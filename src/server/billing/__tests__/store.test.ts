/**
 * The scheduled plan change, over a **real** database.
 *
 * This file exists because a whole feature shipped green without one. `changePlan()`
 * wrote `{ ...mapped, pendingChange }`, five tests asserted the value came back, and
 * every one of them asked `FakeSubscriptionStore` — which used to keep the domain
 * record in a `Map` and hand the same object back. The `subscriptions` table had no
 * column for it, `rowValuesFromRecord()` could not emit one, `recordFromRow()` could
 * not restore one, and `Entitlements.pendingChange` was therefore `null` in production
 * for every customer, forever. A double wider than the thing it stands in for does not
 * fail; it agrees with you.
 *
 * So the assertions below go through `createSubscriptionStore()` against the SQLite
 * database `src/server/repos/__tests__/harness.ts` builds from the Drizzle schema:
 * real column types, real `CHECK` constraints, real `ON DELETE CASCADE`. If a column
 * is missing, or the repository's Zod input strips a field on the way past, the write
 * happens and the read comes back without it — which is precisely the failure that
 * went unseen, and precisely what a `toEqual` here catches.
 *
 * `__tests__/limits.test.ts` is the sibling argument for the ceiling columns, and it
 * is the shape this one copies.
 */

// Must come first: it configures the product ids `#/lib/plans` reads at import.
import './prices.fixture'

import { beforeEach, describe, expect, it } from 'vitest'

import { BILLING_INTERVALS, PLAN_IDS } from '#/lib/plans'
import {
  BILLING_INTERVALS as SCHEMA_BILLING_INTERVALS,
  PLAN_CATALOGUE_IDS,
} from '#/server/db/schema'
import { createHarness as createDbHarness } from '#/server/repos/__tests__/harness'
import { upsertSubscriptionUnscoped } from '#/server/repos/billing'
import { ceilingsForPlan } from '../limits'
import { createSubscriptionStore, pendingChangeColumns } from '../store'
import { TEST_CUSTOMER_ID, subscriptionRecord } from './harness'

