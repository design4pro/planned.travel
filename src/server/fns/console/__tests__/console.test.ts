/**
 * The console server functions, driven against the dependency they are claims about.
 *
 * Every property this directory exists to hold is a property of `better-auth@1.7.1`: that
 * `banUser` empties the `session` table before anything else can enumerate it, that
 * `deleteUserSessions` resolves its token list from the eventually-consistent
 * `active-sessions-<userId>` index and therefore deletes nothing when that key is gone, that
 * `banUser` cannot write `banExpires: null`, that `impersonateUser`'s entire effect is `Set-Cookie`
 * and it returns none of it without `returnHeaders: true`, that `createUser` hashes whatever
 * password it is handed without consulting `minPasswordLength`. An earlier version of this file
 * asserted all of that against a hand-written double, which is to say against a *model* of the
 * library — and a model is exactly the thing that stays green while it is wrong. So the library is
 * here instead: the shipped `getAuth()`, the shipped `adminOptions`, the shipped `databaseHooks`,
 * the shipped cookie prefix, real password hashing, real sessions, real cookies.
 *
 * What is replaced is only what a Worker binding is. `src/server/auth/env.ts` imports
 * `cloudflare:workers`, which the `server` Vitest project cannot load, so `./env`, `./db` and the
 * outbound mail queue are mocked with plain values —
 * `src/server/auth/__tests__/auth-handler-closure.test.ts` establishes exactly that arrangement.
 * `../bindings` is mocked for the same one reason and hands back the real things behind it: the real
 * `auth.api`, the real Better Auth database adapter, a `Map`-backed `SESSIONS` namespace and a real
 * SQLite `platform_audit_log` generated from the Drizzle schema, five `CHECK` constraints and all.
 * The guard is the real `requirePermission`, the audit writer is the real `appendPlatformAudit`, and
 * the caller is a real signed-in operator whose real session cookie rides on every request — which
 * is what makes `adminMiddleware` resolve, and what makes an assertion about a refusal mean
 * something.
 *
 * Two mechanics come from the framework rather than from this code. A server function's handler only
 * runs inside TanStack Start's `AsyncLocalStorage`, and outside a Start build its *return value* is
 * discarded — so every assertion below is about what a handler did, never about what it answered,
 * and the boundary validator is applied by hand because the framework only runs it on the server
 * leg. `getRequest`, `getRequestHeader` and `setResponseHeader` need h3's event store, which
 * `requestHandler()` installs; the response every case inspects is the one the runtime produced.
 */

import { requestHandler } from '@tanstack/react-start/server'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { AsyncLocalStorage } from 'node:async_hooks'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { z } from 'zod'

import { BANNED_USER_MESSAGE } from '#/routes/(auth)/-lib/errors'
import { createPlatformTables } from '#/server/catalog/__tests__/platform-tables'
import { platformAuditLog } from '#/server/db/schema'
import { createLogger, createMemorySink } from '#/server/observability'
import { SESSION_TOKEN_LIMIT } from '../session-keys'
import { createAuthDatabase, createSessionKv } from './real-auth'

import type { PlatformTables } from '#/server/catalog/__tests__/platform-tables'
import type { Database } from '#/server/db/types'
import type { LogRecord, LogSink } from '#/server/observability'
import type { AuthDatabase, SessionKv } from './real-auth'

/* ------------------------------------------------------------------- constants */

const BASE_URL = 'http://localhost:3000'
const AUTH_BASE = `${BASE_URL}/api/auth`
const PASSWORD = 'correct-horse-battery-staple'
const OPERATOR_IP = '203.0.113.42'
const OPERATOR_UA = 'Mozilla/5.0 (console operator)'

/* --------------------------------------------------------------------- mocking */

/**
 * Mutable holders, filled in `beforeAll`. `vi.hoisted` runs above every import, so nothing here may
 * reference an imported value — only the boxes the mock factories read at call time.
 */
interface Holder<TValue> {
  current: TValue
}

interface SharedState {
  readonly authDb: Holder<unknown>
  readonly kv: Holder<unknown>
  readonly platformTables: Holder<unknown>
  readonly sink: Holder<unknown>
  /** When true, `platformDb()` hands back a handle whose every statement rejects. */
  readonly brokenDb: Holder<boolean>
}

const shared = vi.hoisted((): SharedState => ({
  authDb: { current: null },
  kv: { current: null },
  platformTables: { current: null },
  sink: { current: null },
  brokenDb: { current: false },
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
  sessionStore: () => kv(),
  taskQueue: () => {
    throw new Error('The queue is not exercised by a console-function test.')
  },
  trustedOrigins: () => [BASE_URL],
}))

vi.mock('#/server/auth/db', () => ({
  authDb: () => shared.authDb.current,
}))

vi.mock('#/server/auth/email', () => ({
  queueAuthEmail: async () => undefined,
}))

vi.mock('../bindings', () => ({
  consoleLogger: () =>
    createLogger({
      level: 'debug',
      sink: sink(),
      context: { component: 'console-fn' },
    }),
  currentSession: () => getSession(),
  platformDb: () => (shared.brokenDb.current ? brokenDatabase() : tables().db),
  platformApi: () => getAuth().api,
  sessionKeyStore: () => kv(),
  readSessionRows: async (userId: string) => {
    const context = await getAuth().$context
    return context.adapter.findMany<unknown>({
      model: 'session',
      where: [{ field: 'userId', value: userId }],
      limit: SESSION_TOKEN_LIMIT,
    })
  },
  readUserRole: async (userId: string) => {
    const context = await getAuth().$context
    const row = await context.adapter.findOne<{ role?: string | null }>({
      model: 'user',
      where: [{ field: 'id', value: userId }],
      select: ['role'],
    })
    return row?.role ?? null
  },
}))

/* ------------------------------------------------------------- the real modules */

// Imported dynamically, after the constants above exist: `vi.mock` factories are hoisted but their
// bodies run on first request, and the first request for `#/server/auth/env` happens here.
const { getAuth } = await import('#/server/auth')
const { getSession } = await import('#/server/auth/session')
const { AuthRequirementError } = await import('#/server/auth/tenant')
const { ConsoleActionError } = await import('../errors')
const {
  startImpersonationFn,
  startImpersonationInputSchema,
  stopImpersonationFn,
  stopImpersonationInputSchema,
} = await import('../impersonation')
const {
  listPlatformSessionsFn,
  listPlatformSessionsInputSchema,
  revokePlatformSessionFn,
  revokePlatformSessionInputSchema,
  revokePlatformUserSessionsFn,
  revokePlatformUserSessionsInputSchema,
} = await import('../sessions')
const {
  banPlatformUserFn,
  banPlatformUserInputSchema,
  createPlatformUserFn,
  createPlatformUserInputSchema,
  deletePlatformUserFn,
  deletePlatformUserInputSchema,
  getPlatformUserFn,
  getPlatformUserInputSchema,
  listPlatformUsersFn,
  listPlatformUsersInputSchema,
  setPlatformUserEmailFn,
  setPlatformUserEmailInputSchema,
  setPlatformUserPasswordFn,
  setPlatformUserPasswordInputSchema,
  setPlatformUserRoleFn,
  setPlatformUserRoleInputSchema,
  unbanPlatformUserFn,
  unbanPlatformUserInputSchema,
  updatePlatformUserFn,
  updatePlatformUserInputSchema,
} = await import('../users')

/* ------------------------------------------------------------------- accessors */

function kv(): SessionKv {
  const store = shared.kv.current
  if (!store) throw new Error('the session KV has not been created')
  return store as SessionKv
}

function tables(): PlatformTables {
  const value = shared.platformTables.current
  if (!value) throw new Error('the platform tables have not been created')
  return value as PlatformTables
}

function sink(): LogSink & { records: Array<LogRecord> } {
  const value = shared.sink.current
  if (!value) throw new Error('the log sink has not been created')
  return value as LogSink & { records: Array<LogRecord> }
}

function records(): Array<LogRecord> {
  return sink().records
}

