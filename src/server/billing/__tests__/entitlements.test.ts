/**
 * Entitlement maths, asserted exactly on the plan boundaries.
 *
 * A quota bug is only ever visible at three points: the last allowed unit, the
 * first disallowed one, and the case where there is no limit at all. Every test
 * below sits on one of those three, because everything between them is
 * arithmetic that cannot fail on its own.
 */

// Must come first: it configures the price ids `#/lib/plans` reads at import.
import './prices.fixture'

import { describe, expect, it } from 'vitest'

import {
  assertWithinLimit,
  currentLimits,
  entitlements,
  hasFeature,
  invalidateEntitlements,
  loadPlanState,
  planStateCacheKey,
  planStateFromRecord,
  quotaState,
} from '../entitlements'
import {
  FeatureLockedError,
  QuotaExceededError,
  billingContext,
} from '../types'
import { PLANS } from '#/lib/plans'
import { TEST_ORG_ID, createHarness, subscriptionRecord } from './harness'

import type { SubscriptionRecord, UsageSnapshot } from '../types'

const MEGABYTE = 1024 * 1024
const GIGABYTE = 1024 * MEGABYTE

const FREE_TRIPS = PLANS.free.limits.trips
const FREE_STORAGE = PLANS.free.limits.storageBytes

function usage(overrides: Partial<UsageSnapshot> = {}): UsageSnapshot {
  return { seats: 1, trips: 0, storageBytes: 0, ...overrides }
}

function context(options: {
  record?: SubscriptionRecord
  usage?: UsageSnapshot
  now?: Date
}) {
  const harness = createHarness({
    record: options.record,
    usage: options.usage,
    now: options.now,
  })
  return { harness, ctx: billingContext(harness.runtime, TEST_ORG_ID) }
}

/* --------------------------------------------------------------- plan resolution */

describe('plan resolution', () => {
  it('puts an organization with no subscription row on Free', () => {
    const state = planStateFromRecord(null)

    expect(state.planId).toBe('free')
    expect(state.status).toBe('none')
    expect(state.seats).toBe(1)
    expect(state.hasProviderCustomer).toBe(false)
  })

  it('keeps a paid plan while the status still entitles it', () => {
    for (const status of ['trialing', 'active', 'past_due'] as const) {
      const state = planStateFromRecord(subscriptionRecord({ status }))
      expect(state.planId, status).toBe('crew')
    }
  })

  it('falls back to Free the moment the status stops entitling', () => {
    for (const status of [
      'canceled',
      'unpaid',
      'paused',
      'incomplete_expired',
    ] as const) {
      const state = planStateFromRecord(subscriptionRecord({ status }))
      expect(state.planId, status).toBe('free')
    }
  })
})

/* --------------------------------------------------------- countable quotas */

describe('quota state at the boundary', () => {
  it('reads as full but not exceeded on the last allowed unit', () => {
    const state = quotaState('trips', 2, 2)

    expect(state.limit).toBe(2)
    expect(state.used).toBe(2)
    expect(state.remaining).toBe(0)
    expect(state.ratio).toBe(1)
    expect(state.exceeded).toBe(false)
  })

  it('reads as exceeded one unit over, without a ratio above one', () => {
    const state = quotaState('trips', 2, 3)

    expect(state.remaining).toBe(0)
    expect(state.ratio).toBe(1)
    expect(state.exceeded).toBe(true)
  })

  it('reads as empty on the unit before the limit', () => {
    const state = quotaState('trips', 2, 1)

    expect(state.remaining).toBe(1)
    expect(state.ratio).toBe(0.5)
    expect(state.exceeded).toBe(false)
  })

  it('never meters an unlimited quota', () => {
    const state = quotaState('trips', null, 9_999)

    expect(state.limit).toBeNull()
    expect(state.remaining).toBeNull()
    expect(state.ratio).toBe(0)
    expect(state.exceeded).toBe(false)
  })
})

/* -------------------------------------------------------------- enforcement */

