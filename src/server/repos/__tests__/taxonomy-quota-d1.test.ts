import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { getPlatformProxy } from 'wrangler'
import { expect, it } from 'vitest'
import { organization } from '#/server/db/auth-schema'
import { subscriptions, usageRecords, USAGE_METRICS, categoryInitializations, categories } from '#/server/db/schema'
import {
  shippedMigrations,
  statementsOf,
} from '#/server/db/__tests__/migration-files'
import { createScope } from '../base'
import { upsertSubscription } from '../billing'
import {
  createCategory,
  deleteCategory,
  ensureDefaultCategories,
  listCategories,
} from '../categories'
import { createTag, listTags, resolveTags } from '../tags'
import { QuotaExceededError } from '../context'

it('preserves old usage and executes the shared quota atomically on migrations-built D1', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'taxonomy-d1-'))
  const configPath = join(directory, 'wrangler.json')
  await writeFile(
    configPath,
    JSON.stringify({
      name: 'taxonomy-test',
      compatibility_date: '2026-08-15',
      d1_databases: [
        {
          binding: 'DB',
          database_name: 'test',
          database_id: '00000000-0000-0000-0000-000000000001',
        },
      ],
    }),
  )
  const platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath,
    persist: false,
    remoteBindings: false,
  })
  try {
    const binding = platform.env.DB
    const migrations = shippedMigrations()
    const expansionIndex = migrations.findIndex((entry) =>
      entry.sql.includes('__new_usage_records'),
    )
    expect(expansionIndex).toBeGreaterThan(0)
    for (const migration of migrations.slice(0, expansionIndex)) {
      await binding.batch(
        statementsOf(migration.sql).map((statement) =>
          binding.prepare(statement),
        ),
      )
    }
    const db = drizzle(binding)
    const now = new Date()
    for (const id of ['alpha', 'beta']) {
      await db
        .insert(organization)
        .values({ id, name: id, slug: id, createdAt: now, updatedAt: now })
    }
    const alpha = createScope(db, {
      organizationId: 'alpha',
      userId: 'fixture-user',
      role: 'owner',
      impersonatedBy: null,
    })
    const beta = createScope(db, {
      organizationId: 'beta',
      userId: 'fixture-user',
      role: 'owner',
      impersonatedBy: null,
    })
    const oldMetrics = USAGE_METRICS.filter((metric) => metric !== 'taxonomy')
    for (const metric of oldMetrics) {
      await db.insert(usageRecords).values({
        organizationId: 'alpha',
        metric,
        value: 17,
        period: '2026-10',
      })
    }
    const before = await db.select().from(usageRecords)
    const indexes = await binding
      .prepare('PRAGMA index_list(usage_records)')
      .all()
    const foreignKeys = await binding
      .prepare('PRAGMA foreign_key_list(usage_records)')
      .all()
    for (const migration of migrations.slice(expansionIndex)) {
      await binding.batch(
        statementsOf(migration.sql).map((statement) =>
          binding.prepare(statement),
        ),
      )
    }
    expect(await db.select().from(usageRecords)).toEqual(before)
    expect(
      (await binding.prepare('PRAGMA index_list(usage_records)').all()).results,
    ).toEqual(indexes.results)
    expect(
      (await binding.prepare('PRAGMA foreign_key_list(usage_records)').all())
        .results,
    ).toEqual(foreignKeys.results)
    for (const metric of oldMetrics) {
      await db
        .insert(usageRecords)
        .values({ organizationId: 'beta', metric, value: 1 })
    }
    await db
      .insert(usageRecords)
      .values({ organizationId: 'beta', metric: 'taxonomy', value: 0 })
    await expect(
      binding
        .prepare(
          "INSERT INTO usage_records (id,organization_id,metric,value,created_at,updated_at) VALUES ('invalid','alpha','invalid',0,1,1)",
        )
        .run(),
    ).rejects.toThrow()
    await expect(
      binding
        .prepare(
          "INSERT INTO usage_records (id,organization_id,metric,value,created_at,updated_at) VALUES ('foreign','missing','trips',0,1,1)",
        )
        .run(),
    ).rejects.toThrow()
    await expect(
      binding
        .prepare(
          "INSERT INTO usage_records (id,organization_id,metric,value,created_at,updated_at) VALUES ('duplicate','alpha','trips',0,1,1)",
        )
        .run(),
    ).resolves.toBeDefined()
    await expect(
      binding
        .prepare(
          "INSERT INTO usage_records (id,organization_id,metric,value,created_at,updated_at) VALUES ('duplicate2','alpha','trips',0,1,1)",
        )
        .run(),
    ).rejects.toThrow()

    const [custom] = await db.insert(categories).values({ organizationId: 'alpha', name: 'Custom', slug: 'custom' }).returning()
    await upsertSubscription(alpha, { plan: 'free', status: 'active', quotaOverrides: { taxonomy: 0 } })
    expect(await ensureDefaultCategories(alpha)).toEqual([custom])
    expect(await db.select().from(categoryInitializations).where(eq(categoryInitializations.organizationId, 'beta'))).toHaveLength(0)
    for (const scope of [alpha, beta]) {
      for (const row of await ensureDefaultCategories(scope)) await deleteCategory(scope, row.id)
    }
    await upsertSubscription(alpha, {
      plan: 'free',
      status: 'active',
      quotaOverrides: { taxonomy: 1 },
    })
    await createTag(beta, { name: 'Foreign' })
    const results = await Promise.allSettled([
      createCategory(alpha, { name: 'Culture' }),
      createTag(alpha, { name: 'Outdoors' }),
    ])
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    const refusal = results.find((result) => result.status === 'rejected')
    expect(refusal?.status === 'rejected' && refusal.reason).toBeInstanceOf(
      QuotaExceededError,
    )
    expect(
      (await listCategories(alpha)).length + (await listTags(alpha)).length,
    ).toBe(1)
    expect(await listTags(beta)).toHaveLength(1)

    await db
      .update(subscriptions)
      .set({ quotaOverrides: { taxonomy: 51 } })
      .where(eq(subscriptions.organizationId, 'alpha'))
    const names = Array.from({ length: 50 }, (_, index) => `Tag ${index}`)
    const tags = await Promise.all([
      resolveTags(alpha, names),
      resolveTags(alpha, names),
    ])
    expect(tags[0].map((tag) => tag.id)).toEqual(tags[1].map((tag) => tag.id))
    expect(tags[0]).toHaveLength(50)
    await expect(
      resolveTags(alpha, ['No room', 'Another']),
    ).rejects.toBeInstanceOf(QuotaExceededError)
    const alphaBeforeRetry = await listCategories(alpha)
    expect(await ensureDefaultCategories(alpha)).toEqual(alphaBeforeRetry)
    expect(await ensureDefaultCategories(beta)).toHaveLength(0)

    await binding
      .prepare(
        "CREATE TRIGGER interrupt_tags BEFORE INSERT ON tags WHEN NEW.slug = 'fail-second' BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
      )
      .run()
    await expect(resolveTags(beta, ['First', 'Fail second'])).rejects.toThrow()
    expect((await listTags(beta)).map((tag) => tag.slug)).toEqual(['foreign'])
    await binding.prepare('DROP TRIGGER interrupt_tags').run()
    expect(await resolveTags(beta, ['First', 'Fail second'])).toHaveLength(2)
    // A fresh tenant gets the complete bootstrap even at zero capacity; a silent partial
    // seed or marker must roll back on real D1, not just on the SQLite proxy.
    for (const [index, trigger] of [
      "BEFORE INSERT ON categories WHEN NEW.slug = 'museums' BEGIN SELECT RAISE(IGNORE); END",
      "BEFORE INSERT ON categories BEGIN SELECT RAISE(IGNORE); END",
      "BEFORE INSERT ON category_initializations BEGIN SELECT RAISE(IGNORE); END",
      "BEFORE INSERT ON category_initializations BEGIN SELECT RAISE(ABORT, 'marker failed'); END",
    ].entries()) {
      const id = `bootstrap-${index}`
      await db.insert(organization).values({ id, name: id, slug: id, createdAt: now, updatedAt: now })
      const scope = createScope(db, { ...alpha.ctx, organizationId: id })
      await upsertSubscription(scope, { plan: 'free', status: 'active', quotaOverrides: { taxonomy: 0 } })
      await binding.prepare(`CREATE TRIGGER interrupt_bootstrap ${trigger}`).run()
      await expect(ensureDefaultCategories(scope)).rejects.toThrow()
      expect(await listCategories(scope)).toHaveLength(0)
      expect(await db.select().from(categoryInitializations).where(eq(categoryInitializations.organizationId, id))).toHaveLength(0)
      await binding.prepare('DROP TRIGGER interrupt_bootstrap').run()
      const race = await Promise.allSettled([
        ensureDefaultCategories(scope), ensureDefaultCategories(scope),
        createCategory(scope, { name: 'No slot' }), createTag(scope, { name: 'No slot' }),
        resolveTags(scope, ['No slot']),
      ])
      expect(race.slice(0, 2).every(result => result.status === 'fulfilled')).toBe(true)
      expect(race.slice(2).every(result => result.status === 'rejected' && result.reason instanceof QuotaExceededError)).toBe(true)
      const rows = await listCategories(scope)
      expect(rows).toHaveLength(8)
      expect(await db.select().from(categoryInitializations).where(eq(categoryInitializations.organizationId, id))).toHaveLength(1)
      for (const row of rows) await deleteCategory(scope, row.id)
      expect(await ensureDefaultCategories(scope)).toHaveLength(0)
      await db.delete(organization).where(eq(organization.id, id))
      expect(await db.select().from(categoryInitializations).where(eq(categoryInitializations.organizationId, id))).toHaveLength(0)
    }
    expect(
      (await binding.prepare('PRAGMA foreign_key_check').all()).results,
    ).toEqual([])
  } finally {
    await platform.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 120_000)
