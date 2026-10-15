/**
 * The confirmation import's three verbs: start one, look at what was read, keep what was right.
 *
 * The request path writes nothing and waits for nothing. `startBookingImportFn` resolves the file
 * through the tenant-scoped repository and hands one envelope to the queue; the engine stages its
 * answer in KV; `getBookingImportFn` reads it back; `confirmBookingImportFn` is the **only** writer.
 * Nothing a machine read reaches D1 until a person has pressed a button beside it (ADR 0012).
 *
 * Three properties are deliberate, and each one is a trust boundary rather than a convenience:
 *
 * - **The client sends a file id, never a storage key.** A storage key from a browser is a path
 *   into a bucket shared by every tenant. The key, the filename and the format all come off the
 *   row `getFile` resolved inside the caller's own scope.
 * - **A job id is not an authorisation.** KV is one flat namespace with no tenant filter of its
 *   own, so both job-id paths compare the staged record's `orgId` and `tripId` against the scope
 *   the caller just proved. A record that fails that comparison is answered as if it did not exist.
 * - **The staged row becomes a booking here and nowhere else.** The client sends indices, so the
 *   type, the dates, the times and the price a row is written with are this module's to decide —
 *   which is also why {@link bookingImportDrafts} is what the review list renders: the reader sees
 *   the row the confirm would write, not a second reading of it.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { createTranslator, loadCatalogue } from '#/lib/i18n/catalogue'
import { DEFAULT_LOCALE } from '#/lib/i18n/locales'
import { negotiate } from '#/lib/i18n/negotiate'
import { dayKeyIn, resolveTimeZone } from '#/lib/time'
import { taskQueue } from '#/server/auth/env'
import { resolveLimitsFromRow } from '#/server/billing/limits'

import { IMPORT_REFUSAL_CODES } from '#/server/extract/document'
import { geocodeRuntime } from '#/server/geo/bindings'
import { forwardGeocode } from '#/server/geo/geocode'
import { createLogger, serializeError } from '#/server/observability'
import {
  MAX_IMPORT_RESERVATIONS,
  RESERVATION_KINDS,
  STAGED_IMPORT_TTL_SECONDS,
  stagedImportKey,
} from '#/server/queue/handlers/booking-import'
import { enqueueTask } from '#/server/queue/jobs'
import {
  NotFoundError,
  assertBookingRole,
  createAccommodation,
  createPlace,
  createReservation,
  getFile,
  getOrganizationSettings,
  getSubscription,
  listTripDays,
  listTripPlaces,
  markReservationsImported,
  requireTrip,
  updateFile,
  updatePlace,
} from '#/server/repos'
import { appScope, importStore, mirrorToRoom, patch } from './context'
import { MAX_IMPORT_FILES, importFormatFor } from './file-policy'
import { syncReservationExpense } from './reservations'

import type { RESERVATION_TYPES } from '#/server/db/schema'
import type { Day, Reservation, Trip } from '#/server/db/types'
import type { TripPatch } from '#/server/do'
import type { ImportRefusalCode } from '#/server/extract/document'
import type { GeocodeRuntimeOptions } from '#/server/geo/bindings'
import type { GeocodeRuntime } from '#/server/geo/geocode'
import type {
  ReservationKind,
  StagedImport,
  StagedReservation,
} from '#/server/queue/handlers/booking-import'
import type { TaskQueue } from '#/server/queue/types'
import type { Logger } from '#/server/observability'
import type { TenantScope } from '#/server/repos'

/* ------------------------------------------------------------------- inputs */

const tripId = z.string().trim().min(1).max(64)
const rowId = z.string().trim().min(1).max(64)
/** As long as the envelope id this module builds, because that is what it is. */
const jobId = z.string().trim().min(1).max(128)

/**
 * How far apart the files of one drop are started.
 *
 * Cloudflare Queues offers no per-key ordering and this feature declares no table to build one, so
 * five files are enqueued in one act and spaced out instead: one large document cannot starve the
 * others, a closed tab strands nothing, and no new state exists anywhere. The imprecision is
 * stated rather than hidden — a file that takes longer than its budget overlaps the next one, and
 * two concurrent extractions for one workspace is not starvation.
 */
export const EXTRACTION_BUDGET_SECONDS = 20

