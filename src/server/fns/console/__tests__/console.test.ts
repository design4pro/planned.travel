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
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { z } from 'zod'

import {
  BANNED_USER_MESSAGE,
  IMPERSONATION_SESSION_SECONDS,
} from '#/server/auth/admin-options'
import { createPlatformTables } from '#/server/catalog/__tests__/platform-tables'
import { platformAuditLog } from '#/server/db/schema'
import { createLogger, createMemorySink } from '#/server/observability'
import { MEMBERSHIP_LIMIT } from '../account'
import { OWNERSHIP_READ_LIMIT } from '../last-owner'
import { SESSION_LIST_CEILING, enumerateSessionRows } from '../session-keys'
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
  /**
   * Runs the instant `auth.api.stopImpersonating` is entered, before the plugin does anything.
   *
   * The only way to observe the *order* docs/ACCESS.md §6.1 specifies for the impersonation exit
   * from outside the function: what the ledger already holds when the plugin call begins.
   */
  readonly onStopImpersonating: Holder<(() => void) | null>
  /**
   * When true, every page of `session` rows rejects — the D1 read behind the KV purge failing, not
   * a KV delete failing.
   *
   * The distinction is the whole point of the switch. A rejected delete is absorbed and counted
   * (`purgeSessionBlobs` uses `Promise.allSettled`), while a rejected *page read* propagates, and on
   * the paths where the snapshot drop runs after the mutation that rejection would escape past the
   * audit append. Nothing else in this file can produce it.
   */
  readonly sessionPagesReject: Holder<boolean>
  /**
   * When true, the adapter behind the operator's role read rejects.
   *
   * The impersonation exit is the only caller, and the row it writes carries the operator's role as
   * a value — so "the read failed" and "the column is NULL" have to arrive as different things or
   * an admin's exit is recorded under `actor_role: 'user'`. This switch is what makes the first of
   * those two reachable.
   */
  readonly roleReadRejects: Holder<boolean>
}

