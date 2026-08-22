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
import { TEST_PRICE_IDS } from './prices.fixture'

import { describe, expect, it } from 'vitest'

import {
  CHECKOUT_PATH,
  CUSTOMER_SESSION_PATH,
  INVOICE_HISTORY_LIMIT,
  ORDERS_PATH,
  annualisedAmount,
  billingMetadata,
  buildCheckoutParams,
  changePlan,
  checkoutIdempotencyKey,
  checkoutReturnUrl,
  checkoutSuccessUrl,
  createCheckoutSession,
  createPortalSession,
  invoiceSummaryOf,
  isEligibleForTrial,
  listRecentInvoices,
  liveSubscriptionId,
  orderInvoiceUrl,
  planChangedUrl,
  portalReturnUrl,
  prorationFor,
  resolvePlanSelection,
} from '../checkout'
import { BillingForbiddenError } from '../types'
import { PLANS } from '#/lib/plans'
import {
  TEST_APP_URL,
  TEST_CHECKOUT_URL,
  TEST_CUSTOMER_ID,
  TEST_INVOICE_PDF_URL,
  TEST_ORDER_ID,
  TEST_ORG_ID,
  TEST_PORTAL_URL,
  TEST_SUBSCRIPTION_ID,
  billingIdentity,
  createHarness,
  polarOrder,
  subscriptionRecord,
} from './harness'

import type { PlanSelection } from '../checkout'
import type { PolarRequest } from '../types'

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

/* ----------------------------------------------------------------- selection */

describe('resolvePlanSelection', () => {
  it('resolves the product from the catalogue, never from the caller', () => {
    const selection = resolvePlanSelection({
      planId: 'solo',
      interval: 'yearly',
    })

    expect(selection.price.productId).toBe(TEST_PRICE_IDS.soloYearly)
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

    expect(body.products).toEqual([TEST_PRICE_IDS.crewMonthly])
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
    expect(body.products).toEqual([TEST_PRICE_IDS.crewMonthly])
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
      product_id: TEST_PRICE_IDS.soloYearly,
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

    expect(harness.calls).toHaveLength(2)
    expect(bodyOf(harness.calls[0])).toHaveProperty(
      'product_id',
      TEST_PRICE_IDS.crewYearly,
    )
    expect(bodyOf(harness.calls[1])).toHaveProperty('seats', 9)
  })

  it('asks Polar for nothing when nothing actually changed', async () => {
    const harness = createHarness({ record: subscriptionRecord({ seats: 4 }) })

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })

    expect(harness.calls).toHaveLength(0)
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

    const url = await orderInvoiceUrl(harness.runtime, TEST_ORG_ID, {
      orderId: TEST_ORDER_ID,
    })

    expect(url).toBe(TEST_INVOICE_PDF_URL)
    expect(harness.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      `GET /v1/orders/${TEST_ORDER_ID}`,
      `POST /v1/orders/${TEST_ORDER_ID}/invoice`,
      `GET /v1/orders/${TEST_ORDER_ID}/invoice`,
    ])
  })

  it('skips the generate call for an order that already has one', async () => {
    const harness = createHarness({ polar: { order: polarOrder() } })

    await orderInvoiceUrl(harness.runtime, TEST_ORG_ID, {
      orderId: TEST_ORDER_ID,
    })

    expect(harness.calls.map((call) => call.method)).toEqual(['GET', 'GET'])
  })

  it('refuses an order that belongs to another workspace', async () => {
    const harness = createHarness({
      polar: {
        order: polarOrder({
          customer: { id: TEST_CUSTOMER_ID, external_id: 'org_someone_else' },
          metadata: {},
        }),
      },
    })

    await expect(
      orderInvoiceUrl(harness.runtime, TEST_ORG_ID, { orderId: TEST_ORDER_ID }),
    ).rejects.toBeInstanceOf(BillingForbiddenError)
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
