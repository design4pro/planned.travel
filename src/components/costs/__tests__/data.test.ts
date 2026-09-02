import { describe, expect, it } from 'vitest'

import {
  applyOps,
  csvFilename,
  dailySeries,
  dayOptions,
  expensesCsv,
  filterExpenses,
  formatDayLabel,
  formatDayShort,
  groupByDay,
  isFiltered,
  isOptimisticId,
  optimisticId,
  parseDay,
  shareOf,
  toDayString,
  totalsFor,
} from '../data'

import type { CostsFilters, CostsOp } from '../data'
import type {
  CostsExpense,
  CostsPayload,
  CostsPerson,
  CostsSettlement,
} from '#/server/fns/costs'

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const PEOPLE: Array<CostsPerson> = [
  {
    userId: 'u-rafal',
    name: 'Rafal',
    email: 'rafal@example.test',
    image: null,
    role: 'owner',
  },
  {
    userId: 'u-mika',
    name: 'Mika',
    email: 'mika@example.test',
    image: null,
    role: 'member',
  },
  {
    userId: 'u-jonas',
    name: 'Jonas',
    email: 'jonas@example.test',
    image: null,
    role: 'member',
  },
]

function expense(overrides: Partial<CostsExpense> = {}): CostsExpense {
  return {
    id: 'e-1',
    title: 'Shinkansen seats',
    category: 'transport',
    amountMinor: 30_000,
    currency: 'JPY',
    originalAmountMinor: null,
    originalCurrency: null,
    exchangeRate: null,
    spentOn: '2026-07-04',
    paidBy: 'u-rafal',
    splitMethod: 'equal',
    notes: null,
    shares: [
      { userId: 'u-rafal', shareMinor: 10_000, weight: 1, isSettled: false },
      { userId: 'u-mika', shareMinor: 10_000, weight: 1, isSettled: false },
      { userId: 'u-jonas', shareMinor: 10_000, weight: 1, isSettled: false },
    ],
    ...overrides,
  }
}

const ROWS: Array<CostsExpense> = [
  expense(),
  expense({
    id: 'e-2',
    title: 'Outbound flights',
    category: 'transport',
    amountMinor: 464_880,
    originalAmountMinor: 238_400,
    originalCurrency: 'GBP',
    exchangeRate: 195,
    spentOn: '2026-06-28',
    paidBy: 'u-mika',
    notes: 'Booked on the Avios sale',
    shares: [
      { userId: 'u-rafal', shareMinor: 154_960, weight: 1, isSettled: false },
      { userId: 'u-mika', shareMinor: 154_960, weight: 1, isSettled: false },
      { userId: 'u-jonas', shareMinor: 154_960, weight: 1, isSettled: false },
    ],
  }),
  expense({
    id: 'e-3',
    title: 'Konbini run',
    category: 'food',
    amountMinor: 4_800,
    spentOn: '2026-07-04',
    paidBy: null,
    shares: [],
  }),
]

const SETTLEMENT: CostsSettlement = {
  id: 's-1',
  fromUserId: 'u-jonas',
  toUserId: 'u-rafal',
  amountMinor: 40_000,
  currency: 'JPY',
  method: 'bank_transfer',
  settledOn: '2026-07-06',
  note: null,
}

