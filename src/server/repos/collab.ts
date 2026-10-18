/**
 * Collaboration — the trip chat, the shared notes board, decision polls and check-ins.
 *
 * The `TripRoom` Durable Object fans these changes out over WebSockets, but D1 remains the durable
 * record (`src/server/do/trip-room.ts`): every mutation here is the write the room broadcasts, never
 * the other way round.
 */

import { asc, count, desc, eq, inArray, isNotNull, isNull, ne } from 'drizzle-orm'
import { z } from 'zod'
import {
  collabSectionChangeSchema,
  enabledCollabSections,
  resolveCollabSections,
} from '#/lib/collab-sections'
import type { CollabSectionId, CollabSections } from '#/lib/collab-sections'
import {
  CHECK_IN_SOURCES,
  checkIns,
  collabMessageReactions,
  collabMessages,
  collabNotes,
  collabPollVotes,
  collabPolls,
} from '#/server/db/schema'
import { allOf, createTenantRepository, createTenantTableAccess, tenantFilter } from './base'
import { runBatch } from './batch'
import { ForbiddenError, NotFoundError, RepositoryError } from './context'
import { requirePlaceOfTrip } from './places'
import {
  assertTripRole,
  requireTrip,
  requireWritableTrip,
  tripsRepository,
} from './trips'
import {
  colourSchema,
  countryCodeSchema,
  definedOnly,
  idSchema,
  instantSchema,
  latitudeSchema,
  longTextSchema,
  longitudeSchema,
  shortTextSchema,
  sortOrderSchema,
  titleSchema,
} from './validation'
import type { PollOption } from '#/server/db/schema'
import type {
  CheckIn,
  CollabMessage,
  CollabNote,
  CollabPoll,
  CollabPollVote,
} from '#/server/db/types'
import type { CursorPage, TenantScope } from './base'
import type { TripRole } from './trips'

export const collabMessagesRepository = createTenantRepository(collabMessages, 'message')
export const collabMessageReactionsAccess = createTenantTableAccess(
  collabMessageReactions,
  'reaction',
)
export const collabNotesRepository = createTenantRepository(collabNotes, 'note')
export const collabPollsRepository = createTenantRepository(collabPolls, 'poll')
export const collabPollVotesRepository = createTenantRepository(collabPollVotes, 'poll vote')
export const checkInsRepository = createTenantRepository(checkIns, 'check-in')

/* -------------------------------------------------------------------------------------------------
 * Who writes the conversation
 * ---------------------------------------------------------------------------------------------- */

/**
 * Trip roles that may write a trip's conversation, notes and polls: post, edit, react, vote, close
 * and delete. A `viewer` reads the trip, and so does a workspace member who only sees an
 * organization-visible one (`CONTEXT.md`, "Trip member"); ADR 0007 draws the same line, "a member who
 * reads ... but does not write".
 */
export const COLLAB_WRITE_ROLES: ReadonlyArray<TripRole> = ['owner', 'editor']

/**
 * The two guards every writer ends with, in the order the boundary needs them:
 * {@link requireWritableTrip} first, so a caller who may not see the trip is answered with
 * {@link NotFoundError} and learns nothing, and an archived trip refuses before anyone's role is
 * discussed; then {@link assertTripRole}, whose `TripRoleError` is safe because by that point the
 * caller has proved they may see the trip.
 */
async function requireCollabTrip(
  scope: TenantScope,
  tripId: string,
): Promise<void> {
  await requireWritableTrip(scope, tripId)
  await assertTripRole(scope, tripId, COLLAB_WRITE_ROLES)
}

/** A stale switch may not hide the final enabled section. Handlers return this refusal as data. */
export class CollabSectionsError extends Error {
  constructor() {
    super('At least one collaboration section must remain enabled.')
    this.name = 'CollabSectionsError'
  }
}

export async function setTripCollabSections(
  scope: TenantScope,
  tripId: string,
  change: { readonly section: CollabSectionId; readonly on: boolean },
): Promise<CollabSections> {
  const trip = await requireWritableTrip(scope, tripId)
  await assertTripRole(scope, tripId, COLLAB_WRITE_ROLES)
  const input = collabSectionChangeSchema.parse({ tripId, ...change })
  const sections = {
    ...resolveCollabSections(trip.collabModules),
    [input.section]: input.on,
  }
  if (enabledCollabSections(sections).length === 0) {
    throw new CollabSectionsError()
  }
  await tripsRepository.requireUpdate(scope, tripId, { collabModules: sections })
  return sections
}

