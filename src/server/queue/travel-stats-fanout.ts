/**
 * The `travel-stats` fan-out — who a trip write moves statistics for, and which years.
 *
 * Lives in `src/server/queue` rather than beside its first caller, and that placement is the point.
 * It reaches the queue binding through `#/server/auth/env`, which imports `cloudflare:workers`; a
 * module under `src/routes` is in the client graph, so the moment anything there *exports* a
 * function reaching this code, the client bundle has to resolve that specifier and the build fails.
 * The fan-out was private to `trip-lifecycle.ts` and survived only because nothing exported it. It
 * now has two callers — the trip lifecycle and `01-S6a`'s membership writes — so it needed a home
 * outside the route tree rather than a second copy inside it (`docs/SPEC.md` §8).
 *
 * `00-S4` owns what a recompute means; this owns only when one is asked for.
 */

import { createLogger, serializeError } from '#/server/observability'
import { tripMemberUserIds } from '#/server/repos'
import {
  recomputeDelaySeconds,
  travelStatsTaskId,
} from '#/server/queue/handlers/travel-stats'
import { QUEUE_BATCH_MAX, enqueueTasks } from '#/server/queue/jobs'
import { ALL_TIME_STAT_YEAR, isCalendarStatYear } from '#/server/queue/types'

import type { Trip } from '#/server/db/types'
import type { Logger } from '#/server/observability'
import type { EnqueueInput } from '#/server/queue/jobs'
import type { TenantScope } from '#/server/repos'

/** Memoised per isolate: the logger holds no request state. */
let logger: Logger | undefined

function log(): Logger {
  logger ??= createLogger({ context: { component: 'travel-stats-fanout' } })
  return logger
}

/** `null`/`undefined`, or a date whose year the payload schema would refuse, contributes no year. */
function yearOf(date: string | null | undefined): number | null {
  const year = typeof date === 'string' ? Number(date.slice(0, 4)) : Number.NaN
  return isCalendarStatYear(year) ? year : null
}

/**
 * The stat years one trip write can have moved: the all-time roll-up always, the year the trip starts
 * in when it has one, and — on an edit that moved the range — the year it *used* to start in, whose
 * row would otherwise keep counting a trip that has left it.
 */
export function affectedStatYears(
  startDate: string | null | undefined,
  previousStartDate?: string | null,
): Array<number> {
  const years = new Set<number>([ALL_TIME_STAT_YEAR])
  for (const candidate of [yearOf(startDate), yearOf(previousStartDate)]) {
    if (candidate !== null) {
      years.add(candidate)
    }
  }
  return [...years]
}

/**
 * Fans `travel-stats` envelopes out to **the trip's members** for each year the write moved.
 *
 * Three properties, and each is a decision rather than an implementation detail:
 *
 * - **The recipient set is the trip's members, not the workspace** (PRD #104 decision 9). After
 *   ADR 0007 a private trip is invisible to a non-member, so its statistics must be too; `00-S4` was
 *   amended in the same PRD to count a person's trips by membership, and this only sends to the
 *   people that count applies to.
 * - **The ids are `00-S4`'s**, so a burst of writes inside one collapse window folds onto one
 *   recompute per `(user, year)` instead of one per write.
 * - **A queue refusal never fails the write.** D1 is the durable record and has already been written
 *   by the time this runs; a stale statistics panel is a much smaller harm than a save that appears
 *   to have failed. Caught, logged once, and returned from — the same posture `mirrorToRoom` takes.
 *
 * `recipients` exists for the one write that destroys its own recipient list: after `deleteTrip` the
 * `trip_members` rows have gone with the cascade, so the delete reads them first and hands them in.
 * Every other caller lets this read them. Either way the ids arrive deduplicated — both come from
 * `tripMemberUserIds`.
 *
 * The binding is reached inside the function rather than at module scope: `#/server/auth/env` imports
 * `cloudflare:workers`, a specifier that does not resolve outside workerd, and this module is
 * imported by a suite that runs in plain Node.
 */
export async function enqueueTravelStats(
  scope: TenantScope,
  tripId: string,
  years: ReadonlyArray<number>,
  recipients?: ReadonlyArray<string>,
): Promise<void> {
  const orgId = scope.ctx.organizationId
  const at = Date.now()

  try {
    const userIds = recipients ?? (await tripMemberUserIds(scope, tripId))
    const envelopes: Array<EnqueueInput<'travel-stats'>> = []
    for (const userId of userIds) {
      for (const statYear of years) {
        envelopes.push({
          kind: 'travel-stats',
          orgId,
          id: travelStatsTaskId(orgId, userId, statYear, at),
          payload: { userId, statYear },
          delaySeconds: recomputeDelaySeconds(at),
        })
      }
    }
    if (envelopes.length === 0) {
      return
    }

    const { taskQueue } = await import('#/server/auth/env')
    const queue = taskQueue()
    for (let index = 0; index < envelopes.length; index += QUEUE_BATCH_MAX) {
      await enqueueTasks(queue, envelopes.slice(index, index + QUEUE_BATCH_MAX))
    }
  } catch (cause) {
    log().warn('travel statistics were not enqueued for a trip write', {
      organizationId: orgId,
      tripId,
      ...serializeError(cause),
    })
  }
}

/**
 * The statistics fan-out, for a membership change rather than a trip write.
 *
 * A membership change is a statistics write (PRD #104 decision 11): the person added or removed has
 * a different trip count now, and nobody else does. So this takes the recipients rather than reading
 * them — the added person is not yet a member when the add is enqueued, and the removed one is no
 * longer one.
 *
 * Deliberately a wrapper and not a second implementation. {@link enqueueTravelStats} carries three
 * decisions in its doc comment — the recipient set, the collapsing envelope ids, and a queue refusal
 * never failing the write — and `docs/SPEC.md` §8 gives a concept one owner. This adds no arithmetic
 * of its own, which is why the fan-out's behaviour is unchanged by its existence.
 */
export async function enqueueTripStatsFor(
  scope: TenantScope,
  trip: Trip,
  recipients: ReadonlyArray<string>,
): Promise<void> {
  await enqueueTravelStats(
    scope,
    trip.id,
    affectedStatYears(trip.startDate),
    recipients,
  )
}
