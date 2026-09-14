/**
 * `booking-import` — turns an uploaded calendar, JSON export or confirmation
 * document into a staged set of reservations a traveller can review before it
 * touches their trip.
 *
 * Staging (rather than writing straight to D1) keeps the queue out of the
 * tenant-scoped repository layer: the import lands in KV with a short TTL, the
 * UI shows "12 bookings ready to review", and the confirm action writes D1
 * through the repos where quota and tenant checks live.
 *
 * **The model is one branch in front of the parse, never a replacement for it.**
 * `.ics` and `.json` have grammars, and a grammar is better read by a parser
 * than by a model — the deterministic path is also the one that costs nothing
 * against the extraction meter. Everything else becomes text and then rows
 * through `src/server/extract/**`, whose two modules split at the seam that
 * matters: bytes-to-text returns text and never a reservation.
 *
 * The staged output is the same {@link StagedImport} either way, so the KV
 * staging, the row cap, the TTL and the room notification below are reused
 * rather than reimplemented for the new branch.
 */

import { z } from 'zod'
import { drizzle } from 'drizzle-orm/d1'
import { resolveLimitsFromRow } from '#/server/billing/limits'
import { textToReservations } from '#/server/extract/booking'
import { ImportRefusedError, documentToText } from '#/server/extract/document'
import { MAX_IMPORT_BYTES } from '#/server/fns/file-policy'
import { RateCeilingError, spendRateUnit } from '#/server/metering/rate'
import { createScope, getSubscription } from '#/server/repos'
import { parseIcsCalendar } from '../ics'
import { TaskConfigurationError, TaskPermanentError } from '../types'
import type { ImportRefusalCode } from '#/server/extract/document'
import type { Database } from '#/server/db/types'
import type { LogFields } from '#/server/observability/logger'
import type {
  TaskBindings,
  TaskContext,
  TaskHandler,
  TaskMetrics,
  BookingImportPayload,
} from '../types'
import type { IcsEvent } from '../ics'

export const RESERVATION_KINDS = [
  'flight',
  'lodging',
  'transport',
  'activity',
  'other',
] as const

export type ReservationKind = (typeof RESERVATION_KINDS)[number]

export interface StagedReservation {
  externalId: string | null
  title: string
  kind: ReservationKind
  startsAt: string | null
  endsAt: string | null
  allDay: boolean
  /** True when the source had no timezone; the UI resolves it against the trip. */
  floating: boolean
  location: string | null
  notes: string | null
  reference: string | null
  /**
   * An integer count of the currency's minor units, and the ISO-4217 code beside it.
   *
   * Optional, and both or neither. The two deterministic parsers set neither and are unchanged by
   * their arrival; the extractor sets them only when the document stated a price it could turn
   * into minor units, because money is never guessed (`src/server/extract/booking.ts`).
   */
  priceMinor?: number
  currency?: string
  /** True when something the source stated could not be read, so the reader sees it first. */
  needsReview?: boolean
}

export interface StagedImport {
  jobId: string
  tripId: string
  orgId: string
  requestedBy: string
  createdAt: number
  format: 'ics' | 'json' | 'document'
  count: number
  reservations: Array<StagedReservation>
  /**
   * Rows a confirm already wrote, so a retry writes only the remainder.
   *
   * Optional, so every record staged before this field existed still parses. The confirm extends
   * it **before** it reports a partial failure, and the staged key is deleted only once every
   * accepted row is present in it — because once the record is gone there is nothing to retry from.
   */
  written?: ReadonlyArray<{
    readonly index: number
    readonly reservationId: string
  }>
  /**
   * Why the parse refused, when it did.
   *
   * A refusal is staged and then rethrown, so the job still dead-letters rather than retrying a
   * call that will not succeed — and the reader's poll finds a designed outcome instead of waiting
   * out its budget on a job that already failed. `reservations` is empty when this is set.
   */
  refusal?: {
    readonly code: ImportRefusalCode
    /** The plan's allowance, on a `ceiling` refusal only, so the copy can name it. */
    readonly ceiling?: number
  }
}