/** A D1 handle that rejects every statement, for the audit-append failure path. */
function brokenDatabase(): Database {
  const reject = (): never => {
    throw new Error('D1_ERROR: no such table')
  }
  return drizzle(
    async () => reject(),
    async () => reject(),
  )
}

/* --------------------------------------------------------------- the databases */

let authDatabase: AuthDatabase

beforeAll(async () => {
  authDatabase = await createAuthDatabase()
  shared.authDb.current = authDatabase.db
  shared.kv.current = createSessionKv()
})

afterAll(() => {
  authDatabase.close()
  tables().close()
})

/* ------------------------------------------------------------ driving the auth */

/** The real HTTP surface, used only to sign accounts in and to read a session back out. */
function authPost(
  path: string,
  body: unknown,
  cookie?: string,
): Promise<Response> {
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

function authGet(path: string, cookie: string): Promise<Response> {
  return getAuth().handler(
    new Request(`${AUTH_BASE}${path}`, {
      method: 'GET',
      headers: new Headers({ origin: BASE_URL, cookie }),
    }),
  )
}

/**
 * A browser's cookie jar, applied the way a browser applies one.
 *
 * Impersonation sets `planned.session_token` twice in a single response — once empty to delete the
 * operator's session cookie, once with the impersonated token — so folding the values naively would
 * send two cookies of the same name and prove nothing about which one won. Last write wins, and an
 * empty value is a deletion.
 */
type CookieJar = Map<string, string>

function applyCookies(jar: CookieJar, response: Response): CookieJar {
  for (const entry of response.headers.getSetCookie()) {
    const pair = entry.split(';')[0]
    const separator = pair.indexOf('=')
    if (separator < 0) continue
    const name = pair.slice(0, separator).trim()
    const value = pair.slice(separator + 1)
    if (value === '') jar.delete(name)
    else jar.set(name, value)
  }
  return jar
}

function jarHeader(jar: CookieJar): string {
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
}

async function jarFromSignIn(email: string): Promise<CookieJar> {
  const response = await authPost('/sign-in/email', {
    email,
    password: PASSWORD,
  })
  if (response.status !== 200) {
    throw new Error(`sign-in for ${email} answered ${response.status}`)
  }
  return applyCookies(new Map(), response)
}

/* ------------------------------------------------------------------- fixtures */

let seedCounter = 0

interface SeededUser {
  readonly id: string
  readonly email: string
  readonly name: string
}

/**
 * An account row, written straight into SQLite.
 *
 * Direct rather than through `/sign-up/email` because a sign-up costs a real password hash and most
 * targets here are never signed in. The accounts that *are* signed in go through the real endpoint,
 * so every session in this file is one Better Auth minted.
 */
function seedUser(
  overrides: {
    role?: string | null
    banned?: boolean
    banReason?: string | null
    banExpires?: Date | null
    name?: string
    email?: string
    emailVerified?: boolean
  } = {},
): SeededUser {
  seedCounter += 1
  const id = `seeded_user_${seedCounter}`
  const email = overrides.email ?? `account${seedCounter}@planned.travel`
  const name = overrides.name ?? `Account ${seedCounter}`
  const now = Date.now()

  authDatabase.sqlite
    .prepare(
      `insert into user
         (id, name, email, email_verified, image, two_factor_enabled,
          role, banned, ban_reason, ban_expires, created_at, updated_at)
       values (?, ?, ?, ?, null, 0, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      name,
      email,
      overrides.emailVerified === false ? 0 : 1,
      overrides.role ?? null,
      overrides.banned === true ? 1 : 0,
      overrides.banReason ?? null,
      overrides.banExpires === undefined || overrides.banExpires === null
        ? null
        : overrides.banExpires.getTime(),
      now,
      now,
    )

  return { id, email, name }
}

/** An account with a real credential, so it can hold a real session. */
async function seedAccountWithPassword(
  email: string,
  role: string | null = null,
): Promise<string> {
  const response = await authPost('/sign-up/email', {
    email,
    password: PASSWORD,
    name: email.split('@')[0],
  })
  if (response.status !== 200) {
    throw new Error(`sign-up for ${email} answered ${response.status}`)
  }
  const row = authDatabase.sqlite
    .prepare('select id from user where email = ?')
    .get(email) as { id?: unknown } | undefined
  const id = row?.id
  if (typeof id !== 'string') throw new Error(`no user row for ${email}`)
  if (role !== null) {
    authDatabase.sqlite
      .prepare('update user set role = ? where id = ?')
      .run(role, id)
  }
  // `autoSignIn` means the sign-up already minted a session, from the pre-promotion row and before
  // any test had a chance to arrange one. Take it away entirely so every session in this file is one
  // a test asked for by name, and so the KV holds nothing a later assertion could mistake for it.
  authDatabase.sqlite.prepare('delete from session where user_id = ?').run(id)
  kv().clear()
  return id
}

function userRow(id: string): {
  role: string | null
  banned: number
  ban_reason: string | null
  ban_expires: number | null
  name: string
  email: string
} {
  return authDatabase.sqlite
    .prepare(
      'select role, banned, ban_reason, ban_expires, name, email from user where id = ?',
    )
    .get(id) as {
    role: string | null
    banned: number
    ban_reason: string | null
    ban_expires: number | null
    name: string
    email: string
  }
}

function sessionCount(userId: string): number {
  const row = authDatabase.sqlite
    .prepare('select count(*) as n from session where user_id = ?')
    .get(userId) as { n: number }
  return row.n
}

function sessionRows(
  userId: string,
): Array<{ id: string; token: string; expires_at: number }> {
  return authDatabase.sqlite
    .prepare(
      'select id, token, expires_at from session where user_id = ? order by created_at',
    )
    .all(userId) as unknown as Array<{
    id: string
    token: string
    expires_at: number
  }>
}

/** The per-user session index, removed without the removal being recorded as the console's. */
function dropSessionIndex(userId: string): void {
  kv().store.delete(`active-sessions-${userId}`)
}

/* -------------------------------------------------------------- staff credentials */

let tokenCounter = 0

interface SeededStaffToken {
  readonly id: string
  readonly name: string
  readonly tokenPrefix: string
  readonly tokenHash: string
}

/**
 * An issued MCP credential, written straight into `staff_api_tokens`.
 *
 * Direct because nothing in the product issues one yet — the issuance surface is Faza E — and the
 * revocation docs/ACCESS.md §5 requires of a role change has to be measurable before that surface
 * exists rather than after it. The row goes into the table `createPlatformTables()` generated from
 * the real Drizzle schema, so the columns, the types and the `(user_id, revoked_at)` index the
 * revocation predicate rides are the shipped ones.
 */
function seedStaffToken(
  userId: string,
  overrides: { revokedAt?: Date; expiresAt?: Date } = {},
): SeededStaffToken {
  tokenCounter += 1
  const id = `seeded_token_${tokenCounter}`
  const name = `Workstation ${tokenCounter}`
  const tokenPrefix = `pt_live_${tokenCounter}`
  const tokenHash = `deadbeef${tokenCounter}`
  const now = Date.now()

  tables()
    .sqlite.prepare(
      `insert into staff_api_tokens
         (id, user_id, name, token_hash, token_prefix, last_used_at, last_used_ip,
          expires_at, revoked_at, created_by, created_at, updated_at)
       values (?, ?, ?, ?, ?, null, null, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      userId,
      name,
      tokenHash,
      tokenPrefix,
      (overrides.expiresAt ?? new Date(now + 30 * 86_400_000)).getTime(),
      overrides.revokedAt?.getTime() ?? null,
      operatorId,
      now,
      now,
    )

  return { id, name, tokenPrefix, tokenHash }
}

function staffTokenRows(
  userId: string,
): Array<{ id: string; revoked_at: number | null }> {
  return tables()
    .sqlite.prepare(
      'select id, revoked_at from staff_api_tokens where user_id = ? order by created_at, id',
    )
    .all(userId) as unknown as Array<{ id: string; revoked_at: number | null }>
}

/* ---------------------------------------------------------- the request scope */

interface StartContext {
  readonly startOptions: Record<string, never>
  readonly request: Request
}

/**
 * The framework's own `AsyncLocalStorage`, created here if the framework has not created it yet.
 * Both sides key off the same global symbol, so whichever runs first wins.
 */
const startStorage = ((): AsyncLocalStorage<StartContext> => {
  const key = Symbol.for('tanstack-start:start-storage-context')
  const globals = globalThis as Record<symbol, unknown>
  globals[key] ??= new AsyncLocalStorage<StartContext>()
  return globals[key] as AsyncLocalStorage<StartContext>
})()

/** Whose cookies ride on the next console call. Empty means an anonymous caller. */
let callerJar: CookieJar = new Map()

/**
 * Runs `call` inside a real request scope and hands back the `Response` the runtime produced, so a
 * `Set-Cookie` assertion is made on the thing the browser would receive.
 */
async function duringRequest(call: () => Promise<void>): Promise<Response> {
  // h3 turns a thrown error into a `Response` — a refusal carrying `status: 403` really does leave
  // the Worker as a 403, which is worth knowing and is not what these tests are asserting. The
  // failure is caught here and re-raised after the response exists, so a case can inspect the error
  // *and* the response the runtime built around it.
  const failures: Array<unknown> = []
  const handle = requestHandler(async (request) => {
    try {
      await startStorage.run({ startOptions: {}, request }, call)
    } catch (cause) {
      failures.push(cause)
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  })

  const headers = new Headers({
    'cf-connecting-ip': OPERATOR_IP,
    'user-agent': OPERATOR_UA,
  })
  const cookie = jarHeader(callerJar)
  if (cookie.length > 0) headers.set('cookie', cookie)

  const response = await handle(
    new Request(`${BASE_URL}/_serverFn/console`, { method: 'POST', headers }),
    {},
  )
  if (failures.length > 0) {
    throw failures[0]
  }
  return response
}

/**
 * Applies the boundary validator and then the handler, which is how the runtime sequences the two.
 * Each wrapper takes `unknown`, because that is what a wire carries.
 */
function boundary<TSchema extends z.ZodType>(
  schema: TSchema,
  fn: (input: { data: z.output<TSchema> }) => Promise<unknown>,
): (data: unknown) => Promise<Response> {
  return async (data: unknown) => {
    const validated = schema.parse(data)
    return duringRequest(async () => {
      await fn({ data: validated })
    })
  }
}

const setRole = boundary(setPlatformUserRoleInputSchema, setPlatformUserRoleFn)
const ban = boundary(banPlatformUserInputSchema, banPlatformUserFn)
const unban = boundary(unbanPlatformUserInputSchema, unbanPlatformUserFn)
const setPassword = boundary(
  setPlatformUserPasswordInputSchema,
  setPlatformUserPasswordFn,
)
const setEmail = boundary(
  setPlatformUserEmailInputSchema,
  setPlatformUserEmailFn,
)
const updateUser = boundary(updatePlatformUserInputSchema, updatePlatformUserFn)
const createUser = boundary(createPlatformUserInputSchema, createPlatformUserFn)
const deleteUser = boundary(deletePlatformUserInputSchema, deletePlatformUserFn)
const listUsers = boundary(listPlatformUsersInputSchema, listPlatformUsersFn)
const getUser = boundary(getPlatformUserInputSchema, getPlatformUserFn)
const listSessions = boundary(
  listPlatformSessionsInputSchema,
  listPlatformSessionsFn,
)
const revokeSession = boundary(
  revokePlatformSessionInputSchema,
  revokePlatformSessionFn,
)
const revokeAllSessions = boundary(
  revokePlatformUserSessionsInputSchema,
  revokePlatformUserSessionsFn,
)
const impersonate = boundary(
  startImpersonationInputSchema,
  startImpersonationFn,
)
const stopImpersonating = async (): Promise<Response> =>
  duringRequest(async () => {
    await stopImpersonationFn({ data: {} })
  })

/* ------------------------------------------------------------------- the ledger */

interface AuditRow {
  actorUserId: string | null
  actorKind: string
  actorRole: string | null
  tokenId: string | null
  action: string
  entityType: string
  entityId: string | null
  changes: {
    before: Record<string, unknown> | null
    after: Record<string, unknown> | null
  } | null
  ip: string | null
  userAgent: string | null
}

async function auditRows(): Promise<Array<AuditRow>> {
  return tables()
    .db.select({
      actorUserId: platformAuditLog.actorUserId,
      actorKind: platformAuditLog.actorKind,
      actorRole: platformAuditLog.actorRole,
      tokenId: platformAuditLog.tokenId,
      action: platformAuditLog.action,
      entityType: platformAuditLog.entityType,
      entityId: platformAuditLog.entityId,
      changes: platformAuditLog.changes,
      ip: platformAuditLog.ip,
      userAgent: platformAuditLog.userAgent,
    })
    .from(platformAuditLog)
}

async function rowsFor(action: string): Promise<Array<AuditRow>> {
  return (await auditRows()).filter((row) => row.action === action)
}

/** The whole ledger as one string, for "this value appears nowhere" assertions. */
async function ledgerText(): Promise<string> {
  return JSON.stringify(await auditRows())
}

/* -------------------------------------------------------------------- the setup */

let operatorId: string
const OPERATOR_EMAIL = 'ops@planned.travel'

beforeEach(async () => {
  authDatabase.reset()
  kv().clear()
  shared.brokenDb.current = false
  shared.sink.current = createMemorySink()

  const previous = shared.platformTables.current as PlatformTables | null
  previous?.close()
  shared.platformTables.current = await createPlatformTables()

  operatorId = await seedAccountWithPassword(OPERATOR_EMAIL, 'admin')
  callerJar = await jarFromSignIn(OPERATOR_EMAIL)
})

/* ------------------------------------------------------------- the entry point */

describe('the platform-actor entry point', () => {
  it('refuses an anonymous caller before the plugin is reached', async () => {
    callerJar = new Map()
    const target = seedUser()

    await expect(
      setRole({ userId: target.id, role: 'curator' }),
    ).rejects.toThrow(AuthRequirementError)
    expect(userRow(target.id).role).toBeNull()
    expect(await auditRows()).toEqual([])
  })

  it('refuses a curator reaching for a user statement, before any row is touched', async () => {
    await seedAccountWithPassword('curator@planned.travel', 'curator')
    callerJar = await jarFromSignIn('curator@planned.travel')
    const target = seedUser()

    await expect(
      ban({ userId: target.id, reason: 'spam' }),
    ).rejects.toMatchObject({ reason: 'insufficient-platform-permission' })
    // Not "the ban failed" — no row moved at all, which is what "before it touches a row" means.
    expect(userRow(target.id).banned).toBe(0)
    expect(await auditRows()).toEqual([])
  })

  it('refuses an impersonated session whatever role the worn account holds (§6.4)', async () => {
    const worn = seedUser({ role: 'curator' })
    // The impersonated session is the caller from here — a real one, minted by the plugin and
    // carried on the cookies it set, exactly as the browser would carry them.
    callerJar = applyCookies(
      new Map(callerJar),
      await impersonate({ userId: worn.id }),
    )
    const target = seedUser()

    await expect(
      setRole({ userId: target.id, role: 'curator' }),
    ).rejects.toMatchObject({ reason: 'impersonated' })
    expect(userRow(target.id).role).toBeNull()
  })

  it('refuses a banned operator', async () => {
    authDatabase.sqlite
      .prepare('update user set banned = 1 where id = ?')
      .run(operatorId)
    // Without this the session's cached KV snapshot still says `banned: false`, which is the whole
    // reason the ban path deletes those keys rather than trusting the column.
    kv().store.clear()

    await expect(listUsers({})).rejects.toMatchObject({ reason: 'banned' })
  })
})

/* ------------------------------------------------------------------ role change */

describe('setting a platform role', () => {
  it('writes exactly one row carrying the actor, the request and the change', async () => {
    const target = seedUser({ role: null })

    await setRole({ userId: target.id, role: 'curator' })

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.user.role_changed',
      entityType: 'user',
      entityId: target.id,
      actorKind: 'human',
      actorUserId: operatorId,
      // Taken as a VALUE from the session at the moment of the action. A join on `user` would
      // rewrite this row the day the operator's own role changes.
      actorRole: 'admin',
      tokenId: null,
      ip: OPERATOR_IP,
      userAgent: OPERATOR_UA,
    })
    expect(rows[0]?.changes?.before).toMatchObject({ role: null })
    expect(rows[0]?.changes?.after).toMatchObject({ role: 'curator' })
    expect(userRow(target.id).role).toBe('curator')
  })

  it('records the role the operator held then, not the one the column holds now', async () => {
    const target = seedUser()
    await setRole({ userId: target.id, role: 'curator' })

    authDatabase.sqlite
      .prepare('update user set role = ? where id = ?')
      .run('user', operatorId)

    const rows = await rowsFor('platform.user.role_changed')
    expect(rows[0]?.actorRole).toBe('admin')
  })

  it('drops the cached session snapshots so the new role applies on the next request', async () => {
    const targetId = await seedAccountWithPassword('mover@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    await jarFromSignIn('mover@planned.travel')
    const [session] = sessionRows(targetId)

    await setRole({ userId: targetId, role: 'curator' })

    expect(kv().deleted).toContain(session.token)
    expect(kv().store.has(session.token)).toBe(false)
    // The sessions themselves survive a role change, so the per-user index must too.
    expect(kv().store.has(`active-sessions-${targetId}`)).toBe(true)
    expect(sessionCount(targetId)).toBe(1)
  })
})

/* ------------------------------------------------- the credentials a role change orphans */

/**
 * docs/ACCESS.md §5, which is one sentence with two halves: a static bearer "carries its owner's
 * whole platform role with no scopes of any kind", therefore a token whose owner's role moves "is
 * revoked by that role change, in the same call, audited as `platform.token.revoked`".
 *
 * The condition asserted here is the new role rather than the direction, because §5's own two
 * examples run in opposite directions — a demotion strands authority the account no longer holds,
 * a promotion to `admin` silently upgrades a credential sitting in a config file — and the state
 * neither may leave behind is the same one: a non-`curator` holding a live token.
 */
describe('a role change and the MCP credentials it orphans', () => {
  it('revokes a demoted curator’s live tokens and writes one row for each', async () => {
    const target = seedUser({ role: 'curator' })
    const laptop = seedStaffToken(target.id)
    const desktop = seedStaffToken(target.id)

    await setRole({ userId: target.id, role: 'user' })

    for (const row of staffTokenRows(target.id)) {
      expect(row.revoked_at).toBeTypeOf('number')
    }

    const revocations = await rowsFor('platform.token.revoked')
    expect(revocations.map((row) => row.entityId).sort()).toEqual(
      [laptop.id, desktop.id].sort(),
    )

    const row = revocations.find((entry) => entry.entityId === laptop.id)
    expect(row).toMatchObject({
      // The prefix fixes the entity type (docs/ACCESS.md §4.2); the credential is the entity, so a
      // user id in `entity_id` would make §4.4's timeline query answer about the wrong table.
      entityType: 'staff_api_token',
      actorKind: 'human',
      actorUserId: operatorId,
      actorRole: 'admin',
      // `token_id` names the credential an *agent* acted on; this row is a human acting on a
      // credential, and `platform_audit_log_token_agent_only_chk` refuses it on any other kind.
      tokenId: null,
      ip: OPERATOR_IP,
      userAgent: OPERATOR_UA,
    })
    expect(row?.changes?.before).toMatchObject({
      name: laptop.name,
      tokenPrefix: laptop.tokenPrefix,
      ownerRole: 'curator',
      revokedAt: null,
    })
    expect(row?.changes?.after).toMatchObject({
      ownerRole: 'user',
    })
    expect(row?.changes?.after?.revokedAt).toBeTypeOf('string')
  })

  it('revokes on a promotion to admin too — §5’s own example of the rule', async () => {
    const target = seedUser({ role: 'curator' })
    const token = seedStaffToken(target.id)

    await setRole({ userId: target.id, role: 'admin' })

    expect(staffTokenRows(target.id)[0]?.revoked_at).toBeTypeOf('number')
    const revocations = await rowsFor('platform.token.revoked')
    expect(revocations).toHaveLength(1)
    expect(revocations[0]?.entityId).toBe(token.id)
    expect(revocations[0]?.changes?.after).toMatchObject({ ownerRole: 'admin' })
  })

  it('leaves a curator’s tokens alone when the account is still a curator', async () => {
    const target = seedUser({ role: 'curator' })
    seedStaffToken(target.id)

    await setRole({ userId: target.id, role: 'curator' })

    expect(staffTokenRows(target.id)[0]?.revoked_at).toBeNull()
    expect(await rowsFor('platform.token.revoked')).toEqual([])
  })

  it('does not revoke or re-audit a credential that was already revoked', async () => {
    const target = seedUser({ role: 'curator' })
    const revokedAt = new Date(Date.now() - 86_400_000)
    const spent = seedStaffToken(target.id, { revokedAt })
    const live = seedStaffToken(target.id)

    await setRole({ userId: target.id, role: 'user' })

    const rows = staffTokenRows(target.id)
    // The earlier revocation keeps its own instant: a second stamp would rewrite when the
    // credential actually stopped working.
    expect(rows.find((row) => row.id === spent.id)?.revoked_at).toBe(
      revokedAt.getTime(),
    )
    expect(rows.find((row) => row.id === live.id)?.revoked_at).toBeTypeOf(
      'number',
    )

    const revocations = await rowsFor('platform.token.revoked')
    expect(revocations.map((row) => row.entityId)).toEqual([live.id])
  })

  it('writes the role change itself exactly once, whatever the credentials do', async () => {
    const target = seedUser({ role: 'curator' })
    seedStaffToken(target.id)
    seedStaffToken(target.id)

    await setRole({ userId: target.id, role: 'user' })

    expect(await rowsFor('platform.user.role_changed')).toHaveLength(1)
    // Three events, three rows, and no fourth: one role change and two revocations.
    expect(await auditRows()).toHaveLength(3)
  })

  it('holds a role change with no credentials to exactly one row', async () => {
    const target = seedUser({ role: 'curator' })

    await setRole({ userId: target.id, role: 'user' })

    expect(await auditRows()).toHaveLength(1)
  })

  it('puts no token hash in the ledger', async () => {
    const target = seedUser({ role: 'curator' })
    const token = seedStaffToken(target.id)

    await setRole({ userId: target.id, role: 'user' })

    // The hash is the verifier. The prefix is the non-secret fragment a console renders, and it is
    // the only part of a credential this log is allowed to carry.
    const ledger = await ledgerText()
    expect(ledger).not.toContain(token.tokenHash)
    expect(ledger).toContain(token.tokenPrefix)
  })

  it('emits a structured line naming the action, the actor and the credential', async () => {
    const target = seedUser({ role: 'curator' })
    const token = seedStaffToken(target.id)

    await setRole({ userId: target.id, role: 'user' })

    const line = records().find(
      (record) => record.action === 'platform.token.revoked',
    )
    expect(line).toMatchObject({
      level: 'info',
      msg: 'console platform action',
      action: 'platform.token.revoked',
      entityId: token.id,
      actorUserId: operatorId,
      actorRole: 'admin',
      actorKind: 'human',
      ownerUserId: target.id,
      reason: 'platform.user.role_changed',
    })
  })
})

/* -------------------------------------------------------------------------- ban */

describe('banning an account', () => {
  it('deletes every KV session key it enumerated from D1, index key absent', async () => {
    const targetId = await seedAccountWithPassword('two-devices@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    await jarFromSignIn('two-devices@planned.travel')
    await jarFromSignIn('two-devices@planned.travel')
    const tokens = sessionRows(targetId).map((row) => row.token)
    expect(tokens).toHaveLength(2)

    // The measured failure: no `active-sessions-<userId>` key, so better-auth's own
    // `deleteUserSessions` deletes no blob and `findSession` keeps answering with a stale
    // `banned: false` snapshot for the life of the session.
    dropSessionIndex(targetId)

    await ban({ userId: targetId, reason: 'abuse' })

    // The leading entry is `better-auth@1.7.1`'s own, and it is the defect rather than noise:
    // `deleteUserSessions` reads `[]` out of the missing index, deletes not one blob, and then
    // deletes the index key it just failed to find. Everything after it is this directory's work.
    expect(kv().deleted).toEqual([
      `active-sessions-${targetId}`,
      ...tokens,
      `active-sessions-${targetId}`,
    ])
    for (const token of tokens) {
      expect(kv().store.has(token)).toBe(false)
    }
  })

  it('is what makes the ban immediate: the plugin alone leaves the session live', async () => {
    // The control that gives the test above its meaning, measured against `better-auth@1.7.1`
    // rather than argued, and the round-6 measurement reproduced in process: with the index key
    // gone, `banUser` deletes no blob, `findSession` keeps resolving the session from it, and the
    // snapshot inside still says `banned: false`. Two accounts in identical states, one banned each
    // way — the same account cannot serve for both, because the first ban empties the `session`
    // table and leaves the second path nothing to enumerate.
    const throughPlugin = await seedAccountWithPassword(
      'warm-cookie@planned.travel',
    )
    const throughConsole = await seedAccountWithPassword(
      'cold-cookie@planned.travel',
    )
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    const pluginJar = await jarFromSignIn('warm-cookie@planned.travel')
    const consoleJar = await jarFromSignIn('cold-cookie@planned.travel')
    const [pluginSession] = sessionRows(throughPlugin)
    const [consoleSession] = sessionRows(throughConsole)
    dropSessionIndex(throughPlugin)
    dropSessionIndex(throughConsole)

    await getAuth().api.banUser({
      body: { userId: throughPlugin, banReason: 'abuse' },
      headers: new Headers({ cookie: jarHeader(callerJar) }),
    })

    expect(userRow(throughPlugin).banned).toBe(1)
    expect(kv().store.has(pluginSession.token)).toBe(true)
    const stillLive = await authGet('/get-session', jarHeader(pluginJar))
    expect(stillLive.status).toBe(200)
    const body: { user: { id: string; banned?: boolean } } | null =
      await stillLive.json()
    expect(body?.user.id).toBe(throughPlugin)
    expect(body?.user.banned).not.toBe(true)

    await ban({ userId: throughConsole, reason: 'abuse' })

    expect(kv().store.has(consoleSession.token)).toBe(false)
    const afterwards = await authGet('/get-session', jarHeader(consoleJar))
    expect(await afterwards.json()).toBeNull()
  })

  it('enumerates the tokens before the plugin deletes the rows they live in', async () => {
    const targetId = await seedAccountWithPassword('enumerated@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    await jarFromSignIn('enumerated@planned.travel')
    const [session] = sessionRows(targetId)
    dropSessionIndex(targetId)

    await ban({ userId: targetId, reason: 'abuse' })

    // `banUser` empties the D1 session table for that account, so an enumeration taken afterwards
    // would find nothing and the blob would survive. Order is the mechanism, not a style.
    expect(sessionCount(targetId)).toBe(0)
    expect(kv().deleted).toContain(session.token)
  })

  it('writes exactly one row carrying the reason and the expiry', async () => {
    const target = seedUser()

    await ban({ userId: target.id, reason: 'repeated spam', expiresInDays: 7 })

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.user.banned',
      entityType: 'user',
      entityId: target.id,
      actorKind: 'human',
      actorUserId: operatorId,
      actorRole: 'admin',
      ip: OPERATOR_IP,
      userAgent: OPERATOR_UA,
    })
    expect(rows[0]?.changes?.before).toMatchObject({
      banned: false,
      banReason: null,
    })
    expect(rows[0]?.changes?.after).toMatchObject({
      banned: true,
      banReason: 'repeated spam',
    })
    expect(rows[0]?.changes?.after?.banExpiresAt).toEqual(expect.any(String))
  })

  it('turns days into the seconds the plugin expects', async () => {
    const target = seedUser()
    const issuedAt = Date.now()

    await ban({ userId: target.id, reason: 'cooling off', expiresInDays: 3 })

    const expires = userRow(target.id).ban_expires
    expect(expires).not.toBeNull()
    const days = ((expires ?? 0) - issuedAt) / 86_400_000
    expect(days).toBeGreaterThan(2.99)
    expect(days).toBeLessThan(3.01)
  })

  it('never reaches /admin/update-user, so no ban is attributed to nobody', async () => {
    // A ban written through `adminUpdateUser` lands on the auto-unban tripwire and is recorded as
    // `actor_kind: 'system'` with a null actor — a deliberate human action with no operator on it.
    const updateSpy = vi.spyOn(getAuth().api, 'adminUpdateUser')
    const banSpy = vi.spyOn(getAuth().api, 'banUser')
    const target = seedUser()

    await ban({ userId: target.id, reason: 'abuse' })

    expect(updateSpy).not.toHaveBeenCalled()
    expect(banSpy).toHaveBeenCalledTimes(1)

    const rows = await rowsFor('platform.user.banned')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.actorKind).toBe('human')
    expect(rows[0]?.actorUserId).toBe(operatorId)
  })

  it('is the only thing that audits a ban at all', async () => {
    // docs/ACCESS.md §4.3 calls the ban verbs "always audited", and `src/server/auth/index.ts`
    // stands its tripwire down for them on the stated grounds that this directory appends the human
    // row. Measured here rather than asserted in a comment: the plugin endpoint on its own writes
    // nothing, and the console call writes exactly one row naming the operator.
    const target = seedUser()

    await getAuth().api.banUser({
      body: { userId: target.id, banReason: 'straight through the plugin' },
      headers: new Headers({ cookie: jarHeader(callerJar) }),
    })
    expect(await auditRows()).toEqual([])

    await unban({ userId: target.id })
    await ban({ userId: target.id, reason: 'through the console' })

    expect(await rowsFor('platform.user.unbanned')).toHaveLength(1)
    expect(await rowsFor('platform.user.banned')).toHaveLength(1)
  })

  it('clears a stale expiry before applying a permanent ban', async () => {
    const target = seedUser({
      banned: false,
      banExpires: new Date('2020-01-01T00:00:00.000Z'),
    })
    const unbanSpy = vi.spyOn(getAuth().api, 'unbanUser')

    await ban({ userId: target.id, reason: 'permanent' })

    // `banUser` cannot write `banExpires: null` — the adapter factory skips `undefined` on an
    // update — so a leftover expiry would auto-unban the account at its next sign-in.
    expect(unbanSpy).toHaveBeenCalledTimes(1)
    const row = userRow(target.id)
    expect(row.banned).toBe(1)
    expect(row.ban_expires).toBeNull()
    // Still one event: the clearing write is machinery, not something that happened.
    expect(await rowsFor('platform.user.unbanned')).toEqual([])
    expect(await rowsFor('platform.user.banned')).toHaveLength(1)
  })

  it('leaves the expiry in place when the plugin is left to write it', async () => {
    // The control for the case above, and the trap named against the real library: an update that
    // omits `banExpires` does not clear it, so the permanent ban would lift itself.
    const target = seedUser({
      banned: false,
      banExpires: new Date('2020-01-01T00:00:00.000Z'),
    })

    await getAuth().api.banUser({
      body: { userId: target.id, banReason: 'permanent' },
      headers: new Headers({ cookie: jarHeader(callerJar) }),
    })

    expect(userRow(target.id).ban_expires).toBe(
      new Date('2020-01-01T00:00:00.000Z').getTime(),
    )
  })

  it('does not run the clearing write when there is no expiry to clear', async () => {
    const unbanSpy = vi.spyOn(getAuth().api, 'unbanUser')
    const target = seedUser()

    await ban({ userId: target.id, reason: 'permanent' })

    expect(unbanSpy).not.toHaveBeenCalled()
  })

  it('refuses the operator own account before anything is called', async () => {
    await expect(
      ban({ userId: operatorId, reason: 'oops' }),
    ).rejects.toBeInstanceOf(ConsoleActionError)
    expect(userRow(operatorId).banned).toBe(0)
  })

  it('refuses an account that no longer exists', async () => {
    await expect(
      ban({ userId: 'user_missing', reason: 'abuse' }),
    ).rejects.toMatchObject({ code: 'target-not-found' })
    expect(await auditRows()).toEqual([])
  })
})

describe('lifting a ban', () => {
  it('writes exactly one row', async () => {
    const target = seedUser({
      banned: true,
      banReason: 'abuse',
      banExpires: new Date('2027-01-01T00:00:00.000Z'),
    })

    await unban({ userId: target.id })

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.user.unbanned',
      entityId: target.id,
      actorKind: 'human',
      actorRole: 'admin',
    })
    expect(rows[0]?.changes?.before).toMatchObject({
      banned: true,
      banReason: 'abuse',
    })
    expect(rows[0]?.changes?.after).toMatchObject({
      banned: false,
      banReason: null,
      banExpiresAt: null,
    })
    expect(userRow(target.id).banned).toBe(0)
  })
})

