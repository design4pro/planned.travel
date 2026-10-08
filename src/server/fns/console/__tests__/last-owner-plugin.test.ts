/**
 * The three last-owner refusals the console's account-deletion guard relies on the Better Auth
 * `organization()` plugin for, pinned on the real instance.
 *
 * The console refuses to delete the only owner of a workspace other people belong to
 * (`../last-owner`) because `removeUser` cascades past every organization hook. It does *not*
 * guard the plugin's own routes - remove member, leave, update member role - because the plugin
 * already does, and a second guard (an `organizationHooks` entry) would duplicate it. That is only
 * safe while the plugin keeps refusing, which is a fact about a dependency, so it is a test: a
 * Better Auth upgrade that drops one of these fails here instead of stranding a workspace in
 * production.
 *
 * The arrangement is `console.test.ts`'s: the shipped `getAuth()` over an in-memory SQLite database,
 * with only the Worker bindings replaced.
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

import { createAuthDatabase, createSessionKv } from './real-auth'

import type { AuthDatabase, SessionKv } from './real-auth'

const BASE_URL = 'http://localhost:3000'
const AUTH_BASE = `${BASE_URL}/api/auth`
const PASSWORD = 'correct-horse-battery-staple'

interface Holder<TValue> {
  current: TValue
}

const shared = vi.hoisted(() => ({
  authDb: { current: null } as Holder<unknown>,
  kv: { current: null } as Holder<unknown>,
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
  taskQueue: () => {
    throw new Error('The queue is not exercised by this test.')
  },
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
})

/* ---------------------------------------------------------------------- fixtures */

interface Person {
  readonly userId: string
  readonly email: string
  readonly headers: Headers
}

/** A real account with a real session, signed up and signed in through the HTTP surface. */
async function signedInPerson(name: string): Promise<Person> {
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

/** A workspace with the given members, each `[person, role]`; returns its id and their member ids. */
function workspace(members: ReadonlyArray<readonly [Person, string]>): {
  organizationId: string
  memberIds: ReadonlyArray<string>
} {
  const organizationId = `pin_org_${Math.random().toString(36).slice(2)}`
  authDatabase.sqlite
    .prepare(
      'insert into organization (id, name, slug, created_at) values (?, ?, ?, ?)',
    )
    .run(organizationId, 'Pinned', `${organizationId}-slug`, Date.now())

  const memberIds = members.map(([person, role], index) => {
    const id = `${organizationId}_member_${index}`
    authDatabase.sqlite
      .prepare(
        'insert into member (id, organization_id, user_id, role, created_at) values (?, ?, ?, ?, ?)',
      )
      .run(id, organizationId, person.userId, role, Date.now())
    return id
  })
  return { organizationId, memberIds }
}

function membersOf(organizationId: string): number {
  const row = authDatabase.sqlite
    .prepare('select count(*) as n from member where organization_id = ?')
    .get(organizationId) as { n: number }
  return row.n
}

const ONLY_OWNER = {
  body: { code: 'YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER' },
}
const WITHOUT_OWNER = {
  body: { code: 'YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER' },
}

/* ------------------------------------------------------------------------ pins */

describe('the organization plugin never strands a workspace', () => {
  it('refuses removing the last owner, whoever asks', async () => {
    const owner = await signedInPerson('owner')
    const admin = await signedInPerson('admin')
    const { organizationId } = workspace([
      [owner, 'owner'],
      [admin, 'admin'],
    ])

    await expect(
      getAuth().api.removeMember({
        body: { memberIdOrEmail: owner.email, organizationId },
        headers: admin.headers,
      }),
    ).rejects.toMatchObject(ONLY_OWNER)
    await expect(
      getAuth().api.removeMember({
        body: { memberIdOrEmail: owner.email, organizationId },
        headers: owner.headers,
      }),
    ).rejects.toMatchObject(ONLY_OWNER)

    expect(membersOf(organizationId)).toBe(2)
  })

  it('refuses the last owner leaving', async () => {
    const owner = await signedInPerson('owner')
    const member = await signedInPerson('member')
    const { organizationId } = workspace([
      [owner, 'owner'],
      [member, 'member'],
    ])

    await expect(
      getAuth().api.leaveOrganization({
        body: { organizationId },
        headers: owner.headers,
      }),
    ).rejects.toMatchObject(ONLY_OWNER)

    expect(membersOf(organizationId)).toBe(2)
  })

  it('refuses the last owner demoting themselves', async () => {
    const owner = await signedInPerson('owner')
    const member = await signedInPerson('member')
    const { organizationId, memberIds } = workspace([
      [owner, 'owner'],
      [member, 'member'],
    ])

    await expect(
      getAuth().api.updateMemberRole({
        body: { memberId: memberIds[0], role: 'member', organizationId },
        headers: owner.headers,
      }),
    ).rejects.toMatchObject(WITHOUT_OWNER)

    const row = authDatabase.sqlite
      .prepare('select role from member where id = ?')
      .get(memberIds[0]) as { role: string }
    expect(row.role).toBe('owner')
  })

  it('lets one of two owners leave, so the refusals above are the rule and not a blanket', async () => {
    const first = await signedInPerson('first')
    const second = await signedInPerson('second')
    const { organizationId } = workspace([
      [first, 'owner'],
      [second, 'owner'],
    ])

    await getAuth().api.leaveOrganization({
      body: { organizationId },
      headers: first.headers,
    })

    expect(membersOf(organizationId)).toBe(1)
  })
})
