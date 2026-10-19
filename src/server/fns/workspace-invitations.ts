import { createServerFn } from '@tanstack/react-start'
import { appUrl } from '#/server/auth/env'
import { queueAuthEmail } from '#/server/auth/email'
import { appScope } from './context'
import {
  inviteToWorkspace,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  inviteWorkspaceInput,
  workspaceInvitationIdInput,
} from './workspace-invitation-writes'
import type { WorkspaceInvitationPorts } from './workspace-invitation-writes'

async function ports(): Promise<WorkspaceInvitationPorts> {
  return {
    scope: await appScope(),
    now: () => new Date(),
    baseUrl: appUrl(),
    send: (message) => queueAuthEmail(message, { throwOnFailure: true }),
  }
}
export const inviteWorkspaceFn = createServerFn({ method: 'POST' })
  .validator(inviteWorkspaceInput)
  .handler(async ({ data }) => inviteToWorkspace(await ports(), data))
export const resendWorkspaceInvitationFn = createServerFn({ method: 'POST' })
  .validator(workspaceInvitationIdInput)
  .handler(async ({ data }) => resendWorkspaceInvitation(await ports(), data))
export const revokeWorkspaceInvitationFn = createServerFn({ method: 'POST' })
  .validator(workspaceInvitationIdInput)
  .handler(async ({ data }) => revokeWorkspaceInvitation(await ports(), data))
