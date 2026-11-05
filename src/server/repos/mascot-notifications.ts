import { asc, desc, eq, gte, isNull, lte, ne, or, sql } from 'drizzle-orm'
import { notifications } from '#/server/db/schema'
import { tenantFilter } from './base'
import type { TenantScope } from './base'

export async function listMascotNotifications(scope: TenantScope, now: Date) {
  return scope.db
    .select({
      id: notifications.id,
      type: notifications.type,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(
      tenantFilter(
        scope,
        notifications,
        eq(notifications.recipientUserId, scope.ctx.userId),
        eq(notifications.isRead, false),
        or(ne(notifications.type, 'action'), isNull(notifications.response)),
        gte(notifications.createdAt, new Date(now.getTime() - 7 * 86_400_000)),
        lte(notifications.createdAt, now),
      ),
    )
    .orderBy(
      sql`case when ${notifications.type} = 'action' then 0 else 1 end`,
      desc(notifications.createdAt),
      asc(notifications.id),
    )
    .limit(50)
}
