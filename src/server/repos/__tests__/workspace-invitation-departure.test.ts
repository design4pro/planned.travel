import { afterEach, beforeEach, expect, it } from 'vitest'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { eq } from 'drizzle-orm'
import { authSchema, user } from '#/server/db/auth-schema'
import { workspaceParticipants } from '#/server/db/schema'
import type { OrganizationRole } from '#/server/db/types'
import { guardMemberDeletion } from '#/server/auth/member-deletion'
import { departMember } from '#/server/fns/member-departure-writes'
import type { TenantScope } from '../base'
import { createTenantTableAccess } from '../base'
import {
  cancelInvitation,
  createInvitation,
  getMembership,
  listInvitations,
  renewInvitation,
  setInvitationStatus,
} from '../members'
import { listAuditLog } from '../audit'
import {
  acceptWorkspaceInvitation,
  rejectWorkspaceInvitation,
} from '../workspace-invitation-acceptance'
import { createHarness, subscribeTenant } from './harness'
import type { Harness, SeededTenant } from './harness'

let h: Harness
let tenant: SeededTenant
let foreign: SeededTenant
let recipientId: string
let issuerId: string
let issuer: TenantScope
const now = new Date('2026-11-02')
const expiresAt = new Date('2030-01-01')
const anchors = createTenantTableAccess(workspaceParticipants, 'participant')

beforeEach(async () => {
  h = await createHarness()
  tenant = await h.seedTenant('invitation-departure')
  foreign = await h.seedTenant('foreign')
  await subscribeTenant(tenant.scope, 'crew', 10)
  await subscribeTenant(foreign.scope, 'crew', 10)
  issuerId = await tenant.addUser('Issuer', 'owner')
  issuer = tenant.scopeFor(issuerId, 'owner')
  recipientId = foreign.ownerUserId
  await h.db
    .update(user)
    .set({ email: 'recipient@example.test' })
    .where(eq(user.id, recipientId))
})
afterEach(() => h.close())

function invite(role: OrganizationRole = 'member') {
  return createInvitation(issuer, {
    email: 'recipient@example.test',
    role,
    expiresAt,
  })
}
function recipient() {
  return tenant.scopeFor(recipientId)
}
async function depart(self: boolean, actor = tenant.scope) {
  const target = await getMembership(tenant.scope, issuerId)
  if (!target) throw new Error('Missing issuer membership')
  const adapter = guardMemberDeletion(
    drizzleAdapter(h.db, { provider: 'sqlite', schema: authSchema })({}),
  )
  return departMember(
    {
      impersonated: false,
      scope: async () => (self ? issuer : actor),
      remove: async (_organizationId, id) =>
        adapter.delete({
          model: 'member',
          where: [{ field: 'id', value: id }],
        }),
      repairOffboarding: async () => {},
      activateRemaining: async () => {},
    },
    self ? {} : { memberId: target.id },
  )
}

it.each(
  (['member', 'admin', 'owner'] as const).flatMap((role) =>
    [true, false].map((self) => ({ role, self })),
  ),
)(
  'retains the stored $role grant after departure (self=$self), including an already absent issuer',
  async ({ role, self }) => {
    const row = await invite(role)
    const unrelated = await createInvitation(tenant.scope, {
      email: 'other@example.test',
      expiresAt,
    })
    const foreignInvite = await createInvitation(foreign.scope, {
      email: 'foreign@example.test',
      expiresAt,
    })
    expect(await depart(self)).toEqual({
      ok: true,
      left: self,
      activationFailed: false,
    })
    expect(await listInvitations(tenant.scope)).toHaveLength(2)
    expect(await listInvitations(tenant.scope)).toEqual(
      expect.arrayContaining([row, unrelated]),
    )
    expect(await getMembership(tenant.scope, issuerId)).toBeNull()
    // The same stored invitation also covers issuers who left before deployment.
    const accepted = await acceptWorkspaceInvitation(recipient(), row.id, now)
    expect(accepted?.member).toMatchObject({ userId: recipientId, role })
    expect(await getMembership(tenant.scope, issuerId)).toBeNull()
    expect(await anchors.findMany(recipient())).toEqual([
      expect.objectContaining({ userId: recipientId }),
    ])
    expect(await acceptWorkspaceInvitation(recipient(), row.id, now)).toBeNull()
    expect(await listInvitations(foreign.scope)).toEqual([foreignInvite])
    expect(
      (await listInvitations(tenant.scope)).find(
        (item) => item.id === unrelated.id,
      ),
    ).toEqual(unrelated)
    expect(
      (await listAuditLog(tenant.scope)).items
        .map((item) => item.action)
        .sort(),
    ).toEqual([self ? 'member.left' : 'member.removed'])
    expect((await listAuditLog(foreign.scope)).items).toEqual([])
  },
)

