/**
 * Unscoped exception: organizationExistsForRetentionUnscoped answers only whether
 * the exact key's organization exists. Its sole production caller is the weekly
 * retention ownership adapter. It never selects tenant content.
 */
import { eq } from 'drizzle-orm'
import { organization } from '#/server/db/auth-schema'
import type { Database } from '#/server/db/types'

export async function organizationExistsForRetentionUnscoped(
  db: Database,
  organizationId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1)
  return rows.length > 0
}
