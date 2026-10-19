/**
 * The Polar webhook: what happens between a delivery arriving and the 200.
 *
 * Four properties this module guarantees, in order of importance:
 *
 * 1. **Authenticity.** The raw body is read once, verified as Standard Webhooks
 *    over `{webhook-id}.{webhook-timestamp}.{body}`, and only then parsed. The
 *    bytes that were verified are the bytes that were received — a re-serialised
 *    payload has a different signature and must not be given one by us. An
 *    unset signing secret is a refusal, never a bypass.
 * 2. **Idempotency.** Polar retries a failed delivery up to ten times with
 *    exponential backoff, and retries can overlap. The idempotency key is the
 *    `webhook-id` header, because the envelope Polar sends is
 *    `{ type, timestamp, data }` and carries no event id of its own. The key is
 *    claimed in KV before any state changes and confirmed afterwards, and a
 *    handler that throws releases the claim so the next retry can still work.
 * 3. **One inline write.** Verification, the claim, at most one D1 write, at
 *    most one queue send, and no outbound call to Polar at all
 *    (`docs/ARCHITECTURE.md` §2.4). Polar times a delivery out at ten seconds
 *    and asks for two; a provider round trip on this path is what turns a slow
 *    Polar into a disabled endpoint. Everything Polar could tell us it already
 *    told us — a subscription event carries the whole `Subscription` object —
 *    so there is nothing left to read back.
 * 4. **Fresh entitlements.** Every subscription event drops the organization's
 *    cached plan state in the same request (`docs/ARCHITECTURE.md` §4), so a
 *    plan change is visible on the next page load rather than up to 60 s later.
 *
 * Polar deliberately sends both a catch-all `subscription.updated` and the
 * specific event beside it, with separate `webhook-id`s and no ordering
 * guarantee, so the KV claim cannot collapse the pair. Two rules keep that from
 * writing contradictory rows or sending two emails for one real change:
 * attribution and status come from the payload rather than from the event name
 * (a payload whose status is `canceled` or `unpaid` is a revocation, whichever
 * event carried it), and the follow-up task is enqueued only when the row
 * actually moved.
 */

import { z } from 'zod'
import { planById } from '#/lib/plans'
import { invalidateEntitlements } from './entitlements'
import {
  POLAR_CHECKOUT_STATUSES,
  cancelledRecord,
  fromPolarTimestamp,
  organizationIdFromMetadata,
  organizationIdFromOrder,
  organizationIdFromSubscription,
  polarMetadataSchema,
  polarOrderSchema,
  polarSubscriptionSchema,
  subscriptionIdFromOrder,
  subscriptionRecordFromPolar,
} from './mapping'
import { verifyWebhookSignature } from './polar'
import { WebhookVerificationError } from './types'

import type { PolarOrder, PolarSubscription } from './mapping'
import type { BillingRuntime, BillingTask, SubscriptionRecord } from './types'

/* -------------------------------------------------------------- idempotency */

/**
 * How long a handled id is remembered. Polar gives up after ten deliveries of
 * exponential backoff, so three days outlives the last retry comfortably.
 */
export const WEBHOOK_EVENT_TTL_SECONDS = 72 * 60 * 60

/**
 * How long a claim survives if the isolate dies mid-handler. Long enough that an
 * overlapping retry does not duplicate work, short enough that a crash
 * self-heals — and above the 60 s floor Workers KV puts on `expirationTtl`.
 */
export const WEBHOOK_CLAIM_TTL_SECONDS = 120

const EVENT_CACHE_VERSION = 'v1'

/**
 * The KV key one delivery claims.
 *
 * The prefix names Polar on purpose. The previous provider's ids lived under a
 * prefix of their own, and reusing it would let one of its remembered event ids
 * collide with a `webhook-id` and swallow a genuine delivery as a duplicate.
 */
export function webhookEventCacheKey(webhookId: string): string {
  return `billing:polar-event:${EVENT_CACHE_VERSION}:${webhookId}`
}

/* ------------------------------------------------------------------- events */

