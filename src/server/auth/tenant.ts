/**
 * Tenant context derivation.
 *
 * Kept free of Worker bindings and request plumbing so the rules that decide
 * "who is this, and which tenant may they touch" are unit-testable in isolation
 * from the transport that supplies the session.
 */
import {
  parseWorkspaceClaim,
  WORKSPACE_CHANGED_KEY,
} from '#/lib/workspace-claim'
import { ORGANIZATION_ROLES } from '#/server/db/auth-schema'
import { asDate, isImpersonationExpired } from './impersonation-expiry'
import type { OrganizationRole } from '#/server/db/auth-schema'

export type { OrganizationRole }

/**
 * The authenticated user, as the app needs it.
 *
 * The last four fields are Better Auth's `admin` plugin columns (docs/SPEC.md §5). They are read
 * by the permission guard and by the shell; nothing in the client may write them, and
 * {@link normaliseSession} is the only door they come through.
 */
export type AuthUser = {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image: string | null
  twoFactorEnabled: boolean
  /**
   * The platform role, verbatim. `null` for an account that has never been raised, and a value
   * outside the three platform roles is possible because the column carries no `CHECK`; both
   * resolve to `user` in the guard, never to "unset, therefore permissive"
   * (docs/ACCESS.md §1.3).
   */
  role: string | null
  banned: boolean
  banReason: string | null
  banExpires: Date | null
}

/** The active session, as the app needs it. */
export type AuthSessionRecord = {
  id: string
  token: string
  userId: string
  activeOrganizationId: string | null
  expiresAt: Date
  /**
   * The operator acting as this session's user, when the session was minted by impersonation.
   * `null` on every ordinary session. The shell's warning bar renders on this
   * (docs/ACCESS.md §6.1).
   */
  impersonatedBy: string | null
}

export type AuthSession = {
  user: AuthUser
  session: AuthSessionRecord
}

/**
 * The explicit tenant context every repository call takes
 * (docs/SPEC.md §5: no query runs without one).
 */
export type TenantContext = {
  organizationId: string
  userId: string
  role: OrganizationRole
  /**
   * The operator behind an impersonated session, `null` for an ordinary one. Read off the session
   * here and nowhere else, so `trail()` can name the operator in the tenant audit entry
   * (docs/ACCESS.md §6.4) without a caller being able to state it.
   */
  impersonatedBy: string | null
}

/** Ordered most privileged first; index doubles as the privilege rank. */
const ROLE_RANK: Record<OrganizationRole, number> = {
  owner: 0,
  admin: 1,
  member: 2,
}

export function isOrganizationRole(value: unknown): value is OrganizationRole {
  return (
    typeof value === 'string' &&
    (ORGANIZATION_ROLES as ReadonlyArray<string>).includes(value)
  )
}

/**
 * True when `role` is at least as privileged as `minimum`.
 * `owner` satisfies every requirement, `member` only satisfies `member`.
 */
export function roleSatisfies(
  role: OrganizationRole,
  minimum: OrganizationRole,
): boolean {
  return ROLE_RANK[role] <= ROLE_RANK[minimum]
}

/**
 * Why an auth requirement could not be met.
 *
 * One vocabulary for every denial, tenant and platform alike. The last three are the platform
 * guard's: a banned account, a role that does not hold the statement, and an impersonated session
 * reaching for a platform capability §6.4 vetoes. `workspace-changed` is a tab that states a
 * workspace other than the session's effective one (`src/lib/workspace-claim.ts`): the caller is
 * not refused for who they are but for which workspace they believe they are in, which is why it is
 * not `not-a-member`. A second denial type beside this one would be a second answer to "why was
 * this refused".
 */
export type AuthFailureReason =
  | 'unauthenticated'
  | 'no-active-organization'
  | 'not-a-member'
  | 'insufficient-role'
  | 'banned'
  | 'insufficient-platform-permission'
  | 'impersonated'
  | 'workspace-changed'

export class AuthRequirementError extends Error {
  readonly reason: AuthFailureReason
  readonly status: 401 | 403

  constructor(reason: AuthFailureReason, message: string) {
    super(message)
    this.name = 'AuthRequirementError'
    this.reason = reason
    this.status = reason === 'unauthenticated' ? 401 : 403
  }
}

export function isAuthRequirementError(
  error: unknown,
): error is AuthRequirementError {
  return error instanceof AuthRequirementError
}

