import { describe, expect, it, vi } from 'vitest'
import { createLogger } from '#/server/observability'
import { createPublicRates } from '../public-rates'
import type { PublicRatesRuntime } from '../public-rates'

const latestKey = 'fx:public:frankfurter-ecb:v1:latest'
const attemptKey = 'fx:public:frankfurter-ecb:v1:attempt'

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

it.each([
  ['malformed JSON', async () => new Response('[{"date":')],
  ['HTTP 503', async () => new Response(null, { status: 503 })],
  ['HTTP 302', async () => new Response(null, { status: 302 })],
  [
    'redirect rejection',
    async () => {
      throw new TypeError('unexpected redirect')
    },
  ],
  [
    'abort rejection',
    async () => {
      throw new DOMException('Aborted', 'AbortError')
    },
  ],
] as const)(
  'retains the validated snapshot and cooldown after %s',
  async (_name, fail) => {
    const f = fixture()
    const rates = createPublicRates()
    const initial = await rates(f.runtime, 'a')
    if (initial.status !== 'available')
      throw new Error('Expected initial snapshot')
    const stored = f.values.get(latestKey)
    f.advance(3_600_000)
    f.fetch.mockImplementation(fail)
    const retryAt = f.runtime.now() + 300_000
    expect(await rates(f.runtime, 'a')).toMatchObject({
      status: 'available',
      snapshot: initial.snapshot,
      freshness: 'stale',
      reason: 'provider-failed',
      retryAt,
    })
    expect(f.values.get(latestKey)).toBe(stored)
    f.advance(299_999)
    expect(await rates(f.runtime, 'b', true)).toMatchObject({
      reason: 'throttled',
      retryAt,
    })
    expect(f.fetch).toHaveBeenCalledTimes(2)
    f.advance(1)
    expect(await rates(f.runtime, 'b', true)).toMatchObject({
      reason: 'provider-failed',
    })
    expect(f.fetch).toHaveBeenCalledTimes(3)
  },
)

it('revalidates at exactly one hour, leaving the marker untouched on a fresh hit', async () => {
  const f = fixture()
  const rates = createPublicRates()
  const initial = await rates(f.runtime, 'a')
  const marker = f.values.get(attemptKey)
  f.advance(3_599_999)
  expect(await rates(f.runtime, 'b')).toMatchObject({
    status: 'available',
    freshness: 'fresh',
    reason: null,
  })
  expect(f.values.get(attemptKey)).toBe(marker)
  expect(f.fetch).toHaveBeenCalledOnce()
  f.advance(1)
  const refreshed = await rates(f.runtime, 'b')
  expect(refreshed).toMatchObject({
    status: 'available',
    freshness: 'fresh',
    checkedAt: f.runtime.now(),
  })
  expect(refreshed).not.toEqual(initial)
  expect(f.fetch).toHaveBeenCalledTimes(2)
})

it.each([
  ['2026-11-07T23:59:59.999Z', 'fresh', null, 'available', 'old-observation'],
  [
    '2026-11-10T23:59:59.999Z',
    'stale',
    'old-observation',
    'unavailable',
    'throttled',
  ],
] as const)(
  'changes observation eligibility at the UTC midnight after %s despite a just-fetched snapshot',
  async (beforeMidnight, freshness, reason, nextStatus, nextReason) => {
    const f = fixture()
    f.advance(Date.parse(beforeMidnight) - f.runtime.now())
    const rates = createPublicRates()
    expect(await rates(f.runtime, 'a')).toMatchObject({
      status: 'available',
      freshness,
      reason,
      snapshot: { effectiveOn: '2026-11-03', fetchedAt: f.runtime.now() },
    })
    f.advance(1)
    const result = await rates(f.runtime, 'b')
    expect(result).toMatchObject({ status: nextStatus, reason: nextReason })
    if (nextStatus === 'unavailable')
      expect(result).not.toHaveProperty('snapshot')
    else expect(result).toMatchObject({ freshness: 'stale' })
    expect(f.fetch).toHaveBeenCalledOnce()
  },
)

it.each([
  '{broken',
  JSON.stringify({ source: 'private', rates: { EUR: 1, USD: 9.87 } }),
  ' '.repeat(65537),
])(
  'ignores corrupt cached snapshots on a cold read and preserves a validated local fallback (%#)',
  async (corrupt) => {
    const f = fixture()
    f.values.set(latestKey, corrupt)
    const rates = createPublicRates()
    const initial = await rates(f.runtime, 'a')
    expect(initial).toMatchObject({
      status: 'available',
      snapshot: { rates: { EUR: 1, USD: 1.25 } },
    })
    if (initial.status !== 'available')
      throw new Error('Expected validated snapshot')
    expect(f.values.get(latestKey)).toBe(JSON.stringify(initial.snapshot))
    f.values.set(latestKey, corrupt)
    f.advance(3_600_000)
    f.fetch.mockRejectedValue(new Error('offline'))
    expect(await rates(f.runtime, 'b')).toMatchObject({
      status: 'available',
      snapshot: initial.snapshot,
      freshness: 'stale',
      reason: 'provider-failed',
    })
    expect(f.fetch).toHaveBeenCalledTimes(2)
    const cold = await createPublicRates()(f.runtime, 'c')
    expect(cold).toMatchObject({ status: 'unavailable', reason: 'throttled' })
    expect(cold).not.toHaveProperty('snapshot')
    expect(f.fetch).toHaveBeenCalledTimes(2)
  },
)

