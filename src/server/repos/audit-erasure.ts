/** The sole updater of the tenant audit trail, for worker-only erasure. */
import { asc, eq, gt } from 'drizzle-orm'
import { auditLog } from '#/server/db/schema'
import { allOf, anyOf, createTenantRepository } from './base'
import { assertErasure } from './erasure-write'
import type { TenantScope } from './base'

export async function eraseUserAudit(
  scope: TenantScope,
  userId: string,
  formerMemberId: string,
): Promise<void> {
  assertErasure(scope, userId, formerMemberId)
  const repo = createTenantRepository(auditLog, 'audit entry')
  let after: string | undefined
  for (;;) {
    const rows = await repo.findMany(scope, {
      where: allOf(
        anyOf(eq(auditLog.actorUserId, userId), eq(auditLog.entityId, userId)),
        after ? gt(auditLog.id, after) : undefined,
      ),
      orderBy: [asc(auditLog.id)],
      limit: 40,
    })
    if (rows.length === 0) return
    for (const row of rows) {
      const metadata =
        row.metadata === null
          ? null
          : Object.fromEntries(
              Object.entries(row.metadata).filter(
                ([key]) =>
                  /file_?name$/i.test(key) ||
                  !(
                    /^(name|email)$/i.test(key) ||
                    /(?:Name|Email|_name|_email)$/.test(key)
                  ),
              ),
            )
      await repo.requireUpdate(scope, row.id, {
        actorUserId:
          row.actorUserId === userId ? formerMemberId : row.actorUserId,
        entityId: row.entityId === userId ? formerMemberId : row.entityId,
        ip: null,
        userAgent: null,
        metadata,
      })
    }
    after = rows.at(-1)?.id
  }
}
