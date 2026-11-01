import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import { markRegionVisited } from '#/server/repos/atlas'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'

const actor = vi.hoisted(() => ({ scope: null as TenantScope | null }))
vi.mock('../context', () => ({
  appScope: async () => {
    if (!actor.scope) throw new Error('unauthenticated')
    return actor.scope
  },
}))
vi.mock('#/server/auth/env', () => ({
  taskQueue: () => ({ sendBatch: async () => {} }),
}))
/** The Start compiler normally supplies this RPC adapter. Keep its validator and handler seam. */
vi.mock('@tanstack/react-start', () => ({
  createServerOnlyFn: <T,>(fn: T): T => fn,
  createServerFn: () => ({
    validator(schema: { parse: (input: unknown) => unknown }) {
      return {
        handler(handler: (input: { data: unknown }) => Promise<unknown>) {
          return async (input: { data: unknown }) =>
            handler({ data: schema.parse(input.data) })
        },
      }
    },
  }),
}))
const { loadCountryRegionsFn } = await import('../atlas')
let harness: Harness
let tenant: SeededTenant
beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('region-reads')
  actor.scope = tenant.scope
})
afterEach(() => harness.close())

describe('loadCountryRegionsFn traveller boundary', () => {
  it('returns only the acting traveller, country and total, excluding a colleague and another workspace', async () => {
    const colleague = tenant.scopeFor(await tenant.addUser('colleague'))
    const other = await harness.seedTenant('foreign-regions')
    const own = await markRegionVisited(tenant.scope, {
      countryCode: 'DE',
      regionCode: 'DE-BY',
      regionName: 'Bavaria',
    })
    await markRegionVisited(tenant.scope, {
      countryCode: 'FR',
      regionCode: 'FR-IDF',
      regionName: 'Paris',
    })
    await markRegionVisited(colleague, {
      countryCode: 'DE',
      regionCode: 'DE-BE',
      regionName: 'Berlin',
    })
    await markRegionVisited(other.scope, {
      countryCode: 'DE',
      regionCode: 'DE-HH',
      regionName: 'Hamburg',
    })
    expect(await loadCountryRegionsFn({ data: { countryCode: 'DE' } })).toEqual(
      {
        countryCode: 'DE',
        regions: [{ id: own.id, name: 'Bavaria' }],
        total: 2,
      },
    )
    actor.scope = other.scope
    expect(await loadCountryRegionsFn({ data: { countryCode: 'FR' } })).toEqual(
      { countryCode: 'FR', regions: [], total: 1 },
    )
  })
  it('rejects spoofed authority fields at the function interface', async () => {
    await expect(
      loadCountryRegionsFn({
        data: { countryCode: 'DE', userId: tenant.ownerUserId } as never,
      }),
    ).rejects.toThrow()
  })
})
