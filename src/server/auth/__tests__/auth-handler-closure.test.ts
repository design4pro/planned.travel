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
import { BANNED_USER_MESSAGE } from '#/server/auth/admin-options'
import { authSchema } from '#/server/db/auth-schema'
import { workspaceParticipants } from '#/server/db/schema'
import { DISABLED_ADMIN_PATHS } from '../admin-options'
import type * as CatalogAudit from '#/server/catalog/audit'
import type { AuthDb } from '../db'
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
const { WORKSPACE_LIMIT, createOrganizationFor } = await import(
  '../provisioning'
)
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
    await generateSQLiteDrizzleJson({ ...authSchema, workspaceParticipants }),
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

/* -------------------------------------------------------------------------------------------------
 * Switching the active workspace (the workspace switcher, #640)
 * ---------------------------------------------------------------------------------------------- */

/**
 * `organization/set-active` is the only server-side check the switcher relies on, so it is pinned
 * here against the real plugin rather than assumed from its documentation. A Better Auth upgrade
 * that changes what a refused switch does must fail this file instead of shipping.
 *
 * What the library does today, and what the switcher's error branch is written around: a switch to
 * a workspace the caller does not belong to clears `session.activeOrganizationId` *before* it
 * answers 403, so a refusal is not "nothing changed" - the next request resolves through the
 * oldest membership instead.
 */
describe('organization/set-active', () => {
  let cookie: string
  let ownOrganizationId: string
  let foreignOrganizationId: string
  let secondOrganizationId: string

  function organizationOf(email: string): string {
    const row = sqlite
      .prepare(
        'select m.organization_id as id from member m join user u on u.id = m.user_id where u.email = ?',
      )
      .get(email) as { id: string } | undefined
    if (row === undefined) throw new Error(`no membership for ${email}`)
    return row.id
  }

  /** The workspace the reader's session row points at, read from the table rather than the API. */
  function activeOrganizationOf(email: string): string | null {
    const row = sqlite
      .prepare(
        'select s.active_organization_id as id from session s join user u on u.id = s.user_id where u.email = ? order by s.created_at desc limit 1',
      )
      .get(email) as { id: string | null } | undefined
    if (row === undefined) throw new Error(`no session for ${email}`)
    return row.id
  }

  beforeAll(async () => {
    await createAccount('switcher@planned.travel')
    await createAccount('stranger@planned.travel')
    ownOrganizationId = organizationOf('switcher@planned.travel')
    foreignOrganizationId = organizationOf('stranger@planned.travel')

    shared.kv.clear()
    cookie = sessionCookie(await signIn('switcher@planned.travel'))

    // A second workspace the reader genuinely belongs to. Written as rows rather than through the
    // plugin's create endpoint, which is a different feature (#804) and may be closed to the client.
    const userId = (
      sqlite
        .prepare('select id from user where email = ?')
        .get('switcher@planned.travel') as { id: string }
    ).id
    secondOrganizationId = 'org_second_workspace'
    sqlite
      .prepare(
        'insert into organization (id, name, slug, created_at) values (?, ?, ?, ?)',
      )
      .run(secondOrganizationId, 'Second workspace', 'second-workspace', Date.now())
    sqlite
      .prepare(
        'insert into member (id, organization_id, user_id, role, created_at) values (?, ?, ?, ?, ?)',
      )
      .run('mem_second_workspace', secondOrganizationId, userId, 'member', Date.now())
  })

  it('moves the session to another workspace the reader belongs to', async () => {
    const response = await post(
      '/organization/set-active',
      { organizationId: secondOrganizationId },
      cookie,
    )

    expect(response.status).toBe(200)
    expect(activeOrganizationOf('switcher@planned.travel')).toBe(
      secondOrganizationId,
    )

    const back = await post(
      '/organization/set-active',
      { organizationId: ownOrganizationId },
      cookie,
    )
    expect(back.status).toBe(200)
    expect(activeOrganizationOf('switcher@planned.travel')).toBe(
      ownOrganizationId,
    )
  })

  it('refuses a workspace the reader does not belong to, and never leaves it active', async () => {
    const response = await post(
      '/organization/set-active',
      { organizationId: foreignOrganizationId },
      cookie,
    )

    expect(response.status).toBe(403)
    const active = activeOrganizationOf('switcher@planned.travel')
    expect(active).not.toBe(foreignOrganizationId)
    // Cleared rather than kept: the behaviour the switcher's FORBIDDEN branch re-syncs around.
    expect(active).toBeNull()
  })
})

