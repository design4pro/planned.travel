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
import { commitToTripRoom } from '#/server/do'
import { loggerFromEnv, serializeError } from '#/server/observability'
import { createScope } from '#/server/repos'

import type { TripPatch, TripRoomNamespace } from '#/server/do'
import type { DispatchDeps } from '#/server/notifications/dispatch'
import type { Logger } from '#/server/observability'
import type { TenantScope } from '#/server/repos'

/** The caller's tenant scope, or a thrown `AuthRequirementError`. */
export async function appScope(): Promise<TenantScope> {
  return createScope(getDb(), await requireOrg())
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