it.each([true, false])(
  'concurrent acceptance and departure (self=%s) commit independently exactly once',
  async (self) => {
    const row = await invite('owner')
    const [departure, ...joins] = await Promise.all([
      depart(self),
      acceptWorkspaceInvitation(recipient(), row.id, now),
      acceptWorkspaceInvitation(recipient(), row.id, now),
    ])
    expect(departure.ok).toBe(true)
    expect(joins.filter(Boolean)).toHaveLength(1)
    expect(await getMembership(tenant.scope, issuerId)).toBeNull()
    expect(await getMembership(tenant.scope, recipientId)).toMatchObject({
      role: 'owner',
    })
    expect(await anchors.findMany(recipient())).toHaveLength(1)
    expect((await listAuditLog(tenant.scope)).items).toMatchObject([
      { action: self ? 'member.left' : 'member.removed' },
    ])
  },
)

it.each(['refused', 'rollback'] as const)(
  'a %s departure leaves invitations and audit unchanged',
  async (mode) => {
    const row = await invite()
    if (mode === 'rollback') {
      h.sqlite.exec(
        "create trigger refuse_departure before delete on member begin select raise(abort, 'refused'); end",
      )
      await expect(depart(true)).rejects.toThrow()
    } else {
      expect(await depart(false, tenant.scopeFor(recipientId))).toEqual({
        ok: false,
        reason: 'not-permitted',
      })
    }
    expect(await getMembership(tenant.scope, issuerId)).not.toBeNull()
    expect(await listInvitations(tenant.scope)).toEqual([row])
    expect((await listAuditLog(tenant.scope)).items).toEqual([])
    expect(
      (await acceptWorkspaceInvitation(recipient(), row.id, now))?.member.role,
    ).toBe('member')
  },
)

it.each(['member', 'workspace_participants', 'invitation'])(
  'acceptance rollback at %s does not undo the committed departure',
  async (table) => {
    const row = await invite()
    await depart(true)
    h.sqlite.exec(
      `create trigger refuse_acceptance before ${table === 'invitation' ? 'update' : 'insert'} on ${table} begin select raise(abort, 'refused'); end`,
    )
    await expect(
      acceptWorkspaceInvitation(recipient(), row.id, now),
    ).rejects.toThrow()
    expect(await getMembership(tenant.scope, issuerId)).toBeNull()
    expect(await getMembership(tenant.scope, recipientId)).toBeNull()
    expect(await anchors.findMany(recipient())).toEqual([])
    expect(await listInvitations(tenant.scope)).toEqual([row])
    expect((await listAuditLog(tenant.scope)).items).toHaveLength(1)
  },
)

it.each(['owner', 'admin'] as const)(
  'a remaining %s may revoke after issuer departure',
  async (role) => {
    const actor = await tenant.addUser('Revoker', role)
    const row = await invite('admin')
    await depart(true)
    expect(
      (await cancelInvitation(tenant.scopeFor(actor, role), row.id)).status,
    ).toBe('canceled')
    expect(await acceptWorkspaceInvitation(recipient(), row.id, now)).toBeNull()
  },
)

