/** Worker-only money scrub: all amounts and ledger rows survive. */
import { expenses, expenseShares, settlements } from '#/server/db/schema'
import { anonymiseColumn, assertErasure } from './erasure-write'
import type { TenantScope } from './base'

export async function eraseUserMoney(
  scope: TenantScope,
  userId: string,
  formerMemberId: string,
): Promise<void> {
  assertErasure(scope, userId, formerMemberId)
  await anonymiseColumn(scope, expenses, 'paidBy', userId, formerMemberId)
  await anonymiseColumn(scope, expenses, 'createdBy', userId, formerMemberId)
  await anonymiseColumn(scope, expenseShares, 'userId', userId, formerMemberId)
  await anonymiseColumn(
    scope,
    settlements,
    'fromUserId',
    userId,
    formerMemberId,
  )
  await anonymiseColumn(scope, settlements, 'toUserId', userId, formerMemberId)
  await anonymiseColumn(scope, settlements, 'createdBy', userId, formerMemberId)
}
