/**
 * The geocoding proxy: the key, the order of operations and the typed failures.
 *
 * Every case here is observable at the module's own boundary, with the vendor and both stores
 * faked — which is the whole reason `./bindings` is a separate file and `fetch` is a parameter of
 * `./geoapify`. No test in this directory touches the network.
 *
 * Three properties are the reason this file exists at all, and none of them is visible from a
 * screen:
 *
 * - **The cache key is identical for two tenants asking the same question.** The failure it guards
 *   against is the opposite of the usual one: a key that quietly acquired an organization id would
 *   leak nothing and would multiply the vendor bill by the number of workspaces, while every screen
 *   still looked right.
 * - **The order of operations decides who pays.** A cache hit must spend nothing, an unconfigured
 *   deployment must spend nothing and still serve what it holds, and a refusal we could have made
 *   for free must not arrive after the meter has run.
 * - **The retention right is enforced, not merely declared.** ADR 0013 bought permanent storage;
 *   an adapter that does not declare it is refused before a workspace is charged for its answer.
 *
 * The numbered references are to the success criteria on
 * [#281](https://github.com/design4pro/planned.travel/issues/281).
 */
import { describe, expect, it } from 'vitest'

import { RateCeilingError } from '#/server/metering/rate'
import {
  GEOCODE_QUERY_MAX_LENGTH,
  GeoProviderError,
  forwardCacheKey,
  forwardGeocode,
  normalizeGeocodeQuery,
  reverseCacheKey,
  reverseGeocode,
} from '../geocode'

import type {
  GeoCache,
  GeocodeCandidate,
  GeocodeProvider,
  GeocodeRuntime,
  GeocodeVendor,
} from '../geocode'
import type { OutboundRuntime } from '#/server/metering/outbound'

/* --------------------------------------------------------------------- fakes */

