/**
 * Every way a person can lose their place in a workspace queues the close of their trip-room
 * sockets (#1073), on the real Better Auth instance: the organization routes (remove a member,
 * leave), the platform actions that act on an account (ban, sign out everywhere, delete), and
 * nothing at all when the endpoint refused. Every way a person ends their own session does the
 * same (#1093): a password reset, a password change that revokes the other sessions, a sign-out,
 * and a revoke of one, the other or all sessions.
 *
 * The arrangement is `console/__tests__/last-owner-plugin.test.ts`'s: the shipped `getAuth()` over an
 * in-memory SQLite database with only the Worker bindings replaced, here with a recording `TASKS`
 * queue. What the queue consumer then does with a job is `trip-room-evict.test.ts`.
 */

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

let authDatabase: AuthDatabase

beforeAll(async () => {
  authDatabase = await createAuthDatabase()
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
  authDatabase.reset()
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

/* ------------------------------------------------------- ending one's own session */

/** The workspaces the person is in: their own plus two more, and a third they are not in. */
function memberOfTwoMore(person: Person): {
  readonly personal: string
  readonly first: string
  readonly second: string
  readonly stranger: string
} {
  const first = workspace([[person, 'member']])
  const second = workspace([[person, 'owner']])
  return {
    personal: personalWorkspaceOf(person),
    first,
    second,
    stranger: `evict_org_not_a_member`,
  }
}

function evictedWorkspaces(person: Person): Array<string> {
  return evictions()
    .filter((job) => job.userId === person.userId)
    .map((job) => job.orgId)
    .sort()
}

function expectedWorkspaces(
  spaces: ReturnType<typeof memberOfTwoMore>,
): Array<string> {
  return [spaces.personal, spaces.first, spaces.second].sort()
}

function sessionTokensOf(person: Person): Array<string> {
  return (
    authDatabase.sqlite
      .prepare('select token from session where user_id = ?')
      .all(person.userId) as Array<{ token: string }>
  ).map((row) => row.token)
}

/** A second sign-in of the same account: another device. */
async function signInAgain(person: Person): Promise<Person> {
  const response = await getAuth().handler(
    new Request(`${AUTH_BASE}/sign-in/email`, {
      method: 'POST',
      headers: new Headers({
        'content-type': 'application/json',
        origin: BASE_URL,
      }),
      body: JSON.stringify({ email: person.email, password: PASSWORD }),
    }),
  )
  const cookie = response.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0])
    .join('; ')
  return { ...person, headers: new Headers({ cookie }) }
}

async function resetTokenFor(person: Person): Promise<string> {
  await getAuth().api.requestPasswordReset({
    body: { email: person.email, redirectTo: `${BASE_URL}/reset-password` },
  })
  const url = shared.emails.at(-1)?.url
  const token = url?.split('/reset-password/')[1]?.split('?')[0]
  if (token === undefined) throw new Error('no reset link was sent')
  return token
}

