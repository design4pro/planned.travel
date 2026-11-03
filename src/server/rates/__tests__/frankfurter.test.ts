import { expect, it, vi } from 'vitest'

import { fetchPublicSnapshot, validSnapshot } from '../frankfurter'

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