const PAYLOAD: CostsPayload = {
  tripId: 't-1',
  currency: 'JPY',
  today: '2026-07-08',
  startDate: '2026-06-28',
  endDate: '2026-07-09',
  plannedMinor: 600_000,
  spentMinor: 499_680,
  budgetTargetMinor: 800_000,
  expenseCount: 3,
  byCategory: [
    {
      category: 'transport',
      plannedMinor: 500_000,
      spentMinor: 494_880,
      expenseCount: 2,
    },
    {
      category: 'food',
      plannedMinor: 100_000,
      spentMinor: 4_800,
      expenseCount: 1,
    },
  ],
  expenses: ROWS,
  balances: [
    {
      userId: 'u-rafal',
      paidMinor: 30_000,
      shareMinor: 164_960,
      settledOutMinor: 0,
      settledInMinor: 40_000,
      balanceMinor: -174_960,
    },
    {
      userId: 'u-mika',
      paidMinor: 464_880,
      shareMinor: 164_960,
      settledOutMinor: 0,
      settledInMinor: 0,
      balanceMinor: 299_920,
    },
    {
      userId: 'u-jonas',
      paidMinor: 0,
      shareMinor: 164_960,
      settledOutMinor: 40_000,
      settledInMinor: 0,
      balanceMinor: -124_960,
    },
  ],
  settlements: [SETTLEMENT],
  suggestions: [
    { fromUserId: 'u-rafal', toUserId: 'u-mika', amountMinor: 174_960 },
  ],
  people: PEOPLE,
  viewerUserId: 'u-rafal',
}

const ALL: CostsFilters = {
  q: undefined,
  category: undefined,
  day: undefined,
  view: 'all',
}

/* -------------------------------------------------------------------------- */

describe('dates', () => {
  it('reads a spent-on column in UTC, not in the reader’s zone', () => {
    expect(toDayString(parseDay('2026-07-04') ?? new Date(0))).toBe(
      '2026-07-04',
    )
  })

  it('returns null for a column it cannot use', () => {
    expect(parseDay('')).toBeNull()
    expect(parseDay(null)).toBeNull()
    expect(parseDay('not-a-date')).toBeNull()
  })

  it('labels a day the way the group header needs it', () => {
    expect(formatDayLabel('2026-07-04')).toBe('Sat 4 Jul')
    expect(formatDayShort('2026-07-04')).toBe('4 Jul')
  })

  it('falls back to the raw column rather than rendering "Invalid Date"', () => {
    expect(formatDayLabel('whenever--')).toBe('whenever--')
  })
})

describe('shareOf', () => {
  it('finds a traveller’s own responsibility', () => {
    expect(shareOf(ROWS[0], 'u-mika')).toBe(10_000)
  })

  it('is zero for someone left out of the split', () => {
    expect(shareOf(ROWS[2], 'u-mika')).toBe(0)
  })
})

describe('filterExpenses', () => {
  it('returns everything when nothing is filtered', () => {
    expect(filterExpenses(ROWS, ALL, PEOPLE, 'u-rafal')).toHaveLength(3)
  })

  it('matches the search across title, notes, category and payer', () => {
    expect(
      filterExpenses(ROWS, { ...ALL, q: 'konbini' }, PEOPLE, 'u-rafal'),
    ).toHaveLength(1)
    expect(
      filterExpenses(ROWS, { ...ALL, q: 'avios' }, PEOPLE, 'u-rafal'),
    ).toHaveLength(1)
    expect(
      filterExpenses(ROWS, { ...ALL, q: 'transport' }, PEOPLE, 'u-rafal'),
    ).toHaveLength(2)
    expect(
      filterExpenses(ROWS, { ...ALL, q: 'mika' }, PEOPLE, 'u-rafal'),
    ).toHaveLength(1)
  })

  it('ignores case and surrounding space in the search', () => {
    expect(
      filterExpenses(ROWS, { ...ALL, q: '  SHINKANSEN ' }, PEOPLE, 'u-rafal'),
    ).toHaveLength(1)
  })

  it('filters by category and by day', () => {
    expect(
      filterExpenses(ROWS, { ...ALL, category: 'food' }, PEOPLE, 'u-rafal'),
    ).toHaveLength(1)
    expect(
      filterExpenses(ROWS, { ...ALL, day: '2026-07-04' }, PEOPLE, 'u-rafal'),
    ).toHaveLength(2)
  })

  it('shows only what the viewer paid for in the "paid by me" view', () => {
    const rows = filterExpenses(
      ROWS,
      { ...ALL, view: 'paid' },
      PEOPLE,
      'u-rafal',
    )
    expect(rows.map((row) => row.id)).toEqual(['e-1'])
  })

  it('shows only what the viewer paid and split with others in "I’m owed"', () => {
    expect(
      filterExpenses(ROWS, { ...ALL, view: 'owed' }, PEOPLE, 'u-rafal'),
    ).toHaveLength(1)
    // Mika paid the flights, so nothing is owed *to* Rafal on that row.
    expect(
      filterExpenses(ROWS, { ...ALL, view: 'owed' }, PEOPLE, 'u-jonas'),
    ).toHaveLength(0)
  })

  it('excludes an expense the viewer paid entirely for themselves from "I’m owed"', () => {
    const solo = expense({
      id: 'e-solo',
      paidBy: 'u-rafal',
      shares: [
        { userId: 'u-rafal', shareMinor: 30_000, weight: 1, isSettled: false },
      ],
    })
    expect(
      filterExpenses([solo], { ...ALL, view: 'owed' }, PEOPLE, 'u-rafal'),
    ).toHaveLength(0)
  })

  it('combines filters rather than replacing them', () => {
    expect(
      filterExpenses(
        ROWS,
        {
          q: 'shinkansen',
          category: 'transport',
          day: '2026-07-04',
          view: 'paid',
        },
        PEOPLE,
        'u-rafal',
      ),
    ).toHaveLength(1)
  })
})