describe('assertWithinLimit', () => {
  it('allows the write that fills the last slot', async () => {
    const { ctx } = context({
      usage: usage({ trips: FREE_TRIPS === null ? 0 : FREE_TRIPS - 1 }),
    })

    await expect(assertWithinLimit(ctx, 'trips', 1)).resolves.toBeUndefined()
  })

  it('allows a zero-sized request while sitting exactly on the limit', async () => {
    const { ctx } = context({ usage: usage({ trips: 2 }) })

    await expect(assertWithinLimit(ctx, 'trips', 0)).resolves.toBeUndefined()
  })

  it('refuses the write that would be one over the limit', async () => {
    const { ctx } = context({ usage: usage({ trips: 2 }) })

    await expect(assertWithinLimit(ctx, 'trips', 1)).rejects.toBeInstanceOf(
      QuotaExceededError,
    )
  })

  it('reports the violation in terms the UI can act on', async () => {
    const { ctx } = context({ usage: usage({ trips: 2 }) })

    await expect(assertWithinLimit(ctx, 'trips', 1)).rejects.toMatchObject({
      name: 'QuotaExceededError',
      violation: {
        key: 'trips',
        planId: 'free',
        limit: 2,
        used: 2,
        requested: 1,
      },
    })
  })

  it('refuses a batch that overshoots even when the first unit would fit', async () => {
    const { ctx } = context({ usage: usage({ trips: 1 }) })

    await expect(assertWithinLimit(ctx, 'trips', 1)).resolves.toBeUndefined()
    await expect(assertWithinLimit(ctx, 'trips', 2)).rejects.toBeInstanceOf(
      QuotaExceededError,
    )
  })

  it('never refuses anything on an unlimited quota', async () => {
    const { ctx } = context({
      record: subscriptionRecord({
        planId: 'solo',
        seats: 1,
        interval: 'monthly',
      }),
      usage: usage({ trips: 100_000 }),
    })

    await expect(
      assertWithinLimit(ctx, 'trips', 50_000),
    ).resolves.toBeUndefined()
  })

  it('caps seats at the number purchased, not at the plan maximum', async () => {
    const purchased = 4
    expect(PLANS.crew.limits.seats).toBe(10)

    const atLimit = context({
      record: subscriptionRecord({ seats: purchased }),
      usage: usage({ seats: purchased }),
    })
    await expect(
      assertWithinLimit(atLimit.ctx, 'seats', 1),
    ).rejects.toMatchObject({
      violation: { key: 'seats', limit: purchased, used: purchased },
    })

    const underLimit = context({
      record: subscriptionRecord({ seats: purchased }),
      usage: usage({ seats: purchased - 1 }),
    })
    await expect(
      assertWithinLimit(underLimit.ctx, 'seats', 1),
    ).resolves.toBeUndefined()
  })

  it('measures storage to the byte', async () => {
    expect(FREE_STORAGE).toBe(100 * MEGABYTE)

    const full = context({ usage: usage({ storageBytes: 100 * MEGABYTE }) })
    await expect(
      assertWithinLimit(full.ctx, 'storageBytes', 1),
    ).rejects.toBeInstanceOf(QuotaExceededError)

    const nearlyFull = context({
      usage: usage({ storageBytes: 100 * MEGABYTE - 1 }),
    })
    await expect(
      assertWithinLimit(nearlyFull.ctx, 'storageBytes', 1),
    ).resolves.toBeUndefined()
  })

  it('locks a module the plan does not include', async () => {
    const { ctx } = context({})

    await expect(assertWithinLimit(ctx, 'reservations')).rejects.toBeInstanceOf(
      FeatureLockedError,
    )
    await expect(assertWithinLimit(ctx, 'reservations')).rejects.toMatchObject({
      lock: { key: 'reservations', planId: 'free' },
    })
  })

  it('unlocks a module the plan does include', async () => {
    const { ctx } = context({ record: subscriptionRecord() })

    await expect(assertWithinLimit(ctx, 'realtime')).resolves.toBeUndefined()
    await expect(hasFeature(ctx, 'realtime')).resolves.toBe(true)
  })

  it('re-locks every paid module once the subscription stops entitling', async () => {
    const { ctx } = context({
      record: subscriptionRecord({ status: 'unpaid' }),
    })

    await expect(hasFeature(ctx, 'realtime')).resolves.toBe(false)
    await expect(assertWithinLimit(ctx, 'trips', 3)).rejects.toBeInstanceOf(
      QuotaExceededError,
    )
  })

  it('keeps a dunning customer entitled so a failed card is not a lock-out', async () => {
    const { ctx } = context({
      record: subscriptionRecord({ status: 'past_due' }),
    })

    await expect(hasFeature(ctx, 'realtime')).resolves.toBe(true)
    await expect(currentLimits(ctx)).resolves.toMatchObject({ trips: null })
  })
})

