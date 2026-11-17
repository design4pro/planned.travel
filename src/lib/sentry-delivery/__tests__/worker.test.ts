import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDeliveryWorker } from '../worker-protocol'

const body = [
  JSON.stringify({
    event_id: 'a'.repeat(32),
    sent_at: new Date().toISOString(),
  }),
  '{"type":"transaction"}',
  '{"type":"transaction","transaction":"synthetic"}',
].join('\n')
const id = '00000000-0000-4000-8000-000000000001'
const url =
  'https://ingest.example/api/1/envelope/?sentry_key=public&sentry_version=7'
afterEach(() => vi.useRealTimers())
function fixture() {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 204 }))
  const messages: unknown[] = []
  const port = {
    postMessage: (data: unknown) => messages.push(data),
    close: vi.fn(),
  }
  const waitUntil = vi.fn()
  const source = { id: 'page-a', url: 'https://app.example/pricing' }
  const receive = createDeliveryWorker({
    origin: 'https://app.example',
    dsn: 'https://public@ingest.example/1',
    fetch: request,
    client: async () => source,
  })
  const event = (data: unknown, owner = source) => ({
    data,
    source: owner,
    ports: [port],
    waitUntil,
  })
  return { request, messages, port, waitUntil, source, receive, event }
}
describe('the constrained transaction sender', () => {
  it('uses event lifetime ownership and returns the actual response headers', async () => {
    const f = fixture()
    f.request.mockResolvedValue(
      new Response(null, {
        status: 429,
        headers: {
          'Retry-After': '60',
          'X-Sentry-Rate-Limits': '60:transaction:organization',
        },
      }),
    )
    f.receive(f.event({ type: 'send', id, url, body }))
    expect(f.waitUntil).toHaveBeenCalledTimes(1)
    await f.waitUntil.mock.calls[0][0]
    expect(f.request).toHaveBeenCalledTimes(1)
    expect(f.request.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      keepalive: false,
      body,
    })
    expect(f.messages).toEqual([
      {
        ok: true,
        status: 429,
        rateLimits: '60:transaction:organization',
        retryAfter: '60',
      },
    ])
    expect(f.port.close).toHaveBeenCalledTimes(1)
  })
  it.each([
    {
      ...{ type: 'send', id, url, body },
      url: 'https://other.example/api/1/envelope/?sentry_key=public&sentry_version=7',
    },
    { type: 'send', id, url: url.replace('key=public', 'key=other'), body },
    { type: 'send', id, url, body, headers: { Authorization: 'secret' } },
    { type: 'send', id, url, body, credentials: 'include' },
    { type: 'send', id, url, body: '{"type":"not-a-transaction"}' },
  ])(
    'refuses destinations and request fields outside its capability',
    async (data) => {
      const f = fixture()
      f.receive(f.event(data))
      await Promise.all(f.waitUntil.mock.calls.map((call) => call[0]))
      expect(f.request).not.toHaveBeenCalled()
      expect(f.messages).toEqual([{ ok: false }])
    },
  )
  it('does not accept a foreign or disappeared source client', async () => {
    const f = fixture()
    f.receive(
      f.event(
        { type: 'send', id, url, body },
        { id: 'foreign', url: 'https://other.example/' },
      ),
    )
    await Promise.all(f.waitUntil.mock.calls.map((call) => call[0]))
    expect(f.request).not.toHaveBeenCalled()
  })
  it('binds cancellation to source client and releases a request on its deadline', async () => {
    vi.useFakeTimers()
    const f = fixture()
    let signal: AbortSignal | undefined
    f.request.mockImplementation(
      (_, init) =>
        new Promise((resolve, reject) => {
          void resolve
          signal = init?.signal ?? undefined
          signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        }),
    )
    f.receive(f.event({ type: 'send', id, url, body }))
    await vi.advanceTimersByTimeAsync(0)
    expect(signal?.aborted).toBe(false)
    f.receive({
      ...f.event(
        { type: 'cancel', id },
        { id: 'page-b', url: 'https://app.example/' },
      ),
      ports: [],
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(signal?.aborted).toBe(false)
    await vi.advanceTimersByTimeAsync(10000)
    await f.waitUntil.mock.calls[0][0]
    expect(signal?.aborted).toBe(true)
    expect(f.messages).toEqual([{ ok: false }])
    expect(vi.getTimerCount()).toBe(0)
  })
})

it('honors cancellation while source-client verification is still pending', async () => {
  let resolveClient!: (client: { id: string; url: string }) => void
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 204 }))
  const source = { id: 'page-a', url: 'https://app.example/' }
  const receive = createDeliveryWorker({
    origin: 'https://app.example',
    dsn: 'https://public@ingest.example/1',
    fetch: request,
    client: () =>
      new Promise((resolve) => {
        resolveClient = resolve
      }),
  })
  const messages: unknown[] = []
  const work: Promise<unknown>[] = []
  receive({
    data: { type: 'send', id, url, body },
    source,
    ports: [{ postMessage: (value) => messages.push(value), close: () => {} }],
    waitUntil: (promise) => work.push(promise),
  })
  receive({
    data: { type: 'cancel', id },
    source,
    ports: [],
    waitUntil: (promise) => work.push(promise),
  })
  resolveClient(source)
  await Promise.all(work)
  expect(request).not.toHaveBeenCalled()
  expect(messages).toEqual([{ ok: false }])
})

it('bounds a source-client lookup that never resolves and releases the owned request', async () => {
  vi.useFakeTimers()
  const request = vi.fn<typeof fetch>()
  const source = { id: 'page-a', url: 'https://app.example/' }
  const receive = createDeliveryWorker({
    origin: 'https://app.example',
    dsn: 'https://public@ingest.example/1',
    fetch: request,
    client: () => new Promise(() => {}),
  })
  const messages: unknown[] = []
  const work: Promise<unknown>[] = []
  receive({
    data: { type: 'send', id, url, body },
    source,
    ports: [{ postMessage: (value) => messages.push(value), close: () => {} }],
    waitUntil: (promise) => work.push(promise),
  })
  await vi.advanceTimersByTimeAsync(10000)
  await Promise.all(work)
  expect(request).not.toHaveBeenCalled()
  expect(messages).toEqual([{ ok: false }])
  expect(vi.getTimerCount()).toBe(0)
})
