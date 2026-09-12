/**
 * Transports — the movements between places: flights, trains, ferries, the hire car.
 *
 * A transport is stored with its own departure/arrival endpoints rather than as a pair of place
 * ids, because most journeys start or end somewhere that is not a place on the itinerary (an
 * airport, a station). A transport may hang off a day, but it does not have to.
 *
 * A long-distance journey is a **chain of stations** rather than a pair of them, and the part
 * between two consecutive stations is a **leg** (`CONTEXT.md`). Legs are rows in `transport_legs`
 * and are written only by {@link replaceTransportChain}; a transport with no rows there is read as
 * the one-leg chain its own flat endpoints already describe, which is why nothing was backfilled
 * and why every journey recorded before chains existed keeps reading exactly as it did.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  sum,
} from 'drizzle-orm'
import { z } from 'zod'
import {
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  transportLegs,
  transports,
} from '#/server/db/schema'
import { createTenantRepository, tenantFilter } from './base'
import { runBatch } from './batch'
import { NotFoundError, RepositoryError } from './context'
import { listDayNotes, requireTripDay } from './days'
import { listDayAssignments } from './itinerary'
import { assertTripRole, requireTrip } from './trips'

import type { TripRole } from './trips'
import { resolveTimeZone } from '#/lib/time'
import {
  currencySchema,
  dateSchema,
  definedOnly,
  idSchema,
  latitudeSchema,
  longTextSchema,
  longitudeSchema,
  minorAmountSchema,
  nonNegativeIntSchema,
  shortTextSchema,
  sortOrderSchema,
  timeSchema,
  titleSchema,
} from './validation'
import type { Transport, TransportLeg, Trip } from '#/server/db/types'
import type { BatchStatement } from './batch'
import type { TenantScope } from './base'

export const transportsRepository = createTenantRepository(
  transports,
  'transport',
)

/**
 * The chain's rows live beside the record they hang off rather than in a module
 * of their own: `index.ts` maps one repository to the `transports` table and a
 * leg is the same aggregate, so a second module would split one write across two
 * homes for no gain.
 */
export const transportLegsRepository = createTenantRepository(
  transportLegs,
  'transport leg',
)

/* -------------------------------------------------------------------------------------------------
 * Who may write here
 * ---------------------------------------------------------------------------------------------- */

/** The roles that may change a trip's transports. */
const WRITERS: ReadonlyArray<TripRole> = ['owner', 'editor']

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const codeSchema = z.string().trim().min(1).max(8).toUpperCase()

const transportFields = {
  /** The day the journey *departs*. The column keeps its name for the rows already written. */
  dayId: idSchema.nullish(),
  /**
   * The day it lands on, which may be a different one and is never derived from
   * the first: only the traveller knows that the night flight arrives tomorrow.
   */
  arrivalDayId: idSchema.nullish(),
  mode: z.enum(TRANSPORT_MODES).optional(),
  status: z.enum(TRANSPORT_STATUSES).optional(),
  title: titleSchema,
  carrier: shortTextSchema.nullish(),
  serviceNumber: shortTextSchema.nullish(),
  bookingCode: shortTextSchema.nullish(),
  seat: shortTextSchema.nullish(),
  departureName: shortTextSchema.nullish(),
  departureCode: codeSchema.nullish(),
  departureLat: latitudeSchema.nullish(),
  departureLng: longitudeSchema.nullish(),
  departureDate: dateSchema.nullish(),
  departureTime: timeSchema.nullish(),
  departureTimezone: shortTextSchema.nullish(),
  arrivalName: shortTextSchema.nullish(),
  arrivalCode: codeSchema.nullish(),
  arrivalLat: latitudeSchema.nullish(),
  arrivalLng: longitudeSchema.nullish(),
  arrivalDate: dateSchema.nullish(),
  arrivalTime: timeSchema.nullish(),
  arrivalTimezone: shortTextSchema.nullish(),
  distanceMetres: nonNegativeIntSchema.nullish(),
  priceMinor: minorAmountSchema.nullish(),
  currency: currencySchema.nullish(),
  notes: longTextSchema.nullish(),
  sortOrder: sortOrderSchema.optional(),
}

export const createTransportInput = z.object({
  tripId: idSchema,
  ...transportFields,
})
export type CreateTransportInput = z.infer<typeof createTransportInput>

export const updateTransportInput = z.object({
  ...transportFields,
  title: titleSchema.optional(),
})
export type UpdateTransportInput = z.infer<typeof updateTransportInput>

/* -------------------------------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------------------------------- */

/** A trip's transports in travel order: dated ones first by date and time, undated ideas last. */
export async function listTripTransports(
  scope: TenantScope,
  tripId: string,
  options: {
    readonly mode?: (typeof TRANSPORT_MODES)[number]
    readonly status?: (typeof TRANSPORT_STATUSES)[number]
  } = {},
): Promise<Array<Transport>> {
  return transportsRepository.findMany(scope, {
    where: and(
      eq(transports.tripId, tripId),
      options.mode ? eq(transports.mode, options.mode) : undefined,
      options.status ? eq(transports.status, options.status) : undefined,
    ),
    orderBy: [
      asc(transports.departureDate),
      asc(transports.departureTime),
      asc(transports.sortOrder),
      asc(transports.id),
    ],
  })
}

