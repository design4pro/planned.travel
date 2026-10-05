import { describe, expect, it } from 'vitest'

import { inclusiveDays, shiftDate } from '../trip-dates'

describe('inclusiveDays', () => {
  it('counts both ends', () => {
    expect(inclusiveDays('2026-06-01', '2026-06-01')).toBe(1)
    expect(inclusiveDays('2026-06-01', '2026-06-07')).toBe(7)
  })

  it('is not moved by a daylight-saving change', () => {
    expect(inclusiveDays('2026-03-28', '2026-03-30')).toBe(3)
  })

  it('refuses an inverted or malformed range', () => {
    expect(inclusiveDays('2026-06-07', '2026-06-01')).toBeNull()
    expect(inclusiveDays('nope', '2026-06-01')).toBeNull()
  })
})

describe('shiftDate', () => {
  it('moves across a month end in both directions', () => {
    expect(shiftDate('2026-01-30', 3)).toBe('2026-02-02')
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('refuses a malformed date', () => {
    expect(shiftDate('', 1)).toBeNull()
  })
})
