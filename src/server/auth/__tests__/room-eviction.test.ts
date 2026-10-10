/**
 * Every way a person can lose their place in a workspace queues the close of their trip-room
 * sockets (#1073), on the real Better Auth instance: the organization routes (remove a member,
 * leave), the platform actions that act on an account (ban, sign out everywhere, delete), and
 * nothing at all when the endpoint refused.
 *
 * The arrangement is `console/__tests__/last-owner-plugin.test.ts`'s: the shipped `getAuth()` over an
 * in-memory SQLite database with only the Worker bindings replaced, here with a recording `TASKS`
 * queue. What the queue consumer then does with a job is `trip-room-evict.test.ts`.
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  createAuthDatabase,
  createSessionKv,
} from '#/server/fns/console/__tests__/real-auth'

import type {
  AuthDatabase,
  SessionKv,
} from '#/server/fns/console/__tests__/real-auth'

const BASE_URL = 'http://localhost:3000'
const AUTH_BASE = `${BASE_URL}/api/auth`
const PASSWORD = 'correct-horse-battery-staple'

interface Holder<TValue> {
  current: TValue
}

interface Envelope {
  readonly kind: string
  readonly orgId: string
  readonly payload: { readonly userId: string }
}

const shared = vi.hoisted(() => ({
  authDb: { current: null } as Holder<unknown>,
  kv: { current: null } as Holder<unknown>,
  queued: [] as Array<unknown>,
  queueFails: false,
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
  queueAuthEmail: async () => undefined,
}))

const { getAuth } = await import('#/server/auth')

let authDatabase: AuthDatabase

beforeAll(async () => {
  authDatabase = await createAuthDatabase()
  shared.authDb.current = authDatabase.db
  shared.kv.current = createSessionKv()
})

afterAll(() => {
  authDatabase.close()
})

beforeEach(() => {
  authDatabase.reset()
  ;(shared.kv.current as SessionKv).clear()
  shared.queued = []
  shared.queueFails = false
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

/** A workspace with the given members, each `[person, role]`; returns its id. */
function workspace(members: ReadonlyArray<readonly [Person, string]>): string {
  const organizationId = `evict_org_${Math.random().toString(36).slice(2)}`
  authDatabase.sqlite
    .prepare(
      'insert into organization (id, name, slug, created_at) values (?, ?, ?, ?)',
    )
    .run(organizationId, 'Pinned', `${organizationId}-slug`, Date.now())
  members.forEach(([person, role], index) => {
    authDatabase.sqlite
      .prepare(
        'insert into member (id, organization_id, user_id, role, created_at) values (?, ?, ?, ?, ?)',
      )
      .run(
        `${organizationId}_member_${index}`,
        organizationId,
        person.userId,
        role,
        Date.now(),
      )
  })
  return organizationId
}

/** The workspaces every account is provisioned with are noise here: only the pinned ones matter. */
function evictions(): Array<{ orgId: string; userId: string }> {
  return (shared.queued as Array<Envelope>)
    .filter((envelope) => envelope.kind === 'trip-room-evict')
    .map((envelope) => ({
      orgId: envelope.orgId,
      userId: envelope.payload.userId,
    }))
}

function memberRows(organizationId: string): number {
  const row = authDatabase.sqlite
    .prepare('select count(*) as n from member where organization_id = ?')
    .get(organizationId) as { n: number }
  return row.n
}

function personalWorkspaceOf(person: Person): string {
  const row = authDatabase.sqlite
    .prepare(
      'select organization_id as id from member where user_id = ? order by created_at limit 1',
    )
    .get(person.userId) as { id: string }
  return row.id
}

/** A platform operator: an account whose `user.role` is `admin`. */
const operator = (): Promise<Person> => signedInPerson('operator', 'admin')

/* ------------------------------------------------------------------------ pins */

