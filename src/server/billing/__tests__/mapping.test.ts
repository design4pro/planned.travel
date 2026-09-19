/**
 * Translating Polar payloads into the row we persist.
 *
 * This file did not exist while the mapping was a find-and-replace away from another
 * provider's object model, and the two things it exists to pin down are the two that
 * would otherwise silently regress: that all eight subscription statuses survive the
 * crossing intact — the DB CHECK constraint is generated from the same tuple, so a
 * narrowed mapping fails at write time in production rather than here — and that an
 * organization is found from `customer.external_id` even when no metadata came with
 * the payload at all.
 */

// Must come first: it configures the product ids `#/lib/plans` reads at import.
import { TEST_PRODUCT_IDS } from './prices.fixture'

import { describe, expect, it } from 'vitest'

import * as mapping from '../mapping'
import {
  POLAR_ORDER_STATUSES,
  POLAR_SUBSCRIPTION_STATUSES,
  cancelledRecord,
  fromPolarTimestamp,
  organizationIdFromMetadata,
  organizationIdFromOrder,
  organizationIdFromSubscription,
  pendingChangeFromPolar,
  polarDiscountListSchema,
  polarDiscountSchema,
  polarOrderSchema,
  polarSubscriptionSchema,
  resolveSubscriptionPlan,
  subscriptionIdFromOrder,
  subscriptionRecordFromPolar,
  toSubscriptionStatus,
} from '../mapping'
import { ceilingsForPlan } from '../limits'
import { PLANS, SUBSCRIPTION_STATUSES } from '#/lib/plans'
import {
  TEST_CUSTOMER_ID,
  TEST_ORDER_ID,
  TEST_ORG_ID,
  TEST_SUBSCRIPTION_ID,
  polarDiscount,
  polarOrder,
  polarSubscription,
  subscriptionRecord,
} from './harness'

import type { PolarSubscriptionStatus } from '../mapping'
import type { SubscriptionStatus } from '#/lib/plans'

/* ------------------------------------------------------------------ discounts */

describe('polarDiscountSchema', () => {
  it('parses a percentage code with no bounds', () => {
    const parsed = polarDiscountSchema.parse(polarDiscount())
    expect(parsed).toMatchObject({ type: 'percentage', basis_points: 2000, products: [] })
    expect(parsed.ends_at).toBeNull()
    expect(parsed.max_redemptions).toBeNull()
  })

  it('parses a fixed code, reading only the product ids', () => {
    const parsed = polarDiscountSchema.parse({
      ...polarDiscount({ type: 'fixed', basis_points: undefined, amount: 500 }),
      products: [{ id: TEST_PRODUCT_IDS.soloMonthly, name: 'Solo', prices: [] }],
      currency: 'usd',
      duration: 'once',
    })
    expect(parsed.amount).toBe(500)
    expect(parsed.products).toEqual([{ id: TEST_PRODUCT_IDS.soloMonthly }])
  })

  it('keeps dates and bounds, and defaults a missing product list to every product', () => {
    const { products: _omitted, ...wire } = polarDiscount({
      starts_at: '2026-01-01T00:00:00Z',
      ends_at: '2026-12-31T00:00:00Z',
      max_redemptions: 1,
      redemptions_count: 1,
    })
    const parsed = polarDiscountSchema.parse(wire)
    expect(parsed).toMatchObject({ max_redemptions: 1, redemptions_count: 1, products: [] })
    expect(parsed.ends_at).toBe('2026-12-31T00:00:00Z')
  })

  it('refuses a discount without a redemption count', () => {
    const { redemptions_count: _omitted, ...wire } = polarDiscount()
    expect(polarDiscountSchema.safeParse(wire).success).toBe(false)
  })

  it('parses a page of discounts with its pagination', () => {
    const page = polarDiscountListSchema.parse({
      items: [polarDiscount()],
      pagination: { total_count: 1, max_page: 1 },
    })
    expect(page.pagination.max_page).toBe(1)
  })

  it('reads the discount a subscription carries, and its absence', () => {
    expect(
      polarSubscriptionSchema.parse(
        polarSubscription({ discount: { id: 'd1', products: [{ id: 'p1' }] } }),
      ).discount,
    ).toEqual({ id: 'd1', products: [{ id: 'p1' }] })
    expect(polarSubscriptionSchema.parse(polarSubscription()).discount).toBeUndefined()
  })
})

/* ------------------------------------------------------------------- statuses */

