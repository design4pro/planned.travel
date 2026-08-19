/** The collaboration module's public surface. */
export { NotesBoard, PollsBoard } from './collab-board'
export { NoteDialog, PollDialog } from './collab-dialogs'
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
