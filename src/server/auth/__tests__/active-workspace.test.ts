import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { guardMemberDeletion } from '../member-deletion'
import { departMember } from '#/server/fns/member-departure-writes'
import { auditLogRepository } from '#/server/repos/audit'
import { listAuditLog, listMembers } from '#/server/repos'
import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WORKSPACE_CLAIM_HEADER } from '#/lib/workspace-claim'
import { authSchema, member, organization } from '#/server/db/auth-schema'
import { createHarness } from '#/server/repos/__tests__/harness'
import { resolveActiveWorkspace } from '../active-workspace'
import { requireOrg } from '../session'
import { normaliseSession, requireOrgFrom } from '../tenant'
import type { BatchStatement } from '#/server/repos/batch'
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
  getAuth: () => ({
    api: {
      getSession: async () => (shared.session.user ? shared.session : null),
    },
  }),
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

  it('recovers a removed only membership and reuses the personal workspace on reload', async () => {
    const { b } = await fixture()
    await db.delete(member).where(eq(member.userId, b.ownerUserId))
    const organizations = await db.select().from(organization)
    requestSession(b.ownerUserId, b.organizationId)
    const recovered = await requireOrg()
    expect(recovered.organizationId).not.toBe(b.organizationId)
    expect(await requireOrg()).toEqual(recovered)
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

describe('final departure followed by authenticated reload', () => {
  it.each([false, true])(
    'recovers authoritative state after unknown commit, committed=%s',
    async (committed) => {
      const tenant = await harness.seedTenant('departure-reload')
      const self = await tenant.addUser('Leaver', 'member')
      const scope = tenant.scopeFor(self, 'member')
      requestSession(self, tenant.organizationId)
      const adapter = guardMemberDeletion(
        drizzleAdapter(harness.db, { provider: 'sqlite', schema: authSchema })(
          {},
        ),
      )
      const batchDb = harness.db as typeof harness.db & {
        batch: (
          statements: readonly [BatchStatement, ...Array<BatchStatement>],
        ) => Promise<Array<unknown>>
      }
      const original = batchDb.batch.bind(batchDb)
      const batch = vi
        .spyOn(batchDb, 'batch')
        .mockImplementation(async (...args) => {
          if (committed) await original(...args)
          throw new Error('batch response unavailable')
        })
      const lookup = vi
        .spyOn(auditLogRepository, 'findById')
        .mockRejectedValue(new Error('audit unavailable'))
      const repair = vi.fn(async () => {})
      const activate = vi.fn(async () => {})
      const remove = vi.fn(async (_organizationId: string, id: string) =>
        adapter.delete({
          model: 'member',
          where: [{ field: 'id', value: id }],
        }),
      )
      try {
        await expect(
          departMember(
            {
              impersonated: false,
              scope: async () => scope,
              remove,
              repairOffboarding: repair,
              activateRemaining: activate,
            },
            {},
          ),
        ).rejects.toMatchObject({ code: 'MEMBERSHIP_COMMIT_UNKNOWN' })
      } finally {
        batch.mockRestore()
        lookup.mockRestore()
      }
      expect(remove).toHaveBeenCalledTimes(1)
      expect(activate).not.toHaveBeenCalled()
      expect(repair).toHaveBeenCalledExactlyOnceWith(
        self,
        tenant.organizationId,
      )
      const count = (await db.select().from(organization)).length
      const recovered = await requireOrg()
      expect(recovered).toMatchObject({
        userId: self,
        role: committed ? 'owner' : 'member',
      })
      expect(recovered.organizationId === tenant.organizationId).toBe(
        !committed,
      )
      expect(await requireOrg()).toEqual(recovered)
      expect(await db.select().from(organization)).toHaveLength(
        count + Number(committed),
      )
      expect((await listAuditLog(tenant.scope)).items).toHaveLength(
        Number(committed),
      )
      expect(
        (await listMembers(tenant.scope)).some((row) => row.userId === self),
      ).toBe(!committed)
      expect(remove).toHaveBeenCalledTimes(1)
    },
  )

  it.each(['claim', 'malformed', 'pin', 'impersonated', 'banned'] as const)(
    'does not provision on %s',
    async (refusal) => {
      const { b } = await fixture()
      await db.delete(member).where(eq(member.userId, b.ownerUserId))
      requestSession(b.ownerUserId, b.organizationId)
      const count = (await db.select().from(organization)).length
      if (refusal === 'claim') shared.claim = b.organizationId
      if (refusal === 'malformed') shared.claim = 'a b'
      if (refusal === 'impersonated' && shared.session.session) {
        shared.session.session.impersonatedBy = 'operator'
        shared.session.session.createdAt = new Date()
      }
      if (refusal === 'banned' && shared.session.user)
        shared.session.user.banned = true
      await expect(
        requireOrg(
          refusal === 'pin' ? { organizationId: b.organizationId } : {},
        ),
      ).rejects.toMatchObject({
        reason:
          refusal === 'claim' || refusal === 'malformed'
            ? 'workspace-changed'
            : 'not-a-member',
      })
      expect(await db.select().from(organization)).toHaveLength(count)
    },
  )

  it('propagates an unavailable membership read without provisioning', async () => {
    const { b } = await fixture()
    await db.delete(member).where(eq(member.userId, b.ownerUserId))
    requestSession(b.ownerUserId, b.organizationId)
    const count = (await db.select().from(organization)).length
    const read = vi.spyOn(db, 'select').mockImplementationOnce(() => {
      throw new Error('membership read unavailable')
    })
    await expect(requireOrg()).rejects.toThrow('membership read unavailable')
    read.mockRestore()
    expect(await db.select().from(organization)).toHaveLength(count)
  })

  it('refuses an anonymous reload without reading or provisioning', async () => {
    shared.session = {}
    const read = vi.spyOn(db, 'select')
    try {
      await expect(requireOrg()).rejects.toMatchObject({
        reason: 'unauthenticated',
      })
      expect(read).not.toHaveBeenCalled()
    } finally {
      read.mockRestore()
    }
  })
})