export async function getTransport(
  scope: TenantScope,
  transportId: string,
): Promise<Transport | null> {
  return transportsRepository.findById(scope, transportId)
}

export async function listDayTransports(
  scope: TenantScope,
  dayId: string,
): Promise<Array<Transport>> {
  return transportsRepository.findMany(scope, {
    where: eq(transports.dayId, dayId),
    orderBy: [asc(transports.departureTime), asc(transports.sortOrder)],
  })
}

/**
 * Every journey of the trip, with its legs, for the board to place into days.
 *
 * The trip is resolved first and the guard lives here rather than in the loader: a private trip's
 * journeys are endpoints, times, service numbers and fares, and a workspace member who cannot open
 * the trip passes the tenant filter (ADR 0007) — so they get a `NotFoundError` rather than a list.
 * No later caller can reach the rows without it.
 *
 * The **records** half answers every transport of the trip rather than only those naming a day. A
 * chained journey's day references live on its legs while its mode, its status and its title live
 * on the record, so a query that filtered the parent by `day_id` would draw every leg of an
 * ordinary chain with the generic glyph and no status. The filter belongs to the payload.
 */
export async function listTripDayTransports(
  scope: TenantScope,
  tripId: string,
): Promise<{
  readonly records: Array<Transport>
  readonly legs: Array<TransportLeg>
}> {
  await requireTrip(scope, tripId)
  const [records, legs] = await Promise.all([
    transportsRepository.findMany(scope, {
      where: eq(transports.tripId, tripId),
      orderBy: [asc(transports.sortOrder), asc(transports.id)],
    }),
    listTripLegs(scope, tripId),
  ])
  return { records, legs }
}

/** The next transport the traveller has to catch, across every trip in the tenant. */
export async function nextDeparture(
  scope: TenantScope,
  options: { readonly from?: string } = {},
): Promise<Transport | null> {
  const from = dateSchema.parse(
    options.from ?? new Date().toISOString().slice(0, 10),
  )
  const rows = await transportsRepository.findMany(scope, {
    where: and(
      gte(transports.departureDate, from),
      eq(transports.status, 'confirmed'),
    ),
    orderBy: [asc(transports.departureDate), asc(transports.departureTime)],
    limit: 1,
  })
  return rows[0] ?? null
}

export interface TransportModeTotals {
  readonly mode: (typeof TRANSPORT_MODES)[number]
  readonly count: number
  readonly distanceMetres: number
}

/** Transports and distance grouped by mode — the "how you travelled" breakdown on the transports screen. */
export async function summariseTripTransports(
  scope: TenantScope,
  tripId: string,
): Promise<Array<TransportModeTotals>> {
  const rows = await scope.db
    .select({
      mode: transports.mode,
      count: count(),
      distanceMetres: sum(transports.distanceMetres),
    })
    .from(transports)
    .where(tenantFilter(scope, transports, eq(transports.tripId, tripId)))
    .groupBy(transports.mode)
    .orderBy(desc(count()))

  return rows.flatMap((row) =>
    (TRANSPORT_MODES as ReadonlyArray<string>).includes(row.mode)
      ? [
          {
            mode: row.mode as (typeof TRANSPORT_MODES)[number],
            count: row.count,
            distanceMetres: Number(row.distanceMetres ?? 0),
          },
        ]
      : [],
  )
}

