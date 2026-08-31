/**
 * The invariant this file exists to protect: **what the UI is told and what the
 * repositories enforce are the same numbers.**
 *
 * The bug these tests are the answer to had two implementations of "what are this
 * tenant's limits". The repository guard read the subscription row's ceilings; the
 * billing screen derived its own from the marketing catalogue and never looked at the
 * row. `/settings/billing` told a paying workspace it was three seats over a limit it
 * was nowhere near, at a price it was not paying, while `/files` — reading the enforced
 * number — showed something else entirely.
 *
 * Agreeing today is not enough, so the equivalence suite below does not compare two
 * hand-written expectations. It writes a real row to a real database, then asks the two
 * *public* paths, the ones the product actually calls:
 *
 * - `resolveQuotas(scope)` — what `assertQuota()` enforces, column-shaped.
 * - `entitlements(ctx)` / `currentLimits(ctx)` — what the screen renders,
 *   catalogue-shaped.
 *
 * and requires them to be identical for every row shape that exists in the wild: free,
 * a priced plan, a tier-only legacy row, a row carrying `quota_overrides`, and a row
 * whose ceilings sit deliberately above its plan.
 */

// Must come first: it configures the price ids `#/lib/plans` reads at import.
import { TEST_PRODUCT_IDS } from './prices.fixture'

import { beforeEach, describe, expect, it } from 'vitest'

import { PLAN_IDS, PLANS, QUOTA_KEYS } from '#/lib/plans'
import { USAGE_METRICS } from '#/server/db/schema'
import { PLAN_QUOTAS, UNLIMITED } from '#/server/db/types'
import {
  createHarness as createDbHarness,
  captureError,
} from '#/server/repos/__tests__/harness'
import { assertQuota, resolveQuotas } from '#/server/repos/base'
import { upsertSubscription } from '#/server/repos/billing'
import { QuotaExceededError } from '#/server/repos/context'
import {
  assertWithinLimit,
  currentLimits,
  entitlements,
  planStateFromRecord,
} from '../entitlements'
import {
  METRIC_FOR_QUOTA,
  PLAN_RATE_CEILINGS,
  RATE_METRICS,
  ceilingsForPlan,
  planIdFromRow,
  resolveLimits,
  resolveLimitsFromRow,
} from '../limits'
import {
  ceilingColumns,
  createSubscriptionStore,
  recordFromRow,
} from '../store'
import { billingContext } from '../types'
import {
  createHarness as createBillingHarness,
  subscriptionRecord,
} from './harness'

import type { PlanId } from '#/lib/plans'
import type { QuotaOverrides } from '#/server/db/schema'
import type { UpsertSubscriptionInput } from '#/server/repos'
import type {
  Harness as DbHarness,
  SeededTenant,
} from '#/server/repos/__tests__/harness'
import type { SubscriptionLimitsRow } from '../limits'
import type { BillingRuntime, UsageSnapshot } from '../types'

const MEGABYTE = 1024 * 1024
const GIGABYTE = 1024 * MEGABYTE

/** A row shaped for the pure resolver, with only the interesting fields spelled out. */
function row(
  overrides: Partial<SubscriptionLimitsRow> = {},
): SubscriptionLimitsRow {
  return {
    plan: 'free',
    status: 'active',
    seats: 1,
    providerProductId: null,
    seatLimit: 1,
    storageLimitBytes: 100 * MEGABYTE,
    quotaOverrides: null,
    ...overrides,
  }
}

/* ------------------------------------------------------------- the authority order */

