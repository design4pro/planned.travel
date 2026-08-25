import { describe, expect, it } from 'vitest'

import { formatDate } from '#/lib/format'
import { formatConsoleInstant } from '../instant'

/**
 * The regression test for a session list that printed `25 Aug 2026, 2026-`.
 *
 * The cause was passing a full instant to `formatTime`, which is a `HH:MM` *column* formatter and
 * slices the first five characters — `'2026-'` for an ISO string. The console needs the clock time
 * out of an instant, which no formatter in `#/lib/format` provides.
 */
describe('formatConsoleInstant', () => {
  it('prints the day the product prints, plus the clock time in UTC', () => {
    const instant = '2026-08-25T14:05:09.123Z'
    expect(formatConsoleInstant(instant)).toBe(
      `${formatDate(instant) ?? ''}, 14:05 UTC`,
    )
  })

  it('never mistakes the year for the hour', () => {
    // The exact shape of the defect: the first five characters of an ISO instant are its year.
    expect(formatConsoleInstant('2026-08-25T14:05:09.123Z')).not.toContain(
      '2026-,',
    )
    expect(formatConsoleInstant('2026-08-25T00:00:00.000Z')).toContain(
      '00:00 UTC',
    )
  })

  it('reads midnight and the last minute of the day', () => {
    expect(formatConsoleInstant('2026-01-01T00:00:00.000Z')).toContain(
      '00:00 UTC',
    )
    expect(formatConsoleInstant('2026-12-31T23:59:59.999Z')).toContain(
      '23:59 UTC',
    )
  })

  it('accepts exactly what a projection produces', () => {
    // `toConsoleSession` sends `Date.prototype.toISOString()`, whose shape the language fixes.
    const iso = new Date(Date.UTC(2026, 5, 15, 9, 7, 0)).toISOString()
    expect(formatConsoleInstant(iso)).toContain('09:07 UTC')
  })

  it('refuses anything that is not an instant rather than slicing it', () => {
    expect(formatConsoleInstant(null)).toBe('—')
    expect(formatConsoleInstant('')).toBe('—')
    expect(formatConsoleInstant('2026-08-25')).toBe('—')
    expect(formatConsoleInstant('not a date')).toBe('—')
  })
})
