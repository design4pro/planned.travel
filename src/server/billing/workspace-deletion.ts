import { z } from 'zod'
import { polarSubscriptionSchema } from './mapping'
import { subscriptionBlocksWorkspaceDeletion } from './workspace-deletion-rule'
import type { BillingContext, BillingRuntime, PolarClient } from './types'

/** Only the provider fields needed to establish deletion eligibility and attribution. */
export const deletionSubscriptionSchema = polarSubscriptionSchema.pick({
  id: true,
  status: true,
  cancel_at_period_end: true,
  customer: true,
})

const subscriptionPageSchema = z.object({
  items: z.array(deletionSubscriptionSchema).max(100),
  pagination: z.object({
    total_count: z.number().int().nonnegative(),
    // Bound the request work; an oversized history refuses deletion rather than truncating it.
    max_page: z.number().int().min(0).max(100),
  }),
})

export function providerSubscriptionBlocksWorkspaceDeletion(
  subscription: z.infer<typeof deletionSubscriptionSchema>,
): boolean {
  return subscriptionBlocksWorkspaceDeletion({
    providerSubscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  })
}

/** The driver calls this after fencing; a provider failure never authorizes deletion. */
export async function checkWorkspaceDeletionBilling({
  runtime,
  organizationId,
}: Pick<BillingContext, 'organizationId'> & {
  runtime: Pick<BillingRuntime, 'polar' | 'subscriptions'>
}): Promise<'allowed' | 'live-subscription' | 'billing-unavailable'> {
  try {
    if (
      subscriptionBlocksWorkspaceDeletion(
        await runtime.subscriptions.findByOrganization(organizationId),
      )
    ) {
      return 'live-subscription'
    }
    for await (const subscription of workspaceDeletionSubscriptions(
      runtime.polar,
      organizationId,
    )) {
      if (providerSubscriptionBlocksWorkspaceDeletion(subscription))
        return 'live-subscription'
    }
    return 'allowed'
  } catch {
    return 'billing-unavailable'
  }
}

/** One bounded provider-list contract shared by the fence check and post-cascade reconciliation. */
async function* workspaceDeletionSubscriptions(
  polar: PolarClient,
  organizationId: string,
) {
  const seen = new Set<string>()
  let expectedTotal: number | undefined
  let expectedPages: number | undefined
  for (let page = 1; ; page += 1) {
    const result = subscriptionPageSchema.parse(
      await polar.request({
        method: 'GET',
        path: '/v1/subscriptions/',
        query: { external_customer_id: organizationId, page, limit: 100 },
      }),
    )
    const { total_count: total, max_page: pages } = result.pagination
    expectedTotal ??= total
    expectedPages ??= pages
    if (
      total !== expectedTotal ||
      pages !== expectedPages ||
      (pages === 0 && total !== 0)
    )
      throw new Error('Workspace subscription pagination changed')
    for (const subscription of result.items) {
      if (
        subscription.customer.external_id !== organizationId ||
        seen.has(subscription.id)
      )
        throw new Error('Workspace subscription attribution is invalid')
      seen.add(subscription.id)
      yield subscription
    }
    if (page >= pages) {
      if (seen.size !== total)
        throw new Error('Workspace subscription history is incomplete')
      break
    }
    if (result.items.length === 0 || seen.size >= total)
      throw new Error('Workspace subscription history is incomplete')
  }
}

/** After row deletion, reconcile provider authority even if the local subscription cascaded away. */
export async function reconcileWorkspaceDeletionBilling(
  polar: PolarClient,
  organizationId: string,
): Promise<void> {
  const subscriptions: Array<z.infer<typeof deletionSubscriptionSchema>> = []
  for await (const subscription of workspaceDeletionSubscriptions(
    polar,
    organizationId,
  ))
    subscriptions.push(subscription)
  // Validate the entire bounded list before any write; a foreign later page cannot trigger writes.
  for (const subscription of subscriptions) {
    if (!providerSubscriptionBlocksWorkspaceDeletion(subscription)) continue
    const updated = deletionSubscriptionSchema.parse(
      await polar.request({
        method: 'PATCH',
        path: `/v1/subscriptions/${subscription.id}`,
        body: { cancel_at_period_end: true },
      }),
    )
    if (
      updated.id !== subscription.id ||
      updated.customer.external_id !== organizationId ||
      providerSubscriptionBlocksWorkspaceDeletion(updated)
    )
      throw new Error('Workspace period-end cancellation was not confirmed')
  }
}
