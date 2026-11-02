import { eq } from 'drizzle-orm'
import { beforeEach, expect, it, vi } from 'vitest'
import { member } from '#/server/db/auth-schema'
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
    ).rejects.toThrow('shell.session.workspaceChanged')
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

it('denies a room refresh after active membership removal even when another membership survives', async () => {
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
      activeOrganizationId: a.organizationId,
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
})

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
