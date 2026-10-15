import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NotFoundError } from '../context'
import {
  createPlace,
  deletePlace,
  getPlace,
  listPlaceTagIds,
  listTripPlaces,
  reorderPlaces,
  setPlaceTags,
  setPlaceVisited,
  updatePlace,
} from '../places'
import { createTag } from '../tags'
import { addTripMember, createTrip, TripRoleError } from '../trips'
import { createHarness } from './harness'
import type { TenantScope } from '../base'
import type { Harness, SeededTenant } from './harness'

const writers = [
  'create',
  'update',
  'visited',
  'delete',
  'reorder',
  'tags',
] as const

describe('place writer authorization', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let placeId: string
  let tagId: string
  let viewer: TenantScope
  let editor: TenantScope
  let stranger: TenantScope
  let foreign: TenantScope

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('place-roles')
    const trip = await createTrip(tenant.scope, {
      title: 'Lisbon',
      slug: 'lisbon',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
    })
    tripId = trip.id
    const viewerId = await tenant.addUser('Viewer')
    const editorId = await tenant.addUser('Editor')
    await addTripMember(tenant.scope, {
      tripId,
      userId: viewerId,
      role: 'viewer',
    })
    await addTripMember(tenant.scope, {
      tripId,
      userId: editorId,
      role: 'editor',
    })
    viewer = tenant.scopeFor(viewerId)
    editor = tenant.scopeFor(editorId)
    stranger = tenant.scopeFor(await tenant.addUser('Nonmember'))
    foreign = (await harness.seedTenant('foreign')).scope
    placeId = (await createPlace(tenant.scope, { tripId, name: 'Castle' })).id
    tagId = (
      await createTag(tenant.scope, { name: 'Must see', slug: 'must-see' })
    ).id
    await setPlaceTags(tenant.scope, placeId, [tagId])
  })

  afterEach(() => harness.close())

  function write(
    writer: (typeof writers)[number],
    scope: TenantScope,
  ): Promise<unknown> {
    switch (writer) {
      case 'create':
        return createPlace(scope, { tripId, name: 'Museum' })
      case 'update':
        return updatePlace(scope, placeId, { name: 'Changed' })
      case 'visited':
        return setPlaceVisited(scope, placeId, true)
      case 'delete':
        return deletePlace(scope, placeId)
      case 'reorder':
        return reorderPlaces(scope, [{ placeId, sortOrder: 8 }])
      case 'tags':
        return setPlaceTags(scope, placeId, [])
    }
  }

  async function snapshot() {
    return {
      places: await listTripPlaces(tenant.scope, { tripId }),
      tags: await listPlaceTagIds(tenant.scope, placeId),
    }
  }

  for (const writer of writers) {
    it(`${writer}: refuses a viewer before any mutation`, async () => {
      const before = await snapshot()
      harness.statements.length = 0
      await expect(write(writer, viewer)).rejects.toBeInstanceOf(TripRoleError)
      expect(
        harness.statements.some((sql) =>
          /^\s*(insert|update|delete)/i.test(sql),
        ),
      ).toBe(false)
      expect(await snapshot()).toEqual(before)
    })

    for (const role of ['owner', 'editor'] as const) {
      it(`${writer}: permits ${role}`, async () => {
        const before = await snapshot()
        await write(writer, role === 'owner' ? tenant.scope : editor)
        expect(await snapshot()).not.toEqual(before)
      })
    }

    it(`${writer}: hides a private trip from a nonmember`, async () => {
      const before = await snapshot()
      await expect(write(writer, stranger)).rejects.toBeInstanceOf(
        NotFoundError,
      )
      expect(await snapshot()).toEqual(before)
    })

    it(`${writer}: cannot change another tenant's rows`, async () => {
      const before = await snapshot()
      if (writer === 'reorder') {
        await expect(write(writer, foreign)).resolves.toEqual([])
      } else {
        await expect(write(writer, foreign)).rejects.toBeInstanceOf(
          NotFoundError,
        )
      }
      expect(await snapshot()).toEqual(before)
    })
  }

  it('checks all trips before applying a mixed reorder', async () => {
    const own = await createTrip(viewer, {
      title: 'Porto',
      slug: 'porto',
      startDate: '2026-05-01',
      endDate: '2026-05-02',
    })
    const ownPlace = await createPlace(viewer, {
      tripId: own.id,
      name: 'Bridge',
    })
    const before = await snapshot()
    await expect(
      reorderPlaces(viewer, [
        { placeId: ownPlace.id, sortOrder: 9 },
        { placeId, sortOrder: 10 },
      ]),
    ).rejects.toBeInstanceOf(TripRoleError)
    expect(await getPlace(viewer, ownPlace.id)).toEqual(ownPlace)
    expect(await snapshot()).toEqual(before)
  })
})
