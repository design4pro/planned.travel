import { expect, it, vi } from 'vitest'

import {
  fetchPublicSnapshot,
  PublicProviderError,
  validSnapshot,
} from '../frankfurter'

const now = () => Date.parse('2026-11-03T18:00:00Z')
const eur = { date: '2026-11-03', base: 'EUR', quote: 'EUR', rate: 1 }
const usd = { ...eur, quote: 'USD', rate: 1.25 }
it.each(
  [
    [],
    [usd],
    [{ ...eur, rate: 0 }],
    [{ ...eur, rate: 2 }],
    [eur, eur],
    [eur, { ...usd, date: '2026-11-02' }],
    [eur, { ...usd, date: '2026-11-04' }],
    [{ ...eur, date: '2026-02-30' }],
    [eur, { ...usd, base: 'USD' }],
    [eur, { ...usd, rate: -1 }],
    [eur, { ...usd, rate: 1e8 }],
    [eur, { ...usd, rate: 1e-8 }],
    [eur, { ...usd, rate: '1.25' }],
    Array.from({ length: 65 }, () => eur),
  ].map((rows) => ({ rows })),
)(
  'rejects invalid public data without a partial rate result (%#)',
  async ({ rows }) => {
    await expect(
      fetchPublicSnapshot(async () => Response.json(rows), now),
    ).rejects.toThrow()
  },
)
it('ignores additive fields and unreviewed codes while refusing redirects', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json([eur, { ...usd, added: 'ok' }, { ...usd, quote: 'AAA' }]),
  )
  expect((await fetchPublicSnapshot(fetch, now)).rates).toEqual({
    EUR: 1,
    USD: 1.25,
  })
  expect(fetch.mock.calls[0]?.[1]).toMatchObject({
    redirect: 'error',
    signal: expect.any(AbortSignal),
  })
})
it('bounds streamed bytes before buffering the complete response', async () => {
  let cancelled = false
  const body = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(65537))
    },
    cancel() {
      cancelled = true
    },
  })
  await expect(
    fetchPublicSnapshot(async () => new Response(body), now),
  ).rejects.toThrow()
  expect(cancelled).toBe(true)
})
it('validates cache provenance, bounds and timestamps', () => {
  const value = {
    version: 1,
    provider: 'frankfurter-ecb',
    source: 'ECB',
    base: 'EUR',
    effectiveOn: '2026-11-03',
    fetchedAt: now(),
    rates: { EUR: 1, USD: 1.25 },
  }
  expect(validSnapshot(value, now())).toEqual(value)
  for (const patch of [
    { source: 'private' },
    { effectiveOn: '2026-11-04' },
    { fetchedAt: now() + 1 },
    { rates: { EUR: 1, USD: Infinity } },
  ])
    expect(() => validSnapshot({ ...value, ...patch }, now())).toThrow()
})

it('rejects malformed JSON even when the provider returns 200', async () => {
  await expect(
    fetchPublicSnapshot(async () => new Response('[{"date":'), now),
  ).rejects.toBeInstanceOf(SyntaxError)
})

it.each([302, 307, 500, 503])(
  'rejects HTTP %s and cancels its body without following or retrying',
  async (status) => {
    const cancel = vi.fn()
    const fetch = vi.fn<typeof globalThis.fetch>(
      async () =>
        new Response(new ReadableStream({ cancel }), {
          status,
          headers: { Location: 'https://untrusted.example/rates' },
        }),
    )
    await expect(fetchPublicSnapshot(fetch, now)).rejects.toBeInstanceOf(
      PublicProviderError,
    )
    expect(cancel).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch.mock.calls[0]?.[1]?.redirect).toBe('error')
  },
)

it('propagates a fetch redirect rejection without retrying', async () => {
  const error = new TypeError('fetch failed: unexpected redirect')
  const fetch = vi.fn<typeof globalThis.fetch>(async (_url, options) => {
    expect(options?.redirect).toBe('error')
    throw error
  })
  await expect(fetchPublicSnapshot(fetch, now)).rejects.toBe(error)
  expect(fetch).toHaveBeenCalledOnce()
})

it('aborts an unfinished fetch at five seconds without retrying', async () => {
  vi.useFakeTimers()
  // Native AbortSignal.timeout uses Node's real clock; drive that platform seam here.
  const timeout = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms) => {
    const controller = new AbortController()
    setTimeout(
      () => controller.abort(new DOMException('Timed out', 'TimeoutError')),
      ms,
    )
    return controller.signal
  })
  try {
    const fetch = vi.fn<typeof globalThis.fetch>(
      async (_url, options) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = options?.signal
          if (!signal) throw new Error('Missing abort signal')
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          })
        }),
    )
    const settled = vi.fn()
    const request = fetchPublicSnapshot(fetch, now)
    void request.then(settled, settled)
    const failure = expect(request).rejects.toMatchObject({
      name: 'TimeoutError',
    })
    await vi.advanceTimersByTimeAsync(4999)
    expect(settled).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    await failure
    expect(timeout).toHaveBeenCalledWith(5000)
    expect(fetch).toHaveBeenCalledOnce()
  } finally {
    timeout.mockRestore()
    vi.useRealTimers()
  }
})
