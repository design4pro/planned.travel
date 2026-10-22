import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WORKSPACE_CLAIM_HEADER } from '#/lib/workspace-claim'
import { member, organization } from '#/server/db/auth-schema'
import { createHarness } from '#/server/repos/__tests__/harness'
import { resolveActiveWorkspace } from '../active-workspace'
import { requireOrg } from '../session'
import { normaliseSession, requireOrgFrom } from '../tenant'
import type { AuthDb } from '../db'
import type { Harness } from '#/server/repos/__tests__/harness'

const shared = vi.hoisted(() => ({
  db: null as AuthDb | null,
  session: {} as {
    user?: Record<string, unknown>
    session?: Record<string, unknown>
  },
  claim: null as string | null,
}))
vi.mock('../db', () => ({ authDb: () => shared.db }))
vi.mock('../index', () => ({
  getAuth: () => ({ api: { getSession: async () => shared.session } }),
}))
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () =>
    new Request('http://localhost/', {
      headers:
        shared.claim === null ? {} : { [WORKSPACE_CLAIM_HEADER]: shared.claim },
    }),
}))

function requestSession(userId: string, activeOrganizationId: string | null) {
  shared.session = {
    user: { id: userId, email: 'person@example.test' },
    session: {
      id: 'session',
      token: 'token',
      expiresAt: new Date('2030-01-01'),
      activeOrganizationId,
    },
  }
  return normaliseSession({
    user: shared.session.user ?? {},
    session: shared.session.session ?? {},
  })
}

let harness: Harness
let db: AuthDb
beforeEach(async () => {
  shared.claim = null
  harness = await createHarness()
  db = harness.db as unknown as AuthDb
  shared.db = db
})

async function fixture() {
  const a = await harness.seedTenant('a')
  const b = await harness.seedTenant('b')
  const c = await harness.seedTenant('c')
  await db
    .update(member)
    .set({ role: 'member', createdAt: new Date(1000) })
    .where(eq(member.userId, a.ownerUserId))
  await db.insert(member).values({
    id: 'later-membership',
    userId: a.ownerUserId,
    organizationId: c.organizationId,
    role: 'admin',
    createdAt: new Date(2000),
  })
  return { a, b, c }
}

describe('resolveActiveWorkspace', () => {
  it('keeps an active membership and reads its current role', async () => {
    const { a, c } = await fixture()
    expect(
      await resolveActiveWorkspace(db, a.ownerUserId, c.organizationId),
    ).toEqual({ organizationId: c.organizationId, role: 'admin' })
  })

  it('falls back to the oldest surviving membership with its own role, excluding other users', async () => {
    const { a, b } = await fixture()
    expect(
      await resolveActiveWorkspace(db, a.ownerUserId, b.organizationId),
    ).toEqual({ organizationId: a.organizationId, role: 'member' })
  })

  it('returns none after the only membership is removed and creates nothing', async () => {
    const { b } = await fixture()
    await db.delete(member).where(eq(member.userId, b.ownerUserId))
    const organizations = await db.select().from(organization)
    const members = await db.select().from(member)
    expect(
      await resolveActiveWorkspace(db, b.ownerUserId, b.organizationId),
    ).toBeNull()
    expect(await db.select().from(organization)).toEqual(organizations)
    expect(await db.select().from(member)).toEqual(members)
  })

  it('refuses a pinned removed workspace after falling back', async () => {
    const { a, b } = await fixture()
    const resolved = await resolveActiveWorkspace(
      db,
      a.ownerUserId,
      b.organizationId,
    )
    const session = requestSession(
      a.ownerUserId,
      resolved?.organizationId ?? null,
    )
    expect(() =>
      requireOrgFrom(session, resolved?.role ?? null, {
        organizationId: b.organizationId,
      }),
    ).toThrow(expect.objectContaining({ reason: 'not-a-member' }))
    expect(
      requireOrgFrom(session, resolved?.role ?? null, { role: 'member' })
        .organizationId,
    ).toBe(a.organizationId)
  })

  it('resolves a null active workspace without provisioning', async () => {
    const { a, b } = await fixture()
    expect(await resolveActiveWorkspace(db, a.ownerUserId, null)).toEqual({
      organizationId: a.organizationId,
      role: 'member',
    })
    await db.delete(member).where(eq(member.userId, b.ownerUserId))
    const organizations = await db.select().from(organization)
    expect(await resolveActiveWorkspace(db, b.ownerUserId, null)).toBeNull()
    expect(await db.select().from(organization)).toEqual(organizations)
  })
})