/** Narrows a session to its user, or explains why there isn't one. */
export function requireUserFrom(session: AuthSession | null): AuthUser {
  if (!session) {
    throw new AuthRequirementError(
      'unauthenticated',
      'You need to sign in to continue.',
    )
  }
  return session.user
}

export type RequireOrgOptions = {
  /** Minimum role the caller must hold. Defaults to `member`. */
  role?: OrganizationRole
  /**
   * Pin the context to one organization. When given, it must match the
   * request's resolved organization — a mismatch is a tenancy violation, never a
   * silent switch.
   */
  organizationId?: string
  /**
   * The workspace the calling tab says it is showing, verbatim from its request header
   * (`WORKSPACE_CLAIM_HEADER`). Compared with the resolved organization and never used to choose
   * it: absent is allowed, a different or malformed value is `workspace-changed`.
   */
  claim?: string | null
}

/**
 * Builds the tenant context for the active organization, enforcing the minimum
 * role. The caller re-reads the role from `member` for the resolved workspace and
 * supplies a session carrying that workspace for this request.
 */
export function requireOrgFrom(
  session: AuthSession | null,
  membershipRole: string | null,
  options: RequireOrgOptions = {},
): TenantContext {
  const user = requireUserFrom(session)
  const activeOrganizationId = session?.session.activeOrganizationId ?? null

  if (!activeOrganizationId) {
    throw new AuthRequirementError(
      'no-active-organization',
      'Choose a workspace before continuing.',
    )
  }

  const claim = parseWorkspaceClaim(options.claim)
  if (
    claim.status === 'malformed' ||
    (claim.status === 'valid' && claim.organizationId !== activeOrganizationId)
  ) {
    throw new AuthRequirementError('workspace-changed', WORKSPACE_CHANGED_KEY)
  }

  if (
    options.organizationId &&
    options.organizationId !== activeOrganizationId
  ) {
    throw new AuthRequirementError(
      'not-a-member',
      'You do not have access to that workspace.',
    )
  }

  if (!isOrganizationRole(membershipRole)) {
    throw new AuthRequirementError(
      'not-a-member',
      'You are not a member of this workspace.',
    )
  }

  const minimum = options.role ?? 'member'
  if (!roleSatisfies(membershipRole, minimum)) {
    throw new AuthRequirementError(
      'insufficient-role',
      `This action needs the ${minimum} role.`,
    )
  }

  return {
    organizationId: activeOrganizationId,
    userId: user.id,
    role: membershipRole,
    impersonatedBy: session?.session.impersonatedBy ?? null,
  }
}

type RawSession = {
  user: Record<string, unknown>
  session: Record<string, unknown>
} | null

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * Normalises what Better Auth returns into the app's own session shape,
 * returning `null` for anything that is not a complete, usable session.
 */
export function normaliseSession(
  raw: RawSession,
  now: Date = new Date(),
): AuthSession | null {
  if (!raw) return null

  const userId = asString(raw.user.id)
  const email = asString(raw.user.email)
  const sessionId = asString(raw.session.id)
  const token = asString(raw.session.token)
  const expiresAt = asDate(raw.session.expiresAt)

  if (!userId || !email || !sessionId || !token || !expiresAt) return null

  // An impersonated session is bounded by its age, not only by its stored expiry: a row that was
  // already pushed 30 days out by the sliding refresh must stop authorising (docs/ACCESS.md §6.2).
  const impersonatedBy = asString(raw.session.impersonatedBy)
  if (
    isImpersonationExpired(
      { impersonatedBy, createdAt: raw.session.createdAt },
      now,
    )
  ) {
    return null
  }

  return {
    user: {
      id: userId,
      email,
      name: asString(raw.user.name) ?? email,
      emailVerified: raw.user.emailVerified === true,
      image: asString(raw.user.image),
      twoFactorEnabled: raw.user.twoFactorEnabled === true,
      role: asString(raw.user.role),
      banned: raw.user.banned === true,
      banReason: asString(raw.user.banReason),
      banExpires: asDate(raw.user.banExpires),
    },
    session: {
      id: sessionId,
      token,
      userId: asString(raw.session.userId) ?? userId,
      activeOrganizationId: asString(raw.session.activeOrganizationId),
      expiresAt,
      impersonatedBy,
    },
  }
}
