/**
 * The planner's third read, and the writer that places a journey on a day.
 *
 * Its own module rather than a section of `-server/plan.ts`, and that is a stated trade-off rather
 * than an accident: `-server/plan.ts`, `-ui/plan-model.ts`, `repos/itinerary.ts` and `repos/days.ts`
 * are claimed by sibling stages in every wave this one could occupy, and there is no wave in which
 * `03-S5` could take them *and* take `day-section.tsx`. Everything here therefore reaches the data
 * through the exported repositories, and the shared planner modules are left exactly as they are.
 *
 * **The day is one number line and this module writes only half of it.** `reorderPlanFn` renumbers
 * a day's stops and notes `0..n-1`; a journey expresses where it sits *between* two of those
 * positions, through the fractional `sort_order` its own columns were declared to be. The two
 * writes are not atomic with each other, and four properties of code that already exists are what
 * makes that survivable: positions are recomputed on every successful reorder, the merged sequence
 * sorts on time before position, the client issues both calls together and rolls its optimistic
 * order back if either fails, and the calls are ordered stops-then-journeys so the failure that
 * survives leaves the less visible half stale.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  listTripDayTransports,
  reorderDayTransports,
  reorderDayTransportsInput,
  requireTrip,
  tripRoleFor,
} from '#/server/repos'
import { appScope } from '../../../-server/context'

import type { TenantScope } from '#/server/repos'
import type { Transport, TransportLeg, Trip } from '#/server/db/types'

/* -------------------------------------------------------------------------------------------------
 * Shapes
 * ---------------------------------------------------------------------------------------------- */

/**
 * One journey row the board may draw: a whole record, or one leg of a chain.
 *
 * `mode` and `status` travel as stored and are never narrowed to their enums. Both columns carry a
 * `CHECK` constraint so an unknown value cannot be written, but Drizzle types them as `string`, and
 * asserting past that would trade a real guarantee for a cast — the renderer's registry falls back
 * for a name it does not know, exactly as the day note's icon does.
 */
export interface PlanTransport {
  readonly kind: 'transport' | 'leg'
  readonly id: string
  readonly mode: string
  readonly status: string
  readonly serviceNumber: string | null
  readonly fromName: string | null
  readonly toName: string | null
  readonly departureDayId: string | null
  readonly arrivalDayId: string | null
  /** `HH:MM` at the endpoint's own zone, as stored. */
  readonly departureTime: string | null
  readonly arrivalTime: string | null
  readonly priceMinor: number | null
  readonly currency: string | null
  /** `sort_order` — the fractional position among the day's stops and notes. */
  readonly position: number
}

export interface PlanTransportsPayload {
  readonly tripId: string
  /** The acting user may move a journey: owner or editor, and the trip is not archived. */
  readonly canWrite: boolean
  readonly transports: ReadonlyArray<PlanTransport>
}

/* -------------------------------------------------------------------------------------------------
 * Read
 * ---------------------------------------------------------------------------------------------- */

/** True for a row the board can place: it has to name at least one day of the trip. */
function coversADay(row: PlanTransport): boolean {
  return row.departureDayId !== null || row.arrivalDayId !== null
}

/**
 * One leg, wearing its parent's identity.
 *
 * The mode, the status and the fare belong to the record: a leg of a flight is not a different kind
 * of thing from the flight, and a ticket is priced once — splitting a fare across four legs would
 * invent four numbers nobody was charged, which is the rule `transport_legs`' own docblock states.
 * A chained journey's fare is read where it is charged, on the Transports tab.
 */
function legRow(leg: TransportLeg, parent: Transport): PlanTransport {
  return {
    kind: 'leg',
    id: leg.id,
    mode: parent.mode,
    status: parent.status,
    serviceNumber: leg.serviceNumber,
    fromName: leg.fromName,
    toName: leg.toName,
    departureDayId: leg.departureDayId,
    arrivalDayId: leg.arrivalDayId,
    departureTime: leg.departureTime,
    arrivalTime: leg.arrivalTime,
    priceMinor: null,
    currency: null,
    position: leg.sortOrder,
  }
}

function recordRow(record: Transport): PlanTransport {
  return {
    kind: 'transport',
    id: record.id,
    mode: record.mode,
    status: record.status,
    serviceNumber: record.serviceNumber,
    fromName: record.departureName,
    toName: record.arrivalName,
    departureDayId: record.dayId,
    arrivalDayId: record.arrivalDayId,
    departureTime: record.departureTime,
    arrivalTime: record.arrivalTime,
    priceMinor: record.priceMinor,
    currency: record.currency,
    position: record.sortOrder,
  }
}

