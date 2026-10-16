/** The collaboration module's public surface. */
export { NotesBoard } from './notes-board'
export { NoteDialog } from './note-dialog'
export { PollDialog } from './poll-dialog'
export { PollsBoard } from './polls-board'
export { pollOptionsError } from './poll-options'
export { PresenceBar } from './presence-bar'
export { Thread } from './thread'
export type { ThreadProps } from './thread'
export { useTripRoom } from './use-trip-room'
export type { RoomStatus, TripRoomConnection } from './use-trip-room'
export type {
  CollabPerson,
  MessageData,
  NoteData,
  PollData,
  PollOptionData,
  PollTally,
  ReactionTally,
} from './types'
