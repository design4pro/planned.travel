/**
 * `participant-backfill` - the one-off catch-up of the participation anchor (ADR 0043) for people
 * who left a workspace before `workspace_participants` existed.
 *
 * A chain, not a fan-out: one message handles the next workspace after its cursor, then enqueues
 * the message for the one after. The message that finds no further workspace writes the completion
 * marker, which is how "every workspace has been visited" is known without a counter. A message
 * that fails retries by itself; a chain that dies leaves no marker, so the erasure engine keeps
 * refusing to run rather than trusting a half-filled anchor.
 *
 * ## What the envelope may and may not decide
 *
 * The payload is a run id and a cursor and nothing else. The workspace to visit is found by
 * `catalog/erasure.ts` (organization ids only, keyset-paged), and the work runs under a
 * `TenantScope` bound to that one workspace with a reserved id that is not a user, so a forged
 * envelope can start a chain but cannot aim it at a person or a workspace, and the scope it builds
 * reads only the registered user columns of the workspace the catalog named. A run's progress is
 * kept in KV (`participant-backfill-marker.ts`), and a message that does not continue it does
 * nothing, so a stray or forged message cannot write the completion marker for a chain that did
 * not visit every workspace.
 *
 * Shipped inert: nothing enqueues this kind in this release (`BACKWARD_COMPATIBILITY.md` section 6);
 * the producer comes in a later one, once every Worker can decode the kind.
 */

import { drizzle } from 'drizzle-orm/d1'
import { listOrganizationIds } from '#/server/catalog/erasure'
import {
  readParticipantBackfillRunCursor,
  writeParticipantBackfillMarker,
  writeParticipantBackfillRunCursor,
} from '#/server/erasure/participant-backfill-marker'
import { backfillParticipants, createScope } from '#/server/repos'
import { SYSTEM_ORG_ID, enqueueTask } from '../jobs'
import { TaskConfigurationError, TaskRetryableError } from '../types'

import type { Database } from '#/server/db/types'
import type {
  ParticipantBackfillPayload,
  TaskBindings,
  TaskContext,
  TaskHandler,
  TaskMetrics,
} from '../types'

/** The D1 binding as `TaskBindings` declares it, without the `undefined`. */
type D1Handle = NonNullable<TaskBindings['DB']>

/** How a D1 binding becomes a Drizzle handle: injectable, as `trip-room-evict` does. */
export type DatabaseFor = (binding: D1Handle) => Database

/** How long a message that arrived ahead of its run waits before it is tried again. */
const OUT_OF_SEQUENCE_RETRY_SECONDS = 60

/** The user id of the backfill's scope. Reserved: no account is ever given this id. */
export const BACKFILL_SCOPE_USER_ID = 'system:participant-backfill'

/** The idempotency key of the message that handles the workspace after `after`. */
export function participantBackfillMessageId(
  runId: string,
  after: string | null,
): string {
  return `participant-backfill:${runId}:${after ?? 'start'}`
}

export function createParticipantBackfillHandler(
  databaseFor: DatabaseFor = (binding) => drizzle(binding),
): TaskHandler<'participant-backfill'> {
  return async function participantBackfill(
    payload: ParticipantBackfillPayload,
    context: TaskContext,
  ): Promise<TaskMetrics> {
    const binding = context.env.DB
    if (binding === undefined) {
      throw new TaskConfigurationError(
        'The DB binding is not available to the queue consumer; the participation backfill cannot run',
      )
    }

    const db = databaseFor(binding)
    const page = await listOrganizationIds(db, {
      after: payload.after,
      limit: 1,
    })
    const organizationId = page.items.at(0)

    // The run's own record decides whether this message continues it. `''` is "started, nothing
    // visited"; the cursor of a retried message is either its own `after` or the workspace it
    // handles (an earlier attempt got that far). A cursor past this message's position means it is
    // a duplicate of work already done, and it does nothing. A cursor that is missing or behind is
    // either a stale KV read (KV is not read-after-write consistent) or a message that did not
    // follow the chain: it fails and retries instead of completing, so a legitimate run is never
    // stranded by a stale read and a stray message ends in the dead-letter queue. Either way only a
    // chain that visited every workspace in order can end in the marker.
    const expected = payload.after ?? ''
    let cursor = await readParticipantBackfillRunCursor(
      context.env.KV,
      payload.runId,
    )
    if (cursor === null && payload.after === null) {
      await writeParticipantBackfillRunCursor(context.env.KV, payload.runId, '')
      cursor = ''
    }
    const retriedAfterProgress =
      organizationId !== undefined && cursor === organizationId
    if (cursor !== expected && !retriedAfterProgress) {
      if (cursor === null || cursor < expected) {
        throw new TaskRetryableError(
          'The participation backfill message arrived ahead of its run',
          { retryAfterSeconds: OUT_OF_SEQUENCE_RETRY_SECONDS },
        )
      }
      context.logger.info('participation backfill message already handled', {
        runId: payload.runId,
      })
      return { organizations: 0, participants: 0, complete: 0 }
    }

    if (organizationId === undefined) {
      await writeParticipantBackfillMarker(
        context.env.KV,
        payload.runId,
        new Date(context.now()),
      )
      context.logger.info('participation backfill complete', {
        runId: payload.runId,
      })
      return { organizations: 0, participants: 0, complete: 1 }
    }

    const scope = createScope(db, {
      userId: BACKFILL_SCOPE_USER_ID,
      organizationId,
      role: 'member',
    })
    const participants = await backfillParticipants(scope)

    // Recorded before the hand-on: a failed enqueue retries this message, which the check above
    // lets through because the cursor already names this workspace.
    await writeParticipantBackfillRunCursor(
      context.env.KV,
      payload.runId,
      organizationId,
    )
    await enqueueTask(context.env.TASKS, {
      kind: 'participant-backfill',
      orgId: SYSTEM_ORG_ID,
      id: participantBackfillMessageId(payload.runId, organizationId),
      payload: { runId: payload.runId, after: organizationId },
    })
    return { organizations: 1, participants, complete: 0 }
  }
}

/** The handler `consumer.ts` registers, over the Worker's own D1 binding. */
export const handleParticipantBackfill = createParticipantBackfillHandler()
