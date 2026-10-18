/**
 * Changing a member's role: the checks, in the order they run, and the audit entry that follows.
 *
 * Kept apart from `members.ts` for the reason `workspace-writes.ts` is kept apart from
 * `workspace.ts`: outside a Start build a server function discards its answer, so this plain
 * function is the half a test can hold, and what needs a request - the session and the tenant scope
 * - is a port the server function supplies.
 *
 * 1. impersonation - an operator wearing an account does not hand out authority as it. Promoting an
 *    owner creates power that outlives the impersonated session, and the impersonator stamp
 *    `docs/ACCESS.md` §6.4 promises is not written into the tenant trail, so allowing it would
 *    attribute the operator's promotion to the owner. It is refused before the scope is built, so
 *    nothing is read or written.
 * 2. the ceiling and the last-owner guard - `changeMemberRole` in `src/server/repos/members.ts`,
 *    which refuses before it writes.
 * 3. the audit entry - after the role is stored, once, and never when nothing changed.
 *
 * A refusal the reader can act on is returned (`ChangeMemberRoleResult`), because the repository's
 * own errors are redacted on their way to the browser; impersonation is thrown, because nothing
 * the reader can do changes the answer.
 */
import { z } from 'zod'

import { AUDIT_ACTIONS, trail } from '#/server/audit/trail'
import { AuthRequirementError } from '#/server/auth/tenant'
import { ORGANIZATION_ROLES } from '#/server/db/auth-schema'
import { MEMBER_ROLE_IMPERSONATED_KEY } from '#/lib/member-role-refusals'
import { RepositoryError, changeMemberRole, idSchema } from '#/server/repos'

import type { TenantScope } from '#/server/repos'

/**
 * `strictObject` because the tenant and the caller are not the client's to name: an
 * `organizationId`, a `userId` or the caller's own role on the payload would be a second, forgeable
 * input. `role` is one value of the enum, never the comma-joined list Better Auth's endpoint accepts.
 */
export const changeMemberRoleInput = z.strictObject({
  memberId: idSchema,
  role: z.enum(ORGANIZATION_ROLES),
})

export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleInput>

export type ChangeMemberRoleRefusal =
  /** The caller's role does not reach the change: not an owner, or an admin touching an owner. */
  | 'not-permitted'
  /** The change would leave the workspace without an owner. */
  | 'last-owner'
  /** The member is not in this workspace any more. */
  | 'not-found'

export type ChangeMemberRoleResult =
  | { readonly ok: true; readonly changed: boolean }
  | { readonly ok: false; readonly reason: ChangeMemberRoleRefusal }

/** What the request supplies; see the module note for why these are ports. */
export interface ChangeMemberRolePorts {
  /** True when the session was minted by an operator impersonating the caller, or is missing. */
  readonly impersonated: boolean
  /** Builds the caller's tenant scope. Not called for an impersonated session. */
  readonly scope: () => Promise<TenantScope>
}

const REFUSALS: Readonly<Record<string, ChangeMemberRoleRefusal | undefined>> =
  {
    FORBIDDEN: 'not-permitted',
    LAST_OWNER: 'last-owner',
    NOT_FOUND: 'not-found',
  }

export async function changeRole(
  ports: ChangeMemberRolePorts,
  input: ChangeMemberRoleInput,
): Promise<ChangeMemberRoleResult> {
  if (ports.impersonated) {
    throw new AuthRequirementError('impersonated', MEMBER_ROLE_IMPERSONATED_KEY)
  }
  const scope = await ports.scope()

  let change: Awaited<ReturnType<typeof changeMemberRole>>
  try {
    change = await changeMemberRole(scope, input.memberId, input.role)
  } catch (cause) {
    const reason =
      cause instanceof RepositoryError ? REFUSALS[cause.code] : undefined
    if (reason === undefined) throw cause
    return { ok: false, reason }
  }

  if (change.previousRole === change.member.role) {
    return { ok: true, changed: false }
  }
  await trail(scope, {
    action: AUDIT_ACTIONS.MEMBER_ROLE_CHANGED,
    entityType: 'member',
    entityId: change.member.id,
    metadata: {
      targetUserId: change.member.userId,
      from: change.previousRole,
      to: change.member.role,
    },
  })
  return { ok: true, changed: true }
}
