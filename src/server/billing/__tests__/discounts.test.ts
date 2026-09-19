/**
 * Resolving a typed promotion code. Every assertion here is about what reaches Polar — how many
 * requests, and which — and what the customer is told, because the two failures this module
 * exists to prevent are a guessable catalogue and a drained rate limit.
 */

// Must come first: it configures the product ids `#/lib/plans` reads at import.
import { TEST_PRODUCT_IDS } from './prices.fixture'

import { describe, expect, it } from 'vitest'

import {
  DISCOUNT_ATTEMPTS_PER_HOUR,
  appliesToProduct,
  discountHitKey,
  discountLookupBudgetFor,
  discountMissKey,
  fit,
  resolveDiscount,
} from '../discounts'
import { PolarApiError } from '../polar'
import { BillingConfigError } from '../types'
import {
  TEST_DISCOUNT_ID,
  billingIdentity,
  createHarness,
  polarDiscount,
} from './harness'

import type { PolarDiscount } from '../mapping'
import type { HarnessOptions } from './harness'

const NOW = new Date('2025-03-04T09:17:00.000Z')
const SOLO = TEST_PRODUCT_IDS.soloMonthly
const CREW = TEST_PRODUCT_IDS.crewMonthly

function setup(
  discounts: ReadonlyArray<PolarDiscount>,
  options: HarnessOptions = {},
) {
  return createHarness({
    now: NOW,
    ...options,
    polar: { discounts, ...options.polar },
  })
}

/** `count` discounts nobody would type, so a real code can be placed past a page boundary. */
function filler(count: number): Array<PolarDiscount> {
  return Array.from({ length: count }, (_, index) =>
    polarDiscount({ id: `filler-${index}`, code: `FILLER${index}` }),
  )
}

const identity = billingIdentity({ clientIp: '203.0.113.7' })

describe('fit', () => {
  it('fits an open-ended, unlimited, unrestricted code', () => {
    expect(fit(polarDiscount(), SOLO, NOW)).toBeNull()
  })

  it('names each bound that refuses', () => {
    expect(
      fit(polarDiscount({ starts_at: '2025-03-05T00:00:00Z' }), SOLO, NOW),
    ).toBe('not_started')
    expect(
      fit(polarDiscount({ ends_at: '2025-03-04T09:17:00Z' }), SOLO, NOW),
    ).toBe('expired')
    expect(
      fit(
        polarDiscount({ max_redemptions: 1, redemptions_count: 1 }),
        SOLO,
        NOW,
      ),
    ).toBe('exhausted')
    expect(fit(polarDiscount({ products: [{ id: CREW }] }), SOLO, NOW)).toBe(
      'not_applicable',
    )
  })

  it('accepts a code inside its window with redemptions left', () => {
    const live = polarDiscount({
      starts_at: '2025-03-01T00:00:00Z',
      ends_at: '2025-03-31T00:00:00Z',
      max_redemptions: 2,
      redemptions_count: 1,
      products: [{ id: SOLO }],
    })
    expect(fit(live, SOLO, NOW)).toBeNull()
  })

  it('treats an empty product list as every product', () => {
    expect(appliesToProduct({ products: [] }, CREW)).toBe(true)
    expect(appliesToProduct({ products: [{ id: SOLO }] }, CREW)).toBe(false)
  })
})

