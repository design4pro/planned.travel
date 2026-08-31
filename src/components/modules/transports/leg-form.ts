/**
 * The shape of the leg dialog, and the rules it enforces before it submits.
 *
 * A leg is the one row on this trip that a traveller reads back to a stranger at a
 * desk — a booking reference, a seat, a service number — so the form's job is to
 * keep those exact, and to refuse the two things that make a leg nonsense: no name,
 * and an arrival before its departure.
 */
import { formatWeekday } from '#/lib/format'
import { isKnownTimeZone } from '#/lib/timezones'
import { legTimingError } from './connections'

import type { TransportData } from './types'

export const TRANSPORT_MODES = [
  'flight',
  'train',
  'bus',
  'ferry',
  'car',
  'taxi',
  'transit',
  'metro',
  'tram',
  'bike',
  'walk',
  'other',
] as const

export type TransportMode = (typeof TRANSPORT_MODES)[number]

export const TRANSPORT_STATUSES = [
  'idea',
  'pending',
  'confirmed',
  'completed',
  'cancelled',
] as const

export type TransportStatus = (typeof TRANSPORT_STATUSES)[number]

export function isTransportMode(value: string): value is TransportMode {
  return (TRANSPORT_MODES as ReadonlyArray<string>).includes(value)
}

export function isTransportStatus(value: string): value is TransportStatus {
  return (TRANSPORT_STATUSES as ReadonlyArray<string>).includes(value)
}

export const MODE_LABELS: { readonly [K in TransportMode]: string } = {
  flight: 'Flight',
  train: 'Train',
  bus: 'Bus',
  ferry: 'Ferry',
  car: 'Car',
  taxi: 'Taxi',
  transit: 'Transit',
  metro: 'Metro',
  tram: 'Tram',
  bike: 'Bike',
  walk: 'Walk',
  other: 'Other',
}

export function modeLabel(mode: string): string {
  return isTransportMode(mode) ? MODE_LABELS[mode] : 'Leg'
}

export const STATUS_LABELS: { readonly [K in TransportStatus]: string } = {
  idea: 'Idea',
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Done',
  cancelled: 'Cancelled',
}

export function transportStatusLabel(status: string): string {
  return isTransportStatus(status) ? STATUS_LABELS[status] : 'Leg'
}

/**
 * Modes where a station code is a real thing a traveller reads off a ticket. A
 * walk from the hotel does not have one, and asking for it is noise.
 */
const CODED_MODES: ReadonlyArray<TransportMode> = [
  'flight',
  'train',
  'ferry',
  'bus',
]

export function usesCodes(mode: string): boolean {
  return isTransportMode(mode) && CODED_MODES.includes(mode)
}

/** Modes that carry a carrier and a service number. */
const SERVICED_MODES: ReadonlyArray<TransportMode> = [
  'flight',
  'train',
  'bus',
  'ferry',
  'transit',
  'metro',
  'tram',
]

export function usesService(mode: string): boolean {
  return isTransportMode(mode) && SERVICED_MODES.includes(mode)
}

/** Modes where a seat is assigned rather than taken. */
const SEATED_MODES: ReadonlyArray<TransportMode> = ['flight', 'train', 'bus']

export function usesSeat(mode: string): boolean {
  return isTransportMode(mode) && SEATED_MODES.includes(mode)
}

export interface EndpointLabels {
  readonly from: string
  readonly to: string
  readonly fromDay: string
  readonly toDay: string
}

/**
 * The part of an itinerary day this form needs: which day it is, and where it
 * sits in the run. The whole day is not the form's business.
 */
export interface DayChoice {
  readonly id: string
  readonly dayNumber: number
}

/**
 * A day of the trip, named the way a person refers to a day of their own trip:
 * the number first, then whatever tells two days apart.
 *
 * The date is written `Fri 9 Oct` rather than `2026-10-09`, through the shared
 * formatter the timeline already uses — it answers from a CLDR table instead of
 * asking the platform for `month: 'short'`, which workerd and WebKit resolve from
 * different ICU builds (`12-verification-protocol.md` §7.2). A date it cannot
 * read is printed as stored, because a label is better than a gap.
 *
 * The parameter is structural rather than the loader's own type, for the reason
 * `types.ts` gives: these components depend on the data they need, not on one
 * screen's wire format.
 */
