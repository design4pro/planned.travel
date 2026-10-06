/**
 * The transports desk: everything the screen reads, and the writes it makes.
 *
 * A transport carries its own endpoints rather than a pair of place ids, because
 * most journeys start or end somewhere that is not a stop on the itinerary. It is
 * anchored to two itinerary days — the one it leaves on and the one it lands on —
 * and the second is never derived from the first: a night flight leaves on
 * Tuesday and lands on Wednesday, and only the traveller knows that.
 *
 * This layer adds no rule of its own on top of the repository: a journey that
 * arrives before it departs is refused there, for every writer. Whether two
 * *consecutive* journeys connect is a judgement for the screen to surface, not a
 * reason to refuse the save (see `connections.ts`).
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { TRANSPORT_MODES, TRANSPORT_STATUSES } from '#/server/db/schema'
import {
  CHAIN_MAX_LEGS,
  deleteTransport,
  listTripDays,
  listTripLegs,
  listTripTransports,
  requireTrip,
  saveSearchedConnection,
  saveTransport,
  setTransportStatus,
  summariseTripTransports,
  totalTripDistanceMetres,
} from '#/server/repos'
import { findAirportByCode, searchAirports } from '#/server/catalog/airports'
import {
  effectiveLimitsFor,
  loadPlanState,
} from '#/server/billing/entitlements'
import { billingRuntime } from '#/server/billing/runtime.cloudflare'
import { billingContext } from '#/server/billing/types'
import { transitRuntime } from '#/server/transit/bindings'
import {
  refusalReason,
  searchTransitConnections,
  transitQuerySchema,
} from '#/server/transit/search'
import { resolveTimeZone } from '#/lib/time'
import { DATE_PATTERN, TIME_PATTERN } from '#/lib/transport-timing'
import { appScope, mirrorToRoom, orNull, patch, tombstone } from './context'

import type { AirportMatch } from '#/server/catalog/airports'
import type { TransportLeg } from '#/server/db/types'
import type { TenantScope, TransportModeTotals } from '#/server/repos'
import type {
  TransitConnection,
  TransitFailureReason,
} from '#/server/transit/search'

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
    (value) => value === '' || DATE_PATTERN.test(value),
    'must be an ISO calendar date (YYYY-MM-DD)',
  )
const optionalTime = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || TIME_PATTERN.test(value),
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

/**
 * The name a record is filed under. Required: a row nobody can name is a row
 * nobody finds again.
 */
const titleText = z.string().trim().min(1).max(160)

/** Minor units, never a float. `0` means "not recorded" and is written `null`. */
const optionalMinorAmount = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)

/** An ISO-4217 alphabetic code, or `''` for a price with no currency stated. */
const optionalCurrency = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || /^[A-Z]{3}$/.test(value),
    'must be an ISO-4217 alphabetic code',
  )

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

const transportFields = {
  mode: z.enum(TRANSPORT_MODES),
  status: z.enum(TRANSPORT_STATUSES),
  title: titleText,
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
  /**
   * Sent only while a chain owns the endpoints, so the record is ordered in the zones its clocks
   * were validated in; absent, the zones already stored are kept.
   */
  departureTimezone: optionalTimeZone.optional(),
  arrivalTimezone: optionalTimeZone.optional(),
  /** `0` means "not recorded" for both of these. */
  distanceMetres: z.number().int().min(0).max(100_000_000),
  priceMinor: optionalMinorAmount,
  currency: optionalCurrency,
  notes: z.string().trim().max(4000),
}

export const transportInputSchema = z.object({ tripId, ...transportFields })

export type TransportInput = z.infer<typeof transportInputSchema>

function payload(data: TransportInput) {
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
    ...(data.departureTimezone === undefined
      ? {}
      : { departureTimezone: orNull(data.departureTimezone) }),
    ...(data.arrivalTimezone === undefined
      ? {}
      : { arrivalTimezone: orNull(data.arrivalTimezone) }),
    distanceMetres: data.distanceMetres === 0 ? null : data.distanceMetres,
    priceMinor: data.priceMinor === 0 ? null : data.priceMinor,
    currency: orNull(data.currency),
    notes: orNull(data.notes),
  }
}

/* ------------------------------------------------------------ chain inputs */

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
 * The chain, from the wire shapes to the repository's.
 *
 * Both writers send the same two arrays and both mean the same thing by `''` — "not stated" — so
 * the translation is written once. It is a mapping and nothing else: what a chain has to satisfy
 * is stated by {@link saveTransportSchema} on the way in and by the repository at the write.
 */
