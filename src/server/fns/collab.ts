/**
 * Write paths for the trip's shared surface: the thread, the notes board and the
 * decision polls.
 *
 * D1 stays the durable record and the `TripRoom` Durable Object is the
 * fan-out — every handler here writes the row first and then mirrors a
 * notification into the room, so a viewer who is not the author sees the change
 * without polling, and a room that is momentarily unreachable costs a save
 * nothing (see `mirrorToRoom`).
 *
 * A posted message goes one step further and reaches the members who are not
 * looking at the trip at all, through `dispatchQuietly` — the inbox row and the
 * email, on the same never-fail-the-save terms as the room mirror.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { dispatchQuietly } from '#/server/notifications/dispatch'
import {
  castVote,
  closePoll,
  createCollabNote,
  createPoll,
  deleteCollabNote,
  deleteMessage,
  deletePoll,
  editMessage,
  postMessage,
  requireTrip,
  toggleReaction,
  updateCollabNote,
} from '#/server/repos'
import {
  appScope,
  mirrorToRoom,
  notificationDeps,
  orNull,
  patch,
  tombstone,
} from './context'

import type { Trip } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'

/* ------------------------------------------------------------------ inputs */

const tripId = z.string().trim().min(1).max(64)
const rowId = z.string().trim().min(1).max(64)
const body = z.string().trim().min(1).max(4000)

const noteFields = {
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(8000),
  category: z.string().trim().max(60),
  colour: z
    .string()
    .trim()
    .max(9)
    .refine(
      (value) =>
        value === '' || /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value),
      'must be a hex colour',
    ),
  isPinned: z.boolean(),
}

export const noteInputSchema = z.object({ tripId, ...noteFields })
export const noteUpdateSchema = z.object({
  tripId,
  noteId: rowId,
  ...noteFields,
})

/**
 * A poll's options are stored as a JSON array on the row, so their ids are minted
 * here. Two options with the same label are a mistake worth refusing rather than
 * a tie nobody can read.
 */
export const pollInputSchema = z.object({
  tripId,
  question: z.string().trim().min(1).max(200),
  options: z
    .array(z.string().trim().min(1).max(120))
    .min(2)
    .max(12)
    .refine((values) => {
      const seen = new Set(values.map((value) => value.toLowerCase()))
      return seen.size === values.length
    }, 'Two options say the same thing. Give each one its own wording.'),
  allowMultiple: z.boolean(),
})

/* ------------------------------------------------------------ notification */

/** As much of a message as reads sensibly as a one-line preview in an inbox row. */
const PREVIEW_LENGTH = 140

/**
 * Tells the trip's other members that a message landed.
 *
 * The same bargain `mirrorToRoom` strikes one line above: D1 already holds the message, so a
 * notification that cannot be delivered must not turn a successful post into a failed one.
 * `dispatchQuietly` is the wrapper that keeps that promise, so this returns nothing to check.
 */
async function notifyTripMessage(
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

/* ---------------------------------------------------------------- messages */

export const postMessageFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, body, replyToId: z.string().trim().max(64) }))
  .handler(async ({ data }): Promise<{ readonly messageId: string }> => {
    const scope = await appScope()
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
  })

export const editMessageFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, messageId: rowId, body }))
  .handler(async ({ data }): Promise<{ readonly messageId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    await editMessage(scope, data.messageId, data.body)

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { chatChangedAt: Date.now() }),
    ])
    return { messageId: data.messageId }
  })

export const deleteMessageFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, messageId: rowId }))
  .handler(async ({ data }): Promise<{ readonly deleted: true }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    await deleteMessage(scope, data.messageId)

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
    await requireTrip(scope, data.tripId)
    const added = await toggleReaction(scope, data.messageId, data.emoji)

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { chatChangedAt: Date.now() }),
    ])
    return { added }
  })

/* ------------------------------------------------------------------- notes */

export const createNoteFn = createServerFn({ method: 'POST' })
  .validator(noteInputSchema)
  .handler(async ({ data }): Promise<{ readonly noteId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    const note = await createCollabNote(scope, {
      tripId: data.tripId,
      title: data.title,
      body: orNull(data.body),
      category: orNull(data.category),
      colour: orNull(data.colour),
      isPinned: data.isPinned,
    })

    await mirrorToRoom(scope, data.tripId, [
      patch('note', note.id, { title: data.title, isPinned: data.isPinned }),
    ])
    return { noteId: note.id }
  })

export const updateNoteFn = createServerFn({ method: 'POST' })
  .validator(noteUpdateSchema)
  .handler(async ({ data }): Promise<{ readonly noteId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    await updateCollabNote(scope, data.noteId, {
      title: data.title,
      body: orNull(data.body),
      category: orNull(data.category),
      colour: orNull(data.colour),
      isPinned: data.isPinned,
    })

    await mirrorToRoom(scope, data.tripId, [
      patch('note', data.noteId, {
        title: data.title,
        isPinned: data.isPinned,
      }),
    ])
    return { noteId: data.noteId }
  })

export const deleteNoteFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, noteId: rowId }))
  .handler(async ({ data }): Promise<{ readonly deleted: true }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    await deleteCollabNote(scope, data.noteId)

    await mirrorToRoom(scope, data.tripId, [tombstone('note', data.noteId)])
    return { deleted: true }
  })

/* ------------------------------------------------------------------- polls */

export const createPollFn = createServerFn({ method: 'POST' })
  .validator(pollInputSchema)
  .handler(async ({ data }): Promise<{ readonly pollId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    const poll = await createPoll(scope, {
      tripId: data.tripId,
      question: data.question,
      allowMultiple: data.allowMultiple,
      options: data.options.map((label, index) => ({
        id: `opt-${index + 1}`,
        label,
      })),
    })

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, {
        pollsChangedAt: Date.now(),
        pollLastId: poll.id,
      }),
    ])
    return { pollId: poll.id }
  })

/**
 * Casts, moves or withdraws a vote. The repository decides which of those it is —
 * clicking your own answer again withdraws it, and a single-choice poll replaces
 * the previous answer in the same batch so nobody is ever counted twice.
 */
export const castVoteFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId,
      pollId: rowId,
      optionId: z.string().trim().min(1).max(64),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly totalVotes: number }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    const votes = await castVote(scope, data.pollId, data.optionId)

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { pollsChangedAt: Date.now() }),
    ])
    return { totalVotes: votes.length }
  })

export const closePollFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, pollId: rowId }))
  .handler(async ({ data }): Promise<{ readonly closed: true }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    await closePoll(scope, data.pollId)

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { pollsChangedAt: Date.now() }),
    ])
    return { closed: true }
  })

export const deletePollFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, pollId: rowId }))
  .handler(async ({ data }): Promise<{ readonly deleted: true }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    await deletePoll(scope, data.pollId)

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { pollsChangedAt: Date.now() }),
    ])
    return { deleted: true }
  })