export function dayLabel(day: {
  readonly dayNumber: number
  readonly date: string | null
  readonly title: string | null
}): string {
  const parts = [`Day ${day.dayNumber}`]
  if (day.title !== null && day.title.length > 0) {
    parts.push(day.title)
  } else if (day.date !== null) {
    parts.push(formatWeekday(day.date) ?? day.date)
  }
  return parts.join(' · ')
}

/** What the two days are called for everything that is not a hire car. */
const DEPARTS_AND_ARRIVES = {
  fromDay: 'Departure day',
  toDay: 'Arrival day',
} as const

/**
 * What each end of a transport is called, per mode — the endpoint legend and the
 * day beside it, from one function.
 *
 * A hire car is the case worth naming: nobody says a car departs and arrives,
 * they say it is picked up and returned. All four strings are decided here
 * together so the legend over the endpoint and the label over its day select
 * cannot drift apart.
 */
export function endpointLabels(mode: string): EndpointLabels {
  if (mode === 'car') {
    return {
      from: 'Pick-up',
      to: 'Drop-off',
      fromDay: 'Pick-up day',
      toDay: 'Return day',
    }
  }
  if (mode === 'flight') {
    return { from: 'From airport', to: 'To airport', ...DEPARTS_AND_ARRIVES }
  }
  if (mode === 'ferry') {
    return { from: 'From port', to: 'To port', ...DEPARTS_AND_ARRIVES }
  }
  if (mode === 'train' || mode === 'metro' || mode === 'tram') {
    return { from: 'From station', to: 'To station', ...DEPARTS_AND_ARRIVES }
  }
  return { from: 'From', to: 'To', ...DEPARTS_AND_ARRIVES }
}

/* ------------------------------------------------------------------- draft */

export interface LegDraft {
  readonly mode: TransportMode
  readonly status: TransportStatus
  readonly title: string
  /**
   * The day the journey leaves on and the day it lands on, as ids or `''`.
   *
   * Two references and not one derived from the other: a night flight leaves on
   * Tuesday and lands on Wednesday, and only the traveller knows that. `''` on
   * both is a legal draft — an idea has no day.
   */
  readonly departureDayId: string
  readonly arrivalDayId: string
  readonly carrier: string
  readonly serviceNumber: string
  readonly bookingCode: string
  readonly seat: string
  readonly departureName: string
  readonly departureCode: string
  readonly departureDate: string
  readonly departureTime: string
  readonly arrivalName: string
  readonly arrivalCode: string
  readonly arrivalDate: string
  readonly arrivalTime: string
  /** Kilometres, as typed. Converted to metres on submit. */
  readonly distanceKm: string
  readonly price: string
  readonly currency: string
  readonly notes: string
}

export function emptyLegDraft(currency: string): LegDraft {
  return {
    mode: 'flight',
    status: 'pending',
    title: '',
    departureDayId: '',
    arrivalDayId: '',
    carrier: '',
    serviceNumber: '',
    bookingCode: '',
    seat: '',
    departureName: '',
    departureCode: '',
    departureDate: '',
    departureTime: '',
    arrivalName: '',
    arrivalCode: '',
    arrivalDate: '',
    arrivalTime: '',
    distanceKm: '',
    price: '',
    currency,
    notes: '',
  }
}

/**
 * The name the leg gets when the traveller has not typed one: "SAS from LHR to
 * HND", "Train from Tokyo to Kyoto". Suggested, never forced — the field stays
 * editable and this only fills a blank.
 */
