/**
 * Buying a plan on Polar.
 *
 * The load-bearing assertions here are the ones about *money*: that a product id is
 * never taken from the caller, that seats are clamped into the plan's own range and
 * then actually sent — a Crew checkout without `seats` bills ten people as one, and
 * Polar's schema accepts that body without complaint — that only an owner or an admin
 * can spend the organization's money, and that a double-clicked button cannot open two
 * checkouts.
 */

// Must come first: it configures the product ids `#/lib/plans` reads at import.
import { TEST_PRODUCT_IDS } from './prices.fixture'

import { describe, expect, it } from 'vitest'

import {
  CHECKOUT_PATH,
  CUSTOMER_SESSION_PATH,
  applyDiscountToCurrentPlan,
  INVOICE_HISTORY_LIMIT,
  INVOICE_POLL_DELAYS_MS,
  INVOICE_RETRY_AFTER_MS,
  ORDERS_PATH,
  annualisedAmount,
  billingHomeUrl,
  billingMetadata,
  buildCheckoutParams,
  changePlan,
  checkoutIdempotencyKey,
  checkoutReturnUrl,
  checkoutSuccessUrl,
  createCheckoutSession,
  createPortalSession,
  discountAppliedUrl,
  invoiceSummaryOf,
  isEligibleForTrial,
  listRecentInvoices,
  liveSubscriptionId,
  orderInvoiceUrl,
  pendingChangeFor,
  planChangedUrl,
  portalReturnUrl,
  prorationFor,
  resolvePlanSelection,
} from '../checkout'
import {
  assertWithinLimit,
  entitlements,
  planStateCacheKey,
} from '../entitlements'
import { PolarApiError } from '../polar'
import {
  BillingForbiddenError,
  OrderNotInvoiceableError,
  QuotaExceededError,
  billingContext,
} from '../types'
import { PLANS } from '#/lib/plans'
import {
  TEST_APP_URL,
  TEST_CHECKOUT_URL,
  TEST_CUSTOMER_ID,
  TEST_DISCOUNT_ID,
  TEST_INVOICE_PDF_URL,
  TEST_ORDER_ID,
  TEST_ORG_ID,
  TEST_PORTAL_URL,
  TEST_SUBSCRIPTION_ID,
  billingIdentity,
  createHarness,
  invoiceNotRenderedYet,
  polarDiscount,
  polarOrder,
  polarSubscription,
  subscriptionRecord,
} from './harness'

import type { PlanSelection } from '../checkout'
import type { BillingRuntime, PolarRequest } from '../types'

/* ------------------------------------------------------------------- helpers */

function callTo(
  calls: ReadonlyArray<PolarRequest>,
  method: PolarRequest['method'],
  path: string,
): PolarRequest {
  const found = calls.find(
    (call) => call.method === method && call.path === path,
  )
  if (found === undefined) {
    throw new Error(
      `No ${method} ${path} in [${calls.map((c) => `${c.method} ${c.path}`).join(', ')}]`,
    )
  }
  return found
}

function bodyOf(request: PolarRequest): Record<string, unknown> {
  const body = request.body
  if (typeof body !== 'object' || body === null) {
    throw new Error(`${request.method} ${request.path} carried no object body.`)
  }
  return body as Record<string, unknown>
}

/** A sleep that records what it was asked to wait and waits none of it. */
function recordingSleep(): {
  sleep: (ms: number) => Promise<void>
  waits: Array<number>
} {
  const waits: Array<number> = []
  return {
    waits,
    sleep: async (ms) => {
      waits.push(ms)
    },
  }
}

/** Seeds a plan-state entry so an invalidation has something to remove. */
function warmPlanCache(harness: ReturnType<typeof createHarness>): string {
  const key = planStateCacheKey(TEST_ORG_ID)
  harness.cache.entries.set(key, '{"planId":"crew"}')
  return key
}

type Harness = ReturnType<typeof createHarness>

/**
 * Records the order of the two side effects a plan change owes, so a test can prove
 * the row is written *before* the key is dropped and not merely that both happened.
 */
function sideEffectOrder(harness: Harness): Array<'upsert' | 'delete'> {
  const order: Array<'upsert' | 'delete'> = []
  const upsert = harness.store.upsert.bind(harness.store)
  const remove = harness.cache.delete.bind(harness.cache)

  harness.store.upsert = async (record) => {
    order.push('upsert')
    await upsert(record)
  }
  harness.cache.delete = async (key) => {
    order.push('delete')
    await remove(key)
  }

  return order
}

/**
 * A runtime whose Polar answers each PATCH differently, which the shared stub
 * cannot do — and which is the only way to tell "we persisted the last response"
 * apart from "we persisted a response".
 */
function withScriptedPolar(
  harness: Harness,
  answers: ReadonlyArray<unknown | Error>,
): { runtime: BillingRuntime; calls: Array<PolarRequest> } {
  const calls: Array<PolarRequest> = []
  let index = 0

  const runtime: BillingRuntime = {
    ...harness.runtime,
    polar: {
      async request(request: PolarRequest): Promise<unknown> {
        calls.push(request)
        const answer = answers[Math.min(index, answers.length - 1)]
        index += 1
        if (answer instanceof Error) throw answer
        return answer
      },
    },
  }

  return { runtime, calls }
}

const SOLO_RECORD = () =>
  subscriptionRecord({
    planId: 'solo',
    interval: 'monthly',
    seats: 1,
    providerProductId: TEST_PRODUCT_IDS.soloMonthly,
  })

/* ----------------------------------------------------------------- selection */

describe('resolvePlanSelection', () => {
  it('resolves the product from the catalogue, never from the caller', () => {
    const selection = resolvePlanSelection({
      planId: 'solo',
      interval: 'yearly',
    })

    expect(selection.price.productId).toBe(TEST_PRODUCT_IDS.soloYearly)
    expect(selection.price.amount).toBe(PLANS.solo.prices.yearly?.amount)
  })

  it('refuses the Free plan, which is not something Polar can sell', () => {
    expect(() =>
      resolvePlanSelection({
        planId: 'free',
        interval: 'monthly',
      } as unknown as Parameters<typeof resolvePlanSelection>[0]),
    ).toThrow()
  })

  it('refuses a plan id that is not in the catalogue at all', () => {
    expect(() =>
      resolvePlanSelection({
        planId: 'enterprise',
        interval: 'monthly',
      } as unknown as Parameters<typeof resolvePlanSelection>[0]),
    ).toThrow()
  })

  it('clamps a seat count below the plan minimum up to it', () => {
    const selection = resolvePlanSelection({
      planId: 'crew',
      interval: 'monthly',
      seats: 1,
    })

    expect(selection.seats).toBe(PLANS.crew.seatRange.min)
  })

  it('clamps a seat count above the plan maximum down to it', () => {
    const selection = resolvePlanSelection({
      planId: 'crew',
      interval: 'monthly',
      seats: 900,
    })

    expect(selection.seats).toBe(PLANS.crew.seatRange.max)
  })

  it('ignores a seat count sent for a plan that is not billed per seat', () => {
    const selection = resolvePlanSelection({
      planId: 'solo',
      interval: 'monthly',
      seats: 9,
    })

    expect(selection.seats).toBe(1)
    expect(selection.price.perSeat).toBe(false)
  })
})

/* ---------------------------------------------------------------------- urls */

