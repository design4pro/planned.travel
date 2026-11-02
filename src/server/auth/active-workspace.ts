import { parseWorkspaceClaim } from '#/lib/workspace-claim'
import {
  firstOrganizationIdFor,
  membershipRoleFor,
  resolveOrProvisionOrganization,
} from './provisioning'
import type { AuthSession, RequireOrgOptions } from './tenant'
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

/** Recover an unclaimed authenticated reload only after authoritative reads confirm no membership. */
export async function resolveSessionWorkspace(
  db: AuthDb,
  session: AuthSession,
  options: RequireOrgOptions = {},
): ReturnType<typeof resolveActiveWorkspace> {
  const resolved = await resolveActiveWorkspace(
    db,
    session.user.id,
    session.session.activeOrganizationId,
  )
  if (
    resolved ||
    parseWorkspaceClaim(options.claim).status !== 'absent' ||
    options.organizationId ||
    session.user.banned ||
    session.session.impersonatedBy
  )
    return resolved

  // shortcut: provisioning is sequentially idempotent; make it atomic for concurrent recovery in the workspace deletion spec.
  const organizationId = await resolveOrProvisionOrganization(
    db,
    session.user.id,
  )
  if (!organizationId) return null
  return resolveActiveWorkspace(db, session.user.id, organizationId)
}
