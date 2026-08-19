/**
 * Buying, changing and managing a subscription.
 *
 * Three rules govern everything in this file:
 *
 * 1. **The client never names a price.** It sends a plan id, an interval and a
 *    seat count; the Stripe price is resolved from `src/lib/plans.ts` and the
 *    seats are clamped into the plan's own range. A tampered request can only
 *    ever ask for a plan that exists in the catalogue, at the price we publish.
 * 2. **The org is the customer.** One Stripe customer per organization, created
 *    once with a stable idempotency key and carried on the subscription row, so
 *    a workspace that upgrades, cancels and returns keeps one billing history.
 * 3. **Stripe owns the hard parts.** A first subscription goes through Checkout.
 *    A change to an existing one goes through the Billing Portal's confirmation
 *    flow, which is what applies proration on an upgrade and defers a downgrade
 *    to the end of the paid period without us re-implementing either.
 *
 * Nothing here touches a Cloudflare binding: every function takes an injected
 * `BillingRuntime`, which is what makes the whole flow unit-testable.
 */

import { z } from 'zod'
import {
  BILLING_INTERVALS,
  PAID_PLAN_LIST,
  PLAN_IDS,
  clampSeats,
  isEntitlingStatus,
  planById,
  requirePrice,
} from '#/lib/plans'
import type { BillingInterval, Plan, PlanId, PlanPrice } from '#/lib/plans'
import { BillingForbiddenError, canManageBilling } from './types'
import type {
  BillingIdentity,
  BillingRuntime,
  SubscriptionRecord,
} from './types'
import type { StripeBillingMetadata } from './stripe'
import type Stripe from 'stripe'

/* ------------------------------------------------------------------- inputs */

/** Only plans a customer can actually buy are accepted. */
const paidPlanIds = PAID_PLAN_LIST.map((plan) => plan.id)

export const planSelectionInput = z.object({
  planId: z
    .enum(PLAN_IDS)
    .refine((id): id is PlanId => paidPlanIds.includes(id), {
      message: 'That plan cannot be purchased.',
    }),
  interval: z.enum(BILLING_INTERVALS),
  /** Requested seats. Clamped into the plan's range before it reaches Stripe. */
  seats: z.number().int().min(1).max(1000).optional(),
})
export type PlanSelectionInput = z.infer<typeof planSelectionInput>

export const PORTAL_INTENTS = ['home', 'paymentMethod', 'cancel'] as const
export type PortalIntent = (typeof PORTAL_INTENTS)[number]

export const portalInput = z.object({
  intent: z.enum(PORTAL_INTENTS).default('home'),
})
export type PortalInput = z.infer<typeof portalInput>

/** What every purchase path hands back: a URL to send the browser to. */
export interface BillingRedirect {
  readonly url: string
  /** Which Stripe surface the customer is going to, for analytics and copy. */
  readonly surface: 'checkout' | 'portal'
}

export interface PlanSelection {
  readonly plan: Plan
  readonly interval: BillingInterval
  readonly price: PlanPrice
  /** Seats actually billed — clamped into `plan.seatRange`. */
  readonly seats: number
}

/**
 * Turn an untrusted selection into a priced one.
 *
 * `requirePrice` throws when a deployment has not configured the Stripe price id
 * for the plan, which is far better than silently charging the wrong amount.
 */
export function resolvePlanSelection(input: PlanSelectionInput): PlanSelection {
  const parsed = planSelectionInput.parse(input)
  const plan = planById(parsed.planId)
  const price = requirePrice(plan, parsed.interval)
  const seats = plan.seatBased
    ? clampSeats(plan, parsed.seats ?? plan.seatRange.min)
    : plan.seatRange.min

  return { plan, interval: parsed.interval, price, seats }
}

/* --------------------------------------------------------------------- urls */

/**
 * Stripe replaces `{CHECKOUT_SESSION_ID}` in the success URL, which lets the
 * billing screen tell "just subscribed" apart from an ordinary visit before the
 * webhook has necessarily landed.
 */
export function checkoutSuccessUrl(appUrl: string): string {
  return `${appUrl}/settings/billing?checkout=complete&session={CHECKOUT_SESSION_ID}`
}

export function checkoutCancelUrl(appUrl: string): string {
  return `${appUrl}/settings/billing?checkout=cancelled`
}

export function portalReturnUrl(appUrl: string): string {
  return `${appUrl}/settings/billing?portal=complete`
}

/* -------------------------------------------------------------- idempotency */

/** Buckets an idempotency key by the minute it was requested in. */
const IDEMPOTENCY_WINDOW_MS = 60_000