describe('losing a place in a workspace queues the close of the person’s trip-room sockets', () => {
  it('queues it for the removed member, in that workspace only', async () => {
    const owner = await signedInPerson('owner')
    const leaver = await signedInPerson('removed')
    const other = workspace([[leaver, 'member']])
    const organizationId = workspace([
      [owner, 'owner'],
      [leaver, 'member'],
    ])

    await getAuth().api.removeMember({
      body: { memberIdOrEmail: leaver.email, organizationId },
      headers: owner.headers,
    })

    expect(memberRows(organizationId)).toBe(1)
    expect(evictions()).toEqual([
      { orgId: organizationId, userId: leaver.userId },
    ])
    expect(evictions().map((job) => job.orgId)).not.toContain(other)
  })

  it('queues it for a member who leaves', async () => {
    const owner = await signedInPerson('owner')
    const leaver = await signedInPerson('leaver')
    const organizationId = workspace([
      [owner, 'owner'],
      [leaver, 'member'],
    ])

    await getAuth().api.leaveOrganization({
      body: { organizationId },
      headers: leaver.headers,
    })

    expect(memberRows(organizationId)).toBe(1)
    expect(evictions()).toEqual([
      { orgId: organizationId, userId: leaver.userId },
    ])
  })

  it('queues it for every workspace an account belongs to when the platform bans it', async () => {
    const admin = await operator()
    const target = await signedInPerson('target')
    const first = workspace([[target, 'member']])
    const second = workspace([[target, 'owner']])

    await getAuth().api.banUser({
      body: { userId: target.userId },
      headers: admin.headers,
    })

    expect(
      evictions().filter((job) => job.userId === target.userId),
    ).toHaveLength(3)
    expect(evictions().map((job) => job.orgId)).toEqual(
      expect.arrayContaining([first, second, personalWorkspaceOf(target)]),
    )
    expect(evictions().every((job) => job.userId === target.userId)).toBe(true)
  })

  it('queues it for every workspace when the platform signs the account out everywhere', async () => {
    const admin = await operator()
    const target = await signedInPerson('target')
    const first = workspace([[target, 'member']])

    await getAuth().api.revokeUserSessions({
      body: { userId: target.userId },
      headers: admin.headers,
    })

    expect(
      evictions()
        .map((job) => job.orgId)
        .sort(),
    ).toEqual([first, personalWorkspaceOf(target)].sort())
  })

  it('queues it for the workspaces an account belonged to when the platform deletes it', async () => {
    const admin = await operator()
    const target = await signedInPerson('target')
    const first = workspace([[target, 'member']])
    const personal = personalWorkspaceOf(target)

    await getAuth().api.removeUser({
      body: { userId: target.userId },
      headers: admin.headers,
    })

    expect(
      authDatabase.sqlite
        .prepare('select count(*) as n from member where user_id = ?')
        .get(target.userId),
    ).toEqual({ n: 0 })
    expect(
      evictions()
        .map((job) => job.orgId)
        .sort(),
    ).toEqual([first, personal].sort())
    expect(evictions().every((job) => job.userId === target.userId)).toBe(true)
  })

  it('queues nothing when the endpoint refused', async () => {
    const owner = await signedInPerson('owner')
    const organizationId = workspace([[owner, 'owner']])

    await expect(
      getAuth().api.leaveOrganization({
        body: { organizationId },
        headers: owner.headers,
      }),
    ).rejects.toMatchObject({
      body: { code: 'YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER' },
    })

    expect(memberRows(organizationId)).toBe(1)
    expect(evictions()).toEqual([])
  })

  it('queues nothing when the platform action is not permitted', async () => {
    const stranger = await signedInPerson('stranger')
    const target = await signedInPerson('target')

    await expect(
      getAuth().api.banUser({
        body: { userId: target.userId },
        headers: stranger.headers,
      }),
    ).rejects.toBeDefined()

    expect(evictions()).toEqual([])
  })

  it('lets the removal stand when the queue cannot be reached', async () => {
    const owner = await signedInPerson('owner')
    const leaver = await signedInPerson('removed')
    const organizationId = workspace([
      [owner, 'owner'],
      [leaver, 'member'],
    ])
    shared.queueFails = true
    const warnings = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)

    await expect(
      getAuth().api.removeMember({
        body: { memberIdOrEmail: leaver.email, organizationId },
        headers: owner.headers,
      }),
    ).resolves.toBeDefined()

    expect(memberRows(organizationId)).toBe(1)
    expect(warnings).toHaveBeenCalledOnce()
    const line = String(warnings.mock.calls[0]?.[0])
    expect(line).toContain('room-eviction.enqueue.failed')
    expect(line).toContain(leaver.userId)
    expect(line).not.toContain(leaver.email)
    warnings.mockRestore()
  })
})
