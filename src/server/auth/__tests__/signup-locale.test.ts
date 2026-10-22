/**
 * 09-S5c: a person who registers while reading the sign-in screens in Polish opens the new account
 * in Polish.
 *
 * Driven through the real Better Auth handler (not through `provisionPersonalOrganization`), on a
 * database that migrates the **whole** schema: `user_settings` is not an auth table, so the
 * in-memory database of `auth-handler-closure.test.ts` (built from `authSchema` alone) could not
 * hold the row under test. The mocks are the ones that file establishes and explains: `./env` and
 * `./db` import `cloudflare:workers`, so they become plain values; `./email` is rendering cost that
 * has nothing to do with a language; everything else - the plugins, the router, the hooks, the
 * cookies, the password hashing - is the code that ships.
 */

import type { DatabaseSync } from 'node:sqlite'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import { isSeedingPath } from '../signup-locale'
import type * as Provisioning from '../provisioning'
import type * as UserLocaleSeed from '#/server/repos/user-locale-seed'
import type { Harness } from '#/server/repos/__tests__/harness'

const BASE_URL = 'http://localhost:3000'
const AUTH_BASE = `${BASE_URL}/api/auth`
const PASSWORD = 'correct-horse-battery-staple'

const shared = vi.hoisted(() => ({
  /** Filled in `beforeAll`; the auth instance is memoised, so one database serves the file. */
  db: { current: null as unknown },
  kv: new Map<string, string>(),
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
  sessionStore: () => ({
    get: async (key: string, type?: string) => {
      const value = shared.kv.get(key)
      if (value === undefined) return null
      return type === 'json' ? JSON.parse(value) : value
    },
    put: async (key: string, value: string) => {
      shared.kv.set(key, value)
    },
    delete: async (key: string) => {
      shared.kv.delete(key)
    },
  }),
  taskQueue: () => {
    throw new Error('The queue is not exercised by this test.')
  },
  trustedOrigins: () => [BASE_URL],
}))

vi.mock('#/server/auth/db', () => ({
  authDb: () => shared.db.current,
  authRepositoryDb: () => shared.db.current,
}))

vi.mock('#/server/auth/email', () => ({
  queueAuthEmail: async () => undefined,
}))

// Wrapped, not replaced: the real functions run unless a test swaps one for a single call.
vi.mock('#/server/auth/provisioning', async (importOriginal) => {
  const actual = await importOriginal<typeof Provisioning>()
  return {
    ...actual,
    provisionPersonalOrganization: vi.fn(actual.provisionPersonalOrganization),
  }
})

vi.mock('#/server/repos/user-locale-seed', async (importOriginal) => {
  const actual = await importOriginal<typeof UserLocaleSeed>()
  return { ...actual, seedUserLocale: vi.fn(actual.seedUserLocale) }
})

const { getAuth } = await import('../index')
const provisioning = await import('../provisioning')
const { seedUserLocale } = await import('#/server/repos/user-locale-seed')
const { seedSignupLocale } = await import('../signup-locale')

let harness: Harness
let sqlite: DatabaseSync

beforeAll(async () => {
  harness = await createHarness()
  sqlite = harness.sqlite
  shared.db.current = harness.db
})

afterAll(() => {
  harness.close()
})

beforeEach(() => {
  shared.kv.clear()
  sqlite.exec('PRAGMA foreign_keys = OFF')
  for (const table of harness.tableNames()) {
    if (table.startsWith('_') || table.startsWith('sqlite_')) continue
    sqlite.exec(`delete from "${table}"`)
  }
  sqlite.exec('PRAGMA foreign_keys = ON')
})

/* -------------------------------------------------------------------------------------------------
 * Driving the real handler
 * ---------------------------------------------------------------------------------------------- */

interface Signal {
  readonly cookie?: string
  readonly acceptLanguage?: string
}

