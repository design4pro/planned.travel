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
