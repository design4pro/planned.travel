import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TransactionEnvelope } from '../transaction'
import { createRecoveryTransport, TRANSACTION_STORAGE_KEY } from '../recovery'

class TabStore implements Storage {
  values = new Map<string, string>()
  get length() {
    return this.values.size
  }
  clear() {
    this.values.clear()
  }
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}
const envelope = (id = 'a'.repeat(32)): TransactionEnvelope => [
  { event_id: id, sent_at: new Date().toISOString() },
  [
    [
      { type: 'transaction' },
      { type: 'transaction', event_id: id, transaction: 'synthetic' },
    ],
  ],
]
const disposals: Array<() => void> = []
afterEach(() => {
  disposals.splice(0).forEach((dispose) => dispose())
  vi.useRealTimers()
})
function fixture(
  storage: Storage | null = new TabStore(),
  scope: string | null = 'anonymous',
) {
  const drops = vi.fn()
  const sender =
    vi.fn<(_: string, body: string, signal: AbortSignal) => Promise<Response>>()
  const nativeFetch = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 204 }))
  const recovery = createRecoveryTransport(
    {
      url: 'https://ingest.example/api/1/envelope/?sentry_key=public',
      recordDroppedEvent: drops,
    },
    {
      storage,
      scope,
      project: 'project/release',
      send: sender,
      nativeFetch,
      leaving: () => false,
    },
  )
  disposals.push(recovery.dispose)
  return { storage, sender, nativeFetch, drops, recovery }
}

describe('bounded transaction recovery through the real SDK transport', () => {
  it('writes before asynchronous dispatch and resolves only from an ingestion response', async () => {
    const f = fixture()
    let respond!: (response: Response) => void
    f.sender.mockImplementation(
      () =>
        new Promise((resolve) => {
          respond = resolve
        }),
    )
    const pending = f.recovery.transport.send(envelope())
    expect(f.storage?.getItem(TRANSACTION_STORAGE_KEY)).toContain('synthetic')
    await Promise.resolve()
    expect(f.sender).toHaveBeenCalledTimes(1)
    let settled = false
    void Promise.resolve(pending).then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    respond(new Response(null, { status: 204 }))
    expect((await pending).statusCode).toBe(204)
    expect(f.storage?.getItem(TRANSACTION_STORAGE_KEY)).toBeNull()
    expect(f.nativeFetch).not.toHaveBeenCalled()
  })
  it('recovers the original event after a document ends before sender readiness', async () => {
    const store = new TabStore()
    const first = fixture(store)
    first.sender.mockImplementation(() => new Promise(() => {}))
    const pending = first.recovery.transport.send(envelope())
    void Promise.resolve(pending).catch(() => {})
    first.recovery.dispose({ preserve: true })
    const next = fixture(store)
    next.sender.mockResolvedValue(new Response(null, { status: 204 }))
    await next.recovery.recover()
    expect(next.sender).toHaveBeenCalledTimes(1)
    expect(next.sender.mock.calls[0][1]).toContain('a'.repeat(32))
    expect(store.getItem(TRANSACTION_STORAGE_KEY)).toBeNull()
  })
  it('discards prior scope and never coerces unknown authority into anonymous', async () => {
    const store = new TabStore()
    const prior = fixture(store, '1'.repeat(64))
    prior.sender.mockImplementation(() => new Promise(() => {}))
    void Promise.resolve(prior.recovery.transport.send(envelope())).catch(
      () => {},
    )
    prior.recovery.dispose({ preserve: true })
    const next = fixture(store, null)
    await next.recovery.recover()
    expect(next.sender).not.toHaveBeenCalled()
    expect(store.getItem(TRANSACTION_STORAGE_KEY)).toBeNull()
  })
  it.each([204, 413, 429, 503])(
    'preserves actual status %s, removes acknowledged bodies and does not HTTP-retry',
    async (status) => {
      const f = fixture()
      f.sender.mockResolvedValue(
        new Response(null, {
          status,
          headers: {
            'X-Sentry-Rate-Limits': '60:transaction:organization',
            'Retry-After': '60',
          },
        }),
      )
      const response = await f.recovery.transport.send(envelope())
      expect(response.statusCode).toBe(status)
      expect(response.headers?.['retry-after']).toBe('60')
      const retained = f.storage?.getItem(TRANSACTION_STORAGE_KEY) ?? ''
      expect(retained).not.toContain('synthetic')
      expect(retained).not.toContain('a'.repeat(32))
      await f.recovery.recover()
      expect(f.sender).toHaveBeenCalledTimes(1)
    },
  )
  it('falls back once before dispatch when storage is denied and preserves binary native bytes', async () => {
    const f = fixture(null)
    await f.recovery.transport.send(envelope())
    expect(f.nativeFetch).toHaveBeenCalledTimes(1)
    expect(f.sender).not.toHaveBeenCalled()
    expect(f.recovery.counts.recovery_unavailable).toBe(1)
    const binary = fixture()
    await binary.recovery.transport.send([
      { event_id: 'b'.repeat(32), sent_at: new Date().toISOString() },
      [
        [
          { type: 'attachment', length: 3, filename: 'synthetic.bin' },
          new Uint8Array([1, 2, 3]),
        ],
      ],
    ])
    expect(binary.nativeFetch).toHaveBeenCalledTimes(1)
    expect(binary.nativeFetch.mock.calls[0][1]?.body).toBeInstanceOf(Uint8Array)
    expect(binary.storage?.getItem(TRANSACTION_STORAGE_KEY)).toBeNull()
  })
  it('never acknowledges persisted admission as a successful SDK flush', async () => {
    vi.useFakeTimers()
    const f = fixture()
    f.sender.mockImplementation(() => new Promise(() => {}))
    void Promise.resolve(f.recovery.transport.send(envelope())).catch(() => {})
    const flushed = f.recovery.transport.flush(20)
    await vi.advanceTimersByTimeAsync(20)
    expect(await flushed).toBe(false)
  })
})

