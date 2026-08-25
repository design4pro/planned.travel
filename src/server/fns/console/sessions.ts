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
 * refuses to trust, so the all-sessions path enumerates the tokens from D1 first and deletes their
 * keys by name afterwards, exactly as the ban path does.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { PLATFORM_ACTIONS } from '#/server/catalog/audit'
import { platformApi, readSessionRows, sessionKeyStore } from './bindings'
import { openConsoleCall, recordConsoleAction } from './context'
import { ConsoleActionError } from './errors'
import { platformSessionSchema, toConsoleSession } from './projections'
import { purgeSessionKeys, sessionTokensFrom } from './session-keys'

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

/** The account's live sessions, newest first. Reads are not audited (docs/ACCESS.md §4.2). */
async function readSessions(
  id: string,
): Promise<ReadonlyArray<PlatformSessionRow>> {
  const rows = await readSessionRows(id)
  return z
    .array(platformSessionSchema)
    .parse(rows)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
}

/** One account's sessions. Not audited. */
export const listPlatformSessionsFn = createServerFn({ method: 'GET' })
  .validator(listPlatformSessionsInputSchema)
  .handler(async ({ data }): Promise<ReadonlyArray<ConsoleSession>> => {
    const call = await openConsoleCall({ session: ['list'] })
    const sessions = await readSessions(data.userId)

    call.logger.info('console platform read', {
      action: 'platform.session.list',
      actorUserId: call.actor.userId,
      actorRole: call.actor.role,
      entityId: data.userId,
      returned: sessions.length,
    })

    return sessions.map(toConsoleSession)
  })

/** Revokes one session of one account. `platform.session.revoked`. */
export const revokePlatformSessionFn = createServerFn({ method: 'POST' })
  .validator(revokePlatformSessionInputSchema)
  .handler(async ({ data }): Promise<{ sessionId: string }> => {
    const call = await openConsoleCall({ session: ['revoke'] })

    const target = (await readSessions(data.userId)).find(
      (session) => session.id === data.sessionId,
    )
    if (!target) {
      throw new ConsoleActionError(
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

    const tokens = sessionTokensFrom(await readSessionRows(data.userId))

    await platformApi().revokeUserSessions({
      body: { userId: data.userId },
      headers: call.headers,
    })

    const purge = await purgeSessionKeys(sessionKeyStore(), data.userId, tokens)

    await recordConsoleAction(call, {
      action: PLATFORM_ACTIONS.SESSION_REVOKED_ALL,
      entityId: null,
      changes: {
        before: { userId: data.userId, sessions: tokens.length },
        after: { userId: data.userId, sessions: 0 },
      },
    })

    if (purge.failed > 0 || purge.truncated) {
      call.logger.warn('console session revocation left keys behind', {
        action: PLATFORM_ACTIONS.SESSION_REVOKED_ALL,
        entityId: data.userId,
        actorUserId: call.actor.userId,
        ...purge,
      })
    }

    return { revoked: tokens.length }
  })
