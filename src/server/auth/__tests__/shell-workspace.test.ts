import { eq } from 'drizzle-orm'
import { beforeEach, expect, it, vi } from 'vitest'
import { workspaceParticipants } from '#/server/db/schema'
import { member, organization } from '#/server/db/auth-schema'
import { createHarness } from '#/server/repos/__tests__/harness'
import { normaliseSession } from '../tenant'
import type { AuthDb } from '../db'
import type { AuthSession } from '../tenant'

const shared = vi.hoisted(() => ({
  claim: null as string | null,
  db: null as AuthDb | null,
  session: null as AuthSession | null,
  createScope: vi.fn(),
}))
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    validator: () => ({
      handler:
        (
          fn: (options: { data?: { preserveWorkspace?: boolean } }) => unknown,
        ) =>
        (options = {}) =>
          fn(options),
    }),
  }),
}))
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () =>
    new Request('http://localhost/', {
      headers: shared.claim ? { 'x-planned-workspace': shared.claim } : {},
    }),
}))
vi.mock('#/server/auth', () => ({
  getAuth: () => ({ api: { listOrganizations: async () => [] } }),
}))
vi.mock('#/server/auth/db', () => ({ authDb: () => shared.db }))
vi.mock('#/server/auth/session', () => ({
  getSession: async () => shared.session,
}))
vi.mock('#/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('#/server/repos', () => ({
  createScope: shared.createScope,
  getOrganization: async () => ({
    id: 'surviving',
    name: 'Surviving',
    slug: 'surviving',
  }),
  countUnread: async () => 0,
  getEffectiveSettings: async () => ({ mapStyle: 'default' }),
}))
const { loadShell } = await import('#/routes/_app/-server/shell')

beforeEach(() => {
  vi.clearAllMocks()
  shared.claim = null
})

it('the shell uses the surviving membership and its role', async () => {
  const harness = await createHarness()
  shared.db = harness.db as unknown as AuthDb
  const a = await harness.seedTenant('survivor')
  await shared.db
    .update(member)
    .set({ role: 'member' })
    .where(eq(member.userId, a.ownerUserId))
  shared.session = normaliseSession({
    user: { id: a.ownerUserId, email: 'person@example.test' },
    session: {
      id: 'session',
      token: 'token',
      expiresAt: new Date('2030-01-01'),
      activeOrganizationId: 'removed',
    },
  })
  await expect(loadShell()).resolves.toMatchObject({ role: 'member' })
  expect(shared.createScope).toHaveBeenCalledWith(expect.anything(), {
    userId: a.ownerUserId,
    organizationId: a.organizationId,
    role: 'member',
    impersonatedBy: null,
  })
})

it('parallel shell loads after deletion recover exactly one workspace, owner and anchor', async () => {
  const harness = await createHarness()
  shared.db = harness.db as unknown as AuthDb
  const tenant = await harness.seedTenant('deleted')
  await shared.db
    .delete(organization)
    .where(eq(organization.id, tenant.organizationId))
  shared.session = normaliseSession({
    user: { id: tenant.ownerUserId, email: 'person@example.test' },
    session: {
      id: 'session',
      token: 'token',
      expiresAt: new Date('2030-01-01'),
      activeOrganizationId: tenant.organizationId,
    },
  })
  const results = await Promise.all(
    Array.from({ length: 8 }, () => loadShell()),
  )
  for (const result of results) expect(result).toMatchObject({ role: 'owner' })
  const memberships = await shared.db.select().from(member)
  expect(memberships).toHaveLength(1)
  for (const call of shared.createScope.mock.calls) {
    expect(call[1]).toMatchObject({
      organizationId: memberships[0].organizationId,
      userId: tenant.ownerUserId,
      role: 'owner',
    })
  }
  expect(await shared.db.select().from(organization)).toHaveLength(1)
  expect(await harness.db.select().from(workspaceParticipants)).toHaveLength(1)
  await expect(loadShell()).resolves.toMatchObject({ role: 'owner' })
  expect(await shared.db.select().from(organization)).toHaveLength(1)
})

it('the shell recovers a stale or empty workspace and reuses the personal membership', async () => {
  const harness = await createHarness()
  shared.db = harness.db as unknown as AuthDb
  const a = await harness.seedTenant('removed')
  await shared.db.delete(member).where(eq(member.userId, a.ownerUserId))
  shared.session = normaliseSession({
    user: { id: a.ownerUserId, email: 'person@example.test' },
    session: {
      id: 'session',
      token: 'token',
      expiresAt: new Date('2030-01-01'),
      activeOrganizationId: a.organizationId,
    },
  })
  await expect(loadShell()).resolves.toMatchObject({ role: 'owner' })
  if (!shared.session) throw new Error('Missing fixture session')
  shared.session.session.activeOrganizationId = null
  await expect(loadShell()).resolves.toMatchObject({ role: 'owner' })
  expect(await shared.db.select().from(member)).toHaveLength(1)
  expect(shared.createScope).toHaveBeenCalledTimes(2)
})

it.each([false, true])(
  'refuses a room shell refresh before tenant reads (cleared active workspace: %s)',
  async (cleared) => {
    const harness = await createHarness()
    shared.db = harness.db as unknown as AuthDb
    const a = await harness.seedTenant('A')
    const b = await harness.seedTenant('B')
    shared.claim = a.organizationId
    shared.session = normaliseSession({
      user: { id: b.ownerUserId, email: 'person@example.test' },
      session: {
        id: 'session',
        token: 'token',
        expiresAt: new Date('2030-01-01'),
        activeOrganizationId: cleared ? null : b.organizationId,
      },
    })
    await expect(
      loadShell({ data: { preserveWorkspace: true } }),
    ).rejects.toThrow(
      cleared
        ? 'shell.session.membershipRemoved'
        : 'shell.session.workspaceChanged',
    )
    expect(shared.createScope).not.toHaveBeenCalled()
  },
)

