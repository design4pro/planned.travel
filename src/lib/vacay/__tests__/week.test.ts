import { describe, expect, it } from 'vitest'
import { weekColumns, leadingDays, moveDay } from '../week'

describe('the traveller’s week', () => {
  it.each([
    [0, [0, 1, 2, 3, 4, 5, 6], 4, '2026-08-02', '2026-08-08'],
    [1, [1, 2, 3, 4, 5, 6, 0], 3, '2026-08-03', '2026-08-09'],
    [6, [6, 0, 1, 2, 3, 4, 5], 5, '2026-08-01', '2026-08-07'],
  ])(
    'rotates columns, blanks and week ends for %i',
    (start, columns, blanks, home, end) => {
      expect(weekColumns(start)).toEqual(columns)
      expect(leadingDays(2026, 0, start)).toBe(blanks)
      expect(moveDay('2026-08-05', 'Home', false, start)).toBe(home)
      expect(moveDay('2026-08-05', 'End', true, start)).toBe(end)
    },
  )
})
