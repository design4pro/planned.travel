/**
 * The shape of the booking dialog, and the rules it enforces before it submits.
 *
 * A booking is one row with a type discriminator, so the *form* is what makes a
 * flight feel like a flight and a restaurant table feel like a table: each type
 * declares which fields it shows, what they are called, and which of them it
 * refuses to submit without. Keeping that here — pure, no React — is what lets the
 * rules be tested rather than clicked through.
 *
 * What each field is *called* is copy, so the table holds message keys and the
 * dialog resolves them. That keeps this file pure and keeps a booking type's
 * name owned once, by `shell.bookingType.*`.
 */

import type { MessageKey } from '#/lib/i18n'
import type { DeferredMessage } from '../shared/deferred-message'

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
  /**
   * A stay's check-in day and check-out day — `''` until chosen. Only the stay branch reads them;
   * its check-in and check-out *times* are `startTime` and `endTime`, the same columns the booking
   * already has.
   */
  readonly startDayId: string
  readonly endDayId: string
  /** The end of a stay's check-in window — `''` when the property states none. */
  readonly checkInEndTime: string
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
    startDayId: '',
    endDayId: '',
    checkInEndTime: '',
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
  readonly label: MessageKey
  /** What the "provider" field is called for this type. */
  readonly providerLabel: MessageKey
  readonly providerPlaceholder: MessageKey
  /**
   * Example for the name field. Per type, and never the same string as
   * `providerPlaceholder`: the two fields sit next to each other, so one
   * example repeated across both reads as a bug and teaches nothing about
   * which half of the booking goes where.
   */
  readonly titlePlaceholder: MessageKey
  /** What the "location" field is called for this type. */
  readonly locationLabel: MessageKey
  /** What the two date fields are called. */
  readonly startLabel: MessageKey
  readonly endLabel: MessageKey
  readonly fields: ReadonlyArray<BookingField>
  /** Fields this type will not submit without, beyond the title. */
  readonly required: ReadonlyArray<BookingField>
  /** One line under the type picker, so the dialog says what it is for. */
  readonly hint: MessageKey
}

const SHAPES: { readonly [K in BookingType]: BookingTypeShape } = {
  accommodation: {
    label: 'shell.bookingType.accommodation',
    providerLabel: 'modules.book.field.host',
    providerPlaceholder: 'modules.book.example.accommodationProvider',
    titlePlaceholder: 'modules.book.example.accommodationTitle',
    locationLabel: 'modules.book.field.address',
    startLabel: 'modules.book.field.checkIn',
    endLabel: 'modules.book.field.checkOut',
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
    hint: 'modules.book.hint.accommodation',
  },
  restaurant: {
    label: 'shell.bookingType.restaurant',
    providerLabel: 'modules.book.field.restaurant',
    providerPlaceholder: 'modules.book.example.restaurantProvider',
    titlePlaceholder: 'modules.book.example.restaurantTitle',
    locationLabel: 'modules.book.where',
    startLabel: 'modules.book.field.date',
    endLabel: 'modules.book.until',
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
    hint: 'modules.book.hint.restaurant',
  },
  activity: {
    label: 'shell.bookingType.activity',
    providerLabel: 'modules.book.field.operator',
    providerPlaceholder: 'modules.book.example.activityProvider',
    titlePlaceholder: 'modules.book.example.activityTitle',
    locationLabel: 'modules.book.where',
    startLabel: 'modules.book.field.date',
    endLabel: 'modules.book.field.ends',
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
    hint: 'modules.book.hint.activity',
  },
  tour: {
    label: 'shell.bookingType.tour',
    providerLabel: 'modules.book.field.operator',
    providerPlaceholder: 'modules.book.example.tourProvider',
    titlePlaceholder: 'modules.book.example.tourTitle',
    locationLabel: 'modules.book.field.meetingPoint',
    startLabel: 'modules.book.field.date',
    endLabel: 'modules.book.field.ends',
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
    hint: 'modules.book.hint.tour',
  },
  ticket: {
    label: 'shell.bookingType.ticket',
    providerLabel: 'modules.book.field.issuer',
    providerPlaceholder: 'modules.book.example.ticketProvider',
    titlePlaceholder: 'modules.book.example.ticketTitle',
    locationLabel: 'modules.book.field.venue',
    startLabel: 'modules.book.field.validOn',
    endLabel: 'modules.book.until',
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
    hint: 'modules.book.hint.ticket',
  },
  transport: {
    label: 'shell.bookingType.transport',
    providerLabel: 'modules.book.field.carrier',
    providerPlaceholder: 'modules.book.example.transportProvider',
    titlePlaceholder: 'modules.book.example.transportTitle',
    locationLabel: 'modules.book.field.fromTo',
    startLabel: 'modules.book.field.departs',
    endLabel: 'modules.book.field.arrives',
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
    hint: 'modules.book.hint.transport',
  },
  other: {
    label: 'modules.book.shape.other.label',
    providerLabel: 'modules.book.provider',
    providerPlaceholder: 'modules.book.example.otherProvider',
    titlePlaceholder: 'modules.book.example.otherTitle',
    locationLabel: 'modules.book.where',
    startLabel: 'modules.book.field.date',
    endLabel: 'modules.book.until',
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
    hint: 'modules.book.hint.other',
  },
}

