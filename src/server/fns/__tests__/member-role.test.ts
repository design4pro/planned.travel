/**
 * Changing a member's role, at the seam that owns the rules: who is refused before anything is read,
 * what a refusal leaves behind, and the one audit entry a change writes (#995).
 *
 * Every refusal arm reads the stored role and the audit rows back, not only the returned reason:
 * "it said no" and "it wrote nothing" are different claims. The plain `changeRole` is driven rather
 * than the server function, for the reason `workspace.test.ts` gives.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MEMBER_ROLE_IMPERSONATED_KEY } from '#/lib/member-role-refusals'
import { AuthRequirementError } from '#/server/auth/tenant'
import { listAuditLog, listMembers } from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import { changeMemberRoleInput, changeRole } from '../member-role-writes'
import { isImpersonated } from '../workspace-writes'

import type { OrganizationRole } from '#/server/db/types'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

let harness: Harness
let tenant: SeededTenant

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('role-fn')
})

async function seat(
  callerRole: OrganizationRole,
  targetRole: OrganizationRole,
): Promise<{
  readonly scope: () => Promise<ReturnType<SeededTenant['scopeFor']>>
  readonly memberId: string
  readonly targetUserId: string
}> {
  const callerId =
    callerRole === 'owner'
      ? tenant.ownerUserId
      : await tenant.addUser('Caller', callerRole)
  const targetUserId = await tenant.addUser('Target', targetRole)
  const target = (await listMembers(tenant.scope)).find(
    (row) => row.userId === targetUserId,
  )
  if (target === undefined) throw new Error('target was not seeded')
  const scope = tenant.scopeFor(callerId, callerRole)
  return { scope: async () => scope, memberId: target.id, targetUserId }
}

async function roleOf(memberId: string): Promise<string | undefined> {
  return (await listMembers(tenant.scope)).find((row) => row.id === memberId)
    ?.role
}

async function entries() {
  const page = await listAuditLog(tenant.scope, {
    action: 'member.role_changed',
  })
  return page.items
}

describe('the input', () => {
  it('takes a member id and one role of the enum', () => {
    expect(
      changeMemberRoleInput.parse({ memberId: ' m1 ', role: 'admin' }),
    ).toEqual({ memberId: 'm1', role: 'admin' })
  })

  it.each(['owner,admin', 'admin,member', 'superuser', ''])(
    'rejects the role %j: never a comma-joined list',
    (role) => {
      expect(
        changeMemberRoleInput.safeParse({ memberId: 'm1', role }).success,
      ).toBe(false)
    },
  )

  it.each(['organizationId', 'userId', 'callerRole', 'callerMemberId'])(
    "rejects an extra %s: the caller is never the client's to name",
    (field) => {
      expect(
        changeMemberRoleInput.safeParse({
          memberId: 'm1',
          role: 'admin',
          [field]: 'forged',
        }).success,
      ).toBe(false)
    },
  )
})

describe('an ordinary owner session', () => {
  it('stores the role and writes one audit entry naming the member and both roles', async () => {
    const { scope, memberId, targetUserId } = await seat('owner', 'member')

    const result = await changeRole(
      { impersonated: false, scope },
      { memberId, role: 'owner' },
    )

    expect(result).toEqual({ ok: true, changed: true })
    expect(await roleOf(memberId)).toBe('owner')
    const rows = await entries()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'member.role_changed',
      entityType: 'member',
      entityId: memberId,
      actorUserId: tenant.ownerUserId,
      metadata: { targetUserId, from: 'member', to: 'owner' },
    })
  })

  it('writes no entry when the role is already the one asked for', async () => {
    const { scope, memberId } = await seat('owner', 'admin')

    const result = await changeRole(
      { impersonated: false, scope },
      { memberId, role: 'admin' },
    )

    expect(result).toEqual({ ok: true, changed: false })
    expect(await entries()).toHaveLength(0)
  })

  it('still succeeds when the audit write fails', async () => {
    const { scope, memberId } = await seat('owner', 'member')
    harness.sqlite.exec('drop table audit_log')

    const result = await changeRole(
      { impersonated: false, scope },
      { memberId, role: 'admin' },
    )

    expect(result).toEqual({ ok: true, changed: true })
    expect(await roleOf(memberId)).toBe('admin')
  })
})

describe('a refusal', () => {
  it.each<
    [string, OrganizationRole, OrganizationRole, OrganizationRole, string]
  >([
    ['a member caller', 'member', 'member', 'admin', 'not-permitted'],
    ['an admin granting owner', 'admin', 'member', 'owner', 'not-permitted'],
    [
      'an admin touching an owner row',
      'admin',
      'owner',
      'member',
      'not-permitted',
    ],
  ])(
    'for %s is returned, leaves the role and writes nothing',
    async (_name, caller, current, next, reason) => {
      const { scope, memberId } = await seat(caller, current)

      const result = await changeRole(
        { impersonated: false, scope },
        { memberId, role: next },
      )

      expect(result).toEqual({ ok: false, reason })
      expect(await roleOf(memberId)).toBe(current)
      expect(await entries()).toHaveLength(0)
    },
  )

  it('for demoting the only owner says last-owner and writes nothing', async () => {
    const owner = (await listMembers(tenant.scope)).find(
      (row) => row.userId === tenant.ownerUserId,
    )
    if (owner === undefined) throw new Error('owner was not seeded')

    const result = await changeRole(
      { impersonated: false, scope: async () => tenant.scope },
      { memberId: owner.id, role: 'member' },
    )

    expect(result).toEqual({ ok: false, reason: 'last-owner' })
    expect(await roleOf(owner.id)).toBe('owner')
    expect(await entries()).toHaveLength(0)
  })

  it('for a member of another workspace says not-found and leaves its role', async () => {
    const other = await harness.seedTenant('elsewhere')
    const foreign = (await listMembers(other.scope)).find(
      (row) => row.userId === other.ownerUserId,
    )
    if (foreign === undefined) throw new Error('foreign owner was not seeded')

    const result = await changeRole(
      { impersonated: false, scope: async () => tenant.scope },
      { memberId: foreign.id, role: 'member' },
    )

    expect(result).toEqual({ ok: false, reason: 'not-found' })
    expect(
      (await listMembers(other.scope)).find((row) => row.id === foreign.id)
        ?.role,
    ).toBe('owner')
  })
})

describe('an impersonated or missing session', () => {
  it('reads a missing session as impersonated, so it fails closed', () => {
    expect(isImpersonated(null)).toBe(true)
    expect(isImpersonated({ session: { impersonatedBy: 'operator' } })).toBe(
      true,
    )
    expect(isImpersonated({ session: { impersonatedBy: null } })).toBe(false)
  })

  it('throws before the scope is built, and changes and writes nothing', async () => {
    const { memberId } = await seat('owner', 'member')
    const scope = vi.fn(async () => tenant.scope)

    const refusal: unknown = await changeRole(
      { impersonated: true, scope },
      { memberId, role: 'owner' },
    ).catch((cause: unknown) => cause)

    expect(refusal).toBeInstanceOf(AuthRequirementError)
    expect(refusal).toMatchObject({
      reason: 'impersonated',
      status: 403,
      message: MEMBER_ROLE_IMPERSONATED_KEY,
    })
    expect(scope).not.toHaveBeenCalled()
    expect(await roleOf(memberId)).toBe('member')
    expect(await entries()).toHaveLength(0)
  })
})
