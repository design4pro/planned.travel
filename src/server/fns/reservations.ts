/**
 * Write paths for the trip's bookings.
 *
 * A booking is one row with a type discriminator, so a single validated payload
 * covers a flight, a stay, a table and a museum ticket; the type only decides
 * which fields the *form* shows. `assertReferences` inside the repository is what
 * guarantees an attached day belongs to the same trip inside the same tenant.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { RESERVATION_STATUSES, RESERVATION_TYPES } from '#/server/db/schema'
import {
  countTripReservationsByStatus,
  createReservation,
  deleteReservation,
  listTripDays,
  listTripReservations,
  requireTrip,
  setReservationStatus,
  totalTripReservationsMinor,
  updateReservation,
} from '#/server/repos'
import { appScope, mirrorToRoom, orNull, patch, tombstone } from './context'

/* ------------------------------------------------------------------ inputs */

const tripId = z.string().trim().min(1).max(64)
const rowId = z.string().trim().min(1).max(64)

/** `''` is "not set" for every optional text field a form can produce. */
const optionalText = z.string().trim().max(200)
const optionalNotes = z.string().trim().max(4000)
const optionalDate = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value),
    'must be an ISO calendar date (YYYY-MM-DD)',
  )
const optionalTime = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value),
    'must be a 24-hour time (HH:MM)',
  )
const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (value) => value === '' || /^https?:\/\/\S+$/.test(value),
    'must be an http(s) URL',
  )

const bookingFields = {
  type: z.enum(RESERVATION_TYPES),
  status: z.enum(RESERVATION_STATUSES),
  title: z.string().trim().min(1).max(160),
  provider: optionalText,
  location: optionalText,
  confirmationNumber: optionalText,
  url: optionalUrl,
  startDate: optionalDate,
  startTime: optionalTime,
  endDate: optionalDate,
  endTime: optionalTime,
  /** `0` means "not recorded" for both of these. */
  guests: z.number().int().min(0).max(1000),
  priceMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  currency: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^[A-Z]{3}$/.test(value),
      'must be an ISO-4217 alphabetic code',
    ),
  /** `''` leaves the booking off the itinerary. */
  dayId: z.string().trim().max(64),
  notes: optionalNotes,
}

export const bookingInputSchema = z.object({ tripId, ...bookingFields })
export const bookingUpdateSchema = z.object({
  tripId,
  reservationId: rowId,
  ...bookingFields,
})

export type BookingInput = z.infer<typeof bookingInputSchema>

/**
 * A booking whose end is before its start is a typo, not a booking. Checked here
 * as well as in the form so the rule cannot be bypassed by calling the function
 * directly.
 */
function assertOrder(data: {
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}): void {
  if (data.startDate === '' || data.endDate === '') {
    return
  }
  const from = `${data.startDate}T${data.startTime === '' ? '00:00' : data.startTime}`
  const to = `${data.endDate}T${data.endTime === '' ? '23:59' : data.endTime}`
  if (to < from) {
    throw new Error('The booking ends before it starts. Check the dates.')
  }
}

function payload(data: BookingInput) {
  return {
    type: data.type,
    status: data.status,
    title: data.title,
    provider: orNull(data.provider),
    location: orNull(data.location),
    confirmationNumber: orNull(data.confirmationNumber),
    url: orNull(data.url),
    startDate: orNull(data.startDate),
    startTime: orNull(data.startTime),
    endDate: orNull(data.endDate),
    endTime: orNull(data.endTime),
    guests: data.guests === 0 ? null : data.guests,
    priceMinor: data.priceMinor === 0 ? null : data.priceMinor,
    currency: orNull(data.currency),
    dayId: orNull(data.dayId),
    notes: orNull(data.notes),
  }
}

/* ------------------------------------------------------------------ writes */

export const createBookingFn = createServerFn({ method: 'POST' })
  .validator(bookingInputSchema)
  .handler(async ({ data }): Promise<{ readonly reservationId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    assertOrder(data)

    const reservation = await createReservation(scope, {
      tripId: data.tripId,
      ...payload(data),
    })

    await mirrorToRoom(scope, data.tripId, [
      patch('reservation', reservation.id, {
        title: data.title,
        status: data.status,
        startDate: orNull(data.startDate),
      }),
    ])
    return { reservationId: reservation.id }
  })

