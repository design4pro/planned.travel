/** Tenant audit retention: owner-confirms default, aligned with the platform audit log. */
export const TENANT_AUDIT_RETENTION_DAYS = 400
/** A subselect bounds ids without binding one SQL parameter per id. */
export const TENANT_AUDIT_PRUNE_BATCH_SIZE = 200
/** One shared weekly budget: at most 50,000 rows across all workspaces. */
export const TENANT_AUDIT_PRUNE_MAX_BATCHES = 250

export function tenantAuditCutoff(now: Date): Date {
  return new Date(now.getTime() - TENANT_AUDIT_RETENTION_DAYS * 86_400_000)
}
