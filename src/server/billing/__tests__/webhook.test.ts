/**
 * The webhook endpoint's three contracts: authenticity, idempotency, speed.
 *
 * Signatures are generated with Stripe's own helper on the same WebCrypto
 * provider production verifies with, so a passing test here means a real Stripe
 * delivery verifies too — and a rejected one is rejected for the right reason.
 */

// Must come first: it configures the price ids `#/lib/plans` reads at import.
import { TEST_PRICE_IDS } from './prices.fixture'

import { beforeEach, describe, expect, it } from 'vitest'

import {
  WEBHOOK_CLAIM_TTL_SECONDS,
  handleStripeWebhook,
  processStripeEvent,
  verifyStripeEvent,
  webhookEventCacheKey,
} from '../webhook'
import { WEBHOOK_TOLERANCE_SECONDS } from '../stripe'
import { planStateCacheKey } from '../entitlements'
import { WebhookVerificationError } from '../types'
import {
  TEST_ORG_ID,
  TEST_WEBHOOK_SECRET,
  createHarness,
  signStripePayload,
  subscriptionRecord,
  webhookRequest,
} from './harness'

import type Stripe from 'stripe'

/* ------------------------------------------------------------------ fixtures */

const NOW_SECONDS = Math.floor(Date.parse('2026-08-19T12:00:00.000Z') / 1000)

/**
 * A `customer.subscription.updated` payload, shaped the way the API version we
 * pin actually sends it — period boundaries on the item, not the subscription.
 */
function subscriptionEvent(
  overrides: {
    readonly id?: string
    readonly priceId?: string
    readonly quantity?: number
    readonly status?: string
    readonly organizationId?: string | null
    readonly cancelAtPeriodEnd?: boolean
  } = {},
): string {
  const metadata =
    overrides.organizationId === null
      ? {}
      : { organizationId: overrides.organizationId ?? TEST_ORG_ID }

  return JSON.stringify({
    id: overrides.id ?? 'evt_test_1',
    object: 'event',
    api_version: '2026-07-29.dahlia',
    created: NOW_SECONDS,
    type: 'customer.subscription.updated',
    data: {
      object: {
        id: 'sub_test_1',
        object: 'subscription',
        customer: 'cus_test_1',
        status: overrides.status ?? 'active',
        cancel_at_period_end: overrides.cancelAtPeriodEnd ?? false,
        canceled_at: null,
        trial_end: null,
        metadata,
        items: {
          object: 'list',
          data: [
            {
              id: 'si_test_1',
              object: 'subscription_item',
              price: { id: overrides.priceId ?? TEST_PRICE_IDS.crewMonthly },
              quantity: overrides.quantity ?? 4,
              current_period_start: NOW_SECONDS,
              current_period_end: NOW_SECONDS + 2_592_000,
            },
          ],
        },
      },
    },
  })
}

async function signedRequest(
  payload: string,
  timestamp = NOW_SECONDS,
): Promise<Request> {
  const signature = await signStripePayload(
    payload,
    TEST_WEBHOOK_SECRET,
    timestamp,
  )
  return webhookRequest(payload, { 'stripe-signature': signature })
}

/** The endpoint verifies against its own clock, so tests sign for "now". */
async function freshSignedRequest(payload: string): Promise<Request> {
  return await signedRequest(payload, Math.floor(Date.now() / 1000))
}

/* -------------------------------------------------------------- authenticity */

