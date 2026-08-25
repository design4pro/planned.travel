/**
 * The `admin` plugin's HTTP surface, proved shut from the outside (docs/ACCESS.md §2.6), the ban
 * chain proved end to end (§4.3), and the freshness of the session read that carries a ban forward.
 *
 * The third concern belongs here rather than beside `../session` because it needs exactly what this
 * file already builds: a real `auth` instance, a real cookie, and a real database to take a session
 * row out of. It is the same chain — a ban is only as immediate as the next session read is fresh.
 *
 * `__tests__/admin-options.test.ts` asserts the *array*. This file asserts the *surface*: it drives
 * the real `auth.handler` with a real `admin`-role session cookie and reads the status code. It
 * does not care how the closure was achieved, so it keeps passing if a later round replaces
 * `disabledPaths` with something better, and it fails if the array is right and the wiring is not —
 * `disabledPaths` written inside `admin({ … })` type-checks as an ignored extra property, and only
 * a test at this level notices.
 *
 * Two variants are here for a reason each. Matching is `Array.includes()` on a `basePath`-stripped
 * path, so it is exact and case-sensitive: a trailing slash is normalised away by
 * `normalizePathname` and *is* caught by the list, while a differently-cased path is not in the
 * list at all and is answered by the router having no such route. Both must be `404`, by whichever
 * mechanism, and asserting the outcome rather than the mechanism is the point.
 *
 * The mocks are the ones `src/server/email/__tests__/templates.test.tsx` already establishes:
 * `./env` imports `cloudflare:workers` and `./db` reaches it, so both are replaced with plain
 * values — an in-memory SQLite database behind the Drizzle proxy driver and an in-memory KV. Two
 * more are added and named: `./email` because rendering nine React templates on every sign-up is
 * unrelated cost, and `#/server/catalog/audit` because the ban tripwire's contract is that a
 * *throwing* writer cannot reach the caller, which is unobservable while the writer works.
 * Everything else — the plugin, the router, `disabledPaths`, the hooks, the cookies, the password
 * hashing — is the code that ships.
 */

import { DatabaseSync } from 'node:sqlite'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import {
  generateSQLiteDrizzleJson,
  generateSQLiteMigration,
} from 'drizzle-kit/api'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { BANNED_USER_MESSAGE } from '#/routes/(auth)/-lib/errors'
import { authSchema } from '#/server/db/auth-schema'
import { DISABLED_ADMIN_PATHS } from '../admin-options'
import type * as CatalogAudit from '#/server/catalog/audit'
import type { Auth } from '../index'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'

const BASE_URL = 'http://localhost:3000'
const AUTH_BASE = `${BASE_URL}/api/auth`
const PASSWORD = 'correct-horse-battery-staple'

/** The value types `node:sqlite` accepts as a bound parameter. */
type SqliteValue = null | number | bigint | string | Uint8Array

/** Whatever `auth.api.getSession` takes, so the captured argument is never widened by a cast. */
type GetSessionArgument = NonNullable<Parameters<Auth['api']['getSession']>[0]>

const shared = vi.hoisted(() => {
  /** Filled in `beforeAll`; the auth instance is memoised, so one database serves the file. */
  const db: { current: unknown } = { current: null }
  /** What the mocked `getRequest()` hands `../session`. Set per test. */
  const request: { current: Request } = {
    current: new Request('http://localhost:3000'),
  }
  return {
    db,
    request,
    kv: new Map<string, string>(),
    appendPlatformAudit: vi.fn(),
  }
})

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
    throw new Error('The queue is not exercised by an HTTP-surface test.')
  },
  trustedOrigins: () => [BASE_URL],
}))

vi.mock('#/server/auth/db', () => ({
  authDb: () => shared.db.current,
}))

vi.mock('#/server/auth/email', () => ({
  queueAuthEmail: async () => undefined,
}))

vi.mock('#/server/catalog/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof CatalogAudit>()
  return { ...actual, appendPlatformAudit: shared.appendPlatformAudit }
})

// `../session` is the one module under test here that needs a request in scope. Only `getRequest`
// is replaced: the rest of the module is never reached from this file.
vi.mock('@tanstack/react-start/server', () => ({
  getRequest: () => shared.request.current,
}))