function chainInput(data: {
  readonly stations: ReadonlyArray<z.infer<typeof stationSchema>>
  readonly legs: ReadonlyArray<z.infer<typeof chainLegSchema>>
}) {
  return {
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
  }
}

/**
 * The validator of the one save behind the Transport dialog: the record, the id it is saved under,
 * and its chain.
 *
 * `transportId` is minted by the dialog for a new transport and is the row's identity from then
 * on: pressing save twice on one draft is an edit of the row the first press wrote, not a second
 * row. Whether the row exists is the repository's to say, inside the caller's scope.
 *
 * `stations` is capped one above `legs` because that is the arithmetic: thirteen
 * stations is twelve legs, and twelve is the payload bound the repository states
 * and enforces. Both empty is legal and means "this journey has no legs" — the
 * record's own endpoints are the journey, which is what every transport written
 * before chains existed already is.
 */
export const saveTransportSchema = z
  .object({
    ...transportInputSchema.shape,
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
      const chain = legsByTransport.get(leg.transportId) ?? []
      chain.push(toLegRow(leg))
      legsByTransport.set(leg.transportId, chain)
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

/**
 * Save a transport and its legs in one call.
 *
 * `requireTrip` first, so a trip id from another tenant is a 404 before any row is touched; the
 * repository then resolves the transport id inside the same scope and writes the record and the
 * chain in a single batch, because a well-formed id from a client is not an authorised one and a
 * half-saved transport is not a state worth recovering from.
 *
 * The mirror carries the leg count and the two outer endpoints rather than the chain: a patch is
 * a notification here and D1 is the record, so a room that hears "this journey now has four legs"
 * refetches rather than trying to apply twelve rows through a 32 KiB frame.
 */
export const saveTransportFn = createServerFn({ method: 'POST' })
  .validator(saveTransportSchema)
  .handler(async ({ data }): Promise<{ readonly transportId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    const { transport, legs } = await saveTransport(scope, {
      tripId: data.tripId,
      transportId: data.transportId,
      record: payload(data),
      chain: chainInput(data),
    })

    await mirrorToRoom(scope, data.tripId, [
      patch('route', transport.id, {
        title: transport.title,
        mode: transport.mode,
        status: transport.status,
        departureDayId: transport.dayId,
        arrivalDayId: transport.arrivalDayId,
        legs: legs.length,
        departureName: transport.departureName,
        arrivalName: transport.arrivalName,
      }),
    ])
    return { transportId: transport.id }
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

/* ------------------------------------------------- a connection, searched for */

/**
 * The two halves of the search, as the dialog reads them.
 *
 * A refusal is a **value**, not a thrown error, and that is deliberate. Four of the six states
 * this surface has to render are refusals — no allowance left, no credential on this deployment,
 * the provider unreachable, the provider talking nonsense — and each of them is a designed panel
 * with its own words. A thrown `Error` arrives at the browser as one string with no reason
 * attached, so the screen would have to read the message to decide what to draw, which is the
 * shape that quietly stops working the day somebody rewords a sentence.
 *
 * A failure that is *not* one of these is still thrown: an unauthenticated caller, a trip that is
 * not theirs, a malformed payload. Those are faults, not outcomes.
 */
export type ConnectionSearchOutcome =
  | {
      readonly ok: true
      readonly connections: ReadonlyArray<TransitConnection>
      /** True when nobody's allowance was spent, because the answer was already held. */
      readonly cached: boolean
      /** Searches left this month, or `null` when this one cost nothing. */
      readonly remaining: number | null
      readonly ceiling: number
    }
  | {
      /**
       * A refusal carries the two facts the screen needs and no sentence.
       *
       * `RateCeilingError`, `TransitProviderError` and `ProviderBlockedError` each hold an English
       * message, and it is
       * written for the log rather than for a reader: sending it here would put untranslated
       * English in front of twenty-two other languages, and the parity gate could not see it
       * because it would never be a key. The screen reads `reason` - and `ceiling`, which
       * separates an allowance that has to be bought from one that has to be waited out - and
       * takes its words from the catalogue.
       */
      readonly ok: false
      readonly reason: 'ceiling' | TransitFailureReason
      readonly ceiling: number
    }

/**
 * The workspace's own ceiling on searches, from the one resolver every other ceiling comes from.
 *
 * `loadPlanState` rather than a fresh subscription read: it is the cached plan state the billing
 * screen and the quota guard already share, so a search costs no extra D1 round trip in the steady
 * state, and the number enforced here is by construction the number `/settings/billing` publishes.
 */
async function transitCeiling(scope: TenantScope): Promise<number> {
  const state = await loadPlanState(
    billingContext(billingRuntime({ scope }), scope.ctx.organizationId),
  )
  return effectiveLimitsFor(state).rates.transit_searches_per_month
}

/**
 * Search public-transport connections between two stops on a date.
 *
 * `POST`, although it reads: a miss spends real money on the workspace's allowance, and a `GET`
 * is the shape a browser, a prefetch or an intermediary feels free to repeat. The proxy behind it
 * decides everything else — the cache is consulted first and is shared across every workspace, the
 * allowance is spent only on a miss, and the provider is reached only after that.
 *
 * `requireTrip` is what makes this a trip member's search rather than anybody's: the query itself
 * carries no tenant data, but the *spending* is the workspace's, and only somebody who can see the
 * trip may spend it.
 */
export const searchConnectionsFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, ...transitQuerySchema.shape }))
  .handler(async ({ data }): Promise<ConnectionSearchOutcome> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    const ceiling = await transitCeiling(scope)
    const query = {
      origin: data.origin,
      destination: data.destination,
      date: data.date,
      time: data.time,
      modes: data.modes,
    }

    try {
      const result = await searchTransitConnections(
        transitRuntime({ organizationId: scope.ctx.organizationId, ceiling }),
        query,
      )
      return {
        ok: true,
        connections: result.connections,
        cached: result.cached,
        remaining:
          result.spent === null ? null : Math.max(0, ceiling - result.spent),
        ceiling,
      }
    } catch (cause) {
      const reason = refusalReason(cause)
      if (reason !== null) {
        return { ok: false, reason, ceiling }
      }
      throw cause
    }
  })