export function bookingShape(type: BookingType): BookingTypeShape {
  return SHAPES[type]
}

export function bookingTypeLabel(type: string): MessageKey {
  return isBookingType(type) ? SHAPES[type].label : 'shell.bookingType.other'
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

/* ------------------------------------------------------ the ledger notice */

/**
 * What the trip's ledger will do about this booking.
 *
 * A key and the figure it needs, never a sentence: this file stays free of React
 * and of English, and the caller — which has both a provider and a locale —
 * turns the amount into money the reader can read.
 */
export interface LedgerNotice {
  /** `warning` is the one branch where the reader has to do something for the line to exist. */
  readonly tone: 'info' | 'warning'
  readonly key: MessageKey
  /** Minor units for `{money}`, or `null` when the sentence names no figure. */
  readonly amountMinor: number | null
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
          key: 'modules.book.ledger.unlinked',
          amountMinor: null,
        }
      : null
  }

  if (context.linked) {
    return {
      tone: 'info',
      key: 'modules.book.ledger.updated',
      amountMinor: minor,
    }
  }

  const dated =
    draft.startDate !== '' ||
    context.dayDate !== null ||
    context.tripStartDate !== null
  if (!dated) {
    return {
      tone: 'warning',
      key: 'modules.book.ledger.needsDate',
      amountMinor: null,
    }
  }

  return {
    tone: 'info',
    key: 'modules.book.ledger.added',
    amountMinor: minor,
  }
}

/* -------------------------------------------------------------- validation */

/**
 * One reason a draft cannot be saved: the message, and whatever it needs to
 * interpolate. Keeping it a key rather than a sentence is what lets this file
 * stay free of React and of English, and lets the tests assert identity instead
 * of prose.
 *
 * It is a `DeferredMessage` rather than its own shape because a field's *name*
 * is copy as well, and only that shape carries the difference: a name goes in
 * `keyParams`, so the dialog resolves it before it lands in the sentence.
 * Through `params` the key itself is what the reader would see.
 */
export type BookingError = DeferredMessage

export type BookingErrors = Partial<
  Record<keyof BookingDraft | 'form', BookingError>
>

/** A field's name as it reads inside a sentence, not as a label above an input. */
const FIELD_NAMES: { readonly [K in BookingField]: MessageKey } = {
  provider: 'modules.book.fieldName.provider',
  location: 'modules.book.fieldName.location',
  confirmationNumber: 'modules.book.fieldName.confirmationNumber',
  url: 'modules.book.fieldName.link',
  startDate: 'modules.book.fieldName.date',
  startTime: 'modules.book.fieldName.time',
  endDate: 'modules.book.fieldName.endDate',
  endTime: 'modules.book.fieldName.endTime',
  guests: 'modules.book.fieldName.guests',
  price: 'modules.book.fieldName.price',
  assignmentId: 'modules.book.fieldName.stop',
}

/* ------------------------------------------------------------------ the stay */

/** A day of the trip, as far as a stay needs to know it. */
export interface StayDay {
  readonly id: string
  readonly dayNumber: number
}

/**
 * The nights a stay covers: the difference between its two day numbers.
 *
 * Check in on day 1 and out on day 4 is three nights; in and out on the same day is **zero**, not one.
 * The same rule as the server's `countAccommodationNights`, and the only place the screen counts.
 */
export function stayNights(
  firstDayNumber: number,
  lastDayNumber: number,
): number {
  return Math.max(lastDayNumber - firstDayNumber, 0)
}

/** A stay's two days, resolved, and the nights between them — `null` until both are valid. */
export interface StayRange<TDay extends StayDay> {
  readonly first: TDay
  readonly last: TDay
  readonly nights: number
}

export function stayRange<TDay extends StayDay>(
  startDayId: string,
  endDayId: string,
  days: ReadonlyArray<TDay>,
): StayRange<TDay> | null {
  const first = days.find((day) => day.id === startDayId)
  const last = days.find((day) => day.id === endDayId)
  if (first === undefined || last === undefined) {
    return null
  }
  if (last.dayNumber < first.dayNumber) {
    return null
  }
  return { first, last, nights: stayNights(first.dayNumber, last.dayNumber) }
}

export type StayDayWord = 'checkIn' | 'checkOut'

/**
 * What one day of a stay is to the reader: _check in_ on the first, _check out_ on the last, nothing
 * on the nights between — and **both** on a stay that begins and ends on the same day.
 */
export function stayDayWords(
  dayNumber: number,
  firstDayNumber: number,
  lastDayNumber: number,
): ReadonlyArray<StayDayWord> {
  const words: Array<StayDayWord> = []
  if (dayNumber === firstDayNumber) {
    words.push('checkIn')
  }
  if (dayNumber === lastDayNumber) {
    words.push('checkOut')
  }
  return words
}

