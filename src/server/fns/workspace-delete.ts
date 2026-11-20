import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { getAuth } from '#/server/auth'
import { sessionStore } from '#/server/auth/env'
import { createKvSecondaryStorage } from '#/server/auth/secondary-storage'
import { verifyWorkspaceStepUp } from '#/server/auth/workspace-step-up'
import { getDb } from '#/server/db/client'
import { getOrganization } from '#/server/repos/members'
import { getEffectiveSettings } from '#/server/repos/settings'
import { createWorkspaceDeletionRuntime } from '#/server/workspace-deletion/runtime'
import { requestOwnerWorkspaceDeletion } from '#/server/workspace-deletion/request'
import { workspaceDeletionActivated } from '#/server/workspace-deletion/activation'
import { enqueueTask, SYSTEM_ORG_ID } from '#/server/queue/jobs'
import { requestOutboundRuntime } from '#/server/metering/bindings'
import { callProvider } from '#/server/metering/outbound'
import { appScope, log } from './context'
import {
  deleteWorkspace,
  deleteWorkspaceInput,
} from './workspace-delete-writes'

/** The only request entry into the driver; reserved scope remains internal to its implementation. */
export const deleteWorkspaceFn = createServerFn({ method: 'POST' })
  .validator(deleteWorkspaceInput)
  .handler(async ({ data }) => {
    const scope = await appScope()
    const auth = getAuth()
    const session = await auth.api.getSession({
      headers: getRequest().headers,
      query: { disableCookieCache: true },
    })
    if (!session || session.user.id !== scope.ctx.userId)
      throw new Error('Missing deletion identity')
    return deleteWorkspace(
      {
        scope,
        impersonated: session.session.impersonatedBy != null,
        activated: workspaceDeletionActivated(),
        proof: async (password) => {
          const context = await auth.$context
          const account = await context.internalAdapter.findCredentialAccount(
            session.user.id,
          )
          const storage = createKvSecondaryStorage(sessionStore())
          if (!storage.increment)
            throw new Error('Password limiter unavailable')
          return verifyWorkspaceStepUp(
            {
              userId: session.user.id,
              passwordHash: account?.password || null,
              verify: (input) => context.password.verify(input),
              createdAt: session.session.createdAt,
              freshAge: context.sessionConfig.freshAge,
              now: Date.now(),
              increment: storage.increment,
            },
            password,
          )
        },
        start: async () => {
          const db = getDb()
          const [organization, settings] = await Promise.all([
            getOrganization(scope),
            getEffectiveSettings(scope),
          ])
          const deadline = Date.now() + 2000
          const signal = AbortSignal.timeout(2000)
          const runtime = createWorkspaceDeletionRuntime(db, env, {
            now: () => new Date(),
            logger: log(),
            send: (url, init) =>
              callProvider(
                requestOutboundRuntime(),
                {
                  provider: 'polar',
                  operation: 'api.request',
                  organizationId: scope.ctx.organizationId,
                },
                () => fetch(url, { ...init, signal }),
              ),
          })
          return requestOwnerWorkspaceDeletion(
            db,
            {
              scope,
              name: organization.name,
              email: session.user.email,
              locale: settings.locale,
            },
            {
              now: () => new Date(),
              advance: runtime.advance,
              deadline,
              enqueue: async (deletionId) => {
                await enqueueTask(env.TASKS, {
                  kind: 'workspace-deletion',
                  orgId: SYSTEM_ORG_ID,
                  payload: { deletionId },
                  id: `workspace-deletion:${deletionId}:${crypto.randomUUID()}`,
                  delaySeconds: 30,
                })
              },
            },
          )
        },
      },
      data,
    )
  })
