import type { AuthDb } from '#/server/auth/db'
import { departMember } from '#/server/fns/member-departure-writes'
import { resolveOrProvisionOrganization } from '#/server/auth/provisioning'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { createSessionKv } from '#/server/fns/console/__tests__/real-auth'

import type { SessionKv } from '#/server/fns/console/__tests__/real-auth'

import { createHarness } from '#/server/repos/__tests__/harness'
import { createScope } from '#/server/repos/base'
import { createTrip } from '#/server/repos/trips'
import { enableFeed } from '#/server/repos/calendar-feeds'
import { serveCalendarFeed } from '#/server/public/calendar-feed'
import { member } from '#/server/db/auth-schema'
import { eq } from 'drizzle-orm'

const BASE_URL = 'http://localhost:3000'
const AUTH_BASE = `${BASE_URL}/api/auth`
const PASSWORD = 'correct-horse-battery-staple'

interface Holder<TValue> {
  current: TValue
}

const shared = vi.hoisted(() => ({
  authDb: { current: null } as Holder<unknown>,
  kv: { current: null } as Holder<unknown>,
  queued: [] as Array<unknown>,
  queueFails: false,
  emails: [] as Array<{ url?: string }>,
}))

vi.mock('#/server/auth/env', () => ({
  APP_NAME: 'planned.travel',
  appUrl: () => BASE_URL,
  appleBundleIdentifier: () => undefined,
  appleCredentials: () => null,
  authSecret: () => 'test-secret-not-used-outside-this-process',
  d1: () => ({}),
  googleCredentials: () => null,
  relyingPartyId: () => 'localhost',
  sessionStore: () => shared.kv.current,
  taskQueue: () => ({
    send: async (body: unknown) => {
      if (shared.queueFails) throw new Error('the queue is unreachable')
      shared.queued.push(body)
    },
    sendBatch: async (messages: Array<{ body: unknown }>) => {
      if (shared.queueFails) throw new Error('the queue is unreachable')
      shared.queued.push(...messages.map((message) => message.body))
    },
  }),
  trustedOrigins: () => [BASE_URL],
}))

vi.mock('#/server/auth/db', () => ({
  authDb: () => shared.authDb.current,
}))

vi.mock('#/server/auth/email', () => ({
  queueAuthEmail: async (message: { url?: string }) => {
    shared.emails.push(message)
  },
}))

const { getAuth } = await import('#/server/auth')

let authDatabase: Awaited<ReturnType<typeof createHarness>>

beforeAll(async () => {
  authDatabase = await createHarness()
  shared.authDb.current = authDatabase.db
  shared.kv.current = createSessionKv()
})

afterAll(() => {
  authDatabase.close()
})

afterEach(() => {
  vi.restoreAllMocks()
})

beforeEach(() => {
  // Keep the same handle: BetterAuth memoizes its adapter. Clear the full schema between cases.
  authDatabase.sqlite.exec('PRAGMA foreign_keys = OFF')
  for (const table of authDatabase.tableNames())
    authDatabase.sqlite.exec(`delete from "${table}"`)
  authDatabase.sqlite.exec('PRAGMA foreign_keys = ON')
  ;(shared.kv.current as SessionKv).clear()
  shared.queued = []
  shared.queueFails = false
  shared.emails = []
})

/* ---------------------------------------------------------------------- fixtures */

interface Person {
  readonly userId: string
  readonly email: string
  headers: Headers
}

/** `platformRole` is set between sign-up and sign-in: the session carries the role it was created with. */
async function signedInPerson(
  name: string,
  platformRole?: string,
): Promise<Person> {
  const email = `${name}@planned.travel`
  const post = (path: string, body: unknown): Promise<Response> =>
    getAuth().handler(
      new Request(`${AUTH_BASE}${path}`, {
        method: 'POST',
        headers: new Headers({
          'content-type': 'application/json',
          origin: BASE_URL,
        }),
        body: JSON.stringify(body),
      }),
    )

  const signUp = await post('/sign-up/email', {
    email,
    password: PASSWORD,
    name,
  })
  if (signUp.status !== 200)
    throw new Error(`sign-up answered ${signUp.status}`)
  if (platformRole !== undefined) {
    authDatabase.sqlite
      .prepare('update user set role = ? where email = ?')
      .run(platformRole, email)
  }
  const signIn = await post('/sign-in/email', { email, password: PASSWORD })
  if (signIn.status !== 200)
    throw new Error(`sign-in answered ${signIn.status}`)

  const cookie = signIn.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0])
    .join('; ')
  const row = authDatabase.sqlite
    .prepare('select id from user where email = ?')
    .get(email) as { id: string }

  return { userId: row.id, email, headers: new Headers({ cookie }) }
}