describe('return urls', () => {
  it('brings the customer back to the billing screen with an outcome', () => {
    expect(checkoutSuccessUrl(TEST_APP_URL)).toBe(
      'https://planned.travel/settings/billing?checkout=complete&checkout_id={CHECKOUT_ID}',
    )
    expect(checkoutReturnUrl(TEST_APP_URL)).toBe(
      'https://planned.travel/settings/billing?checkout=cancelled',
    )
    expect(portalReturnUrl(TEST_APP_URL)).toBe(
      'https://planned.travel/settings/billing?portal=complete',
    )
    expect(planChangedUrl(TEST_APP_URL)).toBe(
      'https://planned.travel/settings/billing?plan=changed',
    )
    // Deliberately bare: the screen keys every alert off a search parameter, so the
    // absence of one is the absence of a claim.
    expect(billingHomeUrl(TEST_APP_URL)).toBe(
      'https://planned.travel/settings/billing',
    )
  })

  it('uses Polar’s own interpolation token, not another provider’s', () => {
    const url = checkoutSuccessUrl(TEST_APP_URL)
    expect(url).toContain('checkout_id={CHECKOUT_ID}')
    expect(url).not.toContain('CHECKOUT_SESSION_ID')
  })
})

/* -------------------------------------------------------------- idempotency */

describe('checkoutIdempotencyKey', () => {
  const selection = resolvePlanSelection({
    planId: 'crew',
    interval: 'monthly',
    seats: 4,
  })

  it('collapses two identical requests made inside the same window', () => {
    const first = checkoutIdempotencyKey(
      TEST_ORG_ID,
      selection,
      new Date(960_000),
    )
    const second = checkoutIdempotencyKey(
      TEST_ORG_ID,
      selection,
      new Date(1_019_999),
    )

    expect(second).toBe(first)
  })

  it('lets a customer who came back later start again', () => {
    const first = checkoutIdempotencyKey(
      TEST_ORG_ID,
      selection,
      new Date(960_000),
    )
    const later = checkoutIdempotencyKey(
      TEST_ORG_ID,
      selection,
      new Date(4_600_000),
    )

    expect(later).not.toBe(first)
  })

  it('opens a new window rather than reusing an expired session', () => {
    const before = checkoutIdempotencyKey(
      TEST_ORG_ID,
      selection,
      new Date(1_019_999),
    )
    const after = checkoutIdempotencyKey(
      TEST_ORG_ID,
      selection,
      new Date(1_020_000),
    )

    expect(after).not.toBe(before)
  })

  it('separates a different plan, interval, seat count or organization', () => {
    const at = new Date(960_000)
    const base = checkoutIdempotencyKey(TEST_ORG_ID, selection, at)

    expect(checkoutIdempotencyKey('org_other', selection, at)).not.toBe(base)
    expect(
      checkoutIdempotencyKey(TEST_ORG_ID, { ...selection, seats: 5 }, at),
    ).not.toBe(base)
    expect(
      checkoutIdempotencyKey(
        TEST_ORG_ID,
        resolvePlanSelection({ planId: 'crew', interval: 'yearly', seats: 4 }),
        at,
      ),
    ).not.toBe(base)
  })
})

/* ----------------------------------------------------------- checkout params */

describe('buildCheckoutParams', () => {
  const crew: PlanSelection = resolvePlanSelection({
    planId: 'crew',
    interval: 'monthly',
    seats: 4,
  })
  const solo: PlanSelection = resolvePlanSelection({
    planId: 'solo',
    interval: 'monthly',
  })

  function params(selection: PlanSelection, trialDays = 0) {
    return buildCheckoutParams({
      appUrl: TEST_APP_URL,
      organizationId: TEST_ORG_ID,
      customerEmail: 'owner@example.com',
      customerName: 'Test Expeditions',
      selection,
      trialDays,
    })
  }

  it('names the product as an array of UUIDs and the org as the customer', () => {
    const body = params(crew)

    expect(body.products).toEqual([TEST_PRODUCT_IDS.crewMonthly])
    expect(body.external_customer_id).toBe(TEST_ORG_ID)
    expect(body.currency).toBe('usd')
    expect(body.success_url).toBe(checkoutSuccessUrl(TEST_APP_URL))
  })

  it('carries the organization, plan and interval in metadata', () => {
    expect(params(crew).metadata).toEqual({
      organizationId: TEST_ORG_ID,
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })
  })

  it('bills a seat-based plan for its seats, inside its own range', () => {
    const body = params(crew)

    expect(body.seats).toBe(crew.seats)
    expect(body.min_seats).toBe(2)
    expect(body.max_seats).toBe(10)
    expect(body.min_seats).toBe(PLANS.crew.seatRange.min)
    expect(body.max_seats).toBe(PLANS.crew.seatRange.max)
  })

  it('sends no seat fields at all for a flat plan', () => {
    const body = params(solo)

    expect(body).not.toHaveProperty('seats')
    expect(body).not.toHaveProperty('min_seats')
    expect(body).not.toHaveProperty('max_seats')
  })

  it('asks Polar for the trial in days, and refuses a second one', () => {
    const offered = params(crew, 14)
    expect(offered.allow_trial).toBe(true)
    expect(offered.trial_interval).toBe('day')
    expect(offered.trial_interval_count).toBe(14)

    const withheld = params(crew, 0)
    expect(withheld.allow_trial).toBe(false)
    expect(withheld).not.toHaveProperty('trial_interval')
    expect(withheld).not.toHaveProperty('trial_interval_count')
  })

  it('renames the two parameters Polar still has', () => {
    const body = params(crew)

    expect(body.allow_discount_codes).toBe(true)
    expect(body.require_billing_address).toBe(false)
    expect(body).not.toHaveProperty('allow_promotion_codes')
    expect(body).not.toHaveProperty('billing_address_collection')
  })

  it('drops every parameter that has no Polar counterpart', () => {
    const body = params(crew, 14)

    for (const dropped of [
      'mode',
      'line_items',
      'client_reference_id',
      'subscription_data',
      'automatic_tax',
      'tax_id_collection',
      'customer_update',
      'payment_method_collection',
      'cancel_url',
    ]) {
      expect(body).not.toHaveProperty(dropped)
    }
  })
})

describe('billingMetadata', () => {
  it('keeps the seat count an integer, because Polar metadata is typed', () => {
    const selection = resolvePlanSelection({
      planId: 'crew',
      interval: 'yearly',
      seats: 7,
    })

    expect(billingMetadata(TEST_ORG_ID, selection).seats).toBe(7)
  })
})

/* ------------------------------------------------------------------- trials */

