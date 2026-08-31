/**
 * The shape of the booking dialog, and the rules it enforces before it submits.
 *
 * A booking is one row with a type discriminator, so the *form* is what makes a
 * flight feel like a flight and a restaurant table feel like a table: each type
 * declares which fields it shows, what they are called, and which of them it
 * refuses to submit without. Keeping that here — pure, no React — is what lets the
 * rules be tested rather than clicked through.
 */

import { formatMoneyMinor } from '#/lib/format'

export const BOOKING_TYPES = [
  'accommodation',
  'restaurant',
  'activity',
  'tour',
  'ticket',
  'transport',
  'other',
] as const

export type BookingType = (typeof BOOKING_TYPES)[number]

export const BOOKING_STATUSES = [
  'none',
  'pending',
  'confirmed',
  'completed',
  'cancelled',
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]

export function isBookingType(value: string): value is BookingType {
  return (BOOKING_TYPES as ReadonlyArray<string>).includes(value)
}

export function isBookingStatus(value: string): value is BookingStatus {
  return (BOOKING_STATUSES as ReadonlyArray<string>).includes(value)
}

/** Exactly what the controls hold: strings, because that is what inputs give. */
export interface BookingDraft {
  readonly type: BookingType
  readonly status: BookingStatus
  readonly title: string
  readonly provider: string
  readonly location: string
  readonly confirmationNumber: string
  readonly url: string
  readonly startDate: string
  readonly startTime: string
  readonly endDate: string
  readonly endTime: string
  readonly guests: string
  readonly price: string
  readonly currency: string
  readonly dayId: string
  /** The stop on a day this booking is for — `''` for none. */
  readonly assignmentId: string
  readonly notes: string
}

export function emptyBookingDraft(currency: string): BookingDraft {
  return {
    type: 'accommodation',
    status: 'pending',
    title: '',
    provider: '',
    location: '',
    confirmationNumber: '',
    url: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    guests: '',
    price: '',
    currency,
    dayId: '',
    assignmentId: '',
    notes: '',
  }
}

/* ------------------------------------------------------- per-type field sets */

export type BookingField =
  | 'provider'
  | 'location'
  | 'confirmationNumber'
  | 'url'
  | 'startDate'
  | 'startTime'
  | 'endDate'
  | 'endTime'
  | 'guests'
  | 'price'
  | 'assignmentId'

export interface BookingTypeShape {
  readonly label: string
  /** What the "provider" field is called for this type. */
  readonly providerLabel: string
  readonly providerPlaceholder: string
  /**
   * Example for the name field. Per type, and never the same string as
   * `providerPlaceholder`: the two fields sit next to each other, so one
   * example repeated across both reads as a bug and teaches nothing about
   * which half of the booking goes where.
   */
  readonly titlePlaceholder: string
  /** What the "location" field is called for this type. */
  readonly locationLabel: string
  /** What the two date fields are called. */
  readonly startLabel: string
  readonly endLabel: string
  readonly fields: ReadonlyArray<BookingField>
  /** Fields this type will not submit without, beyond the title. */
  readonly required: ReadonlyArray<BookingField>
  /** One line under the type picker, so the dialog says what it is for. */
  readonly hint: string
}