describe('toSubscriptionStatus', () => {
  const table: ReadonlyArray<[PolarSubscriptionStatus, SubscriptionStatus]> = [
    ['incomplete', 'incomplete'],
    ['incomplete_expired', 'incomplete_expired'],
    ['trialing', 'trialing'],
    ['active', 'active'],
    ['past_due', 'past_due'],
    ['canceled', 'canceled'],
    ['unpaid', 'unpaid'],
    ['paused', 'paused'],
  ]

  it.each(table)('maps %s onto %s', (polar, ours) => {
    expect(toSubscriptionStatus(polar)).toBe(ours)
  })

  it('covers Polar’s enum exactly — no narrowing, no lossy default', () => {
    expect(table).toHaveLength(POLAR_SUBSCRIPTION_STATUSES.length)
    expect([...POLAR_SUBSCRIPTION_STATUSES].sort()).toEqual(
      [...SUBSCRIPTION_STATUSES].sort(),
    )
  })

  it('keeps the two statuses that look like another provider’s', () => {
    expect(POLAR_SUBSCRIPTION_STATUSES).toContain('incomplete')
    expect(POLAR_SUBSCRIPTION_STATUSES).toContain('incomplete_expired')
  })

  it('refuses a status Polar does not define, rather than guessing', () => {
    const parsed = polarSubscriptionSchema.safeParse(
      polarSubscription({
        status: 'renewing' as PolarSubscriptionStatus,
      }),
    )

    expect(parsed.success).toBe(false)
  })
})

describe('order statuses', () => {
  it('is Polar’s six, not the five of an invoice', () => {
    expect(POLAR_ORDER_STATUSES).toEqual([
      'draft',
      'pending',
      'paid',
      'refunded',
      'partially_refunded',
      'void',
    ])
  })
})

/* ------------------------------------------------------------------ timestamps */

describe('fromPolarTimestamp', () => {
  it('parses an ISO-8601 instant rather than a count of seconds', () => {
    expect(fromPolarTimestamp('2026-09-01T00:00:00Z')?.toISOString()).toBe(
      '2026-09-01T00:00:00.000Z',
    )
    expect(fromPolarTimestamp('2026-09-01T02:00:00+02:00')?.toISOString()).toBe(
      '2026-09-01T00:00:00.000Z',
    )
  })

  it('is null for absent, empty and unparseable values', () => {
    expect(fromPolarTimestamp(null)).toBeNull()
    expect(fromPolarTimestamp(undefined)).toBeNull()
    expect(fromPolarTimestamp('')).toBeNull()
    expect(fromPolarTimestamp('the first of never')).toBeNull()
  })
})

/* ----------------------------------------------------------------- attribution */

describe('organizationIdFromMetadata', () => {
  it('reads a non-empty string and nothing else', () => {
    expect(organizationIdFromMetadata({ organizationId: TEST_ORG_ID })).toBe(
      TEST_ORG_ID,
    )
    expect(organizationIdFromMetadata({ organizationId: '' })).toBeNull()
    expect(organizationIdFromMetadata({ organizationId: 42 })).toBeNull()
    expect(organizationIdFromMetadata({})).toBeNull()
    expect(organizationIdFromMetadata(null)).toBeNull()
  })
})

describe('organizationIdFromSubscription', () => {
  it('reads customer.external_id first', () => {
    expect(organizationIdFromSubscription(polarSubscription())).toBe(TEST_ORG_ID)
  })

  it('attributes a payload that carries no metadata at all', () => {
    const subscription = polarSubscription({ metadata: null })

    expect(organizationIdFromSubscription(subscription)).toBe(TEST_ORG_ID)
    expect(subscriptionRecordFromPolar(subscription)?.organizationId).toBe(
      TEST_ORG_ID,
    )
  })

  it('believes the external id over a metadata hint that disagrees', () => {
    const subscription = polarSubscription({
      customer: { id: TEST_CUSTOMER_ID, external_id: TEST_ORG_ID },
      metadata: { organizationId: 'org_stale_copy' },
    })

    expect(organizationIdFromSubscription(subscription)).toBe(TEST_ORG_ID)
  })

  it('falls back to metadata, then to our own customer index', () => {
    const withoutExternal = polarSubscription({
      customer: { id: TEST_CUSTOMER_ID, external_id: null },
    })
    expect(organizationIdFromSubscription(withoutExternal)).toBe(TEST_ORG_ID)

    const bare = polarSubscription({
      customer: { id: TEST_CUSTOMER_ID, external_id: null },
      metadata: null,
    })
    expect(
      organizationIdFromSubscription(bare, {
        fallbackOrganizationId: 'org_recovered',
      }),
    ).toBe('org_recovered')
    expect(organizationIdFromSubscription(bare)).toBeNull()
  })
})

/* ------------------------------------------------------------------ plan lookup */

