/**
 * The webhook endpoint's four contracts: authenticity, idempotency, one inline
 * write, and fresh entitlements.
 *
 * Deliveries are signed by `signPolarWebhook()` in the harness — a second,
 * independent implementation of Standard Webhooks written from the
 * specification — so a passing test here means a real Polar delivery verifies,
 * and a rejected one is rejected for the right reason rather than because two
 * copies of the same mistake agree.
 *
 * Every delivery is signed against the harness clock rather than the wall
 * clock, because the endpoint verifies the timestamp against the injected
 * `runtime.now()`. That is also what makes the tolerance assertions exact.
 */

// Must come first: it configures the product ids `#/lib/plans` reads at import.
import { TEST_PRODUCT_IDS } from './prices.fixture'

import { beforeEach, describe, expect, it } from 'vitest'

import {
  HANDLED_POLAR_EVENTS,
  WEBHOOK_CLAIM_TTL_SECONDS,
  WEBHOOK_EVENT_TTL_SECONDS,
  handlePolarWebhook,
  isHandledPolarEvent,
  processPolarDelivery,
  verifyPolarDelivery,
  webhookEventCacheKey,
} from '../webhook'
import { WEBHOOK_TOLERANCE_SECONDS } from '../polar'
import { planStateCacheKey } from '../entitlements'
import { WebhookVerificationError } from '../types'
import {
  TEST_CHECKOUT_ID,
  TEST_CHECKOUT_URL,
  TEST_CUSTOMER_ID,
  TEST_ORDER_ID,
  TEST_ORG_ID,
  TEST_SUBSCRIPTION_ID,
  createHarness,
  polarOrder,
  polarSubscription,
  signPolarWebhook,
  subscriptionRecord,
  webhookRequest,
} from './harness'

import type { PolarOrder, PolarSubscription } from '../mapping'
import type {
  BillingRuntime,
  SubscriptionRecord,
  SubscriptionStore,
} from '../types'
import type { SubscriptionStatus } from '#/lib/plans'
import type { HarnessOptions, PolarSigningOptions } from './harness'

/* ------------------------------------------------------------------ fixtures */

/** The instant the injected clock is frozen at, and what deliveries are signed for. */
const NOW = new Date('2026-08-19T12:00:00.000Z')
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000)

function harness(options: HarnessOptions = {}): ReturnType<typeof createHarness> {
  return createHarness({ now: NOW, ...options })
}

/** The Polar envelope: `{ type, timestamp, data }`, and never an event id. */
function envelope(type: string, data: unknown): string {
  return JSON.stringify({ type, timestamp: NOW.toISOString(), data })
}

function subscriptionBody(
  type: string,
  overrides: Partial<PolarSubscription> = {},
): string {
  return envelope(type, polarSubscription(overrides))
}

function orderBody(type: string, overrides: Partial<PolarOrder> = {}): string {
  return envelope(type, polarOrder(overrides))
}

function checkoutBody(
  status: string,
  overrides: Readonly<Record<string, unknown>> = {},
): string {
  return envelope('checkout.updated', {
    id: TEST_CHECKOUT_ID,
    status,
    url: TEST_CHECKOUT_URL,
    product_id: TEST_PRODUCT_IDS.crewMonthly,
    subscription_id: TEST_SUBSCRIPTION_ID,
    external_customer_id: TEST_ORG_ID,
    customer_id: TEST_CUSTOMER_ID,
    seats: 4,
    metadata: { organizationId: TEST_ORG_ID },
    ...overrides,
  })
}

/** A signed delivery. Polar re-signs every retry, so the headers are per-call. */
async function delivery(
  body: string,
  options: PolarSigningOptions = {},
): Promise<Request> {
  const headers = await signPolarWebhook(body, {
    timestampSeconds: NOW_SECONDS,
    ...options,
  })
  return webhookRequest(body, headers)
}

