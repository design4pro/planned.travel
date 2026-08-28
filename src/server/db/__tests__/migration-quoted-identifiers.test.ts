/**
 * The recurrence guard for the defect migration `0001_aspiring_cargill` shipped.
 *
 * `0001` rebuilds `expenses` to add `original_currency`, and its copy statement selects
 * `"original_currency"` out of the *old* table, which never had that column
 * (`0000_bored_moon_knight.sql` predates the fix to the shared `currency()` builder). SQLite's
 * legacy double-quoted-string fallback resolves an identifier it cannot bind as a text literal
 * instead of failing, so the statement parsed and wrote the 17-character string
 * `'original_currency'` into the new column for every row that existed at the time. D1 has that
 * fallback on. Both deployed databases were counted during triage and `expenses` is empty in each,
 * so no row carries the literal and none can: `0000` and `0001` land in the same commit, so every
 * database built from this repository applies them back-to-back into an empty table. There is
 * nothing to repair. What was unguarded is the next migration making the same mistake.
 *
 * Nothing else in the suite can see a defect of this shape. `src/server/repos/__tests__/harness.ts`
 * builds its DDL from `schema.ts` through `drizzle-kit/api` and never reads `drizzle/*.sql`, and
 * `src/server/billing/__tests__/migrations.test.ts` does replay the files but tolerates the
 * fallback wholesale and asserts only about `subscriptions`.
 *
 * **Why this is a static check driven by the replay and not a second replay with the fallback
 * off.** A DQS-off replay stops at the first offender — `0001` — and therefore never reaches the
 * eighth migration it is supposed to catch, and `0001` is applied and immutable (docs/DEPLOY.md
 * §5), so it cannot be removed from its path. Instead the replay runs on a connection that
 * tolerates the fallback, exactly as the engine did, and every `INSERT INTO … SELECT … FROM
 * <source>` is inspected *before* it executes: each double-quoted identifier in the select list is
 * resolved against `pragma_table_info(<source>)` on the live connection, which is the source
 * table as that migration actually finds it. An unresolvable one is a finding tagged with its
 * migration. The set of tags is then asserted to be exactly the grandfathered one, so an eighth
 * migration repeating the mistake fails this test on the line below rather than being swallowed by
 * an abort at `0001`. `scanMigrations` takes its migrations as an argument rather than reading the
 * directory, which is what lets the last two cases prove the detection fires — on a synthetic
 * statement and on a hypothetical eighth migration — without adding a file to `drizzle/`.
 */

import { readFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATIONS_DIR = join(process.cwd(), 'drizzle')

/**
 * The single migration allowed to name a column its source table lacks.
 *
 * `0001_aspiring_cargill` is applied to both deployed databases and immutable — docs/DEPLOY.md §5
 * and the header of `src/server/billing/__tests__/migrations.test.ts` both say so — so the replay
 * has to tolerate what the engine tolerated. That is a finding about `0001`, not a licence for the
 * next one, which is why this list is asserted as an equality and not as a subset.
 */
const GRANDFATHERED_TAGS: ReadonlyArray<string> = ['0001_aspiring_cargill']

interface JournalEntry {
  readonly idx: number
  readonly tag: string
}

interface Migration {
  readonly tag: string
  readonly sql: string
}

/** One double-quoted identifier a copy statement named and its source table did not have. */
interface Finding {
  readonly tag: string
  readonly source: string
  readonly identifier: string
}

/**
 * `INSERT INTO <target>(<columns>) SELECT <list> FROM <source>` — drizzle-kit's copy-and-swap
 * idiom, and the only shape in which an unresolved identifier can reach a table's contents. A
 * `VALUES` insert (`0002`'s locale mapping table) carries no select list and does not match.
 * drizzle-kit spells the select list as bare double-quoted column names, never qualified by table,
 * so an identifier found there is a column of `<source>` or it is nothing.
 */
const COPY_STATEMENT =
  /INSERT\s+INTO\s+[`"[]?\w+[`"\]]?\s*(?:\([^)]*\))?\s*SELECT\s+(.*?)\s+FROM\s+[`"[]?(\w+)[`"\]]?/is

/** Each double-quoted name in a select list — the exact syntax the DQS fallback rescues. */
const QUOTED_IDENTIFIER = /"([^"]*)"/g

function journal(): Array<JournalEntry> {
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

/** Every migration on disk, in the order D1 applies them. */
function shippedMigrations(): Array<Migration> {
  return journal().map((entry) => ({
    tag: entry.tag,
    sql: readFileSync(join(MIGRATIONS_DIR, `${entry.tag}.sql`), 'utf8'),
  }))
}

/**
 * The double-quoted identifiers `statement` selects that its source table cannot bind.
 *
 * `sqlite` must be positioned immediately before `statement` runs: the columns are read off the
 * live connection, so this answers what the source table looks like at that point in the journal
 * rather than what `schema.ts` says today.
 */
function unresolvedQuotedIdentifiers(
  sqlite: DatabaseSync,
  statement: string,
): Array<Omit<Finding, 'tag'>> {
  const copy = COPY_STATEMENT.exec(statement)
  if (copy === null) return []

  const selectList = copy[1]
  const source = copy[2]
  const columns = new Set(
    sqlite
      .prepare('SELECT name FROM pragma_table_info(?)')
      .all(source)
      .map((row) => String(row.name)),
  )

  return [...selectList.matchAll(QUOTED_IDENTIFIER)]
    .map((match) => match[1])
    .filter((identifier) => !columns.has(identifier))
    .map((identifier) => ({ source, identifier }))
}

/** Replay `migrations` in order, inspecting each copy statement before the engine sees it. */
function scanMigrations(migrations: ReadonlyArray<Migration>): Array<Finding> {
  const sqlite = new DatabaseSync(':memory:', {
    enableDoubleQuotedStringLiterals: true,
  })
  const findings: Array<Finding> = []
  try {
    for (const migration of migrations) {
      for (const statement of migration.sql.split('--> statement-breakpoint')) {
        const trimmed = statement.trim()
        if (trimmed === '') continue
        for (const finding of unresolvedQuotedIdentifiers(sqlite, trimmed)) {
          findings.push({ tag: migration.tag, ...finding })
        }
        sqlite.exec(trimmed)
      }
    }
  } finally {
    sqlite.close()
  }
  return findings
}

describe('the copy statements in drizzle/', () => {
  it('name no column their source table lacks, outside the one grandfathered migration', () => {
    const tags = [
      ...new Set(scanMigrations(shippedMigrations()).map((f) => f.tag)),
    ].sort()

    expect(tags).toEqual([...GRANDFATHERED_TAGS].sort())
  })

  it('report original_currency as the identifier 0001 could not resolve', () => {
    // The whole of the known damage, named rather than counted: if a second identifier in `0001`
    // ever turns up here, the grandfathering no longer covers what it was granted for.
    expect(scanMigrations(shippedMigrations())).toEqual([
      {
        tag: '0001_aspiring_cargill',
        source: 'expenses',
        identifier: 'original_currency',
      },
    ])
  })
})

describe('the detection itself', () => {
  it('flags a synthetic copy statement that names a column the source table lacks', () => {
    // A guard that cannot be shown to fire is not a guard, and no file in `drizzle/` may be added
    // to demonstrate it. The connection stands in for a point mid-replay.
    const sqlite = new DatabaseSync(':memory:', {
      enableDoubleQuotedStringLiterals: true,
    })
    try {
      sqlite.exec('CREATE TABLE `receipts` (`id` text, `amount_minor` integer)')

      expect(
        unresolvedQuotedIdentifiers(
          sqlite,
          'INSERT INTO `__new_receipts`("id", "amount_minor", "original_currency") ' +
            'SELECT "id", "amount_minor", "original_currency" FROM `receipts`',
        ),
      ).toEqual([{ source: 'receipts', identifier: 'original_currency' }])
    } finally {
      sqlite.close()
    }
  })

  it('flags nothing when every identifier resolves', () => {
    const sqlite = new DatabaseSync(':memory:', {
      enableDoubleQuotedStringLiterals: true,
    })
    try {
      sqlite.exec('CREATE TABLE `receipts` (`id` text, `amount_minor` integer)')

      expect(
        unresolvedQuotedIdentifiers(
          sqlite,
          'INSERT INTO `__new_receipts`("id", "amount_minor") ' +
            'SELECT "id", "amount_minor" FROM `receipts`',
        ),
      ).toEqual([])
      // A VALUES insert has no select list to resolve — `0002`'s locale mapping table is one.
      expect(
        unresolvedQuotedIdentifiers(
          sqlite,
          "INSERT INTO `receipts` (`id`, `amount_minor`) VALUES ('r1', 100)",
        ),
      ).toEqual([])
    } finally {
      sqlite.close()
    }
  })

  it('fails a hypothetical eighth migration that repeats 0001, which a DQS-off replay cannot', () => {
    // The point of the design, asserted rather than argued: with the fallback disabled the replay
    // aborts at `0001` and this migration is never reached, so the check has to run on a
    // fallback-tolerant connection and inspect each statement before executing it. `trips` has a
    // `slug` and no `nickname`.
    const hypothetical: Migration = {
      tag: '0007_hypothetical_offender',
      sql: [
        'CREATE TABLE `__new_trips` (`id` text PRIMARY KEY NOT NULL, `slug` text, `nickname` text)',
        'INSERT INTO `__new_trips`("id", "slug", "nickname") SELECT "id", "slug", "nickname" FROM `trips`',
      ].join('--> statement-breakpoint'),
    }

    const tags = scanMigrations([...shippedMigrations(), hypothetical]).map(
      (f) => f.tag,
    )

    expect(tags).toContain('0007_hypothetical_offender')
    expect([...new Set(tags)].sort()).not.toEqual(
      [...GRANDFATHERED_TAGS].sort(),
    )
  })
})