describe('authority order', () => {
  it('0 — a lapsed row grandfathers nothing, ceilings included', () => {
    for (const status of [
      'canceled',
      'unpaid',
      'paused',
      'incomplete_expired',
    ]) {
      const resolved = resolveLimitsFromRow(
        row({
          status,
          plan: 'business',
          seats: 10,
          providerProductId: TEST_PRODUCT_IDS.crewMonthly,
          seatLimit: 10,
          storageLimitBytes: 50 * GIGABYTE,
        }),
      )

      expect(resolved.planId, status).toBe('free')
      expect(resolved.limits.seats, status).toBe(PLANS.free.limits.seats)
      expect(resolved.limits.storageBytes, status).toBe(
        PLANS.free.limits.storageBytes,
      )
      expect(resolved.limits.realtime, status).toBe(false)
    }
  })

  it('1 — the provider product id outranks the tier column', () => {
    // A row whose tier says Free but whose product id says Crew is being charged for Crew.
    const resolved = resolveLimitsFromRow(
      row({
        plan: 'free',
        seats: 4,
        providerProductId: TEST_PRODUCT_IDS.crewMonthly,
      }),
    )

    expect(resolved.planId).toBe('crew')
    expect(resolved.limits.realtime).toBe(true)
  })

  it('1b — a row with no product id falls back to the tier column and its seat count', () => {
    expect(planIdFromRow(row({ plan: 'pro', seats: 1 }))).toBe('solo')
    expect(planIdFromRow(row({ plan: 'business', seats: 1 }))).toBe('solo')
    expect(planIdFromRow(row({ plan: 'business', seats: 4 }))).toBe('crew')
    expect(planIdFromRow(row({ plan: 'starter', seats: 9 }))).toBe('free')
    // An id this deployment does not sell is no better than none at all.
    expect(
      planIdFromRow(
        row({ plan: 'pro', seats: 1, providerProductId: 'product-retired' }),
      ),
    ).toBe('solo')
  })

  it('2 — the catalogue owns its own limits, the tier row owns the rest', () => {
    const resolved = resolveLimits({
      planId: 'solo',
      seats: 1,
      ceilings: ceilingsForPlan('solo', 1),
    })

    expect(resolved.limits.storageBytes).toBe(PLANS.solo.limits.storageBytes)
    expect(resolved.limits.trips).toBeNull()
    // `places` is not something the catalogue sells, so it comes from the tier row.
    expect(resolved.metrics.places).toBe(UNLIMITED)
  })

  it('2b — seats narrow to the seats purchased, never to the plan maximum', () => {
    expect(PLANS.crew.limits.seats).toBe(10)

    const resolved = resolveLimits({
      planId: 'crew',
      seats: 4,
      ceilings: ceilingsForPlan('crew', 4),
    })

    expect(resolved.limits.seats).toBe(4)
    expect(resolved.metrics.members).toBe(4)
  })

  it('3 — stored ceilings win, and may sit above the plan on purpose', () => {
    // The whole point of the escape hatch: a grandfathered Solo workspace on ten seats
    // and 20 GB, above everything its plan publishes.
    const resolved = resolveLimitsFromRow(
      row({
        plan: 'pro',
        seats: 1,
        seatLimit: 10,
        storageLimitBytes: 20 * GIGABYTE,
      }),
    )

    expect(resolved.planId).toBe('solo')
    expect(resolved.limits.seats).toBe(10)
    expect(resolved.limits.storageBytes).toBe(20 * GIGABYTE)
  })

  it('3b — quota_overrides has the final word, over any other metric too', () => {
    const resolved = resolveLimitsFromRow(
      row({
        plan: 'pro',
        seats: 1,
        seatLimit: 10,
        quotaOverrides: { members: 3, trips: 7, places: 42 },
      }),
    )

    expect(resolved.limits.seats).toBe(3)
    expect(resolved.limits.trips).toBe(7)
    expect(resolved.metrics.places).toBe(42)
  })

  it('puts a tenant with no row at all on the published Free plan', () => {
    const resolved = resolveLimitsFromRow(null)

    expect(resolved.planId).toBe('free')
    expect(resolved.limits.trips).toBe(PLANS.free.limits.trips)
    expect(resolved.metrics.trips).toBe(PLANS.free.limits.trips)
  })

  it('never lets a module be bought with a ceiling column', () => {
    // The columns can raise a number; they cannot unlock a feature the plan excludes.
    const resolved = resolveLimitsFromRow(
      row({ plan: 'free', seatLimit: 99, quotaOverrides: { trips: 99 } }),
    )

    expect(resolved.limits.realtime).toBe(false)
    expect(resolved.limits.reservations).toBe(false)
  })
})

/* ----------------------------------------------------- the two shapes of one answer */

