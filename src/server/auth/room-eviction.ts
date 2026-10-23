import { createAuthMiddleware, isAPIError } from 'better-auth/api'
import { z } from 'zod'
import { enqueueTasks } from '#/server/queue/jobs'
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
 * with the attacker's socket still open. The exception is a revoke of the other sessions when both
 * the durable rows and the endpoint's session list prove there is no other live session (#1177):
 * it ends nothing, so queues nothing, avoiding a repeatable paid fan-out with one cookie.
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
 *
 * A revoke of the other sessions has the same gap and a different cure (#1240): Better Auth lists the
 * sessions to end from that same index and deletes those, so a session it missed keeps its row and
 * its blob. The `after` half therefore reads the person's other live rows once the endpoint has run,
 * the caller's own session excluded, and ends them through `internalAdapter.deleteSessions`
 * ({@link sweepOtherSessions}). That sweep runs on every successful revoke, whatever the #1177
 * decision says; the decision only keeps the socket close from being queued. Each call costs one
 * paged D1 read and one KV delete per session found, inside the endpoint's rate limit.
 *
 * Ending an impersonation (`/admin/stop-impersonating`, reached only in process through the console's
 * End impersonation function: its HTTP path is closed, #1179) is a session end too. The `before` half
 * reads the owner of the session cookie, which during an impersonation is the impersonated person,
 * never the operator whose own session the signed `admin_session` cookie carries; the room records
 * nothing about impersonation, so a socket opened under the worn identity cannot be told from the
 * person's own and every socket of that person closes, on their own devices too. A sign-out inside an
 * impersonated session resolves the same person and does the same. A failed exit queues nothing.
 *
 * Two concurrent sign-outs on one cookie both resolve the person before either deletes the session,
 * so the eviction is queued twice. That is accepted (#1179): it costs one extra reconnect and loses
 * nothing, a reliable guard needs atomic state across isolates that KV cannot give, and an
 * idempotency key would swallow a legitimate second eviction.
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
    await enqueueTasks(
      queue,
      organizationIds.map((orgId) => ({
        kind: 'trip-room-evict' as const,
        orgId,
        payload: { userId },
      })),
    )
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

/** `/organization/remove-member` (in process: its HTTP path is closed, #1010) answers `{ member }`, `/organization/leave` answers the member. */
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
  '/admin/stop-impersonating',
])

/** {@link SESSION_ENDING_PATHS} plus the one whose success depends on a flag in the body. */
const PREPARED_PATHS: ReadonlySet<string> = new Set([
  ...SESSION_ENDING_PATHS,
  '/change-password',
])

/**
 * The paths that end every session row of the person while Better Auth removes only the indexed
 * blobs (`internalAdapter.deleteUserSessions`), so the `before` half reads their tokens from the rows.
 * Sign-out and the revoke of one delete their blob by name already. Revoke-other-sessions lists from the
 * same index, but it does not end every row, so it is not here: it is swept in the `after` half
 * ({@link sweepOtherSessions}, #1240).
 */
const BLOB_PURGING_PATHS: ReadonlySet<string> = new Set([
  '/reset-password',
  '/revoke-sessions',
  '/change-password',
])

/** What {@link roomEvictionPrepareHook} leaves on the request for {@link roomEvictionHook}. */
const resolvedPerson = z.object({ roomEvictionUserId: z.string().min(1) })
const evictionDecision = z.object({ roomEvictionShouldEvict: z.boolean() })
/** The caller's own session token, proven to belong to the person, which the sweep must spare (#1240). */
const resolvedCaller = z.object({ roomEvictionCallerToken: z.string().min(1) })
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
  let shouldEvict = true
  let userId: string | null = null
  let callerToken = ''
  let tokens: ReadonlyArray<string> = []
  try {
    userId = await personEndingSession(ctx)
    if (userId !== null && ctx.path === '/revoke-other-sessions') {
      try {
        callerToken = await callerTokenOf(ctx, userId)
        shouldEvict = await hasOtherSessions(ctx, userId, callerToken)
      } catch (cause) {
        logAuth('warn', 'room-eviction.other-sessions.unread', {
          source: ctx.path,
          reason: cause instanceof Error ? cause.name : 'unknown',
        })
      }
    }
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
  // the call itself must not survive into the `after` hook and name somebody else, somebody else's
  // blobs, or a caller's session token to spare.
  return {
    context: {
      roomEvictionUserId: userId ?? '',
      roomEvictionShouldEvict: shouldEvict,
      roomEvictionCallerToken: callerToken,
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

/**
 * The token of the caller's own session, read from its signed cookie and the store and kept only when
 * that session belongs to `userId`: the one session a revoke of the others must spare. Empty when the
 * cookie or the session is missing or is somebody else's, which means "nothing to spare, so nothing to
 * sweep" and never "sweep everything".
 */
async function callerTokenOf(
  ctx: PrepareContext,
  userId: string,
): Promise<string> {
  const cookie = await ctx.getSignedCookie(
    ctx.context.authCookies.sessionToken.name,
    ctx.context.secret,
  )
  if (!cookie) return ''
  const own = await ctx.context.internalAdapter.findSession(cookie)
  return own !== null && own.session.userId === userId ? own.session.token : ''
}

/**
 * Only two successful empty reads can suppress the close. The adapter reads durable rows, while
 * listSessions reads the same secondary-storage index the endpoint uses; neither substitutes for
 * the other. One matching durable row suffices, so there is no unbounded walk. All failures leave
 * the default decision intact. The current session is resolved from its signed cookie and store,
 * never from a context an in-process caller supplied.
 */
async function hasOtherSessions(
  ctx: PrepareContext,
  userId: string,
  callerToken: string,
): Promise<boolean> {
  if (callerToken === '') return true
  const now = new Date()
  const durable = await ctx.context.adapter.findMany({
    model: 'session',
    where: [
      { field: 'userId', value: userId },
      { field: 'expiresAt', operator: 'gt', value: now },
      { field: 'token', operator: 'ne', value: callerToken },
    ],
    limit: 1,
  })
  if (durable.length > 0) return true
  const indexed = await ctx.context.internalAdapter.listSessions(userId)
  return indexed.some(
    (session) => session.expiresAt > now && session.token !== callerToken,
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
 * deletes the cached session blobs the `before` half read, before queueing the close (#1176). A revoke
 * of the other sessions first sweeps the rows and blobs the index did not name (#1240).
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
    if (ctx.path === '/revoke-other-sessions') {
      // Whatever #1177 decided: that flag only avoids a paid socket fan-out, it never says whether
      // a session the index lost is still live.
      await sweepOtherSessions(ctx)
      if (
        evictionDecision.safeParse(ctx).data?.roomEvictionShouldEvict === false
      ) {
        return
      }
    }
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

/** Below D1's limit of 100 bound parameters per statement, which a `token in (…)` delete spends one each. */
const SWEEP_CHUNK_SIZE = 50

const errorName = (cause: unknown): string =>
  cause instanceof Error ? cause.name : 'unknown'

/**
 * Ends one batch of sessions through `internalAdapter.deleteSessions`, which deletes the blobs by name
 * and then the rows. A rejected blob delete aborts the whole batch before any row is touched, so a
 * failed batch is retried one session at a time and one stuck key cannot keep the others signed in.
 * Counts what stayed; never throws.
 */
async function endSessions(
  context: PrepareContext['context'],
  tokens: ReadonlyArray<string>,
): Promise<{ failed: number; reason: string | undefined }> {
  try {
    await context.internalAdapter.deleteSessions([...tokens])
    return { failed: 0, reason: undefined }
  } catch (cause) {
    if (tokens.length === 1) return { failed: 1, reason: errorName(cause) }
    let failed = 0
    let reason: string | undefined
    for (const token of tokens) {
      const single = await endSessions(context, [token])
      failed += single.failed
      reason ??= single.reason
    }
    return { failed, reason }
  }
}

/**
 * After a successful revoke-other-sessions, ends every other live session of the caller, named by the
 * index or not (#1240). Better Auth lists the sessions to end from the eventually-consistent
 * `active-sessions-<userId>` index, so a session the index missed keeps its `session` row and its blob
 * and stays signed in. The rows are read here, after the endpoint ran, so a session created between the
 * two halves is covered, and ended through the library's own `internalAdapter.deleteSessions`: no SQL
 * of ours, and the blobs go by name.
 *
 * The person and the caller's token are the ones {@link roomEvictionPrepareHook} read from the signed
 * cookie and the store. Missing either, nothing is deleted: there is no fallback to "this person's
 * every session". Best effort like the rest of this module: nothing rejects into the request, and a
 * failure is logged at error level with the person's id, the path, counts and the error's name, never
 * a token. The limit is the KV convergence window, not "immediately" (see `./session-blobs`).
 */
async function sweepOtherSessions(ctx: PrepareContext): Promise<void> {
  const person = resolvedPerson.safeParse(ctx)
  const caller = resolvedCaller.safeParse(ctx)
  if (!person.success || !caller.success) return
  const userId = person.data.roomEvictionUserId
  const callerToken = caller.data.roomEvictionCallerToken
  let others: ReadonlyArray<string>
  try {
    const live = await collectSessionTokens(
      createSessionPageReader(async () => ctx.context.adapter, userId),
    )
    others = live.filter((token) => token !== callerToken)
  } catch (cause) {
    logAuth('error', 'room-eviction.sweep.unread', {
      userId,
      source: ctx.path,
      reason: errorName(cause),
    })
    return
  }
  let failed = 0
  let reason: string | undefined
  for (let start = 0; start < others.length; start += SWEEP_CHUNK_SIZE) {
    const outcome = await endSessions(
      ctx.context,
      others.slice(start, start + SWEEP_CHUNK_SIZE),
    )
    failed += outcome.failed
    reason ??= outcome.reason
  }
  if (failed > 0) {
    logAuth('error', 'room-eviction.sweep.failed', {
      userId,
      source: ctx.path,
      found: others.length,
      failed,
      reason,
    })
  }
}