const { PLATFORM_ACTIONS, PLATFORM_SYSTEM_ACTOR } = await import(
  '#/server/catalog/audit'
)
const { getAuth } = await import('../index')
const { getSession } = await import('../session')

/* -------------------------------------------------------------------------------------------------
 * The database
 * ---------------------------------------------------------------------------------------------- */

function toSqliteParams(params: ReadonlyArray<unknown>): Array<SqliteValue> {
  return params.map((param) => {
    if (param === null || param === undefined) return null
    if (typeof param === 'boolean') return param ? 1 : 0
    if (param instanceof Date) return param.getTime()
    if (
      typeof param === 'number' ||
      typeof param === 'bigint' ||
      typeof param === 'string' ||
      param instanceof Uint8Array
    ) {
      return param
    }
    return JSON.stringify(param)
  })
}

function runStatement(
  sqlite: DatabaseSync,
  query: string,
  params: ReadonlyArray<unknown>,
  method: 'run' | 'all' | 'values' | 'get',
): { rows: Array<unknown> } {
  const statement = sqlite.prepare(query)
  const bound = toSqliteParams(params)

  if (method === 'run') {
    statement.run(...bound)
    return { rows: [] }
  }

  // Drizzle maps result rows positionally, so rows must come back as arrays.
  statement.setReturnArrays(true)
  const rows = statement.all(...bound) as unknown as Array<Array<unknown>>
  return method === 'get' ? { rows: rows[0] ?? [] } : { rows }
}

let sqlite: DatabaseSync
/** The same handle `authDb()` is mocked to return, kept typed for the reference instance below. */
let authDatabase: SqliteRemoteDatabase<typeof authSchema>

beforeAll(async () => {
  const statements = await generateSQLiteMigration(
    await generateSQLiteDrizzleJson({}),
    await generateSQLiteDrizzleJson(authSchema),
  )
  sqlite = new DatabaseSync(':memory:')
  for (const statement of statements) sqlite.exec(statement)

  authDatabase = drizzle(
    async (query, params, method) => runStatement(sqlite, query, params, method),
    async (queries) =>
      queries.map((entry) =>
        runStatement(sqlite, entry.sql, entry.params, entry.method),
      ),
    { schema: authSchema },
  )
  shared.db.current = authDatabase
})

afterAll(() => {
  sqlite.close()
})

// The writer spy is created in `vi.hoisted`, outside the per-file mock registry `restoreMocks`
// sweeps, so its call log survives a test boundary unless it is reset here.
beforeEach(() => {
  shared.appendPlatformAudit.mockReset()
})

/* -------------------------------------------------------------------------------------------------
 * Driving the real handler
 * ---------------------------------------------------------------------------------------------- */