/* --------------------------------------------------------------------- password */

describe('setting a password', () => {
  it('writes exactly one row and puts the password nowhere in the ledger', async () => {
    const targetId = await seedAccountWithPassword('resettable@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    const secret = 'correct-horse-battery-staple-two'

    await setPassword({ userId: targetId, newPassword: secret })

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.user.password_set',
      entityType: 'user',
      entityId: targetId,
      actorKind: 'human',
      actorUserId: operatorId,
      actorRole: 'admin',
      ip: OPERATOR_IP,
      userAgent: OPERATOR_UA,
    })
    // The whole serialised ledger, not just `changes`: a password that leaked into `user_agent` or
    // an entity id would be just as permanent, and this table keeps rows for 400 days.
    expect(await ledgerText()).not.toContain(secret)

    // The password did reach Better Auth, so the absence above is not vacuous.
    const signedIn = await authPost('/sign-in/email', {
      email: 'resettable@planned.travel',
      password: secret,
    })
    expect(signedIn.status).toBe(200)
  })

  it('keeps the password out of the log lines as well', async () => {
    const target = seedUser()
    const secret = 'another-long-passphrase'
    await setPassword({ userId: target.id, newPassword: secret })
    expect(JSON.stringify(records())).not.toContain(secret)
  })

  it('drops the cached session snapshots', async () => {
    const targetId = await seedAccountWithPassword('cached@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    await jarFromSignIn('cached@planned.travel')
    const [session] = sessionRows(targetId)

    await setPassword({ userId: targetId, newPassword: 'a-long-passphrase' })

    expect(kv().deleted).toContain(session.token)
  })

  it('refuses a password below the product policy at the boundary', () => {
    expect(() =>
      setPlatformUserPasswordInputSchema.parse({
        userId: 'someone',
        newPassword: 'short',
      }),
    ).toThrow()
  })
})

