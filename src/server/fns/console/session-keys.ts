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
 * **Both halves of that enumeration live here**: {@link enumerateSessionRows} holds the paging rule
 * and {@link purgeSessionKeys} holds the deletion, because the two are one claim — "every session
 * this account holds is gone" — and a bound on the first silently weakens the second. The walk is
 * paged and deterministically ordered rather than capped at one read: a single `LIMIT 200` with no
 * `ORDER BY` reports a live session past the cap as already ended, and hands a ban a token list
 * that is missing exactly the sessions nobody counted.
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
 * How many session rows one D1 read asks for.
 *
 * The enumeration is paged rather than capped at a single read, so an account holding more sessions
 * than one page is walked rather than truncated — a session past the cap that a truncated read never
 * saw is a session a ban leaves live and a revoke-by-id reports as already ended, which is the
 * failure this whole path exists to prevent.
 */
export const SESSION_PAGE_SIZE = 200

/**
 * Where the walk stops, and why it stops anywhere.
 *
 * A Workers invocation is capped at 1000 external-service operations, and every enumerated token
 * costs one KV delete on the ban path — so the ceiling is a budget rather than a guess about how
 * many sessions an account "should" have, and it is set well below the cap to leave room for the
 * plugin's own writes and the audit append in the same request. Six hundred is three pages.
 *
 * Reaching it is not silent truncation: {@link SessionEnumeration.truncated} is resolved by asking
 * for one row past the ceiling, so it is a fact rather than a suspicion, and every caller acts on
 * it — the ban raises an `error` line naming what it could not purge, and a revoke-by-id that did
 * not find its session refuses with `target-beyond-cap` instead of claiming the session had ended.
 */
export const SESSION_ENUMERATION_CEILING = 600

/**
 * One page of `session` rows, however the caller reads them.
 *
 * A function rather than a handle, so {@link enumerateSessionRows} holds the paging rule and nothing
 * else: `./bindings` supplies the Better Auth adapter behind it in production, and a test supplies a
 * page function over an array. The rows stay `unknown` because the paging rule does not care what a
 * session row looks like — {@link sessionTokensFrom} is where that is decided.
 */
export type SessionRowPage = (
  offset: number,
  limit: number,
) => Promise<ReadonlyArray<unknown>>

/** The rows one enumeration saw, and whether it saw all of them. */
export interface SessionEnumeration {
  readonly rows: ReadonlyArray<unknown>
  /** True when the account holds at least one session past {@link SESSION_ENUMERATION_CEILING}. */
  readonly truncated: boolean
}

/**
 * Walks an account's session rows a page at a time, in the caller's order, up to the ceiling.
 *
 * The order is the caller's and must be a *total* one — `./bindings` sorts by `id`, which is unique,
 * rather than by `createdAt`, which is a millisecond stamp two sessions can share. An unstable sort
 * under offset paging drops rows between pages and duplicates others, and a dropped row here is a
 * live session a ban never reached.
 */
export async function enumerateSessionRows(
  page: SessionRowPage,
): Promise<SessionEnumeration> {
  const rows: Array<unknown> = []

  while (rows.length < SESSION_ENUMERATION_CEILING) {
    const limit = Math.min(
      SESSION_PAGE_SIZE,
      SESSION_ENUMERATION_CEILING - rows.length,
    )
    const batch = await page(rows.length, limit)
    rows.push(...batch)
    if (batch.length < limit) {
      return { rows, truncated: false }
    }
  }

  // One row past the ceiling, so "truncated" is measured rather than assumed. An account holding
  // exactly the ceiling would otherwise be reported as truncated for ever, and the two callers that
  // act on the flag would both act on a fact that is not one.
  const overflow = await page(SESSION_ENUMERATION_CEILING, 1)
  return { rows, truncated: overflow.length > 0 }
}

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

/**
 * The tokens an enumeration saw, carrying its own honesty about whether it saw all of them.
 *
 * The flag travels with the tokens rather than being re-derived from their count, which is what a
 * single-page read used to do: `enumerated >= limit` cannot tell an account holding exactly the
 * limit from one holding more, and both callers of the flag act on it.
 */
export interface SessionTokens {
  readonly tokens: ReadonlyArray<string>
  readonly truncated: boolean
}

/** The tokens of an enumeration, with its truncation carried across unchanged. */
export function sessionTokensOf(
  enumeration: SessionEnumeration,
): SessionTokens {
  return {
    tokens: sessionTokensFrom(enumeration.rows),
    truncated: enumeration.truncated,
  }
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
  /** True when the account holds sessions past {@link SESSION_ENUMERATION_CEILING}, unpurged. */
  readonly truncated: boolean
}

async function deleteKeys(
  store: SessionKeyStore,
  keys: ReadonlyArray<string>,
  enumerated: SessionTokens,
): Promise<SessionKeyPurge> {
  const outcomes = await Promise.allSettled(
    keys.map((key) => store.delete(key)),
  )
  const failed = outcomes.filter(
    (outcome) => outcome.status === 'rejected',
  ).length

  return {
    enumerated: enumerated.tokens.length,
    deleted: keys.length - failed,
    failed,
    truncated: enumerated.truncated,
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
  enumerated: SessionTokens,
): Promise<SessionKeyPurge> {
  return deleteKeys(
    store,
    [...new Set(enumerated.tokens), activeSessionsIndexKey(userId)],
    enumerated,
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
  enumerated: SessionTokens,
): Promise<SessionKeyPurge> {
  return deleteKeys(store, [...new Set(enumerated.tokens)], enumerated)
}