/** Staged imports expire in a day: an unreviewed import is not durable state. */
export const STAGED_IMPORT_TTL_SECONDS = 24 * 60 * 60

/**
 * Uploads larger than this are refused rather than streamed into memory.
 *
 * Re-exported rather than declared: the number now lives beside the rest of the upload policy in
 * `src/server/fns/file-policy.ts`, so the dialog can state the same limit this refusal enforces
 * without reaching into a queue handler.
 */
export { MAX_IMPORT_BYTES } from '#/server/fns/file-policy'

export const MAX_IMPORT_RESERVATIONS = 500

export function stagedImportKey(jobId: string): string {
  return `import:${jobId}`
}

const jsonReservationSchema = z.object({
  id: z.string().max(128).optional(),
  externalId: z.string().max(128).optional(),
  title: z.string().min(1).max(200).optional(),
  name: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(200).optional(),
  kind: z.enum(RESERVATION_KINDS).optional(),
  type: z.string().max(40).optional(),
  startsAt: z.string().max(64).optional(),
  start: z.string().max(64).optional(),
  endsAt: z.string().max(64).optional(),
  end: z.string().max(64).optional(),
  location: z.string().max(200).optional(),
  address: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  description: z.string().max(2000).optional(),
  reference: z.string().max(64).optional(),
  confirmation: z.string().max(64).optional(),
})

const jsonImportSchema = z.union([
  z.array(jsonReservationSchema),
  z.object({ reservations: z.array(jsonReservationSchema) }),
  z.object({ bookings: z.array(jsonReservationSchema) }),
])

const KIND_HINTS: Array<{ kind: ReservationKind; pattern: RegExp }> = [
  {
    kind: 'flight',
    pattern:
      /\b(flight|airport|airlines?|boarding|terminal|[A-Z]{2}\d{2,4})\b/i,
  },
  {
    kind: 'lodging',
    pattern:
      /\b(hotel|hostel|apartment|airbnb|check[- ]?in|guesthouse|riad)\b/i,
  },
  {
    kind: 'transport',
    pattern:
      /\b(train|rail|bus|coach|ferry|shuttle|transfer|car hire|rental)\b/i,
  },
  {
    kind: 'activity',
    pattern:
      /\b(tour|museum|ticket|tasting|dinner|reservation|table|guided)\b/i,
  },
]

/** Best-effort classification so imported rows land in the right timeline lane. */
export function inferReservationKind(text: string): ReservationKind {
  for (const hint of KIND_HINTS) {
    if (hint.pattern.test(text)) return hint.kind
  }
  return 'other'
}

const REFERENCE_PATTERN =
  /\b(?:conf(?:irmation)?|booking|ref(?:erence)?|pnr)[^\dA-Z]{0,6}([A-Z0-9]{5,10})\b/i

export function extractReference(text: string): string | null {
  const match = REFERENCE_PATTERN.exec(text)
  return match?.[1] ?? null
}

export function icsEventToReservation(event: IcsEvent): StagedReservation {
  const haystack = [event.summary, event.description, event.location]
    .filter(Boolean)
    .join(' ')
  return {
    externalId: event.uid,
    // Empty rather than an English placeholder — see the same decision in
    // `src/server/extract/booking.ts`: the untitled row is named from the catalogue, at confirm.
    title: event.summary ?? '',
    kind: inferReservationKind(haystack),
    startsAt: event.start,
    endsAt: event.end,
    allDay: event.allDay,
    floating: event.floating,
    location: event.location,
    notes: event.description,
    reference: extractReference(haystack),
  }
}