/*
 * A writer that acts on a row is handed two ids: the trip the caller is working in and the row. The
 * row is looked up by its own id inside the workspace, which is not a statement about the trip, so
 * the pair is checked before anything else - a row of another trip answers exactly as a row that is
 * not there, the same {@link NotFoundError}, and the refusal does not say which ids exist. It comes
 * before the role on purpose: a caller cannot use the role refusal to tell a private trip's row from
 * a missing one.
 */

function assertRowOnTrip(
  entity: string,
  row: { readonly id: string; readonly tripId: string },
  tripId: string,
): void {
  if (row.tripId !== tripId) {
    throw new NotFoundError(entity, row.id)
  }
}

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

export const postMessageInput = z.object({
  tripId: idSchema,
  body: longTextSchema.min(1),
  replyToId: idSchema.nullish(),
  fileId: idSchema.nullish(),
})
export type PostMessageInput = z.infer<typeof postMessageInput>

export const createNoteInput = z.object({
  tripId: idSchema,
  title: titleSchema,
  body: longTextSchema.nullish(),
  category: shortTextSchema.nullish(),
  colour: colourSchema.nullish(),
  isPinned: z.boolean().optional(),
  sortOrder: sortOrderSchema.optional(),
})
export type CreateNoteInput = z.infer<typeof createNoteInput>

export const updateNoteInput = z.object({
  title: titleSchema.optional(),
  body: longTextSchema.nullish(),
  category: shortTextSchema.nullish(),
  colour: colourSchema.nullish(),
  isPinned: z.boolean().optional(),
  sortOrder: sortOrderSchema.optional(),
})
export type UpdateNoteInput = z.infer<typeof updateNoteInput>

const pollOptionSchema: z.ZodType<PollOption> = z.object({
  id: z.string().trim().min(1).max(64),
  label: titleSchema,
})

export const createPollInput = z.object({
  tripId: idSchema,
  question: titleSchema,
  options: z.array(pollOptionSchema).min(2).max(20),
  allowMultiple: z.boolean().optional(),
  closesAt: instantSchema.nullish(),
})
export type CreatePollInput = z.infer<typeof createPollInput>

export const createCheckInInput = z
  .object({
    tripId: idSchema.nullish(),
    placeId: idSchema.nullish(),
    name: titleSchema,
    lat: latitudeSchema.nullish(),
    lng: longitudeSchema.nullish(),
    address: shortTextSchema.nullish(),
    countryCode: countryCodeSchema.nullish(),
    note: longTextSchema.nullish(),
    source: z.enum(CHECK_IN_SOURCES).optional(),
    checkedInAt: instantSchema.optional(),
  })
  // A place belongs to a trip, so a check-in at one names the trip; the message does not say
  // whether the place exists, because nothing has been read when it is raised.
  .refine((value) => !value.placeId || Boolean(value.tripId), {
    message: 'A check-in at a place must name its trip.',
    path: ['tripId'],
  })
export type CreateCheckInInput = z.infer<typeof createCheckInInput>

/* -------------------------------------------------------------------------------------------------
 * Messages
 * ---------------------------------------------------------------------------------------------- */

/** A page of trip chat, newest first. Soft-deleted messages are excluded. */
export async function listMessages(
  scope: TenantScope,
  tripId: string,
  options: { readonly limit?: number; readonly cursor?: string | null } = {},
): Promise<CursorPage<CollabMessage>> {
  return collabMessagesRepository.page(scope, {
    where: allOf(eq(collabMessages.tripId, tripId), isNull(collabMessages.deletedAt)),
    limit: options.limit,
    cursor: options.cursor,
  })
}

export async function postMessage(
  scope: TenantScope,
  input: PostMessageInput,
): Promise<CollabMessage> {
  const values = postMessageInput.parse(input)
  await requireCollabTrip(scope, values.tripId)
  if (values.replyToId) {
    const parent = await collabMessagesRepository.requireById(
      scope,
      values.replyToId,
    )
    assertRowOnTrip(collabMessagesRepository.entityName, parent, values.tripId)
  }
  return collabMessagesRepository.insert(scope, { ...values, userId: scope.ctx.userId })
}

