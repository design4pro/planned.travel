/**
 * The server function behind "Create workspace" in the account menu.
 *
 * A thin wrapper over `createWorkspace` in `workspace-writes.ts`, which holds the rules and is the
 * half a test can drive. What this file adds is the request: the tenant scope, whether the session
 * is an impersonation, and the two Better Auth calls the rules need - the caller's workspace count
 * and the activation of the new one.
 *
 * `auth.api.createOrganization` is never called, here or anywhere: an in-process call with no
 * session headers counts as a system action and skips `allowUserToCreateOrganization`, so it would
 * be a second way to create a workspace that the role, plan and limit checks do not guard. The
 * write is `createOrganizationFor`, reached only through `createWorkspace`.
 */
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { getAuth } from '#/server/auth'
import { authDb } from '#/server/auth/db'
import { serializeError } from '#/server/observability'
import { getSession } from '#/server/auth/session'
import { appScope, log } from './context'
import {
  createWorkspace,
  createWorkspaceInput,
  isImpersonated,
} from './workspace-writes'

import type { CreateWorkspaceResult } from './workspace-writes'

export const createWorkspaceFn = createServerFn({ method: 'POST' })
  .validator(createWorkspaceInput)
  .handler(async ({ data }): Promise<CreateWorkspaceResult> => {
    const scope = await appScope()
    const session = await getSession()
    const { headers } = getRequest()
    const auth = getAuth()

    return createWorkspace(
      {
        scope,
        db: authDb(),
        impersonated: isImpersonated(session),
        countMemberships: async () =>
          (await auth.api.listOrganizations({ headers })).length,
        onActivationFailed: (cause) => {
          log().warn('workspace activation failed after create', {
            organizationId: scope.ctx.organizationId,
            ...serializeError(cause),
          })
        },
        activate: async (organizationId) => {
          await auth.api.setActiveOrganization({
            headers,
            body: { organizationId },
          })
        },
      },
      data,
    )
  })