export const startBookingImportInputSchema = z.object({
  tripId,
  fileId: rowId,
  /**
   * Where this file sat in the drop, which is the only thing the stagger needs.
   *
   * Client-supplied and deliberately harmless: it moves the caller's **own** job later and can
   * reach nothing else, so it is bounded by the drop's own file limit and otherwise trusted.
   */
  index: z
    .number()
    .int()
    .min(0)
    .max(MAX_IMPORT_FILES - 1)
    .default(0),
})

export const getBookingImportInputSchema = z.object({ tripId, jobId })

export const confirmBookingImportInputSchema = z.object({
  tripId,
  jobId,
  /**
   * The rows to write, by index into the staged array.
   *
   * An index alone, because a staged record is written once and never reordered — the frozen
   * plan's index-and-external-id pair would be a checksum against a change that cannot happen.
   */
  accept: z
    .array(
      z
        .number()
        .int()
        .min(0)
        .max(MAX_IMPORT_RESERVATIONS - 1),
    )
    .max(MAX_IMPORT_RESERVATIONS),
})

export type StartBookingImportInput = z.infer<
  typeof startBookingImportInputSchema
>
export type GetBookingImportInput = z.infer<typeof getBookingImportInputSchema>
export type ConfirmBookingImportInput = z.infer<
  typeof confirmBookingImportInputSchema
>

/** The stored file is not a format an import reads. Thrown before anything is enqueued. */
export class ImportFormatError extends Error {
  constructor(readonly filename: string) {
    super(`${filename} is not a file this import can read`)
    this.name = 'ImportFormatError'
  }
}

/* ------------------------------------------------------------------ answers */

export interface StartedBookingImport {
  readonly jobId: string
  /**
   * How many seconds after the start the queue was told to hold this job: `0` for the first file of
   * a drop, `index * EXTRACTION_BUDGET_SECONDS` for the rest.
   *
   * Relative rather than an absolute start time, so the client's stall budget stays on its own
   * clock and a skewed one cannot make a job look late. The stagger is stated here and nowhere else.
   */
  readonly delaySeconds: number
}

export type BookingImportStatus = 'working' | 'ready' | 'refused'

/**
 * One staged row as the desk would hold it: the booking the confirm writes, and nothing else.
 *
 * Every field is already mapped — the type from the extractor's kind, the dates and times into the
 * trip's own wall clock, the price into the pair the column stores. The review list renders this
 * and the confirm writes this, from one mapping, so a reader cannot approve one reading of a row
 * and get another.
 */
export interface BookingImportDraft {
  readonly index: number
  readonly type: (typeof RESERVATION_TYPES)[number]
  readonly title: string
  readonly location: string | null
  readonly reference: string | null
  readonly startDate: string | null
  readonly startTime: string | null
  readonly endDate: string | null
  readonly endTime: string | null
  readonly priceMinor: number | null
  readonly currency: string | null
  /** True when the source stated something the extractor could not read. */
  readonly needsReview: boolean
}

export interface BookingImportView {
  readonly status: BookingImportStatus
  readonly staged?: {
    readonly format: StagedImport['format']
    readonly count: number
    readonly drafts: ReadonlyArray<BookingImportDraft>
    /** Indices a confirm already wrote, so a retry offers only the rest. */
    readonly written: ReadonlyArray<number>
  }
  /** Why the parse refused. A code the catalogue words, never a server sentence. */
  readonly refusal?: {
    readonly code: ImportRefusalCode
    readonly ceiling?: number
  }
}

export interface ConfirmedBookingImport {
  readonly written: number
  /** How many accepted rows could not be written. The confirm tries every one of them. */
  readonly failed: number
  /** Accepted rows still to write, the failed ones included, so a retry is exact. */
  readonly remaining: number
}

/**
 * What a confirm needs from the Worker environment, handed in by its server function.
 *
 * Ports rather than imports, and that is a build constraint before it is a testing one: the client
 * bundle imports this module for its server-function stubs, and the compiler strips a handler's
 * body but not an exported function's. An exported function that named `./context` or
 * `#/server/geo/bindings` itself would pull `cloudflare:workers` into the browser build.
 */
