/**
 * The SQL in `drizzle/`, read the way wrangler applies it.
 *
 * Several suites replay the shipped migration files rather than building their DDL from
 * `schema.ts`: the schema suites in this directory and
 * `src/server/billing/__tests__/migrations.test.ts` ask what the replay ends up with, and
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

/** The indexes `table` physically has on `sqlite`. */
export function physicalIndexNames(
  sqlite: DatabaseSync,
  table: string,
): Array<string> {
  return sqlite
    .prepare('SELECT name FROM pragma_index_list(?)')
    .all(table)
    .map((row) => String(row.name))
}
