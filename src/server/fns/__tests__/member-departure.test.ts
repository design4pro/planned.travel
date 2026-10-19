import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { authSchema } from '#/server/db/auth-schema'
import { guardMemberDeletion } from '#/server/auth/member-deletion'
import { departMember, memberDepartureInput } from '../member-departure-writes'
import type { DeparturePorts } from '../member-departure-writes'
import type { TenantScope } from '#/server/repos'
import { beforeEach, expect, it, vi } from 'vitest'
import { auditLogRepository } from '#/server/repos/audit'
import type { BatchStatement } from '#/server/repos/batch'
import {
  changeMemberRole,
  listAuditLog,
  listMembers,
  removeMember,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

let harness: Harness
let tenant: SeededTenant
beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('departure')
})
async function memberId(userId: string) {
  const row = (await listMembers(tenant.scope)).find(
    (item) => item.userId === userId,
  )
  if (!row) throw new Error('missing test member')
  return row.id
}
it('an admin cannot remove an owner, including composite owner roles', async () => {
  const admin = await tenant.addUser('Admin', 'admin')
  const owner = await tenant.addUser('Other owner', 'owner')
  const id = await memberId(owner)
  harness.sqlite
    .prepare('UPDATE member SET role = ? WHERE id = ?')
    .run('admin,owner', id)
  await expect(
    removeMember(tenant.scopeFor(admin, 'admin'), id),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  expect((await listMembers(tenant.scope)).some((row) => row.id === id)).toBe(
    true,
  )
})
it('simultaneous owner departures preserve one owner', async () => {
  const other = await tenant.addUser('Other owner', 'owner')
  const ownId = await memberId(tenant.ownerUserId)
  const otherId = await memberId(other)
  const outcomes = await Promise.allSettled([
    removeMember(tenant.scope, ownId),
    removeMember(tenant.scopeFor(other, 'owner'), otherId),
  ])
  expect(outcomes.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
  expect(
    (await listMembers(tenant.scope)).filter((row) => row.role === 'owner'),
  ).toHaveLength(1)
})
it('a foreign tenant target cannot be removed', async () => {
  const foreign = await harness.seedTenant('foreign')
  const target = (await listMembers(foreign.scope))[0]
  await expect(removeMember(tenant.scope, target.id)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  })
  expect(await listMembers(foreign.scope)).toHaveLength(1)
  expect((await listAuditLog(tenant.scope)).items).toHaveLength(0)
})

it.each([
  ['owner', 'member', true],
  ['owner', 'admin', true],
  ['owner', 'owner', true],
  ['admin', 'member', true],
  ['admin', 'admin', true],
  ['admin', 'owner', false],
  ['member', 'member', false],
  ['member', 'owner', false],
] as const)(
  'authenticated %s removing %s: allowed=%s',
  async (role, targetRole, allowed) => {
    const actorId =
      role === 'owner'
        ? tenant.ownerUserId
        : await tenant.addUser('Actor', role)
    const targetId = await tenant.addUser('Target', targetRole)
    const scope = tenant.scopeFor(actorId, role)
    const id = await memberId(targetId)
    const outcome = await departMember(ports(scope), { memberId: id })
    expect(outcome.ok).toBe(allowed)
    expect((await listMembers(tenant.scope)).some((row) => row.id === id)).toBe(
      !allowed,
    )
    const events = (await listAuditLog(tenant.scope)).items
    expect(events).toHaveLength(allowed ? 1 : 0)
    if (allowed) {
      expect(events[0]).toMatchObject({
        action: 'member.removed',
        actorUserId: actorId,
        entityId: id,
        metadata: { targetUserId: targetId, role: targetRole },
      })
      expect(await departMember(ports(scope), { memberId: id })).toEqual({
        ok: false,
        reason: 'not-found',
      })
      expect((await listAuditLog(tenant.scope)).items).toHaveLength(1)
    }
  },
)

it('impersonation is refused before scope or auth access', async () => {
  const unreachable = async (): Promise<never> => {
    throw new Error('must not call')
  }
  expect(
    await departMember(
      {
        impersonated: true,
        scope: unreachable,
        remove: unreachable,
        repairOffboarding: async () => {},
        activateRemaining: unreachable,
      },
      {},
    ),
  ).toEqual({ ok: false, reason: 'impersonated' })
})
it.each(['actor-demoted', 'actor-removed', 'target-promoted'] as const)(
  'rechecks current roles at deletion: %s',
  async (change) => {
    const actor = await tenant.addUser('Admin', 'admin')
    const target = await tenant.addUser('Target', 'member')
    const id = await memberId(target)
    const actorMemberId = await memberId(actor)
    const scope = tenant.scopeFor(actor, 'admin')
    const adapter = deletionAdapter()
    const result = await departMember(
      {
        ...ports(scope),
        remove: async () => {
          if (change === 'actor-removed')
            harness.sqlite
              .prepare('DELETE FROM member WHERE id = ?')
              .run(actorMemberId)
          else
            harness.sqlite
              .prepare('UPDATE member SET role = ? WHERE id = ?')
              .run(
                change === 'target-promoted' ? 'admin,owner' : 'member',
                change === 'target-promoted' ? id : actorMemberId,
              )
          await adapter.delete({
            model: 'member',
            where: [{ field: 'id', value: id }],
          })
        },
      },
      { memberId: id },
    )
    expect(result).toEqual({ ok: false, reason: 'not-permitted' })
    expect((await listAuditLog(tenant.scope)).items).toHaveLength(0)
    expect((await listMembers(tenant.scope)).some((row) => row.id === id)).toBe(
      true,
    )
  },
)
it('a departure racing another owner demotion preserves one owner', async () => {
  const other = await tenant.addUser('Owner two', 'owner')
  const ownId = await memberId(tenant.ownerUserId)
  const otherId = await memberId(other)
  await Promise.allSettled([
    departMember(ports(tenant.scope), { memberId: ownId }),
    changeMemberRole(tenant.scopeFor(other, 'owner'), otherId, 'member'),
  ])
  expect(
    (await listMembers(tenant.scope)).filter((row) => row.role === 'owner'),
  ).toHaveLength(1)
})
it('self departure activates once; activation failure does not offer a second deletion', async () => {
  const self = await tenant.addUser('Leaver', 'member')
  const scope = tenant.scopeFor(self, 'member')
  expect(
    await departMember(
      {
        ...ports(scope),
        repairOffboarding: async () => {},
        activateRemaining: async () => {
          throw new Error('activation unavailable')
        },
      },
      {},
    ),
  ).toEqual({ ok: true, left: true, activationFailed: true })
  expect((await listAuditLog(tenant.scope)).items).toMatchObject([
    { action: 'member.left', actorUserId: self },
  ])
})
it.each(['organizationId', 'userId', 'actorRole'])(
  'rejects forged %s input',
  (field) => {
    expect(
      memberDepartureInput.safeParse({ memberId: 'target', [field]: 'forged' })
        .success,
    ).toBe(false)
  },
)

function deletionAdapter() {
  return guardMemberDeletion(
    drizzleAdapter(harness.db, { provider: 'sqlite', schema: authSchema })({}),
  )
}
function ports(scope: TenantScope): DeparturePorts {
  return {
    impersonated: false,
    scope: async () => scope,
    remove: async (_organizationId, id) =>
      deletionAdapter().delete({
        model: 'member',
        where: [{ field: 'id', value: id }],
      }),
    repairOffboarding: async () => {},
    activateRemaining: async () => {},
  }
}

it('repairs offboarding after a committed delete whose auth lifecycle throws, without deleting twice', async () => {
  const target = await tenant.addUser('Target', 'member')
  const id = await memberId(target)
  const repairs: Array<string> = []
  const result = await departMember(
    {
      ...ports(tenant.scope),
      remove: async () => {
        await deletionAdapter().delete({
          model: 'member',
          where: [{ field: 'id', value: id }],
        })
        throw new Error('auth session cleanup failed after commit')
      },
      repairOffboarding: async (userId, organizationId) => {
        repairs.push(`${organizationId}:${userId}`)
      },
    },
    { memberId: id },
  )
  expect(result).toEqual({ ok: true, left: false, activationFailed: false })
  expect(repairs).toEqual([`${tenant.organizationId}:${target}`])
  expect((await listAuditLog(tenant.scope)).items).toHaveLength(1)
})

it.each(['admin, owner ', 'admin,\towner', 'admin,\u00a0owner'])(
  'preserves a sole owner stored as %j',
  async (stored) => {
    const ownId = await memberId(tenant.ownerUserId)
    harness.sqlite
      .prepare('UPDATE member SET role = ? WHERE id = ?')
      .run(stored, ownId)
    await expect(removeMember(tenant.scope, ownId)).rejects.toMatchObject({
      code: 'LAST_OWNER',
    })
    await expect(
      changeMemberRole(tenant.scope, ownId, 'member'),
    ).rejects.toMatchObject({ code: 'LAST_OWNER' })
  },
)

it('never counts a malformed owner token as a surviving owner', async () => {
  const other = await tenant.addUser('Invalid owner', 'member')
  harness.sqlite
    .prepare('UPDATE member SET role = ? WHERE id = ?')
    .run('admin,ow ner', await memberId(other))
  await expect(
    removeMember(tenant.scope, await memberId(tenant.ownerUserId)),
  ).rejects.toMatchObject({ code: 'LAST_OWNER' })
})

it('runs offboarding repair after commit even when a separate audit lookup would fail', async () => {
  const target = await tenant.addUser('Target', 'member')
  const id = await memberId(target)
  const foreign = await harness.seedTenant('unrelated')
  const repair = vi.fn(async () => {})
  const lookup = vi
    .spyOn(auditLogRepository, 'findById')
    .mockRejectedValue(new Error('audit read unavailable'))
  try {
    const result = await departMember(
      {
        ...ports(tenant.scope),
        remove: async () => {
          await deletionAdapter().delete({
            model: 'member',
            where: [{ field: 'id', value: id }],
          })
          throw new Error('auth lifecycle failed')
        },
        repairOffboarding: repair,
      },
      { memberId: id },
    )
    expect(result.ok).toBe(true)
    expect(repair).toHaveBeenCalledExactlyOnceWith(
      target,
      tenant.organizationId,
    )
    expect(lookup).not.toHaveBeenCalled()
    expect((await listMembers(tenant.scope)).some((row) => row.id === id)).toBe(
      false,
    )
    expect((await listAuditLog(tenant.scope)).items).toHaveLength(1)
    expect(await listMembers(foreign.scope)).toHaveLength(1)
    expect((await listAuditLog(foreign.scope)).items).toHaveLength(0)
  } finally {
    lookup.mockRestore()
  }
})

it.each([false, true])(
  'reconciles a lost batch response, unavailable audit read=%s',
  async (unavailable) => {
    const target = await tenant.addUser('Target', 'member')
    const id = await memberId(target)
    const db = tenant.scope.db as typeof tenant.scope.db & {
    batch: (statements: readonly [BatchStatement, ...Array<BatchStatement>]) => Promise<Array<unknown>>
  }
    if (!('batch' in db) || typeof db.batch !== 'function')
      throw new Error('missing batch')
    const original = db.batch.bind(db)
    const batch = vi.spyOn(db, 'batch').mockImplementation(async (...args) => {
      await original(...args)
      throw new Error('batch response lost after commit')
    })
    const lookup = unavailable
      ? vi
          .spyOn(auditLogRepository, 'findById')
          .mockRejectedValue(new Error('read unavailable'))
      : undefined
    const repair = vi.fn(async () => {})
    try {
      const result = departMember(
        { ...ports(tenant.scope), repairOffboarding: repair },
        { memberId: id },
      )
      if (unavailable) {
        await expect(result).rejects.toMatchObject({
          code: 'MEMBERSHIP_COMMIT_UNKNOWN',
        })
        expect(repair).toHaveBeenCalledExactlyOnceWith(
          target,
          tenant.organizationId,
        )
      } else expect((await result).ok).toBe(true)
      expect(
        (await listMembers(tenant.scope)).some((row) => row.id === id),
      ).toBe(false)
      expect((await listAuditLog(tenant.scope)).items).toHaveLength(1)
    } finally {
      batch.mockRestore()
      lookup?.mockRestore()
    }
  },
)