/** The slice of KV both the cache and the meter use, in memory. */
function memoryStore(): GeoCache & {
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

const CREDITS = [
  { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright' },
  { name: 'Geoapify', url: 'https://www.geoapify.com/' },
] as const

const VENDOR: GeocodeVendor = {
  slug: 'geoapify',
  retention: 'permanent',
  attribution: CREDITS,
}

const CANDIDATE: GeocodeCandidate = {
  id: 'osm:way:12345',
  name: 'Plaza Mayor',
  address: 'Plaza Mayor, 28012 Madrid',
  city: 'Madrid',
  countryCode: 'ES',
  lat: 40.4155,
  lng: -3.7074,
}

interface StubProvider extends GeocodeProvider {
  readonly forwardCalls: Array<{ query: string; language: string }>
  readonly reverseCalls: Array<{ lat: number; lng: number }>
}

function stubProvider(
  overrides: Partial<GeocodeVendor> & {
    candidates?: ReadonlyArray<GeocodeCandidate>
  } = {},
): StubProvider {
  const forwardCalls: Array<{ query: string; language: string }> = []
  const reverseCalls: Array<{ lat: number; lng: number }> = []
  const candidates = overrides.candidates ?? [CANDIDATE]
  return {
    slug: overrides.slug ?? VENDOR.slug,
    retention: overrides.retention ?? VENDOR.retention,
    attribution: overrides.attribution ?? VENDOR.attribution,
    forwardCalls,
    reverseCalls,
    forward(query) {
      forwardCalls.push({ query: query.query, language: query.language })
      return Promise.resolve(candidates)
    },
    reverse(query) {
      reverseCalls.push({ lat: query.lat, lng: query.lng })
      return Promise.resolve(candidates)
    },
  }
}

/**
 * The ledger runtime with no database behind it.
 *
 * `db: null` is `callProvider`'s documented "no handle" state, in which the gate stays open and the
 * meter no-ops — metering is never a reason a call does not happen. The cases that do assert the
 * ledger's behaviour drive it against real tables in `__tests__/ledger.test.ts`.
 */
function outboundRuntime(): OutboundRuntime {
  return {
    db: null,
    waitUntil: () => undefined,
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    } as unknown as OutboundRuntime['logger'],
    now: () => new Date('2026-09-01T10:00:00Z'),
  }
}

function runtime(overrides: Partial<GeocodeRuntime> = {}): GeocodeRuntime {
  return {
    cache: memoryStore(),
    counters: memoryStore(),
    vendor: VENDOR,
    provider: stubProvider(),
    outbound: outboundRuntime(),
    organizationId: 'org-alpha',
    ceiling: 200,
    now: () => new Date('2026-09-01T10:00:00Z'),
    ...overrides,
  }
}

/* ----------------------------------------------------------------- the keys */

describe('the cache key', () => {
  /**
   * Criterion 2, and ADR 0013's term. The key has nowhere to put an organization, which is what
   * makes an unexpiring shared cache legal rather than merely cheap.
   */
  it('is the same string for two different tenants asking the same question', async () => {
    const first = await forwardCacheKey('geoapify', 'en', 'Plaza Mayor')
    const second = await forwardCacheKey('geoapify', 'en', 'Plaza Mayor')

    expect(first).toBe(second)
    expect(first).not.toContain('org-')
  })

  /** Criterion 8: one question, however it was spaced or capitalised. */
  it('folds whitespace and case into one question', async () => {
    expect(normalizeGeocodeQuery('  Plaza   Mayor ')).toBe('plaza mayor')
    expect(await forwardCacheKey('geoapify', 'en', '  Plaza   Mayor ')).toBe(
      await forwardCacheKey('geoapify', 'en', 'plaza mayor'),
    )
  })

  /** Criterion 9: a geocoder answers *in* a language, so the language is part of the question. */
  it('separates two languages, two vendors and two directions', async () => {
    const keys = new Set([
      await forwardCacheKey('geoapify', 'en', 'Plaza Mayor'),
      await forwardCacheKey('geoapify', 'pl', 'Plaza Mayor'),
      await forwardCacheKey('here', 'en', 'Plaza Mayor'),
      await forwardCacheKey('geoapify', 'en', 'Plaza Menor'),
      reverseCacheKey('geoapify', 'en', 40.4155, -3.7074),
    ])
    expect(keys.size).toBe(5)
  })

  it('rounds a reverse lookup to about eleven metres, so one doorway is one key', () => {
    expect(reverseCacheKey('geoapify', 'en', 40.415_512, -3.707_431)).toBe(
      reverseCacheKey('geoapify', 'en', 40.415_54, -3.707_39),
    )
    expect(reverseCacheKey('geoapify', 'en', 40.4155, -3.7074)).not.toBe(
      reverseCacheKey('geoapify', 'en', 40.4165, -3.7074),
    )
  })

  it('stays inside a KV key, whatever the traveller typed', async () => {
    const key = await forwardCacheKey(
      'geoapify',
      'en',
      'x'.repeat(GEOCODE_QUERY_MAX_LENGTH),
    )
    expect(new TextEncoder().encode(key).length).toBeLessThanOrEqual(512)
  })
})

/* -------------------------------------------------------------- the proxy */

describe('forwardGeocode', () => {
  /** Criterion 1: ranked candidates, each with a coordinate, and the credit that travels with it. */
  it('answers ranked candidates and the attribution that must be stored beside them', async () => {
    const result = await forwardGeocode(runtime(), {
      query: 'Plaza Mayor',
      language: 'en',
    })

    expect(result.candidates).toEqual([CANDIDATE])
    expect(result.attribution).toEqual(CREDITS)
    expect(result.cached).toBe(false)
  })

  /** Criterion 3, first half: a miss spends exactly one unit. */
  it('spends exactly one unit of the allowance on a miss', async () => {
    const result = await forwardGeocode(runtime(), {
      query: 'Plaza Mayor',
      language: 'en',
    })

    expect(result.spent).toBe(1)
    expect(result.ceiling).toBe(200)
  })

  /** Criteria 2 and 3: a hit costs nothing, so it spends nothing and makes no call. */
  it('serves one workspace the answer another workspace paid for, spending nothing', async () => {
    const cache = memoryStore()

    const alpha = stubProvider()
    await forwardGeocode(
      runtime({ cache, provider: alpha, organizationId: 'org-alpha' }),
      { query: 'Plaza Mayor', language: 'en' },
    )

    const beta = stubProvider()
    const counters = memoryStore()
    const second = await forwardGeocode(
      runtime({
        cache,
        counters,
        provider: beta,
        organizationId: 'org-beta',
      }),
      // Spaced and capitalised differently, to prove the fold reaches the shared entry.
      { query: '  plaza   MAYOR  ', language: 'en' },
    )

    expect(second.cached).toBe(true)
    expect(second.spent).toBeNull()
    expect(second.candidates).toEqual([CANDIDATE])
    expect(beta.forwardCalls).toEqual([])
    expect(counters.writes).toEqual([])
  })

  /** Criterion 9: two languages are two questions, so the second does not read the first's answer. */
  it('does not serve one language the answer given in another', async () => {
    const cache = memoryStore()
    await forwardGeocode(runtime({ cache }), {
      query: 'Plaza Mayor',
      language: 'en',
    })

    const polish = stubProvider()
    const second = await forwardGeocode(runtime({ cache, provider: polish }), {
      query: 'Plaza Mayor',
      language: 'pl',
    })

    expect(second.cached).toBe(false)
    expect(polish.forwardCalls).toHaveLength(1)
  })

  /** Criterion 4: refused before the vendor, carrying facts rather than a sentence. */
  it('refuses at the ceiling before the vendor is called', async () => {
    const provider = stubProvider()
    const counters = memoryStore()
    const deps = runtime({ counters, provider, ceiling: 1 })

    await forwardGeocode(deps, { query: 'Plaza Mayor', language: 'en' })

    await expect(
      forwardGeocode(deps, { query: 'Plaza Menor', language: 'en' }),
    ).rejects.toMatchObject({
      name: 'RateCeilingError',
      metric: 'geocode_lookups_per_month',
      ceiling: 1,
      spent: 1,
    })
    expect(provider.forwardCalls).toHaveLength(1)
  })

  /**
   * The plan gate, position 2 of the order. Unreachable under today's figures — no plan's geocoding
   * allowance is zero — and asserted because it is the boundary: left behind the cache, an excluded
   * workspace would be served real answers a paying one had already bought.
   */
  it('refuses a zero ceiling even when another tenant has warmed the cache', async () => {
    const cache = memoryStore()
    await forwardGeocode(runtime({ cache }), {
      query: 'Plaza Mayor',
      language: 'en',
    })

    const readsAfterWarming = cache.reads.length

    await expect(
      forwardGeocode(runtime({ cache, ceiling: 0 }), {
        query: 'Plaza Mayor',
        language: 'en',
      }),
    ).rejects.toBeInstanceOf(RateCeilingError)

    // The gate is in front of the cache, so the excluded workspace does not even get to look at
    // the entry it would otherwise have been served for free.
    expect(cache.reads).toHaveLength(readsAfterWarming)
  })

  /** Criterion 5, first half: no credential, no call, and no allowance spent on it. */
  it('refuses an unconfigured deployment without spending the allowance', async () => {
    const counters = memoryStore()

    await expect(
      forwardGeocode(runtime({ counters, provider: null }), {
        query: 'Plaza Mayor',
        language: 'en',
      }),
    ).rejects.toMatchObject({
      name: 'GeoProviderError',
      reason: 'unconfigured',
    })
    expect(counters.writes).toEqual([])
  })

  /**
   * Criterion 5, second half, and the reason `vendor` sits beside `provider` rather than inside it.
   * A cache hit on a deployment holding no credential needs the slug, which is in the key, and the
   * attribution, which the result does not make optional — both off `runtime.vendor`.
   */
  it('serves a cached answer with no provider at all, from the vendor alone', async () => {
    const cache = memoryStore()
    await forwardGeocode(runtime({ cache }), {
      query: 'Plaza Mayor',
      language: 'en',
    })

    const result = await forwardGeocode(runtime({ cache, provider: null }), {
      query: 'Plaza Mayor',
      language: 'en',
    })

    expect(result.cached).toBe(true)
    expect(result.candidates).toEqual([CANDIDATE])
    expect(result.attribution).toEqual(CREDITS)
    expect(result.spent).toBeNull()
  })

  /** Criterion 7, and what makes ADR 0013's retention term enforceable rather than declared. */
  it('refuses an adapter that does not declare permanent storage, before the meter', async () => {
    const counters = memoryStore()
    const ephemeral = stubProvider({ retention: 'ephemeral' })

    await expect(
      forwardGeocode(runtime({ counters, provider: ephemeral }), {
        query: 'Plaza Mayor',
        language: 'en',
      }),
    ).rejects.toMatchObject({ name: 'GeoProviderError', reason: 'unstorable' })
    expect(counters.writes).toEqual([])
    expect(ephemeral.forwardCalls).toEqual([])
  })

  /** Criterion 8: refused by the schema, before KV is read at all. */
  it('refuses a query below the minimum or above the maximum length before touching the cache', async () => {
    const cache = memoryStore()

    await expect(
      forwardGeocode(runtime({ cache }), { query: 'ab', language: 'en' }),
    ).rejects.toThrow()
    await expect(
      forwardGeocode(runtime({ cache }), {
        query: 'x'.repeat(GEOCODE_QUERY_MAX_LENGTH + 1),
        language: 'en',
      }),
    ).rejects.toThrow()

    expect(cache.reads).toEqual([])
  })

  it('sends the vendor what the traveller typed, and folds only the key', async () => {
    const provider = stubProvider()
    await forwardGeocode(runtime({ provider }), {
      query: 'Plaza Mayor',
      language: 'en',
    })

    expect(provider.forwardCalls).toEqual([
      { query: 'Plaza Mayor', language: 'en' },
    ])
  })

  it('does not cache an empty answer as if it were one', async () => {
    const cache = memoryStore()
    const empty = stubProvider({ candidates: [] })

    const result = await forwardGeocode(runtime({ cache, provider: empty }), {
      query: 'Plaza Mayor',
      language: 'en',
    })

    expect(result.candidates).toEqual([])
    expect(cache.writes).toEqual([])
  })

  /** With no TTL to retire it, re-validation on read is all that stands between an old shape and a
   * permanent misreading. */
  it('treats a cache entry it cannot parse as a miss rather than as an answer', async () => {
    const cache = memoryStore()
    const key = await forwardCacheKey('geoapify', 'en', 'Plaza Mayor')
    cache.entries.set(key, JSON.stringify({ v: 1, candidates: [{ id: '' }] }))

    const provider = stubProvider()
    const result = await forwardGeocode(runtime({ cache, provider }), {
      query: 'Plaza Mayor',
      language: 'en',
    })

    expect(result.cached).toBe(false)
    expect(provider.forwardCalls).toHaveLength(1)
  })

  /** The inherited posture: a metering or cache fault must not be able to take a feature down. */
  it('treats an unreadable cache as a miss rather than as a failure', async () => {
    const broken: GeoCache = {
      get: () => Promise.reject(new Error('KV unavailable')),
      put: () => Promise.resolve(),
    }

    const result = await forwardGeocode(runtime({ cache: broken }), {
      query: 'Plaza Mayor',
      language: 'en',
    })

    expect(result.cached).toBe(false)
    expect(result.candidates).toEqual([CANDIDATE])
  })

  /** Criterion 6: a vendor failure arrives typed, never as a bare `fetch` rejection. */
  it('lets a vendor failure through as a typed failure', async () => {
    const failing: GeocodeProvider = {
      ...VENDOR,
      forward: () =>
        Promise.reject(
          new GeoProviderError(
            'unreachable',
            'The geocoder could not be reached.',
          ),
        ),
      reverse: () => Promise.resolve([]),
    }

    await expect(
      forwardGeocode(runtime({ provider: failing }), {
        query: 'Plaza Mayor',
        language: 'en',
      }),
    ).rejects.toMatchObject({ name: 'GeoProviderError', reason: 'unreachable' })
  })
})

/* ------------------------------------------------------------- reverse */

describe('reverseGeocode', () => {
  /** Criterion 1, second half: a point answers with an address. */
  it('answers an address for a point, through the same envelope', async () => {
    const result = await reverseGeocode(runtime(), {
      lat: 40.4155,
      lng: -3.7074,
      language: 'en',
    })

    expect(result.candidates).toEqual([CANDIDATE])
    expect(result.attribution).toEqual(CREDITS)
    expect(result.spent).toBe(1)
  })

  it('spends nothing on a second, identical drop of the pin', async () => {
    const cache = memoryStore()
    await reverseGeocode(runtime({ cache }), {
      lat: 40.4155,
      lng: -3.7074,
      language: 'en',
    })

    const provider = stubProvider()
    const second = await reverseGeocode(runtime({ cache, provider }), {
      lat: 40.4155,
      lng: -3.7074,
      language: 'en',
    })

    expect(second.cached).toBe(true)
    expect(second.spent).toBeNull()
    expect(provider.reverseCalls).toEqual([])
  })

  it('refuses a coordinate that is not one', async () => {
    await expect(
      reverseGeocode(runtime(), { lat: 91, lng: 0, language: 'en' }),
    ).rejects.toThrow()
    await expect(
      reverseGeocode(runtime(), { lat: 0, lng: 181, language: 'en' }),
    ).rejects.toThrow()
  })

  it('shares the allowance with forward lookups rather than keeping its own', async () => {
    // One purchased allowance, one metric. Two would be two numbers a plan has to publish and a
    // reader has to understand, and the cheaper of the two would be the one nobody ever reaches.
    const counters = memoryStore()
    const deps = runtime({ counters, ceiling: 2 })

    expect(
      (await forwardGeocode(deps, { query: 'Plaza Mayor', language: 'en' }))
        .spent,
    ).toBe(1)
    expect(
      (
        await reverseGeocode(deps, {
          lat: 40.4155,
          lng: -3.7074,
          language: 'en',
        })
      ).spent,
    ).toBe(2)
    await expect(
      reverseGeocode(deps, { lat: 41.9, lng: 12.5, language: 'en' }),
    ).rejects.toBeInstanceOf(RateCeilingError)
  })
})
