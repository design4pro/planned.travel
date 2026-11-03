import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { workspaceParticipants } from '#/server/db/schema'
import type { AuthDb } from './db'

/**
 * The participation anchor's one write path from the auth layer: "this person took part in this
 * workspace", recorded before or in the same batch as the membership that makes it true (ADR 0043).
 *
 * Write-only by design. Other than the bounded recipient acceptance repository (SPEC §5), the auth
 * graph cannot reach the tenant layer. Other membership paths need only this statement:
 * no tenant reads, no update, no delete. Personal recovery can condition the insert on identity
 * membership absence supplied by provisioning, in the same atomic batch. It writes
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
  condition?: SQL,
) {
  const insert = db.insert(workspaceParticipants)
  // A losing personal-workspace recovery must skip its anchor in the same batch too.
  if (condition) {
    return insert
      .select(
        sql`select ${organizationId}, ${userId}, null, null, null, ${Date.now()} where ${condition}`,
      )
      .onConflictDoNothing()
  }
  return insert.values({ organizationId, userId }).onConflictDoNothing()
}
