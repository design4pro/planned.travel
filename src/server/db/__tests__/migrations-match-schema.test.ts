/**
 * Somebody ran `pnpm db:generate` — asked once, for every table there is.
 *
 * The repository harness builds its DDL from `schema.ts` through `drizzle-kit/api`, so a table or a
 * column added to that file is green across the whole suite whether or not a migration was ever
 * generated for it: a schema D1 has never been told about, proven by hundreds of passing tests.
 * `replayMigrations()` applies `drizzle/*.sql` in journal order instead, which is the database D1
 * actually runs, and the gap between the two is what this file measures.
 *
 * It used to be measured per table, inside each schema suite, by naming that table's columns and
 * indexes on both sides — a hand copy every new table had to repeat, and one that says nothing
 * about the table nobody remembered to copy it for (#184). Here the question is asked structurally:
 * walk every table the two databases have, and diff their whole inventory. A table, a column, an
 * index or a foreign key that reaches `schema.ts` and not `drizzle/` reddens this file the moment
 * it is declared, and a table added tomorrow is covered by the same four cases with no new code.
 *
 * What the diff cannot see stays where it is: a declaration is only pinned against the plan it came
 * from by the schema suites in this directory, the tenant rule by `tenant-columns.test.ts`, and
 * engine behaviour — `ON DELETE` actually firing, a `CHECK` actually refusing, `NULL`s inside a
 * `UNIQUE` index — by cases that write rows and read the survivors back.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import {
  physicalColumns,
  physicalForeignKeys,
  physicalIndexes,
  physicalTableNames,
  replayMigrations,
} from './migration-files'
import type { DatabaseSync } from 'node:sqlite'
import type { Harness } from '#/server/repos/__tests__/harness'

/**
 * The references D1 enforces as `NO ACTION` whatever `schema.ts` declares, as `table.column`.
 *
 * Every one of them arrived by `ALTER TABLE … ADD COLUMN`, and the `ADD COLUMN` drizzle-kit writes
 * carries the `REFERENCES` clause with no `ON DELETE` one — the generator's limit, not the engine's.
 * So deleting a row these point at *fails* on the deployed database instead of unlinking the
 * pointer, and the code that deletes such a parent has to null the column itself first. Pinned
 * rather than fixed: closing the gap means either hand-editing a migration, which `drizzle/` forbids
 * as a generated directory, or a table rebuild, which `BACKWARD_COMPATIBILITY.md` forbids. A fifth
 * entry appearing here is a new instance of that debt and wants the same treatment on the caller
 * side; an entry that stops diverging reddens this file too, and should simply be removed. The rule
 * and what an entry commits its author to are recorded once, in ADR 0044.
 */
const DEPLOYED_WITHOUT_ON_DELETE: ReadonlyArray<string> = [
  'day_accommodations.reservation_id',
  'expenses.cost_category_id',
  'reservations.expense_id',
  'transports.arrival_day_id',
]

/** `read` applied to every table of `sqlite`, keyed by table name, so a failure names the table. */
function inventory(
  sqlite: DatabaseSync,
  read: (sqlite: DatabaseSync, table: string) => Array<string>,
): Record<string, Array<string>> {
  return Object.fromEntries(
    physicalTableNames(sqlite).map((table) => [table, read(sqlite, table)]),
  )
}

/**
 * Column order is not a contract and cannot agree: `ADD COLUMN` appends to the physical table while
 * `schema.ts` declares each column where it reads best. Only the set is meaningful.
 */
function sortedColumns(sqlite: DatabaseSync, table: string): Array<string> {
  return physicalColumns(sqlite, table).sort()
}

/** One declared foreign key, rewritten to the disposition the generated `ADD COLUMN` deployed. */
function asD1Deploys(table: string, foreignKey: string): string {
  const [column] = foreignKey.split(' ')
  return DEPLOYED_WITHOUT_ON_DELETE.includes(`${table}.${column}`)
    ? foreignKey.replace(/\([^)]*\)$/, '(NO ACTION)')
    : foreignKey
}

describe('the shipped migrations', () => {
  let harness: Harness
  let deployed: DatabaseSync

  beforeAll(async () => {
    // The declared side, built from `schema.ts` the way every repository test is built.
    harness = await createHarness()
    deployed = replayMigrations()
  })

  afterAll(() => {
    harness.close()
    deployed.close()
  })

  it('create exactly the tables the schema declares', () => {
    expect(physicalTableNames(deployed)).toEqual(
      physicalTableNames(harness.sqlite),
    )
  })

  it('give every table exactly the columns the schema declares', () => {
    expect(inventory(deployed, sortedColumns)).toEqual(
      inventory(harness.sqlite, sortedColumns),
    )
  })

  it('create every index the schema declares, over the same columns', () => {
    expect(inventory(deployed, physicalIndexes)).toEqual(
      inventory(harness.sqlite, physicalIndexes),
    )
  })

  it('deploy every foreign key as declared, bar the ones the generated ADD COLUMN wrote no disposition for', () => {
    const declared = Object.entries(
      inventory(harness.sqlite, physicalForeignKeys),
    ).map(([table, foreignKeys]) => [
      table,
      foreignKeys.map((foreignKey) => asD1Deploys(table, foreignKey)),
    ])

    expect(inventory(deployed, physicalForeignKeys)).toEqual(
      Object.fromEntries(declared),
    )
  })
})