/* ------------------------------------------------------- the rest of the verbs */

describe('the remaining account verbs', () => {
  it('records an email change and lands the address unverified', async () => {
    const updateSpy = vi.spyOn(getAuth().api, 'adminUpdateUser')
    const target = seedUser({ email: 'old@planned.travel' })

    await setEmail({ userId: target.id, email: 'New@Planned.Travel' })

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe('platform.user.email_set')
    expect(rows[0]?.changes?.before).toMatchObject({
      email: 'old@planned.travel',
      emailVerified: true,
    })
    expect(rows[0]?.changes?.after).toMatchObject({ emailVerified: false })
    expect(userRow(target.id).email).toBe('new@planned.travel')

    // The `data` payload is a closed key set, so `banned` is not reachable from the console.
    const [argument] = updateSpy.mock.calls[0]
    if (argument === undefined)
      throw new Error('adminUpdateUser took no argument')
    expect(Object.keys(argument.body.data).sort()).toEqual([
      'email',
      'emailVerified',
    ])
  })

  it('records a profile update', async () => {
    const updateSpy = vi.spyOn(getAuth().api, 'adminUpdateUser')
    const target = seedUser({ name: 'Old Name' })

    await updateUser({ userId: target.id, name: 'New Name' })

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe('platform.user.updated')
    expect(rows[0]?.changes?.before).toMatchObject({ name: 'Old Name' })
    expect(rows[0]?.changes?.after).toMatchObject({ name: 'New Name' })
    expect(userRow(target.id).name).toBe('New Name')

    const [argument] = updateSpy.mock.calls[0]
    if (argument === undefined)
      throw new Error('adminUpdateUser took no argument')
    expect(Object.keys(argument.body.data)).toEqual(['name'])
  })

  it('records a creation with no password in the payload', async () => {
    const secret = 'a-brand-new-passphrase'

    await createUser({
      email: 'new@planned.travel',
      name: 'New Curator',
      password: secret,
      role: 'curator',
    })

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.user.created',
      entityType: 'user',
      actorKind: 'human',
      actorRole: 'admin',
    })
    expect(rows[0]?.changes?.before).toBeNull()
    expect(rows[0]?.changes?.after).toMatchObject({
      email: 'new@planned.travel',
      role: 'curator',
    })
    expect(await ledgerText()).not.toContain(secret)

    // The account is real and the credential works, so the absence above is not vacuous.
    const signedIn = await authPost('/sign-in/email', {
      email: 'new@planned.travel',
      password: secret,
    })
    expect(signedIn.status).toBe(200)
  })

  it('will not mint an account below the product password policy', async () => {
    // `auth.api.createUser` hashes whatever it is handed and never consults
    // `emailAndPassword.minPasswordLength` — unlike `/sign-up/email`, `/reset-password` and
    // `/admin/set-user-password`, all three of which do. So an operator minting an account is the
    // one path on which the policy has to be stated at the boundary, and this is that statement.
    expect(() =>
      createPlatformUserInputSchema.parse({
        email: 'weak@planned.travel',
        name: 'Weak',
        password: 'x',
      }),
    ).toThrow()

    // The control, measured against `better-auth@1.7.1`: the endpoint itself accepts it.
    const created = await getAuth().api.createUser({
      body: {
        email: 'accepted-by-the-plugin@planned.travel',
        name: 'Accepted',
        password: 'x',
      },
      headers: new Headers({ cookie: jarHeader(callerJar) }),
    })
    expect(created.user.email).toBe('accepted-by-the-plugin@planned.travel')

    // And the control for the control: the product's own sign-up refuses the same password, which
    // is what makes "below the policy" a fact about this product rather than an opinion.
    const signUp = await authPost('/sign-up/email', {
      email: 'weak-signup@planned.travel',
      password: 'x',
      name: 'Weak',
    })
    expect(signUp.status).toBe(400)
  })

  it('records a deletion with the account described before it is gone', async () => {
    const targetId = await seedAccountWithPassword('departing@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    await jarFromSignIn('departing@planned.travel')
    const [session] = sessionRows(targetId)
    dropSessionIndex(targetId)

    await deleteUser({ userId: targetId })

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.user.deleted',
      entityId: targetId,
      actorKind: 'human',
    })
    expect(rows[0]?.changes?.before).toMatchObject({
      email: 'departing@planned.travel',
    })
    expect(rows[0]?.changes?.after).toBeNull()
    expect(kv().deleted).toContain(session.token)
    expect(
      authDatabase.sqlite
        .prepare('select id from user where id = ?')
        .get(targetId),
    ).toBeUndefined()
  })

  it('refuses to delete the operator own account', async () => {
    await expect(deleteUser({ userId: operatorId })).rejects.toMatchObject({
      code: 'target-is-self',
    })
    expect(
      authDatabase.sqlite
        .prepare('select id from user where id = ?')
        .get(operatorId),
    ).toBeDefined()
  })

  it('audits no read, and answers a page that is not empty', async () => {
    seedUser()
    await listUsers({})
    expect(await auditRows()).toEqual([])

    // `listUsers` swallows every internal failure into `{ users: [], total: 0 }`, so a read that
    // returned nothing would be indistinguishable from a working one. The line carries the count.
    const line = records().find(
      (record) => record.action === 'platform.user.list',
    )
    expect(line).toBeDefined()
    expect(line?.total).toBeGreaterThan(0)
    expect(line?.returned).toBeGreaterThan(0)
  })

  it('reads one account without auditing it', async () => {
    const target = seedUser({ name: 'Readable' })
    await getUser({ userId: target.id })
    expect(await auditRows()).toEqual([])
    expect(
      records().some((record) => record.action === 'platform.user.get'),
    ).toBe(true)
  })

  it('never sends the wire a free-hand sort column', () => {
    expect(() =>
      listPlatformUsersInputSchema.parse({ sortBy: 'password' }),
    ).toThrow()
    expect(() =>
      listPlatformUsersInputSchema.parse({ role: 'curator', banned: true }),
    ).toThrow()
  })
})

