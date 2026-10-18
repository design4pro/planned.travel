import { hashSecret, isSecretShape } from '#/server/security/secret'
import {
  findLiveTripInviteByDigestUnscoped,
  readInvitePreviewUnscoped,
} from '#/server/repos/invites'
import { spendPublicBudget } from './rate-limit'
import type { Database } from '#/server/db/types'
import type { RateCounterStore } from '#/server/metering/rate'
import type {
  InvitePreview,
  InviteViewer,
  LiveTripInvite,
} from '#/server/repos/invites'

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

/** Per-minute ceilings of the invite surface (`docs/ACCESS.md` §3.6). */
const PER_IP = 120
const MISSES_PER_IP = 20
const PER_LINK = 60

export interface TripInviteRuntime {
  readonly db: Database
  readonly store: RateCounterStore
  /** The derivation key (`BETTER_AUTH_SECRET`); this module never reads an environment itself. */
  readonly key: string
  readonly now?: () => Date
  /** Receives the link id and the outcome only: never the secret, the digest or the path. */
  readonly log?: (
    event: 'found' | 'unavailable' | 'limited',
    fields: { linkId?: string; retryAfter?: number },
  ) => void
}

export interface TripInviteRequest {
  /** The path segment as the visitor sent it; any string is accepted and judged here. */
  readonly secret: string
  /** The visitor's address from `cf-connecting-ip`, or `unknown`. */
  readonly ip: string
  /** The session's user as data, or `null`; this module never reads a session. */
  readonly viewer: InviteViewer | null
}

export type TripInviteAnswer =
  | {
      readonly status: 200
      readonly preview: Exclude<InvitePreview, { state: 'unavailable' }>
    }
  | { readonly status: 404 }
  | { readonly status: 429; readonly retryAfter: number }

/**
 * What a visitor may see of an invite link: the whole read side of `/join/<secret>`, session-less.
 *
 * Order: per-address budget, shape guard, hash, lookup, per-link budget, projection. A dead link of
 * any kind - malformed, unknown, rotated, switched off, orphaned, archived, a banned viewer - is the
 * same 404 and spends the address's miss budget. A budget store that is down fails the limiter open;
 * resolution is never skipped. Nothing here writes: a read does not count as a use.
 */
export async function loadTripInvite(
  runtime: TripInviteRuntime,
  request: TripInviteRequest,
): Promise<TripInviteAnswer> {
  const now = runtime.now?.() ?? new Date()
  const { db, store, key } = runtime

  function limited(retryAfter: number): TripInviteAnswer {
    runtime.log?.('limited', { retryAfter })
    return { status: 429, retryAfter }
  }

  async function dead(linkId?: string): Promise<TripInviteAnswer> {
    const retry = await spendPublicBudget(
      store,
      'invite-miss',
      request.ip,
      MISSES_PER_IP,
      now,
    )
    if (retry !== null) return limited(retry)
    runtime.log?.('unavailable', linkId ? { linkId } : {})
    return { status: 404 }
  }

  const ipRetry = await spendPublicBudget(store, 'ip', request.ip, PER_IP, now)
  if (ipRetry !== null) return limited(ipRetry)

  const invite = await resolveTripInvite(db, key, request.secret)
  if (!invite) return dead()

  const digest = await hashSecret(request.secret)
  const linkRetry = await spendPublicBudget(
    store,
    'invite',
    digest,
    PER_LINK,
    now,
  )
  if (linkRetry !== null) return limited(linkRetry)

  const preview = await readInvitePreviewUnscoped(
    db,
    digest,
    key,
    request.viewer,
    now,
  )
  if (preview.state === 'unavailable') return dead(invite.id)

  runtime.log?.('found', { linkId: invite.id })
  return { status: 200, preview }
}
