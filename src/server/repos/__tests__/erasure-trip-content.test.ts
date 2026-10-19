import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  assignmentParticipants,
  calendarFeeds,
  dayAssignments,
  dayNotes,
  days,
  packingItems,
  packingLists,
  packingTemplateItems,
  packingTemplates,
  places,
  shareLinks,
  tripFavourites,
  tripFiles,
  tripGuests,
  tripInviteLinks,
  tripMembers,
} from '#/server/db/schema'
import { createErasureScope } from '#/server/erasure/scope'
import { createTenantRepository, createTenantTableAccess } from '../base'
import { eraseUserTrips } from '../trips-erasure'
import { createTrip } from '../trips'
import { createHarness } from './harness'
import type { Harness } from './harness'

let harness: Harness
beforeEach(async () => {
  harness = await createHarness()
})
afterEach(() => harness.close())
it('applies every trip-content outcome, keeps unrelated content, returns rewrite keys on retry, and isolates the same person in another workspace', async () => {
  const a = await harness.seedTenant('a')
  const b = await harness.seedTenant('b')
  const target = a.ownerUserId
  await b.addMembership(target)
  const guestRepo = createTenantRepository(tripGuests, 'guest')
  const noteRepo = createTenantRepository(dayNotes, 'note')
  const listRepo = createTenantRepository(packingLists, 'list')
  const itemRepo = createTenantRepository(packingItems, 'item')
  const templateRepo = createTenantRepository(packingTemplates, 'template')
  const templateItems = createTenantRepository(
    packingTemplateItems,
    'template item',
  )
  const fileRepo = createTenantRepository(tripFiles, 'file')
  const shareRepo = createTenantRepository(shareLinks, 'share')
  const inviteRepo = createTenantRepository(tripInviteLinks, 'invite')
  const feeds = createTenantRepository(calendarFeeds, 'feed')
  const favourites = createTenantTableAccess(tripFavourites, 'favourite')
  const participants = createTenantTableAccess(
    assignmentParticipants,
    'participant',
  )
  const memberships = createTenantRepository(tripMembers, 'membership')
  const snapshots: Array<{
    privateListId: string
    privateTemplateId: string
    rewriteKeys: string[]
  }> = []
  for (const tenant of [a, b]) {
    const trip = await createTrip(tenant.scopeFor(target), {
      title: 'Trip',
      slug: 'trip',
    })
    await memberships.insert(tenant.scope, {
      tripId: trip.id,
      userId: 'remaining',
      role: 'owner',
      invitedBy: target,
    })
    await guestRepo.insert(tenant.scope, {
      tripId: trip.id,
      createdBy: target,
      displayName: 'Guest',
    })
    const day = await createTenantRepository(days, 'day').insert(tenant.scope, {
      tripId: trip.id,
      date: '2026-10-19',
      dayNumber: 1,
    })
    const place = await createTenantRepository(places, 'place').insert(
      tenant.scope,
      { tripId: trip.id, name: 'Place' },
    )
    const assignment = await createTenantRepository(
      dayAssignments,
      'assignment',
    ).insert(tenant.scope, {
      tripId: trip.id,
      dayId: day.id,
      placeId: place.id,
    })
    await participants.insert(tenant.scope, {
      assignmentId: assignment.id,
      userId: target,
    })
    await favourites.insert(tenant.scope, { tripId: trip.id, userId: target })
    await noteRepo.insert(tenant.scope, {
      tripId: trip.id,
      dayId: day.id,
      createdBy: target,
      body: 'Keep',
    })
    const privateList = await listRepo.insert(tenant.scope, {
      tripId: trip.id,
      ownerUserId: target,
      name: 'Private',
    })
    const sharedList = await listRepo.insert(tenant.scope, {
      tripId: trip.id,
      name: 'Shared',
    })
    await itemRepo.insert(tenant.scope, {
      tripId: trip.id,
      listId: privateList.id,
      name: 'Private item',
    })
    await itemRepo.insert(tenant.scope, {
      tripId: trip.id,
      listId: sharedList.id,
      name: 'Keep',
      assignedTo: target,
    })
    const privateTemplate = await templateRepo.insert(tenant.scope, {
      createdBy: target,
      name: 'Private',
      isShared: false,
    })
    await templateItems.insert(tenant.scope, {
      templateId: privateTemplate.id,
      name: 'Remove',
    })
    await templateRepo.insert(tenant.scope, {
      createdBy: target,
      name: 'Shared',
      isShared: true,
    })
    await shareRepo.insert(tenant.scope, {
      tripId: trip.id,
      createdBy: target,
      token: tenant.organizationId,
      scopes: {
        map: false,
        itinerary: true,
        reservations: false,
        lists: false,
        budget: false,
        collab: false,
        files: false,
      },
    })
    await inviteRepo.insert(tenant.scope, {
      tripId: trip.id,
      createdBy: target,
      token: tenant.organizationId,
    })
    await feeds.insert(tenant.scope, {
      userId: target,
      scope: 'workspace',
      tokenDigest: tenant.organizationId,
    })
    const rewriteKeys: string[] = []
    for (let i = 0; i < 105; i++) {
      const storageKey = `trips/${tenant.organizationId}/${trip.id}/${i}`
      rewriteKeys.push(storageKey)
      await fileRepo.insert(tenant.scope, {
        tripId: trip.id,
        uploadedBy: target,
        filename: 'file',
        storageKey,
        contentType: 'text/plain',
      })
    }
    await fileRepo.insert(tenant.scope, {
      tripId: trip.id,
      uploadedBy: 'remaining',
      filename: 'other',
      storageKey: `trips/${tenant.organizationId}/${trip.id}/other`,
      contentType: 'text/plain',
    })
    snapshots.push({
      privateListId: privateList.id,
      privateTemplateId: privateTemplate.id,
      rewriteKeys,
    })
  }
  const scope = createErasureScope(harness.db, a.organizationId)
  const prepare = async () => {
    throw new Error('shared trip must stay')
  }
  const keys = await eraseUserTrips(scope, target, 'erased_target', prepare)
  expect(new Set(keys)).toEqual(new Set(snapshots[0]?.rewriteKeys))
  expect(
    new Set(await eraseUserTrips(scope, target, 'erased_target', prepare)),
  ).toEqual(new Set(keys))
  expect((await guestRepo.findMany(a.scope))[0]?.createdBy).toBe(
    'erased_target',
  )
  expect((await noteRepo.findMany(a.scope))[0]).toMatchObject({
    createdBy: 'erased_target',
    body: 'Keep',
  })
  expect(await participants.count(a.scope)).toBe(0)
  expect(await favourites.count(a.scope)).toBe(0)
  expect(await memberships.findMany(a.scope)).toHaveLength(1)
  expect((await memberships.findMany(a.scope))[0]?.invitedBy).toBeNull()
  expect((await listRepo.findMany(a.scope)).map((r) => r.name)).toEqual([
    'Shared',
  ])
  expect((await itemRepo.findMany(a.scope))[0]).toMatchObject({
    name: 'Keep',
    assignedTo: null,
  })
  expect((await templateRepo.findMany(a.scope))[0]).toMatchObject({
    name: 'Shared',
    createdBy: 'erased_target',
  })
  expect(await templateItems.count(a.scope)).toBe(0)
  expect((await shareRepo.findMany(a.scope))[0]).toMatchObject({
    createdBy: 'erased_target',
    revokedAt: expect.any(Date),
  })
  expect((await inviteRepo.findMany(a.scope))[0]).toMatchObject({
    createdBy: 'erased_target',
    disabledAt: expect.any(Date),
  })
  expect(await feeds.count(a.scope)).toBe(0)
  expect(
    (await fileRepo.findMany(a.scope)).filter(
      (r) => r.uploadedBy === 'erased_target',
    ),
  ).toHaveLength(105)
  expect((await guestRepo.findMany(b.scope))[0]?.createdBy).toBe(target)
  expect((await noteRepo.findMany(b.scope))[0]?.createdBy).toBe(target)
  expect(await participants.count(b.scope)).toBe(1)
  expect(await favourites.count(b.scope)).toBe(1)
  expect(
    (await memberships.findMany(b.scope)).some((r) => r.invitedBy === target),
  ).toBe(true)
  expect(await listRepo.count(b.scope)).toBe(2)
  expect(await itemRepo.count(b.scope)).toBe(2)
  expect(await templateRepo.count(b.scope)).toBe(2)
  expect(await templateItems.count(b.scope)).toBe(1)
  expect((await shareRepo.findMany(b.scope))[0]).toMatchObject({
    createdBy: target,
    revokedAt: null,
  })
  expect((await inviteRepo.findMany(b.scope))[0]).toMatchObject({
    createdBy: target,
    disabledAt: null,
  })
  expect(await feeds.count(b.scope)).toBe(1)
  expect(
    (await fileRepo.findMany(b.scope)).filter((r) => r.uploadedBy === target),
  ).toHaveLength(105)
})
