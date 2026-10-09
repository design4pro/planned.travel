/**
 * The transit proxy against the real provider ledger (#214).
 *
 * `search.test.ts` drives the order of operations with `db: null`, `callProvider`'s documented "no
 * handle" state: the gate stays open and the counter no-ops, because metering is never a reason a
 * call does not happen. That is the right runtime for asserting *when* the vendor is called and the
 * wrong one for asserting that the call is counted, whose regressions are all invisible — a search
 * that stops being recorded still answers correctly, and a `block` policy that stops being honoured
 * still bills quietly.
 *
 * So these cases drive `searchTransitConnections` against a real SQLite database through the
 * platform-table fixture, with the real HERE client over a `fetch` the test wrote — which is what
 * makes `refused`, `unreachable` and `malformed` observable as ledger rows at all.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { createPlatformTables } from '#/server/catalog/__tests__/platform-tables'
import { providerRegistry, providerUsage } from '#/server/db/schema'
import { isProviderBlockedError } from '#/server/metering/errors'
import { resetProviderLimitMemo } from '#/server/metering/outbound'
import {
  RateCeilingError,
  rateMeterKey,
  rateWindowOf,
} from '#/server/metering/rate'
import { createHereClient } from '../here'
import {
  TransitProviderError,
  refusalReason,
  searchTransitConnections,
  transitCacheKey,
} from '../search'

import type { PlatformTables } from '#/server/catalog/__tests__/platform-tables'
import type { OutboundRuntime } from '#/server/metering/outbound'
import type { RateCounterStore } from '#/server/metering/rate'
import type { Logger } from '#/server/observability'
import type { TransitQuery, TransitSearchRuntime } from '../search'

const AT = new Date('2026-09-01T10:00:00Z')

const LISBON_PORTO: TransitQuery = {
  origin: { name: 'Lisboa Santa Apolónia', lat: 38.713_2, lng: -9.122_4 },
  destination: { name: 'Porto Campanhã', lat: 41.148_9, lng: -8.585_1 },
  date: '2026-10-09',
  time: '08:00',
  modes: [],
}

const PORTO_LISBON: TransitQuery = {
  ...LISBON_PORTO,
  origin: LISBON_PORTO.destination,
  destination: LISBON_PORTO.origin,
}

/** One route in the shape HERE answers, as small as `here.ts` accepts. */
const HERE_ANSWER = {
  routes: [
    {
      id: 'R1',
      sections: [
        {
          id: 'S1',
          type: 'transit',
          departure: {
            time: '2026-10-09T08:12:00+01:00',
            place: {
              name: 'Lisboa Santa Apolónia',
              location: { lat: 38.713, lng: -9.122 },
            },
          },
          arrival: {
            time: '2026-10-09T09:41:00+01:00',
            place: {
              name: 'Porto Campanhã',
              location: { lat: 41.148, lng: -8.585 },
            },
          },
          transport: { mode: 'intercityTrain', name: 'IC 728' },
        },
      ],
    },
  ],
}

/** The slice of KV both the cache and the meter use, in memory. */
function memoryStore(): RateCounterStore & {
  readonly entries: Map<string, string>
} {
  const entries = new Map<string, string>()
  return {
    entries,
    get: (key) => Promise.resolve(entries.get(key) ?? null),
    put: (key, value) => {
      entries.set(key, value)
      return Promise.resolve()
    },
  }
}

/** A vendor that answers with `respond`, and remembers it was asked. */
function vendorFetch(respond: () => Response | Promise<Response>): {
  readonly fetch: typeof fetch
  readonly calls: Array<string>
} {
  const calls: Array<string> = []
  const impl = ((input: RequestInfo | URL) => {
    calls.push(String(input))
    return Promise.resolve(respond())
  }) as typeof fetch
  return { fetch: impl, calls }
}

const answers = (): Response =>
  new Response(JSON.stringify(HERE_ANSWER), {
    status: 200,
    // HERE's answer says a shared cache may keep it, which is what lets a repeat be a cache hit.
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
  })

let tables: PlatformTables
let deferred: Array<Promise<unknown>>

/** The ledger write is deliberately off the caller's path, so a test has to join it back on. */
async function settleDeferred(): Promise<void> {
  await Promise.all(deferred)
  deferred = []
}

function outboundRuntime(): OutboundRuntime {
  return {
    db: tables.db,
    waitUntil: (promise) => {
      deferred.push(promise)
    },
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    } as unknown as Logger,
    now: () => AT,
  }
}

interface Workspace {
  readonly cache: ReturnType<typeof memoryStore>
  readonly counters: ReturnType<typeof memoryStore>
}

/** The cache is one store across workspaces (keyed per member); the counters are one per test. */
function runtime(
  organizationId: string,
  stores: Workspace,
  vendor: ReturnType<typeof vendorFetch> | null,
  userId = 'user-ana',
): TransitSearchRuntime {
  return {
    cache: stores.cache,
    counters: stores.counters,
    client:
      vendor === null
        ? null
        : createHereClient({ apiKey: 'test-key', fetch: vendor.fetch }),
    outbound: outboundRuntime(),
    organizationId,
    userId,
    ceiling: 250,
    now: () => AT,
  }
}

