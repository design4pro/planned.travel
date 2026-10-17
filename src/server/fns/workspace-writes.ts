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
 * 3. the limit - the plugin counts only inside its own endpoint;
 * 4. the plan - Free has the one workspace it was provisioned with.
 *
 * The limit runs before the plan, so an account that already belongs to the most workspaces is told
 * so rather than sent to pay for a create it would still be refused.
 *
 * A refusal is returned rather than thrown where the reader can act on it (`CreateWorkspaceResult`),
 * and thrown where nothing they can do changes the answer (impersonation). Every refusal arm writes
 * nothing.
 */
import { z } from 'zod'

import {
  WORKSPACE_LIMIT,
  createOrganizationWithinLimit,
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
  | {
      readonly ok: true
      readonly organizationId: string
      /** False when the workspace was written but could not be made the active one. */
      readonly activated: boolean
    }
  | { readonly ok: false; readonly reason: CreateWorkspaceRefusal }

/**
 * Whether the session is an operator impersonating the caller. Fails closed: no session at all
 * counts as impersonated, so a misread session refuses rather than lets the create through.
 */
export function isImpersonated(
  session: { session: { impersonatedBy?: string | null } } | null,
): boolean {
  return session === null || session.session.impersonatedBy != null
}

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
  /** Told why activation failed, which the reader is not: the result carries only `activated: false`. */
  readonly onActivationFailed?: (cause: unknown) => void
}

/**
 * Creates a workspace owned by the caller and makes it their active one.
 *
 * Activation runs after the batch, which is already committed, so a failure there is not an error:
 * the workspace exists and the switcher lists it. It is returned as `activated: false`, so the
 * reader is told to pick it from the menu rather than being left to retry into a second one.
 *
 * The limit is checked twice. The count before the write gives the early, harmless refusal; the
 * write itself (`createOrganizationWithinLimit`) is what holds the limit when several creates are
 * in flight, because the count and the batch are separate statements and each racing request would
 * otherwise read the same count and write.
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

  if ((await ports.countMemberships()) >= WORKSPACE_LIMIT) {
    return { ok: false, reason: 'limit-reached' }
  }

  if ((await resolveQuotas(scope)).planId === 'free') {
    return { ok: false, reason: 'upgrade-required' }
  }

  const organizationId = await createOrganizationWithinLimit(
    ports.db,
    { id: scope.ctx.userId },
    { name: input.name, metadata: null },
    WORKSPACE_LIMIT,
  )
  if (organizationId === null) return { ok: false, reason: 'limit-reached' }

  const activated = await ports
    .activate(organizationId)
    .then(() => true)
    .catch((cause: unknown) => {
      ports.onActivationFailed?.(cause)
      return false
    })

  return { ok: true, organizationId, activated }
}