describe('resolveSubscriptionPlan', () => {
  it('is a single product lookup — a Polar subscription has no line items', () => {
    expect(resolveSubscriptionPlan(polarSubscription())).toEqual({
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    })
  })

  it('clamps the billed seats into the plan’s own range', () => {
    expect(resolveSubscriptionPlan(polarSubscription({ seats: 40 }))?.seats).toBe(
      PLANS.crew.seatRange.max,
    )
    expect(resolveSubscriptionPlan(polarSubscription({ seats: 1 }))?.seats).toBe(
      PLANS.crew.seatRange.min,
    )
  })

  it('fixes a flat plan at one seat whatever Polar reports', () => {
    const solo = polarSubscription({
      product_id: TEST_PRODUCT_IDS.soloYearly,
      seats: 6,
    })

    expect(resolveSubscriptionPlan(solo)).toEqual({
      planId: 'solo',
      interval: 'yearly',
      seats: 1,
    })
  })

  it('is null for a product this deployment does not sell', () => {
    const foreign = polarSubscription({
      product_id: '11111111-2222-3333-4444-555555555555',
    })

    expect(resolveSubscriptionPlan(foreign)).toBeNull()
    expect(subscriptionRecordFromPolar(foreign)).toBeNull()
  })

  it('defaults a seat-based subscription with no seat count to the minimum', () => {
    expect(resolveSubscriptionPlan(polarSubscription({ seats: null }))?.seats).toBe(
      PLANS.crew.seatRange.min,
    )
  })
})

/* ---------------------------------------------------------------------- record */

describe('subscriptionRecordFromPolar', () => {
  it('builds the row from the subscription’s own top-level fields', () => {
    const record = subscriptionRecordFromPolar(polarSubscription())

    expect(record).toEqual({
      organizationId: TEST_ORG_ID,
      planId: 'crew',
      status: 'active',
      interval: 'monthly',
      seats: 4,
      providerCustomerId: TEST_CUSTOMER_ID,
      providerSubscriptionId: TEST_SUBSCRIPTION_ID,
      providerProductId: TEST_PRODUCT_IDS.crewMonthly,
      currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false,
      trialEndsAt: null,
      canceledAt: null,
      pendingChange: null,
      ceilings: ceilingsForPlan('crew', 4),
    })
  })

  it('carries a trial and a scheduled cancellation through as dates', () => {
    const record = subscriptionRecordFromPolar(
      polarSubscription({
        status: 'trialing',
        cancel_at_period_end: true,
        trial_end: '2026-08-15T12:00:00Z',
        canceled_at: '2026-08-10T08:00:00Z',
      }),
    )

    expect(record?.status).toBe('trialing')
    expect(record?.cancelAtPeriodEnd).toBe(true)
    expect(record?.trialEndsAt).toEqual(new Date('2026-08-15T12:00:00.000Z'))
    expect(record?.canceledAt).toEqual(new Date('2026-08-10T08:00:00.000Z'))
  })

  it('tolerates an open period rather than throwing inside a webhook', () => {
    const record = subscriptionRecordFromPolar(
      polarSubscription({
        status: 'incomplete',
        current_period_start: null,
        current_period_end: null,
      }),
    )

    expect(record?.currentPeriodStart).toBeNull()
    expect(record?.currentPeriodEnd).toBeNull()
  })

  it('stamps the plan’s own ceilings, never an escape', () => {
    const record = subscriptionRecordFromPolar(polarSubscription({ seats: 9 }))

    expect(record?.ceilings).toEqual(ceilingsForPlan('crew', 9))
  })

  it('carries the schedule Polar has accepted but not applied', () => {
    const record = subscriptionRecordFromPolar(
      polarSubscription({
        pending_update: {
          applies_at: '2026-09-01T00:00:00Z',
          product_id: TEST_PRODUCT_IDS.soloYearly,
        },
      }),
    )

    // The record still names the plan in force. Only `pendingChange` describes what
    // it becomes, which is the whole point of the distinction.
    expect(record?.planId).toBe('crew')
    expect(record?.pendingChange).toEqual({
      planId: 'solo',
      interval: 'yearly',
      effectiveAt: new Date('2026-09-01T00:00:00.000Z'),
    })
  })

  it('reports no schedule when Polar sends none, so the webhook clears one', () => {
    expect(subscriptionRecordFromPolar(polarSubscription())?.pendingChange).toBeNull()
    expect(
      subscriptionRecordFromPolar(polarSubscription({ pending_update: null }))
        ?.pendingChange,
    ).toBeNull()
  })
})

