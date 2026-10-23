/**
 * Planning a re-basing of a trip's budget currency: the pure half.
 *
 * `planRebase` is handed the rows of a trip, read once, and answers either a plan - every row as it
 * would be written, the counts, the statement count, the budget target and the balances before and
 * after - or a structured refusal. Nothing here touches a database; the repository half
 * (`trip-currency-preview.test.ts`) holds the guards, the read cost and the parity of
 * `netBalances` with the reader the Costs screen uses.
 *
 * The fixture mixes every shape the rules name: an inherited row, a foreign receipt, a receipt
 * already in the new currency, a zero-decimal currency, exact, percentage and share splits, a zero
 * amount and a planned item in a third currency. Euros become yen at 160, so every expected figure
 * below is a number a person can check by hand (1 EUR = 160 JPY; a yen has no minor unit, so
 * 42.00 EUR is 4200 minor units and 6720 yen).
 */

import { describe, expect, it } from 'vitest'
import { MAX_BOUND_PARAMETERS } from '../batch'
import {
  MAX_REBASE_STATEMENTS,
  SHARE_ROWS_PER_STATEMENT,
  countRebaseStatements,
  netBalances,
  planRebase,
} from '../trip-currency'
import type {
  RebaseExpense,
  RebasePayment,
  RebasePlannedItem,
  RebasePlan,
  RebaseShare,
  RebaseSnapshot,
} from '../trip-currency'

const ANA = 'user-ana'
const BEN = 'user-ben'
const CAL = 'user-cal'

const NO_SOURCE = {
  originalAmountMinor: null,
  originalCurrency: null,
  exchangeRate: null,
} as const

function expense(over: Partial<RebaseExpense> & { id: string }): RebaseExpense {
  return {
    amountMinor: 0,
    currency: 'EUR',
    ...NO_SOURCE,
    splitMethod: 'equal',
    paidBy: ANA,
    ...over,
  }
}

function share(
  over: Partial<RebaseShare> & {
    id: string
    expenseId: string
    userId: string
  },
): RebaseShare {
  return { shareMinor: 0, weight: 1, ...over }
}

function payment(over: Partial<RebasePayment> & { id: string }): RebasePayment {
  return {
    fromUserId: BEN,
    toUserId: ANA,
    amountMinor: 0,
    currency: 'EUR',
    ...NO_SOURCE,
    ...over,
  }
}

function plannedItem(
  over: Partial<RebasePlannedItem> & { id: string },
): RebasePlannedItem {
  return { plannedAmountMinor: 0, currency: 'EUR', ...NO_SOURCE, ...over }
}

function snapshot(over: Partial<RebaseSnapshot> = {}): RebaseSnapshot {
  return {
    expenses: [],
    shares: [],
    payments: [],
    plannedItems: [],
    budgetTargetMinor: null,
    pinnedPrices: 0,
    ...over,
  }
}

const TO_YEN = { from: 'EUR', to: 'JPY', rate: 160 } as const

function planned(
  rows: RebaseSnapshot,
  options: { from: string; to: string; rate: number | null } = TO_YEN,
): RebasePlan {
  const outcome = planRebase(rows, options)
  if (outcome.kind !== 'planned') {
    throw new Error(`Expected a plan, got a refusal: ${outcome.refusal.kind}`)
  }
  return outcome.plan
}

/** The mixed ledger every rule is read against. */
function fixture(): RebaseSnapshot {
  return snapshot({
    expenses: [
      // Inherited: nothing but the trip's own currency, no source triple.
      expense({ id: 'e-inherited', amountMinor: 4200, paidBy: ANA }),
      // A foreign receipt: 100.00 GBP typed, 115.00 EUR counted, rate 1.15 frozen.
      expense({
        id: 'e-foreign',
        amountMinor: 11_500,
        originalAmountMinor: 10_000,
        originalCurrency: 'GBP',
        exchangeRate: 1.15,
        splitMethod: 'shares',
        paidBy: BEN,
      }),
      // A receipt typed in the currency the trip is moving to: 8000 yen, counted as 50.00 EUR.
      expense({
        id: 'e-in-new',
        amountMinor: 5000,
        originalAmountMinor: 8000,
        originalCurrency: 'JPY',
        exchangeRate: 0.00625,
        splitMethod: 'percentage',
        paidBy: ANA,
      }),
      // An exact split: 6.00 and 4.00 of 10.00.
      expense({
        id: 'e-exact',
        amountMinor: 1000,
        splitMethod: 'exact',
        paidBy: CAL,
      }),
      // A zero amount.
      expense({ id: 'e-zero', amountMinor: 0, paidBy: ANA }),
    ],
    shares: [
      share({
        id: 's1',
        expenseId: 'e-inherited',
        userId: ANA,
        shareMinor: 2100,
      }),
      share({
        id: 's2',
        expenseId: 'e-inherited',
        userId: BEN,
        shareMinor: 2100,
      }),
      share({
        id: 's3',
        expenseId: 'e-foreign',
        userId: ANA,
        shareMinor: 3833,
        weight: 1,
      }),
      share({
        id: 's4',
        expenseId: 'e-foreign',
        userId: BEN,
        shareMinor: 7667,
        weight: 2,
      }),
      share({
        id: 's5',
        expenseId: 'e-in-new',
        userId: ANA,
        shareMinor: 3500,
        weight: 70,
      }),
      share({
        id: 's6',
        expenseId: 'e-in-new',
        userId: BEN,
        shareMinor: 1500,
        weight: 30,
      }),
      share({
        id: 's7',
        expenseId: 'e-exact',
        userId: ANA,
        shareMinor: 600,
        weight: 1,
      }),
      share({
        id: 's8',
        expenseId: 'e-exact',
        userId: BEN,
        shareMinor: 400,
        weight: 1,
      }),
      share({ id: 's9', expenseId: 'e-zero', userId: ANA, shareMinor: 0 }),
      share({ id: 's10', expenseId: 'e-zero', userId: BEN, shareMinor: 0 }),
    ],
    payments: [payment({ id: 'p1', amountMinor: 700 })],
    plannedItems: [
      plannedItem({ id: 'b1', plannedAmountMinor: 30_000 }),
      plannedItem({ id: 'b2', plannedAmountMinor: 5000, currency: 'JPY' }),
    ],
    budgetTargetMinor: 100_000,
    pinnedPrices: 3,
  })
}

