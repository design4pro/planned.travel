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

import { eq } from 'drizzle-orm'

import { member } from '#/server/db/auth-schema'
import { expenseShares } from '#/server/db/schema'
import {
  CurrencyRefusalError,
  TripArchivedError,
  archiveTrip,
  restoreTrip,
  NotFoundError,
  TripRoleError,
  addTripMember,
  changeTripCurrency,
  createExpense,
  createSettlement,
  createTrip,
  deleteExpense,
  getExpenseWithShares,
  getMemberBalances,
  listAuditLog,
  getDisplayCurrency,
  listSettlements,
  setDisplayCurrency,
  suggestSettlements,
  listTripExpenses,
  removeTripMember,
  updateTrip,
} from '#/server/repos'
import { captureError, createHarness } from '#/server/repos/__tests__/harness'

import type { TenantScope } from '#/server/repos'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  notificationDeps: vi.fn(() => ({})),
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
  notificationDeps: stubs.notificationDeps,
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
  deletePaymentFn,
  deletePaymentSchema,
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
    stubs.notificationDeps.mockClear()
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

    describe('from a tab that has not seen the trip change its currency', () => {
      beforeEach(async () => {
        await changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: 160 })
      })

      it('is refused with the key, records nothing and tells no room', async () => {
        stubs.scope = editor

        const error = await captureError(() =>
          inStart(() =>
            recordPaymentFn({
              data: { ...payment(), expectedTripCurrency: 'eur' },
            }),
          ),
        )

        expect(error).toBeInstanceOf(CurrencyRefusalError)
        expect(error.message).toBe('costs.refusal.tripCurrencyChanged')
        expect(await listSettlements(tenant.scope, tripId)).toEqual([])
        expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
      })

      it('is recorded when the tab names the currency the trip now has, or none', async () => {
        stubs.scope = editor

        await inStart(() =>
          recordPaymentFn({
            data: { ...payment(), expectedTripCurrency: 'JPY' },
          }),
        )
        await inStart(() => recordPaymentFn({ data: payment() }))

        expect(await listSettlements(tenant.scope, tripId)).toHaveLength(2)
      })
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

      it('accepts the currency the form was filled in under, and refuses one that is not a code', () => {
        expect(
          recordPaymentSchema.safeParse({
            ...payment(),
            expectedTripCurrency: 'EUR',
          }).success,
        ).toBe(true)
        expect(
          recordPaymentSchema.safeParse({
            ...payment(),
            expectedTripCurrency: 'EU',
          }).success,
        ).toBe(false)
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

  describe('deleting a payment', () => {
    let settlementId: string
    let balancesWithout: Awaited<ReturnType<typeof getMemberBalances>>
    let suggestionsWithout: Awaited<ReturnType<typeof suggestSettlements>>

    beforeEach(async () => {
      balancesWithout = await getMemberBalances(tenant.scope, tripId)
      suggestionsWithout = await suggestSettlements(tenant.scope, tripId)
      const recorded = await createSettlement(tenant.scope, payment())
      settlementId = recorded.id
      stubs.mirrorToRoom.mockClear()
    })

    const remove = (id = settlementId, onTrip = tripId) =>
      inStart(() =>
        deletePaymentFn({ data: { tripId: onTrip, settlementId: id } }),
      )

    const paymentAudit = async () =>
      (await listAuditLog(tenant.scope, { entityType: 'payment' })).items

    it.each([
      ['a viewer', () => viewer],
      ['a workspace member who only reads the trip', () => reader],
    ])(
      'is refused for %s: the payment stays, no room is told, nothing is audited',
      async (_name, who) => {
        stubs.scope = who()

        const error = await captureError(() => remove())

        expect(error).toBeInstanceOf(TripRoleError)
        expect(await listSettlements(tenant.scope, tripId)).toHaveLength(1)
        expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
        expect(await paymentAudit()).toEqual([])
      },
    )

    it('is removed by an editor who did not record it, and the balances and suggestions forget it', async () => {
      stubs.scope = editor
      const withPayment = await getMemberBalances(tenant.scope, tripId)
      expect(withPayment).not.toEqual(balancesWithout)

      await remove()

      expect(await listSettlements(tenant.scope, tripId)).toEqual([])
      expect(await getMemberBalances(tenant.scope, tripId)).toEqual(
        balancesWithout,
      )
      expect(await suggestSettlements(tenant.scope, tripId)).toEqual(
        suggestionsWithout,
      )
    })

    it('is removed by the owner', async () => {
      stubs.scope = tenant.scope

      await remove()

      expect(await listSettlements(tenant.scope, tripId)).toEqual([])
    })

    it('tells the room the trip’s money changed, with no tombstone', async () => {
      stubs.scope = editor

      await remove()

      expect(stubs.mirrorToRoom).toHaveBeenCalledTimes(1)
      expect(stubs.mirrorToRoom).toHaveBeenCalledWith(
        expect.anything(),
        tripId,
        [
          {
            entity: { kind: 'trip', id: tripId },
            op: 'upsert',
            fields: { expensesChangedAt: expect.any(Number) },
          },
        ],
      )
    })

    it('writes one payment.deleted entry that carries the amount and currency and no person', async () => {
      stubs.scope = editor

      await remove()

      const entries = await paymentAudit()
      expect(entries).toHaveLength(1)
      expect(entries[0]).toMatchObject({
        action: 'payment.deleted',
        entityType: 'payment',
        entityId: settlementId,
        metadata: { tripId, amountMinor: 1_000, currency: 'EUR' },
      })
      expect(Object.keys(entries[0]?.metadata ?? {}).sort()).toEqual([
        'amountMinor',
        'currency',
        'tripId',
      ])
    })

    it('answers a missing id like an id of another trip of the workspace, and deletes nothing', async () => {
      stubs.scope = editor
      const elsewhere = await createTrip(tenant.scope, {
        title: 'Porto',
        slug: 'porto',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        currency: 'EUR',
      })

      const missing = await captureError(() => remove('missing-payment-id'))
      const otherTrip = await captureError(() =>
        remove(settlementId, elsewhere.id),
      )

      expect(missing).toBeInstanceOf(NotFoundError)
      expect(otherTrip).toBeInstanceOf(NotFoundError)
      expect(await listSettlements(tenant.scope, tripId)).toHaveLength(1)
      expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
      expect(await paymentAudit()).toEqual([])
    })

    it('answers an id of another workspace as a missing id: nothing is deleted and neither workspace is audited', async () => {
      const stranger = await harness.seedTenant('payment-stranger')
      const strangerTrip = await createTrip(stranger.scope, {
        title: 'Elsewhere',
        slug: 'elsewhere',
        startDate: '2026-04-10',
        endDate: '2026-04-13',
        currency: 'EUR',
      })
      const strangerPayer = await stranger.addUser('Their payer')
      await addTripMember(stranger.scope, {
        tripId: strangerTrip.id,
        userId: strangerPayer,
        role: 'viewer',
      })
      const theirs = await createSettlement(stranger.scope, {
        tripId: strangerTrip.id,
        fromUserId: strangerPayer,
        toUserId: stranger.ownerUserId,
        amountMinor: 500,
        method: 'cash',
        settledOn: '2026-04-11',
        note: null,
      })
      stubs.scope = editor

      const naming = await captureError(() => remove(theirs.id))
      const withTheirTrip = await captureError(() =>
        remove(theirs.id, strangerTrip.id),
      )

      expect(naming).toBeInstanceOf(NotFoundError)
      expect(withTheirTrip).toBeInstanceOf(NotFoundError)
      expect(
        await listSettlements(stranger.scope, strangerTrip.id),
      ).toHaveLength(1)
      expect(await listSettlements(tenant.scope, tripId)).toHaveLength(1)
      expect(await paymentAudit()).toEqual([])
      expect(
        (await listAuditLog(stranger.scope, { entityType: 'payment' })).items,
      ).toEqual([])
    })

    it('is refused on an archived trip, and the payment stays', async () => {
      stubs.scope = editor
      await archiveTrip(tenant.scope, tripId)

      const error = await captureError(() => remove())

      expect(error).toBeInstanceOf(TripArchivedError)
      expect(await listSettlements(tenant.scope, tripId)).toHaveLength(1)
      expect(await paymentAudit()).toEqual([])
    })

    it('removes a payment whose recorder has left the trip', async () => {
      const leaving = await tenant.addUser('The recorder who leaves')
      const seat = await addTripMember(tenant.scope, {
        tripId,
        userId: leaving,
        role: 'editor',
      })
      const theirs = await createSettlement(tenant.scopeFor(leaving), payment())
      await removeTripMember(tenant.scope, seat.id)
      stubs.scope = editor

      await remove(theirs.id)

      expect(
        (await listSettlements(tenant.scope, tripId)).map((row) => row.id),
      ).toEqual([settlementId])
    })

    it('removes a payment the trip’s currency change re-based', async () => {
      await changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: 160 })
      stubs.scope = editor

      await remove()

      expect(await listSettlements(tenant.scope, tripId)).toEqual([])
      expect((await paymentAudit())[0]?.metadata).toMatchObject({
        currency: 'JPY',
      })
    })

    describe('input', () => {
      it('is strict: it takes the trip and the payment and nothing else', () => {
        expect(
          deletePaymentSchema.safeParse({ tripId, settlementId }).success,
        ).toBe(true)
        expect(
          deletePaymentSchema.safeParse({ tripId, settlementId, note: 'x' })
            .success,
        ).toBe(false)
        expect(deletePaymentSchema.safeParse({ tripId }).success).toBe(false)
        expect(deletePaymentSchema.safeParse({ settlementId }).success).toBe(
          false,
        )
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

    describe('from a tab that has not seen the trip change its currency', () => {
      beforeEach(async () => {
        await changeTripCurrency(tenant.scope, tripId, { to: 'JPY', rate: 160 })
        stubs.mirrorToRoom.mockClear()
        stubs.notificationDeps.mockClear()
      })

      it.each([
        [
          'logging',
          () =>
            createExpenseFn({
              data: { tripId, expense: { ...body, currency: 'EUR' } },
            }),
        ],
        [
          'editing',
          () =>
            updateExpenseFn({
              data: {
                tripId,
                expenseId,
                expense: { ...body, currency: 'EUR' },
              },
            }),
        ],
      ])(
        'refuses %s with the key and writes nothing',
        async (_name, attempt) => {
          stubs.scope = editor
          const before = await listTripExpenses(tenant.scope, tripId)

          const error = await captureError(() => inStart(attempt))

          expect(error).toBeInstanceOf(CurrencyRefusalError)
          expect(error.message).toBe('costs.refusal.tripCurrencyChanged')
          expect(await listTripExpenses(tenant.scope, tripId)).toEqual(before)
          expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
        },
      )

      it('still takes an expense from a tab that names no currency', async () => {
        stubs.scope = editor

        await inStart(() =>
          createExpenseFn({ data: { tripId, expense: body } }),
        )

        expect(await listTripExpenses(tenant.scope, tripId)).toHaveLength(2)
      })
    })
  })

  it.each([
    ['owner', () => tenant.scope],
    ['editor', () => editor],
  ])(
    'refuses stale %s writes without notifications or collaboration updates',
    async (_role, who) => {
      stubs.scope = who()
      await archiveTrip(tenant.scope, tripId)
      const before = await costsPayload(who(), tripId)
      const writes: ReadonlyArray<() => Promise<unknown>> = [
        () =>
          createExpenseFn({
            data: {
              tripId,
              expense: {
                ...body,
                participants: [{ userId: payerId }],
              },
            },
          }),
        () =>
          updateExpenseFn({
            data: { tripId, expenseId, expense: { ...body, title: 'Changed' } },
          }),
        () => deleteExpenseFn({ data: { tripId, expenseId } }),
        () => recordPaymentFn({ data: payment() }),
      ]
      for (const write of writes) {
        expect(await captureError(() => inStart(write))).toBeInstanceOf(
          TripArchivedError,
        )
      }
      expect(await costsPayload(who(), tripId)).toEqual(before)
      expect(stubs.notificationDeps).not.toHaveBeenCalled()
      expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
      expect(before.canWrite).toBe(false)
      await restoreTrip(tenant.scope, tripId)
      expect((await costsPayload(who(), tripId)).canWrite).toBe(true)
    },
  )

  it('keeps display currency preferences writable on an archived trip', async () => {
    await archiveTrip(tenant.scope, tripId)
    stubs.scope = viewer
    await inStart(() => setDisplayCurrencyFn({ data: { code: 'GBP' } }))
    expect(await getDisplayCurrency(viewer, viewer.ctx.userId)).toBe('GBP')
    const payload = await costsPayload(viewer, tripId)
    expect(payload.canWrite).toBe(false)
    expect(payload.displayCurrency).toMatchObject({ code: 'GBP' })
    expect(payload.expenses.map((row) => row.title)).toEqual(['Dinner'])
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

    it('keeps a person who left the workspace in the list, marked, and nobody else', async () => {
      await harness.db.delete(member).where(eq(member.userId, payerId))

      const payload = await costsPayload(tenant.scope, tripId)

      expect(
        payload.people.map((person) => [person.userId, person.leftWorkspace]),
      ).toContainEqual([payerId, true])
      expect(
        payload.people
          .filter((person) => person.userId !== payerId)
          .every((person) => !person.leftWorkspace),
      ).toBe(true)
      expect(payload.people).toHaveLength(4)
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

  describe('an expense whose split carries someone who has left the trip', () => {
    let boatId: string
    let leaverId: string
    let goneId: string
    let strangerId: string
    let strangerEmail: string

    beforeEach(async () => {
      leaverId = await tenant.addUser('Lena who left the trip')
      goneId = await tenant.addUser('Gil who left the workspace')
      const leaving = await addTripMember(tenant.scope, {
        tripId,
        userId: leaverId,
        role: 'editor',
      })
      const going = await addTripMember(tenant.scope, {
        tripId,
        userId: goneId,
        role: 'editor',
      })
      const boat = await createExpense(tenant.scope, {
        tripId,
        title: 'Boat',
        amountMinor: 9_000,
        spentOn: '2026-04-11',
        paidBy: ownerId,
        participants: [
          { userId: ownerId },
          { userId: payerId },
          { userId: leaverId },
          { userId: goneId },
        ],
      })
      boatId = boat.expense.id
      await removeTripMember(tenant.scope, leaving.id)
      await removeTripMember(tenant.scope, going.id)
      await harness.db.delete(member).where(eq(member.userId, goneId))

      // A share row naming a user of another workspace: no writer produces one, so it is planted.
      const other = await harness.seedTenant('another-workspace')
      strangerId = await other.addUser('Stranger from another workspace')
      strangerEmail = `${strangerId}@example.test`
      await harness.db.insert(expenseShares).values({
        organizationId: tenant.organizationId,
        tripId,
        expenseId: boatId,
        userId: strangerId,
        shareMinor: 0,
        weight: 1,
      })
    })

    const edit = (participants: Array<{ userId: string }>) => ({
      tripId,
      expenseId: boatId,
      expense: { ...body, title: 'Boat', amountMinor: 9_000, participants },
    })

    const shareUsers = async (): Promise<Array<string>> =>
      (await getExpenseWithShares(tenant.scope, boatId)).shares
        .map((row) => row.userId)
        .sort()

    it('names them in the payload, with a name only when the workspace still knows them', async () => {
      const payload = await costsPayload(tenant.scope, tripId)

      const byUser = new Map(
        payload.departedPeople.map((person) => [person.userId, person]),
      )
      expect(byUser.get(leaverId)).toEqual({
        userId: leaverId,
        name: 'Lena who left the trip',
        image: null,
      })
      expect(byUser.get(goneId)?.name).toBeNull()
      expect(
        payload.departedPeople.map((person) => person.userId).sort(),
      ).toEqual([leaverId, goneId, strangerId].sort())
    })

    it('does not list anyone who is still on the trip', async () => {
      const payload = await costsPayload(tenant.scope, tripId)

      const departed = new Set(
        payload.departedPeople.map((person) => person.userId),
      )
      for (const person of payload.people) {
        expect(departed.has(person.userId)).toBe(false)
      }
    })

    it('shows nothing about a user of another workspace beyond the id the shares already carry', async () => {
      const payload = await costsPayload(tenant.scope, tripId)

      expect(
        payload.departedPeople.find((person) => person.userId === strangerId),
      ).toEqual({ userId: strangerId, name: null, image: null })
      const wire = JSON.stringify(payload)
      expect(wire).not.toContain('Stranger from another workspace')
      expect(wire).not.toContain(strangerEmail)
    })

    it('carries no email or role for a departed person', async () => {
      const payload = await costsPayload(tenant.scope, tripId)

      for (const person of payload.departedPeople) {
        expect(Object.keys(person).sort()).toEqual(['image', 'name', 'userId'])
      }
    })

    it('is empty when every share belongs to someone on the trip', async () => {
      await deleteExpense(tenant.scope, tripId, boatId)

      const payload = await costsPayload(tenant.scope, tripId)

      expect(payload.departedPeople).toEqual([])
    })

    it('keeps their share when the edit sends it back, at a full equal part', async () => {
      stubs.scope = editor
      const before = (await getExpenseWithShares(tenant.scope, boatId)).shares
      const keep = [ownerId, payerId, leaverId, goneId, strangerId]

      await inStart(() =>
        updateExpenseFn({ data: edit(keep.map((userId) => ({ userId }))) }),
      )

      const after = (await getExpenseWithShares(tenant.scope, boatId)).shares
      expect(await shareUsers()).toEqual([...keep].sort())
      expect(after.reduce((sum, row) => sum + row.shareMinor, 0)).toBe(9_000)
      // Everyone sent back, a departed person included, carries a full equal part: the cost is
      // not moved onto the travellers who stayed.
      for (const row of after) {
        expect(row.shareMinor).toBe(1_800)
      }
      expect(before.map((row) => row.userId).sort()).toEqual([...keep].sort())
    })

    it('drops their share when the edit leaves them out on purpose', async () => {
      stubs.scope = editor

      await inStart(() =>
        updateExpenseFn({
          data: edit([{ userId: ownerId }, { userId: payerId }]),
        }),
      )

      expect(await shareUsers()).toEqual([ownerId, payerId].sort())
    })

    it('still refuses a person who was never on the expense, and leaves its split alone', async () => {
      stubs.scope = editor
      const neverId = await tenant.addUser('Never on the trip')
      const before = await shareUsers()

      const error = await captureError(() =>
        inStart(() =>
          updateExpenseFn({
            data: edit([{ userId: ownerId }, { userId: neverId }]),
          }),
        ),
      )

      expect(error).toBeInstanceOf(NotFoundError)
      expect(await shareUsers()).toEqual(before)
    })
  })

  describe('a payer who has left the trip and holds no share, and a party to a payment who has left it', () => {
    let ferryId: string
    let paidAwayId: string
    let owedAwayId: string

    beforeEach(async () => {
      paidAwayId = await tenant.addUser('Pia who paid and left')
      owedAwayId = await tenant.addUser('Otto who was paid and left')
      const paying = await addTripMember(tenant.scope, {
        tripId,
        userId: paidAwayId,
        role: 'editor',
      })
      const owed = await addTripMember(tenant.scope, {
        tripId,
        userId: owedAwayId,
        role: 'editor',
      })
      const ferry = await createExpense(tenant.scope, {
        tripId,
        title: 'Ferry',
        amountMinor: 4_000,
        spentOn: '2026-04-11',
        paidBy: paidAwayId,
        participants: [{ userId: ownerId }, { userId: payerId }],
      })
      ferryId = ferry.expense.id
      await createSettlement(tenant.scope, {
        ...payment(),
        fromUserId: ownerId,
        toUserId: owedAwayId,
      })
      await removeTripMember(tenant.scope, paying.id)
      await removeTripMember(tenant.scope, owed.id)
    })

    it('lists them by name, so every part of the screen can word them', async () => {
      const payload = await costsPayload(tenant.scope, tripId)

      const byUser = new Map(
        payload.departedPeople.map((person) => [person.userId, person.name]),
      )
      expect(byUser.get(paidAwayId)).toBe('Pia who paid and left')
      expect(byUser.get(owedAwayId)).toBe('Otto who was paid and left')
    })

    it('lists a departed payer once, and never someone who is still on the trip', async () => {
      const payload = await costsPayload(tenant.scope, tripId)

      const ids = payload.departedPeople.map((person) => person.userId)
      expect(ids.filter((id) => id === paidAwayId)).toHaveLength(1)
      expect(ids).not.toContain(ownerId)
      expect(ids).not.toContain(payerId)
    })

    it('keeps the payer when the edit sends it back unchanged', async () => {
      stubs.scope = editor

      await inStart(() =>
        updateExpenseFn({
          data: {
            tripId,
            expenseId: ferryId,
            expense: {
              ...body,
              title: 'Ferry',
              amountMinor: 4_000,
              paidBy: paidAwayId,
              participants: [{ userId: ownerId }, { userId: payerId }],
            },
          },
        }),
      )

      const stored = (await costsPayload(tenant.scope, tripId)).expenses.find(
        (row) => row.id === ferryId,
      )
      expect(stored?.paidBy).toBe(paidAwayId)
    })

    it('still refuses a departed person taken from another expense as the payer', async () => {
      stubs.scope = editor
      const error = await captureError(() =>
        inStart(() =>
          updateExpenseFn({
            data: {
              tripId,
              expenseId: ferryId,
              expense: {
                ...body,
                title: 'Ferry',
                amountMinor: 4_000,
                paidBy: owedAwayId,
                participants: [{ userId: ownerId }, { userId: payerId }],
              },
            },
          }),
        ),
      )

      expect(error).toBeInstanceOf(NotFoundError)
    })
  })
})