describe('isFiltered', () => {
  it('is false only for the untouched default', () => {
    expect(isFiltered(ALL)).toBe(false)
    expect(isFiltered({ ...ALL, q: '   ' })).toBe(false)
    expect(isFiltered({ ...ALL, q: 'x' })).toBe(true)
    expect(isFiltered({ ...ALL, view: 'paid' })).toBe(true)
    expect(isFiltered({ ...ALL, category: 'food' })).toBe(true)
    expect(isFiltered({ ...ALL, day: '2026-07-04' })).toBe(true)
  })
})

describe('groupByDay', () => {
  it('groups newest first and totals each day', () => {
    const groups = groupByDay(ROWS)
    expect(groups.map((group) => group.day)).toEqual([
      '2026-07-04',
      '2026-06-28',
    ])
    expect(groups[0].totalMinor).toBe(34_800)
    expect(groups[1].totalMinor).toBe(464_880)
  })

  it('has no groups for no rows', () => {
    expect(groupByDay([])).toEqual([])
  })

  it('lists the distinct days newest first', () => {
    expect(dayOptions(ROWS)).toEqual(['2026-07-04', '2026-06-28'])
  })

  it('builds the spend curve oldest first, without inventing empty days', () => {
    expect(dailySeries(ROWS)).toEqual([464_880, 34_800])
  })
})

describe('applyOps — the empty queue', () => {
  it('hands back the repository’s own aggregates, by reference', () => {
    const snapshot = applyOps(PAYLOAD, [])
    expect(snapshot.expenses).toBe(PAYLOAD.expenses)
    expect(snapshot.balances).toBe(PAYLOAD.balances)
    expect(snapshot.byCategory).toBe(PAYLOAD.byCategory)
    expect(snapshot.suggestions).toBe(PAYLOAD.suggestions)
    expect(snapshot.spentMinor).toBe(PAYLOAD.spentMinor)
    expect(snapshot.busy).toBe(false)
    expect(snapshot.busyExpenseIds.size).toBe(0)
  })
})

