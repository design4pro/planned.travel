/**
 * The transports desk: everything the screen reads, and the writes it makes.
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
  CHAIN_MAX_LEGS,
  createTransport,
  deleteTransport,
  listTripDays,
  listTripLegs,
  listTripTransports,
  replaceTransportChain,
  requireTrip,
  setTransportStatus,
  summariseTripTransports,
  totalTripDistanceMetres,
  updateTransport,
} from '#/server/repos'
import { findAirportByCode, searchAirports } from '#/server/catalog/airports'
import { resolveTimeZone } from '#/lib/time'
import { appScope, mirrorToRoom, orNull, patch, tombstone } from './context'

import type { AirportMatch } from '#/server/catalog/airports'
import type { TransportLeg } from '#/server/db/types'
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

/* ------------------------------------------------------------ chain inputs */

/**
 * An IANA zone name, or `''`.
 *
 * Asked of `Intl` rather than matched against a list this file would have to
 * keep: `resolveTimeZone` answers `UTC` for anything the platform rejects, so a
 * value that survives unchanged is a value the platform knows. Refused rather
 * than rewritten — a zone silently turned into `UTC` is a departure time that
 * reads an hour or nine wrong with nothing on screen to say so.
 */
const optionalTimeZone = z
  .string()
  .trim()
  .max(64)
  .refine(
    (value) => value === '' || resolveTimeZone(value) === value,
    'must be an IANA time zone name',
  )

const stationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: optionalCode,
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  timezone: optionalTimeZone,
})

const chainLegSchema = z.object({
  serviceNumber: optionalText,
  platform: optionalText,
  seat: optionalText,
  departureDayId: optionalDayId,
  arrivalDayId: optionalDayId,
  departureDate: optionalDate,
  departureTime: optionalTime,
  arrivalDate: optionalDate,
  arrivalTime: optionalTime,
})

/**
 * The chain writer's validator.
 *
 * `stations` is capped one above `legs` because that is the arithmetic: thirteen
 * stations is twelve legs, and twelve is the payload bound the repository states
 * and enforces. Both empty is legal and means "this journey has no legs" — the
 * record's own endpoints are the journey, which is what every transport written
 * before this stage already is.
 */
export const legChainSchema = z
  .object({
    tripId,
    transportId: rowId,
    stations: z.array(stationSchema).max(CHAIN_MAX_LEGS + 1),
    legs: z.array(chainLegSchema).max(CHAIN_MAX_LEGS),
  })
  .superRefine((data, ctx) => {
    const { stations, legs } = data
    if (stations.length === 0 && legs.length === 0) {
      return
    }
    if (stations.length < 2) {
      ctx.addIssue({
        code: 'custom',
        path: ['stations'],
        message: 'A chain runs between at least two stations.',
      })
      return
    }
    if (legs.length !== stations.length - 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['legs'],
        message: 'A chain of N stations has exactly N−1 legs.',
      })
    }
  })

/* ------------------------------------------------------------------- reads */

/** One leg of a chained journey, as the screen renders it. */
export interface TransportLegRow {
  readonly id: string
  readonly position: number
  readonly fromName: string
  readonly fromCode: string | null
  readonly fromLat: number | null
  readonly fromLng: number | null
  readonly fromTimezone: string | null
  readonly toName: string
  readonly toCode: string | null
  readonly toLat: number | null
  readonly toLng: number | null
  readonly toTimezone: string | null
  readonly serviceNumber: string | null
  readonly platform: string | null
  readonly seat: string | null
  readonly departureDayId: string | null
  readonly arrivalDayId: string | null
  readonly departureDate: string | null
  readonly departureTime: string | null
  readonly arrivalDate: string | null
  readonly arrivalTime: string | null
}

function toLegRow(row: TransportLeg): TransportLegRow {
  return {
    id: row.id,
    position: row.position,
    fromName: row.fromName,
    fromCode: row.fromCode,
    fromLat: row.fromLat,
    fromLng: row.fromLng,
    fromTimezone: row.fromTimezone,
    toName: row.toName,
    toCode: row.toCode,
    toLat: row.toLat,
    toLng: row.toLng,
    toTimezone: row.toTimezone,
    serviceNumber: row.serviceNumber,
    platform: row.platform,
    seat: row.seat,
    departureDayId: row.departureDayId,
    arrivalDayId: row.arrivalDayId,
    departureDate: row.departureDate,
    departureTime: row.departureTime,
    arrivalDate: row.arrivalDate,
    arrivalTime: row.arrivalTime,
  }
}

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
  /** The chain, in order. Empty for a journey nobody broke into legs. */
  readonly legs: ReadonlyArray<TransportLegRow>
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

    const [rows, days, legs, byMode, totalDistanceMetres] = await Promise.all([
      listTripTransports(scope, trip.id),
      listTripDays(scope, trip.id),
      // One read for the whole trip, then grouped in memory: a query per
      // transport is N+1 round trips at the top of a screen that renders a list.
      listTripLegs(scope, trip.id),
      summariseTripTransports(scope, trip.id),
      totalTripDistanceMetres(scope, trip.id),
    ])

    const legsByTransport = new Map<string, Array<TransportLegRow>>()
    for (const leg of legs) {
      const bucket = legsByTransport.get(leg.transportId)
      if (bucket === undefined) {
        legsByTransport.set(leg.transportId, [toLegRow(leg)])
      } else {
        bucket.push(toLegRow(leg))
      }
    }

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
        legs: legsByTransport.get(row.id) ?? [],
      })),
    }
  })

