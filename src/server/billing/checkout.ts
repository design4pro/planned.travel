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
  polarCheckoutSchema,
  polarCustomerSessionSchema,
  polarOrderInvoiceSchema,
  polarOrderListSchema,
  polarOrderSchema,
  polarSubscriptionSchema,
} from './mapping'
import { PolarApiError } from './polar'
import { BillingForbiddenError, canManageBilling } from './types'

import type { BillingInterval, Plan, PlanId, PlanPrice } from '#/lib/plans'
import type { PolarOrder, PolarOrderStatus } from './mapping'
import type {
  BillingIdentity,
  BillingRuntime,
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
   * Which surface the customer is going to, for analytics and copy. `applied` is
   * a change we completed server-side — the URL is our own billing screen.
   */
  readonly surface: 'checkout' | 'portal' | 'applied'
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

/**
 * Move an existing subscription onto another plan, interval or seat count.
 *
 * Polar has no hosted "confirm the prorated amount" flow, so the change is applied
 * with `PATCH /v1/subscriptions/{id}` and we choose the proration behaviour rather
 * than the arithmetic. Product and seats are separate variants of Polar's
 * `SubscriptionUpdate` union — a body carrying both matches the seats variant and
 * drops the product — so a plan change that also resizes the crew is two calls, the
 * product first.
 *
 * This is the one purchase path that mutates entitlement state inside our own
 * request rather than leaving it to the webhook, so it is also the one that owes
 * the cache invalidation ARCHITECTURE §4 rule 2 requires: the redirect below lands
 * on our billing screen, and a cached plan state left in place would let that
 * screen render the plan the customer just moved off for the rest of the TTL.
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

  if (productChanged) {
    polarSubscriptionSchema.parse(
      await runtime.polar.request({
        method: 'PATCH',
        path,
        body: {
          product_id: selection.price.productId,
          proration_behavior: proration,
        },
      }),
    )
  }

  if (seatsChanged) {
    polarSubscriptionSchema.parse(
      await runtime.polar.request({
        method: 'PATCH',
        path,
        body: { seats: selection.seats, proration_behavior: proration },
      }),
    )
  }

  const changed = productChanged || seatsChanged

  // Drop the cached plan state before returning, not after: the browser follows the
  // URL below immediately, and KV would otherwise keep answering with the plan we
  // just left until the TTL lapses or the webhook lands, whichever came first.
  if (changed) {
    await invalidateEntitlements(runtime, identity.organizationId)
  }

  runtime.logger.info('billing.plan_change.applied', {
    organizationId: identity.organizationId,
    from: record.planId,
    to: selection.plan.id,
    interval: selection.interval,
    seats: selection.seats,
    proration,
    changed,
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
