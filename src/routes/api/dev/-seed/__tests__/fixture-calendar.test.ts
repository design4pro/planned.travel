/**
 * The fixture calendar, and the two properties it exists to hold.
 *
 * 1. **The fixture does not read a clock.** Every date and instant the seed writes is measured from
 *    `SEED_ANCHOR_DAY`, so the rows in D1 are a pure function of `../dataset`. A seed run in October
 *    writes the same workspace as one run in August, which is what lets a visual baseline outlive
 *    the day it was recorded.
 * 2. **The fixture and the visual gate agree about what day it is.** The suite pins the Worker's
 *    clock to `BASELINE_DAY`; the fixture writes its dates around `SEED_ANCHOR_DAY`. Those two
 *    constants cannot be shared by import — nothing in the Worker may reach into `e2e/` — so they
 *    are compared here, off disk, against the two files that declare them.
 *
 * The lifecycle assertions at the end are the reason any of it matters: they state, in the same
 * comparisons the repositories make, that the fixture still shows a trip under way, a trip finished,
 * a trip ahead and a booking in the rail. Those are the row sets the authenticated baselines
 * photograph, and a fixture edit that quietly empties one of them fails here rather than as an
 * unexplained red frame.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  SEED_ANCHOR_DAY,
  SEED_ANCHOR_INSTANT,
  SEED_ANCHOR_YEAR,
  anchorYearDay,
  day,
  daysFromAnchor,
  historic,
  instantOn,
  minutesBeforeAnchor,
} from '../dataset/anchor'
import {
  dolomitesTrip,
  flagshipTrip,
  lisbonTrip,
  marrakechTrip,
  patagoniaTrip,
  trips,
} from '../dataset'

const REPO_ROOT = join(import.meta.dirname, '../../../../../..')
const SEED_ROOT = join(import.meta.dirname, '..')

function read(relative: string): string {
  return readFileSync(join(REPO_ROOT, relative), 'utf8')
}

/** Prose is allowed to name what the code may not do, so the checks below read code only. */
function withoutComments(source: string): string {
  return source
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .replaceAll(/(^|\s)\/\/[^\n]*/g, '$1')
}

/** Every TypeScript module under `-seed/`, tests excluded, as `[path, source]`. */
function seedSources(): ReadonlyArray<readonly [string, string]> {
  const walk = (directory: string): Array<string> =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        return entry.name === '__tests__' ? [] : walk(path)
      }
      return entry.name.endsWith('.ts') ? [path] : []
    })
  return walk(SEED_ROOT).map(
    (path) => [path, readFileSync(path, 'utf8')] as const,
  )
}

describe('the fixture anchor', () => {
  it('names the same day the visual gate pins the Worker to', () => {
    const declaration = /const BASELINE_DAY = '(\d{4}-\d{2}-\d{2})'/
    const inConfig = declaration.exec(read('playwright.config.ts'))
    const inHelper = /export const BASELINE_DAY = '(\d{4}-\d{2}-\d{2})'/.exec(
      read('e2e/helpers/shoot.ts'),
    )

    expect(
      inConfig?.[1],
      'playwright.config.ts must declare BASELINE_DAY',
    ).toBeDefined()
    expect(
      inHelper?.[1],
      'e2e/helpers/shoot.ts must export BASELINE_DAY',
    ).toBeDefined()
    expect(inConfig?.[1]).toBe(SEED_ANCHOR_DAY)
    expect(inHelper?.[1]).toBe(SEED_ANCHOR_DAY)
  })

  it('counts whole days in both directions, across months and years', () => {
    expect(day(0)).toBe(SEED_ANCHOR_DAY)
    expect(day(1)).toBe('2026-08-21')
    expect(day(-3)).toBe('2026-08-17')
    // Over a month boundary, over a year boundary, and over a 29-day February.
    expect(day(12)).toBe('2026-09-01')
    expect(day(134)).toBe('2027-01-01')
    expect(day(558)).toBe('2028-02-29')
    expect(day(-285)).toBe('2025-11-08')
  })

  it('refuses a fractional offset rather than rounding one', () => {
    expect(() => day(1.5)).toThrow(TypeError)
  })

  it('reports the distance back to the anchor, floored at today', () => {
    expect(daysFromAnchor(day(50))).toBe(50)
    expect(daysFromAnchor(day(-7))).toBe(0)
    expect(daysFromAnchor(null)).toBe(0)
    expect(daysFromAnchor('not a date')).toBe(0)
  })

  it('places instants inside the day they name', () => {
    expect(SEED_ANCHOR_INSTANT.toISOString()).toBe(
      `${SEED_ANCHOR_DAY}T12:00:00.000Z`,
    )
    expect(instantOn(-12).toISOString()).toBe('2026-08-08T12:00:00.000Z')
    expect(instantOn(0, '06:30').toISOString()).toBe(
      `${SEED_ANCHOR_DAY}T06:30:00.000Z`,
    )
    expect(minutesBeforeAnchor(95).toISOString()).toBe(
      `${SEED_ANCHOR_DAY}T10:25:00.000Z`,
    )
  })

  it('builds a recurring calendar fact in the anchor year, and rejects a date that is not one', () => {
    expect(anchorYearDay('12-24')).toBe(`${String(SEED_ANCHOR_YEAR)}-12-24`)
    expect(() => anchorYearDay('02-30')).toThrow(TypeError)
  })

  it('lets biography stay absolute, and only biography', () => {
    expect(historic('2011-07-14')).toBe('2011-07-14')
    expect(() => historic('2026-08-17')).toThrow(RangeError)
    expect(() => historic('2010-02-31')).toThrow(TypeError)
  })
})

