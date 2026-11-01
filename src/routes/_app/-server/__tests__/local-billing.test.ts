import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  createHarness as createBillingHarness,
  subscriptionRecord,
} from '#/server/billing/__tests__/harness'
import { createSubscriptionStore } from '#/server/billing/store'
import { createHarness } from '#/server/repos/__tests__/harness'
import { loadLocalBilling } from '../local-billing'
import type { BillingRuntime } from '#/server/billing/types'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'

const stubs = vi.hoisted(() => ({
  scope: null as TenantScope | null,
  runtime: null as BillingRuntime | null,
}))
vi.mock('../context', () => ({
  appScope: async () => {
    if (!stubs.scope) throw new Error('Unauthenticated')
    return stubs.scope
  },
}))
vi.mock('#/server/billing/runtime.cloudflare', () => ({
  billingRuntime: ({ scope }: { scope: TenantScope }) => {
    expect(scope).toBe(stubs.scope)
    return stubs.runtime
  },
}))
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    validator: (schema: { parse: (data: unknown) => unknown }) => ({
      handler:
        (handler: () => unknown) =>
        ({ data }: { data: unknown }) => {
          schema.parse(data)
          return handler()
        },
    }),
  }),
}))
let db: Harness
let tenant: SeededTenant
let calls: ReturnType<typeof createBillingHarness>['calls']
beforeEach(async () => {
  db = await createHarness()
  tenant = await db.seedTenant('billing-local')
  stubs.scope = tenant.scope
  const billing = createBillingHarness()
  calls = billing.calls
  stubs.runtime = {
    ...billing.runtime,
    subscriptions: createSubscriptionStore(db.db),
  }
})
afterEach(() => db.close())
it('reads only the authenticated workspace and makes zero provider calls even with forged checkout data', async () => {
  const foreign = await db.seedTenant('foreign-billing')
  const store = createSubscriptionStore(db.db)
  await store.upsert(
    subscriptionRecord({
      organizationId: tenant.organizationId,
      planId: 'solo',
      seats: 1,
    }),
  )
  await store.upsert(
    subscriptionRecord({
      organizationId: foreign.organizationId,
      providerSubscriptionId: 'foreign-subscription',
      providerCustomerId: 'foreign-customer',
      planId: 'crew',
      seats: 8,
    }),
  )
  const readUntrusted = loadLocalBilling as (options: {
    data: unknown
  }) => ReturnType<typeof loadLocalBilling>
  const result = await readUntrusted({
    data: {
      checkout_id: 'foreign-checkout',
      organizationId: foreign.organizationId,
    },
  })
  expect(result.entitlements.organizationId).toBe(tenant.organizationId)
  expect(result.entitlements.planId).toBe('solo')
  expect(result.entitlements.seats).toBe(1)
  expect(result.viewerId).toBe(tenant.scope.ctx.userId)
  for (let index = 0; index < 8; index += 1)
    await loadLocalBilling({ data: {} })
  expect(calls).toHaveLength(0)
})
it('rejects unauthenticated reads', async () => {
  stubs.scope = null
  await expect(loadLocalBilling({ data: {} })).rejects.toThrow(
    'Unauthenticated',
  )
  expect(calls).toHaveLength(0)
})
