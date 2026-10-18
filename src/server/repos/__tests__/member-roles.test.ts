/**
 * Who may grant which role (#995): the ceiling `changeMemberRole` holds, in the repository and not
 * only in the control that offers it.
 *
 * Every refusal arm reads the stored role back, not only the error: "it said no" and "it wrote
 * nothing" are different claims, and the second is the one that matters for a role.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { ForbiddenError, RepositoryError } from '../context'
import { assignableRoles, changeMemberRole, listMembers } from '../members'
import { captureError, createHarness } from './harness'
import type { OrganizationRole } from '../context'
import type { SeededTenant } from './harness'

let tenant: SeededTenant

beforeEach(async () => {
  const harness = await createHarness()
  tenant = await harness.seedTenant('roles')
})

/** A caller of `role`, and the member row of a target who currently holds `targetRole`. */
async function seat(
  callerRole: OrganizationRole,
  targetRole: OrganizationRole,
): Promise<{
  readonly callerScope: ReturnType<SeededTenant['scopeFor']>
  readonly targetMemberId: string
}> {
  const callerUserId =
    callerRole === 'owner'
      ? tenant.ownerUserId
      : await tenant.addUser('Caller', callerRole)
  const targetUserId = await tenant.addUser('Target', targetRole)
  const members = await listMembers(tenant.scope)
  const target = members.find((row) => row.userId === targetUserId)
  if (target === undefined) throw new Error('target member was not seeded')
  return {
    callerScope: tenant.scopeFor(callerUserId, callerRole),
    targetMemberId: target.id,
  }
}

async function storedRole(memberId: string): Promise<string | undefined> {
  return (await listMembers(tenant.scope)).find((row) => row.id === memberId)
    ?.role
}

describe('assignableRoles', () => {
  it.each<[OrganizationRole, OrganizationRole, Array<OrganizationRole>]>([
    ['member', 'member', []],
    ['member', 'admin', []],
    ['admin', 'member', ['admin', 'member']],
    ['admin', 'admin', ['admin', 'member']],
    ['admin', 'owner', []],
    ['owner', 'member', ['owner', 'admin', 'member']],
    ['owner', 'admin', ['owner', 'admin', 'member']],
    ['owner', 'owner', ['owner', 'admin', 'member']],
  ])('a %s caller on a %s row may grant %j', (caller, current, granted) => {
    expect(assignableRoles(caller, current)).toEqual(granted)
  })

  it('treats a comma-joined stored role that includes owner as an owner row', () => {
    expect(assignableRoles('admin', 'admin,owner')).toEqual([])
  })
})

describe('changeMemberRole', () => {
  it('refuses a member caller before the write', async () => {
    const { callerScope, targetMemberId } = await seat('member', 'member')

    const refusal = await captureError(() =>
      changeMemberRole(callerScope, targetMemberId, 'admin'),
    )

    expect(refusal).toBeInstanceOf(ForbiddenError)
    expect(await storedRole(targetMemberId)).toBe('member')
  })

  it('refuses an admin granting owner', async () => {
    const { callerScope, targetMemberId } = await seat('admin', 'member')

    const refusal = await captureError(() =>
      changeMemberRole(callerScope, targetMemberId, 'owner'),
    )

    expect(refusal).toBeInstanceOf(ForbiddenError)
    expect(await storedRole(targetMemberId)).toBe('member')
  })

  it('refuses an admin changing the role of an owner row', async () => {
    const { callerScope, targetMemberId } = await seat('admin', 'owner')

    const refusal = await captureError(() =>
      changeMemberRole(callerScope, targetMemberId, 'member'),
    )

    expect(refusal).toBeInstanceOf(ForbiddenError)
    expect(await storedRole(targetMemberId)).toBe('owner')
  })

  it('lets an admin move a member and another admin between admin and member', async () => {
    const asMember = await seat('admin', 'member')
    const promoted = await changeMemberRole(
      asMember.callerScope,
      asMember.targetMemberId,
      'admin',
    )
    expect(promoted.previousRole).toBe('member')
    expect(promoted.member.role).toBe('admin')

    const demoted = await changeMemberRole(
      asMember.callerScope,
      asMember.targetMemberId,
      'member',
    )
    expect(demoted.previousRole).toBe('admin')
    expect(await storedRole(asMember.targetMemberId)).toBe('member')
  })

  it.each<OrganizationRole>(['owner', 'admin', 'member'])(
    'lets an owner set a member to %s',
    async (role) => {
      const { callerScope, targetMemberId } = await seat('owner', 'member')

      const change = await changeMemberRole(callerScope, targetMemberId, role)

      expect(change.member.role).toBe(role)
      expect(await storedRole(targetMemberId)).toBe(role)
    },
  )

  it('refuses to demote the only owner and leaves the role stored', async () => {
    const owner = (await listMembers(tenant.scope)).find(
      (row) => row.userId === tenant.ownerUserId,
    )
    if (owner === undefined) throw new Error('owner member was not seeded')

    const refusal = await captureError(() =>
      changeMemberRole(tenant.scope, owner.id, 'admin'),
    )

    expect(refusal).toBeInstanceOf(RepositoryError)
    expect((refusal as RepositoryError).code).toBe('LAST_OWNER')
    expect(await storedRole(owner.id)).toBe('owner')
  })

  it('lets an owner demote an owner while another remains', async () => {
    const { callerScope, targetMemberId } = await seat('owner', 'owner')

    await changeMemberRole(callerScope, targetMemberId, 'member')

    expect(await storedRole(targetMemberId)).toBe('member')
  })

  // The count and the write are separate statements, so two owners demoting each other at the same
  // moment each see the other as a remaining owner. Whatever order they land in, the workspace must
  // still have an owner at the end.
  it('never leaves the workspace without an owner when two owners demote each other at once', async () => {
    const second = await tenant.addUser('Second owner', 'owner')
    const members = await listMembers(tenant.scope)
    const idOf = (userId: string): string => {
      const row = members.find((candidate) => candidate.userId === userId)
      if (row === undefined) throw new Error('member was not seeded')
      return row.id
    }
    const first = tenant.ownerUserId
    const firstScope = tenant.scopeFor(first, 'owner')
    const secondScope = tenant.scopeFor(second, 'owner')

    await Promise.allSettled([
      changeMemberRole(firstScope, idOf(second), 'member'),
      changeMemberRole(secondScope, idOf(first), 'member'),
    ])

    const owners = (await listMembers(tenant.scope)).filter(
      (row) => row.role === 'owner',
    )
    expect(owners.length).toBeGreaterThan(0)
  })
})