function post(path: string, body: unknown, signal: Signal = {}) {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: BASE_URL,
  })
  if (signal.cookie !== undefined) headers.set('cookie', signal.cookie)
  if (signal.acceptLanguage !== undefined) {
    headers.set('accept-language', signal.acceptLanguage)
  }
  return getAuth().handler(
    new Request(`${AUTH_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  )
}

async function signUp(email: string, signal: Signal = {}): Promise<string> {
  const response = await post(
    '/sign-up/email',
    { email, password: PASSWORD, name: email.split('@')[0] },
    signal,
  )
  expect(response.status).toBe(200)
  return userIdOf(email)
}

function userIdOf(email: string): string {
  const row = sqlite.prepare('select id from user where email = ?').get(email)
  const id = (row as { id?: unknown } | undefined)?.id
  if (typeof id !== 'string') throw new Error(`no user row for ${email}`)
  return id
}

interface SettingsRow {
  readonly organization_id: string
  readonly user_id: string
  readonly locale: string | null
}

function settingsRows(): Array<SettingsRow> {
  return sqlite
    .prepare('select organization_id, user_id, locale from user_settings')
    .all() as unknown as Array<SettingsRow>
}

function organizationOf(userId: string): string {
  const row = sqlite
    .prepare('select organization_id from member where user_id = ?')
    .get(userId) as { organization_id: string } | undefined
  if (row === undefined) throw new Error(`no membership for ${userId}`)
  return row.organization_id
}

/* -------------------------------------------------------------------------------------------------
 * The tests
 * ---------------------------------------------------------------------------------------------- */

describe('sign-up seeds the language the request resolved anonymously', () => {
  it('seeds the visitor cookie into the new account in its personal workspace', async () => {
    const userId = await signUp('cookie@example.test', {
      cookie: 'planned.locale=pl',
    })

    expect(settingsRows()).toEqual([
      {
        organization_id: organizationOf(userId),
        user_id: userId,
        locale: 'pl',
      },
    ])
  })

  it('seeds the browser language when there is no cookie', async () => {
    const userId = await signUp('header@example.test', {
      acceptLanguage: 'pl-PL,pl;q=0.9,en;q=0.8',
    })

    expect(settingsRows()).toEqual([
      {
        organization_id: organizationOf(userId),
        user_id: userId,
        locale: 'pl',
      },
    ])
  })

  it('lets the cookie win over the browser language', async () => {
    await signUp('both@example.test', {
      cookie: 'planned.locale=de',
      acceptLanguage: 'pl',
    })

    expect(settingsRows().map((row) => row.locale)).toEqual(['de'])
  })

  it.each([
    ['an English visitor', { cookie: 'planned.locale=en' }],
    [
      'an English cookie over a Polish browser',
      {
        cookie: 'planned.locale=en',
        acceptLanguage: 'pl',
      },
    ],
    ['no signal at all', {}],
    ['an unshipped cookie value', { cookie: 'planned.locale=xx' }],
    ['an unshipped browser language', { acceptLanguage: 'tlh' }],
    ['a repeated cookie', { cookie: 'planned.locale=pl; planned.locale=de' }],
  ])('writes no row for %s', async (_name, signal) => {
    const userId = await signUp('none@example.test', signal)

    expect(settingsRows()).toEqual([])
    expect(organizationOf(userId)).not.toBe('')
  })

  it('still completes the sign-up when the seed throws, and says so', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    vi.mocked(seedUserLocale).mockRejectedValueOnce(new Error('d1 is down'))

    const userId = await signUp('throws@example.test', {
      cookie: 'planned.locale=pl',
    })

    expect(settingsRows()).toEqual([])
    expect(organizationOf(userId)).not.toBe('')
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('signup.locale-seed.failed'),
    )
  })

  it('seeds when the session-creation fallback provisioned the workspace first', async () => {
    // The race the hook must survive: Better Auth can run `session.create.before`'s fallback before
    // this hook has provisioned. Set up deterministically by running the fallback first, then the
    // hook's own provisioning, which must return the workspace the fallback made.
    const actual = provisioning.provisionPersonalOrganization
    vi.mocked(actual).mockImplementationOnce(async (db, user) => {
      await provisioning.resolveOrProvisionOrganization(db, user.id)
      return actual(db, user)
    })

    const userId = await signUp('race@example.test', {
      cookie: 'planned.locale=pl',
    })

    expect(settingsRows()).toEqual([
      {
        organization_id: organizationOf(userId),
        user_id: userId,
        locale: 'pl',
      },
    ])
    expect(
      sqlite
        .prepare('select count(*) as n from member where user_id = ?')
        .get(userId),
    ).toEqual({ n: 1 })
  })
})

describe('only a self-registration request seeds', () => {
  it('seeds nothing for a sign-in that creates the workspace in the session fallback', async () => {
    await signUp('fallback@example.test')
    // An account with no workspace, as a sign-in on an older account would find it.
    sqlite.exec('PRAGMA foreign_keys = OFF')
    sqlite.exec('delete from member')
    sqlite.exec('delete from organization')
    sqlite.exec('delete from session')
    sqlite.exec('PRAGMA foreign_keys = ON')
    shared.kv.clear()

    const response = await post(
      '/sign-in/email',
      { email: 'fallback@example.test', password: PASSWORD },
      { cookie: 'planned.locale=pl', acceptLanguage: 'pl' },
    )

    expect(response.status).toBe(200)
    expect(sqlite.prepare('select count(*) as n from member').get()).toEqual({
      n: 1,
    })
    expect(settingsRows()).toEqual([])
  })

  it('never writes when an existing account signs in', async () => {
    await signUp('existing@example.test')
    expect(settingsRows()).toEqual([])

    const response = await post(
      '/sign-in/email',
      { email: 'existing@example.test', password: PASSWORD },
      { cookie: 'planned.locale=pl', acceptLanguage: 'pl' },
    )

    expect(response.status).toBe(200)
    expect(settingsRows()).toEqual([])
  })

  it('seeds nothing for an account the console creates, whatever cookie the admin carries', async () => {
    const operatorId = await signUp('operator@example.test')
    sqlite
      .prepare("update user set role = 'admin' where id = ?")
      .run(operatorId)
    shared.kv.clear()
    const signedIn = await post('/sign-in/email', {
      email: 'operator@example.test',
      password: PASSWORD,
    })
    const token = signedIn.headers
      .getSetCookie()
      .find((entry) => entry.startsWith('planned.session_token='))
    if (token === undefined) throw new Error('no session cookie')

    await getAuth().api.createUser({
      body: {
        email: 'created@example.test',
        password: PASSWORD,
        name: 'Created',
        role: 'user',
      },
      headers: new Headers({
        cookie: `${token.split(';')[0]}; planned.locale=pl`,
        'accept-language': 'pl',
      }),
    })

    expect(userIdOf('created@example.test')).not.toBe('')
    expect(settingsRows()).toEqual([])
  })

  it('seeds nothing for an in-process sign-up that forwards a cookie', async () => {
    // The dev seed is the only server-side `signUpEmail` caller and forwards nothing. Were one to
    // forward another person's headers, it would still seed nothing: only a request that came in
    // over HTTP is read.
    await getAuth().api.signUpEmail({
      body: { email: 'inproc@example.test', password: PASSWORD, name: 'In' },
      headers: new Headers({
        cookie: 'planned.locale=pl',
        'accept-language': 'pl',
      }),
    })

    expect(userIdOf('inproc@example.test')).not.toBe('')
    expect(settingsRows()).toEqual([])
  })
})

describe('the seeding path allowlist', () => {
  it.each(['/sign-up/email', '/callback/google', '/callback/apple'])(
    'accepts %s',
    (path) => {
      expect(isSeedingPath(path)).toBe(true)
    },
  )

  it.each([
    '/admin/create-user',
    '/sign-in/social',
    '/sign-in/email',
    '/callback',
    '/callback/',
    '/sign-up/email/extra',
    '/Sign-Up/Email',
    '',
  ])('refuses %j', (path) => {
    expect(isSeedingPath(path)).toBe(false)
  })

  it('seeds from a concrete social callback path, and from nothing without a request', async () => {
    const userId = await signUp('callback@example.test')
    const organizationId = organizationOf(userId)
    const request = new Request(`${AUTH_BASE}/callback/google?code=x`, {
      headers: { cookie: 'planned.locale=pl' },
    })

    await seedSignupLocale(() => harness.db, null, {
      userId,
      organizationId,
    })
    await seedSignupLocale(
      () => harness.db,
      { path: '/callback/google' },
      { userId, organizationId },
    )
    await seedSignupLocale(
      () => harness.db,
      { path: '/callback/google', request: new Request(BASE_URL) },
      { userId, organizationId },
    )
    expect(settingsRows()).toEqual([])

    await seedSignupLocale(
      () => harness.db,
      { path: '/callback/google', request },
      { userId, organizationId },
    )
    expect(settingsRows()).toEqual([
      { organization_id: organizationId, user_id: userId, locale: 'pl' },
    ])
  })
})
