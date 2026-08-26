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
 * the `session` table (which carries `session_user_id_idx`) and each blob's key is deleted by name.
 *
 * **The purge walks to exhaustion, and that is the correctness property.** An earlier version
 * stopped at a fixed ceiling, reported the remainder as `truncated` and carried on with the ban.
 * That was not a bound, it was permanent damage: `banUser` deletes every D1 session row by
 * predicate and the per-user index key goes with them, so after the call *nothing anywhere* records
 * the surviving token names — no later ban, no revoke-all and no manual retry can reach them,
 * `findSession` keeps resolving each one from its `banned: false` snapshot, and `updateAge`
 * re-caches it. The evasion was open-ended and, worse, invisible afterwards. {@link purgeSessionBlobs}
 * therefore pages until D1 returns a short page, and every caller runs it **before** the mutation
 * that deletes those rows, so a purge that cannot finish leaves the account exactly as it found it
 * and every token still named in D1. A partial purge is never carried into a mutation.
 *
 * **What bounds the walk, then.** The platform does: a Workers invocation has a finite subrequest
 * budget, and exceeding it throws — before the mutation, because the purge runs first, so the
 * account is untouched and the operator sees an error rather than a ban that silently was not one.
 * {@link SESSION_PURGE_PAGE_LIMIT} sits above any realistic budget purely as a runaway-loop guard,
 * and it *throws* rather than truncating, because truncation is the failure this file exists to
 * make impossible.
 *
 * **REPAIR 20 was withdrawn and must not be re-applied.** A round instructed reading the session
 * list through `auth.api.listUserSessions` "rather than reaching past the plugin into storage".
 * That endpoint goes through `internalAdapter.listSessions`, which reads `active-sessions-<userId>`
 * from secondary storage and returns an empty array when the key is missing — it reports *no
 * sessions* in exactly the case a ban most needs to see them. The adapter read stays. Anything that
 * tidies this layering back reintroduces the hole this whole module closes.
 *
 * **The honest bound on "immediate".** A KV delete is immediate in the colo that served it and
 * eventually consistent elsewhere — up to the read's `cacheTtl`, which defaults to 60 seconds.
 * "Immediate" here means "immediate where the ban was issued, and within the KV convergence window
 * everywhere else". Miniflare's local KV has no edge cache at all, so a green local test says
 * nothing about that window in either direction.
 *
 * Nothing in this module reaches a binding, a request or the auth instance. It takes what it needs
 * as arguments, which is what lets `__tests__/session-keys.test.ts` drive it with a KV double whose
 * index key is missing — the exact shape of the failure it exists to close.
 */

import { z } from 'zod'

import { ConsoleActionError } from './errors'

/**
 * Better Auth's per-user session index, whose staleness is the whole problem
 * (`internalAdapter.getActiveSessionReferences`). Deleted alongside the blobs on the paths that end
 * an account's sessions, so a later `listSessions` cannot resurrect a reference to a session that no
 * longer exists.
 */
export const ACTIVE_SESSIONS_INDEX_PREFIX = 'active-sessions-'

export function activeSessionsIndexKey(userId: string): string {
  return `${ACTIVE_SESSIONS_INDEX_PREFIX}${userId}`
}

/**
 * How many session rows one D1 read asks for.
 *
 * Both walks are paged rather than capped at a single read, so an account holding more sessions than
 * one page is walked rather than truncated — a session past a cap that a truncated read never saw is
 * a session a ban leaves live and a revoke-by-id reports as already ended, which is the failure this
 * whole path exists to prevent.
 */
export const SESSION_PAGE_SIZE = 200

/**
 * Where the *console's session list* stops, and why only that one stops anywhere.
 *
 * This is a display bound and nothing else: a screen showing an account's devices does not need to
 * render ten thousand rows, and {@link SessionEnumeration.truncated} tells the operator when the
 * page is not the whole story. It is deliberately not a bound on {@link purgeSessionBlobs} — a
 * *list* that stops early is honest, and a *purge* that stops early is a live session nobody can
 * name afterwards. Three pages.
 */
export const SESSION_LIST_CEILING = 600

/**
 * A runaway-loop guard on the exhaustive purge, and emphatically not a policy bound.
 *
 * Fifty thousand sessions is far past any subrequest budget a Workers invocation has, so the
 * platform's own limit is what a real overrun hits first — and it hits it *before* the mutation,
 * leaving the account untouched. This exists so a page function that always returns a full page
 * cannot spin for ever, and it throws for the same reason nothing else here truncates.
 */
export const SESSION_PURGE_PAGE_LIMIT = 250

/**
 * One page of `session` rows, however the caller reads them.
 *
 * A function rather than a handle, so this module holds the paging rule and nothing else:
 * `./bindings` supplies the Better Auth adapter behind it in production, and a test supplies a page
 * function over an array. The rows stay `unknown` because the paging rule does not care what a
 * session row looks like — {@link sessionTokensFrom} is where that is decided.
 *
 * A page function must apply a **stable** order and a **fixed** expiry instant across every call it
 * serves, or offset paging drops rows between pages; `./bindings` does both.
 */
export type SessionRowPage = (
  offset: number,
  limit: number,
) => Promise<ReadonlyArray<unknown>>

/** The rows one bounded enumeration saw, and whether it saw all of them. */
export interface SessionEnumeration {
  readonly rows: ReadonlyArray<unknown>
  /** True when the account holds at least one session past {@link SESSION_LIST_CEILING}. */
  readonly truncated: boolean
}

