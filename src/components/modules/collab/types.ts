/**
 * The shapes the collaboration screen renders.
 *
 * Declared structurally rather than imported from the route's loader payload, so
 * these components depend on the data they need and not on one screen's wire
 * format.
 */

export interface CollabPerson {
  readonly userId: string
  readonly name: string
  readonly image: string | null
}

export interface ReactionTally {
  readonly emoji: string
  readonly count: number
  readonly userIds: ReadonlyArray<string>
}

export interface MessageData {
  readonly id: string
  readonly userId: string
  readonly body: string
  readonly replyToId: string | null
  /** ISO instant, or `null` when it has never been edited. */
  readonly editedAt: string | null
  /** ISO instant. */
  readonly createdAt: string
  readonly reactions: ReadonlyArray<ReactionTally>
}

export interface NoteData {
  readonly id: string
  readonly title: string
  readonly body: string | null
  readonly category: string | null
  readonly colour: string | null
  readonly isPinned: boolean
  readonly createdBy: string
  /** ISO instant. */
  readonly createdAt: string
}

export interface PollOptionData {
  readonly id: string
  readonly label: string
}

export interface PollTally {
  readonly optionId: string
  readonly label: string
  readonly votes: number
  readonly userIds: ReadonlyArray<string>
}

export interface PollData {
  readonly id: string
  readonly question: string
  readonly options: ReadonlyArray<PollOptionData>
  readonly allowMultiple: boolean
  readonly isClosed: boolean
  readonly createdBy: string
  readonly totalVotes: number
  readonly tally: ReadonlyArray<PollTally>
}
