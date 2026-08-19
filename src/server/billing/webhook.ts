/**
 * Stripe webhook processing.
 *
 * Three properties this module guarantees, in order of importance:
 *
 * 1. **Authenticity.** Every payload is verified against the endpoint signing secret
 *    with `constructEventAsync`, because signature checks run on WebCrypto here and
 *    WebCrypto is asynchronous. An unverified payload never reaches a handler.
 * 2. **Idempotency.** Stripe retries, and retries can overlap. Each event id is
 *    claimed in KV before work starts and confirmed afterwards, so a redelivery is a
 *    no-op. A failed handler releases its claim so the retry can do the work.
 * 3. **Speed.** Only the D1 write happens inline. Receipts, dunning mail and anything
 *    else slow is handed to the `TASKS` queue so Stripe gets its 200 immediately.
 */

import type Stripe from 'stripe'
import { planById  } from '#/lib/plans'
import type {PlanId} from '#/lib/plans';
import { invalidateEntitlements } from './entitlements'
import {
  cancelledRecord,
  subscriptionIdFromInvoice,
  subscriptionRecordFromStripe,
} from './mapping'
import {
  fromStripeTimestamp,
  organizationIdFromMetadata,
  stripeIdOf,
  stripeWebhookCryptoProvider,
  WEBHOOK_TOLERANCE_SECONDS,
} from './stripe'
import {
  WebhookVerificationError
  
  
  
} from './types'
import type {BillingRuntime, BillingTask, SubscriptionRecord} from './types';

/** Stripe stops retrying after roughly three days, so remember ids for a little longer. */
export const WEBHOOK_EVENT_TTL_SECONDS = 72 * 60 * 60

/**
 * How long a claim survives if the isolate dies mid-handler. Long enough that an
 * overlapping retry does not duplicate work, short enough that a crash self-heals.
 */
export const WEBHOOK_CLAIM_TTL_SECONDS = 120

const EVENT_CACHE_VERSION = 'v1'

export function webhookEventCacheKey(eventId: string): string {
  return `billing:stripe-event:${EVENT_CACHE_VERSION}:${eventId}`
}

/** The events this endpoint acts on. Anything else is acknowledged and ignored. */
export const HANDLED_STRIPE_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const

export type HandledStripeEvent = (typeof HANDLED_STRIPE_EVENTS)[number]

export type WebhookResult = 'processed' | 'duplicate' | 'ignored'

export interface StripeWebhookOutcome {
  readonly eventId: string
  readonly type: string
  readonly result: WebhookResult
  readonly organizationId: string | null
}

/* ------------------------------------------------------------------ verification */

/**
 * Verify and parse an inbound request. Throws `WebhookVerificationError` for anything
 * that is not a genuine, in-tolerance Stripe payload.
 */
export async function verifyStripeEvent(
  runtime: BillingRuntime,
  request: Request,
): Promise<Stripe.Event> {
  if (runtime.webhookSecret === '') {
    throw new WebhookVerificationError('STRIPE_WEBHOOK_SECRET is not configured.')
  }

  const signature = request.headers.get('stripe-signature')
  if (signature === null || signature === '') {
    throw new WebhookVerificationError('Missing stripe-signature header.')
  }

  const payload = await request.text()

  try {
    return await runtime.stripe.webhooks.constructEventAsync(
      payload,
      signature,
      runtime.webhookSecret,
      WEBHOOK_TOLERANCE_SECONDS,
      stripeWebhookCryptoProvider(),
    )
  } catch (cause) {
    throw new WebhookVerificationError(
      cause instanceof Error ? cause.message : 'Signature verification failed.',
    )
  }
}

/* --------------------------------------------------------------------- endpoint */

/**
 * The whole endpoint: verify, de-duplicate, handle, answer.
 *
 * Returns 400 for an unverifiable payload (Stripe must not retry those), 200 for
 * anything we have accepted or already seen, and 500 only when a handler failed and a
 * retry could still succeed.
 */
export async function handleStripeWebhook(
  runtime: BillingRuntime,
  request: Request,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, { allow: 'POST' })
  }

  let event: Stripe.Event
  try {
    event = await verifyStripeEvent(runtime, request)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Invalid webhook.'
    runtime.logger.warn('billing.webhook.rejected', { reason: message })
    return json({ error: 'Invalid signature.' }, 400)
  }

  try {
    const outcome = await processStripeEvent(runtime, event)
    runtime.logger.info('billing.webhook.handled', {
      eventId: outcome.eventId,
      type: outcome.type,
      result: outcome.result,
      organizationId: outcome.organizationId,
    })
    return json({ received: true, result: outcome.result }, 200)
  } catch (cause) {
    runtime.logger.error('billing.webhook.failed', {
      eventId: event.id,
      type: event.type,
      message: cause instanceof Error ? cause.message : String(cause),
    })
    return json({ error: 'Webhook handling failed.' }, 500)
  }
}

