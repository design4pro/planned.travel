import {
  leaseWorkspaceDeletion,
  recordWorkspaceDeletionRefusal,
  transitionWorkspaceDeletion,
  pruneWorkspaceDeletions,
} from '#/server/catalog/workspace-deletions'
import type { Database } from '#/server/db/types'
import type { WorkspaceDeletionPorts } from './driver'

/** Weekly maintenance shares the driver boundary; unfinished rows are never eligible. */
export function pruneCompletedWorkspaceDeletions(db: Database, now: Date) {
  return pruneWorkspaceDeletions(db, now)
}

/** The driver is the sole executor of leased deletion state; adapters never supply a tenant id. */
export function createWorkspaceDeletionLedgerPorts(
  db: Database,
): Pick<WorkspaceDeletionPorts, 'lease' | 'checkpoint' | 'recordRefusal'> {
  return {
    recordRefusal: (row, token, reason, now) =>
      recordWorkspaceDeletionRefusal(db, row.id, token, reason, now),
    lease: (id, now) => leaseWorkspaceDeletion(db, id, now),
    checkpoint: (row, token, next, patch, now) =>
      transitionWorkspaceDeletion(
        db,
        row.id,
        token,
        row.state,
        next,
        now,
        patch,
      ),
  }
}
