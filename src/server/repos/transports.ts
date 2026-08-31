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

import { and, asc, count, desc, eq, gte, isNotNull, sum } from 'drizzle-orm'
import { z } from 'zod'
import {
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  TRIP_MEMBER_ROLES,
  transportLegs,
  transports,
} from '#/server/db/schema'
import { createTenantRepository, tenantFilter } from './base'
import { runBatch } from './batch'
import { RepositoryError } from './context'
import { requireTripDay } from './days'
import { requireTrip, tripRoleFor } from './trips'
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
import type { Transport, TransportLeg } from '#/server/db/types'
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

/** One of the three roles a person holds *on a trip*, which is not an organization role. */
export type TripRole = (typeof TRIP_MEMBER_ROLES)[number]

/** Thrown when the caller is on the trip but not in a role that may change it. */
export class TripRoleError extends RepositoryError {
  constructor(
    readonly required: ReadonlyArray<TripRole>,
    readonly actual: TripRole | null,
  ) {
    super(
      `A ${actual ?? 'non-member'} may not change this trip; requires one of: ${required.join(', ')}.`,
      'TRIP_ROLE',
    )
  }
}

const tripRoleSchema = z.enum(TRIP_MEMBER_ROLES)
const tripRolesSchema = z.array(tripRoleSchema).min(1)

/**
 * Refuses a writer whose **trip** role is not one of `required`.
 *
 * Membership is not a role. `requireTrip` answers "is this trip inside the
 * caller's tenant", which is the boundary the whole data layer is built on and
 * is a different question from "may this person change the plan" — so at HEAD a
 * viewer could write a transport while `trip-room.ts:358` refused them the very
 * same edit over the collaborative session. Two answers to one question is a
 * defect whichever of them is right, and the restrictive one is right: a viewer
 * reads.
 *
 * Read paths are deliberately not guarded. A viewer is on the trip to see it,
 * and the tenant filter already decides what they can see.
 */
export async function assertTripRole(
  scope: TenantScope,
  tripId: string,
  required: ReadonlyArray<TripRole>,
): Promise<void> {
  const roles = tripRolesSchema.parse(required)
  // The column is plain `text` behind a `CHECK`, so what comes back is a string.
  // Narrowing it through the enum rather than comparing raw text means a value
  // the enum does not carry is *no role* — a refusal — rather than a value that
  // slipped past a `includes` on a widened type.
  const stored = tripRoleSchema.safeParse(
    await tripRoleFor(scope, tripId, scope.ctx.userId),
  )
  if (!stored.success || !roles.includes(stored.data)) {
    throw new TripRoleError(roles, stored.success ? stored.data : null)
  }
}

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

/** A trip's legs in travel order: dated legs first by date and time, undated ideas last. */
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

/** The next leg the traveller has to catch, across every trip in the tenant. */
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
  readonly legs: number
  readonly distanceMetres: number
}

/** Legs and distance grouped by mode — the "how you travelled" breakdown on the transports screen. */
export async function summariseTripTransports(
  scope: TenantScope,
  tripId: string,
): Promise<Array<TransportModeTotals>> {
  const rows = await scope.db
    .select({
      mode: transports.mode,
      legs: count(),
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
            legs: row.legs,
            distanceMetres: Number(row.distanceMetres ?? 0),
          },
        ]
      : [],
  )
}

/** Total distance of a trip's legs, in metres. */
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

  const rows = legs.map((leg, index) => {
    // `stations[index + 1]` exists for every leg: the refinement above fixed the arithmetic.
    const from = stations[index]
    const to = stations[index + 1]
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
      departureDayId: refOf(leg.departureDayId),
      arrivalDayId: refOf(leg.arrivalDayId),
      departureDate: leg.departureDate ?? null,
      departureTime: leg.departureTime ?? null,
      arrivalDate: leg.arrivalDate ?? null,
      arrivalTime: leg.arrivalTime ?? null,
      sortOrder: leg.sortOrder ?? index,
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
