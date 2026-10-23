/**
 * Committing a re-basing of a trip's budget currency: the repository half.
 *
 * `trip-currency-plan.test.ts` holds the arithmetic on plain rows and `trip-currency-preview.test.ts`
 * the read. This file is about the write: that one atomic batch leaves both invariants true
 * (every figure is in the new currency and equals the conversion of its own typed figure; every
 * share set sums to its expense), that a trip which moved between the read and the commit is left
 * exactly as it was, and who may commit. It runs on the real harness, whose `db.batch()` rolls back
 * as D1 does, so "nothing was written" is a comparison of every money table rather than a hope.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { asc, eq } from 'drizzle-orm'
import { convertMinor } from '#/lib/money'
import {
  budgetItems,
  dayAccommodations,
  expenseShares,
  expenses,
  places,
  reservations,
  settlements,
  transports,
  trips,
} from '#/server/db/schema'
import { NotFoundError } from '../context'
import {
  createBudgetItem,
  createExpense,
  createSettlement,
  expensesRepository,
  expenseSharesRepository,
  getMemberBalances,
  settlementsRepository,
  updateBudgetItem,
  updateExpense,
} from '../expenses'
import {
  CurrencyRefusalError,
  TripArchivedError,
  TripRoleError,
  addTripMember,
  archiveTrip,
  createTrip,
  requireTrip,
  tripsRepository,
  updateTrip,
} from '../trips'
import {
  MAX_REBASE_STATEMENTS,
  SHARE_ROWS_PER_STATEMENT,
  changeTripCurrency,
  changeTripCurrencyInput,
  changeTripCurrencyRequest,
  countRebaseStatements,
} from '../trip-currency'
import { PRICED_KINDS } from './priced-rows'
import { captureError, createHarness, subscribeTenant } from './harness'
import type { Database } from '#/server/db/types'
import type { TenantScope } from '../base'
import type { Harness, SeededTenant } from './harness'

const CHANGED = 'costs.refusal.rebaseChanged'

/** Every table a re-basing may touch, whole, so "unchanged" is a comparison and not a hope. */
async function footprint(harness: Harness) {
  return {
    trips: await harness.db.select().from(trips),
    expenses: await harness.db.select().from(expenses),
    shares: await harness.db.select().from(expenseShares),
    settlements: await harness.db.select().from(settlements),
    budgetItems: await harness.db.select().from(budgetItems),
    places: await harness.db.select().from(places),
    reservations: await harness.db.select().from(reservations),
    transports: await harness.db.select().from(transports),
    stays: await harness.db.select().from(dayAccommodations),
  }
}

type Dump = Record<string, Array<unknown>>

/** The synchronous twin of {@link footprint}: usable from inside the race hook. */
function dump(harness: Harness): Dump {
  const tables = [
    'trips',
    'expenses',
    'expense_shares',
    'settlements',
    'budget_items',
    'places',
    'reservations',
    'transports',
    'day_accommodations',
  ]
  return Object.fromEntries(
    tables.map((table) => [
      table,
      harness.sqlite.prepare(`SELECT * FROM ${table} ORDER BY id`).all(),
    ]),
  )
}

/**
 * A scope whose database runs `beforeWrite` immediately before the `UPDATE` of `trips` - the last
 * statement of a re-basing, built after the plan was made from the rows it read. That is the
 * moment between the read and the commit, where another tab's write can land.
 */
function scopeWithRaceBeforeTripUpdate(
  scope: TenantScope,
  beforeWrite: () => void,
): TenantScope {
  const db: Database = new Proxy(scope.db, {
    get(target, property) {
      const value: unknown = Reflect.get(target, property, target)
      if (typeof value !== 'function') {
        return value
      }
      if (property === 'update') {
        return (table: unknown) => {
          if (table === trips) {
            beforeWrite()
          }
          return value.call(target, table)
        }
      }
      return value.bind(target)
    },
  })
  return { db, ctx: scope.ctx }
}

