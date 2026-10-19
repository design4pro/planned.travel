/** Trip erasure primitives. No request handler or Worker binding belongs here. */
import { asc, eq, exists, ne, notExists, or, sql } from 'drizzle-orm'
import { member } from '#/server/db/auth-schema'
import {
  assignmentParticipants,
  auditLog,
  calendarFeeds,
  dayNotes,
  journeys,
  packingItems,
  packingLists,
  packingTemplates,
  shareLinks,
  tripFavourites,
  tripFiles,
  tripGuests,
  tripInviteLinks,
  tripMembers,
  trips,
} from '#/server/db/schema'
import {
  allOf,
  anyOf,
  createTenantRepository,
  createTenantTableAccess,
  prepareTenantInsert,
  tenantFilter,
} from './base'
import { runBatch } from './batch'
import { RepositoryError } from './context'
import { anonymiseColumn, assertErasure, scrubRows } from './erasure-write'
import type { BatchStatement } from './batch'
import type { TenantScope } from './base'

export interface TripRemoval {
  readonly organizationId: string
  readonly tripId: string
  readonly storageKeys: ReadonlyArray<string>
}

/**
 * Must durably and idempotently save the ENTIRE cleanup plan before resolving: all chunks of
 * attachment/cover keys, export-prefix discovery, and room reset. Execution must wait for confirmed
 * D1 deletion. Queue acceptance is not completion. A rejection leaves the trip and files intact;
 * a D1 failure after preparation must allow the same plan to be prepared again. The later erasure
 * engine owns this integration, including namespace validation by the purge consumer.
 */
export type PrepareTripRemoval = (input: TripRemoval) => Promise<void>

const tripRepo = createTenantRepository(trips, 'trip')
const memberships = createTenantRepository(tripMembers, 'trip member')
const files = createTenantRepository(tripFiles, 'file')

/**
 * Classifies before removing membership, including trips whose creator already left. Returns all
 * surviving upload keys needing metadata rewrite, also on retry after D1 anonymisation succeeded.
 */