export function suggestLegTitle(draft: LegDraft): string {
  const from =
    draft.departureCode.trim() !== ''
      ? draft.departureCode.trim().toUpperCase()
      : draft.departureName.trim()
  const to =
    draft.arrivalCode.trim() !== ''
      ? draft.arrivalCode.trim().toUpperCase()
      : draft.arrivalName.trim()
  const operator =
    draft.carrier.trim() !== '' ? draft.carrier.trim() : modeLabel(draft.mode)

  if (from === '' && to === '') {
    return ''
  }
  if (from === '') {
    return `${operator} to ${to}`
  }
  if (to === '') {
    return `${operator} from ${from}`
  }
  return `${operator} from ${from} to ${to}`
}

/* -------------------------------------------------------------- validation */

export type LegErrors = Partial<Record<keyof LegDraft | 'form', string>>

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

export function validateLegDraft(
  draft: LegDraft,
  days: ReadonlyArray<DayChoice> = [],
): LegErrors {
  const errors: LegErrors = {}

  if (draft.title.trim().length === 0) {
    errors.title = 'Give this leg a name you will recognise in a list.'
  } else if (draft.title.trim().length > 160) {
    errors.title = 'Keep the name under 160 characters.'
  }

  for (const field of ['departureDate', 'arrivalDate'] as const) {
    const value = draft[field].trim()
    if (value !== '' && !DATE_PATTERN.test(value)) {
      errors[field] = 'A date is written YYYY-MM-DD.'
    }
  }
  for (const field of ['departureTime', 'arrivalTime'] as const) {
    const value = draft[field].trim()
    if (value !== '' && !TIME_PATTERN.test(value)) {
      errors[field] = 'A time is written HH:MM on a 24-hour clock.'
    }
  }

  if (draft.departureTime.trim() !== '' && draft.departureDate.trim() === '') {
    errors.departureDate = 'A departure time needs the date it is on.'
  }
  if (draft.arrivalTime.trim() !== '' && draft.arrivalDate.trim() === '') {
    errors.arrivalDate = 'An arrival time needs the date it is on.'
  }

  const ordering = legTimingError({
    departureDate: draft.departureDate.trim(),
    departureTime: draft.departureTime.trim(),
    arrivalDate: draft.arrivalDate.trim(),
    arrivalTime: draft.arrivalTime.trim(),
  })
  if (ordering !== null && errors.arrivalDate === undefined) {
    errors.arrivalDate = ordering
  }

  for (const field of ['departureCode', 'arrivalCode'] as const) {
    const value = draft[field].trim()
    if (value !== '' && !/^[A-Za-z0-9]{2,8}$/u.test(value)) {
      errors[field] = 'A code is 2 to 8 letters or digits.'
    }
  }

  if (draft.distanceKm.trim() !== '') {
    const value = Number.parseFloat(draft.distanceKm.trim().replace(',', '.'))
    if (!Number.isFinite(value) || value < 0 || value > 100_000) {
      errors.distanceKm = 'A distance is a number of kilometres, up to 100,000.'
    }
  }

  if (draft.price.trim() !== '' && !/^[\d.,\s]+$/u.test(draft.price.trim())) {
    errors.price = 'That is not an amount we can read.'
  }

  const dayOrder = dayOrderError(draft, days)
  if (dayOrder !== null) {
    errors.arrivalDayId = dayOrder
  }

  return errors
}

/**
 * Landing on a day earlier than the one you left on, said in the words the mode
 * uses.
 *
 * Silent about a day the list does not carry: an id that resolves to nothing
 * cannot be ordered against anything, and refusing it would refuse a draft the
 * reader has no way to repair. The repository re-runs this rule against the
 * trip's real days, because the form is a convenience and the repository is the
 * rule.
 */
function dayOrderError(
  draft: LegDraft,
  days: ReadonlyArray<DayChoice>,
): string | null {
  const from = days.find((day) => day.id === draft.departureDayId)
  const to = days.find((day) => day.id === draft.arrivalDayId)
  if (
    from === undefined ||
    to === undefined ||
    to.dayNumber >= from.dayNumber
  ) {
    return null
  }
  const labels = endpointLabels(draft.mode)
  return `The ${labels.toDay.toLowerCase()} comes before the ${labels.fromDay.toLowerCase()}.`
}

