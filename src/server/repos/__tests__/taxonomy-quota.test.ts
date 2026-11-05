import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as quotaBase from '../base'
import { taxonomyUsage } from '../taxonomy-quota'
import { subscriptions } from '#/server/db/schema'
import { resolveLimitsFromRow } from '#/server/billing/limits'
import {
  createCategory,
  deleteCategory,
  ensureDefaultCategories,
  listCategories,
  updateCategory,
} from '../categories'
import { createTag, listTags, resolveTags } from '../tags'
import { QuotaExceededError } from '../context'
import { createHarness, subscribeTenant } from './harness'
import type { Harness, SeededTenant } from './harness'

for (const ddl of ['schema', 'migrations'] as const) {
  describe(`shared taxonomy quota (${ddl})`, () => {
    let harness: Harness
    let tenant: SeededTenant
    async function limit(value: number) {
      await harness.db
        .update(subscriptions)
        .set({ quotaOverrides: { taxonomy: value } })
        .where(eq(subscriptions.organizationId, tenant.organizationId))
    }
    beforeEach(async () => {
      harness = await createHarness({ ddl })
      tenant = await harness.seedTenant('taxonomy')
      await subscribeTenant(tenant.scope, 'free')
    })
    afterEach(() => harness.close())

    it('lets only one category or tag take the final slot', async () => {
      await limit(1)
      const results = await Promise.allSettled([
        createCategory(tenant.scope, { name: 'Culture' }),
        createTag(tenant.scope, { name: 'Outdoors' }),
      ])
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1)
      const refused = results.find((result) => result.status === 'rejected')
      expect(refused?.status === 'rejected' && refused.reason).toBeInstanceOf(
        QuotaExceededError,
      )
      expect(
        (await listTags(tenant.scope)).length +
          (await listCategories(tenant.scope)).length,
      ).toBe(1)
    })

    it('inserts all missing tags or none, deduplicates and reuses existing tags at the limit', async () => {
      await limit(2)
      const [first] = await resolveTags(tenant.scope, ['Cafe', 'CAFE'])
      await expect(
        resolveTags(tenant.scope, ['Cafe', 'Museum', 'Park']),
      ).rejects.toBeInstanceOf(QuotaExceededError)
      expect(await listTags(tenant.scope)).toHaveLength(1)
      const results = await Promise.all([
        resolveTags(tenant.scope, ['Museum', 'Cafe']),
        resolveTags(tenant.scope, ['Museum', 'CAFE']),
      ])
      expect(results[0].map((tag) => tag.id)).toEqual(
        results[1].map((tag) => tag.id),
      )
      expect(results[0][1]?.id).toBe(first?.id)
      expect(await listTags(tenant.scope)).toHaveLength(2)
      expect(await resolveTags(tenant.scope, [])).toEqual([])
    })

    it('does not count or reuse another tenant’s taxonomy', async () => {
      const other = await harness.seedTenant('other')
      await createCategory(other.scope, { name: 'Culture' })
      const foreign = await resolveTags(other.scope, ['Cafe'])
      await limit(2)
      const local = await resolveTags(tenant.scope, ['Cafe'])
      expect(local[0]?.id).not.toBe(foreign[0]?.id)
      await createCategory(tenant.scope, { name: 'Culture' })
      await expect(
        createTag(tenant.scope, { name: 'Full' }),
      ).rejects.toBeInstanceOf(QuotaExceededError)
      expect(await listCategories(other.scope)).toHaveLength(1)
    })

    it('preserves over-limit rows and permits edits, deletion and reuse', async () => {
      const category = await createCategory(tenant.scope, { name: 'Culture' })
      await resolveTags(tenant.scope, ['Cafe'])
      await limit(0)
      await expect(
        createCategory(tenant.scope, { name: 'Park' }),
      ).rejects.toBeInstanceOf(QuotaExceededError)
      await expect(
        createTag(tenant.scope, { name: 'Park' }),
      ).rejects.toBeInstanceOf(QuotaExceededError)
      expect(await resolveTags(tenant.scope, ['Cafe'])).toHaveLength(1)
      expect(
        (await updateCategory(tenant.scope, category.id, { name: 'History' }))
          .name,
      ).toBe('History')
      await deleteCategory(tenant.scope, category.id)
      expect(await listTags(tenant.scope)).toHaveLength(1)
    })

    it('handles fifty names within D1 binding limits and rolls back a failed statement', async () => {
      const names = Array.from({ length: 50 }, (_, index) => `Tag ${index}`)
      await limit(50)
      harness.sqlite.exec(
        "CREATE TRIGGER interrupt_tags BEFORE INSERT ON tags WHEN NEW.slug = 'tag-25' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
      )
      await expect(resolveTags(tenant.scope, names)).rejects.toThrow()
      expect(await listTags(tenant.scope)).toHaveLength(0)
      harness.sqlite.exec('DROP TRIGGER interrupt_tags')
      expect(await resolveTags(tenant.scope, names)).toHaveLength(50)
      await expect(
        resolveTags(tenant.scope, [...names, 'Too many']),
      ).rejects.toThrow()
    })

    it('allows only one competing bulk set and never spends a partial set', async () => {
      await limit(2)
      const results = await Promise.allSettled([
        resolveTags(tenant.scope, ['A', 'B']),
        resolveTags(tenant.scope, ['C', 'D']),
      ])
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1)
      const slugs = (await listTags(tenant.scope)).map((tag) => tag.slug).sort()
      expect([
        ['a', 'b'],
        ['c', 'd'],
      ]).toContainEqual(slugs)
    })

    it('rolls back the entire default refill on a database error and permits retry', async () => {
      harness.sqlite.exec(
        "CREATE TRIGGER interrupt_categories BEFORE INSERT ON categories WHEN NEW.slug = 'museums' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
      )
      await expect(ensureDefaultCategories(tenant.scope)).rejects.toThrow()
      expect(await listCategories(tenant.scope)).toHaveLength(0)
      harness.sqlite.exec('DROP TRIGGER interrupt_categories')
      const results = await Promise.all([
        ensureDefaultCategories(tenant.scope),
        ensureDefaultCategories(tenant.scope),
      ])
      expect(results[0].map((row) => row.id)).toEqual(
        results[1].map((row) => row.id),
      )
      expect(await listCategories(tenant.scope)).toHaveLength(8)
    })

    it('counts the default 256 slots from live rows and frees capacity on deletion', async () => {
      for (let batch = 0; batch < 5; batch += 1) {
        await resolveTags(
          tenant.scope,
          Array.from({ length: 50 }, (_, index) => `Tag ${batch * 50 + index}`),
        )
      }
      await resolveTags(tenant.scope, ['A', 'B', 'C', 'D', 'E'])
      const category = await createCategory(tenant.scope, { name: 'Last' })
      await expect(
        createTag(tenant.scope, { name: 'Full' }),
      ).rejects.toBeInstanceOf(QuotaExceededError)
      await deleteCategory(tenant.scope, category.id)
      await createTag(tenant.scope, { name: 'Replacement' })
      const [usage] = await harness.db
        .select({ used: taxonomyUsage(tenant.scope) })
        .from(subscriptions)
        .where(eq(subscriptions.organizationId, tenant.organizationId))
      expect(usage?.used).toBe(256)
    })

    it('handles the unlimited sentinel without sending Infinity as a SQL binding', async () => {
      const resolved = await quotaBase.resolveQuotas(tenant.scope)
      const resolver = vi.spyOn(quotaBase, 'resolveQuotas').mockResolvedValue({
        ...resolved,
        limits: { ...resolved.limits, taxonomy: Number.POSITIVE_INFINITY },
      })
      try {
        expect(await ensureDefaultCategories(tenant.scope)).toHaveLength(8)
        await createCategory(tenant.scope, { name: 'Extra' })
        await createTag(tenant.scope, { name: 'Extra' })
        expect(
          await resolveTags(tenant.scope, ['First', 'Second']),
        ).toHaveLength(2)
      } finally {
        resolver.mockRestore()
      }
    })

    it('retries concurrent slug conflicts without reporting a quota refusal', async () => {
      await limit(4)
      for (const writer of [createCategory, createTag]) {
        const rows = await Promise.all([
          writer(tenant.scope, { name: 'Same' }),
          writer(tenant.scope, { name: 'Same' }),
        ])
        expect(rows.map((row) => row.slug).sort()).toEqual(['same', 'same-2'])
      }
    })

    it('guards the existing default refill as one all-or-none write', async () => {
      await limit(7)
      await expect(
        ensureDefaultCategories(tenant.scope),
      ).rejects.toBeInstanceOf(QuotaExceededError)
      expect(await listCategories(tenant.scope)).toHaveLength(0)
      const other = await harness.seedTenant('other-defaults')
      expect(await ensureDefaultCategories(other.scope)).toHaveLength(8)
      await limit(8)
      expect(await ensureDefaultCategories(tenant.scope)).toHaveLength(8)
      expect(await ensureDefaultCategories(tenant.scope)).toHaveLength(8)
    })
  })
}

it('resolves the taxonomy operational default for all tiers and preserves status and override semantics', () => {
  expect(resolveLimitsFromRow(null).metrics.taxonomy).toBe(256)
  for (const plan of ['free', 'starter', 'pro', 'business']) {
    const row = {
      plan,
      status: 'active',
      seats: 1,
      providerProductId: null,
      seatLimit: 1,
      storageLimitBytes: 100,
      quotaOverrides: null,
    }
    expect(resolveLimitsFromRow(row).metrics.taxonomy).toBe(256)
    for (const value of [0, 3, Number.POSITIVE_INFINITY]) {
      expect(
        resolveLimitsFromRow({ ...row, quotaOverrides: { taxonomy: value } })
          .metrics.taxonomy,
      ).toBe(value)
      expect(
        resolveLimitsFromRow({
          ...row,
          status: 'canceled',
          quotaOverrides: { taxonomy: value },
        }).metrics.taxonomy,
      ).toBe(256)
    }
  }
})
