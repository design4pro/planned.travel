/** Bounded writes for the worker-only erasure repository interfaces. */
import { eq, inArray } from 'drizzle-orm'
import { allOf, createTenantRepository } from './base'
import { RepositoryError } from './context'
import type { SQL } from 'drizzle-orm'
import type { KeyedTenantTable, TenantPatch, TenantScope } from './base'

export function assertErasure(
  scope: TenantScope,
  userId: string,
  formerMemberId: string,
): void {
  if (
    scope.ctx.userId !== 'system:erasure' ||
    scope.ctx.role !== 'owner' ||
    scope.ctx.impersonatedBy !== null ||
    !userId ||
    userId.startsWith('erased_') ||
    !/^erased_[A-Za-z0-9_-]+$/.test(formerMemberId)
  ) {
    throw new RepositoryError('Invalid erasure context.', 'INVALID_ERASURE')
  }
}

/** Each write binds at most 40 ids, the tenant and the small, fixed patch. */
export async function scrubRows<T extends KeyedTenantTable>(
  scope: TenantScope,
  table: T,
  where: SQL,
  patch?: TenantPatch<T>,
): Promise<void> {
  const repo = createTenantRepository(table, 'erasure row')
  for (;;) {
    const rows = await repo.findMany(scope, { where, limit: 40 })
    if (rows.length === 0) return
    const ids = rows.map((row) => String(row.id))
    const selected = allOf(where, inArray(table.id, ids))
    if (patch === undefined) await repo.removeWhere(scope, selected)
    else await repo.updateWhere(scope, selected, patch)
  }
}

/** A single-column reference rewrite, with no bound parameter proportional to workspace volume. */
export async function anonymiseColumn<T extends KeyedTenantTable>(
  scope: TenantScope,
  table: T,
  column: keyof T['$inferInsert'] & keyof T,
  userId: string,
  formerMemberId: string,
): Promise<void> {
  // Callers pass a schema column and the matching insert key; the patch has that table's shape.
  const patch = { [column]: formerMemberId } as TenantPatch<T>
  await scrubRows(scope, table, eq(table[column] as T['id'], userId), patch)
}