describe('ending one’s own session queues the close of the person’s trip-room sockets', () => {
  it('queues it for every workspace of the person, and no other, after a password reset', async () => {
    const person = await signedInPerson('forgetful')
    const bystander = await signedInPerson('bystander')
    const spaces = memberOfTwoMore(person)
    workspace([[bystander, 'owner']])
    const token = await resetTokenFor(person)

    await getAuth().api.resetPassword({
      body: { token, newPassword: 'a-brand-new-passphrase-1' },
    })

    expect(evictedWorkspaces(person)).toEqual(expectedWorkspaces(spaces))
    expect(evictions().map((job) => job.orgId)).not.toContain(spaces.stranger)
    expect(evictions().every((job) => job.userId === person.userId)).toBe(true)
  })

  it('queues one job per workspace, not one per session', async () => {
    const person = await signedInPerson('twice')
    await signInAgain(person)
    const spaces = memberOfTwoMore(person)
    const token = await resetTokenFor(person)

    await getAuth().api.resetPassword({
      body: { token, newPassword: 'a-brand-new-passphrase-1' },
    })

    expect(evictedWorkspaces(person)).toEqual(expectedWorkspaces(spaces))
  })

  it('queues nothing for a reset token that is made up or already used', async () => {
    const person = await signedInPerson('forgetful')
    const token = await resetTokenFor(person)
    await getAuth().api.resetPassword({
      body: { token, newPassword: 'a-brand-new-passphrase-1' },
    })
    shared.queued = []

    await expect(
      getAuth().api.resetPassword({
        body: { token, newPassword: 'another-brand-new-passphrase-2' },
      }),
    ).rejects.toBeDefined()
    await expect(
      getAuth().api.resetPassword({
        body: { token: 'not-a-token', newPassword: 'a-brand-new-passphrase-1' },
      }),
    ).rejects.toBeDefined()

    expect(evictions()).toEqual([])
  })

  it('reads the reset token from the query when the body has none', async () => {
    const person = await signedInPerson('querying')
    const spaces = memberOfTwoMore(person)
    const token = await resetTokenFor(person)

    await getAuth().api.resetPassword({
      body: { newPassword: 'a-brand-new-passphrase-1' } as {
        newPassword: string
      },
      query: { token },
    })

    expect(evictedWorkspaces(person)).toEqual(expectedWorkspaces(spaces))
  })

  it('does not let a caller of the auth API name the person to close', async () => {
    const victim = await signedInPerson('victim')
    memberOfTwoMore(victim)

    await getAuth().api.signOut({
      headers: new Headers(),
      roomEvictionUserId: victim.userId,
    } as { headers: Headers })

    expect(evictions()).toEqual([])
  })

  it('does not take the person from the request body of a reset', async () => {
    const attacker = await signedInPerson('attacker')
    const victim = await signedInPerson('victim')
    const token = await resetTokenFor(attacker)

    await getAuth().api.resetPassword({
      body: {
        token,
        newPassword: 'a-brand-new-passphrase-1',
        userId: victim.userId,
      } as { token: string; newPassword: string },
    })

    expect(evictedWorkspaces(victim)).toEqual([])
    expect(evictedWorkspaces(attacker)).not.toEqual([])
  })

  it('queues it when a password change revokes the other sessions', async () => {
    const person = await signedInPerson('changer')
    const spaces = memberOfTwoMore(person)

    await getAuth().api.changePassword({
      body: {
        currentPassword: PASSWORD,
        newPassword: 'a-brand-new-passphrase-1',
        revokeOtherSessions: true,
      },
      headers: person.headers,
    })

    expect(evictedWorkspaces(person)).toEqual(expectedWorkspaces(spaces))
  })

  it('queues nothing when a password change leaves the other sessions alone', async () => {
    const person = await signedInPerson('changer')
    memberOfTwoMore(person)

    await getAuth().api.changePassword({
      body: {
        currentPassword: PASSWORD,
        newPassword: 'a-brand-new-passphrase-1',
      },
      headers: person.headers,
    })

    expect(evictions()).toEqual([])
  })

  it('queues nothing when a password change is refused', async () => {
    const person = await signedInPerson('changer')
    memberOfTwoMore(person)

    await expect(
      getAuth().api.changePassword({
        body: {
          currentPassword: 'not-the-password-at-all',
          newPassword: 'a-brand-new-passphrase-1',
          revokeOtherSessions: true,
        },
        headers: person.headers,
      }),
    ).rejects.toBeDefined()

    expect(evictions()).toEqual([])
  })

  it('queues it for the person who signs out, whichever door the request came through', async () => {
    const person = await signedInPerson('leaving')
    const spaces = memberOfTwoMore(person)
    const sessionsBefore = sessionTokensOf(person).length

    const response = await getAuth().handler(
      new Request(`${AUTH_BASE}/sign-out`, {
        method: 'POST',
        headers: new Headers({
          cookie: person.headers.get('cookie') ?? '',
          origin: BASE_URL,
          'content-type': 'application/json',
        }),
        body: JSON.stringify({}),
      }),
    )

    expect(response.status).toBe(200)
    expect(sessionTokensOf(person)).toHaveLength(sessionsBefore - 1)
    expect(evictedWorkspaces(person)).toEqual(expectedWorkspaces(spaces))
  })

  it('queues nothing for a sign-out that has no session behind it', async () => {
    const person = await signedInPerson('ghost')
    memberOfTwoMore(person)

    await getAuth().api.signOut({ headers: new Headers() })
    await getAuth().api.signOut({
      headers: new Headers({ cookie: 'planned.session_token=forged.value' }),
    })

    expect(evictions()).toEqual([])
  })

  it('queues it when a person revokes one of their own sessions', async () => {
    const person = await signedInPerson('tidy')
    await signInAgain(person)
    const spaces = memberOfTwoMore(person)
    const [token] = sessionTokensOf(person)

    await getAuth().api.revokeSession({
      body: { token: String(token) },
      headers: person.headers,
    })

    expect(evictedWorkspaces(person)).toEqual(expectedWorkspaces(spaces))
  })

  it('queues nothing when the session to revoke belongs to somebody else', async () => {
    const person = await signedInPerson('curious')
    const other = await signedInPerson('other')
    memberOfTwoMore(person)
    memberOfTwoMore(other)
    const [otherToken] = sessionTokensOf(other)
    const otherSessions = sessionTokensOf(other).length

    await getAuth().api.revokeSession({
      body: { token: String(otherToken) },
      headers: person.headers,
    })

    expect(sessionTokensOf(other)).toHaveLength(otherSessions)
    expect(evictions()).toEqual([])
  })

  it('queues it when a person revokes their other sessions', async () => {
    const person = await signedInPerson('careful')
    await signInAgain(person)
    const spaces = memberOfTwoMore(person)

    await getAuth().api.revokeOtherSessions({ headers: person.headers })

    expect(evictedWorkspaces(person)).toEqual(expectedWorkspaces(spaces))
  })

  it('queues it when a person revokes all their sessions', async () => {
    const person = await signedInPerson('careful')
    await signInAgain(person)
    const spaces = memberOfTwoMore(person)

    await getAuth().api.revokeSessions({ headers: person.headers })

    expect(evictedWorkspaces(person)).toEqual(expectedWorkspaces(spaces))
  })

  it('queues nothing when a revoke is made without a session', async () => {
    const person = await signedInPerson('careful')
    memberOfTwoMore(person)

    await expect(
      getAuth().api.revokeSessions({ headers: new Headers() }),
    ).rejects.toBeDefined()
    await expect(
      getAuth().api.revokeOtherSessions({ headers: new Headers() }),
    ).rejects.toBeDefined()

    expect(evictions()).toEqual([])
  })

  it('queues it for the owner of the session the platform revokes', async () => {
    const admin = await operator()
    const target = await signedInPerson('target')
    const bystander = await signedInPerson('bystander')
    const spaces = memberOfTwoMore(target)
    const [sessionToken] = sessionTokensOf(target)

    await getAuth().api.revokeUserSession({
      body: { sessionToken: String(sessionToken) },
      headers: admin.headers,
    })

    expect(evictedWorkspaces(target)).toEqual(expectedWorkspaces(spaces))
    expect(evictedWorkspaces(bystander)).toEqual([])
    expect(evictedWorkspaces(admin)).toEqual([])
  })

  it('queues nothing when the platform action is not permitted', async () => {
    const stranger = await signedInPerson('stranger')
    const target = await signedInPerson('target')
    const [sessionToken] = sessionTokensOf(target)

    await expect(
      getAuth().api.revokeUserSession({
        body: { sessionToken: String(sessionToken) },
        headers: stranger.headers,
      }),
    ).rejects.toBeDefined()

    expect(evictions()).toEqual([])
  })

  it('lets the reset stand and logs no credential when the person cannot be read', async () => {
    const person = await signedInPerson('forgetful')
    const token = await resetTokenFor(person)
    const { internalAdapter } = await getAuth().$context
    const lookup = vi
      .spyOn(internalAdapter, 'findVerificationValue')
      .mockRejectedValueOnce(
        new Error(`Failed query: select ... params: reset-password:${token}`),
      )
    const warnings = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)

    await expect(
      getAuth().api.resetPassword({
        body: { token, newPassword: 'a-brand-new-passphrase-1' },
      }),
    ).resolves.toMatchObject({ status: true })

    expect(evictions()).toEqual([])
    expect(warnings).toHaveBeenCalledOnce()
    const line = String(warnings.mock.calls[0]?.[0])
    expect(line).toContain('room-eviction.session.failed')
    expect(line).not.toContain(token)
    lookup.mockRestore()
    warnings.mockRestore()
  })

  it('lets the sign-out stand and logs ids only when the queue cannot be reached', async () => {
    const person = await signedInPerson('leaving')
    memberOfTwoMore(person)
    const sessionsBefore = sessionTokensOf(person).length
    shared.queueFails = true
    const warnings = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined)

    await expect(
      getAuth().api.signOut({ headers: person.headers }),
    ).resolves.toMatchObject({ success: true })

    expect(sessionTokensOf(person)).toHaveLength(sessionsBefore - 1)
    expect(warnings).toHaveBeenCalledOnce()
    const line = String(warnings.mock.calls[0]?.[0])
    expect(line).toContain('room-eviction.enqueue.failed')
    expect(line).toContain(person.userId)
    expect(line).not.toContain(person.email)
    warnings.mockRestore()
  })
})

