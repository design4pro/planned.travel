import { eq } from 'drizzle-orm'
import { beforeEach, expect, it, vi } from 'vitest'
import { member } from '#/server/db/auth-schema'
import { createHarness } from '#/server/repos/__tests__/harness'
import { normaliseSession } from '../tenant'
import type { AuthDb } from '../db'
import type { AuthSession } from '../tenant'

const shared = vi.hoisted(() => ({
  db: null as AuthDb | null,
  session: null as AuthSession | null,
  createScope: vi.fn(),
}))
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({ handler: (fn: unknown) => fn }),
}))
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => new Request('http://localhost/'),
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

beforeEach(() => vi.clearAllMocks())

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
