import { enqueueTask, SYSTEM_ORG_ID } from '../jobs'
import { TaskRetryableError, workspaceDeletionPayloadSchema } from '../types'
import type { TaskHandler } from '../types'
import type { advanceWorkspaceDeletion } from '#/server/workspace-deletion/driver'

type Advance = (
  deletionId: string,
) => ReturnType<typeof advanceWorkspaceDeletion>

/** A continuation selects the ledger only; its envelope never grants tenant authority. */
export function createWorkspaceDeletionHandler(
  advance: Advance,
): TaskHandler<'workspace-deletion'> {
  return async (input, context) => {
    const { deletionId } = workspaceDeletionPayloadSchema.parse(input)
    const outcome = await advance(deletionId)
    if (outcome === 'busy') {
      // Success would write the consumer's 24-hour done marker and swallow redelivery.
      throw new TaskRetryableError('Workspace deletion lease is held', {
        retryAfterSeconds: 30,
      })
    }
    if (outcome !== 'terminal') {
      await enqueueTask(
        context.env.TASKS,
        {
          kind: 'workspace-deletion',
          orgId: SYSTEM_ORG_ID,
          payload: { deletionId },
          id: `workspace-deletion:${deletionId}:${crypto.randomUUID()}`,
          delaySeconds: 30,
        },
        context.now,
      )
    }
    return { outcome }
  }
}
