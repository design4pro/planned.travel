/** Worker-only removal of a person's private atlas and preferences. */
import { eq } from 'drizzle-orm'
import {
  visitedCountries,
  visitedRegions,
  travelStats,
  bucketListItems,
  userSettings,
  notificationPreferences,
} from '#/server/db/schema'
import { assertErasure, scrubRows } from './erasure-write'
import type { TenantScope } from './base'

export async function eraseUserPersonalData(
  scope: TenantScope,
  userId: string,
  formerMemberId: string,
): Promise<void> {
  assertErasure(scope, userId, formerMemberId)
  await scrubRows(scope, visitedCountries, eq(visitedCountries.userId, userId))
  await scrubRows(scope, visitedRegions, eq(visitedRegions.userId, userId))
  await scrubRows(scope, travelStats, eq(travelStats.userId, userId))
  await scrubRows(scope, bucketListItems, eq(bucketListItems.userId, userId))
  await scrubRows(scope, userSettings, eq(userSettings.userId, userId))
  await scrubRows(
    scope,
    notificationPreferences,
    eq(notificationPreferences.userId, userId),
  )
}