/* ------------------------------------------- purging the cached blobs of ended sessions */

const kv = (): SessionKv => shared.kv.current as SessionKv

const indexKeyOf = (person: Person): string =>
  `active-sessions-${person.userId}`

/** The failure #1176 closes: the per-user index lost the entry, so Better Auth cannot name the blobs. */
function loseIndexOf(person: Person): void {
  kv().store.delete(indexKeyOf(person))
}

const blobsHeld = (tokens: ReadonlyArray<string>): Array<string> =>
  tokens.filter((token) => kv().store.has(token))

/** Sessions (sign-up, sign-in and a second device) whose blobs the index no longer names. */
async function withUnindexedSessions(
  name: string,
): Promise<{ person: Person; tokens: Array<string> }> {
  const person = await signedInPerson(name)
  const second = await signInAgain(person)
  const tokens = sessionTokensOf(person)
  expect(tokens.length).toBeGreaterThan(1)
  expect(blobsHeld(tokens)).toHaveLength(tokens.length)
  loseIndexOf(person)
  return { person: { ...person, headers: second.headers }, tokens }
}

describe('ending one’s own sessions purges the cached blobs the durable rows name (#1176)', () => {
  it('removes every blob after a password reset, although the index names none of them', async () => {
    const { person, tokens } = await withUnindexedSessions('forgetful')
    const token = await resetTokenFor(person)

    await getAuth().api.resetPassword({
      body: { token, newPassword: 'a-brand-new-passphrase-1' },
    })

    expect(blobsHeld(tokens)).toEqual([])
  })

  it('removes the indexed blobs too', async () => {
    const person = await signedInPerson('forgetful')
    await signInAgain(person)
    const tokens = sessionTokensOf(person)
    const token = await resetTokenFor(person)

    await getAuth().api.resetPassword({
      body: { token, newPassword: 'a-brand-new-passphrase-1' },
    })

    expect(blobsHeld(tokens)).toEqual([])
  })

  it('removes every blob when a person revokes all their sessions', async () => {
    const { person, tokens } = await withUnindexedSessions('careful')

    await getAuth().api.revokeSessions({ headers: person.headers })

    expect(blobsHeld(tokens)).toEqual([])
  })

  it('removes the blobs that existed before a password change that revokes the others, and keeps the new session’s', async () => {
    const { person, tokens } = await withUnindexedSessions('changer')

    await getAuth().api.changePassword({
      body: {
        currentPassword: PASSWORD,
        newPassword: 'a-brand-new-passphrase-1',
        revokeOtherSessions: true,
      },
      headers: person.headers,
    })

    expect(blobsHeld(tokens)).toEqual([])
    const [created] = sessionTokensOf(person)
    expect(sessionTokensOf(person)).toHaveLength(1)
    expect(kv().store.has(String(created))).toBe(true)
    expect(kv().store.get(indexKeyOf(person))).toContain(String(created))
  })

  it('deletes nothing when a password change revokes nothing', async () => {
    const { person, tokens } = await withUnindexedSessions('changer')
    const deletes = kv().deleted.length

    await getAuth().api.changePassword({
      body: {
        currentPassword: PASSWORD,
        newPassword: 'a-brand-new-passphrase-1',
      },
      headers: person.headers,
    })

    expect(kv().deleted).toHaveLength(deletes)
    expect(blobsHeld(tokens)).toHaveLength(tokens.length)
  })

  it('deletes nothing when the endpoint refuses', async () => {
    const { person, tokens } = await withUnindexedSessions('careful')
    const deletes = kv().deleted.length

    await expect(
      getAuth().api.changePassword({
        body: {
          currentPassword: 'not-the-password-at-all',
          newPassword: 'a-brand-new-passphrase-1',
          revokeOtherSessions: true,
        },
        headers: person.headers,
      }),
    ).rejects.toBeDefined()
    await expect(
      getAuth().api.resetPassword({
        body: { token: 'not-a-token', newPassword: 'a-brand-new-passphrase-1' },
      }),
    ).rejects.toBeDefined()
    await expect(
      getAuth().api.revokeSessions({ headers: new Headers() }),
    ).rejects.toBeDefined()

    expect(kv().deleted).toHaveLength(deletes)
    expect(blobsHeld(tokens)).toHaveLength(tokens.length)
  })

  it('never reaches another person’s blobs', async () => {
    const { person } = await withUnindexedSessions('careful')
    const bystander = await signedInPerson('bystander')
    loseIndexOf(bystander)
    const bystanderTokens = sessionTokensOf(bystander)

    await getAuth().api.revokeSessions({ headers: person.headers })

    expect(blobsHeld(bystanderTokens)).toHaveLength(bystanderTokens.length)
  })

  it('takes the person from the store, never from the request body of a reset', async () => {
    const attacker = await signedInPerson('attacker')
    loseIndexOf(attacker)
    const attackerTokens = sessionTokensOf(attacker)
    const victim = await signedInPerson('victim')
    loseIndexOf(victim)
    const victimTokens = sessionTokensOf(victim)
    const token = await resetTokenFor(attacker)

    await getAuth().api.resetPassword({
      body: {
        token,
        newPassword: 'a-brand-new-passphrase-1',
        userId: victim.userId,
      } as { token: string; newPassword: string },
    })

    expect(blobsHeld(attackerTokens)).toEqual([])
    expect(blobsHeld(victimTokens)).toHaveLength(victimTokens.length)
  })

  it('does not let a caller of the auth API name the blobs to delete', async () => {
    const victim = await signedInPerson('victim')
    const victimTokens = sessionTokensOf(victim)
    const attacker = await signedInPerson('attacker')
    loseIndexOf(attacker)
    const attackerTokens = sessionTokensOf(attacker)

    await getAuth().api.revokeSessions({
      headers: attacker.headers,
      roomEvictionSessionTokens: victimTokens,
    } as { headers: Headers })

    expect(blobsHeld(attackerTokens)).toEqual([])
    expect(blobsHeld(victimTokens)).toHaveLength(victimTokens.length)
  })

  it('leaves sign-out and the revoke of one session to Better Auth', async () => {
    const { person, tokens } = await withUnindexedSessions('tidy')
    const [first, second] = tokens.map(String)

    await getAuth().api.revokeSession({
      body: { token: String(first) },
      headers: person.headers,
    })

    expect(kv().deleted).toEqual([first])
    expect(kv().store.has(String(second))).toBe(true)
  })

  it('leaves the other blobs of a person who signs out of one device to Better Auth', async () => {
    const { person, tokens } = await withUnindexedSessions('tidy')

    await getAuth().api.signOut({ headers: person.headers })

    expect(blobsHeld(tokens)).toHaveLength(tokens.length - 1)
    expect(kv().deleted).toHaveLength(1)
  })

  it('never deletes the per-user index key itself', async () => {
    const person = await signedInPerson('careful')
    await signInAgain(person)
    const token = await resetTokenFor(person)
    const { internalAdapter } = await getAuth().$context
    const indexDeleteCalls: Array<string> = []
    const original = kv().delete
    kv().delete = async (key: string) => {
      indexDeleteCalls.push(key)
      return original(key)
    }
    vi.spyOn(internalAdapter, 'deleteUserSessions').mockResolvedValue(undefined)

    try {
      await getAuth().api.resetPassword({
        body: { token, newPassword: 'a-brand-new-passphrase-1' },
      })
    } finally {
      kv().delete = original
    }

    expect(indexDeleteCalls).not.toContain(indexKeyOf(person))
    expect(indexDeleteCalls.length).toBeGreaterThan(0)
  })

  it('lets the request stand, retries once and logs counts and ids only when a delete is rejected', async () => {
    const { person, tokens } = await withUnindexedSessions('unlucky')
    const [stuck] = tokens.map(String)
    kv().failing.add(stuck)
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    await expect(
      getAuth().api.revokeSessions({ headers: person.headers }),
    ).resolves.toMatchObject({ status: true })

    expect(sessionTokensOf(person)).toEqual([])
    expect(kv().deleted.filter((key) => key === stuck)).toHaveLength(2)
    expect(blobsHeld(tokens)).toEqual([stuck])
    expect(errors).toHaveBeenCalledOnce()
    const line = String(errors.mock.calls[0]?.[0])
    expect(JSON.parse(line)).toMatchObject({
      level: 'error',
      event: 'room-eviction.blobs.failed',
      userId: person.userId,
      source: '/revoke-sessions',
      enumerated: tokens.length,
      deleted: tokens.length - 1,
      failed: 1,
    })
    for (const token of tokens) expect(line).not.toContain(token)
  })

  it('still deletes every other blob when one delete is rejected', async () => {
    const { person, tokens } = await withUnindexedSessions('unlucky')
    kv().failing.add(String(tokens[0]))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await getAuth().api.revokeSessions({ headers: person.headers })

    expect(blobsHeld(tokens)).toEqual([String(tokens[0])])
  })

  it('lets the reset stand and logs no credential when the session list cannot be read', async () => {
    const { person, tokens } = await withUnindexedSessions('forgetful')
    const token = await resetTokenFor(person)
    const { adapter } = await getAuth().$context
    const real = adapter.findMany.bind(adapter)
    const unreadable = vi
      .spyOn(adapter, 'findMany')
      .mockImplementation(async (query) => {
        if (query.model === 'session') {
          throw new Error(`Failed query: select ... params: ${tokens.join()}`)
        }
        return real(query)
      })
    const errors = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    await expect(
      getAuth().api.resetPassword({
        body: { token, newPassword: 'a-brand-new-passphrase-1' },
      }),
    ).resolves.toMatchObject({ status: true })

    unreadable.mockRestore()
    expect(sessionTokensOf(person)).toEqual([])
    const lines = errors.mock.calls.map((call) => String(call[0]))
    expect(
      lines.some((line) => line.includes('room-eviction.blobs.unread')),
    ).toBe(true)
    for (const line of lines) {
      for (const secret of [token, ...tokens]) {
        expect(line).not.toContain(secret)
      }
    }
  })
})
