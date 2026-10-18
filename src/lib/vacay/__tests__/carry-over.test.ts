import { describe, expect, it } from 'vitest'
import {
  CARRIED_OVER_MAX_DAYS,
  hasFractionalLeftover,
  walkCarryOver,
  wholeDaysThatCarry,
} from '../carry-over'
import type { CarryOverRow } from '../carry-over'

function row(
  year: number,
  entitlementDays: number,
  carriedOverDays: number,
  usedDays: number,
): CarryOverRow {
  return { year, entitlementDays, carriedOverDays, usedDays }
}

describe('wholeDaysThatCarry', () => {
  it.each([
    [10, 10],
    [4.5, 4],
    [0.5, 0],
    [0, 0],
    [-0.5, 0],
    [-3, 0],
    [365, 365],
    [366, 365],
    [730, 365],
  ])('carries %s as %s', (leftover, carried) => {
    expect(wholeDaysThatCarry(leftover)).toBe(carried)
  })
})

describe('hasFractionalLeftover', () => {
  it.each([
    [4.5, true],
    [0.5, true],
    [4, false],
    [0, false],
    [-0.5, false],
    [-3, false],
  ])('%s is %s', (leftover, fractional) => {
    expect(hasFractionalLeftover(leftover)).toBe(fractional)
  })
})

describe('walkCarryOver', () => {
  it('returns nothing for no rows', () => {
    expect(walkCarryOver([])).toEqual([])
  })

  it('leaves the stored value of a lone row, which is an opening balance', () => {
    expect(walkCarryOver([row(2026, 28, 7, 30)])).toEqual([7])
  })

  it('carries the leftover of one year into the next', () => {
    expect(walkCarryOver([row(2025, 28, 0, 20), row(2026, 28, 99, 0)])).toEqual(
      [0, 8],
    )
  })

  it('compounds the leftover down a chain, adding what was carried in', () => {
    const walked = walkCarryOver([
      row(2024, 25, 5, 20), // leftover 10
      row(2025, 25, 0, 30), // 25 + 10 - 30 = 5
      row(2026, 25, 0, 0), // 25 + 5 - 0 = 30
      row(2027, 25, 0, 0),
    ])

    expect(walked).toEqual([5, 10, 5, 30])
  })

  it('floors a half day and says nothing else about it', () => {
    expect(
      walkCarryOver([row(2025, 28, 0, 23.5), row(2026, 28, 0, 0)]),
    ).toEqual([0, 4])
  })

  it('never carries a debt, and starts the next year from zero', () => {
    const walked = walkCarryOver([
      row(2025, 10, 0, 14),
      row(2026, 10, 0, 4),
      row(2027, 10, 0, 0),
    ])

    expect(walked).toEqual([0, 0, 6])
  })

  it('caps the carried figure at the stored maximum instead of overflowing it', () => {
    const walked = walkCarryOver([row(2025, 365, 365, 0), row(2026, 365, 0, 0)])

    expect(walked).toEqual([365, CARRIED_OVER_MAX_DAYS])
  })

  it('breaks the chain at a missing year: the row after the gap is an opening balance', () => {
    const walked = walkCarryOver([
      row(2024, 28, 0, 0),
      row(2026, 28, 3, 0), // no 2025 row
      row(2027, 28, 0, 0),
    ])

    expect(walked).toEqual([0, 3, 31])
  })

  it('does not bridge a gap even when the earlier year has a leftover', () => {
    expect(walkCarryOver([row(2020, 100, 0, 0), row(2022, 28, 0, 0)])).toEqual([
      0, 0,
    ])
  })

  it('returns one figure per row, in the order given', () => {
    const rows = [row(2025, 28, 0, 0), row(2026, 28, 0, 0), row(2027, 28, 0, 0)]

    expect(walkCarryOver(rows)).toHaveLength(rows.length)
  })

  it('is stable: walking the walked figures again changes nothing', () => {
    const rows = [
      row(2024, 25, 5, 20),
      row(2025, 25, 0, 30),
      row(2026, 25, 0, 0),
    ]
    const first = walkCarryOver(rows)
    const again = walkCarryOver(
      rows.map((entry, index) => ({
        ...entry,
        carriedOverDays: first[index] ?? 0,
      })),
    )

    expect(again).toEqual(first)
  })

  it('agrees with the single-number helper on every input', () => {
    const entitlements = [0, 1, 25, 28, 365]
    const carries = [0, 3, 365]
    const used = [0, 0.5, 4, 27.5, 28, 100, 400, 730]

    for (const entitlement of entitlements) {
      for (const carried of carries) {
        for (const days of used) {
          const walked = walkCarryOver([
            row(2025, entitlement, carried, days),
            row(2026, 1, 1, 0),
          ])

          expect(walked[1]).toBe(
            wholeDaysThatCarry(entitlement + carried - days),
          )
        }
      }
    }
  })
})
