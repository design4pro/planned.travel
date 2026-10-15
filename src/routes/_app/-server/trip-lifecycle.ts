/**
 * Every write that acts on a trip *as a trip* — created, edited, archived, restored, starred, deleted.
 *
 * One module rather than five handlers scattered across the read modules, because they share a
 * side effect and an authorisation story, and both are easier to keep honest in one place:
 *
 * - **Authorisation is the repository's, twice over.** Who may *see* the trip is `requireTrip`, whose
 *   refusal is a `NotFoundError` identical to a foreign tenant's (ADR 0007); who may *change* it is
 *   `assertTripRole`, whose refusal is `FORBIDDEN`. Neither is re-implemented here — these handlers
 *   contribute the tenant scope and a validator, and nothing else. `beforeLoad` guards nothing. The
 *   star is the one write open to every reader (PRD #104 decision 6), and that too is decided in the
 *   repository: `setFavourite` calls `requireTrip` and no role guard.
 * - **A write that moves someone's travel statistics fans `travel-stats` envelopes out to the trip's
 *   members** — which is create, edit and delete, and deliberately not archive, restore or favourite:
 *   `00-S4` counts a person's trips by membership, and neither shelving a trip, bringing it back, nor
 *   bookmarking it moves a membership row. See {@link enqueueTravelStats}, whose doc holds the three
 *   properties of the fan-out.
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
  assertTripRole,
  countTripReservationsByStatus,
  createTrip,
  deleteTrip,
  getFile,
  getTripSpendSummary,
  listTripStorageKeys,
  requireTrip,
  restoreTrip,
  setFavourite,
  startTripCopy,
  summariseTripTransports,
  tripMemberUserIds,
  updateTrip,
  NotFoundError,
  RepositoryError,
} from '#/server/repos'
import { createLogger, serializeError } from '#/server/observability'
import { QUEUE_BATCH_MAX, enqueueTask, enqueueTasks } from '#/server/queue/jobs'
import {
  affectedStatYears,
  enqueueTravelStats,
} from '#/server/queue/travel-stats-fanout'
import { tripCopyTaskId } from '#/server/queue/handlers/trip-copy'
import { tripPurgeTaskId } from '#/server/queue/handlers/trip-purge'
import { MAX_PURGE_KEYS } from '#/server/queue/types'
import { listExportKeys } from '#/server/storage/export-artifacts'
import { TRIP_DAY_COUNT_MAX } from '#/lib/trip-dates'
import { coverUrlFor, isCoverContentType } from '#/lib/trip-cover'
import { appScope } from './context'

import type { Logger } from '#/server/observability'
import type { EnqueueInput } from '#/server/queue/jobs'
import type { Trip } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'

/* -------------------------------------------------------------------------------------------------
 * Constants
 * ---------------------------------------------------------------------------------------------- */

/**
 * How many envelopes may go in one `sendBatch`, re-exported from the module that owns the bound.
 *
 * It applies here because {@link enqueueTripPurge} scales with the objects a trip owns, which has no
 * product ceiling: `files` is `UNLIMITED` on the business tier, and a chunk loop that leaned on a
 * plan's number would break the day an operator raised it. It is declared beside `enqueueTasks`
 * rather than here because the `trip-copy` handler and the statistics fan-out chunk the same way and
 * three spellings of one limit is two too many.
 */
export { QUEUE_BATCH_MAX } from '#/server/queue/jobs'

/**
 * Where the delete confirmation stops being a formality (PRD #104 decision 10).
 *
 * A trip past either of these has to have its name typed out; below both, an absent `confirmTitle` is
 * accepted and the dialog is one paragraph and two buttons. The ceremony should match the loss, and
 * the loss is what the trip *carries*: a two-day sketch nobody else is on is worth one click, a year
 * of bookings and a shared plan is not.
 *
 * Named and exported so the rule has one spelling. The **server** applies it — {@link deleteTripFn}
 * re-derives it from the trip's own counts on every call — so a client that skipped the dialog
 * entirely still meets it.
 */
