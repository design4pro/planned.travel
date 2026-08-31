/**
 * The transports desk: everything the screen reads, and the four writes it makes.
 *
 * A transport carries its own endpoints rather than a pair of place ids, because
 * most journeys start or end somewhere that is not a stop on the itinerary. It is
 * anchored to two itinerary days — the one it leaves on and the one it lands on —
 * and the second is never derived from the first: a night flight leaves on
 * Tuesday and lands on Wednesday, and only the traveller knows that.
 *
 * The only rule this layer adds on top of the repository is that a journey cannot
 * arrive before it departs; whether two *consecutive* journeys connect is a
 * judgement for the screen to surface, not a reason to refuse the save (see
 * `connections.ts`).
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { TRANSPORT_MODES, TRANSPORT_STATUSES } from '#/server/db/schema'
import {
  createTransport,
  deleteTransport,
  listTripDays,
  listTripTransports,
  requireTrip,
  setTransportStatus,
  summariseTripTransports,
  totalTripDistanceMetres,
  updateTransport,
} from '#/server/repos'
import { appScope, mirrorToRoom, orNull, patch, tombstone } from './context'

import type { TransportModeTotals } from '#/server/repos'

/* ------------------------------------------------------------------ inputs */

const tripId = z.string().trim().min(1).max(64)
const rowId = z.string().trim().min(1).max(64)

const optionalText = z.string().trim().max(200)
const optionalCode = z
  .string()
  .trim()
  .max(8)
  .transform((value) => value.toUpperCase())
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

/**
 * A day reference as the form sends it: an id, or `''` for "no day yet".
 *
 * Named here and carried by both write validators on purpose. An object schema
 * strips a key it does not declare, so a column the screen sets and the validator
 * has never heard of is a column written null with every test still green.
 */
const optionalDayId = z.string().trim().max(64)

const legFields = {
  mode: z.enum(TRANSPORT_MODES),
  status: z.enum(TRANSPORT_STATUSES),
  title: z.string().trim().min(1).max(160),
  departureDayId: optionalDayId,
  arrivalDayId: optionalDayId,
  carrier: optionalText,
  serviceNumber: optionalText,
  bookingCode: optionalText,
  seat: optionalText,
  departureName: optionalText,
  departureCode: optionalCode,
  departureDate: optionalDate,
  departureTime: optionalTime,
  arrivalName: optionalText,
  arrivalCode: optionalCode,
  arrivalDate: optionalDate,
  arrivalTime: optionalTime,
  /** `0` means "not recorded" for both of these. */
  distanceMetres: z.number().int().min(0).max(100_000_000),
  priceMinor: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  currency: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || /^[A-Z]{3}$/.test(value),
      'must be an ISO-4217 alphabetic code',
    ),
  notes: z.string().trim().max(4000),
}

export const legInputSchema = z.object({ tripId, ...legFields })
export const legUpdateSchema = z.object({
  tripId,
  transportId: rowId,
  ...legFields,
})

export type LegInput = z.infer<typeof legInputSchema>

/** A leg that lands before it takes off is a typo, and the server says so too. */
function assertOrder(data: LegInput): void {
  if (data.departureDate === '' || data.arrivalDate === '') {
    return
  }
  const from = `${data.departureDate}T${data.departureTime === '' ? '00:00' : data.departureTime}`
  const to = `${data.arrivalDate}T${data.arrivalTime === '' ? '23:59' : data.arrivalTime}`
  if (to < from) {
    throw new Error('This leg arrives before it departs. Check the times.')
  }
}

function payload(data: LegInput) {
  return {
    mode: data.mode,
    status: data.status,
    title: data.title,
    // The column keeps the name it was written under; the wire says which end it is.
    dayId: orNull(data.departureDayId),
    arrivalDayId: orNull(data.arrivalDayId),
    carrier: orNull(data.carrier),
    serviceNumber: orNull(data.serviceNumber),
    bookingCode: orNull(data.bookingCode),
    seat: orNull(data.seat),
    departureName: orNull(data.departureName),
    departureCode: orNull(data.departureCode),
    departureDate: orNull(data.departureDate),
    departureTime: orNull(data.departureTime),
    arrivalName: orNull(data.arrivalName),
    arrivalCode: orNull(data.arrivalCode),
    arrivalDate: orNull(data.arrivalDate),
    arrivalTime: orNull(data.arrivalTime),
    distanceMetres: data.distanceMetres === 0 ? null : data.distanceMetres,
    priceMinor: data.priceMinor === 0 ? null : data.priceMinor,
    currency: orNull(data.currency),
    notes: orNull(data.notes),
  }
}

/* ------------------------------------------------------------------- reads */

