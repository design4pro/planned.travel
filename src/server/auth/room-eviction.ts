import { createAuthMiddleware, isAPIError } from 'better-auth/api'
import { z } from 'zod'
import { QUEUE_BATCH_MAX, enqueueTasks } from '#/server/queue/jobs'
import { authDb } from './db'
import { taskQueue } from './env'
import { logAuth } from './log'
import { organizationIdsFor } from './provisioning'

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
      organizations: organizationIds.join(','),
      reason: cause instanceof Error ? cause.message : 'unknown',
    })
  }
}

const userBody = z.object({ userId: z.string().min(1) })

/** `/organization/remove-member` answers `{ member }`, `/organization/leave` answers the member. */
const memberRow = z.object({
  userId: z.string().min(1),
  organizationId: z.string().min(1),
})
const removedMember = z.union([z.object({ member: memberRow }), memberRow])

/**
 * `hooks.after` for the endpoints whose success ends a person's place in a workspace or ends their
 * sessions: remove member, leave, ban, and sign out every session. Keyed on the path and on a
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
    await queueRoomEviction(row.userId, [row.organizationId])
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
    )
  }
})
