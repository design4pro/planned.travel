/**
 * Transports — the journeys between places: flights, trains, ferries, the hire car.
 *
 * A transport is stored with its own departure/arrival endpoints rather than as a pair of place
 * ids, because most journeys start or end somewhere that is not a place on the itinerary (an
 * airport, a station). Transports may hang off a day, but they do not have to.
 */

import { and, asc, count, desc, eq, gte, isNotNull, sum } from 'drizzle-orm'
import { z } from 'zod'
import {
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  transports,
} from '#/server/db/schema'
import { createTenantRepository, tenantFilter } from './base'
import { requireTripDay } from './days'
import { requireTrip } from './trips'
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
import type { Transport } from '#/server/db/types'
import type { TenantScope } from './base'

export const transportsRepository = createTenantRepository(
  transports,
  'transport',
)

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const codeSchema = z.string().trim().min(1).max(8).toUpperCase()

const transportFields = {
  dayId: idSchema.nullish(),
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

export async function createTransport(
  scope: TenantScope,
  input: CreateTransportInput,
): Promise<Transport> {
  const values = createTransportInput.parse(input)
  await requireTrip(scope, values.tripId)
  if (values.dayId) {
    await requireTripDay(scope, values.tripId, values.dayId)
  }
  return transportsRepository.insert(scope, values)
}

export async function updateTransport(
  scope: TenantScope,
  transportId: string,
  input: UpdateTransportInput,
): Promise<Transport> {
  const values = definedOnly(updateTransportInput.parse(input))
  const existing = await transportsRepository.requireById(scope, transportId)
  if (values.dayId) {
    await requireTripDay(scope, existing.tripId, values.dayId)
  }
  return transportsRepository.requireUpdate(scope, transportId, values)
}

export async function setTransportStatus(
  scope: TenantScope,
  transportId: string,
  status: (typeof TRANSPORT_STATUSES)[number],
): Promise<Transport> {
  return transportsRepository.requireUpdate(scope, transportId, {
    status: z.enum(TRANSPORT_STATUSES).parse(status),
  })
}

export async function deleteTransport(
  scope: TenantScope,
  transportId: string,
): Promise<void> {
  await transportsRepository.requireRemove(scope, transportId)
}
