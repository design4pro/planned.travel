/**
 * Transports — the movements between places: flights, trains, ferries, the hire car.
 *
 * A transport is stored with its own departure/arrival endpoints rather than as a pair of place
 * ids, because most journeys start or end somewhere that is not a place on the itinerary (an
 * airport, a station). A transport may hang off a day, but it does not have to.
 *
 * A long-distance journey is a **chain of stations** rather than a pair of them, and the part
 * between two consecutive stations is a **leg** (`CONTEXT.md`). Legs are rows in `transport_legs`
 * and are written only by {@link saveTransport} and {@link replaceTransportChain}, which share one
 * planner for the rows; a transport with no rows there is read as
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
  newId,
  transportLegs,
  transports,
} from '#/server/db/schema'
import { createTenantRepository, tenantFilter } from './base'
import { boundParametersPerRow, chunkFor, runBatch } from './batch'
import {
  isUniqueConstraintViolation,
  NotFoundError,
  RepositoryError,
} from './context'
import { listDayNotes, requireTripDay } from './days'
import { listDayAssignments } from './itinerary'
import { assertTripRole, requireTrip } from './trips'

import type { TripRole } from './trips'
import { resolveTimeZone } from '#/lib/time'
import {
  CHAIN_MAX_LEGS,
  CHAIN_MAX_STATIONS,
  CHAIN_MIN_LEGS,
  CHAIN_MIN_STATIONS,
  chainShapeIssue,
} from '#/lib/transport-chain'
import { TRANSPORT_SAVE_INTENTS } from '#/lib/transport-save-intent'
import { arrivesBeforeDeparts } from '#/lib/transport-timing'
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
import type { LegClocks, LegZones } from '#/lib/transport-timing'
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

/**
 * Refuses a Transport or a Leg that lands before it takes off.
 *
 * The rule is the dialog's own, from `#/lib/transport-timing`: real instants when both ends name
 * a zone, wall clocks otherwise. It is here and not in the server functions because every writer
 * passes through this file and not all of them through a server function that checked — a chain
 * and a found connection used to reach the table with no ordering check at all.
 */
function requireTimeOrder(
  subject: 'transport' | 'leg',
  clocks: LegClocks,
  zones: LegZones,
): void {
  if (arrivesBeforeDeparts(clocks, zones)) {
    throw new RepositoryError(
      `This ${subject} arrives before it departs. Check the times.`,
      'TIME_ORDER',
    )
  }
}

/** Every leg of a chain, each judged in the zones of the two stations it runs between. */
function requireLegOrder(
  stations: ReadonlyArray<ChainStationInput>,
  legs: ReadonlyArray<ChainLegInput>,
): void {
  legs.forEach((leg, index) => {
    requireTimeOrder('leg', leg, {
      from: stations.at(index)?.timezone,
      to: stations.at(index + 1)?.timezone,
    })
  })
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
  requireTimeOrder('transport', values, {
    from: values.departureTimezone,
    to: values.arrivalTimezone,
  })
  return transportsRepository.insert(scope, values)
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

/**
 * Unlinks every transport of this tenant that arrives on one of `dayIds`, and answers how many.
 *
 * Called by the day deleters in `days.ts` immediately before the days go, and that ordering is the
 * whole point. `schema.ts` declares `arrival_day_id` as `on delete: 'set null'`, but it arrived by
 * `ADD COLUMN`, which carries no `ON DELETE` clause, so what D1 actually enforces is `NO ACTION` —
 * pinned by `migrations-match-schema.test.ts`. Closing that gap in the database would mean either
 * hand-editing a generated migration or rebuilding the table, so the rule the schema promises is
 * kept here instead: without this, deleting the day a journey lands on raises
 * `FOREIGN KEY constraint failed` (#186).
 *
 * `day_id` needs no such help: it was created with its table, so its `set null` is the deployed one.
 *
 * Scoped like every other statement in this file, so a day id belonging to another organization
 * matches no row rather than clearing one.
 */
export async function unlinkTransportsFromDays(
  scope: TenantScope,
  dayIds: ReadonlyArray<string>,
): Promise<number> {
  const rows = await transportsRepository.updateWhere(
    scope,
    inArray(transports.arrivalDayId, [...dayIds]),
    { arrivalDayId: null },
  )
  return rows.length
}

/* -------------------------------------------------------------------------------------------------
 * A journey's place on the day's number line
 * ---------------------------------------------------------------------------------------------- */

/**
 * One row of a day's resulting run, as the reorder names it.
 *
 * The stops and the notes are the **ruler**: they are read to find the gap a journey was dropped
 * into and are never written by this path — `reorderDayTimelines` owns their two columns.
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
 * A day is one number line, and the writer that renumbers it — `reorderDayTimelines` — is owned by
 * another module this stage may not edit. A journey therefore cannot be *inside* that renumbering
 * and expresses where it sits **between** two of its positions, through the fractional key
 * `sort_order` was declared to be (`schema.ts`). The server derives the fraction; the client sends
 * only which stop or note each journey follows.
 *
 * The three rules about the list the client sends are `reorderDayTimelines`'s, for the same reasons:
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
 * to the trip room — `reorderDayTimelines`'s contract, for its reason: a dropped id and a re-inserted
 * one both make the request a different day from the one on disk, and the room must hear the disk.
 */
export async function reorderDayTransports(
  scope: TenantScope,
  input: ReorderDayTransportsInput,
  resolvedTrip?: Trip,
): Promise<Array<DayRunItemInput>> {
  const values = reorderDayTransportsInput.parse(input)

  // Trip, then role, then day — the order `reorderDayTimelines` records: a caller who may not see
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

/** The arithmetic between a chain's two arrays, raised as an issue on the object that holds them. */
function refineChainShape(
  { stations, legs }: { stations: Array<unknown>; legs: Array<unknown> },
  ctx: z.RefinementCtx,
): void {
  const issue = chainShapeIssue(stations.length, legs.length)
  if (issue !== null) {
    ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message })
  }
}

