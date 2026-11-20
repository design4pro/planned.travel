import { expect, it, vi } from 'vitest'
import { verifyStepUp } from '../step-up'

it('requires and verifies a password whenever the account has one', async () => {
  const verify = vi.fn(async () => false)
  const ports = {
    passwordHash: 'hash',
    verify,
    createdAt: 0,
    freshAge: 10,
    now: 50_000,
  }
  expect(await verifyStepUp(ports)).toBe('password-required')
  expect(verify).not.toHaveBeenCalled()
  expect(await verifyStepUp(ports, 'wrong')).toBe('invalid-password')
  verify.mockResolvedValue(true)
  expect(await verifyStepUp(ports, 'right')).toBeNull()
})
it('uses strict freshness for passwordless accounts, failing closed on unreadable dates', async () => {
  const ports = {
    passwordHash: null,
    verify: vi.fn(),
    createdAt: 0,
    freshAge: 10,
    now: 10_000,
  }
  expect(await verifyStepUp(ports)).toBe('session-not-fresh')
  expect(await verifyStepUp({ ...ports, now: 9_999 })).toBeNull()
  expect(await verifyStepUp({ ...ports, createdAt: NaN })).toBe(
    'session-not-fresh',
  )
  expect(await verifyStepUp({ ...ports, freshAge: 0 })).toBeNull()
  expect(ports.verify).not.toHaveBeenCalled()
})
