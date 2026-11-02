import { describe, expect, it } from 'vitest'
import { budgetItems, expenses } from '#/server/db/schema'
import {
  createBudgetItem,
  createExpense,
  getExpenseWithShares,
  repriceExpense,
  updateBudgetItem,
} from '../expenses'
import { addTripMember, createTrip } from '../trips'
import { createHarness } from './harness'
import type { TenantScope } from '../base'
import type { Database } from '#/server/db/types'

const TRIPLE = {
  originalAmountMinor: 8000,
  originalCurrency: 'GBP',
  exchangeRate: 1.125,
}
const CLEARED = {
  originalAmountMinor: null,
  originalCurrency: null,
  exchangeRate: null,
}

// Inject a committed edit after the repository read, immediately before it builds its write.
function racingScope(
  scope: TenantScope,
  table: unknown,
  edit: () => void,
): TenantScope {
  let pending = true
  const db: Database = new Proxy(scope.db, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target)
      if (typeof value !== 'function') return value
      if (property === 'update')
        return (writing: unknown) => {
          if (pending && writing === table) {
            pending = false
            edit()
          }
          return value.call(target, writing)
        }
      return value.bind(target)
    },
  })
  return { db, ctx: scope.ctx }
}

describe('money source fields follow the row at write time', () => {
  it.each(
    [false, true].flatMap((split) =>
      ['amount', 'currency', 'preserve'].map((kind) => ({ split, kind })),
    ),
  )(
    'repricing with split=$split and concurrent $kind edit',
    async ({ split, kind }) => {
      const h = await createHarness()
      try {
        const t = await h.seedTenant('race')
        const trip = await createTrip(t.scope, {
          title: 'Lisbon',
          startDate: '2026-04-10',
          endDate: '2026-04-13',
          currency: 'EUR',
        })
        const target = split || kind === 'preserve' ? 20000 : 10000
        const { expense, shares: before } = await createExpense(t.scope, {
          tripId: trip.id,
          title: 'Hotel',
          amountMinor: 10000,
          currency: 'EUR',
          spentOn: '2026-04-11',
          ...(split
            ? {
                participants: [{ userId: t.ownerUserId }],
                splitMethod: 'equal' as const,
              }
            : {}),
        })
        h.sqlite
          .prepare(
            'update expense_shares set is_settled = 1 where expense_id = ?',
          )
          .run(expense.id)
        const scope = racingScope(t.scope, expenses, () => {
          h.sqlite
            .prepare(
              'update expenses set amount_minor = ?, currency = ?, original_amount_minor = ?, original_currency = ?, exchange_rate = ? where id = ?',
            )
            .run(
              kind === 'amount' ? 9000 : target,
              kind === 'currency' ? 'USD' : 'EUR',
              TRIPLE.originalAmountMinor,
              TRIPLE.originalCurrency,
              TRIPLE.exchangeRate,
              expense.id,
            )
        })
        const result = await repriceExpense(scope, trip.id, expense.id, {
          title: 'Hotel Baixa',
          amountMinor: target,
          currency: 'EUR',
        })
        const expected = {
          amountMinor: target,
          currency: 'EUR',
          ...(kind === 'preserve' ? TRIPLE : CLEARED),
        }
        expect(result.expense).toMatchObject(expected)
        expect(
          (await getExpenseWithShares(t.scope, expense.id)).expense,
        ).toMatchObject(expected)
        expect(result.splitStale).toBe(false)
        expect(result.shares.map((s) => s.id)).toEqual(before.map((s) => s.id))
        if (split)
          expect(result.shares).toMatchObject([
            { shareMinor: target, isSettled: true },
          ])
      } finally {
        h.close()
      }
    },
  )

  it.each([
    'amount-clear',
    'currency-clear',
    'amount-preserve',
    'currency-preserve',
    'metadata',
  ])('budget update with concurrent %s edit', async (kind) => {
    const h = await createHarness()
    try {
      const t = await h.seedTenant('budget-race')
      const trip = await createTrip(t.scope, {
        title: 'Lisbon',
        startDate: '2026-04-10',
        endDate: '2026-04-13',
        currency: 'EUR',
      })
      const item = await createBudgetItem(t.scope, {
        tripId: trip.id,
        name: 'Hotel',
        plannedAmountMinor: 10000,
        currency: 'EUR',
      })
      const preserve = kind.endsWith('preserve')
      const amount = preserve ? 20000 : 9000
      const currency = preserve ? 'USD' : 'GBP'
      const scope = racingScope(t.scope, budgetItems, () => {
        h.sqlite
          .prepare(
            'update budget_items set planned_amount_minor = ?, currency = ?, original_amount_minor = ?, original_currency = ?, exchange_rate = ? where id = ?',
          )
          .run(
            amount,
            currency,
            TRIPLE.originalAmountMinor,
            TRIPLE.originalCurrency,
            TRIPLE.exchangeRate,
            item.id,
          )
      })
      let patch: {
        plannedAmountMinor?: number
        currency?: string
        name?: string
      } = { name: 'Hotel Baixa' }
      if (kind.startsWith('amount'))
        patch = { plannedAmountMinor: preserve ? 20000 : 10000 }
      if (kind.startsWith('currency'))
        patch = { currency: preserve ? 'USD' : 'EUR' }
      const result = await updateBudgetItem(scope, trip.id, item.id, patch)
      expect(result).toMatchObject({
        ...patch,
        ...(preserve || kind === 'metadata' ? TRIPLE : CLEARED),
      })
      expect(
        h.sqlite
          .prepare(
            'select original_amount_minor from budget_items where id = ?',
          )
          .get(item.id),
      ).toEqual({
        original_amount_minor: preserve || kind === 'metadata' ? 8000 : null,
      })
      if (!kind.startsWith('amount'))
        expect(result.plannedAmountMinor).toBe(amount)
      if (!kind.startsWith('currency')) expect(result.currency).toBe(currency)
    } finally {
      h.close()
    }
  })
})