/**
 * Save a chosen connection as an ordinary journey, or replace the route of one already saved.
 *
 * The same wire shapes the hand-typed chain uses, because what is written is the same thing: a
 * transport with a chain of stations. `transportId` is the whole difference between the two acts —
 * without it a new journey is created, with it that journey's route is replaced and its identity,
 * status and booking fields are left exactly where they were.
 *
 * The mirror carries the leg count and the two outer endpoints rather than the chain, for the
 * reason `saveTransportFn` gives: a patch is a notification and D1 is the record.
 */
export const saveSearchedConnectionFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId,
      /** `''` for a connection nobody has saved yet. */
      transportId: z.string().trim().max(64),
      mode: z.enum(TRANSPORT_MODES),
      title: titleText,
      priceMinor: optionalMinorAmount,
      currency: optionalCurrency,
      stations: z
        .array(stationSchema)
        .min(2)
        .max(CHAIN_MAX_LEGS + 1),
      legs: z.array(chainLegSchema).min(1).max(CHAIN_MAX_LEGS),
    }),
  )
  .handler(
    async ({
      data,
    }): Promise<{ readonly transportId: string; readonly legs: number }> => {
      const scope = await appScope()
      await requireTrip(scope, data.tripId)

      const saved = await saveSearchedConnection(scope, {
        tripId: data.tripId,
        transportId: orNull(data.transportId),
        mode: data.mode,
        title: data.title,
        priceMinor: data.priceMinor === 0 ? null : data.priceMinor,
        currency: orNull(data.currency),
        ...chainInput(data),
      })

      await mirrorToRoom(scope, data.tripId, [
        patch('route', saved.transport.id, {
          title: saved.transport.title,
          mode: saved.transport.mode,
          status: saved.transport.status,
          legs: saved.legs.length,
          departureName: saved.transport.departureName,
          arrivalName: saved.transport.arrivalName,
        }),
      ])
      return { transportId: saved.transport.id, legs: saved.legs.length }
    },
  )

/**
 * The answer shapes, re-exported as **types only**.
 *
 * A component that renders a connection needs to know its shape and must not pull the proxy, its
 * validators or the database schema behind it into the browser bundle. Types are erased, so this
 * costs nothing at runtime — the same arrangement `StationMatch` already has, and the reason
 * `leg-form.ts` restates the mode list instead of importing it.
 */
export type {
  TransitConnection,
  TransitLeg,
  TransitMode,
  TransitStop,
} from '#/server/transit/search'