/** Edits a message. Only its author may change the text. */
export async function editMessage(
  scope: TenantScope,
  tripId: string,
  messageId: string,
  body: string,
): Promise<CollabMessage> {
  const message = await collabMessagesRepository.requireById(scope, messageId)
  assertRowOnTrip(collabMessagesRepository.entityName, message, tripId)
  await requireCollabTrip(scope, tripId)
  if (message.userId !== scope.ctx.userId) {
    throw new ForbiddenError('edit another traveller’s message', ['owner'])
  }
  // A deleted message is gone for everyone who could edit it; refused on the write below, which is what stops an edit from putting text back into a row whose body was cleared.
  const [edited] = await collabMessagesRepository.updateWhere(
    scope,
    allOf(eq(collabMessages.id, messageId), isNull(collabMessages.deletedAt)),
    { body: longTextSchema.min(1).parse(body), editedAt: new Date() },
  )
  if (!edited) {
    throw new NotFoundError(collabMessagesRepository.entityName, messageId)
  }
  return edited
}

/**
 * Soft-deletes a message: the row stays so replies keep their thread, but the text is gone - the body
 * is cleared in the same write that sets `deleted_at`, so a deleted message holds no words. Authors
 * delete their own; admins delete anyone's.
 */
export async function deleteMessage(
  scope: TenantScope,
  tripId: string,
  messageId: string,
): Promise<CollabMessage> {
  const message = await collabMessagesRepository.requireById(scope, messageId)
  assertRowOnTrip(collabMessagesRepository.entityName, message, tripId)
  await requireCollabTrip(scope, tripId)
  if (message.userId !== scope.ctx.userId && scope.ctx.role === 'member') {
    throw new ForbiddenError('delete another traveller’s message', ['owner', 'admin'])
  }
  return collabMessagesRepository.requireUpdate(scope, messageId, { deletedAt: new Date(), body: '' })
}

/**
 * Clears the body of every soft-deleted message of this workspace that still has one, and returns how
 * many it cleared. Idempotent: a second call finds nothing left. The per-workspace form of what
 * migration `0020_clear_deleted_message_bodies` did once for all of D1, kept for a caller that acts
 * on one workspace (rows the previous Worker deleted while the migration was running).
 */
export async function clearDeletedMessageBodies(scope: TenantScope): Promise<number> {
  const cleared = await collabMessagesRepository.updateWhere(
    scope,
    allOf(isNotNull(collabMessages.deletedAt), ne(collabMessages.body, '')),
    { body: '' },
  )
  return cleared.length
}

export interface ReactionTally {
  readonly emoji: string
  readonly count: number
  readonly userIds: ReadonlyArray<string>
}

/** Reaction tallies for a set of messages, keyed by message id. */
export async function listReactions(
  scope: TenantScope,
  messageIds: ReadonlyArray<string>,
): Promise<Map<string, Array<ReactionTally>>> {
  const tallies = new Map<string, Array<ReactionTally>>()
  if (messageIds.length === 0) {
    return tallies
  }
  const rows = await collabMessageReactionsAccess.findMany(scope, {
    where: inArray(collabMessageReactions.messageId, [...messageIds]),
    orderBy: [asc(collabMessageReactions.createdAt)],
  })

  for (const row of rows) {
    const bucket = tallies.get(row.messageId) ?? []
    const existing = bucket.find((entry) => entry.emoji === row.emoji)
    if (existing) {
      bucket[bucket.indexOf(existing)] = {
        emoji: existing.emoji,
        count: existing.count + 1,
        userIds: [...existing.userIds, row.userId],
      }
    } else {
      bucket.push({ emoji: row.emoji, count: 1, userIds: [row.userId] })
    }
    tallies.set(row.messageId, bucket)
  }
  return tallies
}

/** Adds the acting user's reaction, or removes it when it is already there. */
export async function toggleReaction(
  scope: TenantScope,
  tripId: string,
  messageId: string,
  emoji: string,
): Promise<boolean> {
  const message = await collabMessagesRepository.requireById(scope, messageId)
  assertRowOnTrip(collabMessagesRepository.entityName, message, tripId)
  await requireCollabTrip(scope, tripId)
  const value = z.string().trim().min(1).max(16).parse(emoji)
  const where = allOf(
    eq(collabMessageReactions.messageId, messageId),
    eq(collabMessageReactions.userId, scope.ctx.userId),
    eq(collabMessageReactions.emoji, value),
  )

  const existing = await collabMessageReactionsAccess.findOne(scope, where)
  if (existing) {
    await collabMessageReactionsAccess.removeWhere(scope, where)
    return false
  }
  await collabMessageReactionsAccess.insert(scope, {
    messageId,
    userId: scope.ctx.userId,
    emoji: value,
  })
  return true
}