it.each([true, false])(
  'acceptance/revocation race has one terminal winner, revoke first=%s',
  async (revokeFirst) => {
    const row = await invite()
    await depart(true)
    const accept = () => acceptWorkspaceInvitation(recipient(), row.id, now)
    const revoke = () => cancelInvitation(tenant.scope, row.id)
    await Promise.allSettled(
      revokeFirst ? [revoke(), accept()] : [accept(), revoke()],
    )
    const [stored] = await listInvitations(tenant.scope)
    expect(['accepted', 'canceled']).toContain(stored.status)
    const joined = await getMembership(tenant.scope, recipientId)
    expect(Boolean(joined)).toBe(stored.status === 'accepted')
    expect(await anchors.findMany(recipient())).toHaveLength(joined ? 1 : 0)
    expect(await accept()).toBeNull()
    await expect(revoke()).rejects.toMatchObject({ code: 'NOT_FOUND' })
  },
)

it.each(['accepted', 'rejected', 'canceled'] as const)(
  'departure, resend and issuer return never revive %s invitations',
  async (status) => {
    const row = await invite()
    if (status === 'accepted')
      await acceptWorkspaceInvitation(recipient(), row.id, now)
    else if (status === 'rejected')
      await rejectWorkspaceInvitation(recipient(), row.id)
    else await cancelInvitation(tenant.scope, row.id)
    await depart(false)
    await expect(
      renewInvitation(tenant.scope, row.id, expiresAt),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(
      setInvitationStatus(tenant.scope, row.id, 'pending'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await tenant.addMembership(issuerId, 'owner')
    await expect(
      renewInvitation(issuer, row.id, expiresAt),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await acceptWorkspaceInvitation(recipient(), row.id, now)).toBeNull()
    expect((await listInvitations(tenant.scope))[0].status).toBe(status)
  },
)

it('keeps recipient, expiry, tenant, duplicate and reserved-seat guards after departure', async () => {
  const row = await invite('admin')
  await depart(true)
  expect(await acceptWorkspaceInvitation(foreign.scope, row.id, now)).toBeNull()
  await expect(cancelInvitation(foreign.scope, row.id)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  })
  await h.db
    .update(user)
    .set({ emailVerified: false })
    .where(eq(user.id, recipientId))
  expect(await acceptWorkspaceInvitation(recipient(), row.id, now)).toBeNull()
  await h.db
    .update(user)
    .set({ emailVerified: true, email: 'changed@example.test' })
    .where(eq(user.id, recipientId))
  expect(await acceptWorkspaceInvitation(recipient(), row.id, now)).toBeNull()
  await h.db
    .update(user)
    .set({ email: 'recipient@example.test' })
    .where(eq(user.id, recipientId))
  expect(
    await acceptWorkspaceInvitation(
      recipient(),
      row.id,
      new Date('2031-01-01'),
    ),
  ).toBeNull()
  await subscribeTenant(tenant.scope, 'free', 1)
  expect(
    (await acceptWorkspaceInvitation(recipient(), row.id, now))?.member.role,
  ).toBe('admin')
  expect(await acceptWorkspaceInvitation(recipient(), row.id, now)).toBeNull()
})

it('still refuses the 100-member ceiling after issuer departure', async () => {
  const row = await invite()
  await depart(true)
  for (let index = 0; index < 99; index++)
    await tenant.addUser(`Member ${index}`)
  expect(await acceptWorkspaceInvitation(recipient(), row.id, now)).toBeNull()
  expect(await getMembership(tenant.scope, recipientId)).toBeNull()
  expect(await anchors.findMany(recipient())).toEqual([])
  expect(await listInvitations(tenant.scope)).toEqual([row])
})

it('renews the same expired reservation after departure without changing its grant', async () => {
  const row = await invite('owner')
  await depart(true)
  expect(
    await acceptWorkspaceInvitation(
      recipient(),
      row.id,
      new Date('2031-01-01'),
    ),
  ).toBeNull()
  const renewed = await renewInvitation(
    tenant.scope,
    row.id,
    new Date('2032-01-01'),
  )
  expect(renewed).toMatchObject({
    id: row.id,
    status: 'pending',
    role: 'owner',
    inviterId: issuerId,
  })
  expect(
    (
      await acceptWorkspaceInvitation(
        recipient(),
        row.id,
        new Date('2031-01-01'),
      )
    )?.member.role,
  ).toBe('owner')
  expect(await getMembership(tenant.scope, issuerId)).toBeNull()
})
