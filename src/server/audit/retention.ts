/** Weekly tenant retention orchestration; SQL stays in catalog discovery and scoped repositories. */
import { z } from 'zod'
import { listTenantAuditRetentionOrganizations } from '#/server/catalog/tenant-audit-retention'
import {
  TENANT_AUDIT_PRUNE_BATCH_SIZE,
  TENANT_AUDIT_PRUNE_MAX_BATCHES,
  TENANT_AUDIT_RETENTION_DAYS,
} from '#/server/db/audit-retention'
import { createScope } from '#/server/repos/base'
import { pruneAuditLog } from '#/server/repos/audit'
import type { PlatformSystemActor } from '#/server/catalog/audit'
import type { Database } from '#/server/db/types'
import type { Logger } from '#/server/observability'

/** No user row or member identity: required context placeholder, never used for attribution. */
export const TENANT_AUDIT_RETENTION_USER_ID = 'system:tenant-audit-retention'

export async function pruneTenantAuditLog(
  db: Database,
  actor: PlatformSystemActor,
  logger: Logger,
  options: { readonly now?: Date; readonly maxBatches?: number } = {},
) {
  z.object({
    actorKind: z.literal('system'),
    userId: z.null(),
    role: z.null(),
    tokenId: z.null(),
  }).parse(actor)
  const now = z.date().parse(options.now ?? new Date())
  const maxBatches = z
    .number()
    .int()
    .min(1)
    .max(TENANT_AUDIT_PRUNE_MAX_BATCHES)
    .parse(options.maxBatches ?? TENANT_AUDIT_PRUNE_MAX_BATCHES)
  let deleted = 0
  let batches = 0
  let organizations = 0
  let after: string | undefined
  let drained = false
  outer: while (batches < maxBatches) {
    const page = await listTenantAuditRetentionOrganizations(db, now, after)
    if (page.length === 0) {
      drained = true
      break
    }
    for (const { organizationId } of page) {
      const scope = createScope(db, {
        organizationId,
        userId: TENANT_AUDIT_RETENTION_USER_ID,
        role: 'member',
        impersonatedBy: null,
      })
      organizations++
      while (batches < maxBatches) {
        const removed = await pruneAuditLog(scope, now)
        batches++
        deleted += removed
        if (removed < TENANT_AUDIT_PRUNE_BATCH_SIZE) {
          after = organizationId
          break
        }
      }
      if (batches === maxBatches) break outer
    }
  }
  if (!drained)
    drained =
      (await listTenantAuditRetentionOrganizations(db, now, after)).length === 0
  const result = { deleted, batches, organizations, drained }
  const fields = {
    ...result,
    retentionDays: TENANT_AUDIT_RETENTION_DAYS,
    actorKind: actor.actorKind,
  }
  if (drained) logger.info('tenant audit retention prune', fields)
  else
    logger.error(
      'tenant audit retention prune did not drain',
      undefined,
      fields,
    )
  return result
}