export const updateBookingFn = createServerFn({ method: 'POST' })
  .validator(bookingUpdateSchema)
  .handler(async ({ data }): Promise<{ readonly reservationId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    assertOrder(data)

    await updateReservation(scope, data.reservationId, payload(data))

    await mirrorToRoom(scope, data.tripId, [
      patch('reservation', data.reservationId, {
        title: data.title,
        status: data.status,
        startDate: orNull(data.startDate),
      }),
    ])
    return { reservationId: data.reservationId }
  })

/**
 * Moves a booking through its lifecycle without opening the dialog: the status
 * pill on the card is the control, so confirming five bookings is five clicks
 * rather than five dialogs.
 */
export const setBookingStatusFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId,
      reservationId: rowId,
      status: z.enum(RESERVATION_STATUSES),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly status: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    await setReservationStatus(scope, data.reservationId, data.status)

    await mirrorToRoom(scope, data.tripId, [
      patch('reservation', data.reservationId, { status: data.status }),
    ])
    return { status: data.status }
  })

export const deleteBookingFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, reservationId: rowId }))
  .handler(async ({ data }): Promise<{ readonly deleted: true }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    await deleteReservation(scope, data.reservationId)

    await mirrorToRoom(scope, data.tripId, [
      tombstone('reservation', data.reservationId),
    ])
    return { deleted: true }
  })

/* -------------------------------------------------------------------- read */

export interface BookingRow {
  readonly id: string
  readonly type: string
  readonly status: string
  readonly title: string
  readonly provider: string | null
  readonly location: string | null
  readonly confirmationNumber: string | null
  readonly url: string | null
  readonly startDate: string | null
  readonly startTime: string | null
  readonly endDate: string | null
  readonly endTime: string | null
  readonly guests: number | null
  readonly priceMinor: number | null
  readonly currency: string | null
  readonly notes: string | null
  /** The itinerary day this booking is pinned to, if any. */
  readonly dayId: string | null
}

export interface BookingDayOption {
  readonly id: string
  readonly dayNumber: number
  readonly date: string | null
  readonly title: string | null
}

export interface BookingDeskPayload {
  readonly currency: string
  readonly bookings: ReadonlyArray<BookingRow>
  readonly days: ReadonlyArray<BookingDayOption>
  readonly byStatus: ReadonlyArray<{
    readonly status: string
    readonly value: number
  }>
  readonly committedMinor: number
}

/**
 * Everything the bookings screen reads.
 *
 * Distinct from the read-only bookings loader because an editable screen needs
 * two things that one does not: the `day_id` each booking is pinned to, and the
 * trip's days to pin it to — a dialog cannot offer "attach to a day" without the
 * list of days.
 */
export const loadBookingDeskFn = createServerFn({ method: 'GET' })
  .validator(z.object({ tripId }))
  .handler(async ({ data }): Promise<BookingDeskPayload> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)

    const [rows, days, byStatus, committedMinor] = await Promise.all([
      listTripReservations(scope, { tripId: trip.id }),
      listTripDays(scope, trip.id),
      countTripReservationsByStatus(scope, trip.id),
      totalTripReservationsMinor(scope, trip.id),
    ])

    return {
      currency: trip.currency,
      byStatus,
      committedMinor,
      days: days.map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        date: day.date,
        title: day.title,
      })),
      bookings: rows.map((row) => ({
        id: row.id,
        type: row.type,
        status: row.status,
        title: row.title,
        provider: row.provider,
        location: row.location,
        confirmationNumber: row.confirmationNumber,
        url: row.url,
        startDate: row.startDate,
        startTime: row.startTime,
        endDate: row.endDate,
        endTime: row.endTime,
        guests: row.guests,
        priceMinor: row.priceMinor,
        currency: row.currency,
        notes: row.notes,
        dayId: row.dayId,
      })),
    }
  })
