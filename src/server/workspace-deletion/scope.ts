import { WorkspaceDeletionAuthorityLostError } from '#/server/repos/members'
import { createScope } from '#/server/repos/base'
import type { WorkspaceDeletionAuthority } from '#/server/catalog/workspace-deletions'
import type { Database, WorkspaceDeletion } from '#/server/db/types'

/** Driver-only authority, derived from the leased row rather than an envelope's tenant. */
export function createWorkspaceDeletionScope(
  db: Database,
  lease: { row: WorkspaceDeletion; token: string },
  now: Date,
) {
  const { row, token } = lease
  if (
    row.leaseToken !== token ||
    row.leaseUntil === null ||
    row.leaseUntil.getTime() <= now.getTime() ||
    row.refusalReason !== null ||
    row.state === 'done' ||
    row.state === 'refused' ||
    (row.initiator === 'owner' && row.requestedBy === null)
  )
    throw new WorkspaceDeletionAuthorityLostError()
  return {
    scope: createScope(db, {
      organizationId: row.organizationId,
      userId: 'system:workspace-deletion',
      role: 'owner',
      impersonatedBy: null,
    }),
    authority: {
      id: row.id,
      organizationId: row.organizationId,
      token,
      requestedBy: row.requestedBy,
      initiator: row.initiator,
      now: now.getTime(),
    } satisfies WorkspaceDeletionAuthority,
    departingUserId:
      row.initiator === 'owner' ? (row.requestedBy ?? undefined) : undefined,
  }
}
