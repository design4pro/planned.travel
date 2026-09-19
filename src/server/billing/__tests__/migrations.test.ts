/**
 * What the generated SQL in `drizzle/` is allowed to *do* to the table that holds paying customers.
 *
 * Whether the shipped migrations carry every column `schema.ts` declares — for `subscriptions` and
 * for every other table — is asked once, in
 * `src/server/db/__tests__/migrations-match-schema.test.ts` (#184). What that structural diff cannot
 * see is the shape of the migration that got there, and for this table the shape is the policy.
 *
 * The last assertion is the one `docs/DEPLOY.md` §5 and §9.10 ask for in prose.
 * SQLite cannot add a constraint to a live table, so drizzle-kit answers a new CHECK
 * with a `__new_subscriptions` copy-and-swap: `CREATE TABLE __new_…`, `INSERT … SELECT`,
 * `DROP TABLE subscriptions`, rename. On D1 that runs without the
 * `PRAGMA foreign_keys=OFF` it emits, because D1 does not honour it — and it is a
 * destructive rewrite of a table that will hold paying customers. Additive column adds
 * are the whole policy, and this is the test that notices when a generate stops obeying
 * it. The first assertion guards the input to all of it: a `.sql` file the journal does not name is
 * never applied, and one the journal names and disk does not have stops the deploy.
 */

import { readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  MIGRATIONS_DIR,
  journalTags,
  shippedMigrations,
} from '#/server/db/__tests__/migration-files'

describe('the generated migrations', () => {
  it('leave the same SQL files on disk as the journal names', () => {
    const onDisk = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => name.replace(/\.sql$/, ''))
      .sort()

    expect(onDisk).toEqual(journalTags().sort())
  })

  it('never rebuild the subscriptions table to add to it', () => {
    // 0000 creates it and 0003 renames three columns in place; nothing after 0000 may
    // copy the table aside and drop the original.
    for (const migration of shippedMigrations().slice(1)) {
      // A recreate is what drizzle-kit answers a new CHECK constraint with, and it
      // brings the `PRAGMA foreign_keys=OFF` that D1 will not honour with it.
      expect(migration.sql, migration.tag).not.toMatch(/__new_subscriptions/)
      expect(migration.sql, migration.tag).not.toMatch(
        /DROP TABLE\s+`?subscriptions`?/i,
      )
    }
  })
})
