/**
 * The shape of the leg dialog, and the rules it enforces before it submits.
 *
 * A leg is the one row on this trip that a traveller reads back to a stranger at a
 * desk — a booking reference, a seat, a service number — so the form's job is to
 * keep those exact, and to refuse the two things that make a leg nonsense: no name,
 * and an arrival before its departure.
 */
import { formatWeekday } from '#/lib/format'
import { legTimingError } from './connections'

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