/**
 * A double-clicked upgrade button must not create two Checkout Sessions, but a
 * customer who abandons Checkout and comes back an hour later must get a fresh
 * one. Bucketing by the minute gives both: identical requests inside the same
 * window collapse, later ones do not.
 */
export function checkoutIdempotencyKey(
  organizationId: string,
  selection: PlanSelection,
  now: Date,
): string {
  const window = Math.floor(now.getTime() / IDEMPOTENCY_WINDOW_MS)
  return [
    'checkout',
    organizationId,
    selection.plan.id,
    selection.interval,
    selection.seats,
    window,
  ].join(':')
}

/** One customer per organization, ever — so this key never varies. */
export function customerIdempotencyKey(organizationId: string): string {
  return `customer:${organizationId}`
}

/* ----------------------------------------------------------------- metadata */

export function billingMetadata(
  organizationId: string,
  selection: PlanSelection,
): StripeBillingMetadata {
  return {
    organizationId,
    planId: selection.plan.id,
    interval: selection.interval,
    seats: String(selection.seats),
  }
}

/* ----------------------------------------------------------------- guarding */

function assertCanManage(identity: BillingIdentity): void {
  if (canManageBilling(identity)) return
  throw new BillingForbiddenError(
    'Only an owner or an admin can change this workspace’s subscription.',
  )
}

/**
 * True when this organization has never carried a paid subscription, and so is
 * still entitled to the plan's free trial. Stripe would happily grant a second
 * one; we do not.
 */
export function isEligibleForTrial(record: SubscriptionRecord | null): boolean {
  if (record === null) return true
  return record.stripeSubscriptionId === null && record.trialEndsAt === null
}

/* ------------------------------------------------------------- the customer */

/**
 * The organization's Stripe customer, created on first use.
 *
 * The customer is written back onto the subscription row immediately rather than
 * waiting for `checkout.session.completed`, so an abandoned Checkout still
 * leaves the workspace with one stable billing profile.
 */
export async function ensureStripeCustomer(
  runtime: BillingRuntime,
  identity: BillingIdentity,
): Promise<string> {
  const existing = await runtime.subscriptions.findByOrganization(
    identity.organizationId,
  )
  if (existing?.stripeCustomerId != null) return existing.stripeCustomerId

  const customer = await runtime.stripe.customers.create(
    {
      email: identity.userEmail,
      name: identity.organizationName,
      metadata: {
        organizationId: identity.organizationId,
        createdByUserId: identity.userId,
      },
    },
    { idempotencyKey: customerIdempotencyKey(identity.organizationId) },
  )

  await runtime.subscriptions.attachCustomer(
    identity.organizationId,
    customer.id,
  )
  runtime.logger.info('billing.customer.created', {
    organizationId: identity.organizationId,
    stripeCustomerId: customer.id,
  })

  return customer.id
}

/* ----------------------------------------------------------------- checkout */

export interface CheckoutParamsInput {
  readonly appUrl: string
  readonly organizationId: string
  readonly customerId: string
  readonly selection: PlanSelection
  readonly trialDays: number
}

/**
 * The Checkout Session we ask Stripe for.
 *
 * Split out from the network call so every decision in it — the trial, the
 * seat range a customer may adjust, the metadata the webhook reads back — is
 * asserted in tests rather than in production.
 */
export function buildCheckoutSessionParams(
  input: CheckoutParamsInput,
): Stripe.Checkout.SessionCreateParams {
  const { selection } = input
  const metadata = billingMetadata(input.organizationId, selection)
  const seatRange = selection.plan.seatRange

  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = {
    price: selection.price.priceId,
    quantity: selection.seats,
  }

  // Seat-based plans let the customer settle on a number inside Checkout; a
  // flat plan is exactly one unit and must not be adjustable.
  if (selection.price.perSeat) {
    lineItem.adjustable_quantity = {
      enabled: true,
      minimum: seatRange.min,
      maximum: seatRange.max ?? seatRange.min,
    }
  }

  const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData =
    {
      description: `${selection.plan.name} — ${selection.plan.tagline}`,
      metadata,
    }

  if (input.trialDays > 0) {
    subscriptionData.trial_period_days = input.trialDays
    // A trial that was never given a card simply ends. Nothing is deleted, the
    // paid modules lock, and the workspace falls back to Free.
    subscriptionData.trial_settings = {
      end_behavior: { missing_payment_method: 'cancel' },
    }
  }

  return {
    mode: 'subscription',
    customer: input.customerId,
    client_reference_id: input.organizationId,
    line_items: [lineItem],
    subscription_data: subscriptionData,
    metadata,
    success_url: checkoutSuccessUrl(input.appUrl),
    cancel_url: checkoutCancelUrl(input.appUrl),
    // No card is asked for while a trial is on offer, which is what the pricing
    // page promises. Stripe collects one before the trial converts.
    payment_method_collection: input.trialDays > 0 ? 'if_required' : 'always',
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    tax_id_collection: { enabled: true },
    automatic_tax: { enabled: true },
    customer_update: { address: 'auto', name: 'auto' },
  }
}

