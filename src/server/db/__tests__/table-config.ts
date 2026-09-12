/**
 * `schema.ts` read the way a schema test asks about it.
 *
 * The declaration suites in this directory — `transport-schema.test.ts`,
 * `reservation-schema.test.ts` — assert the same four things about a table: which columns it
 * declares, which indexes it declares and over which columns, and where each foreign key points
 * with which `ON DELETE` disposition. `getTableConfig()` answers all of that, but only through
 * nested config objects whose shapes differ per entry, so each suite would otherwise carry its own
 * copy of the walk. It lives here once, beside `migration-files.ts`, which does the same job for
 * the other half of the question: what the shipped SQL actually put on disk.
 */

import { getTableConfig } from 'drizzle-orm/sqlite-core'

import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'

/** The column names `table` declares, in declaration order. */
export function columnNames(table: SQLiteTable): Array<string> {
  return getTableConfig(table).columns.map((entry) => entry.name)
}

/** One declared column by its SQL name. Throws rather than returning `undefined`, so a
 * misspelt name fails as a missing column rather than as a null read three lines later. */
export function column(table: SQLiteTable, name: string): SQLiteColumn {
  const found = getTableConfig(table).columns.find(
    (candidate) => candidate.name === name,
  )
  if (found === undefined) {
    throw new Error(`${getTableConfig(table).name} declares no column ${name}`)
  }
  return found
}

/** The index names `table` declares. */
export function indexNames(table: SQLiteTable): Array<string> {
  return getTableConfig(table).indexes.map((entry) => entry.config.name)
}

/** The columns index `name` covers, in the order it covers them. */
export function indexColumns(table: SQLiteTable, name: string): Array<string> {
  const entry = getTableConfig(table).indexes.find(
    (candidate) => candidate.config.name === name,
  )
  return (entry?.config.columns ?? []).map((indexed) =>
    'name' in indexed ? String(indexed.name) : String(indexed),
  )
}

/**
 * The columns `table`'s composite `primaryKey()` covers, in the order it covers them, or `[]` for a
 * table keyed by a single column — `getTableConfig().primaryKeys` holds only the composite kind.
 */
export function primaryKeyColumns(table: SQLiteTable): Array<string> {
  return getTableConfig(table).primaryKeys.flatMap((key) =>
    key.columns.map((entry) => entry.name),
  )
}

/** The check-constraint names `table` declares, in declaration order. */
export function checkNames(table: SQLiteTable): Array<string> {
  return getTableConfig(table).checks.map((entry) => entry.name)
}

/** Every foreign key of `table` as `column -> target.column (onDelete)`, sorted for stability. */
export function foreignKeys(table: SQLiteTable): Array<string> {
  return getTableConfig(table)
    .foreignKeys.map((key) => {
      const reference = key.reference()
      const from = reference.columns.map((entry) => entry.name).join(',')
      const to = reference.foreignColumns
        .map(
          (entry) =>
            `${getTableConfig(reference.foreignTable).name}.${entry.name}`,
        )
        .join(',')
      return `${from} -> ${to} (${key.onDelete ?? 'no action'})`
    })
    .sort()
}