export function hasLegErrors(errors: LegErrors): boolean {
  return Object.keys(errors).length > 0
}

/** Kilometres as typed → whole metres for the column. `''` becomes `0`. */
export function kilometresToMetres(value: string): number {
  const trimmed = value.trim().replace(',', '.')
  if (trimmed === '') {
    return 0
  }
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 1000) : 0
}

/** Metres → the kilometre string the input shows. `null`/`0` becomes `''`. */
export function metresToKilometres(metres: number | null): string {
  if (metres === null || metres === 0) {
    return ''
  }
  const km = metres / 1000
  return Number.isInteger(km) ? String(km) : km.toFixed(1)
}

/* -------------------------------------------------------------------- chain */

/**
 * The most legs one chain may hold, mirrored from `src/server/repos/transports.ts`.
 *
 * It is a bound on the validated array — a payload limit that keeps the mirrored
 * `route` patch inside the frame `src/server/do/protocol.ts` fixes — and not a
 * statement about how many changes a journey may have. Said here as well as
 * there so the editor can stop offering a control the server would refuse; the
 * repository is still the one that enforces it, because the form is a
 * convenience.
 */
export const CHAIN_MAX_LEGS = 12

/** One station on the chain: where it is, and which clock it is on. */
export interface StationDraft {
  /** A React key, local to this editing session. Never sent, never stored. */
  readonly key: string
  readonly name: string
  readonly code: string
  /** From the catalogue when a code resolved, otherwise unset. */
  readonly lat: number | null
  readonly lng: number | null
  /** IANA name, or `''` for an endpoint whose clock is not yet stated. */
  readonly timezone: string
}

/**
 * One leg: the ticket, and the two ends' clocks. Not its endpoints — those are
 * the stations either side of it, so the two rows meeting at a change cannot
 * disagree about which station they meet at.
 */
export interface ChainLegDraft {
  readonly key: string
  readonly serviceNumber: string
  readonly platform: string
  readonly seat: string
  readonly departureDayId: string
  readonly departureDate: string
  readonly departureTime: string
  readonly arrivalDayId: string
  readonly arrivalDate: string
  readonly arrivalTime: string
}

/**
 * A whole chain as the editor holds it: N stations and N−1 legs, always.
 *
 * `broken` is what separates "a journey with two endpoints" from "a chain that
 * happens to have two stations". A transport with no rows is read as the
 * one-leg chain its own columns describe so the editor has something to show,
 * but until the traveller breaks it up that chain is *the record* and is saved
 * as no rows at all — which is what keeps every journey recorded before this
 * stage reading exactly as it did.
 */
export interface ChainDraft {
  readonly broken: boolean
  readonly stations: ReadonlyArray<StationDraft>
  readonly legs: ReadonlyArray<ChainLegDraft>
}

let keySeed = 0

/** A key for a row the traveller just made. Local to the session by design. */
function nextKey(prefix: string): string {
  keySeed += 1
  return `${prefix}-${keySeed}`
}

export function emptyStation(): StationDraft {
  return {
    key: nextKey('station'),
    name: '',
    code: '',
    lat: null,
    lng: null,
    timezone: '',
  }
}

export function emptyChainLeg(): ChainLegDraft {
  return {
    key: nextKey('leg'),
    serviceNumber: '',
    platform: '',
    seat: '',
    departureDayId: '',
    departureDate: '',
    departureTime: '',
    arrivalDayId: '',
    arrivalDate: '',
    arrivalTime: '',
  }
}

/**
 * The chain a *new* transport opens on: two blank stations and the one blank
 * leg between them, unbroken.
 *
 * Unbroken, so a transport nobody breaks up is saved as no rows — and blank
 * rather than absent, so pressing "Break this into legs" before anything has
 * been typed produces an editor rather than nothing.
 */
export function emptyChain(): ChainDraft {
  return {
    broken: false,
    stations: [emptyStation(), emptyStation()],
    legs: [emptyChainLeg()],
  }
}

