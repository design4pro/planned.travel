/**
 * The conversation's message writer as a plain function: the row, then the room, then the members.
 *
 * It lives apart from the server functions in `collab-thread.ts` so that module can use it only
 * inside its handler. A client build of a server-function module keeps whatever the module still
 * exports and drops the imports that only its handlers reach - so a plain function exported beside
 * the server functions would drag `./context`, and `cloudflare:workers` behind it, into the
 * browser. Here nothing a client imports ever names it (the same reason as `stay-writes.ts`).
 *
 * D1 stays the durable record and the `TripRoom` Durable Object is the fan-out: the row is written
 * first and the room mirrored second, so a viewer who is not the author sees the change without
 * polling, and a room that is momentarily unreachable costs a save nothing (see `mirrorToRoom`).
 * A posted message goes one step further and reaches the members who are not looking at the trip
 * at all, through `dispatchQuietly` - the inbox row and the email, on the same
 * never-fail-the-save terms as the room mirror.
 */
import { dispatchQuietly } from '#/server/notifications/dispatch'
import { postMessage, requireTrip } from '#/server/repos'
import { mirrorToRoom, notificationDeps, orNull, patch } from './context'

import type { Trip } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'
import type { PostMessageData } from './collab-inputs'

/** As much of a message as reads sensibly as a one-line preview in an inbox row. */
const PREVIEW_LENGTH = 140

/**
 * Tells the trip's other members that a message landed.
 *
 * The same bargain `mirrorToRoom` strikes: D1 already holds the message, so a
 * notification that cannot be delivered must not turn a successful post into a failed one.
 * `dispatchQuietly` is the wrapper that keeps that promise, so this returns nothing to check.
 */
export async function notifyTripMessage(
  scope: TenantScope,
  trip: Trip,
  message: { readonly id: string; readonly body: string },
): Promise<void> {
  await dispatchQuietly(
    scope,
    {
      kind: 'collab.message',
      tripId: trip.id,
      entityType: 'collab_message',
      entityId: message.id,
      actorUserId: scope.ctx.userId,
      scope: 'trip',
      titleParams: { tripTitle: trip.title },
      bodyParams: { preview: message.body.slice(0, PREVIEW_LENGTH) },
      actionUrl: `/trips/${trip.id}/collab`,
    },
    notificationDeps(),
  )
}

/** Writes a message, mirrors the change into the room, then notifies the members - in that order. */
export async function postTripMessage(
  scope: TenantScope,
  data: PostMessageData,
): Promise<{ readonly messageId: string }> {
  const trip = await requireTrip(scope, data.tripId)

  const message = await postMessage(scope, {
    tripId: data.tripId,
    body: data.body,
    replyToId: orNull(data.replyToId),
  })

  await mirrorToRoom(scope, data.tripId, [
    patch('trip', data.tripId, {
      chatChangedAt: Date.now(),
      chatLastMessageId: message.id,
    }),
  ])
  await notifyTripMessage(scope, trip, message)
  return { messageId: message.id }
}