export interface ConfirmBookingImportPorts {
  /** Mirrors one `trip` patch into the room. Never throws: the rows are already written. */
  readonly announce: (
    tripId: string,
    fields: TripPatch['fields'],
  ) => Promise<void>
  /** The runtime a pin is looked up through. */
  readonly geocoding: (options: GeocodeRuntimeOptions) => GeocodeRuntime
}

/* ------------------------------------------------------------------- staging */

/**
 * The slice of KV this module uses. A real `KVNamespace` satisfies it; so does a map.
 *
 * Declared narrowly for the reason `GeoCache` in `src/server/geo/geocode.ts` is: a port with three
 * methods can be handed over by a test, and nothing here needs a fourth.
 */
export interface ImportStore {
  get: (key: string) => Promise<string | null>
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ) => Promise<void>
  delete: (key: string) => Promise<void>
}

const stagedReservationSchema = z.object({
  externalId: z.string().nullable(),
  title: z.string(),
  kind: z.enum(RESERVATION_KINDS),
  startsAt: z.string().nullable(),
  endsAt: z.string().nullable(),
  allDay: z.boolean(),
  floating: z.boolean(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
  reference: z.string().nullable(),
  priceMinor: z.number().int().optional(),
  currency: z.string().optional(),
  needsReview: z.boolean().optional(),
})

/**
 * What the engine staged, re-read rather than trusted.
 *
 * KV holds what a build of the queue handler wrote, which may be older than the build reading it,
 * so a record that does not parse is treated as no record at all. The type annotation is the guard
 * that keeps this schema and {@link StagedImport} in step: a field the handler adds and this
 * parser drops is a compile error here.
 */
const stagedImportSchema: z.ZodType<StagedImport> = z.object({
  jobId: z.string(),
  tripId: z.string(),
  orgId: z.string(),
  requestedBy: z.string(),
  createdAt: z.number(),
  format: z.enum(['ics', 'json', 'document']),
  count: z.number(),
  reservations: z.array(stagedReservationSchema),
  written: z
    .array(z.object({ index: z.number().int(), reservationId: z.string() }))
    .optional(),
  refusal: z
    .object({
      code: z.enum(IMPORT_REFUSAL_CODES),
      ceiling: z.number().optional(),
    })
    .optional(),
})

/**
 * The staged record for a job this caller may actually see, or `null`.
 *
 * `null` covers four states on purpose — no key, an unreadable record, another workspace's record
 * and another trip's — because the caller is allowed to know about exactly none of them. A poll
 * that answered differently for "not yours" than for "not yet" would make a KV key a probe.
 */
async function readStaged(
  scope: TenantScope,
  store: ImportStore,
  input: { readonly tripId: string; readonly jobId: string },
): Promise<StagedImport | null> {
  const raw = await store.get(stagedImportKey(input.jobId))
  if (raw === null) return null

  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }

  const parsed = stagedImportSchema.safeParse(json)
  if (!parsed.success) return null

  const staged = parsed.data
  if (staged.orgId !== scope.ctx.organizationId) return null
  if (staged.tripId !== input.tripId) return null
  return staged
}

/* -------------------------------------------------------------- the mapping */

/**
 * The reservation type each extracted kind becomes.
 *
 * A mapped type over `ReservationKind`, so a kind added to the extractor is a compile error here
 * rather than a silent `other`, and every value is inside `RESERVATION_TYPES`, which the column's
 * own `CHECK` enforces anyway.
 */
const RESERVATION_TYPE_FOR_KIND: {
  readonly [K in ReservationKind]: (typeof RESERVATION_TYPES)[number]
} = {
  flight: 'transport',
  lodging: 'accommodation',
  transport: 'transport',
  activity: 'activity',
  other: 'other',
}

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

interface WallClock {
  readonly date: string | null
  readonly time: string | null
}

/**
 * A staged instant as the trip's own wall clock.
 *
 * Three cases, and the middle one is the whole reason this function exists. A **floating** source
 * already states the destination's wall clock — a 14:00 check-in on a hotel confirmation is 14:00
 * at the hotel — so re-reading it through a zone would move it by the offset between the trip and
 * UTC. A **zoned** source is an instant, and the same instant is a different wall clock in every
 * zone, so it is resolved against the trip's and never the runtime's (`src/lib/time.ts`). A
 * date-only source has no time at all.
 *
 * A value the model invented that is not a calendar date is dropped rather than pushed at the
 * column: one unreadable date must cost its own field, not the whole row.
 */
