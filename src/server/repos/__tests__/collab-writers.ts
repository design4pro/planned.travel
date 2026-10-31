/**
 * Every trip-linked writer of the conversation, notes, polls and check-ins, for their shared rule:
 * a write names a trip and, for the row writers, a row, and it lands only when the caller may write
 * that trip and the row is on it (#913).
 *
 * Listed once so the role matrix, the member-isolation block and the tenant-isolation block cannot
 * drift apart on which writers they cover - a writer added to `collab.ts` joins the list here and is
 * asked every question those three files ask.
 */

import {
  castVote,
  checkInsRepository,
  closePoll,
  collabMessageReactionsAccess,
  collabMessagesRepository,
  collabNotesRepository,
  collabPollVotesRepository,
  collabPollsRepository,
  createCheckIn,
  createCollabNote,
  createPoll,
  deleteCheckIn,
  deleteCollabNote,
  deleteMessage,
  deletePoll,
  editMessage,
  postMessage,
  toggleReaction,
  updateCollabNote,
} from '../collab'
import type { TenantScope } from '../base'

/** The ids of one trip's check-in, conversation row, note and poll. */
export interface CollabRowIds {
  readonly checkInId: string
  readonly messageId: string
  readonly noteId: string
  readonly pollId: string
}

/** A writer under a name that says which of them failed, and the call itself. */
export type NamedWrite = readonly [label: string, run: () => Promise<unknown>]

export const POLL_OPTIONS = [
  { id: 'a', label: 'Sunrise' },
  { id: 'b', label: 'Market' },
]

/** The writers that take a trip and create a row on it. */
export function creatingWriters(
  scope: TenantScope,
  tripId: string,
): ReadonlyArray<NamedWrite> {
  return [
    ['createCheckIn', () => createCheckIn(scope, { tripId, name: 'Arrived' })],
    ['postMessage', () => postMessage(scope, { tripId, body: 'Hello' })],
    [
      'createCollabNote',
      () => createCollabNote(scope, { tripId, title: 'A note' }),
    ],
    [
      'createPoll',
      () =>
        createPoll(scope, {
          tripId,
          question: 'Which morning?',
          options: POLL_OPTIONS,
        }),
    ],
  ]
}

/** The writers that act on a row by its id, each asked to do so on `tripId`. */
export function rowWriters(
  scope: TenantScope,
  tripId: string,
  rows: CollabRowIds,
): ReadonlyArray<NamedWrite> {
  return [
    ['deleteCheckIn', () => deleteCheckIn(scope, tripId, rows.checkInId)],
    ['editMessage', () => editMessage(scope, tripId, rows.messageId, 'Edited')],
    ['deleteMessage', () => deleteMessage(scope, tripId, rows.messageId)],
    [
      'toggleReaction',
      () => toggleReaction(scope, tripId, rows.messageId, '👍'),
    ],
    [
      'updateCollabNote',
      () => updateCollabNote(scope, tripId, rows.noteId, { title: 'Renamed' }),
    ],
    ['deleteCollabNote', () => deleteCollabNote(scope, tripId, rows.noteId)],
    ['closePoll', () => closePoll(scope, tripId, rows.pollId)],
    ['deletePoll', () => deletePoll(scope, tripId, rows.pollId)],
    ['castVote', () => castVote(scope, tripId, rows.pollId, 'a')],
  ]
}

/** Every writer, creating and acting on a row, for a caller who must be refused all of them. */
export function allWriters(
  scope: TenantScope,
  tripId: string,
  rows: CollabRowIds,
): ReadonlyArray<NamedWrite> {
  return [...creatingWriters(scope, tripId), ...rowWriters(scope, tripId, rows)]
}

/**
 * Every collaboration row of the workspace the scope belongs to, read straight from the tables'
 * repositories (tenant-scoped, trip-blind), so a refused write can be shown to have left all of it
 * byte-identical: bodies, `updated_at`, the soft-delete mark, reaction rows and votes included.
 */
export async function collabRows(scope: TenantScope): Promise<unknown> {
  return {
    checkIns: await checkInsRepository.findMany(scope),
    messages: await collabMessagesRepository.findMany(scope),
    reactions: await collabMessageReactionsAccess.findMany(scope),
    notes: await collabNotesRepository.findMany(scope),
    polls: await collabPollsRepository.findMany(scope),
    votes: await collabPollVotesRepository.findMany(scope),
  }
}

/** A check-in, a message, a note and a poll on a trip, posted by the scope's user. */
export async function seedCollabRows(
  scope: TenantScope,
  tripId: string,
): Promise<CollabRowIds> {
  const checkIn = await createCheckIn(scope, { tripId, name: 'Arrived' })
  const message = await postMessage(scope, { tripId, body: 'Landed.' })
  const note = await createCollabNote(scope, { tripId, title: 'Ideas' })
  const poll = await createPoll(scope, {
    tripId,
    question: 'Which morning?',
    options: POLL_OPTIONS,
  })
  return {
    checkInId: checkIn.id,
    messageId: message.id,
    noteId: note.id,
    pollId: poll.id,
  }
}
