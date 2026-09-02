/**
 * The shape of the leg dialog, and the rules it enforces before it submits.
 *
 * A leg is the one row on this trip that a traveller reads back to a stranger at a
 * desk — a booking reference, a seat, a service number — so the form's job is to
 * keep those exact, and to refuse the two things that make a leg nonsense: no name,
 * and an arrival before its departure.
 */
import { legTimingError } from './connections'

import { isTransportMode, modeLabel } from './vocabulary'

import type { MessageKey } from '#/lib/i18n'
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

/** What each end of a leg is called, per mode. */
export function endpointLabels(mode: string): {
  readonly from: MessageKey
  readonly to: MessageKey
} {
  if (mode === 'flight') {
    return {
      from: 'modules.transports.end.fromAirport',
      to: 'modules.transports.end.toAirport',
    }
  }
  if (mode === 'ferry') {
    return {
      from: 'modules.transports.end.fromPort',
      to: 'modules.transports.end.toPort',
    }
  }
  if (mode === 'train' || mode === 'metro' || mode === 'tram') {
    return {
      from: 'modules.transports.end.fromStation',
      to: 'modules.transports.end.toStation',
    }
  }
  return {
    from: 'modules.transports.end.from',
    to: 'modules.transports.end.to',
  }
}

/* ------------------------------------------------------------------- draft */

export interface LegDraft {
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
/**
 * A title the traveller can accept with one tap.
 *
 * The result is written to the row, so it is composed in the traveller's
 * language rather than in English and translated afterwards: this returns the
 * message and its parts, and the dialog resolves them. `operator` is either the
 * carrier they typed — never translated — or the mode's own label, which is.
 */
export interface LegTitleSuggestion {
  readonly key: MessageKey
  readonly params: Readonly<Record<string, string>>
  /** The mode label to resolve into `operator`, when no carrier was typed. */
  readonly operatorKey: MessageKey | null
}

export function suggestLegTitle(draft: LegDraft): LegTitleSuggestion | null {
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

export type LegErrors = Partial<Record<keyof LegDraft | 'form', MessageKey>>

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/u
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

export function validateLegDraft(draft: LegDraft): LegErrors {
  const errors: LegErrors = {}

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

  return errors
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