function post(path: string, body: unknown, cookie?: string): Promise<Response> {
  const headers = new Headers({
    'content-type': 'application/json',
    origin: BASE_URL,
  })
  if (cookie) headers.set('cookie', cookie)
  return getAuth().handler(
    new Request(`${AUTH_BASE}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  )
}

function get(url: string, cookie?: string): Promise<Response> {
  const headers = new Headers({ origin: BASE_URL })
  if (cookie) headers.set('cookie', cookie)
  return getAuth().handler(new Request(url, { method: 'GET', headers }))
}

/** The `planned.session_token` pair, ready to be sent straight back as a `Cookie` header. */
function sessionCookie(response: Response): string {
  const setCookies = response.headers.getSetCookie()
  const token = setCookies.find((entry) =>
    entry.startsWith('planned.session_token='),
  )
  if (token === undefined) {
    throw new Error(`no session cookie in ${JSON.stringify(setCookies)}`)
  }
  return token.split(';')[0]
}

async function createAccount(email: string): Promise<string> {
  const response = await post('/sign-up/email', {
    email,
    password: PASSWORD,
    name: email.split('@')[0],
  })
  expect(response.status).toBe(200)
  const row = sqlite.prepare('select id from user where email = ?').get(email)
  const id = (row as { id?: unknown } | undefined)?.id
  if (typeof id !== 'string') throw new Error(`no user row for ${email}`)
  return id
}

/**
 * Signs in fresh, so the session is created *after* whatever the test just wrote to the row.
 *
 * Better Auth resolves a session token from KV before it would look at D1, so a cookie minted
 * before a `role` or `banned` write keeps answering with the snapshot it was minted from. Every
 * test here therefore signs in after its setup rather than reusing an earlier cookie — which is
 * the same property the ban path in the console has to respect, one layer down.
 */
function signIn(email: string): Promise<Response> {
  return post('/sign-in/email', { email, password: PASSWORD })
}

function setRole(userId: string, role: string): void {
  sqlite.prepare('update user set role = ? where id = ?').run(role, userId)
}

function applyBan(userId: string, expiresAt: Date | null): void {
  sqlite
    .prepare(
      'update user set banned = 1, ban_reason = ?, ban_expires = ? where id = ?',
    )
    .run('spam', expiresAt === null ? null : expiresAt.getTime(), userId)
}

function banStateOf(userId: string): { banned: number } {
  const row = sqlite
    .prepare('select banned from user where id = ?')
    .get(userId) as { banned: number }
  return row
}

/* -------------------------------------------------------------------------------------------------
 * The tests
 * ---------------------------------------------------------------------------------------------- */

describe('the fifteen /api/auth/admin/* paths answer 404', () => {
  let cookie: string
  let adminUserId: string

  beforeAll(async () => {
    adminUserId = await createAccount('operator@planned.travel')
    setRole(adminUserId, 'admin')
    // The sign-up already minted a session from the pre-promotion row; drop the cached blobs so
    // the sign-in below reads the promoted row rather than that snapshot.
    shared.kv.clear()
    cookie = sessionCookie(await signIn('operator@planned.travel'))
  })

  it('holds a real session whose user carries the admin platform role', async () => {
    // The positive control. Without it a blanket 404 from a broken handler would look like a
    // closed surface, and an unauthenticated request would look like one too.
    const response = await get(`${AUTH_BASE}/get-session`, cookie)
    expect(response.status).toBe(200)

    const body: {
      user: { id: string; role: string | null }
      session: { activeOrganizationId: string | null }
    } = await response.json()
    expect(body.user.id).toBe(adminUserId)
    expect(body.user.role).toBe('admin')
  })

  it('still lands that session inside a tenant, with the ban hook composed ahead', async () => {
    // Plugin `databaseHooks` queue rather than merge, plugin-first and ours last, so registering
    // `admin()` in front of everything must not have displaced the organization provisioning in
    // `session.create.before`. If it had, every authenticated screen would see a null tenant.
    const response = await get(`${AUTH_BASE}/get-session`, cookie)
    const body: { session: { activeOrganizationId: string | null } } =
      await response.json()
    expect(body.session.activeOrganizationId).not.toBeNull()
  })

  it('answers a live core endpoint for the same cookie (positive control)', async () => {
    const response = await get(`${AUTH_BASE}/list-sessions`, cookie)
    expect(response.status).toBe(200)
  })

  it.each(DISABLED_ADMIN_PATHS)('404s POST %s', async (path) => {
    const response = await post(path, {}, cookie)
    expect(response.status).toBe(404)
  })

  it.each(DISABLED_ADMIN_PATHS)('404s GET %s', async (path) => {
    const response = await get(`${AUTH_BASE}${path}`, cookie)
    expect(response.status).toBe(404)
  })

  it('404s a trailing-slash variant, which normalisation folds into the list', async () => {
    const response = await get(`${AUTH_BASE}/admin/list-users/`, cookie)
    expect(response.status).toBe(404)
  })

  it('404s a differently-cased variant, which the list never matches', async () => {
    // `includes()` is case-sensitive, so this one is not closed by `disabledPaths` at all — the
    // router simply has no such route. Same outcome, different mechanism, and the surface is what
    // is being asserted.
    const response = await get(`${AUTH_BASE}/admin/List-Users`, cookie)
    expect(response.status).toBe(404)
  })

  it('leaves the endpoints reachable in process, which is the whole point', async () => {
    // `auth.api` is built by `getEndpoints()` and never passes through `router()`, so the console
    // server functions still have a way to perform the action that the browser does not.
    const listed = await getAuth().api.listUsers({
      query: { limit: 1 },
      headers: new Headers({ cookie }),
    })
    expect(listed.users.length).toBeGreaterThan(0)
  })
})

describe('the ban chain', () => {
  it('refuses a banned account at sign-in, in repo copy', async () => {
    const userId = await createAccount('banned@planned.travel')
    applyBan(userId, null)
    shared.kv.clear()

    const response = await signIn('banned@planned.travel')
    expect(response.status).toBe(403)

    const body: { code?: string; message?: string } = await response.json()
    expect(body.code).toBe('BANNED_USER')
    expect(body.message).toBe(BANNED_USER_MESSAGE)
    expect(body.message).not.toContain('banned from this application')
  })

  it('audits an expired ban that lifts itself, as a system actor', async () => {
    const userId = await createAccount('temporary@planned.travel')
    applyBan(userId, new Date(Date.now() - 60_000))
    shared.kv.clear()

    const response = await signIn('temporary@planned.travel')
    expect(response.status).toBe(200)
    expect(banStateOf(userId).banned).toBe(0)

    expect(shared.appendPlatformAudit).toHaveBeenCalledTimes(1)
    const [, actor, entry] = shared.appendPlatformAudit.mock.calls[0] as [
      unknown,
      typeof PLATFORM_SYSTEM_ACTOR,
      { action: string; entityId: string | null },
    ]
    expect(actor).toEqual(PLATFORM_SYSTEM_ACTOR)
    expect(actor.actorKind).toBe('system')
    expect(entry.action).toBe(PLATFORM_ACTIONS.USER_UNBANNED)
    expect(entry.entityId).toBe(userId)
  })

  it('does not audit an ordinary sign-in, so the ledger stays a ledger', async () => {
    await createAccount('ordinary@planned.travel')
    shared.kv.clear()

    const response = await signIn('ordinary@planned.travel')
    expect(response.status).toBe(200)
    expect(shared.appendPlatformAudit).not.toHaveBeenCalled()
  })

  it('lets the sign-in succeed even when the audit writer throws', async () => {
    // `queueAfterTransactionHook` runs an `after` hook inline when no transaction is open, and no
    // endpoint on this stack opens one — so an unguarded rejection here would surface as a failed
    // sign-in for an account whose ban has just expired. The tripwire swallows it.
    shared.appendPlatformAudit.mockRejectedValueOnce(
      new Error('the audit sink is unreachable'),
    )

    const userId = await createAccount('unreachable@planned.travel')
    applyBan(userId, new Date(Date.now() - 60_000))
    shared.kv.clear()

    const response = await signIn('unreachable@planned.travel')
    expect(response.status).toBe(200)
    expect(shared.appendPlatformAudit).toHaveBeenCalledTimes(1)
    expect(banStateOf(userId).banned).toBe(0)
  })
})

/* -------------------------------------------------------------------------------------------------
 * The freshness of the session read (docs/ACCESS.md §4.3)
 * ---------------------------------------------------------------------------------------------- */

/**
 * A second Better Auth instance, identical to nothing in production except that it still has
 * `session.cookieCache` switched on.
 *
 * It exists because the production instance no longer has one, which is exactly what makes the
 * mistake this section guards against invisible. `dist/api/routes/session.mjs:48` gates the cached
 * read on `sessionDataPayload?.session && options.session?.cookieCache?.enabled &&
 * !ctx.query?.disableCookieCache`, so with `cookieCache` absent the third clause is dead code:
 * moving `disableCookieCache` out of `query` changes no behaviour, breaks no test, and arms a
 * 300-second window the moment anyone turns the cache back on. Proving the spelling matters needs an
 * instance where that clause is live, and the only honest place to get one is here.
 *
 * Deliberately minimal, and deliberately not derived from `buildAuth()`'s options: it is a reference
 * for one library mechanism, not a second copy of our configuration. No secondary storage, so the
 * database row is the only thing behind the cache and removing it is enough to tell the two apart.
 */
function referenceAuthWithCookieCache() {
  return betterAuth({
    baseURL: BASE_URL,
    basePath: '/api/auth',
    secret: 'test-secret-not-used-outside-this-process',
    trustedOrigins: [BASE_URL],
    database: drizzleAdapter(authDatabase, {
      provider: 'sqlite',
      schema: authSchema,
      usePlural: false,
    }),
    session: { cookieCache: { enabled: true, maxAge: 300 } },
    emailAndPassword: { enabled: true, autoSignIn: true },
    advanced: { cookiePrefix: 'cachecheck' },
  })
}

/** An object's own keys, read without the declared type deciding which ones may be asked about. */
function keysOf(value: object): Array<string> {
  return Object.keys(value)
}

/** Every cookie a response set, folded back into one `Cookie` request header. */
function allCookies(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((entry) => entry.split(';')[0])
    .join('; ')
}

describe('getSession() asks for an uncached read, in the only spelling that works', () => {
  /** The exact argument `../session` handed `auth.api.getSession` on a real call. */
  let capturedArgument: GetSessionArgument
  let liveSession: Awaited<ReturnType<typeof getSession>>
  let liveUserId: string

  beforeAll(async () => {
    liveUserId = await createAccount('fresh-read@planned.travel')
    shared.kv.clear()
    const cookie = sessionCookie(await signIn('fresh-read@planned.travel'))
    shared.request.current = new Request(BASE_URL, { headers: { cookie } })

    // Spying rather than stubbing: the call runs for real, so the argument recorded here is the one
    // that just resolved a live session rather than a shape asserted in isolation.
    const spy = vi.spyOn(getAuth().api, 'getSession')
    liveSession = await getSession()

    if (spy.mock.calls.length !== 1) {
      throw new Error(
        `getSession() reached auth.api.getSession ${spy.mock.calls.length} times, expected once`,
      )
    }
    const argument = spy.mock.calls[0][0]
    if (argument === undefined) {
      throw new Error('getSession() passed no options at all')
    }
    capturedArgument = argument
    spy.mockRestore()
  })

  it('resolves a real session through the production call site (positive control)', () => {
    // Without this, the argument shape asserted below could belong to a call that returns nothing.
    expect(liveSession?.user.id).toBe(liveUserId)
  })

  it('passes disableCookieCache as a query parameter, never as a sibling option', () => {
    expect(keysOf(capturedArgument).sort()).toEqual(['headers', 'query'])
    expect(capturedArgument.query).toEqual({ disableCookieCache: true })
    // Named explicitly, because this is the whole mistake: a sibling type-checks and does nothing.
    expect(Object.hasOwn(capturedArgument, 'disableCookieCache')).toBe(false)
  })

  it('hands over the request headers rather than a copy of some of them', () => {
    expect(capturedArgument.headers).toBe(shared.request.current.headers)
  })

  it('leaves no cookie cache in the shipped options for the flag to fight', () => {
    // The other half of the same decision, and just as silent if it regresses: the flag removes a
    // 300-second window, and so does the absence of the block that would open it.
    //
    // Read as keys rather than as `options.session.cookieCache`, which does not type-check at all
    // while the block is absent — a compile error is a fine guarantee but a poor regression test,
    // since re-adding the block would make the property exist and the expression pass.
    expect(keysOf(getAuth().options.session)).not.toContain('cookieCache')
  })

  describe('against an instance whose cookie cache is live', () => {
    let referenceAuth: ReturnType<typeof referenceAuthWithCookieCache>
    let cachedHeaders: Headers

    beforeAll(async () => {
      referenceAuth = referenceAuthWithCookieCache()
      const signedUp = await referenceAuth.handler(
        new Request(`${AUTH_BASE}/sign-up/email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: BASE_URL },
          body: JSON.stringify({
            email: 'cached-read@planned.travel',
            password: PASSWORD,
            name: 'cached',
          }),
        }),
      )
      expect(signedUp.status).toBe(200)
      cachedHeaders = new Headers({ cookie: allCookies(signedUp) })

      // Take the row away. From here the signed cookie snapshot is the only thing that can still
      // answer, so "did this read consult the database" becomes observable from the outside.
      sqlite
        .prepare(
          'delete from session where user_id in (select id from user where email = ?)',
        )
        .run('cached-read@planned.travel')
    })

    it('serves the stale snapshot when the flag is spelled as a sibling option', async () => {
      // The control that gives the assertion below its meaning. `getSessionQuerySchema` strips keys
      // it does not declare and the endpoint reads `ctx.query`, so a sibling is not rejected, not
      // warned about and not read — it is simply somewhere the code never looks.
      const siblingSpelling = { headers: cachedHeaders, disableCookieCache: true }
      const served = await referenceAuth.api.getSession(siblingSpelling)
      expect(served?.session).toBeDefined()
    })

    it('bypasses it for the argument the production call site actually builds', async () => {
      const bypassed = await referenceAuth.api.getSession({
        ...capturedArgument,
        headers: cachedHeaders,
      })
      expect(bypassed).toBeNull()
    })
  })
})
