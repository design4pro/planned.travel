import { firstOrganizationIdFor, membershipRoleFor } from './provisioning'
import type { AuthDb } from './db'

/** Resolves membership for this request without changing the session or provisioning. */
export async function resolveActiveWorkspace(
  db: AuthDb,
  userId: string,
  activeOrganizationId: string | null,
): Promise<{ organizationId: string; role: string | null } | null> {
  if (activeOrganizationId) {
    const role = await membershipRoleFor(db, {
      userId,
      organizationId: activeOrganizationId,
    })
    if (role !== null) return { organizationId: activeOrganizationId, role }
  }
  const organizationId = await firstOrganizationIdFor(db, userId)
  if (!organizationId) return null
  const role = await membershipRoleFor(db, { userId, organizationId })
  return { organizationId, role }
}
