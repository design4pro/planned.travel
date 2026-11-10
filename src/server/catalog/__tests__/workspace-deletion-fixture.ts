import { appendWorkspaceDeletionAudit, PLATFORM_SYSTEM_ACTOR } from '../audit'
import {
  readLeasedWorkspaceDeletion,
  recordWorkspaceDeletionRefusal,
} from '../workspace-deletions'
import type { Database } from '#/server/db/types'

/** Fence-consumer tests assume notice acceptance; persist the real intent/audit preconditions. */
export async function prepareWorkspaceDeletionRefusal(
  db: Database,
  id: string,
  token: string,
  now = new Date(),
) {
  if (
    !(await recordWorkspaceDeletionRefusal(
      db,
      id,
      token,
      'has-other-members',
      now,
    ))
  )
    throw new Error('Missing refusal lease')
  const row = await readLeasedWorkspaceDeletion(db, id, token, now)
  if (!row) throw new Error('Missing refusal intent')
  await appendWorkspaceDeletionAudit(
    db,
    row,
    row.initiator === 'erasure'
      ? PLATFORM_SYSTEM_ACTOR
      : {
          actorKind: 'human',
          userId: row.requestedBy,
          role: null,
          tokenId: null,
        },
    'deletion_refused',
    now,
  )
}
