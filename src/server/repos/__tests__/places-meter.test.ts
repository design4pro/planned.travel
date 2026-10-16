import { TEST_PRODUCT_IDS } from '#/server/billing/__tests__/prices.fixture'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { UNLIMITED } from '#/server/db/types'
import { assertQuota, resolveQuotas } from '../base'
import { upsertSubscription } from '../billing'
import { QuotaExceededError } from '../context'
import { createPlace, placesMeter } from '../places'
import { createTrip } from '../trips'
import { createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { UpsertSubscriptionInput } from '../billing'

const cases: Array<[string, UpsertSubscriptionInput | null]> = [
  ['Free without a subscription', null],
  [
    'Solo',
    {
      plan: 'business',
      status: 'active',
      providerProductId: TEST_PRODUCT_IDS.soloMonthly,
    },
  ],
  [
    'Crew',
    {
      plan: 'business',
      status: 'active',
      providerProductId: TEST_PRODUCT_IDS.crewMonthly,
    },
  ],
  ['legacy starter', { plan: 'starter', status: 'active' }],
  [
    'override',
    { plan: 'business', status: 'active', quotaOverrides: { places: 2 } },
  ],
  [
    'lapsed',
    { plan: 'business', status: 'canceled', quotaOverrides: { places: 2 } },
  ],
]

describe('places meter agrees with the write guard', () => {
  let harness: Harness
  let tenant: SeededTenant
  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('places-meter')
  })
  afterEach(() => harness.close())

  it.each(cases)('%s', async (_name, row) => {
    if (row !== null) await upsertSubscription(tenant.scope, row)
    const meter = await placesMeter(tenant.scope)
    const { limits } = await resolveQuotas(tenant.scope)
    expect(meter).toEqual({
      used: 0,
      limit: limits.places === UNLIMITED ? null : limits.places,
    })
    if (meter.limit === null) {
      await expect(
        assertQuota(tenant.scope, 'places', Number.MAX_SAFE_INTEGER),
      ).resolves.toBeUndefined()
    } else {
      await expect(
        assertQuota(tenant.scope, 'places', meter.limit - 1),
      ).resolves.toBeUndefined()
      await expect(
        assertQuota(tenant.scope, 'places', meter.limit),
      ).rejects.toBeInstanceOf(QuotaExceededError)
    }
  })

  it('counts every trip in this organisation, excludes other tenants, and refreshes overrides live', async () => {
    await upsertSubscription(tenant.scope, {
      plan: 'business',
      status: 'active',
      quotaOverrides: { places: 2 },
    })
    const first = await createTrip(tenant.scope, { title: 'First' })
    const second = await createTrip(tenant.scope, { title: 'Second' })
    const foreign = await harness.seedTenant('foreign')
    const foreignTrip = await createTrip(foreign.scope, { title: 'Foreign' })
    await createPlace(foreign.scope, {
      tripId: foreignTrip.id,
      name: 'Foreign place',
    })
    await createPlace(tenant.scope, { tripId: first.id, name: 'First place' })
    await createPlace(tenant.scope, { tripId: second.id, name: 'Second place' })
    expect(await placesMeter(tenant.scope)).toEqual({ used: 2, limit: 2 })
    await expect(
      createPlace(tenant.scope, { tripId: first.id, name: 'Refused' }),
    ).rejects.toMatchObject({ limit: 2 })
    expect(await placesMeter(foreign.scope)).toMatchObject({ used: 1 })
    await upsertSubscription(tenant.scope, { quotaOverrides: { places: 3 } })
    expect(await placesMeter(tenant.scope)).toEqual({ used: 2, limit: 3 })
    await createPlace(tenant.scope, { tripId: first.id, name: 'Third place' })
    expect(await placesMeter(tenant.scope)).toEqual({ used: 3, limit: 3 })
  })
})
