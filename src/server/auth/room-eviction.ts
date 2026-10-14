import { createAuthMiddleware, isAPIError } from 'better-auth/api'
import { z } from 'zod'
import { QUEUE_BATCH_MAX, enqueueTasks } from '#/server/queue/jobs'
import { authDb } from './db'
import { sessionStore, taskQueue } from './env'
import { logAuth } from './log'
import { organizationIdsFor } from './provisioning'
import {
  collectSessionTokens,
  createSessionPageReader,
  deleteSessionBlobs,
} from './session-blobs'

import type { BetterAuthPlugin } from 'better-auth'

/**
 * Closing a person's open trip-room sockets when they stop belonging to a workspace (#1073).
 *
 * Every way a person can lose their place in a workspace ends in one of the Better Auth endpoints
 * or row deletions handled here, so the rule lives beside the auth instance rather than in each
 * caller: an owner removing a member, a member leaving, and the platform console banning, signing
 * out or deleting an account all pass through {@link roomEvictionHook} (or, for a deletion, the
 * user-row hooks in `./index`), whichever door they came through. The console cannot do it itself:
 * its directory reaches no tenant layer by design
 * (`src/server/fns/console/__tests__/isolation.test.ts`), and neither may this module.
 *
 * Ending one's own session does the same (#1093): a password reset, a password change that revokes
 * the other sessions, a sign-out, and a revoke of one, the other or all sessions. A socket is tied
 * to a person and not to a session, so signing out of one device also closes the sockets on their
 * other devices; they reconnect once, and the connect path re-runs the session and tenancy checks.
 * That is accepted: each narrower rule leaves a route the owner of a compromised account would use
 * with the attacker's socket still open.
 *
 * So it only says who and where: one `trip-room-evict` job per workspace, and the queue consumer
 * (`src/server/queue/handlers/trip-room-evict.ts`) reads the rooms and closes them. A job is queued
 * only after the change has committed, and nothing here can reject into the request: a failure to
 * queue is logged with ids and the removal stands.
 *
 * The close fires once, so a reconnect has to be refused (#1176). A password reset, a revoke of all
 * sessions and a password change that revokes the others end every session row, but Better Auth
 * removes only the cached blobs the eventually-consistent `active-sessions-<userId>` index lists; a
 * blob the index missed keeps authenticating the account. On those three paths the `before` half
 * therefore reads the person's session tokens from the durable rows while they still exist, and the
 * `after` half deletes each blob by name once the endpoint has succeeded, before the sockets are
 * closed. Best effort, like the close: the person's own action never fails on a KV error, and the
 * limit is the KV convergence window (see `./session-blobs`), not "immediately".
 */

/**
 * Every workspace the person belongs to, read through the auth handle like the rest of `./provisioning`.
 * Never rejects: an unreadable list is logged and means there is nothing to queue.
 */
export async function workspaceIdsOf(userId: string): Promise<Array<string>> {
  try {
    return await organizationIdsFor(authDb(), userId)
  } catch (cause) {
    logAuth('warn', 'room-eviction.workspaces.failed', {
      userId,
      reason: cause instanceof Error ? cause.message : 'unknown',
    })
    return []
  }
}

/**
 * Queues the close of the person's sockets in each named workspace. Never rejects.
 *
 * Ids only in the log line: a person's name or email is never written for this.
 */
export async function queueRoomEviction(
  userId: string,
  organizationIds: ReadonlyArray<string>,
  source: string,
): Promise<void> {
  if (organizationIds.length === 0) return
  try {
    const queue = taskQueue()
    for (
      let start = 0;
      start < organizationIds.length;
      start += QUEUE_BATCH_MAX
    ) {
      await enqueueTasks(
        queue,
        organizationIds.slice(start, start + QUEUE_BATCH_MAX).map((orgId) => ({
          kind: 'trip-room-evict' as const,
          orgId,
          payload: { userId },
        })),
      )
    }
  } catch (cause) {
    logAuth('warn', 'room-eviction.enqueue.failed', {
      userId,
      source,
      organizations: organizationIds.join(','),
      reason: cause instanceof Error ? cause.message : 'unknown',
    })
  }
}

const userBody = z.object({ userId: z.string().min(1) })

/** `/change-password` answers the user the endpoint resolved, and a `token` only when it revoked the others. */
const changedPassword = z.object({
  token: z.string().nullable(),
  user: z.object({ id: z.string().min(1) }),
})

/** `/organization/remove-member` answers `{ member }`, `/organization/leave` answers the member. */
const memberRow = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
})
const removedMember = z.union([z.object({ member: memberRow }), memberRow])

async function evictEverywhere(userId: string, source: string): Promise<void> {
  await queueRoomEviction(userId, await workspaceIdsOf(userId), source)
}

