import { afterEach, beforeEach, expect, it } from 'vitest'
import { user, invitation, member } from '#/server/db/auth-schema'
import { workspaceParticipants } from '#/server/db/schema'
import { eq } from 'drizzle-orm'
import { createScope } from '../base'
import {
  createInvitation,
  listPendingInvitations,
  countMembers,
  cancelInvitation,
} from '../members'
import {
  acceptWorkspaceInvitation,
  rejectWorkspaceInvitation,
  resolveWorkspaceInvitationScopeUnscoped,
} from '../workspace-invitation-acceptance'
import { createHarness, subscribeTenant } from './harness'
import type { Harness, SeededTenant } from './harness'

let h: Harness
let a: SeededTenant
let recipientId: string
const now = new Date('2026-10-19')
const expiresAt = new Date('2030-01-01')
beforeEach(async () => {
  h = await createHarness()
  a = await h.seedTenant('acceptance')
  await subscribeTenant(a.scope, 'crew', 10)
  const b = await h.seedTenant('recipient')
  recipientId = b.ownerUserId
  await h.db
    .update(user)
    .set({ email: 'Recipient@example.com', emailVerified: true })
    .where(eq(user.id, recipientId))
})
afterEach(() => h.close())
const scope = (organizationId = a.organizationId) =>
  createScope(h.db, {
    organizationId,
    userId: recipientId,
    role: 'member',
    impersonatedBy: null,
  })
const invite = () =>
  createInvitation(a.scope, {
    email: 'recipient@example.com',
    expiresAt,
    role: 'admin',
  })

it('resolves only recipient coordinates and never exposes foreign tenant content', async () => {
  const row = await invite()
  expect(
    await resolveWorkspaceInvitationScopeUnscoped(h.db, row.id, recipientId),
  ).toEqual({ organizationId: a.organizationId })
  expect(
    await resolveWorkspaceInvitationScopeUnscoped(h.db, row.id, a.ownerUserId),
  ).toBeNull()
  expect(
    await acceptWorkspaceInvitation(scope('foreign'), row.id, now),
  ).toBeNull()
  expect(await rejectWorkspaceInvitation(scope('foreign'), row.id)).toBeNull()
  expect(await listPendingInvitations(a.scope)).toHaveLength(1)
})

it('transfers an over-quota reservation once, with its original role and anchor', async () => {
  const row = await invite()
  await subscribeTenant(a.scope, 'free', 1)
  const result = await acceptWorkspaceInvitation(scope(), row.id, now)
  expect(result?.member).toMatchObject({
    userId: recipientId,
    role: 'admin',
    organizationId: a.organizationId,
  })
  expect(await countMembers(a.scope)).toBe(2)
  expect(await listPendingInvitations(a.scope)).toHaveLength(0)
  expect(
    await h.db
      .select()
      .from(workspaceParticipants)
      .where(eq(workspaceParticipants.organizationId, a.organizationId)),
  ).toEqual(
    expect.arrayContaining([expect.objectContaining({ userId: recipientId })]),
  )
  expect(await acceptWorkspaceInvitation(scope(), row.id, now)).toBeNull()
  expect(await rejectWorkspaceInvitation(scope(), row.id)).toBeNull()
  await h.db.delete(member).where(eq(member.id, result!.member.id))
  expect(await acceptWorkspaceInvitation(scope(), row.id, now)).toBeNull()
  expect(await countMembers(a.scope)).toBe(1)
})

it.each(['member', 'workspace_participants', 'invitation'])(
  'rolls back every acceptance statement when %s refuses',
  async (table) => {
    const row = await invite()
    const operation = table === 'invitation' ? 'update' : 'insert'
    h.sqlite.exec(
      `create trigger refuse_acceptance before ${operation} on ${table} begin select raise(abort, 'refused'); end`,
    )
    await expect(
      acceptWorkspaceInvitation(scope(), row.id, now),
    ).rejects.toThrow()
    expect(await countMembers(a.scope)).toBe(1)
    expect(await listPendingInvitations(a.scope)).toHaveLength(1)
    expect(
      await h.db
        .select()
        .from(workspaceParticipants)
        .where(eq(workspaceParticipants.organizationId, a.organizationId)),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: recipientId }),
      ]),
    )
  },
)

it('refuses stale email, unverified recipients, expiry, revocation and terminal rejection', async () => {
  const row = await invite()
  await h.db
    .update(user)
    .set({ emailVerified: false })
    .where(eq(user.id, recipientId))
  expect(await acceptWorkspaceInvitation(scope(), row.id, now)).toBeNull()
  await h.db
    .update(user)
    .set({ emailVerified: true, email: 'changed@example.com' })
    .where(eq(user.id, recipientId))
  expect(await acceptWorkspaceInvitation(scope(), row.id, now)).toBeNull()
  expect(await rejectWorkspaceInvitation(scope(), row.id)).toBeNull()
  await h.db
    .update(user)
    .set({ email: 'recipient@example.com' })
    .where(eq(user.id, recipientId))
  expect(
    await acceptWorkspaceInvitation(scope(), row.id, new Date('2031-01-01')),
  ).toBeNull()
  await cancelInvitation(a.scope, row.id)
  expect(await acceptWorkspaceInvitation(scope(), row.id, now)).toBeNull()
  expect(await rejectWorkspaceInvitation(scope(), row.id)).toBeNull()
  await h.db
    .update(invitation)
    .set({ status: 'pending' })
    .where(eq(invitation.id, row.id))
  expect((await rejectWorkspaceInvitation(scope(), row.id))?.status).toBe(
    'rejected',
  )
  expect(await acceptWorkspaceInvitation(scope(), row.id, now)).toBeNull()
  expect(await rejectWorkspaceInvitation(scope(), row.id)).toBeNull()
})

it('serializes duplicate acceptance and rejection with one winner', async () => {
  const row = await invite()
  const results = await Promise.all([
    acceptWorkspaceInvitation(scope(), row.id, now),
    acceptWorkspaceInvitation(scope(), row.id, now),
    rejectWorkspaceInvitation(scope(), row.id),
  ])
  expect(results.filter(Boolean)).toHaveLength(1)
  const pending = await listPendingInvitations(a.scope)
  expect(pending).toHaveLength(0)
  expect(await countMembers(a.scope)).toBe(results[0] || results[1] ? 2 : 1)
})

it('refuses a non-atomic driver before any membership, anchor or status write', async () => {
  const row = await invite()
  const noBatch = new Proxy(h.db, {
    get(target, key, receiver) {
      return key === 'batch' ? undefined : Reflect.get(target, key, receiver)
    },
  })
  await expect(
    acceptWorkspaceInvitation(createScope(noBatch, scope().ctx), row.id, now),
  ).rejects.toThrow('Atomic batch driver required')
  expect(await countMembers(a.scope)).toBe(1)
  expect(await listPendingInvitations(a.scope)).toHaveLength(1)
})

it('does not consume a pending reservation for an existing member or above the library ceiling', async () => {
  const row = await invite()
  await a.addMembership(recipientId)
  expect(await acceptWorkspaceInvitation(scope(), row.id, now)).toBeNull()
  expect(await listPendingInvitations(a.scope)).toHaveLength(1)
  await h.db.delete(member).where(eq(member.userId, recipientId))
  for (let index = 0; index < 99; index++) await a.addUser(`Ceiling ${index}`)
  expect(await acceptWorkspaceInvitation(scope(), row.id, now)).toBeNull()
  expect(await countMembers(a.scope)).toBe(100)
  expect(await listPendingInvitations(a.scope)).toHaveLength(1)
})