function wallClock(
  iso: string | null,
  floating: boolean,
  timeZone: string,
): WallClock {
  const stated = iso?.trim() ?? ''
  if (stated.length === 0) return { date: null, time: null }

  const calendarDay = (value: string): string | null =>
    CALENDAR_DATE.test(value) ? value : null

  if (!stated.includes('T')) {
    return { date: calendarDay(stated.slice(0, 10)), time: null }
  }
  if (floating) {
    return {
      date: calendarDay(stated.slice(0, 10)),
      time: wallTime(stated.slice(11, 16)),
    }
  }

  const at = new Date(stated)
  if (Number.isNaN(at.getTime())) {
    return { date: calendarDay(stated.slice(0, 10)), time: null }
  }
  return { date: dayKeyIn(stated, timeZone), time: timeIn(at, timeZone) }
}

const WALL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/

function wallTime(value: string): string | null {
  return WALL_TIME.test(value) ? value : null
}

/**
 * An instant's `HH:MM` in a given zone.
 *
 * Built here rather than in `src/lib/time.ts`, which offers the calendar day of an instant and no
 * clock time, and which this change does not own. `h23` rather than `hour12: false`, which some
 * engines render as `24:00` at midnight — a value the column's own `CHECK` refuses.
 */
function timeIn(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(at)
}

/** The booking one staged row would become, in the trip's zone. */
function draftOf(
  row: StagedReservation,
  index: number,
  timeZone: string,
): BookingImportDraft {
  const start = wallClock(row.startsAt, row.floating, timeZone)
  const end = wallClock(row.endsAt, row.floating, timeZone)
  const money =
    row.priceMinor === undefined || row.currency === undefined
      ? { priceMinor: null, currency: null }
      : { priceMinor: row.priceMinor, currency: row.currency }

  return {
    index,
    type: RESERVATION_TYPE_FOR_KIND[row.kind],
    // Capped at what `titleSchema` accepts: a title the column refuses would fail a whole row over
    // a field the reader can edit in a second.
    title: row.title.trim().slice(0, 200),
    location: row.location?.trim().slice(0, 200) ?? null,
    reference: row.reference?.trim().slice(0, 200) ?? null,
    startDate: start.date,
    startTime: row.allDay ? null : start.time,
    endDate: end.date,
    endTime: row.allDay ? null : end.time,
    ...money,
    needsReview: row.needsReview ?? false,
  }
}

/** The staged rows as the review list renders them, in the trip's zone. */
export function bookingImportDrafts(
  staged: StagedImport,
  timeZone: string,
): ReadonlyArray<BookingImportDraft> {
  return staged.reservations.map((row, index) => draftOf(row, index, timeZone))
}

/* -------------------------------------------------------------------- start */

/** `booking-import:<tripId>:<fileId>` — 67 characters at most, inside the envelope's `max(128)`. */
export function bookingImportJobId(trip: string, file: string): string {
  return `booking-import:${trip}:${file}`
}

/**
 * The only place a `booking-import` envelope is created.
 *
 * The deterministic id is what makes a double submit one job: the consumer keeps a marker under
 * `task:done:<id>` for a day, so the second press is acked without work. A corrected file is a
 * different job, because it is a new upload with a new id — and the trip is in the key on purpose,
 * so one uploaded confirmation is not imported into exactly one trip ever.
 */
export async function startBookingImport(
  scope: TenantScope,
  queue: TaskQueue,
  input: StartBookingImportInput,
): Promise<StartedBookingImport> {
  const trip = await requireTrip(scope, input.tripId)
  // Here as well as at the confirm, and for a different spend: starting a job spends a metered
  // `extraction_calls_per_month` unit and sends a document to Workers AI as soon as the queue
  // handler runs, with nothing between the enqueue and the spend. Without this a trip `viewer` — who
  // may see the desk and may never write to it — could drain the workspace's whole monthly
  // allowance a file at a time, and be refused only at the confirm they were never going to reach.
  await assertBookingRole(scope, trip.id)
  const file = await getFile(scope, input.fileId)
  if (file === null || file.tripId !== trip.id) {
    throw new NotFoundError('file', input.fileId)
  }

  // From the stored row and never from the request: the format decides which reader runs, and a
  // client-chosen one would choose it.
  const format = importFormatFor(file.filename, file.contentType)
  if (format === null) {
    throw new ImportFormatError(file.filename)
  }

  const id = bookingImportJobId(trip.id, file.id)
  const delaySeconds = input.index * EXTRACTION_BUDGET_SECONDS
  await enqueueTask(queue, {
    kind: 'booking-import',
    id,
    orgId: scope.ctx.organizationId,
    payload: {
      tripId: trip.id,
      requestedBy: scope.ctx.userId,
      sourceKey: file.storageKey,
      sourceName: file.filename,
      contentType: file.contentType,
      format,
    },
    ...(delaySeconds === 0 ? {} : { delaySeconds }),
  })

  return { jobId: id, delaySeconds }
}