describe('signature verification', () => {
  it('rejects a payload with no stripe-signature header', async () => {
    const harness = createHarness()
    const response = await handleStripeWebhook(
      harness.runtime,
      webhookRequest(subscriptionEvent()),
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid signature.',
    })
    expect(harness.store.writes).toHaveLength(0)
    expect(harness.tasks.sent).toHaveLength(0)
  })

  it('rejects an empty stripe-signature header', async () => {
    const harness = createHarness()
    const response = await handleStripeWebhook(
      harness.runtime,
      webhookRequest(subscriptionEvent(), { 'stripe-signature': '' }),
    )

    expect(response.status).toBe(400)
    expect(harness.store.writes).toHaveLength(0)
  })

  it('rejects a signature computed with a different secret', async () => {
    const harness = createHarness()
    const payload = subscriptionEvent()
    const signature = await signStripePayload(
      payload,
      'whsec_a_completely_different_secret',
      Math.floor(Date.now() / 1000),
    )

    const response = await handleStripeWebhook(
      harness.runtime,
      webhookRequest(payload, { 'stripe-signature': signature }),
    )

    expect(response.status).toBe(400)
    expect(harness.store.writes).toHaveLength(0)
  })

  it('rejects a payload edited after it was signed', async () => {
    const harness = createHarness()
    const payload = subscriptionEvent()
    const signature = await signStripePayload(
      payload,
      TEST_WEBHOOK_SECRET,
      Math.floor(Date.now() / 1000),
    )
    const tampered = payload.replace('"quantity":4', '"quantity":10')
    expect(tampered).not.toBe(payload)

    const response = await handleStripeWebhook(
      harness.runtime,
      webhookRequest(tampered, { 'stripe-signature': signature }),
    )

    expect(response.status).toBe(400)
    expect(harness.store.writes).toHaveLength(0)
  })

  it('rejects a signature older than the replay tolerance', async () => {
    const harness = createHarness()
    const payload = subscriptionEvent()
    const stale =
      Math.floor(Date.now() / 1000) - (WEBHOOK_TOLERANCE_SECONDS + 60)

    const response = await handleStripeWebhook(
      harness.runtime,
      await signedRequest(payload, stale),
    )

    expect(response.status).toBe(400)
    expect(harness.store.writes).toHaveLength(0)
  })

  it('rejects everything when the endpoint has no signing secret', async () => {
    const harness = createHarness({ webhookSecret: '' })
    const payload = subscriptionEvent()

    await expect(
      verifyStripeEvent(harness.runtime, await freshSignedRequest(payload)),
    ).rejects.toBeInstanceOf(WebhookVerificationError)
  })

  it('accepts a correctly signed payload', async () => {
    const harness = createHarness()
    const event = await verifyStripeEvent(
      harness.runtime,
      await freshSignedRequest(subscriptionEvent()),
    )

    expect(event.id).toBe('evt_test_1')
    expect(event.type).toBe('customer.subscription.updated')
  })

  it('answers 405 to any verb other than POST', async () => {
    const harness = createHarness()
    const response = await handleStripeWebhook(
      harness.runtime,
      new Request('https://planned.travel/api/stripe/webhook', {
        method: 'GET',
      }),
    )

    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('POST')
  })

  it('never lets a rejected payload be cached or answered as handled', async () => {
    const harness = createHarness()
    await handleStripeWebhook(
      harness.runtime,
      webhookRequest(subscriptionEvent()),
    )

    expect(harness.cache.entries.size).toBe(0)
    expect(
      harness.logs.some((log) => log.message === 'billing.webhook.rejected'),
    ).toBe(true)
  })
})

/* --------------------------------------------------------------- idempotency */

