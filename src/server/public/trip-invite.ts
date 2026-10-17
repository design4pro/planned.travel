import {
  TRIP_INVITE_PURPOSE,
  deriveSecret,
  hashSecret,
  isSecretShape,
} from '#/server/security/secret'
import { findLiveTripInviteByDigestUnscoped } from '#/server/repos/invites'
import type { Database } from '#/server/db/types'
import type { LiveTripInvite } from '#/server/repos/invites'

/**
 * Resolves the secret in a `/join/<secret>` path to its live link, or `null` for every kind of dead
 * link and for anything that is not shaped like a secret. The shape guard runs before any query.
 *
 * The digest lookup alone would keep honouring a copy that was already sent after the derivation
 * key is rotated, because the stored digest still matches. Deriving the secret again from the link
 * id, its rotation and the current key and requiring it to equal the presented one is what makes a
 * key rotation fail closed.
 *
 * It holds no SQL and builds no tenant scope: the caller gets coordinates and nothing else.
 */
export async function resolveTripInvite(
  db: Database,
  key: string,
  secret: string,
): Promise<LiveTripInvite | null> {
  if (!isSecretShape('trip-invite', secret)) return null
  const found = await findLiveTripInviteByDigestUnscoped(
    db,
    await hashSecret(secret),
  )
  if (!found) return null
  const derived = await deriveSecret(
    TRIP_INVITE_PURPOSE,
    key,
    found.id,
    found.rotation,
  )
  return derived === secret ? found : null
}