describe('trial eligibility', () => {
  it('offers a trial to an organization that has never subscribed', () => {
    expect(isEligibleForTrial(null)).toBe(true)
    expect(
      isEligibleForTrial(subscriptionRecord({ providerSubscriptionId: null })),
    ).toBe(true)
  })

  it('never offers a second trial', () => {
    expect(isEligibleForTrial(subscriptionRecord())).toBe(false)
    expect(
      isEligibleForTrial(
        subscriptionRecord({
          providerSubscriptionId: null,
          trialEndsAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
    ).toBe(false)
  })
})

describe('liveSubscriptionId', () => {
  it('finds the subscription only while its status still entitles it', () => {
    expect(liveSubscriptionId(subscriptionRecord())).toBe(TEST_SUBSCRIPTION_ID)
    expect(liveSubscriptionId(subscriptionRecord({ status: 'past_due' }))).toBe(
      TEST_SUBSCRIPTION_ID,
    )
    expect(
      liveSubscriptionId(subscriptionRecord({ status: 'canceled' })),
    ).toBeNull()
    expect(
      liveSubscriptionId(subscriptionRecord({ providerSubscriptionId: null })),
    ).toBeNull()
    expect(liveSubscriptionId(null)).toBeNull()
  })
})

/* ------------------------------------------------------------------ checkout */

describe('createCheckoutSession', () => {
  it('posts to /v1/checkouts/ and hands back the URL Polar returned', async () => {
    const harness = createHarness()

    const redirect = await createCheckoutSession(
      harness.runtime,
      billingIdentity(),
      { planId: 'crew', interval: 'monthly', seats: 4 },
    )

    expect(redirect).toEqual({ url: TEST_CHECKOUT_URL, surface: 'checkout' })

    const call = callTo(harness.calls, 'POST', CHECKOUT_PATH)
    const body = bodyOf(call)
    expect(body.products).toEqual([TEST_PRODUCT_IDS.crewMonthly])
    expect(body.external_customer_id).toBe(TEST_ORG_ID)
    expect(body.seats).toBe(4)
  })

  it('never touches a checkout-sessions path', async () => {
    const harness = createHarness()

    await createCheckoutSession(harness.runtime, billingIdentity(), {
      planId: 'solo',
      interval: 'monthly',
    })

    for (const call of harness.calls) {
      expect(call.path).not.toContain('checkout-sessions')
    }
  })

  it('creates no customer up front — external_customer_id does that job', async () => {
    const harness = createHarness()

    await createCheckoutSession(harness.runtime, billingIdentity(), {
      planId: 'solo',
      interval: 'monthly',
    })

    expect(harness.calls.map((call) => call.path)).toEqual([CHECKOUT_PATH])
  })

  it('sends a first-time subscriber to checkout with their trial', async () => {
    const harness = createHarness()

    await createCheckoutSession(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })

    const body = bodyOf(callTo(harness.calls, 'POST', CHECKOUT_PATH))
    expect(body.allow_trial).toBe(true)
    expect(body.trial_interval_count).toBe(PLANS.crew.trialDays)
  })

  it('withholds the trial from a workspace that has already had one', async () => {
    const harness = createHarness({
      record: subscriptionRecord({ status: 'canceled' }),
    })

    await createCheckoutSession(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })

    const body = bodyOf(callTo(harness.calls, 'POST', CHECKOUT_PATH))
    expect(body.allow_trial).toBe(false)
  })

  it('collapses a double-clicked button onto one checkout', async () => {
    const harness = createHarness()

    const first = await createCheckoutSession(
      harness.runtime,
      billingIdentity(),
      { planId: 'solo', interval: 'monthly' },
    )
    const second = await createCheckoutSession(
      harness.runtime,
      billingIdentity(),
      { planId: 'solo', interval: 'monthly' },
    )

    expect(second).toEqual(first)
    expect(harness.calls).toHaveLength(1)
  })

  it('opens a fresh checkout once the window has rolled over', async () => {
    const harness = createHarness({ now: new Date('2025-03-04T09:17:00.000Z') })

    await createCheckoutSession(harness.runtime, billingIdentity(), {
      planId: 'solo',
      interval: 'monthly',
    })
    harness.setNow(new Date('2025-03-04T09:19:00.000Z'))
    await createCheckoutSession(harness.runtime, billingIdentity(), {
      planId: 'solo',
      interval: 'monthly',
    })

    expect(harness.calls).toHaveLength(2)
  })

  it('refuses a member who is not allowed to spend the workspace’s money', async () => {
    const harness = createHarness()

    await expect(
      createCheckoutSession(
        harness.runtime,
        billingIdentity({ role: 'member' }),
        { planId: 'solo', interval: 'monthly' },
      ),
    ).rejects.toBeInstanceOf(BillingForbiddenError)

    expect(harness.calls).toHaveLength(0)
  })

  it('allows an admin as well as an owner', async () => {
    const harness = createHarness()

    await expect(
      createCheckoutSession(
        harness.runtime,
        billingIdentity({ role: 'admin' }),
        { planId: 'solo', interval: 'monthly' },
      ),
    ).resolves.toMatchObject({ surface: 'checkout' })
  })

  it('fails loudly rather than redirecting nowhere', async () => {
    const harness = createHarness({
      polar: { checkout: { id: 'x', status: 'open', product_id: 'y' } },
    })

    await expect(
      createCheckoutSession(harness.runtime, billingIdentity(), {
        planId: 'solo',
        interval: 'monthly',
      }),
    ).rejects.toThrow()
  })
})

/* -------------------------------------------------------------------- portal */

describe('createPortalSession', () => {
  it('mints a customer session against the organization id', async () => {
    const harness = createHarness({ record: subscriptionRecord() })

    const redirect = await createPortalSession(
      harness.runtime,
      billingIdentity(),
    )

    expect(redirect).toEqual({ url: TEST_PORTAL_URL, surface: 'portal' })

    const body = bodyOf(callTo(harness.calls, 'POST', CUSTOMER_SESSION_PATH))
    expect(body.external_customer_id).toBe(TEST_ORG_ID)
    expect(body.return_url).toBe(portalReturnUrl(TEST_APP_URL))
    expect(body).not.toHaveProperty('flow_data')
  })

  it('explains itself when there is no billing profile yet', async () => {
    const harness = createHarness()

    await expect(
      createPortalSession(harness.runtime, billingIdentity()),
    ).rejects.toThrow('no billing profile')
    expect(harness.calls).toHaveLength(0)
  })

  it('refuses a member', async () => {
    const harness = createHarness({ record: subscriptionRecord() })

    await expect(
      createPortalSession(harness.runtime, billingIdentity({ role: 'member' })),
    ).rejects.toBeInstanceOf(BillingForbiddenError)
  })
})

/* -------------------------------------------------------------- plan changes */

describe('proration', () => {
  it('prices a year of a plan at the seats it is billed for', () => {
    expect(annualisedAmount('crew', 'monthly', 4)).toBe(700 * 12 * 4)
    expect(annualisedAmount('crew', 'yearly', 4)).toBe(7000 * 4)
    expect(annualisedAmount('solo', 'monthly', 9)).toBe(900 * 12)
    expect(annualisedAmount('free', null, 1)).toBe(0)
  })

  it('invoices an upgrade now and defers a downgrade to the next period', () => {
    const crew4 = subscriptionRecord({ seats: 4 })

    expect(
      prorationFor(
        crew4,
        resolvePlanSelection({ planId: 'crew', interval: 'monthly', seats: 8 }),
      ),
    ).toBe('invoice')
    expect(
      prorationFor(
        crew4,
        resolvePlanSelection({ planId: 'solo', interval: 'yearly' }),
      ),
    ).toBe('next_period')
    expect(
      prorationFor(
        crew4,
        resolvePlanSelection({ planId: 'crew', interval: 'monthly', seats: 4 }),
      ),
    ).toBe('prorate')
  })
})

describe('changePlan', () => {
  it('patches the subscription onto the new product', async () => {
    const harness = createHarness({ record: subscriptionRecord() })

    const redirect = await changePlan(harness.runtime, billingIdentity(), {
      planId: 'solo',
      interval: 'yearly',
    })

    expect(redirect).toEqual({
      url: planChangedUrl(TEST_APP_URL),
      surface: 'applied',
    })

    const call = callTo(
      harness.calls,
      'PATCH',
      `/v1/subscriptions/${TEST_SUBSCRIPTION_ID}`,
    )
    expect(bodyOf(call)).toEqual({
      product_id: TEST_PRODUCT_IDS.soloYearly,
      proration_behavior: 'next_period',
    })
  })

  it('changes seats on their own variant, never alongside the product', async () => {
    const harness = createHarness({ record: subscriptionRecord({ seats: 4 }) })

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 8,
    })

    expect(harness.calls).toHaveLength(1)
    expect(bodyOf(harness.calls[0])).toEqual({
      seats: 8,
      proration_behavior: 'invoice',
    })
  })

  it('sends the product first and the seats second when both move', async () => {
    const harness = createHarness({ record: subscriptionRecord({ seats: 4 }) })

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'yearly',
      seats: 9,
    })

    const patches = harness.calls.filter((call) => call.method === 'PATCH')
    expect(patches).toHaveLength(2)
    expect(bodyOf(patches[0])).toHaveProperty(
      'product_id',
      TEST_PRODUCT_IDS.crewYearly,
    )
    expect(bodyOf(patches[1])).toHaveProperty('seats', 9)
  })

  it('asks Polar for nothing when nothing actually changed', async () => {
    const harness = createHarness({ record: subscriptionRecord({ seats: 4 }) })
    const key = warmPlanCache(harness)

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })

    expect(harness.calls).toHaveLength(0)
    // Nothing was written, so nothing may be evicted: a no-op that cleared the
    // cache would make every visit to the screen a cold D1 read.
    expect(harness.cache.entries.has(key)).toBe(true)
    expect(harness.cache.deletes).toBe(0)
  })

  it('drops the cached plan state before redirecting to the billing screen', async () => {
    const harness = createHarness({ record: subscriptionRecord() })
    const key = warmPlanCache(harness)

    const redirect = await changePlan(harness.runtime, billingIdentity(), {
      planId: 'solo',
      interval: 'yearly',
    })

    // ARCHITECTURE §4 rule 2. The URL below is our own billing screen, so a plan
    // state left in KV would render the plan we just moved off for the whole TTL.
    expect(redirect).toMatchObject({ url: planChangedUrl(TEST_APP_URL) })
    expect(harness.cache.entries.has(key)).toBe(false)
    expect(harness.cache.deletes).toBe(1)
  })

  it('drops the cached plan state on a seats-only change too', async () => {
    const harness = createHarness({ record: subscriptionRecord({ seats: 4 }) })
    const key = warmPlanCache(harness)

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 8,
    })

    expect(harness.cache.entries.has(key)).toBe(false)
  })

  it('resolves the new product on the server even when the seats are absurd', async () => {
    const harness = createHarness({ record: subscriptionRecord({ seats: 4 }) })

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 999,
    })

    expect(bodyOf(harness.calls[0])).toHaveProperty(
      'seats',
      PLANS.crew.seatRange.max,
    )
  })

  it('falls back to checkout when the old subscription no longer entitles anything', async () => {
    const harness = createHarness({
      record: subscriptionRecord({ status: 'canceled' }),
    })

    const redirect = await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 3,
    })

    expect(redirect.surface).toBe('checkout')
    expect(callTo(harness.calls, 'POST', CHECKOUT_PATH)).toBeDefined()
  })

  it('refuses a member outright', async () => {
    const harness = createHarness({ record: subscriptionRecord() })

    await expect(
      changePlan(harness.runtime, billingIdentity({ role: 'member' }), {
        planId: 'solo',
        interval: 'monthly',
      }),
    ).rejects.toBeInstanceOf(BillingForbiddenError)
  })
})

