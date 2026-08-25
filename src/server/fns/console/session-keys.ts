/**
 * The KV half of a ban, kept pure so it can be measured rather than argued about.
 *
 * **Why this file exists at all.** `auth.api.banUser` writes `banned = true` and then calls
 * `internalAdapter.deleteUserSessions(userId)`, which reads the target's token list from the
 * secondary-storage index `active-sessions-<userId>` and returns `[]` when that key is absent
 * (`better-auth@1.7.1`, `dist/db/internal-adapter.mjs`). Every KV session blob it did not enumerate
 * survives, and `findSession` resolves a token from KV *before* it looks at D1 and returns the
 * blob's own user snapshot verbatim — a snapshot that still says `banned: false`. So a ban that
 * trusts the plugin leaves every unindexed session live for as long as its blob does, up to the
 * 30-day session lifetime, and the guard's `session.user.banned` veto never sees a banned user to
 * veto. That was measured on a real dev Worker in round 6, not inferred: a direct `banned = 1`
 * write left `GET /api/auth/get-session` answering `200` with `"banned": false` on a warm cookie.
 *
 * docs/ARCHITECTURE.md §4 rule 2 makes the fix architectural rather than defensive: "any
 * read-your-own-write path must read D1, not the cache". The tokens are therefore enumerated from
 * the `session` table (which carries `session_user_id_idx`) and each blob's key is deleted by name,
 * with the index key deleted last so a concurrent reader never sees an index pointing at blobs that
 * are already gone.
 *
 * **The honest bound.** A KV delete is immediate in the colo that served it and eventually
 * consistent elsewhere — up to the read's `cacheTtl`, which defaults to 60 seconds. "Immediate"
 * here means "immediate where the ban was issued, and within the KV convergence window everywhere
 * else". Miniflare's local KV has no edge cache at all, so a green local test says nothing about
 * that window in either direction.
 *
 * Nothing in this module reaches a binding, a request or the auth instance. It takes what it needs
 * as arguments, which is what lets `__tests__/session-keys.test.ts` drive it with a KV double whose
 * index key is missing — the exact shape of the failure it exists to close.
 */

import { z } from 'zod'

/**
 * Better Auth's per-user session index, whose staleness is the whole problem
 * (`internalAdapter.getActiveSessionReferences`). Deleted alongside the blobs so a later
 * `listSessions` cannot resurrect a reference to a session that no longer exists.
 */
export const ACTIVE_SESSIONS_INDEX_PREFIX = 'active-sessions-'

export function activeSessionsIndexKey(userId: string): string {
  return `${ACTIVE_SESSIONS_INDEX_PREFIX}${userId}`
}

/**
 * How many session rows one ban enumerates.
 *
 * A Workers invocation is capped at 1000 external-service operations, and the number of live
 * sessions an account holds is influenced by whoever holds the account — so the loop is bounded
 * rather than sized off the data. 200 is far above any legitimate account (a session per device per
 * browser) and far below the cap, leaving room for the D1 read, the plugin's own writes and the
 * audit append in the same request. When the bound bites, {@link SessionKeyPurge.truncated} says so
 * and the caller raises it: the remaining blobs expire on their own TTL, which is the one case
 * where a ban is not immediate and it must not pass silently.
 */
export const SESSION_TOKEN_LIMIT = 200

/**
 * A session blob lives under its *raw token* as the KV key — no prefix, no namespace
 * (`internalAdapter.createSession`: `secondaryStorage.set(sessionToken, …)`). So the token read out
 * of D1 is the key, and nothing derives one from the other.
 */
const sessionRowSchema = z.object({ token: z.string().trim().min(1) })

/**
 * The tokens, out of whatever the database adapter handed back.
 *
 * Validated rather than cast: the rows arrive from Better Auth's adapter as `unknown`, and a
 * column list that silently stopped including `token` would otherwise become "this account had no
 * sessions" — indistinguishable from a correct ban and wrong in the one direction that matters.
 * A row that does not carry a usable token is dropped and counted by the caller through the
 * difference between {@link SessionKeyPurge.enumerated} and the row count.
 */