function jsonToReservation(
  row: z.infer<typeof jsonReservationSchema>,
): StagedReservation {
  const title = row.title ?? row.name ?? row.summary ?? ''
  const notes = row.notes ?? row.description ?? null
  const location = row.location ?? row.address ?? null
  const haystack = [title, notes, location, row.type].filter(Boolean).join(' ')
  const startsAt = row.startsAt ?? row.start ?? null
  return {
    externalId: row.externalId ?? row.id ?? null,
    title,
    kind: row.kind ?? inferReservationKind(haystack),
    startsAt,
    endsAt: row.endsAt ?? row.end ?? null,
    allDay: startsAt !== null && !startsAt.includes('T'),
    floating: startsAt !== null && !startsAt.endsWith('Z'),
    location,
    notes,
    reference: row.reference ?? row.confirmation ?? extractReference(haystack),
  }
}

export function parseJsonImport(source: string): Array<StagedReservation> {
  let json: unknown
  try {
    json = JSON.parse(source)
  } catch {
    throw new TaskPermanentError('Import file is not valid JSON')
  }
  const parsed = jsonImportSchema.safeParse(json)
  if (!parsed.success) {
    throw new TaskPermanentError(
      `Import JSON does not match the expected shape: ${parsed.error.issues[0]?.message ?? 'unknown field'}`,
    )
  }
  const rows = Array.isArray(parsed.data)
    ? parsed.data
    : 'reservations' in parsed.data
      ? parsed.data.reservations
      : parsed.data.bookings
  return rows.map(jsonToReservation)
}

/** The D1 binding as `TaskBindings` declares it, without the `undefined`. */
type D1Handle = NonNullable<TaskBindings['DB']>

/**
 * How a D1 binding becomes a Drizzle handle, and how the extraction ceiling is resolved.
 *
 * Injectable for the mechanical reason `travel-stats.ts` gives for the same seam:
 * `src/server/db/client.ts` reads the ambient Worker environment at module scope, so importing
 * `createDb` here would drag `cloudflare:workers` into the consumer's module graph — and the whole
 * server suite runs in plain Node, where that specifier does not resolve. The default below is the
 * same one line `createDb` is; a test hands in the harness's database, or a ceiling directly.
 */
export interface BookingImportSeams {
  readonly databaseFor?: (binding: D1Handle) => Database
  /** The workspace's `extraction_calls_per_month` allowance. */
  readonly ceilingFor?: (
    payload: BookingImportPayload,
    context: TaskContext,
  ) => Promise<number>
}

/**
 * The workspace's extraction allowance, from the one resolver every published ceiling comes from.
 *
 * `getSubscription` + `resolveLimitsFromRow` is the same pair `resolveQuotas` uses one directory
 * over, so the number enforced here is by construction the number `/settings/billing` publishes.
 * Nothing in this module names an allowance of its own.
 */
async function extractionCeiling(
  db: Database,
  organizationId: string,
  userId: string,
): Promise<number> {
  const scope = createScope(db, { userId, organizationId, role: 'member' })
  const row = await getSubscription(scope)
  return resolveLimitsFromRow(row).rates.extraction_calls_per_month
}

function defaultCeilingFor(
  databaseFor: (binding: D1Handle) => Database,
): NonNullable<BookingImportSeams['ceilingFor']> {
  return async (payload, context) => {
    const binding = context.env.DB
    if (binding === undefined) {
      throw new TaskConfigurationError(
        'DB binding is not available to the queue consumer; a document import cannot resolve its extraction ceiling',
      )
    }
    return extractionCeiling(
      databaseFor(binding),
      context.orgId,
      payload.requestedBy,
    )
  }
}

/**
 * The model branch: spend the unit, read the bytes as text, read the text as bookings.
 *
 * **The meter is spent before the binding is reached**, and that order is the whole guard. There is
 * no cache to sit in front of — ADR 0012 records that this is the only one of the three metered
 * dependencies with none, because each file is unique — so a workspace that has spent its
 * allowance is refused without a call being made, and a plan whose allowance is zero is refused
 * without the counter store being touched at all.
 */
