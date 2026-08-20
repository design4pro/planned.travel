/**
 * Where one visit record sits on the atlas recency ramp.
 *
 * `mapPalette(theme).country` hands out three fills for a visited country —
 * `visitedDistant`, `visited`, `visitedRecent`, evenly spaced in lightness — and
 * it deliberately knows nothing about calendars. A palette that learned about
 * dates would have to be re-measured every time the product changed its mind
 * about what "recent" means, and the contrast figures recorded next to those
 * hexes would go stale with it. This module is the other half of that split, and
 * the only place the question is answered.
 *
 * Three decisions are load-bearing.
 *
 * **The ramp keys off the *last* visit.** "How long since I was there" is the
 * question a world tracker is actually asked; the first visit is history, and
 * ramping on it would paint a country the traveller left last month in the
 * faintest colour on the map because they first went in 2011.
 *
 * **A record with no usable date is not a fourth colour.** Null, empty and
 * malformed columns all resolve to the middle stop, which the palette already
 * defines as "visited, with no date on the record to place it on the ramp". A
 * fourth fill would encode *absence* as a shade of presence, and the reader has
 * no way to decode it; the middle stop says "visited" and lets the record's own
 * text say the dates are missing.
 *
 * **The thresholds are exported, not buried.** Colour alone cannot be decoded
 * into a date — adjacent steps sit 1.2–1.3:1 apart — so anything painting with
 * this ramp owes the reader a legend, and a legend can only be written in words
 * if it can read the numbers the ramp was cut at.
 *
 * Elapsed time is measured in average Gregorian years against a caller-supplied
 * instant, so a test states the answer rather than waiting for one, and the
 * arithmetic matches `visitSpan`'s "13 years apart" line rather than drifting a
 * day from it.
 */

import { parseIsoDate } from '#/routes/_app/-lib/format'

/**
 * A stop on the ramp, named for the `CountryPalette` key that paints it.
 *
 * Sharing the names is what keeps the two halves honest: a stop that the palette
 * cannot paint fails to compile, and a reader of the paint expression can follow
 * the value straight through to the colour it selects.
 */
export type VisitRamp = 'visitedDistant' | 'visited' | 'visitedRecent'

/** Visited this recently, and the country reads at the strong end of the ramp. */
export const RECENT_WITHIN_YEARS = 2

/** Longer ago than this, and the country falls back to the faint end. */
export const DISTANT_AFTER_YEARS = 8

/** Average days per Gregorian year — the same figure `visitSpan` coarsens with. */
const DAYS_PER_YEAR = 365.2425
const YEAR_MS = DAYS_PER_YEAR * 86_400_000

/**
 * The ramp stop for a country whose last visit is `lastVisitedOn`.
 *
 * A date in the future is a typo, not a prophecy, and it reads as recent: the
 * alternative is a negative age falling through to the faint end, which would
 * paint next month's trip as the oldest thing on the map.
 */
export function visitRecency(
  lastVisitedOn: string | null | undefined,
  now: Date = new Date(),
): VisitRamp {
  const at = parseIsoDate(lastVisitedOn)
  if (at === null) {
    return 'visited'
  }

  const years = (now.getTime() - at.getTime()) / YEAR_MS
  if (years <= RECENT_WITHIN_YEARS) {
    return 'visitedRecent'
  }
  if (years > DISTANT_AFTER_YEARS) {
    return 'visitedDistant'
  }
  return 'visited'
}
