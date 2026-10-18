/**
 * The server function behind the role control on the Workspace console's member list.
 *
 * A thin wrapper over `changeRole` in `member-role-writes.ts`, which holds the rules and is the half
 * a test can drive. What this file adds is the request: whether the session is an impersonation
 * (the same reading `createWorkspaceFn` takes) and the caller's tenant scope. The caller's role
 * comes from the scope, re-read from `member`, never from the payload.
 */
import { createServerFn } from '@tanstack/react-start'

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