/* ------------------------------------------------------------- entitlements */

describe('entitlements', () => {
  it('describes a Free workspace sitting exactly on its trip limit', async () => {
    const { ctx } = context({
      usage: usage({ seats: 1, trips: 2, storageBytes: 50 * MEGABYTE }),
    })
    const state = await entitlements(ctx)

    expect(state.planId).toBe('free')
    expect(state.planName).toBe('Free')
    expect(state.status).toBe('none')
    expect(state.quotas.trips).toMatchObject({
      limit: 2,
      used: 2,
      remaining: 0,
      exceeded: false,
    })
    expect(state.quotas.storageBytes.ratio).toBeCloseTo(0.5, 5)
    expect(state.hasProviderCustomer).toBe(false)
  })

  it('flags the over-limit workspace a downgrade leaves behind', async () => {
    const { ctx } = context({
      record: subscriptionRecord({ status: 'canceled', planId: 'crew' }),
      usage: usage({ seats: 4, trips: 9, storageBytes: 2 * GIGABYTE }),
    })
    const state = await entitlements(ctx)

    expect(state.planId).toBe('free')
    expect(state.quotas.trips.exceeded).toBe(true)
    expect(state.quotas.seats.exceeded).toBe(true)
    expect(state.quotas.storageBytes.exceeded).toBe(true)
  })

  it('never meters the unlimited quotas of a paid plan', async () => {
    const { ctx } = context({
      record: subscriptionRecord({ planId: 'solo', seats: 1 }),
      usage: usage({ seats: 1, trips: 412, storageBytes: GIGABYTE }),
    })
    const state = await entitlements(ctx)

    expect(state.limits.trips).toBeNull()
    expect(state.quotas.trips).toMatchObject({
      limit: null,
      remaining: null,
      ratio: 0,
    })
    expect(state.quotas.storageBytes.limit).toBe(5 * GIGABYTE)
  })

  it('counts a trial down only while it is still running', async () => {
    const trialing = context({
      record: subscriptionRecord({
        status: 'trialing',
        trialEndsAt: new Date('2026-08-25T12:00:00.000Z'),
      }),
      now: new Date('2026-08-19T12:00:00.000Z'),
    })
    await expect(entitlements(trialing.ctx)).resolves.toMatchObject({
      trialing: true,
    })

    const expired = context({
      record: subscriptionRecord({
        status: 'trialing',
        trialEndsAt: new Date('2026-08-01T12:00:00.000Z'),
      }),
      now: new Date('2026-08-19T12:00:00.000Z'),
    })
    await expect(entitlements(expired.ctx)).resolves.toMatchObject({
      trialing: false,
    })
  })

  it('serialises every date as an ISO string so it can cross the wire', async () => {
    const { ctx } = context({ record: subscriptionRecord() })
    const state = await entitlements(ctx)

    expect(state.currentPeriodEnd).toBe('2026-09-01T00:00:00.000Z')
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })
})

/* --------------------------------------------------------- scheduled changes */