describe('failure and admission boundaries', () => {
  it('keeps the SDK40-entry buffer,41st overflow and subsequent drain', async () => {
    const f = fixture()
    const replies: Array<(response: Response) => void> = []
    f.sender.mockImplementation(
      () => new Promise((resolve) => replies.push(resolve)),
    )
    const sends = Array.from({ length: 40 }, (_, i) =>
      f.recovery.transport.send(envelope(i.toString(16).padStart(32, '0'))),
    )
    expect(await f.recovery.transport.send(envelope('f'.repeat(32)))).toEqual(
      {},
    )
    expect(f.drops).toHaveBeenCalledWith('queue_overflow', 'transaction')
    await Promise.resolve()
    expect(f.sender).toHaveBeenCalledTimes(40)
    replies.forEach((reply) => reply(new Response(null, { status: 204 })))
    await Promise.all(sends)
    expect(await f.recovery.transport.flush(20)).toBe(true)
    f.sender.mockResolvedValue(new Response(null, { status: 204 }))
    expect(
      (await f.recovery.transport.send(envelope('e'.repeat(32)))).statusCode,
    ).toBe(204)
  })
  it('persists known transaction backoff across a replacement document without retaining headers', async () => {
    const store = new TabStore()
    const first = fixture(store)
    first.sender.mockResolvedValue(
      new Response(null, { status: 429, headers: { 'Retry-After': '60' } }),
    )
    await first.recovery.transport.send(envelope())
    expect(
      await first.recovery.transport.send(envelope('b'.repeat(32))),
    ).toEqual({})
    expect(first.drops).toHaveBeenCalledWith('ratelimit_backoff', 'transaction')
    const raw = store.getItem(TRANSACTION_STORAGE_KEY) ?? ''
    expect(raw).not.toContain('retry-after')
    expect(raw).not.toContain('synthetic')
    first.recovery.dispose({ preserve: true })
    const next = fixture(store)
    next.sender.mockResolvedValue(new Response(null, { status: 204 }))
    await next.recovery.recover()
    expect(next.sender).not.toHaveBeenCalled()
  })
  it('never sends an expired or attempt-exhausted transaction', async () => {
    vi.useFakeTimers()
    const store = new TabStore()
    const first = fixture(store)
    first.sender.mockImplementation(() => new Promise(() => {}))
    void Promise.resolve(first.recovery.transport.send(envelope())).catch(
      () => {},
    )
    first.recovery.dispose({ preserve: true })
    vi.setSystemTime(Date.now() + 30001)
    const next = fixture(store)
    await next.recovery.recover()
    expect(next.sender).not.toHaveBeenCalled()
    expect(store.getItem(TRANSACTION_STORAGE_KEY)).toBeNull()
  })
  it('cancels all owned requests before accepting a fresh scope and prevents late acknowledgement', async () => {
    const f = fixture()
    let reply!: (response: Response) => void
    f.sender.mockImplementation(
      () =>
        new Promise((resolve) => {
          reply = resolve
        }),
    )
    const pending = Promise.resolve(f.recovery.transport.send(envelope()))
    await Promise.resolve()
    const failure = expect(pending).rejects.toMatchObject({
      name: 'AbortError',
    })
    f.recovery.retire()
    await failure
    expect(f.sender.mock.calls[0][2].aborted).toBe(true)
    expect(f.storage?.getItem(TRANSACTION_STORAGE_KEY)).toBeNull()
    reply(new Response(null, { status: 204 }))
    await Promise.resolve()
    expect(f.recovery.counts.response).toBeUndefined()
  })
  it('does not resend a known HTTP response when removal fails', async () => {
    const store = new TabStore()
    const f = fixture(store)
    f.sender.mockImplementation(async () => {
      vi.spyOn(store, 'setItem').mockImplementation(() => {
        throw new Error('denied')
      })
      vi.spyOn(store, 'removeItem').mockImplementation(() => {
        throw new Error('denied')
      })
      return new Response(null, { status: 503 })
    })
    expect((await f.recovery.transport.send(envelope())).statusCode).toBe(503)
    await f.recovery.recover()
    expect(f.sender).toHaveBeenCalledTimes(1)
    expect(f.recovery.counts.cleanup_failed).toBeGreaterThan(0)
  })
  it('does not allocate a transaction over the UTF-8 bound and retains at most2MiB', async () => {
    const f = fixture()
    f.sender.mockImplementation(() => new Promise(() => {}))
    for (let i = 0; i < 3; i++) {
      const item = envelope(i.toString(16).padStart(32, '0'))
      const payload = item[1][0][1] as { extra?: Record<string, unknown> }
      payload.extra = { padding: 'x'.repeat(450000) }
      void Promise.resolve(f.recovery.transport.send(item)).catch(() => {})
    }
    await Promise.resolve()
    expect(f.sender).toHaveBeenCalledTimes(2)
    expect(f.nativeFetch).toHaveBeenCalledTimes(1)
    expect(
      (f.storage?.getItem(TRANSACTION_STORAGE_KEY)?.length ?? 0) * 2,
    ).toBeLessThanOrEqual(2 * 1024 * 1024)
    const unicode = envelope('c'.repeat(32))
    ;(unicode[1][0][1] as { extra?: Record<string, unknown> }).extra = {
      padding: '🙂'.repeat(150000),
    }
    await f.recovery.transport.send(unicode)
    expect(f.nativeFetch).toHaveBeenCalledTimes(2)
  })
  it('re-scrubs retained transactions before sending and never persists credential strings', async () => {
    const f = fixture()
    f.sender.mockResolvedValue(new Response(null, { status: 204 }))
    const value = envelope()
    const payload = value[1][0][1] as {
      request?: { url: string; headers: Record<string, string> }
    }
    payload.request = {
      url: 'https://app.example/join/PrivateSecret?token=PrivateSecret',
      headers: { Authorization: 'PrivateSecret', Cookie: 'PrivateSecret' },
    }
    const sent = f.recovery.transport.send(value)
    expect(f.storage?.getItem(TRANSACTION_STORAGE_KEY)).not.toContain(
      'PrivateSecret',
    )
    await sent
    expect(f.sender.mock.calls[0][1]).not.toContain('PrivateSecret')
  })
})

