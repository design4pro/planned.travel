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
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { PLATFORM_ACTIONS } from '#/server/catalog/audit'
import { platformApi, readSessionRows } from './bindings'
import {
  clearSessionCache,
  endSessionIndex,
  openConsoleCall,
  recordConsoleAction,
  recordConsoleRead,
} from './context'
import { ConsoleActionError } from './errors'
import { platformSessionSchema, toConsoleSession } from './projections'

import type { ConsoleSession, PlatformSessionRow } from './projections'

const userId = z.string().trim().min(1).max(64)

export const listPlatformSessionsInputSchema = z.object({ userId })
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

/** What one account holds, and whether the enumeration reached the end of it. */
interface SessionListing {
  readonly sessions: ReadonlyArray<PlatformSessionRow>
  readonly truncated: boolean
}

/**
 * The account's live sessions, newest first. Reads are not audited (docs/ACCESS.md §4.2).
 *
 * "Live" is a predicate and not a manner of speaking: `./bindings` excludes rows whose `expiresAt`
 * has passed. With `storeSessionInDatabase` a row is deleted only lazily, on the next `findSession`
 * that resolves it, so an account accumulates one for every device it never comes back to — and
 * without the predicate the console would render sessions that ended weeks ago as current, and
 * `revokePlatformSessionFn` would happily write `platform.session.revoked` for one of them.
 *
 * The enumeration is ordered by `id` so that offset paging is stable; the display order is applied
 * here, afterwards, in memory. Two orders because they answer different questions - one has to be a
 * total order over a paged read, the other has to put the session an operator is looking for at the
 * top - and conflating them is what makes a paged read lose rows.
 */
async function readSessions(id: string): Promise<SessionListing> {
  const enumeration = await readSessionRows(id)
  const sessions = z
    .array(platformSessionSchema)
    .parse(enumeration.rows)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
  return { sessions, truncated: enumeration.truncated }
}

/**
 * One account's sessions. Not audited.
 *
 * `truncated` leaves with the page rather than being swallowed: a screen that showed six hundred
 * sessions as though they were all of them would be making the same claim a silent `LIMIT` makes,
 * and the operator deciding whether to revoke one session or all of them is exactly the reader who
 * needs to know the difference.
 */
export const listPlatformSessionsFn = createServerFn({ method: 'GET' })
  .validator(listPlatformSessionsInputSchema)
  .handler(
    async ({
      data,
    }): Promise<{
      sessions: ReadonlyArray<ConsoleSession>
      truncated: boolean
    }> => {
      const call = await openConsoleCall({ session: ['list'] })
      const listing = await readSessions(data.userId)

      recordConsoleRead(call, 'sessions', {
        entityId: data.userId,
        returned: listing.sessions.length,
        truncated: listing.truncated,
      })

      return {
        sessions: listing.sessions.map(toConsoleSession),
        truncated: listing.truncated,
      }
    },
  )

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
