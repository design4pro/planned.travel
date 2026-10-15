/**
 * The three payload builders behind a trip's collaboration screen: the conversation, the notes
 * board and the polls board.
 *
 * Plain functions in a module no client imports (a client build of a server-function module keeps
 * whatever it still exports). Each takes the already-resolved `Trip`, never a bare id: an exported
 * reader that could be called with an id that skipped `requireTrip` would read a private trip
 * through a tenant-only filter. The screen's loader resolves the trip, visibility included, and
 * hands it down.
 */
import { isoOf, isoOfRequired } from '#/server/serialise'
import {
  listMessages,
  listNotes,
  listPolls,
  listReactions,
  listVotes,
} from '#/server/repos'

import type { PollOption } from '#/server/db/schema'
import type { Trip } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'

/* ------------------------------------------------------------------ shapes */

export interface MessageRow {
  readonly id: string
  readonly userId: string
  readonly body: string
  readonly replyToId: string | null
  readonly editedAt: string | null
  readonly createdAt: string
  readonly reactions: ReadonlyArray<{
    readonly emoji: string
    readonly count: number
    readonly userIds: ReadonlyArray<string>
  }>
}

export interface NoteRow {
  readonly id: string
  readonly title: string
  readonly body: string | null
  readonly category: string | null
  readonly colour: string | null
  readonly isPinned: boolean
  readonly createdBy: string
  readonly createdAt: string
}

export interface PollRow {
  readonly id: string
  readonly question: string
  readonly options: ReadonlyArray<PollOption>
  readonly allowMultiple: boolean
  readonly isClosed: boolean
  readonly createdBy: string
  readonly totalVotes: number
  readonly tally: ReadonlyArray<{
    readonly optionId: string
    readonly label: string
    readonly votes: number
    readonly userIds: ReadonlyArray<string>
  }>
}

/* ---------------------------------------------------------------- builders */

/** The newest page of the transcript, oldest-first, each message with its reactions. */
export async function threadPayload(
  scope: TenantScope,
  trip: Trip,
): Promise<Array<MessageRow>> {
  const page = await listMessages(scope, trip.id, { limit: 50 })
  const reactions = await listReactions(
    scope,
    page.items.map((row) => row.id),
  )

  // The repository pages newest-first; a transcript reads oldest-first.
  return [...page.items].reverse().map((row) => ({
    id: row.id,
    userId: row.userId,
    body: row.body,
    replyToId: row.replyToId,
    editedAt: isoOf(row.editedAt),
    createdAt: isoOfRequired(row.createdAt),
    reactions: reactions.get(row.id) ?? [],
  }))
}

export async function notesPayload(
  scope: TenantScope,
  trip: Trip,
): Promise<Array<NoteRow>> {
  const notes = await listNotes(scope, trip.id)

  return notes.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category,
    colour: row.colour,
    isPinned: row.isPinned,
    createdBy: row.createdBy,
    createdAt: isoOfRequired(row.createdAt),
  }))
}

/** The trip's polls, each with its votes tallied per option. */
export async function pollsPayload(
  scope: TenantScope,
  trip: Trip,
): Promise<Array<PollRow>> {
  const polls = await listPolls(scope, trip.id)
  const votes = await Promise.all(
    polls.map((poll) => listVotes(scope, poll.id)),
  )

  return polls.map((poll, index) => {
    const cast = votes[index] ?? []
    return {
      id: poll.id,
      question: poll.question,
      options: poll.options,
      allowMultiple: poll.allowMultiple,
      isClosed: poll.isClosed,
      createdBy: poll.createdBy,
      totalVotes: cast.length,
      tally: poll.options.map((option) => {
        const forOption = cast.filter((vote) => vote.optionId === option.id)
        return {
          optionId: option.id,
          label: option.label,
          votes: forOption.length,
          userIds: forOption.map((vote) => vote.userId),
        }
      }),
    }
  })
}
