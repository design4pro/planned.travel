/**
 * Buying, changing and managing a subscription against Polar.
 *
 * Four rules govern everything in this file:
 *
 * 1. **The client never names a product.** It sends a plan id, an interval and a
 *    seat count; the Polar product UUID is resolved from `src/lib/plans.ts` and the
 *    seats are clamped into the plan's own range. A tampered request can only ever
 *    ask for a plan that exists in the catalogue, at the price we publish.
 * 2. **The organization is the customer.** `external_customer_id` on the checkout is
 *    the organization id, so Polar creates or reuses one customer per workspace with
 *    no pre-flight call of ours, and every object it sends back carries the id home.
 * 3. **Polar owns the hard parts.** It is Merchant of Record: it determines, collects
 *    and remits sales tax, and it owns proration arithmetic — we only choose *when*
 *    the difference is billed.
 * 4. **A third party's JSON is untrusted input.** Every response is parsed with the
 *    schemas in `mapping.ts` before a field is believed.
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
import { invalidateEntitlements } from './entitlements'
import {
  organizationIdFromOrder,
  pendingChangeFromPolar,
  polarCheckoutSchema,
  polarCustomerSessionSchema,
  polarOrderInvoiceSchema,
  polarOrderListSchema,
  polarOrderSchema,
  polarSubscriptionSchema,
  subscriptionRecordFromPolar,
} from './mapping'
import { PolarApiError } from './polar'
import { BillingForbiddenError, canManageBilling } from './types'

import type { BillingInterval, Plan, PlanId, PlanPrice } from '#/lib/plans'
import type { PolarOrder, PolarOrderStatus, PolarSubscription } from './mapping'
import type {
  BillingIdentity,
  BillingRuntime,
  PendingPlanChange,
  ProviderBillingMetadata,
  SubscriptionRecord,
} from './types'

/* ------------------------------------------------------------------ endpoints */

/**
 * Polar answers a collection path without its trailing slash with a 307, which
 * costs a Workers subrequest and can drop the `Authorization` header on the hop.
 * The slash is part of the constant so no call site can forget it.
 */
export const CHECKOUT_PATH = '/v1/checkouts/'
export const CUSTOMER_SESSION_PATH = '/v1/customer-sessions/'
export const ORDERS_PATH = '/v1/orders/'
export const SUBSCRIPTIONS_PATH = '/v1/subscriptions/'

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
  /** Requested seats. Clamped into the plan's range before it reaches Polar. */
  seats: z.number().int().min(1).max(1000).optional(),
})
export type PlanSelectionInput = z.infer<typeof planSelectionInput>

/**
 * The customer portal takes no arguments.
 *
 * The provider before Polar accepted a `flow_data.type` that deep-linked the hosted
 * portal at a card update or a cancellation, which is where the three-member
 * `PORTAL_INTENTS` enum came from. Polar's customer portal has no such parameter and
 * no per-intent endpoint: `POST /v1/customer-sessions/` mints one short-lived token
 * for the portal home and that is the entire surface. Rather than keep three names
 * that all produce the same URL, the enum is gone — but the schema stays, because it
 * is still the boundary that rejects a non-object payload on the server function.
 */
export const portalInput = z.object({})
export type PortalInput = z.infer<typeof portalInput>

/** Reading an order's PDF is an explicit, per-row action. */
export const orderInvoiceInput = z.object({ orderId: z.uuid() })
export type OrderInvoiceInput = z.infer<typeof orderInvoiceInput>

