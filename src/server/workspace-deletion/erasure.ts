import { TaskRetryableError } from '#/server/queue/types'
import { workspaceDeletionResumeId } from './driver'
import {
  consumeWorkspaceDeletionErasure,
  readWorkspaceDeletionErasureState,
} from '#/server/catalog/workspace-deletions'
import type { Database } from '#/server/db/types'

/** Bounded handshake for the separately owned erasure engine; parking never claims a consumer. */
export async function enterWorkspaceDeletionErasure(
  db: Database,
  deletionId: string,
  erasureId: string,
  envelopeId: string,
) {
  const state = await readWorkspaceDeletionErasureState(
    db,
    deletionId,
    erasureId,
  )
  if (state === null) return { outcome: 'stale' as const }
  if (state === 'requested' || state === 'drained') {
    // Only the original live delivery parks successfully. A canonical wake may race the
    // driver's audit/CAS: acknowledging it would let a done marker swallow cron re-issues.
    if (envelopeId === workspaceDeletionResumeId(erasureId, deletionId))
      throw new TaskRetryableError('Workspace deletion is not ready', {
        retryAfterSeconds: 30,
      })
    return { outcome: 'parked' as const }
  }
  if (
    !(await consumeWorkspaceDeletionErasure(
      db,
      deletionId,
      erasureId,
      envelopeId,
    ))
  )
    return { outcome: 'stale' as const }
  // A lost response between consume and this read is recovered by the same winning envelope.
  const current = await readWorkspaceDeletionErasureState(
    db,
    deletionId,
    erasureId,
  )
  if (current === null) return { outcome: 'stale' as const }
  if (current === 'refused')
    return {
      outcome: 'refused' as const,
      reason: `workspace-refused:${deletionId}`,
    }
  return { outcome: 'ready' as const }
}