it('allows an explicit navigation to adopt the session workspace even with an old claim', async () => {
  const harness = await createHarness()
  shared.db = harness.db as unknown as AuthDb
  const b = await harness.seedTenant('B')
  shared.claim = 'old-workspace'
  shared.session = normaliseSession({
    user: { id: b.ownerUserId, email: 'person@example.test' },
    session: {
      id: 'session',
      token: 'token',
      expiresAt: new Date('2030-01-01'),
      activeOrganizationId: b.organizationId,
    },
  })
  await expect(loadShell()).resolves.toMatchObject({ role: 'owner' })
  expect(shared.createScope).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ organizationId: b.organizationId }),
  )
  shared.claim = b.organizationId
  await expect(
    loadShell({ data: { preserveWorkspace: true } }),
  ).resolves.toMatchObject({ role: 'owner' })
})

it.each([false, true])(
  'denies a room refresh after membership removal even when another membership survives (null active: %s)',
  async (cleared) => {
    const harness = await createHarness()
    shared.db = harness.db as unknown as AuthDb
    const a = await harness.seedTenant('A')
    const b = await harness.seedTenant('B')
    await shared.db
      .update(member)
      .set({ organizationId: b.organizationId, role: 'member' })
      .where(eq(member.userId, a.ownerUserId))
    shared.claim = a.organizationId
    shared.session = normaliseSession({
      user: { id: a.ownerUserId, email: 'person@example.test' },
      session: {
        id: 'session',
        token: 'token',
        expiresAt: new Date('2030-01-01'),
        activeOrganizationId: cleared ? null : a.organizationId,
      },
    })
    await expect(
      loadShell({ data: { preserveWorkspace: true } }),
    ).rejects.toThrow('shell.session.membershipRemoved')
    expect(shared.createScope).not.toHaveBeenCalled()
    await expect(loadShell()).resolves.toMatchObject({ role: 'member' })
    shared.claim = b.organizationId
    await expect(
      loadShell({ data: { preserveWorkspace: true } }),
    ).resolves.toMatchObject({ role: 'member' })
  },
)

it('refreshes an unchanged effective workspace when the session has no explicit active workspace', async () => {
  const harness = await createHarness()
  shared.db = harness.db as unknown as AuthDb
  const a = await harness.seedTenant('A')
  shared.claim = a.organizationId
  shared.session = normaliseSession({
    user: { id: a.ownerUserId, email: 'person@example.test' },
    session: {
      id: 'session',
      token: 'token',
      expiresAt: new Date('2030-01-01'),
      activeOrganizationId: null,
    },
  })
  await expect(
    loadShell({ data: { preserveWorkspace: true } }),
  ).resolves.toMatchObject({ role: 'owner' })
})

it('keeps mismatch protection when a null-active session still belongs to the displayed workspace', async () => {
  const harness = await createHarness()
  shared.db = harness.db as unknown as AuthDb
  const a = await harness.seedTenant('A')
  const b = await harness.seedTenant('B')
  await shared.db.insert(member).values({
    id: 'second-membership',
    userId: a.ownerUserId,
    organizationId: b.organizationId,
    role: 'member',
    createdAt: new Date('2040-01-01'),
  })
  shared.claim = b.organizationId
  shared.session = normaliseSession({
    user: { id: a.ownerUserId, email: 'person@example.test' },
    session: {
      id: 'session',
      token: 'token',
      expiresAt: new Date('2030-01-01'),
      activeOrganizationId: null,
    },
  })
  await expect(
    loadShell({ data: { preserveWorkspace: true } }),
  ).rejects.toThrow('shell.session.workspaceChanged')
  expect(shared.createScope).not.toHaveBeenCalled()
})

it.each([
  'claim',
  'malformed',
  'banned',
  'impersonated',
  'read-failure',
] as const)(
  'shell recovery refuses %s without provisioning',
  async (refusal) => {
    const harness = await createHarness()
    shared.db = harness.db as unknown as AuthDb
    const tenant = await harness.seedTenant('refused')
    await shared.db
      .delete(organization)
      .where(eq(organization.id, tenant.organizationId))
    shared.session = normaliseSession({
      user: {
        id: tenant.ownerUserId,
        email: 'person@example.test',
        banned: refusal === 'banned',
      },
      session: {
        id: 'session',
        token: 'token',
        expiresAt: new Date('2030-01-01'),
        activeOrganizationId: tenant.organizationId,
        impersonatedBy: refusal === 'impersonated' ? 'operator' : null,
        createdAt: new Date(),
      },
    })
    if (refusal === 'claim') shared.claim = tenant.organizationId
    if (refusal === 'malformed') shared.claim = 'bad claim'
    const read = vi.spyOn(shared.db, 'select')
    if (refusal === 'read-failure')
      read.mockImplementationOnce(() => {
        throw new Error('membership read unavailable')
      })
    try {
      await expect(loadShell()).rejects.toThrow(
        refusal === 'read-failure'
          ? 'membership read unavailable'
          : 'shell.session.membershipRemoved',
      )
    } finally {
      read.mockRestore()
    }
    expect(shared.createScope).not.toHaveBeenCalled()
    expect(await shared.db.select().from(organization)).toHaveLength(0)
    expect(await shared.db.select().from(member)).toHaveLength(0)
    expect(await harness.db.select().from(workspaceParticipants)).toHaveLength(
      0,
    )
  },
)
