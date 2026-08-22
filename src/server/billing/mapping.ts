/**
 * The Polar wire shapes, and the translation between them and `SubscriptionRecord`.
 *
 * Pure functions and schemas only — no network, no database — so every branch is
 * covered by unit tests. Two rules hold everywhere in this file:
 *
 * 1. **Plan identity comes from the catalogue.** A Polar subscription names exactly
 *    one product, so `planForProductId(subscription.product_id)` is the whole lookup.
 *    There are no line items to search: the previous provider hung price, quantity and
 *    period boundaries off a `items.data[]` array, and Polar hangs none of them there.
 * 2. **Attribution comes from `customer.external_id`.** We set it to the organization
 *    id when the checkout is created, Polar copies it onto every object in the chain,
 *    and it is unique per organization. Checkout metadata carries the same value and is
 *    only ever consulted as a cross-check, because metadata is copied at creation time
 *    and can be edited afterwards in the Polar dashboard.
 *
 * Every timestamp Polar sends is an ISO-8601 string, never a unix second count.
 */

import { z } from 'zod'
import { clampSeats, planById, planForProductId } from '#/lib/plans'
import { ceilingsForPlan } from './limits'

import type { BillingInterval, PlanId, SubscriptionStatus } from '#/lib/plans'
import type { SubscriptionRecord } from './types'

/* ------------------------------------------------------------------ wire shapes */

/**
 * Polar's `SubscriptionStatus`, in the order the API declares it.
 *
 * All eight also exist in `SUBSCRIPTION_STATUSES`, and the `subscriptions_status_chk`
 * CHECK constraint is generated from that tuple — so narrowing either one turns a
 * legitimate webhook into a failed write rather than a failed type check.
 */
export const POLAR_SUBSCRIPTION_STATUSES = [
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused',
] as const
export type PolarSubscriptionStatus = (typeof POLAR_SUBSCRIPTION_STATUSES)[number]

/** Polar's `OrderStatus`. An order is what Polar issues instead of an invoice. */
export const POLAR_ORDER_STATUSES = [
  'draft',
  'pending',
  'paid',
  'refunded',
  'partially_refunded',
  'void',
] as const
export type PolarOrderStatus = (typeof POLAR_ORDER_STATUSES)[number]

/** Polar metadata values are typed, so a seat count survives the round trip. */
export const polarMetadataSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()]),
)
export type PolarMetadata = z.infer<typeof polarMetadataSchema>

/** The customer as Polar embeds it on a subscription or an order. */
const polarCustomerSchema = z.object({
  id: z.string().min(1),
  external_id: z.string().nullish(),
  email: z.string().nullish(),
})

/**
 * The slice of Polar's `Subscription` we read.
 *
 * The period boundaries are declared non-nullable by the API, and are accepted as
 * nullable here anyway: a webhook that throws is retried up to ten times and then
 * disables the endpoint, which is a far worse outcome than a row with an open period.
 */
export const polarSubscriptionSchema = z.object({
  id: z.string().min(1),
  status: z.enum(POLAR_SUBSCRIPTION_STATUSES),
  product_id: z.string().min(1),
  seats: z.number().int().nullish(),
  current_period_start: z.string().nullish(),
  current_period_end: z.string().nullish(),
  cancel_at_period_end: z.boolean(),
  trial_end: z.string().nullish(),
  canceled_at: z.string().nullish(),
  customer_id: z.string().min(1),
  customer: polarCustomerSchema,
  metadata: polarMetadataSchema.nullish(),
})
export type PolarSubscription = z.infer<typeof polarSubscriptionSchema>

/** The slice of Polar's `Order` we read. */
export const polarOrderSchema = z.object({
  id: z.string().min(1),
  status: z.enum(POLAR_ORDER_STATUSES),
  created_at: z.string().min(1),
  total_amount: z.number().int(),
  currency: z.string().min(1),
  invoice_number: z.string().nullish(),
  is_invoice_generated: z.boolean(),
  next_payment_attempt_at: z.string().nullish(),
  subscription_id: z.string().nullish(),
  customer_id: z.string().min(1),
  customer: polarCustomerSchema,
  metadata: polarMetadataSchema.nullish(),
})
export type PolarOrder = z.infer<typeof polarOrderSchema>

/** Polar paginates every collection the same way. */
export const polarOrderListSchema = z.object({
  items: z.array(polarOrderSchema),
  pagination: z.object({ total_count: z.number().int() }),
})

/** Polar's `CheckoutStatus`. */
export const POLAR_CHECKOUT_STATUSES = [
  'open',
  'expired',
  'confirmed',
  'succeeded',
  'failed',
] as const

/** The slice of Polar's `Checkout` we read back after creating one. */
export const polarCheckoutSchema = z.object({
  id: z.string().min(1),
  status: z.enum(POLAR_CHECKOUT_STATUSES),
  /** Non-nullable in the API: a checkout without somewhere to send the customer
   *  is not a checkout, so a missing URL is a parse failure and not a null branch. */
  url: z.string().min(1),
  product_id: z.string().min(1),
  external_customer_id: z.string().nullish(),
  customer_id: z.string().nullish(),
  seats: z.number().int().nullish(),
  metadata: polarMetadataSchema.nullish(),
})

/** `POST /v1/customer-sessions/`. The token is short-lived and never stored. */
export const polarCustomerSessionSchema = z.object({
  id: z.string().min(1),
  customer_portal_url: z.string().min(1),
  customer_id: z.string().min(1),
  expires_at: z.string().min(1),
})

/** `GET /v1/orders/{id}/invoice`. */
export const polarOrderInvoiceSchema = z.object({ url: z.string().min(1) })

/* -------------------------------------------------------------------- primitives */

