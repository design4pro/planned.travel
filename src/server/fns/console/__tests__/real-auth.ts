/**
 * The real `better-auth@1.7.1`, running against an in-memory database and an in-memory KV.
 *
 * This file replaced a hand-written Better Auth double, and the reason is worth stating once: every
 * behavioural claim this directory makes is a claim about the *dependency*. That `banUser` empties
 * the `session` table before anything can enumerate it; that `deleteUserSessions` resolves its token
 * list from the eventually-consistent `active-sessions-<userId>` index and therefore deletes no KV
 * blob when that key is missing; that `banUser` cannot write `banExpires: null`; that
 * `impersonateUser` sets six cookies and returns none of them without `returnHeaders: true`; that
 * `createUser` hashes whatever password it is handed without consulting `minPasswordLength`. A
 * double asserts those against a *model* of the library, and a model is exactly the thing that can
 * be wrong while every test stays green — so the library itself is here instead, with the shipped
 * `adminOptions`, the shipped `databaseHooks`, the shipped cookie prefix and the shipped
 * `disabledPaths`.
 *
 * What is faked is only what a Worker binding is: `src/server/auth/env.ts` imports
 * `cloudflare:workers`, which the `server` Vitest project cannot load at all, so `./env` and `./db`
 * are replaced by the test file with the two plain values below — a SQLite database behind Drizzle's
 * proxy driver and a `Map`-backed KV namespace. `src/server/auth/__tests__/auth-handler-closure.test.ts`
 * establishes that arrangement; this is the same one, with the platform tables kept in a second
 * database because they are not the auth schema's and must not be reachable through its handle.
 *
 * The KV double records every `delete` and can be told to reject named keys, because a partial purge
 * is a real outcome of a ban (a Worker's per-invocation operation cap, a KV write error) and the
 * console's behaviour in that case — the ban stands, the incident is raised — is a property with a
 * test.
 */

import { DatabaseSync } from 'node:sqlite'
import {
  generateSQLiteDrizzleJson,
  generateSQLiteMigration,
} from 'drizzle-kit/api'
import { drizzle } from 'drizzle-orm/sqlite-proxy'

import { authSchema } from '#/server/db/auth-schema'

import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy'

/** The value types `node:sqlite` accepts as a bound parameter. */
type SqliteValue = null | number | bigint | string | Uint8Array

type ProxyMethod = 'run' | 'all' | 'values' | 'get'

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
  method: ProxyMethod,
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

/* ------------------------------------------------------------------ the KV double */

/**
 * The `SESSIONS` namespace, in a `Map`.
 *
 * Better Auth writes session blobs here under their raw token and keeps the per-user index
 * `active-sessions-<userId>` beside them; the console deletes both by name. `deleted` records every
 * attempt in order — successes and refusals alike — so a test can assert *which* keys a ban reached
 * for, which is the whole claim, rather than only which ones are gone.
 */
export interface SessionKv {
  readonly store: Map<string, string>
  readonly deleted: Array<string>
  /** Keys whose `delete` rejects, so a partial purge can be driven deliberately. */
  readonly failing: Set<string>
  /** The `expirationTtl` each key was last written with, so a lifetime can be asserted on. */
  readonly ttls: Map<string, number | undefined>
  get: (key: string, type?: string) => Promise<unknown>
  put: (
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ) => Promise<void>
  delete: (key: string) => Promise<void>
  clear: () => void
}

export function createSessionKv(): SessionKv {
  const store = new Map<string, string>()
  const deleted: Array<string> = []
  const failing = new Set<string>()
  const ttls = new Map<string, number | undefined>()

  return {
    store,
    deleted,
    failing,
    ttls,
    async get(key, type) {
      const value = store.get(key)
      if (value === undefined) return null
      return type === 'json' ? JSON.parse(value) : value
    },
    async put(key, value, options) {
      store.set(key, value)
      ttls.set(key, options?.expirationTtl)
    },
    async delete(key) {
      deleted.push(key)
      if (failing.has(key)) {
        throw new Error(`KV delete refused: ${key}`)
      }
      store.delete(key)
    },
    clear() {
      store.clear()
      deleted.length = 0
      failing.clear()
      ttls.clear()
    },
  }
}

/* ------------------------------------------------------------ the auth database */

/**
 * The Better Auth schema in SQLite, with a `reset()` that empties every table.
 *
 * One database for the whole test file, because `getAuth()` memoises the instance and
 * `drizzleAdapter` captures its handle when the instance is built — a fresh database per test would
 * be a database the auth instance never looks at. Emptying the tables gives the same isolation for
 * the cost of one statement each.
 */
export interface AuthDatabase {
  readonly sqlite: DatabaseSync
  readonly db: SqliteRemoteDatabase<typeof authSchema>
  reset: () => void
  close: () => void
}

export async function createAuthDatabase(): Promise<AuthDatabase> {
  const statements = await generateSQLiteMigration(
    await generateSQLiteDrizzleJson({}),
    await generateSQLiteDrizzleJson(authSchema),
  )

  const sqlite = new DatabaseSync(':memory:')
  for (const statement of statements) sqlite.exec(statement)

  const tables = (
    sqlite
      .prepare(
        "select name from sqlite_master where type = 'table' and name not like 'sqlite_%'",
      )
      .all() as unknown as Array<{ name: string }>
  ).map((row) => row.name)

  const db: SqliteRemoteDatabase<typeof authSchema> = drizzle(
    async (query, params, method) =>
      runStatement(sqlite, query, params, method),
    async (queries) =>
      queries.map((entry) =>
        runStatement(sqlite, entry.sql, entry.params, entry.method),
      ),
    { schema: authSchema },
  )

  return {
    sqlite,
    db,
    reset() {
      for (const table of tables) sqlite.exec(`delete from "${table}"`)
    },
    close() {
      sqlite.close()
    },
  }
}