describe('pendingChangeFromPolar', () => {
  it('refuses a schedule it cannot name or date', () => {
    expect(pendingChangeFromPolar(null)).toBeNull()
    expect(pendingChangeFromPolar(undefined)).toBeNull()
    expect(
      pendingChangeFromPolar({
        applies_at: '2026-09-01T00:00:00Z',
        product_id: 'a-product-we-do-not-sell',
      }),
    ).toBeNull()
    expect(
      pendingChangeFromPolar({
        applies_at: 'the first of next month',
        product_id: TEST_PRODUCT_IDS.soloYearly,
      }),
    ).toBeNull()
  })
})

describe('cancelledRecord', () => {
  it('drops to Free, keeps the customer, and forgets the product', () => {
    const previous = subscriptionRecord()
    const canceledAt = new Date('2026-09-01T00:00:00.000Z')

    const record = cancelledRecord(
      previous,
      TEST_ORG_ID,
      TEST_CUSTOMER_ID,
      canceledAt,
    )

    expect(record.planId).toBe('free')
    expect(record.status).toBe('canceled')
    expect(record.interval).toBeNull()
    expect(record.providerCustomerId).toBe(TEST_CUSTOMER_ID)
    expect(record.providerSubscriptionId).toBe(TEST_SUBSCRIPTION_ID)
    expect(record.providerProductId).toBeNull()
    expect(record.canceledAt).toBe(canceledAt)
    expect(record.ceilings).toEqual(ceilingsForPlan('free', 1))
  })

  it('keeps the customer the previous row carried when the event omits it', () => {
    const record = cancelledRecord(
      subscriptionRecord(),
      TEST_ORG_ID,
      null,
      new Date(0),
    )

    expect(record.providerCustomerId).toBe(TEST_CUSTOMER_ID)
  })
})

/* ---------------------------------------------------------------------- orders */

describe('orders', () => {
  it('finds the subscription an order was raised against', () => {
    expect(subscriptionIdFromOrder(polarOrder())).toBe(TEST_SUBSCRIPTION_ID)
    expect(subscriptionIdFromOrder(polarOrder({ subscription_id: null }))).toBeNull()
  })

  it('attributes an order on the same rules as a subscription', () => {
    expect(organizationIdFromOrder(polarOrder())).toBe(TEST_ORG_ID)
    expect(
      organizationIdFromOrder(
        polarOrder({
          customer: { id: TEST_CUSTOMER_ID, external_id: null },
          metadata: { organizationId: 'org_from_metadata' },
        }),
      ),
    ).toBe('org_from_metadata')
    expect(
      organizationIdFromOrder(
        polarOrder({
          customer: { id: TEST_CUSTOMER_ID, external_id: null },
          metadata: null,
        }),
      ),
    ).toBeNull()
  })

  it('parses the order shape Polar actually sends', () => {
    const parsed = polarOrderSchema.parse({
      id: TEST_ORDER_ID,
      status: 'paid',
      created_at: '2026-08-01T09:30:00Z',
      total_amount: 2800,
      currency: 'usd',
      invoice_number: 'PT-0001',
      is_invoice_generated: false,
      subscription_id: TEST_SUBSCRIPTION_ID,
      customer_id: TEST_CUSTOMER_ID,
      customer: { id: TEST_CUSTOMER_ID, external_id: TEST_ORG_ID },
    })

    expect(parsed.is_invoice_generated).toBe(false)
    expect(parsed.next_payment_attempt_at).toBeUndefined()
  })
})

/* --------------------------------------------------------------- the port itself */

describe('the ported surface', () => {
  /**
   * An exact list rather than a set of absence checks. Absence checks have to spell
   * the names of the model this file replaced, which keeps those names alive in the
   * tree forever; equality catches the same regression — a line-item helper coming
   * back for an object that has no line items — and catches a lost export too.
   */
  it('exports exactly the Polar mapping surface', () => {
    expect(Object.keys(mapping).sort()).toEqual(
      [
        'POLAR_CHECKOUT_STATUSES',
        'POLAR_ORDER_STATUSES',
        'POLAR_SUBSCRIPTION_STATUSES',
        'cancelledRecord',
        'fromPolarTimestamp',
        'organizationIdFromMetadata',
        'organizationIdFromOrder',
        'organizationIdFromSubscription',
        'pendingChangeFromPolar',
        'polarCheckoutSchema',
        'polarCustomerSessionSchema',
        'polarDiscountListSchema',
        'polarDiscountSchema',
        'polarMetadataSchema',
        'polarOrderInvoiceSchema',
        'polarOrderListSchema',
        'polarOrderSchema',
        'polarPendingUpdateSchema',
        'polarSubscriptionDiscountSchema',
        'polarSubscriptionSchema',
        'resolveSubscriptionPlan',
        'subscriptionIdFromOrder',
        'subscriptionRecordFromPolar',
        'toSubscriptionStatus',
      ].sort(),
    )
  })
})