describe('a change Polar has scheduled but not applied', () => {
  const SCHEDULED = {
    planId: 'solo',
    interval: 'yearly',
    effectiveAt: new Date('2026-09-01T00:00:00.000Z'),
  } as const

  it('names what the workspace becomes, never what it is on now', async () => {
    const { ctx } = context({
      record: subscriptionRecord({ pendingChange: SCHEDULED }),
      now: new Date('2026-08-19T12:00:00.000Z'),
    })
    const state = await entitlements(ctx)

    // Crew until the period ends, Solo after it. A screen that read `planId` off
    // the schedule would tell a paying customer they had already lost Crew.
    expect(state.planId).toBe('crew')
    expect(state.pendingChange).toEqual(SCHEDULED)
    expect(state.pendingChange?.effectiveAt).toBeInstanceOf(Date)
  })

  it('reports nothing scheduled for a workspace whose plan is simply in force', async () => {
    const { ctx } = context({ record: subscriptionRecord() })

    await expect(entitlements(ctx)).resolves.toMatchObject({
      pendingChange: null,
    })
  })

  it('forgets the schedule the moment its date arrives', async () => {
    const { ctx } = context({
      record: subscriptionRecord({ pendingChange: SCHEDULED }),
      now: SCHEDULED.effectiveAt,
    })

    // Past this instant Polar has applied the change, so the plan fields above are
    // the change and a banner still promising it is a lie the customer can check.
    await expect(entitlements(ctx)).resolves.toMatchObject({
      pendingChange: null,
    })
  })

  it('drops the schedule with the plan when the status stops entitling', async () => {
    const { ctx } = context({
      record: subscriptionRecord({ status: 'unpaid', pendingChange: SCHEDULED }),
      now: new Date('2026-08-19T12:00:00.000Z'),
    })
    const state = await entitlements(ctx)

    expect(state.planId).toBe('free')
    expect(state.pendingChange).toBeNull()
  })

  it('survives the KV round trip as an ISO instant', async () => {
    const { harness, ctx } = context({
      record: subscriptionRecord({ pendingChange: SCHEDULED }),
      now: new Date('2026-08-19T12:00:00.000Z'),
    })

    await loadPlanState(ctx)
    const cached = harness.cache.entries.get(planStateCacheKey(TEST_ORG_ID))
    expect(cached).toContain('"effectiveAt":"2026-09-01T00:00:00.000Z"')

    // Second read comes from KV, not D1 — the shape has to parse or the cache
    // silently turns itself off.
    harness.store.rows.delete(TEST_ORG_ID)
    await expect(entitlements(ctx)).resolves.toMatchObject({
      planId: 'crew',
      pendingChange: SCHEDULED,
    })
  })
})

/* --------------------------------------------------------------------- cache */

describe('plan-state caching', () => {
  it('reads D1 once, then serves the plan from KV', async () => {
    const { harness, ctx } = context({ record: subscriptionRecord() })
    let reads = 0
    const inner = harness.store.findByOrganization.bind(harness.store)
    harness.store.findByOrganization = async (organizationId: string) => {
      reads += 1
      return await inner(organizationId)
    }

    await loadPlanState(ctx)
    await loadPlanState(ctx)
    await loadPlanState(ctx)

    expect(reads).toBe(1)
    expect(harness.cache.entries.has(planStateCacheKey(TEST_ORG_ID))).toBe(true)
  })

  it('counts usage live on every check, so a cache window cannot be burst through', async () => {
    const { harness, ctx } = context({ usage: usage({ trips: 1 }) })

    await entitlements(ctx)
    await entitlements(ctx)

    expect(harness.usage.reads).toBe(2)
  })

  it('goes back to D1 after an invalidation', async () => {
    const { harness, ctx } = context({ record: subscriptionRecord() })
    await loadPlanState(ctx)

    await invalidateEntitlements(harness.runtime, TEST_ORG_ID)

    expect(harness.cache.entries.has(planStateCacheKey(TEST_ORG_ID))).toBe(
      false,
    )
    harness.store.seed(subscriptionRecord({ planId: 'solo', seats: 1 }))
    await expect(loadPlanState(ctx)).resolves.toMatchObject({ planId: 'solo' })
  })

  it('treats an unreadable cache entry as a miss rather than an error', async () => {
    const { harness, ctx } = context({ record: subscriptionRecord() })
    harness.cache.entries.set(planStateCacheKey(TEST_ORG_ID), 'not json at all')

    await expect(loadPlanState(ctx)).resolves.toMatchObject({ planId: 'crew' })
    expect(
      harness.logs.some(
        (log) => log.message === 'billing.plan_state.cache_discarded',
      ),
    ).toBe(true)
  })

  it('discards a cache entry written by an older shape', async () => {
    const { harness, ctx } = context({ record: subscriptionRecord() })
    harness.cache.entries.set(
      planStateCacheKey(TEST_ORG_ID),
      JSON.stringify({ planId: 'crew', seats: 0 }),
    )

    await expect(loadPlanState(ctx)).resolves.toMatchObject({
      planId: 'crew',
      seats: 4,
    })
  })
})
