/**
 * Multi-statement writes.
 *
 * D1 has no interactive transactions: a statement list is submitted in one round trip with
 * `db.batch()`, which is atomic and — crucially for a Worker — a single network hop. Repositories
 * therefore never hold a transaction open across awaits; they assemble the statements they need and
 * hand them to {@link runBatch}.
 *
 * Keep batches small and single-purpose (`docs/SPEC.md` §5). A batch that rewrites a whole
 * itinerary belongs in a queue consumer, not in a request path.
 */

import { getTableColumns } from 'drizzle-orm'
import type { Database } from '#/server/db/types'
import type { TenantScope, TenantTable } from './base'

/**
 * A prepared Drizzle write. Query builders are thenables, so the sequential fallback can simply
 * await them, and the D1 driver accepts the very same objects in `batch()`.
 */
export type BatchStatement = PromiseLike<unknown>

/** D1 refuses a statement carrying more than this many bound parameters. */
export const MAX_BOUND_PARAMETERS = 100

/** How many rows of `columns` bound parameters each fit in one statement. */
export function chunkFor(columns: number): number {
  return Math.max(1, Math.floor(MAX_BOUND_PARAMETERS / columns))
}

/** The safe upper bound of parameters Drizzle binds for one inserted row. */
export function boundParametersPerRow(table: TenantTable): number {
  return Object.keys(getTableColumns(table)).length
}

/** Inserts rows in statements small enough for D1's bound-parameter ceiling. */
export async function insertChunked<TRow extends object, TResult>(
  table: TenantTable,
  rows: ReadonlyArray<TRow>,
  insert: (chunk: ReadonlyArray<TRow>) => Promise<Array<TResult>>,
  beforeChunk?: (rowsInChunk: number) => Promise<void>,
): Promise<Array<TResult>> {
  if (rows.length === 0) {
    return []
  }
  const size = chunkFor(boundParametersPerRow(table))
  const inserted: Array<TResult> = []
  for (let index = 0; index < rows.length; index += size) {
    const chunk = rows.slice(index, index + size)
    await beforeChunk?.(chunk.length)
    inserted.push(...(await insert(chunk)))
  }
  return inserted
}

/** The batch surface D1 (and the test proxy driver) add on top of the abstract Drizzle handle. */
interface BatchCapableDatabase {
  batch: (statements: readonly [BatchStatement, ...Array<BatchStatement>]) => Promise<Array<unknown>>
}

function supportsBatch(db: Database): db is Database & BatchCapableDatabase {
  return typeof (db as unknown as Partial<BatchCapableDatabase>).batch === 'function'
}

/**
 * Runs `statements` as one batch on drivers that support it, and sequentially on those that do not.
 * An empty list is a no-op, so callers can build statement arrays conditionally without guarding.
 */
export async function runBatch(
  scope: TenantScope,
  statements: ReadonlyArray<BatchStatement>,
): Promise<void> {
  const first = statements.at(0)
  if (first === undefined) {
    return
  }
  if (supportsBatch(scope.db)) {
    await scope.db.batch([first, ...statements.slice(1)])
    return
  }
  for (const statement of statements) {
    await statement
  }
}
