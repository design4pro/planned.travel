/**
 * The wire shapes of the Transport writes: what the dialog and the connection search send, and
 * what a server function accepts before it reaches the repository.
 *
 * Not in `transports.ts`: that module reaches `cloudflare:workers` through the billing runtime, so
 * nothing outside a Worker can load it, and the dialog's tests could only bind to these
 * validators by a type assertion. This module imports no binding, so a plain Node test parses the
 * payload the dialog builds through the very schema the server function runs.
 *
 * These are **not** the repository's field schemas, and are not merged with them on purpose: on
 * the wire `''` means "not stated", in the repository it is `nullish()`, and one declaration for
 * both would change what the dialog sends. What the two dialects do share — how many legs a chain
 * may hold and how its stations relate to them — is `#/lib/transport-chain`.
 */
import { z } from 'zod'

import { TRANSPORT_MODES, TRANSPORT_STATUSES } from '#/server/db/schema'
import { resolveTimeZone } from '#/lib/time'
import {
  CHAIN_MAX_LEGS,
  CHAIN_MAX_STATIONS,
  CHAIN_MIN_LEGS,
  CHAIN_MIN_STATIONS,
  chainShapeIssue,
} from '#/lib/transport-chain'
import { TRANSPORT_SAVE_INTENTS } from '#/lib/transport-save-intent'
import { DATE_PATTERN, TIME_PATTERN } from '#/lib/transport-timing'

export const tripId = z.string().trim().min(1).max(64)
export const rowId = z.string().trim().min(1).max(64)

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

/* ------------------------------------------------------------ chain inputs */

export const stationSchema = z.object({
  name: z.string().trim().min(1).max(200),
  code: optionalCode,
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  timezone: optionalTimeZone,
})

export const chainLegSchema = z.object({
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
 * The arithmetic between a chain's two arrays, as an issue on the object that holds them.
 *
 * The bounds on each array are `.min()` and `.max()` at the call site; what a bound cannot state
 * — N stations, N−1 legs — is `chainShapeIssue`, which the repository asks as well.
 */
function refineChainShape(
  data: {
    readonly stations: ReadonlyArray<unknown>
    readonly legs: ReadonlyArray<unknown>
  },
  ctx: z.RefinementCtx,
): void {
  const issue = chainShapeIssue(data.stations.length, data.legs.length)
  if (issue !== null) {
    ctx.addIssue({ code: 'custom', path: [issue.path], message: issue.message })
  }
}

/**
 * The validator of the one save behind the Transport dialog: the record, the id it is saved under,
 * and its chain.
 *
 * `transportId` is minted by the dialog for a new transport and is the row's identity from then
 * on: pressing save twice on one draft is an edit of the row the first press wrote, not a second
 * row. `intent` is what the dialog means to do, from whether it is editing: an `edit` of a row that
 * is no longer there is refused rather than written back. Whether the row exists is the
 * repository's to say, inside the caller's scope.
 *
 * Both arrays empty is legal and means "this journey has no legs" — the record's own endpoints
 * are the journey, which is what every transport written before chains existed already is.
 */
export const saveTransportSchema = z
  .object({
    ...transportInputSchema.shape,
    transportId: rowId,
    intent: z.enum(TRANSPORT_SAVE_INTENTS),
    stations: z.array(stationSchema).max(CHAIN_MAX_STATIONS),
    legs: z.array(chainLegSchema).max(CHAIN_MAX_LEGS),
  })
  .superRefine(refineChainShape)

/**
 * The validator of a found connection's save: a chosen connection becomes a journey, or replaces
 * the route of one already saved.
 *
 * The same chain shapes the hand-typed dialog sends, because what is written is the same thing, but
 * a found connection always has a route: at least two stations and one leg. `transportId` is `''`
 * for a connection nobody has saved yet and names the journey being re-searched otherwise.
 */
export const saveSearchedConnectionSchema = z
  .object({
    tripId,
    transportId: z.string().trim().max(64),
    mode: z.enum(TRANSPORT_MODES),
    title: titleText,
    priceMinor: optionalMinorAmount,
    currency: optionalCurrency,
    stations: z
      .array(stationSchema)
      .min(CHAIN_MIN_STATIONS)
      .max(CHAIN_MAX_STATIONS),
    legs: z.array(chainLegSchema).min(CHAIN_MIN_LEGS).max(CHAIN_MAX_LEGS),
  })
  .superRefine(refineChainShape)
