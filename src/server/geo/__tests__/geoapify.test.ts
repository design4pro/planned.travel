/**
 * The Geoapify adapter: the request it builds, the answer it reads, and what it says when it cannot.
 *
 * No case here touches the network — `fetch` is a parameter of `createGeoapifyClient`, which is the
 * whole point of that parameter. What is asserted is the boundary the rest of the product depends
 * on: the vendor's `lang` code, the candidate shape, the five failure reasons `./geocode` renders
 * from, and one property that has nothing to do with geocoding at all — **the API key never appears
 * in anything this module throws**, because a stack trace reaches a log and a log reaches a screen.
 */
import { describe, expect, it } from 'vitest'

import { GeoProviderError } from '../geocode'
import { createGeoapifyClient, geoapifyVendor } from '../geoapify'

import type { GeoapifyClientOptions } from '../geoapify'

/* --------------------------------------------------------------------- fakes */

/** A stand-in secret. Long and distinctive so a leak into a message cannot be missed. */
const API_KEY = 'test-key-2f4b9c7e1a5d'

const RESULT = {
  place_id: '51a3b2c1d4e5f6',
  name: 'Wawel Castle',
  formatted: 'Wawel Castle, Wawel 5, 31-001 Kraków, Poland',
  address_line1: 'Wawel Castle',
  city: 'Kraków',
  country_code: 'pl',
  lat: 50.0541,
  lon: 19.9356,
}