/* -------------------------------------------------------------------------------------------------
 * Creating a workspace is server-side only (#804)
 * ---------------------------------------------------------------------------------------------- */

/**
 * `createWorkspace` carries the plan gate, the role rule, the workspace limit and the impersonation
 * veto, and the plugin's own endpoint carries none of them. `allowUserToCreateOrganization: false`
 * is what keeps a hand-made `POST /api/auth/organization/create` from being a way round all four,
 * so it is pinned against the real handler rather than read off the options. `disabledPaths` stays
 * the admin plugin's list (docs/ACCESS.md §2.6): this closure lives inside the plugin's own config.
 */
describe('organization/create', () => {
  let cookie: string
  let activeBefore: string | null

  function organizationCount(): number {
    const row = sqlite
      .prepare('select count(*) as n from organization')
      .get() as {
      n: number
    }
    return row.n
  }

  function activeOrganizationOf(email: string): string | null {
    const row = sqlite
      .prepare(
        'select s.active_organization_id as id from session s join user u on u.id = s.user_id where u.email = ? order by s.created_at desc limit 1',
      )
      .get(email) as { id: string | null } | undefined
    if (row === undefined) throw new Error(`no session for ${email}`)
    return row.id
  }

  beforeAll(async () => {
    await createAccount('creator@planned.travel')
    shared.kv.clear()
    cookie = sessionCookie(await signIn('creator@planned.travel'))
    activeBefore = activeOrganizationOf('creator@planned.travel')
  })

  it('refuses a signed-in caller with 403 and writes nothing', async () => {
    const before = organizationCount()

    const response = await post(
      '/organization/create',
      { name: 'Sneaky', slug: 'sneaky' },
      cookie,
    )

    expect(response.status).toBe(403)
    // The plugin's own refusal, so a 403 from an origin check or other middleware cannot stand in.
    const body: { code?: string } = await response.json()
    expect(body.code).toBe('YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION')
    expect(organizationCount()).toBe(before)
  })

  it('answers an anonymous caller with 401', async () => {
    const response = await post('/organization/create', {
      name: 'Anonymous',
      slug: 'anonymous',
    })

    expect(response.status).toBe(401)
  })

  it('leaves organization/set-active answering for the same session (positive control)', async () => {
    expect(activeBefore).not.toBeNull()

    const response = await post(
      '/organization/set-active',
      { organizationId: activeBefore },
      cookie,
    )

    expect(response.status).toBe(200)
  })

  it('makes an in-process activation visible on the next getSession(), read uncached', async () => {
    // `createWorkspace` activates the new workspace in process, with the request's headers. The
    // reader must land in it on the very next request, so the session row is what is asserted.
    const userId = (
      sqlite
        .prepare('select id from user where email = ?')
        .get('creator@planned.travel') as { id: string }
    ).id
    const created = await createOrganizationFor(
      authDatabase as unknown as AuthDb,
      { id: userId },
      { name: 'Created in process', metadata: null },
    )
    shared.request.current = new Request(BASE_URL, { headers: { cookie } })

    await getAuth().api.setActiveOrganization({
      headers: shared.request.current.headers,
      body: { organizationId: created },
    })
    const spy = vi.spyOn(getAuth().api, 'getSession')
    const session = await getSession()

    expect(session?.session.activeOrganizationId).toBe(created)
    expect(spy.mock.calls[0][0]?.query).toEqual({ disableCookieCache: true })
    spy.mockRestore()
    // And the new workspace is listed for the caller, which is what the switcher reads.
    const listed = await getAuth().api.listOrganizations({
      headers: shared.request.current.headers,
    })
    expect(listed.map((entry) => entry.id)).toContain(created)
  })

  it('reads the workspace limit from the one exported constant', () => {
    // The plugin enforces `organizationLimit` only inside its own create endpoint, and creation
    // no longer goes through it: `createWorkspace` counts against the same constant.
    const plugin = getAuth().options.plugins?.find(
      (entry) => entry.id === 'organization',
    )
    const options =
      plugin !== undefined && 'options' in plugin ? plugin.options : undefined

    expect(options).toMatchObject({
      organizationLimit: WORKSPACE_LIMIT,
      allowUserToCreateOrganization: false,
      disableOrganizationDeletion: true,
    })
  })
})