import type { Harness as DbHarness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { PendingPlanChange, SubscriptionRecord, SubscriptionStore } from '../types'

const SCHEDULED_AT = new Date('2026-09-01T00:00:00.000Z')

describe('a scheduled plan change over the real store', () => {
  let db: DbHarness
  let tenant: SeededTenant
  let store: SubscriptionStore

  beforeEach(async () => {
    db = await createDbHarness()
    tenant = await db.seedTenant('pending change')
    store = createSubscriptionStore(db.db)
  })

  /** The record the tests write, always attributed to the seeded organization. */
  function record(overrides: Partial<SubscriptionRecord> = {}): SubscriptionRecord {
    return subscriptionRecord({ organizationId: tenant.organizationId, ...overrides })
  }

  const downgrade: PendingPlanChange = {
    planId: 'solo',
    interval: 'yearly',
    effectiveAt: SCHEDULED_AT,
  }

  it('survives the round trip through D1', async () => {
    await store.upsert(record({ pendingChange: downgrade }))

    const read = await store.findByOrganization(tenant.organizationId)

    expect(read?.pendingChange).toEqual(downgrade)
    // The instant is an epoch-millisecond integer column, so it must come back as a
    // real `Date` and not as the number the driver bound.
    expect(read?.pendingChange?.effectiveAt).toBeInstanceOf(Date)
    // And the rest of the row is untouched by carrying one.
    expect(read?.planId).toBe('crew')
    expect(read?.seats).toBe(4)
    expect(read?.ceilings).toEqual(ceilingsForPlan('crew', 4))
  })

  it('is reachable by every lookup the webhook uses, not just by organization', async () => {
    const written = record({ pendingChange: downgrade })
    await store.upsert(written)

    const byCustomer = await store.findByProviderCustomerId(
      written.providerCustomerId ?? '',
    )
    const bySubscription = await store.findByProviderSubscriptionId(
      written.providerSubscriptionId ?? '',
    )

    expect(byCustomer?.pendingChange).toEqual(downgrade)
    expect(bySubscription?.pendingChange).toEqual(downgrade)
  })

  it('is cleared by the next write that schedules nothing', async () => {
    await store.upsert(record({ pendingChange: downgrade }))

    // What the webhook does when Polar applies or supersedes the change: it writes the
    // whole row from a payload whose `pending_update` is gone. The three columns have
    // to be set to NULL rather than left out, or `definedOnly()` keeps the old promise.
    await store.upsert(record({ pendingChange: null }))

    await expect(store.findByOrganization(tenant.organizationId)).resolves.toMatchObject(
      { pendingChange: null },
    )
  })

  it('is cleared just the same by a record that never mentions one', async () => {
    await store.upsert(record({ pendingChange: downgrade }))

    const { pendingChange: _omitted, ...withoutTheField } = record()
    await store.upsert(withoutTheField)

    await expect(store.findByOrganization(tenant.organizationId)).resolves.toMatchObject(
      { pendingChange: null },
    )
  })

  it('replaces one schedule with the next rather than merging them', async () => {
    await store.upsert(record({ pendingChange: downgrade }))

    const superseding: PendingPlanChange = {
      planId: 'crew',
      interval: 'monthly',
      effectiveAt: new Date('2026-10-01T00:00:00.000Z'),
    }
    await store.upsert(record({ pendingChange: superseding }))

    await expect(store.findByOrganization(tenant.organizationId)).resolves.toMatchObject(
      { pendingChange: superseding },
    )
  })

  it('leaves a schedule alone when a narrow write touches something else', async () => {
    await store.upsert(record({ pendingChange: downgrade }))

    // `updateStatus()` and `attachCustomer()` patch single columns. Emitting the
    // pending triple as `undefined` there is what keeps them from clearing it.
    await store.updateStatus(tenant.organizationId, 'past_due', new Date())
    await store.attachCustomer(tenant.organizationId, TEST_CUSTOMER_ID)

    const read = await store.findByOrganization(tenant.organizationId)
    expect(read?.status).toBe('past_due')
    expect(read?.pendingChange).toEqual(downgrade)
  })

  it('reads a half-written triple as no schedule at all', async () => {
    // Three nullable columns with no CHECK behind them can be left inconsistent by an
    // operator or by a partially applied migration. A plan with no date is a change we
    // cannot describe, and it must never reach KV or an email as `Invalid Date`.
    await upsertSubscriptionUnscoped(db.db, tenant.organizationId, {
      status: 'active',
      pendingPlan: 'solo',
      pendingInterval: 'yearly',
      pendingEffectiveAt: null,
    })

    await expect(store.findByOrganization(tenant.organizationId)).resolves.toMatchObject(
      { pendingChange: null },
    )
  })
})

describe('pendingChangeColumns', () => {
  it('clears with explicit nulls, because `definedOnly()` keeps null and drops undefined', () => {
    expect(pendingChangeColumns(null)).toEqual({
      pendingPlan: null,
      pendingInterval: null,
      pendingEffectiveAt: null,
    })
  })

  it('names the catalogue plan, not the coarse tier the row is filed under', () => {
    expect(
      pendingChangeColumns({
        planId: 'crew',
        interval: 'monthly',
        effectiveAt: SCHEDULED_AT,
      }),
    ).toEqual({
      pendingPlan: 'crew',
      pendingInterval: 'monthly',
      pendingEffectiveAt: SCHEDULED_AT,
    })
  })
})

/**
 * `src/server/db/schema.ts` cannot import `#/lib/plans` — that module reads
 * `import.meta.env` at load time and `drizzle-kit generate` runs it under plain Node,
 * where the read throws — so the two value tuples the pending columns are validated
 * against are declared twice. This is the join that keeps them from drifting, and it
 * is the same argument `mapping.test.ts` makes for the eight subscription statuses.
 */
describe('the plan vocabularies the pending columns are validated against', () => {
  it('are the same tuples the catalogue sells, in the same order', () => {
    expect([...PLAN_CATALOGUE_IDS]).toEqual([...PLAN_IDS])
    expect([...SCHEMA_BILLING_INTERVALS]).toEqual([...BILLING_INTERVALS])
  })
})