/** `null` reads as an empty field, never as the word "null". */
function text(value: string | null | undefined): string {
  return value ?? ''
}

/**
 * The chain to edit for a transport.
 *
 * With rows, it is those rows. Without them it is the **one-leg chain the
 * record's own endpoints already describe** — the compatibility claim of this
 * whole stage, and the reason the migration backfills nothing: an old journey
 * opens on exactly the two endpoints and the one set of times it was recorded
 * with, and saves back as no rows unless the traveller breaks it up.
 */
export function chainFromTransport(transport: TransportData): ChainDraft {
  const rows = [...transport.legs].sort(
    (left, right) => left.position - right.position,
  )
  const first = rows.at(0)
  if (first === undefined) {
    return {
      broken: false,
      stations: [
        {
          key: nextKey('station'),
          name: text(transport.departureName),
          code: text(transport.departureCode),
          lat: null,
          lng: null,
          timezone: '',
        },
        {
          key: nextKey('station'),
          name: text(transport.arrivalName),
          code: text(transport.arrivalCode),
          lat: null,
          lng: null,
          timezone: '',
        },
      ],
      legs: [
        {
          key: nextKey('leg'),
          serviceNumber: text(transport.serviceNumber),
          platform: '',
          seat: text(transport.seat),
          departureDayId: text(transport.departureDayId),
          departureDate: text(transport.departureDate),
          departureTime: text(transport.departureTime),
          arrivalDayId: text(transport.arrivalDayId),
          arrivalDate: text(transport.arrivalDate),
          arrivalTime: text(transport.arrivalTime),
        },
      ],
    }
  }

  return {
    broken: true,
    stations: [
      {
        key: `${first.id}-from`,
        name: first.fromName,
        code: text(first.fromCode),
        lat: first.fromLat,
        lng: first.fromLng,
        timezone: text(first.fromTimezone),
      },
      ...rows.map((row) => ({
        key: `${row.id}-to`,
        name: row.toName,
        code: text(row.toCode),
        lat: row.toLat,
        lng: row.toLng,
        timezone: text(row.toTimezone),
      })),
    ],
    legs: rows.map((row) => ({
      key: row.id,
      serviceNumber: text(row.serviceNumber),
      platform: text(row.platform),
      seat: text(row.seat),
      departureDayId: text(row.departureDayId),
      departureDate: text(row.departureDate),
      departureTime: text(row.departureTime),
      arrivalDayId: text(row.arrivalDayId),
      arrivalDate: text(row.arrivalDate),
      arrivalTime: text(row.arrivalTime),
    })),
  }
}

/** How many legs the chain holds. N stations, N−1 legs, at every edit. */
export function chainLegCount(chain: ChainDraft): number {
  return chain.legs.length
}

/** Breaks a recorded journey into legs without changing anything about it. */
export function breakIntoLegs(chain: ChainDraft): ChainDraft {
  return chain.broken ? chain : { ...chain, broken: true }
}

/**
 * Adds a stop in the middle of leg `index`, splitting it in two.
 *
 * The traveller is adding a change of train, not retyping their ticket, so both
 * halves keep the service number and the seat and the outer times stay where
 * they were; only the two clocks at the new join are blank, because nobody has
 * typed them yet. Out of range, or past the cap, the chain is returned unchanged
 * — the caller has nothing to handle and no state to roll back.
 */
export function splitLegAt(chain: ChainDraft, index: number): ChainDraft {
  if (
    index < 0 ||
    index >= chain.legs.length ||
    chain.legs.length >= CHAIN_MAX_LEGS
  ) {
    return chain
  }
  const leg = chain.legs[index]
  const first: ChainLegDraft = {
    ...leg,
    key: nextKey('leg'),
    arrivalDayId: '',
    arrivalDate: '',
    arrivalTime: '',
  }
  const second: ChainLegDraft = {
    ...leg,
    key: nextKey('leg'),
    departureDayId: '',
    departureDate: '',
    departureTime: '',
  }
  return {
    broken: true,
    stations: [
      ...chain.stations.slice(0, index + 1),
      emptyStation(),
      ...chain.stations.slice(index + 1),
    ],
    legs: [
      ...chain.legs.slice(0, index),
      first,
      second,
      ...chain.legs.slice(index + 1),
    ],
  }
}

