/**
 * Test harness: the whole relational model in an in-memory SQLite database.
 *
 * The DDL is generated from the Drizzle schema itself (`drizzle-kit/api`, once per run in the
 * `server` project's global setup), so these tests exercise the real column types, the real
 * `CHECK` constraints and the real foreign keys — including `ON DELETE CASCADE` — rather than a
 * hand-written approximation that could drift. Pass `{ ddl: 'migrations' }` to build the database
 * D1 is running instead; see {@link HarnessOptions} for when that difference matters.
 *
 * The database is reached through Drizzle's proxy driver, whose handle satisfies the same
 * {@link Database} type the Worker's D1 handle does. Both the single-statement and the `batch`
 * callbacks are wired, so `runBatch()` takes its real batching path here too.
 */

import { DatabaseSync } from 'node:sqlite'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { inject } from 'vitest'
import { member, organization, user } from '#/server/db/auth-schema'
import { newId } from '#/server/db/schema'
import { ceilingsForPlan } from '#/server/billing/limits'
import { ceilingColumns } from '#/server/billing/store'
import { replayMigrations } from '#/server/db/__tests__/migration-files'
import { createScope } from '../base'
import { upsertSubscription } from '../billing'
import type { PlanId } from '#/lib/plans'
import type { Database, OrganizationRole } from '#/server/db/types'
import type { TenantScope } from '../base'
import type { TripParticipant } from '../trips'

/** The value types `node:sqlite` accepts as a bound parameter. */
type SqliteValue = null | number | bigint | string | Uint8Array

/**
 * The DDL is generated once per run by `vitest.global-setup.server.ts`, the `server` project's
 * global setup: generating it here cost every test file a drizzle-kit import and a snapshot.
 */
function schemaStatements(): Array<string> {
  const ddl = inject('schemaDdl')
  if (!ddl) {
    throw new Error(
      'No schema DDL was provided. The harness runs in the `server` vitest project, whose global setup generates it.',
    )
  }
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

type ProxyMethod = 'run' | 'all' | 'values' | 'get'

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

  // Drizzle maps result rows positionally, so rows must come back as arrays, not objects: a join that
  // selects two columns of the same name would otherwise collapse into one key.
  statement.setReturnArrays(true)
  const rows = statement.all(...bound) as unknown as Array<Array<unknown>>

  if (method === 'get') {
    return { rows: rows[0] ?? [] }
  }
  return { rows }
}

/** One tenant, ready to act: its organization, its owner, and a scope bound to both. */
export interface SeededTenant {
  readonly organizationId: string
  readonly ownerUserId: string
  readonly scope: TenantScope
  /** A scope for another member of the same organization. */
  scopeFor: (userId: string, role?: OrganizationRole) => TenantScope
  /** Adds a user row plus a `member` row and returns the user id. */
  addUser: (name: string, role?: OrganizationRole) => Promise<string>
}

export interface Harness {
  readonly db: Database
  readonly sqlite: DatabaseSync
  /**
   * Every SQL statement Drizzle has sent, in order — the DDL excluded, since that runs straight
   * against `sqlite`. A test that cares which tables a read touches truncates it, runs the call,
   * and inspects what came back; nothing else reads it.
   */
  readonly statements: Array<string>
  seedTenant: (label: string) => Promise<SeededTenant>
  /** Table names present in the generated schema — used by the smoke test. */
  tableNames: () => Array<string>
  close: () => void
}

export interface HarnessOptions {
  /**
   * Where the DDL comes from — `'schema'` (the default) or `'migrations'`.
   *
   * They are not the same database, and the difference is the point of the option. `'schema'`
   * builds what `schema.ts` declares, which is what a repository is written against. `'migrations'`
   * replays `drizzle/*.sql` in journal order, which is what D1 is actually running — and
   * drizzle-kit's `ADD COLUMN` cannot express every clause the schema declares, so a rule that
   * holds in one can be absent from the other (`reservations.expense_id` is the live example:
   * `set null` declared, `NO ACTION` deployed). A repository whose correctness depends on closing
   * such a gap has to be tested on the second one, or the test proves the gap does not matter.
   */
  readonly ddl?: 'schema' | 'migrations'
}