/* --------------------------------------------------------------------- sessions */

describe('sessions', () => {
  it('revokes one session by id and audits it without the token', async () => {
    const targetId = await seedAccountWithPassword('two-tabs@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    await jarFromSignIn('two-tabs@planned.travel')
    await jarFromSignIn('two-tabs@planned.travel')
    const [kept, doomed] = sessionRows(targetId)

    await revokeSession({ userId: targetId, sessionId: doomed.id })

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.session.revoked',
      entityType: 'session',
      entityId: doomed.id,
      actorKind: 'human',
      actorRole: 'admin',
    })
    expect(await ledgerText()).not.toContain(doomed.token)
    expect(sessionRows(targetId).map((row) => row.id)).toEqual([kept.id])
    expect(kv().store.has(doomed.token)).toBe(false)
  })

  it('refuses a session id that does not belong to the named account', async () => {
    const target = seedUser()
    const otherId = await seedAccountWithPassword('elsewhere@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    await jarFromSignIn('elsewhere@planned.travel')
    const [foreign] = sessionRows(otherId)

    await expect(
      revokeSession({ userId: target.id, sessionId: foreign.id }),
    ).rejects.toMatchObject({ code: 'target-not-found' })
    expect(sessionRows(otherId).map((row) => row.id)).toEqual([foreign.id])
  })

  it('revokes every session and deletes the keys the plugin would have missed', async () => {
    const targetId = await seedAccountWithPassword('everywhere@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    await jarFromSignIn('everywhere@planned.travel')
    await jarFromSignIn('everywhere@planned.travel')
    const tokens = sessionRows(targetId).map((row) => row.token)
    dropSessionIndex(targetId)

    await revokeAllSessions({ userId: targetId })

    // As on the ban path, the leading entry is the plugin deleting the index key it could not read
    // while deleting none of the blobs it names. The tail is this directory closing that gap.
    expect(kv().deleted).toEqual([
      `active-sessions-${targetId}`,
      ...tokens,
      `active-sessions-${targetId}`,
    ])
    for (const token of tokens) {
      expect(kv().store.has(token)).toBe(false)
    }

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.session.revoked_all',
      entityType: 'session',
      // No single session was touched, so no session id is claimed.
      entityId: null,
      actorKind: 'human',
    })
    expect(rows[0]?.changes?.before).toMatchObject({
      userId: targetId,
      sessions: 2,
    })
  })

  it('lists what D1 holds rather than what the KV index remembers', async () => {
    const targetId = await seedAccountWithPassword('listed@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    await jarFromSignIn('listed@planned.travel')
    // `auth.api.listUserSessions` reads this index and answers `[]` without it. The console does
    // not, which is the reason it does not use that endpoint.
    dropSessionIndex(targetId)

    await listSessions({ userId: targetId })

    const line = records().find(
      (record) => record.action === 'platform.session.list',
    )
    expect(line?.returned).toBe(1)

    const throughThePlugin = await getAuth().api.listUserSessions({
      body: { userId: targetId },
      headers: new Headers({ cookie: jarHeader(callerJar) }),
    })
    expect(throughThePlugin.sessions).toEqual([])
  })

  it('validates the session list input', () => {
    expect(() => listPlatformSessionsInputSchema.parse({})).toThrow()
    expect(() =>
      revokePlatformUserSessionsInputSchema.parse({ userId: '' }),
    ).toThrow()
    expect(() =>
      revokePlatformSessionInputSchema.parse({ userId: 'a', sessionId: '' }),
    ).toThrow()
  })
})