export const DELETE_CONFIRM_THRESHOLD = {
  /** Any record at all: one booking, one leg, one expense or one file. */
  records: 0,
  /** More than the owner alone. A trip with company is somebody else's plan too. */
  members: 1,
} as const

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

/**
 * A date range and a duration are one fact with two faces, so a request carries one of them: a day
 * count beside either date is refused. The form never sends both; this is what stops a hand-rolled
 * request from making the trip's length ambiguous.
 */
function durationXorDates(value: {
  startDate?: string | null
  endDate?: string | null
  dayCount?: number
}): boolean {
  return value.dayCount === undefined || (!value.startDate && !value.endDate)
}

const durationWithDates = {
  error: 'Give either dates or a number of days, not both.',
  path: ['dayCount'],
}

/** Days before departure, as the trip row stores them; `0` is no reminder. */
const reminderDaysSchema = z.number().int().min(0).max(365)

export const createTripInputSchema = z
  .strictObject({
    title: titleSchema,
    summary: textOrBlankSchema(280).optional(),
    destination: textOrBlankSchema(160),
    startDate: dateOrBlankSchema,
    endDate: dateOrBlankSchema,
    /** How many undated days to create; refused when either date is present. */
    dayCount: z.number().int().min(1).max(TRIP_DAY_COUNT_MAX).optional(),
    currency: currencySchema,
    reminderDays: reminderDaysSchema.optional(),
  })
  .refine(datesInOrder, datesOutOfOrder)
  .refine(durationXorDates, durationWithDates)

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
    reminderDays: reminderDaysSchema.optional(),
    /**
     * The file that becomes the cover, or `null` to clear it. A file id and never a key or a URL: the
     * server resolves the file inside the caller's workspace and derives both from it, so a client
     * cannot point a trip at an object it does not own. Optional like every field of this patch, so a
     * tab loaded before this shipped keeps saving.
     */
    coverFileId: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .refine(datesInOrder, datesOutOfOrder)

export const tripDeleteSummaryInputSchema = z.strictObject({
  tripId: tripIdSchema,
})

/**
 * The terminal delete. `confirmTitle` is **optional here and required by the handler**, because
 * whether it is required is a property of the trip rather than of the request: a strict schema that
 * demanded it always would make the light dialog a lie, and one that never did would put the
 * threshold in the browser. It is compared to the trip's own title on the server, once the counts are
 * in — see {@link deleteTripFn}.
 */
export const deleteTripInputSchema = z.strictObject({
  tripId: tripIdSchema,
  confirmTitle: z.string().trim().max(120).optional(),
})

export const archiveTripInputSchema = z.strictObject({ tripId: tripIdSchema })
export const restoreTripInputSchema = z.strictObject({ tripId: tripIdSchema })

/**
 * The state the reader is asking for, not a toggle.
 *
 * A `toggleFavourite` would read the current row and invert it, so a double click — or a retry of a
 * request that in fact succeeded — would land back where it started. Sending the wanted state makes
 * the write idempotent end to end, which is what an optimistic control needs.
 */
export const setTripFavouriteInputSchema = z.strictObject({
  tripId: tripIdSchema,
  isFavourite: z.boolean(),
})

/**
 * What the copy dialog may change: the name and the range, and nothing else (PRD #104 decision 4a).
 *
 * **Both dates or neither.** A half-open range is what a clear-dates control produces if it is
 * allowed to clear one side, and the queue consumer that reads this back is in no position to ask
 * which end was meant. An undated copy is a template; a copy dated at one end is a mistake.
 *
 * Absent rather than blank, unlike the two schemas above: those patch a trip that exists and need a
 * spelling for "clear this column", whereas this describes a trip that does not exist yet, where
 * "no dates" is simply the absence of them.
 */
