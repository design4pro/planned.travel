/** The real connection-search handler carries an operator block through its catch without charging. */
import { beforeEach, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import type * as EntitlementsModule from '#/server/billing/entitlements'

import { createPlatformTables } from '#/server/catalog/__tests__/platform-tables'
import { providerRegistry, providerUsage } from '#/server/db/schema'
import { resetProviderLimitMemo } from '#/server/metering/outbound'
import { rateMeterKey, rateWindowOf } from '#/server/metering/rate'
import { createTrip } from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'
import type { TransitSearchRuntime } from '#/server/transit/search'
import type { Logger } from '#/server/observability'

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  transit: null as TransitSearchRuntime | null,
}))

// Outside the Start build the RPC transform discards a handler's return value. This adapter
// keeps the real handler and Zod validator, replacing only the generated RPC transport.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    validator: <T>(schema: ZodType<T>) => ({
      handler:
        <R>(handler: (ctx: { data: T }) => Promise<R>) =>
        ({ data }: { data: unknown }) =>
          handler({ data: schema.parse(data) }),
    }),
  }),
}))

vi.mock('../context', () => ({
  appScope: async () => {
    if (stubs.scope === null) throw new Error('unauthenticated')
    return stubs.scope
  },
  mirrorToRoom: vi.fn(),
  orNull: vi.fn(),
  patch: vi.fn(),
  tombstone: vi.fn(),
}))
vi.mock('#/server/billing/runtime.cloudflare', () => ({
  billingRuntime: () => ({}),
}))
vi.mock('#/server/billing/entitlements', async (importOriginal) => {
  const actual = await importOriginal<typeof EntitlementsModule>()
  return {
    ...actual,
    loadPlanState: async () => ({
      ...actual.planStateFromRecord(null),
      planId: 'solo',
    }),
  }
})
vi.mock('#/server/transit/bindings', () => ({
  transitRuntime: () => {
    if (stubs.transit === null) throw new Error('missing test runtime')
    return stubs.transit
  },
}))

const { searchConnectionsFn } = await import('../transports')

beforeEach(() => resetProviderLimitMemo())

it('returns the existing unreachable refusal and preserves the remaining allowance', async () => {
  const tenant = await (await createHarness()).seedTenant('blocked-search')
  stubs.scope = tenant.scope
  const trip = await createTrip(tenant.scope, {
    title: 'Portugal',
    startDate: '2026-10-09',
    endDate: '2026-10-10',
  })
  const tables = await createPlatformTables()
  await tables.db.insert(providerRegistry).values({
    slug: 'here',
    label: 'HERE',
    limitWindow: 'month',
    callLimit: 0,
    policy: 'block',
  })
  const at = new Date('2026-10-01T10:00:00Z')
  const key = rateMeterKey(
    'transit_searches_per_month',
    tenant.scope.ctx.organizationId,
    rateWindowOf(at),
  )
  const entries = new Map<string, string>([[key, '17']])
  const store = {
    get: async (name: string) => entries.get(name) ?? null,
    put: async (name: string, value: string) => {
      entries.set(name, value)
    },
  }
  const deferred: Array<Promise<unknown>> = []
  const search = vi.fn(async () => {
    throw new Error('vendor must not be called')
  })
  stubs.transit = {
    organizationId: tenant.scope.ctx.organizationId,
    userId: tenant.scope.ctx.userId,
    ceiling: 250,
    now: () => at,
    cache: store,
    counters: store,
    client: { search },
    outbound: {
      db: tables.db,
      now: () => at,
      waitUntil: (promise) => {
        deferred.push(promise)
      },
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as unknown as Logger,
    },
  }
  const result = await searchConnectionsFn({
    data: {
      tripId: trip.id,
      origin: { name: 'Lisbon', lat: 38.7132, lng: -9.1224 },
      destination: { name: 'Porto', lat: 41.1489, lng: -8.5851 },
      date: '2026-10-09',
      time: '08:00',
      modes: [],
    },
  })
  expect(result).toEqual({ ok: false, reason: 'unreachable', ceiling: 250 })
  expect(250 - Number(await store.get(key))).toBe(233)
  expect(search).not.toHaveBeenCalled()
  await Promise.all(deferred)
  expect(await tables.db.select().from(providerUsage)).toMatchObject([
    { calls: 0, errors: 0, blocked: 1 },
  ])
})