/**
 * Removes a stop, joining the two legs either side of it.
 *
 * A middle stop leaves one leg carrying the departure of the leg before it and
 * the arrival of the leg after — which is what "the train no longer stops here"
 * means. An end stop simply drops the leg hanging off it. A chain never falls
 * below two stations, because one station is not a journey; that call returns the
 * chain unchanged rather than throwing, so a stale click is a no-op.
 */
export function removeStationAt(chain: ChainDraft, index: number): ChainDraft {
  if (
    index < 0 ||
    index >= chain.stations.length ||
    chain.stations.length <= 2
  ) {
    return chain
  }
  const stations = [
    ...chain.stations.slice(0, index),
    ...chain.stations.slice(index + 1),
  ]
  if (index === 0) {
    return { ...chain, broken: true, stations, legs: chain.legs.slice(1) }
  }
  if (index === chain.stations.length - 1) {
    return { ...chain, broken: true, stations, legs: chain.legs.slice(0, -1) }
  }
  const before = chain.legs[index - 1]
  const after = chain.legs[index]
  const joined: ChainLegDraft = {
    ...before,
    arrivalDayId: after.arrivalDayId,
    arrivalDate: after.arrivalDate,
    arrivalTime: after.arrivalTime,
  }
  return {
    broken: true,
    stations,
    legs: [
      ...chain.legs.slice(0, index - 1),
      joined,
      ...chain.legs.slice(index + 1),
    ],
  }
}

/**
 * What a station is called in a control's accessible name — "Add a stop after
 * Nagoya". Its name, else its code, else its place in the chain, so the button
 * is never announced as "Add a stop after".
 */
export function stationLabel(station: StationDraft, index: number): string {
  const name = station.name.trim()
  if (name !== '') return name
  const code = station.code.trim()
  return code === '' ? `stop ${index + 1}` : code.toUpperCase()
}

/* --------------------------------------------------------- chain validation */

export interface StationErrors {
  readonly name?: string
  readonly code?: string
  readonly timezone?: string
}

export interface ChainLegErrors {
  readonly departureDate?: string
  readonly departureTime?: string
  readonly arrivalDate?: string
  readonly arrivalTime?: string
  readonly arrivalDayId?: string
}

export interface ChainErrors {
  readonly stations?: ReadonlyArray<StationErrors | undefined>
  readonly legs?: ReadonlyArray<ChainLegErrors | undefined>
  readonly form?: string
}

export function hasChainErrors(errors: ChainErrors): boolean {
  if (errors.form !== undefined) return true
  const rows = [...(errors.stations ?? []), ...(errors.legs ?? [])]
  return rows.some((row) => row !== undefined && Object.keys(row).length > 0)
}

function stationErrors(station: StationDraft): StationErrors {
  const errors: { name?: string; code?: string; timezone?: string } = {}
  if (station.name.trim() === '') {
    errors.name = 'Every stop needs a name — this is where you change.'
  } else if (station.name.trim().length > 200) {
    errors.name = 'Keep a stop’s name under 200 characters.'
  }
  const code = station.code.trim()
  if (code !== '' && !/^[A-Za-z0-9]{2,8}$/u.test(code)) {
    errors.code = 'A code is 2 to 8 letters or digits.'
  }
  const zone = station.timezone.trim()
  if (zone !== '' && !isKnownTimeZone(zone)) {
    errors.timezone = 'Pick a time zone from the list.'
  }
  return errors
}