/**
 * The Polar events this endpoint acts on. Anything else is acknowledged with a
 * 200 and never claimed, so an endpoint subscribed to more than this costs one
 * request and no storage.
 */
export const HANDLED_POLAR_EVENTS = [
  'subscription.created',
  'subscription.active',
  'subscription.updated',
  'subscription.canceled',
  'subscription.uncanceled',
  'subscription.cycled',
  'subscription.past_due',
  'subscription.revoked',
  'subscription.paused',
  'subscription.resumed',
  'order.created',
  'order.updated',
  'order.paid',
  'order.refunded',
  'checkout.created',
  'checkout.updated',
  'checkout.expired',
] as const

export type HandledPolarEvent = (typeof HANDLED_POLAR_EVENTS)[number]

const HANDLED_EVENT_SET: ReadonlySet<string> = new Set(HANDLED_POLAR_EVENTS)

export function isHandledPolarEvent(type: string): type is HandledPolarEvent {
  return HANDLED_EVENT_SET.has(type)
}

export type WebhookResult = 'processed' | 'duplicate' | 'ignored'

export interface PolarWebhookOutcome {
  /** The `webhook-id` header — Polar's delivery id, and our idempotency key. */
  readonly eventId: string
  readonly type: string
  readonly result: WebhookResult
  readonly organizationId: string | null
}

/* ------------------------------------------------------------- verification */

/**
 * The Polar envelope. Every one of the 41 payload schemas is this shape, and
 * none of them carries an event id, which is why the header is the only key
 * available for de-duplication.
 */
const deliveryEnvelopeSchema = z.object({
  type: z.string().min(1),
  timestamp: z.string().min(1),
  data: z.unknown(),
})

/**
 * What the webhook path needs off a delivered `Checkout`.
 *
 * Narrower than `polarCheckoutSchema` in `./mapping`, and deliberately so: that
 * one validates the checkout *we* created and can insist on `url` and a product
 * id, while a delivered checkout types `product_id` as nullable and the fields
 * that matter here are the status and the attribution. A schema that rejected a
 * legitimate delivery would cost us the customer attach.
 */
const deliveredCheckoutSchema = z.object({
  status: z.enum(POLAR_CHECKOUT_STATUSES),
  customer_id: z.string().nullish(),
  external_customer_id: z.string().nullish(),
  metadata: polarMetadataSchema.nullish(),
})

/** One verified delivery, ready to dispatch. */
export interface PolarDelivery {
  readonly eventId: string
  readonly sentAt: Date
  readonly type: string
  readonly data: unknown
}

/**
 * Verify and parse an inbound delivery.
 *
 * The body is read exactly once, before anything looks at it, and that same
 * string is what the signature is computed over. Throws
 * `WebhookVerificationError` for anything that is not a genuine, in-tolerance,
 * envelope-shaped Polar delivery — which is what lets the endpoint answer 400
 * rather than 500.
 */
export async function verifyPolarDelivery(
  runtime: BillingRuntime,
  request: Request,
): Promise<PolarDelivery> {
  const payload = await request.text()

  const verified = await verifyWebhookSignature({
    secret: runtime.webhookSecret,
    headers: request.headers,
    payload,
    now: runtime.now(),
  })

  const envelope = deliveryEnvelopeSchema.safeParse(parseJson(payload))
  if (!envelope.success) {
    throw new WebhookVerificationError(
      'The delivery body is not a Polar webhook envelope.',
    )
  }

  return {
    eventId: verified.webhookId,
    sentAt: verified.sentAt,
    type: envelope.data.type,
    data: envelope.data.data,
  }
}

function parseJson(payload: string): unknown {
  try {
    return JSON.parse(payload) as unknown
  } catch {
    return null
  }
}

/* --------------------------------------------------------------------- HTTP */

/**
 * The whole endpoint: verify, de-duplicate, handle, answer.
 *
 * 400 for an unverifiable payload, because retrying identical bytes cannot fix
 * a signature and ten consecutive failures disable the endpoint. 200 for
 * anything accepted, already seen, or deliberately not acted on. 500 only when
 * a handler failed and Polar's retry could still succeed.
 */