describe('real BetterAuth offboarding invalidates calendar credentials', () => {
  it.each([['remove', false], ['leave', false], ['leave', true]] as const)(
    'reads current membership after %s (provision=%s) and never revives an old link after re-addition',
    async (action, provision) => {
      const owner = await signedInPerson('owner')
      const leaver = await signedInPerson('leaver')
      if (provision) authDatabase.sqlite.prepare('delete from member where user_id = ?').run(leaver.userId)
      const organizationId = `feed_org_${action}`
      const initial = Date.now() - 1000
      authDatabase.sqlite
        .prepare(
          'insert into organization (id, name, slug, created_at) values (?, ?, ?, ?)',
        )
        .run(organizationId, 'Calendar', organizationId, initial)
      for (const [person, role] of [
        [owner, 'owner'],
        [leaver, 'member'],
      ] as const) {
        authDatabase.sqlite
          .prepare(
            'insert into member (id, organization_id, user_id, role, created_at) values (?, ?, ?, ?, ?)',
          )
          .run(
            `${organizationId}_${role}`,
            organizationId,
            person.userId,
            role,
            initial,
          )
      }
      const ownerScope = createScope(authDatabase.db, {
        organizationId,
        userId: owner.userId,
        role: 'owner',
        impersonatedBy: null,
      })
      const scope = createScope(authDatabase.db, {
        organizationId,
        userId: leaver.userId,
        role: 'member',
        impersonatedBy: null,
      })
      const trip = await createTrip(ownerScope, {
        title: 'Visible before offboarding',
        currency: 'EUR',
        startDate: '2026-10-10',
      })
      authDatabase.sqlite
        .prepare(
          'insert into trip_members (id, organization_id, trip_id, user_id, role, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          `trip_${action}`,
          organizationId,
          trip.id,
          leaver.userId,
          'editor',
          initial,
          initial,
        )
      const feed = await enableFeed(scope, { scope: 'trip', tripId: trip.id })
      const store = new Map<string, string>()
      const pending: Array<Promise<unknown>> = []
      const runtime = {
        db: authDatabase.db,
        baseUrl: BASE_URL,
        store: {
          get: async (key: string) => store.get(key) ?? null,
          put: async (key: string, value: string) => {
            store.set(key, value)
          },
        },
        waitUntil: (promise: Promise<unknown>) => {
          pending.push(promise)
        },
      }
      const request = () =>
        new Request(`${BASE_URL}/api/feed/${feed.secret}.ics`)
      expect((await serveCalendarFeed(request(), runtime)).status).toBe(200)
      await Promise.all(pending)

      const caller = action === 'remove' ? owner : leaver
      await getAuth().api.setActiveOrganization({ headers: caller.headers, body: { organizationId } })
      const outcome = await departMember({
        impersonated: false,
        scope: async () => action === 'remove' ? ownerScope : scope,
        remove: (orgId, memberId, self) => self
          ? getAuth().api.leaveOrganization({ headers: caller.headers, body: { organizationId: orgId } })
          : getAuth().api.removeMember({ headers: caller.headers, body: { organizationId: orgId, memberIdOrEmail: memberId } }),
        repairOffboarding: async () => {}, activateRemaining: async (userId) => {
          const next = await resolveOrProvisionOrganization(shared.authDb.current as AuthDb, userId)
          await getAuth().api.setActiveOrganization({ headers: caller.headers, body: { organizationId: next } })
        },
      }, { memberId: `${organizationId}_member` })
      expect(outcome).toEqual({ ok: true, left: action === 'leave', activationFailed: false })
      const session = await getAuth().api.getSession({ headers: caller.headers })
      if (action === 'leave') {
        expect(session?.session.activeOrganizationId).toBeTruthy()
        expect(session?.session.activeOrganizationId).not.toBe(organizationId)
        const active = authDatabase.sqlite.prepare('select role from member where user_id = ? and organization_id = ?').get(caller.userId, session?.session.activeOrganizationId ?? '')
        expect(active).toEqual({ role: 'owner' })
      }

      expect(authDatabase.sqlite.prepare('select action, actor_user_id, entity_id from audit_log where organization_id = ?').all(organizationId)).toEqual([
        { action: action === 'leave' ? 'member.left' : 'member.removed', actor_user_id: caller.userId, entity_id: `${organizationId}_member` },
      ])
      expect(shared.queued).toContainEqual(expect.objectContaining({ kind: 'trip-room-evict', orgId: organizationId, payload: { userId: leaver.userId } }))
      const retry = await departMember({ impersonated: false, scope: async () => ownerScope, remove: async () => { throw new Error('must not call auth on stale target') }, repairOffboarding: async () => {}, activateRemaining: async () => {} }, { memberId: `${organizationId}_member` })
      expect(retry).toEqual({ ok: false, reason: 'not-found' })

      expect(
        await authDatabase.db
          .select()
          .from(member)
          .where(eq(member.userId, leaver.userId)),
      ).not.toContainEqual(expect.objectContaining({ organizationId }))
      expect((await serveCalendarFeed(request(), runtime)).status).toBe(404)
      // The trip row remains: it is the real organization removal, not a trip-fixture deletion, denying access.
      expect(
        authDatabase.sqlite
          .prepare(
            'select id from trip_members where trip_id = ? and user_id = ?',
          )
          .get(trip.id, leaver.userId),
      ).toBeDefined()
      const armed = authDatabase.sqlite
        .prepare(
          'select coalesce(rotated_at, created_at) as armed from calendar_feeds where id = ?',
        )
        .get(feed.feedId) as { armed: number }
      const readdedAt = Math.max(Date.now(), armed.armed + 1)
      expect(readdedAt).toBeGreaterThan(armed.armed)
      authDatabase.sqlite
        .prepare(
          'insert into member (id, organization_id, user_id, role, created_at) values (?, ?, ?, ?, ?)',
        )
        .run(
          `readded_${action}`,
          organizationId,
          leaver.userId,
          'member',
          readdedAt,
        )
      expect((await serveCalendarFeed(request(), runtime)).status).toBe(404)
      // Positive control: enabling after the new membership explicitly arms a fresh credential.
      while (Date.now() < readdedAt)
        await new Promise((resolve) => setTimeout(resolve, 1))
      const replacement = await enableFeed(scope, {
        scope: 'trip',
        tripId: trip.id,
      })
      expect(
        (
          await serveCalendarFeed(
            new Request(`${BASE_URL}/api/feed/${replacement.secret}.ics`),
            runtime,
          )
        ).status,
      ).toBe(200)
      expect((await serveCalendarFeed(request(), runtime)).status).toBe(404)
      await Promise.all(pending)
    },
  )
})