it('does not invent backoff for413 when the installed SDK intentionally skips its headers', async () => {
  const f = fixture()
  f.sender
    .mockResolvedValueOnce(
      new Response(null, { status: 413, headers: { 'Retry-After': '60' } }),
    )
    .mockResolvedValue(new Response(null, { status: 204 }))
  expect((await f.recovery.transport.send(envelope())).statusCode).toBe(413)
  expect(
    (await f.recovery.transport.send(envelope('b'.repeat(32)))).statusCode,
  ).toBe(204)
  expect(f.sender).toHaveBeenCalledTimes(2)
})
it('cleans expired bodies even if an interrupted navigation leaves the document marked departing', async () => {
  vi.useFakeTimers()
  const store = new TabStore()
  const drops = vi.fn()
  const send =
    vi.fn<(_: string, body: string, signal: AbortSignal) => Promise<Response>>()
  const recovery = createRecoveryTransport(
    {
      url: 'https://ingest.example/api/1/envelope/?sentry_key=public',
      recordDroppedEvent: drops,
    },
    {
      storage: store,
      scope: 'anonymous',
      project: 'project/release',
      send,
      nativeFetch: fetch,
      leaving: () => true,
    },
  )
  disposals.push(recovery.dispose)
  void Promise.resolve(recovery.transport.send(envelope())).catch(() => {})
  expect(store.getItem(TRANSACTION_STORAGE_KEY)).toContain('synthetic')
  await vi.advanceTimersByTimeAsync(30001)
  await recovery.recover()
  expect(store.getItem(TRANSACTION_STORAGE_KEY)).toBeNull()
  expect(send).not.toHaveBeenCalled()
})

