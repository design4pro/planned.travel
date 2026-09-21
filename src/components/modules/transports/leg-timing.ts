/**
 * How long one transport takes, from what the form holds.
 *
 * Kept beside the dialog rather than in `connections.ts` because that module
 * reasons about the *gaps between* transports; this is the transport's own duration, and the
 * dialog shows it live so a traveller can sanity-check a red-eye they have just
 * typed in. The arithmetic is `elapsedMinutes` (`#/lib/transport-timing`), which the ordering
 * rule shares; these two name the two ways the screens ask for it.
 */

import { elapsedMinutes } from '#/lib/transport-timing'

/**
 * Minutes from departure to arrival, or `null` when either end is not yet known
 * or the pair is the wrong way round (which the form reports as an error instead).
 */
export function transportDurationMinutes(transport: {
  readonly departureDate: string
  readonly departureTime: string
  readonly arrivalDate: string
  readonly arrivalTime: string
}): number | null {
  return elapsedMinutes(transport)
}

/**
 * The same duration for a leg whose two ends are on different clocks — the elapsed time.
 *
 * {@link transportDurationMinutes} subtracts one wall clock from the other, which is right only when
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
  return elapsedMinutes(leg, zones)
}