describe('redelivery idempotency', () => {
  let harness: ReturnType<typeof createHarness>

  beforeEach(() => {
    harness = createHarness()
  })

  it('persists the subscription on the first delivery', async () => {
    const response = await handleStripeWebhook(
      harness.runtime,
      await freshSignedRequest(subscriptionEvent()),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'processed',
    })

    expect(harness.store.writes).toHaveLength(1)
    const row = harness.store.rows.get(TEST_ORG_ID)
    expect(row?.planId).toBe('crew')
    expect(row?.seats).toBe(4)
    expect(row?.status).toBe('active')
    expect(harness.tasks.sent).toHaveLength(1)
  })

  it('treats a redelivery of the same event id as a no-op', async () => {
    const payload = subscriptionEvent()

    const first = await handleStripeWebhook(
      harness.runtime,
      await freshSignedRequest(payload),
    )
    const second = await handleStripeWebhook(
      harness.runtime,
      await freshSignedRequest(payload),
    )

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    await expect(second.json()).resolves.toEqual({
      received: true,
      result: 'duplicate',
    })

    expect(harness.store.writes).toHaveLength(1)
    expect(harness.tasks.sent).toHaveLength(1)
  })

  it('claims the event id before working and confirms it afterwards', async () => {
    const key = webhookEventCacheKey('evt_test_1')

    const outcome = await processStripeEvent(
      harness.runtime,
      JSON.parse(subscriptionEvent()) as Stripe.Event,
    )

    expect(outcome.result).toBe('processed')
    expect(harness.cache.entries.get(key)).toBe('handled')
    // Claimed, then confirmed — two writes for one event.
    expect(harness.cache.puts).toBe(2)
    expect(WEBHOOK_CLAIM_TTL_SECONDS).toBeLessThan(600)
  })

  it('still applies a different event id for the same subscription', async () => {
    await handleStripeWebhook(
      harness.runtime,
      await freshSignedRequest(subscriptionEvent({ id: 'evt_test_1' })),
    )
    await handleStripeWebhook(
      harness.runtime,
      await freshSignedRequest(
        subscriptionEvent({ id: 'evt_test_2', quantity: 7 }),
      ),
    )

    expect(harness.store.writes).toHaveLength(2)
    expect(harness.store.rows.get(TEST_ORG_ID)?.seats).toBe(7)
  })

  it('releases the claim when a handler fails, so Stripe’s retry can succeed', async () => {
    const failing = createHarness()
    // `invoice.paid` looks the org up through the store; making that throw is the
    // narrowest way to fail one handler without faking the whole runtime.
    const brokenStore = failing.store
    let shouldFail = true
    brokenStore.findByStripeSubscriptionId = async (id: string) => {
      if (shouldFail) throw new Error('D1 is unavailable')
      return subscriptionRecord({ stripeSubscriptionId: id })
    }

    const payload = JSON.stringify({
      id: 'evt_invoice_1',
      object: 'event',
      created: NOW_SECONDS,
      type: 'invoice.paid',
      data: {
        object: {
          id: 'in_test_1',
          object: 'invoice',
          customer: 'cus_test_1',
          currency: 'usd',
          amount_paid: 2800,
          attempt_count: 1,
          next_payment_attempt: null,
          period_start: NOW_SECONDS,
          period_end: NOW_SECONDS,
          parent: { subscription_details: { subscription: 'sub_test_1' } },
        },
      },
    })

    const first = await handleStripeWebhook(
      failing.runtime,
      await freshSignedRequest(payload),
    )
    expect(first.status).toBe(500)
    expect(
      failing.cache.entries.has(webhookEventCacheKey('evt_invoice_1')),
    ).toBe(false)

    shouldFail = false
    const retry = await handleStripeWebhook(
      failing.runtime,
      await freshSignedRequest(payload),
    )
    expect(retry.status).toBe(200)
    await expect(retry.json()).resolves.toEqual({
      received: true,
      result: 'processed',
    })
  })

  it('acknowledges an event type it does not act on', async () => {
    const payload = JSON.stringify({
      id: 'evt_ignored_1',
      object: 'event',
      created: NOW_SECONDS,
      type: 'customer.updated',
      data: { object: { id: 'cus_test_1', object: 'customer' } },
    })

    const response = await handleStripeWebhook(
      harness.runtime,
      await freshSignedRequest(payload),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'ignored',
    })
    expect(harness.store.writes).toHaveLength(0)
  })

  it('ignores a subscription it cannot attribute to an organization', async () => {
    const response = await handleStripeWebhook(
      harness.runtime,
      await freshSignedRequest(
        subscriptionEvent({ id: 'evt_orphan', organizationId: null }),
      ),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'ignored',
    })
    expect(harness.store.writes).toHaveLength(0)
  })

  it('ignores a price this product does not sell', async () => {
    const response = await handleStripeWebhook(
      harness.runtime,
      await freshSignedRequest(
        subscriptionEvent({
          id: 'evt_foreign',
          priceId: 'price_someone_elses_product',
        }),
      ),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      received: true,
      result: 'ignored',
    })
    expect(harness.store.writes).toHaveLength(0)
  })
})

/* --------------------------------------------------------------------- speed */

describe('answering Stripe quickly', () => {
  it('drops the cached plan state so the change is visible immediately', async () => {
    const harness = createHarness()
    harness.cache.entries.set(planStateCacheKey(TEST_ORG_ID), '{"stale":true}')

    await handleStripeWebhook(
      harness.runtime,
      await freshSignedRequest(subscriptionEvent()),
    )

    expect(harness.cache.entries.has(planStateCacheKey(TEST_ORG_ID))).toBe(
      false,
    )
  })

  it('hands the slow follow-up work to the queue rather than doing it inline', async () => {
    const harness = createHarness()

    await handleStripeWebhook(
      harness.runtime,
      await freshSignedRequest(subscriptionEvent()),
    )

    expect(harness.tasks.sent).toEqual([
      {
        kind: 'billing.subscription.changed',
        organizationId: TEST_ORG_ID,
        planId: 'crew',
        previousPlanId: 'free',
        status: 'active',
        stripeEventId: 'evt_test_1',
      },
    ])
  })

  it('still answers 200 when the queue is unavailable', async () => {
    const harness = createHarness()
    harness.tasks.failNext = true

    const response = await handleStripeWebhook(
      harness.runtime,
      await freshSignedRequest(subscriptionEvent()),
    )

    expect(response.status).toBe(200)
    expect(harness.store.writes).toHaveLength(1)
    expect(
      harness.logs.some((log) => log.message === 'billing.task.enqueue_failed'),
    ).toBe(true)
  })
})
