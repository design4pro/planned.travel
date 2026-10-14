/**
 * The costs boundary: who may write a trip's money, and what the screen is told about it (#837).
 *
 * Outside a Start build a server function runs its handler and discards the answer
 * (`reservations.test.ts` and `atlas.test.ts` measured it first), so the writes are driven for what
 * they *do* to the database and the read is held through `costsPayload`, the plain function
 * `loadCosts` wraps. Everything else is real: a migrated SQLite database, real repositories, real
 * trip roles.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TripRoleError,
  addTripMember,
  createExpense,
  createSettlement,
  createTrip,
  getDisplayCurrency,
  listSettlements,
  setDisplayCurrency,
  listTripExpenses,
  updateTrip,
} from '#/server/repos'
import { captureError, createHarness } from '#/server/repos/__tests__/harness'

import type { TenantScope } from '#/server/repos'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  mirrorToRoom: vi.fn(async (): Promise<void> => undefined),
}))

/**
 * `./context` imports `cloudflare:workers` at module scope, which does not resolve in the `server`
 * Vitest project, so it is replaced wholesale with the same stand-ins `reservations.test.ts` uses.
 * `notificationDeps` is never reached: the expense below has no split, so nobody is notified.
 */
vi.mock('../context', () => ({
  appScope: async (): Promise<unknown> => {
    if (stubs.scope === null) {
      throw new Error('unauthenticated')
    }
    return stubs.scope
  },
  mirrorToRoom: stubs.mirrorToRoom,
  notificationDeps: () => ({}),
  patch: (kind: string, id: string, fields: unknown) => ({
    entity: { kind, id },
    op: 'upsert',
    fields,
  }),
  tombstone: (kind: string, id: string) => ({
    entity: { kind, id },
    op: 'delete',
    fields: {},
  }),
}))

interface StartContext {
  readonly startOptions: Record<string, never>
  readonly request: Request
}

const startStorage = ((): AsyncLocalStorage<StartContext> => {
  const key = Symbol.for('tanstack-start:start-storage-context')
  const globals = globalThis as Record<symbol, unknown>
  globals[key] ??= new AsyncLocalStorage<StartContext>()
  return globals[key] as AsyncLocalStorage<StartContext>
})()

function inStart<T>(run: () => Promise<T>): Promise<T> {
  return startStorage.run(
    {
      startOptions: {},
      request: new Request('https://planned.travel/_serverFn/costs', {
        method: 'POST',
      }),
    },
    run,
  )
}

const {
  costsPayload,
  createExpenseFn,
  deleteExpenseFn,
  recordPaymentFn,
  recordPaymentSchema,
  setDisplayCurrencyFn,
  setDisplayCurrencySchema,
  updateExpenseFn,
} = await import('../costs')