/**
 * A store that counts every write.
 *
 * `ARCHITECTURE.md` §2.4 allows the request path exactly one D1 write, and the
 * previous integration broke that on checkout completion by attaching the
 * customer *and* upserting the row. Only a counter that sees all three mutating
 * methods can prove it does not happen again.
 */
class CountingStore implements SubscriptionStore {
  writes = 0

  constructor(private readonly inner: SubscriptionStore) {}

  async findByOrganization(id: string): Promise<SubscriptionRecord | null> {
    return await this.inner.findByOrganization(id)
  }

  async findByProviderCustomerId(id: string): Promise<SubscriptionRecord | null> {
    return await this.inner.findByProviderCustomerId(id)
  }

  async findByProviderSubscriptionId(
    id: string,
  ): Promise<SubscriptionRecord | null> {
    return await this.inner.findByProviderSubscriptionId(id)
  }

  async upsert(record: SubscriptionRecord): Promise<void> {
    this.writes += 1
    await this.inner.upsert(record)
  }

  async attachCustomer(organizationId: string, customerId: string): Promise<void> {
    this.writes += 1
    await this.inner.attachCustomer(organizationId, customerId)
  }

  async updateStatus(
    organizationId: string,
    status: SubscriptionStatus,
    changedAt: Date,
  ): Promise<void> {
    this.writes += 1
    await this.inner.updateStatus(organizationId, status, changedAt)
  }
}

function counting(runtime: BillingRuntime): {
  runtime: BillingRuntime
  store: CountingStore
} {
  const store = new CountingStore(runtime.subscriptions)
  return { runtime: { ...runtime, subscriptions: store }, store }
}

/* -------------------------------------------------------------- authenticity */