describe('source writers refuse unrelated rows', () => {
  it.each(
    ['budget', 'expense', 'split-expense'].flatMap((writer) =>
      ['tenant', 'trip', 'viewer'].map((denial) => ({ writer, denial })),
    ),
  )(
    '$writer refuses $denial without changing the row',
    async ({ writer, denial }) => {
      const h = await createHarness()
      try {
        const t = await h.seedTenant('guards')
        const trip = await createTrip(t.scope, {
          title: 'Lisbon',
          startDate: '2026-04-10',
          endDate: '2026-04-13',
          currency: 'EUR',
        })
        const item = await createBudgetItem(t.scope, {
          tripId: trip.id,
          name: 'Hotel',
          plannedAmountMinor: 10000,
          currency: 'EUR',
        })
        const { expense } = await createExpense(t.scope, {
          tripId: trip.id,
          title: 'Hotel',
          amountMinor: 10000,
          currency: 'EUR',
          spentOn: '2026-04-11',
          ...(writer === 'split-expense'
            ? { participants: [{ userId: t.ownerUserId }] }
            : {}),
        })
        let scope = t.scope
        let requestedTrip = trip.id
        if (denial === 'tenant') scope = (await h.seedTenant('other')).scope
        if (denial === 'trip')
          requestedTrip = (
            await createTrip(t.scope, {
              title: 'Porto',
              startDate: '2026-04-10',
              endDate: '2026-04-13',
              currency: 'EUR',
            })
          ).id
        if (denial === 'viewer') {
          const viewer = await t.addUser('Viewer')
          await addTripMember(t.scope, {
            tripId: trip.id,
            userId: viewer,
            role: 'viewer',
          })
          scope = t.scopeFor(viewer)
        }
        const beforeExpense = await getExpenseWithShares(t.scope, expense.id)
        const beforeBudget = h.sqlite
          .prepare('select * from budget_items where id = ?')
          .get(item.id)
        if (writer === 'budget')
          await expect(
            updateBudgetItem(scope, requestedTrip, item.id, {
              plannedAmountMinor: 20000,
            }),
          ).rejects.toThrow()
        else
          await expect(
            repriceExpense(scope, requestedTrip, expense.id, {
              title: 'Changed',
              amountMinor: 20000,
              currency: 'EUR',
            }),
          ).rejects.toThrow()
        expect(await getExpenseWithShares(t.scope, expense.id)).toEqual(
          beforeExpense,
        )
        expect(
          h.sqlite
            .prepare('select * from budget_items where id = ?')
            .get(item.id),
        ).toEqual(beforeBudget)
      } finally {
        h.close()
      }
    },
  )
})
