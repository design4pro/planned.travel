import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { WORKSPACE_CLAIM_HEADER } from '#/lib/workspace-claim'
import { member, session } from '#/server/db/auth-schema'
import { AuthRequirementError } from '#/server/auth/tenant'
import { createSessionKv } from '../console/__tests__/real-auth'
import { createHarness } from '#/server/repos/__tests__/harness'
import { createLogger, createMemorySink } from '#/server/observability'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { SessionKv } from '../console/__tests__/real-auth'

const shared = vi.hoisted(() => ({
  request: new Request('http://localhost:3000'),
  db: null as Harness['db'] | null,
  sessions: null as SessionKv | null,
  cache: { get: vi.fn(), put: vi.fn() },
  outbound: vi.fn(),
  fetch: vi.fn(),
}))

// Node has no Start compiler: replace RPC transport, retaining the registered handler and schema.
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    validator: (schema: { parse: (data: unknown) => unknown }) => ({
      handler:
        (fn: (options: { data: unknown }) => unknown) =>
        (options: { data: unknown }) =>
          fn({ data: schema.parse(options.data) }),
    }),
  }),
}))
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => shared.request,
}))
// Worker bindings/storage and email delivery are faked; auth, cookies, scope and rate policy are real.
vi.mock('cloudflare:workers', () => ({ env: { KV: shared.cache } }))
vi.mock('#/server/auth/env', () => ({
  APP_NAME: 'planned.travel',
  appUrl: () => 'http://localhost:3000',
  appleBundleIdentifier: () => undefined,
  appleCredentials: () => null,
  authSecret: () => 'test-secret-not-used-outside-this-process',
  d1: () => ({}),
  googleCredentials: () => null,
  relyingPartyId: () => 'localhost',
  sessionStore: () => shared.sessions,
  taskQueue: () => ({ send: async () => {} }),
  trustedOrigins: () => ['http://localhost:3000'],
}))
vi.mock('#/server/auth/db', () => ({
  authDb: () => shared.db,
  authRepositoryDb: () => shared.db,
}))
vi.mock('#/server/db/client', () => ({ getDb: () => shared.db }))
vi.mock('#/server/auth/email', () => ({ queueAuthEmail: async () => {} }))
vi.mock('#/server/metering/bindings', () => ({
  requestOutboundRuntime: shared.outbound,
}))
const { getAuth } = await import('#/server/auth')
const { getPublicRatesFn } = await import('../public-rates')

let harness: Harness
let foreign: SeededTenant
let cookie: string
let current: NonNullable<
  Awaited<ReturnType<ReturnType<typeof getAuth>['api']['getSession']>>
>

beforeAll(async () => {
  harness = await createHarness()
  shared.db = harness.db
  shared.sessions = createSessionKv()
})
afterAll(() => {
  vi.unstubAllGlobals()
  harness.close()
})
beforeEach(async () => {
  vi.clearAllMocks()
  shared.sessions!.clear()
  const response = await getAuth().handler(
    new Request('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        name: 'Rates reader',
        email: `${crypto.randomUUID()}@example.test`,
        password: 'correct-horse-battery-staple',
      }),
    }),
  )
  expect(response.status).toBe(200)
  cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ')
  const resolved = await getAuth().api.getSession({
    headers: new Headers({ cookie }),
  })
  if (!resolved?.session.activeOrganizationId)
    throw new Error('Sign-up did not create an active workspace')
  current = resolved
  foreign = await harness.seedTenant('foreign')
  const now = Date.now()
  shared.cache.get.mockImplementation(async (key: string) =>
    key.endsWith(':latest')
      ? JSON.stringify({
          version: 1,
          provider: 'frankfurter-ecb',
          source: 'ECB',
          base: 'EUR',
          effectiveOn: new Date(now).toISOString().slice(0, 10),
          fetchedAt: now,
          rates: { EUR: 1, USD: 1.25 },
        })
      : null,
  )
  shared.outbound.mockReturnValue({
    db: harness.db,
    now: () => new Date(),
    logger: createLogger({ sink: createMemorySink() }),
    waitUntil: () => {
      throw new Error('Warm public cache must not schedule provider work')
    },
  })
  vi.stubGlobal('fetch', shared.fetch)
})