describe('requireOrg request resolution', () => {
  it('uses the surviving workspace and refuses a pin to the removed workspace without changing the session', async () => {
    const { a, b } = await fixture()
    requestSession(a.ownerUserId, b.organizationId)
    await expect(requireOrg()).resolves.toEqual({
      userId: a.ownerUserId,
      organizationId: a.organizationId,
      role: 'member',
      impersonatedBy: null,
    })
    await expect(
      requireOrg({ organizationId: b.organizationId }),
    ).rejects.toMatchObject({ reason: 'not-a-member' })
    expect(shared.session.session?.activeOrganizationId).toBe(b.organizationId)
  })

  it('carries the operator of an impersonated session onto the context', async () => {
    const { a } = await fixture()
    requestSession(a.ownerUserId, a.organizationId)
    shared.session = {
      ...shared.session,
      session: {
        ...shared.session.session,
        impersonatedBy: 'usr_operator',
        // An impersonated session only authorises inside its first 900 seconds (docs/ACCESS.md §6.2).
        createdAt: new Date(),
      },
    }

    await expect(requireOrg()).resolves.toMatchObject({
      userId: a.ownerUserId,
      impersonatedBy: 'usr_operator',
    })
  })

  it('refuses a removed only membership without provisioning, but still provisions for null active workspace', async () => {
    const { b } = await fixture()
    await db.delete(member).where(eq(member.userId, b.ownerUserId))
    const organizations = await db.select().from(organization)
    requestSession(b.ownerUserId, b.organizationId)
    await expect(requireOrg()).rejects.toMatchObject({ reason: 'not-a-member' })
    expect(await db.select().from(organization)).toEqual(organizations)
    requestSession(b.ownerUserId, null)
    await expect(requireOrg()).resolves.toMatchObject({
      userId: b.ownerUserId,
      role: 'owner',
    })
    expect(await db.select().from(organization)).toHaveLength(
      organizations.length + 1,
    )
  })
})

describe('requireOrg with the workspace claim header', () => {
  it('answers as before when the tab names the workspace the session resolves to', async () => {
    const { a } = await fixture()
    requestSession(a.ownerUserId, a.organizationId)
    shared.claim = a.organizationId
    await expect(requireOrg()).resolves.toMatchObject({
      organizationId: a.organizationId,
    })
  })

  it("refuses a tab whose workspace is not the session's, with nothing read or written", async () => {
    const { a, c } = await fixture()
    // Another tab switched to `c`; this tab still believes it is in `a`.
    requestSession(a.ownerUserId, c.organizationId)
    shared.claim = a.organizationId
    const organizations = await db.select().from(organization)
    const members = await db.select().from(member)

    await expect(requireOrg()).rejects.toMatchObject({
      reason: 'workspace-changed',
      status: 403,
    })

    expect(await db.select().from(organization)).toEqual(organizations)
    expect(await db.select().from(member)).toEqual(members)
  })

  it('does not provision a workspace for a call that states one, then refuse it', async () => {
    const { b } = await fixture()
    await db.delete(member).where(eq(member.userId, b.ownerUserId))
    requestSession(b.ownerUserId, null)
    shared.claim = b.organizationId
    const organizations = await db.select().from(organization)
    const members = await db.select().from(member)

    await expect(requireOrg()).rejects.toMatchObject({
      reason: 'workspace-changed',
      status: 403,
    })

    expect(await db.select().from(organization)).toEqual(organizations)
    expect(await db.select().from(member)).toEqual(members)
  })

  it('still adopts the oldest membership for a session with no active workspace when the claim names it', async () => {
    const { a } = await fixture()
    requestSession(a.ownerUserId, null)
    shared.claim = a.organizationId

    await expect(requireOrg()).resolves.toMatchObject({
      organizationId: a.organizationId,
    })
  })

  it("cannot be switched off by a caller's own options", async () => {
    const { a, c } = await fixture()
    requestSession(a.ownerUserId, c.organizationId)
    shared.claim = a.organizationId

    await expect(requireOrg({ claim: null })).rejects.toMatchObject({
      reason: 'workspace-changed',
    })
  })

  it('refuses a claim for a workspace the caller is not a member of, without the role check', async () => {
    const { a, b } = await fixture()
    requestSession(a.ownerUserId, a.organizationId)
    shared.claim = b.organizationId

    await expect(requireOrg()).rejects.toMatchObject({
      reason: 'workspace-changed',
      status: 403,
    })
  })

  it('compares against the workspace the request resolves to, not the stale session value', async () => {
    const { a, b } = await fixture()
    // The session still points at `b`, where the membership was removed: the request falls back to `a`.
    await db.delete(member).where(eq(member.userId, b.ownerUserId))
    requestSession(a.ownerUserId, b.organizationId)

    shared.claim = a.organizationId
    await expect(requireOrg()).resolves.toMatchObject({
      organizationId: a.organizationId,
    })
    shared.claim = b.organizationId
    await expect(requireOrg()).rejects.toMatchObject({
      reason: 'workspace-changed',
    })
  })

  it('refuses a malformed claim instead of ignoring it', async () => {
    const { a } = await fixture()
    requestSession(a.ownerUserId, a.organizationId)
    shared.claim = 'a b'
    await expect(requireOrg()).rejects.toMatchObject({
      reason: 'workspace-changed',
    })
  })

  it('never lets a claim choose the workspace for a session that has none', async () => {
    const { a } = await fixture()
    requestSession(a.ownerUserId, null)
    // The fallback adopts the oldest membership; a claim for a different workspace is refused, not obeyed.
    shared.claim = 'someone-elses-workspace'
    await expect(requireOrg()).rejects.toMatchObject({
      reason: 'workspace-changed',
    })
  })
})