/* ------------------------------------------------------------- the catalogue */

/** An airport or station the type-ahead can offer. */
export interface StationMatch {
  readonly code: string
  readonly name: string
  readonly city: string | null
  readonly countryCode: string | null
  readonly timezone: string | null
  readonly lat: number | null
  readonly lng: number | null
}

function toStationMatch(row: AirportMatch): StationMatch {
  return {
    code: row.iataCode ?? row.icaoCode ?? '',
    name: row.name,
    city: row.city,
    countryCode: row.countryCode,
    timezone: row.timezone,
    lat: row.lat,
    lng: row.lng,
  }
}

/**
 * The endpoint type-ahead: a name, a city, a country and a zone from a code.
 *
 * A **shortcut over free text and never a gate in front of it** — the catalogue
 * is a cut of a public dataset taken on the day the artefact was built, so it is
 * always behind the world, and a traveller must still be able to record a flight
 * to an airport that opened last week. An unknown term answers `[]`; nothing
 * here is on a write path, and no write consults it.
 *
 * `GET` because it is a read, and because the browser may cache it: a
 * type-ahead over reference data that never changes between deploys should not
 * cost a round trip twice for the same prefix.
 */
export const searchStationsFn = createServerFn({ method: 'GET' })
  .validator(z.object({ term: z.string().trim().max(64) }))
  .handler(async ({ data }): Promise<ReadonlyArray<StationMatch>> => {
    const scope = await appScope()
    const rows = await searchAirports(scope.db, data.term)
    return rows.map(toStationMatch)
  })

/** One airport or station by its exact code, or `null` when nothing carries it. */
export const findStationFn = createServerFn({ method: 'GET' })
  .validator(z.object({ code: z.string().trim().max(8) }))
  .handler(async ({ data }): Promise<StationMatch | null> => {
    const scope = await appScope()
    const row = await findAirportByCode(scope.db, data.code)
    return row === null ? null : toStationMatch(row)
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

/**
 * The one writer for a whole chain.
 *
 * `requireTrip` first, so a trip id from another tenant is a 404 before any row
 * is touched; the repository then re-resolves the parent transport inside the
 * same scope, because a well-formed transport id from a client is not an
 * authorised transport id and the chain writer never trusts the one it was
 * handed.
 *
 * The mirror carries the leg count and the two outer endpoints rather than the
 * chain: a patch is a notification here and D1 is the record, so a room that
 * hears "this journey now has four legs" refetches rather than trying to apply
 * twelve rows through a 32 KiB frame.
 */
export const saveLegChainFn = createServerFn({ method: 'POST' })
  .validator(legChainSchema)
  .handler(async ({ data }): Promise<{ readonly legs: number }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    const legs = await replaceTransportChain(scope, data.transportId, {
      stations: data.stations.map((station) => ({
        name: station.name,
        code: orNull(station.code),
        lat: station.lat,
        lng: station.lng,
        timezone: orNull(station.timezone),
      })),
      legs: data.legs.map((leg) => ({
        serviceNumber: orNull(leg.serviceNumber),
        platform: orNull(leg.platform),
        seat: orNull(leg.seat),
        departureDayId: orNull(leg.departureDayId),
        arrivalDayId: orNull(leg.arrivalDayId),
        departureDate: orNull(leg.departureDate),
        departureTime: orNull(leg.departureTime),
        arrivalDate: orNull(leg.arrivalDate),
        arrivalTime: orNull(leg.arrivalTime),
      })),
    })

    const first = legs.at(0)
    const last = legs.at(-1)
    await mirrorToRoom(scope, data.tripId, [
      patch('route', data.transportId, {
        legs: legs.length,
        departureName: first?.fromName ?? null,
        arrivalName: last?.toName ?? null,
      }),
    ])
    return { legs: legs.length }
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
