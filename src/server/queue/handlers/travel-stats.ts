/**
 * `travel-stats` — rebuilds one traveller's roll-up in `travel_stats`.
 *
 * The panel on `/atlas` reads a derived cache. Before this handler existed
 * nothing in production wrote it: `recomputeTravelStats` had exactly one caller,
 * the dev seeder, so marking a country visited repainted the map and left every
 * number frozen at whatever the fixture had put there.
 *
 * It runs here rather than inline because a recompute is six aggregate queries
 * over the traveller's trips, days, places, expenses and transport legs, and D1
 * bills on rows scanned (`ARCHITECTURE.md` §5). The write path enqueues and
 * returns; the panel catches up on its next read.
 *
 * ## What the envelope may and may not decide
 *
 * The envelope names the organization and the traveller, and nothing else. The
 * organization builds the scope, and every query the repository then runs is
 * `tenantFilter()`-bound to that same organization, so a forged envelope can only
 * rebuild rows its own tenant already owns. The role is not taken from the
 * message either: it is read from `member` inside that tenant, and a message
 * whose user is no longer a member is a permanent failure rather than five
 * retries against a membership that is not coming back.
 */

import { drizzle } from 'drizzle-orm/d1'
import { isOrganizationRole } from '#/server/auth/tenant'
import {
  createScope,
  getMembership,
  listTravelStats,
  recomputeTravelStats,
  upsertTravelStats,
} from '#/server/repos'
import {
  ALL_TIME_STAT_YEAR,
  TaskConfigurationError,
  TaskPermanentError,
} from '../types'

import type { Database, TravelStat } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'
import type {
  TaskBindings,
  TaskContext,
  TaskHandler,
  TaskMetrics,
  TravelStatsPayload,
} from '../types'

/** The D1 binding as `TaskBindings` declares it, without the `undefined`. */
type D1Handle = NonNullable<TaskBindings['DB']>

/**
 * How a D1 binding becomes a Drizzle handle.
 *
 * Injectable, and for a mechanical reason rather than a stylistic one:
 * `src/server/db/client.ts` reads the ambient Worker environment at module
 * scope, so importing `createDb` here would drag `cloudflare:workers` into the
 * consumer's module graph — and `vitest.config.ts` runs the whole server suite
 * in plain Node, where that specifier does not resolve. Importing every queue
 * handler is exactly what `consumer.ts` does. The default below is the same one
 * line `createDb` is; a test hands in the harness's database instead.
 */
export type DatabaseFor = (binding: D1Handle) => Database

/**
 * How long a burst of writes for one traveller and year collapses onto a single
 * recompute.
 *
 * The consumer acks a redelivery of an id it has already completed and keeps
 * that marker for `TASK_DONE_TTL_SECONDS` — a day. So the envelope id cannot be
 * *only* `(user, year)`: the second country a traveller marks would be acked as
 * a duplicate and the panel would freeze again, which is the bug this stage
 * exists to close. The id therefore carries the window the write fell into, and
 * the window is what "deterministic per (user, year)" means in practice: a
 * double-tapped control, a retried request and a handful of quick toggles
 * collapse onto one recompute, and a write after the window gets its own.
 */
export const RECOMPUTE_WINDOW_MS = 10_000

/** Which collapse window an instant falls into. The id and the delay share it. */
function windowOf(at: number): number {
  return Math.floor(at / RECOMPUTE_WINDOW_MS)
}

/**
 * The envelope id for one traveller's year, and the producer's whole idempotency
 * story. Exported because `src/server/queue/travel-stats-fanout.ts` is the only
 * producer and the suites around it assert the exact string.
 */
export function travelStatsTaskId(
  orgId: string,
  userId: string,
  statYear: number,
  at: number,
): string {
  return `travel-stats:${orgId}:${userId}:${statYear}:${windowOf(at)}`
}

/**
 * How long the producer holds a message back, so the one recompute a window
 * collapses onto runs *after* that window closes and therefore sees every write
 * in it. Delivering immediately would rebuild the row from a snapshot the rest
 * of the burst is still being written into, and the writes that lost the
 * collapse would not be reflected until the next one.
 */
export function recomputeDelaySeconds(at: number): number {
  const windowEnd = (windowOf(at) + 1) * RECOMPUTE_WINDOW_MS
  return Math.ceil((windowEnd - at) / 1000)
}