it('honors an HTTP-date Retry-After through its exact deadline', async () => {
  const f = fixture()
  const retryAt = Date.parse('2026-11-03T19:00:00Z')
  const pending: Promise<unknown>[] = []
  f.runtime.outbound = {
    ...f.runtime.outbound,
    waitUntil: (promise) => {
      pending.push(promise)
    },
  }
  f.runtime.sleep = async (ms) => {
    f.advance(ms)
  }
  f.fetch.mockResolvedValueOnce(
    new Response(null, {
      status: 429,
      headers: { 'Retry-After': new Date(retryAt).toUTCString() },
    }),
  )
  const rates = createPublicRates()
  expect(await rates(f.runtime, 'a')).toMatchObject({
    status: 'unavailable',
    reason: 'provider-failed',
    retryAt,
  })
  await Promise.all(pending)
  expect(JSON.parse(f.values.get(attemptKey) ?? '{}')).toMatchObject({
    retryAt,
  })
  f.advance(retryAt - f.runtime.now() - 1)
  expect(await rates(f.runtime, 'b', true)).toMatchObject({
    reason: 'throttled',
    retryAt,
  })
  expect(f.fetch).toHaveBeenCalledOnce()
  f.advance(1)
  expect(await rates(f.runtime, 'b', true)).toMatchObject({
    status: 'available',
  })
  expect(f.fetch).toHaveBeenCalledTimes(2)
})

it('keeps the local 3600-second deadline after a 100ms 429 and failed supervised marker extension', async () => {
  const f = fixture()
  const startedAt = f.runtime.now()
  const pending: Promise<unknown>[] = []
  let release: () => void = () => {}
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
  const put = f.runtime.cache.put
  const writes: number[] = []
  f.runtime.cache.put = async (key, value, options) => {
    if (key === attemptKey) {
      writes.push(f.runtime.now())
      if (writes.length === 2) throw new Error('KV extension failed')
    }
    await put(key, value, options)
  }
  f.fetch.mockImplementationOnce(async () => {
    f.advance(100)
    return new Response(null, {
      status: 429,
      headers: { 'Retry-After': '3600' },
    })
  })
  const retryAt = startedAt + 100 + 3_600_000
  const rates = createPublicRates()
  expect(await rates(f.runtime, 'a')).toEqual({
    status: 'unavailable',
    reason: 'provider-failed',
    retryAt,
  })
  expect(pending).toHaveLength(1)
  expect(f.runtime.sleep).toHaveBeenCalledWith(900)
  const marker = f.values.get(attemptKey)
  expect(JSON.parse(marker ?? '{}')).toEqual({
    attemptedAt: startedAt,
    retryAt: startedAt + 300_000,
  })
  f.advance(899)
  expect(await rates(f.runtime, 'b', true)).toMatchObject({
    reason: 'throttled',
    retryAt,
  })
  expect(writes).toEqual([startedAt])
  f.advance(1)
  release()
  await Promise.all(pending)
  expect(writes).toEqual([startedAt, startedAt + 1000])
  expect(f.values.get(attemptKey)).toBe(marker)
  f.advance(startedAt + 300_000 - f.runtime.now())
  f.values.delete(attemptKey) // Simulate expiration of the only durable marker.
  expect(await rates(f.runtime, 'b', true)).toMatchObject({
    reason: 'throttled',
    retryAt,
  })
  f.advance(retryAt - f.runtime.now() - 1)
  expect(await rates(f.runtime, 'b', true)).toMatchObject({
    reason: 'throttled',
    retryAt,
  })
  expect(f.fetch).toHaveBeenCalledOnce()
  f.advance(1)
  expect(await rates(f.runtime, 'b', true)).toMatchObject({
    status: 'available',
  })
  expect(f.fetch).toHaveBeenCalledTimes(2)
})

it('shares a deferred rejected attempt and clears the flight for a later successful retry', async () => {
  const f = fixture()
  let reject: (reason: Error) => void = () => {}
  let started: () => void = () => {}
  const fetching = new Promise<void>((resolve) => {
    started = resolve
  })
  f.fetch.mockImplementationOnce(
    async () =>
      new Promise<Response>((_resolve, fail) => {
        reject = fail
        started()
      }),
  )
  const rates = createPublicRates()
  const first = rates(f.runtime, 'a')
  await fetching
  const waiter = rates(f.runtime, 'b')
  expect(waiter).toBe(first)
  reject(new Error('connection reset'))
  const [a, b] = await Promise.all([first, waiter])
  expect(a).toEqual(b)
  expect(a).toMatchObject({ status: 'unavailable', reason: 'provider-failed' })
  expect(f.values.has(latestKey)).toBe(false)
  f.advance(300_000)
  expect(await rates(f.runtime, 'b')).toMatchObject({ status: 'available' })
  expect(f.fetch).toHaveBeenCalledTimes(2)
})

it('handles a same-key marker write collision between isolates without a second upstream attempt', async () => {
  const f = fixture()
  const put = f.runtime.cache.put
  const lastWrite = new Map<string, number>()
  const collisions = vi.fn()
  f.runtime.cache.put = async (key, value, options) => {
    const previous = lastWrite.get(key)
    if (previous !== undefined && f.runtime.now() - previous < 1000) {
      collisions(key)
      throw new Error('KV same-key write rate exceeded')
    }
    lastWrite.set(key, f.runtime.now())
    await put(key, value, options)
  }
  const first = createPublicRates()
  const second = createPublicRates()
  const results = await Promise.all([
    first(f.runtime, 'a'),
    second(f.runtime, 'b'),
  ])
  expect(results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ status: 'available' }),
      expect.objectContaining({
        status: 'unavailable',
        reason: 'cache-unavailable',
      }),
    ]),
  )
  expect(collisions).toHaveBeenCalledExactlyOnceWith(attemptKey)
  expect(f.fetch).toHaveBeenCalledOnce()
  f.advance(1000)
  expect(await second(f.runtime, 'b')).toMatchObject({ status: 'available' })
  expect(f.fetch).toHaveBeenCalledOnce()
})