export const copyTripInputSchema = z
  .strictObject({
    tripId: tripIdSchema,
    title: titleSchema,
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
  })
  .refine(
    (value) =>
      (value.startDate === undefined) === (value.endDate === undefined),
    { error: 'Set both dates, or clear them both.', path: ['endDate'] },
  )
  .refine(datesInOrder, datesOutOfOrder)

/** Memoised per isolate: the logger holds no request state. */
let logger: Logger | undefined

function log(): Logger {
  logger ??= createLogger({ context: { component: 'trip-lifecycle' } })
  return logger
}

/* -------------------------------------------------------------------------------------------------
 * Deleting a trip — what it carries, and what it leaves in the bucket
 * ---------------------------------------------------------------------------------------------- */

/** What the delete dialog names, and what {@link DELETE_CONFIRM_THRESHOLD} is applied to. */
export interface TripDeleteSummary {
  readonly tripId: string
  /** The trip's own title — the string a confirmation has to match, character for character. */
  readonly title: string
  readonly reservations: number
  readonly transports: number
  readonly expenses: number
  readonly files: number
  readonly members: number
  /**
   * Whether the title has to be typed. **The server's answer**, carried on the payload so the client
   * renders the rule rather than re-deriving it; {@link deleteTripFn} asks the same question again of
   * the same counts, so a client that ignored this cannot skip the ceremony.
   */
  readonly requiresTitle: boolean
}

/**
 * Everything the delete path needs about a trip, read once.
 *
 * Exported because it is the seam both server functions sit on and the one place `requiresTitle` is
 * decided: a handler's return value is discarded outside a Start build, so this is where the
 * threshold can be asserted against a real database rather than against a re-derivation of it.
 *
 * Both callers need the same reads, so there is one function: the summary function returns the
 * counts, and the delete needs the counts *plus* the two things that stop existing the moment the
 * cascade runs — the storage keys of the objects the trip owns, and who its members were.
 *
 * Every count is an aggregate rather than a list taken by its length: `countTripReservationsByStatus`,
 * `summariseTripTransports` and `getTripSpendSummary` already group in SQL. The file count is the one
 * exception and is free — the delete has to read those keys anyway.
 */
export async function readTripForDelete(
  scope: TenantScope,
  tripId: string,
): Promise<{
  readonly trip: Trip
  readonly summary: TripDeleteSummary
  readonly storageKeys: ReadonlyArray<string>
  readonly memberIds: ReadonlyArray<string>
}> {
  // The two guards in the order every trip write needs them, before anything is counted: a caller who
  // may not see the trip learns nothing, and only then is "not yours to do" safe to say.
  const trip = await requireTrip(scope, tripId)
  await assertTripRole(scope, tripId, ['owner'])

  const [bookings, byMode, spend, storageKeys, memberIds] = await Promise.all([
    countTripReservationsByStatus(scope, tripId),
    summariseTripTransports(scope, tripId),
    getTripSpendSummary(scope, tripId),
    listTripStorageKeys(scope, tripId),
    tripMemberUserIds(scope, tripId),
  ])

  const reservations = bookings.reduce((total, row) => total + row.value, 0)
  const transports = byMode.reduce((total, row) => total + row.count, 0)
  const records =
    reservations + transports + spend.expenseCount + storageKeys.length

  return {
    trip,
    storageKeys,
    memberIds,
    summary: {
      tripId,
      title: trip.title,
      reservations,
      transports,
      expenses: spend.expenseCount,
      files: storageKeys.length,
      members: memberIds.length,
      requiresTitle:
        records > DELETE_CONFIRM_THRESHOLD.records ||
        memberIds.length > DELETE_CONFIRM_THRESHOLD.members,
    },
  }
}