/* ------------------------------------------------------- promotion codes */

describe('promotion codes', () => {
  const SUBSCRIPTION_PATH = `/v1/subscriptions/${TEST_SUBSCRIPTION_ID}`

  function patchBodies(calls: ReadonlyArray<PolarRequest>) {
    return calls
      .filter((call) => call.method === 'PATCH')
      .map((call) => bodyOf(call))
  }

  it('attaches the resolved discount to the checkout by id', async () => {
    const harness = createHarness({ polar: { discounts: [polarDiscount()] } })

    const result = await createCheckoutSession(
      harness.runtime,
      billingIdentity(),
      {
        planId: 'crew',
        interval: 'monthly',
        seats: 4,
        discountCode: 'summer20',
      },
    )

    expect(result).toEqual({ url: TEST_CHECKOUT_URL, surface: 'checkout' })
    const body = bodyOf(callTo(harness.calls, 'POST', CHECKOUT_PATH))
    expect(body.discount_id).toBe(TEST_DISCOUNT_ID)
    expect(body.allow_discount_codes).toBe(true)
  })

  it('sends no discount key on a checkout without a code', async () => {
    const harness = createHarness()

    await createCheckoutSession(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })

    expect(
      bodyOf(callTo(harness.calls, 'POST', CHECKOUT_PATH)),
    ).not.toHaveProperty('discount_id')
  })

  it('refuses a checkout with a code it cannot find, and opens nothing', async () => {
    const harness = createHarness({ polar: { discounts: [] } })

    const result = await createCheckoutSession(
      harness.runtime,
      billingIdentity(),
      {
        planId: 'crew',
        interval: 'monthly',
        seats: 4,
        discountCode: 'NOPE123',
      },
    )

    expect(result).toEqual({ surface: 'discount_rejected', reason: 'invalid' })
    expect(harness.calls.some((call) => call.path === CHECKOUT_PATH)).toBe(
      false,
    )
  })

  it('keys the checkout by the discount, so a cached uncoded one is not reused', () => {
    const selection = resolvePlanSelection({
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })
    const now = new Date(960_000)

    expect(checkoutIdempotencyKey(TEST_ORG_ID, selection, now)).not.toBe(
      checkoutIdempotencyKey(TEST_ORG_ID, selection, now, TEST_DISCOUNT_ID),
    )
    expect(checkoutIdempotencyKey(TEST_ORG_ID, selection, now, null)).toBe(
      checkoutIdempotencyKey(TEST_ORG_ID, selection, now),
    )
  })

  it('marks a plan change that carried a code, and a code on its own', () => {
    expect(planChangedUrl(TEST_APP_URL, true)).toBe(
      `${TEST_APP_URL}/settings/billing?plan=changed&discount=applied`,
    )
    expect(discountAppliedUrl(TEST_APP_URL)).toBe(
      `${TEST_APP_URL}/settings/billing?discount=applied`,
    )
  })

  it('writes nothing to the subscription when the code is refused', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: {
        discounts: [
          polarDiscount({ products: [{ id: TEST_PRODUCT_IDS.soloMonthly }] }),
        ],
      },
    })

    const result = await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'yearly',
      seats: 4,
      discountCode: 'SUMMER20',
    })

    expect(result).toEqual({
      surface: 'discount_rejected',
      reason: 'not_applicable',
    })
    expect(patchBodies(harness.calls)).toEqual([])
  })

  it('attaches a code to the plan in force on its own', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: { discounts: [polarDiscount()] },
    })

    const result = await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
      discountCode: 'SUMMER20',
    })

    expect(result).toEqual({
      url: discountAppliedUrl(TEST_APP_URL),
      surface: 'discount_applied',
    })
    expect(patchBodies(harness.calls)).toEqual([
      { discount_id: TEST_DISCOUNT_ID },
    ])
  })

  it('attaches the code before the product, and reads no subscription for it', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: { discounts: [polarDiscount()] },
    })

    const result = await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'yearly',
      seats: 4,
      discountCode: 'SUMMER20',
    })

    expect(result).toEqual({
      url: planChangedUrl(TEST_APP_URL, true),
      surface: 'applied',
    })
    expect(patchBodies(harness.calls)).toEqual([
      { discount_id: TEST_DISCOUNT_ID },
      {
        product_id: TEST_PRODUCT_IDS.crewYearly,
        proration_behavior: 'next_period',
      },
    ])
    expect(
      harness.calls.some(
        (call) => call.method === 'GET' && call.path === SUBSCRIPTION_PATH,
      ),
    ).toBe(false)
  })

  it('attaches the code before the seats, never inside the seats body', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: { discounts: [polarDiscount()] },
    })

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 8,
      discountCode: 'SUMMER20',
    })

    expect(patchBodies(harness.calls)).toEqual([
      { discount_id: TEST_DISCOUNT_ID },
      { seats: 8, proration_behavior: 'invoice' },
    ])
  })

  it('orders code, product, seats when all three move', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: { discounts: [polarDiscount()] },
    })

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'yearly',
      seats: 9,
      discountCode: 'SUMMER20',
    })

    expect(
      patchBodies(harness.calls).map((body) => Object.keys(body)[0]),
    ).toEqual(['discount_id', 'product_id', 'seats'])
  })

  it('carries a code that excludes the product in force inside the product PATCH', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: {
        discounts: [
          polarDiscount({ products: [{ id: TEST_PRODUCT_IDS.crewYearly }] }),
        ],
      },
    })

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'yearly',
      seats: 4,
      discountCode: 'SUMMER20',
    })

    expect(patchBodies(harness.calls)).toEqual([
      {
        product_id: TEST_PRODUCT_IDS.crewYearly,
        proration_behavior: 'next_period',
        discount_id: TEST_DISCOUNT_ID,
      },
    ])
  })

  it('tells the customer invalid when Polar refuses the code, and moves nothing', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: {
        discounts: [polarDiscount()],
        rejectPatch: (body) =>
          typeof body === 'object' && body !== null && 'product_id' in body
            ? null
            : new PolarApiError(422, '{"detail":"expired"}', 'Unprocessable'),
      },
    })

    const result = await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'yearly',
      seats: 4,
      discountCode: 'SUMMER20',
    })

    expect(result).toEqual({ surface: 'discount_rejected', reason: 'invalid' })
    expect(patchBodies(harness.calls)).toEqual([
      { discount_id: TEST_DISCOUNT_ID },
    ])
    expect(
      harness.logs.find(
        (entry) => entry.message === 'billing.discount.rejected',
      )?.fields,
    ).toMatchObject({
      reason: 'refused_by_polar',
      discountId: TEST_DISCOUNT_ID,
    })
    expect(harness.store.writes).toHaveLength(0)
  })

  it('tells the customer invalid when a code carried in the product PATCH ran out since the lookup', async () => {
    const restricted = polarDiscount({
      products: [{ id: TEST_PRODUCT_IDS.crewYearly }],
    })
    const catalogue = [restricted]
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: {
        discounts: catalogue,
        rejectPatch: () => {
          // The last redemption went to someone else between the lookup and this PATCH.
          catalogue[0] = {
            ...restricted,
            max_redemptions: 1,
            redemptions_count: 1,
          }
          return new PolarApiError(
            422,
            '{"detail":"exhausted"}',
            'Unprocessable',
          )
        },
      },
    })

    const result = await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'yearly',
      seats: 4,
      discountCode: 'SUMMER20',
    })

    expect(result).toEqual({ surface: 'discount_rejected', reason: 'invalid' })
    expect(
      harness.logs.find(
        (entry) => entry.message === 'billing.discount.rejected',
      )?.fields,
    ).toMatchObject({
      reason: 'refused_by_polar',
      discountId: TEST_DISCOUNT_ID,
    })
    expect(harness.store.writes).toHaveLength(0)
  })

  it('leaves a product PATCH 422 to the product when the carried code still fits', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: {
        discounts: [
          polarDiscount({ products: [{ id: TEST_PRODUCT_IDS.crewYearly }] }),
        ],
        rejectPatch: () =>
          new PolarApiError(422, '{"detail":"seats"}', 'Unprocessable'),
      },
    })

    await expect(
      changePlan(harness.runtime, billingIdentity(), {
        planId: 'crew',
        interval: 'yearly',
        seats: 4,
        discountCode: 'SUMMER20',
      }),
    ).rejects.toMatchObject({ status: 422 })
    expect(harness.store.writes).toHaveLength(0)
  })

  it('clears a restricted discount that would not fit the new product', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: {
        subscriptionRead: polarSubscription({
          discount: {
            id: TEST_DISCOUNT_ID,
            products: [{ id: TEST_PRODUCT_IDS.crewMonthly }],
          },
        }),
      },
    })

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'solo',
      interval: 'yearly',
    })

    expect(patchBodies(harness.calls)).toEqual([
      {
        product_id: TEST_PRODUCT_IDS.soloYearly,
        proration_behavior: 'next_period',
        discount_id: null,
      },
    ])
  })

  it('reads the discount itself when the subscription embeds it without products', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: {
        discounts: [polarDiscount()],
        subscriptionRead: polarSubscription({
          discount: { id: TEST_DISCOUNT_ID },
        }),
      },
    })

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'solo',
      interval: 'yearly',
    })

    callTo(harness.calls, 'GET', `/v1/discounts/${TEST_DISCOUNT_ID}`)
    // Unrestricted, so it follows the customer: the key is omitted, not nulled.
    expect(patchBodies(harness.calls)).toEqual([
      {
        product_id: TEST_PRODUCT_IDS.soloYearly,
        proration_behavior: 'next_period',
      },
    ])
  })
})

