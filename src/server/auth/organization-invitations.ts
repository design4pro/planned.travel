import { APIError, createAuthEndpoint } from 'better-auth/api'
import { getOrgAdapter, organization } from 'better-auth/plugins/organization'
import { createScope } from '#/server/repos/base'
import {
  acceptWorkspaceInvitation,
  rejectWorkspaceInvitation,
  resolveWorkspaceInvitationScopeUnscoped,
} from '#/server/repos/workspace-invitation-acceptance'
import type { OrganizationOptions } from 'better-auth/plugins/organization'
import type { Database } from '#/server/db/types'

/** Reuses the installed endpoint options for HTTP and auth.api; only consumption is replaced. */
export function organizationWithAtomicInvitations(
  options: OrganizationOptions,
  database: () => Database,
) {
  if (options.teams?.enabled || options.membershipLimit !== 100)
    throw new Error(
      'Atomic invitations require the configured no-team, 100-member contract.',
    )
  const plugin = organization(options)
  const accept = plugin.endpoints.acceptInvitation
  const reject = plugin.endpoints.rejectInvitation
  const notFound = () =>
    APIError.from('BAD_REQUEST', plugin.$ERROR_CODES.INVITATION_NOT_FOUND)

  const acceptInvitation = createAuthEndpoint(
    accept.path,
    accept.options,
    async (ctx) => {
      const session = ctx.context.session
      const adapter = getOrgAdapter(ctx.context, options)
      const invitation = await adapter.findInvitationById(ctx.body.invitationId)
      if (
        !invitation ||
        invitation.status !== 'pending' ||
        invitation.expiresAt < new Date()
      )
        throw notFound()
      if (invitation.email.toLowerCase() !== session.user.email.toLowerCase())
        throw APIError.from(
          'FORBIDDEN',
          plugin.$ERROR_CODES.YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION,
        )
      if (!session.user.emailVerified)
        throw APIError.from(
          'FORBIDDEN',
          plugin.$ERROR_CODES
            .EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION,
        )
      const workspace = await adapter.findOrganizationById(
        invitation.organizationId,
      )
      if (!workspace) throw notFound()
      if ((await adapter.countMembers({ organizationId: workspace.id })) >= 100)
        throw APIError.from(
          'FORBIDDEN',
          plugin.$ERROR_CODES.ORGANIZATION_MEMBERSHIP_LIMIT_REACHED,
        )
      await options.organizationHooks?.beforeAcceptInvitation?.({
        invitation,
        user: session.user,
        organization: workspace,
      })
      const db = database()
      const coordinates = await resolveWorkspaceInvitationScopeUnscoped(
        db,
        invitation.id,
        session.user.id,
      )
      if (!coordinates) throw notFound()
      const result = await acceptWorkspaceInvitation(
        createScope(db, {
          userId: session.user.id,
          organizationId: coordinates.organizationId,
          role: 'member',
          impersonatedBy: session.session.impersonatedBy ?? null,
        }),
        invitation.id,
        new Date(),
      )
      if (!result) throw notFound()
      // Durable membership is never compensated on a session/KV failure. The existing workspace
      // switcher can recover activation, and a repeated acceptance cannot recreate removed access.
      await ctx.context.internalAdapter.updateSession(session.session.token, {
        activeOrganizationId: workspace.id,
      })
      await options.organizationHooks?.afterAcceptInvitation?.({
        ...result,
        user: session.user,
        organization: workspace,
      })
      return ctx.json(result)
    },
  )

  const rejectInvitation = createAuthEndpoint(
    reject.path,
    reject.options,
    async (ctx) => {
      const session = ctx.context.session
      const adapter = getOrgAdapter(ctx.context, options)
      const invitation = await adapter.findInvitationById(ctx.body.invitationId)
      if (!invitation || invitation.status !== 'pending') throw notFound()
      if (invitation.email.toLowerCase() !== session.user.email.toLowerCase())
        throw APIError.from(
          'FORBIDDEN',
          plugin.$ERROR_CODES.YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION,
        )
      if (!session.user.emailVerified)
        throw APIError.from(
          'FORBIDDEN',
          plugin.$ERROR_CODES
            .EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION,
        )
      const workspace = await adapter.findOrganizationById(
        invitation.organizationId,
      )
      if (!workspace) throw notFound()
      await options.organizationHooks?.beforeRejectInvitation?.({
        invitation,
        user: session.user,
        organization: workspace,
      })
      const db = database()
      const coordinates = await resolveWorkspaceInvitationScopeUnscoped(
        db,
        invitation.id,
        session.user.id,
      )
      if (!coordinates) throw notFound()
      const rejected = await rejectWorkspaceInvitation(
        createScope(db, {
          userId: session.user.id,
          organizationId: coordinates.organizationId,
          role: 'member',
          impersonatedBy: session.session.impersonatedBy ?? null,
        }),
        invitation.id,
      )
      if (!rejected) throw notFound()
      await options.organizationHooks?.afterRejectInvitation?.({
        invitation: rejected,
        user: session.user,
        organization: workspace,
      })
      return ctx.json({ invitation: rejected, member: null })
    },
  )
  return {
    ...plugin,
    endpoints: { ...plugin.endpoints, acceptInvitation, rejectInvitation },
  }
}
