/** Worker-only vacation erasure; invited members keep the shared plan. */
import { eq, exists, ne, not, sql } from 'drizzle-orm'
import {
  vacayPlans,
  vacayPlanMembers,
  vacayUserYears,
  vacayEntries,
  vacayUserColours,
} from '#/server/db/schema'
import { allOf, tenantFilter } from './base'
import { assertErasure, scrubRows, anonymiseColumn } from './erasure-write'
import type { TenantScope } from './base'

export async function eraseUserVacation(
  scope: TenantScope,
  userId: string,
  formerMemberId: string,
): Promise<void> {
  assertErasure(scope, userId, formerMemberId)
  const invited = exists(
    scope.db
      .select({ present: sql`1` })
      .from(vacayPlanMembers)
      .where(
        tenantFilter(
          scope,
          vacayPlanMembers,
          eq(vacayPlanMembers.planId, vacayPlans.id),
          ne(vacayPlanMembers.userId, userId),
        ),
      ),
  )
  await scrubRows(
    scope,
    vacayPlans,
    allOf(eq(vacayPlans.ownerUserId, userId), not(invited)),
  )
  await anonymiseColumn(
    scope,
    vacayPlans,
    'ownerUserId',
    userId,
    formerMemberId,
  )
  await scrubRows(scope, vacayPlanMembers, eq(vacayPlanMembers.userId, userId))
  await scrubRows(scope, vacayUserYears, eq(vacayUserYears.userId, userId))
  await scrubRows(scope, vacayEntries, eq(vacayEntries.userId, userId))
  await scrubRows(scope, vacayUserColours, eq(vacayUserColours.userId, userId))
}