describe('shape translation', () => {
  it('maps every catalogue quota onto exactly one metric column', () => {
    const resolved = resolveLimitsFromRow(row({ plan: 'business', seats: 3 }))

    for (const key of QUOTA_KEYS) {
      expect(asMetric(resolved.limits[key])).toBe(
        resolved.metrics[METRIC_FOR_QUOTA[key]],
      )
    }
  })

  it('renders unlimited as `null` for the client and as the sentinel for the guard', () => {
    const resolved = resolveLimits({
      planId: 'crew',
      seats: 2,
      ceilings: ceilingsForPlan('crew', 2),
    })

    expect(resolved.limits.trips).toBeNull()
    expect(resolved.metrics.trips).toBe(UNLIMITED)
    expect(JSON.parse(JSON.stringify(resolved.limits))).toEqual(resolved.limits)
  })
})

/** `null` (unlimited, JSON-safe) into the infinite sentinel the columns count in. */
function asMetric(limit: number | null): number {
  return limit === null ? UNLIMITED : limit
}

/* ------------------------------------------------------------------- the invariant */

/** Every row shape that exists in the wild, and why each one is here. */
const ROW_CASES: ReadonlyArray<{
  readonly name: string
  readonly values: UpsertSubscriptionInput | null
  readonly expectPlanId: PlanId
}> = [
  { name: 'no subscription row at all', values: null, expectPlanId: 'free' },
  {
    name: 'a free row written by the sanctioned path',
    values: {
      ...ceilingColumns(ceilingsForPlan('free', 1)),
      status: 'active',
      seats: 1,
    },
    expectPlanId: 'free',
  },
  {
    name: 'a priced Crew row',
    values: {
      ...ceilingColumns(ceilingsForPlan('crew', 10)),
      status: 'active',
      seats: 10,
      providerProductId: TEST_PRODUCT_IDS.crewMonthly,
    },
    expectPlanId: 'crew',
  },
  {
    name: 'a priced Solo row on a trial',
    values: {
      ...ceilingColumns(ceilingsForPlan('solo', 1)),
      status: 'trialing',
      seats: 1,
      providerProductId: TEST_PRODUCT_IDS.soloMonthly,
    },
    expectPlanId: 'solo',
  },
  {
    name: 'a tier-only legacy row with no product id',
    values: { plan: 'pro', status: 'active', seats: 1 },
    expectPlanId: 'solo',
  },
  {
    name: 'a row carrying quota_overrides',
    values: {
      plan: 'pro',
      status: 'active',
      seats: 2,
      quotaOverrides: { trips: 7, members: 3, places: 42 },
    },
    expectPlanId: 'solo',
  },
  {
    name: 'a row whose ceilings sit above its plan',
    values: {
      plan: 'pro',
      status: 'active',
      seats: 1,
      seatLimit: 10,
      storageLimitBytes: 20 * GIGABYTE,
    },
    expectPlanId: 'solo',
  },
  {
    name: 'a row whose ceilings sit below its plan',
    values: {
      ...ceilingColumns(ceilingsForPlan('crew', 10)),
      status: 'active',
      seats: 10,
      providerProductId: TEST_PRODUCT_IDS.crewMonthly,
      seatLimit: 2,
      storageLimitBytes: 1 * GIGABYTE,
    },
    expectPlanId: 'crew',
  },
  {
    name: 'a cancelled row that still remembers its Crew ceilings',
    values: {
      ...ceilingColumns(ceilingsForPlan('crew', 10)),
      status: 'canceled',
      seats: 10,
      providerProductId: TEST_PRODUCT_IDS.crewMonthly,
    },
    expectPlanId: 'free',
  },
  {
    name: 'a bare row that only carries a provider customer',
    values: { providerCustomerId: 'customer-bare' },
    expectPlanId: 'free',
  },
]