describe('promotion codes, when Polar says no', () => {
  const embeddedWithoutProducts = () =>
    polarSubscription({ discount: { id: TEST_DISCOUNT_ID } })

  it.each([
    [
      'a token without discounts:read',
      new PolarApiError(403, '{}', 'Forbidden'),
    ],
    ['a discount deleted since', null],
  ] as const)(
    'still moves an uncoded plan when the current discount is unreadable: %s',
    async (_, discountError) => {
      const harness = createHarness({
        record: subscriptionRecord(),
        polar: {
          // No catalogue entry: the by-id read answers 404.
          discounts: [],
          subscriptionRead: embeddedWithoutProducts(),
          ...(discountError === null ? {} : { discountError }),
        },
      })

      const result = await changePlan(harness.runtime, billingIdentity(), {
        planId: 'solo',
        interval: 'yearly',
      })

      expect(result).toMatchObject({ surface: 'applied' })
      const patches = harness.calls.filter((call) => call.method === 'PATCH')
      expect(patches).toHaveLength(1)
      expect(bodyOf(patches[0])).not.toHaveProperty('discount_id')
      expect(
        harness.logs.find(
          (entry) => entry.message === 'billing.discount.current_unreadable',
        )?.fields,
      ).toMatchObject({ discountId: TEST_DISCOUNT_ID })
    },
  )

  it('says the code stayed when the product PATCH after it fails', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: {
        discounts: [polarDiscount()],
        rejectPatch: (body) =>
          typeof body === 'object' && body !== null && 'product_id' in body
            ? new PolarApiError(500, '{}', 'Polar PATCH failed with 500.')
            : null,
      },
    })
    const key = warmPlanCache(harness)

    await expect(
      changePlan(harness.runtime, billingIdentity(), {
        planId: 'crew',
        interval: 'yearly',
        seats: 4,
        discountCode: 'SUMMER20',
      }),
    ).rejects.toMatchObject({ status: 500 })

    expect(harness.store.writes).toHaveLength(0)
    expect(harness.cache.entries.has(key)).toBe(false)
    expect(
      harness.logs.find(
        (entry) => entry.message === 'billing.plan_change.discount_kept',
      )?.fields,
    ).toMatchObject({ discountId: TEST_DISCOUNT_ID })
  })

  it('keeps a booked downgrade when only a code is attached', async () => {
    const booked = {
      planId: 'solo' as const,
      interval: 'monthly' as const,
      effectiveAt: new Date('2026-09-01T00:00:00.000Z'),
    }
    const harness = createHarness({
      record: subscriptionRecord({ pendingChange: booked }),
      polar: { discounts: [polarDiscount()] },
    })

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
      discountCode: 'SUMMER20',
    })

    expect(harness.store.writes.at(-1)?.pendingChange).toEqual(booked)
  })
})

