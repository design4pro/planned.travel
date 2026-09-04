/**
 * How long one leg takes, from what the form holds.
 *
 * Kept beside the dialog rather than in `connections.ts` because that module
 * reasons about the *gaps between* legs; this is the leg's own duration, and the
 * dialog shows it live so a traveller can sanity-check a red-eye they have just
 * typed in.
 */

import { timeZoneOffsetMinutes } from '#/lib/timezones'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u

function instantOf(date: string, time: string): number | null {
  if (!DATE_PATTERN.test(date)) {
    return null
  }
  const clock = /^\d{2}:\d{2}/u.test(time) ? time.slice(0, 5) : '00:00'
  const parsed = Date.parse(`${date}T${clock}:00.000Z`)
  return Number.isNaN(parsed) ? null : parsed
}

/**
 * Minutes from departure to arrival, or `null` when either end is not yet known
 * or the pair is the wrong way round (which the form reports as an error instead).
 */
export function legDurationMinutes(leg: {
  readonly departureDate: string
  readonly departureTime: string
  readonly arrivalDate: string
  readonly arrivalTime: string
}): number | null {
  const from = instantOf(leg.departureDate, leg.departureTime)
  const to = instantOf(leg.arrivalDate, leg.arrivalTime)
  if (from === null || to === null || to <= from) {
    return null
  }
  return Math.round((to - from) / 60_000)
}

/**
 * The same duration for a leg whose two ends are on different clocks — the elapsed time.
 *
 * {@link legDurationMinutes} subtracts one wall clock from the other, which is right only when
 * both are the same clock. Across zones it is wrong by the difference between them, and wrong in
 * the direction that matters most: a westbound flight arrives at a clock reading *earlier* than
 * the one it left, so the naive subtraction answers `null` and the label vanishes for exactly the
 * journeys it was written for. LHR 09:00 → JFK 08:00 is four hours in the air, not a paradox.
 *
 * Each end is converted to a real instant by its own zone's offset **on its own date**, so a leg
 * that crosses a DST switch is measured across it rather than around it. An end with no zone
 * named yet answers `null`: an offset guessed for a field the traveller has not filled would read
 * as a fact.
 */
export function legElapsedMinutes(
  leg: {
    readonly departureDate: string
    readonly departureTime: string
    readonly arrivalDate: string
    readonly arrivalTime: string
  },
  zones: { readonly from: string; readonly to: string },
): number | null {
  if (zones.from.trim() === '' || zones.to.trim() === '') {
    return null
  }
  const from = instantOf(leg.departureDate, leg.departureTime)
  const to = instantOf(leg.arrivalDate, leg.arrivalTime)
  if (from === null || to === null) {
    return null
  }
  const departed =
    from - timeZoneOffsetMinutes(zones.from, leg.departureDate) * 60_000
  const arrived = to - timeZoneOffsetMinutes(zones.to, leg.arrivalDate) * 60_000
  if (arrived <= departed) {
    return null
  }
  return Math.round((arrived - departed) / 60_000)
}
