/**
 * Write paths for the trip's travel transports.
 *
 * A transport carries its own endpoints rather than a pair of place ids, because most
 * transports start or end somewhere that is not a stop on the itinerary. The only rule
 * this layer adds on top of the repository is that a transport cannot arrive before it
 * departs; whether two *consecutive* transports connect is a judgement for the screen
 * to surface, not a reason to refuse the save (see `connections.ts`).
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { TRANSPORT_MODES, TRANSPORT_STATUSES } from '#/server/db/schema'
import {
  createTransport,
  deleteTransport,
  requireTrip,
  setTransportStatus,
  updateTransport,
} from '#/server/repos'
import { appScope, mirrorToRoom, orNull, patch, tombstone } from './context'

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

const transportFields = {
  mode: z.enum(TRANSPORT_MODES),
  status: z.enum(TRANSPORT_STATUSES),
  title: z.string().trim().min(1).max(160),
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

export const transportInputSchema = z.object({ tripId, ...transportFields })
export const transportUpdateSchema = z.object({
  tripId,
  transportId: rowId,
  ...transportFields,
})

export type TransportInput = z.infer<typeof transportInputSchema>

/** A transport that lands before it takes off is a typo, and the server says so too. */
function assertOrder(data: TransportInput): void {
  if (data.departureDate === '' || data.arrivalDate === '') {
    return
  }
  const from = `${data.departureDate}T${data.departureTime === '' ? '00:00' : data.departureTime}`
  const to = `${data.arrivalDate}T${data.arrivalTime === '' ? '23:59' : data.arrivalTime}`
  if (to < from) {
    throw new Error(
      'This transport arrives before it departs. Check the times.',
    )
  }
}

function payload(data: TransportInput) {
  return {
    mode: data.mode,
    status: data.status,
    title: data.title,
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

/* ------------------------------------------------------------------ writes */

export const createTransportFn = createServerFn({ method: 'POST' })
  .validator(transportInputSchema)
  .handler(async ({ data }): Promise<{ readonly transportId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    assertOrder(data)

    const transport = await createTransport(scope, {
      tripId: data.tripId,
      ...payload(data),
    })

    await mirrorToRoom(scope, data.tripId, [
      patch('route', transport.id, {
        title: data.title,
        mode: data.mode,
        status: data.status,
      }),
    ])
    return { transportId: transport.id }
  })

export const updateTransportFn = createServerFn({ method: 'POST' })
  .validator(transportUpdateSchema)
  .handler(async ({ data }): Promise<{ readonly transportId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    assertOrder(data)

    await updateTransport(scope, data.transportId, payload(data))

    await mirrorToRoom(scope, data.tripId, [
      patch('route', data.transportId, {
        title: data.title,
        mode: data.mode,
        status: data.status,
      }),
    ])
    return { transportId: data.transportId }
  })

export const setTransportStatusFn = createServerFn({ method: 'POST' })
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

export const deleteTransportFn = createServerFn({ method: 'POST' })
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
