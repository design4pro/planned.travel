/**
 * The transit proxy: the cache, the meter and the provider client.
 *
 * This is the seam PRD #167's testing decision 4 names — the one place three properties can be
 * seen at all:
 *
 * - **The cache key belongs to one member of one workspace.** HERE Platform Terms §6.4 l and §6.4 h
 *   forbid one Request serving more than one End User, and ADR 0011 (amended, see ADR 0019) reads an
 *   End User as every person using the product. A key that dropped either id would serve one
 *   member's answer to another, and nothing on any screen would look wrong.
 * - **Only what HERE's caching headers allow is stored, for as long as they say** (Exhibit 2 §1.3),
 *   and never for longer than 24 hours.
 * - **The meter refuses at the ceiling, and a cache hit does not spend it.** A tally in KV is the
 *   only shape a ceiling on an outbound call can take: a search leaves no row, so `assertQuota()`
 *   has nothing to `COUNT(*)`.
 * - **A malformed provider response is refused by a validator** rather than half-filling a form,
 *   and a provider that fails surfaces as a typed failure rather than as a thrown `fetch`.
 *
 * **No test here touches the network.** `here.ts` is its own module partly so it can be replaced
 * by a stub at the seam — `searchTransitConnections` takes its client as a dependency — and the
 * two cases that do exercise the real client drive it with a `fetch` of their own.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

import { createHereClient } from '../here'
import { RateCeilingError, rateMeterKey } from '#/server/metering/rate'
import {
  TRANSIT_CACHE_MAX_TTL_SECONDS,
  TransitProviderError,
  searchTransitConnections,
  transitCacheKey,
} from '../search'

import type { OutboundRuntime } from '#/server/metering/outbound'
import type { RateCounterStore } from '#/server/metering/rate'
import type { CachingHeaders } from '#/lib/http-cache'
import type { Logger } from '#/server/observability'
import type {
  TransitAnswer,
  TransitClient,
  TransitConnection,
  TransitQuery,
  TransitSearchRuntime,
} from '../search'

/* ------------------------------------------------------------------ fakes */

/** The slice of KV both the cache and the meter use, in memory. */
function memoryStore(): RateCounterStore & {
  readonly entries: Map<string, string>
  readonly reads: Array<string>
  readonly writes: Array<string>
  readonly ttls: Map<string, number | undefined>
} {
  const entries = new Map<string, string>()
  const reads: Array<string> = []
  const writes: Array<string> = []
  const ttls = new Map<string, number | undefined>()
  return {
    entries,
    reads,
    writes,
    ttls,
    get(key) {
      reads.push(key)
      return Promise.resolve(entries.get(key) ?? null)
    },
    put(key, value, options) {
      writes.push(key)
      entries.set(key, value)
      ttls.set(key, options?.expirationTtl)
      return Promise.resolve()
    },
  }
}

const CONNECTION: TransitConnection = {
  id: 'R1',
  departureAt: '2026-10-09T08:12:00',
  arrivalAt: '2026-10-09T09:41:00',
  durationMinutes: 89,
  changes: 1,
  modes: ['train'],
  fare: { amountMinor: 2450, currency: 'EUR' },
  legs: [
    {
      mode: 'train',
      name: 'IC 728',
      headsign: 'Porto Campanhã',
      origin: {
        name: 'Lisboa Santa Apolónia',
        lat: 38.713,
        lng: -9.122,
        at: '2026-10-09T08:12:00',
      },
      destination: {
        name: 'Coimbra-B',
        lat: 40.222,
        lng: -8.44,
        at: '2026-10-09T09:41:00',
      },
      intermediateStops: [],
    },
  ],
}

/** Headers that let a shared cache keep an answer for an hour. */
const FOR_AN_HOUR: CachingHeaders = {
  cacheControl: 'public, max-age=3600',
  expires: null,
  date: 'Thu, 01 Oct 2026 10:00:00 GMT',
  age: null,
}