describe('signature verification', () => {
  it('rejects a delivery with no signature headers', async () => {
    const h = harness()
    const response = await handlePolarWebhook(
      h.runtime,
      webhookRequest(subscriptionBody('subscription.updated')),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: 'Invalid signature.' })
    expect(h.store.writes).toHaveLength(0)
    expect(h.tasks.sent).toHaveLength(0)
  })

  it('rejects an empty webhook-signature header', async () => {
    const h = harness()
    const body = subscriptionBody('subscription.updated')
    const headers = await signPolarWebhook(body, { timestampSeconds: NOW_SECONDS })

    const response = await handlePolarWebhook(
      h.runtime,
      webhookRequest(body, { ...headers, 'webhook-signature': '' }),
    )

    expect(response.status).toBe(400)
    expect(h.store.writes).toHaveLength(0)
  })

  it('rejects a signature computed with a different secret', async () => {
    const h = harness()
    const response = await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.updated'), {
        secret: 'a_completely_different_secret',
      }),
    )

    expect(response.status).toBe(400)
    expect(h.store.writes).toHaveLength(0)
  })

  it('rejects a body edited after it was signed', async () => {
    const h = harness()
    const body = subscriptionBody('subscription.updated')
    const headers = await signPolarWebhook(body, { timestampSeconds: NOW_SECONDS })
    const tampered = body.replace('"seats":4', '"seats":10')
    expect(tampered).not.toBe(body)

    const response = await handlePolarWebhook(
      h.runtime,
      webhookRequest(tampered, headers),
    )

    expect(response.status).toBe(400)
    expect(h.store.writes).toHaveLength(0)
  })

  it('verifies the bytes it received, not a re-serialisation of them', async () => {
    const h = harness()
    const received = JSON.stringify(
      { type: 'subscription.updated', timestamp: NOW.toISOString(), data: polarSubscription() },
      null,
      2,
    )
    const reserialised = JSON.stringify(JSON.parse(received))
    expect(reserialised).not.toBe(received)

    // A handler that re-serialised the body before verifying would sign
    // `reserialised` and accept this. The endpoint must not.
    const wrongBytes = await signPolarWebhook(reserialised, {
      timestampSeconds: NOW_SECONDS,
    })
    const rejected = await handlePolarWebhook(
      h.runtime,
      webhookRequest(received, wrongBytes),
    )
    expect(rejected.status).toBe(400)
    expect(h.store.writes).toHaveLength(0)

    // The very same bytes, signed as they were received, are accepted.
    const accepted = await handlePolarWebhook(h.runtime, await delivery(received))
    expect(accepted.status).toBe(200)
    expect(h.store.writes).toHaveLength(1)
  })

  it('rejects a delivery older than the replay tolerance', async () => {
    const h = harness()
    const response = await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.updated'), {
        timestampSeconds: NOW_SECONDS - (WEBHOOK_TOLERANCE_SECONDS + 60),
      }),
    )

    expect(response.status).toBe(400)
    expect(h.store.writes).toHaveLength(0)
  })

  it('keeps the 300 second tolerance, and accepts a delivery inside it', async () => {
    expect(WEBHOOK_TOLERANCE_SECONDS).toBe(300)

    const h = harness()
    const response = await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.updated'), {
        timestampSeconds: NOW_SECONDS - (WEBHOOK_TOLERANCE_SECONDS - 30),
      }),
    )

    expect(response.status).toBe(200)
  })

  it('refuses every delivery when the endpoint has no signing secret', async () => {
    const h = harness({ webhookSecret: '' })

    await expect(
      verifyPolarDelivery(
        h.runtime,
        await delivery(subscriptionBody('subscription.updated')),
      ),
    ).rejects.toBeInstanceOf(WebhookVerificationError)
  })

  it('refuses an unsigned delivery when the secret is unset, never skipping the check', async () => {
    const h = harness({ webhookSecret: '' })

    const response = await handlePolarWebhook(
      h.runtime,
      webhookRequest(subscriptionBody('subscription.updated')),
    )

    expect(response.status).toBe(400)
    expect(h.store.writes).toHaveLength(0)
    expect(h.tasks.sent).toHaveLength(0)
    expect(h.cache.entries.size).toBe(0)
  })

  it('accepts a correctly signed delivery and keys it on the webhook-id header', async () => {
    const h = harness()
    const verified = await verifyPolarDelivery(
      h.runtime,
      await delivery(subscriptionBody('subscription.active'), {
        webhookId: 'msg_signed_ok',
      }),
    )

    expect(verified.eventId).toBe('msg_signed_ok')
    expect(verified.type).toBe('subscription.active')
    expect(verified.sentAt.getTime()).toBe(NOW_SECONDS * 1000)
  })

  it('rejects a signed body that is not a Polar envelope', async () => {
    const h = harness()
    const response = await handlePolarWebhook(
      h.runtime,
      await delivery(JSON.stringify({ id: 'evt', object: 'event' })),
    )

    expect(response.status).toBe(400)
    expect(h.cache.entries.size).toBe(0)
  })

  it('answers 405 to any verb other than POST', async () => {
    const h = harness()
    const response = await handlePolarWebhook(
      h.runtime,
      new Request('https://planned.travel/api/polar/webhook', { method: 'GET' }),
    )

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })

  it('never lets a rejected delivery be cached or answered as handled', async () => {
    const h = harness()
    await handlePolarWebhook(
      h.runtime,
      webhookRequest(subscriptionBody('subscription.updated')),
    )

    expect(h.cache.entries.size).toBe(0)
    expect(h.cache.puts).toBe(0)
    expect(h.logs.some((log) => log.message === 'billing.webhook.rejected')).toBe(true)
    expect(h.logs.some((log) => log.message === 'billing.webhook.handled')).toBe(false)
  })
})

/* ----------------------------------------------------------------- idempotency */