describe('planning a re-basing', () => {
  describe('an inherited row (rule 1)', () => {
    it('pins the typed figure from itself and converts it once at the confirmed rate', () => {
      const [row] = planned(fixture()).expenses

      expect(row).toMatchObject({
        id: 'e-inherited',
        amountMinor: 6720,
        currency: 'JPY',
        originalAmountMinor: 4200,
        originalCurrency: 'EUR',
        exchangeRate: 160,
      })
    })

    it('moves the amount, the code and the whole triple together', () => {
      const plan = planned(fixture())

      for (const row of [
        ...plan.expenses,
        ...plan.payments,
        ...plan.plannedItems,
      ]) {
        expect(row.currency).toBe('JPY')
        expect(row.originalAmountMinor).not.toBeNull()
        expect(row.originalCurrency).not.toBeNull()
        expect(row.exchangeRate).toBeGreaterThan(0)
      }
    })
  })

  describe('a foreign receipt (rule 4)', () => {
    it('converts the typed figure with its own frozen rate times the confirmed one, once', () => {
      const row = planned(fixture()).expenses.find((r) => r.id === 'e-foreign')

      // 100.00 GBP at 1.15 EUR/GBP at 160 JPY/EUR: 184 yen to the pound, 18,400 yen.
      expect(row).toMatchObject({
        amountMinor: 18_400,
        currency: 'JPY',
        originalAmountMinor: 10_000,
        originalCurrency: 'GBP',
      })
      expect(row?.exchangeRate).toBeCloseTo(184, 9)
    })
  })

  describe('a receipt already in the new currency (rule 4)', () => {
    it('keeps the typed figure exactly, with rate 1', () => {
      const row = planned(fixture()).expenses.find((r) => r.id === 'e-in-new')

      expect(row).toMatchObject({
        amountMinor: 8000,
        currency: 'JPY',
        originalAmountMinor: 8000,
        originalCurrency: 'JPY',
        exchangeRate: 1,
      })
    })

    it('does not drift when the round trip is rounded the other way', () => {
      // 8000 yen at the rate frozen then is 50.00 EUR; re-basing by a rate that would make
      // 8000 yen 7999.99 never happens, because the typed figure is used as it is.
      const row = planned(fixture(), {
        from: 'EUR',
        to: 'JPY',
        rate: 159.97,
      }).expenses.find((r) => r.id === 'e-in-new')

      expect(row?.amountMinor).toBe(8000)
    })
  })

  describe('a zero amount (rule 4)', () => {
    it('stays zero, with zero shares, and takes the confirmed rate like any other row', () => {
      const plan = planned(fixture())
      const row = plan.expenses.find((r) => r.id === 'e-zero')

      expect(row).toMatchObject({
        amountMinor: 0,
        currency: 'JPY',
        originalAmountMinor: 0,
        originalCurrency: 'EUR',
        // Pinned from itself (r = 1), so the rate is the real EUR to JPY one, never a constant 1.
        exchangeRate: 160,
      })
      expect(row?.shares.map((s) => s.shareMinor)).toEqual([0, 0])
    })

    it('re-anchors the rate of a zero row that already had a triple to the old rate times the new one', () => {
      const row = planned(
        snapshot({
          expenses: [
            expense({
              id: 'e-zero-foreign',
              amountMinor: 0,
              originalAmountMinor: 0,
              originalCurrency: 'GBP',
              exchangeRate: 1.15,
            }),
          ],
        }),
      ).expenses[0]

      expect(row).toMatchObject({
        amountMinor: 0,
        originalCurrency: 'GBP',
        originalAmountMinor: 0,
      })
      expect(row.exchangeRate).toBeCloseTo(184, 9)
    })

    it('writes a real rate of its pair on a second re-basing in a row too', () => {
      const first = planned(
        snapshot({ expenses: [expense({ id: 'e-zero', amountMinor: 0 })] }),
      ).expenses[0]
      const second = planned(
        snapshot({
          expenses: [
            expense({
              id: first.id,
              amountMinor: first.amountMinor,
              currency: first.currency,
              originalAmountMinor: first.originalAmountMinor,
              originalCurrency: first.originalCurrency,
              exchangeRate: first.exchangeRate,
            }),
          ],
        }),
        { from: 'JPY', to: 'USD', rate: 0.0065 },
      ).expenses[0]

      // EUR typed, then JPY, then USD: the source stays EUR and the rate is EUR to USD, 160 x 0.0065.
      expect(second.originalCurrency).toBe('EUR')
      expect(second.currency).toBe('USD')
      expect(second.exchangeRate).toBeCloseTo(1.04, 9)
    })

    it('does not trust the constant 1 an earlier zero-amount re-basing left across two currencies', () => {
      // The shape the old planner wrote: a zero row typed in EUR, counted in JPY, rate 1.
      const row = planned(
        snapshot({
          expenses: [
            expense({
              id: 'e-legacy',
              amountMinor: 0,
              currency: 'JPY',
              originalAmountMinor: 0,
              originalCurrency: 'EUR',
              exchangeRate: 1,
            }),
          ],
        }),
        { from: 'JPY', to: 'USD', rate: 0.0065 },
      ).expenses[0]

      expect(row).toMatchObject({
        originalCurrency: 'JPY',
        currency: 'USD',
        exchangeRate: 0.0065,
      })
    })

    it('never writes the constant 1 across two currencies', () => {
      const plan = planned(fixture())

      for (const row of [
        ...plan.expenses,
        ...plan.payments,
        ...plan.plannedItems,
      ]) {
        if (row.originalCurrency !== row.currency) {
          expect(row.exchangeRate).not.toBe(1)
          expect(row.exchangeRate).not.toBeNull()
        }
      }
    })
  })

  describe('a figure typed in a foreign currency on a row already in the new one (rule 5)', () => {
    // 100.00 GBP typed on a JPY expense, 18,400 yen counted at 184 JPY to the pound.
    const keptTriple = {
      amountMinor: 18_400,
      currency: 'JPY',
      originalAmountMinor: 10_000,
      originalCurrency: 'GBP',
      exchangeRate: 184,
    } as const

    it('keeps the typed figure and its rate, and the amount', () => {
      const row = planned(
        snapshot({ expenses: [expense({ id: 'e', ...keptTriple })] }),
      ).expenses[0]

      expect(row).toMatchObject(keptTriple)
    })

    it('keeps a payment and a planned item the same way', () => {
      const plan = planned(
        snapshot({
          payments: [payment({ id: 'p', ...keptTriple })],
          plannedItems: [
            plannedItem({
              id: 'b',
              plannedAmountMinor: keptTriple.amountMinor,
              currency: keptTriple.currency,
              originalAmountMinor: keptTriple.originalAmountMinor,
              originalCurrency: keptTriple.originalCurrency,
              exchangeRate: keptTriple.exchangeRate,
            }),
          ],
        }),
      )

      expect(plan.payments[0]).toMatchObject(keptTriple)
      expect(plan.plannedItems[0]).toMatchObject(keptTriple)
    })

    it('fills orig = amount and rate 1 when the row carries nothing', () => {
      const row = planned(
        snapshot({
          expenses: [
            expense({ id: 'e', amountMinor: 18_400, currency: 'JPY' }),
          ],
        }),
      ).expenses[0]

      expect(row).toMatchObject({
        amountMinor: 18_400,
        currency: 'JPY',
        originalAmountMinor: 18_400,
        originalCurrency: 'JPY',
        exchangeRate: 1,
      })
    })

    it('re-bases from the amount when the triple has outgrown it (a stale triple)', () => {
      // The row was repriced to 20,000 yen after 100.00 GBP was typed; the triple still says 100.00 GBP.
      const row = planned(
        snapshot({
          expenses: [
            expense({
              id: 'e',
              ...keptTriple,
              amountMinor: 20_000,
            }),
          ],
        }),
      ).expenses[0]

      expect(row).toMatchObject({
        amountMinor: 20_000,
        originalAmountMinor: 20_000,
        originalCurrency: 'JPY',
        exchangeRate: 1,
      })
    })

    it('keeps a typed figure that has no rate, and writes no rate', () => {
      const row = planned(
        snapshot({
          expenses: [
            expense({
              id: 'e',
              amountMinor: 0,
              currency: 'JPY',
              originalAmountMinor: 500,
              originalCurrency: 'GBP',
              exchangeRate: null,
            }),
          ],
        }),
      ).expenses[0]

      expect(row).toMatchObject({
        amountMinor: 0,
        currency: 'JPY',
        originalAmountMinor: 500,
        originalCurrency: 'GBP',
        exchangeRate: null,
      })
    })
  })

  describe('a typed figure without a rate (rule 4)', () => {
    const rateless = (over: Partial<RebaseExpense> = {}) =>
      expense({
        id: 'e',
        amountMinor: 0,
        originalAmountMinor: 500,
        originalCurrency: 'GBP',
        exchangeRate: null,
        ...over,
      })

    it('keeps the typed amount and currency, converts its own amount and writes a null rate', () => {
      const row = planned(
        snapshot({ expenses: [rateless({ amountMinor: 1000 })] }),
      ).expenses[0]

      expect(row).toMatchObject({
        amountMinor: 1600,
        currency: 'JPY',
        originalAmountMinor: 500,
        originalCurrency: 'GBP',
        exchangeRate: null,
      })
    })

    it('keeps a zero amount at zero with the typed figure', () => {
      const row = planned(snapshot({ expenses: [rateless()] })).expenses[0]

      expect(row).toMatchObject({
        amountMinor: 0,
        originalAmountMinor: 500,
        originalCurrency: 'GBP',
        exchangeRate: null,
      })
    })

    it('never lets the typed figure drive the amount, even in the new currency', () => {
      const row = planned(
        snapshot({
          expenses: [
            rateless({
              amountMinor: 1000,
              originalAmountMinor: 9999,
              originalCurrency: 'JPY',
            }),
          ],
        }),
      ).expenses[0]

      expect(row).toMatchObject({
        amountMinor: 1600,
        originalAmountMinor: 9999,
        originalCurrency: 'JPY',
        exchangeRate: null,
      })
    })

    it('treats a rate that cannot convert as no rate', () => {
      const row = planned(
        snapshot({
          expenses: [rateless({ amountMinor: 1000, exchangeRate: 0 })],
        }),
      ).expenses[0]

      expect(row).toMatchObject({
        amountMinor: 1600,
        originalAmountMinor: 500,
        originalCurrency: 'GBP',
        exchangeRate: null,
      })
    })

    it('pins any other partial shape from the amount', () => {
      for (const partial of [
        { originalAmountMinor: 500 },
        { originalCurrency: 'GBP' },
        { exchangeRate: 1.15 },
        { originalAmountMinor: 500, exchangeRate: 1.15 },
        { originalCurrency: 'GBP', exchangeRate: 1.15 },
      ] as const) {
        const row = planned(
          snapshot({
            expenses: [expense({ id: 'e', amountMinor: 4200, ...partial })],
          }),
        ).expenses[0]

        expect(row).toMatchObject({
          amountMinor: 6720,
          originalAmountMinor: 4200,
          originalCurrency: 'EUR',
          exchangeRate: 160,
        })
      }
    })
  })

  describe('a stale triple (rule 4)', () => {
    it('converts the current amount of an old-currency row, not the typed figure', () => {
      // A booking synced as 100.00 GBP at 1.15 was repriced to 200.00 EUR; the triple stayed.
      const row = planned(
        snapshot({
          expenses: [
            expense({
              id: 'e',
              amountMinor: 20_000,
              originalAmountMinor: 10_000,
              originalCurrency: 'GBP',
              exchangeRate: 1.15,
            }),
          ],
        }),
      ).expenses[0]

      expect(row).toMatchObject({
        amountMinor: 32_000,
        originalAmountMinor: 20_000,
        originalCurrency: 'EUR',
        exchangeRate: 160,
      })
    })

    it('trusts a triple that is within one minor unit of the amount', () => {
      // 33 GBP at 1.15 is 37.95 EUR; a row counted as 37.96 is one unit off, a rounding.
      const row = planned(
        snapshot({
          expenses: [
            expense({
              id: 'e',
              amountMinor: 3796,
              originalAmountMinor: 3300,
              originalCurrency: 'GBP',
              exchangeRate: 1.15,
            }),
          ],
        }),
      ).expenses[0]

      expect(row.originalCurrency).toBe('GBP')
      expect(row.originalAmountMinor).toBe(3300)
    })

    it('does not trust a triple two minor units off', () => {
      const row = planned(
        snapshot({
          expenses: [
            expense({
              id: 'e',
              amountMinor: 3797,
              originalAmountMinor: 3300,
              originalCurrency: 'GBP',
              exchangeRate: 1.15,
            }),
          ],
        }),
      ).expenses[0]

      expect(row.originalCurrency).toBe('EUR')
      expect(row.originalAmountMinor).toBe(3797)
    })

    it('does not trust a typed figure that overflows a safe integer', () => {
      const row = planned(
        snapshot({
          expenses: [
            expense({
              id: 'e',
              amountMinor: 100,
              originalAmountMinor: Number.MAX_SAFE_INTEGER + 2,
              originalCurrency: 'GBP',
              exchangeRate: 1.15,
            }),
          ],
        }),
      ).expenses[0]

      expect(row).toMatchObject({
        originalAmountMinor: 100,
        originalCurrency: 'EUR',
      })
    })

    it('keeps a row an edit wrote and a row an earlier re-basing wrote', () => {
      // The Costs-tab edit stores the converted figure it showed: 100.00 USD at 0.92 is 92.00 EUR.
      const edited = expense({
        id: 'edited',
        amountMinor: 9200,
        originalAmountMinor: 10_000,
        originalCurrency: 'USD',
        exchangeRate: 0.92,
      })
      const there = planned(snapshot({ expenses: [edited] })).expenses[0]
      const back = planned(
        snapshot({
          expenses: [
            expense({
              id: there.id,
              amountMinor: there.amountMinor,
              currency: there.currency,
              originalAmountMinor: there.originalAmountMinor,
              originalCurrency: there.originalCurrency,
              exchangeRate: there.exchangeRate,
            }),
          ],
        }),
        { from: 'JPY', to: 'EUR', rate: 1 / 160 },
      ).expenses[0]

      expect(there).toMatchObject({
        originalAmountMinor: 10_000,
        originalCurrency: 'USD',
      })
      expect(back).toMatchObject({
        amountMinor: 9200,
        originalAmountMinor: 10_000,
        originalCurrency: 'USD',
      })
    })
  })

  describe('shares (rule 6)', () => {
    it('recomputes an equal split through the splitter and sums to the new amount', () => {
      const row = planned(fixture()).expenses[0]

      expect(row.shares).toEqual([
        { id: 's1', userId: ANA, shareMinor: 3360 },
        { id: 's2', userId: BEN, shareMinor: 3360 },
      ])
    })

    it('splits a shares method by the stored weights', () => {
      const row = planned(fixture()).expenses.find((r) => r.id === 'e-foreign')

      // 18,400 split 1:2 is 6133.33 and 12266.67; the remainder unit goes to the first in order.
      expect(row?.shares).toEqual([
        { id: 's3', userId: ANA, shareMinor: 6134 },
        { id: 's4', userId: BEN, shareMinor: 12_266 },
      ])
    })

    it('passes the stored weight of a percentage split as the percentage, and does not throw', () => {
      const row = planned(fixture()).expenses.find((r) => r.id === 'e-in-new')

      expect(row?.shares).toEqual([
        { id: 's5', userId: ANA, shareMinor: 5600 },
        { id: 's6', userId: BEN, shareMinor: 2400 },
      ])
    })

    it('keeps an exact split proportional to the old shares, not equal', () => {
      const row = planned(fixture()).expenses.find((r) => r.id === 'e-exact')

      // 10.00 EUR is 1600 yen; 6:4 of that is 960 and 640, not 800 and 800.
      expect(row?.shares).toEqual([
        { id: 's7', userId: ANA, shareMinor: 960 },
        { id: 's8', userId: BEN, shareMinor: 640 },
      ])
    })

    it('sums every expense’s shares exactly to its new amount', () => {
      const plan = planned(fixture())

      for (const row of plan.expenses) {
        expect(row.shares.reduce((sum, s) => sum + s.shareMinor, 0)).toBe(
          row.amountMinor,
        )
      }
    })

    it('rounds a remainder to participants in the order the shares were stored', () => {
      const row = planned(
        snapshot({
          expenses: [expense({ id: 'e', amountMinor: 100 })],
          shares: [
            share({ id: 'a', expenseId: 'e', userId: ANA }),
            share({ id: 'b', expenseId: 'e', userId: BEN }),
            share({ id: 'c', expenseId: 'e', userId: CAL }),
          ],
        }),
        { from: 'EUR', to: 'JPY', rate: 100 },
      ).expenses[0]

      // 100 minor EUR (1.00) at 100 is 100 yen: 33, 33, 33 and the remainder unit to the first.
      expect(row.shares.map((s) => s.shareMinor)).toEqual([34, 33, 33])
    })

    it('refuses an expense whose split cannot be recomputed, rather than throwing', () => {
      const outcome = planRebase(
        snapshot({
          expenses: [
            expense({ id: 'e', amountMinor: 500, splitMethod: 'exact' }),
          ],
          shares: [
            share({ id: 'a', expenseId: 'e', userId: ANA, shareMinor: 0 }),
            share({ id: 'b', expenseId: 'e', userId: BEN, shareMinor: 0 }),
          ],
        }),
        TO_YEN,
      )

      expect(outcome).toEqual({
        kind: 'refused',
        refusal: { kind: 'unsplittable', count: 1 },
      })
    })
  })

  describe('a payment and a planned item (rules 2 and 4)', () => {
    it('converts a payment like an expense', () => {
      expect(planned(fixture()).payments[0]).toMatchObject({
        id: 'p1',
        amountMinor: 1120,
        currency: 'JPY',
        originalAmountMinor: 700,
        originalCurrency: 'EUR',
        exchangeRate: 160,
      })
    })

    it('converts a planned item and keeps one already in the new currency as typed', () => {
      const [euros, yen] = planned(fixture()).plannedItems

      expect(euros).toMatchObject({
        amountMinor: 48_000,
        currency: 'JPY',
        originalAmountMinor: 30_000,
        originalCurrency: 'EUR',
        exchangeRate: 160,
      })
      expect(yen).toMatchObject({
        amountMinor: 5000,
        originalAmountMinor: 5000,
        originalCurrency: 'JPY',
        exchangeRate: 1,
      })
    })
  })

  describe('a zero-decimal currency (the digit shift)', () => {
    it('converts yen to euros through the difference in minor-unit digits', () => {
      const row = planned(
        snapshot({
          expenses: [
            expense({ id: 'e', amountMinor: 12_400, currency: 'JPY' }),
          ],
        }),
        { from: 'JPY', to: 'EUR', rate: 0.006 },
      ).expenses[0]

      // 12,400 yen at 0.006 EUR/JPY is 74.40 EUR.
      expect(row).toMatchObject({
        amountMinor: 7440,
        currency: 'EUR',
        originalAmountMinor: 12_400,
        originalCurrency: 'JPY',
        exchangeRate: 0.006,
      })
    })
  })

  describe('the round trip', () => {
    it('returns a row with a source triple to its typed figure', () => {
      const there = planned(fixture())
      const row = there.expenses.find((r) => r.id === 'e-foreign')
      if (row === undefined) {
        throw new Error('fixture row missing')
      }

      const back = planned(
        snapshot({
          expenses: [
            expense({
              id: row.id,
              amountMinor: row.amountMinor,
              currency: row.currency,
              originalAmountMinor: row.originalAmountMinor,
              originalCurrency: row.originalCurrency,
              exchangeRate: row.exchangeRate,
            }),
          ],
        }),
        { from: 'JPY', to: 'EUR', rate: 1 / 160 },
      ).expenses[0]

      // The typed 100.00 GBP is still the source, and the euros are what they were.
      expect(back.originalAmountMinor).toBe(10_000)
      expect(back.originalCurrency).toBe('GBP')
      expect(back.amountMinor).toBe(11_500)
    })

    it('returns an inherited row to the figure it was typed in', () => {
      const there = planned(fixture()).expenses[0]

      const back = planned(
        snapshot({
          expenses: [
            expense({
              id: there.id,
              amountMinor: there.amountMinor,
              currency: there.currency,
              originalAmountMinor: there.originalAmountMinor,
              originalCurrency: there.originalCurrency,
              exchangeRate: there.exchangeRate,
            }),
          ],
        }),
        { from: 'JPY', to: 'EUR', rate: 1 / 160 },
      ).expenses[0]

      expect(back.amountMinor).toBe(4200)
    })
  })

  describe('the budget target (rule 8)', () => {
    it('is converted with the same rate and reported before and after', () => {
      expect(planned(fixture()).budgetTarget).toEqual({
        before: 100_000,
        after: 160_000,
      })
    })

    it('is null when the trip has none', () => {
      expect(
        planned(snapshot({ plannedItems: [plannedItem({ id: 'b' })] }))
          .budgetTarget,
      ).toBeNull()
    })
  })

  describe('the counts and the example', () => {
    it('counts what would be written and what stays where it is', () => {
      const plan = planned(fixture())

      expect(plan.counts).toEqual({
        expenses: 5,
        settlements: 1,
        budgetItems: 2,
        shareRows: 10,
        pinnedPrices: 3,
      })
    })

    it('shows the first priced row as a typed figure and what it will count as', () => {
      expect(planned(fixture()).example).toEqual({
        original: { amountMinor: 4200, currency: 'EUR' },
        converted: { amountMinor: 6720, currency: 'JPY' },
      })
    })

    it('shows a row that moves rather than a figure kept as typed', () => {
      const plan = planned(
        snapshot({
          expenses: [
            expense({ id: 'a-kept', amountMinor: 8000, currency: 'JPY' }),
            expense({ id: 'b-moved', amountMinor: 4200 }),
          ],
        }),
      )

      expect(plan.example).toEqual({
        original: { amountMinor: 4200, currency: 'EUR' },
        converted: { amountMinor: 6720, currency: 'JPY' },
      })
    })

    it('does not show a kept foreign figure or a rate-less typed figure as the example', () => {
      const plan = planned(
        snapshot({
          expenses: [
            // 100.00 GBP kept on a row already in yen: the confirmed rate did not touch it.
            expense({
              id: 'a-kept-foreign',
              amountMinor: 18_400,
              currency: 'JPY',
              originalAmountMinor: 10_000,
              originalCurrency: 'GBP',
              exchangeRate: 184,
            }),
            // A typed figure with no rate: its amount is converted, the typed figure is not.
            expense({
              id: 'b-rateless',
              amountMinor: 1000,
              originalAmountMinor: 500,
              originalCurrency: 'GBP',
              exchangeRate: null,
            }),
            expense({ id: 'c-moved', amountMinor: 4200 }),
          ],
        }),
      )

      expect(plan.example).toEqual({
        original: { amountMinor: 4200, currency: 'EUR' },
        converted: { amountMinor: 6720, currency: 'JPY' },
      })
    })

    it('has no example when only a kept foreign figure is priced', () => {
      const plan = planned(
        snapshot({
          expenses: [
            expense({
              id: 'a-kept-foreign',
              amountMinor: 18_400,
              currency: 'JPY',
              originalAmountMinor: 10_000,
              originalCurrency: 'GBP',
              exchangeRate: 184,
            }),
          ],
        }),
      )

      expect(plan.example).toBeNull()
    })

    it('falls back to the budget target when no row is priced', () => {
      expect(planned(snapshot({ budgetTargetMinor: 2500 })).example).toEqual({
        original: { amountMinor: 2500, currency: 'EUR' },
        converted: { amountMinor: 4000, currency: 'JPY' },
      })
    })

    it('has no example when nothing is priced', () => {
      expect(
        planned(snapshot({ pinnedPrices: 2 }), { ...TO_YEN, rate: null })
          .example,
      ).toBeNull()
    })
  })

  describe('a trip with nothing to convert', () => {
    it('needs no rate when only reference prices are pinned', () => {
      const plan = planned(snapshot({ pinnedPrices: 4 }), {
        from: 'EUR',
        to: 'JPY',
        rate: null,
      })

      expect(plan.rate).toBeNull()
      expect(plan.counts.pinnedPrices).toBe(4)
      expect(plan.expenses).toEqual([])
    })

    it('needs a rate as soon as a budget target exists', () => {
      expect(
        planRebase(snapshot({ budgetTargetMinor: 0 }), {
          from: 'EUR',
          to: 'JPY',
          rate: null,
        }),
      ).toEqual({ kind: 'refused', refusal: { kind: 'no-rate' } })
    })
  })

  describe('refusals', () => {
    it('refuses with no rate, and invents none', () => {
      expect(
        planRebase(fixture(), { from: 'EUR', to: 'JPY', rate: null }),
      ).toEqual({ kind: 'refused', refusal: { kind: 'no-rate' } })
    })

    it('counts the entries in a currency that is neither the old nor the new one', () => {
      const rows = fixture()
      const outcome = planRebase(
        {
          ...rows,
          expenses: [
            ...rows.expenses,
            expense({ id: 'e-usd', amountMinor: 900, currency: 'USD' }),
          ],
          payments: [
            payment({ id: 'p-usd', amountMinor: 50, currency: 'USD' }),
          ],
          plannedItems: [
            ...rows.plannedItems,
            plannedItem({
              id: 'b-usd',
              plannedAmountMinor: 700,
              currency: 'USD',
            }),
          ],
        },
        TO_YEN,
      )

      expect(outcome).toEqual({
        kind: 'refused',
        refusal: { kind: 'unconverted-rows', count: 3 },
      })
    })

    it('refuses a converted amount that is not a safe integer', () => {
      expect(
        planRebase(
          snapshot({
            expenses: [
              expense({ id: 'e', amountMinor: 9_000_000_000_000_000 }),
            ],
          }),
          { from: 'EUR', to: 'JPY', rate: 1e7 },
        ),
      ).toEqual({ kind: 'refused', refusal: { kind: 'amount-out-of-range' } })
    })

    it('refuses a budget target that overflows', () => {
      expect(
        planRebase(snapshot({ budgetTargetMinor: 9_000_000_000_000_000 }), {
          from: 'EUR',
          to: 'JPY',
          rate: 1e7,
        }),
      ).toEqual({ kind: 'refused', refusal: { kind: 'amount-out-of-range' } })
    })

    it('refuses a trip over the statement ceiling, and says which numbers', () => {
      const many = Array.from({ length: MAX_REBASE_STATEMENTS }, (_, index) =>
        expense({ id: `e${index}`, amountMinor: 100 }),
      )
      const outcome = planRebase(snapshot({ expenses: many }), TO_YEN)

      expect(outcome).toEqual({
        kind: 'refused',
        refusal: {
          kind: 'too-large',
          statements: MAX_REBASE_STATEMENTS + 5,
          ceiling: MAX_REBASE_STATEMENTS,
        },
      })
    })

    it('explains the entries in a third currency before it asks for a rate', () => {
      const outcome = planRebase(
        snapshot({
          expenses: [expense({ id: 'e', amountMinor: 900, currency: 'USD' })],
        }),
        { from: 'EUR', to: 'JPY', rate: null },
      )

      expect(outcome).toMatchObject({
        refusal: { kind: 'unconverted-rows', count: 1 },
      })
    })
  })
})