/**
 * A whole chain, as the chain writers accept it.
 *
 * Stations and legs arrive apart rather than as legs carrying two endpoints each, and that is the
 * whole of the join guarantee: the station two legs meet at is written once and read into both
 * rows, so leg *i*'s arrival endpoint and leg *i+1*'s departure endpoint cannot disagree about
 * which station they name. `legs.length === stations.length - 1` is then the only arithmetic left,
 * and it is checked here, by the rule `#/lib/transport-chain` shares with the dialog and the server
 * functions, rather than trusted.
 *
 * Both empty is the legal way to say "this journey is not a chain": the rows go and the record's
 * own endpoints are left exactly as they were.
 */
export const transportChainInput = z
  .object({
    stations: z.array(stationSchema).max(CHAIN_MAX_STATIONS),
    legs: z.array(chainLegSchema).max(CHAIN_MAX_LEGS),
  })
  .superRefine(refineChainShape)
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

/** The record columns a chain owns: the flat form of its outer stations and their clocks. */
type ChainEndpoints = Pick<
  typeof transports.$inferInsert,
  | 'departureName'
  | 'departureCode'
  | 'departureLat'
  | 'departureLng'
  | 'departureTimezone'
  | 'departureDate'
  | 'departureTime'
  | 'arrivalName'
  | 'arrivalCode'
  | 'arrivalLat'
  | 'arrivalLng'
  | 'arrivalTimezone'
  | 'arrivalDate'
  | 'arrivalTime'
>

/**
 * The statements that put a chain in place of whatever the transport had, and the endpoints the
 * record takes from it.
 *
 * Shared by the two writers of `transport_legs` so that "the outer stations are the record's
 * endpoints" is stated once. `endpoints` is `null` for an empty chain: the record's own endpoints
 * are then the journey and are left as they were.
 *
 * The chain is rewritten by delete-and-reinsert, so a leg's day position would be lost on every
 * edit — and since the planner reads `sort_order`, renaming a service number would throw the whole
 * journey to the head of its day. The previous row at the same `position` hands its value on when
 * it departed from the same day; identity by position is a heuristic, and what a station inserted
 * mid-chain mis-carries, the next reorder of that day re-places.
 */
function planChain(
  scope: TenantScope,
  parent: { readonly id: string; readonly tripId: string },
  { stations, legs }: z.output<typeof transportChainInput>,
  previousLegs: ReadonlyArray<TransportLeg>,
): { statements: Array<BatchStatement>; endpoints: ChainEndpoints | null } {
  const previous = new Map(previousLegs.map((row) => [row.position, row]))

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
  if (first === undefined || last === undefined) {
    return { statements, endpoints: null }
  }

  // One statement per chunk, still inside the one batch: a whole chain in one insert binds
  // more parameters than D1 accepts from its fourth leg on.
  const size = chunkFor(boundParametersPerRow(transportLegs))
  for (let index = 0; index < rows.length; index += size) {
    statements.push(
      scope.db.insert(transportLegs).values(rows.slice(index, index + size)),
    )
  }
  return {
    statements,
    endpoints: {
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
    },
  }
}