/** What every purchase path hands back: a URL to send the browser to. */
export interface BillingRedirect {
  readonly url: string
  /**
   * Which surface the customer is going to, for analytics and copy.
   *
   * `applied` is a change we completed server-side and `unchanged` is a request that
   * matched the subscription already in force, so nothing was patched and nothing was
   * billed. Both land on our own billing screen; only `applied` carries the
   * `?plan=changed` marker that raises the "Plan updated" alert, because telling a
   * customer their plan changed when we sent no request at all is the same class of
   * untruth as telling them we invoiced a difference we deferred.
   */
  readonly surface: 'checkout' | 'portal' | 'applied' | 'unchanged'
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
 * `requirePrice` throws when a deployment has not configured the Polar product id
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
 * Polar interpolates `checkout_id={CHECKOUT_ID}` into the success URL, which lets
 * the billing screen tell "just subscribed" apart from an ordinary visit before the
 * webhook has necessarily landed.
 */
export function checkoutSuccessUrl(appUrl: string): string {
  return `${appUrl}/settings/billing?checkout=complete&checkout_id={CHECKOUT_ID}`
}

/**
 * Where the checkout's back button goes.
 *
 * Not a cancellation callback — Polar never calls one — so a customer who walks away
 * without pressing it simply leaves the checkout open until it expires.
 */
export function checkoutReturnUrl(appUrl: string): string {
  return `${appUrl}/settings/billing?checkout=cancelled`
}

export function portalReturnUrl(appUrl: string): string {
  return `${appUrl}/settings/billing?portal=complete`
}

/** Where a change we applied ourselves sends the browser. */
export function planChangedUrl(appUrl: string): string {
  return `${appUrl}/settings/billing?plan=changed`
}

/**
 * The billing screen with nothing to announce — where a request that matched the
 * live subscription sends the browser. Deliberately the bare path: the screen keys
 * every alert off a search parameter, so the absence of one *is* the absence of a
 * claim.
 */
export function billingHomeUrl(appUrl: string): string {
  return `${appUrl}/settings/billing`
}

/* -------------------------------------------------------------- idempotency */

/** Buckets an idempotency key by the minute it was requested in. */
const IDEMPOTENCY_WINDOW_MS = 60_000

/** KV is the only thing that can collapse a double click: Polar has no such header. */
export const CHECKOUT_REUSE_TTL_SECONDS = 60

/**
 * A double-clicked upgrade button must not create two checkouts, but a customer who
 * abandons one and comes back an hour later must get a fresh session. Bucketing by
 * the minute gives both: identical requests inside the same window collapse onto the
 * cached URL, later ones do not.
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

export function checkoutCacheKey(idempotencyKey: string): string {
  return `billing:checkout:v1:${idempotencyKey}`
}

/* ----------------------------------------------------------------- metadata */

export function billingMetadata(
  organizationId: string,
  selection: PlanSelection,
): ProviderBillingMetadata {
  return {
    organizationId,
    planId: selection.plan.id,
    interval: selection.interval,
    // Polar metadata is typed, so the seat count travels as an integer and needs
    // no parsing on the way back.
    seats: selection.seats,
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
 * still entitled to the plan's free trial. Polar would grant a second one on every
 * checkout against a product that has a trial configured; we do not.
 */
export function isEligibleForTrial(record: SubscriptionRecord | null): boolean {
  if (record === null) return true
  return record.providerSubscriptionId === null && record.trialEndsAt === null
}

/* ----------------------------------------------------------------- checkout */

export interface CheckoutParamsInput {
  readonly appUrl: string
  readonly organizationId: string
  readonly customerEmail: string
  readonly customerName: string
  readonly selection: PlanSelection
  readonly trialDays: number
}

/** The body of `POST /v1/checkouts/`, as Polar's `CheckoutProductsCreate` defines it. */
export interface PolarCheckoutCreate {
  /** Product UUIDs; the first is preselected. Always exactly the one we priced. */
  readonly products: ReadonlyArray<string>
  readonly external_customer_id: string
  readonly customer_email: string
  readonly customer_name: string
  readonly currency: PlanPrice['currency']
  readonly metadata: ProviderBillingMetadata
  readonly success_url: string
  readonly return_url: string
  readonly allow_discount_codes: boolean
  readonly require_billing_address: boolean
  readonly allow_trial: boolean
  readonly trial_interval?: 'day'
  readonly trial_interval_count?: number
  /** Seat-based pricing only. Absent, not null, on a flat plan. */
  readonly seats?: number
  readonly min_seats?: number
  readonly max_seats?: number
}

/**
 * The checkout we ask Polar for.
 *
 * Split out from the network call so every decision in it — the trial, the seat
 * range, the metadata the webhook reads back — is asserted in tests rather than in
 * production.
 *
 * Six parameters the previous provider took have no Polar counterpart and are gone
 * on purpose, not by oversight: `automatic_tax`, `tax_id_collection`,
 * `customer_update`, `payment_method_collection` and `cancel_url` — Polar is
 * Merchant of Record, so it determines and collects tax, gathers the customer's
 * billing details itself, decides when a payment method is needed, and never calls
 * back on an abandoned checkout — and `mode`, because Polar infers subscription
 * versus one-off from the product. `client_reference_id` and `subscription_data`
 * are folded into `external_customer_id` and `metadata`, which is where Polar keeps
 * both. `allow_promotion_codes` and `billing_address_collection` survive under
 * Polar's names below.
 */
export function buildCheckoutParams(
  input: CheckoutParamsInput,
): PolarCheckoutCreate {
  const { selection } = input
  const seatRange = selection.plan.seatRange

  const base = {
    products: [selection.price.productId],
    external_customer_id: input.organizationId,
    customer_email: input.customerEmail,
    customer_name: input.customerName,
    // Pinned to the catalogue rather than to the buyer's locale: the amount we
    // publish on the pricing page is the amount we charge.
    currency: selection.price.currency,
    metadata: billingMetadata(input.organizationId, selection),
    success_url: checkoutSuccessUrl(input.appUrl),
    return_url: checkoutReturnUrl(input.appUrl),
    // was `allow_promotion_codes`
    allow_discount_codes: true,
    // was `billing_address_collection: 'auto'`. False still collects a country,
    // which is all Polar needs to determine tax for an individual; forcing a full
    // address on everyone would add friction Polar itself does not ask for.
    require_billing_address: false,
  } satisfies Omit<PolarCheckoutCreate, 'allow_trial'>

  // Polar defaults `allow_trial` to true whenever the product has a trial
  // configured, so a returning workspace must be told "no" explicitly.
  const trial =
    input.trialDays > 0
      ? {
          allow_trial: true,
          trial_interval: 'day' as const,
          trial_interval_count: input.trialDays,
        }
      : { allow_trial: false }

  // A flat plan carries none of the three seat keys: Polar documents them as
  // working with seat-based pricing only, and a Crew checkout that omitted them
  // would bill ten people as one.
  const seats = selection.plan.seatBased
    ? {
        seats: selection.seats,
        min_seats: seatRange.min,
        max_seats: seatRange.max ?? seatRange.min,
      }
    : {}

  return { ...base, ...trial, ...seats }
}

/** Start a brand-new subscription in Polar Checkout. */
export async function createCheckoutSession(
  runtime: BillingRuntime,
  identity: BillingIdentity,
  input: PlanSelectionInput,
): Promise<BillingRedirect> {
  assertCanManage(identity)

  const selection = resolvePlanSelection(input)
  const existing = await runtime.subscriptions.findByOrganization(
    identity.organizationId,
  )
  const trialDays = isEligibleForTrial(existing) ? selection.plan.trialDays : 0

  const cacheKey = checkoutCacheKey(
    checkoutIdempotencyKey(identity.organizationId, selection, runtime.now()),
  )
  const reusable = await runtime.cache.get(cacheKey)
  if (reusable !== null) {
    return { url: reusable, surface: 'checkout' }
  }

  const checkout = polarCheckoutSchema.parse(
    await runtime.polar.request({
      method: 'POST',
      path: CHECKOUT_PATH,
      body: buildCheckoutParams({
        appUrl: runtime.appUrl,
        organizationId: identity.organizationId,
        customerEmail: identity.userEmail,
        customerName: identity.organizationName,
        selection,
        trialDays,
      }),
    }),
  )

  await runtime.cache.put(cacheKey, checkout.url, {
    expirationTtl: CHECKOUT_REUSE_TTL_SECONDS,
  })

  runtime.logger.info('billing.checkout.created', {
    organizationId: identity.organizationId,
    planId: selection.plan.id,
    interval: selection.interval,
    seats: selection.seats,
    trialDays,
    checkoutId: checkout.id,
  })

  return { url: checkout.url, surface: 'checkout' }
}

/* ------------------------------------------------------------------- portal */

/**
 * Send the customer into the hosted customer portal — invoices, payment methods,
 * billing details, cancellation.
 *
 * The session is minted against `external_customer_id`, so the organization id is
 * the only identifier that leaves this process. Polar's tokens are short-lived by
 * design: a fresh one is minted on every click and none is ever stored.
 */
export async function createPortalSession(
  runtime: BillingRuntime,
  identity: BillingIdentity,
  input: PortalInput = {},
): Promise<BillingRedirect> {
  assertCanManage(identity)
  portalInput.parse(input)

  const record = await runtime.subscriptions.findByOrganization(
    identity.organizationId,
  )

  if (record?.providerCustomerId == null) {
    throw new Error(
      'This workspace has no billing profile yet. Choose a plan to set one up first.',
    )
  }

  const session = polarCustomerSessionSchema.parse(
    await runtime.polar.request({
      method: 'POST',
      path: CUSTOMER_SESSION_PATH,
      body: {
        external_customer_id: identity.organizationId,
        return_url: portalReturnUrl(runtime.appUrl),
      },
    }),
  )

  runtime.logger.info('billing.portal.created', {
    organizationId: identity.organizationId,
  })

  return { url: session.customer_portal_url, surface: 'portal' }
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
  if (record.providerSubscriptionId === null) return null
  return isEntitlingStatus(record.status) ? record.providerSubscriptionId : null
}

const PRORATION_BEHAVIORS = [
  'invoice',
  'prorate',
  'next_period',
  'reset',
] as const
export type ProrationBehavior = (typeof PRORATION_BEHAVIORS)[number]

/** What a plan costs over a year at a given seat count, in minor units. */
export function annualisedAmount(
  planId: PlanId,
  interval: BillingInterval | null,
  seats: number,
): number {
  if (interval === null) return 0
  const price = planById(planId).prices[interval]
  if (price === null) return 0
  const units = price.perSeat ? seats : 1
  return (interval === 'monthly' ? price.amount * 12 : price.amount) * units
}

/**
 * When the price difference is billed.
 *
 * An upgrade is invoiced immediately, because the customer asked for more and gets
 * it immediately. A downgrade is scheduled for the next period: the customer keeps
 * what they have already paid for to the end of the period, and we issue no credit.
 * A move that costs the same either way is folded into the next invoice.
 */
export function prorationFor(
  current: SubscriptionRecord | null,
  next: PlanSelection,
): ProrationBehavior {
  const before =
    current === null
      ? 0
      : annualisedAmount(current.planId, current.interval, current.seats)
  const after = annualisedAmount(next.plan.id, next.interval, next.seats)

  if (after > before) return 'invoice'
  if (after < before) return 'next_period'
  return 'prorate'
}

/** One `PATCH /v1/subscriptions/{id}`. */
async function patchSubscription(
  runtime: BillingRuntime,
  path: string,
  body: unknown,
): Promise<PolarSubscription> {
  const raw = await runtime.polar.request({ method: 'PATCH', path, body })
  return polarSubscriptionSchema.parse(raw)
}

/**
 * What Polar has scheduled but not applied, after a change we just made.
 *
 * Polar's own answer comes first: `pending_update` names the product and the instant,
 * and it is the only source that stays right when the API disagrees with our local
 * arithmetic. It is read straight off the parsed subscription, because
 * `polarSubscriptionSchema` now names the field: the raw response is not parsed a
 * second time here, or anywhere.
 *
 * The `next_period` branch below is the fallback for a response that carries no
 * usable `pending_update` — a deferred change is, by definition, the one the customer
 * just asked for, landing when the period they have paid for ends. An immediate change
 * schedules nothing and returns `null`, which is also what supersedes a pending change
 * already on the subscription.
 */
export function pendingChangeFor(
  applied: PolarSubscription,
  proration: ProrationBehavior,
  selection: PlanSelection,
  current: SubscriptionRecord,
): PendingPlanChange | null {
  const scheduled = pendingChangeFromPolar(applied.pending_update)
  if (scheduled !== null) return scheduled

  if (proration !== 'next_period') return null
  if (current.currentPeriodEnd === null) return null

  return {
    planId: selection.plan.id,
    interval: selection.interval,
    effectiveAt: current.currentPeriodEnd,
  }
}

/**
 * Persist what Polar just told us the subscription is.
 *
 * The response is authoritative and a locally reconstructed row is a guess, so the
 * write goes through the same mapper the webhook uses — which stamps
 * `ceilingsForPlan()` and therefore leaves a row that agrees with its own plan. On a
 * deferred change that response still names the *old* product, which is correct:
 * nothing has moved yet, and only `pendingChange` describes what will.
 *
 * A failed write is a real failure and propagates. The webhook stays the reconciler.
 */
async function persistChangedSubscription(
  runtime: BillingRuntime,
  organizationId: string,
  applied: PolarSubscription,
  pendingChange: PendingPlanChange | null,
): Promise<void> {
  const mapped = subscriptionRecordFromPolar(applied, {
    fallbackOrganizationId: organizationId,
  })

  if (mapped === null) {
    // Only reachable if Polar answered with a product this deployment does not
    // sell, which it cannot do for a product we just named. Loud, and not fatal:
    // the eviction below still runs and the webhook still reconciles.
    runtime.logger.warn('billing.plan_change.unmapped', {
      organizationId,
      subscriptionId: applied.id,
      productId: applied.product_id,
    })
    return
  }

  await runtime.subscriptions.upsert({ ...mapped, pendingChange })
}

/**
 * Drop the cached plan state, and never let failing to do so fail the change.
 *
 * By the time this runs Polar has taken the customer's money. An exception escaping
 * here would surface on the billing screen as "that change was not applied" for a
 * change that was, which is a worse outcome than one stale minute — the entry
 * carries a 60 s TTL and the webhook invalidates again behind us.
 */
async function evictPlanState(
  runtime: BillingRuntime,
  organizationId: string,
): Promise<void> {
  try {
    await invalidateEntitlements(runtime, organizationId)
  } catch (cause) {
    runtime.logger.error('billing.plan_change.eviction_failed', {
      organizationId,
      reason: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

/**
 * Move an existing subscription onto another plan, interval or seat count.
 *
 * Polar has no hosted "confirm the prorated amount" flow, so the change is applied
 * with `PATCH /v1/subscriptions/{id}` and we choose the proration behaviour rather
 * than the arithmetic. Product and seats are separate variants of Polar's
 * `SubscriptionUpdate` union — a body carrying both matches the seats variant and
 * drops the product — so a plan change that also resizes the crew is two calls, the
 * product first, and only the second response describes both moves.
 *
 * This is the one purchase path that mutates entitlement state inside our own
 * request rather than leaving it to the webhook, so it owes the full write shape
 * ARCHITECTURE §2.2 sets out: write D1 from the provider's answer, *then* invalidate
 * the key that answer makes stale. Evicting without writing is inert — the next read
 * misses, re-reads the same unchanged row and re-caches it for another TTL — and it
 * is the ceilings that make it expensive: `effectiveLimitsFor()` derives them from
 * that row, so a Solo→Crew upgrade Polar has already billed would leave
 * `assertWithinLimit` refusing the seats the customer is paying for.
 *
 * The eviction sits in a `finally` so a change that failed half way through cannot
 * leave a stale entry behind, and it swallows its own failure so a KV problem can
 * never be reported as a billing problem.
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

  if (subscriptionId === null || record === null) {
    return await createCheckoutSession(runtime, identity, input)
  }

  const proration = prorationFor(record, selection)
  const path = `${SUBSCRIPTIONS_PATH}${subscriptionId}`
  const productChanged = record.providerProductId !== selection.price.productId
  const seatsChanged =
    selection.plan.seatBased && record.seats !== selection.seats

  if (!productChanged && !seatsChanged) {
    // The selection already describes the live subscription, so no request was made,
    // no money moved and there is nothing to invalidate. Saying "applied" here is what
    // let `?plan=changed` raise "Plan updated" over a change that never happened.
    runtime.logger.info('billing.plan_change.unchanged', {
      organizationId: identity.organizationId,
      planId: record.planId,
      interval: selection.interval,
      seats: selection.seats,
    })
    return { url: billingHomeUrl(runtime.appUrl), surface: 'unchanged' }
  }

  let pendingChange: PendingPlanChange | null = null

  try {
    let applied: PolarSubscription | null = null

    if (productChanged) {
      applied = await patchSubscription(runtime, path, {
        product_id: selection.price.productId,
        proration_behavior: proration,
      })
    }

    if (seatsChanged) {
      applied = await patchSubscription(runtime, path, {
        seats: selection.seats,
        proration_behavior: proration,
      })
    }

    if (applied !== null) {
      pendingChange = pendingChangeFor(applied, proration, selection, record)
      await persistChangedSubscription(
        runtime,
        identity.organizationId,
        applied,
        pendingChange,
      )
    }
  } finally {
    await evictPlanState(runtime, identity.organizationId)
  }

  runtime.logger.info('billing.plan_change.applied', {
    organizationId: identity.organizationId,
    from: record.planId,
    to: selection.plan.id,
    interval: selection.interval,
    seats: selection.seats,
    proration,
    scheduled: pendingChange !== null,
  })

  return { url: planChangedUrl(runtime.appUrl), surface: 'applied' }
}

/* ------------------------------------------------------------------- orders */

/**
 * One row of the billing history table. Every value is wire-safe.
 *
 * A Polar order carries no billing-period boundaries and no hosted invoice page, so
 * the columns that used to show them are gone rather than rendered as two dashes and
 * a dead link. The PDF is not here either: Polar generates it on demand, and doing
 * that eagerly would mean two extra API calls per row on every page load.
 */
export interface InvoiceSummary {
  readonly id: string
  /** Polar's human invoice number, or the order id when one was never assigned. */
  readonly number: string
  readonly status: PolarOrderStatus
  readonly createdAt: string
  readonly total: number
  readonly currency: string
  /** True once Polar has produced the PDF; false means it is generated on request. */
  readonly invoiceGenerated: boolean
}

export const INVOICE_HISTORY_LIMIT = 12

export function invoiceSummaryOf(order: PolarOrder): InvoiceSummary {
  return {
    id: order.id,
    number: order.invoice_number ?? order.id,
    status: order.status,
    createdAt: new Date(order.created_at).toISOString(),
    total: order.total_amount,
    currency: order.currency.toUpperCase(),
    invoiceGenerated: order.is_invoice_generated,
  }
}

/**
 * The organization's recent orders, newest first.
 *
 * A workspace with no Polar customer has no orders by definition, and that is an
 * empty list rather than an error — the billing screen renders a designed empty
 * state for it.
 */
export async function listRecentInvoices(
  runtime: BillingRuntime,
  organizationId: string,
): Promise<ReadonlyArray<InvoiceSummary>> {
  const record = await runtime.subscriptions.findByOrganization(organizationId)
  if (record?.providerCustomerId == null) return []

  const page = polarOrderListSchema.parse(
    await runtime.polar.request({
      method: 'GET',
      path: ORDERS_PATH,
      query: {
        external_customer_id: organizationId,
        limit: INVOICE_HISTORY_LIMIT,
        sorting: '-created_at',
      },
    }),
  )

  return page.items.map(invoiceSummaryOf)
}

/**
 * How long we are willing to hold the request path open while Polar renders a PDF,
 * and how that wait is spread.
 *
 * `POST /v1/orders/{id}/invoice` answers 202 and renders asynchronously, so a `GET`
 * issued straight after it 404s every time — which is exactly what the first
 * download of any invoice used to do. Four reads spread over about a second and a
 * half cover the generation Polar finishes quickly, which is nearly all of them,
 * without turning one click into a hung tab when it does not.
 */
export const INVOICE_POLL_DELAYS_MS: ReadonlyArray<number> = [150, 400, 900]

/** What we ask the browser to wait before trying a pending invoice again. */
export const INVOICE_RETRY_AFTER_MS = 4_000

/**
 * The outcome of asking for one order's PDF.
 *
 * Discriminated rather than `string | null`, because "not written yet" is a state
 * the billing screen renders rather than a failure: the document is on its way and
 * the same click succeeds a moment later. Every other Polar failure still throws.
 */
export type OrderInvoiceResult =
  | { readonly state: 'ready'; readonly url: string }
  | { readonly state: 'pending'; readonly retryAfterMs: number }

export interface OrderInvoiceOptions {
  /** Injected in tests so the backoff can be asserted without waiting it out. */
  readonly sleep?: (ms: number) => Promise<void>
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * One read of the rendered document. `null` means Polar has not written it yet.
 *
 * Only a 404, and only from this endpoint, is read that way: a 403, a 429 or a 500
 * propagates, because reporting "still generating" over an outage would hide it
 * from the customer and from the logs at the same time.
 */
async function readInvoiceUrl(
  runtime: BillingRuntime,
  orderId: string,
): Promise<string | null> {
  try {
    const invoice = polarOrderInvoiceSchema.parse(
      await runtime.polar.request({
        method: 'GET',
        path: `${ORDERS_PATH}${orderId}/invoice`,
      }),
    )
    return invoice.url
  } catch (error) {
    if (error instanceof PolarApiError && error.status === 404) return null
    throw error
  }
}

/**
 * The PDF for one order, fetched only when a customer asks for it.
 *
 * The first thing that happens is the one that matters: the order is read back and
 * checked against the organization asking for it, because the order id arrived from
 * a browser. Polar is then asked to render the document if it has not already, and
 * the URL is polled on a bounded backoff — the render is asynchronous, so the read
 * that follows a fresh 202 legitimately answers 404 and is retried rather than
 * believed. When the budget runs out the caller gets `pending`, never a thrown 404
 * and never a wait without an end.
 */
export async function orderInvoiceUrl(
  runtime: BillingRuntime,
  organizationId: string,
  input: OrderInvoiceInput,
  options: OrderInvoiceOptions = {},
): Promise<OrderInvoiceResult> {
  const { orderId } = orderInvoiceInput.parse(input)
  const sleep = options.sleep ?? defaultSleep

  const order = polarOrderSchema.parse(
    await runtime.polar.request({
      method: 'GET',
      path: `${ORDERS_PATH}${orderId}`,
    }),
  )

  if (organizationIdFromOrder(order) !== organizationId) {
    throw new BillingForbiddenError('That invoice belongs to another workspace.')
  }

  if (!order.is_invoice_generated) {
    await runtime.polar.request({
      method: 'POST',
      path: `${ORDERS_PATH}${orderId}/invoice`,
    })
  }

  for (const delay of INVOICE_POLL_DELAYS_MS) {
    const url = await readInvoiceUrl(runtime, orderId)
    if (url !== null) return { state: 'ready', url }
    await sleep(delay)
  }

  // One last look after the final wait, so the budget is spent on reading rather
  // than on sleeping.
  const settled = await readInvoiceUrl(runtime, orderId)
  if (settled !== null) return { state: 'ready', url: settled }

  runtime.logger.warn('billing.invoice.still_generating', {
    organizationId,
    orderId,
    attempts: INVOICE_POLL_DELAYS_MS.length + 1,
  })

  return { state: 'pending', retryAfterMs: INVOICE_RETRY_AFTER_MS }
}