/**
 * Polar's eight subscription statuses onto ours, one for one.
 *
 * Spelled out rather than passed through a guard: the mapping is the contract, and a
 * table with no `default` branch is what makes the compiler refuse a Polar release
 * that adds a ninth value instead of quietly filing it under something plausible.
 */
const STATUS_BY_POLAR_STATUS: {
  readonly [K in PolarSubscriptionStatus]: SubscriptionStatus
} = {
  incomplete: 'incomplete',
  incomplete_expired: 'incomplete_expired',
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'unpaid',
  paused: 'paused',
}

export function toSubscriptionStatus(
  status: PolarSubscriptionStatus,
): SubscriptionStatus {
  return STATUS_BY_POLAR_STATUS[status]
}

/** Parse an ISO-8601 instant, tolerating null and refusing an unparseable string. */
export function fromPolarTimestamp(value: string | null | undefined): Date | null {
  if (value == null || value === '') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Our organization id as carried in Polar metadata.
 *
 * A cross-check only — see the file header. Metadata values may be numbers or
 * booleans, and neither is an organization id, so only a non-empty string counts.
 */
export function organizationIdFromMetadata(
  metadata: PolarMetadata | null | undefined,
): string | null {
  const value = metadata?.organizationId
  return typeof value === 'string' && value !== '' ? value : null
}

/* ------------------------------------------------------------------- attribution */

export interface SubscriptionMappingOptions {
  /**
   * Organization to attribute the subscription to when Polar carries neither an
   * external customer id nor our metadata — typically recovered by looking the
   * customer up in our own table.
   */
  readonly fallbackOrganizationId?: string | null
}

/**
 * Which organization a Polar subscription belongs to.
 *
 * `customer.external_id` first, always: we set it, Polar keeps it unique inside the
 * organization and refuses to let it be changed once written. Metadata is second and
 * our own customer index is last.
 */
export function organizationIdFromSubscription(
  subscription: PolarSubscription,
  options: SubscriptionMappingOptions = {},
): string | null {
  const external = subscription.customer.external_id
  if (typeof external === 'string' && external !== '') return external
  return (
    organizationIdFromMetadata(subscription.metadata) ??
    options.fallbackOrganizationId ??
    null
  )
}

/** The plan a Polar subscription is on, or `null` for a product we do not sell. */
export interface ResolvedSubscriptionPlan {
  readonly planId: PlanId
  readonly interval: BillingInterval
  readonly seats: number
}

export function resolveSubscriptionPlan(
  subscription: PolarSubscription,
): ResolvedSubscriptionPlan | null {
  const match = planForProductId(subscription.product_id)
  if (match === null) return null

  const billed = subscription.seats ?? match.plan.seatRange.min
  const seats = match.plan.seatBased
    ? clampSeats(match.plan, billed)
    : match.plan.seatRange.min

  return { planId: match.plan.id, interval: match.interval, seats }
}

/* ----------------------------------------------------------------------- records */

/**
 * Build the row we persist from a Polar subscription.
 *
 * Returns `null` when the subscription cannot be attributed to an organization or
 * names a product this deployment does not sell — both legitimate on an organization
 * that also sells something else, and neither may throw inside a webhook.
 */
export function subscriptionRecordFromPolar(
  subscription: PolarSubscription,
  options: SubscriptionMappingOptions = {},
): SubscriptionRecord | null {
  const organizationId = organizationIdFromSubscription(subscription, options)
  if (organizationId === null) return null

  const resolved = resolveSubscriptionPlan(subscription)
  if (resolved === null) return null

  return {
    organizationId,
    planId: resolved.planId,
    status: toSubscriptionStatus(subscription.status),
    interval: resolved.interval,
    seats: resolved.seats,
    providerCustomerId: subscription.customer_id,
    providerSubscriptionId: subscription.id,
    providerProductId: subscription.product_id,
    currentPeriodStart: fromPolarTimestamp(subscription.current_period_start),
    currentPeriodEnd: fromPolarTimestamp(subscription.current_period_end),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialEndsAt: fromPolarTimestamp(subscription.trial_end),
    canceledAt: fromPolarTimestamp(subscription.canceled_at),
    // A subscription that arrives from Polar is the plan it names, so its ceilings are
    // the plan's own. An operator escape can only ever be applied after this point.
    ceilings: ceilingsForPlan(resolved.planId, resolved.seats),
  }
}

/**
 * The row that represents "this organization is back on Free".
 * Keeps the Polar customer so the next upgrade reuses the same billing profile.
 */
export function cancelledRecord(
  previous: SubscriptionRecord | null,
  organizationId: string,
  providerCustomerId: string | null,
  canceledAt: Date,
): SubscriptionRecord {
  const free = planById('free')
  return {
    organizationId,
    planId: 'free',
    status: 'canceled',
    interval: null,
    seats: free.seatRange.min,
    providerCustomerId: providerCustomerId ?? previous?.providerCustomerId ?? null,
    providerSubscriptionId: previous?.providerSubscriptionId ?? null,
    providerProductId: null,
    currentPeriodStart: previous?.currentPeriodStart ?? null,
    currentPeriodEnd: previous?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    canceledAt,
    // Back on Free means back to Free's ceilings: cancellation grandfathers nothing.
    ceilings: ceilingsForPlan('free', free.seatRange.min),
  }
}

/** The subscription an order was raised against, when it was raised against one. */
export function subscriptionIdFromOrder(order: PolarOrder): string | null {
  const value = order.subscription_id
  return typeof value === 'string' && value !== '' ? value : null
}

/** Which organization an order belongs to, on the same rules as a subscription. */
export function organizationIdFromOrder(order: PolarOrder): string | null {
  const external = order.customer.external_id
  if (typeof external === 'string' && external !== '') return external
  return organizationIdFromMetadata(order.metadata)
}