function chainLegErrors(
  leg: ChainLegDraft,
  mode: string,
  days: ReadonlyArray<DayChoice>,
): ChainLegErrors {
  const errors: {
    departureDate?: string
    departureTime?: string
    arrivalDate?: string
    arrivalTime?: string
    arrivalDayId?: string
  } = {}

  for (const field of ['departureDate', 'arrivalDate'] as const) {
    const value = leg[field].trim()
    if (value !== '' && !DATE_PATTERN.test(value)) {
      errors[field] = 'A date is written YYYY-MM-DD.'
    }
  }
  for (const field of ['departureTime', 'arrivalTime'] as const) {
    const value = leg[field].trim()
    if (value !== '' && !TIME_PATTERN.test(value)) {
      errors[field] = 'A time is written HH:MM on a 24-hour clock.'
    }
  }

  const ordering = legTimingError({
    departureDate: leg.departureDate.trim(),
    departureTime: leg.departureTime.trim(),
    arrivalDate: leg.arrivalDate.trim(),
    arrivalTime: leg.arrivalTime.trim(),
  })
  if (ordering !== null && errors.arrivalTime === undefined) {
    errors.arrivalTime = ordering
  }

  const from = days.find((day) => day.id === leg.departureDayId)
  const to = days.find((day) => day.id === leg.arrivalDayId)
  if (from !== undefined && to !== undefined && to.dayNumber < from.dayNumber) {
    const labels = endpointLabels(mode)
    errors.arrivalDayId = `The ${labels.toDay.toLowerCase()} comes before the ${labels.fromDay.toLowerCase()}.`
  }

  return errors
}

/**
 * Every rule a chain has to keep before it is sent, per row.
 *
 * Silent about a day the list does not carry, for the reason `dayOrderError`
 * gives: an id that resolves to nothing cannot be ordered against anything, and
 * the repository re-runs the rule against the trip's real days anyway.
 */
export function validateChain(
  chain: ChainDraft,
  mode: string,
  days: ReadonlyArray<DayChoice>,
): ChainErrors {
  const errors: ChainErrors = {
    stations: chain.stations.map(stationErrors),
    legs: chain.legs.map((leg) => chainLegErrors(leg, mode, days)),
  }
  return chain.legs.length > CHAIN_MAX_LEGS
    ? { ...errors, form: `A chain holds at most ${CHAIN_MAX_LEGS} legs.` }
    : errors
}

/* -------------------------------------------------------------- chain wire */

export interface ChainStationPayload {
  readonly name: string
  readonly code: string
  readonly lat: number | null
  readonly lng: number | null
  readonly timezone: string
}

export interface ChainLegPayload {
  readonly serviceNumber: string
  readonly platform: string
  readonly seat: string
  readonly departureDayId: string
  readonly departureDate: string
  readonly departureTime: string
  readonly arrivalDayId: string
  readonly arrivalDate: string
  readonly arrivalTime: string
}

/**
 * Mutable arrays on purpose: this is a wire payload handed straight to a Zod
 * validator, and `z.array()` infers a mutable array. A `ReadonlyArray` here
 * would make the call site cast, which is the one place a cast would be over
 * data on its way to the server.
 */
export interface ChainPayload {
  readonly stations: Array<ChainStationPayload>
  readonly legs: Array<ChainLegPayload>
}

/**
 * The chain as the one writer takes it — or nothing at all.
 *
 * A journey nobody broke up sends an **empty** chain, which is not "no change"
 * but "this transport has no legs": the record's own endpoints are the journey,
 * exactly as they were before this stage existed, and any rows it used to have
 * are removed. That is the same statement the migration made by backfilling
 * nothing, made once more at the only place that writes.
 */
export function chainPayload(chain: ChainDraft): ChainPayload {
  if (!chain.broken || chain.stations.length < 2) {
    return { stations: [], legs: [] }
  }
  return {
    stations: chain.stations.map((station) => ({
      name: station.name.trim(),
      code: station.code.trim().toUpperCase(),
      lat: station.lat,
      lng: station.lng,
      timezone: station.timezone.trim(),
    })),
    legs: chain.legs.map((leg) => ({
      serviceNumber: leg.serviceNumber.trim(),
      platform: leg.platform.trim(),
      seat: leg.seat.trim(),
      departureDayId: leg.departureDayId,
      departureDate: leg.departureDate.trim(),
      departureTime: leg.departureTime.trim(),
      arrivalDayId: leg.arrivalDayId,
      arrivalDate: leg.arrivalDate.trim(),
      arrivalTime: leg.arrivalTime.trim(),
    })),
  }
}

