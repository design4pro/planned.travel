import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  BILLING_STATES,
  PLANS,
  SUBSCRIPTION_STATUSES,
  clampSeats,
  effectiveSeatLimit,
  isEntitlingStatus,
  requirePrice,
} from '../plans'

const PRODUCT_ID_NAMES = [
  'VITE_POLAR_PRODUCT_SOLO_MONTHLY',
  'VITE_POLAR_PRODUCT_SOLO_YEARLY',
  'VITE_POLAR_PRODUCT_CREW_MONTHLY',
  'VITE_POLAR_PRODUCT_CREW_YEARLY',
] as const

/**
 * The catalogue reads its four product ids from `import.meta.env` at module
 * evaluation time, so a test that cares about them has to stub the environment
 * and re-evaluate the module. All four names are always stubbed, blank unless
 * named: a developer's `.env.local` is loaded into a local test run and would
 * otherwise make these cases pass here and fail in CI, or the reverse.
 */
async function catalogueWith(ids: Readonly<Record<string, string>> = {}) {
  vi.resetModules()
  for (const name of PRODUCT_ID_NAMES) vi.stubEnv(name, ids[name] ?? '')
  return import('../plans')
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('SUBSCRIPTION_STATUSES', () => {
  it('carries all eight of the provider statuses', () => {
    expect(SUBSCRIPTION_STATUSES).toHaveLength(8)
    expect(SUBSCRIPTION_STATUSES).toEqual([
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused',
    ])
  })

  /**
   * These two look inherited from a previous provider and are not: Polar sends
   * both, and `subscriptions_status_chk` mirrors this tuple in SQL, so dropping
   * one would fail a legitimate webhook on write rather than fail a type check.
   */
  it('keeps the two incomplete statuses the CHECK constraint mirrors', () => {
    expect(SUBSCRIPTION_STATUSES).toContain('incomplete')
    expect(SUBSCRIPTION_STATUSES).toContain('incomplete_expired')
  })

  it('appends our own `none` sentinel to the billing states and nothing else', () => {
    expect(BILLING_STATES).toEqual([...SUBSCRIPTION_STATUSES, 'none'])
  })

  it('entitles only the three statuses that still grant the paid plan', () => {
    const entitling = SUBSCRIPTION_STATUSES.filter(isEntitlingStatus)
    expect(entitling).toEqual(['trialing', 'active', 'past_due'])
  })
})

describe('the Crew seat contract', () => {
  it('bills per seat between two and ten members', () => {
    expect(PLANS.crew.seatBased).toBe(true)
    expect(PLANS.crew.seatRange).toEqual({ min: 2, max: 10 })
  })

  it('prices both intervals per seat', () => {
    expect(PLANS.crew.prices.monthly).toMatchObject({
      amount: 700,
      perSeat: true,
    })
    expect(PLANS.crew.prices.yearly).toMatchObject({
      amount: 7000,
      perSeat: true,
    })
  })

  it('leaves Solo billed flat for one person', () => {
    expect(PLANS.solo.seatBased).toBe(false)
    expect(PLANS.solo.seatRange).toEqual({ min: 1, max: 1 })
    expect(PLANS.solo.prices.monthly).toMatchObject({
      amount: 900,
      perSeat: false,
    })
    expect(PLANS.solo.prices.yearly).toMatchObject({
      amount: 9000,
      perSeat: false,
    })
  })
})

describe('clampSeats', () => {
  it('holds a request inside the plan range', () => {
    expect(clampSeats(PLANS.crew, 1)).toBe(2)
    expect(clampSeats(PLANS.crew, 6)).toBe(6)
    expect(clampSeats(PLANS.crew, 40)).toBe(10)
  })

  it('floors a fractional request and falls back to the minimum on a non-number', () => {
    expect(clampSeats(PLANS.crew, 6.9)).toBe(6)
    expect(clampSeats(PLANS.crew, Number.NaN)).toBe(2)
  })

  it('pins a flat plan to its single seat', () => {
    expect(clampSeats(PLANS.solo, 9)).toBe(1)
    expect(clampSeats(PLANS.free, 0)).toBe(1)
  })
})

describe('effectiveSeatLimit', () => {
  it('lets a seat-based plan fill only the seats it pays for', () => {
    expect(effectiveSeatLimit(PLANS.crew, 4)).toBe(4)
    expect(effectiveSeatLimit(PLANS.crew, 99)).toBe(10)
  })

  it('ignores the purchased count on a flat plan', () => {
    expect(effectiveSeatLimit(PLANS.solo, 7)).toBe(1)
  })
})

describe('planForProductId', () => {
  it('resolves a configured product id back to its plan and interval', async () => {
    const productId = 'c47b1d38-0f56-4a29-b3e8-52d9a610f7be'
    const catalogue = await catalogueWith({
      VITE_POLAR_PRODUCT_CREW_YEARLY: productId,
    })

    expect(catalogue.planForProductId(productId)).toEqual({
      plan: catalogue.PLANS.crew,
      interval: 'yearly',
    })
  })

  it('never matches on the empty id an unconfigured deployment carries', async () => {
    const catalogue = await catalogueWith()

    expect(catalogue.planForProductId('')).toBeNull()
    expect(catalogue.planForProductId(null)).toBeNull()
    expect(catalogue.planForProductId(undefined)).toBeNull()
  })

  it('returns null for a product this deployment does not sell', async () => {
    const catalogue = await catalogueWith({
      VITE_POLAR_PRODUCT_SOLO_MONTHLY: '3f1d9c02-7a64-4b18-9e5c-8d1a2f0b6c31',
    })

    expect(
      catalogue.planForProductId('9a2c7e50-64b1-4d83-a15f-7c0e2b48d963'),
    ).toBeNull()
  })
})

describe('requirePrice', () => {
  it('names the missing build variable rather than charging the wrong thing', async () => {
    const catalogue = await catalogueWith()

    expect(() =>
      catalogue.requirePrice(catalogue.PLANS.solo, 'monthly'),
    ).toThrow('Set VITE_POLAR_PRODUCT_SOLO_MONTHLY.')
    expect(() =>
      catalogue.requirePrice(catalogue.PLANS.crew, 'yearly'),
    ).toThrow('Set VITE_POLAR_PRODUCT_CREW_YEARLY.')
  })

  it('refuses a plan that is not sold on that interval', () => {
    expect(() => requirePrice(PLANS.free, 'monthly')).toThrow(
      'Plan "free" cannot be purchased on a monthly interval.',
    )
  })

  it('returns the configured price once the id is set', async () => {
    const productId = '3f1d9c02-7a64-4b18-9e5c-8d1a2f0b6c31'
    const catalogue = await catalogueWith({
      VITE_POLAR_PRODUCT_SOLO_MONTHLY: productId,
    })

    expect(catalogue.requirePrice(catalogue.PLANS.solo, 'monthly')).toEqual({
      interval: 'monthly',
      productId,
      amount: 900,
      currency: 'usd',
      perSeat: false,
    })
  })
})