/* -------------------------------------------------------------------------------------------------
 * Deleting a workspace is closed at the handler (#999)
 * ---------------------------------------------------------------------------------------------- */

/**
 * The plugin's `organization/delete` removes the `organization` row and lets `orgRef()` cascade over
 * every tenant table, and it cancels no subscription, purges no storage and writes no audit entry.
 * `disableOrganizationDeletion` is checked before the session is looked up, so the refusal is the
 * same for an owner and for an anonymous caller. The closure is pinned against the real handler;
 * the product-owned path that replaces it is #1000, and it must decide the flag explicitly: it stays
 * for a deletion done through repository SQL.
 */
describe('organization/delete', () => {
  let cookie: string
  let organizationId: string

  function count(table: 'organization' | 'member' | 'invitation'): number {
    const column = table === 'organization' ? 'id' : 'organization_id'
    const row = sqlite
      .prepare(`select count(*) as n from ${table} where ${column} = ?`)
      .get(organizationId) as { n: number }
    return row.n
  }

  beforeAll(async () => {
    const userId = await createAccount('deleter@planned.travel')
    organizationId = (
      sqlite
        .prepare('select organization_id as id from member where user_id = ?')
        .get(userId) as { id: string }
    ).id
    // A row in a table that `organization` cascades over, standing in for a tenant table: the
    // in-memory database carries the auth tables only.
    sqlite
      .prepare(
        'insert into invitation (id, organization_id, email, role, status, inviter_id, expires_at, created_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        'inv_tenant_row',
        organizationId,
        'guest@planned.travel',
        'member',
        'pending',
        userId,
        Date.now() + 60_000,
        Date.now(),
      )
    shared.kv.clear()
    cookie = sessionCookie(await signIn('deleter@planned.travel'))
  })

  it('refuses the owner of the workspace with 404 and deletes nothing', async () => {
    const response = await post('/organization/delete', { organizationId }, cookie)

    expect(response.status).toBe(404)
    // The plugin's own refusal, so a 404 from the router having no such route cannot stand in.
    const body: { code?: string } = await response.json()
    expect(body.code).toBe('ORGANIZATION_DELETION_DISABLED')
    expect(count('organization')).toBe(1)
    expect(count('member')).toBeGreaterThan(0)
    expect(count('invitation')).toBe(1)
  })

  it('answers an anonymous caller the same way, not with the 401 organization/create gives', async () => {
    const response = await post('/organization/delete', { organizationId })

    expect(response.status).toBe(404)
    const body: { code?: string } = await response.json()
    expect(body.code).toBe('ORGANIZATION_DELETION_DISABLED')
    expect(count('organization')).toBe(1)
  })

  it('refuses the in-process call too', async () => {
    await expect(
      getAuth().api.deleteOrganization({
        headers: new Headers({ cookie }),
        body: { organizationId },
      }),
    ).rejects.toMatchObject({ body: { code: 'ORGANIZATION_DELETION_DISABLED' } })
    expect(count('organization')).toBe(1)
  })

  it('leaves organization/set-active answering for the same session (positive control)', async () => {
    const response = await post(
      '/organization/set-active',
      { organizationId },
      cookie,
    )

    expect(response.status).toBe(200)
  })
})

