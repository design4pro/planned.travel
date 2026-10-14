/**
 * Previewing what a re-basing of a trip's budget currency would do: the repository half.
 *
 * `trip-currency-plan.test.ts` holds the arithmetic on plain rows. This file holds what only a
 * database can show: who may ask (the owner of a trip that is not archived, checked before a single
 * money row is read), that asking writes nothing, that the read cost is fixed however many expenses
 * the trip has, where the rate comes from, and that `netBalances` agrees with the reader the Costs
 * screen uses.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  budgetItems,
  expenseShares,
  expenses,
  places,
  settlements,
  trips,
} from '#/server/db/schema'
import { NotFoundError } from '../context'
import {
  createBudgetItem,
  createExpense,
  createSettlement,
  getMemberBalances,
} from '../expenses'
import { createPlace } from '../places'
import {
  TripArchivedError,
  TripRoleError,
  addTripMember,
  archiveTrip,
  createTrip,
  tripsRepository,
  updateTrip,
} from '../trips'
import {
  MAX_REBASE_STATEMENTS,
  netBalances,
  previewCurrencyChange,
  previewCurrencyChangeInput,
  previewCurrencyChangeRequest,
} from '../trip-currency'
import { captureError, createHarness, subscribeTenant } from './harness'
import type { Harness, SeededTenant } from './harness'

/** Every money table whole, so "nothing was written" is a comparison and not a hope. */
async function footprint(harness: Harness) {
  return {
    trips: await harness.db.select().from(trips),
    expenses: await harness.db.select().from(expenses),
    shares: await harness.db.select().from(expenseShares),
    settlements: await harness.db.select().from(settlements),
    budgetItems: await harness.db.select().from(budgetItems),
    places: await harness.db.select().from(places),
  }
}

/** The tables a preview must not touch before it knows the caller may ask. */
const MONEY_ROW_TABLES = /"(expenses|expense_shares|settlements|budget_items)"/

