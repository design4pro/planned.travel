import { describe, expect, it } from 'vitest'
import {
  clampRailWidth,
  plannerDaysPreference,
  plannerLayoutPreference,
} from '../plan-layout'

describe('planner layout', () => {
  it('keeps widths local and unfolded days session-lived, both bounded by trip', () => {
    expect(plannerLayoutPreference.area).toBe('local')
    expect(plannerDaysPreference.area).toBe('session')
    expect(plannerLayoutPreference.limit).toBe(8)
    expect(plannerDaysPreference.limit).toBe(8)
  })
  it('clamps finite widths and falls back for malformed widths', () => {
    expect(clampRailWidth(99, 344)).toBe(280)
    expect(clampRailWidth(999, 344)).toBe(400)
    expect(clampRailWidth(312, 344)).toBe(312)
    for (const value of [NaN, Infinity, '300', null]) {
      expect(clampRailWidth(value, 344)).toBe(344)
    }
  })
})