export async function eraseUserTrips(
  scope: TenantScope,
  userId: string,
  formerMemberId: string,
  prepareTripRemoval: PrepareTripRemoval,
): Promise<ReadonlyArray<string>> {
  assertErasure(scope, userId, formerMemberId)
  const workspaceMembers = await scope.db
    .select()
    .from(member)
    .where(tenantFilter(scope, member))
  const remainingWorkspaceMembers = workspaceMembers.filter(
    (row) => row.userId !== userId,
  )
  const owners = remainingWorkspaceMembers
    .filter((row) => row.role === 'owner')
    .sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    )
  let cursor: string | null = null
  do {
    const page = await tripRepo.page(scope, { cursor, limit: 40 })
    for (const trip of page.items) {
      const people = await memberships.findMany(scope, {
        where: eq(tripMembers.tripId, trip.id),
      })
      const departing = people.find((row) => row.userId === userId)
      if (trip.createdBy !== userId && departing === undefined) continue
      const remaining = people.filter((row) => row.userId !== userId)
      if (
        remaining.length === 0 &&
        (trip.visibility !== 'organization' ||
          remainingWorkspaceMembers.length === 0)
      ) {
        const storageKeys = (
          await files.findMany(scope, { where: eq(tripFiles.tripId, trip.id) })
        ).map((row) => row.storageKey)
        if (trip.coverImageKey) storageKeys.push(trip.coverImageKey)
        await prepareTripRemoval({
          organizationId: scope.ctx.organizationId,
          tripId: trip.id,
          storageKeys: [...new Set(storageKeys)],
        })
        // Classification can change while the cleanup plan is being persisted.
        const deletable = allOf(
          eq(trips.id, trip.id),
          notExists(
            scope.db
              .select({ id: tripMembers.id })
              .from(tripMembers)
              .where(
                tenantFilter(
                  scope,
                  tripMembers,
                  eq(tripMembers.tripId, trip.id),
                  ne(tripMembers.userId, userId),
                ),
              ),
          ),
          anyOf(
            ne(trips.visibility, 'organization'),
            notExists(
              scope.db
                .select({ id: member.id })
                .from(member)
                .where(tenantFilter(scope, member, ne(member.userId, userId))),
            ),
          ),
        )
        const currentSoloTrip = scope.db
          .select({ id: trips.id })
          .from(trips)
          .where(tenantFilter(scope, trips, deletable))
        // The public deleteTrip still checks membership and role. Only this reserved actor bypasses it.
        await runBatch(scope, [
          scope.db
            .update(journeys)
            .set({ tripDeletedAt: new Date() })
            .where(
              tenantFilter(
                scope,
                journeys,
                eq(journeys.tripId, trip.id),
                exists(currentSoloTrip),
              ),
            ),
          scope.db.delete(trips).where(tenantFilter(scope, trips, deletable)),
        ])
        if (await tripRepo.exists(scope, trip.id)) {
          throw new RepositoryError(
            'Trip classification changed during erasure; retry.',
            'ERASURE_TRIP_CHANGED',
          )
        }
        continue
      }
      const survivingOwner = scope.db
        .select({ id: tripMembers.id })
        .from(tripMembers)
        .where(
          tenantFilter(
            scope,
            tripMembers,
            eq(tripMembers.tripId, trip.id),
            ne(tripMembers.userId, userId),
            eq(tripMembers.role, 'owner'),
          ),
        )
      const statements: BatchStatement[] = []
      if (remaining.length === 0) {
        const owner = owners[0]
        if (owner === undefined)
          throw new RepositoryError(
            'An organization-visible trip has no workspace owner.',
            'ERASURE_NO_OWNER',
          )
        const ownerStillPresent = scope.db
          .select({ id: member.id })
          .from(member)
          .where(
            tenantFilter(
              scope,
              member,
              eq(member.id, owner.id),
              eq(member.role, 'owner'),
            ),
          )
        const anotherMember = scope.db
          .select({ id: tripMembers.id })
          .from(tripMembers)
          .where(
            tenantFilter(
              scope,
              tripMembers,
              eq(tripMembers.tripId, trip.id),
              ne(tripMembers.userId, userId),
            ),
          )
        statements.push(
          prepareTenantInsert(
            scope,
            tripMembers,
            {
              tripId: trip.id,
              userId: owner.userId,
              role: 'owner',
            },
            allOf(exists(ownerStillPresent), notExists(anotherMember)),
          ),
        )
      } else if (departing?.role === 'owner' || trip.createdBy === userId) {
        // Re-select inside the transaction: the editor read earlier may already have left.
        const successor = scope.db
          .select({ id: tripMembers.id })
          .from(tripMembers)
          .where(
            tenantFilter(
              scope,
              tripMembers,
              eq(tripMembers.tripId, trip.id),
              ne(tripMembers.userId, userId),
            ),
          )
          .orderBy(
            asc(
              sql`case when ${tripMembers.role} = 'editor' then 0 else 1 end`,
            ),
            asc(
              sql`coalesce(${tripMembers.joinedAt}, ${tripMembers.createdAt})`,
            ),
            asc(tripMembers.createdAt),
            asc(tripMembers.id),
          )
          .limit(1)
        // The notice precedes the update with the same condition, in one atomic batch. No
        // concurrent writer can remove the selected member between these two statements.
        statements.push(
          prepareTenantInsert(
            scope,
            auditLog,
            {
              actorUserId: scope.ctx.userId,
              action: 'trip.owner_promoted',
              entityType: 'trip',
              entityId: trip.id,
            },
            allOf(notExists(survivingOwner), exists(successor)),
          ),
          scope.db
            .update(tripMembers)
            .set({ role: 'owner' })
            .where(
              tenantFilter(
                scope,
                tripMembers,
                eq(tripMembers.id, sql`(${successor})`),
                notExists(survivingOwner),
              ),
            ),
        )
      }
      // Removing the erased owner and anonymising the creator are part of that same handoff.
      // If every successor left, both writes refuse, keeping the original retry anchors intact.
      statements.push(
        scope.db
          .delete(tripMembers)
          .where(
            tenantFilter(
              scope,
              tripMembers,
              eq(tripMembers.tripId, trip.id),
              eq(tripMembers.userId, userId),
              exists(survivingOwner),
            ),
          ),
        scope.db
          .update(trips)
          .set({ createdBy: formerMemberId })
          .where(
            tenantFilter(
              scope,
              trips,
              eq(trips.id, trip.id),
              eq(trips.createdBy, userId),
              exists(survivingOwner),
            ),
          ),
      )
      await runBatch(scope, statements)
      if (await tripRepo.exists(scope, trip.id)) {
        const target = await memberships.findOne(
          scope,
          allOf(
            eq(tripMembers.tripId, trip.id),
            eq(tripMembers.userId, userId),
          ),
        )
        const owner = await memberships.findOne(
          scope,
          allOf(
            eq(tripMembers.tripId, trip.id),
            ne(tripMembers.userId, userId),
            eq(tripMembers.role, 'owner'),
          ),
        )
        if (target !== null || owner === null)
          throw new RepositoryError(
            'Trip ownership changed during erasure; retry.',
            'ERASURE_TRIP_CHANGED',
          )
      }
    }
    cursor = page.nextCursor
  } while (cursor !== null)

  await scrubRows(scope, tripMembers, eq(tripMembers.invitedBy, userId), {
    invitedBy: null,
  })
  await anonymiseColumn(scope, tripGuests, 'createdBy', userId, formerMemberId)
  const favourites = createTenantTableAccess(tripFavourites, 'favourite')
  for (;;) {
    const rows = await favourites.findMany(scope, {
      where: eq(tripFavourites.userId, userId),
      limit: 40,
    })
    if (!rows.length) break
    for (const row of rows)
      await favourites.removeWhere(
        scope,
        allOf(
          eq(tripFavourites.userId, userId),
          eq(tripFavourites.tripId, row.tripId),
        ),
      )
  }
  const participants = createTenantTableAccess(
    assignmentParticipants,
    'assignment participant',
  )
  for (;;) {
    const rows = await participants.findMany(scope, {
      where: eq(assignmentParticipants.userId, userId),
      limit: 40,
    })
    if (!rows.length) break
    for (const row of rows)
      await participants.removeWhere(
        scope,
        allOf(
          eq(assignmentParticipants.userId, userId),
          eq(assignmentParticipants.assignmentId, row.assignmentId),
        ),
      )
  }
  await anonymiseColumn(scope, dayNotes, 'createdBy', userId, formerMemberId)
  await scrubRows(scope, packingLists, eq(packingLists.ownerUserId, userId))
  await scrubRows(scope, packingItems, eq(packingItems.assignedTo, userId), {
    assignedTo: null,
  })
  await scrubRows(
    scope,
    packingTemplates,
    allOf(
      eq(packingTemplates.createdBy, userId),
      eq(packingTemplates.isShared, false),
    ),
  )
  await anonymiseColumn(
    scope,
    packingTemplates,
    'createdBy',
    userId,
    formerMemberId,
  )
  await scrubRows(scope, shareLinks, eq(shareLinks.createdBy, userId), {
    createdBy: formerMemberId,
    revokedAt: new Date(),
  })
  await scrubRows(
    scope,
    tripInviteLinks,
    eq(tripInviteLinks.createdBy, userId),
    { createdBy: formerMemberId, disabledAt: new Date() },
  )
  await scrubRows(scope, calendarFeeds, eq(calendarFeeds.userId, userId))
  await anonymiseColumn(scope, tripFiles, 'uploadedBy', userId, formerMemberId)
  const rewriteKeys: string[] = []
  let fileCursor: string | null = null
  do {
    const page = await files.page(scope, {
      cursor: fileCursor,
      where: or(
        eq(tripFiles.uploadedBy, userId),
        eq(tripFiles.uploadedBy, formerMemberId),
      ),
      limit: 40,
    })
    rewriteKeys.push(...page.items.map((row) => row.storageKey))
    fileCursor = page.nextCursor
  } while (fileCursor !== null)
  return rewriteKeys
}
