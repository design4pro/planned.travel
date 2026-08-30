/**
 * The forecast arithmetic, including the cases where it declines to produce a number.
 *
 * The refusals get as much attention as the formulas, because they are the part a reader is most
 * likely to "fix" later: a `null` looks like a gap, and filling it with a projection from three
 * hours of data would make the screen look complete while telling the operator something no data
 * supports. Each of the three is pinned here with the reason in the test name.
 */

import { describe, expect, it } from 'vitest'
import {
  HOURS_PER_MONTH,
  MAX_FORECAST_HOURS,
  forecast,
  hoursRemainingInMonth,
  meterTone,
  projectAtScale,
} from '../providers'
import type { UsagePoint } from '../providers'

/** Hourly points ending at `endBucket`, one call each, going back `hours`. */
function series(
  endMs: number,
  hours: number,
  callsEach = 1,
): Array<UsagePoint> {
  const points: Array<UsagePoint> = []
  for (let i = 0; i < hours; i += 1) {
    points.push({
      bucket: new Date(endMs - i * 3_600_000).toISOString().slice(0, 13),
      calls: callsEach,
    })
  }
  return points
}

const NOW = new Date('2026-08-30T18:00:00.000Z')

describe('hoursRemainingInMonth', () => {
  it('counts to the first hour of the next month', () => {
    // 30 Aug 18:00 → 1 Sep 00:00 is 30 hours.
    expect(hoursRemainingInMonth(NOW)).toBe(30)
  })

  it('is zero in the last hour of a month', () => {
    expect(hoursRemainingInMonth(new Date('2026-08-31T23:30:00.000Z'))).toBe(0)
  })

  it('handles a leap February, where a hard-coded month length would be wrong', () => {
    expect(hoursRemainingInMonth(new Date('2028-02-01T00:00:00.000Z'))).toBe(
      29 * 24,
    )
  })
})

describe('forecast', () => {
  it('declines to project below a day of observation, and says it is provisional', () => {
    const measuringSince = new Date(NOW.getTime() - 3 * 3_600_000)
      .toISOString()
      .slice(0, 13)

    const result = forecast({
      now: NOW,
      series: series(NOW.getTime(), 3, 10),
      monthToDate: 30,
      activeWorkspaces: 2,
      measuringSince,
    })

    expect(result.provisional).toBe(true)
    expect(result.monthEnd).toBeNull()
    expect(result.runRate).toBeNull()
    expect(result.perWorkspace).toBeNull()
    // The measurement itself is still reported — it is the projection that is withheld.
    expect(result.windowCalls).toBe(30)
    expect(result.windowHours).toBe(3)
  })

  it('projects month-end from calls already made plus the hours left', () => {
    const measuringSince = new Date(NOW.getTime() - 48 * 3_600_000)
      .toISOString()
      .slice(0, 13)

    const result = forecast({
      now: NOW,
      series: series(NOW.getTime(), 48, 2),
      monthToDate: 96,
      activeWorkspaces: 4,
      measuringSince,
    })

    expect(result.provisional).toBe(false)
    // 96 calls over 48 hours = 2/hour; 30 hours left ⇒ 96 + 60.
    expect(result.monthEnd).toBeCloseTo(156, 5)
    expect(result.runRate).toBeCloseTo(2 * HOURS_PER_MONTH, 5)
  })

  it('averages per workspace, which is the measured counterpart of the assumed workload', () => {
    const measuringSince = new Date(NOW.getTime() - 730 * 3_600_000)
      .toISOString()
      .slice(0, 13)

    const result = forecast({
      now: NOW,
      series: series(NOW.getTime(), 730, 4),
      monthToDate: 0,
      activeWorkspaces: 4,
      measuringSince,
    })

    // 4 calls/hour over a month-long window, shared by 4 workspaces ⇒ 730 each per month.
    expect(result.perWorkspace).toBeCloseTo(HOURS_PER_MONTH, 0)
  })

  it('caps the window, so a long quiet history cannot depress the current rate', () => {
    const measuringSince = new Date(NOW.getTime() - 5000 * 3_600_000)
      .toISOString()
      .slice(0, 13)

    const result = forecast({
      now: NOW,
      series: series(NOW.getTime(), 5000, 1),
      monthToDate: 0,
      activeWorkspaces: 1,
      measuringSince,
    })

    expect(result.windowHours).toBe(MAX_FORECAST_HOURS)
    // Only the calls inside the cap are counted, or the rate would divide a longer numerator by a
    // shorter denominator and read high.
    expect(result.windowCalls).toBe(MAX_FORECAST_HOURS)
    expect(result.runRate).toBeCloseTo(HOURS_PER_MONTH, 5)
  })

  it('has no per-workspace figure when only the platform has called', () => {
    const measuringSince = new Date(NOW.getTime() - 48 * 3_600_000)
      .toISOString()
      .slice(0, 13)

    const result = forecast({
      now: NOW,
      series: series(NOW.getTime(), 48, 1),
      monthToDate: 48,
      activeWorkspaces: 0,
      measuringSince,
    })

    expect(result.perWorkspace).toBeNull()
    // The other two are still meaningful without any workspace traffic.
    expect(result.runRate).not.toBeNull()
    expect(result.monthEnd).not.toBeNull()
  })

  it('reports nothing measured when the provider has never been called', () => {
    const result = forecast({
      now: NOW,
      series: [],
      monthToDate: 0,
      activeWorkspaces: 0,
      measuringSince: null,
    })

    expect(result.windowCalls).toBe(0)
    expect(result.monthEnd).toBeNull()
    expect(result.provisional).toBe(true)
  })
})

describe('projectAtScale', () => {
  it('multiplies the per-workspace rate by the workspace count', () => {
    expect(projectAtScale(250, 40)).toBe(10_000)
  })

  it('refuses rather than inventing a rate when none was measured', () => {
    expect(projectAtScale(250, null)).toBeNull()
  })

  it('never returns a negative projection', () => {
    expect(projectAtScale(-5, 40)).toBe(0)
  })
})

describe('meterTone', () => {
  it('steps at the provider’s own thresholds, not at hard-coded ones', () => {
    expect(meterTone(50, 100, 70, 90)).toBe('brand')
    expect(meterTone(75, 100, 70, 90)).toBe('warning')
    expect(meterTone(95, 100, 70, 90)).toBe('danger')

    // A vendor with a hard cap can warn earlier, and the same usage reads differently.
    expect(meterTone(50, 100, 40, 60)).toBe('warning')
  })

  it('warns at exactly the threshold rather than one call past it', () => {
    expect(meterTone(70, 100, 70, 90)).toBe('warning')
    expect(meterTone(90, 100, 70, 90)).toBe('danger')
  })

  it('treats a ceiling of zero as spent rather than dividing by it', () => {
    expect(meterTone(0, 0, 70, 90)).toBe('danger')
  })
})
