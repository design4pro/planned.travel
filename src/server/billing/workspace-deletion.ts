import { z } from 'zod'
import { polarSubscriptionSchema } from './mapping'
import { subscriptionBlocksWorkspaceDeletion } from './workspace-deletion-rule'
import type { BillingContext } from './types'

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
}: BillingContext): Promise<
  'allowed' | 'live-subscription' | 'billing-unavailable'
> {
  try {
    if (
      subscriptionBlocksWorkspaceDeletion(
        await runtime.subscriptions.findByOrganization(organizationId),
      )
    ) {
      return 'live-subscription'
    }
    const seen = new Set<string>()
    let expectedTotal: number | undefined
    let expectedPages: number | undefined
    for (let page = 1; ; page += 1) {
      const result = subscriptionPageSchema.parse(
        await runtime.polar.request({
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
      ) {
        return 'billing-unavailable'
      }
      for (const subscription of result.items) {
        if (
          subscription.customer.external_id !== organizationId ||
          seen.has(subscription.id)
        ) {
          return 'billing-unavailable'
        }
        seen.add(subscription.id)
        if (providerSubscriptionBlocksWorkspaceDeletion(subscription))
          return 'live-subscription'
      }
      if (page >= pages)
        return seen.size === total ? 'allowed' : 'billing-unavailable'
      if (result.items.length === 0 || seen.size >= total)
        return 'billing-unavailable'
    }
  } catch {
    return 'billing-unavailable'
  }
}
