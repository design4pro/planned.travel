/** The real connection-search handler carries an operator block through its catch without charging. */
import { beforeEach, expect, it, vi } from 'vitest'
import type { ZodType } from 'zod'
import type * as EntitlementsModule from '#/server/billing/entitlements'

import { createPlatformTables } from '#/server/catalog/__tests__/platform-tables'
import { providerRegistry, providerUsage } from '#/server/db/schema'
import { resetProviderLimitMemo } from '#/server/metering/outbound'
import { rateMeterKey, rateWindowOf } from '#/server/metering/rate'
import { addTripMember, archiveTrip, createTrip } from '#/server/repos'
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

const { searchConnectionsFn, searchConnections, loadTransportDeskFn } =
  await import('../transports')

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

const query = {
  origin: { name: 'Lisbon', lat: 38.7132, lng: -9.1224 },
  destination: { name: 'Porto', lat: 41.1489, lng: -8.5851 },
  date: '2026-10-09',
  time: '08:00',
  modes: [],
}

it.each(['viewer', 'non-member', 'foreign'] as const)(
  'refuses %s before resolving a ceiling or constructing a transit runtime',
  async (role) => {
    const harness = await createHarness()
    const tenant = await harness.seedTenant('roles')
    const trip = await createTrip(tenant.scope, {
      title: 'Portugal',
      visibility: 'organization',
    })
    const userId = await tenant.addUser('Reader')
    if (role === 'viewer') {
      await addTripMember(tenant.scope, { tripId: trip.id, userId, role })
    }
    const scope =
      role === 'foreign'
        ? (await harness.seedTenant('foreign')).scope
        : tenant.scopeFor(userId)
    const ports = { ceiling: vi.fn(), transit: vi.fn() }
    await expect(
      searchConnections(scope, { tripId: trip.id, ...query }, ports),
    ).rejects.toMatchObject({
      code: role === 'foreign' ? 'NOT_FOUND' : 'FORBIDDEN',
    })
    expect(ports.ceiling).not.toHaveBeenCalled()
    expect(ports.transit).not.toHaveBeenCalled()
    stubs.scope = scope
    await expect(
      searchConnectionsFn({ data: { tripId: trip.id, ...query } }),
    ).rejects.toMatchObject({
      code: role === 'foreign' ? 'NOT_FOUND' : 'FORBIDDEN',
    })
    if (role !== 'foreign') {
      expect(
        await loadTransportDeskFn({ data: { tripId: trip.id } }),
      ).toMatchObject({ canSearchConnections: false })
    }
  },
)

it.each(['owner', 'editor'] as const)(
  'allows %s to search and exposes the capability even on an archived trip',
  async (role) => {
    const tenant = await (await createHarness()).seedTenant('writer')
    const trip = await createTrip(tenant.scope, { title: 'Portugal' })
    const userId = await tenant.addUser('Editor')
    await addTripMember(tenant.scope, {
      tripId: trip.id,
      userId,
      role: 'editor',
    })
    const scope = role === 'owner' ? tenant.scope : tenant.scopeFor(userId)
    const client = {
      search: vi.fn(async () => ({
        connections: [],
        attributions: [],
        caching: { cacheControl: null, expires: null, date: null, age: null },
      })),
    }
    const store = { get: async () => null, put: async () => {} }
    const ports = {
      ceiling: vi.fn(async () => 250),
      transit: vi.fn(
        (input: {
          organizationId: string
          userId: string
          ceiling: number
        }): TransitSearchRuntime => ({
          ...input,
          cache: store,
          counters: store,
          client,
          now: () => new Date('2026-10-01T10:00:00Z'),
          outbound: {
            db: null,
            now: () => new Date('2026-10-01T10:00:00Z'),
            waitUntil: () => {},
            logger: {
              debug: vi.fn(),
              info: vi.fn(),
              warn: vi.fn(),
              error: vi.fn(),
            } as unknown as Logger,
          },
        }),
      ),
    }
    for (const archived of [false, true]) {
      if (archived) await archiveTrip(tenant.scope, trip.id)
      stubs.scope = scope
      expect(
        await loadTransportDeskFn({ data: { tripId: trip.id } }),
      ).toMatchObject({ canSearchConnections: true })
      expect(
        await searchConnections(scope, { tripId: trip.id, ...query }, ports),
      ).toMatchObject({ ok: true, cached: false, ceiling: 250, remaining: 249 })
    }
    expect(client.search).toHaveBeenCalledTimes(2)
  },
)