/**
 * Refuses the delete unless the reader typed the trip's name, when the trip has earned that.
 *
 * Thrown as a **Zod** failure rather than as a `RepositoryError`, and that is the difference between
 * a sentence and a redaction envelope: `classifyFailure` (`src/server/errors/public.ts`) passes a
 * validation message through to the browser intact and puts every `RepositoryError` in `unexpected`,
 * where the message is logged and withheld. The reader has to be told what to type.
 *
 * No `z.literal` on the input schema — the title is not knowable when the schema is declared, and a
 * comparison that lived in the browser would be a comparison an attacker could delete.
 */
function assertConfirmed(summary: TripDeleteSummary, confirmTitle?: string) {
  if (!summary.requiresTitle) {
    return
  }
  z.string()
    .refine((value) => value === summary.title, {
      error: `This trip carries bookings, money, files or other people. Type its name — ${summary.title} — to delete it.`,
    })
    .parse(confirmTitle ?? '')
}

/**
 * The keys of the exports a deleted trip left in the bucket.
 *
 * Its own `try`, because a listing that fails (the binding, R2) must cost the exports only: the purge
 * goes on with the keys D1 holds, the delete is not failed and the attachment purge is not dropped.
 * `databaseKeys` is how many of those there are, so the warning says what the purge still carries.
 */
async function listTripExportKeys(
  orgId: string,
  tripId: string,
  databaseKeys: number,
): Promise<Array<string>> {
  try {
    const { filesBucket } = await import('#/server/fns/context')
    return await listExportKeys(filesBucket(), orgId, tripId)
  } catch (cause) {
    log().warn(
      'the exports of a deleted trip could not be listed for the purge',
      {
        organizationId: orgId,
        tripId,
        keys: databaseKeys,
        ...serializeError(cause),
      },
    )
    return []
  }
}

/**
 * Hands the objects a deleted trip owned to the `trip-purge` handler.
 *
 * Three properties:
 *
 * - **It never fails the delete.** D1 is the record and has already been written; a queue that is
 *   unreachable leaves objects in the bucket, which is a sweep job, where a save that appears to have
 *   failed is a reader deleting the same trip twice. Caught, logged once, returned from — the posture
 *   the statistics fan-out already takes.
 * - **It chunks.** `files` is `UNLIMITED` on the business tier, so the key list has no product bound,
 *   and a Queues message body is capped at 128 KB. {@link MAX_PURGE_KEYS} keys per envelope,
 *   {@link QUEUE_BATCH_MAX} envelopes per `sendBatch`.
 * - **Each chunk's id is deterministic on it.** Two chunks sharing one id would see the second acked
 *   as a duplicate of the first and its objects left in the bucket for good.
 *
 * `keys` is what D1 knows (attachments, cover). The trip's exports are not a row, so they are listed
 * from the bucket under the caller's own organization and the trip the delete was authorised for,
 * and added to the same list — before the empty-list return, because a trip whose only objects are
 * exports must not be skipped. Once the trip is gone no request can run the export prune for it.
 */
async function enqueueTripPurge(
  scope: TenantScope,
  tripId: string,
  keys: ReadonlyArray<string>,
): Promise<void> {
  const orgId = scope.ctx.organizationId
  const exportKeys = await listTripExportKeys(orgId, tripId, keys.length)
  // A blank string names no object, and one would fail `tripPurgePayloadSchema` inside the `try`
  // below — taking every real key of the same trip down with it, silently.
  const unique = [...new Set([...keys, ...exportKeys])].filter(
    (key) => key !== '',
  )
  if (unique.length === 0) {
    return
  }

  try {
    const envelopes: Array<EnqueueInput<'trip-purge'>> = []
    for (let index = 0; index < unique.length; index += MAX_PURGE_KEYS) {
      const chunk = index / MAX_PURGE_KEYS
      envelopes.push({
        kind: 'trip-purge',
        orgId,
        id: tripPurgeTaskId(tripId, chunk),
        payload: { keys: unique.slice(index, index + MAX_PURGE_KEYS) },
      })
    }

    const { taskQueue } = await import('#/server/auth/env')
    const queue = taskQueue()
    for (let index = 0; index < envelopes.length; index += QUEUE_BATCH_MAX) {
      await enqueueTasks(queue, envelopes.slice(index, index + QUEUE_BATCH_MAX))
    }
  } catch (cause) {
    log().warn('the storage purge for a deleted trip was not enqueued', {
      organizationId: orgId,
      tripId,
      keys: unique.length,
      ...serializeError(cause),
    })
  }
}