describe('applyOps — create', () => {
  const created = expense({
    id: 'pending-abc',
    title: 'Ryokan dinner',
    category: 'food',
    amountMinor: 9_000,
    spentOn: '2026-07-05',
    paidBy: 'u-jonas',
    shares: [
      { userId: 'u-rafal', shareMinor: 3_000, weight: 1, isSettled: false },
      { userId: 'u-mika', shareMinor: 3_000, weight: 1, isSettled: false },
      { userId: 'u-jonas', shareMinor: 3_000, weight: 1, isSettled: false },
    ],
  })
  const ops: Array<CostsOp> = [{ kind: 'create', key: 'k1', row: created }]

  it('shows the row immediately and marks it busy', () => {
    const snapshot = applyOps(PAYLOAD, ops)
    expect(snapshot.expenses.map((row) => row.id)).toContain('pending-abc')
    expect(snapshot.busyExpenseIds.has('pending-abc')).toBe(true)
    expect(snapshot.busy).toBe(true)
  })

  it('moves the spend, the count and the category total by the same amount', () => {
    const snapshot = applyOps(PAYLOAD, ops)
    expect(snapshot.spentMinor).toBe(PAYLOAD.spentMinor + 9_000)
    expect(snapshot.expenseCount).toBe(4)
    expect(
      snapshot.byCategory.find((row) => row.category === 'food')?.spentMinor,
    ).toBe(13_800)
    expect(
      snapshot.byCategory.find((row) => row.category === 'food')?.expenseCount,
    ).toBe(2)
  })

  it('credits the payer and debits every share', () => {
    const snapshot = applyOps(PAYLOAD, ops)
    const balance = (userId: string): number =>
      snapshot.balances.find((row) => row.userId === userId)?.balanceMinor ?? 0
    expect(balance('u-jonas')).toBe(-124_960 + 9_000 - 3_000)
    expect(balance('u-rafal')).toBe(-174_960 - 3_000)
    expect(balance('u-mika')).toBe(299_920 - 3_000)
  })

  it('re-derives the settle-up suggestions from the moved balances', () => {
    const snapshot = applyOps(PAYLOAD, ops)
    const owedToMika = snapshot.suggestions
      .filter((row) => row.toUserId === 'u-mika')
      .reduce((sum, row) => sum + row.amountMinor, 0)
    expect(owedToMika).toBe(296_920)
  })

  it('puts a traveller with no ledger yet on the board', () => {
    const withNewcomer: Array<CostsOp> = [
      {
        kind: 'create',
        key: 'k2',
        row: expense({
          id: 'pending-new',
          paidBy: 'u-priya',
          amountMinor: 1_000,
          shares: [
            {
              userId: 'u-priya',
              shareMinor: 1_000,
              weight: 1,
              isSettled: false,
            },
          ],
        }),
      },
    ]
    const snapshot = applyOps(PAYLOAD, withNewcomer)
    expect(
      snapshot.balances.find((row) => row.userId === 'u-priya')?.balanceMinor,
    ).toBe(0)
  })
})

describe('applyOps — update', () => {
  it('replaces the row and applies the difference, not the whole amount', () => {
    const previous = ROWS[0]
    const next = expense({
      ...previous,
      amountMinor: 60_000,
      title: 'Green car upgrade',
    })
    const snapshot = applyOps(PAYLOAD, [
      { kind: 'update', key: 'k1', previous, row: next },
    ])
    expect(snapshot.expenses.find((row) => row.id === 'e-1')?.title).toBe(
      'Green car upgrade',
    )
    expect(snapshot.spentMinor).toBe(PAYLOAD.spentMinor + 30_000)
    expect(snapshot.expenseCount).toBe(PAYLOAD.expenseCount)
    expect(snapshot.busyExpenseIds.has('e-1')).toBe(true)
  })

  it('moves the total out of the old category and into the new one', () => {
    const previous = ROWS[0]
    const next = expense({ ...previous, category: 'food' })
    const snapshot = applyOps(PAYLOAD, [
      { kind: 'update', key: 'k1', previous, row: next },
    ])
    expect(
      snapshot.byCategory.find((row) => row.category === 'transport')
        ?.spentMinor,
    ).toBe(464_880)
    expect(
      snapshot.byCategory.find((row) => row.category === 'food')?.spentMinor,
    ).toBe(34_800)
  })

  it('re-points the ledger when the payer changes', () => {
    const previous = ROWS[0]
    const next = expense({ ...previous, paidBy: 'u-mika' })
    const snapshot = applyOps(PAYLOAD, [
      { kind: 'update', key: 'k1', previous, row: next },
    ])
    const balance = (userId: string): number =>
      snapshot.balances.find((row) => row.userId === userId)?.balanceMinor ?? 0
    expect(balance('u-rafal')).toBe(-174_960 - 30_000)
    expect(balance('u-mika')).toBe(299_920 + 30_000)
  })
})

