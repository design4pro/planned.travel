/**
 * An in-memory Better Auth instance driven over its real HTTP handler, shared by the passkey
 * endpoint suites (tickets 09-S1a, b and c).
 *
 * `vi.mock` is hoisted per test file, so the three module mocks the instance needs (`env`, `db`,
 * `email`) stay in the suite and are written the way `../../__tests__/auth-handler-closure.test.ts`
 * writes them. Everything that does not need hoisting lives here: the SQLite database behind the
 * Drizzle proxy driver, real cookies from a real sign-in, and row-level helpers that move a session
 * into the state a test needs (impersonated, old) by editing the row and dropping the KV snapshot
 * Better Auth would otherwise answer from.
 */
import { DatabaseSync } from 'node:sqlite'
import {
  generateSQLiteDrizzleJson,
  generateSQLiteMigration,
} from 'drizzle-kit/api'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { expect } from 'vitest'
import { authSchema } from '#/server/db/auth-schema'
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'

export const BASE_URL = 'http://localhost:3000'
export const AUTH_BASE = `${BASE_URL}/api/auth`
export const PASSWORD = 'correct-horse-battery-staple'

/** The value types `node:sqlite` accepts as a bound parameter. */
type SqliteValue = null | number | bigint | string | Uint8Array

export type AuthDatabase = SqliteRemoteDatabase<typeof authSchema>

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

/** A migrated, empty in-memory database and the Drizzle handle `authDb()` is mocked to return. */
export async function openAuthDatabase(): Promise<{
  sqlite: DatabaseSync
  database: AuthDatabase
}> {
  const statements = await generateSQLiteMigration(
    await generateSQLiteDrizzleJson({}),
    await generateSQLiteDrizzleJson(authSchema),
  )
  const sqlite = new DatabaseSync(':memory:')
  for (const statement of statements) sqlite.exec(statement)

  const database = drizzle(
    async (query, params, method) =>
      runStatement(sqlite, query, params, method),
    async (queries) =>
      queries.map((entry) =>
        runStatement(sqlite, entry.sql, entry.params, entry.method),
      ),
    { schema: authSchema },
  )
  return { sqlite, database }
}

/** What a request can carry beyond its body. */
export type RequestOptions = {
  readonly cookie?: string
  readonly headers?: Record<string, string>
}

export type SeededPasskey = {
  readonly id: string
  readonly name?: string | null
  readonly createdAt?: Date
}

type HarnessOptions = {
  readonly sqlite: DatabaseSync
  /** The handler of the instance under test, resolved lazily so mocks are in place first. */
  readonly handler: () => (request: Request) => Promise<Response>
  /** The in-memory KV behind `sessionStore()`; cleared whenever a row is edited under it. */
  readonly kv: Map<string, string>
}

export function createAuthHarness({ sqlite, handler, kv }: HarnessOptions) {
  function post(
    path: string,
    body: unknown,
    { cookie, headers: extra }: RequestOptions = {},
  ): Promise<Response> {
    const headers = new Headers({
      'content-type': 'application/json',
      origin: BASE_URL,
      ...extra,
    })
    if (cookie) headers.set('cookie', cookie)
    return handler()(
      new Request(`${AUTH_BASE}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }),
    )
  }

  function get(
    path: string,
    { cookie, headers: extra }: RequestOptions = {},
  ): Promise<Response> {
    const headers = new Headers({ origin: BASE_URL, ...extra })
    if (cookie) headers.set('cookie', cookie)
    return handler()(
      new Request(`${AUTH_BASE}${path}`, { method: 'GET', headers }),
    )
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

  /** Signs in and returns the cookie of the session that sign-in minted. */
  async function signIn(email: string): Promise<string> {
    const response = await post('/sign-in/email', { email, password: PASSWORD })
    expect(response.status).toBe(200)
    return sessionCookie(response)
  }

  /** The newest session row of a user, which is the one `signIn` just created. */
  function latestSessionId(userId: string): string {
    const row = sqlite
      .prepare(
        'select id from session where user_id = ? order by rowid desc limit 1',
      )
      .get(userId) as { id: string } | undefined
    if (row === undefined) throw new Error(`no session for ${userId}`)
    return row.id
  }

  /**
   * Better Auth answers a session read from KV before it looks at D1, so an edit to the row is
   * only seen once the snapshot is gone.
   */
  function editSession(
    userId: string,
    column: 'impersonated_by' | 'created_at',
    value: string | number | null,
  ): void {
    sqlite
      .prepare(`update session set ${column} = ? where id = ?`)
      .run(value, latestSessionId(userId))
    kv.clear()
  }

  function seedPasskeys(
    userId: string,
    passkeys: ReadonlyArray<SeededPasskey>,
  ): void {
    const insert = sqlite.prepare(
      `insert into passkey
        (id, name, user_id, credential_id, public_key, algorithm, counter,
         device_type, backed_up, transports, aaguid, created_at, last_used_at)
       values (?, ?, ?, ?, ?, -7, 0, 'singleDevice', 0, null, null, ?, null)`,
    )
    for (const entry of passkeys) {
      insert.run(
        entry.id,
        entry.name ?? null,
        userId,
        `credential-${entry.id}`,
        `public-key-${entry.id}`,
        (entry.createdAt ?? new Date()).getTime(),
      )
    }
  }

  function passkeyCount(userId: string): number {
    const row = sqlite
      .prepare('select count(*) as total from passkey where user_id = ?')
      .get(userId) as { total: number }
    return row.total
  }

  /** The stored name of a passkey, `null` when it is unnamed; `undefined` when the row is gone. */
  function passkeyName(id: string): string | null | undefined {
    const row = sqlite
      .prepare('select name from passkey where id = ?')
      .get(id) as { name: string | null } | undefined
    return row?.name
  }

  /** Open registration challenges: every one is a row `register/options` wrote and nothing consumed. */
  function challengeCount(): number {
    const row = sqlite
      .prepare(
        "select count(*) as total from verification where identifier like 'passkey-challenge:%'",
      )
      .get() as { total: number }
    return row.total
  }

  return {
    post,
    get,
    sessionCookie,
    createAccount,
    signIn,
    editSession,
    seedPasskeys,
    passkeyCount,
    passkeyName,
    challengeCount,
  }
}

export type AuthHarness = ReturnType<typeof createAuthHarness>