function json(
  body: Readonly<Record<string, unknown>>,
  status: number,
  extraHeaders: Readonly<Record<string, string>> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  })
}

/* ------------------------------------------------------------------- dispatching */

/**
 * Claim the event id, dispatch it, then confirm the claim.
 *
 * A duplicate delivery short-circuits on the claim. A handler that throws releases the
 * claim first, so the retry Stripe sends is free to try again.
 */
export async function processStripeEvent(
  runtime: BillingRuntime,
  event: Stripe.Event,
): Promise<StripeWebhookOutcome> {
  const key = webhookEventCacheKey(event.id)

  if ((await runtime.cache.get(key)) !== null) {
    return { eventId: event.id, type: event.type, result: 'duplicate', organizationId: null }
  }

  await runtime.cache.put(key, 'claimed', { expirationTtl: WEBHOOK_CLAIM_TTL_SECONDS })

  try {
    const outcome = await dispatch(runtime, event)
    await runtime.cache.put(key, 'handled', { expirationTtl: WEBHOOK_EVENT_TTL_SECONDS })
    return outcome
  } catch (cause) {
    await runtime.cache.delete(key)
    throw cause
  }
}

async function dispatch(
  runtime: BillingRuntime,
  event: Stripe.Event,
): Promise<StripeWebhookOutcome> {
  switch (event.type) {
    case 'checkout.session.completed':
      return await onCheckoutCompleted(runtime, event.id, event.data.object)
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      return await onSubscriptionUpserted(runtime, event.id, event.type, event.data.object)
    case 'customer.subscription.deleted':
      return await onSubscriptionDeleted(runtime, event.id, event.data.object)
    case 'invoice.paid':
      return await onInvoicePaid(runtime, event.id, event.data.object)
    case 'invoice.payment_failed':
      return await onInvoicePaymentFailed(runtime, event.id, event.data.object)
    default:
      return { eventId: event.id, type: event.type, result: 'ignored', organizationId: null }
  }
}

/* ----------------------------------------------------------------- event handlers */

async function onCheckoutCompleted(
  runtime: BillingRuntime,
  eventId: string,
  session: Stripe.Checkout.Session,
): Promise<StripeWebhookOutcome> {
  const type = 'checkout.session.completed'
  const organizationId =
    organizationIdFromMetadata(session.metadata) ?? session.client_reference_id ?? null
  const customerId = stripeIdOf(session.customer)

  if (organizationId === null || session.mode !== 'subscription') {
    return { eventId, type, result: 'ignored', organizationId }
  }

  if (customerId !== null) {
    await runtime.subscriptions.attachCustomer(organizationId, customerId)
  }

  const subscriptionId = stripeIdOf(session.subscription)
  if (subscriptionId === null) {
    await invalidateEntitlements(runtime, organizationId)
    return { eventId, type, result: 'processed', organizationId }
  }

  // Sync immediately rather than waiting for `customer.subscription.created`, so the
  // billing screen is already correct when Stripe redirects the customer back.
  const subscription = await runtime.stripe.subscriptions.retrieve(subscriptionId)
  const record = subscriptionRecordFromStripe(subscription, {
    fallbackOrganizationId: organizationId,
  })

  if (record === null) {
    return { eventId, type, result: 'ignored', organizationId }
  }

  await persist(runtime, eventId, record)
  return { eventId, type, result: 'processed', organizationId }
}

async function onSubscriptionUpserted(
  runtime: BillingRuntime,
  eventId: string,
  type: string,
  subscription: Stripe.Subscription,
): Promise<StripeWebhookOutcome> {
  const fallback = await organizationForSubscription(runtime, subscription)
  const record = subscriptionRecordFromStripe(subscription, {
    fallbackOrganizationId: fallback,
  })

  if (record === null) {
    return { eventId, type, result: 'ignored', organizationId: fallback }
  }

  await persist(runtime, eventId, record)
  return { eventId, type, result: 'processed', organizationId: record.organizationId }
}

async function onSubscriptionDeleted(
  runtime: BillingRuntime,
  eventId: string,
  subscription: Stripe.Subscription,
): Promise<StripeWebhookOutcome> {
  const type = 'customer.subscription.deleted'
  const organizationId = await organizationForSubscription(runtime, subscription)
  if (organizationId === null) {
    return { eventId, type, result: 'ignored', organizationId: null }
  }

  const previous = await runtime.subscriptions.findByOrganization(organizationId)
  const canceledAt = fromStripeTimestamp(subscription.canceled_at) ?? runtime.now()
  const record = cancelledRecord(
    previous,
    organizationId,
    stripeIdOf(subscription.customer),
    canceledAt,
  )

  await persist(runtime, eventId, record, previous?.planId)
  return { eventId, type, result: 'processed', organizationId }
}