/**
 * Walks an account's session rows a page at a time, up to {@link SESSION_LIST_CEILING} — the read
 * behind the console's session list, and nothing else.
 *
 * The order is the caller's and must be a *total* one — `./bindings` sorts by `id`, which is unique,
 * rather than by `createdAt`, which is a millisecond stamp two sessions can share. An unstable sort
 * under offset paging drops rows between pages and duplicates others.
 */
export async function enumerateSessionRows(
  page: SessionRowPage,
): Promise<SessionEnumeration> {
  const rows: Array<unknown> = []

  while (rows.length < SESSION_LIST_CEILING) {
    const limit = Math.min(
      SESSION_PAGE_SIZE,
      SESSION_LIST_CEILING - rows.length,
    )
    const batch = await page(rows.length, limit)
    rows.push(...batch)
    if (batch.length < limit) {
      return { rows, truncated: false }
    }
  }

  // One row past the ceiling, so "truncated" is measured rather than assumed. An account holding
  // exactly the ceiling would otherwise be reported as truncated for ever, and the caller that acts
  // on the flag would be acting on a fact that is not one.
  const overflow = await page(SESSION_LIST_CEILING, 1)
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
 * difference between {@link SessionBlobPurge.enumerated} and the row count.
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

/** What one exhaustive purge reached, and what it could not. */
export interface SessionBlobPurge {
  /** Distinct session tokens read from D1 and attempted. */
  readonly enumerated: number
  /** Blobs actually removed. */
  readonly deleted: number
  /** Blobs whose delete was still rejected after one retry. */
  readonly failed: number
  /**
   * Which keys those were, so a test can name them and a future caller could retry them.
   *
   * Never logged and never returned past this directory: a session token *is* the credential, and a
   * log line is exactly as durable a place to put one as an audit row. The callers here report the
   * three counts above and nothing else.
   */
  readonly failedKeys: ReadonlyArray<string>
}

async function deleteEach(
  store: SessionKeyStore,
  keys: ReadonlyArray<string>,
): Promise<{ deleted: number; failedKeys: Array<string> }> {
  const outcomes = await Promise.allSettled(
    keys.map((key) => store.delete(key)),
  )
  const failedKeys = keys.filter(
    (_key, index) => outcomes[index]?.status === 'rejected',
  )
  return { deleted: keys.length - failedKeys.length, failedKeys }
}

/**
 * Deletes the cached blob of **every** session the account holds, walking D1 to exhaustion.
 *
 * The blob is what `findSession` answers from, so this is the whole of what makes a ban, a session
 * revocation or a password reset take effect on the target's *next request* rather than on its next
 * sign-in. It deletes blobs only; the per-user index key is {@link deleteSessionIndexKey}'s, because
 * the two are needed on different paths — a role change keeps the index (the sessions survive; only
 * what they say about their user is stale) and a ban does not.
 *
 * Every key is attempted even when an earlier one fails, and the rejections are then retried once
 * as a batch: a KV delete rejects for transient reasons far more often than for permanent ones, and
 * stopping at the first would leave the *rest* of the account's sessions cached for no reason
 * anybody could reconstruct later. What survives the retry is reported by name rather than thrown,
 * because the caller — which has not mutated anything yet — is the one that decides whether to
 * refuse.
 *
 * Deletion happens page by page rather than after the whole walk, so the work is already done for
 * every page that was read even if a later one fails.
 */
export async function purgeSessionBlobs(
  store: SessionKeyStore,
  page: SessionRowPage,
): Promise<SessionBlobPurge> {
  const seen = new Set<string>()
  const failedKeys: Array<string> = []
  let offset = 0
  let deleted = 0

  for (let index = 0; ; index += 1) {
    if (index >= SESSION_PURGE_PAGE_LIMIT) {
      throw new ConsoleActionError(
        'target-beyond-cap',
        'That account holds more sessions than one call can clear. Nothing was changed.',
      )
    }

    const rows = await page(offset, SESSION_PAGE_SIZE)
    const tokens = sessionTokensFrom(rows).filter((token) => {
      if (seen.has(token)) return false
      seen.add(token)
      return true
    })

    const outcome = await deleteEach(store, tokens)
    deleted += outcome.deleted
    failedKeys.push(...outcome.failedKeys)

    if (rows.length < SESSION_PAGE_SIZE) break
    offset += rows.length
  }

  if (failedKeys.length > 0) {
    const retry = await deleteEach(store, failedKeys)
    deleted += retry.deleted
    return {
      enumerated: seen.size,
      deleted,
      failed: retry.failedKeys.length,
      failedKeys: retry.failedKeys,
    }
  }

  return { enumerated: seen.size, deleted, failed: 0, failedKeys: [] }
}

/**
 * Deletes the per-user index key — the paths that end an account's sessions, and only those.
 *
 * Called **after** the mutation that deletes the D1 rows, and unconditionally, including when the
 * account had no session rows at all. That is the case it exists for: an index that survives its
 * blobs is what makes `internalAdapter.listSessions` answer with sessions that are gone, and what
 * makes `deleteUserSessions` enumerate blobs that are not. Better Auth's own
 * `deleteCachedUserSessions` usually removes it in the same breath; this is idempotent beside it and
 * covers the case where it rewrote the key instead of removing it.
 *
 * A rejection is reported rather than thrown: the mutation has already committed and reversing it
 * because a cache key survived would be the worse of the two failures. A stale index alone cannot
 * authenticate anybody — every blob it names is gone by the time this runs.
 */
export async function deleteSessionIndexKey(
  store: SessionKeyStore,
  userId: string,
): Promise<boolean> {
  const outcome = await deleteEach(store, [activeSessionsIndexKey(userId)])
  return outcome.failedKeys.length === 0
}
