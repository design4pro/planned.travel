/**
 * Read and write paths for the trip's conversation.
 *
 * D1 stays the durable record and the `TripRoom` Durable Object is the fan-out - every writer
 * here writes the row first and then mirrors a notification into the room, so a viewer who is not
 * the author sees the change without polling, and a room that is momentarily unreachable costs a
 * save nothing (see `mirrorToRoom`). Posting is the plain `postTripMessage`, which also tells the
 * members who are not looking at the trip.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { deleteMessage, editMessage, toggleReaction } from '#/server/repos'
import { postTripMessage } from './collab-thread-writes'
import { appScope, mirrorToRoom, patch } from './context'
import { loadOlderMessages } from './collab-payloads'
import {
  olderMessagesSchema,
  body,
  postMessageSchema,
  rowId,
  tripId,
} from './collab-inputs'

export const postMessageFn = createServerFn({ method: 'POST' })
  .validator(postMessageSchema)
  .handler(async ({ data }): Promise<{ readonly messageId: string }> => {
    const scope = await appScope()
    return postTripMessage(scope, data)
  })

export const editMessageFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, messageId: rowId, body }))
  .handler(async ({ data }): Promise<{ readonly messageId: string }> => {
    const scope = await appScope()
    await editMessage(scope, data.tripId, data.messageId, data.body)

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { chatChangedAt: Date.now() }),
    ])
    return { messageId: data.messageId }
  })

export const deleteMessageFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, messageId: rowId }))
  .handler(async ({ data }): Promise<{ readonly deleted: true }> => {
    const scope = await appScope()
    await deleteMessage(scope, data.tripId, data.messageId)

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { chatChangedAt: Date.now() }),
    ])
    return { deleted: true }
  })

export const toggleReactionFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId,
      messageId: rowId,
      emoji: z.string().trim().min(1).max(16),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly added: boolean }> => {
    const scope = await appScope()
    const added = await toggleReaction(
      scope,
      data.tripId,
      data.messageId,
      data.emoji,
    )

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { chatChangedAt: Date.now() }),
    ])
    return { added }
  })

export const loadOlderMessagesFn = createServerFn({ method: 'GET' })
  .validator(olderMessagesSchema)
  .handler(async ({ data }) => {
    const scope = await appScope()
    return loadOlderMessages(scope, data)
  })
