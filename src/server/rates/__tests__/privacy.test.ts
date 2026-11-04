import { expect, it, vi } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
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
    const sink = createMemorySink()
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
        logger: createLogger({ sink }),
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
    await Promise.all(pending)
    const publicData = JSON.stringify([
      first,
      [...values],
      [...fetch.mock.calls],
      sink.records,
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

it('keeps workspace attribution out of real Drizzle write-failure logs without failing the quote', async () => {
  const organizationId = 'private-rates-workspace'
  const run = vi.fn(async () => {
    throw new Error('private-driver-detail')
  })
  const statement = {
    bind: vi.fn().mockReturnThis(),
    all: async () => ({ results: [] }),
    raw: async () => [],
    run,
  }
  const db = drizzle({ prepare: () => statement } as unknown as D1Database)
  const sink = createMemorySink()
  const pending: Promise<unknown>[] = []
  const now = () => Date.parse('2026-11-04T12:00:00Z')
  const result = await createPublicRates()(
    {
      cache: { get: async () => null, put: async () => {} },
      fetch: async () =>
        Response.json([
          { date: '2026-11-04', base: 'EUR', quote: 'EUR', rate: 1 },
          { date: '2026-11-04', base: 'EUR', quote: 'USD', rate: 1.25 },
        ]),
      now,
      sleep: async () => {},
      outbound: {
        db,
        now: () => new Date(now()),
        waitUntil: (promise) => pending.push(promise),
        logger: createLogger({ sink }),
      },
    },
    organizationId,
  )
  await Promise.all(pending)
  expect(result.status).toBe('available')
  expect(run).toHaveBeenCalledTimes(1)
  expect(JSON.stringify(statement.bind.mock.calls)).toContain(organizationId)
  expect(sink.records).toHaveLength(1)
  expect(sink.records[0]).toMatchObject({
    msg: 'provider usage record failed',
    provider: 'frankfurter',
  })
  const logged = JSON.stringify(sink.records)
  expect(logged).not.toContain(organizationId)
  expect(logged).not.toContain('private-driver-detail')
  expect(logged).not.toContain('errorStack')
})
