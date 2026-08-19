/**
 * Server-side session access.
 *
 * These are the only sanctioned ways for a server function, loader or server
 * route to learn who is calling. The decision logic lives in `./tenant` so it
 * can be tested without a request; this module supplies the request.
 */
import { getRequest } from '@tanstack/react-start/server'
import { authDb } from './db'
import { getAuth } from './index'
import {
  membershipRoleFor,
  resolveOrProvisionOrganization,
} from './provisioning'
import {
  AuthRequirementError,
  normaliseSession,
  requireOrgFrom,
  requireUserFrom,
} from './tenant'
import type {
  AuthSession,
  AuthUser,
  RequireOrgOptions,
  TenantContext,
} from './tenant'

export {
  AuthRequirementError,
  isAuthRequirementError,
  roleSatisfies,
} from './tenant'
export type {
  AuthSession,
  AuthUser,
  OrganizationRole,
  RequireOrgOptions,
  TenantContext,
} from './tenant'

/**
 * The current session, or `null` when the caller is anonymous.
 *
 * Reads the signed cookie cache first (Better Auth handles that internally), so
 * the common case costs no KV or D1 round trip.
 */
export async function getSession(): Promise<AuthSession | null> {
  const request = getRequest()
  const result = await getAuth().api.getSession({ headers: request.headers })
  return normaliseSession(result ?? null)
}

/**
 * The current user, or a thrown `AuthRequirementError` with status 401.
 * Use in any server function that must not run anonymously.
 */
export async function requireUser(): Promise<AuthUser> {
  return requireUserFrom(await getSession())
}

/**
 * The tenant context for the caller's active organization.
 *
 * The membership role is re-read from `member` rather than trusted from the
 * session, so a revoked or downgraded membership takes effect immediately
 * instead of lingering for the life of a cookie.
 */
export async function requireOrg(
  options: RequireOrgOptions = {},
): Promise<TenantContext> {
  const session = await getSession()
  const user = requireUserFrom(session)
  let organizationId = session?.session.activeOrganizationId ?? null

  if (!organizationId) {
    // Sessions issued before the active organization could be resolved (and any
    // whose cookie cache predates it) would otherwise be stranded on every
    // authenticated screen. Adopt the user's own oldest membership for this
    // request instead of failing; `session.create.before` is what makes new
    // sessions carry it durably.
    organizationId = await resolveOrProvisionOrganization(authDb(), user.id)
  }

  if (!organizationId) {
    throw new AuthRequirementError(
      'no-active-organization',
      'Choose a workspace before continuing.',
    )
  }

  const role = await membershipRoleFor(authDb(), {
    userId: user.id,
    organizationId,
  })

  // `requireOrgFrom` is deliberately pure and reads the active organization off
  // the session, so hand it the organization this request actually resolved.
  const effective: AuthSession | null = session
    ? { ...session, session: { ...session.session, activeOrganizationId: organizationId } }
    : session

  return requireOrgFrom(effective, role, options)
}
