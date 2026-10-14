import { z } from 'zod'

import type { createAuthMiddleware } from 'better-auth/api'

/**
 * Deleting the cached session blobs of an account by the names its durable session rows give.
 *
 * Better Auth keeps a session blob in KV under its raw token and, when it ends every session of a
 * person (`internalAdapter.deleteUserSessions`), removes the blobs it can find through the
 * eventually-consistent per-user index `active-sessions-<userId>` (a read-modify-write with no
 * compare-and-swap). A blob the index missed keeps authenticating the account on every request
 * until the session expires, and a refresh re-caches it. The `session` table is the durable record
 * (`storeSessionInDatabase: true`), so the tokens are read from it and each blob is deleted by name
 * (docs/ARCHITECTURE.md §4 rule 2: a read-your-own-write path reads D1, not the cache).
 *
 * Two callers share this module and neither is the other's: the room-eviction hooks beside the auth
 * instance (`./room-eviction`, self-service revocation, best effort) and the platform console
 * (`#/server/fns/console/session-keys`, which maps a failure to its own fail-closed refusal). The
 * auth module imports nothing from the console layer, so what both need lives here and takes what it
 * reads and writes as arguments: a page function over the session rows and a key store. That is also
 * what lets `__tests__/session-blobs.test.ts` drive it with a store whose index key is missing, the
 * exact shape of the failure.
 *
 * **The honest bound.** A KV delete is immediate in the colo that served it and eventually
 * consistent elsewhere (Workers KV's 60 second floor), and a refresh in another colo can re-cache a
 * blob inside that window. The purge holds within the KV convergence window, barring a refresh race
 * inside it, and not "immediately". Only a D1-authoritative check closes that window.
 *
 * What losing that race costs: an attacker's request that reaches a colo still showing the old blob,
 * when the session is due a refresh, makes Better Auth write the blob back to KV with a fresh expiry
 * and re-add it to the index before it finds the row gone. That request is refused, but the blob then
 * admits later ones until it expires (up to 30 days). A second "revoke all sessions" clears it, as
 * the index names the token again; closing it for good is the D1 check above (#1085).
 *
 * Tokens are credentials: nothing here logs one, and {@link SessionBlobPurge} carries counts.
 */

/**
 * How many session rows one D1 read asks for. The walk is paged to exhaustion, because a session
 * past a cap that a truncated read never saw is a session whose blob stays live.
 */
export const SESSION_PAGE_SIZE = 200

/**
 * A runaway-loop guard on the exhaustive walk, and emphatically not a policy bound: a Workers
 * invocation's subrequest budget is hit long before fifty thousand sessions. It throws rather than
 * truncating, because truncation is the failure this module exists to make impossible.
 */
export const SESSION_PURGE_PAGE_LIMIT = 250

/** Thrown when the walk reaches {@link SESSION_PURGE_PAGE_LIMIT} pages. */
export class SessionWalkLimitError extends Error {
  constructor() {
    super('The account holds more session rows than one walk reads.')
    this.name = 'SessionWalkLimitError'
  }
}

/**
 * One page of `session` rows, however the caller reads them.
 *
 * A page function must apply a **stable** order and a **fixed** expiry instant across every call it
 * serves, or offset paging drops rows between pages; {@link createSessionPageReader} does both.
 */
export type SessionRowPage = (
  offset: number,
  limit: number,
) => Promise<ReadonlyArray<unknown>>

type MiddlewareContext = Parameters<
  Parameters<typeof createAuthMiddleware>[0]
>[0]

/** The one method of Better Auth's database adapter the page reader uses. */
export type SessionRowAdapter = Pick<
  MiddlewareContext['context']['adapter'],
  'findMany'
>

/**
 * A page function over one account's **live** session rows, read from D1 through Better Auth's own
 * adapter, so no SQL is written outside the repos layer. It is emphatically not
 * `internalAdapter.listSessions` (nor `auth.api.listUserSessions` above it): both read the KV index
 * and answer `[]` when it is missing, which is the reading this module stops trusting.
 *
 * **Expired rows are excluded.** `getSession` refuses a cached blob whose `expiresAt` has passed and
 * deletes it on the spot, so an expired blob authenticates nobody whether or not this removed it.
 *
 * **One instant for the whole walk.** The expiry bound is captured when the reader is built, not
 * re-evaluated per page: a predicate that moved between pages would shift the result set under offset
 * paging and drop rows.
 *
 * **Ordered by `id`.** It is unique, so offset paging over it neither drops a row nor repeats one;
 * `createdAt` is a millisecond stamp two sessions can share.
 *
 * The adapter is resolved per page through `source`, because `getAuth().$context` is a promise
 * resolved per isolate and a page function must be constructible synchronously.
 */
