import { hashSecret, isSecretShape } from '#/server/security/secret'
import { findLiveTripInviteByDigestUnscoped } from '#/server/repos/invites'
import type { Database } from '#/server/db/types'
import type { LiveTripInvite } from '#/server/repos/invites'

/**
 * Resolves the secret in a `/join/<secret>` path to its live link, or `null` for every kind of dead
 * link and for anything that is not shaped like a secret. The shape guard runs before any query.
 *
 * The finder derives the secret again from the link and the current key, so a rotated key fails
 * closed here and for every other caller of the lookup.
 *
 * It holds no SQL and builds no tenant scope: the caller gets coordinates and nothing else.
 */
export async function resolveTripInvite(
  db: Database,
  key: string,
  secret: string,
): Promise<LiveTripInvite | null> {
  if (!isSecretShape('trip-invite', secret)) return null
  return findLiveTripInviteByDigestUnscoped(db, await hashSecret(secret), key)
}