function freshStores(): Workspace {
  return { cache: memoryStore(), counters: memoryStore() }
}

async function ledger() {
  await settleDeferred()
  return tables.db.select().from(providerUsage)
}

/** How many allowance units `organizationId` has spent this month, read off the tally itself. */
function spentBy(workspace: Workspace, organizationId: string): number {
  const key = rateMeterKey(
    'transit_searches_per_month',
    organizationId,
    rateWindowOf(AT),
  )
  return Number(workspace.counters.entries.get(key) ?? 0)
}

beforeEach(async () => {
  tables = await createPlatformTables()
  deferred = []
  resetProviderLimitMemo()
})

describe('the provider ledger around a connection search', () => {
  it('records a search that reached the vendor under the here slug', async () => {
    const shared = freshStores()
    const vendor = vendorFetch(answers)

    const result = await searchTransitConnections(
      runtime('org-alpha', shared, vendor),
      LISBON_PORTO,
    )

    expect(result.cached).toBe(false)
    expect(vendor.calls).toHaveLength(1)
    const rows = await ledger()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      provider: 'here',
      operation: 'transit.search',
      organizationId: 'org-alpha',
      calls: 1,
      errors: 0,
      blocked: 0,
    })
  })

  it('neither charges nor records the same member served the same route from the cache', async () => {
    const stores = freshStores()
    const vendor = vendorFetch(answers)

    await searchTransitConnections(
      runtime('org-alpha', stores, vendor),
      LISBON_PORTO,
    )
    const served = await searchTransitConnections(
      runtime('org-alpha', stores, vendor),
      LISBON_PORTO,
    )

    expect(served.cached).toBe(true)
    expect(vendor.calls).toHaveLength(1)
    const rows = await ledger()
    expect(rows.map((row) => row.organizationId)).toEqual(['org-alpha'])
    expect(rows[0]).toMatchObject({ calls: 1 })
    expect(spentBy(stores, 'org-alpha')).toBe(1)
  })

  it('records and charges another workspace that repeats the route, as the cache is not shared', async () => {
    const shared = freshStores()
    const vendor = vendorFetch(answers)
    const alpha = { cache: shared.cache, counters: memoryStore() }
    const bravo = { cache: shared.cache, counters: memoryStore() }

    await searchTransitConnections(
      runtime('org-alpha', alpha, vendor),
      LISBON_PORTO,
    )
    const second = await searchTransitConnections(
      runtime('org-bravo', bravo, vendor, 'user-bia'),
      LISBON_PORTO,
    )

    expect(second.cached).toBe(false)
    expect(vendor.calls).toHaveLength(2)
    const rows = await ledger()
    expect(rows.map((row) => row.organizationId).sort()).toEqual([
      'org-alpha',
      'org-bravo',
    ])
    expect(spentBy(bravo, 'org-bravo')).toBe(1)
  })

  it('attributes each ledger row to the workspace that made the call', async () => {
    const shared = freshStores()
    const vendor = vendorFetch(answers)

    await searchTransitConnections(
      runtime(
        'org-alpha',
        { cache: shared.cache, counters: memoryStore() },
        vendor,
      ),
      LISBON_PORTO,
    )
    await searchTransitConnections(
      runtime(
        'org-bravo',
        { cache: shared.cache, counters: memoryStore() },
        vendor,
      ),
      PORTO_LISBON,
    )

    const rows = await ledger()
    expect(
      rows
        .map((row) => [row.organizationId, row.calls])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
    ).toEqual([
      ['org-alpha', 1],
      ['org-bravo', 1],
    ])
  })

  it.each([
    ['refused', () => new Response('nope', { status: 403 })],
    ['malformed', () => new Response('{"routes": 7}', { status: 200 })],
  ])('records a %s answer as a failed call', async (reason, respond) => {
    const shared = freshStores()

    const error = await searchTransitConnections(
      runtime('org-alpha', shared, vendorFetch(respond)),
      LISBON_PORTO,
    ).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(TransitProviderError)
    expect((error as TransitProviderError).reason).toBe(reason)
    const rows = await ledger()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ calls: 1, errors: 1, blocked: 0 })
  })

  it('records an unreachable vendor as a failed call', async () => {
    const shared = freshStores()
    const vendor = vendorFetch(() => {
      throw new TypeError('fetch failed')
    })

    const error = await searchTransitConnections(
      runtime('org-alpha', shared, vendor),
      LISBON_PORTO,
    ).catch((cause: unknown) => cause)

    expect((error as TransitProviderError).reason).toBe('unreachable')
    const rows = await ledger()
    expect(rows[0]).toMatchObject({ calls: 1, errors: 1, blocked: 0 })
  })

  it('records nothing and spends nothing on an unconfigured deployment', async () => {
    const shared = freshStores()

    const error = await searchTransitConnections(
      runtime('org-alpha', shared, null),
      LISBON_PORTO,
    ).catch((cause: unknown) => cause)

    expect((error as TransitProviderError).reason).toBe('unconfigured')
    expect(await ledger()).toEqual([])
    expect(spentBy(shared, 'org-alpha')).toBe(0)
  })

  describe('when an operator has blocked a spent provider', () => {
    beforeEach(async () => {
      await tables.db.insert(providerRegistry).values({
        slug: 'here',
        label: 'HERE',
        // A `block` policy alone never closes the gate; the ceiling is what makes it "spent", and
        // zero is the shortest way to write that.
        limitWindow: 'month',
        callLimit: 0,
        policy: 'block',
      })
      resetProviderLimitMemo()
    })

    it('refuses before the vendor, writes no cache entry and records one blocked row', async () => {
      const shared = freshStores()
      const vendor = vendorFetch(answers)

      const error = await searchTransitConnections(
        runtime('org-alpha', shared, vendor),
        LISBON_PORTO,
      ).catch((cause: unknown) => cause)

      expect(isProviderBlockedError(error)).toBe(true)
      // Refused *before* the vendor: a block that arrived afterwards would bill for exactly the
      // calls it exists to prevent.
      expect(vendor.calls).toEqual([])
      expect(
        shared.cache.entries.has(
          transitCacheKey(
            { organizationId: 'org-alpha', userId: 'user-ana' },
            LISBON_PORTO,
          ),
        ),
      ).toBe(false)
      const rows = await ledger()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        provider: 'here',
        operation: 'transit.search',
        organizationId: 'org-alpha',
        calls: 0,
        blocked: 1,
      })
    })

    /**
     * Pins the rule geo already follows: the ledger sits inside the meter, so the allowance is
     * spent before the gate is consulted. Changing it is a follow-up covering both modules, and
     * this case is what makes that a decision rather than a drift.
     */
    it('still spends one unit of the workspace allowance, as geocoding does', async () => {
      const shared = freshStores()

      await searchTransitConnections(
        runtime('org-alpha', shared, vendorFetch(answers)),
        LISBON_PORTO,
      ).catch(() => undefined)

      expect(spentBy(shared, 'org-alpha')).toBe(1)
    })

    it('spends a unit on every retry while the block lasts', async () => {
      const shared = freshStores()
      const vendor = vendorFetch(answers)

      for (let attempt = 0; attempt < 2; attempt += 1) {
        await searchTransitConnections(
          runtime('org-alpha', shared, vendor),
          LISBON_PORTO,
        ).catch(() => undefined)
      }

      expect(vendor.calls).toEqual([])
      expect(spentBy(shared, 'org-alpha')).toBe(2)
      const rows = await ledger()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ calls: 0, blocked: 2 })
    })

    it('still serves an answer the cache already holds', async () => {
      const shared = freshStores()
      // Warm the cache while the gate is open, then shut it.
      await tables.db.delete(providerRegistry)
      resetProviderLimitMemo()
      await searchTransitConnections(
        runtime('org-alpha', shared, vendorFetch(answers)),
        LISBON_PORTO,
      )
      await tables.db.insert(providerRegistry).values({
        slug: 'here',
        label: 'HERE',
        limitWindow: 'month',
        callLimit: 0,
        policy: 'block',
      })
      resetProviderLimitMemo()

      const repeat = { cache: shared.cache, counters: memoryStore() }
      const vendor = vendorFetch(answers)
      const rowsBefore = await ledger()

      const served = await searchTransitConnections(
        runtime('org-alpha', repeat, vendor),
        LISBON_PORTO,
      )

      expect(served.cached).toBe(true)
      // A live vendor that is never asked, no allowance spent and no new row, blocked or not.
      expect(vendor.calls).toEqual([])
      expect(spentBy(repeat, 'org-alpha')).toBe(0)
      expect(await ledger()).toEqual(rowsBefore)
    })
  })
})

describe('refusalReason', () => {
  it('maps an operator block to a provider reason, never to the plan ceiling', async () => {
    await tables.db.insert(providerRegistry).values({
      slug: 'here',
      label: 'HERE',
      limitWindow: 'month',
      callLimit: 0,
      policy: 'block',
    })
    resetProviderLimitMemo()
    const error = await searchTransitConnections(
      runtime('org-alpha', freshStores(), vendorFetch(answers)),
      LISBON_PORTO,
    ).catch((cause: unknown) => cause)

    // `ceiling` would tell a customer to buy an allowance that is not theirs, and the deployment's
    // own limit and usage are not theirs to read.
    expect(refusalReason(error)).toBe('unreachable')
  })

  it('keeps the two existing refusals as they were', () => {
    expect(refusalReason(new TransitProviderError('refused', 'no', 403))).toBe(
      'refused',
    )
    expect(
      refusalReason(
        new RateCeilingError('transit_searches_per_month', 250, 250),
      ),
    ).toBe('ceiling')
  })

  it('leaves a fault to be thrown', () => {
    expect(refusalReason(new Error('boom'))).toBeNull()
  })
})