async function extractFromDocument(
  payload: BookingImportPayload,
  bytes: ArrayBuffer,
  context: TaskContext,
  seams: Required<Pick<BookingImportSeams, 'ceilingFor'>>,
): Promise<Array<StagedReservation>> {
  const ceiling = await seams.ceilingFor(payload, context)
  try {
    await spendRateUnit(context.env.KV, {
      metric: 'extraction_calls_per_month',
      organizationId: context.orgId,
      ceiling,
      now: () => new Date(context.now()),
      logger: {
        // The meter's logger port widens its fields to `unknown`; `Logger.warn` narrows them to
        // `LogFields`. The meter only ever passes a flat record of strings, so this is the seam
        // between two descriptions of the same thing rather than a cast that hides one.
        warn: (message: string, fields?: unknown) => {
          context.logger.warn(message, fields as LogFields | undefined)
        },
      },
    })
  } catch (cause) {
    if (cause instanceof RateCeilingError) {
      // Re-worded rather than forwarded: `RateCeilingError`'s own sentences are the timetable
      // search's, and a reader's refusal belongs in the 23-locale catalogue. The code and the
      // ceiling travel; the message stays in the log line.
      throw new ImportRefusedError(
        'ceiling',
        `The workspace has spent its ${cause.ceiling} confirmation readings this month`,
        cause.ceiling,
      )
    }
    throw cause
  }

  const ai = context.env.AI
  if (ai === undefined) {
    throw new TaskConfigurationError(
      'AI binding is not available to the queue consumer; a document import cannot run',
    )
  }

  const text = await documentToText(ai, {
    name: payload.sourceName,
    bytes,
  })
  return textToReservations(ai, { text, sourceName: payload.sourceName })
}

async function runBookingImport(
  payload: BookingImportPayload,
  context: TaskContext,
  seams: Required<Pick<BookingImportSeams, 'ceilingFor'>>,
): Promise<TaskMetrics> {
  const object = await context.env.FILES.get(payload.sourceKey)
  if (object === null || object.body === null) {
    throw new TaskPermanentError(
      `Import source ${payload.sourceKey} is missing from R2`,
    )
  }
  if (object.size > MAX_IMPORT_BYTES) {
    throw new ImportRefusedError(
      'too-large',
      `Import source is ${object.size} bytes; the limit is ${MAX_IMPORT_BYTES}`,
    )
  }

  // One read, two readings. The deterministic parsers want text and the conversion wants bytes,
  // and an R2 body may only be consumed once.
  const bytes = await new Response(object.body).arrayBuffer()
  const parsed =
    payload.format === 'ics'
      ? parseIcsCalendar(decodeSource(bytes)).map(icsEventToReservation)
      : payload.format === 'json'
        ? parseJsonImport(decodeSource(bytes))
        : await extractFromDocument(payload, bytes, context, seams)

  if (parsed.length === 0) {
    // The same permanent failure it has always been, now carrying the code its copy is worded
    // from: "we could not find a booking in that file" is a designed outcome, not a stack trace.
    throw new ImportRefusedError('empty', 'Import contained no bookings')
  }

  const reservations = parsed.slice(0, MAX_IMPORT_RESERVATIONS)
  const jobId = context.taskId
  const staged: StagedImport = {
    jobId,
    tripId: payload.tripId,
    orgId: context.orgId,
    requestedBy: payload.requestedBy,
    createdAt: context.now(),
    format: payload.format,
    count: reservations.length,
    reservations,
  }

  await context.env.KV.put(stagedImportKey(jobId), JSON.stringify(staged), {
    expirationTtl: STAGED_IMPORT_TTL_SECONDS,
  })

  // Nudge anyone looking at the trip right now. The room is a notification
  // channel here, not a store: the reservations themselves stay in KV.
  await notifyTripRoom(
    payload.tripId,
    payload.requestedBy,
    jobId,
    reservations.length,
    context,
  )

  context.logger.info('booking import staged', {
    tripId: payload.tripId,
    format: payload.format,
    parsed: parsed.length,
    staged: reservations.length,
    truncated: parsed.length > reservations.length,
  })

  return {
    parsed: parsed.length,
    staged: reservations.length,
    truncated: parsed.length > reservations.length,
  }
}

