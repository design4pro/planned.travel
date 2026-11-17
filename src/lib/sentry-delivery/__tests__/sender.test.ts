import { afterEach, expect, it, vi } from 'vitest'
import { createWorkerSender } from '../sender'

afterEach(() => vi.unstubAllGlobals())
it('rejects invalid response headers without escaping the message callback', async () => {
  let receive: ((event: { data: unknown }) => void) | undefined
  const close = vi.fn()
  vi.stubGlobal(
    'MessageChannel',
    class {
      port1 = {
        close,
        set onmessage(value: typeof receive) {
          receive = value
        },
        onmessageerror: null,
      }
      port2 = { close }
    },
  )
  const worker = {
    state: 'activated',
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  const sender = createWorkerSender(
    {
      register: async () => ({
        active: worker,
        installing: null,
        waiting: null,
      }),
    },
    '/worker.js',
    'https://ingest.example/api/1/envelope/',
    'https://app.example',
  )
  await sender.ready()
  const response = sender.send('test', 'body', new AbortController().signal)
  const rejection = expect(response).rejects.toThrow(
    'Invalid transaction response headers',
  )
  expect(() =>
    receive?.({
      data: {
        ok: true,
        status: 204,
        rateLimits: 'invalid\r\nheader',
        retryAfter: null,
      },
    }),
  ).not.toThrow()
  await rejection
  expect(close).toHaveBeenCalledTimes(2)
})

it('never starts registration after departure and reports actual activation separately', async () => {
  let leaving = true
  const worker = {
    state: 'activated',
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  const register = vi.fn(async () => ({
    active: worker,
    installing: null,
    waiting: null,
  }))
  const sender = createWorkerSender(
    { register },
    '/worker.js',
    'https://ingest.example/api/1/envelope/',
    'https://app.example',
    () => !leaving,
  )
  expect(sender.activated()).toBe(false)
  await expect(sender.ready()).rejects.toThrow('registration deferred')
  expect(register).not.toHaveBeenCalled()
  leaving = false
  await sender.ready()
  expect(sender.activated()).toBe(true)
  leaving = true
  await sender.ready()
  expect(register).toHaveBeenCalledOnce()
})

it('bounds activation and cleans its listener without accepting a late worker', async () => {
  vi.useFakeTimers()
  const worker = {
    state: 'installing',
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  const sender = createWorkerSender(
    {
      register: async () => ({
        active: null,
        installing: worker,
        waiting: null,
      }),
    },
    '/worker.js',
    'https://ingest.example/api/1/envelope/',
    'https://app.example',
  )
  try {
    const pending = expect(sender.ready()).rejects.toThrow('activation ended')
    await vi.advanceTimersByTimeAsync(10001)
    await pending
    expect(worker.removeEventListener).toHaveBeenCalledOnce()
    worker.state = 'activated'
    expect(sender.activated()).toBe(false)
  } finally {
    vi.useRealTimers()
  }
})

it('retirement cancels activation and cannot cache a worker returned after cancellation', async () => {
  let resolveRegistration!: (
    value: Awaited<
      ReturnType<Parameters<typeof createWorkerSender>[0]['register']>
    >,
  ) => void
  const sender = createWorkerSender(
    {
      register: () =>
        new Promise((resolve) => {
          resolveRegistration = resolve
        }),
    },
    '/worker.js',
    'https://ingest.example/api/1/envelope/',
    'https://app.example',
  )
  const stopped = expect(sender.ready()).rejects.toThrow('activation ended')
  sender.cancelInitialization()
  await stopped
  resolveRegistration({
    active: {
      state: 'activated',
      postMessage: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
    installing: null,
    waiting: null,
  })
  await Promise.resolve()
  await Promise.resolve()
  expect(sender.activated()).toBe(false)
})

it('rechecks departure before retrying failed empty registration', async () => {
  let leaving = false
  const register = vi.fn().mockRejectedValue(new Error('startup failed'))
  const sender = createWorkerSender(
    { register },
    '/worker.js',
    'https://ingest.example/api/1/envelope/',
    'https://app.example',
    () => !leaving,
  )
  await expect(sender.ready()).rejects.toThrow('startup failed')
  leaving = true
  await expect(sender.ready()).rejects.toThrow('registration deferred')
  expect(register).toHaveBeenCalledOnce()
})