/**
 * Hands the source's inventory to the `trip-copy` handler.
 *
 * **This is the one enqueue in this module that fails its write**, and it compensates before it
 * does. Every other producer here is a follow-up to a record D1 already holds, so a queue that is
 * unreachable costs a stale panel or some objects left in a bucket. This one *is* the other half:
 * without the message the target keeps a `copy_pending_at` no consumer will ever clear, which is a
 * tile stuck on "Copying" for good and a `wrangler d1 execute` to repair. Deleting the empty target
 * and telling the reader the copy did not start is the smaller harm, and the only recoverable one.
 *
 * The envelope id is deterministic on the **target**, which {@link startTripCopy} has just minted and
 * which cannot repeat: a redelivery is one job, and a second Copy on the same source is a different
 * trip and a different envelope.
 */
async function enqueueTripCopy(
  scope: TenantScope,
  sourceTripId: string,
  targetTripId: string,
): Promise<void> {
  try {
    const { taskQueue } = await import('#/server/auth/env')
    await enqueueTask(taskQueue(), {
      kind: 'trip-copy',
      orgId: scope.ctx.organizationId,
      id: tripCopyTaskId(targetTripId),
      payload: {
        sourceTripId,
        targetTripId,
        requestedBy: scope.ctx.userId,
      },
    })
  } catch (cause) {
    log().error(
      'a trip copy was not enqueued; the target was rolled back',
      cause,
      {
        organizationId: scope.ctx.organizationId,
        tripId: targetTripId,
      },
    )
    // The compensation is guarded in turn: a failed rollback must not replace the reader's error
    // with one about the rollback, and the trip it leaves behind is the state this branch is
    // already reporting.
    try {
      await deleteTrip(scope, targetTripId)
    } catch (rollback) {
      log().error(
        'the target of a copy that was never enqueued could not be removed',
        rollback,
        { tripId: targetTripId },
      )
    }
    throw cause
  }
}

/* -------------------------------------------------------------------------------------------------
 * Server functions
 * ---------------------------------------------------------------------------------------------- */

/**
 * Copies a trip. Open to every reader (PRD #104 decision 6) — `requireTrip` inside
 * {@link startTripCopy} is the whole check, and there is no role guard here or there.
 *
 * The write is split on the bound, not on the table. What is O(1) in the source's size happens
 * inside this call, so the reader gets a trip id and a quota refusal in one round trip; what scales
 * with the source's inventory is the `trip-copy` handler's, because `places` is `UNLIMITED` on every
 * paid tier and duplicating one is an unbounded write.
 *
 * Three steps, and their order is the contract:
 *
 * 1. **Mint the target.** The trip row, the caller's `owner` membership, the day run when the copy
 *    is dated, and the `copy_pending_at` stamp that marks it as still being built.
 * 2. **Enqueue the inventory.** Unlike every other producer in this module, a refusal here fails the
 *    call and rolls the target back — see {@link enqueueTripCopy}.
 * 3. **Fan the statistics out.** The copier's own trip count has moved already, on a trip they are
 *    the only member of; the handler fans them out again when the inventory lands, and the
 *    deterministic ids collapse the pair.
 */