export function createSessionPageReader(
  source: () => Promise<SessionRowAdapter>,
  userId: string,
): SessionRowPage {
  const liveAt = new Date()
  return async (offset, limit) => {
    const adapter = await source()
    return adapter.findMany<unknown>({
      model: 'session',
      where: [
        { field: 'userId', value: userId },
        { field: 'expiresAt', operator: 'gt', value: liveAt },
      ],
      sortBy: { field: 'id', direction: 'asc' },
      limit,
      offset,
    })
  }
}

/**
 * A session blob lives under its *raw token* as the KV key, with no prefix
 * (`internalAdapter.createSession`: `secondaryStorage.set(sessionToken, …)`).
 */
const sessionRowSchema = z.object({ token: z.string().trim().min(1) })

/**
 * The tokens, out of whatever the database adapter handed back. Validated rather than cast: a column
 * list that silently stopped including `token` would otherwise read as "this account had no
 * sessions". A row without a usable token is dropped.
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

/** What one purge reached, and what it could not. */
export interface SessionBlobPurge {
  /** Distinct session tokens read from D1 and attempted. */
  readonly enumerated: number
  /** Blobs actually removed. */
  readonly deleted: number
  /** Blobs whose delete was still rejected after one retry. */
  readonly failed: number
  /**
   * Which keys those were, so a test can name them. Never logged and never returned past the auth
   * and console modules: a session token *is* the credential. Callers report the counts.
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
 * Walks an account's session rows a page at a time to exhaustion, handing each page's tokens (new
 * ones only) to `visit`, and answers how many distinct tokens it saw.
 */
async function walkSessionTokens(
  page: SessionRowPage,
  visit: (tokens: ReadonlyArray<string>) => Promise<void>,
): Promise<number> {
  const seen = new Set<string>()
  let offset = 0

  for (let index = 0; ; index += 1) {
    if (index >= SESSION_PURGE_PAGE_LIMIT) {
      throw new SessionWalkLimitError()
    }

    const rows = await page(offset, SESSION_PAGE_SIZE)
    await visit(
      sessionTokensFrom(rows).filter((token) => {
        if (seen.has(token)) return false
        seen.add(token)
        return true
      }),
    )

    if (rows.length < SESSION_PAGE_SIZE) return seen.size
    offset += rows.length
  }
}

/**
 * Every key is attempted even when an earlier one fails, and the rejections are then retried once as
 * a batch: a KV delete rejects for transient reasons far more often than for permanent ones.
 */
async function settle(
  store: SessionKeyStore,
  enumerated: number,
  deleted: number,
  failedKeys: ReadonlyArray<string>,
): Promise<SessionBlobPurge> {
  if (failedKeys.length === 0) {
    return { enumerated, deleted, failed: 0, failedKeys: [] }
  }
  const retry = await deleteEach(store, failedKeys)
  return {
    enumerated,
    deleted: deleted + retry.deleted,
    failed: retry.failedKeys.length,
    failedKeys: retry.failedKeys,
  }
}

/**
 * The distinct session tokens the account's durable rows name, read to exhaustion. Reads only: the
 * room-eviction hooks call it before the endpoint deletes the rows and delete after it succeeds.
 */
export async function collectSessionTokens(
  page: SessionRowPage,
): Promise<ReadonlyArray<string>> {
  const tokens: Array<string> = []
  await walkSessionTokens(page, async (fresh) => {
    tokens.push(...fresh)
  })
  return tokens
}

/**
 * Deletes the cached blob of each named token. Rejections are reported, not thrown: the caller
 * decides whether a blob that would not go refuses anything. The per-user index key is never touched.
 */
export async function deleteSessionBlobs(
  store: SessionKeyStore,
  tokens: ReadonlyArray<string>,
): Promise<SessionBlobPurge> {
  const first = await deleteEach(store, tokens)
  return settle(store, tokens.length, first.deleted, first.failedKeys)
}

/**
 * Deletes the cached blob of **every** session the account holds, walking D1 to exhaustion, page by
 * page so the work is already done for every page read even if a later one fails.
 */
export async function purgeSessionBlobs(
  store: SessionKeyStore,
  page: SessionRowPage,
): Promise<SessionBlobPurge> {
  let deleted = 0
  const failedKeys: Array<string> = []
  const enumerated = await walkSessionTokens(page, async (tokens) => {
    const outcome = await deleteEach(store, tokens)
    deleted += outcome.deleted
    failedKeys.push(...outcome.failedKeys)
  })
  return settle(store, enumerated, deleted, failedKeys)
}