/** Builds a fresh, fully migrated database. Call it in `beforeEach` so tests never share state. */
export async function createHarness(
  options: HarnessOptions = {},
): Promise<Harness> {
  let sqlite: DatabaseSync
  if (options.ddl === 'migrations') {
    sqlite = replayMigrations()
  } else {
    sqlite = new DatabaseSync(':memory:')
    for (const statement of schemaStatements()) {
      sqlite.exec(statement)
    }
  }

  const statements: Array<string> = []

  const db: Database = drizzle(
    async (query, params, method) => {
      statements.push(query)
      return runStatement(sqlite, query, params, method)
    },
    async (queries) =>
      queries.map((entry) => {
        statements.push(entry.sql)
        return runStatement(sqlite, entry.sql, entry.params, entry.method)
      }),
  )

  async function insertUser(name: string): Promise<string> {
    const id = newId()
    const now = new Date()
    await db.insert(user).values({
      id,
      name,
      email: `${id}@example.test`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })
    return id
  }

  async function seedTenant(label: string): Promise<SeededTenant> {
    const organizationId = newId()
    const now = new Date()
    await db.insert(organization).values({
      id: organizationId,
      name: `Workspace ${label}`,
      slug: `workspace-${label}-${organizationId.slice(-6)}`,
      createdAt: now,
      updatedAt: now,
    })

    const ownerUserId = await insertUser(`Owner ${label}`)
    await db.insert(member).values({
      id: newId(),
      organizationId,
      userId: ownerUserId,
      role: 'owner',
      createdAt: now,
    })

    const scopeFor = (
      userId: string,
      role: OrganizationRole = 'member',
    ): TenantScope => createScope(db, { userId, organizationId, role })

    return {
      organizationId,
      ownerUserId,
      scope: createScope(db, {
        userId: ownerUserId,
        organizationId,
        role: 'owner',
      }),
      scopeFor,
      async addUser(name, role = 'member') {
        const userId = await insertUser(name)
        await db.insert(member).values({
          id: newId(),
          organizationId,
          userId,
          role,
          createdAt: new Date(),
        })
        return userId
      },
    }
  }

  return {
    db,
    sqlite,
    statements,
    seedTenant,
    tableNames() {
      const statement = sqlite.prepare(
        "select name from sqlite_master where type = 'table' order by name",
      )
      statement.setReturnArrays(true)
      const rows = statement.all() as unknown as Array<Array<unknown>>
      return rows.map((row) => String(row[0]))
    },
    close() {
      sqlite.close()
    },
  }
}

/**
 * Puts a tenant on a plan the way every sanctioned write path does: the plan's own
 * ceilings, stamped onto the same columns `resolveQuotas()` reads back. A test that
 * needs head-room asks for the plan that sells it rather than hand-picking a tier.
 */
export async function subscribeTenant(
  scope: TenantScope,
  planId: PlanId,
  seats = 1,
): Promise<void> {
  await upsertSubscription(scope, {
    ...ceilingColumns(ceilingsForPlan(planId, seats)),
    status: 'active',
    seats,
  })
}

/**
 * The user ids of a participant list's `member` variants, in order.
 *
 * `TripParticipant` is a discriminated union whose `guest` variant carries no `userId`, so `userId`
 * is not reachable without narrowing on `kind`. This is the narrowing, written once rather than in
 * every case that wants to name who came back.
 */
export function memberUserIds(
  participants: ReadonlyArray<TripParticipant>,
): Array<string> {
  return participants
    .filter((row) => row.kind === 'member')
    .map((row) => row.userId)
}

/** Asserts that `run` rejects, and returns the error so the caller can check its `code`. */
export async function captureError(
  run: () => Promise<unknown>,
): Promise<Error> {
  try {
    await run()
  } catch (error) {
    if (error instanceof Error) {
      return error
    }
    throw error
  }
  throw new Error('Expected the call to reject, but it resolved.')
}

/**
 * The constraint a rejected write tripped, for pairing with {@link captureError}.
 *
 * Drizzle's own message repeats the SQL and the parameters; SQLite's name for the constraint is on
 * the `cause`. Asserting on that name rather than on "it threw" is what tells one `CHECK` from
 * another, and either from the `NOT NULL` that happened to fire first.
 */
export function constraintName(error: Error): string {
  const cause: unknown = error.cause
  return cause instanceof Error ? cause.message : error.message
}
