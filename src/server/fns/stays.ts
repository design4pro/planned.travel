/**
 * Write paths for a stay: the nights on the trip's days, and the booking that pays for them.
 *
 * A stay is one action to the reader and two rows in the database — the `reservations` row carries
 * the confirmation code, the status and the price; the `day_accommodations` row carries the run of
 * days and the times, linked to the booking through `reservation_id`. The two writes go through two
 * repositories, so they cannot share a D1 batch, and every function here states the order it writes
 * them in and what it does when the second one fails.
 *
 * Each server function is a thin wrapper over a plain function of the same name without `Fn`. Outside
 * a Start build a server function runs its handler and discards the answer, so the plain function is
 * the half a test can hold — `fns/reservations.ts` makes the same split for the desk payload.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { AUDIT_ACTIONS, trail } from '#/server/audit/trail'
import { createLogger, serializeError } from '#/server/observability'
import {
  NotFoundError,
  createAccommodation,
  createReservation,
  dayAccommodationsRepository,
  deleteAccommodation,
  deleteReservation,
  requireTrip,
  requireTripDay,
  updateAccommodation,
  updateReservation,
} from '#/server/repos'
import { appScope, mirrorToRoom, orNull, patch, tombstone } from './context'
import { bookingInputSchema, syncReservationExpense } from './reservations'

import type { Logger } from '#/server/observability'
import type { Day, DayAccommodation } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'
import type { LedgerOutcome } from './reservations'

/* ------------------------------------------------------------------ inputs */

const rowId = z.string().trim().min(1).max(64)
const booking = bookingInputSchema.shape

/**
 * The booking's own fields, taken from the booking validator rather than restated, so a stay's
 * booking and any other booking cannot disagree about what a title or a currency may be. The dates
 * are absent on purpose: a stay's dates are the dates of its days, never typed.
 */
const stayFields = {
  tripId: booking.tripId,
  status: booking.status,
  title: booking.title,
  provider: booking.provider,
  location: booking.location,
  confirmationNumber: booking.confirmationNumber,
  url: booking.url,
  guests: booking.guests,
  priceMinor: booking.priceMinor,
  currency: booking.currency,
  notes: booking.notes,
  /** The day the reader checks in on, and the day they check out on. */
  startDayId: rowId,
  endDayId: rowId,
  checkInTime: booking.startTime,
  /** The end of the check-in window; `''` when the property states none. */
  checkInEndTime: booking.startTime,
  checkOutTime: booking.endTime,
}

export const stayInputSchema = z.object(stayFields)
export const stayUpdateSchema = z.object({
  ...stayFields,
  reservationId: rowId,
  stayId: rowId,
})
export const stayDeleteSchema = z.object({
  tripId: booking.tripId,
  reservationId: rowId,
  stayId: rowId,
})

export type StayInput = z.infer<typeof stayInputSchema>
export type StayUpdate = z.infer<typeof stayUpdateSchema>
export type StayDelete = z.infer<typeof stayDeleteSchema>

/** What a stay write answers with: both rows, and what the booking's ledger line did. */
export interface StayWriteResult {
  readonly reservationId: string
  readonly stayId: string
  readonly ledger: LedgerOutcome
}

/* ----------------------------------------------------------------- helpers */

/** Memoised per isolate, for the one line this module emits: a compensation that failed. */
let logger: Logger | undefined

function log(): Logger {
  logger ??= createLogger({ context: { component: 'stay-writes' } })
  return logger
}

/**
 * Both days, resolved in the trip, and in order.
 *
 * Checked before the first write rather than left to `createAccommodation`, so a stay whose check-out
 * precedes its check-in is refused before a booking exists that would then need undoing.
 */
async function stayDays(
  scope: TenantScope,
  data: Pick<StayInput, 'tripId' | 'startDayId' | 'endDayId'>,
): Promise<{ readonly start: Day; readonly end: Day }> {
  const [start, end] = await Promise.all([
    requireTripDay(scope, data.tripId, data.startDayId),
    requireTripDay(scope, data.tripId, data.endDayId),
  ])
  if (end.dayNumber < start.dayNumber) {
    throw new Error('The stay ends before it starts. Check the days.')
  }
  return { start, end }
}

/** The booking half: dated by its days, timed by its check-in and check-out. */
function bookingValues(data: StayInput, start: Day, end: Day) {
  return {
    type: 'accommodation' as const,
    status: data.status,
    title: data.title,
    provider: orNull(data.provider),
    location: orNull(data.location),
    confirmationNumber: orNull(data.confirmationNumber),
    url: orNull(data.url),
    startDate: start.date,
    startTime: orNull(data.checkInTime),
    endDate: end.date,
    endTime: orNull(data.checkOutTime),
    guests: data.guests === 0 ? null : data.guests,
    priceMinor: data.priceMinor === 0 ? null : data.priceMinor,
    currency: orNull(data.currency),
    dayId: start.id,
    endDayId: end.id,
    notes: orNull(data.notes),
  }
}

/**
 * The stay half: the nights and the times. The price is not copied onto it — the booking holds the
 * total, and a second copy is a second number that can disagree with it.
 */
function stayValues(data: StayInput) {
  return {
    startDayId: data.startDayId,
    endDayId: data.endDayId,
    name: data.title,
    address: orNull(data.location),
    checkInTime: orNull(data.checkInTime),
    checkInEndTime: orNull(data.checkInEndTime),
    checkOutTime: orNull(data.checkOutTime),
  }
}