describe('the limits reported to the UI are the limits the repositories enforce', () => {
  let dbHarness: DbHarness
  let tenant: SeededTenant

  beforeEach(async () => {
    dbHarness = await createDbHarness()
    tenant = await dbHarness.seedTenant('equivalence')
  })

  /** The billing runtime the screen would use, over this test's real database. */
  function runtimeOver(usage: UsageSnapshot): BillingRuntime {
    const billing = createBillingHarness({ usage })
    return {
      ...billing.runtime,
      subscriptions: createSubscriptionStore(dbHarness.db),
    }
  }

  for (const testCase of ROW_CASES) {
    it(`agrees on every metric for ${testCase.name}`, async () => {
      if (testCase.values !== null) {
        await upsertSubscription(tenant.scope, testCase.values)
      }

      const enforced = await resolveQuotas(tenant.scope)
      const ctx = billingContext(
        runtimeOver({ seats: 0, trips: 0, storageBytes: 0 }),
        tenant.organizationId,
      )
      const displayed = await entitlements(ctx)

      expect(displayed.planId).toBe(testCase.expectPlanId)
      expect(enforced.planId).toBe(testCase.expectPlanId)

      for (const key of QUOTA_KEYS) {
        const metric = METRIC_FOR_QUOTA[key]
        expect(
          asMetric(displayed.limits[key]),
          `${testCase.name}: ${key} displayed vs ${metric} enforced`,
        ).toBe(enforced.limits[metric])
        expect(asMetric(displayed.quotas[key].limit)).toBe(
          enforced.limits[metric],
        )
      }

      // `currentLimits()` is the same answer by a shorter route; it must not differ.
      await expect(currentLimits(ctx)).resolves.toEqual(displayed.limits)
    })
  }

  it('refuses and allows the same write on both sides of the boundary', async () => {
    // A grandfathered Solo workspace: three seats, above everything Solo publishes.
    await upsertSubscription(tenant.scope, {
      plan: 'pro',
      status: 'active',
      seats: 1,
      seatLimit: 3,
    })

    const enforced = await resolveQuotas(tenant.scope)
    expect(enforced.limits.members).toBe(3)

    // One seat below the ceiling: both sides allow the next member.
    const under = billingContext(
      runtimeOver({ seats: 2, trips: 0, storageBytes: 0 }),
      tenant.organizationId,
    )
    await expect(assertWithinLimit(under, 'seats', 1)).resolves.toBeUndefined()
    await expect(
      assertQuota(tenant.scope, 'members', 2, 1),
    ).resolves.toBeUndefined()

    // Exactly on it: both sides refuse, and name the same ceiling.
    const at = billingContext(
      runtimeOver({ seats: 3, trips: 0, storageBytes: 0 }),
      tenant.organizationId,
    )
    await expect(assertWithinLimit(at, 'seats', 1)).rejects.toMatchObject({
      violation: { key: 'seats', limit: 3, used: 3 },
    })
    const guard = await captureError(() =>
      assertQuota(tenant.scope, 'members', 3, 1),
    )
    expect(guard).toBeInstanceOf(QuotaExceededError)
    expect(guard.message).toContain('3')
  })

  it('still flags a workspace that is genuinely over a ceiling', async () => {
    // The case the broken screen invented and then got wrong: four members against a
    // ceiling of one. Once it is real, the meter has to say so.
    await upsertSubscription(tenant.scope, {
      plan: 'pro',
      status: 'active',
      seats: 1,
      seatLimit: 1,
      storageLimitBytes: 1 * MEGABYTE,
      quotaOverrides: { trips: 2 },
    })

    const ctx = billingContext(
      runtimeOver({ seats: 4, trips: 9, storageBytes: 5 * MEGABYTE }),
      tenant.organizationId,
    )
    const displayed = await entitlements(ctx)
    const enforced = await resolveQuotas(tenant.scope)

    expect(displayed.quotas.seats).toMatchObject({
      limit: 1,
      used: 4,
      exceeded: true,
    })
    expect(displayed.quotas.trips).toMatchObject({
      limit: 2,
      used: 9,
      exceeded: true,
    })
    expect(displayed.quotas.storageBytes.exceeded).toBe(true)
    // The over-limit warning is driven by `used > limit`, so it has to be true here.
    for (const key of QUOTA_KEYS) {
      const quota = displayed.quotas[key]
      expect(quota.limit).not.toBeNull()
      expect(quota.used > (quota.limit ?? 0)).toBe(true)
      expect(asMetric(quota.limit)).toBe(enforced.limits[METRIC_FOR_QUOTA[key]])
    }
  })

  it('round-trips a row through the record without losing its ceilings', async () => {
    const written = await upsertSubscription(tenant.scope, {
      plan: 'business',
      status: 'active',
      seats: 6,
      seatLimit: 12,
      storageLimitBytes: 30 * GIGABYTE,
      quotaOverrides: { journeys: 5 },
    })

    const record = recordFromRow(written)
    expect(record.ceilings).toEqual({
      tier: 'business',
      seatLimit: 12,
      storageLimitBytes: 30 * GIGABYTE,
      overrides: { journeys: 5 },
    })

    const fromRecord = resolveLimits(planStateFromRecord(record))
    const fromRow = await resolveQuotas(tenant.scope)
    for (const key of QUOTA_KEYS) {
      expect(asMetric(fromRecord.limits[key])).toBe(
        fromRow.limits[METRIC_FOR_QUOTA[key]],
      )
    }
    expect(fromRecord.metrics.journeys).toBe(5)
  })
})