describe('redelivery idempotency', () => {
  let h: ReturnType<typeof createHarness>

  beforeEach(() => {
    h = harness()
  })

  it('keys the claim on the header, under a Polar-specific prefix', () => {
    expect(webhookEventCacheKey('msg_2f8c')).toBe('billing:polar-event:v1:msg_2f8c')
  })

  it('persists the subscription on the first delivery', async () => {
    const response = await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.created')),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'processed',
    })

    expect(h.store.writes).toHaveLength(1)
    const row = h.store.rows.get(TEST_ORG_ID)
    expect(row?.planId).toBe('crew')
    expect(row?.seats).toBe(4)
    expect(row?.status).toBe('active')
    expect(row?.providerSubscriptionId).toBe(TEST_SUBSCRIPTION_ID)
    expect(h.tasks.sent).toHaveLength(1)
  })

  it('treats a retry of the same webhook-id as a no-op, however it is re-signed', async () => {
    const body = subscriptionBody('subscription.created')

    const first = await handlePolarWebhook(
      h.runtime,
      await delivery(body, { webhookId: 'msg_retry', timestampSeconds: NOW_SECONDS }),
    )
    // Polar re-signs a retry with a fresh timestamp, so the signature differs
    // while the delivery id does not. The claim is what dedupes, not the bytes.
    const second = await handlePolarWebhook(
      h.runtime,
      await delivery(body, {
        webhookId: 'msg_retry',
        timestampSeconds: NOW_SECONDS - 45,
      }),
    )

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    await expect(second.json()).resolves.toEqual({
      received: true,
      result: 'duplicate',
    })

    expect(h.store.writes).toHaveLength(1)
    expect(h.tasks.sent).toHaveLength(1)
  })

  it('claims the delivery before working and confirms it afterwards', async () => {
    const key = webhookEventCacheKey('msg_claimed')

    const outcome = await processPolarDelivery(h.runtime, {
      eventId: 'msg_claimed',
      sentAt: NOW,
      type: 'subscription.updated',
      data: polarSubscription(),
    })

    expect(outcome.result).toBe('processed')
    expect(h.cache.entries.get(key)).toBe('handled')
    // Claimed, then confirmed — two writes for one delivery.
    expect(h.cache.puts).toBe(2)
    expect(WEBHOOK_CLAIM_TTL_SECONDS).toBeGreaterThanOrEqual(60)
    expect(WEBHOOK_CLAIM_TTL_SECONDS).toBeLessThan(WEBHOOK_EVENT_TTL_SECONDS)
  })

  it('applies a different webhook-id carrying the same subscription', async () => {
    await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.created'), {
        webhookId: 'msg_a',
      }),
    )
    await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.updated', { seats: 7 }), {
        webhookId: 'msg_b',
      }),
    )

    expect(h.store.writes).toHaveLength(2)
    expect(h.store.rows.get(TEST_ORG_ID)?.seats).toBe(7)
  })

  it('releases the claim when a handler fails, so the next retry can succeed', async () => {
    const failing = harness({ record: subscriptionRecord({ status: 'past_due' }) })
    // `order.paid` resolves the row through the store; making that throw is the
    // narrowest way to fail one handler without faking the whole runtime.
    let shouldFail = true
    const inner = failing.store.findByProviderSubscriptionId.bind(failing.store)
    failing.store.findByProviderSubscriptionId = async (id: string) => {
      if (shouldFail) throw new Error('D1 is unavailable')
      return await inner(id)
    }

    const body = orderBody('order.paid')
    const first = await handlePolarWebhook(
      failing.runtime,
      await delivery(body, { webhookId: 'msg_failing' }),
    )
    expect(first.status).toBe(500)
    expect(failing.cache.entries.has(webhookEventCacheKey('msg_failing'))).toBe(false)

    shouldFail = false
    const retry = await handlePolarWebhook(
      failing.runtime,
      await delivery(body, { webhookId: 'msg_failing' }),
    )
    expect(retry.status).toBe(200)
    await expect(retry.json()).resolves.toEqual({
      received: true,
      result: 'processed',
    })
  })

  it('acknowledges an event type it does not act on, and claims nothing', async () => {
    const response = await handlePolarWebhook(
      h.runtime,
      await delivery(
        envelope('customer.state_changed', { id: TEST_CUSTOMER_ID }),
        { webhookId: 'msg_unhandled' },
      ),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'ignored',
    })
    // No claim, and not even a read: an endpoint subscribed to Polar's whole
    // catalogue costs one request and no storage.
    expect(h.cache.gets).toBe(0)
    expect(h.cache.entries.size).toBe(0)
    expect(h.store.writes).toHaveLength(0)
  })

  it('ignores a subscription it cannot attribute to an organization', async () => {
    const response = await handlePolarWebhook(
      h.runtime,
      await delivery(
        subscriptionBody('subscription.updated', {
          customer: { id: TEST_CUSTOMER_ID, external_id: null, email: null },
          metadata: null,
        }),
        { webhookId: 'msg_orphan' },
      ),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'ignored',
    })
    expect(h.store.writes).toHaveLength(0)
  })

  it('ignores a product this deployment does not sell', async () => {
    const response = await handlePolarWebhook(
      h.runtime,
      await delivery(
        subscriptionBody('subscription.updated', {
          product_id: '8e1b0a44-2d6f-4c37-9f52-1b7c3d840a95',
        }),
        { webhookId: 'msg_foreign' },
      ),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'ignored',
    })
    expect(h.store.writes).toHaveLength(0)
  })

  it('acknowledges a signed delivery whose body does not match its shape', async () => {
    const response = await handlePolarWebhook(
      h.runtime,
      await delivery(envelope('subscription.updated', { id: 'not-a-subscription' }), {
        webhookId: 'msg_unreadable',
      }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'ignored',
    })
    expect(h.logs.some((log) => log.message === 'billing.webhook.unreadable')).toBe(
      true,
    )
  })
})

