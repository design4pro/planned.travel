/**
 * Every write that acts on a trip *as a trip* — created, edited, archived, restored.
 *
 * One module rather than four handlers scattered across the read modules, because the four share a
 * side effect and an authorisation story, and both are easier to keep honest in one place:
 *
 * - **Authorisation is the repository's, twice over.** Who may *see* the trip is `requireTrip`, whose
 *   refusal is a `NotFoundError` identical to a foreign tenant's (ADR 0007); who may *change* it is
 *   `assertTripRole`, whose refusal is `FORBIDDEN`. Neither is re-implemented here — these handlers
 *   contribute the tenant scope and a validator, and nothing else. `beforeLoad` guards nothing.
 * - **A write that moves someone's travel statistics fans `travel-stats` envelopes out to the trip's
 *   members** — which is create and edit, and deliberately not archive and restore: `00-S4` counts a
 *   person's trips by membership, and neither shelving a trip nor bringing it back moves a membership
 *   row. See {@link enqueueTravelStats}, whose doc holds the three properties of the fan-out.
 *
 * **No pre-departure-notice code is reachable from this module, and that is deliberate rather than
 * forgotten.** Under `00-S5`'s scan model (ADR 0005) the quarter-hourly sweep reads current rows —
 * `start_date IS NOT NULL AND reminder_days > 0 AND is_archived = 0` — so archiving stops a notice
 * because the scan skips the row, restoring resumes it the same way, and a date edit is what the next
 * scan sees.
 * There is no index to keep in sync and nothing to cancel. A scheduler call added here would be the
 * defect, not the omission of one, which is why `__tests__/trip-lifecycle-side-effects.test.ts`
 * asserts the absence structurally.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  archiveTrip,
  createTrip,
  listTripMembers,
  requireTrip,
  restoreTrip,
  updateTrip,
} from '#/server/repos'
import { createLogger, serializeError } from '#/server/observability'
import { enqueueTasks } from '#/server/queue/jobs'
import {
  recomputeDelaySeconds,
  travelStatsTaskId,
} from '#/server/queue/handlers/travel-stats'
import { ALL_TIME_STAT_YEAR, isCalendarStatYear } from '#/server/queue/types'
import { appScope } from './context'

import type { Logger } from '#/server/observability'
import type { EnqueueInput } from '#/server/queue/jobs'
import type { TenantScope } from '#/server/repos'

/* -------------------------------------------------------------------------------------------------
 * Constants
 * ---------------------------------------------------------------------------------------------- */

/**
 * How many envelopes may go in one `sendBatch`.
 *
 * Cloudflare Queues accepts at most 100 messages per batch, and `enqueueTasks`
 * (`src/server/queue/jobs.ts`) maps every input into one `sendBatch` without chunking — so the bound
 * has to be held by the producer. This producer scales with a trip's membership, which has no product
 * ceiling: the 100-member limit Better Auth's organization plugin is configured with is a
 * configuration value, not a guarantee, and a chunk loop that leaned on it would break the day an
 * operator raised it.
 */
export const QUEUE_BATCH_MAX = 100

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const tripIdSchema = z.string().trim().min(1).max(64)

/** A required, trimmed name. */
const titleSchema = z
  .string()
  .trim()
  .min(1, { error: 'A trip needs a name.' })
  .max(120, { error: 'That name is too long — 120 characters at most.' })

/**
 * Normalises `''` from a form control into the `null` a nullable column wants.
 *
 * On the schema rather than in the handlers, so a validated input *is* the repository's input and
 * no handler re-spells its fields on the way through. A field added to a strict object below then
 * reaches the repository by existing, instead of by a second line being remembered — which would
 * have been a silent omission, every repository field being optional.
 */
function blankToNull(value: string): string | null {
  return value === '' ? null : value
}

/** A trimmed, bounded free-text field. Blank clears the column. */
function textOrBlankSchema(max: number) {
  return z.string().trim().max(max).transform(blankToNull)
}

/** `YYYY-MM-DD`, or the empty string meaning "clear it". */
const dateOrBlankSchema = z
  .union([z.literal(''), z.iso.date()], {
    error: 'Use a calendar date, or leave it empty.',
  })
  .transform(blankToNull)

const currencySchema = z
  .string()
  .trim()
  .length(3, { error: 'A currency is a three-letter ISO code.' })
  .toUpperCase()

/**
 * The rule both trip forms share: a range that ends before it starts is refused at the boundary. A
 * field the patch left out, or left blank, orders against nothing and so passes.
 *
 * Defence in depth — the dialog and the edit sheet each disable their own save button and name the
 * problem on the Return field — so this is what stops a hand-rolled request, never a sentence a
 * reader sees.
 */
function datesInOrder(value: {
  startDate?: string | null
  endDate?: string | null
}): boolean {
  const { startDate, endDate } = value
  if (!startDate || !endDate) {
    return true
  }
  return endDate >= startDate
}

/** Where the refusal above lands, shared by both schemas that carry it. */
const datesOutOfOrder = {
  error: 'The return date cannot be before the departure date.',
  path: ['endDate'],
}

