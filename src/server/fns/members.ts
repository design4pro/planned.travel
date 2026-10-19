/**
 * The server function behind the role control on the Workspace console's member list.
 *
 * A thin wrapper over `changeRole` in `member-role-writes.ts`, which holds the rules and is the half
 * a test can drive. What this file adds is the request: whether the session is an impersonation
 * (the same reading `createWorkspaceFn` takes) and the caller's tenant scope. The caller's role
 * comes from the scope, re-read from `member`, never from the payload.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireUserFrom } from '#/server/auth/tenant'

import { getRequest } from '@tanstack/react-start/server'
import { getAuth } from '#/server/auth'
import { queueRoomEviction } from '#/server/auth/room-eviction'
import { authDb } from '#/server/auth/db'
import { resolveOrProvisionOrganization } from '#/server/auth/provisioning'
import { departMember, memberDepartureInput } from './member-departure-writes'
import { getSession } from '#/server/auth/session'
import { appScope } from './context'
import { changeMemberRoleInput, changeRole } from './member-role-writes'
import { isImpersonated } from './workspace-writes'

import type { ChangeMemberRoleResult } from './member-role-writes'

export const changeMemberRoleFn = createServerFn({ method: 'POST' })
  .validator(changeMemberRoleInput)
  .handler(async ({ data }): Promise<ChangeMemberRoleResult> => {
    return changeRole(
      { impersonated: isImpersonated(await getSession()), scope: appScope },
      data,
    )
  })

export const departMemberFn = createServerFn({ method: 'POST' })
  .validator(memberDepartureInput)
  .handler(async ({ data }) => {
    const { headers } = getRequest()
    const auth = getAuth()
    return departMember(
      {
        impersonated: isImpersonated(await getSession()),
        scope: appScope,
        remove: (organizationId, memberId, self) =>
          self
            ? auth.api.leaveOrganization({ headers, body: { organizationId } })
            : auth.api.removeMember({
                headers,
                body: { organizationId, memberIdOrEmail: memberId },
              }),
        repairOffboarding: (userId, organizationId) =>
          queueRoomEviction(
            userId,
            [organizationId],
            'product-departure-recovery',
          ),
        activateRemaining: async (userId) => {
          const organizationId = await resolveOrProvisionOrganization(
            authDb(),
            userId,
          )
          if (!organizationId)
            throw new Error('No remaining workspace for signed-in user.')
          await auth.api.setActiveOrganization({
            headers,
            body: { organizationId },
          })
        },
      },
      data,
    )
  })

/** Recovery after a committed self-departure: no tenant scope or deleted membership is required. */
export const recoverDepartureWorkspaceFn = createServerFn({ method: 'POST' })
  .validator(z.strictObject({}))
  .handler(async () => {
    const session = await getSession()
    if (isImpersonated(session)) return { ok: false } as const
    const user = requireUserFrom(session)
    const organizationId = await resolveOrProvisionOrganization(
      authDb(),
      user.id,
    )
    if (!organizationId) return { ok: false } as const
    await getAuth().api.setActiveOrganization({
      headers: getRequest().headers,
      body: { organizationId },
    })
    return { ok: true } as const
  })
