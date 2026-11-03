import { describe, expect, it, vi } from 'vitest'
import { createLogger } from '#/server/observability'
import { createPublicRates } from '../public-rates'
import type { PublicRatesRuntime } from '../public-rates'

function fixture() {
  let time = Date.parse('2026-11-03T18:00:00Z')
  const values = new Map<string, string>()
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json([
      { date: '2026-11-03', base: 'EUR', quote: 'EUR', rate: 1 },
      { date: '2026-11-03', base: 'EUR', quote: 'USD', rate: 1.25 },
    ]),
  )
  const runtime: PublicRatesRuntime = {
    cache: {
      get: async (key) => values.get(key) ?? null,
      put: async (key, value) => {
        values.set(key, value)
      },
    },
    fetch,
    now: () => time,
    sleep: async () => {},
    outbound: {
      db: null,
      now: () => new Date(time),
      waitUntil: () => {},
      logger: createLogger({ sink: { write: () => {} } }),
    },
  }
  return {
    runtime,
    fetch,
    values,
    advance: (ms: number) => {
      time += ms
    },
  }
}

describe('public reference rates', () => {
  it('shares only a public snapshot between workspaces and coalesces actual demand', async () => {
    const f = fixture()
    const rates = createPublicRates()
    const [a, b] = await Promise.all([
      rates(f.runtime, 'workspace-a'),
      rates(f.runtime, 'workspace-b'),
    ])
    expect(a).toEqual(b)
    expect(a.status).toBe('available')
    expect(f.fetch).toHaveBeenCalledTimes(1)
    expect(JSON.stringify([...f.values])).not.toMatch(
      /workspace|organization|amount/,
    )
    expect(f.fetch.mock.calls[0]?.[0]).toBe(
      'https://api.frankfurter.dev/v2/providers/ecb/rates?base=EUR',
    )
    await rates(f.runtime, 'workspace-b')
    expect(f.fetch).toHaveBeenCalledTimes(1)
  })
  it('keeps a good snapshot after malformed success and respects cooldown', async () => {
    const f = fixture()
    const rates = createPublicRates()
    await rates(f.runtime, 'a')
    f.advance(3_600_000)
    f.fetch.mockImplementation(async () =>
      Response.json([
        { date: '2026-11-03', base: 'EUR', quote: 'EUR', rate: 0 },
      ]),
    )
    expect(await rates(f.runtime, 'a')).toMatchObject({
      status: 'available',
      freshness: 'stale',
      reason: 'provider-failed',
    })
    expect(await rates(f.runtime, 'b', true)).toMatchObject({
      status: 'available',
      reason: 'throttled',
    })
    expect(f.fetch).toHaveBeenCalledTimes(2)
  })
  it('does not turn a cache failure into an upstream call', async () => {
    const f = fixture()
    f.runtime.cache.get = async () => {
      throw new Error('offline')
    }
    expect(await createPublicRates()(f.runtime, 'a')).toMatchObject({
      status: 'unavailable',
      reason: 'cache-unavailable',
    })
    expect(f.fetch).not.toHaveBeenCalled()
  })
  it('expires observations at UTC midnight independently of fetched time', async () => {
    const f = fixture()
    const rates = createPublicRates()
    await rates(f.runtime, 'a')
    f.advance(8 * 86_400_000)
    f.fetch.mockRejectedValue(new Error('offline'))
    expect(await rates(f.runtime, 'a')).toMatchObject({ status: 'unavailable' })
  })
})

