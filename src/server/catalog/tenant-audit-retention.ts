/**
 * Session-less retention discovery (SPEC §5/§6): organisation ids only, cutoff-filtered,
 * keyset-paged, read-only. The sole production caller is audit/retention.ts; it performs
 * every delete through a TenantScope. This module never reaches repositories.
 */
import { and, asc, gt, lt } from 'drizzle-orm'
import { auditLog } from '#/server/db/schema'
import { tenantAuditCutoff } from '#/server/db/audit-retention'
import type { Database } from '#/server/db/types'

export async function listTenantAuditRetentionOrganizations(
  db: Database,
  now: Date,
  after?: string,
): Promise<Array<{ organizationId: string }>> {
  return db
    .selectDistinct({ organizationId: auditLog.organizationId })
    .from(auditLog)
    .where(
      and(
        lt(auditLog.createdAt, tenantAuditCutoff(now)),
        after === undefined ? undefined : gt(auditLog.organizationId, after),
      ),
    )
    .orderBy(asc(auditLog.organizationId))
    .limit(100)
}
