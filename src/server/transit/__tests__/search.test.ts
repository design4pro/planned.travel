/**
 * The transit proxy: the cache, the meter and the provider client.
 *
 * This is the seam PRD #167's testing decision 4 names — the one place three properties can be
 * seen at all:
 *
 * - **The cache key is identical for two tenants issuing the same query.** The failure it guards
 *   against is the opposite of the usual one. A key that accidentally carried an organization id
 *   would leak nothing; it would silently multiply the provider bill by the number of workspaces,
 *   and nothing on any screen would look wrong.
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
import {
  RateCeilingError,
  rateMeterKey,
  rateWindowOf,
  spendRateUnit,
} from '../meter'
import {
  TRANSIT_CACHE_TTL_SECONDS,
  TransitProviderError,
  searchTransitConnections,
  transitCacheKey,
} from '../search'

import type { RateCounterStore } from '../meter'
import type {
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
} {
  const entries = new Map<string, string>()
  const reads: Array<string> = []
  const writes: Array<string> = []
  return {
    entries,
    reads,
    writes,
    get(key) {
      reads.push(key)
      return Promise.resolve(entries.get(key) ?? null)
    },
    put(key, value) {
      writes.push(key)
      entries.set(key, value)
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

function stubClient(
  connections: ReadonlyArray<TransitConnection> = [CONNECTION],
): TransitClient & { readonly calls: Array<TransitQuery> } {
  const calls: Array<TransitQuery> = []
  return {
    calls,
    search(query) {
      calls.push(query)
      return Promise.resolve(connections)
    },
  }
}

const QUERY: TransitQuery = {
  origin: { name: 'Lisboa Santa Apolónia', lat: 38.713_2, lng: -9.122_4 },
  destination: { name: 'Porto Campanhã', lat: 41.148_9, lng: -8.585_1 },
  date: '2026-10-09',
  modes: ['train', 'bus'],
}

function runtime(
  overrides: Partial<TransitSearchRuntime> = {},
): TransitSearchRuntime {
  return {
    cache: memoryStore(),
    counters: memoryStore(),
    client: stubClient(),
    organizationId: 'org-alpha',
    ceiling: 250,
    now: () => new Date('2026-09-01T10:00:00Z'),
    ...overrides,
  }
}

/* --------------------------------------------------------------- the key */

describe('transitCacheKey', () => {
  /**
   * The property ADR 0011 chose this cache for. Two workspaces asking the same question of the
   * same timetable are one question, and the answer is a public fact about a train.
   */
  it('is the same string for two different tenants asking the same question', () => {
    // Neither call is handed an organization: the key has nowhere to put one.
    expect(transitCacheKey(QUERY)).toBe(transitCacheKey({ ...QUERY }))
    expect(transitCacheKey(QUERY)).not.toContain('org-')
  })

  it('answers the same key however the traveller labelled the stops', () => {
    expect(
      transitCacheKey({
        ...QUERY,
        origin: { ...QUERY.origin, name: 'Santa Apolónia station' },
        destination: { ...QUERY.destination, name: 'porto campanha' },
      }),
    ).toBe(transitCacheKey(QUERY))
  })

  it('answers the same key however the mode filter was ordered', () => {
    expect(transitCacheKey({ ...QUERY, modes: ['bus', 'train'] })).toBe(
      transitCacheKey(QUERY),
    )
    expect(transitCacheKey({ ...QUERY, modes: ['bus', 'train', 'bus'] })).toBe(
      transitCacheKey(QUERY),
    )
  })

  it('separates a different date, a different filter and a different stop', () => {
    const keys = new Set([
      transitCacheKey(QUERY),
      transitCacheKey({ ...QUERY, date: '2026-10-10' }),
      transitCacheKey({ ...QUERY, modes: ['train'] }),
      transitCacheKey({ ...QUERY, modes: [] }),
      transitCacheKey({
        ...QUERY,
        destination: { ...QUERY.destination, lat: 41.2 },
      }),
    ])
    expect(keys.size).toBe(5)
  })

  it('stays inside a KV key, whatever the traveller typed', () => {
    const key = transitCacheKey({
      ...QUERY,
      origin: { ...QUERY.origin, name: 'x'.repeat(4000) },
    })
    expect(new TextEncoder().encode(key).length).toBeLessThanOrEqual(512)
  })
})

/* --------------------------------------------------------------- the meter */

