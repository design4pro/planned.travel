/**
 * Audit log — an append-only record of who changed what inside a workspace.
 *
 * Rows are updated only by `eraseUserAudit` in `audit-erasure.ts` for personal-data erasure.
 * The only delete path is {@link pruneAuditLog} for the retention cron.
 * An audit write must never be the reason a user's action fails, so callers append after the work has
 * succeeded and treat a rejected append as a logging problem, not a request failure.
 */

import { and, asc, count, desc, eq, lt } from 'drizzle-orm'
import { z } from 'zod'
import { AUDIT_ACTION_PATTERN } from '#/server/db/audit-action'
import { auditLog } from '#/server/db/schema'
import { allOf, createTenantRepository, tenantFilter } from './base'
import { idSchema, shortTextSchema } from './validation'
import type { JsonRecord } from '#/server/db/schema'
import type { AuditLogEntry } from '#/server/db/types'
import type { CursorPage, TenantScope } from './base'

export const auditLogRepository = createTenantRepository(auditLog, 'audit entry')

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const jsonRecordSchema: z.ZodType<JsonRecord> = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
)

export const recordAuditInput = z.object({
  /** Dotted verb, e.g. `trip.archived`, `member.role_changed`. */
  action: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(AUDIT_ACTION_PATTERN, 'must be a lowercase dotted action'),
  entityType: shortTextSchema.nullish(),
  entityId: idSchema.nullish(),
  metadata: jsonRecordSchema.nullish(),
  ip: shortTextSchema.nullish(),
  userAgent: shortTextSchema.nullish(),
})
export type RecordAuditInput = z.infer<typeof recordAuditInput>

export const listAuditInput = z.object({
  action: shortTextSchema.min(1).optional(),
  actorUserId: idSchema.optional(),
  entityType: shortTextSchema.min(1).optional(),
  entityId: idSchema.optional(),
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z.string().trim().min(1).max(64).nullish(),
})
export type ListAuditInput = z.infer<typeof listAuditInput>

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

/** Appends an entry attributed to the acting user. */
export async function recordAudit(
  scope: TenantScope,
  input: RecordAuditInput,
): Promise<AuditLogEntry> {
  const values = recordAuditInput.parse(input)
  return auditLogRepository.insert(scope, { ...values, actorUserId: scope.ctx.userId })
}

/**
 * Appends several entries in one insert — used when a single user action fans out, e.g. importing a
 * trip that creates dozens of places.
 */
export async function recordAuditMany(
  scope: TenantScope,
  inputs: ReadonlyArray<RecordAuditInput>,
): Promise<Array<AuditLogEntry>> {
  if (inputs.length === 0) {
    return []
  }
  return auditLogRepository.insertMany(
    scope,
    inputs.map((input) => ({
      ...recordAuditInput.parse(input),
      actorUserId: scope.ctx.userId,
    })),
  )
}

/* -------------------------------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------------------------------- */

/** A page of the workspace's audit trail, newest first. */
export async function listAuditLog(
  scope: TenantScope,
  input: ListAuditInput = {},
): Promise<CursorPage<AuditLogEntry>> {
  const options = listAuditInput.parse(input)
  return auditLogRepository.page(scope, {
    where: and(
      options.action ? eq(auditLog.action, options.action) : undefined,
      options.actorUserId ? eq(auditLog.actorUserId, options.actorUserId) : undefined,
      options.entityType ? eq(auditLog.entityType, options.entityType) : undefined,
      options.entityId ? eq(auditLog.entityId, options.entityId) : undefined,
    ),
    limit: options.limit,
    cursor: options.cursor,
  })
}

/** The trail for one entity, oldest first — the history panel on a trip or reservation. */
export async function listEntityHistory(
  scope: TenantScope,
  entityType: string,
  entityId: string,
): Promise<Array<AuditLogEntry>> {
  return auditLogRepository.findMany(scope, {
    where: allOf(
      eq(auditLog.entityType, shortTextSchema.min(1).parse(entityType)),
      eq(auditLog.entityId, idSchema.parse(entityId)),
    ),
    orderBy: [asc(auditLog.createdAt)],
  })
}

/** Action counts for the workspace — the admin activity chart. */
export async function countAuditActions(
  scope: TenantScope,
  options: { readonly limit?: number } = {},
): Promise<Array<{ readonly action: string; readonly value: number }>> {
  const rows = await scope.db
    .select({ action: auditLog.action, value: count() })
    .from(auditLog)
    .where(tenantFilter(scope, auditLog))
    .groupBy(auditLog.action)
    .orderBy(desc(count()))
    .limit(options.limit ?? 20)
  return rows
}

/** Drops entries older than `before`. Retention only — never call this from a request path. */
export async function pruneAuditLog(scope: TenantScope, before: Date): Promise<number> {
  return auditLogRepository.removeWhere(scope, lt(auditLog.createdAt, before))
}