/* -------------------------------------------------------------------------------------------------
 * Changing a member's role is server-side only (#995)
 * ---------------------------------------------------------------------------------------------- */

/**
 * `changeRole` audits a role change, holds the owner ceiling and refuses an impersonated session;
 * the plugin's `organization/update-member-role` does none of those and accepts a comma-joined role
 * string, so a hand-made `POST` would be a way round all three. It is closed over HTTP by
 * `DISABLED_ORGANIZATION_PATHS`, a list of its own beside the admin list (docs/ACCESS.md §2.6), and
 * stays usable in process, which `last-owner-plugin.test.ts` drives.
 */
describe('organization/update-member-role', () => {
  let cookie: string
  let organizationId: string
  let memberId: string

  function roleOf(id: string): string {
    return (
      sqlite.prepare('select role from member where id = ?').get(id) as {
        role: string
      }
    ).role
  }

  beforeAll(async () => {
    const ownerId = await createAccount('role-owner@planned.travel')
    const colleagueId = await createAccount('role-colleague@planned.travel')
    organizationId = (
      sqlite
        .prepare('select organization_id as id from member where user_id = ?')
        .get(ownerId) as { id: string }
    ).id
    memberId = 'mem_role_colleague'
    sqlite
      .prepare(
        'insert into member (id, organization_id, user_id, role, created_at) values (?, ?, ?, ?, ?)',
      )
      .run(memberId, organizationId, colleagueId, 'member', Date.now())
    shared.kv.clear()
    cookie = sessionCookie(await signIn('role-owner@planned.travel'))
  })

  it('answers a real owner session with 404 and changes nothing', async () => {
    for (const role of ['admin', 'owner', 'admin,owner']) {
      const response = await post(
        '/organization/update-member-role',
        { memberId, role, organizationId },
        cookie,
      )

      expect(response.status).toBe(404)
      expect(roleOf(memberId)).toBe('member')
    }
  })

  it('leaves organization/set-active answering for the same session (positive control)', async () => {
    const response = await post(
      '/organization/set-active',
      { organizationId },
      cookie,
    )

    expect(response.status).toBe(200)
  })

  it('stays usable in process, which is the audited path’s own building block', async () => {
    await getAuth().api.updateMemberRole({
      body: { memberId, role: 'admin', organizationId },
      headers: new Headers({ cookie }),
    })

    expect(roleOf(memberId)).toBe('admin')
  })
})

/* -------------------------------------------------------------------------------------------------
 * A workspace switch inside an impersonated session is audited (#959, docs/ACCESS.md §6.4)
 * ---------------------------------------------------------------------------------------------- */

/**
 * `databaseHooks.session.update` is the one place every change of `activeOrganizationId` passes
 * through, so the tests drive the real handler and the real plugin endpoints and read the writer's
 * spy, never a hook in isolation. The session is made the way the console makes it: `admin()`'s own
 * `impersonateUser`, in process (its HTTP path answers `404`).
 */