const SHAPES: { readonly [K in BookingType]: BookingTypeShape } = {
  accommodation: {
    label: 'Stay',
    providerLabel: 'Hotel or host',
    providerPlaceholder: 'Booking.com',
    titlePlaceholder: 'Hotel Gracery Shinjuku · 2 twin rooms',
    locationLabel: 'Address',
    startLabel: 'Check in',
    endLabel: 'Check out',
    fields: [
      'provider',
      'location',
      'startDate',
      'startTime',
      'endDate',
      'endTime',
      'guests',
      'price',
      'confirmationNumber',
      'url',
    ],
    required: ['startDate'],
    hint: 'A hotel, a ryokan, an apartment — anywhere you sleep.',
  },
  restaurant: {
    label: 'Table',
    providerLabel: 'Restaurant',
    providerPlaceholder: 'Den',
    titlePlaceholder: 'Dinner at Den',
    locationLabel: 'Where',
    startLabel: 'Date',
    endLabel: 'Until',
    fields: [
      'provider',
      'location',
      'startDate',
      'startTime',
      'endTime',
      'guests',
      'price',
      'confirmationNumber',
      'url',
      'assignmentId',
    ],
    required: ['startDate', 'startTime'],
    hint: 'A booked table. The time is the part you will be held to.',
  },
  activity: {
    label: 'Activity',
    providerLabel: 'Operator',
    providerPlaceholder: 'teamLab',
    titlePlaceholder: 'teamLab Planets, 4 tickets',
    locationLabel: 'Where',
    startLabel: 'Date',
    endLabel: 'Ends',
    fields: [
      'provider',
      'location',
      'startDate',
      'startTime',
      'endDate',
      'endTime',
      'guests',
      'price',
      'confirmationNumber',
      'url',
      'assignmentId',
    ],
    required: ['startDate'],
    hint: 'A class, a bath house, a booked experience.',
  },
  tour: {
    label: 'Tour',
    providerLabel: 'Operator',
    providerPlaceholder: 'Kyoto Free Walking Tour',
    titlePlaceholder: 'Arashiyama bamboo grove walk',
    locationLabel: 'Meeting point',
    startLabel: 'Date',
    endLabel: 'Ends',
    fields: [
      'provider',
      'location',
      'startDate',
      'startTime',
      'endDate',
      'endTime',
      'guests',
      'price',
      'confirmationNumber',
      'url',
      'assignmentId',
    ],
    required: ['startDate', 'startTime'],
    hint: 'Somewhere to be, at a time, with a guide waiting.',
  },
  ticket: {
    label: 'Ticket',
    providerLabel: 'Issued by',
    providerPlaceholder: 'Ghibli Museum',
    titlePlaceholder: 'Ghibli Museum, 10:00 entry',
    locationLabel: 'Venue',
    startLabel: 'Valid on',
    endLabel: 'Until',
    fields: [
      'provider',
      'location',
      'startDate',
      'startTime',
      'guests',
      'price',
      'confirmationNumber',
      'url',
      'assignmentId',
    ],
    required: ['startDate'],
    hint: 'A timed entry, a museum pass, a match. Keep the code to hand.',
  },
  transport: {
    label: 'Travel',
    providerLabel: 'Carrier',
    providerPlaceholder: 'JR Central',
    titlePlaceholder: 'Nozomi 21 to Kyoto',
    locationLabel: 'From and to',
    startLabel: 'Departs',
    endLabel: 'Arrives',
    fields: [
      'provider',
      'location',
      'startDate',
      'startTime',
      'endDate',
      'endTime',
      'price',
      'confirmationNumber',
      'url',
      'assignmentId',
    ],
    required: ['startDate'],
    hint: 'A booked seat. Full legs with carriers and codes belong in Transports.',
  },
  other: {
    label: 'Other',
    providerLabel: 'Provider',
    providerPlaceholder: 'Who is holding this for you',
    titlePlaceholder: 'What you have booked',
    locationLabel: 'Where',
    startLabel: 'Date',
    endLabel: 'Until',
    fields: [
      'provider',
      'location',
      'startDate',
      'startTime',
      'endDate',
      'endTime',
      'price',
      'confirmationNumber',
      'url',
      'assignmentId',
    ],
    required: [],
    hint: 'Anything held in your name that does not fit the others.',
  },
}

export function bookingShape(type: BookingType): BookingTypeShape {
  return SHAPES[type]
}

export function bookingTypeLabel(type: string): string {
  return isBookingType(type) ? SHAPES[type].label : 'Booking'
}

export function showsField(type: BookingType, field: BookingField): boolean {
  return SHAPES[type].fields.includes(field)
}

/* ------------------------------------------------------------------- money */

/**
 * How many minor units the currency has: two for EUR, none for JPY. Asked of
 * `Intl` rather than hardcoded, so a zero-decimal currency is never divided by a
 * hundred it does not use.
 */
export function minorUnitDigits(currency: string): number {
  const code = /^[A-Za-z]{3}$/.test(currency.trim())
    ? currency.trim().toUpperCase()
    : 'EUR'
  try {
    return (
      new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: code,
      }).resolvedOptions().minimumFractionDigits ?? 2
    )
  } catch {
    return 2
  }
}

/**
 * Reduces however a person wrote an amount to plain digits and one dot.
 *
 * `1.250,50`, `1,250.50` and `1 250,50` all mean the same thing, and a traveller
 * pasting a figure off a confirmation email will use whichever their locale taught
 * them. When both separators appear the last one is the decimal point and the
 * other is grouping — unambiguous. A lone separator is not, so the rule follows
 * the locale the whole product is typeset in (en-GB): a dot is always the decimal
 * point, and a comma is grouping when exactly three digits follow it and the
 * decimal point otherwise. `19.99` and `1,250` therefore both mean what an
 * English-reading traveller expects, and `12,50` still reads as twelve fifty.
 */