/* ---------------------------------------------------------------- impersonation */

describe('impersonation', () => {
  it('lands every cookie separately on the response and really swaps the session', async () => {
    const worn = seedUser({ name: 'Worn Account' })

    const response = await impersonate({ userId: worn.id })

    const cookies = response.headers.getSetCookie()
    // Six values, in this order, and the number is measured rather than read off the endpoint's
    // source: `impersonateUser` calls `deleteSessionCookie`, which expires all three of the session
    // cookie, its signed data companion and the remember-me marker; then it writes the signed
    // `admin_session` cookie carrying the operator's own token; then `setSessionCookie` writes the
    // impersonated session and its marker. `planned.session_token` and `planned.dont_remember`
    // therefore appear twice each, once cleared and once live — and a merge that kept only the
    // first of each name would restore the operator's own session instead of swapping it.
    expect(cookies.map((cookie) => cookie.split('=')[0])).toEqual([
      'planned.session_token',
      'planned.session_data',
      'planned.dont_remember',
      'planned.admin_session',
      'planned.session_token',
      'planned.dont_remember',
    ])
    // The clearing half is `Max-Age=0` rather than an `Expires=` date, so none of today's six
    // carries the comma that makes `Headers#get('set-cookie')` unrecoverable. That is an accident of
    // the library's attribute choice and not something this directory leans on: one `Expires=`
    // anywhere in the set is enough, which is the case `__tests__/cookies.test.ts` drives directly.
    expect(
      cookies.filter((cookie) => cookie.includes('Max-Age=0')),
    ).toHaveLength(3)
    expect(cookies.some((cookie) => cookie.includes('Expires='))).toBe(false)

    // The claim that matters is not "six headers" but "the browser is now that account".
    const jar = applyCookies(new Map(), response)
    const session = await authGet('/get-session', jarHeader(jar))
    const body: {
      user: { id: string }
      session: { impersonatedBy: string | null; expiresAt: string }
    } | null = await session.json()
    expect(body?.user.id).toBe(worn.id)
    expect(body?.session.impersonatedBy).toBe(operatorId)
  })

  it('writes exactly one row naming the operator and the target, with a 900-second expiry', async () => {
    const worn = seedUser()
    const before = Date.now()

    const response = await impersonate({ userId: worn.id })

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.user.impersonation_started',
      entityType: 'user',
      entityId: worn.id,
      actorKind: 'human',
      actorUserId: operatorId,
      actorRole: 'admin',
      ip: OPERATOR_IP,
      userAgent: OPERATOR_UA,
    })

    const expiresAt = rows[0]?.changes?.after?.expiresAt
    expect(typeof expiresAt).toBe('string')
    const remaining = (new Date(String(expiresAt)).getTime() - before) / 1000
    // docs/ACCESS.md §6.2: 900 seconds, not the plugin's own 3600-second fallback. The window is
    // one-sided around 900 because `before` is read here and the expiry is computed a few
    // milliseconds later inside the endpoint; anything near 3600 fails either bound.
    expect(remaining).toBeGreaterThanOrEqual(900)
    expect(remaining).toBeLessThan(910)

    // The same number, read off the session row the plugin actually minted.
    const jar = applyCookies(new Map(), response)
    const impersonated = sessionRows(worn.id)
    expect(impersonated).toHaveLength(1)
    const lifetime = (impersonated[0].expires_at - before) / 1000
    expect(lifetime).toBeGreaterThanOrEqual(900)
    expect(lifetime).toBeLessThan(910)
    expect(jarHeader(jar)).toContain('planned.admin_session=')
  })

  it('refuses a banned target with its own error and never mints a session', async () => {
    const impersonateSpy = vi.spyOn(getAuth().api, 'impersonateUser')
    const target = seedUser({ banned: true, banReason: 'abuse' })

    const failure = await impersonate({ userId: target.id }).catch(
      (cause: unknown) => cause,
    )

    expect(failure).toBeInstanceOf(ConsoleActionError)
    expect(failure).toMatchObject({ code: 'target-banned' })
    // Not the plugin's `bannedUserMessage`, which is copy written for the banned user.
    expect(String((failure as Error).message)).toContain(
      'That account is banned',
    )
    expect(impersonateSpy).not.toHaveBeenCalled()
    expect(await auditRows()).toEqual([])
    expect(sessionCount(target.id)).toBe(0)
  })

  it('refuses in copy of its own, because the plugin refusal is written for the banned user', async () => {
    // The measurement behind the pre-check above. Left to `better-auth@1.7.1`, a banned target is
    // refused not by the endpoint but by the `admin` plugin's `session.create.before` database
    // hook, which throws `FORBIDDEN` carrying `bannedUserMessage` — and that string is our own repo
    // copy, written in the second person for the banned account's own login screen. Shown to an
    // operator it says *their* account is suspended.
    const target = seedUser({ banned: true, banReason: 'abuse' })

    const raw = await getAuth()
      .api.impersonateUser({
        body: { userId: target.id },
        headers: new Headers({ cookie: jarHeader(callerJar) }),
      })
      .catch((cause: unknown) => cause)

    expect(raw).toBeInstanceOf(Error)
    expect(raw).toMatchObject({
      status: 'FORBIDDEN',
      body: { code: 'BANNED_USER', message: BANNED_USER_MESSAGE },
    })
    expect(BANNED_USER_MESSAGE).not.toContain('That account is banned')
  })

  it('refuses a platform admin target', async () => {
    const impersonateSpy = vi.spyOn(getAuth().api, 'impersonateUser')
    const target = seedUser({ role: 'admin' })

    await expect(impersonate({ userId: target.id })).rejects.toMatchObject({
      code: 'target-is-admin',
    })
    expect(impersonateSpy).not.toHaveBeenCalled()
  })

  it('refuses the operator own account', async () => {
    await expect(impersonate({ userId: operatorId })).rejects.toMatchObject({
      code: 'target-is-self',
    })
  })

  it('ends an impersonation, restoring the operator session and naming them as the actor', async () => {
    const worn = seedUser({ role: 'curator' })
    const started = await impersonate({ userId: worn.id })
    // The impersonated cookies are the caller's now, exactly as they would be in the browser.
    const wornJar = applyCookies(new Map(callerJar), started)
    callerJar = wornJar

    const response = await stopImpersonating()

    const restored = applyCookies(new Map(callerJar), response)
    const session = await authGet('/get-session', jarHeader(restored))
    const body: {
      user: { id: string }
      session: { impersonatedBy: string | null }
    } | null = await session.json()
    expect(body?.user.id).toBe(operatorId)
    expect(body?.session.impersonatedBy).toBeNull()

    const rows = await rowsFor('platform.user.impersonation_ended')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.user.impersonation_ended',
      entityType: 'user',
      // docs/ACCESS.md §6.4: the impersonator in `actor_user_id`, the target in `entity_id`.
      entityId: worn.id,
      actorUserId: operatorId,
      actorKind: 'human',
      // The operator's role, read from the row — not the worn account's `curator`.
      actorRole: 'admin',
      ip: OPERATOR_IP,
      userAgent: OPERATOR_UA,
    })
  })

  it('refuses to end an impersonation on an ordinary session', async () => {
    await expect(stopImpersonating()).rejects.toMatchObject({
      code: 'not-impersonating',
    })
    expect(await auditRows()).toEqual([])
  })

  it('refuses to end an impersonation with no session at all', async () => {
    callerJar = new Map()
    await expect(stopImpersonating()).rejects.toBeInstanceOf(
      AuthRequirementError,
    )
  })

  it('refuses any payload at the boundary', () => {
    // A client that names a target is trying to end somebody else's impersonation. The exit takes
    // no argument at all, and the validator is what says so.
    expect(() => stopImpersonationInputSchema.parse({})).not.toThrow()
    expect(() =>
      stopImpersonationInputSchema.parse({ userId: 'someone-else' }),
    ).toThrow()
  })
})

