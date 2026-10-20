/**
 * The write-path bridge between an authenticated request and the data layer.
 *
 * Every server function in this directory starts at {@link appScope}: it obtains
 * a tenant scope from the session and from that point on all data access goes
 * through `src/server/repos/**`. Nothing here builds a query, and nothing in
 * `src/components` or `src/routes` may import this module outside a handler —
 * handlers are stripped from the client bundle, which is what keeps the auth
 * layer, the D1 handle and the R2 bucket off the browser.
 */
import { env } from 'cloudflare:workers'

import { appUrl, taskQueue } from '#/server/auth/env'
import { requireOrg } from '#/server/auth/session'
import { getDb } from '#/server/db/client'
import {
  closeTripRoom,
  closeTripRoomFor,
  commitToTripRoom,
  resetTripRoom,
} from '#/server/do'
import { loggerFromEnv, serializeError } from '#/server/observability'
import { createScope } from '#/server/repos'

import type { TripPatch, TripRoomNamespace } from '#/server/do'
import type { DispatchDeps } from '#/server/notifications/dispatch'
import type { Logger } from '#/server/observability'
import type { TenantContext, TenantScope } from '#/server/repos'

/** The caller's tenant scope, or a thrown `AuthRequirementError`. */
export async function appScope(): Promise<TenantScope> {
  return createScope(getDb(), await requireOrg())
}

/**
 * A scope for a context a repository already resolved, such as the joiner's in the workspace of the
 * link they used. `appScope` binds to the session's active workspace; this binds to the context it
 * is given, which the caller must have taken from a repository result and never from a request.
 */
export function scopeFor(context: TenantContext): TenantScope {
  return createScope(getDb(), context)
}

/** The `FILES` R2 bucket. Only ever reached from inside a handler. */
export function filesBucket(): R2Bucket {
  return env.FILES
}

/**
 * The shared `KV` namespace. Only ever reached from inside a handler.
 *
 * Named for its one caller rather than for the binding: a queue handler stages a booking import
 * under `import:<jobId>` and `./booking-import` is the request path that reads it back. Every
 * other use of `KV` on this tree reaches it through the runtime its own directory assembles
 * (`src/server/geo/bindings.ts`, `src/server/metering/bindings.ts`), and a server function has no
 * such directory — which is why the accessor sits here, beside {@link filesBucket}, rather than
 * being re-derived in the module that needs it.
 */
export function importStore(): KVNamespace {
  return env.KV
}

/** Memoised per isolate: the logger holds no request state. */
let logger: Logger | undefined

export function log(): Logger {
  logger ??= loggerFromEnv(env, { context: { component: 'server-fn' } })
  return logger
}

/**
 * Mirrors a write into the trip's Durable Object so every other viewer sees it
 * without polling.
 *
 * D1 is the durable record and has already been written by the time this runs,
 * so a room that is unreachable must never turn a successful save into a failed
 * one: the failure is logged and the client's own router invalidation still
 * shows the author their change. Peers pick it up on their next reconnect
 * catch-up.
 */
export async function mirrorToRoom(
  scope: TenantScope,
  tripId: string,
  patches: ReadonlyArray<TripPatch>,
): Promise<void> {
  if (patches.length === 0) {
    return
  }
  const namespace: TripRoomNamespace = env.TRIP_ROOM
  try {
    await commitToTripRoom(namespace, {
      tripId,
      authorId: scope.ctx.userId,
      patches: [...patches],
    })
  } catch (cause) {
    log().warn('trip room mirror failed', {
      tripId,
      organizationId: scope.ctx.organizationId,
      ...serializeError(cause),
    })
  }
}

/**
 * Runs a room eviction on the same terms as {@link mirrorToRoom}: D1 already holds the change that
 * makes it necessary, so a room that cannot be reached is logged and never fails the request.
 * The log carries ids only, never a name or an email.
 */
async function evictQuietly(
  scope: TenantScope,
  tripId: string,
  userId: string | null,
  close: (namespace: TripRoomNamespace) => Promise<void>,
): Promise<void> {
  try {
    await close(env.TRIP_ROOM)
  } catch (cause) {
    log().warn('trip room eviction failed', {
      tripId,
      organizationId: scope.ctx.organizationId,
      ...(userId === null ? {} : { userId }),
      ...serializeError(cause),
    })
  }
}

/**
 * Closes one person's open sockets in a trip's room, after their access to the trip changed (a new
 * role, a removal, leaving). The room reads a connection's role once, at connect, so this is what
 * makes the change reach a tab that is already open: it reconnects through the connect handler and
 * picks up the stored role.
 *
 * Call it only after the database write succeeded, with ids taken from the rows the repository
 * resolved - never straight from the request.
 */
export function closeRoomFor(
  scope: TenantScope,
  tripId: string,
  userId: string,
): Promise<void> {
  return evictQuietly(scope, tripId, userId, (namespace) =>
    closeTripRoomFor(namespace, tripId, userId),
  )
}

/**
 * Closes every socket in a trip's room, after a change whose audience the server cannot enumerate:
 * the trip was archived or restored, or its visibility narrowed to private (the people who
 * lose the right to read it are workspace members who were never on it). Same terms as
 * {@link closeRoomFor}.
 */
export function closeRoom(scope: TenantScope, tripId: string): Promise<void> {
  return evictQuietly(scope, tripId, null, (namespace) =>
    closeTripRoom(namespace, tripId),
  )
}

/**
 * Erases the deleted trip's room after its authorized D1 deletion committed. The same reset used
 * by erasure closes sockets and removes stored state; idle expiry remains the failure backstop.
 * Call with the id resolved by the repository, on the same terms as {@link closeRoomFor}.
 */
export function resetRoom(scope: TenantScope, tripId: string): Promise<void> {
  return evictQuietly(scope, tripId, null, (namespace) =>
    resetTripRoom(namespace, tripId),
  )
}

/**
 * What `dispatchQuietly` needs from the runtime: the queue that carries the email, and the origin
 * its links are built from.
 *
 * A function rather than a constant, and read at the call site rather than at module load: both
 * come from the Worker environment, which a module evaluated at build time has no access to.
 */
export function notificationDeps(): DispatchDeps {
  return { queue: taskQueue(), appUrl: appUrl() }
}

/** A one-field `upsert` patch, the shape almost every mirror needs. */
export function patch(
  kind: TripPatch['entity']['kind'],
  id: string,
  fields: TripPatch['fields'],
): TripPatch {
  return { entity: { kind, id }, op: 'upsert', fields }
}

/** A tombstone patch, so a delete propagates as a delete rather than a gap. */
export function tombstone(
  kind: TripPatch['entity']['kind'],
  id: string,
): TripPatch {
  return { entity: { kind, id }, op: 'delete', fields: {} }
}

/** Normalises `''` from a form control into the `null` a nullable column wants. */
export function orNull(value: string | undefined): string | null {
  if (value === undefined) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}
