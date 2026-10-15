/**
 * Write paths for the trip's decision polls.
 *
 * Every handler writes the row first and then mirrors a notification into the `TripRoom`, on the
 * same never-fail-the-save terms as the conversation (see `mirrorToRoom`).
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  castVote,
  closePoll,
  createPoll,
  deletePoll,
  requireTrip,
} from '#/server/repos'
import { pollInputSchema, rowId, tripId } from './collab-inputs'
import { appScope, mirrorToRoom, patch } from './context'

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
 * Casts, moves or withdraws a vote. The repository decides which of those it is -
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