describe('previewing a change of a trip’s budget currency', () => {
  let harness: Harness
  let tenant: SeededTenant
  let travellerId: string
  let tripId: string

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('rebase')
    await subscribeTenant(tenant.scope, 'crew')
    travellerId = await tenant.addUser('Traveller')
    const trip = await createTrip(tenant.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })
    tripId = trip.id
    await addTripMember(tenant.scope, {
      tripId,
      userId: travellerId,
      role: 'editor',
    })
  })

  async function logDinner(amountMinor = 4200) {
    return createExpense(tenant.scope, {
      tripId,
      title: 'Dinner',
      amountMinor,
      spentOn: '2026-04-10',
      participants: [{ userId: tenant.ownerUserId }, { userId: travellerId }],
    })
  }

  describe('who may ask', () => {
    it('answers the owner of a trip', async () => {
      await logDinner()

      const preview = await previewCurrencyChange(tenant.scope, tripId, {
        to: 'JPY',
        rate: 160,
      })

      expect(preview.refusal).toBeNull()
      expect(preview.from).toBe('EUR')
      expect(preview.to).toBe('JPY')
    })

    it.each([
      ['an editor', 'editor'],
      ['a viewer', 'viewer'],
    ] as const)(
      'refuses %s, reading no money row first',
      async (_name, role) => {
        const other = await tenant.addUser(`A ${role}`)
        await addTripMember(tenant.scope, { tripId, userId: other, role })
        await logDinner()
        harness.statements.length = 0

        const refusal = await captureError(() =>
          previewCurrencyChange(tenant.scopeFor(other), tripId, {
            to: 'JPY',
            rate: 160,
          }),
        )

        expect(refusal).toBeInstanceOf(TripRoleError)
        expect(
          harness.statements.filter((s) => MONEY_ROW_TABLES.test(s)),
        ).toEqual([])
      },
    )

    it('refuses a workspace member who is not on an organization-visible trip, reading no money row first', async () => {
      // Seeing a trip is not travelling on it: only the trip's own owner role may ask.
      await updateTrip(tenant.scope, tripId, { visibility: 'organization' })
      const stranger = await tenant.addUser('Not on the trip')
      await logDinner()
      const before = await footprint(harness)
      harness.statements.length = 0

      const refusal = await captureError(() =>
        previewCurrencyChange(tenant.scopeFor(stranger), tripId, {
          to: 'JPY',
          rate: 160,
        }),
      )

      expect(refusal).toBeInstanceOf(TripRoleError)
      expect(
        harness.statements.filter((s) => MONEY_ROW_TABLES.test(s)),
      ).toEqual([])
      expect(await footprint(harness)).toEqual(before)
    })

    it('refuses an archived trip, reading no money row first', async () => {
      await logDinner()
      await archiveTrip(tenant.scope, tripId)
      harness.statements.length = 0

      const refusal = await captureError(() =>
        previewCurrencyChange(tenant.scope, tripId, { to: 'JPY', rate: 160 }),
      )

      expect(refusal).toBeInstanceOf(TripArchivedError)
      expect(
        harness.statements.filter((s) => MONEY_ROW_TABLES.test(s)),
      ).toEqual([])
    })

    it('does not know a trip that is not there', async () => {
      const refusal = await captureError(() =>
        previewCurrencyChange(tenant.scope, 'no-such-trip', { to: 'JPY' }),
      )

      expect(refusal).toBeInstanceOf(NotFoundError)
    })
  })

  describe('what it answers', () => {
    it('counts what would be converted, shows a worked example, and names no one by name', async () => {
      await logDinner()
      await createSettlement(tenant.scope, {
        tripId,
        fromUserId: travellerId,
        toUserId: tenant.ownerUserId,
        amountMinor: 700,
        settledOn: '2026-04-11',
      })
      await createBudgetItem(tenant.scope, {
        tripId,
        name: 'Food',
        plannedAmountMinor: 30_000,
      })
      await createPlace(tenant.scope, {
        tripId,
        name: 'Pastéis',
        priceMinor: 350,
      })
      await tripsRepository.requireUpdate(tenant.scope, tripId, {
        budgetTargetMinor: 100_000,
      })

      const preview = await previewCurrencyChange(tenant.scope, tripId, {
        to: 'JPY',
        rate: 160,
      })

      expect(preview).toMatchObject({
        from: 'EUR',
        to: 'JPY',
        rate: { value: 160, source: 'manual' },
        counts: {
          expenses: 1,
          settlements: 1,
          budgetItems: 1,
          shareRows: 2,
          pinnedPrices: 1,
        },
        example: {
          original: { amountMinor: 4200, currency: 'EUR' },
          converted: { amountMinor: 6720, currency: 'JPY' },
        },
        budgetTarget: { before: 100_000, after: 160_000 },
        refusal: null,
        ceiling: MAX_REBASE_STATEMENTS,
      })
      // One expense and its one chunk of shares, a payment, a planned item, and the five fixed ones.
      expect(preview.statements).toBe(2 + 1 + 1 + 5)
      expect(JSON.stringify(preview)).not.toContain('Traveller')
    })

    it('needs no rate on a trip whose only prices are reference prices', async () => {
      await createPlace(tenant.scope, {
        tripId,
        name: 'Pastéis',
        priceMinor: 350,
      })

      const preview = await previewCurrencyChange(tenant.scope, tripId, {
        to: 'JPY',
      })

      expect(preview.refusal).toBeNull()
      expect(preview.rate).toBeNull()
      expect(preview.counts.pinnedPrices).toBe(1)
    })

    it('says so when the new currency is the one the trip already has', async () => {
      const preview = await previewCurrencyChange(tenant.scope, tripId, {
        to: 'EUR',
      })

      expect(preview.refusal).toEqual({ kind: 'same-currency' })
    })

    it('refuses a trip whose copy is still in progress, reading no money row', async () => {
      await logDinner()
      await tripsRepository.requireUpdate(tenant.scope, tripId, {
        copyPendingAt: new Date(),
      })
      harness.statements.length = 0

      const preview = await previewCurrencyChange(tenant.scope, tripId, {
        to: 'JPY',
        rate: 160,
      })

      expect(preview.refusal).toEqual({ kind: 'copy-pending' })
      expect(
        harness.statements.filter((s) => MONEY_ROW_TABLES.test(s)),
      ).toEqual([])
    })

    it('counts the entries in a currency that is neither the old nor the new one', async () => {
      await createBudgetItem(tenant.scope, {
        tripId,
        name: 'Taxis',
        plannedAmountMinor: 900,
        currency: 'USD',
      })

      const preview = await previewCurrencyChange(tenant.scope, tripId, {
        to: 'JPY',
        rate: 160,
      })

      expect(preview.refusal).toEqual({ kind: 'unconverted-rows', count: 1 })
      expect(preview.example).toBeNull()
    })
  })

  describe('the rate', () => {
    async function freezeRateOnAYenTrip(rate: number) {
      const yen = await createTrip(tenant.scope, {
        title: 'Tokyo',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        currency: 'JPY',
      })
      await createExpense(tenant.scope, {
        tripId: yen.id,
        title: 'Ramen paid in euros',
        amountMinor: 1600,
        currency: 'JPY',
        originalAmountMinor: 1000,
        originalCurrency: 'EUR',
        exchangeRate: rate,
        spentOn: '2026-06-01',
      })
    }

    it('is the one the owner typed', async () => {
      await logDinner()
      await freezeRateOnAYenTrip(150)

      const preview = await previewCurrencyChange(tenant.scope, tripId, {
        to: 'JPY',
        rate: 161,
      })

      expect(preview.rate).toEqual({ value: 161, source: 'manual' })
    })

    it('is otherwise the last one this workspace froze for the pair, and never invented', async () => {
      await logDinner()

      const without = await previewCurrencyChange(tenant.scope, tripId, {
        to: 'JPY',
      })
      expect(without.rate).toBeNull()
      expect(without.refusal).toEqual({ kind: 'no-rate' })
      // Refused, so there is no arithmetic to show and nothing that looks like a result.
      expect(without.example).toBeNull()
      expect(without.balances).toBeNull()

      await freezeRateOnAYenTrip(150)
      const withRecent = await previewCurrencyChange(tenant.scope, tripId, {
        to: 'JPY',
      })
      expect(withRecent.rate).toEqual({ value: 150, source: 'recent' })
      expect(withRecent.refusal).toBeNull()
    })

    it('is a parse error outside the bounds, and so is an extra key', () => {
      for (const rate of [0, -1, 1e-8, 1e8, Number.NaN, Infinity]) {
        expect(
          previewCurrencyChangeInput.safeParse({ to: 'JPY', rate }).success,
        ).toBe(false)
      }
      expect(
        previewCurrencyChangeInput.safeParse({ to: 'JPY', expenseIds: [] })
          .success,
      ).toBe(false)
      // The server function's request is the same object with the trip, and just as strict.
      expect(
        previewCurrencyChangeRequest.safeParse({
          tripId: 'trip',
          to: 'JPY',
          expenseIds: [],
        }).success,
      ).toBe(false)
      expect(
        previewCurrencyChangeRequest.safeParse({ tripId: 'trip', to: 'JPY' })
          .success,
      ).toBe(true)
      expect(
        previewCurrencyChangeInput.safeParse({ to: 'JPY', rate: 1e-7 }).success,
      ).toBe(true)
      expect(
        previewCurrencyChangeInput.safeParse({ to: 'JPY', rate: 1e7 }).success,
      ).toBe(true)
    })
  })

  describe('what it costs and what it leaves behind', () => {
    it('writes nothing', async () => {
      await logDinner()
      await createBudgetItem(tenant.scope, { tripId, name: 'Food' })
      const before = await footprint(harness)

      await previewCurrencyChange(tenant.scope, tripId, {
        to: 'JPY',
        rate: 160,
      })
      await previewCurrencyChange(tenant.scope, tripId, { to: 'JPY' })

      expect(await footprint(harness)).toEqual(before)
    })

    it('reads the same number of times however many expenses the trip has', async () => {
      async function readsFor(expenseCount: number) {
        const trip = await createTrip(tenant.scope, {
          title: `Trip of ${expenseCount}`,
          startDate: '2026-04-10',
          endDate: '2026-04-12',
          currency: 'EUR',
        })
        await addTripMember(tenant.scope, {
          tripId: trip.id,
          userId: travellerId,
          role: 'editor',
        })
        for (let index = 0; index < expenseCount; index += 1) {
          await createExpense(tenant.scope, {
            tripId: trip.id,
            title: `Expense ${index}`,
            amountMinor: 1000 + index,
            spentOn: '2026-04-10',
            participants: [
              { userId: tenant.ownerUserId },
              { userId: travellerId },
            ],
          })
        }
        harness.statements.length = 0
        await previewCurrencyChange(tenant.scope, trip.id, {
          to: 'JPY',
          rate: 160,
        })
        return harness.statements.length
      }

      const few = await readsFor(1)
      const many = await readsFor(25)

      expect(many).toBe(few)
    })

    it('reads one query per money table, each filtered by the workspace and the trip', async () => {
      await logDinner()
      harness.statements.length = 0

      await previewCurrencyChange(tenant.scope, tripId, {
        to: 'JPY',
        rate: 160,
      })

      for (const table of [
        'expenses',
        'expense_shares',
        'settlements',
        'budget_items',
      ]) {
        const reads = harness.statements.filter((s) =>
          s.includes(`from "${table}"`),
        )
        expect(reads).toHaveLength(1)
        expect(reads[0]).toContain('"organization_id" = ?')
        expect(reads[0]).toContain('"trip_id" = ?')
      }
    })
  })

  describe('the balances', () => {
    it('are netted by the same formula as the member-balance reader', async () => {
      await logDinner()
      await createExpense(tenant.scope, {
        tripId,
        title: 'Taxi',
        amountMinor: 1501,
        paidBy: travellerId,
        spentOn: '2026-04-11',
        participants: [{ userId: tenant.ownerUserId }, { userId: travellerId }],
      })
      await createSettlement(tenant.scope, {
        tripId,
        fromUserId: travellerId,
        toUserId: tenant.ownerUserId,
        amountMinor: 700,
        settledOn: '2026-04-12',
      })

      const stored = await getMemberBalances(tenant.scope, tripId)
      const netted = netBalances({
        expenses: await harness.db.select().from(expenses),
        shares: await harness.db.select().from(expenseShares),
        payments: await harness.db.select().from(settlements),
      })

      const byUser = (
        rows: ReadonlyArray<{ userId: string; balanceMinor: number }>,
      ) =>
        rows
          .map((row) => [row.userId, row.balanceMinor] as const)
          .sort(([left], [right]) => left.localeCompare(right))
      expect(byUser(netted)).toEqual(byUser(stored))
      expect(stored.some((row) => row.balanceMinor !== 0)).toBe(true)
    })

    it('say which debts a rounding would leave on a trip that was settled to zero', async () => {
      // 0.10 EUR shared 4:3:3 and paid back to the cent; at 15 yen to the euro the rows round alone.
      const cal = await tenant.addUser('Cal')
      await addTripMember(tenant.scope, { tripId, userId: cal, role: 'editor' })
      await createExpense(tenant.scope, {
        tripId,
        title: 'Coffee',
        amountMinor: 10,
        paidBy: tenant.ownerUserId,
        splitMethod: 'shares',
        spentOn: '2026-04-10',
        participants: [
          { userId: tenant.ownerUserId, weight: 4 },
          { userId: travellerId, weight: 3 },
          { userId: cal, weight: 3 },
        ],
      })
      for (const userId of [travellerId, cal]) {
        await createSettlement(tenant.scope, {
          tripId,
          fromUserId: userId,
          toUserId: tenant.ownerUserId,
          amountMinor: 3,
          settledOn: '2026-04-11',
        })
      }
      expect(
        (await getMemberBalances(tenant.scope, tripId)).map(
          (row) => row.balanceMinor,
        ),
      ).toEqual([0, 0, 0])

      const preview = await previewCurrencyChange(tenant.scope, tripId, {
        to: 'JPY',
        rate: 15,
      })

      expect(preview.balances).toEqual({
        maxMovementMinor: 1,
        leftovers: [
          {
            userId: travellerId,
            otherUserId: tenant.ownerUserId,
            amountMinor: 1,
          },
        ],
      })
    })
  })
})
