import {
  TaskAbandonedError,
  TaskConfigurationError,
  TaskPermanentError,
  TaskRetryableError,
} from '#/server/queue/types'
import { createPolarClient } from '#/server/billing/polar'
import { PLATFORM_SYSTEM_ACTOR } from '#/server/catalog/audit'
import { closeTripRoom, resetTripRoom } from '#/server/do/trip-room-client'
import { listStaleWorkspaceDeletions } from '#/server/catalog/workspace-deletions'
import { advanceWorkspaceDeletion } from './driver'
import { createWorkspaceDeletionEffects } from './effects'
import { createWorkspaceDeletionLedgerPorts } from './ledger'
import { recoverWorkspaceDeletions } from './recovery'
import type { PolarFetch } from '#/server/billing/polar'
import type { Database } from '#/server/db/types'
import type { Logger } from '#/server/observability/logger'
import type { TaskBindings } from '#/server/queue/types'
import type { WorkspaceDeletionPorts } from './driver'

interface RuntimeOptions {
  now: () => Date
  logger: Logger
  /** Queue and cron supply their own metered fetch; tests use a local provider. */
  send: PolarFetch
  /** Missing adapters throw; acceptance must match the immutable delivery request id. */
  delivery?: Pick<
    WorkspaceDeletionPorts,
    'receipt' | 'resumeErasure' | 'refusalNotice'
  >
}

/** A later activation must supply real delivery; absence never acknowledges an effect. */
async function deliveryUnavailable(): Promise<never> {
  throw new Error('Workspace deletion delivery is not activated')
}

/** Queue and recovery share the same leased, bounded implementation and external effects. */
export function createWorkspaceDeletionRuntime(
  db: Database,
  env: TaskBindings,
  options: RuntimeOptions,
) {
  const ledger = createWorkspaceDeletionLedgerPorts(db)
  const ports: WorkspaceDeletionPorts = {
    now: options.now,
    ...ledger,
    checkpoint: async (row, token, next, patch, now) => {
      const saved = await ledger.checkpoint(row, token, next, patch, now)
      if (saved) {
        const fields = {
          deletionId: row.id,
          organizationId: row.organizationId,
          state: next,
          attempts: row.attempts,
        }
        options.logger.info('workspace-deletion.state', fields)
        if (next === 'refused')
          options.logger.error('workspace-deletion.refused', undefined, {
            ...fields,
            reason: row.refusalReason ?? patch.lastError,
          })
      }
      return saved
    },
    ...createWorkspaceDeletionEffects(db, {
      now: options.now,
      files: env.FILES,
      invalidatePlan: (key) => env.KV.delete(key),
      // Read credentials only when a step reaches billing; terminal/missing rows need none.
      polar: {
        request: (request) =>
          createPolarClient({
            accessToken: env.POLAR_ACCESS_TOKEN,
            server: env.POLAR_SERVER,
            fetch: options.send,
          }).request(request),
      },
      closeRooms: async (row, tripIds) => {
        if (tripIds.length === 0) return
        const namespace = env.TRIP_ROOM
        if (!namespace)
          throw new Error('TRIP_ROOM is required for workspace deletion')
        for (const id of tripIds) {
          if (row.initiator === 'erasure')
            await resetTripRoom(namespace, id, () => options.now().getTime())
          else await closeTripRoom(namespace, id, () => options.now().getTime())
        }
      },
      // The ledger records the authenticated requester. No platform role is fabricated from
      // the reserved tenant scope; erasure never attributes its work to the erased person.
      actorFor: async (row) =>
        row.initiator === 'erasure'
          ? PLATFORM_SYSTEM_ACTOR
          : {
              actorKind: 'human',
              userId: row.requestedBy,
              role: null,
              tokenId: null,
            },
      notifications: options.delivery ?? {
        refusalNotice: deliveryUnavailable,
        receipt: deliveryUnavailable,
        resumeErasure: deliveryUnavailable,
      },
    }),
  }
  const advance = async (id: string) => {
    try {
      return await advanceWorkspaceDeletion(id, ports)
    } catch (error) {
      // Provider bodies, receipt addresses and names must not reach structured diagnostics.
      options.logger.error('workspace-deletion.step-unavailable', undefined, {
        deletionId: id,
      })
      const message = 'Workspace deletion step unavailable'
      if (error instanceof TaskAbandonedError)
        throw new TaskAbandonedError(error.reason, message)
      if (error instanceof TaskConfigurationError)
        throw new TaskConfigurationError(message)
      if (error instanceof TaskPermanentError)
        throw new TaskPermanentError(message)
      if (error instanceof TaskRetryableError) {
        const delay = error.retryAfterSeconds
        throw new TaskRetryableError(message, {
          ...(Number.isInteger(delay) && delay !== undefined && delay >= 0
            ? { retryAfterSeconds: delay }
            : {}),
        })
      }
      throw new Error(message)
    }
  }
  return {
    advance,
    recover: () =>
      recoverWorkspaceDeletions({
        now: options.now,
        listStale: (now) => listStaleWorkspaceDeletions(db, now),
        advance,
        stuck: (deletionId) =>
          options.logger.error('workspace-deletion.stuck', undefined, {
            deletionId,
          }),
      }),
  }
}
