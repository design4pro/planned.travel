import { workspaceParticipants } from '#/server/db/schema'
import type { AuthDb } from './db'

/**
 * The participation anchor's one write path from the auth layer: "this person took part in this
 * workspace", recorded before or in the same batch as the membership that makes it true (ADR 0043).
 *
 * Write-only by design. The auth layer cannot import `src/server/repos` (the Workspace console
 * graph reaches `#/server/auth` and must not reach the tenant layer), yet it creates memberships,
 * so it needs this single statement and nothing else: no select, no update, no delete. It writes
 * `organization_id` and `user_id` and leaves the erasure job-state columns null. `INSERT OR IGNORE`
 * makes it safe to repeat, so a redelivered hook or a person who rejoins writes nothing new.
 *
 * `organizationId` must come from the id minted in the same batch or from hook data (the invitation
 * row, the organization the library resolved), never from a request body.
 */
export function recordParticipation(
  db: AuthDb,
  organizationId: string,
  userId: string,
) {
  return db
    .insert(workspaceParticipants)
    .values({ organizationId, userId })
    .onConflictDoNothing()
}