export const createTripInputSchema = z
  .strictObject({
    title: titleSchema,
    destination: textOrBlankSchema(160),
    startDate: dateOrBlankSchema,
    endDate: dateOrBlankSchema,
    currency: currencySchema,
  })
  .refine(datesInOrder, datesOutOfOrder)

/**
 * The edit patch. **Blank clears, `undefined` leaves** — the convention `-server/plan.ts` established
 * and this reuses rather than reinvents. A field the sheet did not touch is simply absent, so an edit
 * of the title can never blank a destination the form never showed.
 */
export const updateTripInputSchema = z
  .strictObject({
    tripId: tripIdSchema,
    title: titleSchema.optional(),
    destination: textOrBlankSchema(160).optional(),
    summary: textOrBlankSchema(280).optional(),
    startDate: dateOrBlankSchema.optional(),
    endDate: dateOrBlankSchema.optional(),
    currency: currencySchema.optional(),
  })
  .refine(datesInOrder, datesOutOfOrder)

export const archiveTripInputSchema = z.strictObject({ tripId: tripIdSchema })
export const restoreTripInputSchema = z.strictObject({ tripId: tripIdSchema })

/* -------------------------------------------------------------------------------------------------
 * Travel statistics — `00-S4`'s obligation on this stage
 * ---------------------------------------------------------------------------------------------- */

/** Memoised per isolate: the logger holds no request state. */
let logger: Logger | undefined

function log(): Logger {
  logger ??= createLogger({ context: { component: 'trip-lifecycle' } })
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
 * The binding is reached inside the function rather than at module scope: `#/server/auth/env` imports
 * `cloudflare:workers`, a specifier that does not resolve outside workerd, and this module is
 * imported by a suite that runs in plain Node.
 */
async function enqueueTravelStats(
  scope: TenantScope,
  tripId: string,
  years: ReadonlyArray<number>,
): Promise<void> {
  const orgId = scope.ctx.organizationId
  const at = Date.now()

  try {
    const members = await listTripMembers(scope, tripId)
    const userIds = [...new Set(members.map((member) => member.userId))]
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

/* -------------------------------------------------------------------------------------------------
 * Server functions
 * ---------------------------------------------------------------------------------------------- */

/**
 * Creates a trip and hands back its id so the caller can navigate straight into the planner.
 *
 * Moved here from `-server/overview.ts`, unchanged in behaviour but no longer alone: it now enqueues
 * the statistics envelopes its three siblings do. Quota, slug reservation, the owner membership and
 * the day run are all the repository's job — this validates, forwards and fans out.
 */
export const createTripFn = createServerFn({ method: 'POST' })
  .validator(createTripInputSchema)
  .handler(async ({ data }): Promise<{ readonly tripId: string }> => {
    const scope = await appScope()
    const trip = await createTrip(scope, data)
    await enqueueTravelStats(scope, trip.id, affectedStatYears(trip.startDate))
    return { tripId: trip.id }
  })

/**
 * Edits a trip's metadata. Owner only, decided in the repository.
 *
 * The day run follows the dates without anything here arranging it: `updateTrip` reconciles it
 * through `syncTripDays` when the range moves, which is why the edit path needs no day handling of
 * its own.
 */
export const updateTripFn = createServerFn({ method: 'POST' })
  .validator(updateTripInputSchema)
  .handler(async ({ data }): Promise<{ readonly tripId: string }> => {
    const scope = await appScope()
    const { tripId, ...patch } = data

    // Read before the write, for one reason: the year a trip *leaves* has to be recomputed as well as
    // the one it arrives in, and only the row as it stood knows which year that was.
    const before = await requireTrip(scope, tripId)
    const trip = await updateTrip(scope, tripId, patch)

    await enqueueTravelStats(
      scope,
      trip.id,
      affectedStatYears(trip.startDate, before.startDate),
    )
    return { tripId: trip.id }
  })

/**
 * Shelves a trip. Owner only.
 *
 * No statistics envelope: an archived trip is still a trip a member has been on, and `00-S4`'s
 * recompute counts membership rather than the archive flag, so nothing it computes has moved.
 */
export const archiveTripFn = createServerFn({ method: 'POST' })
  .validator(archiveTripInputSchema)
  .handler(
    async ({
      data,
    }): Promise<{ readonly tripId: string; readonly isArchived: true }> => {
      const scope = await appScope()
      const trip = await archiveTrip(scope, data.tripId)
      return { tripId: trip.id, isArchived: true }
    },
  )

/** Brings a trip back with the lifecycle status it went in with. Owner only. */
export const restoreTripFn = createServerFn({ method: 'POST' })
  .validator(restoreTripInputSchema)
  .handler(
    async ({
      data,
    }): Promise<{ readonly tripId: string; readonly isArchived: false }> => {
      const scope = await appScope()
      const trip = await restoreTrip(scope, data.tripId)
      return { tripId: trip.id, isArchived: false }
    },
  )
