/**
 * Reads the places in the schema sources that name a user, so the registry can be held to them.
 *
 * `userRef('<column>')` is a plain text column with no foreign key, so nothing at runtime tells it
 * apart from any other `text()`: the only place the fact is recorded is the source of `schema.ts`.
 * The auth tables are the opposite, a real `.references(() => user.id)` in `auth-schema.ts`. Both
 * extractions work on the source text and take it as an argument, which is what lets the drift test
 * hand them a source with a column added or removed and watch the comparison fail.
 */

import type { ErasureEntry } from '../registry'

/** `table.column`, the key a registry entry and an extracted column are compared by. */
export type PlaceKey = `${string}.${string}`

const TABLE_OPEN = /sqliteTable\(\s*'([a-z_]+)'/
const TABLE_OPEN_BARE = /sqliteTable\(\s*$/
const QUOTED_NAME = /'([a-z_]+)'/
const USER_REF = /userRef\('([a-z_]+)'\)/
const USER_FK = /\.references\(\s*\(\)\s*=>\s*user\.id/
const TEXT_COLUMN = /text\('([a-z_]+)'\)/

/** The table each line of `source` is inside, by the `sqliteTable('name', …)` that opened it. */
function tablePerLine(lines: ReadonlyArray<string>): Array<string> {
  const tables: Array<string> = []
  let current = ''
  for (const [index, line] of lines.entries()) {
    if (TABLE_OPEN.test(line)) {
      current = TABLE_OPEN.exec(line)?.[1] ?? current
    } else if (TABLE_OPEN_BARE.test(line)) {
      current = QUOTED_NAME.exec(lines[index + 1] ?? '')?.[1] ?? current
    }
    tables.push(current)
  }
  return tables
}

/** Every `userRef('<column>')` of the source, as `table.column`. */
export function extractUserRefColumns(source: string): Array<PlaceKey> {
  const lines = source.split('\n')
  const tables = tablePerLine(lines)
  const found: Array<PlaceKey> = []
  for (const [index, line] of lines.entries()) {
    const column = USER_REF.exec(line)?.[1]
    const table = tables[index]
    if (column !== undefined && table !== undefined && table !== '') {
      found.push(`${table}.${column}`)
    }
  }
  return found
}

/** Every column of the auth source that is a foreign key to `user.id`, as `table.column`. */
export function extractUserForeignKeys(source: string): Array<PlaceKey> {
  const lines = source.split('\n')
  const tables = tablePerLine(lines)
  const found: Array<PlaceKey> = []
  for (const [index, line] of lines.entries()) {
    if (!USER_FK.test(line)) {
      continue
    }
    // The column is declared on the line of the `text('…')` builder, at most a few lines above.
    for (let back = 0; back <= 4; back += 1) {
      const column = TEXT_COLUMN.exec(lines[index - back] ?? '')?.[1]
      const table = tables[index]
      if (column !== undefined && table !== undefined && table !== '') {
        found.push(`${table}.${column}`)
        break
      }
    }
  }
  return found
}

export interface RegistryDrift {
  /** In the schema, not in the registry: the next engineer's new column. */
  readonly missing: Array<PlaceKey>
  /** In the registry, no longer in the schema: a renamed or dropped column. */
  readonly surplus: Array<PlaceKey>
}

function keyOf(entry: Pick<ErasureEntry, 'table' | 'column'>): PlaceKey {
  return `${entry.table}.${entry.column}`
}

/**
 * Compares the registry with the sources. `schemaSource` is `schema.ts`, `authSchemaSource` is
 * `auth-schema.ts`; the entries compared are the `user-ref` ones against the first and the `auth`
 * ones (less `user.id`, which is the row itself) against the second.
 */
export function findRegistryDrift(
  schemaSource: string,
  authSchemaSource: string,
  registry: ReadonlyArray<ErasureEntry>,
): RegistryDrift {
  const declared = new Set<PlaceKey>([
    ...extractUserRefColumns(schemaSource),
    ...extractUserForeignKeys(authSchemaSource),
  ])
  const registered = new Set<PlaceKey>(
    registry
      .filter(
        (entry) =>
          entry.origin === 'user-ref' ||
          (entry.origin === 'auth' && keyOf(entry) !== 'user.id'),
      )
      .map(keyOf),
  )
  return {
    missing: [...declared].filter((key) => !registered.has(key)).sort(),
    surplus: [...registered].filter((key) => !declared.has(key)).sort(),
  }
}