function stubClient(
  connections: ReadonlyArray<TransitConnection> = [CONNECTION],
  caching: CachingHeaders = FOR_AN_HOUR,
): TransitClient & { readonly calls: Array<TransitQuery> } {
  const calls: Array<TransitQuery> = []
  return {
    calls,
    search(query): Promise<TransitAnswer> {
      calls.push(query)
      return Promise.resolve({ connections, caching })
    },
  }
}

const QUERY: TransitQuery = {
  origin: { name: 'Lisboa Santa Apolónia', lat: 38.713_2, lng: -9.122_4 },
  destination: { name: 'Porto Campanhã', lat: 41.148_9, lng: -8.585_1 },
  date: '2026-10-09',
  time: '08:00',
  modes: ['train', 'bus'],
}

/**
 * `callProvider`'s documented "no handle" state: no database, so the gate stays open and nothing is
 * recorded. `ledger.test.ts` drives the same proxy against a real ledger.
 */
function outboundWithoutLedger(): OutboundRuntime {
  return {
    db: null,
    waitUntil: () => undefined,
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    } as unknown as Logger,
    now: () => new Date('2026-09-01T10:00:00Z'),
  }
}

function runtime(
  overrides: Partial<TransitSearchRuntime> = {},
): TransitSearchRuntime {
  return {
    cache: memoryStore(),
    counters: memoryStore(),
    client: stubClient(),
    outbound: outboundWithoutLedger(),
    organizationId: 'org-alpha',
    userId: 'user-ana',
    ceiling: 250,
    now: () => new Date('2026-09-01T10:00:00Z'),
    ...overrides,
  }
}

/* --------------------------------------------------------------- the key */

const ALPHA_ANA = { organizationId: 'org-alpha', userId: 'user-ana' }

describe('transitCacheKey', () => {
  /**
   * HERE Platform Terms §6.4 l and §6.4 h: one Request may not serve more than one End User, and
   * every person using the product is one. So the key belongs to a member of a workspace, and the
   * same question asked by two members, or by two workspaces, is two questions.
   */
  it('is a different string for another member of the same workspace', () => {
    expect(transitCacheKey(ALPHA_ANA, QUERY)).not.toBe(
      transitCacheKey({ ...ALPHA_ANA, userId: 'user-ben' }, QUERY),
    )
  })

  it('is a different string for another workspace', () => {
    expect(transitCacheKey(ALPHA_ANA, QUERY)).not.toBe(
      transitCacheKey({ ...ALPHA_ANA, organizationId: 'org-beta' }, QUERY),
    )
  })

  it('is the same string for the same member asking the same question twice', () => {
    expect(transitCacheKey(ALPHA_ANA, QUERY)).toBe(
      transitCacheKey({ ...ALPHA_ANA }, { ...QUERY }),
    )
  })

  it('moves to a new version, so no entry written under the shared key is read again', () => {
    expect(transitCacheKey(ALPHA_ANA, QUERY).startsWith('transit:v2:')).toBe(
      true,
    )
  })

  it('answers the same key however the traveller labelled the stops', () => {
    expect(
      transitCacheKey(ALPHA_ANA, {
        ...QUERY,
        origin: { ...QUERY.origin, name: 'Santa Apolónia station' },
        destination: { ...QUERY.destination, name: 'porto campanha' },
      }),
    ).toBe(transitCacheKey(ALPHA_ANA, QUERY))
  })

  it('answers the same key however the mode filter was ordered', () => {
    expect(
      transitCacheKey(ALPHA_ANA, { ...QUERY, modes: ['bus', 'train'] }),
    ).toBe(transitCacheKey(ALPHA_ANA, QUERY))
    expect(
      transitCacheKey(ALPHA_ANA, { ...QUERY, modes: ['bus', 'train', 'bus'] }),
    ).toBe(transitCacheKey(ALPHA_ANA, QUERY))
  })

  it('separates a different date, a different clock, a different filter and a different stop', () => {
    const keys = new Set([
      transitCacheKey(ALPHA_ANA, QUERY),
      transitCacheKey(ALPHA_ANA, { ...QUERY, date: '2026-10-10' }),
      // The clock has to be in the key: the provider answers with the services *after* it, so the
      // morning and the evening of one day are two questions. Keyed on the date alone, whichever
      // was asked first would be served to the member for the rest of the entry's life.
      transitCacheKey(ALPHA_ANA, { ...QUERY, time: '18:15' }),
      transitCacheKey(ALPHA_ANA, { ...QUERY, modes: ['train'] }),
      transitCacheKey(ALPHA_ANA, { ...QUERY, modes: [] }),
      transitCacheKey(ALPHA_ANA, {
        ...QUERY,
        destination: { ...QUERY.destination, lat: 41.2 },
      }),
    ])
    expect(keys.size).toBe(6)
  })

  it('stays inside a KV key, whatever the traveller typed and whatever the ids', () => {
    // 64 is the longest id `requireTenantContext` accepts; five modes is the longest filter.
    const key = transitCacheKey(
      { organizationId: 'o'.repeat(64), userId: 'm'.repeat(64) },
      {
        origin: { name: 'x'.repeat(4000), lat: -89.999_9, lng: -179.999_9 },
        destination: { name: 'y', lat: -89.999_9, lng: -179.999_9 },
        date: '2026-10-09',
        time: '08:00',
        modes: ['train', 'bus', 'tram', 'metro', 'ferry'],
      },
    )
    expect(new TextEncoder().encode(key).length).toBeLessThanOrEqual(512)
  })
})