describe('applyDiscountToCurrentPlan', () => {
  it('sends only the code, whatever plan the page thought was current', async () => {
    const harness = createHarness({
      record: subscriptionRecord({ seats: 6 }),
      polar: { discounts: [polarDiscount()] },
    })

    const result = await applyDiscountToCurrentPlan(
      harness.runtime,
      billingIdentity(),
      { discountCode: 'summer20' },
    )

    expect(result).toEqual({
      url: discountAppliedUrl(TEST_APP_URL),
      surface: 'discount_applied',
    })
    expect(
      harness.calls
        .filter((call) => call.method === 'PATCH')
        .map((call) => bodyOf(call)),
    ).toEqual([{ discount_id: TEST_DISCOUNT_ID }])
    expect(harness.store.writes).toHaveLength(1)
  })

  it('checks the code against the product in force', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: {
        discounts: [
          polarDiscount({ products: [{ id: TEST_PRODUCT_IDS.soloMonthly }] }),
        ],
      },
    })

    const result = await applyDiscountToCurrentPlan(
      harness.runtime,
      billingIdentity(),
      { discountCode: 'SUMMER20' },
    )

    expect(result).toEqual({
      surface: 'discount_rejected',
      reason: 'not_applicable',
    })
    expect(harness.calls.some((call) => call.method === 'PATCH')).toBe(false)
  })

  it('refuses without a live subscription, and looks nothing up', async () => {
    const harness = createHarness({
      record: subscriptionRecord({ status: 'canceled' }),
      polar: { discounts: [polarDiscount()] },
    })

    const result = await applyDiscountToCurrentPlan(
      harness.runtime,
      billingIdentity(),
      { discountCode: 'SUMMER20' },
    )

    expect(result).toEqual({
      surface: 'discount_rejected',
      reason: 'not_applicable',
    })
    expect(harness.calls).toEqual([])
  })

  it('turns a 422 into invalid and writes nothing', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: {
        discounts: [polarDiscount()],
        rejectPatch: () => new PolarApiError(422, '{}', 'Unprocessable'),
      },
    })

    const result = await applyDiscountToCurrentPlan(
      harness.runtime,
      billingIdentity(),
      { discountCode: 'SUMMER20' },
    )

    expect(result).toEqual({ surface: 'discount_rejected', reason: 'invalid' })
    expect(harness.store.writes).toHaveLength(0)
  })

  it('refuses a member', async () => {
    const harness = createHarness({ record: subscriptionRecord() })
    await expect(
      applyDiscountToCurrentPlan(
        harness.runtime,
        billingIdentity({ role: 'member' }),
        { discountCode: 'SUMMER20' },
      ),
    ).rejects.toBeInstanceOf(BillingForbiddenError)
  })
})

describe('changePlan writes what Polar answered', () => {
  it('persists the subscription from the PATCH response before it evicts the key', async () => {
    const harness = createHarness({ record: SOLO_RECORD() })
    warmPlanCache(harness)
    const order = sideEffectOrder(harness)

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })

    // Evicting without writing is inert: the next read misses, re-reads the same
    // unchanged row and re-caches it for another full TTL.
    expect(order).toEqual(['upsert', 'delete'])
    expect(harness.store.writes).toHaveLength(1)
    expect(harness.store.writes[0]).toMatchObject({
      organizationId: TEST_ORG_ID,
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
      providerProductId: TEST_PRODUCT_IDS.crewMonthly,
      providerSubscriptionId: TEST_SUBSCRIPTION_ID,
    })
  })

  it('stamps the new plan onto the ceilings, so the upgraded seats are usable at once', async () => {
    const harness = createHarness({
      record: SOLO_RECORD(),
      usage: { seats: 1, trips: 0, storageBytes: 0 },
    })
    const ctx = billingContext(harness.runtime, TEST_ORG_ID)

    // Solo allows one seat, so this is the exact refusal the stale row produced for
    // a Crew subscription Polar had already billed.
    await expect(assertWithinLimit(ctx, 'seats', 3)).rejects.toBeInstanceOf(
      QuotaExceededError,
    )

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })

    expect(harness.store.writes[0]?.ceilings.seatLimit).toBe(4)

    const state = await entitlements(ctx)
    expect(state.planId).toBe('crew')
    expect(state.limits.seats).toBe(4)
    expect(state.quotas.seats.limit).toBe(4)
    await expect(assertWithinLimit(ctx, 'seats', 3)).resolves.toBeUndefined()
  })

  it('persists the second response when the product and the seats both move', async () => {
    const harness = createHarness({ record: SOLO_RECORD() })
    const { runtime, calls } = withScriptedPolar(harness, [
      // The read before an uncoded product change: no discount to clear.
      polarSubscription({ product_id: TEST_PRODUCT_IDS.soloMonthly, seats: 1 }),
      polarSubscription({ product_id: TEST_PRODUCT_IDS.crewMonthly, seats: 1 }),
      polarSubscription({ product_id: TEST_PRODUCT_IDS.crewMonthly, seats: 6 }),
    ])

    await changePlan(runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 6,
    })

    expect(calls.filter((call) => call.method === 'PATCH')).toHaveLength(2)
    // Only the last answer describes both moves; persisting the first would write a
    // seat count Polar has already superseded.
    expect(harness.store.writes).toHaveLength(1)
    expect(harness.store.writes[0]?.seats).toBe(6)
    expect(harness.store.writes[0]?.ceilings.seatLimit).toBe(6)
  })

  it('leaves D1 alone and still evicts when the seats PATCH fails', async () => {
    const harness = createHarness({ record: SOLO_RECORD() })
    const key = warmPlanCache(harness)
    const { runtime } = withScriptedPolar(harness, [
      polarSubscription({ product_id: TEST_PRODUCT_IDS.soloMonthly, seats: 1 }),
      polarSubscription({ product_id: TEST_PRODUCT_IDS.crewMonthly, seats: 1 }),
      new PolarApiError(409, '{}', 'Polar PATCH failed with 409.'),
    ])

    await expect(
      changePlan(runtime, billingIdentity(), {
        planId: 'crew',
        interval: 'monthly',
        seats: 6,
      }),
    ).rejects.toBeInstanceOf(PolarApiError)

    // A half-applied change must not leave the plan the customer moved off in KV.
    expect(harness.cache.entries.has(key)).toBe(false)
    expect(harness.store.writes).toHaveLength(0)
  })

  it('never turns a failed eviction into a failed billing change', async () => {
    const harness = createHarness({ record: SOLO_RECORD() })
    harness.cache.delete = async () => {
      throw new Error('KV namespace unavailable')
    }

    const redirect = await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })

    // Polar has already charged the customer by this point. Reporting a cache
    // problem here would render "that change was not applied" for one that was.
    expect(redirect.surface).toBe('applied')
    expect(harness.store.writes).toHaveLength(1)
    expect(
      harness.logs.some(
        (log) =>
          log.level === 'error' &&
          log.message === 'billing.plan_change.eviction_failed',
      ),
    ).toBe(true)
  })

  it('writes nothing and evicts nothing when Polar was never asked', async () => {
    const harness = createHarness({ record: subscriptionRecord({ seats: 4 }) })
    const key = warmPlanCache(harness)

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })

    expect(harness.store.writes).toHaveLength(0)
    expect(harness.cache.entries.has(key)).toBe(true)
  })

  it('says so, rather than announcing a change it did not make', async () => {
    const harness = createHarness({ record: subscriptionRecord({ seats: 4 }) })

    const redirect = await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })

    // `/settings/billing` raises its "Plan updated" alert off `?plan=changed` and
    // nothing else, so the bare path is what stops a no-op claiming a change — and
    // claiming, in the same sentence, that Polar invoiced a difference.
    expect(redirect).toEqual({
      url: billingHomeUrl(TEST_APP_URL),
      surface: 'unchanged',
    })
    expect(JSON.stringify(redirect)).not.toContain('plan=changed')
    expect(
      harness.logs.some((log) => log.message === 'billing.plan_change.applied'),
    ).toBe(false)
    expect(
      harness.logs.some(
        (log) => log.message === 'billing.plan_change.unchanged',
      ),
    ).toBe(true)
  })
})