const shared = vi.hoisted((): SharedState => ({
  authDb: { current: null },
  kv: { current: null },
  platformTables: { current: null },
  sink: { current: null },
  brokenDb: { current: false },
  onStopImpersonating: { current: null },
  sessionPagesReject: { current: false },
  roleReadRejects: { current: false },
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

vi.mock('../bindings', async () => {
  // The *shipped* reads, not a copy of them. `../bindings` cannot be loaded here at all — it imports
  // `cloudflare:workers` — so this factory replaces it, and everything it once re-implemented inline
  // now comes from `../adapter-reads`, which takes its adapter as an argument for exactly this
  // reason. What is supplied below is the Worker environment: the real `auth.api`, the real Better
  // Auth database adapter over the real SQLite schema, a `Map`-backed `SESSIONS` namespace and a
  // real `platform_audit_log`. The expiry predicate, the `id` order and the single expiry instant
  // are therefore under test as the code that ships, not as a restatement of it.
  const {
    createSessionPageReader,
    readOrganizations,
    readPlatformRole,
    readWorkspaceOwnership,
  } = await import('../adapter-reads')
  const adapter = async () => (await getAuth().$context).adapter

  return {
    consoleLogger: () =>
      createLogger({
        level: 'debug',
        sink: sink(),
        context: { component: 'console-fn' },
      }),
    currentSession: () => getSession(),
    platformDb: () =>
      shared.brokenDb.current ? brokenDatabase() : tables().db,
    platformApi: () => {
      const api = getAuth().api
      const hook = shared.onStopImpersonating.current
      if (!hook) return api
      return {
        ...api,
        stopImpersonating: ((
          ...args: Parameters<typeof api.stopImpersonating>
        ) => {
          hook()
          return api.stopImpersonating(...args)
        }) as typeof api.stopImpersonating,
      }
    },
    sessionKeyStore: () => kv(),
    // The one wrapper, and it injects a fault rather than re-stating a query: nothing else in this
    // file can make a *page read* reject, which is the failure the post-mutation snapshot drop has
    // to absorb without losing the audit row.
    sessionPageReader: (userId: string) => {
      const page = createSessionPageReader(adapter, userId)
      return async (offset: number, limit: number) => {
        if (shared.sessionPagesReject.current) {
          throw new Error('D1_ERROR: database is locked')
        }
        return page(offset, limit)
      }
    },
    readSessionRows: async (userId: string) =>
      enumerateSessionRows(createSessionPageReader(adapter, userId)),
    readOwnership: async (userId: string) =>
      readWorkspaceOwnership(adapter, userId),
    readWorkspaces: async (organizationIds: ReadonlyArray<string>) =>
      readOrganizations(adapter, organizationIds),
    readUserRole: async (userId: string) => {
      if (shared.roleReadRejects.current) {
        return readPlatformRole(async () => {
          throw new Error('D1_ERROR: database is locked')
        }, userId)
      }
      return readPlatformRole(adapter, userId)
    },
  }
})

/* ------------------------------------------------------------- the real modules */

// Imported dynamically, after the constants above exist: `vi.mock` factories are hoisted but their
// bodies run on first request, and the first request for `#/server/auth/env` happens here.
const { getAuth } = await import('#/server/auth')
const { getSession } = await import('#/server/auth/session')
const { AuthRequirementError } = await import('#/server/auth/tenant')
const { ConsoleActionError, ConsoleUnattributableError } =
  await import('../errors')
const {
  endImpersonationFn,
  endImpersonationInputSchema,
  startImpersonationFn,
  startImpersonationInputSchema,
} = await import('../impersonation')
const { listPlatformSessions, listPlatformSessionsInputSchema } =
  await import('../session-listing')
const {
  revokePlatformSessionFn,
  revokePlatformSessionInputSchema,
  revokePlatformUserSessionsFn,
  revokePlatformUserSessionsInputSchema,
} = await import('../sessions')
const {
  banPlatformUser,
  banPlatformUserInputSchema,
  createPlatformUser,
  createPlatformUserInputSchema,
  deletePlatformUser,
  deletePlatformUserInputSchema,
  getPlatformUser,
  getPlatformUserInputSchema,
  listPlatformUsers,
  listPlatformUsersInputSchema,
  setPlatformUserEmail,
  setPlatformUserEmailInputSchema,
  setPlatformUserPassword,
  setPlatformUserPasswordInputSchema,
  setPlatformUserRole,
  setPlatformUserRoleInputSchema,
  unbanPlatformUser,
  unbanPlatformUserInputSchema,
  updatePlatformUser,
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

let workspaceCounter = 0

/** A workspace row, written straight into SQLite. */
function seedWorkspace(name: string): string {
  workspaceCounter += 1
  const id = `seeded_org_${workspaceCounter}`
  authDatabase.sqlite
    .prepare(
      'insert into organization (id, name, slug, created_at) values (?, ?, ?, ?)',
    )
    .run(id, name, `${id}-slug`, Date.now())
  return id
}

/** A membership row. `createdAt` rises with every call, so "the last workspace" is well defined. */
function seedMember(
  organizationId: string,
  userId: string,
  role: string,
): void {
  workspaceCounter += 1
  authDatabase.sqlite
    .prepare(
      'insert into member (id, organization_id, user_id, role, created_at) values (?, ?, ?, ?, ?)',
    )
    .run(
      `seeded_member_${workspaceCounter}`,
      organizationId,
      userId,
      role,
      Date.now() + workspaceCounter,
    )
}

function memberCount(userId: string): number {
  const row = authDatabase.sqlite
    .prepare('select count(*) as n from member where user_id = ?')
    .get(userId) as { n: number }
  return row.n
}

function userExists(id: string): boolean {
  return (
    authDatabase.sqlite.prepare('select id from user where id = ?').get(id) !==
    undefined
  )
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

/**
 * A number of session rows written straight into SQLite, with their KV blobs beside them.
 *
 * Direct because the point is the *count*: signing in six hundred times costs six hundred password
 * hashes and proves nothing extra. The ids are zero-padded so their lexicographic order is their
 * numeric one, which is what makes "the last of them sorts past the enumeration ceiling" a fact the
 * test can name rather than a coincidence of id generation.
 */
function seedSessionRows(
  userId: string,
  count: number,
): Array<{ id: string; token: string }> {
  const now = Date.now()
  const insert = authDatabase.sqlite.prepare(
    `insert into session
       (id, token, user_id, active_organization_id, ip_address, user_agent,
        impersonated_by, expires_at, created_at, updated_at)
     values (?, ?, ?, null, null, null, null, ?, ?, ?)`,
  )
  const rows: Array<{ id: string; token: string }> = []

  for (let index = 0; index < count; index += 1) {
    const suffix = String(index).padStart(4, '0')
    const id = `bulk_session_${suffix}`
    const token = `bulk_token_${suffix}`
    const expiresAt = now + 86_400_000
    insert.run(id, token, userId, expiresAt, now + index, now + index)
    // The blob Better Auth itself writes, in the shape `findSession` and `deleteSession` read: a
    // `{}` placeholder makes `deleteSession` log "Session not found in secondary storage" and return
    // without touching D1, which would be a fixture quietly disabling the code under test.
    kv().store.set(
      token,
      JSON.stringify({
        session: { id, token, userId, expiresAt },
        user: { id: userId },
      }),
    )
    rows.push({ id, token })
  }

  return rows
}

/**
 * One session row whose `expiresAt` is in the past, with its blob beside it.
 *
 * `storeSessionInDatabase` deletes a row lazily, on the next `findSession` that resolves it, so a
 * device an account never comes back to leaves this behind for the whole of the session lifetime.
 * It is a row the console must not call live.
 */
function seedExpiredSessionRow(userId: string): { id: string; token: string } {
  const id = `expired_session_${userId}`
  const token = `expired_token_${userId}`
  const expiresAt = Date.now() - 86_400_000

  authDatabase.sqlite
    .prepare(
      `insert into session
         (id, token, user_id, active_organization_id, ip_address, user_agent,
          impersonated_by, expires_at, created_at, updated_at)
       values (?, ?, ?, null, null, null, null, ?, ?, ?)`,
    )
    .run(id, token, userId, expiresAt, expiresAt, expiresAt)
  kv().store.set(
    token,
    JSON.stringify({
      session: { id, token, userId, expiresAt },
      user: { id: userId },
    }),
  )

  return { id, token }
}

/** The per-user session index, removed without the removal being recorded as the console's. */
function dropSessionIndex(userId: string): void {
  kv().store.delete(`active-sessions-${userId}`)
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
  const attempt = await attemptDuringRequest(call)
  if (attempt.failures.length > 0) {
    throw attempt.failures[0]
  }
  return attempt.response
}

/**
 * The same request scope, handing back the response *and* whatever the handler threw.
 *
 * The two are separate facts and one case needs both: a handler that rejects still leaves its
 * headers on the response the runtime builds, which is exactly how a forwarded `Set-Cookie` can
 * survive an error the operator is shown. {@link duringRequest} re-raises for every other case.
 */
async function attemptDuringRequest(
  call: () => Promise<void>,
): Promise<{ response: Response; failures: Array<unknown> }> {
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
  return { response, failures }
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

/**
 * The same sequencing for the eleven verbs that are plain `async` functions rather than server
 * functions — the ten in `../users` and the session read in `../session-listing` — and so take their input
 * directly (see those files' headers for why they must stay that way). The parse here is the
 * *wrapper's* — `src/routes/_app/console/-server/users.ts` — kept so an invalid payload is refused
 * before `duringRequest` exactly as it is on the wire; each function re-parses its own schema on
 * entry, which is what the runtime does too.
 */
function plain<TSchema extends z.ZodType>(
  schema: TSchema,
  fn: (input: z.output<TSchema>) => Promise<unknown>,
): (data: unknown) => Promise<Response> {
  return async (data: unknown) => {
    const validated = schema.parse(data)
    return duringRequest(async () => {
      await fn(validated)
    })
  }
}

const setRole = plain(setPlatformUserRoleInputSchema, setPlatformUserRole)
const ban = plain(banPlatformUserInputSchema, banPlatformUser)
const unban = plain(unbanPlatformUserInputSchema, unbanPlatformUser)
const setPassword = plain(
  setPlatformUserPasswordInputSchema,
  setPlatformUserPassword,
)
const setEmail = plain(setPlatformUserEmailInputSchema, setPlatformUserEmail)
const updateUser = plain(updatePlatformUserInputSchema, updatePlatformUser)
const createUser = plain(createPlatformUserInputSchema, createPlatformUser)
const deleteUser = plain(deletePlatformUserInputSchema, deletePlatformUser)
const listUsers = plain(listPlatformUsersInputSchema, listPlatformUsers)
const getUser = plain(getPlatformUserInputSchema, getPlatformUser)
const listSessions = plain(
  listPlatformSessionsInputSchema,
  listPlatformSessions,
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
const endImpersonation = async (): Promise<Response> =>
  duringRequest(async () => {
    await endImpersonationFn({ data: {} })
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
  shared.onStopImpersonating.current = null
  shared.sessionPagesReject.current = false
  shared.roleReadRejects.current = false
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

  it('refuses the operator’s own account, which is the one demotion with no way back', async () => {
    // Better Auth permits it. The model reserves no seat and the product ships no recovery path, so
    // one call can leave a platform whose console nobody can open — including the operator who just
    // made it so.
    await expect(
      setRole({ userId: operatorId, role: 'user' }),
    ).rejects.toMatchObject({ code: 'target-is-self' })

    expect(userRow(operatorId).role).toBe('admin')
    expect(await auditRows()).toEqual([])
  })

  it('refuses a self-target even when the role would not move', async () => {
    await expect(
      setRole({ userId: operatorId, role: 'admin' }),
    ).rejects.toMatchObject({ code: 'target-is-self' })
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

  it('still writes the row when the snapshot drop cannot read its pages', async () => {
    // The snapshot drop runs *after* `setRole` has committed, and the enumeration behind it is a D1
    // read that can reject. A rejection escaping there does not undo the role change — nothing can,
    // there is no transaction around it — it only deletes the row that records a deliberate human
    // action, which is docs/ACCESS.md §4.3's "unaudited mutation" arriving by the back door.
    const target = seedUser({ role: null })
    shared.sessionPagesReject.current = true

    await setRole({ userId: target.id, role: 'curator' })

    expect(userRow(target.id).role).toBe('curator')
    const rows = await rowsFor('platform.user.role_changed')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      entityId: target.id,
      actorKind: 'human',
      actorUserId: operatorId,
      actorRole: 'admin',
    })
    expect(rows[0]?.changes?.after).toMatchObject({ role: 'curator' })
  })

  it('raises the snapshots it could not drop, naming the action and the actor', async () => {
    const target = seedUser({ role: null })
    shared.sessionPagesReject.current = true

    await setRole({ userId: target.id, role: 'curator' })

    expect(
      records().find(
        (record) =>
          record.msg === 'console could not clear the stale session snapshots',
      ),
    ).toMatchObject({
      level: 'error',
      action: 'platform.user.role_changed',
      entityId: target.id,
      actorUserId: operatorId,
      actorRole: 'admin',
    })
  })

  it('refuses before the mutation when the same read fails on a ban', async () => {
    // The other half of the same rule, and the reason the snapshot drop may swallow what the purge
    // may not. Before a ban, the identical rejection is allowed to stop the call outright: the
    // account is untouched, every token is still named in D1, and the operator can press again.
    // After a role change there is nothing left to refuse.
    const target = seedUser()
    shared.sessionPagesReject.current = true

    await expect(ban({ userId: target.id, reason: 'abuse' })).rejects.toThrow(
      'D1_ERROR',
    )

    expect(userRow(target.id).banned).toBe(0)
    expect(await auditRows()).toEqual([])
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

    // The blobs go first and the index key last, and that order is the correctness property rather
    // than a detail. `banUser` deletes every D1 `session` row by predicate, so a blob this call has
    // not already deleted by the time the plugin runs is one nothing anywhere can name again — the
    // D1 rows are gone and the index key goes with them. The two entries in the middle are
    // better-auth's own: it reads `[]` out of the missing index, deletes not one blob, and then
    // removes the index key it just failed to find.
    // The leading tokens are compared as a set: the enumeration is ordered by session `id`, which is
    // a total order chosen for stable paging and is not the sign-in order.
    expect([...kv().deleted.slice(0, 2)].sort()).toEqual([...tokens].sort())
    expect(kv().deleted.slice(2)).toEqual([
      `active-sessions-${targetId}`,
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

    // The three halves of "the ban took effect", asserted separately because each one failed on its
    // own in an earlier round: (a) the D1 session rows are gone, (b) the KV blobs are gone, and
    // (c) the pre-ban token no longer resolves to a live session — which is the only one of the
    // three a browser would notice, and the one a green (a) and (b) used to coexist with.
    expect(sessionCount(throughConsole)).toBe(0)
    expect(kv().store.has(consoleSession.token)).toBe(false)
    expect(
      await getAuth().api.getSession({
        headers: new Headers({ cookie: jarHeader(consoleJar) }),
        query: { disableCookieCache: true },
      }),
    ).toBeNull()
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

    // Both verbs, and both attributed to the operator by name. `SELF_AUDITING_BAN_PATHS` in
    // `src/server/auth/index.ts` stands the tripwire down for `/admin/ban-user` and
    // `/admin/unban-user` on the stated grounds that this directory appends the human row — so
    // until these two assertions hold, docs/ACCESS.md §4.3's "always audited" is false for exactly
    // the two verbs it was written to protect, and the comment is the only thing claiming otherwise.
    for (const action of [
      'platform.user.unbanned',
      'platform.user.banned',
    ] as const) {
      const rows = await rowsFor(action)
      expect({ action, rows: rows.length }).toEqual({ action, rows: 1 })
      expect(rows[0]).toMatchObject({
        actorKind: 'human',
        actorUserId: operatorId,
        actorRole: 'admin',
        entityType: 'user',
        entityId: target.id,
      })
      expect(rows[0]?.changes?.before).toBeDefined()
      expect(rows[0]?.changes?.after).toBeDefined()
    }
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

  it('restores the ban it cleared when the permanent one cannot be applied', async () => {
    // The clearing write is `unbanUser`, which really does set `banned = false` with a null reason
    // and a null expiry. If the `banUser` behind it then rejects — a D1 transient, or `NOT_FOUND` if
    // the row moved — an account under a live temporary ban would otherwise be left *un*banned while
    // the operator reads an error: the weaker state, reached by a call asking for a stronger one.
    const expires = new Date(Date.now() + 3 * 86_400_000)
    const target = seedUser({
      banned: true,
      banReason: 'first offence',
      banExpires: expires,
    })

    let calls = 0
    const realBan = getAuth().api.banUser
    vi.spyOn(getAuth().api, 'banUser').mockImplementation(async (options) => {
      calls += 1
      // The permanent ban, i.e. the one with no expiry: the only call that is allowed to fail here.
      if (calls === 1) throw new Error('D1_ERROR: database is locked')
      return realBan(options)
    })

    await expect(
      ban({ userId: target.id, reason: 'permanent' }),
    ).rejects.toThrow('D1_ERROR')

    const row = userRow(target.id)
    expect(row.banned).toBe(1)
    expect(row.ban_reason).toBe('first offence')
    // Restored to what was left of the original ban rather than to the whole of it: the compensation
    // works in seconds remaining, and the drift is under a second.
    expect(row.ban_expires).not.toBeNull()
    expect(Math.abs((row.ban_expires ?? 0) - expires.getTime())).toBeLessThan(
      2000,
    )
    // Nothing happened, as far as the ledger is concerned, because nothing did.
    expect(await auditRows()).toEqual([])
  })

  it('raises the compensation it could not make, because only a human can fix that', async () => {
    const target = seedUser({
      banned: true,
      banReason: 'first offence',
      banExpires: new Date(Date.now() + 3 * 86_400_000),
    })
    vi.spyOn(getAuth().api, 'banUser').mockRejectedValue(
      new Error('D1_ERROR: database is locked'),
    )

    await expect(
      ban({ userId: target.id, reason: 'permanent' }),
    ).rejects.toThrow('D1_ERROR')

    expect(
      records().find(
        (record) =>
          record.msg === 'console could not restore the ban it cleared',
      ),
    ).toMatchObject({
      level: 'error',
      action: 'platform.user.banned',
      entityId: target.id,
      actorUserId: operatorId,
      actorRole: 'admin',
    })
  })

  it('audits the unban it could not undo, because a human changed that ban state', async () => {
    // The one branch of the two-step transition that leaves a state nobody asked for. When the
    // compensation succeeds the ledger stays empty, because the account ends banned as it was found
    // and nothing moved; when it fails the account is left *unbanned*, and docs/ACCESS.md §4.3
    // audits an unban without exception. `/admin/unban-user` sits in `SELF_AUDITING_BAN_PATHS` on
    // the stated grounds that this directory appends the human row, so nothing else will.
    const target = seedUser({
      banned: true,
      banReason: 'first offence',
      banExpires: new Date(Date.now() + 3 * 86_400_000),
    })
    vi.spyOn(getAuth().api, 'banUser').mockRejectedValue(
      new Error('D1_ERROR: database is locked'),
    )

    await expect(
      ban({ userId: target.id, reason: 'permanent' }),
    ).rejects.toThrow('D1_ERROR')

    // The state the operator is actually left with, and the row that says so.
    expect(userRow(target.id).banned).toBe(0)
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.user.unbanned',
      entityType: 'user',
      entityId: target.id,
      actorKind: 'human',
      actorUserId: operatorId,
      actorRole: 'admin',
      ip: OPERATOR_IP,
      userAgent: OPERATOR_UA,
    })
    expect(rows[0]?.changes?.before).toMatchObject({
      banned: true,
      banReason: 'first offence',
    })
    expect(rows[0]?.changes?.after).toMatchObject({
      banned: false,
      banReason: null,
      banExpiresAt: null,
    })
  })

  it('does not put back a ban the account was not under', async () => {
    // A leftover expiry on an account that is not banned. The plugin's own verbs cannot produce it —
    // `unbanUser` nulls all three columns together — but `/admin/update-user` writes the record
    // free-form and a `wrangler d1 execute` reaches the column directly. Keyed on the expiry alone,
    // the compensation would leave a *failed* ban having banned an account that was not banned:
    // strictly worse than the state it exists to prevent.
    const target = seedUser({
      banned: false,
      banExpires: new Date(Date.now() + 3 * 86_400_000),
    })
    const banSpy = vi
      .spyOn(getAuth().api, 'banUser')
      .mockRejectedValue(new Error('D1_ERROR: database is locked'))

    await expect(
      ban({ userId: target.id, reason: 'permanent' }),
    ).rejects.toThrow('D1_ERROR')

    // One attempt, the permanent ban that failed. No compensating second call.
    expect(banSpy).toHaveBeenCalledTimes(1)
    const row = userRow(target.id)
    expect(row.banned).toBe(0)
    expect(row.ban_expires).toBeNull()
    expect(
      records().find(
        (record) =>
          record.msg === 'console could not restore the ban it cleared',
      ),
    ).toBeUndefined()
    // The clearing write stands, a human made it, and §4.3 audits an unban without exception — and
    // the pair of payloads says what it really was: a stale expiry cleared, not a ban lifted.
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.user.unbanned',
      entityId: target.id,
      actorKind: 'human',
      actorUserId: operatorId,
      actorRole: 'admin',
    })
    expect(rows[0]?.changes?.before).toMatchObject({ banned: false })
    expect(rows[0]?.changes?.after).toMatchObject({
      banned: false,
      banExpiresAt: null,
    })
  })

  it('does not put back a ban that had already lapsed as a one-second one', async () => {
    // `banExpires` in the past is a ban the plugin lifts at the account's next sign-in
    // (`databaseHooks.session.create.before`), so the effective state is already "not banned" and
    // the remaining time is negative. Clamped to a second, as an earlier version did, the
    // compensation imposed a ban nobody ever asked for.
    const target = seedUser({
      banned: true,
      banReason: 'first offence',
      banExpires: new Date('2020-01-01T00:00:00.000Z'),
    })
    const banSpy = vi
      .spyOn(getAuth().api, 'banUser')
      .mockRejectedValue(new Error('D1_ERROR: database is locked'))

    await expect(
      ban({ userId: target.id, reason: 'permanent' }),
    ).rejects.toThrow('D1_ERROR')

    expect(banSpy).toHaveBeenCalledTimes(1)
    const row = userRow(target.id)
    expect(row.banned).toBe(0)
    expect(row.ban_expires).toBeNull()
    expect(row.ban_reason).toBeNull()
    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      action: 'platform.user.unbanned',
      entityId: target.id,
      actorKind: 'human',
    })
    expect(rows[0]?.changes?.before).toMatchObject({
      banned: true,
      banReason: 'first offence',
    })
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
  it('writes exactly one password row and puts the password nowhere in the ledger', async () => {
    const targetId = await seedAccountWithPassword('resettable@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    const secret = 'correct-horse-battery-staple-two'

    await setPassword({ userId: targetId, newPassword: secret })

    const rows = await rowsFor('platform.user.password_set')
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

  it('ends every session the account holds, and audits that separately', async () => {
    // The operator use case for this verb is a compromised account, and
    // `/admin/set-user-password` touches no session at all: it hashes, calls
    // `internalAdapter.updatePassword` and returns. `revokeSessionsOnPasswordReset` is set on this
    // product and is read only by the self-service reset route, so without this the attacker's
    // session survived the remediation on the old credential.
    const targetId = await seedAccountWithPassword('compromised@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    const victimJar = await jarFromSignIn('compromised@planned.travel')
    const [session] = sessionRows(targetId)
    // The state the whole chain is measured in: the index better-auth would have enumerated from
    // is gone, so nothing but this directory's own D1 read can name the blob.
    dropSessionIndex(targetId)

    await setPassword({ userId: targetId, newPassword: 'a-fresh-passphrase' })

    expect(sessionCount(targetId)).toBe(0)
    expect(kv().store.has(session.token)).toBe(false)
    expect(
      await authGet('/get-session', jarHeader(victimJar)).then((r) => r.json()),
    ).toBeNull()

    // Two actions happened, so two rows: §4.2 gives "every session of one account is revoked" its
    // own name under `session:revoke`, and folding it into the password row would hide a session
    // revocation from the §4.4 timeline that reads by `entity_type = 'session'`.
    const revoked = await rowsFor('platform.session.revoked_all')
    expect(revoked).toHaveLength(1)
    expect(revoked[0]).toMatchObject({
      entityType: 'session',
      entityId: null,
      actorKind: 'human',
      actorUserId: operatorId,
    })
    expect(revoked[0]?.changes?.before).toMatchObject({
      userId: targetId,
      sessions: 1,
    })
  })

  it('sets the credential last, after the revocation and after the row that records it', async () => {
    // The ordering *is* the handler. Everything that can reject runs while the account still holds
    // the credential it arrived with, so the credential write is the last statement in the call and
    // only `recordConsoleAction` — which never throws, and neither does `appendPlatformAudit`
    // beneath it — stands between it and its row.
    const targetId = await seedAccountWithPassword('ordered@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)

    const seen: Array<string> = []
    const realRevoke = getAuth().api.revokeUserSessions
    const realSet = getAuth().api.setUserPassword
    vi.spyOn(getAuth().api, 'revokeUserSessions').mockImplementation(
      async (options) => {
        seen.push(
          `revoke after ${(await rowsFor('platform.session.revoked_all')).length} row(s)`,
        )
        return realRevoke(options)
      },
    )
    vi.spyOn(getAuth().api, 'setUserPassword').mockImplementation(
      async (options) => {
        seen.push(
          `set after ${(await rowsFor('platform.session.revoked_all')).length} row(s)`,
        )
        return realSet(options)
      },
    )

    await setPassword({
      userId: targetId,
      newPassword: 'a-perfectly-ordinary-passphrase',
    })

    expect(seen).toEqual(['revoke after 0 row(s)', 'set after 1 row(s)'])
  })

  it('leaves the credential alone when the revocation rejects, rather than changing it unrecorded', async () => {
    // The failure this ordering exists for. With the credential written first, an ordinary transient
    // out of `revokeUserSessions` left the password changed, no `platform.user.password_set` row for
    // it anywhere, the target's sessions still live on the old credential, and the operator told the
    // call had failed — irreversible and invisible at once.
    const targetId = await seedAccountWithPassword('transient@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    const setSpy = vi.spyOn(getAuth().api, 'setUserPassword')
    vi.spyOn(getAuth().api, 'revokeUserSessions').mockRejectedValue(
      new Error('D1_ERROR: database is locked'),
    )
    const refused = 'a-passphrase-that-never-lands'

    await expect(
      setPassword({ userId: targetId, newPassword: refused }),
    ).rejects.toThrow('D1_ERROR')

    expect(setSpy).not.toHaveBeenCalled()
    expect(await rowsFor('platform.user.password_set')).toEqual([])
    expect(await rowsFor('platform.session.revoked_all')).toEqual([])
    // The account is exactly as it was found: the credential it arrived with still signs in, and the
    // one the operator asked for does not. Pressing the button again is the whole remedy.
    expect(
      await authPost('/sign-in/email', {
        email: 'transient@planned.travel',
        password: refused,
      }).then((r) => r.status),
    ).not.toBe(200)
    expect(
      await authPost('/sign-in/email', {
        email: 'transient@planned.travel',
        password: PASSWORD,
      }).then((r) => r.status),
    ).toBe(200)
  })

  it('sets the operator own password and signs them out with it', async () => {
    // The console offers this verb on the operator's own row deliberately
    // (`src/routes/_app/console/-ui/user-actions.tsx`): an operator who has left a session on a
    // machine they no longer control wants exactly this, and the copy says so in the first person.
    // A refusal here would make that affordance fail every time it was pressed.
    const secret = 'the-operator-own-new-passphrase'

    await setPassword({ userId: operatorId, newPassword: secret })

    // Both halves landed: the credential moved, and every session the operator held ended with it —
    // including the one that made the call.
    expect(
      await authPost('/sign-in/email', {
        email: OPERATOR_EMAIL,
        password: secret,
      }).then((response) => response.status),
    ).toBe(200)
    expect(
      await authPost('/sign-in/email', {
        email: OPERATOR_EMAIL,
        password: PASSWORD,
      }).then((response) => response.status),
    ).not.toBe(200)

    const password = await rowsFor('platform.user.password_set')
    expect(password).toHaveLength(1)
    expect(password[0]).toMatchObject({
      entityId: operatorId,
      actorKind: 'human',
      actorUserId: operatorId,
      actorRole: 'admin',
    })
    const revoked = await rowsFor('platform.session.revoked_all')
    expect(revoked).toHaveLength(1)
    expect(revoked[0]?.changes?.before).toMatchObject({
      userId: operatorId,
      sessions: 1,
    })
    expect(await ledgerText()).not.toContain(secret)
  })

  it('writes the operator own credential first, because the revocation ends the call otherwise', async () => {
    // The one target on which the handler's usual order cannot run. Reversed, the credential write
    // still carries its own row as its next statement, so REPAIR 57's invariant holds either way:
    // no step that can reject stands between a committed credential change and its ledger row.
    const seen: Array<string> = []
    const realRevoke = getAuth().api.revokeUserSessions
    const realSet = getAuth().api.setUserPassword
    vi.spyOn(getAuth().api, 'revokeUserSessions').mockImplementation(
      async (options) => {
        seen.push(
          `revoke after ${(await rowsFor('platform.user.password_set')).length} row(s)`,
        )
        return realRevoke(options)
      },
    )
    vi.spyOn(getAuth().api, 'setUserPassword').mockImplementation(
      async (options) => {
        seen.push(
          `set after ${(await rowsFor('platform.user.password_set')).length} row(s)`,
        )
        return realSet(options)
      },
    )

    await setPassword({
      userId: operatorId,
      newPassword: 'a-perfectly-ordinary-passphrase',
    })

    expect(seen).toEqual(['set after 0 row(s)', 'revoke after 1 row(s)'])
  })

  it('cannot write its own credential after revoking its own session, which is why that order is reversed', async () => {
    // The measurement behind the reversal, taken against `better-auth@1.7.1` rather than argued from
    // the handler. `/admin/set-user-password` runs behind `adminMiddleware`, which re-resolves the
    // caller from `headers` on entry — so once the revocation has deleted the operator's own session
    // row and its blob, the credential write answers `UNAUTHORIZED`: signed out of every device,
    // told the call failed, password unchanged.
    const headers = new Headers({ cookie: jarHeader(callerJar) })

    await getAuth().api.revokeUserSessions({
      body: { userId: operatorId },
      headers,
    })

    const failure = await getAuth()
      .api.setUserPassword({
        body: { userId: operatorId, newPassword: 'a-passphrase-that-cannot' },
        headers,
      })
      .catch((cause: unknown) => cause)

    expect(failure).toBeInstanceOf(Error)
    expect(failure).toMatchObject({ status: 'UNAUTHORIZED' })
    expect(
      await authPost('/sign-in/email', {
        email: OPERATOR_EMAIL,
        password: 'a-passphrase-that-cannot',
      }).then((response) => response.status),
    ).not.toBe(200)
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
    const line = records().find((record) => record.read === 'users')
    expect(line).toBeDefined()
    expect(line?.total).toBeGreaterThan(0)
    expect(line?.returned).toBeGreaterThan(0)
  })

  it('reads one account without auditing it', async () => {
    const target = seedUser({ name: 'Readable' })
    await getUser({ userId: target.id })
    expect(await auditRows()).toEqual([])
    expect(records().some((record) => record.read === 'user')).toBe(true)
  })

  it('never gives a read a field shaped like an audit action', async () => {
    // docs/ACCESS.md §4.2 closes the action vocabulary at thirty-one names and says in as many words
    // that reads are not audited. `platform.user.list`, `platform.user.get` and
    // `platform.session.list` are not in that list and never can be, so they may not appear in the
    // one log field an operational view reads as an action. They are log fields; they carry `read`.
    const target = await seedAccountWithPassword('readable@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)

    await listUsers({})
    await getUser({ userId: target })
    await listSessions({ userId: target })

    const reads = records().filter((record) => record.read !== undefined)
    expect(reads.map((record) => record.read)).toEqual([
      'users',
      'user',
      'sessions',
    ])
    for (const record of reads) {
      expect(record.action).toBeUndefined()
    }
    expect(JSON.stringify(records())).not.toContain('platform.user.list')
    expect(JSON.stringify(records())).not.toContain('platform.user.get')
    expect(JSON.stringify(records())).not.toContain('platform.session.list')
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

describe('deleting an account that owns a workspace', () => {
  it('refuses the sole owner of a workspace other people belong to, and changes nothing', async () => {
    const targetId = await seedAccountWithPassword('founder@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    await jarFromSignIn('founder@planned.travel')
    const colleague = seedUser({
      name: 'Colleague Secret',
      email: 'colleague-secret@planned.travel',
    })
    const team = seedWorkspace('Acme Travel')
    seedMember(team, targetId, 'owner')
    seedMember(team, colleague.id, 'member')
    const memberships = memberCount(targetId)
    const removeUser = vi.spyOn(getAuth().api, 'removeUser')
    kv().deleted.length = 0

    const refusal: unknown = await deleteUser({ userId: targetId }).catch(
      (cause: unknown) => cause,
    )

    expect(refusal).toMatchObject({
      name: 'ConsoleActionError',
      code: 'target-sole-owner',
      status: 409,
    })
    const message = (refusal as Error).message
    expect(message).toContain('Acme Travel')
    expect(message).toMatch(/promote another member to owner/i)
    expect(message).toMatch(/suspend/i)
    // The operator is in the platform console, which has no role action: the promotion is an
    // owner's act, in that workspace's own console, and the sentence must not order the operator to it.
    expect(message).toContain('Workspace console')
    expect(message).not.toMatch(/(^|\. )Promote/)
    for (const secret of [colleague.id, colleague.name, colleague.email]) {
      expect(message).not.toContain(secret)
    }

    expect(userExists(targetId)).toBe(true)
    expect(memberCount(targetId)).toBe(memberships)
    expect(memberCount(colleague.id)).toBe(1)
    expect(sessionRows(targetId)).toHaveLength(1)
    expect(kv().deleted).toEqual([])
    expect(removeUser).not.toHaveBeenCalled()
    expect(await auditRows()).toEqual([])
    const logged = JSON.stringify(records())
    for (const secret of [colleague.id, colleague.name, colleague.email]) {
      expect(logged).not.toContain(secret)
    }
  })

  it('names every workspace the account would strand, and no other', async () => {
    const target = seedUser()
    const other = seedUser()
    const stranded = seedWorkspace('Stranded One')
    const alsoStranded = seedWorkspace('Stranded Two')
    const coOwned = seedWorkspace('Shared Ownership')
    for (const id of [stranded, alsoStranded, coOwned]) {
      seedMember(id, target.id, 'owner')
      seedMember(id, other.id, id === coOwned ? 'owner' : 'member')
    }

    const refusal: unknown = await deleteUser({ userId: target.id }).catch(
      (cause: unknown) => cause,
    )

    const message = (refusal as Error).message
    expect(message).toContain('Stranded One')
    expect(message).toContain('Stranded Two')
    expect(message).not.toContain('Shared Ownership')
  })

  it('deletes the only member of their own workspace, as before', async () => {
    const target = seedUser()
    const personal = seedWorkspace('Personal')
    seedMember(personal, target.id, 'owner')

    await deleteUser({ userId: target.id })

    expect(userExists(target.id)).toBe(false)
    expect(await rowsFor('platform.user.deleted')).toHaveLength(1)
  })

  it('deletes one of two owners', async () => {
    const target = seedUser()
    const coOwner = seedUser()
    const team = seedWorkspace('Two Owners')
    seedMember(team, target.id, 'owner')
    seedMember(team, coOwner.id, 'owner')

    await deleteUser({ userId: target.id })

    expect(userExists(target.id)).toBe(false)
    expect(memberCount(coOwner.id)).toBe(1)
  })

  it('does not let the owners of one workspace stand in for the owners of another', async () => {
    const target = seedUser()
    const other = seedUser()
    const stranded = seedWorkspace('Workspace A')
    const covered = seedWorkspace('Workspace B')
    seedMember(stranded, target.id, 'owner')
    seedMember(stranded, other.id, 'member')
    seedMember(covered, target.id, 'owner')
    seedMember(covered, other.id, 'owner')

    await expect(deleteUser({ userId: target.id })).rejects.toMatchObject({
      code: 'target-sole-owner',
    })
    expect(userExists(target.id)).toBe(true)
  })

  it('deletes a plain member of somebody else’s workspace', async () => {
    const target = seedUser()
    const owner = seedUser()
    const team = seedWorkspace('Not Theirs')
    seedMember(team, owner.id, 'owner')
    seedMember(team, target.id, 'member')

    await deleteUser({ userId: target.id })

    expect(userExists(target.id)).toBe(false)
    expect(memberCount(owner.id)).toBe(1)
  })

  it('finds the stranded workspace past the console’s display limit', async () => {
    const target = seedUser()
    const other = seedUser()
    for (let index = 0; index < MEMBERSHIP_LIMIT + 3; index += 1) {
      seedMember(seedWorkspace(`Filler ${index}`), target.id, 'member')
    }
    const last = seedWorkspace('The Last One')
    seedMember(last, target.id, 'owner')
    seedMember(last, other.id, 'member')

    await expect(deleteUser({ userId: target.id })).rejects.toMatchObject({
      code: 'target-sole-owner',
    })
    expect(userExists(target.id)).toBe(true)
  })

  it('refuses rather than guess when the memberships cannot be read in full', async () => {
    const target = seedUser()
    const personal = seedWorkspace('Only Mine')
    seedMember(personal, target.id, 'owner')
    // One full page of memberships: the read answers "could not tell", and so does the refusal.
    for (let index = 0; index < OWNERSHIP_READ_LIMIT; index += 1) {
      seedMember(seedWorkspace(`Crowd ${index}`), target.id, 'member')
    }

    await expect(deleteUser({ userId: target.id })).rejects.toMatchObject({
      code: 'target-beyond-cap',
    })
    expect(userExists(target.id)).toBe(true)
    expect(await auditRows()).toEqual([])
  })

  it('counts a comma-joined role the way the plugin does', async () => {
    const target = seedUser()
    const other = seedUser()
    const team = seedWorkspace('Comma Roles')
    seedMember(team, target.id, 'admin,owner')
    seedMember(team, other.id, 'member')

    await expect(deleteUser({ userId: target.id })).rejects.toMatchObject({
      code: 'target-sole-owner',
    })

    // And the other direction: a second owner who holds the role among others is an owner.
    authDatabase.sqlite
      .prepare('update member set role = ? where user_id = ?')
      .run('admin, owner', other.id)
    await deleteUser({ userId: target.id })
    expect(userExists(target.id)).toBe(false)
  })

  it('does not take a role that merely contains owner for an owner', async () => {
    const target = seedUser()
    const other = seedUser()
    const team = seedWorkspace('Lookalike')
    seedMember(team, target.id, 'owner')
    seedMember(team, other.id, 'co-owner')

    await expect(deleteUser({ userId: target.id })).rejects.toMatchObject({
      code: 'target-sole-owner',
    })
  })
})

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

    // As on the ban path: the blobs go first, because `revokeUserSessions` deletes every D1
    // `session` row by predicate and a blob left behind after that is one nothing can name again.
    // The two index deletes at the tail are the plugin's (it could not read the key it removed) and
    // ours behind it.
    expect([...kv().deleted.slice(0, 2)].sort()).toEqual([...tokens].sort())
    expect(kv().deleted.slice(2)).toEqual([
      `active-sessions-${targetId}`,
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

    const line = records().find((record) => record.read === 'sessions')
    expect(line?.returned).toBe(1)

    const throughThePlugin = await getAuth().api.listUserSessions({
      body: { userId: targetId },
      headers: new Headers({ cookie: jarHeader(callerJar) }),
    })
    expect(throughThePlugin.sessions).toEqual([])
  })

  it('walks past a single page rather than stopping at it', async () => {
    // The read used to be one `limit: 200` with no `ORDER BY`. Session 201 was then invisible: a
    // ban left its cached blob live and a revoke-by-id reported it as already ended.
    const target = seedUser()
    const rows = seedSessionRows(target.id, 250)

    await ban({ userId: target.id, reason: 'abuse' })

    for (const row of rows) {
      expect(kv().store.has(row.token)).toBe(false)
    }
    expect(kv().deleted).toContain(rows[249].token)
    expect(
      records().find(
        (record) => record.msg === 'console ban left session keys behind',
      ),
    ).toBeUndefined()
  })

  it('reports an account past the ceiling as truncated instead of silently short', async () => {
    const target = seedUser()
    seedSessionRows(target.id, SESSION_LIST_CEILING + 1)

    await listSessions({ userId: target.id })

    const line = records().find((record) => record.read === 'sessions')
    expect(line).toMatchObject({
      returned: SESSION_LIST_CEILING,
      truncated: true,
    })
  })

  it('refuses a session beyond the ceiling instead of calling it ended', async () => {
    const target = seedUser()
    const rows = seedSessionRows(target.id, SESSION_LIST_CEILING + 1)
    // Ordered by id, so the last row seeded is the one that sorts past the ceiling.
    const beyond = rows[SESSION_LIST_CEILING]

    await expect(
      revokeSession({ userId: target.id, sessionId: beyond.id }),
    ).rejects.toMatchObject({ code: 'target-beyond-cap' })

    // Still live, and still said to be live: the refusal is the point, and so is the row surviving.
    expect(sessionRows(target.id).some((row) => row.id === beyond.id)).toBe(
      true,
    )
    expect(await auditRows()).toEqual([])
  })

  it('still revokes a session the enumeration did reach', async () => {
    const target = seedUser()
    const rows = seedSessionRows(target.id, SESSION_LIST_CEILING + 1)

    await revokeSession({ userId: target.id, sessionId: rows[0].id })

    expect(sessionRows(target.id).some((row) => row.id === rows[0].id)).toBe(
      false,
    )
    expect(await rowsFor('platform.session.revoked')).toHaveLength(1)
  })

  it('purges past the list ceiling, because a ban that truncates loses those tokens for ever', async () => {
    // The defect this replaced, and the reason it could not be fixed by raising a number. The purge
    // used to stop at the list ceiling, announce `truncated` and carry on with the ban — after which
    // `banUser` deleted every D1 `session` row and the index key went with them, so the surplus
    // blobs were not merely live, they were unnameable: no later ban, no revoke-all and no manual
    // retry could reach them, `findSession` kept resolving each one from its `banned: false`
    // snapshot, and `updateAge` re-cached it. The list has a ceiling; the purge does not.
    const target = seedUser()
    const rows = seedSessionRows(target.id, SESSION_LIST_CEILING + 1)
    const beyond = rows[SESSION_LIST_CEILING]

    await ban({ userId: target.id, reason: 'abuse' })

    for (const row of rows) {
      expect(kv().store.has(row.token)).toBe(false)
    }
    expect(kv().deleted).toContain(beyond.token)
    expect(userRow(target.id).banned).toBe(1)
    expect(await rowsFor('platform.user.banned')).toHaveLength(1)
    expect(records().find((record) => record.level === 'error')).toBeUndefined()
  })

  it('refuses the ban outright when a session blob will not go, and changes nothing', async () => {
    // The other half of the same property. A purge that cannot finish must not be carried into the
    // mutation: once `banUser` has run, the D1 rows naming the surviving token are gone. Refusing
    // leaves the account exactly as it was found — no worse off than a second ago, every token
    // still named in D1, and an error the operator can act on by pressing the button again.
    const target = seedUser()
    const rows = seedSessionRows(target.id, 3)
    kv().failing.add(rows[1].token)

    await expect(
      ban({ userId: target.id, reason: 'abuse' }),
    ).rejects.toMatchObject({ code: 'sessions-still-cached' })

    expect(userRow(target.id).banned).toBe(0)
    expect(sessionCount(target.id)).toBe(3)
    expect(kv().store.has(rows[1].token)).toBe(true)
    expect(await auditRows()).toEqual([])
    // A session token is the credential. The incident line carries three counts and never a key.
    expect(JSON.stringify(records())).not.toContain(rows[1].token)
    expect(
      records().find(
        (record) =>
          record.msg === 'console could not clear the target session cache',
      ),
    ).toMatchObject({
      level: 'error',
      action: 'platform.user.banned',
      entityId: target.id,
      actorUserId: operatorId,
      actorRole: 'admin',
    })
  })

  it('leaves an expired session row out of the list and out of the count', async () => {
    // With `storeSessionInDatabase` a row is deleted only lazily, on the next `findSession` that
    // resolves it, so an account accumulates one for every device it never returns to. Without the
    // expiry predicate the console reported those as live and `platform.session.revoked` could be
    // written for a session that ended weeks ago.
    const target = seedUser()
    const [live] = seedSessionRows(target.id, 1)
    const expired = seedExpiredSessionRow(target.id)

    await listSessions({ userId: target.id })

    expect(
      records().find((record) => record.read === 'sessions'),
    ).toMatchObject({ returned: 1 })

    await expect(
      revokeSession({ userId: target.id, sessionId: expired.id }),
    ).rejects.toMatchObject({ code: 'target-not-found' })
    expect(await auditRows()).toEqual([])

    await revokeSession({ userId: target.id, sessionId: live.id })
    expect(await rowsFor('platform.session.revoked')).toHaveLength(1)
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

  it('records the workspace the impersonated session starts in, as an id and nothing else', async () => {
    const worn = seedUser()
    const team = seedWorkspace('Acme Travel')
    seedMember(team, worn.id, 'owner')

    await impersonate({ userId: worn.id })

    const landed = authDatabase.sqlite
      .prepare(
        'select active_organization_id as id from session where user_id = ?',
      )
      .get(worn.id) as { id: string | null }
    expect(landed.id).toBe(team)

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.changes?.after?.organizationId).toBe(team)
    expect(JSON.stringify(rows[0]?.changes)).not.toContain('Acme Travel')
  })

  it('records the same workspace the session row carries when the account had none', async () => {
    const worn = seedUser()

    await impersonate({ userId: worn.id })

    const landed = authDatabase.sqlite
      .prepare(
        'select active_organization_id as id from session where user_id = ?',
      )
      .get(worn.id) as { id: string | null }
    const rows = await auditRows()
    expect(landed.id).not.toBeNull()
    expect(rows[0]?.changes?.after?.organizationId).toBe(landed.id)
  })

  it('records null, and still starts, when the plugin body carries no landing workspace', async () => {
    const worn = seedUser()
    // The call is made with `returnHeaders: true`, so the real answer is `{ headers, response }`;
    // the declared overload does not say so.
    interface WithHeaders {
      headers: Headers
      response: { session: Record<string, unknown> }
    }
    const realImpersonate = getAuth().api.impersonateUser as unknown as (
      options: unknown,
    ) => Promise<WithHeaders>
    vi.spyOn(getAuth().api, 'impersonateUser').mockImplementation((async (
      options: unknown,
    ) => {
      const result = await realImpersonate(options)
      const { activeOrganizationId: _landed, ...session } =
        result.response.session
      return { ...result, response: { ...result.response, session } }
    }) as never)

    await impersonate({ userId: worn.id })

    const rows = await auditRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.changes?.after?.organizationId).toBeNull()
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

  it('forwards nothing when the plugin body cannot be read, rather than swapping the session behind an error', async () => {
    // The failure the parse-before-forward order exists for. TanStack merges whatever
    // `setResponseHeader` put on the event onto the response it builds — an error response included
    // — so cookies forwarded before the body was known good land the operator *inside* the
    // impersonated session while the screen reports the failure, and docs/ACCESS.md §4.3's
    // "audited without exception" is false for a session that is live for the next fifteen minutes.
    const worn = seedUser({ name: 'Unreadable Body' })
    const real = getAuth().api.impersonateUser
    vi.spyOn(getAuth().api, 'impersonateUser').mockImplementation(
      async (options) => {
        const result = await real(options)
        // A body the boundary schema cannot read, with the real `Set-Cookie` set beside it: version
        // skew in the dependency, which is the whole reason the response is parsed at all.
        const { headers, response } = result as unknown as {
          headers: Headers
          response: Record<string, unknown>
        }
        // Two casts through `unknown`, once each way, because the endpoint's declared return type
        // is the bare body: `returnHeaders: true` is resolved at runtime from the argument, not in
        // the type, so the shape the handler actually receives is unrepresentable here.
        return {
          headers,
          response: { ...response, session: null },
        } as unknown as Awaited<ReturnType<typeof real>>
      },
    )

    const attempt = await attemptDuringRequest(async () => {
      await startImpersonationFn({ data: { userId: worn.id } })
    })

    expect(attempt.failures).toHaveLength(1)
    // Not one value, and the plugin really did set six of them on the result this call discarded.
    expect(attempt.response.headers.getSetCookie()).toEqual([])
    expect(await auditRows()).toEqual([])
    // The operator's own cookies are untouched, so the browser is still the operator.
    const still = await authGet('/get-session', jarHeader(callerJar))
    const body: { user: { id: string } } | null = await still.json()
    expect(body?.user.id).toBe(operatorId)
  })

  it('ends an impersonation, restoring the operator session and naming them as the actor', async () => {
    const worn = seedUser({ role: 'curator' })
    const started = await impersonate({ userId: worn.id })
    // The impersonated cookies are the caller's now, exactly as they would be in the browser.
    const wornJar = applyCookies(new Map(callerJar), started)
    callerJar = wornJar

    const response = await endImpersonation()

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

  it('appends the row before it calls the plugin, which is the order §6.1 specifies', async () => {
    const worn = seedUser({ role: 'curator' })
    const started = await impersonate({ userId: worn.id })
    callerJar = applyCookies(new Map(callerJar), started)

    // Read synchronously the instant the plugin call is entered. `node:sqlite` is synchronous, so
    // this is the ledger as it stood at that moment and not a moment either side of it.
    let ledgerWhenTheExitBegan = -1
    shared.onStopImpersonating.current = () => {
      const row = tables()
        .sqlite.prepare(
          "select count(*) as n from platform_audit_log where action = 'platform.user.impersonation_ended'",
        )
        .get() as { n: number }
      ledgerWhenTheExitBegan = row.n
    }

    await endImpersonation()

    // docs/ACCESS.md §6.1 and §2.6 both write this half of the lifecycle as "appends
    // `platform.user.impersonation_ended` and then calls `auth.api.stopImpersonating` in process".
    // Appending afterwards loses the entry exactly when the exit is the thing being investigated.
    expect(ledgerWhenTheExitBegan).toBe(1)
    expect(await rowsFor('platform.user.impersonation_ended')).toHaveLength(1)
  })

  it('refuses to end an impersonation on an ordinary session', async () => {
    await expect(endImpersonation()).rejects.toMatchObject({
      code: 'not-impersonating',
    })
    expect(await auditRows()).toEqual([])
  })

  it('refuses to end an impersonation it cannot attribute, rather than recording the operator as a plain account', async () => {
    const worn = seedUser({ role: 'curator' })
    const started = await impersonate({ userId: worn.id })
    callerJar = applyCookies(new Map(callerJar), started)

    const stopSpy = vi.spyOn(getAuth().api, 'stopImpersonating')
    shared.roleReadRejects.current = true

    await expect(endImpersonation()).rejects.toBeInstanceOf(
      ConsoleUnattributableError,
    )

    // The append comes first on this path, so a refusal that happened after it would have left a
    // row behind. It must not: `resolvePlatformRole(null)` is `'user'`, and a row saying an
    // `admin`'s exit was performed by a `user` is a fact nothing can re-derive later
    // (docs/ACCESS.md §4.1 records `actor_role` as a value for exactly that reason).
    expect(await rowsFor('platform.user.impersonation_ended')).toEqual([])
    expect(stopSpy).not.toHaveBeenCalled()
  })

  it('raises a line naming the action, the actor and the entity when it cannot read the role', async () => {
    const worn = seedUser({ role: 'curator' })
    const started = await impersonate({ userId: worn.id })
    callerJar = applyCookies(new Map(callerJar), started)
    shared.roleReadRejects.current = true

    await endImpersonation().catch(() => undefined)

    const incident = records().find(
      (record) =>
        record.msg ===
        'console could not read the platform role of the operator ending an impersonation',
    )
    expect(incident?.level).toBe('error')
    expect(incident).toMatchObject({
      action: 'platform.user.impersonation_ended',
      actorUserId: operatorId,
      actorKind: 'human',
      entityId: worn.id,
      reason: 'unreadable',
    })
  })

  it('refuses to end an impersonation with no session at all', async () => {
    callerJar = new Map()
    await expect(endImpersonation()).rejects.toBeInstanceOf(
      AuthRequirementError,
    )
  })

  it('refuses any payload at the boundary', () => {
    // A client that names a target is trying to end somebody else's impersonation. The exit takes
    // no argument at all, and the validator is what says so.
    expect(() => endImpersonationInputSchema.parse({})).not.toThrow()
    expect(() =>
      endImpersonationInputSchema.parse({ userId: 'someone-else' }),
    ).toThrow()
  })
})

/* ------------------------------------------- impersonated session expiry (#1358) */

describe('impersonated session expiry (docs/ACCESS.md §6.2)', () => {
  const IMPERSONATION_MS = IMPERSONATION_SESSION_SECONDS * 1000
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

  /** Where the impersonated session lives, in both stores Better Auth reads it from. */
  function storedSession(userId: string): {
    token: string
    expiresAt: number
    createdAt: number
  } {
    const row = authDatabase.sqlite
      .prepare(
        'select token, expires_at, created_at from session where user_id = ?',
      )
      .get(userId) as { token: string; expires_at: number; created_at: number }
    return {
      token: row.token,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }
  }

  function rewriteSession(
    token: string,
    patch: { expiresAt?: number; createdAt?: number },
  ): void {
    const columns: Array<string> = []
    const values: Array<number> = []
    if (patch.expiresAt !== undefined) {
      columns.push('expires_at = ?')
      values.push(patch.expiresAt)
    }
    if (patch.createdAt !== undefined) {
      columns.push('created_at = ?')
      values.push(patch.createdAt)
    }
    authDatabase.sqlite
      .prepare(`update session set ${columns.join(', ')} where token = ?`)
      .run(...values, token)

    const blob = kv().store.get(token)
    if (blob === undefined) return
    const parsed = JSON.parse(blob) as { session: Record<string, unknown> }
    if (patch.expiresAt !== undefined) {
      parsed.session.expiresAt = new Date(patch.expiresAt).toISOString()
    }
    if (patch.createdAt !== undefined) {
      parsed.session.createdAt = new Date(patch.createdAt).toISOString()
    }
    kv().store.set(token, JSON.stringify(parsed))
  }

  /** The cookies the operator's browser holds right after "Impersonate". */
  async function impersonationJar(userId: string): Promise<CookieJar> {
    return applyCookies(new Map(), await impersonate({ userId }))
  }

  /** The same token as a client that leaves out the `dont_remember` marker. */
  function withoutMarker(jar: CookieJar): CookieJar {
    const copy = new Map(jar)
    copy.delete('planned.dont_remember')
    return copy
  }

  function sessionTokenCookies(response: Response): Array<string> {
    return response.headers
      .getSetCookie()
      .filter((entry) => entry.startsWith('planned.session_token='))
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the expiry put when the token is read without the don’t-remember cookie', async () => {
    const worn = seedUser()
    const jar = await impersonationJar(worn.id)
    const before = storedSession(worn.id)
    const ttlBefore = kv().ttls.get(before.token) ?? 0

    const response = await authGet(
      '/get-session',
      jarHeader(withoutMarker(jar)),
    )

    const body: { session: { expiresAt: string } } | null =
      await response.json()
    expect(new Date(String(body?.session.expiresAt)).getTime()).toBe(
      before.expiresAt,
    )
    expect(storedSession(worn.id).expiresAt).toBe(before.expiresAt)
    const blob: { session: { expiresAt: string } } = JSON.parse(
      kv().store.get(before.token) ?? '{}',
    )
    expect(new Date(blob.session.expiresAt).getTime()).toBe(before.expiresAt)
    // The TTL counts down with the clock; the bug made it 30 days.
    const ttlAfter = kv().ttls.get(before.token) ?? Infinity
    expect(ttlAfter).toBeLessThanOrEqual(ttlBefore)
    expect(ttlAfter).toBeGreaterThan(ttlBefore - 10)
    // No `Set-Cookie` may hand the token a longer life than its row has.
    expect(sessionTokenCookies(response)).toEqual([])
  })

  it('leaves the expiry alone on the cookie-present path a browser takes', async () => {
    const worn = seedUser()
    const jar = await impersonationJar(worn.id)
    const before = storedSession(worn.id)

    const response = await authGet('/get-session', jarHeader(jar))

    expect(response.status).toBe(200)
    expect(storedSession(worn.id).expiresAt).toBe(before.expiresAt)
    expect(sessionTokenCookies(response)).toEqual([])
  })

  it('refuses the session on the server-side read once 900 seconds have passed', async () => {
    const worn = seedUser()
    const jar = await impersonationJar(worn.id)
    // The probe: before the fix this read pushed the row 30 days out.
    await authGet('/get-session', jarHeader(withoutMarker(jar)))

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + IMPERSONATION_MS + 1000)
    callerJar = jar
    let seen: unknown = 'unread'
    await duringRequest(async () => {
      seen = await getSession()
    })

    expect(seen).toBeNull()
  })

  it('refuses a row that was already extended before the fix shipped', async () => {
    const worn = seedUser()
    const jar = await impersonationJar(worn.id)
    const { token } = storedSession(worn.id)
    rewriteSession(token, {
      createdAt: Date.now() - IMPERSONATION_MS - 60_000,
      expiresAt: Date.now() + THIRTY_DAYS_MS,
    })

    callerJar = jar
    let seen: unknown = 'unread'
    await duringRequest(async () => {
      seen = await getSession()
    })

    expect(seen).toBeNull()
  })

  it('drops an extension that arrives with no endpoint to resolve the session from', async () => {
    const worn = seedUser()
    await impersonationJar(worn.id)
    const before = storedSession(worn.id)

    await (
      await getAuth().$context
    ).internalAdapter.updateSession(before.token, {
      expiresAt: new Date(Date.now() + THIRTY_DAYS_MS),
    })

    expect(storedSession(worn.id).expiresAt).toBe(before.expiresAt)
  })

  it('ends a row extended before the fix on the library’s own endpoints', async () => {
    const worn = seedUser()
    const organizationId = seedWorkspace('Second workspace')
    seedMember(organizationId, worn.id, 'member')
    const jar = await impersonationJar(worn.id)
    const { token } = storedSession(worn.id)
    rewriteSession(token, {
      createdAt: Date.now() - IMPERSONATION_MS - 60_000,
      expiresAt: Date.now() + THIRTY_DAYS_MS,
    })

    const read = await authGet('/get-session', jarHeader(withoutMarker(jar)))
    expect(await read.json()).toBeNull()
    expect(sessionCount(worn.id)).toBe(0)
    expect(kv().store.has(token)).toBe(false)

    const rewrittenAgain = await impersonationJar(worn.id)
    const second = storedSession(worn.id)
    rewriteSession(second.token, {
      createdAt: Date.now() - IMPERSONATION_MS - 60_000,
      expiresAt: Date.now() + THIRTY_DAYS_MS,
    })
    const switched = await authPost(
      '/organization/set-active',
      { organizationId },
      jarHeader(rewrittenAgain),
    )
    expect(switched.status).toBe(401)
    expect(sessionCount(worn.id)).toBe(0)
  })

  it('still slides an ordinary session to 30 days once it is past the update age', async () => {
    await seedAccountWithPassword('ordinary@planned.travel')
    const jar = await jarFromSignIn('ordinary@planned.travel')
    const row = authDatabase.sqlite
      .prepare('select token from session order by created_at desc limit 1')
      .get() as { token: string }
    rewriteSession(row.token, { expiresAt: Date.now() + 28 * 86_400_000 })

    await authGet('/get-session', jarHeader(jar))

    const refreshed = authDatabase.sqlite
      .prepare('select expires_at from session where token = ?')
      .get(row.token) as { expires_at: number }
    expect(refreshed.expires_at).toBeGreaterThan(Date.now() + 29 * 86_400_000)
  })

  it('still lets an impersonated session switch workspace', async () => {
    const worn = seedUser()
    const organizationId = seedWorkspace('Second workspace')
    seedMember(organizationId, worn.id, 'member')
    const jar = await impersonationJar(worn.id)
    const before = storedSession(worn.id)

    const response = await authPost(
      '/organization/set-active',
      { organizationId },
      jarHeader(withoutMarker(jar)),
    )

    expect(response.status).toBe(200)
    const row = authDatabase.sqlite
      .prepare('select active_organization_id from session where token = ?')
      .get(before.token) as { active_organization_id: string }
    expect(row.active_organization_id).toBe(organizationId)
    expect(storedSession(worn.id).expiresAt).toBe(before.expiresAt)
  })
})

/* ------------------------------------------------------------ observability */

describe('every function emits a structured log line', () => {
  it('names its action on at least one record, and a read names its noun', async () => {
    // SPEC §5: "every server function emits structured logs". A read has no audit row, so the line
    // is the only trace it leaves — and a mutation whose line is missing is a mutation nobody can
    // correlate with the request that made it. A read carries `read` rather than `action`, because
    // docs/ACCESS.md §4.2's action list is closed and a read is not in it.
    const target = seedUser({ role: 'curator' })
    const otherId = await seedAccountWithPassword('other@planned.travel')
    callerJar = await jarFromSignIn(OPERATOR_EMAIL)
    await jarFromSignIn('other@planned.travel')
    const [session] = sessionRows(otherId)
    const worn = seedUser()

    const reads: Array<[string, () => Promise<unknown>]> = [
      ['users', () => listUsers({})],
      ['user', () => getUser({ userId: target.id })],
      ['sessions', () => listSessions({ userId: otherId })],
    ]

    for (const [read, run] of reads) {
      const before = records().length
      await run()
      const emitted = records()
        .slice(before)
        .filter((record) => record.read === read)
      expect({ read, emitted: emitted.length > 0 }).toEqual({
        read,
        emitted: true,
      })
    }

    const cases: Array<[string, () => Promise<unknown>]> = [
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
    await endImpersonation()
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
      // A ban is one of the five verbs docs/ACCESS.md §4.3 audits without exception, so it is
      // attempted twice before the incident is raised.
      attempts: 2,
    })
  })
})
