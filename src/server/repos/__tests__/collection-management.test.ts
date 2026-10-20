import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createHarness } from './harness'
import { createTrip } from '../trips'
import { createPlace, getPlace } from '../places'
import {
  addCollectionPlace,
  collectionDeleteSummary,
  createCollection,
  createLabel,
  deleteCollection,
  deleteCollectionConfirmed,
  getCollection,
  listCollectionPlaces,
  listLabels,
  setCollectionPlaceStatus,
  saveTripPlaceToCollection,
  updateCollection,
} from '../collections'
import type { Harness, SeededTenant } from './harness'

let harness: Harness
let tenant: SeededTenant
beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('collections')
})
afterEach(() => harness.close())

describe('collection management', () => {
  it('allows the collection owner with a member role and preserves the slug', async () => {
    const collection = await createCollection(tenant.scope, { name: 'Someday' })
    const updated = await updateCollection(
      tenant.scopeFor(tenant.ownerUserId, 'member'),
      collection.id,
      { name: 'Later' },
    )
    expect(updated.name).toBe('Later')
    expect(updated.slug).toBe(collection.slug)
  })
  it('refuses a plain member on every management verb, before reading counts', async () => {
    const collection = await createCollection(tenant.scope, { name: 'Someday' })
    const member = tenant.scopeFor(await tenant.addUser('Member'), 'member')
    for (const call of [
      () => updateCollection(member, collection.id, { name: 'Forged' }),
      () => deleteCollection(member, collection.id),
      () => deleteCollectionConfirmed(member, collection.id, 'Someday'),
      () => collectionDeleteSummary(member, collection.id),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: 'FORBIDDEN' })
    }
    expect((await getCollection(tenant.scope, collection.id))?.name).toBe(
      'Someday',
    )
  })
  it('lets an admin manage a departed owner’s collection and counts saved places and labels', async () => {
    const collection = await createCollection(tenant.scope, { name: 'Someday' })
    await addCollectionPlace(tenant.scope, {
      collectionId: collection.id,
      name: 'Cafe',
    })
    await createLabel(tenant.scope, {
      collectionId: collection.id,
      name: 'Food',
    })
    const admin = tenant.scopeFor(
      await tenant.addUser('Admin', 'admin'),
      'admin',
    )
    harness.sqlite
      .prepare('DELETE FROM member WHERE organization_id = ? AND user_id = ?')
      .run(tenant.organizationId, tenant.ownerUserId)
    expect(await collectionDeleteSummary(admin, collection.id)).toEqual({
      name: 'Someday',
      places: 1,
      labels: 1,
      requiresName: true,
    })
    await updateCollection(admin, collection.id, { name: 'Later' })
    await deleteCollection(admin, collection.id)
    expect(await getCollection(tenant.scope, collection.id)).toBeNull()
  })
  it('resolves foreign ids as not-found for every verb and leaves foreign rows unchanged', async () => {
    const other = await harness.seedTenant('other')
    const collection = await createCollection(other.scope, {
      name: 'Private tenant data',
    })
    const place = await addCollectionPlace(other.scope, {
      collectionId: collection.id,
      name: 'Cafe',
    })
    const before = await listCollectionPlaces(other.scope, {
      collectionId: collection.id,
    })
    const caller = tenant.scopeFor(tenant.ownerUserId, 'member')
    for (const call of [
      () => updateCollection(caller, collection.id, { name: 'Forged' }),
      () => deleteCollection(caller, collection.id),
      () => deleteCollectionConfirmed(caller, collection.id, 'Private tenant data'),
      () => collectionDeleteSummary(caller, collection.id),
      () => setCollectionPlaceStatus(caller, place.id, 'visited'),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
    expect(await getCollection(other.scope, collection.id)).toEqual(collection)
    expect(
      await listCollectionPlaces(other.scope, { collectionId: collection.id }),
    ).toEqual(before)
  })
  it('deletes saved copies and labels while preserving the trip place', async () => {
    const trip = await createTrip(tenant.scope, { title: 'Weekend' })
    const place = await createPlace(tenant.scope, {
      tripId: trip.id,
      name: 'Cafe',
    })
    const collection = await createCollection(tenant.scope, { name: 'Someday' })
    await saveTripPlaceToCollection(tenant.scope, {
      collectionId: collection.id,
      placeId: place.id,
    })
    await createLabel(tenant.scope, {
      collectionId: collection.id,
      name: 'Food',
    })
    await deleteCollection(tenant.scope, collection.id)
    expect(
      await listCollectionPlaces(tenant.scope, { collectionId: collection.id }),
    ).toEqual([])
    expect(await listLabels(tenant.scope, collection.id)).toEqual([])
    expect(await getPlace(tenant.scope, place.id)).toEqual(place)
  })
})