async function onInvoicePaid(
  runtime: BillingRuntime,
  eventId: string,
  invoice: Stripe.Invoice,
): Promise<StripeWebhookOutcome> {
  const type = 'invoice.paid'
  const existing = await organizationForInvoice(runtime, invoice)
  if (existing === null) {
    return { eventId, type, result: 'ignored', organizationId: null }
  }

  // A successful payment ends dunning. Trials and healthy subscriptions are left alone
  // so we never contradict the status Stripe itself will send.
  if (existing.status === 'past_due' || existing.status === 'unpaid') {
    await runtime.subscriptions.updateStatus(
      existing.organizationId,
      'active',
      runtime.now(),
    )
    await invalidateEntitlements(runtime, existing.organizationId)
  }

  await enqueue(runtime, {
    kind: 'billing.invoice.paid',
    organizationId: existing.organizationId,
    stripeInvoiceId: invoice.id,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    stripeEventId: eventId,
  })

  return { eventId, type, result: 'processed', organizationId: existing.organizationId }
}

async function onInvoicePaymentFailed(
  runtime: BillingRuntime,
  eventId: string,
  invoice: Stripe.Invoice,
): Promise<StripeWebhookOutcome> {
  const type = 'invoice.payment_failed'
  const existing = await organizationForInvoice(runtime, invoice)
  if (existing === null) {
    return { eventId, type, result: 'ignored', organizationId: null }
  }

  if (existing.status === 'active' || existing.status === 'trialing') {
    await runtime.subscriptions.updateStatus(
      existing.organizationId,
      'past_due',
      runtime.now(),
    )
    await invalidateEntitlements(runtime, existing.organizationId)
  }

  await enqueue(runtime, {
    kind: 'billing.invoice.payment_failed',
    organizationId: existing.organizationId,
    stripeInvoiceId: invoice.id,
    attemptCount: invoice.attempt_count,
    nextAttemptAt: fromStripeTimestamp(invoice.next_payment_attempt)?.toISOString() ?? null,
    stripeEventId: eventId,
  })

  return { eventId, type, result: 'processed', organizationId: existing.organizationId }
}

/* ----------------------------------------------------------------------- helpers */

/**
 * Write the row, drop the entitlement cache, and hand the notification work off.
 * The cache invalidation is what makes a plan change visible on the next request.
 */
async function persist(
  runtime: BillingRuntime,
  eventId: string,
  record: SubscriptionRecord,
  previousPlanId?: PlanId,
): Promise<void> {
  const before =
    previousPlanId ??
    (await runtime.subscriptions.findByOrganization(record.organizationId))?.planId ??
    planById('free').id

  await runtime.subscriptions.upsert(record)
  await invalidateEntitlements(runtime, record.organizationId)

  await enqueue(runtime, {
    kind: 'billing.subscription.changed',
    organizationId: record.organizationId,
    planId: record.planId,
    previousPlanId: before,
    status: record.status,
    stripeEventId: eventId,
  })
}

/**
 * Queue delivery must never turn a successfully persisted change into a Stripe retry,
 * so a send failure is logged rather than thrown.
 */
async function enqueue(runtime: BillingRuntime, task: BillingTask): Promise<void> {
  try {
    await runtime.tasks.send(task)
  } catch (cause) {
    runtime.logger.error('billing.task.enqueue_failed', {
      kind: task.kind,
      organizationId: task.organizationId,
      message: cause instanceof Error ? cause.message : String(cause),
    })
  }
}

/** Metadata first, then our own customer index — never trust one source alone. */
async function organizationForSubscription(
  runtime: BillingRuntime,
  subscription: Stripe.Subscription,
): Promise<string | null> {
  const fromMetadata = organizationIdFromMetadata(subscription.metadata)
  if (fromMetadata !== null) return fromMetadata

  const bySubscription = await runtime.subscriptions.findByStripeSubscriptionId(
    subscription.id,
  )
  if (bySubscription !== null) return bySubscription.organizationId

  const customerId = stripeIdOf(subscription.customer)
  if (customerId === null) return null

  const byCustomer = await runtime.subscriptions.findByStripeCustomerId(customerId)
  return byCustomer?.organizationId ?? null
}

/** Resolve the row an invoice belongs to via its subscription, then its customer. */
async function organizationForInvoice(
  runtime: BillingRuntime,
  invoice: Stripe.Invoice,
): Promise<SubscriptionRecord | null> {
  const subscriptionId = subscriptionIdFromInvoice(invoice)
  if (subscriptionId !== null) {
    const bySubscription =
      await runtime.subscriptions.findByStripeSubscriptionId(subscriptionId)
    if (bySubscription !== null) return bySubscription
  }

  const customerId = stripeIdOf(invoice.customer)
  if (customerId === null) return null

  return await runtime.subscriptions.findByStripeCustomerId(customerId)
}