/** Records every URL asked for and answers with whatever the case handed over. */
function stubFetch(answer: () => Promise<Response>): {
  readonly fetch: typeof fetch
  readonly urls: Array<URL>
} {
  const urls: Array<URL> = []
  return {
    urls,
    fetch: (input: RequestInfo | URL) => {
      urls.push(new URL(String(input)))
      return answer()
    },
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function client(
  answer: () => Promise<Response>,
  overrides: Partial<GeoapifyClientOptions> = {},
) {
  const transport = stubFetch(answer)
  return {
    urls: transport.urls,
    provider: createGeoapifyClient({
      apiKey: API_KEY,
      fetch: transport.fetch,
      ...overrides,
    }),
  }
}

/* --------------------------------------------------------------------- cases */

describe('the Geoapify adapter', () => {
  it('declares the vendor identity the cache and the credits are built from', () => {
    expect(geoapifyVendor.slug).toBe('geoapify')
    // ADR 0013 bought permanent storage; `./geocode` refuses to write a cache entry without it.
    expect(geoapifyVendor.retention).toBe('permanent')
    expect(geoapifyVendor.attribution.map((credit) => credit.name)).toEqual([
      'OpenStreetMap',
      'Geoapify',
    ])
  })

  it('refuses an empty credential at construction, before any lookup is attempted', () => {
    // The refusal belongs here rather than at the first call: `./bindings` hands the proxy a `null`
    // provider on an unconfigured deployment, so a lookup never reaches a client that cannot work.
    expect(() =>
      createGeoapifyClient({ apiKey: '   ', fetch: globalThis.fetch }),
    ).toThrow(GeoProviderError)
  })

  it('reads a populated forward answer into candidates', async () => {
    const { provider, urls } = client(() =>
      Promise.resolve(jsonResponse({ results: [RESULT] })),
    )

    const candidates = await provider.forward({
      query: 'wawel castle',
      language: 'en',
    })

    expect(candidates).toEqual([
      {
        id: '51a3b2c1d4e5f6',
        name: 'Wawel Castle',
        address: 'Wawel Castle, Wawel 5, 31-001 Kraków, Poland',
        city: 'Kraków',
        // Upper case, which is the shape `places.country_code` stores.
        countryCode: 'PL',
        lat: 50.0541,
        lng: 19.9356,
      },
    ])
    expect(urls[0]?.searchParams.get('text')).toBe('wawel castle')
    expect(urls[0]?.searchParams.get('limit')).toBe('5')
  })

  it('asks the reverse endpoint for one place, not five', async () => {
    const { provider, urls } = client(() =>
      Promise.resolve(jsonResponse({ results: [RESULT] })),
    )

    const candidates = await provider.reverse({
      lat: 50.0541,
      lng: 19.9356,
      language: 'en',
    })

    expect(candidates).toHaveLength(1)
    expect(urls[0]?.pathname).toBe('/v1/geocode/reverse')
    expect(urls[0]?.searchParams.get('lat')).toBe('50.0541')
    // The vendor spells the second coordinate `lon`; the product spells it `lng` everywhere else.
    expect(urls[0]?.searchParams.get('lon')).toBe('19.9356')
    expect(urls[0]?.searchParams.get('limit')).toBe('1')
  })

  it('treats an empty answer as an answer', async () => {
    const { provider } = client(() =>
      Promise.resolve(jsonResponse({ results: [] })),
    )

    // Nothing found is not a failure — `./geocode` declines to cache it and spends the lookup, and
    // the surface says "no matches" rather than "something went wrong".
    await expect(
      provider.forward({ query: 'qqqqqqqq', language: 'en' }),
    ).resolves.toEqual([])
  })

  it('drops a result the vendor gave no id for', async () => {
    const { provider } = client(() =>
      Promise.resolve(
        jsonResponse({ results: [{ ...RESULT, place_id: undefined }, RESULT] }),
      ),
    )

    // An id we invented would name a place the vendor cannot be asked about again, and the id is
    // exactly what a caller writes to `places.external_id`.
    const candidates = await provider.forward({
      query: 'wawel castle',
      language: 'en',
    })
    expect(candidates).toHaveLength(1)
  })

  it('sends a bare tag unchanged and collapses the three that are not bare', async () => {
    const { provider, urls } = client(() =>
      Promise.resolve(jsonResponse({ results: [] })),
    )

    for (const language of ['pl', 'pt-BR', 'zh-Hans', 'zh-Hant'] as const) {
      await provider.forward({ query: 'kraków', language })
    }

    // Both Chinese readers get the same script from the vendor: a loss owned by the vendor's `lang`
    // parameter, not by this mapping. The cache key keeps the full tag, so the two never share one.
    expect(urls.map((url) => url.searchParams.get('lang'))).toEqual([
      'pl',
      'pt',
      'zh',
      'zh',
    ])
  })

  it('reports a transport failure as unreachable', async () => {
    const { provider } = client(() =>
      Promise.reject(new Error('socket hang up')),
    )

    await expect(
      provider.forward({ query: 'kraków', language: 'en' }),
    ).rejects.toMatchObject({ reason: 'unreachable', status: null })
  })

  it('reports a rejected request as refused, with the status', async () => {
    const { provider } = client(() =>
      Promise.resolve(jsonResponse({ error: 'quota' }, 429)),
    )

    await expect(
      provider.forward({ query: 'kraków', language: 'en' }),
    ).rejects.toMatchObject({ reason: 'refused', status: 429 })
  })

  it('reports an unreadable body as malformed', async () => {
    const { provider } = client(() =>
      Promise.resolve(
        new Response('<html>maintenance</html>', {
          headers: { 'content-type': 'text/html' },
        }),
      ),
    )

    await expect(
      provider.forward({ query: 'kraków', language: 'en' }),
    ).rejects.toMatchObject({ reason: 'malformed' })
  })

  it('reports an answer in the wrong shape as malformed', async () => {
    const { provider } = client(() =>
      Promise.resolve(jsonResponse({ results: [{ ...RESULT, lat: 'fifty' }] })),
    )

    // A field we read arriving in the wrong shape is refused outright: a response that half-parses
    // is a coordinate nobody can account for.
    await expect(
      provider.forward({ query: 'kraków', language: 'en' }),
    ).rejects.toMatchObject({ reason: 'malformed' })
  })

  it('never puts the credential in anything it throws', async () => {
    const cases: ReadonlyArray<() => Promise<Response>> = [
      () => Promise.reject(new Error(`connect failed`)),
      () => Promise.resolve(jsonResponse({ error: 'quota' }, 429)),
      () => Promise.resolve(new Response('nope')),
    ]

    for (const answer of cases) {
      const { provider } = client(answer)
      const error = await provider
        .forward({ query: 'kraków', language: 'en' })
        .catch((thrown: unknown) => thrown)

      // The key rides in the query string because that is the only form the vendor accepts, so the
      // URL is what must never be quoted — not the status, and not the vendor's own text.
      expect(String(error)).not.toContain(API_KEY)
      expect(
        JSON.stringify(error, Object.getOwnPropertyNames(error)),
      ).not.toContain(API_KEY)
    }
  })
})