/* -------------------------------------------------------------- the proxy */

describe('searchTransitConnections', () => {
  it('calls the provider on a miss, and caches what it answered', async () => {
    const cache = memoryStore()
    const client = stubClient()
    const deps = runtime({ cache, client })

    const first = await searchTransitConnections(deps, QUERY)

    expect(first.cached).toBe(false)
    expect(first.connections).toEqual([CONNECTION])
    expect(client.calls).toHaveLength(1)
    expect(cache.entries.has(transitCacheKey(ALPHA_ANA, QUERY))).toBe(true)
  })

  it('answers a second, identical query from the cache without calling the provider', async () => {
    const cache = memoryStore()
    const client = stubClient()
    const deps = runtime({ cache, client })

    await searchTransitConnections(deps, QUERY)
    const second = await searchTransitConnections(deps, QUERY)

    expect(second.cached).toBe(true)
    expect(second.connections).toEqual([CONNECTION])
    expect(client.calls).toHaveLength(1)
  })

  /**
   * The shared cache is gone, seen from the side that matters: β's identical question is β's own
   * Request, and it spends β's own unit.
   */
  it('makes a second workspace its own Request and spends its own unit', async () => {
    const cache = memoryStore()
    const counters = memoryStore()
    const client = stubClient()

    await searchTransitConnections(
      runtime({ cache, counters, client, organizationId: 'org-alpha' }),
      QUERY,
    )
    const beta = await searchTransitConnections(
      runtime({ cache, counters, client, organizationId: 'org-beta' }),
      QUERY,
    )

    expect(beta.cached).toBe(false)
    expect(client.calls).toHaveLength(2)
    expect(beta.spent).toBe(1)
    expect([...counters.entries.keys()].sort()).toEqual(
      [
        rateMeterKey('transit_searches_per_month', 'org-alpha', '2026-09'),
        rateMeterKey('transit_searches_per_month', 'org-beta', '2026-09'),
      ].sort(),
    )
    expect(cache.entries.size).toBe(2)
  })

  it('makes a second member of the same workspace its own Request and spends a unit of the same allowance', async () => {
    const cache = memoryStore()
    const counters = memoryStore()
    const client = stubClient()

    await searchTransitConnections(
      runtime({ cache, counters, client, userId: 'user-ana' }),
      QUERY,
    )
    const ben = await searchTransitConnections(
      runtime({ cache, counters, client, userId: 'user-ben' }),
      QUERY,
    )

    expect(ben.cached).toBe(false)
    expect(client.calls).toHaveLength(2)
    // Both units come out of the workspace's one allowance.
    expect(ben.spent).toBe(2)
    expect(cache.entries.size).toBe(2)
  })

  /** Tenant isolation: an entry written for one owner is invisible to every other. */
  it('never reads an entry written for another member or another workspace', async () => {
    const cache = memoryStore()
    await searchTransitConnections(
      runtime({ cache, organizationId: 'org-alpha', userId: 'user-ana' }),
      QUERY,
    )
    const written = new Set(cache.entries.keys())
    cache.reads.length = 0

    for (const other of [
      { organizationId: 'org-alpha', userId: 'user-ben' },
      { organizationId: 'org-beta', userId: 'user-ana' },
    ]) {
      await searchTransitConnections(runtime({ cache, ...other }), QUERY)
      expect(cache.reads.some((key) => written.has(key))).toBe(false)
      cache.reads.length = 0
    }
  })

  it('spends nothing on a cache hit', async () => {
    const cache = memoryStore()
    const counters = memoryStore()
    const deps = runtime({ cache, counters, ceiling: 1 })

    expect((await searchTransitConnections(deps, QUERY)).spent).toBe(1)
    // The ceiling is 1 and the second call still answers, because it costs nothing.
    const second = await searchTransitConnections(deps, QUERY)
    expect(second.cached).toBe(true)
    expect(second.spent).toBeNull()
  })

  /**
   * The deployment with no credential, which is a realistic state: `HERE_API_KEY` is an optional
   * binding and a Worker that never had it set reaches this line on every cache miss.
   *
   * The refusal the reader sees is the same either way — `connection-search.tsx` renders
   * `unconfigured` as a refusal in all 23 locales — so the only observable difference is the one
   * asserted here: whether a unit of a monthly allowance was spent on a call that never left the
   * Worker. Left after the meter, a Solo workspace's 250 searches drain to zero without a single
   * search having been made.
   */
  it('refuses an unconfigured provider without spending the allowance', async () => {
    const counters = memoryStore()

    const error = await searchTransitConnections(
      runtime({ counters, client: null }),
      QUERY,
    ).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(TransitProviderError)
    expect((error as TransitProviderError).reason).toBe('unconfigured')
    expect([...counters.entries.keys()]).toEqual([])
  })

  /** And the cache is still read first, so what the deployment already holds is still served. */
  it('serves a cached answer with no provider at all', async () => {
    const cache = memoryStore()
    const counters = memoryStore()

    expect(
      (await searchTransitConnections(runtime({ cache, counters }), QUERY))
        .cached,
    ).toBe(false)

    const second = await searchTransitConnections(
      runtime({ cache, counters, client: null }),
      QUERY,
    )

    expect(second.cached).toBe(true)
    expect(second.connections).toEqual([CONNECTION])
  })

  it('refuses at the ceiling, before the provider is called', async () => {
    const client = stubClient()
    const deps = runtime({ client, ceiling: 0 })

    await expect(searchTransitConnections(deps, QUERY)).rejects.toBeInstanceOf(
      RateCeilingError,
    )
    expect(client.calls).toEqual([])
  })

  /**
   * The plan boundary and the cache, and they have to be ordered.
   *
   * A zero ceiling is not "no searches left this month", it is "this plan does not search" - and a
   * workspace downgraded to such a plan still has its members' old entries in the cache. Answered
   * from them, the workspace would get real results with `ok: true`, no meter and no refusal.
   * Nothing leaks and nothing is billed, which is exactly why this needs a test.
   */
  it('refuses a zero ceiling even when the member has a warm entry from before a downgrade', async () => {
    const cache = memoryStore()
    const client = stubClient()

    const before = await searchTransitConnections(
      runtime({ cache, client, ceiling: 250 }),
      QUERY,
    )
    expect(before.cached).toBe(false)

    const downgraded = runtime({ cache, client, ceiling: 0 })
    await expect(
      searchTransitConnections(downgraded, QUERY),
    ).rejects.toBeInstanceOf(RateCeilingError)
    // And the refusal is a gate rather than a race: the entry is still there for the plan that
    // may read it again.
    expect(
      (await searchTransitConnections(runtime({ cache, client }), QUERY))
        .cached,
    ).toBe(true)
  })

  it('treats a cache entry it cannot parse as a miss rather than as an answer', async () => {
    const cache = memoryStore()
    const client = stubClient()
    await cache.put(
      transitCacheKey(ALPHA_ANA, QUERY),
      '{"connections":[{"id":42}]}',
    )

    const result = await searchTransitConnections(
      runtime({ cache, client }),
      QUERY,
    )

    expect(result.cached).toBe(false)
    expect(result.connections).toEqual([CONNECTION])
  })

  it('does not cache an empty answer as if it were one', async () => {
    const cache = memoryStore()
    const client = stubClient([])

    const result = await searchTransitConnections(
      runtime({ cache, client }),
      QUERY,
    )

    expect(result.connections).toEqual([])
    expect(cache.entries.size).toBe(0)
  })

  it('lets a provider failure through as a typed failure', async () => {
    const failing: TransitClient = {
      search: () =>
        Promise.reject(new TransitProviderError('unreachable', 'gone')),
    }
    const error = await searchTransitConnections(
      runtime({ client: failing }),
      QUERY,
    ).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(TransitProviderError)
    expect((error as TransitProviderError).reason).toBe('unreachable')
  })

  /**
   * Exhibit 2 §1.3: nothing is stored "except as explicitly allowed by the caching headers". The
   * fixtures are the cases the proxy has to tell apart; the arithmetic is `http-cache`'s own.
   */
  describe('what the caching headers allow', () => {
    const KEY = transitCacheKey(ALPHA_ANA, QUERY)

    async function stored(
      caching: Partial<CachingHeaders>,
      connections: ReadonlyArray<TransitConnection> = [CONNECTION],
    ): Promise<ReturnType<typeof memoryStore>> {
      const cache = memoryStore()
      await searchTransitConnections(
        runtime({
          cache,
          client: stubClient(connections, { ...FOR_AN_HOUR, ...caching }),
        }),
        QUERY,
      )
      return cache
    }

    it('stores an answer for the lifetime the headers state', async () => {
      const cache = await stored({ cacheControl: 'public, max-age=3600' })
      expect(cache.ttls.get(KEY)).toBe(3600)
    })

    it('takes s-maxage over max-age and takes Age off the lifetime', async () => {
      const cache = await stored({
        cacheControl: 'max-age=7200, s-maxage=900',
        age: '100',
      })
      expect(cache.ttls.get(KEY)).toBe(800)
    })

    it('never keeps an answer longer than 24 hours, whatever the headers allow', async () => {
      const cache = await stored({
        cacheControl: `max-age=${30 * 24 * 60 * 60}`,
      })
      expect(TRANSIT_CACHE_MAX_TTL_SECONDS).toBe(24 * 60 * 60)
      expect(cache.ttls.get(KEY)).toBe(TRANSIT_CACHE_MAX_TTL_SECONDS)
    })

    it.each([
      ['no-store', { cacheControl: 'no-store' }],
      ['no-cache', { cacheControl: 'no-cache, max-age=3600' }],
      ['private', { cacheControl: 'private, max-age=3600' }],
      ['no freshness at all', { cacheControl: null }],
      ['a lifetime under the KV minimum', { cacheControl: 'max-age=59' }],
      [
        'a lifetime Age has used up',
        { cacheControl: 'max-age=300', age: '300' },
      ],
    ])('does not store an answer with %s', async (_label, caching) => {
      const cache = await stored(caching)
      expect(cache.entries.size).toBe(0)
    })

    it('still returns the answer it did not store', async () => {
      const deps = runtime({
        client: stubClient([CONNECTION], {
          ...FOR_AN_HOUR,
          cacheControl: 'no-store',
        }),
      })
      const result = await searchTransitConnections(deps, QUERY)
      expect(result.connections).toEqual([CONNECTION])
      expect(result.cached).toBe(false)
    })

    it('spends a unit again for a question it was not allowed to keep', async () => {
      const client = stubClient([CONNECTION], {
        ...FOR_AN_HOUR,
        cacheControl: 'no-store',
      })
      const deps = runtime({ client })
      await searchTransitConnections(deps, QUERY)
      const second = await searchTransitConnections(deps, QUERY)
      expect(second.cached).toBe(false)
      expect(second.spent).toBe(2)
      expect(client.calls).toHaveLength(2)
    })

    it('does not store an empty answer even when the headers allow it', async () => {
      const cache = await stored({}, [])
      expect(cache.entries.size).toBe(0)
    })
  })
})

