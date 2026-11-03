import { expect, it, vi } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import { createTrip } from '#/server/repos/trips'
import { createExpense } from '#/server/repos/expenses'
import { resolveRate } from '#/server/repos/rates'
import { createLogger, createMemorySink } from '#/server/observability'
import { createPublicRates } from '../public-rates'
import type { PublicRatesRuntime } from '../public-rates'

it('shares public observations while leaving two private frozen-rate ledgers untouched', async () => {
  const h = await createHarness()
  try {
    const a = await h.seedTenant('private-fx-a')
    const b = await h.seedTenant('private-fx-b')
    for (const [tenant, amount] of [
      [a, 98700],
      [b, 32100],
    ] as const) {
      const trip = await createTrip(tenant.scope, {
        title: 'Private money',
        currency: 'EUR',
        visibility: 'private',
      })
      await createExpense(tenant.scope, {
        tripId: trip.id,
        title: 'Private observation',
        amountMinor: amount,
        currency: 'EUR',
        exchangeRate: amount / 10000,
        originalAmountMinor: 10000,
        originalCurrency: 'USD',
        spentOn: '2026-11-03',
      })
    }
    const query = { from: 'USD', to: 'EUR', on: '2026-11-03' }
    const beforeA = await resolveRate(a.scope, query)
    const beforeB = await resolveRate(b.scope, query)
    expect(beforeA?.rate).toBe(9.87)
    expect(beforeB?.rate).toBe(3.21)
    const values = new Map<string, string>()
    const pending: Promise<unknown>[] = []
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      Response.json([
        { date: '2026-11-03', base: 'EUR', quote: 'EUR', rate: 1 },
        { date: '2026-11-03', base: 'EUR', quote: 'USD', rate: 1.25 },
      ]),
    )
    const now = () => Date.parse('2026-11-03T18:00:00Z')
    const runtime: PublicRatesRuntime = {
      fetch,
      now,
      sleep: async () => {},
      cache: {
        get: async (key) => values.get(key) ?? null,
        put: async (key, value) => {
          values.set(key, value)
        },
      },
      outbound: {
        db: h.db,
        now: () => new Date(now()),
        logger: createLogger({ sink: createMemorySink() }),
        waitUntil: (promise) => {
          pending.push(promise)
        },
      },
    }
    const read = createPublicRates()
    const first = await read(runtime, a.scope.ctx.organizationId)
    expect(await read(runtime, b.scope.ctx.organizationId)).toEqual(first)
    expect(first).toMatchObject({
      status: 'available',
      snapshot: { rates: { EUR: 1, USD: 1.25 } },
    })
    expect(fetch).toHaveBeenCalledTimes(1)
    const publicData = JSON.stringify([
      first,
      [...values],
      [...fetch.mock.calls],
    ])
    for (const secret of [
      a.scope.ctx.organizationId,
      b.scope.ctx.organizationId,
      'Private money',
      'Private observation',
      '9.87',
      '3.21',
    ])
      expect(publicData).not.toContain(secret)
    expect(await resolveRate(a.scope, query)).toEqual(beforeA)
    expect(await resolveRate(b.scope, query)).toEqual(beforeB)
    await Promise.all(pending)
  } finally {
    h.close()
  }
})
