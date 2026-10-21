/**
 * `trip-room-evict` - closes a person's open trip-room sockets when they lose their place in a
 * workspace (#1073) or end their own session (#1093).
 *
 * A trip room reads a person's role once, at connect, so a socket opened before the person was
 * removed from the workspace (by an owner, by leaving, or by the platform console banning, signing
 * out or deleting the account) keeps receiving every commit and presence frame until it drops;
 * so does a socket of a person who then resets their password or signs out (#1093). A socket is
 * not tied to a session, so every socket of that person closes, on their other devices too. Ending
 * an impersonation closes the impersonated person's sockets for the same reason, on their own
 * devices too, because a socket records nothing about impersonation (#1179). Two concurrent
 * sign-outs queue this job twice; the second close can drop a socket that already reconnected, so
 * the person reconnects once more, which is accepted.
 * #1050 closes sockets on trip-level changes; this is the same close for the workspace-level ones,
 * and the person's next connect re-runs the session and tenancy checks. After losing a place that
 * connect is refused; after ending one's own session it is refused only on a device with no valid
 * session left. For a password reset, a revoke of all sessions and a password change that revokes
 * the others, the producer first deletes the cached blob of each ended session by name, so a blob
 * the KV session index missed cannot re-admit the reconnect (#1176) - within the KV convergence
 * window, about a minute across colos.
 *
 * Queued rather than run in the request because it is a fan-out over every room the person could
 * open, and because the producer is the auth layer (`src/server/auth/room-eviction.ts`), whose
 * module graph the platform console shares and must not reach a tenant repository. The producer
 * enqueues only after the change committed.
 *
 * ## What the envelope may and may not decide
 *
 * The envelope names the workspace (`orgId`) and the person. Rooms are listed through the
 * tenant-scoped `reachableTripIds` for that workspace, so a forged envelope can only close rooms of
 * a workspace it names, and only for the person it names. The person's membership is deliberately
 * not asked for: they have just left it, and the rule that decides which rooms they could have
 * joined (`readableTripFilter`) does not need it.
 *
 * Every room is tried even when one refuses; the job then fails so the queue retries it. Closing a
 * room twice is harmless, and a socket left open is exactly what this job exists to prevent. A
 * failure names the trip, the workspace and the person by id and never a name or an email.
 */

import { drizzle } from 'drizzle-orm/d1'
import { closeTripRoomFor } from '#/server/do'
import { createScope, reachableTripIds } from '#/server/repos'
import { serializeError } from '../../observability/logger'
import { TaskConfigurationError } from '../types'

import type { Database } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'
import type {
  TaskBindings,
  TaskContext,
  TaskHandler,
  TaskMetrics,
  TripRoomEvictPayload,
} from '../types'

/** The D1 binding as `TaskBindings` declares it, without the `undefined`. */
type D1Handle = NonNullable<TaskBindings['DB']>

/** How a D1 binding becomes a Drizzle handle: injectable for the reason `travel-stats` gives. */
export type DatabaseFor = (binding: D1Handle) => Database

/** How many rooms are called at once: quick enough, few enough to stay clear of the Worker's limits. */
const ROOM_EVICTION_CONCURRENCY = 8

/**
 * A fan-out larger than this is still closed in full - a cap would leave sockets open - but it is
 * logged as a warning, which is the signal to shard the job per batch of trips.
 */
export const ROOM_EVICTION_WARN_THRESHOLD = 500

/** The ids of the rooms the person could open in the scope's workspace. */
type ReachableTrips = (scope: TenantScope) => Promise<Array<string>>

/**
 * Builds the handler over a database seam. {@link handleTripRoomEvict} is the one the consumer
 * registers; a test builds its own against the harness.
 */
export function createTripRoomEvictHandler(
  databaseFor: DatabaseFor = (binding) => drizzle(binding),
  reachable: ReachableTrips = reachableTripIds,
): TaskHandler<'trip-room-evict'> {
  return async function tripRoomEvict(
    payload: TripRoomEvictPayload,
    context: TaskContext,
  ): Promise<TaskMetrics> {
    const binding = context.env.DB
    const namespace = context.env.TRIP_ROOM
    if (binding === undefined || namespace === undefined) {
      throw new TaskConfigurationError(
        'The DB and TRIP_ROOM bindings are not available to the queue consumer; a trip room eviction cannot run',
      )
    }

    const { userId } = payload
    const organizationId = context.orgId
    const scope = createScope(databaseFor(binding), {
      userId,
      organizationId,
      role: 'member',
      impersonatedBy: null,
    })
    const tripIds = await reachable(scope)

    let failed = 0
    let next = 0
    const worker = async (): Promise<void> => {
      while (next < tripIds.length) {
        const tripId = tripIds[next++]
        try {
          await closeTripRoomFor(namespace, tripId, userId)
        } catch (cause) {
          failed += 1
          context.logger.warn('trip room eviction failed', {
            tripId,
            organizationId,
            userId,
            ...serializeError(cause),
          })
        }
      }
    }
    await Promise.all(
      Array.from(
        { length: Math.min(ROOM_EVICTION_CONCURRENCY, tripIds.length) },
        worker,
      ),
    )

    if (tripIds.length > ROOM_EVICTION_WARN_THRESHOLD) {
      context.logger.warn('trip room eviction fan-out is large', {
        organizationId,
        userId,
        rooms: tripIds.length,
      })
    }
    if (failed > 0) {
      throw new Error(
        `${failed} of ${tripIds.length} trip rooms could not be told to close a person's sockets`,
      )
    }
    return { rooms: tripIds.length, failed }
  }
}

/** The handler `consumer.ts` registers, over the Worker's own D1 binding. */
export const handleTripRoomEvict = createTripRoomEvictHandler()