/**
 * Replaces the chain of a transport that already exists.
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
 *
 * Neither save path comes through here: {@link saveTransport} writes the record in the same batch,
 * for the hand-typed dialog and for a found connection alike. This is the chain on its own, for a
 * record that already exists and needs nothing but its route replaced.
 */
export async function replaceTransportChain(
  scope: TenantScope,
  transportId: string,
  input: TransportChainInput,
): Promise<Array<TransportLeg>> {
  const chain = transportChainInput.parse(input)
  const parent = await transportsRepository.requireById(scope, transportId)
  await assertTripRole(scope, parent.tripId, WRITERS)

  requireLegOrder(chain.stations, chain.legs)
  await requireChainDays(scope, parent.tripId, chain.legs)

  const { statements, endpoints } = planChain(
    scope,
    parent,
    chain,
    await listTransportLegs(scope, parent.id),
  )
  if (endpoints !== null) {
    statements.push(
      scope.db
        .update(transports)
        .set(endpoints)
        .where(tenantFilter(scope, transports, eq(transports.id, parent.id))),
    )
  }

  await runBatch(scope, statements)
  return listTransportLegs(scope, parent.id)
}

/* -------------------------------------------------------------------------------------------------
 * A transport and its legs, saved as one
 * ---------------------------------------------------------------------------------------------- */

/**
 * One Transport with its chain, as the dialog saves it.
 *
 * `transportId` is the row's identity and the caller mints it for a new transport: saving the same
 * draft twice is then an edit of the row the first press wrote, not a second row.
 *
 * `intent` says what the caller means, and it only chooses between two outcomes that are both
 * inside the caller's own scope, so it widens no access: `edit` refuses a row that is not there
 * (deleted in another tab, or never the caller's) instead of writing it back, and `create` of an id
 * the caller already wrote stays an edit, which is what makes a double press safe. Whether the row
 * exists is still decided here, inside the caller's scope, and never from the caller's say-so.
 */
export const saveTransportInput = z.object({
  tripId: idSchema,
  transportId: idSchema,
  intent: z.enum(TRANSPORT_SAVE_INTENTS),
  record: z.object(transportFields),
  chain: transportChainInput,
})
export type SaveTransportInput = z.input<typeof saveTransportInput>

/** What a save answers: the record as written, and the chain it now has. */
export interface SavedTransport {
  readonly transport: Transport
  readonly legs: Array<TransportLeg>
}

/**
 * Saves a Transport and its Legs in **one batch**: the record is created or updated, the chain
 * replaced, and the record's endpoints taken from the chain's outer stations — all or nothing, so
 * a half-saved transport is not a state this path can leave behind.
 *
 * **The record's day pair is the caller's.** Nothing here derives a day from the legs: a night
 * train leaves on one day and lands on another and only the traveller knows which. Each leg's days
 * are resolved against the trip like the chain writer's, and the record's pair is ordered over the
 * row that results.
 *
 * **Every refusal comes before the batch.** The trip, the role, the existence of the record an
 * `edit` names and its agreement with that trip, both orderings and every day reference are
 * checked first, so a refused save has written nothing; the batch then covers what only the
 * database can refuse. The existence check comes ahead of every ordering rule, so a row of another
 * workspace is a `NotFoundError` and never a timing refusal that would confirm it exists.
 *
 * **An `edit` never inserts.** A row that is not there is a `NotFoundError`, and a row deleted
 * between the read and the batch is one too: the update then matches nothing, and a chain that
 * could not be attached to the vanished parent is answered the same way.
 */