describe('committing a change of a trip’s budget currency', () => {
  const RATE = 160

  let harness: Harness
  let tenant: SeededTenant
  let travellerId: string
  let tripId: string

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('commit')
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

  /** Every shape the rules name, in euros: inherited rows, a foreign receipt, one already in yen. */
  async function seedLedger() {
    const both = [{ userId: tenant.ownerUserId }, { userId: travellerId }]
    const log = (
      title: string,
      amountMinor: number,
      extra: Partial<Parameters<typeof createExpense>[1]> = {},
    ) =>
      createExpense(tenant.scope, {
        tripId,
        title,
        amountMinor,
        spentOn: '2026-04-10',
        paidBy: tenant.ownerUserId,
        participants: both,
        ...extra,
      })
    await log('Dinner', 4201)
    await log('Taxi', 1001, {
      splitMethod: 'shares',
      participants: [
        { userId: tenant.ownerUserId, weight: 2 },
        { userId: travellerId, weight: 1 },
      ],
    })
    await log('Hotel', 33_333, {
      splitMethod: 'percentage',
      participants: [
        { userId: tenant.ownerUserId, percentage: 60 },
        { userId: travellerId, percentage: 40 },
      ],
    })
    await log('Groceries', 1000, {
      splitMethod: 'exact',
      participants: [
        { userId: tenant.ownerUserId, shareMinor: 700 },
        { userId: travellerId, shareMinor: 300 },
      ],
    })
    await log('Souvenirs', 1000, {
      originalAmountMinor: 1100,
      originalCurrency: 'USD',
      exchangeRate: 1000 / 1100,
    })
    await log('Ramen', 10_000, {
      originalAmountMinor: 16_000,
      originalCurrency: 'JPY',
      exchangeRate: 0.00625,
    })
    await log('Free ticket', 0)
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
    await tripsRepository.requireUpdate(tenant.scope, tripId, {
      budgetTargetMinor: 500_000,
    })
  }

  async function seedReferencePrices() {
    for (const kind of PRICED_KINDS) {
      if (/with no currency$/.test(kind.name)) {
        await kind.seed(tenant.scope, tripId, travellerId)
      }
    }
  }

  async function rows() {
    const expenseRows = await harness.db
      .select()
      .from(expenses)
      .orderBy(asc(expenses.title))
    const shareRows = await harness.db.select().from(expenseShares)
    return {
      expenses: expenseRows,
      shares: shareRows,
      settlements: await harness.db.select().from(settlements),
      budgetItems: await harness.db.select().from(budgetItems),
    }
  }

  /** The two invariants a re-basing exists to keep, read back from the database. */
  async function expectInvariants(to: string) {
    const after = await rows()
    for (const row of after.expenses) {
      expect(row.currency).toBe(to)
      expect(row.originalAmountMinor).not.toBeNull()
      expect(row.originalCurrency).not.toBeNull()
      expect(row.amountMinor).toBe(
        row.originalCurrency === to
          ? row.originalAmountMinor
          : convertMinor(
              row.originalAmountMinor ?? 0,
              row.exchangeRate ?? 1,
              row.originalCurrency ?? to,
              to,
            ),
      )
      const own = after.shares.filter((share) => share.expenseId === row.id)
      if (own.length > 0) {
        expect(own.reduce((sum, share) => sum + share.shareMinor, 0)).toBe(
          row.amountMinor,
        )
      }
    }
    for (const row of after.settlements) {
      expect(row.currency).toBe(to)
    }
    for (const row of after.budgetItems) {
      expect(row.currency).toBe(to)
    }
  }

  describe('what it writes', () => {
    it('leaves every figure in the new currency, equal to the conversion of its own typed figure', async () => {
      await seedLedger()

      await changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE })

      await expectInvariants('JPY')
      expect((await requireTrip(tenant.scope, tripId)).currency).toBe('JPY')
    })

    it('keeps what the traveller typed readable in the source columns, and never rewrites it', async () => {
      await seedLedger()
      const before = await rows()

      await changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE })

      const after = await rows()
      const byTitle = (list: typeof after.expenses, title: string) => {
        const found = list.find((row) => row.title === title)
        if (found === undefined) {
          throw new Error(`No expense titled ${title}`)
        }
        return found
      }
      // An inherited row is pinned from itself: the euros typed are the source.
      expect(byTitle(after.expenses, 'Dinner')).toMatchObject({
        amountMinor: convertMinor(4201, RATE, 'EUR', 'JPY'),
        originalAmountMinor: 4201,
        originalCurrency: 'EUR',
        exchangeRate: RATE,
      })
      // A foreign receipt keeps its own figure and currency, and the rate becomes the product.
      const souvenirs = byTitle(after.expenses, 'Souvenirs')
      expect(souvenirs).toMatchObject({
        originalAmountMinor: 1100,
        originalCurrency: 'USD',
      })
      expect(souvenirs.exchangeRate).toBeCloseTo((1000 / 1100) * RATE, 9)
      // A receipt typed in the currency the trip is moving to is used verbatim.
      expect(byTitle(after.expenses, 'Ramen')).toMatchObject({
        amountMinor: 16_000,
        originalAmountMinor: 16_000,
        originalCurrency: 'JPY',
        exchangeRate: 1,
      })
      // A zero stays zero, with zero shares.
      expect(byTitle(after.expenses, 'Free ticket').amountMinor).toBe(0)
      // The typed figure of a row that already had a triple is untouched.
      expect(byTitle(before.expenses, 'Souvenirs').originalAmountMinor).toBe(
        1100,
      )
    })

    it('writes a null rate for a typed figure that never had one, and the real rate for a zero row', async () => {
      await seedLedger()
      const [dinner] = await harness.db
        .select()
        .from(expenses)
        .where(eq(expenses.title, 'Dinner'))
      // How a zero converted amount with a typed figure is stored: both set, no rate.
      await harness.db
        .update(expenses)
        .set({ originalAmountMinor: 500, originalCurrency: 'GBP' })
        .where(eq(expenses.title, 'Free ticket'))
      await harness.db
        .update(expenses)
        .set({ originalAmountMinor: 500, originalCurrency: 'GBP' })
        .where(eq(expenses.id, dinner.id))

      await changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE })

      const after = await rows()
      for (const title of ['Free ticket', 'Dinner']) {
        expect(after.expenses.find((row) => row.title === title)).toMatchObject(
          {
            currency: 'JPY',
            originalAmountMinor: 500,
            originalCurrency: 'GBP',
            exchangeRate: null,
          },
        )
      }
      expect(
        after.expenses.find((row) => row.title === 'Dinner')?.amountMinor,
      ).toBe(convertMinor(4201, RATE, 'EUR', 'JPY'))
    })

    it('keeps the split method, the weights and the settled flag of every share', async () => {
      await seedLedger()
      const before = await harness.db.select().from(expenseShares)

      await changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE })

      const after = await harness.db.select().from(expenseShares)
      const keyed = (list: typeof before) =>
        new Map(list.map((row) => [row.id, row]))
      const beforeById = keyed(before)
      expect(after).toHaveLength(before.length)
      for (const row of after) {
        const was = beforeById.get(row.id)
        expect(row.weight).toBe(was?.weight)
        expect(row.isSettled).toBe(was?.isSettled)
        expect(row.userId).toBe(was?.userId)
      }
    })

    it('keeps an exact split proportional to its old shares and does not throw on a percentage one', async () => {
      await seedLedger()

      await changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE })

      const after = await rows()
      const groceries = after.expenses.find((row) => row.title === 'Groceries')
      const owner = after.shares.find(
        (share) =>
          share.expenseId === groceries?.id &&
          share.userId === tenant.ownerUserId,
      )
      // 1000 minor euros are 160 000 minor yen... minus the digit shift (a yen has no minor unit).
      expect(groceries?.amountMinor).toBe(
        convertMinor(1000, RATE, 'EUR', 'JPY'),
      )
      expect(owner?.shareMinor).toBe(
        Math.round(((groceries?.amountMinor ?? 0) * 700) / 1000),
      )
    })

    it('converts the planned items, the payments and the trip budget with the one rate', async () => {
      await seedLedger()

      const result = await changeTripCurrency(tenant.scope, tripId, {
        to: 'JPY',
        rate: RATE,
      })

      const after = await rows()
      expect(after.settlements[0]).toMatchObject({
        amountMinor: convertMinor(700, RATE, 'EUR', 'JPY'),
        currency: 'JPY',
        originalAmountMinor: 700,
        originalCurrency: 'EUR',
      })
      expect(after.budgetItems[0]).toMatchObject({
        plannedAmountMinor: convertMinor(30_000, RATE, 'EUR', 'JPY'),
        currency: 'JPY',
        originalAmountMinor: 30_000,
        originalCurrency: 'EUR',
      })
      const trip = await requireTrip(tenant.scope, tripId)
      expect(trip.budgetTargetMinor).toBe(
        convertMinor(500_000, RATE, 'EUR', 'JPY'),
      )
      expect(result.budgetTarget).toEqual({
        before: 500_000,
        after: convertMinor(500_000, RATE, 'EUR', 'JPY'),
      })
    })

    it('answers with the counts it wrote', async () => {
      await seedLedger()
      await seedReferencePrices()

      const result = await changeTripCurrency(tenant.scope, tripId, {
        to: 'JPY',
        rate: RATE,
      })

      expect(result).toMatchObject({
        from: 'EUR',
        to: 'JPY',
        rate: RATE,
        counts: {
          expenses: 7,
          settlements: 1,
          budgetItems: 1,
          shareRows: 14,
          pinnedPrices: 4,
        },
      })
    })

    it('pins the reference prices to the old currency instead of converting them', async () => {
      await seedReferencePrices()
      const [place] = await harness.db.select().from(places)
      await harness.db.insert(places).values({
        id: 'priced-in-dollars',
        organizationId: tenant.organizationId,
        tripId,
        name: 'Dollar museum',
        priceMinor: 900,
        currency: 'USD',
      })
      await harness.db.insert(places).values({
        id: 'unpriced',
        organizationId: tenant.organizationId,
        tripId,
        name: 'Free viewpoint',
      })

      await changeTripCurrency(tenant.scope, tripId, { to: 'JPY' })

      const after = await harness.db.select().from(places)
      expect(after.find((row) => row.id === place?.id)).toMatchObject({
        priceMinor: place?.priceMinor,
        currency: 'EUR',
      })
      // A price that already named a currency, and a row with no price at all, are not touched.
      expect(after.find((row) => row.id === 'priced-in-dollars')).toMatchObject(
        {
          priceMinor: 900,
          currency: 'USD',
        },
      )
      expect(after.find((row) => row.id === 'unpriced')?.currency).toBeNull()
      for (const table of [reservations, transports, dayAccommodations]) {
        const list = await harness.db.select().from(table)
        expect(list.length).toBeGreaterThan(0)
        for (const row of list) {
          expect(row.currency).toBe('EUR')
        }
      }
      expect((await requireTrip(tenant.scope, tripId)).currency).toBe('JPY')
    })

    it('needs no rate on a trip with nothing to convert, and changes only the currency', async () => {
      const before = await footprint(harness)

      const result = await changeTripCurrency(tenant.scope, tripId, {
        to: 'JPY',
      })

      expect(result.rate).toBeNull()
      expect(result.counts).toMatchObject({ expenses: 0, pinnedPrices: 0 })
      const after = await footprint(harness)
      expect(after.trips[0]).toMatchObject({ currency: 'JPY' })
      expect({ ...after, trips: [] }).toEqual({ ...before, trips: [] })
    })

    it('returns every row to its starting figures when converted back, the trip budget excepted', async () => {
      await seedLedger()
      const start = await rows()

      await changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE })
      await changeTripCurrency(tenant.scope, tripId, {
        to: 'EUR',
        rate: 1 / RATE,
      })

      const end = await rows()
      const figures = (list: Awaited<ReturnType<typeof rows>>) => ({
        expenses: list.expenses.map((row) => [
          row.title,
          row.amountMinor,
          row.currency,
        ]),
        shares: list.shares
          .map((row) => [row.id, row.shareMinor] as const)
          .sort((left, right) => left[0].localeCompare(right[0])),
        settlements: list.settlements.map((row) => [
          row.amountMinor,
          row.currency,
        ]),
        budgetItems: list.budgetItems.map((row) => [
          row.plannedAmountMinor,
          row.currency,
        ]),
      })
      expect(figures(end)).toEqual(figures(start))
      expect((await requireTrip(tenant.scope, tripId)).currency).toBe('EUR')
    })
  })

  describe('the balances', () => {
    it('move by at most one minor unit per row the member appears in', async () => {
      await seedLedger()
      const before = await getMemberBalances(tenant.scope, tripId)
      const appearances = new Map<string, number>()
      const state = await rows()
      for (const row of state.expenses) {
        if (row.paidBy !== null) {
          appearances.set(row.paidBy, (appearances.get(row.paidBy) ?? 0) + 1)
        }
      }
      for (const row of state.shares) {
        appearances.set(row.userId, (appearances.get(row.userId) ?? 0) + 1)
      }
      for (const row of state.settlements) {
        for (const id of [row.fromUserId, row.toUserId]) {
          appearances.set(id, (appearances.get(id) ?? 0) + 1)
        }
      }

      await changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE })

      const after = await getMemberBalances(tenant.scope, tripId)
      for (const row of before) {
        const now = after.find((candidate) => candidate.userId === row.userId)
        const expected = convertMinor(row.balanceMinor, RATE, 'EUR', 'JPY')
        expect(
          Math.abs((now?.balanceMinor ?? 0) - expected),
        ).toBeLessThanOrEqual(appearances.get(row.userId) ?? 0)
      }
    })

    it('stay within the same bound on a trip that was settled to zero', async () => {
      await createExpense(tenant.scope, {
        tripId,
        title: 'Odd dinner',
        amountMinor: 1001,
        spentOn: '2026-04-10',
        paidBy: tenant.ownerUserId,
        participants: [{ userId: tenant.ownerUserId }, { userId: travellerId }],
      })
      await createSettlement(tenant.scope, {
        tripId,
        fromUserId: travellerId,
        toUserId: tenant.ownerUserId,
        amountMinor: 500,
        settledOn: '2026-04-11',
      })
      expect(
        (await getMemberBalances(tenant.scope, tripId)).map(
          (row) => row.balanceMinor,
        ),
      ).toEqual([0, 0])

      await changeTripCurrency(tenant.scope, tripId, {
        to: 'JPY',
        rate: 1.2345,
      })

      await expectInvariants('JPY')
      for (const row of await getMemberBalances(tenant.scope, tripId)) {
        // Two rows each: the expense and the payment.
        expect(Math.abs(row.balanceMinor)).toBeLessThanOrEqual(2)
      }
    })
  })

  describe('how big a trip may be', () => {
    it('re-bases an expense split between exactly one statement’s worth of people, and one more', async () => {
      const people: Array<string> = []
      for (let index = 0; index <= SHARE_ROWS_PER_STATEMENT; index += 1) {
        people.push(await tenant.addUser(`Guest ${index}`))
      }
      const split = async (title: string, count: number) => {
        const [expense] = await expensesRepository.insertMany(tenant.scope, [
          {
            tripId,
            title,
            amountMinor: 100_000 + count,
            currency: 'EUR',
            spentOn: '2026-04-10',
            paidBy: tenant.ownerUserId,
            createdBy: tenant.ownerUserId,
          },
        ])
        const splitRows = people.slice(0, count).map((userId, index) => ({
          tripId,
          expenseId: expense?.id ?? '',
          userId,
          shareMinor:
            Math.floor((100_000 + count) / count) +
            (index === 0 ? (100_000 + count) % count : 0),
          weight: 1,
        }))
        // Ten rows a statement: the harness refuses more than 100 bound parameters, as D1 does.
        for (let index = 0; index < splitRows.length; index += 10) {
          await expenseSharesRepository.insertMany(
            tenant.scope,
            splitRows.slice(index, index + 10),
          )
        }
      }
      await split('At the cap', SHARE_ROWS_PER_STATEMENT)
      await split('One over the cap', SHARE_ROWS_PER_STATEMENT + 1)

      await changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE })

      await expectInvariants('JPY')
      const shareRows = await harness.db.select().from(expenseShares)
      expect(shareRows).toHaveLength(SHARE_ROWS_PER_STATEMENT * 2 + 1)
    })

    // Five rows a statement: sixteen columns each, under the 100 bound parameters D1 allows.
    const PAYMENTS_PER_INSERT = 5

    async function logPayments(count: number) {
      for (let index = 0; index < count; index += PAYMENTS_PER_INSERT) {
        await settlementsRepository.insertMany(
          tenant.scope,
          Array.from(
            { length: Math.min(PAYMENTS_PER_INSERT, count - index) },
            () => ({
              tripId,
              fromUserId: travellerId,
              toUserId: tenant.ownerUserId,
              amountMinor: 100,
              currency: 'EUR',
              settledOn: '2026-04-11',
              createdBy: tenant.ownerUserId,
            }),
          ),
        )
      }
    }

    it('commits a trip at the statement ceiling', async () => {
      await logPayments(MAX_REBASE_STATEMENTS - 5)

      await changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE })

      await expectInvariants('JPY')
      expect((await requireTrip(tenant.scope, tripId)).currency).toBe('JPY')
    })

    it('refuses a trip one statement over it, and writes nothing', async () => {
      await logPayments(MAX_REBASE_STATEMENTS - 4)
      const before = await footprint(harness)

      const refusal = await captureError(() =>
        changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE }),
      )

      expect(refusal).toBeInstanceOf(CurrencyRefusalError)
      expect(refusal.message).toBe(CHANGED)
      expect(await footprint(harness)).toEqual(before)
    })

    it('counts the statements the way the plan does', async () => {
      await logPayments(3)
      expect(
        countRebaseStatements({
          expenses: [],
          shares: [],
          payments: Array.from({ length: 3 }, (_, index) => ({
            id: String(index),
            fromUserId: 'a',
            toUserId: 'b',
            amountMinor: 1,
            currency: 'EUR',
            originalAmountMinor: null,
            originalCurrency: null,
            exchangeRate: null,
          })),
          plannedItems: [],
          budgetTargetMinor: null,
          pinnedPrices: 0,
        }),
      ).toBe(8)
    })
  })

  describe('a trip that moved between the read and the commit', () => {
    const OWNER_WRITES: ReadonlyArray<
      readonly [name: string, write: (context: Context) => void]
    > = [
      [
        'an expense edited',
        (context) =>
          context.sql(
            `UPDATE expenses SET amount_minor = 9999 WHERE title = 'Dinner'`,
          ),
      ],
      [
        'an expense logged in the old currency',
        (context) =>
          context.sql(
            `INSERT INTO expenses (id, organization_id, trip_id, title, amount_minor, currency, spent_on, created_by, created_at, updated_at)
             VALUES ('late-expense', '${context.organizationId}', '${context.tripId}', 'Late', 500, 'EUR', '2026-04-12', '${context.ownerId}', 0, 0)`,
          ),
      ],
      [
        'a payment recorded in the old currency',
        (context) =>
          context.sql(
            `INSERT INTO settlements (id, organization_id, trip_id, from_user_id, to_user_id, amount_minor, currency, settled_on, created_by, created_at, updated_at)
             VALUES ('late-payment', '${context.organizationId}', '${context.tripId}', '${context.ownerId}', '${context.otherId}', 100, 'EUR', '2026-04-12', '${context.ownerId}', 0, 0)`,
          ),
      ],
      [
        'a payment edited',
        (context) => context.sql(`UPDATE settlements SET amount_minor = 999`),
      ],
      [
        'a planned item edited',
        (context) =>
          context.sql(`UPDATE budget_items SET planned_amount_minor = 1`),
      ],
      [
        'the trip budget edited',
        (context) =>
          context.sql(
            `UPDATE trips SET budget_target_minor = 1 WHERE id = '${context.tripId}'`,
          ),
      ],
      [
        'the people sharing an expense changed',
        (context) =>
          context.sql(
            `UPDATE expense_shares SET share_minor = share_minor + 1 WHERE id = (SELECT id FROM expense_shares LIMIT 1)`,
          ),
      ],
      [
        'a share replaced under a new id',
        (context) =>
          context.sql(
            `UPDATE expense_shares SET id = 'replaced-share' WHERE id = (SELECT id FROM expense_shares LIMIT 1)`,
          ),
      ],
      [
        'the trip already moved by a rival commit',
        (context) =>
          context.sql(
            `UPDATE trips SET currency = 'JPY' WHERE id = '${context.tripId}'`,
          ),
      ],
    ]

    interface Context {
      readonly organizationId: string
      readonly tripId: string
      readonly ownerId: string
      readonly otherId: string
      readonly sql: (statement: string) => void
    }

    it.each(OWNER_WRITES)(
      'rolls the whole batch back after %s, leaving the trip as the write left it',
      async (_name, write) => {
        await seedLedger()
        let asWritten: Dump | null = null
        const racing = scopeWithRaceBeforeTripUpdate(tenant.scope, () => {
          write({
            organizationId: tenant.organizationId,
            tripId,
            ownerId: tenant.ownerUserId,
            otherId: travellerId,
            sql: (statement) => harness.sqlite.exec(statement),
          })
          // The injected write belongs to the world the commit must leave alone, so the comparison
          // is with the database as it stood the moment the write finished.
          asWritten = dump(harness)
        })

        const refusal = await captureError(() =>
          changeTripCurrency(racing, tripId, { to: 'JPY', rate: RATE }),
        )

        expect(refusal).toBeInstanceOf(CurrencyRefusalError)
        expect(refusal.message).toBe(CHANGED)
        expect(asWritten).not.toBeNull()
        expect(dump(harness)).toEqual(asWritten)
      },
    )

    it('refuses a second commit of the same change, and a rival that got there first, on a trip with nothing to convert', async () => {
      // With no rows the batch is the trip statement alone: if the old-currency test sat in the
      // `WHERE`, a trip that had already moved would match nothing and report success.
      const racing = scopeWithRaceBeforeTripUpdate(tenant.scope, () => {
        harness.sqlite.exec(
          `UPDATE trips SET currency = 'JPY' WHERE id = '${tripId}'`,
        )
      })

      const refusal = await captureError(() =>
        changeTripCurrency(racing, tripId, { to: 'JPY' }),
      )

      expect(refusal).toBeInstanceOf(CurrencyRefusalError)
      expect(refusal.message).toBe(CHANGED)
    })

    it('refuses a retry once the first commit landed, changing nothing', async () => {
      await seedLedger()
      await changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE })
      const settled = await footprint(harness)

      const refusal = await captureError(() =>
        changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE }),
      )

      expect(refusal).toBeInstanceOf(CurrencyRefusalError)
      expect(refusal.message).toBe(CHANGED)
      expect(await footprint(harness)).toEqual(settled)
    })

    it('leaves the trip untouched when the last statement fails for any reason', async () => {
      await seedLedger()
      const before = await footprint(harness)
      harness.sqlite.exec(
        `CREATE TRIGGER refuse_trip_update BEFORE UPDATE ON trips BEGIN SELECT RAISE(ABORT, 'disk full'); END`,
      )

      const failure = await captureError(() =>
        changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE }),
      )

      // Another failure than the stale test arrives as itself: it is not "the trip changed".
      expect(failure).not.toBeInstanceOf(CurrencyRefusalError)
      expect(await footprint(harness)).toEqual(before)
    })
  })

  describe('what it refuses before writing', () => {
    it('refuses a rate it was not given on a trip with money in it', async () => {
      await seedLedger()
      const before = await footprint(harness)

      const refusal = await captureError(() =>
        changeTripCurrency(tenant.scope, tripId, { to: 'JPY' }),
      )

      expect(refusal.message).toBe(CHANGED)
      expect(await footprint(harness)).toEqual(before)
    })

    it('refuses an entry in a third currency, and writes nothing', async () => {
      await seedLedger()
      harness.sqlite.exec(`UPDATE budget_items SET currency = 'USD'`)
      const before = await footprint(harness)

      const refusal = await captureError(() =>
        changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE }),
      )

      expect(refusal.message).toBe(CHANGED)
      expect(await footprint(harness)).toEqual(before)
    })

    it('refuses an amount that no longer fits a safe integer, and writes nothing', async () => {
      await createExpense(tenant.scope, {
        tripId,
        title: 'Huge',
        amountMinor: Number.MAX_SAFE_INTEGER,
        spentOn: '2026-04-10',
      })
      const before = await footprint(harness)

      const refusal = await captureError(() =>
        changeTripCurrency(tenant.scope, tripId, { to: 'USD', rate: 1e7 }),
      )

      expect(refusal.message).toBe(CHANGED)
      expect(await footprint(harness)).toEqual(before)
    })

    it('refuses the currency the trip already has', async () => {
      const refusal = await captureError(() =>
        changeTripCurrency(tenant.scope, tripId, { to: 'EUR' }),
      )

      expect(refusal.message).toBe(CHANGED)
    })

    it('refuses a rate previewed against another currency than the trip has now, and writes nothing', async () => {
      await seedLedger()
      const before = await footprint(harness)

      const refusal = await captureError(() =>
        changeTripCurrency(tenant.scope, tripId, {
          from: 'GBP',
          to: 'JPY',
          rate: RATE,
        }),
      )

      expect(refusal.message).toBe(CHANGED)
      expect(await footprint(harness)).toEqual(before)
    })

    it('commits when the currency it was previewed against is still the trip’s, and when none was named', async () => {
      await seedLedger()

      await changeTripCurrency(tenant.scope, tripId, {
        from: 'EUR',
        to: 'JPY',
        rate: RATE,
      })

      expect((await requireTrip(tenant.scope, tripId)).currency).toBe('JPY')
    })

    it('refuses a trip whose copy is still in progress, and writes nothing', async () => {
      await seedLedger()
      await tripsRepository.requireUpdate(tenant.scope, tripId, {
        copyPendingAt: new Date(),
      })
      const before = await footprint(harness)

      const refusal = await captureError(() =>
        changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE }),
      )

      expect(refusal.message).toBe(CHANGED)
      expect(await footprint(harness)).toEqual(before)
    })

    it('is a parse error for an extra key, an out-of-bounds rate and a currency that is not a code', () => {
      expect(() =>
        changeTripCurrencyRequest.parse({
          tripId: 'trip',
          to: 'JPY',
          rate: 160,
          expenseIds: ['a'],
        }),
      ).toThrow()
      expect(() =>
        changeTripCurrencyInput.parse({ to: 'JPY', rate: 0 }),
      ).toThrow()
      expect(() =>
        changeTripCurrencyInput.parse({ to: 'JPY', rate: 1e8 }),
      ).toThrow()
      expect(() => changeTripCurrencyInput.parse({ to: 'yen' })).toThrow()
      expect(changeTripCurrencyInput.parse({ to: 'JPY', rate: 160 })).toEqual({
        to: 'JPY',
        rate: 160,
      })
      expect(
        changeTripCurrencyInput.parse({ from: 'EUR', to: 'JPY', rate: 160 }),
      ).toEqual({ from: 'EUR', to: 'JPY', rate: 160 })
      expect(() =>
        changeTripCurrencyInput.parse({ from: 'euro', to: 'JPY' }),
      ).toThrow()
    })
  })

  describe('who may commit', () => {
    it.each([
      ['an editor', 'editor'],
      ['a viewer', 'viewer'],
    ] as const)('refuses %s, and writes nothing', async (_name, role) => {
      await seedLedger()
      const other = await tenant.addUser(`A ${role}`)
      await addTripMember(tenant.scope, { tripId, userId: other, role })
      const before = await footprint(harness)

      const refusal = await captureError(() =>
        changeTripCurrency(tenant.scopeFor(other), tripId, {
          to: 'JPY',
          rate: RATE,
        }),
      )

      expect(refusal).toBeInstanceOf(TripRoleError)
      expect(await footprint(harness)).toEqual(before)
    })

    it('does not know a private trip to someone who is not on it', async () => {
      await updateTrip(tenant.scope, tripId, { visibility: 'private' })
      await seedLedger()
      const stranger = await tenant.addUser('Stranger')
      const before = await footprint(harness)

      const refusal = await captureError(() =>
        changeTripCurrency(tenant.scopeFor(stranger), tripId, {
          to: 'JPY',
          rate: RATE,
        }),
      )

      expect(refusal).toBeInstanceOf(NotFoundError)
      expect(await footprint(harness)).toEqual(before)
    })

    it('refuses an archived trip, and writes nothing', async () => {
      await seedLedger()
      await archiveTrip(tenant.scope, tripId)
      const before = await footprint(harness)

      const refusal = await captureError(() =>
        changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE }),
      )

      expect(refusal).toBeInstanceOf(TripArchivedError)
      expect(await footprint(harness)).toEqual(before)
    })
  })

  describe('a stale tab’s writes', () => {
    const moveToYen = () =>
      changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: RATE })

    /**
     * A stale writer: the state it is sent into (the trip already in yen, with a row to edit where
     * the writer edits one) and the write itself, which believes the trip is still in euros.
     */
    const STALE_WRITERS: ReadonlyArray<
      readonly [
        name: string,
        arrange: () => Promise<{ id: string } | undefined>,
        write: (target: { id: string } | undefined) => Promise<unknown>,
      ]
    > = [
      [
        'an expense logged',
        async () => {
          await moveToYen()
          return undefined
        },
        () =>
          createExpense(tenant.scope, {
            tripId,
            title: 'Stale dinner',
            amountMinor: 1000,
            spentOn: '2026-04-10',
            expectedTripCurrency: 'EUR',
            participants: [{ userId: tenant.ownerUserId }],
          }),
      ],
      [
        'an expense edited',
        async () => {
          const { expense } = await createExpense(tenant.scope, {
            tripId,
            title: 'Dinner',
            amountMinor: 1000,
            spentOn: '2026-04-10',
            participants: [{ userId: tenant.ownerUserId }],
          })
          await moveToYen()
          return expense
        },
        (target) =>
          updateExpense(tenant.scope, tripId, target?.id ?? '', {
            amountMinor: 2000,
            expectedTripCurrency: 'EUR',
          }),
      ],
      [
        'a payment recorded',
        async () => {
          await moveToYen()
          return undefined
        },
        () =>
          createSettlement(tenant.scope, {
            tripId,
            fromUserId: travellerId,
            toUserId: tenant.ownerUserId,
            amountMinor: 700,
            settledOn: '2026-04-11',
            expectedTripCurrency: 'EUR',
          }),
      ],
      [
        'a planned item created',
        async () => {
          await moveToYen()
          return undefined
        },
        () =>
          createBudgetItem(tenant.scope, {
            tripId,
            name: 'Food',
            plannedAmountMinor: 100,
            expectedTripCurrency: 'EUR',
          }),
      ],
      [
        'a planned item edited',
        async () => {
          const item = await createBudgetItem(tenant.scope, {
            tripId,
            name: 'Food',
            plannedAmountMinor: 100,
          })
          await moveToYen()
          return item
        },
        (target) =>
          updateBudgetItem(tenant.scope, tripId, target?.id ?? '', {
            plannedAmountMinor: 200,
            expectedTripCurrency: 'EUR',
          }),
      ],
    ]

    it.each(STALE_WRITERS)(
      'writes nothing when %s on a trip that is no longer in the currency the tab believes',
      async (_name, arrange, write) => {
        const target = await arrange()
        const before = await footprint(harness)

        const refusal = await captureError(() => write(target))

        expect(refusal).toBeInstanceOf(CurrencyRefusalError)
        expect(refusal.message).toBe('costs.refusal.tripCurrencyChanged')
        expect(await footprint(harness)).toEqual(before)
      },
    )

    it('behaves as before when the tab’s belief matches, or says nothing', async () => {
      const matching = await createExpense(tenant.scope, {
        tripId,
        title: 'Matching',
        amountMinor: 1000,
        spentOn: '2026-04-10',
        expectedTripCurrency: 'EUR',
      })
      const silent = await createExpense(tenant.scope, {
        tripId,
        title: 'Silent',
        amountMinor: 1000,
        spentOn: '2026-04-10',
      })

      expect(matching.expense.currency).toBe('EUR')
      expect(silent.expense.currency).toBe('EUR')
      // The belief is a guard, not a column.
      expect(matching.expense).not.toHaveProperty('expectedTripCurrency')
    })

    it('does not stop a booking’s own foreign-currency line, which asserts nothing', async () => {
      await changeTripCurrency(tenant.scope, tripId, { to: 'JPY' })

      const { expense } = await createExpense(tenant.scope, {
        tripId,
        title: 'Hotel (booked in dollars)',
        amountMinor: 20_000,
        currency: 'USD',
        spentOn: '2026-04-10',
      })

      expect(expense.currency).toBe('USD')
    })
  })
})