/**
 * The rules a stay adds in place of the typed-date rules: both days chosen, the check-out day not
 * before the check-in day, a check-in window that does not close before it opens, and — on a
 * same-day stay — no check-out before the check-in.
 *
 * The typed-date rules do not run beside these: the stay branch renders no date field, so an error
 * landing on one would refuse the save with nothing on screen to say why.
 */
export function validateStayDraft(
  draft: BookingDraft,
  days: ReadonlyArray<StayDay>,
): BookingErrors {
  const errors: BookingErrors = {}

  if (draft.startDayId === '') {
    errors.startDayId = {
      key: 'modules.book.error.required',
      keyParams: { field: 'modules.book.fieldName.checkInDay' },
    }
  }
  if (draft.endDayId === '') {
    errors.endDayId = {
      key: 'modules.book.error.required',
      keyParams: { field: 'modules.book.fieldName.checkOutDay' },
    }
  }

  const first = days.find((day) => day.id === draft.startDayId)
  const last = days.find((day) => day.id === draft.endDayId)
  if (
    first !== undefined &&
    last !== undefined &&
    last.dayNumber < first.dayNumber
  ) {
    errors.endDayId = { key: 'modules.book.error.endsBeforeStart' }
  }

  if (
    draft.startTime !== '' &&
    draft.checkInEndTime !== '' &&
    draft.checkInEndTime < draft.startTime
  ) {
    errors.checkInEndTime = { key: 'modules.book.error.endTimeBeforeStart' }
  }
  if (
    first !== undefined &&
    first.id === last?.id &&
    draft.startTime !== '' &&
    draft.endTime !== '' &&
    draft.endTime < draft.startTime
  ) {
    errors.endTime = { key: 'modules.book.error.endTimeBeforeStart' }
  }

  return errors
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
  /**
   * The trip's days, when the draft is a stay recorded against them. Given, the stay's rules
   * ({@link validateStayDraft}) replace the typed-date rules.
   */
  readonly stayDays?: ReadonlyArray<StayDay>
}

export function validateBookingDraft(
  draft: BookingDraft,
  context: BookingDraftContext = {},
): BookingErrors {
  const shape = SHAPES[draft.type]
  const stay = context.stayDays
  const errors: BookingErrors =
    stay === undefined ? {} : validateStayDraft(draft, stay)

  if (draft.title.trim().length === 0) {
    errors.title = { key: 'modules.book.error.titleEmpty' }
  } else if (draft.title.trim().length > 160) {
    errors.title = { key: 'modules.error.titleLong' }
  }

  if (stay === undefined) {
    validateTypedDates(draft, shape, errors)
  }

  if (draft.guests.trim() !== '') {
    const guests = draft.guests.trim()
    // A digits-only test, not `parseInt`: `parseInt('2.5')` is 2, which would
    // silently book half a person's worth of table.
    if (!/^\d{1,4}$/u.test(guests) || Number.parseInt(guests, 10) > 1000) {
      errors.guests = { key: 'modules.book.error.guests' }
    }
  }

  if (
    draft.price !== '' &&
    parseMoneyToMinor(draft.price, draft.currency) === null
  ) {
    errors.price = { key: 'modules.error.price' }
  }

  if (draft.url !== '' && !/^https?:\/\/\S+$/u.test(draft.url.trim())) {
    errors.url = { key: 'modules.book.error.url' }
  }

  if (draft.confirmationNumber.trim().length > 200) {
    errors.confirmationNumber = { key: 'modules.book.error.confirmationLong' }
  }

  if (
    draft.assignmentId !== '' &&
    context.stopIds !== undefined &&
    !context.stopIds.includes(draft.assignmentId)
  ) {
    errors.assignmentId = { key: 'modules.book.error.stopGone' }
  }

  return errors
}

/** The rules of a booking dated by typed calendar dates: every type except a stay on its days. */
function validateTypedDates(
  draft: BookingDraft,
  shape: BookingTypeShape,
  errors: BookingErrors,
): void {
  for (const field of shape.required) {
    if (draft[field].trim().length === 0) {
      errors[field] = {
        key: 'modules.book.error.required',
        keyParams: { field: FIELD_NAMES[field] },
      }
    }
  }

  if (draft.startTime !== '' && draft.startDate === '') {
    errors.startDate = { key: 'modules.book.error.timeNeedsDate' }
  }
  if (draft.endTime !== '' && draft.endDate === '' && draft.startDate === '') {
    errors.endDate = { key: 'modules.book.error.endTimeNeedsDate' }
  }

  if (
    draft.startDate !== '' &&
    draft.endDate !== '' &&
    draft.endDate < draft.startDate
  ) {
    errors.endDate = { key: 'modules.book.error.endsBeforeStart' }
  } else if (
    draft.startDate !== '' &&
    draft.startDate === draft.endDate &&
    draft.startTime !== '' &&
    draft.endTime !== '' &&
    draft.endTime < draft.startTime
  ) {
    errors.endTime = { key: 'modules.book.error.endTimeBeforeStart' }
  }
}

export function hasBookingErrors(errors: BookingErrors): boolean {
  return Object.keys(errors).length > 0
}
