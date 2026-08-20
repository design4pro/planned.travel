import { describe, expect, it } from 'vitest'

import { mapPalette } from '#/lib/map/palette'
import {
  DISTANT_AFTER_YEARS,
  RECENT_WITHIN_YEARS,
  visitRecency,
} from '#/lib/map/visit-recency'

import type { VisitRamp } from '#/lib/map/visit-recency'

/** A fixed instant, so every case below states its answer rather than drifts. */
const NOW = new Date('2026-08-20T00:00:00.000Z')

const DAY_MS = 86_400_000
const DAYS_PER_YEAR = 365.2425

/**
 * `YYYY-MM-DD` for the day exactly `days` before {@link NOW}.
 *
 * Whole days rather than whole years, because a year of 365.2425 days lands
 * mid-afternoon and truncating that back to a date would move a boundary case to
 * the wrong side of the threshold it is there to pin down.
 */
function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString().slice(0, 10)
}

/** The last day still inside a window cut at `years` average Gregorian years. */
function lastDayInside(years: number): number {
  return Math.floor(years * DAYS_PER_YEAR)
}

describe('visitRecency', () => {
  it('places a visit inside the recent window at the strong end of the ramp', () => {
    expect(visitRecency(daysAgo(0), NOW)).toBe('visitedRecent')
    expect(visitRecency(daysAgo(365), NOW)).toBe('visitedRecent')
  })

  it('keeps the recent window inclusive at its own boundary', () => {
    // A visit exactly two years old is still inside "within two years": the
    // reader is told the rule in whole years, so the boundary has to answer the
    // way the words do.
    const edge = lastDayInside(RECENT_WITHIN_YEARS)
    expect(visitRecency(daysAgo(edge), NOW)).toBe('visitedRecent')
    expect(visitRecency(daysAgo(edge + 1), NOW)).toBe('visited')
  })

  it('holds the middle stop across the years between the two thresholds', () => {
    expect(visitRecency(daysAgo(3 * 365), NOW)).toBe('visited')
    expect(visitRecency(daysAgo(7 * 365), NOW)).toBe('visited')
    expect(visitRecency(daysAgo(lastDayInside(DISTANT_AFTER_YEARS)), NOW)).toBe(
      'visited',
    )
  })

  it('drops to the faint end only once a visit is older than the far threshold', () => {
    const edge = lastDayInside(DISTANT_AFTER_YEARS)
    expect(visitRecency(daysAgo(edge + 1), NOW)).toBe('visitedDistant')
    expect(visitRecency(daysAgo(15 * 365), NOW)).toBe('visitedDistant')
  })

  it('answers the middle stop for a record that carries no date at all', () => {
    // Absence is not a fourth colour. The middle stop is exactly what the
    // palette documents it as — visited, with nothing to place it on the ramp.
    expect(visitRecency(null, NOW)).toBe('visited')
    expect(visitRecency(undefined, NOW)).toBe('visited')
    expect(visitRecency('', NOW)).toBe('visited')
  })

  it('treats an unusable date the same as a missing one', () => {
    expect(visitRecency('2011-13-45', NOW)).toBe('visited')
    expect(visitRecency('not a date', NOW)).toBe('visited')
    expect(visitRecency('2011', NOW)).toBe('visited')
  })

  it('reads a date in the future as a typo rather than as the oldest visit', () => {
    // Negative age must not fall through to the faint end: a trip recorded a
    // month early would otherwise paint as the most distant country on the map.
    expect(visitRecency('2027-01-04', NOW)).toBe('visitedRecent')
  })

  it('ignores the time of day on the reference instant', () => {
    const lateInTheDay = new Date('2026-08-20T23:59:59.000Z')
    expect(visitRecency(daysAgo(4 * 365), lateInTheDay)).toBe('visited')
  })

  it('names every stop after a colour the palette can actually paint', () => {
    // The end of the contract with `mapPalette`: a stop the palette cannot paint
    // would leave the fill expression selecting nothing at all.
    const stops: ReadonlyArray<VisitRamp> = [
      visitRecency(daysAgo(0), NOW),
      visitRecency(null, NOW),
      visitRecency(daysAgo(20 * 365), NOW),
    ]
    expect(new Set(stops).size).toBe(3)

    for (const theme of ['light', 'dark'] as const) {
      const country = mapPalette(theme).country
      for (const stop of stops) {
        expect(country[stop]).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  it('spaces the three stops apart in both themes', () => {
    const light = mapPalette('light').country
    expect(
      new Set([light.visitedDistant, light.visited, light.visitedRecent]).size,
    ).toBe(3)
    const dark = mapPalette('dark').country
    expect(
      new Set([dark.visitedDistant, dark.visited, dark.visitedRecent]).size,
    ).toBe(3)
  })

  it('defaults its reference instant to now', () => {
    // The one branch a fixed instant cannot cover: called with one argument, it
    // must still answer against the real clock rather than throw.
    const today = new Date().toISOString().slice(0, 10)
    expect(visitRecency(today)).toBe('visitedRecent')
  })
})
