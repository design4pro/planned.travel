/**
 * Buying a plan.
 *
 * The load-bearing assertions here are the ones about *trust*: that a price is
 * never taken from the caller, that seats are clamped into the plan's own range,
 * that only an owner or an admin can spend the organization's money, and that a
 * double-clicked button cannot open two Checkout Sessions.
 */

// Must come first: it configures the price ids `#/lib/plans` reads at import.
import { TEST_PRICE_IDS } from './prices.fixture'

import { describe, expect, it } from 'vitest'

import {
  buildCheckoutSessionParams,
  buildPortalSessionParams,
  changePlan,
  checkoutCancelUrl,
  checkoutIdempotencyKey,
  checkoutSuccessUrl,
  createCheckoutSession,
  createPortalSession,
  ensureStripeCustomer,
  invoiceSummaryOf,
  isEligibleForTrial,
  listRecentInvoices,
  liveSubscriptionId,
  portalReturnUrl,
  resolvePlanSelection,
} from '../checkout'
import { BillingForbiddenError } from '../types'
import { PLANS } from '#/lib/plans'
import {
  TEST_APP_URL,
  TEST_CHECKOUT_URL,
  TEST_CUSTOMER_ID,
  TEST_ORG_ID,
  TEST_PORTAL_URL,
  billingIdentity,
  createHarness,
  subscriptionRecord,
} from './harness'

import type Stripe from 'stripe'
import type { PlanSelection } from '../checkout'

/* ----------------------------------------------------------------- selection */