/**
 * Every journey row of the trip, filtered to the ones a day can draw.
 *
 * Two rows are dropped here rather than in the query, because the query has to answer a different
 * question: a chained journey's day references live on its legs while its mode, its status and its
 * title live on the record, so a read that filtered the parent by `day_id` would draw every leg of
 * an ordinary chain with the generic glyph and no status.
 *
 * - **A record that has legs** contributes nothing itself. A journey drawn as its legs is never
 *   also drawn whole; there is no spanning row beside them.
 * - **A row that names no day at all** is not on the board. It lives on the Transports tab, which
 *   is where a day is given to it.
 *
 * A plain function beside the server-function shell, because outside a Start build a handler's
 * return value is discarded — so a read tested through the boundary can assert nothing about what
 * it read. The same split `readDayNotes` records.
 */
export async function readPlanTransports(
  scope: TenantScope,
  tripId: string,
): Promise<PlanTransportsPayload> {
  const trip = await requireTrip(scope, tripId)
  const [role, { records, legs }] = await Promise.all([
    tripRoleFor(scope, trip.id, scope.ctx.userId),
    listTripDayTransports(scope, trip.id),
  ])

  const byId = new Map(records.map((record) => [record.id, record]))
  const chained = new Set(legs.map((leg) => leg.transportId))

  const rows = [
    ...records.filter((record) => !chained.has(record.id)).map(recordRow),
    ...legs.flatMap((leg) => {
      const parent = byId.get(leg.transportId)
      return parent === undefined ? [] : [legRow(leg, parent)]
    }),
  ]

  return {
    tripId: trip.id,
    canWrite: !trip.isArchived && (role === 'owner' || role === 'editor'),
    transports: rows.filter(coversADay),
  }
}

const id = z.string().trim().min(1).max(64)

export const loadPlanTransports = createServerFn({ method: 'GET' })
  .validator(z.object({ tripId: id }))
  .handler(async ({ data }): Promise<PlanTransportsPayload> => {
    const scope = await appScope()
    return readPlanTransports(scope, data.tripId)
  })

/* -------------------------------------------------------------------------------------------------
 * Write
 * ---------------------------------------------------------------------------------------------- */

/**
 * Resolves the trip and refuses to write to an archived one.
 *
 * The same backstop `-server/plan.ts` and `-server/day-notes.ts` each keep for a stale tab: an
 * archived trip is a record of something that happened, and the rails render read-only for one, so
 * this can afford to be a plain error.
 */
async function writableTrip(scope: TenantScope, tripId: string): Promise<Trip> {
  const trip = await requireTrip(scope, tripId)
  if (trip.isArchived) {
    throw new Error('This trip is archived. Restore it before making changes.')
  }
  return trip
}

/**
 * Tells the trip room that this day's journeys were re-placed.
 *
 * Under its own field rather than beside the `items` `reorderPlanFn` mirrors, because the two
 * writes carry two different halves of one day and neither should overwrite the other's news.
 *
 * `#/server/fns/context` is reached at call time rather than imported at the top of the file: it
 * imports `cloudflare:workers` and the trip room's Durable Object module, and this file is imported
 * by the planner route, so a static import would put both into that route's module graph. The
 * posture `-server/plan.ts` records in the same words, for the same reason.
 */
async function mirrorDayJourneys(
  scope: TenantScope,
  tripId: string,
  dayId: string,
  journeys: ReadonlyArray<{ readonly kind: string; readonly id: string }>,
): Promise<void> {
  const { mirrorToRoom, patch } = await import('#/server/fns/context')
  await mirrorToRoom(scope, tripId, [
    patch('day', dayId, {
      journeys: journeys.map((ref) => ({ kind: ref.kind, id: ref.id })),
    }),
  ])
}

/**
 * Places one day's journeys between the stops and notes the run names.
 *
 * The client sends the day's *resulting* run — stops, notes and journeys, in order — and the server
 * takes from it only which stop or note each journey follows; the fractions themselves are derived
 * from the day as stored, so a client can never inject a position of its own choosing. The
 * repository's own schema is the validator, so the wire contract and the boundary check cannot
 * drift apart: at most 400 rows, of which at most 200 are stops and notes — `reorderPlanFn`'s
 * per-day cap counted by the same rule, so a day the primary write accepts is never refused here.
 */
export const reorderDayTransportsFn = createServerFn({ method: 'POST' })
  .validator(reorderDayTransportsInput)
  .handler(async ({ data }): Promise<{ readonly placed: number }> => {
    const scope = await appScope()
    const trip = await writableTrip(scope, data.tripId)

    // The run as written, not as asked for: the repository drops an id it does not know and puts
    // back a known one the payload left out, so the request and the day on disk can differ — and
    // the room, like the count, has to hear the disk. The trip goes with it: the repository keeps
    // its own guard for every other caller and reads the row again only when it is not handed one.
    const journeys = await reorderDayTransports(scope, data, trip)
    await mirrorDayJourneys(scope, data.tripId, data.dayId, journeys)

    return { placed: journeys.length }
  })
