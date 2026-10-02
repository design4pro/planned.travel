/**
 * The calendar arithmetic behind a trip's dates-or-duration fact, for the form and the boundary alike.
 *
 * Dates are `YYYY-MM-DD` strings and the maths runs in UTC, so a day is always exactly 24 hours and
 * no zone or daylight-saving shift can move a trip's length.
 */

/** The most days a trip can be created with when only a duration is given. */
export const TRIP_DAY_COUNT_MAX = 365

const MS_PER_DAY = 86_400_000

function utcMs(date: string): number {
  return Date.parse(`${date}T00:00:00.000Z`)
}

/** Days in the inclusive range, or `null` when either end is missing, malformed or inverted. */
export function inclusiveDays(start: string, end: string): number | null {
  const from = utcMs(start)
  const to = utcMs(end)
  if (Number.isNaN(from) || Number.isNaN(to) || to < from) return null
  return Math.round((to - from) / MS_PER_DAY) + 1
}

/** `date` moved by `days` (negative moves back), or `null` for a malformed date. */
export function shiftDate(date: string, days: number): string | null {
  const from = utcMs(date)
  if (Number.isNaN(from)) return null
  return new Date(from + days * MS_PER_DAY).toISOString().slice(0, 10)
}