function call(claim: string, authenticated = true) {
  shared.request = new Request('http://localhost:3000/_serverFn/rates', {
    method: 'POST',
    headers: {
      [WORKSPACE_CLAIM_HEADER]: claim,
      ...(authenticated ? { cookie } : {}),
    },
  })
  return getPublicRatesFn({ data: {} })
}

async function expectRefusal(
  read: Promise<unknown>,
  reason: 'unauthenticated' | 'workspace-changed',
) {
  await expect(read).rejects.toBeInstanceOf(AuthRequirementError)
  await expect(read).rejects.toMatchObject({
    reason,
    status: reason === 'unauthenticated' ? 401 : 403,
  })
  expect(shared.cache.get).not.toHaveBeenCalled()
  expect(shared.cache.put).not.toHaveBeenCalled()
  expect(shared.outbound).not.toHaveBeenCalled()
  expect(shared.fetch).not.toHaveBeenCalled()
}

it('refuses an anonymous request before reading a warm public cache', async () => {
  await expectRefusal(
    call(current.session.activeOrganizationId!, false),
    'unauthenticated',
  )
})

it.each(['KV', 'database'])(
  'refuses a genuinely expired session read from %s',
  async (source) => {
    const expiresAt = new Date(Date.now() - 1000)
    await harness.db
      .update(session)
      .set({ expiresAt })
      .where(eq(session.id, current.session.id))
    if (source === 'KV') {
      shared.sessions!.store.set(
        current.session.token,
        JSON.stringify({
          ...current,
          session: { ...current.session, expiresAt },
        }),
      )
    } else {
      shared.sessions!.store.delete(current.session.token)
    }
    await expectRefusal(
      call(current.session.activeOrganizationId!),
      'unauthenticated',
    )
  },
)

it.each([false, true])(
  'refuses removed membership with surviving membership=%s',
  async (survives) => {
    const organizationId = current.session.activeOrganizationId!
    if (survives) await foreign.addMembership(current.user.id)
    await harness.db
      .delete(member)
      .where(
        and(
          eq(member.userId, current.user.id),
          eq(member.organizationId, organizationId),
        ),
      )
    await expectRefusal(call(organizationId), 'workspace-changed')
  },
)

it('refuses a foreign workspace claim instead of choosing it for the caller', async () => {
  await expectRefusal(call(foreign.organizationId), 'workspace-changed')
})

it('refuses a stale tab claim after the session switches to another valid membership', async () => {
  await foreign.addMembership(current.user.id)
  await getAuth().api.setActiveOrganization({
    headers: new Headers({ cookie }),
    body: { organizationId: foreign.organizationId },
  })
  await expectRefusal(
    call(current.session.activeOrganizationId!),
    'workspace-changed',
  )
})

it('allows the same public snapshot in two valid workspaces after a session switch', async () => {
  await foreign.addMembership(current.user.id, 'member')
  const first = await call(current.session.activeOrganizationId!)
  expect(first).toMatchObject({
    status: 'available',
    snapshot: { rates: { EUR: 1, USD: 1.25 } },
  })
  await getAuth().api.setActiveOrganization({
    headers: new Headers({ cookie }),
    body: { organizationId: foreign.organizationId },
  })
  const second = await call(foreign.organizationId)
  expect(second).toEqual(first)
  expect(shared.cache.get).toHaveBeenCalledTimes(4)
  expect(shared.cache.put).not.toHaveBeenCalled()
  expect(shared.fetch).not.toHaveBeenCalled()
  for (const privateId of [
    current.user.id,
    current.session.activeOrganizationId,
    foreign.organizationId,
  ]) {
    expect(
      JSON.stringify([first, second, shared.cache.get.mock.calls]),
    ).not.toContain(privateId)
  }
})
