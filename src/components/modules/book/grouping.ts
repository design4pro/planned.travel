/**
 * Bookings, grouped the way the screen reads them.
 *
 * A separate module from the timeline that renders it, and deliberately free of
 * any runtime import: the grouping is the part worth testing, and a test for it
 * should not need a Worker runtime behind it to resolve a binding.
 */

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