/** One transport, as the screen renders it. */
export interface TransportRow {
  readonly id: string
  readonly mode: string
  readonly status: string
  readonly title: string
  readonly carrier: string | null
  readonly serviceNumber: string | null
  readonly bookingCode: string | null
  readonly seat: string | null
  /** The itinerary day it leaves on, and the one it lands on. Either may be unset. */
  readonly departureDayId: string | null
  readonly arrivalDayId: string | null
  readonly departureName: string | null
  readonly departureCode: string | null
  readonly departureDate: string | null
  readonly departureTime: string | null
  readonly arrivalName: string | null
  readonly arrivalCode: string | null
  readonly arrivalDate: string | null
  readonly arrivalTime: string | null
  readonly distanceMetres: number | null
  readonly priceMinor: number | null
  readonly currency: string | null
  readonly notes: string | null
}

/** A day of the trip, as the two day selects offer it. */
export interface TransportDayOption {
  readonly id: string
  readonly dayNumber: number
  readonly date: string | null
  readonly title: string | null
}

export interface TransportDeskPayload {
  readonly currency: string
  readonly transports: ReadonlyArray<TransportRow>
  readonly days: ReadonlyArray<TransportDayOption>
  readonly byMode: ReadonlyArray<TransportModeTotals>
  readonly totalDistanceMetres: number
  readonly distanceUnit: 'metric'
}

/**
 * Everything the transports screen reads.
 *
 * Distinct from a read-only transports loader because an editable screen needs
 * one thing that a read-only one does not: the trip's days. A dialog cannot offer
 * "which day does this leave on" without the list to choose from, and it cannot
 * show which day a journey already names without the numbers behind the ids. The
 * booking desk makes the same split for the same reason (`loadBookingDeskFn`).
 */
export const loadTransportDeskFn = createServerFn({ method: 'GET' })
  .validator(z.object({ tripId }))
  .handler(async ({ data }): Promise<TransportDeskPayload> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)

    const [rows, days, byMode, totalDistanceMetres] = await Promise.all([
      listTripTransports(scope, trip.id),
      listTripDays(scope, trip.id),
      summariseTripTransports(scope, trip.id),
      totalTripDistanceMetres(scope, trip.id),
    ])

    return {
      currency: trip.currency,
      byMode,
      totalDistanceMetres,
      distanceUnit: 'metric',
      days: days.map((day) => ({
        id: day.id,
        dayNumber: day.dayNumber,
        date: day.date,
        title: day.title,
      })),
      transports: rows.map((row) => ({
        id: row.id,
        mode: row.mode,
        status: row.status,
        title: row.title,
        carrier: row.carrier,
        serviceNumber: row.serviceNumber,
        bookingCode: row.bookingCode,
        seat: row.seat,
        departureDayId: row.dayId,
        arrivalDayId: row.arrivalDayId,
        departureName: row.departureName,
        departureCode: row.departureCode,
        departureDate: row.departureDate,
        departureTime: row.departureTime,
        arrivalName: row.arrivalName,
        arrivalCode: row.arrivalCode,
        arrivalDate: row.arrivalDate,
        arrivalTime: row.arrivalTime,
        distanceMetres: row.distanceMetres,
        priceMinor: row.priceMinor,
        currency: row.currency,
        notes: row.notes,
      })),
    }
  })

/* ------------------------------------------------------------------ writes */

export const createLegFn = createServerFn({ method: 'POST' })
  .validator(legInputSchema)
  .handler(async ({ data }): Promise<{ readonly transportId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    assertOrder(data)

    const leg = await createTransport(scope, {
      tripId: data.tripId,
      ...payload(data),
    })

    await mirrorToRoom(scope, data.tripId, [
      patch('route', leg.id, {
        title: data.title,
        mode: data.mode,
        status: data.status,
        departureDayId: leg.dayId,
        arrivalDayId: leg.arrivalDayId,
      }),
    ])
    return { transportId: leg.id }
  })

export const updateLegFn = createServerFn({ method: 'POST' })
  .validator(legUpdateSchema)
  .handler(async ({ data }): Promise<{ readonly transportId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    assertOrder(data)

    const leg = await updateTransport(scope, data.transportId, payload(data))

    await mirrorToRoom(scope, data.tripId, [
      patch('route', data.transportId, {
        title: data.title,
        mode: data.mode,
        status: data.status,
        departureDayId: leg.dayId,
        arrivalDayId: leg.arrivalDayId,
      }),
    ])
    return { transportId: data.transportId }
  })

export const setLegStatusFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId,
      transportId: rowId,
      status: z.enum(TRANSPORT_STATUSES),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly status: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    await setTransportStatus(scope, data.transportId, data.status)

    await mirrorToRoom(scope, data.tripId, [
      patch('route', data.transportId, { status: data.status }),
    ])
    return { status: data.status }
  })

export const deleteLegFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, transportId: rowId }))
  .handler(async ({ data }): Promise<{ readonly deleted: true }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    await deleteTransport(scope, data.transportId)

    await mirrorToRoom(scope, data.tripId, [
      tombstone('route', data.transportId),
    ])
    return { deleted: true }
  })