/* ------------------------------------------------------------------ what a plan writes */

describe('ceilingsForPlan', () => {
  it('writes the plan it is given, in the columns the guard reads back', () => {
    expect(ceilingsForPlan('free', 1)).toEqual({
      tier: 'free',
      seatLimit: PLANS.free.limits.seats,
      storageLimitBytes: PLANS.free.limits.storageBytes,
      overrides: { trips: PLANS.free.limits.trips },
    })
    expect(ceilingsForPlan('crew', 4)).toEqual({
      tier: 'business',
      seatLimit: 4,
      storageLimitBytes: PLANS.crew.limits.storageBytes,
      // Crew's trips are uncapped, and no integer column can say so — the tier it maps
      // to has no cap either, which is exactly why it maps there.
      overrides: {},
    })
  })

  it('leaves a freshly written row agreeing with itself', () => {
    // What the seed and the webhook both produce: a record whose ceilings are its
    // plan's, resolving back to the very limits the catalogue published.
    for (const planId of ['free', 'solo', 'crew'] as const) {
      const seats = planId === 'crew' ? 10 : 1
      const record = subscriptionRecord({
        planId,
        seats,
        status: 'active',
        providerProductId: null,
        interval: null,
        ceilings: ceilingsForPlan(planId, seats),
      })
      const resolved = resolveLimits(planStateFromRecord(record))

      expect(resolved.planId, planId).toBe(planId)
      expect(resolved.limits.seats, planId).toBe(PLANS[planId].limits.seats)
      expect(resolved.limits.trips, planId).toBe(PLANS[planId].limits.trips)
      expect(resolved.limits.storageBytes, planId).toBe(
        PLANS[planId].limits.storageBytes,
      )
    }
  })
})

/* ----------------------------------------------------------------- rate ceilings */

/**
 * The second kind of ceiling, and the reason it is a second kind.
 *
 * Every metric above bounds a *row* a workspace owns: the guard counts what is in the table and
 * `assertQuota()` refuses the next insert. Neither of the two below leaves a row. A transit search
 * is a metered call to a routing provider; an extraction is a document turned into a draft booking
 * by our own model binding. Both are made on a tenant's behalf and billed to us, and a tenant that
 * makes either in a loop spends money every other tenant is paying for. So the numbers are resolved
 * here, beside the ones they must never contradict, and enforced by the per-organization tally over
 * KV that `03-S3` builds and `03-S7` reuses under the second name.
 *
 * The cases below are written over `RATE_METRICS` rather than over one metric, because everything
 * that is true of the first is true of the second by construction: they resolve through the same
 * step of the authority order, lapse with the same subscription and are refused the same escape
 * hatch. A case naming one metric would leave the other asserted by nothing.
 */