/** Start a brand-new subscription in Stripe Checkout. */
export async function createCheckoutSession(
  runtime: BillingRuntime,
  identity: BillingIdentity,
  input: PlanSelectionInput,
): Promise<BillingRedirect> {
  assertCanManage(identity)

  const selection = resolvePlanSelection(input)
  const [customerId, existing] = await Promise.all([
    ensureStripeCustomer(runtime, identity),
    runtime.subscriptions.findByOrganization(identity.organizationId),
  ])

  const trialDays = isEligibleForTrial(existing) ? selection.plan.trialDays : 0

  const session = await runtime.stripe.checkout.sessions.create(
    buildCheckoutSessionParams({
      appUrl: runtime.appUrl,
      organizationId: identity.organizationId,
      customerId,
      selection,
      trialDays,
    }),
    {
      idempotencyKey: checkoutIdempotencyKey(
        identity.organizationId,
        selection,
        runtime.now(),
      ),
    },
  )

  if (session.url === null) {
    throw new Error(
      'Stripe did not return a Checkout URL. Try again in a moment.',
    )
  }

  runtime.logger.info('billing.checkout.created', {
    organizationId: identity.organizationId,
    planId: selection.plan.id,
    interval: selection.interval,
    seats: selection.seats,
    trialDays,
    sessionId: session.id,
  })

  return { url: session.url, surface: 'checkout' }
}

/* ------------------------------------------------------------------- portal */

const PORTAL_FLOWS: {
  readonly [
    K in PortalIntent
  ]: Stripe.BillingPortal.SessionCreateParams.FlowData.Type | null
} = {
  home: null,
  paymentMethod: 'payment_method_update',
  cancel: 'subscription_cancel',
}

export interface PortalParamsInput {
  readonly appUrl: string
  readonly customerId: string
  readonly intent: PortalIntent
  /** Required by the cancel flow; ignored by the others. */
  readonly subscriptionId: string | null
}

export function buildPortalSessionParams(
  input: PortalParamsInput,
): Stripe.BillingPortal.SessionCreateParams {
  const returnUrl = portalReturnUrl(input.appUrl)
  const flow = PORTAL_FLOWS[input.intent]

  if (flow === null) {
    return { customer: input.customerId, return_url: returnUrl }
  }

  if (flow === 'subscription_cancel') {
    if (input.subscriptionId === null) {
      throw new Error('There is no active subscription to cancel.')
    }
    return {
      customer: input.customerId,
      return_url: returnUrl,
      flow_data: {
        type: 'subscription_cancel',
        subscription_cancel: { subscription: input.subscriptionId },
        after_completion: {
          type: 'redirect',
          redirect: { return_url: returnUrl },
        },
      },
    }
  }

  return {
    customer: input.customerId,
    return_url: returnUrl,
    flow_data: {
      type: flow,
      after_completion: {
        type: 'redirect',
        redirect: { return_url: returnUrl },
      },
    },
  }
}

/** Send the customer into the Billing Portal — invoices, cards, cancellation. */
export async function createPortalSession(
  runtime: BillingRuntime,
  identity: BillingIdentity,
  input: PortalInput = { intent: 'home' },
): Promise<BillingRedirect> {
  assertCanManage(identity)

  const parsed = portalInput.parse(input)
  const record = await runtime.subscriptions.findByOrganization(
    identity.organizationId,
  )

  if (record?.stripeCustomerId == null) {
    throw new Error(
      'This workspace has no billing profile yet. Choose a plan to set one up first.',
    )
  }

  const session = await runtime.stripe.billingPortal.sessions.create(
    buildPortalSessionParams({
      appUrl: runtime.appUrl,
      customerId: record.stripeCustomerId,
      intent: parsed.intent,
      subscriptionId: record.stripeSubscriptionId,
    }),
  )

  runtime.logger.info('billing.portal.created', {
    organizationId: identity.organizationId,
    intent: parsed.intent,
  })

  return { url: session.url, surface: 'portal' }
}

/* -------------------------------------------------------------- plan change */