export async function handlePolarWebhook(
  runtime: BillingRuntime,
  request: Request,
): Promise<Response> {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405, { allow: 'POST' })
  }

  let delivery: PolarDelivery
  try {
    delivery = await verifyPolarDelivery(runtime, request)
  } catch (cause) {
    runtime.logger.warn('billing.webhook.rejected', {
      reason: cause instanceof Error ? cause.message : 'Invalid webhook.',
    })
    return json({ error: 'Invalid signature.' }, 400)
  }

  try {
    const outcome = await processPolarDelivery(runtime, delivery)
    runtime.logger.info('billing.webhook.handled', {
      eventId: outcome.eventId,
      type: outcome.type,
      result: outcome.result,
      organizationId: outcome.organizationId,
    })
    return json({ received: true, result: outcome.result }, 200)
  } catch (cause) {
    runtime.logger.error('billing.webhook.failed', {
      eventId: delivery.eventId,
      type: delivery.type,
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

/* -------------------------------------------------------------- dispatching */

/** A delivery whose type this endpoint acts on. */
interface HandledDelivery extends PolarDelivery {
  readonly type: HandledPolarEvent
}

/**
 * Claim the delivery id, dispatch it, then confirm the claim.
 *
 * An event type we do not act on returns before the cache is touched at all: it
 * leaves no claim, so subscribing the endpoint to Polar's whole catalogue costs
 * nothing and cannot mask a later, genuine delivery.
 */
export async function processPolarDelivery(
  runtime: BillingRuntime,
  delivery: PolarDelivery,
): Promise<PolarWebhookOutcome> {
  if (!isHandledPolarEvent(delivery.type)) {
    return outcomeOf(delivery, 'ignored', null)
  }
  const handled: HandledDelivery = { ...delivery, type: delivery.type }

  const key = webhookEventCacheKey(delivery.eventId)
  if ((await runtime.cache.get(key)) !== null) {
    return outcomeOf(delivery, 'duplicate', null)
  }

  await runtime.cache.put(key, 'claimed', {
    expirationTtl: WEBHOOK_CLAIM_TTL_SECONDS,
  })

  try {
    const result = await dispatch(runtime, handled)
    await runtime.cache.put(key, 'handled', {
      expirationTtl: WEBHOOK_EVENT_TTL_SECONDS,
    })
    return result
  } catch (cause) {
    await runtime.cache.delete(key)
    throw cause
  }
}

async function dispatch(
  runtime: BillingRuntime,
  delivery: HandledDelivery,
): Promise<PolarWebhookOutcome> {
  switch (delivery.type) {
    case 'subscription.created':
    case 'subscription.active':
    case 'subscription.updated':
    case 'subscription.canceled':
    case 'subscription.uncanceled':
    case 'subscription.cycled':
    case 'subscription.past_due':
    case 'subscription.revoked':
    case 'subscription.paused':
    case 'subscription.resumed':
      return await onSubscriptionEvent(runtime, delivery)
    case 'order.paid':
      return await onOrderPaid(runtime, delivery)
    case 'order.created':
    case 'order.updated':
      return await onOrderProgressed(runtime, delivery)
    case 'order.refunded':
      return await onOrderRefunded(runtime, delivery)
    case 'checkout.updated':
      return await onCheckoutUpdated(runtime, delivery)
    case 'checkout.created':
    case 'checkout.expired':
      // Nothing of ours changes until a checkout succeeds; both are claimed and
      // acknowledged so the endpoint can carry Polar's full checkout stream.
      return outcomeOf(delivery, 'ignored', null)
  }
}

/* ---------------------------------------------------------------- handlers */

/**
 * Every subscription event, from `created` through `revoked`.
 *
 * The event name decides nothing except which log line is written: the row is
 * derived from the payload, so the catch-all `subscription.updated` that Polar
 * sends beside each specific event converges on exactly the same row instead of
 * racing it.
 */
async function onSubscriptionEvent(
  runtime: BillingRuntime,
  delivery: HandledDelivery,
): Promise<PolarWebhookOutcome> {
  const parsed = polarSubscriptionSchema.safeParse(delivery.data)
  if (!parsed.success) {
    return unreadable(runtime, delivery, 'subscription')
  }
  const subscription = parsed.data

  const organizationId = await organizationForSubscription(runtime, subscription)
  if (organizationId === null) {
    return outcomeOf(delivery, 'ignored', null)
  }
  if (!(await runtime.subscriptions.organizationExists(organizationId))) {
    return ignoredForDeletedOrganization(runtime, delivery, organizationId)
  }

  const previous = await runtime.subscriptions.findByOrganization(organizationId)
  const record = recordForSubscription(runtime, subscription, organizationId, previous)

  if (record === null) {
    // A product this deployment does not sell — legitimate for an organization
    // that also sells something else, and never a reason to fail a delivery.
    await invalidateEntitlements(runtime, organizationId)
    return outcomeOf(delivery, 'ignored', organizationId)
  }

  await runtime.subscriptions.upsert(record)
  await invalidateEntitlements(runtime, organizationId)

  if (movedState(previous, record)) {
    await enqueue(runtime, {
      kind: 'billing.subscription.changed',
      organizationId,
      planId: record.planId,
      previousPlanId: previous?.planId ?? planById('free').id,
      status: record.status,
      providerEventId: delivery.eventId,
    })
  }

  return outcomeOf(delivery, 'processed', organizationId)
}

/**
 * The row a subscription payload describes.
 *
 * `canceled` and `unpaid` are the two statuses Polar sets when access has
 * actually ended — a cancellation that is merely *scheduled* keeps its
 * entitling status and raises `cancel_at_period_end`, and Polar's own field
 * documentation says so. Both therefore take the Free row, keeping the customer
 * so the next upgrade reuses the same billing profile.
 *
 * Either branch carries the payload's `pending_update` — `null` on the cancelled
 * one, because a subscription that has ended schedules nothing. That is what makes
 * this handler the reconciler for a scheduled change and not merely for a plan: the
 * upsert below writes the whole row, so a schedule Polar has applied, superseded or
 * cancelled is cleared by the same delivery that tells us about it, whether the
 * customer asked for it here or in the hosted portal.
 */
function recordForSubscription(
  runtime: BillingRuntime,
  subscription: PolarSubscription,
  organizationId: string,
  previous: SubscriptionRecord | null,
): SubscriptionRecord | null {
  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    return cancelledRecord(
      previous,
      organizationId,
      subscription.customer_id,
      fromPolarTimestamp(subscription.canceled_at) ?? runtime.now(),
    )
  }
  return subscriptionRecordFromPolar(subscription, {
    fallbackOrganizationId: organizationId,
  })
}

/**
 * A paid order is a receipt, and the end of any dunning that was running.
 *
 * The status write is narrow and conditional: a healthy subscription is left
 * alone so we never contradict the status Polar is about to send us anyway.
 */
async function onOrderPaid(
  runtime: BillingRuntime,
  delivery: HandledDelivery,
): Promise<PolarWebhookOutcome> {
  const parsed = polarOrderSchema.safeParse(delivery.data)
  if (!parsed.success) {
    return unreadable(runtime, delivery, 'order')
  }
  const order = parsed.data

  const existing = await recordForOrder(runtime, order)
  if (existing === null) {
    return outcomeOf(delivery, 'ignored', null)
  }

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
    providerOrderId: order.id,
    amountPaid: order.total_amount,
    currency: order.currency,
    providerEventId: delivery.eventId,
  })

  return outcomeOf(delivery, 'processed', existing.organizationId)
}