export const copyTripFn = createServerFn({ method: 'POST' })
  .validator(copyTripInputSchema)
  .handler(
    async ({
      data,
    }): Promise<{ readonly tripId: string; readonly copyPending: true }> => {
      const scope = await appScope()
      const { tripId, ...input } = data

      const targetTripId = await startTripCopy(scope, tripId, input)
      await enqueueTripCopy(scope, tripId, targetTripId)
      await enqueueTravelStats(
        scope,
        targetTripId,
        affectedStatYears(input.startDate),
      )

      return { tripId: targetTripId, copyPending: true }
    },
  )

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
 * Closes every socket in the trip's room after the trip was archived, restored or deleted, so an
 * open tab goes back through the connect handler instead of keeping the role it connected with.
 *
 * The bridge is reached at call time for the reason `taskQueue` is above: `#/server/fns/context`
 * imports `cloudflare:workers`, which a route module's static graph must not. A room that cannot be
 * reached is logged inside the helper and never fails the write.
 */
async function evictRoom(scope: TenantScope, tripId: string): Promise<void> {
  const { closeRoom } = await import('#/server/fns/context')
  await closeRoom(scope, tripId)
}

/** The two columns a cover is: the object it is stored as, and the URL a browser reads it from. */
export interface TripCoverPatch {
  readonly coverImageKey: string | null
  readonly coverImageUrl: string | null
}

/**
 * What a cover-file reference turns into: the key and the URL, derived here and never taken from the
 * client (`null` clears both).
 *
 * Exported for the reason {@link readTripForDelete} is: a handler's return value is discarded outside
 * a Start build, so the derivation is asserted against a real database through this.
 *
 * Four refusals, in this order, and the order is the point:
 *
 * 1. **The trip, then the role.** An editor or a viewer is refused before the file is looked at, so
 *    a reference they are not allowed to make cannot be used to probe which file ids exist.
 * 2. **The file, in the caller's workspace.** `getFile` is tenant-scoped, so an id from another
 *    workspace is not there - `NotFoundError`, the same answer as an id that never existed.
 * 3. **The file, on this trip.** One from another trip of the same workspace is refused alike: a
 *    cover is served to every reader of the trip, and a file attached to a private trip must not be
 *    published to another by naming it.
 * 4. **An image the cover route will serve.** `isCoverContentType` is the route's own list.
 *
 * `origin` is the configured app origin, passed in because reading it reaches `cloudflare:workers`.
 */
export async function coverPatchFor(
  scope: TenantScope,
  tripId: string,
  fileId: string | null,
  origin: string,
): Promise<TripCoverPatch> {
  await requireTrip(scope, tripId)
  await assertTripRole(scope, tripId, ['owner'])

  if (fileId === null) {
    return { coverImageKey: null, coverImageUrl: null }
  }

  const file = await getFile(scope, fileId)
  if (file === null || file.tripId !== tripId) {
    throw new NotFoundError('file', fileId)
  }
  if (!isCoverContentType(file.contentType)) {
    throw new RepositoryError(
      'That file is not an image a cover can use.',
      'COVER_FILE_REFUSED',
    )
  }
  return {
    coverImageKey: file.storageKey,
    coverImageUrl: coverUrlFor(origin, tripId, file.id),
  }
}

/**
 * Edits a trip's metadata. Owner only, decided in the repository.
 *
 * A `coverFileId` makes the file the cover (`null` clears it) through {@link coverPatchFor}, which
 * derives the key and the URL itself.
 *
 * The day run follows the dates without anything here arranging it: `updateTrip` reconciles it
 * through `syncTripDays` when the range moves, which is why the edit path needs no day handling of
 * its own.
 */
