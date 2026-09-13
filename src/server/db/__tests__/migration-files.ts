/**
 * The SQL in `drizzle/`, read the way wrangler applies it.
 *
 * Several suites replay the shipped migration files rather than building their DDL from
 * `schema.ts`: `migrations-match-schema.test.ts` asks what the replay ends up with for every table
 * there is, the schema suites here and `src/server/billing/__tests__/migrations.test.ts` ask what
 * shape the migration carrying their table took, and
 * `src/server/db/__tests__/migration-quoted-identifiers.test.ts` inspects the statements on the way
 * past. All need the journal order — the filenames alone do not carry it — so the reading of
 * `meta/_journal.json`, the splitting on statement breakpoints and the replay itself live here
 * once. What the *declarations* say, as opposed to what the SQL did, is `table-config.ts`.
 */

import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'

export const MIGRATIONS_DIR = join(process.cwd(), 'drizzle')

/** One migration file, named by the tag the journal gives it. */
export interface Migration {
  readonly tag: string
  readonly sql: string
}

interface JournalEntry {
  readonly idx: number
  readonly tag: string
}

function journalEntries(): Array<JournalEntry> {
  const raw: unknown = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'),
  )
  const entries =
    typeof raw === 'object' && raw !== null && 'entries' in raw
      ? raw.entries
      : null
  if (!Array.isArray(entries)) {
    throw new Error('drizzle/meta/_journal.json has no entries array')
  }
  return [...(entries as Array<JournalEntry>)].sort((a, b) => a.idx - b.idx)
}

/** The tags the journal names, in the order D1 applies them. */
export function journalTags(): Array<string> {
  return journalEntries().map((entry) => entry.tag)
}

/** Every migration on disk, in the order D1 applies them. */
export function shippedMigrations(): Array<Migration> {
  return journalEntries().map((entry) => ({
    tag: entry.tag,
    sql: readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`), 'utf8'),
  }))
}

/** `sql` split into the statements wrangler would run, with the blank tail dropped. */
export function statementsOf(sql: string): Array<string> {
  return sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '')
}

/**
 * An empty database that tolerates SQLite's legacy double-quoted-string fallback, as D1 does.
 *
 * Not decoration: migration `0001_aspiring_cargill` rebuilds `expenses` and its `INSERT … SELECT`
 * names a column the old table did not have, which only parses because of the fallback. That
 * migration is applied and immutable (docs/DEPLOY.md §5), so a replay that refuses the fallback
 * cannot get past it — it has to tolerate what the engine tolerated. What that costs is covered by
 * `migration-quoted-identifiers.test.ts`, which catches the next migration making the same mistake.
 */
export function openReplayDatabase(): DatabaseSync {
  return new DatabaseSync(':memory:', {
    enableDoubleQuotedStringLiterals: true,
  })
}

/**
 * An empty database with every shipped migration applied, in journal order.
 *
 * The repository harness builds its DDL from `schema.ts` through `drizzle-kit/api`, so a column
 * added to that file is green there whether or not `pnpm db:generate` was ever run. A suite that
 * needs to know what D1 is actually running asks this connection instead. The caller closes it.
 */
export function replayMigrations(): DatabaseSync {
  const sqlite = openReplayDatabase()
  for (const migration of shippedMigrations()) {
    for (const statement of statementsOf(migration.sql)) {
      sqlite.exec(statement)
    }
  }
  return sqlite
}

/**
 * The tables `sqlite` physically has, in name order, SQLite's own bookkeeping excluded.
 *
 * The entry point of the table-agnostic reads below: `migrations-match-schema.test.ts` asks this of
 * both databases and diffs what the three readers answer for every name that comes back, so a table
 * added to `schema.ts` is covered without anyone naming it here.
 */
export function physicalTableNames(sqlite: DatabaseSync): Array<string> {
  return sqlite
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((row) => String(row.name))
}

/** The columns `table` physically has on `sqlite`, in the order the engine stores them. */
export function physicalColumns(
  sqlite: DatabaseSync,
  table: string,
): Array<string> {
  return sqlite
    .prepare('SELECT name FROM pragma_table_info(?)')
    .all(table)
    .map((row) => String(row.name))
}

/**
 * The indexes `table` physically has on `sqlite`, as `name(column, column)` plus `unique` where the
 * engine enforces one row per value, sorted.
 *
 * The covered columns and the uniqueness ride along with the name because an index renamed, narrowed
 * or quietly demoted to non-unique is the same kind of drift as one that never reached disk, and a
 * string per index keeps the whole comparison to one `toEqual`.
 */
export function physicalIndexes(
  sqlite: DatabaseSync,
  table: string,
): Array<string> {
  return sqlite
    .prepare('SELECT name, "unique" FROM pragma_index_list(?)')
    .all(table)
    .map((row) => {
      const name = String(row.name)
      const covered = sqlite
        .prepare('SELECT name FROM pragma_index_info(?)')
        .all(name)
        .map((entry) => String(entry.name))
      const unique = Number(row.unique) === 1 ? ' unique' : ''
      return `${name}(${covered.join(', ')})${unique}`
    })
    .sort()
}

/**
 * Every foreign key `table` physically has, as `column -> target.column (ON DELETE …)`, sorted.
 *
 * The disposition is part of the answer because the declared one and the deployed one can differ:
 * drizzle-kit's `ALTER TABLE … ADD COLUMN` emits a `REFERENCES` clause with no `ON DELETE` one, so a
 * column added that way is `NO ACTION` on D1 whatever `schema.ts` says. Which columns those are is
 * the allowlist in `migrations-match-schema.test.ts`.
 */
export function physicalForeignKeys(
  sqlite: DatabaseSync,
  table: string,
): Array<string> {
  return sqlite
    .prepare('SELECT * FROM pragma_foreign_key_list(?)')
    .all(table)
    .map(
      (row) =>
        `${String(row.from)} -> ${String(row.table)}.${String(row.to)} (${String(row.on_delete)})`,
    )
    .sort()
}