/* ---------------------------------------------------------- one inline write */

describe('one inline write, no provider call', () => {
  it('attaches the customer on a succeeded checkout with a single write', async () => {
    const h = harness()
    const { runtime, store } = counting(h.runtime)

    const response = await handlePolarWebhook(
      runtime,
      await delivery(checkoutBody('succeeded'), { webhookId: 'msg_checkout' }),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'processed',
    })

    // Exactly one D1 write, and Polar is never called back for the subscription.
    expect(store.writes).toBe(1)
    expect(h.calls).toHaveLength(0)
    expect(h.store.rows.get(TEST_ORG_ID)?.providerCustomerId).toBe(TEST_CUSTOMER_ID)
  })

  it('takes the customer attach even when the checkout names no product', async () => {
    const h = harness()
    const { runtime, store } = counting(h.runtime)

    // Polar types `product_id` as nullable on a delivered checkout; a schema
    // that insisted on it would cost us the attach.
    await handlePolarWebhook(
      runtime,
      await delivery(checkoutBody('succeeded', { product_id: null }), {
        webhookId: 'msg_checkout_no_product',
      }),
    )

    expect(store.writes).toBe(1)
    expect(h.store.rows.get(TEST_ORG_ID)?.providerCustomerId).toBe(TEST_CUSTOMER_ID)
  })

  it('does not treat a confirmed checkout as a paid one', async () => {
    const h = harness()
    const { runtime, store } = counting(h.runtime)

    const response = await handlePolarWebhook(
      runtime,
      await delivery(checkoutBody('confirmed'), { webhookId: 'msg_confirmed' }),
    )

    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'ignored',
    })
    expect(store.writes).toBe(0)
    expect(h.calls).toHaveLength(0)
  })

  it('writes once and calls nothing on a subscription delivery', async () => {
    const h = harness()
    const { runtime, store } = counting(h.runtime)

    await handlePolarWebhook(
      runtime,
      await delivery(subscriptionBody('subscription.active'), {
        webhookId: 'msg_active',
      }),
    )

    expect(store.writes).toBe(1)
    expect(h.calls).toHaveLength(0)
  })

  it('hands the follow-up work to the queue rather than doing it inline', async () => {
    const h = harness()

    await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.created'), {
        webhookId: 'msg_queue',
      }),
    )

    expect(h.tasks.sent).toEqual([
      {
        kind: 'billing.subscription.changed',
        organizationId: TEST_ORG_ID,
        planId: 'crew',
        previousPlanId: 'free',
        status: 'active',
        providerEventId: 'msg_queue',
      },
    ])
  })

  it('still answers 200 when the queue is unavailable', async () => {
    const h = harness()
    h.tasks.failNext = true

    const response = await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.created')),
    )

    expect(response.status).toBe(200)
    expect(h.store.writes).toHaveLength(1)
    expect(h.logs.some((log) => log.message === 'billing.task.enqueue_failed')).toBe(
      true,
    )
  })
})

