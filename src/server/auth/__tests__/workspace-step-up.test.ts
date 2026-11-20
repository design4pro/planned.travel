import { expect, it, vi } from 'vitest'
import { verifyWorkspaceStepUp } from '../workspace-step-up'
import { createKvSecondaryStorage } from '../secondary-storage'

it('limits password verification by user for 300 seconds and allows another window after expiry', async () => {
  const values = new Map<string, string>()
  const kv = {
    get: async (key: string, type: string) => {
      const raw = values.get(key) ?? null
      return type === 'json' && raw ? JSON.parse(raw) : raw
    },
    put: async (key: string, value: string) => {
      values.set(key, value)
    },
  } as unknown as KVNamespace
  const increment = createKvSecondaryStorage(kv).increment!
  const verify = vi.fn(async () => false)
  const ports = {
    userId: 'owner',
    passwordHash: 'hash',
    verify,
    createdAt: 0,
    freshAge: 10,
    now: 0,
    increment,
  }
  vi.useFakeTimers()
  try {
    vi.setSystemTime(0)
    expect(await verifyWorkspaceStepUp(ports)).toBe('password-required')
    for (let n = 0; n < 5; n++)
      expect(await verifyWorkspaceStepUp(ports, 'wrong')).toBe(
        'invalid-password',
      )
    expect(await verifyWorkspaceStepUp(ports, 'wrong')).toBe('rate-limited')
    expect(verify).toHaveBeenCalledTimes(5)
    expect(
      await verifyWorkspaceStepUp({ ...ports, userId: 'another' }, 'wrong'),
    ).toBe('invalid-password')
    vi.setSystemTime(300_000)
    expect(await verifyWorkspaceStepUp(ports, 'wrong')).toBe('invalid-password')
  } finally {
    vi.useRealTimers()
  }
})
