/**
 * The tenant context — the only thing that authorises a repository call.
 *
 * Nothing in `src/server/repos/**` reads a row without one, and a context can only be produced by
 * {@link requireTenantContext}, which rejects anything malformed. Server functions build it from
 * the authenticated session; there is no ambient or default tenant anywhere in the codebase.
 */

import { z } from 'zod'
import { ORGANIZATION_ROLES } from '#/server/db/auth-schema'
import type { OrganizationRole } from '#/server/db/auth-schema'

export type { OrganizationRole }

/** Roles ordered from least to most privileged, used by {@link hasAtLeastRole}. */
const ROLE_RANK: Record<OrganizationRole, number> = { member: 0, admin: 1, owner: 2 }

/** Identifies the acting user and the single organization whose rows they may touch. */
export interface TenantContext {
  /** `user.id` of the acting principal. */
  readonly userId: string
  /** `organization.id` every row read or written in this call must belong to. */
  readonly organizationId: string
  /** The principal's role inside that organization. */
  readonly role: OrganizationRole
}

/** Base class for every error the repository layer raises, so callers can map them to HTTP codes. */
export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message)
    this.name = new.target.name
  }
}

/** Thrown when a repository is called without a usable tenant context. */
export class MissingTenantContextError extends RepositoryError {
  constructor(detail: string) {
    super(`Tenant context is required: ${detail}.`, 'MISSING_TENANT_CONTEXT')
  }
}

/**
 * Thrown when a call would have crossed a tenant boundary. In practice the scoped query helpers
 * make this unreachable through `WHERE organization_id = ?`; it exists so the few places that
 * receive a pre-loaded row can re-assert ownership and fail loudly rather than silently leaking.
 */
export class TenantIsolationError extends RepositoryError {
  constructor(entity: string) {
    super(`Cross-tenant access to ${entity} was rejected.`, 'TENANT_ISOLATION')
  }
}

/** Thrown when the context is valid but the role is insufficient. */
export class ForbiddenError extends RepositoryError {
  constructor(action: string, required: ReadonlyArray<OrganizationRole>) {
    super(`Role not permitted to ${action}; requires one of: ${required.join(', ')}.`, 'FORBIDDEN')
  }
}

/** Thrown when a row addressed by id does not exist inside the caller's tenant. */
export class NotFoundError extends RepositoryError {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} was not found.`, 'NOT_FOUND')
  }
}

/** Thrown when a write would take the tenant past its plan quota. */
export class QuotaExceededError extends RepositoryError {
  constructor(
    readonly metric: string,
    readonly limit: number,
    readonly current: number,
  ) {
    super(`Quota for ${metric} reached (${current}/${limit}).`, 'QUOTA_EXCEEDED')
  }
}

const identifier = z.string().trim().min(1).max(64)

/** Validates a tenant context arriving from a session, a queue message or a Durable Object. */
export const tenantContextSchema: z.ZodType<TenantContext> = z.object({
  userId: identifier,
  organizationId: identifier,
  role: z.enum(ORGANIZATION_ROLES),
})

/**
 * The single gate into the repository layer: returns a frozen, validated {@link TenantContext} or
 * throws. Every scope is built through it, so an unauthenticated or half-populated context can
 * never reach a query builder.
 */
export function requireTenantContext(context: unknown): TenantContext {
  if (context === null || context === undefined) {
    throw new MissingTenantContextError('no context was supplied')
  }

  const parsed = tenantContextSchema.safeParse(context)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'context'} ${issue.message.toLowerCase()}`)
      .join('; ')
    throw new MissingTenantContextError(detail)
  }

  return Object.freeze({
    userId: parsed.data.userId,
    organizationId: parsed.data.organizationId,
    role: parsed.data.role,
  })
}

/** True when the context's role is at least as privileged as `minimum`. */
export function hasAtLeastRole(context: TenantContext, minimum: OrganizationRole): boolean {
  return ROLE_RANK[context.role] >= ROLE_RANK[minimum]
}

/** Throws {@link ForbiddenError} unless the context holds one of the listed roles. */
export function assertRole(
  context: TenantContext,
  action: string,
  ...allowed: ReadonlyArray<OrganizationRole>
): void {
  if (allowed.length === 0) {
    throw new ForbiddenError(action, ORGANIZATION_ROLES)
  }
  if (!allowed.includes(context.role)) {
    throw new ForbiddenError(action, allowed)
  }
}

/** Throws {@link ForbiddenError} unless the context is an `admin` or `owner`. */
export function assertCanAdminister(context: TenantContext, action: string): void {
  if (!hasAtLeastRole(context, 'admin')) {
    throw new ForbiddenError(action, ['owner', 'admin'])
  }
}

/**
 * Re-asserts that an already-loaded row belongs to the caller's tenant. Used for rows that arrive
 * from outside a scoped query — a websocket payload, a queue message, a share-link lookup.
 */
export function assertSameTenant<TRow extends { organizationId: string }>(
  context: TenantContext,
  entity: string,
  row: TRow | null | undefined,
): TRow {
  if (!row || row.organizationId !== context.organizationId) {
    throw new TenantIsolationError(entity)
  }
  return row
}
