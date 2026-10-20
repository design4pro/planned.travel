import { z } from 'zod'
import { AUDIT_ACTIONS, trail } from '#/server/audit/trail'
import { INVITATION_TTL_SECONDS } from '#/server/auth/invitation-policy'
import { ORGANIZATION_ROLES } from '#/server/db/auth-schema'
import {
  createInvitation,
  renewInvitation,
  cancelInvitation,
  getOrganization,
  listMemberProfiles,
  idSchema,
  RepositoryError,
} from '#/server/repos'
import type { TenantScope } from '#/server/repos'
import type { TransactionalEmailMessage } from '#/server/auth/email'
import type { Invitation } from '#/server/db/types'

export const inviteWorkspaceInput = z.strictObject({
  email: z.string().trim().toLowerCase().email().max(320),
  role: z.enum(ORGANIZATION_ROLES),
})
export const workspaceInvitationIdInput = z.strictObject({
  invitationId: idSchema,
})
export type InvitationRefusal =
  | 'not-permitted'
  | 'not-found'
  | 'already-member'
  | 'invitation-exists'
  | 'quota'
export type WorkspaceInvitationResult =
  | {
      readonly ok: true
      readonly invitationId: string
      readonly delivered: boolean
    }
  | { readonly ok: false; readonly reason: InvitationRefusal }
export interface WorkspaceInvitationPorts {
  readonly scope: TenantScope
  readonly now: () => Date
  readonly baseUrl: string
  readonly send: (
    message: Extract<
      TransactionalEmailMessage,
      { kind: 'auth.organization-invitation' }
    >,
  ) => Promise<void>
  readonly audit?: typeof trail
}
const REFUSALS: Readonly<Record<string, InvitationRefusal | undefined>> = {
  FORBIDDEN: 'not-permitted',
  NOT_FOUND: 'not-found',
  ALREADY_MEMBER: 'already-member',
  INVITATION_EXISTS: 'invitation-exists',
  QUOTA_EXCEEDED: 'quota',
}
function expiry(ports: WorkspaceInvitationPorts): Date {
  return new Date(ports.now().getTime() + INVITATION_TTL_SECONDS * 1000)
}
async function perform(
  ports: WorkspaceInvitationPorts,
  operation: () => Promise<Invitation>,
  action:
    | typeof AUDIT_ACTIONS.MEMBER_INVITED
    | typeof AUDIT_ACTIONS.MEMBER_INVITATION_RESENT
    | typeof AUDIT_ACTIONS.MEMBER_INVITATION_REVOKED,
): Promise<WorkspaceInvitationResult> {
  let row: Invitation
  try {
    row = await operation()
  } catch (cause) {
    const reason =
      cause instanceof RepositoryError ? REFUSALS[cause.code] : undefined
    if (reason) return { ok: false, reason }
    throw cause
  }
  // trail owns failure containment and impersonator attribution. Injected adapters follow it too.
  await (ports.audit ?? trail)(ports.scope, {
    action,
    entityType: 'invitation',
    entityId: row.id,
    metadata: { email: row.email, role: row.role },
  }).catch(() => undefined)
  if (action === AUDIT_ACTIONS.MEMBER_INVITATION_REVOKED)
    return { ok: true, invitationId: row.id, delivered: false }
  let delivered = false
  try {
    const [organization, members] = await Promise.all([
      getOrganization(ports.scope),
      listMemberProfiles(ports.scope),
    ])
    const inviter = members.find((person) => person.userId === row.inviterId)
    await ports.send({
      kind: 'auth.organization-invitation',
      to: row.email,
      invitedByName: inviter?.name ?? organization.name,
      invitedByEmail: inviter?.email ?? '',
      organizationName: organization.name,
      role: row.role ?? 'member',
      url: `${ports.baseUrl}/accept-invitation/${encodeURIComponent(row.id)}`,
      expiresInHours: INVITATION_TTL_SECONDS / 3600,
    })
    delivered = true
  } catch {
    /* The row remains pending; explicit Resend is the recovery path. */
  }
  return { ok: true, invitationId: row.id, delivered }
}
export async function inviteToWorkspace(
  ports: WorkspaceInvitationPorts,
  input: z.infer<typeof inviteWorkspaceInput>,
) {
  const values = inviteWorkspaceInput.parse(input)
  return perform(
    ports,
    () =>
      createInvitation(ports.scope, { ...values, expiresAt: expiry(ports) }),
    AUDIT_ACTIONS.MEMBER_INVITED,
  )
}
export async function resendWorkspaceInvitation(
  ports: WorkspaceInvitationPorts,
  input: z.infer<typeof workspaceInvitationIdInput>,
) {
  const { invitationId } = workspaceInvitationIdInput.parse(input)
  return perform(
    ports,
    () => renewInvitation(ports.scope, invitationId, expiry(ports)),
    AUDIT_ACTIONS.MEMBER_INVITATION_RESENT,
  )
}
export async function revokeWorkspaceInvitation(
  ports: WorkspaceInvitationPorts,
  input: z.infer<typeof workspaceInvitationIdInput>,
) {
  const { invitationId } = workspaceInvitationIdInput.parse(input)
  return perform(
    ports,
    () => cancelInvitation(ports.scope, invitationId),
    AUDIT_ACTIONS.MEMBER_INVITATION_REVOKED,
  )
}
