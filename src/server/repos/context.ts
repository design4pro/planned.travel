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
const ROLE_RANK: Record<OrganizationRole, number> = {
  member: 0,
  admin: 1,
  owner: 2,
}

/** Identifies the acting user and the single organization whose rows they may touch. */
export interface TenantContext {
  /** `user.id` of the acting principal. */
  readonly userId: string
  /** `organization.id` every row read or written in this call must belong to. */
  readonly organizationId: string
  /** The principal's role inside that organization. */
  readonly role: OrganizationRole
  /**
   * The operator acting as `userId`, when the session behind this context was minted by
   * impersonation; `null` for an ordinary session and for every context no session stands behind
   * (a queue handler, a seed, a probe). Required rather than optional so a construction that forgets
   * it is refused by {@link requireTenantContext} instead of silently stamping nothing. `trail()`
   * writes it into `audit_log.metadata` (docs/ACCESS.md §6.4).
   */
  readonly impersonatedBy: string | null
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

/**
 * Thrown when the context is valid but the role is insufficient.
 *
 * It answers the same question as `TripRoleError` in `trips.ts`, and unlike that class it is
 * deliberately not authored copy: `classifyFailure` redacts it, and the reader sees the caller's
 * localised fallback. Its sentence is written for a maintainer. `action` is typed `string`, so what
 * it interpolates is only as safe as every call site stays, and `required` is not always the
 * reader's way out - `collab.ts` refuses an edit to another traveller's message with `['owner']`
 * although no role may make it. Authoring it would also add a class to the English refusal set
 * `docs/SPEC.md` §9 rule 10 closes. Should this refusal ever need to reach the reader, it travels
 * as a message key, not as this sentence.
 */
export class ForbiddenError extends RepositoryError {
  constructor(action: string, required: ReadonlyArray<OrganizationRole>) {
    super(
      `Role not permitted to ${action}; requires one of: ${required.join(', ')}.`,
      'FORBIDDEN',
    )
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
    super(
      `Quota for ${metric} reached (${current}/${limit}).`,
      'QUOTA_EXCEEDED',
    )
  }
}

const identifier = z.string().trim().min(1).max(64)

/** Validates a tenant context arriving from a session, a queue message or a Durable Object. */
export const tenantContextSchema: z.ZodType<TenantContext> = z.object({
  userId: identifier,
  organizationId: identifier,
  role: z.enum(ORGANIZATION_ROLES),
  impersonatedBy: identifier.nullable(),
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
      .map(
        (issue) =>
          `${issue.path.join('.') || 'context'} ${issue.message.toLowerCase()}`,
      )
      .join('; ')
    throw new MissingTenantContextError(detail)
  }

  return Object.freeze({
    userId: parsed.data.userId,
    organizationId: parsed.data.organizationId,
    role: parsed.data.role,
    impersonatedBy: parsed.data.impersonatedBy,
  })
}

/** True when the context's role is at least as privileged as `minimum`. */
export function hasAtLeastRole(
  context: TenantContext,
  minimum: OrganizationRole,
): boolean {
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
export function assertCanAdminister(
  context: TenantContext,
  action: string,
): void {
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

/**
 * SQLite's constraint sub-codes for the two indexes that can refuse a duplicate:
 * `SQLITE_CONSTRAINT_PRIMARYKEY` and `SQLITE_CONSTRAINT_UNIQUE`.
 */
const UNIQUE_CONSTRAINT_CODES: ReadonlySet<number> = new Set([1555, 2067])

/** How far down a `cause` chain {@link isUniqueConstraintViolation} will look. */
const CAUSE_DEPTH = 8

function errorCode(value: object): number | null {
  const code: unknown = (value as { errcode?: unknown }).errcode
  return typeof code === 'number' ? code : null
}

/**
 * True when `cause` is a database refusal from a unique index.
 *
 * The chain has to be walked because no two drivers agree on where the refusal
 * ends up. The proxy driver the tests run against wraps it: the outer error says
 * "Failed query: insert into …" and carries the real one as `cause`, with
 * `errcode` 2067 on it. D1 in the Worker throws its own error whose message is
 * `D1_ERROR: UNIQUE constraint failed: …: SQLITE_CONSTRAINT` and carries no
 * numeric code at all. Matching either the sub-code or the sentence SQLite emits
 * covers both without asking the caller which runtime it is in.
 */
export function isUniqueConstraintViolation(cause: unknown): boolean {
  let current: unknown = cause
  for (let depth = 0; depth < CAUSE_DEPTH; depth += 1) {
    if (typeof current !== 'object' || current === null) {
      return false
    }
    const code = errorCode(current)
    if (code !== null && UNIQUE_CONSTRAINT_CODES.has(code)) {
      return true
    }
    if (
      current instanceof Error &&
      /unique constraint failed/i.test(current.message)
    ) {
      return true
    }
    current = (current as { cause?: unknown }).cause
  }
  return false
}