/* ------------------------------------------------------------ the client */

/** One recorded HERE Transit v8 answer, trimmed to the fields the parser reads. */
const HERE_RESPONSE = {
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
            place: { name: 'Coimbra-B', location: { lat: 40.222, lng: -8.44 } },
          },
          transport: {
            mode: 'intercityTrain',
            name: 'IC 728',
            headsign: 'Porto Campanhã',
          },
          intermediateStops: [
            {
              departure: {
                time: '2026-10-09T08:44:00+01:00',
                place: {
                  name: 'Entroncamento',
                  location: { lat: 39.466, lng: -8.472 },
                },
              },
            },
          ],
          fares: [{ price: { currency: 'EUR', value: 24.5 } }],
        },
      ],
    },
  ],
}

function jsonFetch(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): { fetch: typeof fetch; readonly urls: Array<string> } {
  const urls: Array<string> = []
  const impl = ((input: RequestInfo | URL) => {
    urls.push(String(input))
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json', ...headers },
      }),
    )
  }) as typeof fetch
  return { fetch: impl, urls }
}

describe('the HERE client', () => {
  it('parses a recorded answer into our own shape', async () => {
    const transport = jsonFetch(HERE_RESPONSE)
    const client = createHereClient({
      apiKey: 'secret',
      fetch: transport.fetch,
    })

    const [connection] = (await client.search(QUERY)).connections

    expect(connection.id).toBe('R1')
    // The wall clock at the place it applies to, with the provider's offset dropped.
    expect(connection.departureAt).toBe('2026-10-09T08:12:00')
    expect(connection.arrivalAt).toBe('2026-10-09T09:41:00')
    expect(connection.durationMinutes).toBe(89)
    expect(connection.changes).toBe(0)
    expect(connection.modes).toEqual(['train'])
    // Minor units and a three-letter code. Never a float on a money field.
    expect(connection.fare).toEqual({ amountMinor: 2450, currency: 'EUR' })
    expect(connection.legs[0].intermediateStops).toEqual([
      {
        name: 'Entroncamento',
        lat: 39.466,
        lng: -8.472,
        at: '2026-10-09T08:44:00',
      },
    ])
  })

  /**
   * The seam that makes Exhibit 2 §1.3 enforceable: the client used to drop the response headers,
   * so nothing downstream could honour them.
   */
  it('hands the response’s caching headers to the proxy beside the connections', async () => {
    const transport = jsonFetch(HERE_RESPONSE, 200, {
      'cache-control': 'public, max-age=300',
      expires: 'Thu, 01 Oct 2026 10:05:00 GMT',
      date: 'Thu, 01 Oct 2026 10:00:00 GMT',
      age: '12',
    })
    const answer = await createHereClient({
      apiKey: 'secret',
      fetch: transport.fetch,
    }).search(QUERY)

    expect(answer.caching).toEqual({
      cacheControl: 'public, max-age=300',
      expires: 'Thu, 01 Oct 2026 10:05:00 GMT',
      date: 'Thu, 01 Oct 2026 10:00:00 GMT',
      age: '12',
    })
    expect(answer.connections).toHaveLength(1)
  })

  it('reports a response with no caching headers as one that may not be stored', async () => {
    const { fetch: transport } = jsonFetch(HERE_RESPONSE)
    const answer = await createHereClient({
      apiKey: 'secret',
      fetch: transport,
    }).search(QUERY)

    expect(answer.caching.cacheControl).toBeNull()
    expect(answer.caching.expires).toBeNull()
    expect(answer.caching.age).toBeNull()
  })

  it('asks for the question it was given, and for the detail the list expands into', async () => {
    const transport = jsonFetch(HERE_RESPONSE)
    await createHereClient({
      apiKey: 'secret',
      fetch: transport.fetch,
    }).search(QUERY)

    expect(transport.urls).toHaveLength(1)
    const url = new URL(transport.urls[0])
    expect(url.searchParams.get('origin')).toBe('38.7132,-9.1224')
    expect(url.searchParams.get('destination')).toBe('41.1489,-8.5851')
    expect(url.searchParams.get('departureTime')).toBe('2026-10-09T08:00:00')
    expect(url.searchParams.get('return')).toBe('intermediate,fares')
    // Our two filter modes, in the vendor's own vocabulary and deduplicated.
    expect(url.searchParams.get('modes')?.split(',')).toEqual([
      'highSpeedTrain',
      'intercityTrain',
      'interRegionalTrain',
      'regionalTrain',
      'cityTrain',
      'bus',
      'privateBus',
      'busRapid',
    ])
  })

  /**
   * The clock is the half of the question that decides which services are reachable at all.
   *
   * The router answers with the `alternatives` services departing at or after the instant it is
   * given — five of them — so the hour is not a refinement of the date, it selects the window. A
   * client that sent the day and dropped the clock would ask for the night's first five departures
   * on every search, and would look correct doing it: the request succeeds, the answer parses, and
   * the traveller is simply told that the sleeper is what runs.
   */
  it('anchors the window on the clock it was given, not on the start of the day', async () => {
    const morning = jsonFetch(HERE_RESPONSE)
    await createHereClient({ apiKey: 'secret', fetch: morning.fetch }).search({
      ...QUERY,
      time: '09:30',
    })
    const evening = jsonFetch(HERE_RESPONSE)
    await createHereClient({ apiKey: 'secret', fetch: evening.fetch }).search({
      ...QUERY,
      time: '18:15',
    })

    expect(new URL(morning.urls[0]).searchParams.get('departureTime')).toBe(
      '2026-10-09T09:30:00',
    )
    expect(new URL(evening.urls[0]).searchParams.get('departureTime')).toBe(
      '2026-10-09T18:15:00',
    )
  })

  /**
   * The credential rides in the query because that is the only form the vendor accepts, so the one
   * thing that must hold is that no *message* carries it: a failure is quoted to a logger and to a
   * screen, and a request URL is neither.
   */
  it('keeps the key out of every message it raises', async () => {
    const clients = [
      createHereClient({ apiKey: 'secret', fetch: jsonFetch({}, 401).fetch }),
      createHereClient({
        apiKey: 'secret',
        fetch: jsonFetch({ nope: 1 }).fetch,
      }),
      createHereClient({
        apiKey: 'secret',
        fetch: () => Promise.reject(new Error('down')),
      }),
    ]
    for (const client of clients) {
      const error = await client.search(QUERY).catch((cause: unknown) => cause)
      expect(error).toBeInstanceOf(TransitProviderError)
      expect((error as Error).message).not.toContain('secret')
    }
  })

  it('refuses a malformed answer rather than half-filling a form', async () => {
    const transport = jsonFetch({ routes: [{ sections: 'not a list' }] })
    const client = createHereClient({
      apiKey: 'secret',
      fetch: transport.fetch,
    })

    const error = await client.search(QUERY).catch((cause: unknown) => cause)
    expect(error).toBeInstanceOf(TransitProviderError)
    expect((error as TransitProviderError).reason).toBe('malformed')
  })

  it('turns a refusal and an outage into a typed failure, not a thrown fetch', async () => {
    const refused = createHereClient({
      apiKey: 'secret',
      fetch: jsonFetch({ error: 'Unauthorized' }, 401).fetch,
    })
    const refusal = await refused.search(QUERY).catch((cause: unknown) => cause)
    expect(refusal).toBeInstanceOf(TransitProviderError)
    expect((refusal as TransitProviderError).reason).toBe('refused')
    expect((refusal as TransitProviderError).status).toBe(401)

    const down = createHereClient({
      apiKey: 'secret',
      fetch: () => Promise.reject(new Error('connect ETIMEDOUT')),
    })
    const outage = await down.search(QUERY).catch((cause: unknown) => cause)
    expect(outage).toBeInstanceOf(TransitProviderError)
    expect((outage as TransitProviderError).reason).toBe('unreachable')
  })

  it('refuses to be built without a key, and says which secret is missing', () => {
    const built = (): unknown =>
      createHereClient({
        apiKey: '',
        fetch: vi.fn(),
      })
    expect(built).toThrow(TransitProviderError)
    expect(built).toThrow(/HERE_API_KEY/)
  })
})