describe('resolvePlanSelection', () => {
  it('resolves the price from the catalogue, never from the caller', () => {
    const selection = resolvePlanSelection({
      planId: 'solo',
      interval: 'yearly',
    })

    expect(selection.price.priceId).toBe(TEST_PRICE_IDS.soloYearly)
    expect(selection.price.amount).toBe(PLANS.solo.prices.yearly?.amount)
  })

  it('refuses the Free plan, which is not something Stripe can sell', () => {
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
      'https://planned.travel/settings/billing?checkout=complete&session={CHECKOUT_SESSION_ID}',
    )
    expect(checkoutCancelUrl(TEST_APP_URL)).toBe(
      'https://planned.travel/settings/billing?checkout=cancelled',
    )
    expect(portalReturnUrl(TEST_APP_URL)).toBe(
      'https://planned.travel/settings/billing?portal=complete',
    )
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

/* ------------------------------------------------------------ session params */

describe('buildCheckoutSessionParams', () => {
  const crew: PlanSelection = resolvePlanSelection({
    planId: 'crew',
    interval: 'monthly',
    seats: 4,
  })

  it('asks for a subscription against our own customer and organization', () => {
    const params = buildCheckoutSessionParams({
      appUrl: TEST_APP_URL,
      organizationId: TEST_ORG_ID,
      customerId: TEST_CUSTOMER_ID,
      selection: crew,
      trialDays: 0,
    })

    expect(params.mode).toBe('subscription')
    expect(params.customer).toBe(TEST_CUSTOMER_ID)
    expect(params.client_reference_id).toBe(TEST_ORG_ID)
    expect(params.metadata).toEqual({
      organizationId: TEST_ORG_ID,
      planId: 'crew',
      interval: 'monthly',
      seats: '4',
    })
  })

  it('carries the same metadata onto the subscription the webhook reads back', () => {
    const params = buildCheckoutSessionParams({
      appUrl: TEST_APP_URL,
      organizationId: TEST_ORG_ID,
      customerId: TEST_CUSTOMER_ID,
      selection: crew,
      trialDays: 0,
    })

    expect(params.subscription_data?.metadata).toEqual(params.metadata)
  })

  it('lets a seat-based plan be adjusted only inside its own range', () => {
    const params = buildCheckoutSessionParams({
      appUrl: TEST_APP_URL,
      organizationId: TEST_ORG_ID,
      customerId: TEST_CUSTOMER_ID,
      selection: crew,
      trialDays: 0,
    })

    expect(params.line_items?.[0]).toMatchObject({
      price: TEST_PRICE_IDS.crewMonthly,
      quantity: 4,
      adjustable_quantity: {
        enabled: true,
        minimum: PLANS.crew.seatRange.min,
        maximum: PLANS.crew.seatRange.max,
      },
    })
  })

  it('fixes the quantity of a flat plan at one', () => {
    const solo = resolvePlanSelection({ planId: 'solo', interval: 'monthly' })
    const params = buildCheckoutSessionParams({
      appUrl: TEST_APP_URL,
      organizationId: TEST_ORG_ID,
      customerId: TEST_CUSTOMER_ID,
      selection: solo,
      trialDays: 0,
    })

    expect(params.line_items?.[0]?.quantity).toBe(1)
    expect(params.line_items?.[0]?.adjustable_quantity).toBeUndefined()
  })

  it('asks for no card while a trial is on offer, and cancels if none arrives', () => {
    const params = buildCheckoutSessionParams({
      appUrl: TEST_APP_URL,
      organizationId: TEST_ORG_ID,
      customerId: TEST_CUSTOMER_ID,
      selection: crew,
      trialDays: 14,
    })

    expect(params.payment_method_collection).toBe('if_required')
    expect(params.subscription_data?.trial_period_days).toBe(14)
    expect(params.subscription_data?.trial_settings).toEqual({
      end_behavior: { missing_payment_method: 'cancel' },
    })
  })

  it('insists on a card when there is no trial', () => {
    const params = buildCheckoutSessionParams({
      appUrl: TEST_APP_URL,
      organizationId: TEST_ORG_ID,
      customerId: TEST_CUSTOMER_ID,
      selection: crew,
      trialDays: 0,
    })

    expect(params.payment_method_collection).toBe('always')
    expect(params.subscription_data?.trial_period_days).toBeUndefined()
    expect(params.subscription_data?.trial_settings).toBeUndefined()
  })
})

describe('buildPortalSessionParams', () => {
  it('opens the portal home with no flow', () => {
    const params = buildPortalSessionParams({
      appUrl: TEST_APP_URL,
      customerId: TEST_CUSTOMER_ID,
      intent: 'home',
      subscriptionId: 'sub_test_1',
    })

    expect(params.flow_data).toBeUndefined()
    expect(params.return_url).toBe(portalReturnUrl(TEST_APP_URL))
  })

  it('opens the card-update flow without needing a subscription', () => {
    const params = buildPortalSessionParams({
      appUrl: TEST_APP_URL,
      customerId: TEST_CUSTOMER_ID,
      intent: 'paymentMethod',
      subscriptionId: null,
    })

    expect(params.flow_data?.type).toBe('payment_method_update')
  })

  it('names the subscription being cancelled', () => {
    const params = buildPortalSessionParams({
      appUrl: TEST_APP_URL,
      customerId: TEST_CUSTOMER_ID,
      intent: 'cancel',
      subscriptionId: 'sub_test_1',
    })

    expect(params.flow_data).toMatchObject({
      type: 'subscription_cancel',
      subscription_cancel: { subscription: 'sub_test_1' },
    })
  })

  it('refuses to open a cancellation flow with nothing to cancel', () => {
    expect(() =>
      buildPortalSessionParams({
        appUrl: TEST_APP_URL,
        customerId: TEST_CUSTOMER_ID,
        intent: 'cancel',
        subscriptionId: null,
      }),
    ).toThrow('no active subscription')
  })
})

/* ------------------------------------------------------------------- trials */

describe('trial eligibility', () => {
  it('offers a trial to an organization that has never subscribed', () => {
    expect(isEligibleForTrial(null)).toBe(true)
    expect(
      isEligibleForTrial(subscriptionRecord({ stripeSubscriptionId: null })),
    ).toBe(true)
  })

  it('never offers a second trial', () => {
    expect(isEligibleForTrial(subscriptionRecord())).toBe(false)
    expect(
      isEligibleForTrial(
        subscriptionRecord({
          stripeSubscriptionId: null,
          trialEndsAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      ),
    ).toBe(false)
  })
})

describe('liveSubscriptionId', () => {
  it('finds the subscription only while its status still entitles it', () => {
    expect(liveSubscriptionId(subscriptionRecord())).toBe('sub_test_1')
    expect(liveSubscriptionId(subscriptionRecord({ status: 'past_due' }))).toBe(
      'sub_test_1',
    )
    expect(
      liveSubscriptionId(subscriptionRecord({ status: 'canceled' })),
    ).toBeNull()
    expect(
      liveSubscriptionId(subscriptionRecord({ stripeSubscriptionId: null })),
    ).toBeNull()
    expect(liveSubscriptionId(null)).toBeNull()
  })
})

/* ----------------------------------------------------------------- customers */

describe('ensureStripeCustomer', () => {
  it('creates one customer per organization and remembers it', async () => {
    const harness = createHarness()

    const id = await ensureStripeCustomer(harness.runtime, billingIdentity())

    expect(id).toBe(TEST_CUSTOMER_ID)
    expect(harness.calls.customers).toHaveLength(1)
    expect(harness.calls.customers[0]?.params.metadata).toMatchObject({
      organizationId: TEST_ORG_ID,
    })
    expect(harness.calls.customers[0]?.options?.idempotencyKey).toBe(
      `customer:${TEST_ORG_ID}`,
    )
    expect(harness.store.rows.get(TEST_ORG_ID)?.stripeCustomerId).toBe(
      TEST_CUSTOMER_ID,
    )
  })

  it('reuses the customer a returning workspace already has', async () => {
    const harness = createHarness({
      record: subscriptionRecord({ status: 'canceled' }),
    })

    const id = await ensureStripeCustomer(harness.runtime, billingIdentity())

    expect(id).toBe(TEST_CUSTOMER_ID)
    expect(harness.calls.customers).toHaveLength(0)
  })
})

/* ------------------------------------------------------------------ checkout */

describe('createCheckoutSession', () => {
  it('sends a first-time subscriber to Checkout with their trial', async () => {
    const harness = createHarness()

    const redirect = await createCheckoutSession(
      harness.runtime,
      billingIdentity(),
      {
        planId: 'crew',
        interval: 'monthly',
        seats: 4,
      },
    )

    expect(redirect).toEqual({ url: TEST_CHECKOUT_URL, surface: 'checkout' })
    const call = harness.calls.checkoutSessions[0]
    expect(call.params.subscription_data?.trial_period_days).toBe(
      PLANS.crew.trialDays,
    )
    expect(call.options?.idempotencyKey).toBeTypeOf('string')
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

    expect(
      harness.calls.checkoutSessions[0]?.params.subscription_data
        ?.trial_period_days,
    ).toBeUndefined()
  })

  it('refuses a member who is not allowed to spend the workspace’s money', async () => {
    const harness = createHarness()

    await expect(
      createCheckoutSession(
        harness.runtime,
        billingIdentity({ role: 'member' }),
        {
          planId: 'solo',
          interval: 'monthly',
        },
      ),
    ).rejects.toBeInstanceOf(BillingForbiddenError)

    expect(harness.calls.checkoutSessions).toHaveLength(0)
    expect(harness.calls.customers).toHaveLength(0)
  })

  it('allows an admin as well as an owner', async () => {
    const harness = createHarness()

    await expect(
      createCheckoutSession(
        harness.runtime,
        billingIdentity({ role: 'admin' }),
        {
          planId: 'solo',
          interval: 'monthly',
        },
      ),
    ).resolves.toMatchObject({ surface: 'checkout' })
  })

  it('fails loudly rather than redirecting nowhere', async () => {
    const harness = createHarness({ stripe: { checkoutWithoutUrl: true } })

    await expect(
      createCheckoutSession(harness.runtime, billingIdentity(), {
        planId: 'solo',
        interval: 'monthly',
      }),
    ).rejects.toThrow('Checkout URL')
  })
})

/* -------------------------------------------------------------- plan changes */

const LIVE_SUBSCRIPTION = {
  id: 'sub_test_1',
  items: { data: [{ id: 'si_test_1' }] },
} as unknown as Stripe.Subscription

describe('changePlan', () => {
  it('confirms the change in the portal when a subscription is already live', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      stripe: { subscription: LIVE_SUBSCRIPTION },
    })

    const redirect = await changePlan(harness.runtime, billingIdentity(), {
      planId: 'solo',
      interval: 'yearly',
    })

    expect(redirect).toEqual({ url: TEST_PORTAL_URL, surface: 'portal' })
    expect(harness.calls.portalSessions[0]?.flow_data).toMatchObject({
      type: 'subscription_update_confirm',
      subscription_update_confirm: {
        subscription: 'sub_test_1',
        items: [
          { id: 'si_test_1', price: TEST_PRICE_IDS.soloYearly, quantity: 1 },
        ],
      },
    })
    expect(harness.calls.checkoutSessions).toHaveLength(0)
  })

  it('falls back to Checkout when the old subscription no longer entitles anything', async () => {
    const harness = createHarness({
      record: subscriptionRecord({ status: 'canceled' }),
    })

    const redirect = await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 3,
    })

    expect(redirect.surface).toBe('checkout')
    expect(harness.calls.portalSessions).toHaveLength(0)
  })

  it('resolves the new price on the server even when the seats are absurd', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      stripe: { subscription: LIVE_SUBSCRIPTION },
    })

    await changePlan(harness.runtime, billingIdentity(), {
      planId: 'crew',
      interval: 'monthly',
      seats: 999,
    })

    expect(harness.calls.portalSessions[0]?.flow_data).toMatchObject({
      subscription_update_confirm: {
        items: [
          {
            price: TEST_PRICE_IDS.crewMonthly,
            quantity: PLANS.crew.seatRange.max,
          },
        ],
      },
    })
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

/* -------------------------------------------------------------------- portal */

describe('createPortalSession', () => {
  it('opens the portal for a workspace with a billing profile', async () => {
    const harness = createHarness({ record: subscriptionRecord() })

    const redirect = await createPortalSession(
      harness.runtime,
      billingIdentity(),
      {
        intent: 'paymentMethod',
      },
    )

    expect(redirect).toEqual({ url: TEST_PORTAL_URL, surface: 'portal' })
    expect(harness.calls.portalSessions[0]?.customer).toBe(TEST_CUSTOMER_ID)
  })

  it('explains itself when there is no billing profile yet', async () => {
    const harness = createHarness()

    await expect(
      createPortalSession(harness.runtime, billingIdentity(), {
        intent: 'home',
      }),
    ).rejects.toThrow('no billing profile')
  })

  it('refuses a member', async () => {
    const harness = createHarness({ record: subscriptionRecord() })

    await expect(
      createPortalSession(
        harness.runtime,
        billingIdentity({ role: 'member' }),
        {
          intent: 'home',
        },
      ),
    ).rejects.toBeInstanceOf(BillingForbiddenError)
  })
})

/* ------------------------------------------------------------------ invoices */

function invoice(overrides: Partial<Stripe.Invoice> = {}): Stripe.Invoice {
  return {
    id: 'in_test_1',
    number: 'PT-0001',
    status: 'paid',
    created: 1_755_000_000,
    currency: 'usd',
    total: 2800,
    period_start: 1_755_000_000,
    period_end: 1_757_678_400,
    hosted_invoice_url: 'https://invoice.stripe.com/i/test',
    invoice_pdf: 'https://invoice.stripe.com/i/test.pdf',
    ...overrides,
  } as unknown as Stripe.Invoice
}

describe('invoice history', () => {
  it('turns a Stripe invoice into wire-safe values', () => {
    const summary = invoiceSummaryOf(invoice())

    expect(summary).toEqual({
      id: 'in_test_1',
      number: 'PT-0001',
      status: 'paid',
      createdAt: new Date(1_755_000_000_000).toISOString(),
      total: 2800,
      currency: 'USD',
      periodStart: new Date(1_755_000_000_000).toISOString(),
      periodEnd: new Date(1_757_678_400_000).toISOString(),
      hostedUrl: 'https://invoice.stripe.com/i/test',
      pdfUrl: 'https://invoice.stripe.com/i/test.pdf',
    })
  })

  it('falls back to the invoice id when Stripe never numbered it', () => {
    expect(invoiceSummaryOf(invoice({ number: null })).number).toBe('in_test_1')
  })

  it('narrows an unrecognised status rather than trusting it', () => {
    expect(
      invoiceSummaryOf(
        invoice({ status: 'something_new' as Stripe.Invoice.Status }),
      ).status,
    ).toBe('draft')
  })

  it('reads a customer’s invoices, newest first', async () => {
    const harness = createHarness({
      record: subscriptionRecord(),
      stripe: {
        invoices: [invoice(), invoice({ id: 'in_test_2', number: 'PT-0002' })],
      },
    })

    const rows = await listRecentInvoices(harness.runtime, TEST_ORG_ID)

    expect(rows.map((row) => row.number)).toEqual(['PT-0001', 'PT-0002'])
    expect(harness.calls.invoiceQueries[0]?.customer).toBe(TEST_CUSTOMER_ID)
  })

  it('returns nothing, and asks Stripe nothing, without a customer', async () => {
    const harness = createHarness()

    await expect(
      listRecentInvoices(harness.runtime, TEST_ORG_ID),
    ).resolves.toEqual([])
    expect(harness.calls.invoiceQueries).toHaveLength(0)
  })
})