export const updateTripFn = createServerFn({ method: 'POST' })
  .validator(updateTripInputSchema)
  .handler(async ({ data }): Promise<{ readonly tripId: string }> => {
    const scope = await appScope()
    const { tripId, coverFileId, ...patch } = data

    // Read before the write, for one reason: the year a trip *leaves* has to be recomputed as well as
    // the one it arrives in, and only the row as it stood knows which year that was.
    const before = await requireTrip(scope, tripId)
    const cover =
      coverFileId === undefined
        ? {}
        : await coverPatchFor(
            scope,
            tripId,
            coverFileId,
            // At call time: `#/server/auth/env` reaches `cloudflare:workers`, which a route
            // module's static graph must not (see `taskQueue` above).
            (await import('#/server/auth/env')).appUrl(),
          )
    const trip = await updateTrip(scope, tripId, { ...patch, ...cover })

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
      await evictRoom(scope, trip.id)
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
      await evictRoom(scope, trip.id)
      return { tripId: trip.id, isArchived: false }
    },
  )

/**
 * Stars or unstars a trip for the caller, and nobody else (PRD #104 decision 5).
 *
 * Open to every reader of the trip, and no travel-statistics envelope: a bookmark moves no dates and
 * no membership, so nothing `00-S4` computes has changed. Echoes the state back rather than reading
 * the row again — the repository's write is idempotent, so the answer is the request.
 */
export const setTripFavouriteFn = createServerFn({ method: 'POST' })
  .validator(setTripFavouriteInputSchema)
  .handler(
    async ({
      data,
    }): Promise<{
      readonly tripId: string
      readonly isFavourite: boolean
    }> => {
      const scope = await appScope()
      await setFavourite(scope, data.tripId, data.isFavourite)
      return { tripId: data.tripId, isFavourite: data.isFavourite }
    },
  )

/**
 * What a delete would take, so the dialog can say so before it is pressed.
 *
 * A read, so `GET`. Owner-only like the delete itself — a reader who cannot delete the trip has no
 * business being handed an inventory of it — and it is the same `readTripForDelete` the write runs,
 * so the two can never disagree about the threshold.
 */
export const tripDeleteSummaryFn = createServerFn({ method: 'GET' })
  .validator(tripDeleteSummaryInputSchema)
  .handler(async ({ data }): Promise<TripDeleteSummary> => {
    const scope = await appScope()
    return (await readTripForDelete(scope, data.tripId)).summary
  })

/**
 * Deletes a trip for good. Owner only, and there is no undo — the archive is the undo
 * (PRD #104 decision 3).
 *
 * The order matters and every step of it is load-bearing:
 *
 * 1. **Read, then guard, then count.** `readTripForDelete` does all three, in that order.
 * 2. **Apply the graduated confirmation** (decision 10) to the counts it just read, not to anything
 *    the client claimed about them.
 * 3. **Delete the rows.** D1 cascades, and that is the durable record of what happened.
 * 4. **Enqueue the sweep.** R2 does not cascade, so the objects the trip owned — its attachments, its
 *    cover and the exports it made — are handed to `trip-purge`. The delete never waits on it and a
 *    queue failure never surfaces.
 * 5. **Fan the statistics out** to the members read in step 1 — after the cascade there is nobody
 *    left to read.
 * 6. **Close the trip's room.** Last, because it awaits a Durable Object round trip that has no
 *    timeout and must not hold up the durable steps above; it logs and never fails the request.
 */
export const deleteTripFn = createServerFn({ method: 'POST' })
  .validator(deleteTripInputSchema)
  .handler(async ({ data }): Promise<{ readonly deleted: true }> => {
    const scope = await appScope()
    const { trip, summary, storageKeys, memberIds } = await readTripForDelete(
      scope,
      data.tripId,
    )
    assertConfirmed(summary, data.confirmTitle)

    const keys = [
      ...storageKeys,
      ...(trip.coverImageKey === null ? [] : [trip.coverImageKey]),
    ]

    await deleteTrip(scope, trip.id)
    await enqueueTripPurge(scope, trip.id, keys)
    await enqueueTravelStats(
      scope,
      trip.id,
      affectedStatYears(trip.startDate),
      memberIds,
    )
    await evictRoom(scope, trip.id)

    return { deleted: true }
  })