/* ------------------------------------------------------------------ the seam */

/**
 * The binding seam, asserted by reading the directory rather than by importing it.
 *
 * `bindings.ts` cannot be imported here at all — `cloudflare:workers` does not resolve in the
 * `server` Vitest project, which is the whole reason every binding in this repository is reached
 * through one seam module rather than inline. So what is checked is the property that makes the
 * rest of this file possible: the cache, the counters and the credential arrive as arguments, and
 * the module with a vendor's name on it has exactly one importer.
 *
 * The second case is the one that rots. `./here` says nothing outside this directory imports it,
 * and a server function reaching for `createHereClient` to wire a key would be a plausible-looking
 * edit that quietly makes the proxy optional — the cache, the ceiling and the per-member key with it.
 */
describe('the transit directory keeps its bindings in one file', () => {
  const DIRECTORY = fileURLToPath(new URL('../', import.meta.url))
  const SRC = fileURLToPath(new URL('../../../', import.meta.url))

  /** Written as a value so this file can look for the specifier without containing an import. */
  const WORKER_ENV = `from 'cloudflare:workers'`

  const codeOf = (file: string): string => readFileSync(file, 'utf8')

  /** Every `.ts`/`.tsx` file under `root`, tests included. */
  function sourceFiles(root: string): Array<string> {
    const found: Array<string> = []
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory)) {
        const full = join(directory, entry)
        if (statSync(full).isDirectory()) {
          walk(full)
          continue
        }
        if (/\.tsx?$/.test(entry)) found.push(full)
      }
    }
    walk(root)
    return found
  }

  it('reaches the Worker environment from `bindings.ts` and nowhere else', () => {
    const offenders = sourceFiles(DIRECTORY)
      // This file is not shipped, and it names the specifier in order to look for it.
      .filter((file) => !file.includes(`${sep}__tests__${sep}`))
      .filter((file) => codeOf(file).includes(WORKER_ENV))
      .map((file) => file.slice(DIRECTORY.length))
    expect(offenders).toEqual(['bindings.ts'])
  })

  it('is the vendor module’s only importer outside this directory', () => {
    const importers = sourceFiles(SRC)
      .filter((file) => !file.startsWith(DIRECTORY))
      .filter((file) => /from '#\/server\/transit\/here'/.test(codeOf(file)))
    expect(importers).toEqual([])

    // The control, because an assertion that nothing was found passes just as well when the scan
    // is broken: the sibling module every server function does reach is found by the same walk.
    const proxyImporters = sourceFiles(SRC)
      .filter((file) => !file.startsWith(DIRECTORY))
      .filter((file) => /from '#\/server\/transit\/search'/.test(codeOf(file)))
    expect(proxyImporters.length).toBeGreaterThan(0)
  })
})
