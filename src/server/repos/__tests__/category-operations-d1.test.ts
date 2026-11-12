import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/d1'
import { getPlatformProxy } from 'wrangler'
import { expect, it } from 'vitest'
import { member, organization, user } from '#/server/db/auth-schema'
import { categories } from '#/server/db/schema'
import {
  shippedMigrations,
  statementsOf,
} from '#/server/db/__tests__/migration-files'
import { createScope } from '../base'
import {
  createCategory,
  deleteCategory,
  ensureDefaultCategories,
  getCategory,
  listCategories,
  moveCategory,
} from '../categories'
import { upsertSubscription } from '../billing'
import { createTrip } from '../trips'
import { createPlace, getPlace } from '../places'
import {
  addCollectionPlace,
  createCollection,
  listCollectionPlaces,
} from '../collections'

it('moves atomically with ties and races and preserves current references on migrations-built local D1', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'category-operations-d1-'))
  const configPath = join(directory, 'wrangler.json')
  await writeFile(
    configPath,
    JSON.stringify({
      name: 'category-operations-test',
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
    for (const migration of shippedMigrations())
      await binding.batch(
        statementsOf(migration.sql).map((statement) =>
          binding.prepare(statement),
        ),
      )
    const db = drizzle(binding)
    const now = new Date()
    await db
      .insert(user)
      .values({
        id: 'owner',
        name: 'Owner',
        email: 'owner@example.test',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
      })
    for (const id of ['alpha', 'beta']) {
      await db
        .insert(organization)
        .values({ id, name: id, slug: id, createdAt: now, updatedAt: now })
      await db
        .insert(member)
        .values({
          id: `member-${id}`,
          userId: 'owner',
          organizationId: id,
          role: 'owner',
          createdAt: now,
        })
    }
    const alpha = createScope(db, {
      organizationId: 'alpha',
      userId: 'owner',
      role: 'owner',
      impersonatedBy: null,
    })
    const beta = createScope(db, { ...alpha.ctx, organizationId: 'beta' })
    for (const scope of [alpha, beta]) {
      await upsertSubscription(scope, { plan: 'free', status: 'active' })
      for (const row of await ensureDefaultCategories(scope))
        await deleteCategory(scope, row.id)
    }
    await db
      .insert(categories)
      .values(
        ['c', 'b', 'a'].map((id) => ({
          id,
          organizationId: 'alpha',
          name: 'Same',
          slug: id,
          sortOrder: 20,
        })),
      )
    const foreign = await createCategory(beta, { name: 'Same' })
    const results = await Promise.allSettled([
      moveCategory(alpha, 'b', 'up'),
      moveCategory(alpha, 'b', 'up'),
    ])
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1)
    let rows = await listCategories(alpha)
    expect(rows.map((row) => row.id)).toEqual(['b', 'a', 'c'])
    expect(rows.map((row) => row.sortOrder)).toEqual([1, 2, 3])
    await expect(moveCategory(alpha, foreign.id, 'up')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(await getCategory(beta, foreign.id)).toEqual(foreign)
    await binding
      .prepare(
        "CREATE TRIGGER interrupt_move BEFORE UPDATE ON categories WHEN NEW.id = 'c' BEGIN SELECT RAISE(ABORT, 'move failure'); END",
      )
      .run()
    await expect(moveCategory(alpha, 'c', 'up')).rejects.toThrow()
    expect(await listCategories(alpha)).toEqual(rows)
    await binding.prepare('DROP TRIGGER interrupt_move').run()
    for (let index = 0; index < 110; index++)
      await db
        .insert(categories)
        .values({
          organizationId: 'alpha',
          name: 'Bulk',
          slug: `bulk-${index}`,
          sortOrder: 50,
        })
    await moveCategory(alpha, 'c', 'up')
    rows = await listCategories(alpha)
    expect(rows[1].id).toBe('c')
    expect(rows.map((row) => row.sortOrder)).toEqual(
      Array.from({ length: 113 }, (_, index) => index + 1),
    )
    const trip = await createTrip(alpha, { title: 'Trip' })
    const place = await createPlace(alpha, {
      tripId: trip.id,
      name: 'Current reference',
      categoryId: 'c',
    })
    const collection = await createCollection(alpha, { name: 'Saved' })
    const saved = await addCollectionPlace(alpha, {
      collectionId: collection.id,
      name: 'Saved reference',
      categoryId: 'c',
    })
    expect(await deleteCategory(alpha, 'c')).toBeUndefined()
    expect(await getPlace(alpha, place.id)).toMatchObject({
      id: place.id,
      categoryId: null,
    })
    expect(
      await listCollectionPlaces(alpha, { collectionId: collection.id }),
    ).toEqual([expect.objectContaining({ id: saved.id, categoryId: null })])
    await expect(deleteCategory(alpha, 'c')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  } finally {
    await platform.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 120_000)