function decodeSource(bytes: ArrayBuffer): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

/**
 * Records a refusal where the reader's poll will find it, then lets the failure through.
 *
 * Without this a refused import is indistinguishable from a slow one: the handler throws, the
 * consumer dead-letters, KV stays empty and the widget waits out its whole budget before offering
 * "Check again" — for a job that will never answer. Staging the refusal first turns that into the
 * designed state the copy was written for, and rethrowing is what still stops the retry.
 *
 * Every format records one, the two deterministic parsers included. They used to be left out on the
 * grounds that their behaviour was unchanged, and that reasoning does not survive this feature:
 * `too-large` and `empty` are both raised on the path all three formats share, the reader polling
 * them is new here, and an `.ics` with no `VEVENT` is exactly the case
 * `modules.book.import.empty.title` was written for. Leaving it out gave that reader a twenty-second
 * stall instead of the sentence.
 */
async function stageRefusal(
  payload: BookingImportPayload,
  context: TaskContext,
  error: unknown,
): Promise<void> {
  const refused = error instanceof ImportRefusedError ? error : null
  const staged: StagedImport = {
    jobId: context.taskId,
    tripId: payload.tripId,
    orgId: context.orgId,
    requestedBy: payload.requestedBy,
    createdAt: context.now(),
    format: payload.format,
    count: 0,
    reservations: [],
    refusal: {
      code: refused?.code ?? 'unknown',
      ...(refused?.ceiling === undefined ? {} : { ceiling: refused.ceiling }),
    },
  }
  try {
    await context.env.KV.put(
      stagedImportKey(staged.jobId),
      JSON.stringify(staged),
      {
        expirationTtl: STAGED_IMPORT_TTL_SECONDS,
      },
    )
  } catch (cause) {
    // A refusal that could not be recorded is still a refusal. Failing the cleanup would replace a
    // designed message with a dead-lettered job and tell the reader nothing either way.
    context.logger.warn('booking import refusal not recorded', {
      tripId: payload.tripId,
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

/**
 * Builds the handler over its two seams. {@link handleBookingImport} is the one the consumer
 * registers; a test builds its own with a ceiling it chose.
 */
export function createBookingImportHandler(
  seams: BookingImportSeams = {},
): TaskHandler<'booking-import'> {
  const ceilingFor =
    seams.ceilingFor ??
    defaultCeilingFor(seams.databaseFor ?? ((binding) => drizzle(binding)))

  return async function bookingImport(
    payload: BookingImportPayload,
    context: TaskContext,
  ): Promise<TaskMetrics> {
    try {
      return await runBookingImport(payload, context, { ceilingFor })
    } catch (error) {
      if (error instanceof TaskPermanentError) {
        await stageRefusal(payload, context, error)
      }
      throw error
    }
  }
}

export const handleBookingImport = createBookingImportHandler()

async function notifyTripRoom(
  tripId: string,
  requestedBy: string,
  jobId: string,
  count: number,
  context: TaskContext,
): Promise<void> {
  const namespace = context.env.TRIP_ROOM
  if (!namespace) return
  const stub = namespace.get(namespace.idFromName(tripId))
  const response = await stub.fetch(
    new Request(
      `https://trip-room.internal/${encodeURIComponent(tripId)}/commit`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tripId,
          authorId: requestedBy,
          patches: [
            {
              entity: { kind: 'trip', id: tripId },
              op: 'upsert',
              fields: {
                importJobId: jobId,
                importCount: count,
                importStagedAt: context.now(),
              },
            },
          ],
        }),
      },
    ),
  )
  if (!response.ok) {
    // A closed room is not a failed import; the banner appears on next load.
    context.logger.warn('trip room import notification rejected', {
      tripId,
      status: response.status,
    })
  }
}
