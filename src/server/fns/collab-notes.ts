/**
 * Write paths for the trip's notes board.
 *
 * Every handler writes the row first and then mirrors a notification into the `TripRoom`, on the
 * same never-fail-the-save terms as the conversation (see `mirrorToRoom`).
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  createCollabNote,
  deleteCollabNote,
  requireTrip,
  updateCollabNote,
} from '#/server/repos'
import {
  noteInputSchema,
  noteUpdateSchema,
  rowId,
  tripId,
} from './collab-inputs'
import { appScope, mirrorToRoom, orNull, patch, tombstone } from './context'

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
