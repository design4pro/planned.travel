/**
 * Creating a workspace: the checks, in the order they run, and the batch that follows them.
 *
 * Kept apart from `workspace.ts` for the reason `stay-writes.ts` is kept apart from `stays.ts`:
 * outside a Start build a server function discards its answer, so this plain function is the half a
 * test can hold. Everything that needs a request - the session, the auth API, the D1 handle - is a
 * port the server function supplies.
 *
 * Better Auth's own `organization/create` is shut (`allowUserToCreateOrganization: false`), so
 * nothing the plugin would have checked is checked for us. Each rule below is one the plugin's
 * endpoint did not have, or enforced somewhere this path never reaches:
 *
 * 1. the role - creating is a billing-adjacent act, so `admin` is the minimum, as `canManageBilling`;
 * 2. impersonation - an operator wearing an account does not create workspaces as it;
 * 3. the plan - Free has the one workspace it was provisioned with;
 * 4. the limit - the plugin counts only inside its own endpoint.
 *
 * A refusal is returned rather than thrown where the reader can act on it (`CreateWorkspaceResult`),
 * and thrown where nothing they can do changes the answer (impersonation). Every refusal arm writes
 * nothing.
 */
import { z } from 'zod'

import {
  WORKSPACE_LIMIT,
  createOrganizationFor,
} from '#/server/auth/provisioning'
import { AuthRequirementError, roleSatisfies } from '#/server/auth/tenant'
import { resolveQuotas } from '#/server/repos'

import type { AuthDb } from '#/server/auth/db'
import type { TenantScope } from '#/server/repos'

/**
 * `strictObject` because the tenant is not the client's to name: an `organizationId`, a `userId` or
 * a `slug` on the payload would be a second, forgeable input. The slug is derived on the server.
 */
export const createWorkspaceInput = z.strictObject({
  name: z.string().trim().min(1).max(60),
})

/**
 * The lowest organization role that may create a workspace (docs/ACCESS.md §2.7). `admin`, the same
 * floor `canManageBilling` sets: creating is the first step to a billed workspace.
 */
export const MIN_ROLE_TO_CREATE_WORKSPACE = 'admin' as const

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceInput>

export type CreateWorkspaceRefusal =
  /** The caller's current workspace is on Free: one workspace is what the plan means. */
  | 'upgrade-required'
  /** The account already belongs to {@link WORKSPACE_LIMIT} workspaces. */
  | 'limit-reached'
  /** The caller is a `member` of the workspace they are in, below the `admin` minimum. */
  | 'role-required'

export type CreateWorkspaceResult =
  | { readonly ok: true; readonly organizationId: string }
  | { readonly ok: false; readonly reason: CreateWorkspaceRefusal }

/** What the request supplies; see the module note for why these are ports. */
export interface CreateWorkspacePorts {
  readonly scope: TenantScope
  readonly db: AuthDb
  /** True when the session was minted by an operator impersonating the caller. */
  readonly impersonated: boolean
  /** How many workspaces the caller belongs to, across every plan. */
  readonly countMemberships: () => Promise<number>
  /** Makes the new workspace the session's active one. */
  readonly activate: (organizationId: string) => Promise<void>
}

/**
 * Creates a workspace owned by the caller and makes it their active one.
 *
 * Activation runs after the batch, which is already committed, so a failure there throws with the
 * workspace written: it is reachable from the switcher, and the reader is told the create failed to
 * finish rather than being left to retry into a second one.
 *
 * Two concurrent creates can both read a count of {@link WORKSPACE_LIMIT} minus one and both write,
 * ending at most one over. The count and the batch are separate statements because the count is the
 * auth API's and the batch is the provisioning module's; the overshoot is bounded by the number of
 * requests in flight in a window of milliseconds, and the workspace limit protects the switcher's
 * length, not money - the money gate is the plan, which a created workspace does not widen.
 */
export async function createWorkspace(
  ports: CreateWorkspacePorts,
  input: CreateWorkspaceInput,
): Promise<CreateWorkspaceResult> {
  const { scope } = ports

  if (!roleSatisfies(scope.ctx.role, MIN_ROLE_TO_CREATE_WORKSPACE)) {
    return { ok: false, reason: 'role-required' }
  }

  if (ports.impersonated) {
    throw new AuthRequirementError(
      'impersonated',
      'Creating a workspace is unavailable while you are impersonating someone.',
    )
  }

  if ((await resolveQuotas(scope)).planId === 'free') {
    return { ok: false, reason: 'upgrade-required' }
  }

  if ((await ports.countMemberships()) >= WORKSPACE_LIMIT) {
    return { ok: false, reason: 'limit-reached' }
  }

  const organizationId = await createOrganizationFor(
    ports.db,
    { id: scope.ctx.userId },
    { name: input.name, metadata: null },
  )

  await ports.activate(organizationId)

  return { ok: true, organizationId }
}
