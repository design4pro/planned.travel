/**
 * The admin overview's places figures are the places meter's, not a second composition of the same
 * concept: one owner (`placesMeter`) for "places used against the ceiling the guard enforces".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createCollection,
  createPlace,
  createTrip,
  placesMeter,
  upsertSubscription,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'
import type * as ReactStart from '@tanstack/react-start'
import type * as Repos from '#/server/repos'

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  meter: null as { used: number; limit: number | null } | null,
}))

// `cloudflare:workers` does not resolve in the Node test project, so the context module is replaced
// by the scope the case seeded.
vi.mock('#/routes/_app/-server/context', () => ({
  appScope: async (): Promise<TenantScope> => {
    if (stubs.scope === null) throw new Error('This case has no acting scope.')
    return stubs.scope
  },
}))

// Outside a Start build the wrapper discards return values; keep the registered handler callable.
vi.mock('@tanstack/react-start', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactStart>()),
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (handler: unknown) => handler,
    }
    return builder
  },
}))

// The real meter unless a case plants a sentinel, to prove the overview delegates to it.
vi.mock('#/server/repos', async (importOriginal) => {
  const actual = await importOriginal<typeof Repos>()
  return {
    ...actual,
    placesMeter: (scope: TenantScope) =>
      stubs.meter ?? actual.placesMeter(scope),
  }
})

const { loadAdmin } = await import('../overview')

const read = async () => {
  const payload = await (loadAdmin as unknown as () => Promise<
    Awaited<ReturnType<typeof loadAdmin>>
  >)()
  if (payload === null) throw new Error('The owner must be served the console.')
  return payload.limits
}

describe('the admin overview places usage', () => {
  let harness: Harness
  let tenant: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('admin-overview')
    stubs.scope = tenant.scope
    stubs.meter = null
  })

  afterEach(() => harness.close())

  it('takes both figures from the places meter', async () => {
    stubs.meter = { used: 41, limit: 42 }
    const places = (await read()).find((row) => row.metric === 'places')
    expect(places).toEqual({ metric: 'places', used: 41, limit: 42 })
  })

  it('sends an unlimited ceiling as null', async () => {
    stubs.meter = { used: 3, limit: null }
    const places = (await read()).find((row) => row.metric === 'places')
    expect(places).toEqual({ metric: 'places', used: 3, limit: null })
  })

  it.each([
    ['a finite plan ceiling', { plan: 'starter', status: 'active' }],
    [
      'a places override',
      {
        plan: 'business',
        status: 'active',
        quotaOverrides: { places: 7 },
      },
    ],
    ['no subscription', null],
  ] as const)('equals the meter for %s', async (_name, subscription) => {
    if (subscription !== null) {
      await upsertSubscription(tenant.scope, subscription)
    }
    const trip = await createTrip(tenant.scope, { title: 'Trip' })
    await createPlace(tenant.scope, { tripId: trip.id, name: 'One' })
    await createPlace(tenant.scope, { tripId: trip.id, name: 'Two' })
    const places = (await read()).find((row) => row.metric === 'places')
    const { used, limit } = await placesMeter(tenant.scope)
    expect(used).toBe(2)
    expect(places).toEqual({ metric: 'places', used, limit })
    expect(places?.limit === null || Number.isFinite(places?.limit)).toBe(true)
  })

  it('leaves the other usage entries as they were', async () => {
    const trip = await createTrip(tenant.scope, { title: 'Trip' })
    await createPlace(tenant.scope, { tripId: trip.id, name: 'One' })
    await createCollection(tenant.scope, { name: 'Shortlist' })
    const limits = await read()
    expect(limits.map((row) => row.metric)).toEqual([
      'trips',
      'places',
      'members',
      'files',
      'storage_bytes',
      'collections',
      'journeys',
    ])
    const used = Object.fromEntries(limits.map((row) => [row.metric, row.used]))
    expect(used).toMatchObject({
      trips: 1,
      members: 1,
      files: 0,
      collections: 1,
      journeys: 0,
    })
  })
})