/* -------------------------------------------------------------------------------------------------
 * Notes
 * ---------------------------------------------------------------------------------------------- */

/** A trip's notes board: pinned notes first, then board order. */
export async function listNotes(scope: TenantScope, tripId: string): Promise<Array<CollabNote>> {
  return collabNotesRepository.findMany(scope, {
    where: eq(collabNotes.tripId, tripId),
    orderBy: [desc(collabNotes.isPinned), asc(collabNotes.sortOrder), desc(collabNotes.id)],
  })
}

export async function createCollabNote(
  scope: TenantScope,
  input: CreateNoteInput,
): Promise<CollabNote> {
  const values = createNoteInput.parse(input)
  await requireCollabTrip(scope, values.tripId)
  return collabNotesRepository.insert(scope, { ...values, createdBy: scope.ctx.userId })
}

/** The note, once it is known to be on the trip the request names and the caller may write it. */
async function requireNoteOfTrip(
  scope: TenantScope,
  tripId: string,
  noteId: string,
): Promise<void> {
  const note = await collabNotesRepository.requireById(scope, noteId)
  assertRowOnTrip(collabNotesRepository.entityName, note, tripId)
  await requireCollabTrip(scope, tripId)
}

export async function updateCollabNote(
  scope: TenantScope,
  tripId: string,
  noteId: string,
  input: UpdateNoteInput,
): Promise<CollabNote> {
  await requireNoteOfTrip(scope, tripId, noteId)
  return collabNotesRepository.requireUpdate(scope, noteId, definedOnly(updateNoteInput.parse(input)))
}

export async function deleteCollabNote(
  scope: TenantScope,
  tripId: string,
  noteId: string,
): Promise<void> {
  await requireNoteOfTrip(scope, tripId, noteId)
  await collabNotesRepository.requireRemove(scope, noteId)
}

/* -------------------------------------------------------------------------------------------------
 * Polls
 * ---------------------------------------------------------------------------------------------- */

export async function listPolls(scope: TenantScope, tripId: string): Promise<Array<CollabPoll>> {
  return collabPollsRepository.findMany(scope, {
    where: eq(collabPolls.tripId, tripId),
    orderBy: [asc(collabPolls.isClosed), desc(collabPolls.id)],
  })
}

export async function createPoll(scope: TenantScope, input: CreatePollInput): Promise<CollabPoll> {
  const values = createPollInput.parse(input)
  await requireCollabTrip(scope, values.tripId)
  return collabPollsRepository.insert(scope, { ...values, createdBy: scope.ctx.userId })
}

/** The poll, once it is known to be on the trip the request names and the caller may write it. */
async function requirePollOfTrip(
  scope: TenantScope,
  tripId: string,
  pollId: string,
): Promise<CollabPoll> {
  const poll = await collabPollsRepository.requireById(scope, pollId)
  assertRowOnTrip(collabPollsRepository.entityName, poll, tripId)
  await requireCollabTrip(scope, tripId)
  return poll
}

export async function closePoll(
  scope: TenantScope,
  tripId: string,
  pollId: string,
): Promise<CollabPoll> {
  await requirePollOfTrip(scope, tripId, pollId)
  return collabPollsRepository.requireUpdate(scope, pollId, { isClosed: true })
}

export async function deletePoll(
  scope: TenantScope,
  tripId: string,
  pollId: string,
): Promise<void> {
  await requirePollOfTrip(scope, tripId, pollId)
  await collabPollsRepository.requireRemove(scope, pollId)
}

/**
 * Records a vote. Single-choice polls replace the voter's previous answer in the same batch, so a
 * traveller can never end up counted twice.
 */