/* ------------------------------------------------------------ observability */

describe('every function emits a structured log line', () => {
  it('names its action on at least one record, reads included', async () => {
    // SPEC §5: "every server function emits structured logs". A read has no audit row, so the line
    // is the only trace it leaves — and a mutation whose line is missing is a mutation nobody can
    // correlate with the request that made it.
    const target = seedUser({ role: 'curator' })
    const otherId = await seedAccountWithPassword('other@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    await jarFromSignIn('other@planned.travel')
    const [session] = sessionRows(otherId)
    const worn = seedUser()

    const cases: Array<[string, () => Promise<unknown>]> = [
      ['platform.user.list', () => listUsers({})],
      ['platform.user.get', () => getUser({ userId: target.id })],
      [
        'platform.user.created',
        () =>
          createUser({
            email: 'fresh@planned.travel',
            name: 'Fresh',
            password: 'a-long-enough-passphrase',
            role: 'user',
          }),
      ],
      [
        'platform.user.updated',
        () => updateUser({ userId: target.id, name: 'Renamed' }),
      ],
      [
        'platform.user.email_set',
        () => setEmail({ userId: target.id, email: 'moved@planned.travel' }),
      ],
      [
        'platform.user.role_changed',
        () => setRole({ userId: target.id, role: 'user' }),
      ],
      [
        'platform.user.password_set',
        () =>
          setPassword({ userId: target.id, newPassword: 'a-long-passphrase' }),
      ],
      [
        'platform.user.banned',
        () => ban({ userId: target.id, reason: 'abuse' }),
      ],
      ['platform.user.unbanned', () => unban({ userId: target.id })],
      ['platform.session.list', () => listSessions({ userId: otherId })],
      [
        'platform.session.revoked',
        () => revokeSession({ userId: otherId, sessionId: session.id }),
      ],
      [
        'platform.session.revoked_all',
        () => revokeAllSessions({ userId: otherId }),
      ],
      ['platform.user.deleted', () => deleteUser({ userId: target.id })],
    ]

    for (const [action, run] of cases) {
      const before = records().length
      await run()
      const emitted = records()
        .slice(before)
        .filter((record) => record.action === action)
      expect({ action, emitted: emitted.length > 0 }).toEqual({
        action,
        emitted: true,
      })
    }

    // The last two run against each other and need the impersonated session in between.
    const startedAt = records().length
    const started = await impersonate({ userId: worn.id })
    expect(
      records()
        .slice(startedAt)
        .some(
          (record) => record.action === 'platform.user.impersonation_started',
        ),
    ).toBe(true)

    callerJar = applyCookies(new Map(callerJar), started)
    const endedAt = records().length
    await stopImpersonating()
    expect(
      records()
        .slice(endedAt)
        .some(
          (record) => record.action === 'platform.user.impersonation_ended',
        ),
    ).toBe(true)
  })
})

/* -------------------------------------------------------- the audit failure path */

describe('when the audit append is rejected', () => {
  it('lets the action stand and raises a line naming the action, the actor and the entity', async () => {
    const target = seedUser()
    shared.brokenDb.current = true

    await expect(
      ban({ userId: target.id, reason: 'abuse' }),
    ).resolves.toBeDefined()

    // Reversing a completed ban because a log write failed is the worse of the two failures.
    expect(userRow(target.id).banned).toBe(1)

    const failure = records().find(
      (record) => record.msg === 'platform audit append failed',
    )
    expect(failure).toBeDefined()
    expect(failure?.level).toBe('error')
    expect(failure).toMatchObject({
      action: 'platform.user.banned',
      actorUserId: operatorId,
      actorRole: 'admin',
      actorKind: 'human',
      entityId: target.id,
      // A ban is one of the four verbs docs/ACCESS.md §4.3 audits without exception, so it is
      // attempted twice before the incident is raised.
      attempts: 2,
    })
  })
})