describe('a workspace switch inside an impersonated session', () => {
  const ACTION = 'platform.user.impersonation_workspace_changed'

  let operatorId: string
  let targetId: string
  let targetEmail: string
  let operatorCookie: string
  let ownOrganizationId: string
  let secondOrganizationId: string
  let foreignOrganizationId: string
  let inviterCookie: string
  let inviterOrganizationId: string

  function organizationOf(email: string): string {
    const row = sqlite
      .prepare(
        'select m.organization_id as id from member m join user u on u.id = m.user_id where u.email = ?',
      )
      .get(email) as { id: string } | undefined
    if (row === undefined) throw new Error(`no membership for ${email}`)
    return row.id
  }

  function activeOrganizationOf(sessionCookieValue: string): string | null {
    const token = decodeURIComponent(sessionCookieValue.split('=')[1]).split(
      '.',
    )[0]
    const row = sqlite
      .prepare(
        'select active_organization_id as id from session where token = ?',
      )
      .get(token) as { id: string | null } | undefined
    if (row === undefined) throw new Error('no session row for the cookie')
    return row.id
  }

  /** A fresh impersonated session of the target, worn by the operator, as a `Cookie` header value. */
  async function impersonate(): Promise<string> {
    const result = await getAuth().api.impersonateUser({
      body: { userId: targetId },
      headers: new Headers({ cookie: operatorCookie }),
      returnHeaders: true,
    })
    // `impersonateUser` first expires the operator's cookie and then sets the worn one, under the
    // same name: the last `session_token` entry is the one that counts.
    const worn = result.headers
      .getSetCookie()
      .filter((entry) => entry.startsWith('planned.session_token='))
      .at(-1)
    if (worn === undefined) throw new Error('no worn session cookie')
    return worn.split(';')[0]
  }

  /** What the one expected row was written with. */
  function onlyEntry(): {
    actor: unknown
    entry: unknown
  } {
    expect(shared.appendPlatformAudit).toHaveBeenCalledTimes(1)
    const [, actor, entry] = shared.appendPlatformAudit.mock.calls[0] as [
      unknown,
      unknown,
      unknown,
    ]
    return { actor, entry }
  }

  const OPERATOR_ACTOR = () => ({
    userId: operatorId,
    actorKind: 'human',
    role: 'admin',
    tokenId: null,
  })

  beforeAll(async () => {
    operatorId = await createAccount('operator-959@planned.travel')
    setRole(operatorId, 'admin')
    targetEmail = 'target-959@planned.travel'
    targetId = await createAccount(targetEmail)
    // Accepting an invitation needs a verified address; the sign-up above does not send one here.
    sqlite
      .prepare('update user set email_verified = 1 where id = ?')
      .run(targetId)
    await createAccount('inviter-959@planned.travel')
    await createAccount('stranger-959@planned.travel')
    ownOrganizationId = organizationOf(targetEmail)
    foreignOrganizationId = organizationOf('stranger-959@planned.travel')
    inviterOrganizationId = organizationOf('inviter-959@planned.travel')

    secondOrganizationId = 'org_959_second'
    sqlite
      .prepare(
        'insert into organization (id, name, slug, created_at) values (?, ?, ?, ?)',
      )
      .run(secondOrganizationId, 'Second workspace', 'second-959', Date.now())
    sqlite
      .prepare(
        'insert into member (id, organization_id, user_id, role, created_at) values (?, ?, ?, ?, ?)',
      )
      .run(
        'mem_959_second',
        secondOrganizationId,
        targetId,
        'member',
        Date.now(),
      )

    shared.kv.clear()
    operatorCookie = sessionCookie(await signIn('operator-959@planned.travel'))
    inviterCookie = sessionCookie(await signIn('inviter-959@planned.travel'))
  })

  it('writes one row for an impersonated set-active over HTTP, naming the operator and both ids', async () => {
    const cookie = await impersonate()
    expect(activeOrganizationOf(cookie)).toBe(ownOrganizationId)

    const response = await post(
      '/organization/set-active',
      { organizationId: secondOrganizationId },
      cookie,
    )

    expect(response.status).toBe(200)
    expect(activeOrganizationOf(cookie)).toBe(secondOrganizationId)
    const { actor, entry } = onlyEntry()
    // The operator's own role, read from the operator's own row: the worn session is the target's.
    expect(actor).toEqual(OPERATOR_ACTOR())
    expect(entry).toEqual({
      action: ACTION,
      entityId: targetId,
      changes: {
        before: { organizationId: ownOrganizationId },
        after: { organizationId: secondOrganizationId },
      },
    })
  })

  it('writes the same row for the in-process call, which is what the server functions make', async () => {
    const cookie = await impersonate()

    await getAuth().api.setActiveOrganization({
      headers: new Headers({ cookie }),
      body: { organizationId: secondOrganizationId },
    })

    expect(onlyEntry().entry).toMatchObject({
      action: ACTION,
      entityId: targetId,
      changes: {
        before: { organizationId: ownOrganizationId },
        after: { organizationId: secondOrganizationId },
      },
    })
  })

  it('carries ids and nothing else in changes', async () => {
    const cookie = await impersonate()

    await post(
      '/organization/set-active',
      { organizationId: secondOrganizationId },
      cookie,
    )

    const { entry } = onlyEntry()
    const changes = (entry as { changes: { before: object; after: object } })
      .changes
    expect(Object.keys(changes)).toEqual(['before', 'after'])
    expect(Object.keys(changes.before)).toEqual(['organizationId'])
    expect(Object.keys(changes.after)).toEqual(['organizationId'])
  })

  it('writes the row for an accepted invitation, which activates the new workspace', async () => {
    const invitation = await getAuth().api.createInvitation({
      headers: new Headers({ cookie: inviterCookie }),
      body: {
        email: targetEmail,
        role: 'member',
        organizationId: inviterOrganizationId,
      },
    })
    const cookie = await impersonate()

    await getAuth().api.acceptInvitation({
      headers: new Headers({ cookie }),
      body: { invitationId: invitation.id },
    })

    expect(activeOrganizationOf(cookie)).toBe(inviterOrganizationId)
    expect(onlyEntry().entry).toMatchObject({
      action: ACTION,
      entityId: targetId,
      changes: {
        before: { organizationId: ownOrganizationId },
        after: { organizationId: inviterOrganizationId },
      },
    })
  })

  it('writes the row, with a null after, when the impersonated session leaves its active workspace', async () => {
    // A workspace of its own, so the membership this test deletes is not one the other tests use.
    const leavingOrganizationId = 'org_959_leave'
    sqlite
      .prepare(
        'insert into organization (id, name, slug, created_at) values (?, ?, ?, ?)',
      )
      .run(leavingOrganizationId, 'Leaving workspace', 'leave-959', Date.now())
    sqlite
      .prepare(
        'insert into member (id, organization_id, user_id, role, created_at) values (?, ?, ?, ?, ?)',
      )
      .run(
        'mem_959_leave',
        leavingOrganizationId,
        targetId,
        'member',
        Date.now(),
      )
    const cookie = await impersonate()
    await post(
      '/organization/set-active',
      { organizationId: leavingOrganizationId },
      cookie,
    )
    shared.appendPlatformAudit.mockClear()

    const response = await post(
      '/organization/leave',
      { organizationId: leavingOrganizationId },
      cookie,
    )

    expect(response.status).toBe(200)
    expect(activeOrganizationOf(cookie)).toBeNull()
    expect(onlyEntry().entry).toEqual({
      action: ACTION,
      entityId: targetId,
      changes: {
        before: { organizationId: leavingOrganizationId },
        after: { organizationId: null },
      },
    })
  })

  it('logs at error, and writes no row, when an impersonated update reaches the hook with no request context', async () => {
    // Better Auth passes `context = null` when its async-local request context is missing. Nothing
    // pairs such an update with a previous workspace, so the gap must be named, never silent.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const after = getAuth().options.databaseHooks?.session?.update?.after

    await after?.(
      {
        userId: targetId,
        impersonatedBy: operatorId,
        activeOrganizationId: secondOrganizationId,
      } as never,
      null,
    )
    const lines = error.mock.calls.map(([line]) => String(line))
    error.mockRestore()

    expect(after).toBeTypeOf('function')
    expect(shared.appendPlatformAudit).not.toHaveBeenCalled()
    expect(
      lines.some((line) =>
        line.includes('audit.impersonation-workspace.no-context'),
      ),
    ).toBe(true)
  })

  it('has no create-organization path to audit: the plugin refuses it, and so does createWorkspace', async () => {
    const cookie = await impersonate()

    const response = await post(
      '/organization/create',
      { name: 'Operator made', slug: 'operator-made-959' },
      cookie,
    )

    expect(response.status).toBe(403)
    expect(shared.appendPlatformAudit).not.toHaveBeenCalled()
  })

  it('writes the row, with a null after, when set-active refuses a workspace the target is not in', async () => {
    // The plugin clears the active workspace *before* it refuses (`crud-org.mjs`), so the session
    // did move: a refused request still changed `activeOrganizationId`, and the ledger says so.
    const cookie = await impersonate()

    const response = await post(
      '/organization/set-active',
      { organizationId: foreignOrganizationId },
      cookie,
    )

    expect(response.status).toBe(403)
    expect(activeOrganizationOf(cookie)).toBeNull()
    expect(onlyEntry().entry).toEqual({
      action: ACTION,
      entityId: targetId,
      changes: {
        before: { organizationId: ownOrganizationId },
        after: { organizationId: null },
      },
    })
  })

  it('writes the row, with a null after, when get-organization clears the workspace of a non-member', async () => {
    const cookie = await impersonate()

    const response = await get(
      `${AUTH_BASE}/organization/get-organization?organizationId=${foreignOrganizationId}`,
      cookie,
    )

    expect(response.status).toBe(403)
    expect(onlyEntry().entry).toMatchObject({
      action: ACTION,
      changes: {
        before: { organizationId: ownOrganizationId },
        after: { organizationId: null },
      },
    })
  })

  it('writes nothing for a switch made by a session nobody is wearing', async () => {
    shared.kv.clear()
    const cookie = sessionCookie(await signIn(targetEmail))

    const response = await post(
      '/organization/set-active',
      { organizationId: secondOrganizationId },
      cookie,
    )

    expect(response.status).toBe(200)
    expect(shared.appendPlatformAudit).not.toHaveBeenCalled()
  })

  it('writes nothing, and reads nothing, when an impersonated session is merely refreshed', async () => {
    // An impersonated session lives 900 seconds against a 30-day `expiresIn`, so every read of it is
    // past `updateAge` and rewrites `expiresAt`: the update that must stay free.
    const cookie = await impersonate()
    const { adapter } = await getAuth().$context
    const findOne = vi.spyOn(adapter, 'findOne')

    const response = await get(`${AUTH_BASE}/get-session`, cookie)

    expect(response.status).toBe(200)
    expect(shared.appendPlatformAudit).not.toHaveBeenCalled()
    expect(
      findOne.mock.calls.filter(([query]) => query.model === 'user'),
    ).toEqual([])
    findOne.mockRestore()
  })

  it('lets the switch succeed when the audit insert is rejected', async () => {
    shared.appendPlatformAudit.mockRejectedValueOnce(
      new Error('the audit sink is unreachable'),
    )
    const cookie = await impersonate()

    const response = await post(
      '/organization/set-active',
      { organizationId: secondOrganizationId },
      cookie,
    )

    expect(response.status).toBe(200)
    expect(activeOrganizationOf(cookie)).toBe(secondOrganizationId)
    expect(shared.appendPlatformAudit).toHaveBeenCalledTimes(1)
  })

  it("writes no row, and still switches, when the operator's role cannot be read", async () => {
    // Never `role: null`: that resolves to `user`, and a row with the wrong role is worse than none.
    const cookie = await impersonate()
    const { adapter } = await getAuth().$context
    const original = adapter.findOne.bind(adapter)
    const findOne = vi
      .spyOn(adapter, 'findOne')
      .mockImplementation((query) =>
        query.model === 'user' && query.select?.[0] === 'role'
          ? Promise.reject(new Error('the user table is unreachable'))
          : original(query),
      )

    const response = await post(
      '/organization/set-active',
      { organizationId: secondOrganizationId },
      cookie,
    )
    findOne.mockRestore()

    expect(response.status).toBe(200)
    expect(activeOrganizationOf(cookie)).toBe(secondOrganizationId)
    expect(shared.appendPlatformAudit).not.toHaveBeenCalled()
  })
})