/* ---------------------------------------------------------------------- get */

/** What the engine has made of one job: still working, ready to review, or refused. */
export async function bookingImportView(
  scope: TenantScope,
  store: ImportStore,
  input: GetBookingImportInput,
): Promise<BookingImportView> {
  const trip = await requireTrip(scope, input.tripId)
  const staged = await readStaged(scope, store, input)
  if (staged === null) return { status: 'working' }

  if (staged.refusal !== undefined) {
    return { status: 'refused', refusal: staged.refusal }
  }

  return {
    status: 'ready',
    staged: {
      format: staged.format,
      count: staged.count,
      drafts: bookingImportDrafts(staged, resolveTimeZone(trip.timezone)),
      written: (staged.written ?? []).map((row) => row.index),
    },
  }
}

/* ------------------------------------------------------------------ confirm */

/**
 * Memoised per isolate, and built without `env` for the reason `./reservations` gives: this module
 * is imported by a suite that runs in plain Node, and every line emitted here is a `warn`.
 */
let logger: Logger | undefined

function log(): Logger {
  logger ??= createLogger({ context: { component: 'booking-import' } })
  return logger
}

/** The file the job was started for. The id is in the envelope id, which is the job id. */
function fileIdOf(id: string): string {
  return id.slice(id.lastIndexOf(':') + 1)
}

/**
 * Coordinates for a place an import created, or nothing.
 *
 * **Never throws.** `GeoProviderError`, `RateCeilingError` and `ProviderBlockedError` are the
 * proxy's designed refusals, the map already filters a place with no coordinates, and a pin is
 * decoration on a booking that has already been written. Charging the failure to the import would
 * turn a missing dot into a lost confirmation.
 */
async function pin(
  scope: TenantScope,
  geocoding: ConfirmBookingImportPorts['geocoding'],
  ceilingFor: () => Promise<number>,
  placeId: string,
  query: string,
): Promise<void> {
  try {
    const ceiling = await ceilingFor()
    const result = await forwardGeocode(
      geocoding({ organizationId: scope.ctx.organizationId, ceiling }),
      // `en` and not the reader's locale: the only fields taken from the answer are the
      // coordinates and the country code, and the language decides the names this discards —
      // while it is also part of the shared cache key, so one language is one cached answer.
      { query, language: 'en' },
    )
    const best = result.candidates.at(0)
    if (best === undefined) return
    await updatePlace(scope, placeId, {
      lat: best.lat,
      lng: best.lng,
      ...(best.countryCode === null ? {} : { countryCode: best.countryCode }),
    })
  } catch (cause) {
    log().warn('booking import place not pinned', {
      placeId,
      organizationId: scope.ctx.organizationId,
      ...serializeError(cause),
    })
  }
}

/**
 * The place a lodging row points at: the trip's own, if it holds one of that name, or a new one.
 *
 * The trip's places are read once and only when a lodging row actually arrives, and a place this
 * confirm creates joins the same index — so five nights at one hotel produce one place, whether it
 * was already on the trip or not.
 *
 * **Never throws.** `createPlace` refuses when the places quota is spent, and a booking that has a
 * price, a date and a confirmation number is worth writing without a pin on the map.
 */
