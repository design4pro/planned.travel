/**
 * The session half of the console: what an account currently holds, and the two ways to take it
 * away.
 *
 * The list is read from D1 rather than from `auth.api.listUserSessions`, and that is a decision with
 * a reason rather than a preference. That endpoint reads the secondary-storage index
 * `active-sessions-<userId>` and then reads each blob, so it answers `[]` whenever the index is
 * missing *or* whenever the blobs have been dropped — and dropping the blobs is exactly what every
 * mutation in `./users` deliberately does to make its change take effect on the next request. Read
 * through KV, this screen would show "no sessions" for an account that is signed in on three
 * devices, seconds after a role change. D1 is the durable record (`storeSessionInDatabase: true`)
 * and docs/ARCHITECTURE.md §4 rule 2 says a read-your-own-write path reads it rather than the cache.
 *
 * Revoking one session goes through the plugin whole: `internalAdapter.deleteSession` deletes the
 * KV blob, repairs the per-user index and deletes the D1 row, in that order, and needs no help.
 * Revoking *all* of them does not: `deleteUserSessions` enumerates from the same index this file
 * refuses to trust. So the all-sessions path deletes every cached blob **first**, walking D1 to
 * exhaustion, and only then calls the plugin — exactly as the ban path does, and for exactly its
 * reason. `revokeUserSessions` deletes every D1 `session` row by predicate, so a blob still cached
 * after it has run is one nothing anywhere can name again; a purge that cannot finish therefore
 * refuses the revocation rather than half-performing it.
 *
 * **Reading the list is not here, and that is a bundling boundary rather than a taxonomy.** This
 * module is imported by `-ui/session-actions.tsx` and `-ui/user-actions.tsx`, so it is in the
 * client graph, so every export in it must be a `createServerFn` — a plain server-only function's
 * body is not stripped from the client twin, and its reach into `./context` takes the whole client
 * build down on `@tanstack/react-start/server`. The read has no client caller and so must *not* be
 * one, for the opposite reason: a `createServerFn` called only from another handler is never
 * registered and throws `Server function info not found` in the deployed Worker. It lives in
 * `./session-listing`, whose header carries both halves of that argument; `readSessions` is shared
 * from there, reached from inside a handler and therefore dropped on the client.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { PLATFORM_ACTIONS } from '#/server/catalog/audit'
import { platformApi } from './bindings'
import {
  clearSessionCache,
  endSessionIndex,
  openConsoleCall,
  recordConsoleAction,
} from './context'
import { ConsoleActionError } from './errors'
import { readSessions } from './session-listing'

const userId = z.string().trim().min(1).max(64)

export const revokePlatformSessionInputSchema = z.object({
  userId,
  /**
   * The session's `id`, never its `token`.
   *
   * `revokeUserSession` takes a token, and a client that could name one could revoke any session in
   * the product — the endpoint has no notion of which account a token belongs to. The server maps
   * the id back to a token out of its own scoped read below, so the account named in `userId` is
   * the only account this call can reach.
   */
  sessionId: z.string().trim().min(1).max(64),
})
export const revokePlatformUserSessionsInputSchema = z.object({ userId })

/** Revokes one session of one account. `platform.session.revoked`. */
export const revokePlatformSessionFn = createServerFn({ method: 'POST' })
  .validator(revokePlatformSessionInputSchema)
  .handler(async ({ data }): Promise<{ sessionId: string }> => {
    const call = await openConsoleCall({ session: ['revoke'] })

    const listing = await readSessions(data.userId)
    const target = listing.sessions.find(
      (session) => session.id === data.sessionId,
    )
    if (!target) {
      // The two refusals are deliberately not one. An enumeration that reached the end of the
      // account's sessions is entitled to say the named one is gone; an enumeration that stopped at
      // the ceiling is not, and reporting a session it never looked at as ended would leave a live
      // session behind while telling the operator it had been dealt with.
      throw listing.truncated
        ? new ConsoleActionError(
            'target-beyond-cap',
            'This account holds more sessions than the console lists in one call, and that session was not among them. Revoke all of its sessions instead.',
          )
        : new ConsoleActionError(
            'target-not-found',
            'That session has already ended.',
          )
    }

    await platformApi().revokeUserSession({
      body: { sessionToken: target.token },
      headers: call.headers,
    })

    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.SESSION_REVOKED,
      entityId: target.id,
      // The token is the credential and is not recorded. What identifies the session in the ledger
      // is its id, which is already the row's `entity_id`.
      changes: {
        before: {
          userId: target.userId,
          ipAddress: target.ipAddress ?? null,
          userAgent: target.userAgent ?? null,
          expiresAt: target.expiresAt.toISOString(),
          revoked: false,
        },
        after: { userId: target.userId, revoked: true },
      },
    })

    return { sessionId: target.id }
  })

/**
 * Revokes every session of one account. `platform.session.revoked_all`.
 *
 * `entity_id` is `null` and not the account id. The prefix `platform.session.*` fixes `entity_type`
 * to `session` (docs/ACCESS.md §4.2), and there is no single session this action touched — putting a
 * user id in a column the query in §4.4 reads as a session id would make the timeline query answer
 * wrongly rather than answer nothing. The account and the count live in `changes`, where they are
 * what they say they are.
 */
export const revokePlatformUserSessionsFn = createServerFn({ method: 'POST' })
  .validator(revokePlatformUserSessionsInputSchema)
  .handler(async ({ data }): Promise<{ revoked: number }> => {
    const call = await openConsoleCall({ session: ['revoke'] })

    // Before the plugin call, and refused rather than truncated if it cannot finish, for the same
    // reason the ban path is: `revokeUserSessions` deletes every D1 `session` row by predicate,
    // and a blob left cached after that is one nothing can name again. See `clearSessionCache`.
    const purge = await clearSessionCache(
      call,
      data.userId,
      PLATFORM_ACTIONS.SESSION_REVOKED_ALL,
    )

    await platformApi().revokeUserSessions({
      body: { userId: data.userId },
      headers: call.headers,
    })

    await endSessionIndex(
      call,
      data.userId,
      PLATFORM_ACTIONS.SESSION_REVOKED_ALL,
    )

    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.SESSION_REVOKED_ALL,
      entityId: null,
      changes: {
        before: { userId: data.userId, sessions: purge.enumerated },
        after: { userId: data.userId, sessions: 0 },
      },
    })

    call.logger.info('console purged session keys', {
      action: PLATFORM_ACTIONS.SESSION_REVOKED_ALL,
      entityId: data.userId,
      enumerated: purge.enumerated,
      deleted: purge.deleted,
    })

    return { revoked: purge.enumerated }
  })