/* -------------------------------------------------------------- entitlements */

describe('entitlement invalidation', () => {
  const subscriptionEvents = HANDLED_POLAR_EVENTS.filter((type) =>
    type.startsWith('subscription.'),
  )

  it('covers all ten subscription events', () => {
    expect(subscriptionEvents).toEqual([
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
    ])
  })

  it.each(subscriptionEvents)(
    'drops the cached plan state on %s, in the same request',
    async (type) => {
      const h = harness({ record: subscriptionRecord() })
      h.cache.entries.set(planStateCacheKey(TEST_ORG_ID), '{"planId":"crew"}')

      const response = await handlePolarWebhook(
        h.runtime,
        await delivery(subscriptionBody(type), { webhookId: `msg_${type}` }),
      )

      expect(response.status).toBe(200)
      expect(h.cache.entries.has(planStateCacheKey(TEST_ORG_ID))).toBe(false)
    },
  )

  it('drops it even for a product this deployment does not sell', async () => {
    const h = harness({ record: subscriptionRecord() })
    h.cache.entries.set(planStateCacheKey(TEST_ORG_ID), '{"planId":"crew"}')

    await handlePolarWebhook(
      h.runtime,
      await delivery(
        subscriptionBody('subscription.updated', {
          product_id: '8e1b0a44-2d6f-4c37-9f52-1b7c3d840a95',
        }),
        { webhookId: 'msg_foreign_invalidate' },
      ),
    )

    expect(h.cache.entries.has(planStateCacheKey(TEST_ORG_ID))).toBe(false)
  })
})

/* ----------------------------------------------------------- event semantics */

