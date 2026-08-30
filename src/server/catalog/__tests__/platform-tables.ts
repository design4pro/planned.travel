/**
 * Four of the global tables of SPEC §5's carve-out, in an in-memory SQLite database.
 *
 * `src/server/repos/__tests__/harness.ts` builds the whole relational model the same way and is the
 * right tool for a tenant repository test. It cannot be the tool here: it imports `../base` and
 * hands back a `TenantScope`, so a `src/server/catalog/**` test that used it would pull the tenant
 * repository into the global-table path — the exact reach SPEC §5 forbids and `isolation.test.ts`
 * beside this file exists to catch. That check walks the module graph from every module in this
 * directory, this fixture included, so an import taken here for convenience is as visible as one
 * taken in `audit.ts`. This fixture is deliberately the smaller thing rather than a second copy of
 * that one: two tables, no tenant, no scope, no seeding.
 *
 * The DDL is generated from the Drizzle schema itself (`drizzle-kit/api`), so the real column types,
 * the five real `CHECK` constraints of docs/ACCESS.md §4.1 and the real `token_id` foreign key are
 * exercised rather than a hand-written approximation that could drift. `staff_api_tokens` is present
 * because `platform_audit_log.token_id` references it; nothing else in the schema does, since
 * `userRef()` is a bare text column by house convention.
 */

import { DatabaseSync } from 'node:sqlite'
import {
  generateSQLiteDrizzleJson,
  generateSQLiteMigration,
} from 'drizzle-kit/api'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import {
  platformAuditLog,
  providerRegistry,
  providerUsage,
  staffApiTokens,
} from '#/server/db/schema'
import type { Database } from '#/server/db/types'

/** The value types `node:sqlite` accepts as a bound parameter. */
type SqliteValue = null | number | bigint | string | Uint8Array

type ProxyMethod = 'run' | 'all' | 'values' | 'get'

/** Generating the schema snapshot is the slow part, so it happens once per test process. */
let ddl: Promise<Array<string>> | undefined

function schemaStatements(): Promise<Array<string>> {
  ddl ??= (async () => {
    const empty = await generateSQLiteDrizzleJson({})
    const current = await generateSQLiteDrizzleJson({
      platformAuditLog,
      providerRegistry,
      providerUsage,
      staffApiTokens,
    })
    return generateSQLiteMigration(empty, current)
  })()
  return ddl
}

function toSqliteParams(params: ReadonlyArray<unknown>): Array<SqliteValue> {
  return params.map((param) => {
    if (param === null || param === undefined) {
      return null
    }
    if (typeof param === 'boolean') {
      return param ? 1 : 0
    }
    if (param instanceof Date) {
      return param.getTime()
    }
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

  // Drizzle maps result rows positionally, so rows must come back as arrays, not objects.
  statement.setReturnArrays(true)
  const rows = statement.all(...bound) as unknown as Array<Array<unknown>>

  if (method === 'get') {
    return { rows: rows[0] ?? [] }
  }
  return { rows }
}

export interface PlatformTables {
  /** The same {@link Database} type the Worker's D1 handle satisfies. */
  readonly db: Database
  readonly sqlite: DatabaseSync
  close: () => void
}

/** Builds a fresh database. Call it in `beforeEach` so tests never share state. */
export async function createPlatformTables(): Promise<PlatformTables> {
  const statements = await schemaStatements()
  const sqlite = new DatabaseSync(':memory:')
  for (const statement of statements) {
    sqlite.exec(statement)
  }

  const db: Database = drizzle(
    async (query, params, method) =>
      runStatement(sqlite, query, params, method),
    async (queries) =>
      queries.map((entry) =>
        runStatement(sqlite, entry.sql, entry.params, entry.method),
      ),
  )

  return {
    db,
    sqlite,
    close() {
      sqlite.close()
    },
  }
}