function placeResolver(
  scope: TenantScope,
  geocoding: ConfirmBookingImportPorts['geocoding'],
  forTrip: string,
): (row: StagedReservation) => Promise<string | null> {
  let byName: Map<string, string> | null = null
  // Read once per confirm, beside the trip's places and for the same reason: the workspace's
  // geocoding allowance is a plan row, and five hundred rows must not be five hundred reads of it.
  let ceiling: Promise<number> | null = null
  const ceilingFor = (): Promise<number> => {
    ceiling ??= getSubscription(scope).then(
      (row) => resolveLimitsFromRow(row).rates.geocode_lookups_per_month,
    )
    return ceiling
  }

  return async (row) => {
    const name = row.title.trim().slice(0, 200)
    if (name.length === 0) return null

    try {
      byName ??= new Map(
        (await listTripPlaces(scope, { tripId: forTrip })).map(
          (place) => [place.name.trim().toLowerCase(), place.id] as const,
        ),
      )
      const existing = byName.get(name.toLowerCase())
      if (existing !== undefined) return existing

      const address = row.location?.trim().slice(0, 200) ?? null
      const place = await createPlace(scope, {
        tripId: forTrip,
        name,
        address,
        source: 'import',
      })
      byName.set(name.toLowerCase(), place.id)
      await pin(scope, geocoding, ceilingFor, place.id, address ?? name)
      return place.id
    } catch (cause) {
      log().warn('booking import place not created', {
        tripId: forTrip,
        organizationId: scope.ctx.organizationId,
        ...serializeError(cause),
      })
      return null
    }
  }
}

/**
 * Everything that follows a written booking, none of which may fail it.
 *
 * The row is written the moment `createReservation` returns, and a retry must never write it
 * twice — so the ledger line and the file link are recorded here, after the id exists and outside
 * the decision about whether the row succeeded. `syncReservationExpense` already reports its own
 * failure rather than throwing; the file link is the one that needs the guard.
 */
async function settle(
  scope: TenantScope,
  trip: Trip,
  reservation: Reservation,
  fileId: string,
): Promise<void> {
  await syncReservationExpense(scope, { reservation, trip })
  try {
    await updateFile(scope, trip.id, fileId, {
      reservationId: reservation.id,
    })
  } catch (cause) {
    log().warn('booking import file not linked', {
      fileId,
      reservationId: reservation.id,
      organizationId: scope.ctx.organizationId,
      ...serializeError(cause),
    })
  }
}

/**
 * The run of nights an imported accommodation booking covers, written beside it when its dates say.
 *
 * Only after the booking is written, recorded and settled, and **never throws**: the booking is
 * durable by then, and a retry must not write it twice. A range this trip's days cannot hold —
 * either date outside the trip, or an end before its start — and a refused stay write each leave
 * the booking alone for the reader to review, with a warning of their own that is not the one a
 * failed row gets. The days are read from the trip the caller was just authorised for, once per
 * confirm and only when an accommodation row arrives.
 */
function stayWriter(
  scope: TenantScope,
  forTrip: string,
): (draft: BookingImportDraft, reservation: Reservation) => Promise<void> {
  let dayByDate: Promise<Map<string, Day>> | null = null

  return async (draft, reservation) => {
    try {
      dayByDate ??= listTripDays(scope, forTrip).then(
        // An undated day (a trip with no dates) is one no imported date can name.
        (days) =>
          new Map(
            days.flatMap((day) =>
              day.date === null ? [] : [[day.date, day] as const],
            ),
          ),
      )
      const days = await dayByDate
      const start =
        draft.startDate === null ? undefined : days.get(draft.startDate)
      const end = draft.endDate === null ? undefined : days.get(draft.endDate)
      if (
        start === undefined ||
        end === undefined ||
        end.dayNumber < start.dayNumber
      ) {
        log().warn('booking import stay range not resolved', {
          tripId: forTrip,
          index: draft.index,
          reservationId: reservation.id,
          organizationId: scope.ctx.organizationId,
        })
        return
      }
      await createAccommodation(scope, {
        tripId: forTrip,
        startDayId: start.id,
        endDayId: end.id,
        name: reservation.title,
        address: draft.location,
        checkInTime: draft.startTime,
        checkOutTime: draft.endTime,
        reservationId: reservation.id,
      })
    } catch (cause) {
      log().warn('booking import stay not written', {
        tripId: forTrip,
        index: draft.index,
        reservationId: reservation.id,
        organizationId: scope.ctx.organizationId,
        ...serializeError(cause),
      })
    }
  }
}

