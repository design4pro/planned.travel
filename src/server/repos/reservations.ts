/**
 * Reservations — the bookings behind the itinerary: hotels, restaurants, tours, tickets.
 *
 * A reservation can point at a day, a place, a specific itinerary stop or a transport leg, and every
 * one of those references is verified against the same trip before it is stored.
 */

import { and, asc, count, desc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'
import { z } from 'zod'
import {
  RESERVATION_STATUSES,
  RESERVATION_TYPES,
  dayAssignments,
  reservations,
  transports,
} from '#/server/db/schema'
import { createTenantRepository, tenantFilter } from './base'
import { NotFoundError } from './context'
import { requireTripDay } from './days'
import { placesRepository } from './places'
import { requireTrip } from './trips'
import {
  currencySchema,
  dateSchema,
  definedOnly,
  idSchema,
  longTextSchema,
  minorAmountSchema,
  nonNegativeIntSchema,
  shortTextSchema,
  sortOrderSchema,
  timeSchema,
  titleSchema,
  urlSchema,
} from './validation'
import type { Reservation } from '#/server/db/types'
import type { TenantScope } from './base'

export const reservationsRepository = createTenantRepository(reservations, 'reservation')

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const reservationFields = {
  dayId: idSchema.nullish(),
  endDayId: idSchema.nullish(),
  placeId: idSchema.nullish(),
  assignmentId: idSchema.nullish(),
  transportId: idSchema.nullish(),
  type: z.enum(RESERVATION_TYPES).optional(),
  status: z.enum(RESERVATION_STATUSES).optional(),
  title: titleSchema,
  provider: shortTextSchema.nullish(),
  location: shortTextSchema.nullish(),
  url: urlSchema.nullish(),
  confirmationNumber: shortTextSchema.nullish(),
  startDate: dateSchema.nullish(),
  startTime: timeSchema.nullish(),
  endDate: dateSchema.nullish(),
  endTime: timeSchema.nullish(),
  guests: nonNegativeIntSchema.max(1000).nullish(),
  priceMinor: minorAmountSchema.nullish(),
  currency: currencySchema.nullish(),
  notes: longTextSchema.nullish(),
  sortOrder: sortOrderSchema.optional(),
}

export const createReservationInput = z.object({ tripId: idSchema, ...reservationFields })
export type CreateReservationInput = z.infer<typeof createReservationInput>

export const updateReservationInput = z.object({
  ...reservationFields,
  title: titleSchema.optional(),
})
export type UpdateReservationInput = z.infer<typeof updateReservationInput>

export const listReservationsInput = z.object({
  tripId: idSchema,
  type: z.enum(RESERVATION_TYPES).optional(),
  status: z.enum(RESERVATION_STATUSES).optional(),
  unscheduled: z.boolean().optional(),
})
export type ListReservationsInput = z.infer<typeof listReservationsInput>

/* -------------------------------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------------------------------- */

/** A trip's bookings in date order, undated ones last. */
export async function listTripReservations(
  scope: TenantScope,
  input: ListReservationsInput,
): Promise<Array<Reservation>> {
  const options = listReservationsInput.parse(input)
  return reservationsRepository.findMany(scope, {
    where: and(
      eq(reservations.tripId, options.tripId),
      options.type ? eq(reservations.type, options.type) : undefined,
      options.status ? eq(reservations.status, options.status) : undefined,
      options.unscheduled === true ? isNull(reservations.dayId) : undefined,
    ),
    orderBy: [
      asc(reservations.startDate),
      asc(reservations.startTime),
      asc(reservations.sortOrder),
      asc(reservations.id),
    ],
  })
}

export async function getReservation(
  scope: TenantScope,
  reservationId: string,
): Promise<Reservation | null> {
  return reservationsRepository.findById(scope, reservationId)
}

export async function listDayReservations(
  scope: TenantScope,
  dayId: string,
): Promise<Array<Reservation>> {
  return reservationsRepository.findMany(scope, {
    where: eq(reservations.dayId, dayId),
    orderBy: [asc(reservations.startTime), asc(reservations.sortOrder)],
  })
}

/** Bookings coming up across every trip — the dashboard's reservation rail. */
export async function listUpcomingReservations(
  scope: TenantScope,
  options: { readonly from?: string; readonly to?: string; readonly limit?: number } = {},
): Promise<Array<Reservation>> {
  const from = dateSchema.parse(options.from ?? new Date().toISOString().slice(0, 10))
  return reservationsRepository.findMany(scope, {
    where: and(
      gte(reservations.startDate, from),
      options.to ? lte(reservations.startDate, dateSchema.parse(options.to)) : undefined,
      inArray(reservations.status, ['pending', 'confirmed']),
    ),
    orderBy: [asc(reservations.startDate), asc(reservations.startTime)],
    limit: options.limit ?? 10,
  })
}

export interface ReservationStatusCounts {
  readonly status: (typeof RESERVATION_STATUSES)[number]
  readonly value: number
}

/** Booking counts per status for one trip — the progress ring on the bookings screen. */
export async function countTripReservationsByStatus(
  scope: TenantScope,
  tripId: string,
): Promise<Array<ReservationStatusCounts>> {
  const rows = await scope.db
    .select({ status: reservations.status, value: count() })
    .from(reservations)
    .where(tenantFilter(scope, reservations, eq(reservations.tripId, tripId)))
    .groupBy(reservations.status)
    .orderBy(desc(count()))

  return rows.flatMap((row) =>
    (RESERVATION_STATUSES as ReadonlyArray<string>).includes(row.status)
      ? [{ status: row.status as (typeof RESERVATION_STATUSES)[number], value: row.value }]
      : [],
  )
}

/** Money committed to bookings on a trip, in minor units of each booking's own currency. */
export async function totalTripReservationsMinor(
  scope: TenantScope,
  tripId: string,
): Promise<number> {
  return reservationsRepository.sumOf(
    scope,
    reservations.priceMinor,
    and(eq(reservations.tripId, tripId), inArray(reservations.status, ['pending', 'confirmed'])),
  )
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

/** Verifies every optional reference points at a row of the same trip inside the same tenant. */
async function assertReferences(
  scope: TenantScope,
  tripId: string,
  values: Partial<CreateReservationInput>,
): Promise<void> {
  if (values.dayId) {
    await requireTripDay(scope, tripId, values.dayId)
  }
  if (values.endDayId) {
    await requireTripDay(scope, tripId, values.endDayId)
  }
  if (values.placeId) {
    const place = await placesRepository.requireById(scope, values.placeId)
    if (place.tripId !== tripId) {
      throw new NotFoundError('place', values.placeId)
    }
  }
  if (values.assignmentId) {
    const rows = await scope.db
      .select({ tripId: dayAssignments.tripId })
      .from(dayAssignments)
      .where(tenantFilter(scope, dayAssignments, eq(dayAssignments.id, values.assignmentId)))
      .limit(1)
    if (rows[0]?.tripId !== tripId) {
      throw new NotFoundError('day assignment', values.assignmentId)
    }
  }
  if (values.transportId) {
    const rows = await scope.db
      .select({ tripId: transports.tripId })
      .from(transports)
      .where(tenantFilter(scope, transports, eq(transports.id, values.transportId)))
      .limit(1)
    if (rows[0]?.tripId !== tripId) {
      throw new NotFoundError('transport', values.transportId)
    }
  }
}

export async function createReservation(
  scope: TenantScope,
  input: CreateReservationInput,
): Promise<Reservation> {
  const values = createReservationInput.parse(input)
  await requireTrip(scope, values.tripId)
  await assertReferences(scope, values.tripId, values)
  return reservationsRepository.insert(scope, values)
}

export async function updateReservation(
  scope: TenantScope,
  reservationId: string,
  input: UpdateReservationInput,
): Promise<Reservation> {
  const values = definedOnly(updateReservationInput.parse(input))
  const existing = await reservationsRepository.requireById(scope, reservationId)
  await assertReferences(scope, existing.tripId, values)
  return reservationsRepository.requireUpdate(scope, reservationId, values)
}

export async function setReservationStatus(
  scope: TenantScope,
  reservationId: string,
  status: (typeof RESERVATION_STATUSES)[number],
): Promise<Reservation> {
  return reservationsRepository.requireUpdate(scope, reservationId, {
    status: z.enum(RESERVATION_STATUSES).parse(status),
  })
}

export async function deleteReservation(
  scope: TenantScope,
  reservationId: string,
): Promise<void> {
  await reservationsRepository.requireRemove(scope, reservationId)
}
