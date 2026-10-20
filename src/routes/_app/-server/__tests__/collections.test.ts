import { AsyncLocalStorage } from 'node:async_hooks'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import {
  addCollectionPlace,
  createCollection,
  collectionsRepository,
  updateCollection,
  getCollection,
} from '#/server/repos/collections'
import type { TenantScope } from '#/server/repos/base'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

const stubs = vi.hoisted(() => ({ scope: null as TenantScope | null }))
vi.mock('../context', () => ({
  appScope: async () => {
    if (!stubs.scope) throw new Error('Unauthenticated')
    return stubs.scope
  },
}))
Object.assign(globalThis, {
  [Symbol.for('tanstack-start:start-storage-context')]: new AsyncLocalStorage(),
})
const boundary = {
  ...(await import('../collections-wire')),
  ...(await import('../collections-handlers')),
}
let harness: Harness
let tenant: SeededTenant
beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('boundary')
  stubs.scope = tenant.scope
})
afterEach(() => {
  vi.restoreAllMocks()
  harness.close()
})
describe('collections boundary', () => {
  it.each([
    'slug',
    'icon',
    'coverImageUrl',
    'visibility',
    'sortOrder',
    'ownerUserId',
  ])('refuses an extra %s field', (field) => {
    expect(
      boundary.updateCollectionSchema.safeParse({
        collectionId: 'collection',
        name: 'Later',
        description: '',
        colour: '#123456',
        [field]: 'forged',
      }).success,
    ).toBe(false)
  })
  it('requires the current name before deleting saved places, then deletes', async () => {
    const collection = await createCollection(tenant.scope, { name: 'Someday' })
    await addCollectionPlace(tenant.scope, {
      collectionId: collection.id,
      name: 'Cafe',
    })
    await expect(
      boundary.deleteCollectionResult({ collectionId: collection.id }),
    ).rejects.toMatchObject({ name: 'ZodError' })
    expect(await getCollection(tenant.scope, collection.id)).not.toBeNull()
    await boundary.deleteCollectionResult({
      collectionId: collection.id,
      confirmName: 'Someday',
    })
    expect(await getCollection(tenant.scope, collection.id)).toBeNull()
  })
  it.each(['save', 'rename'] as const)(
    'refuses deletion when a concurrent %s invalidates confirmation after the summary',
    async (change) => {
      const collection = await createCollection(tenant.scope, {
        name: 'Someday',
      })
      if (change === 'rename') {
        await addCollectionPlace(tenant.scope, {
          collectionId: collection.id,
          name: 'Existing cafe',
        })
      }
      const requireById = collectionsRepository.requireById
      let reads = 0
      vi.spyOn(collectionsRepository, 'requireById').mockImplementation(
        async (scope, id) => {
          const row = await requireById(scope, id)
          reads += 1
          if (reads === 2) {
            if (change === 'save') {
              await addCollectionPlace(tenant.scope, {
                collectionId: collection.id,
                name: 'Concurrent cafe',
              })
            } else {
              await updateCollection(tenant.scope, collection.id, {
                name: 'Later',
              })
            }
          }
          return row
        },
      )
      await expect(
        boundary.deleteCollectionResult({
          collectionId: collection.id,
          ...(change === 'rename' ? { confirmName: 'Someday' } : {}),
        }),
      ).rejects.toMatchObject({ name: 'ZodError' })
      expect(await getCollection(tenant.scope, collection.id)).not.toBeNull()
      expect(
        await boundary.collectionDeleteSummaryResult({
          collectionId: collection.id,
        }),
      ).toMatchObject({ places: 1, requiresName: true })
    },
  )
  it('deletes an empty collection without a name and returns a closed update projection', async () => {
    const collection = await createCollection(tenant.scope, { name: 'Someday' })
    const result = await boundary.updateCollectionResult({
      collectionId: collection.id,
      name: 'Later',
      description: '',
      colour: '#123456',
    })
    expect(result).toEqual({
      id: collection.id,
      name: 'Later',
      description: null,
      colour: '#123456',
    })
    await boundary.deleteCollectionResult({ collectionId: collection.id })
    expect(await getCollection(tenant.scope, collection.id)).toBeNull()
  })
  it('enforces the same-workspace role boundary and permits member status changes', async () => {
    const collection = await createCollection(tenant.scope, { name: 'Someday' })
    const place = await addCollectionPlace(tenant.scope, {
      collectionId: collection.id,
      name: 'Cafe',
    })
    stubs.scope = tenant.scopeFor(await tenant.addUser('Member'))
    await expect(
      boundary.updateCollectionResult({
        collectionId: collection.id,
        name: 'Forged',
        description: '',
        colour: '#123456',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      boundary.collectionDeleteSummaryResult({ collectionId: collection.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(
      boundary.deleteCollectionResult({
        collectionId: collection.id,
        confirmName: 'Someday',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(
      await boundary.setPlaceStatusResult({
        collectionPlaceId: place.id,
        status: 'visited',
      }),
    ).toEqual({ id: place.id, status: 'visited' })
    stubs.scope = tenant.scopeFor(
      await tenant.addUser('Admin', 'admin'),
      'admin',
    )
    expect(
      await boundary.collectionDeleteSummaryResult({
        collectionId: collection.id,
      }),
    ).toEqual({ name: 'Someday', places: 1, labels: 0, requiresName: true })
    await boundary.updateCollectionResult({
      collectionId: collection.id,
      name: 'Later',
      description: '',
      colour: '#123456',
    })
    await expect(
      boundary.deleteCollectionResult({
        collectionId: collection.id,
        confirmName: 'Someday',
      }),
    ).rejects.toMatchObject({ name: 'ZodError' })
    await boundary.deleteCollectionResult({
      collectionId: collection.id,
      confirmName: 'Later',
    })
    expect(await getCollection(tenant.scope, collection.id)).toBeNull()
  })
  it('refuses all foreign directly addressed ids and all unexpected boundary fields', async () => {
    const other = await harness.seedTenant('other')
    const collection = await createCollection(other.scope, { name: 'Other' })
    const place = await addCollectionPlace(other.scope, {
      collectionId: collection.id,
      name: 'Cafe',
    })
    for (const call of [
      () =>
        boundary.updateCollectionResult({
          collectionId: collection.id,
          name: 'Forged',
          description: '',
          colour: '#123456',
        }),
      () =>
        boundary.collectionDeleteSummaryResult({ collectionId: collection.id }),
      () => boundary.deleteCollectionResult({ collectionId: collection.id }),
      () =>
        boundary.setPlaceStatusResult({
          collectionPlaceId: place.id,
          status: 'visited',
        }),
    ])
      await expect(call()).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(
      boundary.collectionIdSchema.safeParse({
        collectionId: collection.id,
        ownerUserId: 'forged',
      }).success,
    ).toBe(false)
    expect(
      boundary.deleteCollectionSchema.safeParse({
        collectionId: collection.id,
        requiresName: false,
      }).success,
    ).toBe(false)
    expect(
      boundary.setPlaceStatusSchema.safeParse({
        collectionPlaceId: place.id,
        status: 'visited',
        collectionId: collection.id,
      }).success,
    ).toBe(false)
  })
})