/* ---------------------------------------------------------- the catalogue */

/**
 * One catalogue row, as a station row consumes it.
 *
 * Declared structurally rather than imported from `#/server/fns/transports`, for
 * the reason `types.ts` gives about the loader payload: this module depends on
 * the four fields it can store and not on one endpoint's wire format.
 *
 * The catalogue also answers a city and a country, and neither is here, because
 * neither has anywhere to go: `transport_legs` stores a name, a code, a
 * coordinate pair and a zone per endpoint and nothing else. They are shown in
 * the picker's own rows — which is where they do their job, telling two
 * identically-named airports apart while the traveller chooses between them.
 */
export interface StationLookup {
  readonly code: string
  readonly name: string
  readonly timezone: string | null
  readonly lat: number | null
  readonly lng: number | null
}

/**
 * A coordinate is a pair or it is nothing.
 *
 * Half of one is not a weaker fact than both, it is a wrong one: a latitude with
 * no longitude puts the station on the Gulf of Guinea. The schema's own
 * `latLngChecks` treat the two columns together for the same reason.
 */
function pairOf(
  match: StationLookup,
): { lat: number; lng: number } | undefined {
  return match.lat === null || match.lng === null
    ? undefined
    : { lat: match.lat, lng: match.lng }
}

/**
 * The station a traveller **picked** out of the type-ahead.
 *
 * An explicit choice replaces what was in the fields: they looked at the row and
 * chose it, and refusing to fill would leave them staring at a station they
 * picked beside a name they did not. The one thing it will not do is *clear* a
 * field — a catalogue cut that carries no zone for a row is a fact about the
 * artefact, never a statement that the airport has no clock.
 */
export function applyStationMatch(
  station: StationDraft,
  match: StationLookup,
): StationDraft {
  return {
    ...station,
    name: match.name,
    code: match.code.toUpperCase(),
    timezone: match.timezone ?? station.timezone,
    ...(pairOf(match) ?? {}),
  }
}

/**
 * The station behind a code the traveller **typed**, which is a hint rather than
 * a choice.
 *
 * It fills the blanks around the code and touches nothing that was written by
 * hand. That asymmetry with {@link applyStationMatch} is the whole rule: a
 * lookup that overwrote a name somebody typed would have turned the shortcut
 * into a gate, and the catalogue is a cut taken on the day the artefact was
 * built — it is always behind the world, so the traveller is right and it is
 * wrong more often than the reverse.
 *
 * The code itself is still canonicalised, because that is the field they were
 * typing into and `nrt` and `NRT` are the same code.
 */
export function fillStationFromCode(
  station: StationDraft,
  match: StationLookup,
): StationDraft {
  const pair = pairOf(match)
  return {
    ...station,
    code: match.code.toUpperCase(),
    name: station.name.trim() === '' ? match.name : station.name,
    timezone:
      station.timezone.trim() === ''
        ? (match.timezone ?? station.timezone)
        : station.timezone,
    ...(station.lat === null && station.lng === null && pair !== undefined
      ? pair
      : {}),
  }
}

/**
 * Whether a typed code is worth asking the catalogue about.
 *
 * The lookup runs when the traveller leaves the code field, so this is what
 * keeps a half-typed code from costing a round trip: an IATA code is three
 * characters and an ICAO code is four, and the catalogue is indexed on exactly
 * those two. Anything else is either unfinished or not a code, and a station
 * recorded as free text never needs one at all.
 */
export function isLookupCode(value: string): boolean {
  return /^[A-Za-z0-9]{3,4}$/u.test(value.trim())
}