/** Total distance of a trip's transports, in metres. */
export async function totalTripDistanceMetres(
  scope: TenantScope,
  tripId: string,
): Promise<number> {
  return transportsRepository.sumOf(
    scope,
    transports.distanceMetres,
    and(eq(transports.tripId, tripId), isNotNull(transports.distanceMetres)),
  )
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

/**
 * Resolves both ends of a journey against the trip's own day run and refuses a
 * pair that runs backwards.
 *
 * `requireTripDay` is what makes a day id from the browser a day of *this* trip
 * rather than of any trip the caller can reach — the same guard `dayId` has
 * always had, now applied to both references. The ordering rule is here and not
 * only in the form because the form is a convenience and the repository is the
 * rule; a null on either end is no order to break.
 */
async function requireDayPair(
  scope: TenantScope,
  tripId: string,
  departureDayId: string | null,
  arrivalDayId: string | null,
): Promise<void> {
  const departure =
    departureDayId === null
      ? null
      : await requireTripDay(scope, tripId, departureDayId)
  const arrival =
    arrivalDayId === null
      ? null
      : await requireTripDay(scope, tripId, arrivalDayId)
  if (
    departure !== null &&
    arrival !== null &&
    arrival.dayNumber < departure.dayNumber
  ) {
    throw new RepositoryError(
      `A transport cannot arrive on day ${arrival.dayNumber} and depart on day ${departure.dayNumber}.`,
      'DAY_ORDER',
    )
  }
}

export async function createTransport(
  scope: TenantScope,
  input: CreateTransportInput,
): Promise<Transport> {
  const values = createTransportInput.parse(input)
  await requireTrip(scope, values.tripId)
  await assertTripRole(scope, values.tripId, WRITERS)
  await requireDayPair(
    scope,
    values.tripId,
    values.dayId ?? null,
    values.arrivalDayId ?? null,
  )
  return transportsRepository.insert(scope, values)
}

export async function updateTransport(
  scope: TenantScope,
  transportId: string,
  input: UpdateTransportInput,
): Promise<Transport> {
  const values = definedOnly(updateTransportInput.parse(input))
  const existing = await transportsRepository.requireById(scope, transportId)
  await assertTripRole(scope, existing.tripId, WRITERS)
  // The rule holds over the row that results, not over the fields that arrived: moving one end
  // alone is ordered against the end already stored, or a two-step edit walks past the guard.
  const departureDayId =
    'dayId' in values ? (values.dayId ?? null) : existing.dayId
  const arrivalDayId =
    'arrivalDayId' in values
      ? (values.arrivalDayId ?? null)
      : existing.arrivalDayId
  await requireDayPair(scope, existing.tripId, departureDayId, arrivalDayId)
  return transportsRepository.requireUpdate(scope, transportId, values)
}

export async function setTransportStatus(
  scope: TenantScope,
  transportId: string,
  status: (typeof TRANSPORT_STATUSES)[number],
): Promise<Transport> {
  const existing = await transportsRepository.requireById(scope, transportId)
  await assertTripRole(scope, existing.tripId, WRITERS)
  return transportsRepository.requireUpdate(scope, transportId, {
    status: z.enum(TRANSPORT_STATUSES).parse(status),
  })
}

export async function deleteTransport(
  scope: TenantScope,
  transportId: string,
): Promise<void> {
  const existing = await transportsRepository.requireById(scope, transportId)
  await assertTripRole(scope, existing.tripId, WRITERS)
  await transportsRepository.requireRemove(scope, transportId)
}

/* -------------------------------------------------------------------------------------------------
 * A journey's place on the day's number line
 * ---------------------------------------------------------------------------------------------- */

/**
 * One row of a day's resulting run, as the reorder names it.
 *
 * The stops and the notes are the **ruler**: they are read to find the gap a journey was dropped
 * into and are never written by this path — `reorderDayTimeline` owns their two columns.
 */
export const dayRunItemInput = z.strictObject(
  {
    kind: z.enum(['stop', 'note', 'transport', 'leg']),
    id: idSchema,
  },
  {
    error:
      'A day run item is a stop, a note, a transport or a leg, named by its id.',
  },
)
export type DayRunItemInput = z.infer<typeof dayRunItemInput>

/**
 * The most rows one day's run may carry.
 *
 * `reorderPlanFn` caps a day at 200 stops and notes; the journeys get their own 200 rather than
 * taking them out of that budget, so a day the primary write accepts is never refused for its
 * journeys.
 */
export const DAY_RUN_MAX_ITEMS = 400

/** The bound `reorderPlanFn` already applies to one day's stops and notes. */
export const DAY_RUN_MAX_ANCHORS = 200

export const reorderDayTransportsInput = z
  .object({
    tripId: idSchema,
    dayId: idSchema,
    items: z.array(dayRunItemInput).max(DAY_RUN_MAX_ITEMS),
  })
  .refine(
    ({ items }) =>
      items.filter((item) => item.kind === 'stop' || item.kind === 'note')
        .length <= DAY_RUN_MAX_ANCHORS,
    {
      message: `A day carries at most ${DAY_RUN_MAX_ANCHORS} stops and notes.`,
      path: ['items'],
    },
  )
export type ReorderDayTransportsInput = z.infer<
  typeof reorderDayTransportsInput
>

/** `kind/id`, so the four id spaces share one `Set` without colliding. */
function runKey(ref: DayRunItemInput): string {
  return `${ref.kind}/${ref.id}`
}

/** True for the two kinds that carry a stored position this path may not write. */
function isAnchor(ref: DayRunItemInput): boolean {
  return ref.kind === 'stop' || ref.kind === 'note'
}

interface DayRunEntry {
  readonly ref: DayRunItemInput
  readonly position: number
}

/**
 * The journeys that **depart** from one day: a record with no legs whose `day_id` is this day, and
 * a leg whose `departure_day_id` is.
 *
 * A journey drawn as its legs is never also drawn whole, so a record that has legs contributes
 * nothing here — its legs do, each on its own departure day.
 *
 * Read as the **day** rather than as the trip, unlike {@link listTripDayTransports}, which answers
 * the board and has to draw every day at once. The placement below needs one day of a set that
 * grows with the whole itinerary, and the planner issues one placement per day a drag touches, in
 * parallel — so borrowing the board's read here meant pulling every `transports` and
 * `transport_legs` row of the trip to keep one day's.
 *
 * Three questions, asked together, and each one of them an index seek rather than a filter over
 * the trip — `EXPLAIN QUERY PLAN` is the assertion, in `transports.test.ts`, because a day-scoped
 * `WHERE` that the planner answers by walking the trip is trip-wide work wearing the right words,
 * and D1 bills rows read:
 *
 * 1. the records of this day (`transports_org_trip_day_idx`),
 * 2. the legs that depart from it (`transport_legs_org_trip_departure_day_idx`) — the half this
 *    run places,
 * 3. which of those records have legs at all (`transport_legs_org_transport_idx`), which is the
 *    only thing that can say a record of this day is drawn as its legs and so not drawn whole.
 *
 * The third is one question, not three merged into the second with an `OR`: an `OR` across two
 * columns costs SQLite the seek and sends it back to walking the trip's legs. It reads the ids it
 * needs as a subquery rather than waiting for (1), so all three still go out together.
 *
 * None of them orders, unlike the trip-wide reads next door: the caller sorts this list against
 * the day's stops and notes and breaks every tie by id, so an `ORDER BY` here would be a sort
 * SQLite performs and the caller discards.
 */
async function departingJourneys(
  scope: TenantScope,
  tripId: string,
  dayId: string,
): Promise<Array<DayRunEntry>> {
  const ofTheDay = and(
    eq(transports.tripId, tripId),
    eq(transports.dayId, dayId),
  )
  const theDaysRecords = scope.db
    .select({ id: transports.id })
    .from(transports)
    .where(tenantFilter(scope, transports, ofTheDay))

  const [records, legs, chainedRows] = await Promise.all([
    transportsRepository.findMany(scope, { where: ofTheDay }),
    transportLegsRepository.findMany(scope, {
      where: and(
        eq(transportLegs.tripId, tripId),
        eq(transportLegs.departureDayId, dayId),
      ),
    }),
    scope.db
      .select({ transportId: transportLegs.transportId })
      .from(transportLegs)
      .where(
        tenantFilter(
          scope,
          transportLegs,
          inArray(transportLegs.transportId, theDaysRecords),
        ),
      ),
  ])

  const chained = new Set(chainedRows.map((row) => row.transportId))
  return [
    ...records
      .filter((row) => !chained.has(row.id))
      .map((row) => ({
        ref: { kind: 'transport' as const, id: row.id },
        position: row.sortOrder,
      })),
    ...legs.map((leg) => ({
      ref: { kind: 'leg' as const, id: leg.id },
      position: leg.sortOrder,
    })),
  ]
}

/**
 * The value a journey takes between the anchor it follows and the next one.
 *
 * `a` is the **stored** position of the preceding stop or note and `b` the next stored position
 * strictly greater than it — never a count of entries, because a day is numbered `0..n-1` only
 * straight after `reorderPlanFn` renumbers it: `schedulePlaceFn` stores a new stop at the midpoint
 * of its neighbours and `unschedulePlaceFn` deletes one without renumbering, so on a day of stops
 * at `0` and `2` an index formula would write `1.5` for a journey that belongs behind the second.
 *
 * An open end is one unit wide: `b − 1` ahead of the day's first anchor, `a + 1` behind its last,
 * and `0`/`1` on a day with neither. Every value therefore lies strictly between two stored
 * positions and ties with no stop or note.
 */
function splitGap(
  before: number | null,
  anchorPositions: ReadonlyArray<number>,
  sharing: number,
): Array<number> {
  const first = anchorPositions.at(0)
  const [low, high] =
    before === null
      ? [(first ?? 1) - 1, first ?? 1]
      : [before, anchorPositions.find((value) => value > before) ?? before + 1]

  return Array.from(
    { length: sharing },
    (_unused, index) => low + ((index + 1) * (high - low)) / (sharing + 1),
  )
}

/**
 * Places one day's journey rows between the stops and notes the run names.
 *
 * A day is one number line, and the writer that renumbers it — `reorderDayTimeline` — is owned by
 * another module this stage may not edit. A journey therefore cannot be *inside* that renumbering
 * and expresses where it sits **between** two of its positions, through the fractional key
 * `sort_order` was declared to be (`schema.ts`). The server derives the fraction; the client sends
 * only which stop or note each journey follows.
 *
 * The three rules about the list the client sends are `reorderDayTimeline`'s, for the same reasons:
 *
 * - **Unknown ids are dropped, not rejected.** A tab one delete behind must still be able to
 *   reorder the rows that do exist. A forged id therefore moves nothing, and a real stop id placed
 *   out of order can only misposition the caller's own journey inside the caller's own day — an
 *   arrangement they could have sent directly, and one the next reorder heals.
 * - **Known ids the client omitted go back behind the row they currently follow**, before any gap
 *   is split, so a journey the payload left out is counted among the journeys sharing its gap and
 *   rewritten with them rather than left at a value a recomputed sibling could land on.
 * - **The stops and notes are the ruler and are never written.** Only `transports.sort_order` and
 *   `transport_legs.sort_order` are, and all of them in one {@link runBatch} — one transaction on
 *   D1, because half a day's journeys re-placed is not a state anything can render honestly.
 *
 * Returns the journeys as written, in the order they were written, which is what the caller mirrors
 * to the trip room — `reorderDayTimeline`'s contract, for its reason: a dropped id and a re-inserted
 * one both make the request a different day from the one on disk, and the room must hear the disk.
 */
export async function reorderDayTransports(
  scope: TenantScope,
  input: ReorderDayTransportsInput,
  resolvedTrip?: Trip,
): Promise<Array<DayRunItemInput>> {
  const values = reorderDayTransportsInput.parse(input)

  // Trip, then role, then day — the order `reorderDayTimeline` records: a caller who may not see
  // the trip learns nothing beyond `NotFoundError`.
  //
  // The trip is the one of the three a caller can hand in already proved, and `resolvedTrip` is
  // that proof: the planner's handler resolves the trip to refuse an archived one immediately
  // before calling this, so re-reading it here is a second read of a row already in memory. Omit
  // the argument, or name a different trip with it, and the trip is resolved here exactly as
  // before — which is what every other caller, and both isolation suites, do.
  //
  // What it is trusted for, exactly: that the caller has *already run this same guard in this same
  // scope*. `Trip` cannot say so — the type is the row, not the proof — so a caller that hands in a
  // row it read some other way trades the refusal this line would have given for the one
  // `assertTripRole` gives next, `FORBIDDEN` rather than `NotFoundError`. The write is still
  // refused either way (`member-isolation.test.ts` holds that line for the three-argument form),
  // but the refusal names the trip, so this argument is for a caller that has run `requireTrip`
  // and for no one else.
  if (resolvedTrip?.id !== values.tripId) {
    await requireTrip(scope, values.tripId)
  }
  await assertTripRole(scope, values.tripId, WRITERS)
  await requireTripDay(scope, values.tripId, values.dayId)

  const [stops, notes, journeys] = await Promise.all([
    listDayAssignments(scope, values.dayId),
    listDayNotes(scope, values.dayId),
    departingJourneys(scope, values.tripId, values.dayId),
  ])

  const anchors: Array<DayRunEntry> = [
    ...stops.map((row) => ({
      ref: { kind: 'stop' as const, id: row.id },
      position: row.orderIndex,
    })),
    ...notes.map((row) => ({
      ref: { kind: 'note' as const, id: row.id },
      position: row.sortOrder,
    })),
  ]

  // The day as it stands. A journey that ties with a stop or a note follows it — the client's rule,
  // and the only tie this design can produce (`schedulePlaceFn` positions a stop among stops alone,
  // so it can land on a note's integer).
  const current = [...anchors, ...journeys].sort(
    (a, b) =>
      a.position - b.position ||
      Number(isAnchor(b.ref)) - Number(isAnchor(a.ref)) ||
      a.ref.id.localeCompare(b.ref.id),
  )

  const known = new Map(current.map((entry) => [runKey(entry.ref), entry.ref]))
  const wanted: Array<DayRunItemInput> = []
  const seen = new Set<string>()
  for (const ref of values.items) {
    const key = runKey(ref)
    const row = known.get(key)
    if (row === undefined || seen.has(key)) continue
    seen.add(key)
    wanted.push(row)
  }

  let previousKey: string | null = null
  for (const entry of current) {
    const key = runKey(entry.ref)
    if (!seen.has(key)) {
      const anchor =
        previousKey === null
          ? -1
          : wanted.findIndex((ref) => runKey(ref) === previousKey)
      seen.add(key)
      wanted.splice(anchor + 1, 0, entry.ref)
    }
    previousKey = key
  }

  const positionOfAnchor = new Map(
    anchors.map((entry) => [runKey(entry.ref), entry.position]),
  )
  const anchorPositions = anchors
    .map((entry) => entry.position)
    .sort((a, b) => a - b)

  const written: Array<{ ref: DayRunItemInput; position: number }> = []
  let before: number | null = null
  let run: Array<DayRunItemInput> = []
  const flush = (): void => {
    if (run.length === 0) return
    const positions = splitGap(before, anchorPositions, run.length)
    for (const [index, ref] of run.entries()) {
      written.push({ ref, position: positions[index] })
    }
    run = []
  }
  for (const ref of wanted) {
    if (isAnchor(ref)) {
      flush()
      before = positionOfAnchor.get(runKey(ref)) ?? before
      continue
    }
    run.push(ref)
  }
  flush()

  await runBatch(
    scope,
    written.map(({ ref, position }) =>
      ref.kind === 'transport'
        ? scope.db
            .update(transports)
            .set({ sortOrder: position })
            .where(tenantFilter(scope, transports, eq(transports.id, ref.id)))
        : scope.db
            .update(transportLegs)
            .set({ sortOrder: position })
            .where(
              tenantFilter(scope, transportLegs, eq(transportLegs.id, ref.id)),
            ),
    ),
  )

  return written.map(({ ref }) => ref)
}

/* -------------------------------------------------------------------------------------------------
 * The station chain
 * ---------------------------------------------------------------------------------------------- */

/**
 * The most legs one chain may hold.
 *
 * A bound on the validated array — a payload limit — and not a statement about how many changes a
 * journey may have: the mirrored `route` patch has to stay inside the 32 KiB frame
 * `src/server/do/protocol.ts` fixes. Twelve legs is thirteen stations, which is more changes than
 * any timetable in the world asks of one ticket.
 */
export const CHAIN_MAX_LEGS = 12

/** An IANA name the platform accepts, refused rather than silently rewritten to `UTC`. */
const timeZoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((value) => resolveTimeZone(value) === value, {
    message: 'must be an IANA time zone name',
  })

/**
 * One station on the chain — where it is, not when anything happens there.
 *
 * Times are per *leg end* and never per station: a change at Nagoya arrives at 14:05 and leaves at
 * 14:32, so one station carries two clocks and neither belongs to it.
 */
const stationSchema = z.object({
  name: titleSchema,
  code: codeSchema.nullish(),
  lat: latitudeSchema.nullish(),
  lng: longitudeSchema.nullish(),
  /** What makes this endpoint's times readable somewhere else. */
  timezone: timeZoneSchema.nullish(),
})
export type ChainStationInput = z.infer<typeof stationSchema>

/** The part of a leg that is not its two endpoints: the ticket, and the two clocks. */
const chainLegSchema = z.object({
  serviceNumber: shortTextSchema.nullish(),
  platform: shortTextSchema.nullish(),
  seat: shortTextSchema.nullish(),
  departureDayId: idSchema.nullish(),
  arrivalDayId: idSchema.nullish(),
  departureDate: dateSchema.nullish(),
  departureTime: timeSchema.nullish(),
  arrivalDate: dateSchema.nullish(),
  arrivalTime: timeSchema.nullish(),
  sortOrder: sortOrderSchema.optional(),
})
export type ChainLegInput = z.infer<typeof chainLegSchema>

/**
 * A whole chain, as the one writer accepts it.
 *
 * Stations and legs arrive apart rather than as legs carrying two endpoints each, and that is the
 * whole of the join guarantee: the station two legs meet at is written once and read into both
 * rows, so leg *i*'s arrival endpoint and leg *i+1*'s departure endpoint cannot disagree about
 * which station they name. `legs.length === stations.length - 1` is then the only arithmetic left,
 * and it is checked here rather than trusted.
 *
 * Both empty is the legal way to say "this journey is not a chain": the rows go and the record's
 * own endpoints are left exactly as they were.
 */
export const transportChainInput = z
  .object({
    stations: z.array(stationSchema).max(CHAIN_MAX_LEGS + 1),
    legs: z.array(chainLegSchema).max(CHAIN_MAX_LEGS),
  })
  .refine(
    ({ stations, legs }) =>
      (stations.length === 0 && legs.length === 0) ||
      (stations.length >= 2 && legs.length === stations.length - 1),
    {
      message:
        'A chain of N stations has exactly N−1 legs, and N is 2 or more.',
    },
  )
export type TransportChainInput = z.input<typeof transportChainInput>

/** One transport's legs, in chain order. */
export async function listTransportLegs(
  scope: TenantScope,
  transportId: string,
): Promise<Array<TransportLeg>> {
  return transportLegsRepository.findMany(scope, {
    where: eq(transportLegs.transportId, transportId),
    orderBy: [asc(transportLegs.position), asc(transportLegs.id)],
  })
}

/** Every leg of a trip, for the desk and for the day timeline. */
export async function listTripLegs(
  scope: TenantScope,
  tripId: string,
): Promise<Array<TransportLeg>> {
  return transportLegsRepository.findMany(scope, {
    where: eq(transportLegs.tripId, tripId),
    orderBy: [
      asc(transportLegs.transportId),
      asc(transportLegs.position),
      asc(transportLegs.id),
    ],
  })
}

/** `''` and `undefined` both mean "no reference"; the column takes `null`. */
function refOf(value: string | null | undefined): string | null {
  return value === null || value === undefined || value === '' ? null : value
}

/**
 * Resolves every day a chain references, then orders each leg's pair.
 *
 * Not `requireDayPair` in a loop: a twelve-leg chain names at most thirteen
 * distinct days but up to twenty-four references, and awaiting each in turn is
 * twenty-four sequential D1 round trips inside one request. The distinct ids are
 * resolved once and concurrently — every one of them still through
 * `requireTripDay`, so a day of another trip is still a `NotFoundError` and not
 * a reference written quietly across a boundary — and the ordering rule is then
 * arithmetic over numbers already in hand.
 */
async function requireChainDays(
  scope: TenantScope,
  tripId: string,
  legs: ReadonlyArray<ChainLegInput>,
): Promise<void> {
  const pairs = legs.map((leg) => [
    refOf(leg.departureDayId),
    refOf(leg.arrivalDayId),
  ])
  const ids = new Set(pairs.flat().filter((id): id is string => id !== null))

  const numbers = new Map<string, number>()
  await Promise.all(
    [...ids].map(async (id) => {
      const day = await requireTripDay(scope, tripId, id)
      numbers.set(id, day.dayNumber)
    }),
  )

  for (const [departureDayId, arrivalDayId] of pairs) {
    if (departureDayId === null || arrivalDayId === null) {
      continue
    }
    const departure = numbers.get(departureDayId)
    const arrival = numbers.get(arrivalDayId)
    if (
      departure !== undefined &&
      arrival !== undefined &&
      arrival < departure
    ) {
      throw new RepositoryError(
        `A leg cannot arrive on day ${arrival} and depart on day ${departure}.`,
        'DAY_ORDER',
      )
    }
  }
}

/**
 * The only writer of `transport_legs`.
 *
 * It resolves the parent inside the caller's own scope first — a well-formed transport id from a
 * client is not an authorised transport id — then resolves every day reference against *that
 * record's* trip, then deletes and re-inserts the whole chain in **one batch**. `db.batch()` is a
 * real transaction on D1: statements run in order and a failure rolls the sequence back, which is
 * the property a chain needs, because a half-replaced chain is a journey with two station threes.
 *
 * The parent's flat `departure_*` / `arrival_*` columns are rewritten from the first and last
 * station in that same batch, so the two representations of one journey cannot drift apart and a
 * reader that knows nothing about legs still sees where the journey starts and ends.
 */
export async function replaceTransportChain(
  scope: TenantScope,
  transportId: string,
  input: TransportChainInput,
): Promise<Array<TransportLeg>> {
  const { stations, legs } = transportChainInput.parse(input)
  const parent = await transportsRepository.requireById(scope, transportId)
  await assertTripRole(scope, parent.tripId, WRITERS)

  await requireChainDays(scope, parent.tripId, legs)

  // The chain is rewritten by delete-and-reinsert, so a leg's day position would be lost on every
  // edit — and since the planner reads `sort_order`, renaming a service number would throw the
  // whole journey to the head of its day. The previous row at the same `position` hands its value
  // on when it departed from the same day; identity by position is a heuristic, and what a station
  // inserted mid-chain mis-carries, the next reorder of that day re-places.
  const previous = new Map(
    (await listTransportLegs(scope, parent.id)).map((row) => [
      row.position,
      row,
    ]),
  )

  const rows = legs.map((leg, index) => {
    // `stations[index + 1]` exists for every leg: the refinement above fixed the arithmetic.
    const from = stations[index]
    const to = stations[index + 1]
    const departureDayId = refOf(leg.departureDayId)
    const carried = previous.get(index)
    const keptSortOrder =
      carried !== undefined && carried.departureDayId === departureDayId
        ? carried.sortOrder
        : index
    return {
      organizationId: scope.ctx.organizationId,
      tripId: parent.tripId,
      transportId: parent.id,
      position: index,
      fromName: from.name,
      fromCode: from.code ?? null,
      fromLat: from.lat ?? null,
      fromLng: from.lng ?? null,
      fromTimezone: from.timezone ?? null,
      toName: to.name,
      toCode: to.code ?? null,
      toLat: to.lat ?? null,
      toLng: to.lng ?? null,
      toTimezone: to.timezone ?? null,
      serviceNumber: leg.serviceNumber ?? null,
      platform: leg.platform ?? null,
      seat: leg.seat ?? null,
      departureDayId,
      arrivalDayId: refOf(leg.arrivalDayId),
      departureDate: leg.departureDate ?? null,
      departureTime: leg.departureTime ?? null,
      arrivalDate: leg.arrivalDate ?? null,
      arrivalTime: leg.arrivalTime ?? null,
      sortOrder: leg.sortOrder ?? keptSortOrder,
    }
  })

  const statements: Array<BatchStatement> = [
    scope.db
      .delete(transportLegs)
      .where(
        tenantFilter(
          scope,
          transportLegs,
          eq(transportLegs.transportId, parent.id),
        ),
      ),
  ]
  const first = rows.at(0)
  const last = rows.at(-1)
  if (first !== undefined && last !== undefined) {
    statements.push(scope.db.insert(transportLegs).values(rows))
    statements.push(
      scope.db
        .update(transports)
        .set({
          departureName: first.fromName,
          departureCode: first.fromCode,
          departureLat: first.fromLat,
          departureLng: first.fromLng,
          departureTimezone: first.fromTimezone,
          departureDate: first.departureDate,
          departureTime: first.departureTime,
          arrivalName: last.toName,
          arrivalCode: last.toCode,
          arrivalLat: last.toLat,
          arrivalLng: last.toLng,
          arrivalTimezone: last.toTimezone,
          arrivalDate: last.arrivalDate,
          arrivalTime: last.arrivalTime,
        })
        .where(tenantFilter(scope, transports, eq(transports.id, parent.id))),
    )
  }

  await runBatch(scope, statements)
  return listTransportLegs(scope, parent.id)
}

/* -------------------------------------------------------------------------------------------------
 * A connection the traveller did not have to look up
 * ---------------------------------------------------------------------------------------------- */

/**
 * A connection found by the transit proxy, as this repository accepts it.
 *
 * Everything about it is ordinary. A found connection is a `transports` row with a mode already in
 * {@link TRANSPORT_MODES} and a chain of stations in `transport_legs` — the shapes `03-S2b`
 * already built — so a saved connection is editable afterwards exactly like a journey somebody
 * typed by hand, and nothing about it needs a second table, a second writer or a second screen.
 *
 * `transportId` is what separates the two acts this input describes: absent, the connection is
 * saved as a new journey; present, it **replaces the route of a journey that already exists**
 * while keeping its identity, its status and its booking fields.
 */
export const searchedConnectionInput = z
  .object({
    tripId: idSchema,
    /** Absent for a new journey; the record being re-searched otherwise. */
    transportId: idSchema.nullish(),
    mode: z.enum(TRANSPORT_MODES),
    title: titleSchema,
    /** Minor units beside a three-letter code, or neither. A fare is never guessed. */
    priceMinor: minorAmountSchema.nullish(),
    currency: currencySchema.nullish(),
    stations: z
      .array(stationSchema)
      .min(2)
      .max(CHAIN_MAX_LEGS + 1),
    legs: z.array(chainLegSchema).min(1).max(CHAIN_MAX_LEGS),
  })
  .refine(({ stations, legs }) => legs.length === stations.length - 1, {
    message: 'A chain of N stations has exactly N−1 legs, and N is 2 or more.',
  })
export type SearchedConnectionInput = z.input<typeof searchedConnectionInput>

/** What the save answers: the record, and the chain it now has. */
export interface SavedConnection {
  readonly transport: Transport
  readonly legs: Array<TransportLeg>
}

/**
 * The record a found connection is first written as.
 *
 * The endpoints are set here as well as by the chain writer, so a save whose second half never
 * lands leaves a journey that says where it goes rather than an empty row. The status is left to
 * the column's own default — a connection somebody chose is not a connection anybody booked.
 */
function newRecordFrom(
  values: z.output<typeof searchedConnectionInput>,
): CreateTransportInput {
  // Both ends exist: the validator refuses fewer than two stations and fewer than one leg.
  const first = values.stations[0]
  const last = values.stations[values.stations.length - 1]
  const firstLeg = values.legs[0]
  const lastLeg = values.legs[values.legs.length - 1]
  return {
    tripId: values.tripId,
    mode: values.mode,
    title: values.title,
    priceMinor: values.priceMinor ?? null,
    currency: values.currency ?? null,
    departureName: first.name,
    departureCode: first.code ?? null,
    departureLat: first.lat ?? null,
    departureLng: first.lng ?? null,
    departureTimezone: first.timezone ?? null,
    departureDate: firstLeg.departureDate ?? null,
    departureTime: firstLeg.departureTime ?? null,
    arrivalName: last.name,
    arrivalCode: last.code ?? null,
    arrivalLat: last.lat ?? null,
    arrivalLng: last.lng ?? null,
    arrivalTimezone: last.timezone ?? null,
    arrivalDate: lastLeg.arrivalDate ?? null,
    arrivalTime: lastLeg.arrivalTime ?? null,
  }
}

/**
 * Save a found connection as a first-class journey, or replace the route of one already saved.
 *
 * **It writes through {@link replaceTransportChain} rather than beside it.** A found connection is
 * N stations and N−1 legs, which is exactly what that writer already refuses to get wrong: one
 * batch, the delete and the inserts and the parent's endpoint rewrite together, so a
 * half-replaced chain is not a state this path can reach either. Everything this function adds is
 * the record the chain hangs off.
 *
 * **A re-search keeps the record.** The plan's story is a timetable change that must not cost the
 * traveller their booking code and their seat, so the title, the status, the price and every
 * booking field are read from the row and left there; only the stations, the legs and the flat
 * endpoints derived from them move. A journey re-searched is the same journey.
 *
 * **The trip is resolved first, then the transport, then their agreement.** Two ids arrive from
 * the browser and a well-formed one is not an authorised one. The third check is not redundant:
 * within one workspace, a transport of *another* trip would otherwise be re-routed by a caller who
 * named a trip they can see and a transport they can also see.
 *
 * **No day reference is invented.** A timetable knows dates and clocks; it does not know which day
 * of the trip they are. The legs carry the wall clocks the provider stated and the day selects in
 * the dialog stay the traveller's to answer, which is the same posture `03-S1` took for the two
 * ends of a journey typed by hand.
 */
export async function saveSearchedConnection(
  scope: TenantScope,
  input: SearchedConnectionInput,
): Promise<SavedConnection> {
  const values = searchedConnectionInput.parse(input)
  await requireTrip(scope, values.tripId)

  const requested = values.transportId ?? null
  const existing =
    requested === null
      ? null
      : await transportsRepository.requireById(scope, requested)
  if (existing !== null && existing.tripId !== values.tripId) {
    throw new NotFoundError('transport', existing.id)
  }

  const parent =
    existing ?? (await createTransport(scope, newRecordFrom(values)))

  const legs = await replaceTransportChain(scope, parent.id, {
    stations: values.stations,
    legs: values.legs,
  })

  // Re-read rather than return `parent`: the chain writer rewrote the flat endpoints in its own
  // batch, so the row in hand is one write out of date for a re-search.
  return {
    transport: await transportsRepository.requireById(scope, parent.id),
    legs,
  }
}
