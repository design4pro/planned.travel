import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { categories } from '#/server/db/schema'
import { createHarness, subscribeTenant } from './harness'
import {
  categoriesRepository,
  createCategory,
  deleteCategory,
  ensureDefaultCategories,
  getCategory,
  listCategories,
  listCategoriesWithUsage,
  moveCategory,
  updateCategory,
} from '../categories'
import { createTrip } from '../trips'
import { createPlace, getPlace } from '../places'
import {
  addCollectionPlace,
  createCollection,
  listCollectionPlaces,
} from '../collections'
import type { Harness, SeededTenant } from './harness'

let harness: Harness
let tenant: SeededTenant
beforeEach(async () => {
  harness = await createHarness({ ddl: 'migrations' })
  tenant = await harness.seedTenant('categories')
  await subscribeTenant(tenant.scope, 'free')
  for (const row of await ensureDefaultCategories(tenant.scope))
    await deleteCategory(tenant.scope, row.id)
})
afterEach(() => harness.close())

async function tiedRows() {
  return harness.db
    .insert(categories)
    .values(
      ['c', 'a', 'b'].map((id) => ({
        id,
        name: 'Same',
        slug: id,
        organizationId: tenant.organizationId,
        sortOrder: 12,
      })),
    )
    .returning()
}

it('orders ties by binary id, atomically moves to dense ranks and isolates tenants', async () => {
  await tiedRows()
  const foreign = await harness.seedTenant('foreign')
  const other = await createCategory(foreign.scope, { name: 'Other' })
  expect((await listCategories(tenant.scope)).map((row) => row.id)).toEqual([
    'a',
    'b',
    'c',
  ])
  await moveCategory(tenant.scope, 'b', 'up')
  const rows = await listCategories(tenant.scope)
  expect(rows.map((row) => row.id)).toEqual(['b', 'a', 'c'])
  expect(rows.map((row) => row.sortOrder)).toEqual([1, 2, 3])
  await moveCategory(tenant.scope, 'b', 'down')
  expect((await listCategories(tenant.scope)).map((row) => row.id)).toEqual([
    'a',
    'b',
    'c',
  ])
  await expect(
    moveCategory(tenant.scope, other.id, 'up'),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  expect(await getCategory(foreign.scope, other.id)).toEqual(other)
  await expect(moveCategory(tenant.scope, 'a', 'up')).rejects.toMatchObject({
    code: 'CONFLICT',
  })
})

it('refuses the stale half of a race without changing the winning order', async () => {
  await tiedRows()
  const results = await Promise.allSettled([
    moveCategory(tenant.scope, 'b', 'up'),
    moveCategory(tenant.scope, 'b', 'up'),
  ])
  expect(
    results.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1)
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(
    1,
  )
  expect((await listCategories(tenant.scope)).map((row) => row.id)).toEqual([
    'b',
    'a',
    'c',
  ])
})

it('refuses a changed neighbor snapshot and rolls back a database failure', async () => {
  await tiedRows()
  const original = categoriesRepository.findMany.bind(categoriesRepository)
  vi.spyOn(categoriesRepository, 'findMany').mockImplementationOnce(
    async (...args) => {
      const observed = await original(...args)
      await updateCategory(tenant.scope, 'a', { sortOrder: 99 })
      return observed
    },
  )
  await expect(moveCategory(tenant.scope, 'b', 'up')).rejects.toMatchObject({
    code: 'CONFLICT',
  })
  expect((await listCategories(tenant.scope)).map((row) => row.id)).toEqual([
    'b',
    'c',
    'a',
  ])
  harness.sqlite.exec(
    "CREATE TRIGGER interrupt_move BEFORE UPDATE ON categories WHEN NEW.id = 'c' BEGIN SELECT RAISE(ABORT, 'move failure'); END",
  )
  const before = await listCategories(tenant.scope)
  await expect(moveCategory(tenant.scope, 'c', 'up')).rejects.toThrow()
  expect(await listCategories(tenant.scope)).toEqual(before)
})

it('keeps move bindings bounded even for a list larger than the D1 parameter limit', async () => {
  for (let index = 0; index < 130; index++)
    await harness.db
      .insert(categories)
      .values({
        organizationId: tenant.organizationId,
        name: 'Same',
        slug: `row-${index}`,
        sortOrder: 0,
      })
  const before = await listCategories(tenant.scope)
  harness.statements.length = 0
  await moveCategory(tenant.scope, before[100].id, 'up')
  const updates = harness.statements.filter((query) =>
    /update "categories"/i.test(query),
  )
  expect(updates).toHaveLength(1)
  expect(updates[0].match(/\?/g)?.length).toBeLessThan(20)
  expect((await listCategories(tenant.scope))[99].id).toBe(before[100].id)
})

it('preserves slug identity, scopes counts and deletes current trip and saved references without deleting places', async () => {
  const category = await createCategory(tenant.scope, { name: 'Culture' })
  const foreign = await harness.seedTenant('foreign')
  const other = await createCategory(foreign.scope, { name: 'Culture' })
  expect(other.slug).toBe(category.slug)
  await expect(
    updateCategory(tenant.scope, other.id, { name: 'Forged' }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(deleteCategory(tenant.scope, other.id)).rejects.toMatchObject({
    code: 'NOT_FOUND',
  })
  const renamed = await updateCategory(tenant.scope, category.id, {
    name: 'History',
    colour: '#123456',
  })
  expect(renamed.slug).toBe(category.slug)
  const trip = await createTrip(tenant.scope, { title: 'Trip' })
  const place = await createPlace(tenant.scope, {
    tripId: trip.id,
    name: 'Museum',
    categoryId: category.id,
  })
  const collection = await createCollection(tenant.scope, { name: 'Saved' })
  const saved = await addCollectionPlace(tenant.scope, {
    collectionId: collection.id,
    name: 'Saved museum',
    categoryId: category.id,
  })
  expect((await listCategoriesWithUsage(tenant.scope))[0].placeCount).toBe(1)
  const late = await createPlace(tenant.scope, {
    tripId: trip.id,
    name: 'Late reference',
    categoryId: category.id,
  })
  expect(await deleteCategory(tenant.scope, category.id)).toBeUndefined()
  for (const row of [place, late])
    expect(await getPlace(tenant.scope, row.id)).toMatchObject({
      id: row.id,
      categoryId: null,
    })
  expect(
    await listCollectionPlaces(tenant.scope, { collectionId: collection.id }),
  ).toEqual([expect.objectContaining({ id: saved.id, categoryId: null })])
  expect(await getCategory(foreign.scope, other.id)).toEqual(other)
  await expect(deleteCategory(tenant.scope, category.id)).rejects.toMatchObject(
    { code: 'NOT_FOUND' },
  )
})

it('bounds repeated unique conflicts and never reports a failed insert as success', async () => {
  harness.sqlite.exec(
    "CREATE TRIGGER conflict_category BEFORE INSERT ON categories BEGIN SELECT RAISE(ABORT, 'UNIQUE constraint failed: categories.organization_id, categories.slug'); END",
  )
  harness.statements.length = 0
  await expect(
    createCategory(tenant.scope, { name: 'Collision' }),
  ).rejects.toMatchObject({ code: 'CONFLICT' })
  expect(
    harness.statements.filter((query) =>
      /insert into "categories"/i.test(query),
    ),
  ).toHaveLength(25)
  expect(await listCategories(tenant.scope)).toEqual([])
})