describe('pendingChangeFor', () => {
  const record = subscriptionRecord()

  it('reads Polar\u2019s own schedule in preference to our arithmetic', () => {
    const pending = pendingChangeFor(
      polarSubscription({
        pending_update: {
          applies_at: '2026-09-01T00:00:00Z',
          product_id: TEST_PRODUCT_IDS.soloYearly,
        },
      }),
      'next_period',
      resolvePlanSelection({ planId: 'crew', interval: 'monthly', seats: 2 }),
      record,
    )

    expect(pending).toEqual({
      planId: 'solo',
      interval: 'yearly',
      effectiveAt: new Date('2026-09-01T00:00:00Z'),
    })
  })

  it('falls back to the end of the paid period for a deferred change', () => {
    expect(
      pendingChangeFor(
        polarSubscription({ pending_update: null }),
        'next_period',
        resolvePlanSelection({ planId: 'solo', interval: 'yearly' }),
        record,
      ),
    ).toEqual({
      planId: 'solo',
      interval: 'yearly',
      effectiveAt: record.currentPeriodEnd,
    })
  })

  it('schedules nothing for a change that is already in force', () => {
    for (const proration of ['invoice', 'prorate'] as const) {
      expect(
        pendingChangeFor(
          polarSubscription(),
          proration,
          resolvePlanSelection({
            planId: 'crew',
            interval: 'monthly',
            seats: 8,
          }),
          record,
        ),
        proration,
      ).toBeNull()
    }
  })

  it('refuses a schedule it cannot date or name', () => {
    const selection = resolvePlanSelection({
      planId: 'crew',
      interval: 'monthly',
      seats: 8,
    })

    expect(
      pendingChangeFor(
        polarSubscription({
          pending_update: {
            applies_at: 'not a date',
            product_id: TEST_PRODUCT_IDS.soloYearly,
          },
        }),
        'invoice',
        selection,
        record,
      ),
    ).toBeNull()
    expect(
      pendingChangeFor(
        polarSubscription({
          pending_update: {
            applies_at: '2026-09-01T00:00:00Z',
            product_id: 'a-product-we-do-not-sell',
          },
        }),
        'invoice',
        selection,
        record,
      ),
    ).toBeNull()
  })

  it('cannot date a deferred change on a subscription with no period end', () => {
    expect(
      pendingChangeFor(
        polarSubscription(),
        'next_period',
        resolvePlanSelection({ planId: 'solo', interval: 'yearly' }),
        subscriptionRecord({ currentPeriodEnd: null }),
      ),
    ).toBeNull()
  })
})

describe('changePlan records a scheduled change', () => {
  it('files the downgrade Polar deferred against the row it writes', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: {
        subscription: {
          ...polarSubscription(),
          pending_update: {
            applies_at: '2026-09-01T00:00:00Z',
            product_id: TEST_PRODUCT_IDS.soloYearly,
          },
        },
      },
    })

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'solo',
      interval: 'yearly',
    })

    const written = harness.store.writes[0]
    // Polar's answer still names the old product, because nothing has moved yet.
    expect(written.planId).toBe('crew')
    expect(written.pendingChange).toEqual({
      planId: 'solo',
      interval: 'yearly',
      effectiveAt: new Date('2026-09-01T00:00:00Z'),
    })
    expect(
      harness.logs.some(
        (log) =>
          log.message === 'billing.plan_change.applied' &&
          log.fields.scheduled === true,
      ),
    ).toBe(true)
  })

  it('files nothing against a change that took effect immediately', async () => {
    const harness = createHarness({ record: SOLO_RECORD() })

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })

    expect(harness.store.writes[0]?.pendingChange).toBeNull()
  })
})

/* ------------------------------------------------------------------- orders */

describe('order history', () => {
  it('turns a Polar order into wire-safe values', () => {
    expect(invoiceSummaryOf(polarOrder())).toEqual({
      id: TEST_ORDER_ID,
      number: 'PT-0001',
      status: 'paid',
      createdAt: new Date('2026-08-01T09:30:00Z').toISOString(),
      total: 2800,
      currency: 'USD',
      invoiceGenerated: true,
    })
  })

  it('emits no period or hosted-page fields, because Polar has neither', () => {
    const summary = invoiceSummaryOf(polarOrder())

    expect(summary).not.toHaveProperty('periodStart')
    expect(summary).not.toHaveProperty('periodEnd')
    expect(summary).not.toHaveProperty('hostedUrl')
    expect(summary).not.toHaveProperty('pdfUrl')
  })

  it('falls back to the order id when Polar never numbered it', () => {
    expect(invoiceSummaryOf(polarOrder({ invoice_number: null })).number).toBe(
      TEST_ORDER_ID,
    )
  })

  it('carries Polar’s own order statuses', () => {
    expect(invoiceSummaryOf(polarOrder({ status: 'refunded' })).status).toBe(
      'refunded',
    )
    expect(
      invoiceSummaryOf(polarOrder({ status: 'partially_refunded' })).status,
    ).toBe('partially_refunded')
  })

  it('reads the organization’s orders, newest first', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      polar: {
        orders: [
          polarOrder(),
          polarOrder({
            id: 'bd0f7d1a-2c4e-4b98-9f37-6a1e5c082d94',
            invoice_number: 'PT-0002',
          }),
        ],
      },
    })

    const rows = await listRecentInvoices(harness.runtime, TEST_ORG_ID)

    expect(rows.map((row) => row.number)).toEqual(['PT-0001', 'PT-0002'])

    const call = callTo(harness.calls, 'GET', ORDERS_PATH)
    expect(call.query).toEqual({
      external_customer_id: TEST_ORG_ID,
      limit: INVOICE_HISTORY_LIMIT,
      sorting: '-created_at',
    })
  })

  it('returns nothing, and asks Polar nothing, without a customer', async () => {
    const harness = createHarness()

    await expect(
      listRecentInvoices(harness.runtime, TEST_ORG_ID),
    ).resolves.toEqual([])
    expect(harness.calls).toHaveLength(0)
  })
})

