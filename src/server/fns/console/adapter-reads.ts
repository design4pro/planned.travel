/**
 * The two D1 reads this directory takes through Better Auth's own database adapter, written so they
 * can be driven by a test rather than described by one.
 *
 * They used to live in `./bindings`, which imports `cloudflare:workers` and therefore cannot be
 * loaded by the `server` Vitest project at all. The consequence was measured rather than suspected:
 * `__tests__/console.test.ts` replaces `../bindings` wholesale, so its factory carried a *copy* of
 * both queries, and every property those queries exist to hold — the expiry predicate, the total
 * order, the single expiry instant across a paged walk — was pinned against the copy while the
 * shipped query was executed by nothing. Deleting either clause from the real file left all 110
 * console tests green.
 *
 * So the queries take their adapter as an argument, exactly as `./session-keys` takes its page
 * function and its key store, and `./bindings` shrinks to the one thing only it can do: resolve the
 * adapter out of the Worker environment. The mock in `__tests__/console.test.ts` now calls straight
 * into this module, which puts the shipped query under the real Better Auth adapter over the real
 * SQLite schema, and `__tests__/adapter-reads.test.ts` asserts the query *shape* against a recording
 * double.
 *
 * Nothing here decides anything: no authorisation, no validation of a caller's input, no audit
 * write. It reads two things and reports what it read, including its own failure to read.
 */

import { z } from 'zod'

import type { getAuth } from '#/server/auth'
import type { SessionRowPage } from './session-keys'

/**
 * The slice of Better Auth's database adapter these two reads use.
 *
 * Derived from the shipped instance rather than hand-declared, so a bump that changes the adapter's
 * query shape is a type error here instead of a runtime surprise, and so a test double has to be a
 * real adapter rather than an approximation of one.
 */
export type AuthReadAdapter = Pick<
  Awaited<ReturnType<typeof getAuth>['$context']>['adapter'],
  'findMany' | 'findOne'
>

/**
 * How the adapter is obtained, deferred because `getAuth().$context` is a promise resolved per
 * isolate and a page function must be constructible synchronously.
 */
export type AuthReadAdapterSource = () => Promise<AuthReadAdapter>

/**
 * A page function over one account's **live** session rows, read from D1.
 *
 * Straight through Better Auth's own database adapter rather than a Drizzle statement of ours:
 * `session` is an auth-owned table, the adapter already knows its field mapping, and this keeps the
 * read on the same layer as every other auth read in the product — no SQL is written in
 * `src/server/fns`. It is emphatically *not* `internalAdapter.listSessions`, and not
 * `auth.api.listUserSessions` above it: both consult secondary storage and answer `[]` when the KV
 * index is missing, which is the exact reading this whole path exists to stop trusting. That was
 * once handed down as a repair instruction and then withdrawn once the endpoint was read — it
 * reports "no sessions" in precisely the case a ban most needs to see them — so the adapter read is
 * a decision on the record and not a layering oversight to tidy away. The plugin's in-process
 * endpoints carry every session *mutation* — `revokeUserSession`, `revokeUserSessions`, `banUser` —
 * and what they cannot supply is an authoritative list. docs/ARCHITECTURE.md §4 rule 2 says where an
 * authoritative list comes from: "any read-your-own-write path must read D1, not the cache".
 *
 * `session_user_id_idx` is what makes the predicate cheap, and `storeSessionInDatabase: true` is
 * what makes D1 the durable record rather than a mirror.
 *
 * **Expired rows are excluded.** With `storeSessionInDatabase` a row is deleted only lazily, on the
 * next `findSession` that resolves it, so an account accumulates a row for every device it never
 * returns to. Without this predicate the console would list sessions that ended weeks ago as live
 * and `platform.session.revoked` would be written for one of them. Excluding them costs the purge
 * nothing: `getSession` refuses a cached blob whose `expiresAt` has passed and deletes it on the
 * spot (`better-auth@1.7.1`, `dist/api/routes/session.mjs`), so an expired blob cannot authenticate
 * anybody whether or not this call removed it.
 *
 * **One instant for the whole walk.** The expiry bound is captured when the reader is built rather
 * than re-evaluated per page: a predicate that moved between pages would shift the result set under
 * offset paging and drop rows, and a dropped row here is a live session a ban never reaches.
 *
 * **Ordered by `id`.** `id` is unique, so it is a total order: offset paging over it neither drops a
 * row between pages nor repeats one. `createdAt` is a millisecond stamp two sessions can share, and
 * an unstable sort under paging loses rows silently.
 */
export function createSessionPageReader(
  source: AuthReadAdapterSource,
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
 * What one attempt to read an account's platform role found — including the attempt that found
 * nothing, which is the whole reason this is not a `string | null`.
 *
 * `role` is `null` for an account whose column is `NULL`, which docs/ACCESS.md §1.3 resolves as
 * `user` and which is an ordinary, correct answer. `ok: false` is the *absence* of an answer, and
 * collapsing the two is how an admin's action ends up in the ledger under `actor_role: 'user'`:
 * `resolvePlatformRole(null)` is `'user'`, so a read that failed and a plain account are the same
 * value by the time the audit writer sees it. docs/ACCESS.md §4.1 records `actor_role` as a value
 * precisely so nothing can rewrite it afterwards, which makes writing the wrong one worse than
 * refusing to write at all.
 */
export type PlatformRoleRead =
  | { readonly ok: true; readonly role: string | null }
  | { readonly ok: false; readonly reason: PlatformRoleReadFailure }

/** Why a role read produced no answer. Separated because they lead to different operator advice. */
export type PlatformRoleReadFailure =
  /** The adapter answered, and there is no `user` row with that id. A retry will not help. */
  | 'not-found'
  /** The adapter rejected, or answered something that is not a `user` row. A retry may help. */
  | 'unreadable'

const userRoleSchema = z.object({ role: z.string().nullish() })

/**
 * One `user` row's platform role, straight from D1.
 *
 * `auth.api.getUser` would be the obvious call and cannot be used here: it checks `user:get` for
 * itself, and the only caller is the impersonation exit, which runs on a session that holds no
 * statement at all (docs/ACCESS.md §6.4). This is a read of one column of a row the caller has
 * already proved it is connected to, taken through the same adapter as
 * {@link createSessionPageReader}.
 *
 * The adapter's rejection is caught here rather than propagated so that the caller has exactly one
 * branch to write and every failure arrives through it — a rejected read and an unparseable row are
 * the same fact ("no answer") to everything downstream, and only this function can tell them apart
 * from a `NULL` column.
 */
export async function readPlatformRole(
  source: AuthReadAdapterSource,
  userId: string,
): Promise<PlatformRoleRead> {
  let row: unknown
  try {
    const adapter = await source()
    row = await adapter.findOne<unknown>({
      model: 'user',
      where: [{ field: 'id', value: userId }],
      select: ['role'],
    })
  } catch {
    return { ok: false, reason: 'unreadable' }
  }

  if (row === null || row === undefined) {
    return { ok: false, reason: 'not-found' }
  }

  const parsed = userRoleSchema.safeParse(row)
  if (!parsed.success) {
    return { ok: false, reason: 'unreadable' }
  }
  return { ok: true, role: parsed.data.role ?? null }
}
