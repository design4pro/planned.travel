import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  authRequestFailure,
  commitFactorOperation,
  factorOperationStatus,
  registerFactorOperation,
} from '../client'

afterEach(() => vi.unstubAllGlobals())
const registration = {
  id: 'd9a32f18-b136-4a73-a284-72020b0989c5',
  intent: 'b606d24c-36ea-4e7f-9b26-0c40cd3052ae',
  operation: 'disable' as const,
}
describe('factor management client boundary', () => {
  it('retains the supplied registration intent and makes no destructive request on failure', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', fetch)
    await expect(
      registerFactorOperation('disable', registration.intent),
    ).rejects.toThrow('offline')
    expect(fetch).toHaveBeenCalledOnce()
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({
      intent: registration.intent,
      operation: 'disable',
    })
    expect(fetch.mock.calls[0][1].credentials).toBe('include')
  })
  it('rejects malformed success instead of claiming the factor was disabled', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(Response.json({ status: 'committed' }))
    vi.stubGlobal('fetch', fetch)
    await expect(
      commitFactorOperation(registration, {
        password: 'fixture-password',
        proof: { kind: 'totp', code: '123456' },
      }),
    ).rejects.toThrow()
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('strips even unexpected backup material from read-only recovery', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          status: 'committed',
          enabled: true,
          operation: 'backup',
          cleanupPending: false,
          backupCodes: Array.from({ length: 10 }, () => 'fixture-code'),
          token: 'fixture-token',
        }),
      ),
    )
    const value = await factorOperationStatus(registration.id)
    expect(Object.keys(value).sort()).toEqual([
      'cleanupPending',
      'enabled',
      'operation',
      'status',
    ])
  })
  it('carries the server retry deadline without retrying the destructive operation', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { code: 'ACCOUNT_TEMPORARILY_LOCKED' },
          { status: 429, headers: { 'retry-after': '23' } },
        ),
      )
    vi.stubGlobal('fetch', fetch)
    const started = Date.now()
    const error = await commitFactorOperation(registration, {
      password: 'fixture-password',
      proof: { kind: 'backup', code: 'fixture-code' },
    }).catch((cause: unknown) => authRequestFailure(cause))
    expect(error).toMatchObject({
      status: 429,
      code: 'ACCOUNT_TEMPORARILY_LOCKED',
    })
    if (!('retryAt' in error)) throw new Error('Missing deadline')
    expect(error.retryAt).toBeGreaterThanOrEqual(started + 23000)
    expect(fetch).toHaveBeenCalledOnce()
  })
})
