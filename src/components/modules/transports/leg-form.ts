/**
 * The shape of the transport dialog, and the rules it enforces before it submits.
 *
 * A transport is the one row on this trip that a traveller reads back to a stranger at a
 * desk — a booking reference, a seat, a service number — so the form's job is to
 * keep those exact, and to refuse the two things that make a transport nonsense: no name,
 * and an arrival before its departure.
 */
import { formatWeekday } from '#/lib/format'
import { isKnownTimeZone } from '#/lib/timezones'
import { transportTimingError } from './connections'

import { isTransportMode, modeLabel } from './vocabulary'

import type { Locale, MessageKey, Translate } from '#/lib/i18n'
import type { TransportData } from './types'
import type { TransportMode, TransportStatus } from './vocabulary'

/* The vocabulary keeps its own file but stays reachable from here, so no caller
 * had to change its import when it moved. */
export {
  MODE_LABELS,
  STATUS_LABELS,
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  isTransportMode,
  isTransportStatus,
  modeLabel,
  transportStatusLabel,
} from './vocabulary'
export type { TransportMode, TransportStatus } from './vocabulary'

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

/**
 * What both ends of a transport are called, and what the day beside each end is
 * called. Keys, never sentences: the catalogue owns the words.
 */
export interface EndpointLabels {
  readonly from: MessageKey
  readonly to: MessageKey
  readonly fromDay: MessageKey
  readonly toDay: MessageKey
  /** Landing on a day before the one you left on, said in this mode's words. */
  readonly dayOrder: MessageKey
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
 * The date is written the reader's way rather than `2026-10-09`, through the
 * shared formatter the timeline already uses - it answers from a CLDR table
 * instead of asking the platform for `month: 'short'`, which workerd and WebKit
 * resolve from different ICU builds (`12-verification-protocol.md` 7.2). A date
 * it cannot read is printed as stored, because a label is better than a gap.
 *
 * The parameter is structural rather than the loader's own type, for the reason
 * `types.ts` gives: these components depend on the data they need, not on one
 * screen's wire format.
 */
export function dayLabel(
  day: {
    readonly dayNumber: number
    readonly date: string | null
    readonly title: string | null
  },
  t: Translate,
  locale: Locale,
): string {
  const parts = [t('modules.transports.dayNumber', { n: day.dayNumber })]
  if (day.title !== null && day.title.length > 0) {
    parts.push(day.title)
  } else if (day.date !== null) {
    parts.push(formatWeekday(day.date, locale) ?? day.date)
  }
  return parts.join(' · ')
}

/** What the two days are called for everything that is not a hire car. */
const DEPARTS_AND_ARRIVES = {
  fromDay: 'modules.transports.end.departureDay',
  toDay: 'modules.transports.end.arrivalDay',
  dayOrder: 'modules.transports.error.arrivalDayBeforeDeparture',
} as const satisfies Pick<EndpointLabels, 'fromDay' | 'toDay' | 'dayOrder'>

/**
 * What each end of a transport is called, per mode - the endpoint legend, the
 * day beside it, and the sentence for a chain of days out of order, from one
 * function.
 *
 * A hire car is the case worth naming: nobody says a car departs and arrives,
 * they say it is picked up and returned. All five keys are decided here together
 * so the legend over the endpoint, the label over its day select and the error
 * under them cannot drift apart. The day-order message is a whole sentence per
 * family rather than a template built from the two labels, because a language
 * that inflects them cannot be served by lowercasing an English noun.
 */
export function endpointLabels(mode: string): EndpointLabels {
  if (mode === 'car') {
    return {
      from: 'modules.transports.end.pickUp',
      to: 'modules.transports.end.dropOff',
      fromDay: 'modules.transports.end.pickUpDay',
      toDay: 'modules.transports.end.returnDay',
      dayOrder: 'modules.transports.error.returnDayBeforePickUp',
    }
  }
  if (mode === 'flight') {
    return {
      from: 'modules.transports.end.fromAirport',
      to: 'modules.transports.end.toAirport',
      ...DEPARTS_AND_ARRIVES,
    }
  }
  if (mode === 'ferry') {
    return {
      from: 'modules.transports.end.fromPort',
      to: 'modules.transports.end.toPort',
      ...DEPARTS_AND_ARRIVES,
    }
  }
  if (mode === 'train' || mode === 'metro' || mode === 'tram') {
    return {
      from: 'modules.transports.end.fromStation',
      to: 'modules.transports.end.toStation',
      ...DEPARTS_AND_ARRIVES,
    }
  }
  return {
    from: 'modules.transports.end.from',
    to: 'modules.transports.end.to',
    ...DEPARTS_AND_ARRIVES,
  }
}

/* ------------------------------------------------------------------- draft */

export interface TransportDraft {
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

export function emptyTransportDraft(currency: string): TransportDraft {
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
 * The name the transport gets when the traveller has not typed one: "SAS from LHR to
 * HND", "Train from Tokyo to Kyoto". Suggested, never forced — the field stays
 * editable and this only fills a blank.
 */
export interface TransportTitleSuggestion {
  readonly key: MessageKey
  readonly params: Readonly<Record<string, string>>
  /** The mode label to resolve into `operator`, when no carrier was typed. */
  readonly operatorKey: MessageKey | null
}

export function suggestTransportTitle(
  draft: TransportDraft,
): TransportTitleSuggestion | null {
  const from =
    draft.departureCode.trim() !== ''
      ? draft.departureCode.trim().toUpperCase()
      : draft.departureName.trim()
  const to =
    draft.arrivalCode.trim() !== ''
      ? draft.arrivalCode.trim().toUpperCase()
      : draft.arrivalName.trim()
  const carrier = draft.carrier.trim()
  // A typed carrier is the operator as-is; otherwise the mode names itself and
  // the caller resolves the key, because only the caller has a provider.
  const operatorKey = carrier === '' ? modeLabel(draft.mode) : null
  const operator: Record<string, string> =
    carrier === '' ? {} : { operator: carrier }

  if (from === '' && to === '') {
    return null
  }
  if (from === '') {
    return {
      key: 'modules.transports.title.to',
      params: { ...operator, to },
      operatorKey,
    }
  }
  if (to === '') {
    return {
      key: 'modules.transports.title.from',
      params: { ...operator, from },
      operatorKey,
    }
  }
  return {
    key: 'modules.transports.title.fromTo',
    params: { ...operator, from, to },
    operatorKey,
  }
}

/* -------------------------------------------------------------- validation */

export type TransportErrors = Partial<
  Record<keyof TransportDraft | 'form', MessageKey>
>

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

export function validateTransportDraft(
  draft: TransportDraft,
  days: ReadonlyArray<DayChoice> = [],
): TransportErrors {
  const errors: TransportErrors = {}

  if (draft.title.trim().length === 0) {
    errors.title = 'modules.transports.error.titleEmpty'
  } else if (draft.title.trim().length > 160) {
    errors.title = 'modules.error.titleLong'
  }

  for (const field of ['departureDate', 'arrivalDate'] as const) {
    const value = draft[field].trim()
    if (value !== '' && !DATE_PATTERN.test(value)) {
      errors[field] = 'modules.transports.error.date'
    }
  }
  for (const field of ['departureTime', 'arrivalTime'] as const) {
    const value = draft[field].trim()
    if (value !== '' && !TIME_PATTERN.test(value)) {
      errors[field] = 'modules.transports.error.time'
    }
  }

  if (draft.departureTime.trim() !== '' && draft.departureDate.trim() === '') {
    errors.departureDate = 'modules.transports.error.departureNeedsDate'
  }
  if (draft.arrivalTime.trim() !== '' && draft.arrivalDate.trim() === '') {
    errors.arrivalDate = 'modules.transports.error.arrivalNeedsDate'
  }

  const ordering = transportTimingError({
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
      errors[field] = 'modules.transports.error.code'
    }
  }

  if (draft.distanceKm.trim() !== '') {
    const value = Number.parseFloat(draft.distanceKm.trim().replace(',', '.'))
    if (!Number.isFinite(value) || value < 0 || value > 100_000) {
      errors.distanceKm = 'modules.transports.error.distance'
    }
  }

  if (draft.price.trim() !== '' && !/^[\d.,\s]+$/u.test(draft.price.trim())) {
    errors.price = 'modules.error.price'
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
  draft: TransportDraft,
  days: ReadonlyArray<DayChoice>,
): MessageKey | null {
  const from = days.find((day) => day.id === draft.departureDayId)
  const to = days.find((day) => day.id === draft.arrivalDayId)
  if (
    from === undefined ||
    to === undefined ||
    to.dayNumber >= from.dayNumber
  ) {
    return null
  }
  return endpointLabels(draft.mode).dayOrder
}

export function hasTransportErrors(errors: TransportErrors): boolean {
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

/**
 * A price as typed → whole minor units. `''` and anything not above zero becomes `0`.
 *
 * The comma is accepted because half of the twenty-three locales this form is read
 * in write the decimal separator that way, and a traveller typing `12,50` means
 * twelve fifty and not twelve.
 *
 * `0` is the same statement `distanceMetres` makes with it — "not recorded" — which
 * is why a negative or unparseable amount lands on it rather than raising: the
 * field is optional, and a price nobody could read is a price nobody gave.
 */
export function priceToMinor(value: string): number {
  const parsed = Number.parseFloat(value.trim().replace(',', '.') || '0')
  const minor = Math.round(parsed * 100)
  return Number.isFinite(minor) && minor > 0 ? minor : 0
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
 * The twelve fields a journey with no legs of its own already is: two named
 * ends, the one set of times between them, and the ticket that carries it.
 *
 * A shape rather than `TransportData`, because two different things hold those
 * fields under those names and {@link flatChain} has to read both - the stored
 * transport, and the draft being typed over it. The record's are
 * `string | null` and the draft's are `string`; the wider type takes either,
 * and `text()` flattens the difference on the way in.
 */
export interface FlatEndpoints {
  readonly departureName: string | null
  readonly departureCode: string | null
  readonly departureDate: string | null
  readonly departureTime: string | null
  readonly departureDayId: string | null
  readonly arrivalName: string | null
  readonly arrivalCode: string | null
  readonly arrivalDate: string | null
  readonly arrivalTime: string | null
  readonly arrivalDayId: string | null
  readonly serviceNumber: string | null
  readonly seat: string | null
}

/**
 * The one-leg chain a transport's own columns already describe, **unbroken**.
 *
 * The compatibility claim of this whole stage, and the reason the migration
 * backfills nothing: an old journey opens on exactly the two endpoints and the
 * one set of times it was recorded with, and saves back as no rows at all.
 *
 * It is also what "put it back as one journey" produces, which is the same
 * statement read in the other direction — a chain the traveller has collapsed is
 * a journey whose endpoints are the record's again.
 */
export function flatChain(endpoints: FlatEndpoints): ChainDraft {
  return {
    broken: false,
    stations: [
      {
        ...emptyStation(),
        name: text(endpoints.departureName),
        code: text(endpoints.departureCode),
      },
      {
        ...emptyStation(),
        name: text(endpoints.arrivalName),
        code: text(endpoints.arrivalCode),
      },
    ],
    legs: [
      {
        ...emptyChainLeg(),
        serviceNumber: text(endpoints.serviceNumber),
        seat: text(endpoints.seat),
        departureDayId: text(endpoints.departureDayId),
        departureDate: text(endpoints.departureDate),
        departureTime: text(endpoints.departureTime),
        arrivalDayId: text(endpoints.arrivalDayId),
        arrivalDate: text(endpoints.arrivalDate),
        arrivalTime: text(endpoints.arrivalTime),
      },
    ],
  }
}

/**
 * The chain to edit for a transport: its own rows, or {@link flatChain} when it
 * has none.
 *
 * Keys come from the row ids rather than from the session counter, so a station
 * keeps its identity across a re-read and React does not remount a field the
 * traveller is typing into.
 */
export function chainFromTransport(transport: TransportData): ChainDraft {
  const rows = [...transport.legs].sort(
    (left, right) => left.position - right.position,
  )
  const first = rows.at(0)
  if (first === undefined) {
    return flatChain(transport)
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

/**
 * Breaks a journey into legs, seeded from the endpoints on screen.
 *
 * On screen, and not on the record - which is the whole of what this argument
 * is for. A transport being added has no record to read: seeded from one, the
 * first press would open a blank editor, and the save after it would write
 * those blanks over the two stations the traveller had just typed. A transport
 * being edited has a record that stopped being current the moment anything was
 * typed into the flat form above.
 *
 * A chain that is already broken holds stations and legs nothing else holds, so
 * it is its own truth and comes back untouched.
 */
export function breakIntoLegs(
  chain: ChainDraft,
  endpoints: FlatEndpoints,
): ChainDraft {
  return chain.broken ? chain : { ...flatChain(endpoints), broken: true }
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
 * Applies an edit to one station, found by its own key rather than by where it sits.
 *
 * For edits that resolve *later* — today that is the code lookup in `chain-editor.tsx`, which is a
 * server round trip started on blur. By the time it answers, the traveller may have typed a name,
 * picked a timezone or inserted a stop, so neither the station the lookup started from nor its
 * index is still a safe address: rebuilding the chain from the pre-await snapshot would put every
 * one of those edits back the way it was, and an index would land the answer on somebody else's
 * stop. The key is local to the editing session and never moves, which is what makes it the one
 * stable handle a late answer can hold.
 *
 * A key that names no station — the stop was removed while the answer was in the air — changes
 * nothing. That is the right outcome and not a silent failure: the row the answer was about is
 * gone.
 */
export function updateStationByKey(
  chain: ChainDraft,
  key: string,
  update: (current: StationDraft) => StationDraft,
): ChainDraft {
  if (!chain.stations.some((station) => station.key === key)) {
    return chain
  }
  return {
    ...chain,
    stations: chain.stations.map((station) =>
      station.key === key ? update(station) : station,
    ),
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
export function stationLabel(
  station: StationDraft,
  index: number,
  t: Translate,
): string {
  const name = station.name.trim()
  if (name !== '') return name
  const code = station.code.trim()
  return code === ''
    ? t('modules.transports.chain.stopNumber', { n: index + 1 })
    : code.toUpperCase()
}

/* --------------------------------------------------------- chain validation */

export interface StationErrors {
  readonly name?: MessageKey
  readonly code?: MessageKey
  readonly timezone?: MessageKey
}

export interface ChainLegErrors {
  readonly departureDate?: MessageKey
  readonly departureTime?: MessageKey
  readonly arrivalDate?: MessageKey
  readonly arrivalTime?: MessageKey
  readonly arrivalDayId?: MessageKey
}

export interface ChainErrors {
  readonly stations?: ReadonlyArray<StationErrors | undefined>
  readonly legs?: ReadonlyArray<ChainLegErrors | undefined>
  readonly form?: MessageKey
}

/**
 * The same error record, still being filled in.
 *
 * Every error type here is read-only, because nothing downstream of validation
 * may edit one. The two functions that *build* them need the fields writable for
 * the few lines it takes, and taking the modifier off the declared type is what
 * keeps the field list stated once instead of copied into a local literal that
 * can silently fall behind it.
 */
type Building<TErrors> = { -readonly [K in keyof TErrors]: TErrors[K] }

export function hasChainErrors(errors: ChainErrors): boolean {
  if (errors.form !== undefined) return true
  const rows = [...(errors.stations ?? []), ...(errors.legs ?? [])]
  return rows.some((row) => row !== undefined && Object.keys(row).length > 0)
}

function stationErrors(station: StationDraft): StationErrors {
  const errors: Building<StationErrors> = {}
  if (station.name.trim() === '') {
    errors.name = 'modules.transports.chain.error.stopName'
  } else if (station.name.trim().length > 200) {
    errors.name = 'modules.transports.chain.error.stopNameLong'
  }
  const code = station.code.trim()
  if (code !== '' && !/^[A-Za-z0-9]{2,8}$/u.test(code)) {
    errors.code = 'modules.transports.error.code'
  }
  const zone = station.timezone.trim()
  if (zone !== '' && !isKnownTimeZone(zone)) {
    errors.timezone = 'modules.transports.chain.error.timezone'
  }
  return errors
}

function chainLegErrors(
  leg: ChainLegDraft,
  mode: string,
  days: ReadonlyArray<DayChoice>,
): ChainLegErrors {
  const errors: Building<ChainLegErrors> = {}

  for (const field of ['departureDate', 'arrivalDate'] as const) {
    const value = leg[field].trim()
    if (value !== '' && !DATE_PATTERN.test(value)) {
      errors[field] = 'modules.transports.error.date'
    }
  }
  for (const field of ['departureTime', 'arrivalTime'] as const) {
    const value = leg[field].trim()
    if (value !== '' && !TIME_PATTERN.test(value)) {
      errors[field] = 'modules.transports.error.time'
    }
  }

  const ordering = transportTimingError({
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
    errors.arrivalDayId = endpointLabels(mode).dayOrder
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
    ? { ...errors, form: 'modules.transports.chain.error.tooManyLegs' }
    : errors
}

/**
 * The record fields a broken chain owns, and which the flat form therefore no
 * longer asks about.
 *
 * `TransportDialog` writes all ten from the outer stations of the chain, and hides the
 * pair of endpoint fieldsets that used to hold them. An error raised against one
 * of those hidden fields is neither visible to the traveller nor theirs to
 * repair, so it must not be what stops the save — a disabled button with no
 * error on screen is the one failure a form can offer that has no way out.
 */
const CHAIN_OWNED_FIELDS = [
  'departureName',
  'departureCode',
  'departureDate',
  'departureTime',
  'departureDayId',
  'arrivalName',
  'arrivalCode',
  'arrivalDate',
  'arrivalTime',
  'arrivalDayId',
] as const satisfies ReadonlyArray<keyof TransportDraft>

/** A record field written from the chain rather than typed into the flat form. */
export type ChainOwnedField = (typeof CHAIN_OWNED_FIELDS)[number]

/**
 * The draft errors that still stand between a traveller and a save.
 *
 * Everything, until the chain owns the endpoints — {@link validateChain} then
 * states the rules over the rows the traveller can actually see and edit, and
 * the repository re-runs every one of them over what is sent.
 */
export function blockingLegErrors(
  errors: TransportErrors,
  chain: ChainDraft,
): TransportErrors {
  if (!chain.broken) {
    return errors
  }
  const kept: TransportErrors = { ...errors }
  for (const field of CHAIN_OWNED_FIELDS) {
    delete kept[field]
  }
  return kept
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

/* ------------------------------------------------------------- record wire */

/**
 * The transport record as the two writers take it.
 *
 * Declared structurally rather than imported from `#/server/fns/transports`, for
 * the same reason {@link StationLookup} gives: this module states the fields it
 * fills in, and does not take a dependency on one endpoint's wire format. The
 * binding to the real contract is asserted where an assertion belongs — the unit
 * test parses this through `transportInputSchema` and `transportUpdateSchema`, so
 * a field this builder sets that the schema would silently strip fails there
 * rather than in a browser.
 */
export interface TransportPayload {
  readonly tripId: string
  readonly mode: TransportMode
  readonly status: TransportStatus
  readonly title: string
  readonly carrier: string
  readonly serviceNumber: string
  readonly bookingCode: string
  readonly seat: string
  readonly departureName: string
  readonly departureCode: string
  readonly departureDate: string
  readonly departureTime: string
  readonly departureDayId: string
  readonly arrivalName: string
  readonly arrivalCode: string
  readonly arrivalDate: string
  readonly arrivalTime: string
  readonly arrivalDayId: string
  readonly distanceMetres: number
  readonly priceMinor: number
  readonly currency: string
  readonly notes: string
}

/**
 * The record's own endpoints and days, which a chain owns once there is one.
 *
 * The repository rewrites the endpoints from the outer stations in the same batch
 * that writes the legs, so this is not the source of truth — it is what keeps the
 * record correct for the moment between the two writes, and for a save whose
 * second half never lands. The two day references have no such second writer, so
 * this is the only place they are decided.
 */
function recordEndpoints(
  draft: TransportDraft,
  chain: ChainDraft,
): Pick<TransportDraft, ChainOwnedField> {
  const first = chain.stations.at(0)
  const last = chain.stations.at(-1)
  const firstLeg = chain.legs.at(0)
  const lastLeg = chain.legs.at(-1)
  if (
    !chain.broken ||
    first === undefined ||
    last === undefined ||
    firstLeg === undefined ||
    lastLeg === undefined
  ) {
    return {
      departureName: draft.departureName,
      departureCode: draft.departureCode,
      departureDate: draft.departureDate,
      departureTime: draft.departureTime,
      departureDayId: draft.departureDayId,
      arrivalName: draft.arrivalName,
      arrivalCode: draft.arrivalCode,
      arrivalDate: draft.arrivalDate,
      arrivalTime: draft.arrivalTime,
      arrivalDayId: draft.arrivalDayId,
    }
  }
  return {
    departureName: first.name.trim(),
    departureCode: first.code.trim(),
    departureDate: firstLeg.departureDate,
    departureTime: firstLeg.departureTime,
    departureDayId: firstLeg.departureDayId,
    arrivalName: last.name.trim(),
    arrivalCode: last.code.trim(),
    arrivalDate: lastLeg.arrivalDate,
    arrivalTime: lastLeg.arrivalTime,
    arrivalDayId: lastLeg.arrivalDayId,
  }
}

/**
 * The draft as the record writers take it — the whole mapping, in one place.
 *
 * A pure function and not a closure over the dialog's state, because the one
 * thing that can go wrong here is a field going missing on the way to the wire,
 * and a mapping that only exists inside a submit handler can only be checked by
 * rendering the dialog and pressing the button. Here it is a call.
 *
 * `create` and `update` take the same shape; the update adds nothing to it but
 * the id of the row being rewritten.
 */
export function transportPayload(
  draft: TransportDraft,
  chain: ChainDraft,
  tripId: string,
): TransportPayload {
  const priceMinor = priceToMinor(draft.price)
  return {
    tripId,
    mode: draft.mode,
    status: draft.status,
    title: draft.title.trim(),
    carrier: draft.carrier,
    serviceNumber: draft.serviceNumber,
    bookingCode: draft.bookingCode,
    seat: draft.seat,
    ...recordEndpoints(draft, chain),
    distanceMetres: kilometresToMetres(draft.distanceKm),
    priceMinor,
    /* An amount nobody recorded has no currency to be in. */
    currency: priceMinor > 0 ? draft.currency : '',
    notes: draft.notes,
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
 * A lookup answer applied to the station as it stands **now**, or that station untouched.
 *
 * The code field's lookup runs on blur, and two blurs are two calls with no ordering between them,
 * so an earlier one can land last. Type `NRT`, tab out, correct it to `HND`, tab out: if `HND`
 * answers first it fills the then-blank name, zone and coordinates, and the late `NRT` answer then
 * meets {@link fillStationFromCode}'s non-blank guards on every field except the one they do not
 * cover. That field is the code itself, which is canonicalised unconditionally — so the row is
 * left reading `NRT` at Haneda's coordinates, and nothing on screen says so.
 *
 * The guard is a comparison rather than a sequence token because of what is stale here. An answer
 * that no longer matches what the field asks is worthless whatever its order; an edit made while
 * it was in the air is not, and has to survive. So `station` is the current draft rather than the
 * one the lookup was started from, and the answer is kept only while the two still agree.
 */
export function applyTypedCodeMatch(
  station: StationDraft,
  code: string,
  match: StationLookup,
): StationDraft {
  return station.code.trim().toUpperCase() === code.trim().toUpperCase()
    ? fillStationFromCode(station, match)
    : station
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