/**
 * Writes every accepted row it can, reports the ones it cannot, and never writes one twice.
 *
 * The staged record is the retry's only memory, so it is extended with what was written **before**
 * a partial failure is reported and deleted only when every accepted row is in it. An earlier
 * reading of the ticket deleted it unconditionally and still promised a partial retry; the two
 * cannot both be true.
 *
 * **A row that cannot be written is stepped over, not stopped on.** Stopping was the first reading
 * of "write only the rest", and it does not survive a row that fails the same way every time: the
 * retry recomputes `pending` as the accepted set minus what is in `written`, lowest index first, so
 * the row that failed is always the one tried first — it fails again, and every row behind it is
 * unreachable for good. A hallucinated date is enough to reach that, and it is ordinary model
 * output: `wallClock` only shape-checks `YYYY-MM-DD`, so `2026-02-30` stages happily and is refused
 * by `dateSchema`'s calendar check at write time, on every attempt. Stepping over it writes the
 * other rows on the first confirm, and the reader is left looking at exactly the rows that failed,
 * because the review list re-reads `written` after a partial confirm.
 */
export async function confirmBookingImport(
  scope: TenantScope,
  store: ImportStore,
  input: ConfirmBookingImportInput,
  ports: ConfirmBookingImportPorts,
): Promise<ConfirmedBookingImport> {
  const trip = await requireTrip(scope, input.tripId)
  // Before anything is read, created or spent. The rows below reach `createReservation`, which asks
  // this same question — but an accommodation row first creates a place (a `places` quota unit) and
  // pins it through the geocoder (a metered monthly lookup), and the refusal at the reservation is
  // caught per row and counted as a failed one. Without this a trip `viewer` who opened an import
  // an editor staged would spend both and be handed a result, not a refusal.
  await assertBookingRole(scope, trip.id)
  const staged = await readStaged(scope, store, input)
  if (staged === null) {
    throw new NotFoundError('staged import', input.jobId)
  }

  const already = staged.written ?? []
  const done = new Set(already.map((row) => row.index))
  const pending = [...new Set(input.accept)]
    .filter(
      // `.at` rather than `[index]`, which the element type says can never be `undefined` — and
      // an index from a request can name a row a record does not hold.
      (index) =>
        !done.has(index) && staged.reservations.at(index) !== undefined,
    )
    .sort((left, right) => left - right)

  const timeZone = resolveTimeZone(trip.timezone)
  const placeFor = placeResolver(scope, ports.geocoding, trip.id)
  const stayFor = stayWriter(scope, trip.id)
  /*
   * The name a row the source never titled is written under.
   *
   * Resolved here rather than staged with the extraction, because it is copy and copy comes from
   * the 23-locale catalogue (docs/SPEC.md §9) — the queue consumer that staged the row has neither
   * a reader nor a locale to resolve it in, so anything it wrote would be English in every
   * workspace. In the workspace's language, the way `renderNotificationEmail` picks one.
   *
   * Lazily, beside `ceilingFor` and for the same reason: most confirms have no untitled row at
   * all, and this is a settings read plus a catalogue load.
   */
  let untitled: Promise<string> | null = null
  const untitledTitle = (): Promise<string> => {
    untitled ??= (async () => {
      const settings = await getOrganizationSettings(scope)
      const locale =
        settings === null
          ? DEFAULT_LOCALE
          : negotiate({ workspace: settings.locale })
      const t = createTranslator(locale, await loadCatalogue(locale))
      return t('modules.book.import.review.untitled')
    })()
    return untitled
  }
  const fileId = fileIdOf(staged.jobId)
  const written = [...already]
  let failed = 0

  for (const index of pending) {
    const row = staged.reservations.at(index)
    if (row === undefined) continue
    const draft = draftOf(row, index, timeZone)
    try {
      const placeId =
        draft.type === 'accommodation' ? await placeFor(row) : null
      const reservation = await createReservation(scope, {
        tripId: trip.id,
        placeId,
        type: draft.type,
        status: 'confirmed',
        title: draft.title.length > 0 ? draft.title : await untitledTitle(),
        location: draft.location,
        confirmationNumber: draft.reference,
        notes: row.notes,
        startDate: draft.startDate,
        startTime: draft.startTime,
        endDate: draft.endDate,
        endTime: draft.endTime,
        priceMinor: draft.priceMinor,
        currency: draft.currency,
      })
      written.push({ index, reservationId: reservation.id })
      await settle(scope, trip, reservation, fileId)
      if (draft.type === 'accommodation') await stayFor(draft, reservation)
    } catch (cause) {
      log().warn('booking import row not written', {
        tripId: trip.id,
        index,
        organizationId: scope.ctx.organizationId,
        ...serializeError(cause),
      })
      failed += 1
    }
  }

  const fresh = written.slice(already.length)
  await stamp(scope, trip.id, fresh)
  await persist(store, staged, written, {
    asked: pending.length,
    remaining: pending.length - fresh.length,
  })

  if (fresh.length > 0) {
    // One patch for the batch: five hundred rows must refresh another tab once, not five hundred
    // times. The desk re-reads its own list from the invalidation this triggers.
    await ports.announce(trip.id, {
      importJobId: staged.jobId,
      importWritten: fresh.length,
      importConfirmedAt: Date.now(),
    })
  }

  return {
    written: fresh.length,
    failed,
    remaining: pending.length - fresh.length,
  }
}