/**
 * The endpoints that end a session by what the session is or what the caller holds, not by an id in
 * the request: the person is read by {@link roomEvictionPrepareHook} before the endpoint deletes it.
 */
const SESSION_ENDING_PATHS: ReadonlySet<string> = new Set([
  '/reset-password',
  '/sign-out',
  '/revoke-session',
  '/revoke-other-sessions',
  '/revoke-sessions',
  '/admin/revoke-user-session',
])

/** {@link SESSION_ENDING_PATHS} plus the one whose success depends on a flag in the body. */
const PREPARED_PATHS: ReadonlySet<string> = new Set([
  ...SESSION_ENDING_PATHS,
  '/change-password',
])

/**
 * The paths that end every session row of the person while Better Auth removes only the indexed
 * blobs (`internalAdapter.deleteUserSessions`). Sign-out and the revoke of one delete their blob by
 * name already; revoke-other-sessions lists from the same index, so its gap is a revocation gap.
 */
const BLOB_PURGING_PATHS: ReadonlySet<string> = new Set([
  '/reset-password',
  '/revoke-sessions',
  '/change-password',
])

/** What {@link roomEvictionPrepareHook} leaves on the request for {@link roomEvictionHook}. */
const resolvedPerson = z.object({ roomEvictionUserId: z.string().min(1) })
const resolvedTokens = z.object({
  roomEvictionSessionTokens: z.array(z.string().min(1)),
})

/** `/change-password` ends the other sessions only when asked to, and only then is there anything to purge. */
const revokingBody = z.object({ revokeOtherSessions: z.literal(true) })

const tokenBody = z.object({ token: z.string().min(1) })
const sessionTokenBody = z.object({ sessionToken: z.string().min(1) })
/** Better Auth reads the reset token from the body first, then from the query. */
const optionalToken = z.object({ token: z.string().min(1).optional() })

/**
 * The `before` hook for the endpoints that end a session: it resolves the person while the session or
 * the reset token still exists, because an endpoint like sign-out deletes it and the `after` hook
 * then has nothing left to read. The person is never taken from the request: it is the owner of the
 * session cookie, of the session a token names, or the user a reset token was issued to, each read
 * from the store. On the paths that end every session row it also reads the tokens those rows name,
 * which is the only moment they can be read. Nothing is queued or deleted here, only handed on; a
 * request whose endpoint then fails changes nothing, and nothing in this hook can reject into the
 * request.
 */
const roomEvictionPrepareHook = createAuthMiddleware(async (ctx) => {
  // A password change that revokes nothing ends no session and purges nothing: nothing to resolve.
  if (
    ctx.path === '/change-password' &&
    !revokingBody.safeParse(ctx.body).success
  ) {
    return
  }
  let userId: string | null = null
  let tokens: ReadonlyArray<string> = []
  try {
    userId = await personEndingSession(ctx)
    if (userId !== null && endsEveryRow(ctx)) {
      try {
        tokens = await collectSessionTokens(
          createSessionPageReader(async () => ctx.context.adapter, userId),
        )
      } catch (cause) {
        // Same rule as below: the error's name only, a failed query's message can carry a token.
        // Error level like a rejected delete: the purge did not happen, on an account-recovery path.
        logAuth('error', 'room-eviction.blobs.unread', {
          userId,
          source: ctx.path,
          reason: cause instanceof Error ? cause.name : 'unknown',
        })
      }
    }
  } catch (cause) {
    // The error's name only: a failed query's message carries its parameters, which here are a
    // session token or a reset token, and a credential is never logged.
    logAuth('warn', 'room-eviction.session.failed', {
      source: ctx.path,
      reason: cause instanceof Error ? cause.name : 'unknown',
    })
  }
  // Always written, empty when nobody was resolved: a key an in-process `auth.api.*` caller put on
  // the call itself must not survive into the `after` hook and name somebody else, or somebody
  // else's blobs.
  return {
    context: {
      roomEvictionUserId: userId ?? '',
      roomEvictionSessionTokens: [...tokens],
    },
  }
})

/**
 * {@link roomEvictionPrepareHook} as a plugin with a matcher rather than as `hooks.before`: the
 * single `hooks.before` slot of the auth options is left free for a guard that must run on one
 * endpoint (the two-factor enrolment guard), and this one only runs on the paths that need it.
 */
export const roomEvictionPrepare: BetterAuthPlugin = {
  id: 'room-eviction-prepare',
  hooks: {
    before: [
      {
        matcher: (ctx) =>
          ctx.path !== undefined && PREPARED_PATHS.has(ctx.path),
        handler: roomEvictionPrepareHook,
      },
    ],
  },
}

type PrepareContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]

function endsEveryRow(ctx: PrepareContext): boolean {
  if (ctx.path === undefined || !BLOB_PURGING_PATHS.has(ctx.path)) return false
  return (
    ctx.path !== '/change-password' || revokingBody.safeParse(ctx.body).success
  )
}