/**
 * `order.created` and `order.updated`: dunning, and nothing else.
 *
 * An order Polar has scheduled another payment attempt for is a payment that
 * failed. It is a safety net rather than the primary signal — `subscription.
 * past_due` says the same thing about the same subscription — so it writes only
 * from a healthy row, and the two deliveries converge instead of fighting. The
 * receipt half of an order belongs to `order.paid`, which is delivered for
 * every order that reaches `paid`, so this path never touches one.
 */
async function onOrderProgressed(
  runtime: BillingRuntime,
  delivery: HandledDelivery,
): Promise<PolarWebhookOutcome> {
  const parsed = polarOrderSchema.safeParse(delivery.data)
  if (!parsed.success) {
    return unreadable(runtime, delivery, 'order')
  }
  const order = parsed.data

  const retrying =
    order.status !== 'paid' &&
    typeof order.next_payment_attempt_at === 'string' &&
    order.next_payment_attempt_at !== ''
  if (!retrying) {
    return outcomeOf(delivery, 'ignored', null)
  }

  const existing = await recordForOrder(runtime, order)
  if (existing === null) {
    return outcomeOf(delivery, 'ignored', null)
  }
  if (existing.status !== 'active' && existing.status !== 'trialing') {
    return outcomeOf(delivery, 'ignored', existing.organizationId)
  }

  await runtime.subscriptions.updateStatus(
    existing.organizationId,
    'past_due',
    runtime.now(),
  )
  await invalidateEntitlements(runtime, existing.organizationId)

  await enqueue(runtime, {
    kind: 'billing.subscription.changed',
    organizationId: existing.organizationId,
    planId: existing.planId,
    previousPlanId: existing.planId,
    status: 'past_due',
    providerEventId: delivery.eventId,
  })

  return outcomeOf(delivery, 'processed', existing.organizationId)
}