/**
 * The marker is written in chunks, so a failure part way leaves the earlier chunks marked, and a
 * shortfall is a bug rather than a refusal.
 *
 * `markReservationsImported` marks only the rows the caller owns and says how many it marked, so a
 * count below what was written means an id did not resolve inside the scope that just wrote it.
 * Nothing here may fail the confirm: the rows exist, and a missing marker costs a badge.
 */
async function stamp(
  scope: TenantScope,
  owningTripId: string,
  fresh: ReadonlyArray<{ readonly reservationId: string }>,
): Promise<void> {
  if (fresh.length === 0) return
  try {
    const marked = await markReservationsImported(
      scope,
      owningTripId,
      fresh.map((row) => row.reservationId),
    )
    if (marked !== fresh.length) {
      log().warn('booking import marker count short', {
        organizationId: scope.ctx.organizationId,
        written: fresh.length,
        marked,
      })
    }
  } catch (cause) {
    log().warn('booking import rows not marked', {
      organizationId: scope.ctx.organizationId,
      written: fresh.length,
      ...serializeError(cause),
    })
  }
}

/**
 * The staged record after a confirm: gone on a full one, extended on a partial one.
 *
 * "Full" means every row this caller asked for, which is why `asked` is in the condition and not
 * only `remaining`: a confirm that accepted nothing leaves nothing outstanding either, and deleting
 * the record then would throw away the rows the reader has not decided about yet. The dialog cannot
 * send an empty acceptance — the button is disabled at none — which is exactly why the write path
 * must not depend on that.
 */
async function persist(
  store: ImportStore,
  staged: StagedImport,
  written: ReadonlyArray<{
    readonly index: number
    readonly reservationId: string
  }>,
  counts: { readonly asked: number; readonly remaining: number },
): Promise<void> {
  const key = stagedImportKey(staged.jobId)
  if (counts.asked > 0 && counts.remaining === 0) {
    await store.delete(key)
    return
  }
  await store.put(key, JSON.stringify({ ...staged, written }), {
    expirationTtl: STAGED_IMPORT_TTL_SECONDS,
  })
}

/* -------------------------------------------------------------------- verbs */

export const startBookingImportFn = createServerFn({ method: 'POST' })
  .validator(startBookingImportInputSchema)
  .handler(async ({ data }): Promise<StartedBookingImport> =>
    startBookingImport(await appScope(), taskQueue(), data),
  )

export const getBookingImportFn = createServerFn({ method: 'GET' })
  .validator(getBookingImportInputSchema)
  .handler(async ({ data }): Promise<BookingImportView> =>
    bookingImportView(await appScope(), importStore(), data),
  )

export const confirmBookingImportFn = createServerFn({ method: 'POST' })
  .validator(confirmBookingImportInputSchema)
  .handler(async ({ data }): Promise<ConfirmedBookingImport> => {
    const scope = await appScope()
    return confirmBookingImport(scope, importStore(), data, {
      announce: (trip, fields) =>
        mirrorToRoom(scope, trip, [patch('trip', trip, fields)]),
      geocoding: geocodeRuntime,
    })
  })
