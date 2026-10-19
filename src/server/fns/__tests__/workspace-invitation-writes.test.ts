import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import {
  inviteToWorkspace,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  inviteWorkspaceInput,
} from '../workspace-invitation-writes'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

let h: Harness
let a: SeededTenant
beforeEach(async () => {
  h = await createHarness()
  a = await h.seedTenant('delivery')
  await subscribeTenant(a.scope, 'crew')
})
afterEach(() => h.close())
it('keeps a failed delivery recoverable by an explicit same-row resend and audits transitions', async () => {
  const send = vi
    .fn()
    .mockRejectedValueOnce(new Error('queue unavailable'))
    .mockResolvedValue(undefined)
  const audit = vi.fn().mockResolvedValue(undefined)
  const ports = {
    scope: a.scope,
    now: () => new Date('2026-10-19T12:00:00Z'),
    send,
    audit,
    baseUrl: 'https://planned.travel',
  }
  const first = await inviteToWorkspace(ports, {
    email: 'new@example.com',
    role: 'member',
  })
  expect(first).toMatchObject({ ok: true, delivered: false })
  if (!first.ok) throw new Error('expected persisted invitation')
  expect(send).toHaveBeenCalledTimes(1)
  expect(audit).toHaveBeenCalledWith(
    a.scope,
    expect.objectContaining({ action: 'member.invited' }),
  )
  const resent = await resendWorkspaceInvitation(ports, {
    invitationId: first.invitationId,
  })
  expect(resent).toEqual({
    ok: true,
    delivered: true,
    invitationId: first.invitationId,
  })
  expect(send).toHaveBeenLastCalledWith(
    expect.objectContaining({
      to: 'new@example.com',
      url: `https://planned.travel/accept-invitation/${first.invitationId}`,
      expiresInHours: 168,
    }),
  )
  await revokeWorkspaceInvitation(ports, { invitationId: first.invitationId })
  expect(
    await resendWorkspaceInvitation(ports, {
      invitationId: first.invitationId,
    }),
  ).toMatchObject({ ok: false, reason: 'not-found' })
  expect(send).toHaveBeenCalledTimes(2)
  expect(audit).toHaveBeenCalledTimes(3)
})
it('refuses client scope and expiry fields', () => {
  expect(
    inviteWorkspaceInput.safeParse({
      email: 'new@example.com',
      role: 'member',
      expiresAt: '2030-01-01',
    }).success,
  ).toBe(false)
  expect(
    inviteWorkspaceInput.safeParse({
      email: 'new@example.com',
      role: 'owner',
      organizationId: 'other',
    }).success,
  ).toBe(false)
})

it('does not email or audit a refusal, and contains audit failure after a real write', async () => {
  const send = vi.fn().mockResolvedValue(undefined)
  const audit = vi.fn().mockRejectedValue(new Error('audit offline'))
  const ports = {
    scope: a.scope,
    now: () => new Date(),
    send,
    audit,
    baseUrl: 'https://planned.travel',
  }
  expect(
    await inviteToWorkspace(ports, {
      email: 'new@example.com',
      role: 'member',
    }),
  ).toMatchObject({ ok: true, delivered: true })
  expect(
    await inviteToWorkspace(ports, {
      email: 'new@example.com',
      role: 'member',
    }),
  ).toEqual({ ok: false, reason: 'invitation-exists' })
  expect(send).toHaveBeenCalledTimes(1)
  expect(audit).toHaveBeenCalledTimes(1)
})
