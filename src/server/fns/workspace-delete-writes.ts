import { assertRole } from '#/server/repos/context'
import { AuthRequirementError } from '#/server/auth/tenant'
import { z } from 'zod'
import { getOrganization } from '#/server/repos/members'
import type { TenantScope } from '#/server/repos'

export const deleteWorkspaceInput = z.strictObject({
  expectedOrganizationId: z.string().min(1).max(128),
  name: z.string().min(1).max(60),
  password: z.string().min(1).max(1024).optional(),
})
export type DeleteWorkspaceInput = z.infer<typeof deleteWorkspaceInput>
export type DeleteWorkspaceRefusal =
  | 'workspace-changed'
  | 'name-mismatch'
  | 'password-required'
  | 'password-invalid'
  | 'session-not-fresh'
  | 'rate-limited'
  | 'unavailable'
  | 'billing-unavailable'
  | 'live-subscription'
  | 'has-other-members'
export type DeleteWorkspaceResult =
  | { ok: false; reason: DeleteWorkspaceRefusal }
  | { ok: true; complete: boolean }

/** The write interface; no client-selected id is ever passed to the driver. */
export async function deleteWorkspace(
  ports: {
    scope: TenantScope
    impersonated: boolean
    activated: boolean
    proof: (
      password?: string,
    ) => Promise<
      | 'password-required'
      | 'invalid-password'
      | 'session-not-fresh'
      | 'rate-limited'
      | null
    >
    start: () => Promise<DeleteWorkspaceResult>
  },
  input: DeleteWorkspaceInput,
): Promise<DeleteWorkspaceResult> {
  const parsed = deleteWorkspaceInput.parse(input)
  assertRole(ports.scope.ctx, 'workspace.delete', 'owner')
  if (ports.impersonated || ports.scope.ctx.impersonatedBy != null)
    throw new AuthRequirementError(
      'impersonated',
      'Workspace deletion is unavailable while impersonating someone.',
    )
  if (parsed.expectedOrganizationId !== ports.scope.ctx.organizationId)
    return { ok: false, reason: 'workspace-changed' }
  const organization = await getOrganization(ports.scope)
  if (
    parsed.name.trim().normalize('NFC') !==
    organization.name.trim().normalize('NFC')
  )
    return { ok: false, reason: 'name-mismatch' }
  if (!ports.activated) return { ok: false, reason: 'unavailable' }
  const reason = await ports.proof(parsed.password)
  if (reason !== null)
    return {
      ok: false,
      reason: reason === 'invalid-password' ? 'password-invalid' : reason,
    }
  return ports.start()
}
