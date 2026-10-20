import { describe, expect, it } from 'vitest'
import { blockedReason, daysToWrite } from '../day-rules'
import { ENTRY_KINDS, ENTRY_KIND_COST, KIND_COST_LINE } from '../entry-kinds'
import { moveDay } from '../week'

describe('leave day rules', () => {
  const rules = {
    blockWeekends: true,
    companyHolidaysEnabled: true,
    companyHolidays: new Set(['2026-08-03']),
  }
  it('uses one cost vocabulary for every picker line', () => {
    for (const kind of ENTRY_KINDS)
      expect(ENTRY_KIND_COST[kind]).toBe(
        { full: 1, half: 0.5, none: 0 }[KIND_COST_LINE[kind]],
      )
  })
  it('skips blocked days and charges only the written days', () => {
    expect(daysToWrite('2026-08-01', '2026-08-05', 'half_day', rules)).toEqual({
      dates: ['2026-08-04', '2026-08-05'],
      skipped: 3,
      cost: 1,
    })
    expect(blockedReason('2026-08-01', rules)).toBe('weekend')
    expect(() =>
      daysToWrite('2026-01-01', '2027-01-02', 'vacation', rules),
    ).toThrow(RangeError)
  })
  it('crosses months, clamps month length and stops at year ends', () => {
    expect(moveDay('2026-01-31', 'ArrowRight', false)).toBe('2026-02-01')
    expect(moveDay('2026-01-31', 'PageDown', false)).toBe('2026-02-28')
    expect(moveDay('2026-01-01', 'ArrowLeft', false)).toBe('2026-01-01')
    expect(moveDay('2026-12-31', 'ArrowRight', false)).toBe('2026-12-31')
    expect(moveDay('2026-08-03', 'ArrowLeft', true)).toBe('2026-08-04')
    expect(moveDay('2026-08-01', 'Home', false)).toBe('2026-07-27')
    expect(moveDay('2026-08-31', 'End', false)).toBe('2026-09-06')
  })
})