async function personEndingSession(
  ctx: PrepareContext,
): Promise<string | null> {
  const { internalAdapter } = ctx.context

  if (ctx.path === '/reset-password') {
    const token =
      optionalToken.safeParse(ctx.body).data?.token ??
      optionalToken.safeParse(ctx.query).data?.token
    if (token === undefined) return null
    const verification = await internalAdapter.findVerificationValue(
      `reset-password:${token}`,
    )
    return verification?.value ?? null
  }

  if (ctx.path === '/admin/revoke-user-session') {
    const body = sessionTokenBody.safeParse(ctx.body)
    if (!body.success) return null
    const found = await internalAdapter.findSession(body.data.sessionToken)
    return found?.session.userId ?? null
  }

  const cookie = await ctx.getSignedCookie(
    ctx.context.authCookies.sessionToken.name,
    ctx.context.secret,
  )
  if (!cookie) return null
  const own = await internalAdapter.findSession(cookie)
  if (!own) return null

  if (ctx.path === '/revoke-session') {
    // The endpoint answers success for a token that is not the caller's and deletes nothing.
    const body = tokenBody.safeParse(ctx.body)
    if (!body.success) return null
    const named = await internalAdapter.findSession(body.data.token)
    return named?.session.userId === own.session.userId
      ? own.session.userId
      : null
  }
  return own.session.userId
}

/**
 * `hooks.after` for the endpoints whose success ends a person's place in a workspace or ends their
 * sessions: remove member, leave, ban, sign out every session, and the self-service ones (#1093).
 * On a password reset, a revoke of all sessions and a password change that revokes the others it also
 * deletes the cached session blobs the `before` half read, before queueing the close (#1176).
 * Keyed on the path and on a response that is not an error, and on the ids the endpoint itself resolved (the member it
 * returned, the validated `userId` it was given, the person {@link roomEvictionPrepareHook} read from
 * the store), never on anything read from a request header.
 */
export const roomEvictionHook = createAuthMiddleware(async (ctx) => {
  const returned: unknown = ctx.context.returned
  if (
    returned === undefined ||
    returned instanceof Error ||
    isAPIError(returned)
  ) {
    return
  }

  if (
    ctx.path === '/organization/remove-member' ||
    ctx.path === '/organization/leave'
  ) {
    const parsed = removedMember.safeParse(returned)
    if (!parsed.success) return
    const row = 'member' in parsed.data ? parsed.data.member : parsed.data
    await queueRoomEviction(row.userId, [row.organizationId], ctx.path)
    return
  }

  if (
    ctx.path === '/admin/ban-user' ||
    ctx.path === '/admin/revoke-user-sessions'
  ) {
    const body = userBody.safeParse(ctx.body)
    if (!body.success) return
    await queueRoomEviction(
      body.data.userId,
      await workspaceIdsOf(body.data.userId),
      ctx.path,
    )
    return
  }

  if (ctx.path === '/change-password') {
    // A password change that leaves the other sessions alone closes nothing: it answers a null `token`.
    const parsed = changedPassword.safeParse(returned)
    if (!parsed.success || parsed.data.token === null) return
    await purgeEndedSessions(ctx, parsed.data.user.id, ctx.path)
    await evictEverywhere(parsed.data.user.id, ctx.path)
    return
  }

  if (SESSION_ENDING_PATHS.has(ctx.path)) {
    const prepared = resolvedPerson.safeParse(ctx)
    if (!prepared.success) return
    await purgeEndedSessions(ctx, prepared.data.roomEvictionUserId, ctx.path)
    await evictEverywhere(prepared.data.roomEvictionUserId, ctx.path)
  }
})

/**
 * Deletes, by name, the cached blob of each session the `before` half read, once the endpoint has
 * succeeded. Never rejects: every delete is attempted and the failures are retried once, then logged
 * at error level with the person's id, the path and the counts, never a token. The per-user index
 * key is not touched, and a session the endpoint created is not in the list.
 */
async function purgeEndedSessions(
  ctx: { path: string },
  userId: string,
  source: string,
): Promise<void> {
  const prepared = resolvedTokens.safeParse(ctx)
  if (
    !prepared.success ||
    prepared.data.roomEvictionSessionTokens.length === 0
  ) {
    return
  }
  try {
    const purge = await deleteSessionBlobs(
      sessionStore(),
      prepared.data.roomEvictionSessionTokens,
    )
    if (purge.failed > 0) {
      logAuth('error', 'room-eviction.blobs.failed', {
        userId,
        source,
        enumerated: purge.enumerated,
        deleted: purge.deleted,
        failed: purge.failed,
      })
    }
  } catch (cause) {
    logAuth('error', 'room-eviction.blobs.failed', {
      userId,
      source,
      reason: cause instanceof Error ? cause.name : 'unknown',
    })
  }
}