/**
 * Consecutive years of travel, newest first, from the rows the recompute writes.
 *
 * A **traveller's** streak, since the `00-S4` amendment (PRD #104, decision 11):
 * a year row's `tripCount` counts the trips that row's `user_id` is a member of,
 * so consecutive years of travel are that person's own and two members of one
 * workspace who travel separately hold two different streaks.
 *
 * Two things end a run, and both have to, because a year without travel can be
 * recorded either way: a row whose `tripCount` is zero, and a year with no row
 * at all. Counting rows alone would read 2026 and 2024 as a streak of two.
 */
export function yearStreakFrom(rows: ReadonlyArray<TravelStat>): number {
  const years = rows
    .filter((row) => row.statYear > 0 && row.tripCount > 0)
    .map((row) => row.statYear)
    .sort((left, right) => right - left)

  let streak = 0
  let previous: number | null = null
  for (const year of years) {
    if (previous !== null && year !== previous - 1) {
      break
    }
    streak += 1
    previous = year
  }
  return streak
}

/**
 * The scope a recompute runs under: the envelope's organization, the envelope's
 * traveller, and the role that traveller actually holds in that organization.
 *
 * The role is never taken from the message. Reading it needs a scope of its own,
 * so the membership read is made at the lowest privilege there is: `getMembership`
 * is a tenant-filtered `findOne` that asserts no role, so the probe can only ever
 * see the row that decides the real one. A message whose user is no longer a
 * member is a permanent failure rather than five retries against a membership
 * that is not coming back.
 */
async function scopeForTraveller(
  db: Database,
  organizationId: string,
  userId: string,
): Promise<TenantScope> {
  const probe = createScope(db, { userId, organizationId, role: 'member' })
  const membership = await getMembership(probe, userId)
  if (membership === null) {
    throw new TaskPermanentError(
      `User ${userId} is no longer a member of ${organizationId}; travel stats will not be recomputed`,
    )
  }

  return createScope(db, {
    userId,
    organizationId,
    // An unrecognised value in the column resolves to the least privilege,
    // never to "unset, therefore permissive".
    role: isOrganizationRole(membership.role) ? membership.role : 'member',
  })
}

/**
 * Brings the all-time row's streak up to date and answers with it.
 *
 * The streak is not derivable from a single row, so `recomputeTravelStats`
 * cannot write it: it is a property of the year rows read together, and it
 * belongs on the all-time roll-up. `upsertTravelStats` writes through
 * `definedOnly`, so this second call moves that one column and leaves the
 * numbers the recompute just wrote exactly as they are.
 */
async function syncYearStreak(
  scope: TenantScope,
  userId: string,
  allTimeRow: TravelStat,
): Promise<number> {
  const yearStreak = yearStreakFrom(await listTravelStats(scope, userId))
  if (yearStreak !== allTimeRow.yearStreak) {
    await upsertTravelStats(scope, {
      userId,
      statYear: ALL_TIME_STAT_YEAR,
      yearStreak,
    })
  }
  return yearStreak
}

/**
 * Builds the handler over a database seam. {@link handleTravelStats} is the one
 * the consumer registers; a test builds its own against the harness.
 */
export function createTravelStatsHandler(
  databaseFor: DatabaseFor = (binding) => drizzle(binding),
): TaskHandler<'travel-stats'> {
  return async function travelStats(
    payload: TravelStatsPayload,
    context: TaskContext,
  ): Promise<TaskMetrics> {
    const binding = context.env.DB
    if (binding === undefined) {
      throw new TaskConfigurationError(
        'DB binding is not available to the queue consumer; a travel-stats recompute cannot run',
      )
    }

    const { userId, statYear } = payload
    const scope = await scopeForTraveller(
      databaseFor(binding),
      context.orgId,
      userId,
    )

    const row = await recomputeTravelStats(scope, userId, statYear)
    const yearStreak =
      statYear === ALL_TIME_STAT_YEAR
        ? await syncYearStreak(scope, userId, row)
        : row.yearStreak

    context.logger.debug('travel stats recomputed', {
      userId,
      statYear,
      tripCount: row.tripCount,
    })

    return {
      statYear,
      tripCount: row.tripCount,
      countryCount: row.countryCount,
      distanceMetres: row.distanceMetres,
      yearStreak,
    }
  }
}

/** The handler `consumer.ts` registers, over the Worker's own D1 binding. */
export const handleTravelStats = createTravelStatsHandler()