export async function saveTransport(
  scope: TenantScope,
  input: SaveTransportInput,
): Promise<SavedTransport> {
  const { tripId, transportId, intent, record, chain } =
    saveTransportInput.parse(input)
  await requireTrip(scope, tripId)
  await assertTripRole(scope, tripId, WRITERS)

  const existing = await transportsRepository.findById(scope, transportId)
  if (
    (existing === null && intent === 'edit') ||
    (existing !== null && existing.tripId !== tripId)
  ) {
    throw new NotFoundError('transport', transportId)
  }

  requireLegOrder(chain.stations, chain.legs)
  await requireChainDays(scope, tripId, chain.legs)

  const previousLegs =
    existing === null ? [] : await listTransportLegs(scope, transportId)
  const { statements, endpoints } = planChain(
    scope,
    { id: transportId, tripId },
    chain,
    previousLegs,
  )
  // `definedOnly` widens `title` to optional; it is required, and an insert needs it typed so.
  const values = { ...definedOnly(record), title: record.title, ...endpoints }

  await requireDayPair(
    scope,
    tripId,
    'dayId' in values ? (values.dayId ?? null) : (existing?.dayId ?? null),
    'arrivalDayId' in values
      ? (values.arrivalDayId ?? null)
      : (existing?.arrivalDayId ?? null),
  )
  const resulting = { ...existing, ...values }
  requireTimeOrder('transport', resulting, {
    from: resulting.departureTimezone,
    to: resulting.arrivalTimezone,
  })

  // The record goes first: the legs reference it.
  try {
    await runBatch(scope, [
      existing === null
        ? scope.db.insert(transports).values({
            ...values,
            id: transportId,
            tripId,
            organizationId: scope.ctx.organizationId,
          })
        : scope.db
            .update(transports)
            .set(values)
            .where(
              tenantFilter(scope, transports, eq(transports.id, transportId)),
            ),
      ...statements,
    ])
  } catch (cause) {
    // The scope sees no row under this id, so a primary-key refusal on the insert means the id
    // belongs to a row outside the scope: answer it like every other foreign id, not as a raw
    // database failure. The batch has rolled back, so nothing of either row has changed.
    if (existing === null && isUniqueConstraintViolation(cause)) {
      throw new NotFoundError('transport', transportId)
    }
    // An update of a row deleted since the read matches nothing, and the legs that were to hang off
    // it then fail on their foreign key. That is the same "not there" the read would have said.
    if (
      existing !== null &&
      (await transportsRepository.findById(scope, transportId)) === null
    ) {
      throw new NotFoundError('transport', transportId)
    }
    throw cause
  }

  return {
    transport: await transportsRepository.requireById(scope, transportId),
    legs: await listTransportLegs(scope, transportId),
  }
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
      .min(CHAIN_MIN_STATIONS)
      .max(CHAIN_MAX_STATIONS),
    legs: z.array(chainLegSchema).min(CHAIN_MIN_LEGS).max(CHAIN_MAX_LEGS),
  })
  .superRefine(refineChainShape)
export type SearchedConnectionInput = z.input<typeof searchedConnectionInput>

/** What the save answers: the record, and the chain it now has. */
export type SavedConnection = SavedTransport

/**
 * Save a found connection as a first-class journey, or replace the route of one already saved.
 *
 * **It writes through {@link saveTransport}**, the writer behind the hand-typed dialog, so a found
 * connection is one batch as well: the record, the delete and the inserts of the chain, and the
 * record's endpoints taken from the outer stations all land together or not at all. A first save
 * used to be a `createTransport` followed by a chain write, and a second half that never landed
 * left a journey with no chain behind it.
 *
 * **A new journey gets its id here.** The writer needs one and the browser sends none for a
 * connection nobody has saved; the status is left to the column's own default, because a
 * connection somebody chose is not a connection anybody booked. Saving the same found connection
 * twice is two journeys: only a draft the dialog minted an id for is an edit of the row its first
 * press wrote.
 *
 * **A re-search keeps the record.** The plan's story is a timetable change that must not cost the
 * traveller their booking code and their seat, so the writer is handed the row's own title and no
 * mode, status, price or booking field: those stay where they were, and only the stations, the
 * legs and the flat endpoints derived from them move. A journey re-searched is the same journey.
 *
 * **The transport is resolved before the writer is asked.** Two ids arrive from the browser and a
 * well-formed one is not an authorised one, and the writer would take an id it cannot find as the
 * identity of a new row. Resolving it here inside the caller's scope is what makes a transport of
 * another workspace a `NotFoundError` rather than a journey created under a client-chosen id; the
 * agreement of the transport with the trip is checked here too, and again by the writer, because
 * within one workspace a transport of *another* trip would otherwise be re-routed by a caller who
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

  const requested = values.transportId ?? null
  const existing =
    requested === null
      ? null
      : await transportsRepository.requireById(scope, requested)
  if (existing !== null && existing.tripId !== values.tripId) {
    throw new NotFoundError('transport', existing.id)
  }

  return saveTransport(scope, {
    tripId: values.tripId,
    transportId: existing?.id ?? newId(),
    intent: existing === null ? 'create' : 'edit',
    record:
      existing === null
        ? {
            mode: values.mode,
            title: values.title,
            priceMinor: values.priceMinor,
            currency: values.currency,
          }
        : { title: existing.title },
    chain: { stations: values.stations, legs: values.legs },
  })
}