/**
 * A refund moves money, not entitlement: when access ends with it, Polar says so
 * in a `subscription.revoked` of its own. All this owes is a fresh read — the
 * refund is often the first delivery of the pair, and one KV delete is cheaper
 * than a minute of a plan the customer no longer has.
 */
async function onOrderRefunded(
  runtime: BillingRuntime,
  delivery: HandledDelivery,
): Promise<PolarWebhookOutcome> {
  const parsed = polarOrderSchema.safeParse(delivery.data)
  if (!parsed.success) {
    return unreadable(runtime, delivery, 'order')
  }

  const existing = await recordForOrder(runtime, parsed.data)
  if (existing === null) {
    return outcomeOf(delivery, 'ignored', null)
  }

  await invalidateEntitlements(runtime, existing.organizationId)
  return outcomeOf(delivery, 'processed', existing.organizationId)
}

/**
 * `checkout.updated` at `succeeded` — the moment the customer has paid.
 *
 * One write, and it is the smallest one available: the Polar customer is
 * attached to the organization so the billing screen and the portal work the
 * instant the browser comes back. The plan itself is *not* written here. The
 * checkout carries no subscription status and no period boundaries, and the
 * provider read the previous integration made inline to get them is gone — a
 * `subscription.created` for the same purchase is already on its way carrying
 * the entire `Subscription`, and that delivery does the sync and sends the one
 * notification. `confirmed` is explicitly not a payment: Polar's own field
 * documentation says it means the customer pressed Pay, nothing more.
 */
async function onCheckoutUpdated(
  runtime: BillingRuntime,
  delivery: HandledDelivery,
): Promise<PolarWebhookOutcome> {
  const parsed = deliveredCheckoutSchema.safeParse(delivery.data)
  if (!parsed.success) {
    return unreadable(runtime, delivery, 'checkout')
  }
  const checkout = parsed.data

  if (checkout.status !== 'succeeded') {
    return outcomeOf(delivery, 'ignored', null)
  }

  const organizationId =
    nonEmpty(checkout.external_customer_id) ??
    organizationIdFromMetadata(checkout.metadata)
  if (organizationId === null) {
    return outcomeOf(delivery, 'ignored', null)
  }

  if (!(await runtime.subscriptions.organizationExists(organizationId))) {
    return ignoredForDeletedOrganization(runtime, delivery, organizationId)
  }

  const customerId = nonEmpty(checkout.customer_id)
  if (customerId !== null) {
    await runtime.subscriptions.attachCustomer(organizationId, customerId)
  }
  await invalidateEntitlements(runtime, organizationId)

  return outcomeOf(delivery, 'processed', organizationId)
}

/* ----------------------------------------------------------------- helpers */