export async function castVote(
  scope: TenantScope,
  tripId: string,
  pollId: string,
  optionId: string,
): Promise<Array<CollabPollVote>> {
  const poll = await requirePollOfTrip(scope, tripId, pollId)
  if (poll.isClosed) {
    throw new RepositoryError('This poll is closed.', 'POLL_CLOSED')
  }
  const option = z.string().trim().min(1).max(64).parse(optionId)
  if (!poll.options.some((entry) => entry.id === option)) {
    throw new RepositoryError('That option is not on this poll.', 'INVALID_POLL_OPTION')
  }

  const mine = await collabPollVotesRepository.findMany(scope, {
    where: allOf(eq(collabPollVotes.pollId, pollId), eq(collabPollVotes.userId, scope.ctx.userId)),
  })
  const already = mine.find((vote) => vote.optionId === option)

  if (already) {
    await collabPollVotesRepository.requireRemove(scope, already.id)
  } else {
    const statements = poll.allowMultiple
      ? []
      : mine.map((vote) =>
          scope.db
            .delete(collabPollVotes)
            .where(tenantFilter(scope, collabPollVotes, eq(collabPollVotes.id, vote.id))),
        )
    await runBatch(scope, statements)
    await collabPollVotesRepository.insert(scope, {
      pollId,
      userId: scope.ctx.userId,
      optionId: option,
    })
  }

  return listVotes(scope, pollId)
}

export async function listVotes(
  scope: TenantScope,
  pollId: string,
): Promise<Array<CollabPollVote>> {
  return collabPollVotesRepository.findMany(scope, {
    where: eq(collabPollVotes.pollId, pollId),
    orderBy: [asc(collabPollVotes.createdAt)],
  })
}

export interface PollResult {
  readonly poll: CollabPoll
  readonly tally: ReadonlyArray<{
    readonly option: PollOption
    readonly votes: number
    readonly userIds: ReadonlyArray<string>
  }>
  readonly totalVotes: number
}

/** A poll with its per-option tally, in the poll's own option order. */
export async function getPollResult(scope: TenantScope, pollId: string): Promise<PollResult> {
  const poll = await collabPollsRepository.requireById(scope, pollId)
  const votes = await listVotes(scope, pollId)

  const tally = poll.options.map((option) => {
    const forOption = votes.filter((vote) => vote.optionId === option.id)
    return {
      option,
      votes: forOption.length,
      userIds: forOption.map((vote) => vote.userId),
    }
  })

  return { poll, tally, totalVotes: votes.length }
}

/* -------------------------------------------------------------------------------------------------
 * Check-ins
 * ---------------------------------------------------------------------------------------------- */

export async function createCheckIn(
  scope: TenantScope,
  input: CreateCheckInInput,
): Promise<CheckIn> {
  const values = createCheckInInput.parse(input)
  if (values.tripId) {
    await requireTrip(scope, values.tripId)
    if (values.placeId) {
      await requirePlaceOfTrip(scope, values.tripId, values.placeId)
    }
  }
  return checkInsRepository.insert(scope, {
    ...values,
    userId: scope.ctx.userId,
    checkedInAt: values.checkedInAt ?? new Date(),
  })
}

/** A traveller's check-in timeline, newest first. */
export async function listUserCheckIns(
  scope: TenantScope,
  userId: string,
  options: { readonly limit?: number } = {},
): Promise<Array<CheckIn>> {
  return checkInsRepository.findMany(scope, {
    where: eq(checkIns.userId, userId),
    orderBy: [desc(checkIns.checkedInAt)],
    limit: options.limit ?? 50,
  })
}

export async function listTripCheckIns(
  scope: TenantScope,
  tripId: string,
): Promise<Array<CheckIn>> {
  return checkInsRepository.findMany(scope, {
    where: eq(checkIns.tripId, tripId),
    orderBy: [desc(checkIns.checkedInAt)],
  })
}

export async function deleteCheckIn(scope: TenantScope, checkInId: string): Promise<void> {
  const checkIn = await checkInsRepository.requireById(scope, checkInId)
  if (checkIn.userId !== scope.ctx.userId && scope.ctx.role === 'member') {
    throw new ForbiddenError('delete another traveller’s check-in', ['owner', 'admin'])
  }
  await checkInsRepository.requireRemove(scope, checkInId)
}

/** Check-in counts per country for one traveller — feeds the atlas roll-up. */
export async function countCheckInsByCountry(
  scope: TenantScope,
  userId: string,
): Promise<Array<{ readonly countryCode: string; readonly value: number }>> {
  const rows = await scope.db
    .select({ countryCode: checkIns.countryCode, value: count() })
    .from(checkIns)
    .where(tenantFilter(scope, checkIns, eq(checkIns.userId, userId)))
    .groupBy(checkIns.countryCode)
    .orderBy(desc(count()))
  return rows.flatMap((row) =>
    row.countryCode === null ? [] : [{ countryCode: row.countryCode, value: row.value }],
  )
}