export function sessionTokensFrom(
  rows: ReadonlyArray<unknown>,
): ReadonlyArray<string> {
  const tokens: Array<string> = []
  for (const row of rows) {
    const parsed = sessionRowSchema.safeParse(row)
    if (parsed.success) {
      tokens.push(parsed.data.token)
    }
  }
  return tokens
}

/** The slice of `KVNamespace` this module uses, so a test can supply the whole of it. */
export interface SessionKeyStore {
  delete: (key: string) => Promise<void>
}

export interface SessionKeyPurge {
  /** Session tokens read from D1 and attempted. */
  readonly enumerated: number
  /** Keys actually removed, the index key included when it was one of them. */
  readonly deleted: number
  /** Keys whose delete was rejected. Their cached blobs stay readable until their TTL expires. */
  readonly failed: number
  /** True when the account holds at least {@link SESSION_TOKEN_LIMIT} sessions and some were not enumerated. */
  readonly truncated: boolean
}

async function deleteKeys(
  store: SessionKeyStore,
  keys: ReadonlyArray<string>,
  enumerated: number,
): Promise<SessionKeyPurge> {
  const outcomes = await Promise.allSettled(
    keys.map((key) => store.delete(key)),
  )
  const failed = outcomes.filter(
    (outcome) => outcome.status === 'rejected',
  ).length

  return {
    enumerated,
    deleted: keys.length - failed,
    failed,
    truncated: enumerated >= SESSION_TOKEN_LIMIT,
  }
}

/**
 * Deletes every enumerated session blob **and** the per-user index key — the ban and delete path.
 *
 * Every key is attempted even when an earlier one fails, because a partial ban is worse than a
 * reported one: the caller's mutation has already committed, and stopping at the first rejection
 * would leave the *rest* of the account's sessions live for no reason anybody could reconstruct
 * later. Failures are counted and handed back rather than thrown, for the same reason the audit
 * writer never throws — the ban stands, and the incident is a log line.
 *
 * The index key is deleted unconditionally, including when D1 enumerated nothing. That is the case
 * this function exists for: an index that survives its blobs is what makes
 * `internalAdapter.listSessions` answer with sessions that are gone, and what makes
 * `deleteUserSessions` enumerate blobs that are not.
 */
export async function purgeSessionKeys(
  store: SessionKeyStore,
  userId: string,
  tokens: ReadonlyArray<string>,
): Promise<SessionKeyPurge> {
  return deleteKeys(
    store,
    [...new Set(tokens), activeSessionsIndexKey(userId)],
    tokens.length,
  )
}

/**
 * Deletes the cached blobs and **keeps** the index — the path for a mutation that changes what a
 * session says about its user without ending it.
 *
 * docs/ARCHITECTURE.md §2.2 makes this the mandatory shape of a mutation, not a nicety: "write D1
 * in the smallest possible transaction → invalidate the KV cache keys the write touched". A session
 * blob is `{ session, user }`, so a role change, an email change, a profile edit and a password set
 * each write a row whose cached copy is now wrong — and `findSession` reads that copy in preference
 * to D1. Dropping the blob costs the account's next request one D1 read (`storeSessionInDatabase`
 * is on, so `findSession` falls through and re-caches) and makes the change take effect on that
 * request instead of on the next sign-in.
 *
 * The index survives because the sessions themselves survive. Purging it here would leave live
 * sessions unreferenced, which is the defect this file was written to close rather than to cause.
 */
export async function invalidateSessionSnapshots(
  store: SessionKeyStore,
  tokens: ReadonlyArray<string>,
): Promise<SessionKeyPurge> {
  return deleteKeys(store, [...new Set(tokens)], tokens.length)
}