describe('the seed writes no clock and no randomness', () => {
  it('never reaches for the wall clock, except the stopwatch that reports the run', () => {
    for (const [path, source] of seedSources()) {
      // `new Date(...)` with an argument is arithmetic on a fixture value and is fine; the
      // zero-argument form is the machine's clock and is not.
      const code = withoutComments(source)
      expect(code, `${path} constructs a Date from the wall clock`).not.toMatch(
        /new Date\(\)/,
      )
      // `apply.ts` keeps one: the stopwatch behind the report's `durationMs`, which is measured and
      // never written to a row.
      if (!path.endsWith('apply.ts')) {
        expect(code, `${path} reads Date.now()`).not.toMatch(/Date\.now\(\)/)
      }
    }
  })

  it('never draws from a random source', () => {
    for (const [path, source] of seedSources()) {
      const code = withoutComments(source)
      expect(code, `${path} calls Math.random()`).not.toMatch(/Math\.random\(/)
      expect(code, `${path} calls getRandomValues()`).not.toMatch(
        /getRandomValues\(/,
      )
      expect(code, `${path} mints a nanoid`).not.toMatch(/nanoid\(/)
    }
  })

  it('leaves no bare calendar literal in the dataset', () => {
    // Anchored offsets, `anchorYearDay('MM-DD')` and `historic('YYYY-MM-DD')` are the three ways a
    // date may be written. A bare `'2026-10-09'` is the fourth, and it is what rots.
    for (const file of [
      'flagship.ts',
      'trips.ts',
      'workspace.ts',
      'index.ts',
    ]) {
      const source = readFileSync(join(SEED_ROOT, 'dataset', file), 'utf8')
      const bare = source
        .replaceAll(/historic\('\d{4}-\d{2}-\d{2}'\)/g, '')
        .match(/'\d{4}-\d{2}-\d{2}'/g)
      expect(bare ?? [], `dataset/${file} carries an unanchored date`).toEqual(
        [],
      )
    }
  })
})

describe('the fixture the authenticated baselines photograph', () => {
  const anchor = SEED_ANCHOR_DAY

  /**
   * ISO `YYYY-MM-DD` sorts lexicographically, which is how the repositories compare it: string
   * comparison, no timezone, no off-by-one at midnight. The assertions below read the same way.
   */
  const ordered = (...days: ReadonlyArray<string | undefined>): boolean =>
    days.every(
      (value, index) =>
        value !== undefined &&
        (index === 0 || value >= (days[index - 1] ?? '')),
    )

  it('keeps one trip under way on the anchor day', () => {
    expect(lisbonTrip.startDate).toBeDefined()
    expect(lisbonTrip.endDate).toBeDefined()
    // `listUpcomingTrips` keeps a trip while `endDate >= today`; the dashboard hero is the first.
    expect(ordered(lisbonTrip.startDate, anchor, lisbonTrip.endDate)).toBe(true)
    expect(lisbonTrip.status).toBe('active')
  })

  it('keeps two trips finished, so the journal has a backlog', () => {
    // `listTripsWithoutJourney` ranks a trip as finished on `endDate < today`.
    expect(ordered(dolomitesTrip.endDate, anchor)).toBe(true)
    expect(dolomitesTrip.endDate).not.toBe(anchor)
    expect(ordered(marrakechTrip.endDate, dolomitesTrip.endDate)).toBe(true)
  })

  it('keeps the flagship ahead of the anchor by seven weeks', () => {
    expect(flagshipTrip.startDate).toBe(day(50))
    expect(flagshipTrip.endDate).toBe(day(61))
    expect(ordered(anchor, flagshipTrip.startDate)).toBe(true)
  })

  it('keeps one trip with no dates at all', () => {
    expect(patagoniaTrip.startDate).toBeUndefined()
    expect(patagoniaTrip.endDate).toBeUndefined()
  })

  it('keeps the reservation rail non-empty, in both trips that feed it', () => {
    // The rail reads forward from today (`startDate >= today`) across every trip. A reservation's
    // date is its trip's start plus `startDay - 1`, so a dated trip that has not finished and
    // carries reservations is what puts rows in the rail.
    const ahead = trips.filter((trip) => {
      const end = trip.endDate
      return (
        end !== undefined &&
        end >= anchor &&
        (trip.reservations ?? []).length > 0
      )
    })
    expect(ahead.map((trip) => trip.slug)).toEqual([
      flagshipTrip.slug,
      lisbonTrip.slug,
    ])
  })
})
