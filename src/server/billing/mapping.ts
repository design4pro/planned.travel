/**
 * Translation between Stripe objects and our `SubscriptionRecord`.
 *
 * Pure functions only — no network, no database — so every branch is covered by unit
 * tests. Plan identity is *always* resolved from `src/lib/plans.ts` via the price id
 * on the subscription item; metadata is only ever a hint we cross-check.
 */

import type Stripe from 'stripe'
import {
  clampSeats,
  isSubscriptionStatus,
  planById,
  planForPriceId
  
  
  
} from '#/lib/plans'
import type {BillingInterval, PlanId, SubscriptionStatus} from '#/lib/plans';
import { ceilingsForPlan } from './limits'
import { fromStripeTimestamp, organizationIdFromMetadata, stripeIdOf } from './stripe'
import type { SubscriptionRecord } from './types'

/** The subscription item that carries the plan we recognise. */
export interface ResolvedSubscriptionItem {
  readonly item: Stripe.SubscriptionItem
  readonly priceId: string
  readonly planId: PlanId
  readonly interval: BillingInterval
  readonly seats: number
}

/**
 * Find the item on a Stripe subscription that maps to a plan in our catalogue.
 * Returns `null` for subscriptions created outside this product.
 */
export function resolveSubscriptionItem(
  subscription: Stripe.Subscription,
): ResolvedSubscriptionItem | null {
  for (const item of subscription.items.data) {
    const priceId = stripeIdOf(item.price)
    const match = planForPriceId(priceId)
    if (!match || priceId === null) continue

    const quantity = typeof item.quantity === 'number' ? item.quantity : 1
    const seats = match.plan.seatBased
      ? clampSeats(match.plan, quantity)
      : match.plan.seatRange.min

    return { item, priceId, planId: match.plan.id, interval: match.interval, seats }
  }
  return null
}

/** Stripe statuses we do not model collapse to `incomplete`, our safest neutral. */
export function toSubscriptionStatus(status: string): SubscriptionStatus {
  return isSubscriptionStatus(status) ? status : 'incomplete'
}

/**
 * Period boundaries moved from the subscription onto its items in API version
 * `2025-03-31.basil` and later, so they are read from the resolved item.
 */
function periodOf(item: Stripe.SubscriptionItem): {
  start: Date | null
  end: Date | null
} {
  return {
    start: fromStripeTimestamp(item.current_period_start),
    end: fromStripeTimestamp(item.current_period_end),
  }
}

export interface SubscriptionMappingOptions {
  /**
   * Organization to attribute the subscription to when Stripe metadata does not
   * carry one — typically recovered by looking the customer up in our own table.
   */
  readonly fallbackOrganizationId?: string | null
}

/**
 * Build the row we persist from a Stripe subscription.
 *
 * Returns `null` when the subscription cannot be attributed to an organization or
 * does not reference a price this product sells — both of which are legitimate on a
 * shared Stripe account and must not throw inside a webhook.
 */
export function subscriptionRecordFromStripe(
  subscription: Stripe.Subscription,
  options: SubscriptionMappingOptions = {},
): SubscriptionRecord | null {
  const organizationId =
    organizationIdFromMetadata(subscription.metadata) ??
    options.fallbackOrganizationId ??
    null
  if (organizationId === null) return null

  const resolved = resolveSubscriptionItem(subscription)
  if (!resolved) return null

  const status = toSubscriptionStatus(subscription.status)
  const period = periodOf(resolved.item)

  return {
    organizationId,
    planId: resolved.planId,
    status,
    interval: resolved.interval,
    seats: resolved.seats,
    stripeCustomerId: stripeIdOf(subscription.customer),
    stripeSubscriptionId: subscription.id,
    stripePriceId: resolved.priceId,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialEndsAt: fromStripeTimestamp(subscription.trial_end),
    canceledAt: fromStripeTimestamp(subscription.canceled_at),
    // A subscription that arrives from Stripe is the plan it names, so its ceilings are
    // the plan's own. An operator escape can only ever be applied after this point.
    ceilings: ceilingsForPlan(resolved.planId, resolved.seats),
  }
}

/**
 * The row that represents "this organization is back on Free".
 * Keeps the Stripe customer so the next upgrade reuses the same billing profile.
 */
export function cancelledRecord(
  previous: SubscriptionRecord | null,
  organizationId: string,
  stripeCustomerId: string | null,
  canceledAt: Date,
): SubscriptionRecord {
  const free = planById('free')
  return {
    organizationId,
    planId: 'free',
    status: 'canceled',
    interval: null,
    seats: free.seatRange.min,
    stripeCustomerId: stripeCustomerId ?? previous?.stripeCustomerId ?? null,
    stripeSubscriptionId: previous?.stripeSubscriptionId ?? null,
    stripePriceId: null,
    currentPeriodStart: previous?.currentPeriodStart ?? null,
    currentPeriodEnd: previous?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    canceledAt,
    // Back on Free means back to Free's ceilings: cancellation grandfathers nothing.
    ceilings: ceilingsForPlan('free', free.seatRange.min),
  }
}

/** The invoice's parent subscription id, wherever Stripe currently keeps it. */
export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  return stripeIdOf(invoice.parent?.subscription_details?.subscription)
}