function normaliseAmount(text: string): string | null {
  const stripped = text.replaceAll(/[\s\u00a0\u202f'\u2019]/gu, '')
  if (!/^[\d.,]+$/u.test(stripped)) {
    return null
  }

  const lastComma = stripped.lastIndexOf(',')
  const lastDot = stripped.lastIndexOf('.')

  if (lastComma !== -1 && lastDot !== -1) {
    const decimal = lastComma > lastDot ? ',' : '.'
    const grouping = decimal === ',' ? '.' : ','
    return stripped.replaceAll(grouping, '').replace(decimal, '.')
  }

  if (lastComma === -1 && lastDot === -1) {
    return stripped
  }
  if (lastDot !== -1) {
    // A lone dot is the decimal point, however many digits follow it.
    return (stripped.match(/\./gu) ?? []).length > 1 ? null : stripped
  }

  const commas = (stripped.match(/,/gu) ?? []).length
  const tail = stripped.length - lastComma - 1
  if (commas === 1 && tail > 0 && tail <= 2) {
    return stripped.replace(',', '.')
  }
  return stripped.replaceAll(',', '')
}

/**
 * `"1 250,50"` in a two-decimal currency becomes `125050`.
 *
 * Returns `null` for text that is not an amount at all, and `0` for an empty
 * field — "not recorded" and "free" are the same thing to the column, and the
 * caller decides which it means.
 */
export function parseMoneyToMinor(
  text: string,
  currency: string,
): number | null {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return 0
  }
  const normalised = normaliseAmount(trimmed)
  if (normalised === null || normalised.length === 0 || normalised === '.') {
    return null
  }
  const value = Number.parseFloat(normalised)
  if (!Number.isFinite(value) || value < 0) {
    return null
  }
  return Math.round(value * 10 ** minorUnitDigits(currency))
}

/** The inverse, for pre-filling the edit dialog. `0` becomes an empty field. */
export function formatMinorForInput(
  minor: number | null,
  currency: string,
): string {
  if (minor === null || minor === 0) {
    return ''
  }
  const digits = minorUnitDigits(currency)
  return (minor / 10 ** digits).toFixed(digits)
}

/* --------------------------------------------------------------- the stop */

/** The stop a picker hands back: the row itself, the day it sits on, and that day's date. */
export interface BookingStopChoice {
  readonly assignmentId: string
  readonly dayId: string
  /** `null` until the trip is dated — a day of an undated trip has no calendar date. */
  readonly date: string | null
}

/**
 * Applies a stop choice to the draft.
 *
 * Two things follow from a stop and neither is guessed. The **day** is the stop's own, because a
 * booking attached to a stop on day five that claims day three is two answers to one question. The
 * **date** is filled only when the field is empty: a date the traveller typed is theirs, and a
 * picker that overwrites it teaches them not to use the picker.
 *
 * Clearing the stop clears only the stop. Whatever it filled in stays, because by then it is the
 * traveller's booking rather than the picker's suggestion.
 */
export function chooseStop(
  draft: BookingDraft,
  stop: BookingStopChoice | null,
): BookingDraft {
  if (stop === null) {
    return { ...draft, assignmentId: '' }
  }
  return {
    ...draft,
    assignmentId: stop.assignmentId,
    dayId: stop.dayId,
    startDate:
      draft.startDate === '' && stop.date !== null
        ? stop.date
        : draft.startDate,
  }
}

/* ------------------------------------------------------------ the ledger notice */

/** What the trip's ledger will do about this booking, in the reader's own words. */
export interface LedgerNotice {
  /** `warning` is the one branch where the reader has to do something for the line to exist. */
  readonly tone: 'info' | 'warning'
  readonly message: string
}

/** Everything outside the draft the notice needs to know. */
export interface LedgerNoticeContext {
  /** Whether this booking already has a line in the trip's costs. */
  readonly linked: boolean
  /** The date of the day this booking is pinned to, if any. */
  readonly dayDate: string | null
  /** The trip's own start date — the last fallback before "no date anywhere". */
  readonly tripStartDate: string | null
}

/**
 * The sentence under the price, stating the effect *before* the save.
 *
 * A side effect the reader discovers afterwards is a side effect they never agreed to, so each of
 * the four branches of the server's own rule has a sentence here and the four sets match one for
 * one. `null` is the fifth case and the only silent one: no price, no line, nothing to say.
 *
 * The date chain is the server's: the booking's own date, then the day it is pinned to, then the
 * trip's start. When all three are missing the cost is not guessed onto a date — a wrong date on a
 * money row is worse than no row — and the notice says what to do about it.
 */
export function ledgerNotice(
  draft: BookingDraft,
  context: LedgerNoticeContext,
): LedgerNotice | null {
  const minor = parseMoneyToMinor(draft.price, draft.currency)
  if (minor === null) {
    // Unreadable is the price field's own error to report; the notice stays quiet rather than
    // guessing what the figure was going to be.
    return null
  }

  if (minor === 0) {
    return context.linked
      ? {
          tone: 'info',
          message:
            'This booking’s cost line will stay in the trip’s costs, no longer linked to this booking.',
        }
      : null
  }

  const money = formatMoneyMinor(minor, draft.currency)
  if (context.linked) {
    return {
      tone: 'info',
      message: `This booking’s cost line will be updated to ${money}.`,
    }
  }

  const dated =
    draft.startDate !== '' ||
    context.dayDate !== null ||
    context.tripStartDate !== null
  if (!dated) {
    return {
      tone: 'warning',
      message:
        'Give this booking a date and its cost will be added to the trip’s costs.',
    }
  }

  return {
    tone: 'info',
    message: `A ${money} line will be added to this trip’s costs.`,
  }
}

/* -------------------------------------------------------------- validation */

export type BookingErrors = Partial<Record<keyof BookingDraft | 'form', string>>

const FIELD_NAMES: { readonly [K in BookingField]: string } = {
  provider: 'provider',
  location: 'location',
  confirmationNumber: 'confirmation number',
  url: 'link',
  startDate: 'date',
  startTime: 'time',
  endDate: 'end date',
  endTime: 'end time',
  guests: 'guests',
  price: 'price',
  assignmentId: 'stop',
}

/**
 * Every reason this draft cannot be saved, keyed by the field that owns it.
 *
 * The server checks the same things again — this exists so a traveller is told
 * before the round trip, not so the server can trust the client.
 */
/** What the screen knows that the draft does not. */
export interface BookingDraftContext {
  /**
   * Every stop the trip has, when the caller has the list.
   *
   * Left out, the stop is not checked at all: a caller with no list cannot tell a stop that was
   * deleted from one it simply has not loaded, and refusing on the second would block a save that
   * is perfectly good. The repository decides ownership either way.
   */
  readonly stopIds?: ReadonlyArray<string>
}

export function validateBookingDraft(
  draft: BookingDraft,
  context: BookingDraftContext = {},
): BookingErrors {
  const errors: BookingErrors = {}
  const shape = SHAPES[draft.type]

  if (draft.title.trim().length === 0) {
    errors.title = 'Give this booking a name you will recognise in a list.'
  } else if (draft.title.trim().length > 160) {
    errors.title = 'Keep the name under 160 characters.'
  }

  for (const field of shape.required) {
    if (draft[field].trim().length === 0) {
      errors[field] =
        `A ${shape.label.toLowerCase()} needs a ${FIELD_NAMES[field]}.`
    }
  }

  if (draft.startTime !== '' && draft.startDate === '') {
    errors.startDate = 'A time needs the date it is on.'
  }
  if (draft.endTime !== '' && draft.endDate === '' && draft.startDate === '') {
    errors.endDate = 'An end time needs the date it is on.'
  }

  if (
    draft.startDate !== '' &&
    draft.endDate !== '' &&
    draft.endDate < draft.startDate
  ) {
    errors.endDate = 'This ends before it starts.'
  } else if (
    draft.startDate !== '' &&
    draft.startDate === draft.endDate &&
    draft.startTime !== '' &&
    draft.endTime !== '' &&
    draft.endTime < draft.startTime
  ) {
    errors.endTime = 'The end time is before the start time.'
  }

  if (draft.guests.trim() !== '') {
    const guests = draft.guests.trim()
    // A digits-only test, not `parseInt`: `parseInt('2.5')` is 2, which would
    // silently book half a person's worth of table.
    if (!/^\d{1,4}$/u.test(guests) || Number.parseInt(guests, 10) > 1000) {
      errors.guests = 'Guests must be a whole number up to 1000.'
    }
  }

  if (
    draft.price !== '' &&
    parseMoneyToMinor(draft.price, draft.currency) === null
  ) {
    errors.price = 'That is not an amount we can read.'
  }

  if (draft.url !== '' && !/^https?:\/\/\S+$/u.test(draft.url.trim())) {
    errors.url = 'A link has to start with http:// or https://.'
  }

  if (draft.confirmationNumber.trim().length > 200) {
    errors.confirmationNumber = 'That confirmation number is too long to store.'
  }

  if (
    draft.assignmentId !== '' &&
    context.stopIds !== undefined &&
    !context.stopIds.includes(draft.assignmentId)
  ) {
    errors.assignmentId = 'That stop is not on this trip any more.'
  }

  return errors
}

export function hasBookingErrors(errors: BookingErrors): boolean {
  return Object.keys(errors).length > 0
}
