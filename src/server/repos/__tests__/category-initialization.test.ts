import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { organization } from '#/server/db/auth-schema'
import {
  categories,
  categoryInitializations,
  subscriptions,
  tags,
} from '#/server/db/schema'
import { createHarness, subscribeTenant } from './harness'
import {
  createCategory,
  deleteCategory,
  ensureDefaultCategories,
  listCategories,
} from '../categories'
import { createTag, resolveTags } from '../tags'
import { createTenantRepository } from '../base'
import { QuotaExceededError } from '../context'
import * as batches from '../batch'
import type { Harness, SeededTenant } from './harness'

for (const ddl of ['schema', 'migrations'] as const) {
  describe(`category initialization (${ddl})`, () => {
    let harness: Harness
    let tenant: SeededTenant
    const markers = createTenantRepository(
      categoryInitializations,
      'initialization',
    )
    beforeEach(async () => {
      harness = await createHarness({ ddl })
      tenant = await harness.seedTenant('initialization')
      await subscribeTenant(tenant.scope, 'free')
    })
    afterEach(() => harness.close())

    it('never restores deliberately deleted starters, including an empty list and a lost response', async () => {
      const rows = await ensureDefaultCategories(tenant.scope)
      expect(rows).toHaveLength(8)
      await deleteCategory(tenant.scope, rows[0].id)
      expect(await ensureDefaultCategories(tenant.scope)).toHaveLength(7)
      for (const row of await listCategories(tenant.scope))
        await deleteCategory(tenant.scope, row.id)
      expect(await ensureDefaultCategories(tenant.scope)).toEqual([])
      expect(await markers.count(tenant.scope)).toBe(1)
    })

    it('retries a lost batch response without duplicating or restoring starters', async () => {
      const batch = batches.runAtomicBatch
      const response = vi
        .spyOn(batches, 'runAtomicBatch')
        .mockImplementationOnce(async (scope, statements) => {
          await batch(scope, statements)
          throw new Error('response lost after commit')
        })
      try {
        await expect(ensureDefaultCategories(tenant.scope)).rejects.toThrow(
          'response lost after commit',
        )
      } finally {
        response.mockRestore()
      }
      const committed = await listCategories(tenant.scope)
      expect(committed).toHaveLength(8)
      expect(await ensureDefaultCategories(tenant.scope)).toEqual(committed)
      await deleteCategory(tenant.scope, committed[0].id)
      expect(await ensureDefaultCategories(tenant.scope)).toHaveLength(7)
      expect(await markers.count(tenant.scope)).toBe(1)
    })

    it('marks an existing custom list unchanged, isolates tenants and cascades only its marker', async () => {
      const [custom] = await harness.db
        .insert(categories)
        .values({
          organizationId: tenant.organizationId,
          name: 'Custom',
          slug: 'custom',
        })
        .returning()
      const other = await harness.seedTenant('other')
      await harness.db
        .update(subscriptions)
        .set({ quotaOverrides: { taxonomy: 0 } })
        .where(eq(subscriptions.organizationId, tenant.organizationId))
      expect(await ensureDefaultCategories(tenant.scope)).toEqual([custom])
      expect(await markers.count(other.scope)).toBe(0)
      const defaults = await ensureDefaultCategories(other.scope)
      expect(defaults).toHaveLength(8)
      expect(
        defaults.every((row) => row.organizationId === other.organizationId),
      ).toBe(true)
      expect(await ensureDefaultCategories(tenant.scope)).toEqual([custom])
      await harness.db
        .delete(organization)
        .where(eq(organization.id, tenant.organizationId))
      expect(await markers.count(tenant.scope)).toBe(0)
      expect(await markers.count(other.scope)).toBe(1)
    })

    it('initializes the complete starter definitions with sufficient capacity and keeps read helpers pure', async () => {
      expect(await listCategories(tenant.scope)).toEqual([])
      expect(await markers.count(tenant.scope)).toBe(0)
      const rows = await ensureDefaultCategories(tenant.scope)
      expect(rows.map((row) => row.slug)).toEqual([
        'landmarks',
        'food-and-drink',
        'stays',
        'outdoors',
        'museums',
        'nightlife',
        'shopping',
        'transport',
      ])
      expect(rows.every((row) => row.isSystem)).toBe(true)
      expect(rows.map((row) => row.sortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    })

    it.each([0, 1, 2, 7, 8, 9, 256])(
      'bootstraps all eight with limit %i despite existing tags and serializes competing writers',
      async (limit) => {
        await harness.db.insert(tags).values({
          organizationId: tenant.organizationId,
          name: 'Existing',
          slug: 'existing',
        })
        await harness.db
          .update(subscriptions)
          .set({ quotaOverrides: { taxonomy: limit } })
          .where(eq(subscriptions.organizationId, tenant.organizationId))
        const results = await Promise.allSettled([
          ensureDefaultCategories(tenant.scope),
          ensureDefaultCategories(tenant.scope),
          createCategory(tenant.scope, { name: 'Extra' }),
          createTag(tenant.scope, { name: 'Extra' }),
          resolveTags(tenant.scope, ['Bulk']),
        ])
        expect(
          results.slice(0, 2).every((row) => row.status === 'fulfilled'),
        ).toBe(true)
        expect(
          (await listCategories(tenant.scope)).filter((row) => row.isSystem),
        ).toHaveLength(8)
        expect(await markers.count(tenant.scope)).toBe(1)
        if (limit <= 9) {
          expect(
            results
              .slice(2)
              .every(
                (row) =>
                  row.status === 'rejected' &&
                  row.reason instanceof QuotaExceededError,
              ),
          ).toBe(true)
        } else {
          expect(results.every((row) => row.status === 'fulfilled')).toBe(true)
        }
      },
    )

    it.each([
      ['categories', "NEW.slug = 'museums'", 'ABORT'],
      ['categories', "NEW.slug = 'museums'", 'IGNORE'],
      ['categories', '1', 'IGNORE'],
      ['category_initializations', '1', 'ABORT'],
      ['category_initializations', '1', 'IGNORE'],
    ])(
      'rolls back %s %s %s and retries cleanly',
      async (table, condition, action) => {
        const raise =
          action === 'IGNORE' ? 'IGNORE' : "ABORT, 'fixture failure'"
        harness.sqlite.exec(
          `CREATE TRIGGER interrupt_bootstrap BEFORE INSERT ON ${table} WHEN ${condition} BEGIN SELECT RAISE(${raise}); END`,
        )
        await expect(ensureDefaultCategories(tenant.scope)).rejects.toThrow()
        expect(await listCategories(tenant.scope)).toHaveLength(0)
        expect(await markers.count(tenant.scope)).toBe(0)
        harness.sqlite.exec('DROP TRIGGER interrupt_bootstrap')
        expect(await ensureDefaultCategories(tenant.scope)).toHaveLength(8)
        expect(await markers.count(tenant.scope)).toBe(1)
      },
    )
  })
}
