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

import type { Database } from '#/server/db/types'
import type { TenantScope } from './base'

/**
 * A prepared Drizzle write. Query builders are thenables, so the sequential fallback can simply
 * await them, and the D1 driver accepts the very same objects in `batch()`.
 */
export type BatchStatement = PromiseLike<unknown>

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