it('refuses upstream when the initial marker cannot be written', async () => {
  const f = fixture()
  f.runtime.cache.put = async () => {
    throw new Error('unavailable')
  }
  expect(await createPublicRates()(f.runtime, 'a')).toMatchObject({
    status: 'unavailable',
    reason: 'cache-unavailable',
  })
  expect(f.fetch).not.toHaveBeenCalled()
})
it('returns an eligible isolate fallback after a snapshot write or cache read fault', async () => {
  const f = fixture()
  const rates = createPublicRates()
  const original = f.runtime.cache.put
  f.runtime.cache.put = async (key, value, options) => {
    if (key.endsWith(':latest')) throw new Error('unavailable')
    await original(key, value, options)
  }
  expect(await rates(f.runtime, 'a')).toMatchObject({
    status: 'available',
    freshness: 'stale',
    reason: 'cache-unavailable',
  })
  f.runtime.cache.get = async () => {
    throw new Error('unavailable')
  }
  expect(await rates(f.runtime, 'b')).toMatchObject({
    status: 'available',
    reason: 'cache-unavailable',
  })
  expect(f.fetch).toHaveBeenCalledTimes(1)
})
it('retains newer observations and never resets their UTC age on revalidation', async () => {
  const f = fixture()
  const rates = createPublicRates()
  await rates(f.runtime, 'a')
  f.advance(5 * 86400000)
  expect(await rates(f.runtime, 'a')).toMatchObject({
    status: 'available',
    freshness: 'stale',
    reason: 'old-observation',
  })
  f.advance(3600000)
  f.fetch.mockImplementation(async () =>
    Response.json([{ date: '2026-11-02', base: 'EUR', quote: 'EUR', rate: 1 }]),
  )
  expect(await rates(f.runtime, 'a')).toMatchObject({
    status: 'available',
    reason: 'old-observation',
    snapshot: { effectiveOn: '2026-11-03' },
  })
})
it('honors Retry-After locally and supervises extension only after the KV write interval', async () => {
  const f = fixture()
  let release: () => void = () => {}
  const pending: Promise<unknown>[] = []
  f.runtime.sleep = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve
      }),
  )
  f.runtime.outbound = {
    ...f.runtime.outbound,
    waitUntil: (promise) => {
      pending.push(promise)
    },
  }
  f.fetch.mockImplementation(
    async () =>
      new Response(null, { status: 429, headers: { 'Retry-After': '3600' } }),
  )
  const rates = createPublicRates()
  const response = await rates(f.runtime, 'a')
  expect(response).toMatchObject({
    status: 'unavailable',
    reason: 'provider-failed',
    retryAt: f.runtime.now() + 3600000,
  })
  expect(f.runtime.sleep).toHaveBeenCalledWith(1000)
  const marker = () =>
    JSON.parse(
      f.values.get('fx:public:frankfurter-ecb:v1:attempt') ?? '{}',
    ) as { retryAt: number }
  expect(marker().retryAt).toBe(f.runtime.now() + 300000)
  f.advance(1000)
  release()
  await Promise.all(pending)
  expect(marker().retryAt).toBe(f.runtime.now() + 3599000)
  f.advance(600000)
  await rates(f.runtime, 'a', true)
  expect(f.fetch).toHaveBeenCalledTimes(1)
})
it('allows observable cross-isolate races rather than pretending KV is a global lock', async () => {
  const f = fixture()
  await Promise.all([
    createPublicRates()(f.runtime, 'a'),
    createPublicRates()(f.runtime, 'b'),
  ])
  expect(f.fetch).toHaveBeenCalledTimes(2)
})

it('waits a full second after a slow initial marker write before extending it', async () => {
  const f = fixture()
  const put = f.runtime.cache.put
  const pending: Promise<unknown>[] = []
  f.runtime.cache.put = async (key, value, options) => {
    await put(key, value, options)
    f.advance(2000)
  }
  f.runtime.sleep = vi.fn(async () => {})
  f.runtime.outbound = {
    ...f.runtime.outbound,
    waitUntil: (promise) => {
      pending.push(promise)
    },
  }
  f.fetch.mockImplementation(
    async () =>
      new Response(null, { status: 429, headers: { 'Retry-After': '3600' } }),
  )
  await createPublicRates()(f.runtime, 'a')
  await Promise.all(pending)
  expect(f.runtime.sleep).toHaveBeenCalledWith(1000)
})
it.each(['2026-11-04', 'not a date', '-1'])(
  'ignores invalid Retry-After %s',
  async (header) => {
    const f = fixture()
    f.fetch.mockImplementation(
      async () =>
        new Response(null, { status: 429, headers: { 'Retry-After': header } }),
    )
    expect(await createPublicRates()(f.runtime, 'a')).toMatchObject({
      retryAt: f.runtime.now() + 300000,
    })
  },
)
it('rejects oversized or malformed attempt metadata without upstream work', async () => {
  const f = fixture()
  f.values.set('fx:public:frankfurter-ecb:v1:attempt', ' '.repeat(257))
  expect(await createPublicRates()(f.runtime, 'a')).toMatchObject({
    reason: 'cache-unavailable',
  })
  expect(f.fetch).not.toHaveBeenCalled()
})
