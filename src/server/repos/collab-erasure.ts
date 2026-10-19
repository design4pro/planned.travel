/** Worker-only collaboration scrub; reply targets and poll results remain intact. */
import { eq, or } from 'drizzle-orm'
import {
  collabMessages,
  collabMessageReactions,
  collabNotes,
  collabPolls,
  collabPollVotes,
  checkIns,
  notifications,
} from '#/server/db/schema'
import { allOf, createTenantTableAccess } from './base'
import { anonymiseColumn, assertErasure, scrubRows } from './erasure-write'
import type { TenantScope } from './base'

export async function eraseUserCollaboration(
  scope: TenantScope,
  userId: string,
  formerMemberId: string,
): Promise<void> {
  assertErasure(scope, userId, formerMemberId)
  await scrubRows(scope, collabMessages, eq(collabMessages.userId, userId), {
    userId: formerMemberId,
    body: '',
    deletedAt: new Date(),
  })
  const reactions = createTenantTableAccess(collabMessageReactions, 'reaction')
  for (;;) {
    const rows = await reactions.findMany(scope, {
      where: eq(collabMessageReactions.userId, userId),
      limit: 40,
    })
    if (rows.length === 0) break
    for (const row of rows) {
      await reactions.removeWhere(
        scope,
        allOf(
          eq(collabMessageReactions.userId, userId),
          eq(collabMessageReactions.messageId, row.messageId),
          eq(collabMessageReactions.emoji, row.emoji),
        ),
      )
    }
  }
  await anonymiseColumn(scope, collabNotes, 'createdBy', userId, formerMemberId)
  await anonymiseColumn(scope, collabPolls, 'createdBy', userId, formerMemberId)
  await anonymiseColumn(
    scope,
    collabPollVotes,
    'userId',
    userId,
    formerMemberId,
  )
  await scrubRows(scope, checkIns, eq(checkIns.userId, userId))
  await scrubRows(
    scope,
    notifications,
    or(
      eq(notifications.recipientUserId, userId),
      eq(notifications.senderUserId, userId),
    ) ?? eq(notifications.recipientUserId, userId),
  )
  await anonymiseColumn(
    scope,
    notifications,
    'entityId',
    userId,
    formerMemberId,
  )
}
