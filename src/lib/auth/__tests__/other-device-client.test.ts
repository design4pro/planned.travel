import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  registerOtherDeviceRevocation,
  settleOtherDeviceRevocation,
} from '../client'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
describe('bounded account-security requests', () => {
  it('refuses timed-out registration without sending a destructive request', async () => {
    const controller = new AbortController()
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(controller.signal)
    const fetch = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('fixture timeout', 'TimeoutError')),
          )
        }),
    )
    vi.stubGlobal('fetch', fetch)
    const pending = registerOtherDeviceRevocation('fixture-intent')
    const refused = expect(pending).rejects.toThrow('fixture timeout')
    controller.abort()
    await refused
    expect(timeout).toHaveBeenCalledWith(15000)
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch.mock.calls[0][0]).toContain('/register-operation')
  })
  it.each(['fixture-intent', null])(
    'returns unknown on commit/status timeout without retry (%s)',
    async (intent) => {
      const controller = new AbortController()
      vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal)
      const fetch = vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('fixture timeout', 'TimeoutError')),
            )
          }),
      )
      vi.stubGlobal('fetch', fetch)
      const pending = settleOtherDeviceRevocation('fixture-id', intent)
      controller.abort()
      expect(await pending).toEqual({
        status: 'unknown',
        cleanupPending: false,
      })
      expect(fetch).toHaveBeenCalledTimes(1)
    },
  )
})
