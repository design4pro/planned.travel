/** Worker-only collection erasure; another contributor's saved places survive. */
import { eq, exists, ne, not, sql } from 'drizzle-orm'
import { collections, collectionPlaces } from '#/server/db/schema'
import { allOf, tenantFilter } from './base'
import { assertErasure, scrubRows, anonymiseColumn } from './erasure-write'
import type { TenantScope } from './base'

export async function eraseUserCollections(
  scope: TenantScope,
  userId: string,
  formerMemberId: string,
): Promise<void> {
  assertErasure(scope, userId, formerMemberId)
  const owned = exists(
    scope.db
      .select({ present: sql`1` })
      .from(collections)
      .where(
        tenantFilter(
          scope,
          collections,
          eq(collections.id, collectionPlaces.collectionId),
          eq(collections.ownerUserId, userId),
        ),
      ),
  )
  await scrubRows(
    scope,
    collectionPlaces,
    allOf(eq(collectionPlaces.savedBy, userId), owned),
  )
  const other = exists(
    scope.db
      .select({ present: sql`1` })
      .from(collectionPlaces)
      .where(
        tenantFilter(
          scope,
          collectionPlaces,
          eq(collectionPlaces.collectionId, collections.id),
          ne(collectionPlaces.savedBy, userId),
        ),
      ),
  )
  await scrubRows(
    scope,
    collections,
    allOf(eq(collections.ownerUserId, userId), not(other)),
  )
  await anonymiseColumn(
    scope,
    collections,
    'ownerUserId',
    userId,
    formerMemberId,
  )
  await anonymiseColumn(
    scope,
    collectionPlaces,
    'savedBy',
    userId,
    formerMemberId,
  )
}
