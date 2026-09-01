/**
 * Bookings, grouped the way the screen reads them.
 *
 * A separate module from the timeline that renders it, and deliberately free of
 * React and of anything under `server/`: the grouping is the part worth testing,
 * and a test for it should not need a Worker runtime behind it to resolve a
 * binding. Its one import is `booking-form`, which is pure for the same reason.
 */

import { BOOKING_TYPES } from './booking-form'

import type { BookingRow } from '#/server/fns/reservations'

export interface BookingDateGroup {
  /** `null` is the "no date yet" group, which always comes last. */
  readonly date: string | null
  readonly bookings: ReadonlyArray<BookingRow>
}

/**
 * Bookings by start date, earliest first, undated last, and each day's bookings in
 * time order with the untimed ones after them.
 */
export function groupBookingsByDate(
  bookings: ReadonlyArray<BookingRow>,
): Array<BookingDateGroup> {
  const dated = new Map<string, Array<BookingRow>>()
  const undated: Array<BookingRow> = []

  for (const booking of bookings) {
    const date = booking.startDate
    if (date === null || date.length < 10) {
      undated.push(booking)
      continue
    }
    const bucket = dated.get(date)
    if (bucket === undefined) {
      dated.set(date, [booking])
    } else {
      bucket.push(booking)
    }
  }

  const groups: Array<BookingDateGroup> = [...dated.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, rows]) => ({
      date,
      // `99:99` sorts after every real clock time, so an untimed booking lands at
      // the end of its day rather than at the start of it.
      bookings: [...rows].sort((left, right) =>
        (left.startTime ?? '99:99').localeCompare(right.startTime ?? '99:99'),
      ),
    }))

  if (undated.length > 0) {
    groups.push({ date: null, bookings: undated })
  }
  return groups
}

/* ------------------------------------------------- settled and outstanding */

/**
 * The two halves the desk reads as separate work.
 *
 * *Outstanding* is what still needs somebody to do something about it; *settled*
 * is everything that does not. A cancelled booking is settled: it is a decision
 * that has been taken, not a chase that is still open, and burying three
 * unconfirmed hotels under nine cancelled ones is the exact failure the split
 * exists to prevent.
 */
export type BookingSettlement = 'settled' | 'outstanding'

/**
 * The statuses that mean nothing further is owed.
 *
 * A `Set` of strings rather than a mapped type over `BOOKING_STATUSES`, because
 * `reservations.status` is a `text` column and this function is handed whatever
 * is in it — including a word written by a build that came after this one.
 */
const SETTLED_STATUSES: ReadonlySet<string> = new Set([
  'confirmed',
  'completed',
  'cancelled',
])

/**
 * Which half a booking belongs to.
 *
 * A status this build does not recognise is **outstanding**: not knowing what
 * happened to a booking is not evidence that it was settled, and the cost of
 * being wrong is a reader who is shown one item too many rather than one too
 * few.
 */
export function settlementOf(status: string): BookingSettlement {
  return SETTLED_STATUSES.has(status) ? 'settled' : 'outstanding'
}

export interface BookingSettlementGroups {
  readonly settled: ReadonlyArray<BookingRow>
  readonly outstanding: ReadonlyArray<BookingRow>
}

/**
 * The desk's second grouping, beside {@link groupBookingsByDate} rather than
 * instead of it: this one decides the two panels, and the date grouping runs
 * again *inside* each of them.
 *
 * One pass, and the incoming order is preserved inside each half, so whatever
 * the caller sorted by still holds after the split.
 */
export function partitionBookings(
  bookings: ReadonlyArray<BookingRow>,
): BookingSettlementGroups {
  const settled: Array<BookingRow> = []
  const outstanding: Array<BookingRow> = []

  for (const booking of bookings) {
    if (settlementOf(booking.status) === 'settled') {
      settled.push(booking)
    } else {
      outstanding.push(booking)
    }
  }
  return { settled, outstanding }
}

/* -------------------------------------------------------- filter by kind */

export interface BookingTypeCount {
  readonly type: string
  readonly count: number
}

/**
 * The kinds this trip actually has, commonest first — the filter row's own
 * vocabulary.
 *
 * Derived from the rows rather than from `BOOKING_TYPES`, so a trip with no
 * flights is never offered a "Flights" chip that can only ever empty the list.
 * Ties break on the declared order of {@link BOOKING_TYPES}, so two kinds with
 * the same count do not swap places between renders.
 */
export function countBookingTypes(
  bookings: ReadonlyArray<BookingRow>,
): Array<BookingTypeCount> {
  const tally = new Map<string, number>()
  for (const booking of bookings) {
    tally.set(booking.type, (tally.get(booking.type) ?? 0) + 1)
  }
  const declared = (type: string): number => {
    const at = (BOOKING_TYPES as ReadonlyArray<string>).indexOf(type)
    return at === -1 ? BOOKING_TYPES.length : at
  }
  return [...tally.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort(
      (left, right) =>
        right.count - left.count || declared(left.type) - declared(right.type),
    )
}

/**
 * The rows of the selected kinds, or every row when nothing is selected.
 *
 * An empty selection is "no lens", not "nothing matches" — a filter row with no
 * chip pressed shows the whole desk. A selection that matches nothing answers
 * with nothing, which is what the third empty state is for.
 */
export function filterBookingsByType(
  bookings: ReadonlyArray<BookingRow>,
  types: ReadonlyArray<string>,
): Array<BookingRow> {
  if (types.length === 0) {
    return [...bookings]
  }
  const wanted = new Set(types)
  return bookings.filter((booking) => wanted.has(booking.type))
}
