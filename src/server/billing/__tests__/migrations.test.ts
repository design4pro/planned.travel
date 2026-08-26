/**
 * The generated SQL in `drizzle/`, applied for real — because nothing else applies it.
 *
 * `src/server/repos/__tests__/harness.ts` builds its database from the Drizzle schema
 * through `drizzle-kit/api`, which is the right thing for repository tests and a blind
 * spot for this one: every column added to `schema.ts` appears there whether or not a
 * migration file was ever generated. So a green suite says nothing about whether D1
 * can hold the column. This file closes that gap for the `subscriptions` table by
 * replaying `drizzle/*.sql` in journal order into an empty SQLite database and asking
 * the database what it ended up with.
 *
 * `enableDoubleQuotedStringLiterals` is on for the replay, and it is not decoration:
 * migration `0001` rebuilds `expenses` and its `INSERT … SELECT` names columns the old
 * table did not have, which only parses because SQLite falls back to reading an
 * unresolved double-quoted identifier as a string literal. That migration is applied
 * and immutable, so the replay has to tolerate what the engine tolerated — it is a
 * finding about `0001`, not a licence for the next one.
 *
 * The last assertion is the one `docs/DEPLOY.md` §5 and §9.10 ask for in prose.
 * SQLite cannot add a constraint to a live table, so drizzle-kit answers a new CHECK
 * with a `__new_subscriptions` copy-and-swap: `CREATE TABLE __new_…`, `INSERT … SELECT`,
 * `DROP TABLE subscriptions`, rename. On D1 that runs without the
 * `PRAGMA foreign_keys=OFF` it emits, because D1 does not honour it — and it is a
 * destructive rewrite of a table that will hold paying customers. Additive column adds
 * are the whole policy, and this is the test that notices when a generate stops obeying
 * it.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const MIGRATIONS_DIR = join(process.cwd(), 'drizzle')

interface JournalEntry {
  readonly idx: number
  readonly tag: string
}

function journal(): Array<JournalEntry> {
  const raw: unknown = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, 'meta', '_journal.json'), 'utf8'),
  )
  const entries =
    typeof raw === 'object' && raw !== null && 'entries' in raw ? raw.entries : null
  if (!Array.isArray(entries)) {
    throw new Error('drizzle/meta/_journal.json has no entries array')
  }
  return [...(entries as Array<JournalEntry>)].sort((a, b) => a.idx - b.idx)
}

function sqlFor(tag: string): string {
  return readFileSync(join(MIGRATIONS_DIR, `${tag}.sql`), 'utf8')
}

/** Column names of `subscriptions` after every migration has been applied in order. */
function migratedColumns(): Array<string> {
  const sqlite = new DatabaseSync(':memory:', {
    enableDoubleQuotedStringLiterals: true,
  })
  try {
    for (const entry of journal()) {
      for (const statement of sqlFor(entry.tag).split('--> statement-breakpoint')) {
        const trimmed = statement.trim()
        if (trimmed !== '') sqlite.exec(trimmed)
      }
    }
    return sqlite
      .prepare("SELECT name FROM pragma_table_info('subscriptions')")
      .all()
      .map((row) => String(row.name))
  } finally {
    sqlite.close()
  }
}

describe('the generated migrations', () => {
  it('leave the same SQL files on disk as the journal names', () => {
    const onDisk = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => name.replace(/\.sql$/, ''))
      .sort()

    expect(onDisk).toEqual(journal().map((entry) => entry.tag).sort())
  })

  it('build a subscriptions table that can hold a scheduled plan change', () => {
    const columns = migratedColumns()

    expect(columns).toContain('pending_plan')
    expect(columns).toContain('pending_interval')
    expect(columns).toContain('pending_effective_at')
    // The three columns the Polar migration renamed are still the ones we read.
    expect(columns).toContain('provider_customer_id')
    expect(columns).toContain('provider_subscription_id')
    expect(columns).toContain('provider_product_id')
  })

  it('never rebuild the subscriptions table to add to it', () => {
    // 0000 creates it and 0002 renames three columns in place; nothing after 0000 may
    // copy the table aside and drop the original.
    for (const entry of journal().filter((candidate) => candidate.idx > 0)) {
      const sql = sqlFor(entry.tag)
      // A recreate is what drizzle-kit answers a new CHECK constraint with, and it
      // brings the `PRAGMA foreign_keys=OFF` that D1 will not honour with it.
      expect(sql, entry.tag).not.toMatch(/__new_subscriptions/)
      expect(sql, entry.tag).not.toMatch(/DROP TABLE\s+`?subscriptions`?/i)
    }
  })
})
