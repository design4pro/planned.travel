import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createInvitation, listPendingInvitations, addMember } from '../members'
import { createHarness, subscribeTenant } from './harness'
import type { Harness, SeededTenant } from './harness'

let h: Harness
let a: SeededTenant
const expiresAt = new Date('2030-01-01')
beforeEach(async () => {
  h = await createHarness()
  a = await h.seedTenant('invitations')
  await subscribeTenant(a.scope, 'crew', 10)
})
afterEach(() => h.close())

describe('workspace invitations', () => {
  it('refuses duplicate pending addresses instead of silently resending', async () => {
    await createInvitation(a.scope, { email: 'invite@example.com', expiresAt })
    await expect(
      createInvitation(a.scope, { email: ' INVITE@example.com ', expiresAt }),
    ).rejects.toMatchObject({ code: 'INVITATION_EXISTS' })
    expect(await listPendingInvitations(a.scope)).toHaveLength(1)
  })
  it('checks the admin ceiling even before returning an existing duplicate', async () => {
    await createInvitation(a.scope, {
      email: 'invite@example.com',
      expiresAt,
      role: 'owner',
    })
    const admin = await a.addUser('Admin', 'admin')
    await expect(
      createInvitation(a.scopeFor(admin, 'admin'), {
        email: 'invite@example.com',
        expiresAt,
        role: 'owner',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
  it('holds the same ceiling on direct member add, including an existing member', async () => {
    const admin = await a.addUser('Admin', 'admin')
    await expect(
      addMember(a.scopeFor(admin, 'admin'), {
        userId: a.ownerUserId,
        role: 'owner',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

it('serializes concurrent duplicate and quota claims, including expired pending seats', async () => {
  await subscribeTenant(a.scope, 'crew', 10)
  const same = await Promise.allSettled(
    Array.from({ length: 6 }, () =>
      createInvitation(a.scope, {
        email: 'same@example.com',
        expiresAt: new Date('2020-01-01'),
      }),
    ),
  )
  expect(same.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
  const different = await Promise.allSettled(
    Array.from({ length: 12 }, (_, i) =>
      createInvitation(a.scope, { email: `other${i}@example.com`, expiresAt }),
    ),
  )
  expect(
    different.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(8)
  expect(await listPendingInvitations(a.scope)).toHaveLength(9)
})
it('isolates duplicate detection, profile joins, renewals, cancellation and direct adds', async () => {
  const b = await h.seedTenant('other')
  await subscribeTenant(b.scope, 'crew')
  const email = 'shared@example.com'
  const foreign = await createInvitation(b.scope, { email, expiresAt })
  const own = await createInvitation(a.scope, { email, expiresAt })
  const {
    renewInvitation,
    cancelInvitation,
    listPendingInvitationProfiles,
    listMembers,
  } = await import('../members')
  const profiles = await listPendingInvitationProfiles(a.scope)
  expect(profiles.map((row) => row.id)).toEqual([own.id])
  expect(profiles[0]?.inviterId).toBe(a.ownerUserId)
  await expect(
    renewInvitation(a.scope, foreign.id, expiresAt),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(cancelInvitation(a.scope, foreign.id)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  })
  expect(
    await addMember(a.scope, { userId: b.ownerUserId, role: 'member' }),
  ).toMatchObject({ organizationId: a.organizationId, role: 'member' })
  expect(
    (await listMembers(b.scope)).find((row) => row.userId === b.ownerUserId)
      ?.role,
  ).toBe('owner')
  expect((await listPendingInvitations(b.scope))[0]?.expiresAt).toEqual(
    expiresAt,
  )
})
it('refuses existing members and ordinary callers, but permits a member of another workspace', async () => {
  const id = await a.addUser('Existing')
  const { user } = await import('#/server/db/auth-schema')
  const { eq } = await import('drizzle-orm')
  const [existing] = await h.db.select().from(user).where(eq(user.id, id))
  await expect(
    createInvitation(a.scope, { email: existing.email, expiresAt }),
  ).rejects.toMatchObject({ code: 'ALREADY_MEMBER' })
  await expect(
    createInvitation(a.scopeFor(id), { email: 'new@example.com', expiresAt }),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
it('renews the same pending row, keeps inviter and ceiling, and never revives a terminal row', async () => {
  const { renewInvitation, cancelInvitation, setInvitationStatus } =
    await import('../members')
  const row = await createInvitation(a.scope, {
    email: 'old@example.com',
    role: 'owner',
    expiresAt: new Date('2020-01-01'),
  })
  const admin = await a.addUser('Admin', 'admin')
  await expect(
    renewInvitation(a.scopeFor(admin, 'admin'), row.id, expiresAt),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  expect(await renewInvitation(a.scope, row.id, expiresAt)).toMatchObject({
    id: row.id,
    email: row.email,
    inviterId: row.inviterId,
    role: row.role,
    expiresAt,
  })
  for (const status of ['accepted', 'rejected', 'canceled'] as const) {
    const terminal = await createInvitation(a.scope, {
      email: `${status}@example.com`,
      expiresAt,
    })
    await setInvitationStatus(a.scope, terminal.id, status)
    await expect(
      renewInvitation(a.scope, terminal.id, expiresAt),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(cancelInvitation(a.scope, terminal.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  }
})

it('refuses member renewal and cancellation without revealing a pending row', async () => {
  const { renewInvitation, cancelInvitation } = await import('../members')
  const row = await createInvitation(a.scope, {
    email: 'restricted@example.com',
    expiresAt,
  })
  const memberId = await a.addUser('Member')
  const scope = a.scopeFor(memberId)
  await expect(renewInvitation(scope, row.id, expiresAt)).rejects.toMatchObject(
    { code: 'FORBIDDEN' },
  )
  await expect(cancelInvitation(scope, row.id)).rejects.toMatchObject({
    code: 'FORBIDDEN',
  })
  expect((await listPendingInvitations(a.scope))[0]?.id).toBe(row.id)
})

it('holds authorization, tenant scope and terminal states on the generic status writer too', async () => {
  const { setInvitationStatus } = await import('../members')
  const row = await createInvitation(a.scope, {
    email: 'status@example.com',
    expiresAt,
  })
  const memberId = await a.addUser('Status member')
  await expect(
    setInvitationStatus(a.scopeFor(memberId), row.id, 'canceled'),
  ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  const b = await h.seedTenant('status-foreign')
  await expect(
    setInvitationStatus(b.scope, row.id, 'canceled'),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await setInvitationStatus(a.scope, row.id, 'canceled')
  await expect(
    setInvitationStatus(a.scope, row.id, 'pending'),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' })
})
