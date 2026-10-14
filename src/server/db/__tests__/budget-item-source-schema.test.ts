/**
 * The three columns a planned item gains so a re-basing of the trip's budget currency can keep what
 * the traveller typed (`budget_items.original_amount_minor`, `original_currency`, `exchange_rate`),
 * the same triple `expenses` and `settlements` carry.
 *
 * Both halves are asserted, declaration and shipped SQL, because the repository harness builds its
 * DDL from `schema.ts` and is green whether or not `pnpm db:generate` was ever run: the replay of
 * `drizzle/*.sql` is the only thing here that asks what D1 is actually running. The migration is
 * additive (`BACKWARD_COMPATIBILITY.md`): three nullable columns, no default, no backfill, no
 * `CHECK` - a constraint change rebuilds the table on SQLite - so the Worker before this one, which
 * reads none of them, keeps working against the migrated database.
 */

import { describe, expect, it } from 'vitest'
import { budgetItems } from '#/server/db/schema'
import {
  physicalColumns,
  replayMigrations,
  shippedMigrations,
} from './migration-files'
import { checkNames, columnNames } from './table-config'

const SOURCE_COLUMNS = [
  'original_amount_minor',
  'original_currency',
  'exchange_rate',
]

describe('budget_items source columns', () => {
  it('declares the three columns, all nullable and with no default', () => {
    expect(columnNames(budgetItems)).toEqual(
      expect.arrayContaining(SOURCE_COLUMNS),
    )
    for (const column of [
      budgetItems.originalAmountMinor,
      budgetItems.originalCurrency,
      budgetItems.exchangeRate,
    ]) {
      expect(column.notNull).toBe(false)
      expect(column.hasDefault).toBe(false)
    }
  })

  it('adds no check constraint for them', () => {
    expect(checkNames(budgetItems)).toEqual([
      'budget_items_category_chk',
      'budget_items_amount_chk',
      'budget_items_persons_chk',
      'budget_items_days_chk',
    ])
  })

  it('ships them as one additive migration that touches nothing else', () => {
    const shipping = shippedMigrations().filter((migration) =>
      migration.sql.includes('`budget_items` ADD `original_amount_minor`'),
    )

    expect(shipping).toHaveLength(1)
    const statements = shipping[0].sql
      .split('--> statement-breakpoint')
      .map((statement) => statement.trim())
    expect(statements).toEqual([
      'ALTER TABLE `budget_items` ADD `original_amount_minor` integer;',
      'ALTER TABLE `budget_items` ADD `original_currency` text(3);',
      'ALTER TABLE `budget_items` ADD `exchange_rate` real;',
    ])
  })

  it('puts them on disk, empty for a row written before them', () => {
    const sqlite = replayMigrations()
    try {
      expect(physicalColumns(sqlite, 'budget_items')).toEqual(
        expect.arrayContaining(SOURCE_COLUMNS),
      )
      sqlite.exec(
        "INSERT INTO organization (id, name, slug, created_at) VALUES ('org', 'Org', 'org', 0)",
      )
      sqlite.exec(
        'INSERT INTO user (id, name, email, email_verified, created_at, updated_at)' +
          " VALUES ('usr', 'Ada', 'ada@example.com', 0, 0, 0)",
      )
      sqlite.exec(
        `INSERT INTO trips (id, organization_id, created_by, title, slug, created_at, updated_at)` +
          ` VALUES ('trip', 'org', 'usr', 'Lisbon', 'lisbon', 0, 0)`,
      )
      sqlite.exec(
        `INSERT INTO budget_items (id, organization_id, trip_id, name, created_at, updated_at)` +
          ` VALUES ('item', 'org', 'trip', 'Food', 0, 0)`,
      )
      const row = sqlite
        .prepare(
          'SELECT original_amount_minor AS a, original_currency AS c, exchange_rate AS r FROM budget_items',
        )
        .get()
      expect({ ...row }).toEqual({ a: null, c: null, r: null })
    } finally {
      sqlite.close()
    }
  })
})
