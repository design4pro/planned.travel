/**
 * The boundary of re-basing a trip's budget currency: who may commit it, and what a commit leaves
 * behind (#840).
 *
 * The same harness as `costs.test.ts`: a migrated SQLite database, real repositories and roles, and
 * `./context` replaced because it reaches `cloudflare:workers`. The arithmetic and the atomicity are
 * `src/server/repos/__tests__/trip-currency-commit.test.ts`; this file holds what only the function
 * adds - the audit row, the room patch, and that a refusal leaves neither.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { convertMinor } from '#/lib/money'
import {
  CurrencyRefusalError,
  TripRoleError,
  addTripMember,
  createExpense,
  createTrip,
  listEntityHistory,
  requireTrip,
  tripsRepository,
} from '#/server/repos'
import { captureError, createHarness } from '#/server/repos/__tests__/harness'

import type { TenantScope } from '#/server/repos'
import type { SeededTenant } from '#/server/repos/__tests__/harness'

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  mirrorToRoom: vi.fn(async (): Promise<void> => undefined),
}))

vi.mock('../context', () => ({
  appScope: async (): Promise<unknown> => {
    if (stubs.scope === null) {
      throw new Error('unauthenticated')
    }
    return stubs.scope
  },
  mirrorToRoom: stubs.mirrorToRoom,
  patch: (kind: string, id: string, fields: unknown) => ({
    entity: { kind, id },
    op: 'upsert',
    fields,
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
      request: new Request('https://planned.travel/_serverFn/trip-currency', {
        method: 'POST',
      }),
    },
    run,
  )
}

const { changeTripCurrencyFn } = await import('../trip-currency')

describe('committing a change of a trip’s budget currency', () => {
  let tenant: SeededTenant
  let tripId: string
  let editor: TenantScope

  beforeEach(async () => {
    stubs.mirrorToRoom.mockClear()
    const harness = await createHarness()
    tenant = await harness.seedTenant('currency-boundary')
    const editorId = await tenant.addUser('An editor')
    const trip = await createTrip(tenant.scope, {
      title: 'Lisbon, together',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      currency: 'EUR',
    })
    tripId = trip.id
    await addTripMember(tenant.scope, {
      tripId,
      userId: editorId,
      role: 'editor',
    })
    editor = tenant.scopeFor(editorId)
    await createExpense(tenant.scope, {
      tripId,
      title: 'Dinner',
      amountMinor: 6_000,
      spentOn: '2026-04-10',
      paidBy: tenant.ownerUserId,
      participants: [{ userId: tenant.ownerUserId }],
    })
    await tripsRepository.requireUpdate(tenant.scope, tripId, {
      budgetTargetMinor: 100_000,
    })
  })

  it('records who changed what in the audit trail, and tells the room the new figures', async () => {
    stubs.scope = tenant.scope

    await inStart(() =>
      changeTripCurrencyFn({ data: { tripId, to: 'JPY', rate: 160 } }),
    )

    expect((await requireTrip(tenant.scope, tripId)).currency).toBe('JPY')
    const [entry] = await listEntityHistory(tenant.scope, 'trip', tripId)
    expect(entry).toMatchObject({
      action: 'trip.currency_changed',
      actorUserId: tenant.ownerUserId,
      entityId: tripId,
      metadata: {
        from: 'EUR',
        to: 'JPY',
        rate: 160,
        expenses: 1,
        settlements: 0,
        budgetItems: 0,
        pinnedPrices: 0,
        budgetTargetBefore: 100_000,
        budgetTargetAfter: convertMinor(100_000, 160, 'EUR', 'JPY'),
      },
    })
    expect(stubs.mirrorToRoom).toHaveBeenCalledTimes(1)
    expect(stubs.mirrorToRoom).toHaveBeenCalledWith(tenant.scope, tripId, [
      expect.objectContaining({
        entity: { kind: 'trip', id: tripId },
        fields: expect.objectContaining({
          currency: 'JPY',
          budgetTargetMinor: expect.any(Number),
        }),
      }),
    ])
  })

  it('leaves no audit row and no room patch when the commit is refused', async () => {
    stubs.scope = tenant.scope

    const error = await captureError(() =>
      inStart(() => changeTripCurrencyFn({ data: { tripId, to: 'JPY' } })),
    )

    expect(error).toBeInstanceOf(CurrencyRefusalError)
    expect(error.message).toBe('costs.refusal.rebaseChanged')
    expect(await listEntityHistory(tenant.scope, 'trip', tripId)).toEqual([])
    expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
  })

  it('passes the currency the owner previewed on, so a stale tab’s rate is refused', async () => {
    stubs.scope = tenant.scope

    const error = await captureError(() =>
      inStart(() =>
        changeTripCurrencyFn({
          data: { tripId, from: 'GBP', to: 'JPY', rate: 160 },
        }),
      ),
    )

    expect(error).toBeInstanceOf(CurrencyRefusalError)
    expect((await requireTrip(tenant.scope, tripId)).currency).toBe('EUR')
    expect(await listEntityHistory(tenant.scope, 'trip', tripId)).toEqual([])
    expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
  })

  it('refuses an editor, who may log money but not change the trip’s currency', async () => {
    stubs.scope = editor

    const error = await captureError(() =>
      inStart(() =>
        changeTripCurrencyFn({ data: { tripId, to: 'JPY', rate: 160 } }),
      ),
    )

    expect(error).toBeInstanceOf(TripRoleError)
    expect((await requireTrip(tenant.scope, tripId)).currency).toBe('EUR')
    expect(await listEntityHistory(tenant.scope, 'trip', tripId)).toEqual([])
    expect(stubs.mirrorToRoom).not.toHaveBeenCalled()
  })
})