describe('applyOps — delete', () => {
  it('removes the row and unwinds exactly what it contributed', () => {
    const snapshot = applyOps(PAYLOAD, [
      { kind: 'delete', key: 'k1', previous: ROWS[0] },
    ])
    expect(snapshot.expenses.map((row) => row.id)).not.toContain('e-1')
    expect(snapshot.spentMinor).toBe(PAYLOAD.spentMinor - 30_000)
    expect(snapshot.expenseCount).toBe(2)
    expect(
      snapshot.balances.find((row) => row.userId === 'u-rafal')?.balanceMinor,
    ).toBe(-174_960 - 30_000 + 10_000)
  })

  it('never drives an aggregate below zero, whatever order the queue is in', () => {
    const snapshot = applyOps({ ...PAYLOAD, spentMinor: 0, expenseCount: 0 }, [
      { kind: 'delete', key: 'k1', previous: ROWS[0] },
    ])
    expect(snapshot.spentMinor).toBe(0)
    expect(snapshot.expenseCount).toBe(0)
  })
})

describe('applyOps — payment', () => {
  const payment: CostsSettlement = {
    id: 'pending-pay',
    fromUserId: 'u-rafal',
    toUserId: 'u-mika',
    amountMinor: 174_960,
    currency: 'JPY',
    method: 'bank_transfer',
    settledOn: '2026-07-08',
    note: null,
  }

  it('leads the payments list and clears both sides of the balance', () => {
    const snapshot = applyOps(PAYLOAD, [
      { kind: 'payment', key: 'k1', row: payment },
    ])
    expect(snapshot.settlements[0].id).toBe('pending-pay')
    expect(snapshot.settlements).toHaveLength(2)
    expect(
      snapshot.balances.find((row) => row.userId === 'u-rafal')?.balanceMinor,
    ).toBe(0)
    expect(
      snapshot.balances.find((row) => row.userId === 'u-mika')?.balanceMinor,
    ).toBe(124_960)
  })

  it('drops the suggestion it satisfied', () => {
    const snapshot = applyOps(PAYLOAD, [
      { kind: 'payment', key: 'k1', row: payment },
    ])
    expect(
      snapshot.suggestions.some(
        (row) => row.fromUserId === 'u-rafal' && row.toUserId === 'u-mika',
      ),
    ).toBe(false)
  })

  it('leaves the expense list untouched', () => {
    const snapshot = applyOps(PAYLOAD, [
      { kind: 'payment', key: 'k1', row: payment },
    ])
    expect(snapshot.expenses).toHaveLength(3)
    expect(snapshot.busyExpenseIds.size).toBe(0)
  })
})

describe('totalsFor', () => {
  it('reports the viewer’s side of the ledger', () => {
    const totals = totalsFor(applyOps(PAYLOAD, []), 'u-rafal')
    expect(totals.owesMinor).toBe(174_960)
    expect(totals.owedMinor).toBe(0)
    expect(totals.viewerShareMinor).toBe(164_960)
    expect(totals.viewerPaidMinor).toBe(30_000)
  })

  it('reports the other side for a creditor', () => {
    const totals = totalsFor(applyOps(PAYLOAD, []), 'u-mika')
    expect(totals.owesMinor).toBe(0)
    expect(totals.owedMinor).toBe(299_920)
  })

  it('counts the receipts nobody has claimed', () => {
    const totals = totalsFor(applyOps(PAYLOAD, []), 'u-rafal')
    expect(totals.unclaimedMinor).toBe(4_800)
    expect(totals.unclaimedCount).toBe(1)
  })

  it('is all zeroes for a traveller with no money on the trip', () => {
    const totals = totalsFor(applyOps(PAYLOAD, []), 'u-nobody')
    expect(totals.owesMinor).toBe(0)
    expect(totals.owedMinor).toBe(0)
    expect(totals.viewerShareMinor).toBe(0)
    expect(totals.viewerPaidMinor).toBe(0)
  })
})