it('discards a durably exhausted record without issuing a fourth attempt', async () => {
  const storage = new TabStore()
  const first = fixture(storage)
  void Promise.resolve(first.recovery.transport.send(envelope())).catch(
    () => {},
  )
  const raw = JSON.parse(storage.getItem(TRANSACTION_STORAGE_KEY)!)
  first.recovery.dispose({ preserve: true })
  raw.entries[0].attempts = 3
  raw.entries[0].nextAttemptAt = Date.now()
  storage.setItem(TRANSACTION_STORAGE_KEY, JSON.stringify(raw))
  const next = fixture(storage)
  await next.recovery.recover()
  expect(next.sender).not.toHaveBeenCalled()
  expect(next.nativeFetch).not.toHaveBeenCalled()
  expect(next.recovery.counts.attempts_exhausted).toBe(1)
  expect(storage.getItem(TRANSACTION_STORAGE_KEY)).toBeNull()
})

it('never dispatches or falls back after the attempt counter cannot be persisted', async () => {
  const storage = new TabStore()
  const f = fixture(storage)
  const pending = Promise.resolve(f.recovery.transport.send(envelope()))
  const failed = expect(pending).rejects.toThrow(
    'Transaction attempt unavailable',
  )
  vi.spyOn(storage, 'setItem').mockImplementation(() => {
    throw new Error('quota')
  })
  await failed
  expect(f.recovery.counts.attempt_persist_failed).toBe(1)
  expect(f.sender).not.toHaveBeenCalled()
  expect(f.nativeFetch).not.toHaveBeenCalled()
})