describe('orderInvoiceUrl', () => {
  it('generates the PDF only when Polar has not already', async () => {
    const harness = createHarness({
      polar: { order: polarOrder({ is_invoice_generated: false }) },
    })

    const result = await orderInvoiceUrl(harness.runtime, TEST_ORG_ID, {
      orderId: TEST_ORDER_ID,
    })

    expect(result).toEqual({ state: 'ready', url: TEST_INVOICE_PDF_URL })
    expect(harness.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `GET /v1/orders/${TEST_ORDER_ID}`,
      `POST /v1/orders/${TEST_ORDER_ID}/invoice`,
      `GET /v1/orders/${TEST_ORDER_ID}/invoice`,
    ])
  })

  it('skips the generate call for an order that already has one', async () => {
    const harness = createHarness({ polar: { order: polarOrder() } })

    await expect(
      orderInvoiceUrl(harness.runtime, TEST_ORG_ID, { orderId: TEST_ORDER_ID }),
    ).resolves.toEqual({ state: 'ready', url: TEST_INVOICE_PDF_URL })

    expect(harness.calls.map((call) => call.method)).toEqual(['GET', 'GET'])
  })

  /**
   * The generate call answers 202 and Polar renders asynchronously, so the very
   * first download of any invoice used to race the renderer and 404. This is that
   * exact delivery: 202, then a 404, then the document.
   */
  it('waits out the 202 → 404 → 200 render race instead of failing on the 404', async () => {
    const harness = createHarness({
      polar: {
        order: polarOrder({ is_invoice_generated: false }),
        orderInvoiceSequence: [
          invoiceNotRenderedYet(),
          { url: TEST_INVOICE_PDF_URL },
        ],
      },
    })
    const { sleep, waits } = recordingSleep()

    const result = await orderInvoiceUrl(
      harness.runtime,
      TEST_ORG_ID,
      { orderId: TEST_ORDER_ID },
      { sleep },
    )

    expect(result).toEqual({ state: 'ready', url: TEST_INVOICE_PDF_URL })
    expect(harness.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `GET /v1/orders/${TEST_ORDER_ID}`,
      `POST /v1/orders/${TEST_ORDER_ID}/invoice`,
      `GET /v1/orders/${TEST_ORDER_ID}/invoice`,
      `GET /v1/orders/${TEST_ORDER_ID}/invoice`,
    ])
    expect(waits).toEqual([INVOICE_POLL_DELAYS_MS[0]])
  })

  it('reports a still-rendering invoice as pending rather than waiting forever', async () => {
    const harness = createHarness({
      polar: {
        order: polarOrder({ is_invoice_generated: false }),
        orderInvoiceSequence: [invoiceNotRenderedYet()],
      },
    })
    const { sleep, waits } = recordingSleep()

    const result = await orderInvoiceUrl(
      harness.runtime,
      TEST_ORG_ID,
      { orderId: TEST_ORDER_ID },
      { sleep },
    )

    expect(result).toEqual({
      state: 'pending',
      retryAfterMs: INVOICE_RETRY_AFTER_MS,
    })
    // One read per delay, plus the read that precedes the first wait — and then it
    // gives the request path back rather than holding it open.
    expect(
      harness.calls.filter((call) => call.path.endsWith('/invoice')),
    ).toHaveLength(INVOICE_POLL_DELAYS_MS.length + 2)
    expect(waits).toEqual([...INVOICE_POLL_DELAYS_MS])
    expect(harness.logs).toContainEqual({
      level: 'warn',
      message: 'billing.invoice.still_generating',
      fields: {
        organizationId: TEST_ORG_ID,
        orderId: TEST_ORDER_ID,
        attempts: INVOICE_POLL_DELAYS_MS.length + 1,
      },
    })
  })

  it('never reads a failure that is not a 404 as "still generating"', async () => {
    const harness = createHarness({
      polar: {
        order: polarOrder(),
        orderInvoiceSequence: [
          new PolarApiError(500, 'boom', 'Polar GET failed with 500.'),
        ],
      },
    })
    const { sleep, waits } = recordingSleep()

    await expect(
      orderInvoiceUrl(
        harness.runtime,
        TEST_ORG_ID,
        { orderId: TEST_ORDER_ID },
        { sleep },
      ),
    ).rejects.toBeInstanceOf(PolarApiError)
    expect(waits).toEqual([])
  })

  /**
   * Polar documents two refusals of `POST /v1/orders/{id}/invoice`: 409, the order is not in a
   * status that can be invoiced, and 422, it has no billing name or address. Both mean the same
   * thing to the reader - this order has no invoice to open - so both become one named error,
   * and neither is polled or retried.
   */
  it.each([409, 422])(
    'reads a %i from the generate call as an order that cannot be invoiced',
    async (status) => {
      const harness = createHarness({
        polar: {
          order: polarOrder({ is_invoice_generated: false }),
          generateInvoiceError: new PolarApiError(
            status,
            '{"detail":"x"}',
            `Polar POST /v1/orders/{id}/invoice failed with ${status}.`,
          ),
        },
      })
      const { sleep, waits } = recordingSleep()

      await expect(
        orderInvoiceUrl(
          harness.runtime,
          TEST_ORG_ID,
          { orderId: TEST_ORDER_ID },
          { sleep },
        ),
      ).rejects.toBeInstanceOf(OrderNotInvoiceableError)

      expect(waits).toEqual([])
      expect(
        harness.calls.filter(
          (call) => call.method === 'GET' && call.path.endsWith('/invoice'),
        ),
      ).toHaveLength(0)
      expect(harness.logs).toContainEqual({
        level: 'warn',
        message: 'billing.invoice.not_invoiceable',
        fields: { organizationId: TEST_ORG_ID, orderId: TEST_ORDER_ID, status },
      })
    },
  )

  it.each([403, 429, 500])(
    'lets a %i from the generate call through as the provider failure it is',
    async (status) => {
      const harness = createHarness({
        polar: {
          order: polarOrder({ is_invoice_generated: false }),
          generateInvoiceError: new PolarApiError(status, 'x', 'Polar failed.'),
        },
      })

      await expect(
        orderInvoiceUrl(harness.runtime, TEST_ORG_ID, {
          orderId: TEST_ORDER_ID,
        }),
      ).rejects.toBeInstanceOf(PolarApiError)
    },
  )

  it('refuses an order that belongs to another workspace', async () => {
    const harness = createHarness({
      polar: {
        order: polarOrder({
          // Not yet rendered, so a check that ran late would send the render request.
          is_invoice_generated: false,
          customer: { id: TEST_CUSTOMER_ID, external_id: 'org_someone_else' },
          metadata: {},
        }),
      },
    })

    await expect(
      orderInvoiceUrl(harness.runtime, TEST_ORG_ID, { orderId: TEST_ORDER_ID }),
    ).rejects.toBeInstanceOf(BillingForbiddenError)
    // Only the read-back of the order went out: no render was requested for it.
    expect(harness.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `GET /v1/orders/${TEST_ORDER_ID}`,
    ])
  })

  it('refuses an order whose workspace cannot be determined, with no write to Polar', async () => {
    const harness = createHarness({
      polar: {
        order: polarOrder({
          is_invoice_generated: false,
          customer: { id: TEST_CUSTOMER_ID, external_id: null },
          metadata: {},
        }),
      },
    })

    await expect(
      orderInvoiceUrl(harness.runtime, TEST_ORG_ID, { orderId: TEST_ORDER_ID }),
    ).rejects.toBeInstanceOf(BillingForbiddenError)
    expect(harness.calls.map((call) => call.method)).toEqual(['GET'])
  })

  it('refuses an order id that is not a Polar id at all', async () => {
    const harness = createHarness()

    await expect(
      orderInvoiceUrl(harness.runtime, TEST_ORG_ID, {
        orderId: '../../v1/customers/',
      }),
    ).rejects.toThrow()
    expect(harness.calls).toHaveLength(0)
  })
})
