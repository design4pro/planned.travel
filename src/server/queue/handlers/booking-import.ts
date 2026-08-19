/**
 * `booking-import` — turns an uploaded `.ics` or JSON booking export into a
 * staged set of reservations a traveller can review before it touches their trip.
 *
 * Staging (rather than writing straight to D1) keeps the queue out of the
 * tenant-scoped repository layer: the import lands in KV with a short TTL, the
 * UI shows "12 bookings ready to review", and the confirm action writes D1
 * through the repos where quota and tenant checks live.
 */

import { z } from 'zod'
import { parseIcsCalendar } from '../ics'
import { TaskPermanentError } from '../types'
import type { TaskContext, TaskMetrics, BookingImportPayload  } from '../types'
import type { IcsEvent } from '../ics'

export const RESERVATION_KINDS = ['flight', 'lodging', 'transport', 'activity', 'other'] as const

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
}

export interface StagedImport {
  jobId: string
  tripId: string
  orgId: string
  requestedBy: string
  createdAt: number
  format: 'ics' | 'json'
  count: number
  reservations: Array<StagedReservation>
}

/** Staged imports expire in a day: an unreviewed import is not durable state. */
export const STAGED_IMPORT_TTL_SECONDS = 24 * 60 * 60

/** Uploads larger than this are refused rather than streamed into memory. */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024

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
  { kind: 'flight', pattern: /\b(flight|airport|airlines?|boarding|terminal|[A-Z]{2}\d{2,4})\b/i },
  { kind: 'lodging', pattern: /\b(hotel|hostel|apartment|airbnb|check[- ]?in|guesthouse|riad)\b/i },
  { kind: 'transport', pattern: /\b(train|rail|bus|coach|ferry|shuttle|transfer|car hire|rental)\b/i },
  { kind: 'activity', pattern: /\b(tour|museum|ticket|tasting|dinner|reservation|table|guided)\b/i },
]

/** Best-effort classification so imported rows land in the right timeline lane. */
export function inferReservationKind(text: string): ReservationKind {
  for (const hint of KIND_HINTS) {
    if (hint.pattern.test(text)) return hint.kind
  }
  return 'other'
}

const REFERENCE_PATTERN = /\b(?:conf(?:irmation)?|booking|ref(?:erence)?|pnr)[^\dA-Z]{0,6}([A-Z0-9]{5,10})\b/i

export function extractReference(text: string): string | null {
  const match = REFERENCE_PATTERN.exec(text)
  return match?.[1] ?? null
}

export function icsEventToReservation(event: IcsEvent): StagedReservation {
  const haystack = [event.summary, event.description, event.location].filter(Boolean).join(' ')
  return {
    externalId: event.uid,
    title: event.summary ?? 'Untitled booking',
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

function jsonToReservation(row: z.infer<typeof jsonReservationSchema>): StagedReservation {
  const title = row.title ?? row.name ?? row.summary ?? 'Untitled booking'
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

export async function handleBookingImport(
  payload: BookingImportPayload,
  context: TaskContext,
): Promise<TaskMetrics> {
  const object = await context.env.FILES.get(payload.sourceKey)
  if (object === null || object.body === null) {
    throw new TaskPermanentError(`Import source ${payload.sourceKey} is missing from R2`)
  }
  if (object.size > MAX_IMPORT_BYTES) {
    throw new TaskPermanentError(
      `Import source is ${object.size} bytes; the limit is ${MAX_IMPORT_BYTES}`,
    )
  }

  const source = await new Response(object.body).text()
  const parsed =
    payload.format === 'ics'
      ? parseIcsCalendar(source).map(icsEventToReservation)
      : parseJsonImport(source)

  if (parsed.length === 0) {
    throw new TaskPermanentError('Import contained no bookings')
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
  await notifyTripRoom(payload.tripId, payload.requestedBy, jobId, reservations.length, context)

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
    new Request(`https://trip-room.internal/${encodeURIComponent(tripId)}/commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tripId,
        authorId: requestedBy,
        patches: [
          {
            entity: { kind: 'trip', id: tripId },
            op: 'upsert',
            fields: { importJobId: jobId, importCount: count, importStagedAt: context.now() },
          },
        ],
      }),
    }),
  )
  if (!response.ok) {
    // A closed room is not a failed import; the banner appears on next load.
    context.logger.warn('trip room import notification rejected', {
      tripId,
      status: response.status,
    })
  }
}
