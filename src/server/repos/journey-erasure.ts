/** Worker-only journal erasure. Cleanup must be durable before a photo key can disappear. */
import { eq, exists, inArray, ne, not, sql } from 'drizzle-orm'
import { journeys, journeyEntries, journeyPhotos } from '#/server/db/schema'
import { allOf, anyOf, createTenantRepository, tenantFilter } from './base'
import { assertErasure, scrubRows, anonymiseColumn } from './erasure-write'
import { RepositoryError } from './context'
import type { TenantScope } from './base'

export async function eraseUserJourneys(
  scope: TenantScope,
  userId: string,
  formerMemberId: string,
  preparePhotoRemoval: (keys: ReadonlyArray<string>) => Promise<void>,
): Promise<Array<string>> {
  assertErasure(scope, userId, formerMemberId)
  const otherEntry = exists(
    scope.db
      .select({ present: sql`1` })
      .from(journeyEntries)
      .where(
        tenantFilter(
          scope,
          journeyEntries,
          eq(journeyEntries.journeyId, journeys.id),
          ne(journeyEntries.authorUserId, userId),
        ),
      ),
  )
  const doomed = allOf(eq(journeys.ownerUserId, userId), not(otherEntry))
  const inDoomed = exists(
    scope.db
      .select({ present: sql`1` })
      .from(journeys)
      .where(
        tenantFilter(
          scope,
          journeys,
          eq(journeys.id, journeyPhotos.journeyId),
          doomed,
        ),
      ),
  )
  const inOwnEntry = exists(
    scope.db
      .select({ present: sql`1` })
      .from(journeyEntries)
      .where(
        tenantFilter(
          scope,
          journeyEntries,
          eq(journeyEntries.id, journeyPhotos.entryId),
          eq(journeyEntries.authorUserId, userId),
        ),
      ),
  )
  const removedPhoto = anyOf(
    eq(journeyPhotos.uploadedBy, userId),
    inOwnEntry,
    inDoomed,
  )
  const photos = createTenantRepository(journeyPhotos, 'journey photo')
  const entries = createTenantRepository(journeyEntries, 'journey entry')
  const journal = createTenantRepository(journeys, 'journey')
  const keys: Array<string> = []
  for (;;) {
    const page = await photos.findMany(scope, {
      where: removedPhoto,
      limit: 40,
    })
    if (page.length === 0) break
    const pageKeys = page.flatMap((row) =>
      row.thumbnailKey === null
        ? [row.storageKey]
        : [row.storageKey, row.thumbnailKey],
    )
    // Save a durable manifest before deleting only the exact rows whose keys it contains.
    await preparePhotoRemoval(pageKeys)
    await photos.removeWhere(
      scope,
      inArray(
        journeyPhotos.id,
        page.map((row) => row.id),
      ),
    )
    keys.push(...pageKeys)
  }
  const attachedPhoto = exists(
    scope.db
      .select({ present: sql`1` })
      .from(journeyPhotos)
      .where(
        tenantFilter(
          scope,
          journeyPhotos,
          eq(journeyPhotos.entryId, journeyEntries.id),
        ),
      ),
  )
  await scrubRows(
    scope,
    journeyEntries,
    allOf(eq(journeyEntries.authorUserId, userId), not(attachedPhoto)),
  )
  // A late attachment must be collected on retry, never silently removed through a cascade.
  if (await entries.count(scope, eq(journeyEntries.authorUserId, userId))) {
    throw new RepositoryError(
      'Journey photos changed during erasure.',
      'ERASURE_RETRY',
    )
  }
  const remainingPhoto = exists(
    scope.db
      .select({ present: sql`1` })
      .from(journeyPhotos)
      .where(
        tenantFilter(
          scope,
          journeyPhotos,
          eq(journeyPhotos.journeyId, journeys.id),
        ),
      ),
  )
  await scrubRows(scope, journeys, allOf(doomed, not(remainingPhoto)))
  if (await journal.count(scope, doomed)) {
    throw new RepositoryError(
      'Journey photos changed during erasure.',
      'ERASURE_RETRY',
    )
  }
  await anonymiseColumn(scope, journeys, 'ownerUserId', userId, formerMemberId)
  return keys
}