describe('metered provider calls, ceilings on calls rather than on rows', () => {
  it('resolves the plan its row is entitled to, for every plan', () => {
    for (const planId of PLAN_IDS) {
      const seats = planId === 'crew' ? 4 : 1
      const resolved = resolveLimits({
        planId,
        seats,
        ceilings: ceilingsForPlan(planId, seats),
      })

      for (const metric of RATE_METRICS) {
        expect(resolved.rates[metric], `${planId}.${metric}`).toBe(
          PLAN_RATE_CEILINGS[planId][metric],
        )
      }
    }
  })

  it('takes the allowance away with the plan when a subscription lapses', () => {
    // Step 0 of the authority order reaches these ceilings too: a cancelled Crew workspace keeps
    // making provider calls at Crew's rate otherwise, on a subscription nobody is paying for.
    const lapsed = resolveLimitsFromRow(
      row({
        status: 'canceled',
        plan: 'business',
        seats: 10,
        providerProductId: TEST_PRODUCT_IDS.crewMonthly,
      }),
    )

    expect(lapsed.planId).toBe('free')
    for (const metric of RATE_METRICS) {
      expect(lapsed.rates[metric], metric).toBe(PLAN_RATE_CEILINGS.free[metric])
    }
  })

  it('sells no plan an unbounded number of provider calls', () => {
    // `UNLIMITED` is available and deliberately unused: a row costs us storage, a call costs us
    // money on somebody else's invoice, and an uncapped one has no ceiling to discover it by.
    for (const planId of PLAN_IDS) {
      for (const metric of RATE_METRICS) {
        const ceiling = PLAN_RATE_CEILINGS[planId][metric]
        expect(Number.isSafeInteger(ceiling), `${planId}.${metric}`).toBe(true)
        expect(ceiling, `${planId}.${metric}`).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('gives an allowance to exactly the plans that can reach the desk', () => {
    // Both calls are reached from the booking desk — the search from the add-transport dialog, the
    // extraction from the import beside New booking — and the desk is the `reservations` module. A
    // positive allowance on a plan that cannot open it would be a number nobody can spend; a zero
    // one on a plan that can would be a screen that is on and refuses every press.
    for (const planId of PLAN_IDS) {
      const resolved = resolveLimits({ planId, seats: 1, ceilings: null })

      for (const metric of RATE_METRICS) {
        expect(resolved.rates[metric] > 0, `${planId}.${metric}`).toBe(
          resolved.limits.reservations,
        )
      }
    }
  })

  it('costs more per extraction than per lookup, and is sized accordingly', () => {
    // A transit search is one request to a timetable. An extraction converts a document to text and
    // then runs a model over it, so it is the dearer call of the two and its allowance is never the
    // looser one. Stated as an ordering rather than as two literals, so the argument survives the
    // next time either figure is re-sized.
    for (const planId of PLAN_IDS) {
      expect(
        PLAN_RATE_CEILINGS[planId].extraction_calls_per_month,
        planId,
      ).toBeLessThanOrEqual(
        PLAN_RATE_CEILINGS[planId].transit_searches_per_month,
      )
    }
  })

  it('is not raisable by the per-tenant escape hatch, which counts rows only', () => {
    // `quota_overrides` is `Partial<Record<UsageMetric, number>>` under a CHECK-constrained enum,
    // and neither of these metrics is a `UsageMetric`. An operator who writes the key gets it
    // ignored rather than applied — stated here so the next reader does not take the silence for
    // an override that worked.
    const overrides = Object.fromEntries(
      RATE_METRICS.map((metric) => [metric, 9_999]),
    )
    const resolved = resolveLimitsFromRow(
      row({
        plan: 'pro',
        seats: 1,
        quotaOverrides: overrides as unknown as QuotaOverrides,
      }),
    )

    expect(resolved.planId).toBe('solo')
    for (const metric of RATE_METRICS) {
      expect(resolved.rates[metric], metric).toBe(
        PLAN_RATE_CEILINGS.solo[metric],
      )
      expect(Object.keys(resolved.metrics)).not.toContain(metric)
    }
  })

  it('stays out of the published quota table, on both sides of it', () => {
    // The published table sells ceilings on rows a workspace owns and is rendered as such. Neither
    // of these is sold or counted there, and `assertQuota()` must never find one: a guard that
    // half-applies a ceiling is worse than one that does not apply it at all.
    for (const metric of RATE_METRICS) {
      expect(USAGE_METRICS as ReadonlyArray<string>).not.toContain(metric)
      expect(QUOTA_KEYS as ReadonlyArray<string>).not.toContain(metric)
      for (const tier of Object.keys(PLAN_QUOTAS)) {
        expect(
          Object.keys(PLAN_QUOTAS[tier as keyof typeof PLAN_QUOTAS]),
        ).not.toContain(metric)
      }
    }
  })
})