describe('the rate meter', () => {
  it('keys a tally by metric, workspace and calendar month', () => {
    expect(rateWindowOf(new Date('2026-09-01T00:00:00Z'))).toBe('2026-09')
    expect(rateWindowOf(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12')
    expect(
      rateMeterKey('transit_searches_per_month', 'org-alpha', '2026-09'),
    ).not.toBe(
      rateMeterKey('transit_searches_per_month', 'org-beta', '2026-09'),
    )
    expect(
      rateMeterKey('transit_searches_per_month', 'org-alpha', '2026-09'),
    ).not.toBe(
      rateMeterKey('extraction_calls_per_month', 'org-alpha', '2026-09'),
    )
  })

  it('counts up to the ceiling and then refuses', async () => {
    const store = memoryStore()
    const spend = (): Promise<number> =>
      spendRateUnit(store, {
        metric: 'transit_searches_per_month',
        organizationId: 'org-alpha',
        ceiling: 2,
        now: () => new Date('2026-09-01T10:00:00Z'),
      })

    expect(await spend()).toBe(1)
    expect(await spend()).toBe(2)
    await expect(spend()).rejects.toBeInstanceOf(RateCeilingError)
  })

  it('refuses a plan whose ceiling is zero without writing anything', async () => {
    const store = memoryStore()
    await expect(
      spendRateUnit(store, {
        metric: 'transit_searches_per_month',
        organizationId: 'org-free',
        ceiling: 0,
        now: () => new Date('2026-09-01T10:00:00Z'),
      }),
    ).rejects.toBeInstanceOf(RateCeilingError)
    expect(store.writes).toEqual([])
  })

  it('starts again in the next calendar month', async () => {
    const store = memoryStore()
    const spend = (at: string): Promise<number> =>
      spendRateUnit(store, {
        metric: 'transit_searches_per_month',
        organizationId: 'org-alpha',
        ceiling: 1,
        now: () => new Date(at),
      })

    expect(await spend('2026-09-30T23:00:00Z')).toBe(1)
    await expect(spend('2026-09-30T23:30:00Z')).rejects.toBeInstanceOf(
      RateCeilingError,
    )
    expect(await spend('2026-10-01T00:30:00Z')).toBe(1)
  })

  /**
   * The posture `src/server/metering/outbound.ts` states and this file inherits: a metering fault
   * must not be able to take a feature down. Only a *successful* read saying the ceiling is spent
   * closes the gate.
   */
  it('fails open when the counter cannot be read', async () => {
    const broken: RateCounterStore = {
      get: () => Promise.reject(new Error('KV unavailable')),
      put: () => Promise.resolve(),
    }
    await expect(
      spendRateUnit(broken, {
        metric: 'transit_searches_per_month',
        organizationId: 'org-alpha',
        ceiling: 1,
        now: () => new Date('2026-09-01T10:00:00Z'),
      }),
    ).resolves.toBe(1)
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
    expect(cache.entries.has(transitCacheKey(QUERY))).toBe(true)
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

  /** The shared cache, seen from the side that matters: β pays nothing for α's question. */
  it('serves one workspace the answer another workspace paid for', async () => {
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

    expect(beta.cached).toBe(true)
    expect(client.calls).toHaveLength(1)
    expect(beta.spent).toBeNull()
    // One search was made and one was counted, against the workspace that made it.
    expect([...counters.entries.keys()]).toEqual([
      rateMeterKey('transit_searches_per_month', 'org-alpha', '2026-09'),
    ])
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

  it('refuses at the ceiling, before the provider is called', async () => {
    const client = stubClient()
    const deps = runtime({ client, ceiling: 0 })

    await expect(searchTransitConnections(deps, QUERY)).rejects.toBeInstanceOf(
      RateCeilingError,
    )
    expect(client.calls).toEqual([])
  })

  /**
   * The one place the shared cache and the plan boundary meet, and they have to be ordered.
   *
   * A zero ceiling is not "no searches left this month", it is "this plan does not search" — and
   * the cache is shared by design, so a paying workspace asking about a popular route leaves an
   * answer sitting there for six hours. Answered from the cache, a Free workspace would get real
   * results with `ok: true`, no meter and no refusal. Nothing leaks and nothing is billed, which
   * is exactly why this needs a test: every symptom the mistake has is invisible.
   */
  it('refuses a zero ceiling even when another tenant has warmed the cache', async () => {
    const cache = memoryStore()
    const client = stubClient()

    // A paying workspace asks first, and the answer is now in the shared entry.
    const paying = await searchTransitConnections(
      runtime({ cache, client, organizationId: 'org-alpha', ceiling: 250 }),
      QUERY,
    )
    expect(paying.cached).toBe(false)

    const free = runtime({
      cache,
      client,
      organizationId: 'org-free',
      ceiling: 0,
    })
    await expect(searchTransitConnections(free, QUERY)).rejects.toBeInstanceOf(
      RateCeilingError,
    )
    // And the refusal is a gate rather than a race: the entry is still there for the plan that
    // may read it.
    expect(
      (await searchTransitConnections(runtime({ cache, client }), QUERY))
        .cached,
    ).toBe(true)
  })

  it('treats a cache entry it cannot parse as a miss rather than as an answer', async () => {
    const cache = memoryStore()
    const client = stubClient()
    await cache.put(transitCacheKey(QUERY), '{"connections":[{"id":42}]}')

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

  it('caches for a bounded window rather than for ever', () => {
    expect(TRANSIT_CACHE_TTL_SECONDS).toBeGreaterThan(0)
    expect(TRANSIT_CACHE_TTL_SECONDS).toBeLessThanOrEqual(86_400)
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
): { fetch: typeof fetch; readonly urls: Array<string> } {
  const urls: Array<string> = []
  const impl = ((input: RequestInfo | URL) => {
    urls.push(String(input))
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
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

    const [connection] = await client.search(QUERY)

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
    expect(url.searchParams.get('departureTime')).toBe('2026-10-09T00:00:00')
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
 * edit that quietly makes the proxy optional — the cache, the ceiling and the shared key with it.
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
