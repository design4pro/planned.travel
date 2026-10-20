import { afterEach, beforeEach, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { invitation, session, verification } from '#/server/db/auth-schema'
import {
  platformAuditLog,
  staffApiTokens,
  providerRegistry,
} from '#/server/db/schema'
import {
  eraseWorkspaceInvitations,
  eraseAccountAuthLeftovers,
  erasePlatformUserReferences,
  countPlatformUserReferences,
} from '#/server/catalog/erasure'
import { createHarness } from '#/server/repos/__tests__/harness'
import type { Harness } from '#/server/repos/__tests__/harness'
import type { PlatformActor } from '#/server/auth/guard'

const actor: PlatformActor = {
  actorKind: 'system',
  userId: null,
  role: null,
  tokenId: null,
}
let h: Harness
beforeEach(async () => {
  h = await createHarness()
})
afterEach(() => h.close())

it('deletes incoming invitations only in the named workspace, leaves sent invitations and protects another recipient', async () => {
  const a = await h.seedTenant('a'),
    b = await h.seedTenant('b')
  for (const t of [a, b])
    for (const email of ['PERSON@example.test', 'other@example.test'])
      await h.db.insert(invitation).values({
        id: `${t.organizationId}${email}`,
        organizationId: t.organizationId,
        email,
        inviterId: t.ownerUserId,
        expiresAt: new Date(),
        createdAt: new Date(),
      })
  await eraseWorkspaceInvitations(
    h.db,
    actor,
    a.organizationId,
    'person@example.test',
  )
  await eraseWorkspaceInvitations(
    h.db,
    actor,
    a.organizationId,
    'person@example.test',
  )
  expect(
    (
      await h.db
        .select()
        .from(invitation)
        .where(eq(invitation.organizationId, a.organizationId))
    ).map((r) => r.email),
  ).toEqual(['other@example.test'])
  expect(
    await h.db
      .select()
      .from(invitation)
      .where(eq(invitation.organizationId, b.organizationId)),
  ).toHaveLength(2)
})
it('finds exact verification identities and passkey JSON, preserves similar users and malformed records, and ends impersonated sessions after persisting their cache cleanup', async () => {
  const a = await h.seedTenant('a'),
    b = await h.seedTenant('b'),
    userId = a.ownerUserId,
    email = 'person@example.test'
  const rows = [
    ['email', email, 'secret'],
    ['otp', 'email-verification-otp-' + email, '123456:0'],
    ['reset', 'reset-password:random', userId],
    ['twofactor', '2fa-random', userId],
    ['trust', 'trust-device-random', userId],
    ['lock', 'revoke-unproven-account-access:' + userId, 'lock'],
    ['key', userId, 'code'],
    [
      'passkey',
      'passkey-challenge:random',
      JSON.stringify({ ceremony: 'register', userId }),
    ],
    ['similar-email', 'x' + email, 'keep'],
    ['similar-id', 'reset-password:other', userId + 'x'],
    [
      'json-other',
      'passkey-challenge:other',
      JSON.stringify({ userId: userId + 'x', note: userId }),
    ],
    ['malformed', 'passkey-challenge:bad', '{"userId":"' + userId + '"'],
    ['substring', 'prefix:' + userId + ':suffix', 'keep'],
  ]
  for (const [id, identifier, value] of rows)
    await h.db.insert(verification).values({
      id: id ?? '',
      identifier: identifier ?? '',
      value: value ?? '',
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  for (const t of [a, b])
    await h.db.insert(session).values({
      id: t.organizationId,
      token: t.organizationId,
      userId: t.ownerUserId,
      impersonatedBy: userId,
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  await h.db.insert(session).values({
    id: 'unrelated',
    token: 'unrelated',
    userId: b.ownerUserId,
    impersonatedBy: 'other',
    expiresAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  await expect(
    eraseAccountAuthLeftovers(h.db, actor, { userId, email }, async () => {
      throw new Error('manifest failed')
    }),
  ).rejects.toThrow('manifest failed')
  expect(await h.db.select().from(session)).toHaveLength(3)
  const tokens: string[] = []
  await eraseAccountAuthLeftovers(
    h.db,
    actor,
    { userId, email },
    async (values) => {
      tokens.push(...values)
    },
  )
  expect(tokens.sort()).toEqual([a.organizationId, b.organizationId].sort())
  expect(
    (await h.db.select().from(verification)).map((r) => r.id).sort(),
  ).toEqual([
    'json-other',
    'malformed',
    'similar-email',
    'similar-id',
    'substring',
  ])
  expect((await h.db.select().from(session)).map((r) => r.id)).toEqual([
    'unrelated',
  ])
  await eraseAccountAuthLeftovers(
    h.db,
    actor,
    { userId, email },
    async () => {},
  )
})
it('revokes and anonymises owned tokens, anonymises issuer only on another holder token, preserves ledger and counts remaining references', async () => {
  const a = await h.seedTenant('a'),
    userId = a.ownerUserId
  for (const [id, holder, issuer] of [
    ['own', userId, 'other'],
    ['issued', 'other', userId],
    ['both', userId, userId],
    ['unrelated', 'other', 'other'],
  ])
    await h.db.insert(staffApiTokens).values({
      id: id ?? '',
      userId: holder ?? '',
      createdBy: issuer ?? '',
      name: 'token',
      tokenHash: id ?? '',
      tokenPrefix: 'prefix',
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  await h.db.insert(providerRegistry).values({
    id: 'provider',
    slug: 'provider',
    label: 'Provider',
    updatedBy: userId,
  })
  await h.db.insert(platformAuditLog).values({
    id: 'ledger',
    actorKind: 'agent',
    actorRole: 'admin',
    actorUserId: userId,
    tokenId: 'own',
    action: 'platform.user.updated',
    entityType: 'user',
    entityId: userId,
  })
  const before = await h.db.select().from(platformAuditLog)
  expect(
    (await countPlatformUserReferences(h.db, actor, userId)).map(
      (r) => r.count,
    ),
  ).toEqual([2, 2, 1])
  await erasePlatformUserReferences(h.db, actor, userId, 'erased_platform')
  await erasePlatformUserReferences(h.db, actor, userId, 'erased_platform')
  const tokens = await h.db.select().from(staffApiTokens)
  expect(tokens.find((r) => r.id === 'own')).toMatchObject({
    userId: 'erased_platform',
    createdBy: 'other',
    revokedAt: expect.any(Date),
  })
  expect(tokens.find((r) => r.id === 'issued')).toMatchObject({
    userId: 'other',
    createdBy: 'erased_platform',
    revokedAt: null,
  })
  expect(tokens.find((r) => r.id === 'both')).toMatchObject({
    userId: 'erased_platform',
    createdBy: 'erased_platform',
    revokedAt: expect.any(Date),
  })
  expect(tokens.find((r) => r.id === 'unrelated')).toMatchObject({
    userId: 'other',
    createdBy: 'other',
    revokedAt: null,
  })
  expect(
    (await countPlatformUserReferences(h.db, actor, userId)).every(
      (r) => r.count === 0,
    ),
  ).toBe(true)
  expect(await h.db.select().from(platformAuditLog)).toEqual(before)
})
it('rejects non-system actors and missing identity before a query', async () => {
  const bad: PlatformActor = {
    actorKind: 'human',
    userId: 'staff',
    role: 'admin',
    tokenId: null,
  }
  h.statements.length = 0
  await expect(
    erasePlatformUserReferences(h.db, bad, 'person', 'erased_one'),
  ).rejects.toThrow()
  await expect(
    eraseWorkspaceInvitations(h.db, bad, 'org', 'person@example.test'),
  ).rejects.toThrow()
  await expect(
    eraseAccountAuthLeftovers(
      h.db,
      bad,
      { userId: 'person', email: 'person@example.test' },
      async () => {},
    ),
  ).rejects.toThrow()
  await expect(
    countPlatformUserReferences(h.db, bad, 'person'),
  ).rejects.toThrow()
  await expect(
    eraseAccountAuthLeftovers(
      h.db,
      actor,
      { userId: 'person', email: '' },
      async () => {},
    ),
  ).rejects.toThrow()
  expect(h.statements).toEqual([])
})

it('cleans auth and platform rows beyond one batch and leaves another identity intact', async () => {
  const a = await h.seedTenant('a')
  const userId = a.ownerUserId
  for (let i = 0; i < 105; i++) {
    await h.db.insert(verification).values({
      id: `v${i}`,
      identifier: `reset-password:${i}`,
      value: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(),
    })
    await h.db.insert(session).values({
      id: `s${i}`,
      token: `token${i}`,
      userId,
      impersonatedBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(),
    })
    await h.db.insert(staffApiTokens).values({
      id: `t${i}`,
      userId,
      createdBy: userId,
      name: 'Token',
      tokenHash: `hash${i}`,
      tokenPrefix: 'prefix',
      expiresAt: new Date(),
    })
  }
  const saved: string[] = []
  await eraseAccountAuthLeftovers(
    h.db,
    actor,
    { userId, email: 'person@example.test' },
    async (tokens) => {
      saved.push(...tokens)
    },
  )
  await erasePlatformUserReferences(h.db, actor, userId, 'erased_platform')
  expect(saved).toHaveLength(105)
  expect(await h.db.select().from(session)).toEqual([])
  expect(await h.db.select().from(verification)).toEqual([])
  const tokens = await h.db.select().from(staffApiTokens)
  expect(tokens).toHaveLength(105)
  expect(
    tokens.every(
      (row) =>
        row.userId === 'erased_platform' &&
        row.createdBy === 'erased_platform' &&
        row.revokedAt !== null,
    ),
  ).toBe(true)
})