/**
 * The stay a payload names, once it is shown to be this trip's and this booking's.
 *
 * The tenant filter cannot tell two trips of one workspace apart, and the repositories check the
 * role against the stay's own trip — so without this a stay of another trip could be edited under
 * this trip's name. A mismatch is the same `NotFoundError` a foreign id already gets.
 */
async function requireStayOfBooking(
  scope: TenantScope,
  data: StayDelete,
): Promise<DayAccommodation> {
  const stay = await dayAccommodationsRepository.requireById(scope, data.stayId)
  if (
    stay.tripId !== data.tripId ||
    stay.reservationId !== data.reservationId
  ) {
    throw new NotFoundError('accommodation', data.stayId)
  }
  return stay
}

function auditMetadata(data: Pick<StayInput, 'tripId' | 'status' | 'title'>) {
  return {
    tripId: data.tripId,
    type: 'accommodation',
    status: data.status,
    title: data.title,
  }
}

/* ------------------------------------------------------------------ writes */

/**
 * Writes a stay and the booking that pays for it: the booking first, then the stay linked to it.
 *
 * If the second write fails the booking is deleted again. A stay with no booking is recoverable by
 * hand; a booking claiming nights nobody is staying is a lie the reader cannot see — so the order and
 * the compensation both point the same way. The ledger line is written only once both rows exist, so
 * a rolled-back booking never leaves a cost behind.
 */
export async function createStay(
  scope: TenantScope,
  data: StayInput,
): Promise<StayWriteResult> {
  const trip = await requireTrip(scope, data.tripId)
  const { start, end } = await stayDays(scope, data)

  const reservation = await createReservation(scope, {
    tripId: data.tripId,
    ...bookingValues(data, start, end),
  })
  let stay: DayAccommodation
  try {
    stay = await createAccommodation(scope, {
      tripId: data.tripId,
      ...stayValues(data),
      reservationId: reservation.id,
    })
  } catch (cause) {
    await deleteReservation(scope, reservation.id).catch((error: unknown) => {
      log().warn('stay compensation failed', {
        reservationId: reservation.id,
        organizationId: scope.ctx.organizationId,
        ...serializeError(error),
      })
    })
    throw cause
  }
  const ledger = await syncReservationExpense(scope, { reservation, trip })

  await mirrorToRoom(scope, data.tripId, [
    patch('reservation', reservation.id, {
      title: data.title,
      status: data.status,
      startDate: start.date,
    }),
  ])
  await trail(scope, {
    action: AUDIT_ACTIONS.RESERVATION_CREATED,
    entityType: 'reservation',
    entityId: reservation.id,
    metadata: auditMetadata(data),
  })
  return { reservationId: reservation.id, stayId: stay.id, ledger }
}

/**
 * Updates both halves of a stay, booking first. It never creates a booking for a stay that had none:
 * the payload names both rows, and they must already be linked to each other.
 */
export async function updateStay(
  scope: TenantScope,
  data: StayUpdate,
): Promise<StayWriteResult> {
  const trip = await requireTrip(scope, data.tripId)
  const stay = await requireStayOfBooking(scope, data)
  const { start, end } = await stayDays(scope, data)

  const reservation = await updateReservation(
    scope,
    data.reservationId,
    bookingValues(data, start, end),
  )
  await updateAccommodation(scope, stay.id, stayValues(data))
  const ledger = await syncReservationExpense(scope, { reservation, trip })

  await mirrorToRoom(scope, data.tripId, [
    patch('reservation', reservation.id, {
      title: data.title,
      status: data.status,
      startDate: start.date,
    }),
  ])
  await trail(scope, {
    action: AUDIT_ACTIONS.RESERVATION_UPDATED,
    entityType: 'reservation',
    entityId: reservation.id,
    metadata: auditMetadata(data),
  })
  return { reservationId: reservation.id, stayId: stay.id, ledger }
}

/**
 * Removes a stay together with its booking — the reader's explicit choice. Removing only the booking
 * is `deleteBookingFn`'s, and there the nights stay: the link column is `ON DELETE SET NULL`.
 *
 * The booking goes first for the same reason it is written first: if the second delete fails, what
 * is left is nights with no booking, which the reader can see and remove, never a booking whose
 * nights are gone.
 */
export async function deleteStay(
  scope: TenantScope,
  data: StayDelete,
): Promise<{ readonly deleted: true }> {
  await requireTrip(scope, data.tripId)
  const stay = await requireStayOfBooking(scope, data)

  await deleteReservation(scope, data.reservationId)
  await deleteAccommodation(scope, stay.id)

  await mirrorToRoom(scope, data.tripId, [
    tombstone('reservation', data.reservationId),
  ])
  await trail(scope, {
    action: AUDIT_ACTIONS.RESERVATION_DELETED,
    entityType: 'reservation',
    entityId: data.reservationId,
    metadata: { tripId: data.tripId },
  })
  return { deleted: true }
}

export const createStayFn = createServerFn({ method: 'POST' })
  .validator(stayInputSchema)
  .handler(async ({ data }): Promise<StayWriteResult> =>
    createStay(await appScope(), data),
  )

export const updateStayFn = createServerFn({ method: 'POST' })
  .validator(stayUpdateSchema)
  .handler(async ({ data }): Promise<StayWriteResult> =>
    updateStay(await appScope(), data),
  )

export const deleteStayFn = createServerFn({ method: 'POST' })
  .validator(stayDeleteSchema)
  .handler(async ({ data }): Promise<{ readonly deleted: true }> =>
    deleteStay(await appScope(), data),
  )