/**
 * A delivery for a workspace that has been deleted: accepted, and nothing else.
 *
 * Deleting a workspace does not cancel its provider subscription (it refuses while one is live, but
 * a cancellation set for the end of the period passes), so Polar goes on sending events for it. A
 * non-2xx answer would be retried and, repeated, disable the endpoint for every workspace; writing a
 * row would violate the `organization_id` foreign key. So it answers 2xx, writes no row, drops no
 * cache entry and enqueues no follow-up, and the next delivery is answered the same way.
 */
function ignoredForDeletedOrganization(
  runtime: BillingRuntime,
  delivery: HandledDelivery,
  organizationId: string,
): PolarWebhookOutcome {
  runtime.logger.info('billing.webhook.organization_gone', {
    eventType: delivery.type,
    organizationId,
  })
  return outcomeOf(delivery, 'ignored', organizationId)
}

function outcomeOf(
  delivery: PolarDelivery,
  result: WebhookResult,
  organizationId: string | null,
): PolarWebhookOutcome {
  return { eventId: delivery.eventId, type: delivery.type, result, organizationId }
}

/**
 * A signed delivery whose body does not match the schema we read it with.
 *
 * Acknowledged rather than failed: Polar would resend the identical bytes ten
 * times and then disable the endpoint, so the log line is the useful half.
 */
function unreadable(
  runtime: BillingRuntime,
  delivery: PolarDelivery,
  shape: string,
): PolarWebhookOutcome {
  runtime.logger.warn('billing.webhook.unreadable', {
    eventId: delivery.eventId,
    type: delivery.type,
    shape,
  })
  return outcomeOf(delivery, 'ignored', null)
}

function nonEmpty(value: string | null | undefined): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * Did the organization's billing state actually move?
 *
 * The gate on the follow-up task, and the reason Polar's duplicate delivery of
 * one real change produces one notification: the second delivery finds the row
 * already where it is trying to put it. A renewal (`subscription.cycled`) moves
 * the period and nothing else, so it writes the row and sends no task — the
 * receipt for a renewal is `order.paid`.
 */
function movedState(
  previous: SubscriptionRecord | null,
  next: SubscriptionRecord,
): boolean {
  if (previous === null) return true
  return (
    previous.planId !== next.planId ||
    previous.status !== next.status ||
    previous.seats !== next.seats ||
    previous.interval !== next.interval ||
    previous.cancelAtPeriodEnd !== next.cancelAtPeriodEnd
  )
}

/**
 * Queue delivery must never turn a persisted change into a Polar retry — the
 * write already happened, and a retry would redo it — so a send failure is
 * logged rather than thrown.
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

/**
 * Attribution for a subscription: `customer.external_id` and metadata first,
 * because Polar copies both onto every object in the chain, then our own
 * indexes — never one source alone.
 */
async function organizationForSubscription(
  runtime: BillingRuntime,
  subscription: PolarSubscription,
): Promise<string | null> {
  const attributed = organizationIdFromSubscription(subscription)
  if (attributed !== null) return attributed

  const bySubscription = await runtime.subscriptions.findByProviderSubscriptionId(
    subscription.id,
  )
  if (bySubscription !== null) return bySubscription.organizationId

  const byCustomer = await runtime.subscriptions.findByProviderCustomerId(
    subscription.customer_id,
  )
  return byCustomer?.organizationId ?? null
}

/** The row an order belongs to: its subscription, then its customer's id. */
async function recordForOrder(
  runtime: BillingRuntime,
  order: PolarOrder,
): Promise<SubscriptionRecord | null> {
  const subscriptionId = subscriptionIdFromOrder(order)
  if (subscriptionId !== null) {
    const bySubscription =
      await runtime.subscriptions.findByProviderSubscriptionId(subscriptionId)
    if (bySubscription !== null) return bySubscription
  }

  const attributed = organizationIdFromOrder(order)
  if (attributed !== null) {
    const byOrganization = await runtime.subscriptions.findByOrganization(attributed)
    if (byOrganization !== null) return byOrganization
  }

  return await runtime.subscriptions.findByProviderCustomerId(order.customer_id)
}
