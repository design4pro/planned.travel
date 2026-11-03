/** A stay's booking and nights commit together; archive refusal never needs a compensating write. */
import { eq, sql } from 'drizzle-orm'
import {
  dayAccommodations,
  newId,
  reservations,
  trips,
} from '#/server/db/schema'
import { allOf, prepareTenantInsert, tenantFilter } from './base'
import { runAtomicBatch } from './batch'
import { NotFoundError } from './context'
import {
  prepareAccommodationCreate,
  prepareAccommodationUpdate,
} from './itinerary'
import {
  prepareReservationCreate,
  prepareReservationUpdate,
  requireWritableBookingTrip,
} from './reservations'
import type { TenantScope } from './base'
import type {
  CreateAccommodationInput,
  UpdateAccommodationInput,
} from './itinerary'
import type {
  CreateReservationInput,
  UpdateReservationInput,
} from './reservations'

function activeTrip(scope: TenantScope, tripId: string) {
  return sql`exists (select 1 from ${trips} where ${tenantFilter(scope, trips, eq(trips.id, tripId), eq(trips.isArchived, false))})`
}

/** The batch matched nothing: preserve visibility/archive/role refusal ordering. */
async function refusedPair(scope: TenantScope, tripId: string): Promise<never> {
  await requireWritableBookingTrip(scope, tripId)
  throw new NotFoundError('stay', tripId)
}

export async function createStayPair(
  scope: TenantScope,
  booking: CreateReservationInput,
  nights: Omit<CreateAccommodationInput, 'tripId' | 'reservationId'>,
) {
  const reservation = await prepareReservationCreate(scope, booking)
  const stay = await prepareAccommodationCreate(scope, {
    ...nights,
    tripId: reservation.tripId,
    reservationId: undefined,
  })
  const reservationId = newId()
  const stayId = newId()
  const active = activeTrip(scope, reservation.tripId)
  const [bookings, stays] = await runAtomicBatch(scope, [
    prepareTenantInsert(
      scope,
      reservations,
      { ...reservation, id: reservationId },
      active,
    ).returning(),
    prepareTenantInsert(
      scope,
      dayAccommodations,
      { ...stay, id: stayId, reservationId },
      active,
    ).returning(),
  ] as const)
  const writtenBooking = bookings[0]
  const writtenStay = stays[0]
  if (!writtenBooking || !writtenStay)
    return refusedPair(scope, reservation.tripId)
  return { reservation: writtenBooking, stay: writtenStay }
}

export async function updateStayPair(
  scope: TenantScope,
  tripId: string,
  reservationId: string,
  stayId: string,
  booking: UpdateReservationInput,
  nights: Omit<UpdateAccommodationInput, 'reservationId'>,
) {
  const reservation = await prepareReservationUpdate(
    scope,
    reservationId,
    booking,
  )
  const stay = await prepareAccommodationUpdate(scope, stayId, {
    ...nights,
    reservationId: undefined,
  })
  if (
    reservation.existing.tripId !== tripId ||
    stay.existing.tripId !== tripId ||
    stay.existing.reservationId !== reservationId
  ) {
    throw new NotFoundError('stay', stayId)
  }
  // Both statements use the same pair identity, including its link, inside the atomic batch.
  const pair = allOf(
    activeTrip(scope, tripId),
    sql`exists (select 1 from ${reservations} where ${tenantFilter(scope, reservations, eq(reservations.id, reservationId), eq(reservations.tripId, tripId))})`,
    sql`exists (select 1 from ${dayAccommodations} where ${tenantFilter(scope, dayAccommodations, eq(dayAccommodations.id, stayId), eq(dayAccommodations.tripId, tripId), eq(dayAccommodations.reservationId, reservationId))})`,
  )
  const [bookings, stays] = await runAtomicBatch(scope, [
    scope.db
      .update(reservations)
      .set(reservation.values)
      .where(
        tenantFilter(
          scope,
          reservations,
          eq(reservations.id, reservationId),
          pair,
        ),
      )
      .returning(),
    scope.db
      .update(dayAccommodations)
      .set(stay.values)
      .where(
        tenantFilter(
          scope,
          dayAccommodations,
          eq(dayAccommodations.id, stayId),
          pair,
        ),
      )
      .returning(),
  ] as const)
  const writtenBooking = bookings[0]
  const writtenStay = stays[0]
  if (!writtenBooking || !writtenStay) return refusedPair(scope, tripId)
  return { reservation: writtenBooking, stay: writtenStay }
}