describe('the costs boundary', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let expenseId: string
  let ownerId: string
  let payerId: string
  let viewer: TenantScope
  let editor: TenantScope
  let reader: TenantScope

  beforeEach(async () => {
    stubs.mirrorToRoom.mockClear()
    harness = await createHarness()
    tenant = await harness.seedTenant('costs-boundary')
    ownerId = tenant.ownerUserId
    payerId = await tenant.addUser('The payer')
    const viewerId = await tenant.addUser('A viewer')
    const editorId = await tenant.addUser('An editor')
    const readerId = await tenant.addUser('A reader who is not on the trip')

    const trip = await createTrip(tenant.scope, {
      title: 'Lisbon, together',
      slug: 'lisbon-together',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      currency: 'EUR',
    })
    tripId = trip.id
    await addTripMember(tenant.scope, {
      tripId,
      userId: payerId,
      role: 'viewer',
    })
    await addTripMember(tenant.scope, {
      tripId,
      userId: viewerId,
      role: 'viewer',
    })
    await addTripMember(tenant.scope, {
      tripId,
      userId: editorId,
      role: 'editor',
    })
    await updateTrip(tenant.scope, tripId, { visibility: 'organization' })

    viewer = tenant.scopeFor(viewerId)
    editor = tenant.scopeFor(editorId)
    reader = tenant.scopeFor(readerId)

    const { expense } = await createExpense(tenant.scope, {
      tripId,
      title: 'Dinner',
      amountMinor: 6_000,
      spentOn: '2026-04-10',
      paidBy: ownerId,
    })
    expenseId = expense.id
  })

  const payment = () => ({
    tripId,
    fromUserId: payerId,
    toUserId: ownerId,
    amountMinor: 1_000,
    method: 'cash' as const,
    settledOn: '2026-04-11',
    note: null,
  })

  const body = {
    title: 'Taxi',
    category: 'transport' as const,
    amountMinor: 900,
    originalAmountMinor: null,
    originalCurrency: null,
    spentOn: '2026-04-12',
    paidBy: null,
    splitMethod: 'equal' as const,
    notes: null,
    participants: [],
  }

  describe('a payment', () => {
    it.each([
      ['a viewer', () => viewer],
      ['a workspace member who only reads the trip', () => reader],
    ])('is refused for %s, and no payment is recorded', async (_name, who) => {
      stubs.scope = who()

      const error = await captureError(() =>
        inStart(() => recordPaymentFn({ data: payment() })),
      )

      expect(error).toBeInstanceOf(TripRoleError)
      expect(await listSettlements(tenant.scope, tripId)).toEqual([])
      expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
    })

    it('is recorded for an editor', async () => {
      stubs.scope = editor

      await inStart(() => recordPaymentFn({ data: payment() }))

      expect(await listSettlements(tenant.scope, tripId)).toHaveLength(1)
    })

    describe('in another currency', () => {
      it('keeps the pair the payer typed and the rate the server derived from it', async () => {
        stubs.scope = editor

        // The statement shows EUR 10.00; GBP 8.50 left the account.
        await inStart(() =>
          recordPaymentFn({
            data: {
              ...payment(),
              originalAmountMinor: 850,
              originalCurrency: 'gbp',
            },
          }),
        )

        const [stored] = await listSettlements(tenant.scope, tripId)
        expect(stored?.amountMinor).toBe(1_000)
        expect(stored?.currency).toBe('EUR')
        expect(stored?.originalAmountMinor).toBe(850)
        expect(stored?.originalCurrency).toBe('GBP')
        expect(stored?.exchangeRate).toBeCloseTo(1_000 / 850, 10)
      })

      it('stores no source figures when the source currency is the trip’s own', async () => {
        stubs.scope = editor

        await inStart(() =>
          recordPaymentFn({
            data: {
              ...payment(),
              originalAmountMinor: 1_000,
              originalCurrency: 'eur',
            },
          }),
        )

        const [stored] = await listSettlements(tenant.scope, tripId)
        expect(stored?.originalAmountMinor).toBeNull()
        expect(stored?.originalCurrency).toBeNull()
        expect(stored?.exchangeRate).toBeNull()
      })

      it.each([
        ['a currency with no source amount', { originalCurrency: 'GBP' }],
        ['an amount with no currency', { originalAmountMinor: 850 }],
        [
          'a source amount of nothing',
          { originalAmountMinor: 0, originalCurrency: 'GBP' },
        ],
      ])(
        'is refused with %s, and nothing is written',
        async (_name, source) => {
          stubs.scope = editor

          const error = await captureError(() =>
            inStart(() =>
              recordPaymentFn({ data: { ...payment(), ...source } }),
            ),
          )

          expect((error as { code?: string }).code).toBe(
            'CONVERSION_INCOMPLETE',
          )
          expect(await listSettlements(tenant.scope, tripId)).toEqual([])
          expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
        },
      )
    })

    describe('input', () => {
      it('accepts the source pair, or neither of them', () => {
        expect(recordPaymentSchema.safeParse(payment()).success).toBe(true)
        expect(
          recordPaymentSchema.safeParse({
            ...payment(),
            originalAmountMinor: 850,
            originalCurrency: 'GBP',
          }).success,
        ).toBe(true)
        expect(
          recordPaymentSchema.safeParse({
            ...payment(),
            originalAmountMinor: null,
            originalCurrency: null,
          }).success,
        ).toBe(true)
      })

      it.each([
        ['a rate', { exchangeRate: 1.18 }],
        ['a currency', { currency: 'GBP' }],
        ['a misspelled source amount', { originalAmount: 850 }],
      ])('is strict: %s is refused rather than dropped', (_name, extra) => {
        const result = recordPaymentSchema.safeParse({ ...payment(), ...extra })

        expect(result.success).toBe(false)
        expect(result.error?.issues[0]?.code).toBe('unrecognized_keys')
      })

      it('refuses a source currency that is not three letters', () => {
        expect(
          recordPaymentSchema.safeParse({
            ...payment(),
            originalAmountMinor: 850,
            originalCurrency: 'GB',
          }).success,
        ).toBe(false)
      })
    })
  })

  describe('an expense write', () => {
    it('is refused for a viewer, whichever of the three it is', async () => {
      stubs.scope = viewer

      const attempts = [
        () => createExpenseFn({ data: { tripId, expense: body } }),
        () => updateExpenseFn({ data: { tripId, expenseId, expense: body } }),
        () => deleteExpenseFn({ data: { tripId, expenseId } }),
      ]
      for (const attempt of attempts) {
        const error = await captureError(() => inStart(attempt))
        expect(error).toBeInstanceOf(TripRoleError)
      }

      const rows = await listTripExpenses(tenant.scope, tripId)
      expect(rows.map((row) => [row.title, row.amountMinor])).toEqual([
        ['Dinner', 6_000],
      ])
    })

    it('goes through for an editor', async () => {
      stubs.scope = editor

      await inStart(() => createExpenseFn({ data: { tripId, expense: body } }))

      expect(await listTripExpenses(tenant.scope, tripId)).toHaveLength(2)
    })
  })

  describe('the costs payload', () => {
    it('is still loaded by a viewer, who may read the whole ledger, and says they cannot write', async () => {
      const payload = await costsPayload(viewer, tripId)

      expect(payload.canWrite).toBe(false)
      expect(payload.expenses.map((row) => row.title)).toEqual(['Dinner'])
    })

    it('is still loaded by a workspace member who only reads the trip, and says they cannot write', async () => {
      const payload = await costsPayload(reader, tripId)

      expect(payload.canWrite).toBe(false)
      expect(payload.expenses).toHaveLength(1)
    })

    it.each([
      ['an editor', () => editor],
      ['the owner', () => tenant.scope],
    ])('tells %s they can write', async (_name, who) => {
      expect((await costsPayload(who(), tripId)).canWrite).toBe(true)
    })

    describe('the suggested rate', () => {
      async function pounds(
        trip: string,
        rate: number,
        spentOn: string,
      ): Promise<void> {
        await createExpense(tenant.scope, {
          tripId: trip,
          title: 'Receipt in pounds',
          amountMinor: 11_500,
          currency: 'EUR',
          originalAmountMinor: 10_000,
          originalCurrency: 'GBP',
          exchangeRate: rate,
          spentOn,
        })
      }

      it('is null while the trip has no foreign expense', async () => {
        expect(
          (await costsPayload(tenant.scope, tripId)).suggestedRate,
        ).toBeNull()
      })

      it('names the rate this trip last froze for each foreign currency, and the day it records', async () => {
        await pounds(tripId, 1.1, '2026-04-10')
        await pounds(tripId, 1.15, '2026-04-12')

        expect((await costsPayload(viewer, tripId)).suggestedRate).toEqual({
          GBP: { rate: 1.15, observedOn: '2026-04-12' },
        })
      })

      it('never carries a rate frozen on another trip, even a later one', async () => {
        const other = await createTrip(tenant.scope, {
          title: 'Porto, alone',
          startDate: '2026-07-10',
          endDate: '2026-07-13',
          currency: 'EUR',
        })
        await pounds(tripId, 1.15, '2026-04-12')
        await pounds(other.id, 1.5, '2026-07-11')

        expect(
          (await costsPayload(tenant.scope, tripId)).suggestedRate,
        ).toEqual({
          GBP: { rate: 1.15, observedOn: '2026-04-12' },
        })
      })
    })
  })

  describe('the display currency', () => {
    /** A trip kept in pounds on which a receipt in euros froze a rate of 0.85 pounds to the euro. */
    async function freezeEuroToPound(): Promise<void> {
      const london = await createTrip(tenant.scope, {
        title: 'London',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        currency: 'GBP',
      })
      await createExpense(tenant.scope, {
        tripId: london.id,
        title: 'Tickets',
        amountMinor: 8_500,
        currency: 'GBP',
        originalAmountMinor: 10_000,
        originalCurrency: 'EUR',
        exchangeRate: 0.85,
        spentOn: '2026-05-02',
      })
    }

    async function addPayments(count: number): Promise<void> {
      for (let index = 0; index < count; index += 1) {
        await createSettlement(tenant.scope, {
          tripId,
          fromUserId: payerId,
          toUserId: ownerId,
          amountMinor: 1_000 + index,
          settledOn: '2026-04-11',
        })
      }
    }

    /** The statements that looked up the newest frozen rate for a pair (the menu's list has no limit). */
    function rateLookups(): number {
      return harness.statements.filter(
        (sql) => /"original_currency" = \?/.test(sql) && /limit \?/.test(sql),
      ).length
    }

    it('shows each trip in its own currency when nothing is stored, and consults no rate', async () => {
      await addPayments(2)
      harness.statements.length = 0

      const payload = await costsPayload(tenant.scope, tripId)

      expect(payload.displayCurrency).toEqual({ mode: 'per-trip', code: 'EUR' })
      expect(payload.expenses.map((row) => row.convertedMinor)).toEqual([6_000])
      expect(payload.settlements.map((row) => row.convertedMinor)).toEqual(
        payload.settlements.map((row) => row.amountMinor),
      )
      expect(payload.unconverted).toEqual([])
      expect(rateLookups()).toBe(0)
    })

    it('converts each expense and payment into the stored code through the frozen rate', async () => {
      await freezeEuroToPound()
      await addPayments(1)
      await setDisplayCurrency(tenant.scope, 'GBP')

      const payload = await costsPayload(tenant.scope, tripId)

      expect(payload.displayCurrency).toEqual({ mode: 'fixed', code: 'GBP' })
      expect(payload.expenses.map((row) => row.convertedMinor)).toEqual([5_100])
      expect(payload.settlements.map((row) => row.convertedMinor)).toEqual([
        850,
      ])
      expect(payload.unconverted).toEqual([])
      // The accounting figures are what they were.
      expect(payload.expenses.map((row) => row.amountMinor)).toEqual([6_000])
    })

    it('asks for a rate once per pair, however many rows share it', async () => {
      await freezeEuroToPound()
      await addPayments(3)
      await setDisplayCurrency(tenant.scope, 'GBP')
      await createExpense(tenant.scope, {
        tripId,
        title: 'Coffee',
        amountMinor: 300,
        spentOn: '2026-04-11',
      })
      harness.statements.length = 0

      const payload = await costsPayload(tenant.scope, tripId)

      expect(payload.expenses).toHaveLength(2)
      expect(payload.settlements).toHaveLength(3)
      // One expenses query and one payments query for the single EUR to GBP pair.
      expect(rateLookups()).toBe(2)
    })

    it('still loads a trip with more rows than the lookup accepts currencies', async () => {
      await addPayments(70)
      await setDisplayCurrency(tenant.scope, 'GBP')

      const payload = await costsPayload(tenant.scope, tripId)

      expect(payload.settlements).toHaveLength(70)
      expect(payload.displayCurrency).toEqual({ mode: 'fixed', code: 'GBP' })
    })

    it('shows no converted figure, and names the pair and the day, when no rate answers', async () => {
      await setDisplayCurrency(tenant.scope, 'GBP')

      const payload = await costsPayload(tenant.scope, tripId)

      expect(payload.displayCurrency).toEqual({ mode: 'fixed', code: 'GBP' })
      expect(payload.expenses.map((row) => row.convertedMinor)).toEqual([null])
      expect(payload.unconverted).toEqual([
        { from: 'EUR', to: 'GBP', on: payload.today },
      ])
    })

    it('treats a stored code equal to the trip’s own as per-trip', async () => {
      await setDisplayCurrency(tenant.scope, 'EUR')
      harness.statements.length = 0

      const payload = await costsPayload(tenant.scope, tripId)

      expect(payload.displayCurrency).toEqual({ mode: 'per-trip', code: 'EUR' })
      expect(rateLookups()).toBe(0)
    })

    it('reads the caller’s own preference, never another member’s', async () => {
      await freezeEuroToPound()
      await setDisplayCurrency(tenant.scope, 'GBP')

      const other = await costsPayload(editor, tripId)

      expect(other.displayCurrency).toEqual({ mode: 'per-trip', code: 'EUR' })
    })

    it('offers the workspace default and the codes a frozen rate answers for', async () => {
      await freezeEuroToPound()

      const payload = await costsPayload(tenant.scope, tripId)

      expect(payload.displayChoices).toEqual({
        workspaceCode: 'EUR',
        rateCodes: ['GBP'],
      })
    })

    describe('the preference writer', () => {
      it('writes the caller’s own row from a code, and clears it from null', async () => {
        stubs.scope = editor
        await inStart(() => setDisplayCurrencyFn({ data: { code: 'GBP' } }))
        const editorId = editor.ctx.userId

        expect(await getDisplayCurrency(editor, editorId)).toBe('GBP')
        expect(await getDisplayCurrency(tenant.scope, ownerId)).toBeNull()

        await inStart(() => setDisplayCurrencyFn({ data: { code: null } }))
        expect(await getDisplayCurrency(editor, editorId)).toBeNull()
      })

      it('is strict: a user id, a lower-case code and a missing code are refused', () => {
        expect(
          setDisplayCurrencySchema.safeParse({ code: 'GBP' }).success,
        ).toBe(true)
        expect(setDisplayCurrencySchema.safeParse({ code: null }).success).toBe(
          true,
        )
        for (const bad of [
          { code: 'GBP', userId: 'someone-else' },
          { code: 'gbp' },
          { code: 'GB' },
          {},
        ]) {
          expect(setDisplayCurrencySchema.safeParse(bad).success).toBe(false)
        }
      })
    })
  })
})
