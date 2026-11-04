import type { SubscriptionStatus } from '#/lib/plans'

/** Shared with the atomic SQL guard; unpaid subscriptions no longer grant access. */
export const WORKSPACE_DELETION_BLOCKING_STATUSES: ReadonlyArray<SubscriptionStatus> =
  ['trialing', 'active', 'past_due', 'paused']

export function subscriptionBlocksWorkspaceDeletion(
  row: {
    providerSubscriptionId: string | null
    status: SubscriptionStatus
    cancelAtPeriodEnd: boolean
  } | null,
): boolean {
  return (
    row !== null &&
    row.providerSubscriptionId !== null &&
    WORKSPACE_DELETION_BLOCKING_STATUSES.includes(row.status) &&
    !row.cancelAtPeriodEnd
  )
}