describe('the Polar event vocabulary', () => {
  it('handles exactly the seventeen events the integration subscribes to', () => {
    expect([...HANDLED_POLAR_EVENTS]).toEqual([
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
    ])
    expect(isHandledPolarEvent('subscription.revoked')).toBe(true)
    expect(isHandledPolarEvent('benefit_grant.created')).toBe(false)
  })

  it('ends access on subscription.revoked', async () => {
    const h = harness({ record: subscriptionRecord() })

    await handlePolarWebhook(
      h.runtime,
      await delivery(
        subscriptionBody('subscription.revoked', {
          status: 'canceled',
          canceled_at: '2026-08-19T11:59:00Z',
        }),
        { webhookId: 'msg_revoked' },
      ),
    )

    const row = h.store.rows.get(TEST_ORG_ID)
    expect(row?.planId).toBe('free')
    expect(row?.status).toBe('canceled')
    expect(row?.canceledAt?.toISOString()).toBe('2026-08-19T11:59:00.000Z')
    // The customer survives so the next upgrade reuses the billing profile.
    expect(row?.providerCustomerId).toBe(TEST_CUSTOMER_ID)
    expect(h.tasks.sent).toEqual([
      {
        kind: 'billing.subscription.changed',
        organizationId: TEST_ORG_ID,
        planId: 'free',
        previousPlanId: 'crew',
        status: 'canceled',
        providerEventId: 'msg_revoked',
      },
    ])
  })

  it('keeps access on subscription.canceled, which only schedules the end', async () => {
    const h = harness({ record: subscriptionRecord() })

    await handlePolarWebhook(
      h.runtime,
      await delivery(
        subscriptionBody('subscription.canceled', {
          status: 'active',
          cancel_at_period_end: true,
          canceled_at: '2026-08-19T11:00:00Z',
        }),
        { webhookId: 'msg_canceled' },
      ),
    )

    const row = h.store.rows.get(TEST_ORG_ID)
    expect(row?.planId).toBe('crew')
    expect(row?.status).toBe('active')
    expect(row?.cancelAtPeriodEnd).toBe(true)
    expect(h.tasks.sent).toHaveLength(1)
  })

  it('restores the scheduled cancellation on subscription.uncanceled', async () => {
    const h = harness({
      record: subscriptionRecord({ cancelAtPeriodEnd: true }),
    })

    await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.uncanceled'), {
        webhookId: 'msg_uncanceled',
      }),
    )

    expect(h.store.rows.get(TEST_ORG_ID)?.cancelAtPeriodEnd).toBe(false)
    expect(h.tasks.sent).toHaveLength(1)
  })

  it('moves the period on subscription.cycled without announcing a plan change', async () => {
    const h = harness({ record: subscriptionRecord() })

    await handlePolarWebhook(
      h.runtime,
      await delivery(
        subscriptionBody('subscription.cycled', {
          current_period_start: '2026-09-01T00:00:00Z',
          current_period_end: '2026-10-01T00:00:00Z',
        }),
        { webhookId: 'msg_cycled' },
      ),
    )

    const row = h.store.rows.get(TEST_ORG_ID)
    expect(row?.currentPeriodEnd?.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(row?.planId).toBe('crew')
    // A renewal is not a change of plan: the receipt is `order.paid`.
    expect(h.tasks.sent).toHaveLength(0)
  })

  it('keeps the paid plan through dunning on subscription.past_due', async () => {
    const h = harness({ record: subscriptionRecord() })

    await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.past_due', { status: 'past_due' }), {
        webhookId: 'msg_past_due',
      }),
    )

    const row = h.store.rows.get(TEST_ORG_ID)
    expect(row?.status).toBe('past_due')
    expect(row?.planId).toBe('crew')
    expect(h.tasks.sent).toHaveLength(1)
  })

  it('pauses and resumes without losing the subscription', async () => {
    const h = harness({ record: subscriptionRecord() })

    await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.paused', { status: 'paused' }), {
        webhookId: 'msg_paused',
      }),
    )
    expect(h.store.rows.get(TEST_ORG_ID)?.status).toBe('paused')
    expect(h.store.rows.get(TEST_ORG_ID)?.providerSubscriptionId).toBe(
      TEST_SUBSCRIPTION_ID,
    )

    await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.resumed'), {
        webhookId: 'msg_resumed',
      }),
    )
    expect(h.store.rows.get(TEST_ORG_ID)?.status).toBe('active')
    expect(h.tasks.sent).toHaveLength(2)
  })

  it('lets the catch-all update converge instead of resurrecting a revoked row', async () => {
    const h = harness({ record: subscriptionRecord() })
    const revoked = subscriptionBody('subscription.revoked', { status: 'canceled' })

    await handlePolarWebhook(
      h.runtime,
      await delivery(revoked, { webhookId: 'msg_revoked_first' }),
    )
    // Polar sends the catch-all beside the specific event, with its own
    // delivery id and no ordering guarantee.
    await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.updated', { status: 'canceled' }), {
        webhookId: 'msg_updated_after',
      }),
    )

    const row = h.store.rows.get(TEST_ORG_ID)
    expect(row?.planId).toBe('free')
    expect(row?.status).toBe('canceled')
    // Two deliveries, one real change, one notification.
    expect(h.tasks.sent).toHaveLength(1)
  })

  it('turns a paid order into a receipt and ends dunning', async () => {
    const h = harness({ record: subscriptionRecord({ status: 'past_due' }) })

    const response = await handlePolarWebhook(
      h.runtime,
      await delivery(orderBody('order.paid'), { webhookId: 'msg_order_paid' }),
    )

    expect(response.status).toBe(200)
    expect(h.store.rows.get(TEST_ORG_ID)?.status).toBe('active')
    expect(h.tasks.sent).toEqual([
      {
        kind: 'billing.invoice.paid',
        organizationId: TEST_ORG_ID,
        providerOrderId: TEST_ORDER_ID,
        amountPaid: 2800,
        currency: 'usd',
        providerEventId: 'msg_order_paid',
      },
    ])
  })

  it('leaves a healthy subscription alone when its order is paid', async () => {
    const h = harness({ record: subscriptionRecord() })
    const { runtime, store } = counting(h.runtime)

    await handlePolarWebhook(
      runtime,
      await delivery(orderBody('order.paid'), { webhookId: 'msg_order_paid_ok' }),
    )

    expect(store.writes).toBe(0)
    expect(h.tasks.sent).toHaveLength(1)
  })

  it('reads a retrying order as dunning, and converges with subscription.past_due', async () => {
    const h = harness({ record: subscriptionRecord() })
    const pending = {
      status: 'pending',
      next_payment_attempt_at: '2026-08-22T09:00:00Z',
    } as const

    await handlePolarWebhook(
      h.runtime,
      await delivery(orderBody('order.updated', pending), {
        webhookId: 'msg_order_dunning',
      }),
    )
    expect(h.store.rows.get(TEST_ORG_ID)?.status).toBe('past_due')
    expect(h.tasks.sent).toEqual([
      {
        kind: 'billing.subscription.changed',
        organizationId: TEST_ORG_ID,
        planId: 'crew',
        previousPlanId: 'crew',
        status: 'past_due',
        providerEventId: 'msg_order_dunning',
      },
    ])

    // Polar says the same thing again on the subscription. One notification.
    await handlePolarWebhook(
      h.runtime,
      await delivery(subscriptionBody('subscription.past_due', { status: 'past_due' }), {
        webhookId: 'msg_past_due_after',
      }),
    )
    expect(h.tasks.sent).toHaveLength(1)
  })

  it('does not re-open dunning against a subscription that has already ended', async () => {
    const h = harness({ record: subscriptionRecord({ status: 'canceled' }) })
    const { runtime, store } = counting(h.runtime)

    const response = await handlePolarWebhook(
      runtime,
      await delivery(
        orderBody('order.created', {
          status: 'pending',
          next_payment_attempt_at: '2026-08-22T09:00:00Z',
        }),
        { webhookId: 'msg_order_late' },
      ),
    )

    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'ignored',
    })
    expect(store.writes).toBe(0)
    expect(h.tasks.sent).toHaveLength(0)
  })

  it('leaves an order that is merely created alone', async () => {
    const h = harness({ record: subscriptionRecord() })
    const { runtime, store } = counting(h.runtime)

    const response = await handlePolarWebhook(
      runtime,
      await delivery(orderBody('order.created', { status: 'pending' }), {
        webhookId: 'msg_order_created',
      }),
    )

    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'ignored',
    })
    expect(store.writes).toBe(0)
    expect(h.tasks.sent).toHaveLength(0)
  })

  it('drops the cached plan on a refund and writes nothing', async () => {
    const h = harness({ record: subscriptionRecord() })
    const { runtime, store } = counting(h.runtime)
    h.cache.entries.set(planStateCacheKey(TEST_ORG_ID), '{"planId":"crew"}')

    const response = await handlePolarWebhook(
      runtime,
      await delivery(orderBody('order.refunded', { status: 'refunded' }), {
        webhookId: 'msg_refund',
      }),
    )

    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'processed',
    })
    expect(store.writes).toBe(0)
    expect(h.cache.entries.has(planStateCacheKey(TEST_ORG_ID))).toBe(false)
    expect(h.tasks.sent).toHaveLength(0)
  })

  it('claims but does not act on the other checkout events', async () => {
    const h = harness()

    for (const type of ['checkout.created', 'checkout.expired'] as const) {
      const response = await handlePolarWebhook(
        h.runtime,
        await delivery(envelope(type, { id: TEST_CHECKOUT_ID, status: 'open' }), {
          webhookId: `msg_${type}`,
        }),
      )
      await expect(response.json()).resolves.toEqual({
        received: true,
        result: 'ignored',
      })
      expect(h.cache.entries.get(webhookEventCacheKey(`msg_${type}`))).toBe('handled')
    }

    expect(h.store.writes).toHaveLength(0)
  })
})