/**
 * A live subscription this organization owns, or `null` when the next purchase
 * has to go through Checkout.
 */
export function liveSubscriptionId(
  record: SubscriptionRecord | null,
): string | null {
  if (record === null) return null
  if (record.stripeSubscriptionId === null) return null
  return isEntitlingStatus(record.status) ? record.stripeSubscriptionId : null
}

/**
 * Move an existing subscription onto another plan or interval.
 *
 * The Portal's `subscription_update_confirm` flow is deliberate: it shows the
 * customer the prorated amount before they commit, applies an upgrade
 * immediately, and defers a downgrade to the end of the period they have
 * already paid for. Re-implementing that with `subscriptions.update` would mean
 * owning proration and schedule maths we have no business owning.
 */
export async function changePlan(
  runtime: BillingRuntime,
  identity: BillingIdentity,
  input: PlanSelectionInput,
): Promise<BillingRedirect> {
  assertCanManage(identity)

  const selection = resolvePlanSelection(input)
  const record = await runtime.subscriptions.findByOrganization(
    identity.organizationId,
  )
  const subscriptionId = liveSubscriptionId(record)

  if (subscriptionId === null || record?.stripeCustomerId == null) {
    return await createCheckoutSession(runtime, identity, input)
  }

  const subscription =
    await runtime.stripe.subscriptions.retrieve(subscriptionId)
  const item = subscription.items.data.at(0)
  if (item === undefined) {
    return await createCheckoutSession(runtime, identity, input)
  }

  const returnUrl = portalReturnUrl(runtime.appUrl)
  const session = await runtime.stripe.billingPortal.sessions.create({
    customer: record.stripeCustomerId,
    return_url: returnUrl,
    flow_data: {
      type: 'subscription_update_confirm',
      subscription_update_confirm: {
        subscription: subscriptionId,
        items: [
          {
            id: item.id,
            price: selection.price.priceId,
            quantity: selection.seats,
          },
        ],
      },
      after_completion: {
        type: 'redirect',
        redirect: { return_url: returnUrl },
      },
    },
  })

  runtime.logger.info('billing.plan_change.started', {
    organizationId: identity.organizationId,
    from: record.planId,
    to: selection.plan.id,
    interval: selection.interval,
    seats: selection.seats,
  })

  return { url: session.url, surface: 'portal' }
}

/* ----------------------------------------------------------------- invoices */

/** One row of the invoice history table. Every value is wire-safe. */
export interface InvoiceSummary {
  readonly id: string
  /** Stripe's human invoice number, or the id when one was never assigned. */
  readonly number: string
  readonly status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void'
  readonly createdAt: string
  readonly total: number
  readonly currency: string
  readonly periodStart: string
  readonly periodEnd: string
  readonly hostedUrl: string | null
  readonly pdfUrl: string | null
}

export const INVOICE_HISTORY_LIMIT = 12

const INVOICE_STATUSES = [
  'draft',
  'open',
  'paid',
  'uncollectible',
  'void',
] as const

function invoiceStatusOf(value: string | null): InvoiceSummary['status'] {
  return value !== null &&
    (INVOICE_STATUSES as ReadonlyArray<string>).includes(value)
    ? (value as InvoiceSummary['status'])
    : 'draft'
}

export function invoiceSummaryOf(invoice: Stripe.Invoice): InvoiceSummary {
  return {
    id: invoice.id,
    number: invoice.number ?? invoice.id,
    status: invoiceStatusOf(invoice.status),
    createdAt: new Date(invoice.created * 1000).toISOString(),
    total: invoice.total,
    currency: invoice.currency.toUpperCase(),
    periodStart: new Date(invoice.period_start * 1000).toISOString(),
    periodEnd: new Date(invoice.period_end * 1000).toISOString(),
    hostedUrl: invoice.hosted_invoice_url ?? null,
    pdfUrl: invoice.invoice_pdf ?? null,
  }
}

/**
 * The organization's recent invoices, newest first.
 *
 * A workspace with no Stripe customer has no invoices by definition, and that is
 * an empty list rather than an error — the billing screen renders a designed
 * empty state for it.
 */
export async function listRecentInvoices(
  runtime: BillingRuntime,
  organizationId: string,
): Promise<ReadonlyArray<InvoiceSummary>> {
  const record = await runtime.subscriptions.findByOrganization(organizationId)
  if (record?.stripeCustomerId == null) return []

  const page = await runtime.stripe.invoices.list({
    customer: record.stripeCustomerId,
    limit: INVOICE_HISTORY_LIMIT,
  })

  return page.data.map(invoiceSummaryOf)
}