describe('expensesCsv', () => {
  const BOM = '\ufeff'
  const csv = expensesCsv({
    rows: ROWS,
    people: PEOPLE,
    viewerUserId: 'u-rafal',
  })
  const lines = csv.slice(BOM.length).trimEnd().split('\r\n')

  it('leads with a byte-order mark so Excel reads the symbols', () => {
    expect(csv.startsWith(BOM)).toBe(true)
  })

  it('writes one header row and one row per expense', () => {
    expect(lines).toHaveLength(4)
    expect(lines[0]).toContain('"Date"')
    expect(lines[0]).toContain('"Your share"')
  })

  it('writes amounts unformatted so a spreadsheet reads them as numbers', () => {
    expect(lines[1]).toContain('"30,000"')
    expect(lines[1]).toContain('"JPY"')
  })

  it('carries the source amount and currency of a foreign receipt', () => {
    expect(lines[2]).toContain('"2,384.00"')
    expect(lines[2]).toContain('"GBP"')
    expect(lines[2]).toContain('"195.0000"')
  })

  it('leaves the source columns empty for a receipt in the trip currency', () => {
    expect(lines[1]).toContain('"30,000","JPY","","",""')
  })

  it('names the payer, and leaves it blank when nobody has claimed it', () => {
    expect(lines[1]).toContain('"Rafal"')
    expect(lines[3]).toContain('"","equal"')
  })

  it('quotes and escapes a title that would otherwise break the row', () => {
    const tricky = expensesCsv({
      rows: [expense({ title: 'Dinner, "the good one"\nwith wine' })],
      people: PEOPLE,
      viewerUserId: 'u-rafal',
    })
    expect(tricky).toContain('"Dinner, ""the good one""\nwith wine"')
  })

  /** A spreadsheet treats a leading `=` as a formula, and titles are user text. */
  it('defuses a field a spreadsheet would run as a formula', () => {
    const injected = expensesCsv({
      rows: [expense({ title: '=1+1' })],
      people: PEOPLE,
      viewerUserId: 'u-rafal',
    })
    expect(injected).toContain(`"'=1+1"`)
  })

  it('writes only the header when there is nothing to export', () => {
    const empty = expensesCsv({
      rows: [],
      people: PEOPLE,
      viewerUserId: 'u-rafal',
    })
    expect(empty.slice(BOM.length).trimEnd().split('\r\n')).toHaveLength(1)
  })
})

describe('csvFilename', () => {
  it('slugs the trip title and dates the file', () => {
    expect(csvFilename('Tokyo & Kyoto', '2026-08-19')).toBe(
      'tokyo-kyoto-expenses-2026-08-19.csv',
    )
  })

  it('still produces a usable name for a title with nothing to slug', () => {
    expect(csvFilename('  ···  ', '2026-08-19')).toBe(
      'trip-expenses-2026-08-19.csv',
    )
  })
})

describe('optimisticId', () => {
  it('is recognisable as a row the server has never seen', () => {
    const id = optimisticId()
    expect(isOptimisticId(id)).toBe(true)
    expect(isOptimisticId('e-1')).toBe(false)
  })

  it('does not collide across a burst of writes', () => {
    const ids = new Set(Array.from({ length: 200 }, () => optimisticId()))
    expect(ids.size).toBeGreaterThan(190)
  })
})
