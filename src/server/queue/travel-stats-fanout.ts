/**
 * The `travel-stats` fan-out — who a trip write moves statistics for, and which years.
 *
 * Lives in `src/server/queue` rather than beside its first caller, and that placement is the point.
 * It reaches the queue binding through `enqueueDetached`, which imports `#/server/auth/env`, which
 * imports `cloudflare:workers`; a module under `src/routes` is in the client graph, so the moment
 * anything there *exports* a function reaching this code, the client bundle has to resolve that
 * specifier and the build fails.
 * The fan-out was private to `trip-lifecycle.ts` and survived only because nothing exported it. It
 * serves trip lifecycle, membership, content and visited-country writes, so it needs a home
 * outside the route tree rather than a second copy inside it
 * (`docs/SPEC.md` §8).
 *
 * `00-S4` owns what a recompute means; this owns only when one is asked for.
 */

import { createLogger, serializeError } from '#/server/observability'
import { tripMemberUserIds } from '#/server/repos'
import {
  recomputeDelaySeconds,
  travelStatsTaskId,
} from '#/server/queue/handlers/travel-stats'
import { enqueueDetached } from '#/server/queue/enqueue-detached'
import { ALL_TIME_STAT_YEAR, isCalendarStatYear } from '#/server/queue/types'

import type { Trip } from '#/server/db/types'
import type { LogFields, Logger } from '#/server/observability'
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
 * row would otherwise keep counting a trip that has left it. Further dates also cover transport
 * departures before and after a content write.
 *
 * A date, not a trip, so the atlas's visited countries pass their own: the date a country was
 * visited on, and on an undo the date carried by the row being removed. A date whose year is not one
 * the payload schema accepts — `0000-01-01` is still a `YYYY-MM-DD` the input validators let
 * through — contributes no year row rather than an envelope the consumer would refuse.
 */
export function affectedStatYears(
  startDate: string | null | undefined,
  ...otherDates: ReadonlyArray<string | null | undefined>
): Array<number> {
  const years = new Set<number>([ALL_TIME_STAT_YEAR])
  for (const date of [startDate, ...otherDates]) {
    const candidate = yearOf(date)
    if (candidate !== null) {
      years.add(candidate)
    }
  }
  return [...years]
}

/**
 * Asks the queue to rebuild `travel_stats` for a set of travellers, over a set of years.
 *
 * The whole producer, and every decision in it. Three properties, and each is a decision rather than
 * an implementation detail:
 *
 * - **The ids are `00-S4`'s**, so a burst of writes inside one collapse window folds onto one
 *   recompute per `(user, year)` instead of one per write, and the message is held back until that
 *   window has closed, so the recompute that survives the collapse sees every write in it.
 * - **A queue refusal never fails the write.** D1 is the durable record and has already been written
 *   by the time this runs; a stale statistics panel is a much smaller harm than a save that appears
 *   to have failed. `enqueueDetached` owns the catch: logged once, under this producer's own message
 *   and context, and returned from — the same posture `mirrorToRoom` takes.
 * - **It sends everything in one call.** Cloudflare Queues accepts at most `QUEUE_BATCH_MAX`
 *   messages per `sendBatch`, and a trip's membership is bounded by a plan rather than by anything
 *   here; `enqueueTasks` cuts the envelopes at that bound, so this does not.
 *
 * **Who the recipients are is the caller's**, and it is the only thing that varies between the
 * writes that reach this: a trip write fans out to the trip's members (PRD #104 decision 9), an
 * atlas write moves nobody's numbers but the acting traveller's. That is one argument, which is why
 * this is one producer rather than one per call site (`docs/SPEC.md` §8). The ids are expected to
 * arrive deduplicated; a repeated one costs a second envelope that the collapse window would ack as
 * a duplicate anyway.
 *
 * The binding is not this module's to reach: `enqueueDetached` imports `#/server/auth/env` lazily,
 * inside the function rather than at module scope, because that module imports `cloudflare:workers`,
 * a specifier that does not resolve outside workerd, and this module is imported by suites that run
 * in plain Node. It is not reached at all when there is nothing to send.
 *
 * `context` is what the caller's own write is identified by — a trip id, a route — and exists because
 * the one line this can emit is otherwise unattributable: "statistics were not enqueued" for an
 * organization says nothing about *which* of the writes in flight lost them.
 */
export async function requestTravelStatsRecompute(
  scope: TenantScope,
  userIds: ReadonlyArray<string>,
  years: ReadonlyArray<number>,
  context: LogFields = {},
): Promise<void> {
  const orgId = scope.ctx.organizationId

  await enqueueDetached(
    () => {
      const at = Date.now()
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
      return envelopes
    },
    {
      logger: log(),
      message: 'travel statistics were not enqueued',
      context: {
        organizationId: orgId,
        travellers: userIds.length,
        ...context,
      },
    },
  )
}

/**
 * Fans `travel-stats` envelopes out to **the trip's members** for each year the write moved.
 *
 * The recipient set is the trip's members, not the workspace (PRD #104 decision 9). After ADR 0007 a
 * private trip is invisible to a non-member, so its statistics must be too; `00-S4` was amended in
 * the same PRD to count a person's trips by membership, and this only sends to the people that count
 * applies to. Deciding that set is all this adds — everything past it is
 * {@link requestTravelStatsRecompute}'s.
 *
 * `recipients` exists for the one write that destroys its own recipient list: after `deleteTrip` the
 * `trip_members` rows have gone with the cascade, so the delete reads them first and hands them in.
 * Every other caller lets this read them. Either way the ids arrive deduplicated — both come from
 * `tripMemberUserIds`.
 *
 * The member read is guarded in turn, and that guard is this function's own: the producer cannot
 * catch a read it does not make, and a repository that will not answer must no more fail a write D1
 * has already taken than an unreachable queue does.
 */
export async function enqueueTravelStats(
  scope: TenantScope,
  tripId: string,
  years: ReadonlyArray<number>,
  recipients?: ReadonlyArray<string>,
): Promise<void> {
  try {
    const userIds = recipients ?? (await tripMemberUserIds(scope, tripId))
    await requestTravelStatsRecompute(scope, userIds, years, { tripId })
  } catch (cause) {
    log().warn(
      'the members of a trip write could not be read for the statistics fan-out',
      {
        organizationId: scope.ctx.organizationId,
        tripId,
        ...serializeError(cause),
      },
    )
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

/** A content write rebuilds the trip members' roll-ups, including extra departure dates. */
export async function enqueueTripRollup(
  scope: TenantScope,
  trip: Trip,
  otherDates: ReadonlyArray<string | null | undefined> = [],
): Promise<void> {
  await enqueueTravelStats(
    scope,
    trip.id,
    affectedStatYears(trip.startDate, ...otherDates),
  )
}