describe('resolveDiscount', () => {
  it('finds a code case-insensitively and caches the hit', async () => {
    const h = setup([polarDiscount()])
    const result = await resolveDiscount(
      h.runtime,
      identity,
      ' summer20 ',
      SOLO,
    )

    expect(result).toEqual({ ok: true, discount: polarDiscount() })
    expect(h.cache.entries.get(discountHitKey('SUMMER20'))).toBe(
      TEST_DISCOUNT_ID,
    )
  })

  it('confirms a cached code by id, without paging', async () => {
    const h = setup([polarDiscount()])
    await resolveDiscount(h.runtime, identity, 'SUMMER20', SOLO)
    h.calls.length = 0

    await resolveDiscount(h.runtime, identity, 'SUMMER20', SOLO)
    expect(h.calls.map((call) => call.path)).toEqual([
      `/v1/discounts/${TEST_DISCOUNT_ID}`,
    ])
  })

  it.each([
    ['unknown', [], 'invalid'],
    [
      'expired',
      [polarDiscount({ ends_at: '2025-01-01T00:00:00Z' })],
      'invalid',
    ],
    [
      'not_started',
      [polarDiscount({ starts_at: '2026-01-01T00:00:00Z' })],
      'invalid',
    ],
    [
      'exhausted',
      [polarDiscount({ max_redemptions: 1, redemptions_count: 1 })],
      'invalid',
    ],
    [
      'not_applicable',
      [polarDiscount({ products: [{ id: CREW }] })],
      'not_applicable',
    ],
  ] as const)(
    'logs %s precisely and tells the customer %s',
    async (precise, catalogue, shown) => {
      const h = setup(catalogue)
      const result = await resolveDiscount(
        h.runtime,
        identity,
        'SUMMER20',
        SOLO,
      )

      expect(result).toEqual({ ok: false, reason: shown })
      const log = h.logs.find(
        (entry) => entry.message === 'billing.discount.rejected',
      )
      expect(log?.fields).toMatchObject({
        reason: precise,
        userId: identity.userId,
      })
      expect(JSON.stringify(h.logs)).not.toContain('SUMMER20')
    },
  )

  it('finds a code past the first page', async () => {
    const h = setup([...filler(250), polarDiscount()])
    const result = await resolveDiscount(h.runtime, identity, 'SUMMER20', SOLO)

    expect(result.ok).toBe(true)
    expect(h.calls.map((call) => call.query?.page)).toEqual([1, 2, 3])
  })

  it('stops after ten pages, refuses the code and logs the truncation', async () => {
    const h = setup([...filler(1000), polarDiscount()])
    const runtime = { ...h.runtime, discountLookupBudget: 100 }
    const result = await resolveDiscount(runtime, identity, 'SUMMER20', SOLO)

    expect(result).toEqual({ ok: false, reason: 'invalid' })
    expect(h.calls).toHaveLength(10)
    expect(
      h.logs.some(
        (entry) => entry.message === 'billing.discount.lookup_truncated',
      ),
    ).toBe(true)
  })

  it('serves a repeated wrong code from the miss cache, and still counts it', async () => {
    const h = setup([])
    await resolveDiscount(h.runtime, identity, 'NOPE123', SOLO)
    expect(h.cache.entries.has(discountMissKey('NOPE123'))).toBe(true)
    h.calls.length = 0

    const again = await resolveDiscount(h.runtime, identity, 'NOPE123', SOLO)
    expect(again).toEqual({ ok: false, reason: 'invalid' })
    expect(h.calls).toEqual([])
    expect(h.cache.entries.get('billing:discount-attempts:u:user_test')).toBe(
      '2',
    )
  })

  describe('the per-caller limiter', () => {
    it('refuses the eleventh attempt with no Polar call, accepted attempts included', async () => {
      const h = setup([polarDiscount()])
      for (
        let attempt = 0;
        attempt < DISCOUNT_ATTEMPTS_PER_HOUR;
        attempt += 1
      ) {
        expect(
          (await resolveDiscount(h.runtime, identity, 'SUMMER20', SOLO)).ok,
        ).toBe(true)
      }
      h.calls.length = 0

      const eleventh = await resolveDiscount(
        h.runtime,
        identity,
        'SUMMER20',
        SOLO,
      )
      expect(eleventh).toEqual({ ok: false, reason: 'rate_limited' })
      expect(h.calls).toEqual([])
    })

    it.each([
      ['user', { organizationId: 'org_other', clientIp: '198.51.100.1' }],
      ['organization', { userId: 'user_other', clientIp: '198.51.100.1' }],
      ['address', { userId: 'user_other', organizationId: 'org_other' }],
    ] as const)('counts per %s', async (_, fresh) => {
      const h = setup([])
      for (
        let attempt = 0;
        attempt < DISCOUNT_ATTEMPTS_PER_HOUR;
        attempt += 1
      ) {
        await resolveDiscount(h.runtime, identity, `WRONG${attempt}`, SOLO)
      }
      // Only one of the three keys is shared with the caller above, and it is spent.
      const result = await resolveDiscount(
        h.runtime,
        billingIdentity({ clientIp: identity.clientIp, ...fresh }),
        'SUMMER20',
        SOLO,
      )
      expect(result).toEqual({ ok: false, reason: 'rate_limited' })
    })
  })

  describe('the global lookup budget', () => {
    it('refuses the lookup past the budget with busy, whoever asks', async () => {
      const h = setup([])
      for (let caller = 0; caller < 20; caller += 1) {
        await resolveDiscount(
          h.runtime,
          billingIdentity({
            userId: `u${caller}`,
            organizationId: `o${caller}`,
            clientIp: `198.51.100.${caller}`,
          }),
          `WRONG${caller}`,
          SOLO,
        )
      }
      expect(h.calls).toHaveLength(20)

      const late = await resolveDiscount(
        h.runtime,
        billingIdentity({
          userId: 'late',
          organizationId: 'late',
          clientIp: '192.0.2.1',
        }),
        'SUMMER20',
        SOLO,
      )
      expect(late).toEqual({ ok: false, reason: 'busy' })
      expect(h.calls).toHaveLength(20)
      expect(
        h.logs.some(
          (entry) =>
            entry.message === 'billing.discount.lookup_budget_exhausted',
        ),
      ).toBe(true)
    })

    it('does not count a by-id confirmation', async () => {
      const h = setup([polarDiscount()])
      await resolveDiscount(h.runtime, identity, 'SUMMER20', SOLO)
      await resolveDiscount(
        h.runtime,
        billingIdentity({ userId: 'u2' }),
        'SUMMER20',
        SOLO,
      )

      const minute = Math.floor(NOW.getTime() / 60_000)
      expect(h.cache.entries.get(`billing:discount-lookups:${minute}`)).toBe(
        '1',
      )
    })

    it('is a fifth of the environment limit', () => {
      expect(discountLookupBudgetFor('production')).toBe(100)
      expect(discountLookupBudgetFor('sandbox')).toBe(20)
    })
  })

  it('turns a 403 into a configuration error and names the scope in the log', async () => {
    const h = setup([], {
      polar: { discountError: new PolarApiError(403, '{}', 'Forbidden') },
    })

    await expect(
      resolveDiscount(h.runtime, identity, 'SUMMER20', SOLO),
    ).rejects.toBeInstanceOf(BillingConfigError)
    expect(
      h.logs.find(
        (entry) => entry.message === 'billing.discount.lookup_forbidden',
      )?.fields,
    ).toMatchObject({ missingScope: 'discounts:read' })
  })

  it('lets a 429 through to the caller’s readable error', async () => {
    const h = setup([], {
      polar: { discountError: new PolarApiError(429, '{}', 'Too many') },
    })
    await expect(
      resolveDiscount(h.runtime, identity, 'SUMMER20', SOLO),
    ).rejects.toMatchObject({
      status: 429,
    })
  })
})
