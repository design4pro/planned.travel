import { createAuthMiddleware, isAPIError } from 'better-auth/api'
import { z } from 'zod'
import { QUEUE_BATCH_MAX, enqueueTasks } from '#/server/queue/jobs'
import { authDb } from './db'
import { taskQueue } from './env'
import { logAuth } from './log'
import { organizationIdsFor } from './provisioning'

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
 * the request: the person is read by {@link roomEvictionPrepare} before the endpoint deletes it.
 */
const SESSION_ENDING_PATHS: ReadonlySet<string> = new Set([
  '/reset-password',
  '/sign-out',
  '/revoke-session',
  '/revoke-other-sessions',
  '/revoke-sessions',
  '/admin/revoke-user-session',
])

/** What {@link roomEvictionPrepare} leaves on the request for {@link roomEvictionHook}. */
const resolvedPerson = z.object({ roomEvictionUserId: z.string().min(1) })

const tokenBody = z.object({ token: z.string().min(1) })
const sessionTokenBody = z.object({ sessionToken: z.string().min(1) })
/** Better Auth reads the reset token from the body first, then from the query. */
const resetBody = z.object({ token: z.string().min(1).optional() })
const resetQuery = z.object({ token: z.string().min(1).optional() })

/**
 * The `before` hook for the endpoints that end a session: it resolves the person while the session or
 * the reset token still exists, because an endpoint like sign-out deletes it and the `after` hook
 * then has nothing left to read. The person is never taken from the request: it is the owner of the
 * session cookie, of the session a token names, or the user a reset token was issued to, each read
 * from the store. Nothing is queued here, only handed on; a request whose endpoint then fails queues
 * nothing, and nothing in this hook can reject into the request.
 */
const roomEvictionPrepareHook = createAuthMiddleware(async (ctx) => {
  try {
    const userId = await personEndingSession(ctx)
    if (userId === null) return
    return { context: { roomEvictionUserId: userId } }
  } catch (cause) {
    // The error's name only: a failed query's message carries its parameters, which here are a
    // session token or a reset token, and a credential is never logged.
    logAuth('warn', 'room-eviction.session.failed', {
      source: ctx.path,
      reason: cause instanceof Error ? cause.name : 'unknown',
    })
  }
})

/**
 * {@link roomEvictionPrepare} as a plugin with a matcher rather than as `hooks.before`: the
 * single `hooks.before` slot of the auth options is left free for a guard that must run on one
 * endpoint (the two-factor enrolment guard), and this one only runs on the paths that need it.
 */
export const roomEvictionPrepare: BetterAuthPlugin = {
  id: 'room-eviction-prepare',
  hooks: {
    before: [
      {
        matcher: (ctx) =>
          ctx.path !== undefined && SESSION_ENDING_PATHS.has(ctx.path),
        handler: roomEvictionPrepareHook,
      },
    ],
  },
}

type PrepareContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0]

async function personEndingSession(
  ctx: PrepareContext,
): Promise<string | null> {
  const { internalAdapter } = ctx.context

  if (ctx.path === '/reset-password') {
    const token =
      resetBody.safeParse(ctx.body).data?.token ??
      resetQuery.safeParse(ctx.query).data?.token
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
 * sessions: remove member, leave, ban, sign out every session, and the self-service ones (#1093). Keyed on the path and on a
 * response that is not an error, and on the ids the endpoint itself resolved (the member it
 * returned, the validated `userId` it was given), never on anything read from a request header.
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
    await evictEverywhere(parsed.data.user.id, ctx.path)
    return
  }

  if (SESSION_ENDING_PATHS.has(ctx.path)) {
    const prepared = resolvedPerson.safeParse(ctx)
    if (!prepared.success) return
    await evictEverywhere(prepared.data.roomEvictionUserId, ctx.path)
  }
})