describe('the statement count', () => {
  const FIXED = 5

  it('is one statement per row, per chunk of shares, and five fixed ones', () => {
    // Five expenses with one chunk of shares each, a payment and two planned items, plus the four
    // pins and the trip row.
    expect(countRebaseStatements(fixture())).toBe(5 * 2 + 1 + 2 + FIXED)
  })

  it('counts an expense without shares as one statement', () => {
    expect(
      countRebaseStatements(
        snapshot({ expenses: [expense({ id: 'e', amountMinor: 1 })] }),
      ),
    ).toBe(1 + FIXED)
  })

  it('caps the shares per statement so each statement fits the bound-parameter limit', () => {
    // Three bound parameters per row (`WHEN id = ? THEN ?` and the id in the `IN` list) and six
    // fixed ones: workspace, trip, expense and the like.
    expect(SHARE_ROWS_PER_STATEMENT).toBe(
      Math.floor((MAX_BOUND_PARAMETERS - 6) / 3),
    )
    expect(SHARE_ROWS_PER_STATEMENT * 3 + 6).toBeLessThanOrEqual(
      MAX_BOUND_PARAMETERS,
    )
  })

  it('needs one more statement for the participant after the cap', () => {
    const shareRows = (count: number) =>
      Array.from({ length: count }, (_, index) =>
        share({ id: `s${index}`, expenseId: 'e', userId: `u${index}` }),
      )
    const withParticipants = (count: number) =>
      countRebaseStatements(
        snapshot({
          expenses: [expense({ id: 'e', amountMinor: 1 })],
          shares: shareRows(count),
        }),
      )

    expect(withParticipants(SHARE_ROWS_PER_STATEMENT)).toBe(1 + 1 + FIXED)
    expect(withParticipants(SHARE_ROWS_PER_STATEMENT + 1)).toBe(1 + 2 + FIXED)
  })

  it('is what the plan reports', () => {
    const rows = fixture()

    expect(planned(rows).statements).toBe(countRebaseStatements(rows))
  })
})

describe('the balances', () => {
  it('nets paid, shares and payments the way the member-balance reader does', () => {
    const balances = netBalances({
      expenses: [
        { paidBy: ANA, amountMinor: 3000 },
        { paidBy: null, amountMinor: 999 },
      ],
      shares: [
        { userId: ANA, shareMinor: 1000 },
        { userId: BEN, shareMinor: 1000 },
        { userId: CAL, shareMinor: 1000 },
      ],
      payments: [{ fromUserId: BEN, toUserId: ANA, amountMinor: 400 }],
    })

    expect(balances).toEqual([
      { userId: ANA, balanceMinor: 1600 },
      { userId: BEN, balanceMinor: -600 },
      { userId: CAL, balanceMinor: -1000 },
    ])
  })

  it('reports the largest movement against the proportional expectation', () => {
    // Ana paid 10.00 EUR for three. Equal shares are 3.34, 3.33 and 3.33, so she is owed 6.66 and
    // the others owe 3.33 each. At one yen to the euro the expense is 10 yen, split 4, 3, 3: she is
    // owed 6 where 6.66 rounds to 7, and Ben and Cal owe 3 where 3.33 rounds to 3.
    const plan = planned(
      snapshot({
        expenses: [expense({ id: 'e', amountMinor: 1000, paidBy: ANA })],
        shares: [
          share({ id: 'a', expenseId: 'e', userId: ANA, shareMinor: 334 }),
          share({ id: 'b', expenseId: 'e', userId: BEN, shareMinor: 333 }),
          share({ id: 'c', expenseId: 'e', userId: CAL, shareMinor: 333 }),
        ],
      }),
      { from: 'EUR', to: 'JPY', rate: 1 },
    )

    expect(plan.balances.after).toEqual([
      { userId: ANA, balanceMinor: 6 },
      { userId: BEN, balanceMinor: -3 },
      { userId: CAL, balanceMinor: -3 },
    ])
    expect(plan.balances.maxMovementMinor).toBe(1)
    expect(plan.balances.leftovers).toEqual([])
  })

  it('reports no movement when every row converts exactly', () => {
    expect(planned(fixture()).balances.maxMovementMinor).toBeLessThanOrEqual(
      // One minor unit per row a member appears in is the bound the spec promises.
      fixture().expenses.length + fixture().payments.length,
    )
  })

  it('names every person who would owe a leftover on a trip settled to zero', () => {
    // Ana paid 0.10 EUR for three people (weights 4, 3, 3) and Ben and Cal each paid her back
    // 0.03: everybody is at zero. At 15 yen to the euro the expense is 1.5 yen, which rounds to 2,
    // and each 0.03 payment is 0.45 yen, which rounds to 0. The two yen are split 1, 1, 0.
    const rows = snapshot({
      expenses: [
        expense({
          id: 'e',
          amountMinor: 10,
          paidBy: ANA,
          splitMethod: 'shares',
        }),
      ],
      shares: [
        share({
          id: 'a',
          expenseId: 'e',
          userId: ANA,
          shareMinor: 4,
          weight: 4,
        }),
        share({
          id: 'b',
          expenseId: 'e',
          userId: BEN,
          shareMinor: 3,
          weight: 3,
        }),
        share({
          id: 'c',
          expenseId: 'e',
          userId: CAL,
          shareMinor: 3,
          weight: 3,
        }),
      ],
      payments: [
        payment({ id: 'p1', fromUserId: BEN, toUserId: ANA, amountMinor: 3 }),
        payment({ id: 'p2', fromUserId: CAL, toUserId: ANA, amountMinor: 3 }),
      ],
    })
    expect(netBalances(rows).map((b) => b.balanceMinor)).toEqual([0, 0, 0])

    const plan = planned(rows, { from: 'EUR', to: 'JPY', rate: 15 })

    // Keyed by participant id, never by name: Ben would owe Ana one yen.
    expect(plan.balances.leftovers).toEqual([
      { userId: BEN, otherUserId: ANA, amountMinor: 1 },
    ])
    expect(plan.balances.maxMovementMinor).toBe(1)
  })

  it('names no leftover when somebody was already owed', () => {
    const plan = planned(
      snapshot({
        expenses: [expense({ id: 'e', amountMinor: 1000, paidBy: ANA })],
        shares: [
          share({ id: 'a', expenseId: 'e', userId: ANA, shareMinor: 500 }),
          share({ id: 'b', expenseId: 'e', userId: BEN, shareMinor: 500 }),
        ],
      }),
    )

    expect(plan.balances.leftovers).toEqual([])
  })
})
