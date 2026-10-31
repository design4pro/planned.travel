import { beforeEach, describe, expect, it } from 'vitest'
import { checkInsRepository, createCheckIn, deleteCheckIn } from '../collab'
import { ForbiddenError, NotFoundError } from '../context'
import { addTripMember, createTrip, TripRoleError, updateTrip } from '../trips'
import { createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

describe('check-in deletion context and moderation', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('check-in-roles')
    const trip = await createTrip(tenant.scope, {
      title: 'Lisbon',
      slug: 'lisbon',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
    })
    tripId = trip.id
  })

  it('requires exact context, including standalone, before checking roles', async () => {
    const viewerId = await tenant.addUser('Viewer')
    await addTripMember(tenant.scope, {
      tripId,
      userId: viewerId,
      role: 'viewer',
    })
    const linked = await createCheckIn(tenant.scope, { tripId, name: 'Linked' })
    const standalone = await createCheckIn(tenant.scope, { name: 'Standalone' })
    const before = await checkInsRepository.findMany(tenant.scope)
    for (const scope of [tenant.scope, tenant.scopeFor(viewerId)]) {
      await expect(
        deleteCheckIn(scope, null, linked.id),
      ).rejects.toBeInstanceOf(NotFoundError)
      await expect(
        deleteCheckIn(scope, tripId, standalone.id),
      ).rejects.toBeInstanceOf(NotFoundError)
      await expect(
        deleteCheckIn(scope, tripId, 'missing'),
      ).rejects.toBeInstanceOf(NotFoundError)
    }
    expect(await checkInsRepository.findMany(tenant.scope)).toEqual(before)
    await deleteCheckIn(tenant.scope, null, standalone.id)
    await deleteCheckIn(tenant.scope, tripId, linked.id)
    expect(await checkInsRepository.findMany(tenant.scope)).toEqual([])
  })

  it.each(['owner', 'editor'] as const)(
    'keeps author restrictions for a trip %s who is a workspace member',
    async (role) => {
      const memberId = await tenant.addUser('Traveller')
      await addTripMember(tenant.scope, { tripId, userId: memberId, role })
      const scope = tenant.scopeFor(memberId)
      const other = await createCheckIn(tenant.scope, {
        tripId,
        name: 'Other author',
      })
      const own = await createCheckIn(scope, { tripId, name: 'Own' })
      const before = await checkInsRepository.findMany(tenant.scope)
      await expect(
        deleteCheckIn(scope, tripId, other.id),
      ).rejects.toBeInstanceOf(ForbiddenError)
      expect(await checkInsRepository.findMany(tenant.scope)).toEqual(before)
      await deleteCheckIn(scope, tripId, own.id)
      expect(await checkInsRepository.findById(tenant.scope, other.id)).toEqual(
        other,
      )
    },
  )

  it.each(['owner', 'admin'] as const)(
    'requires a trip write role even for a workspace %s',
    async (role) => {
      const moderatorId = await tenant.addUser('Moderator', role)
      const scope = tenant.scopeFor(moderatorId, role)
      await updateTrip(tenant.scope, tripId, { visibility: 'organization' })
      const row = await createCheckIn(tenant.scope, {
        tripId,
        name: 'Other author',
      })
      const before = await checkInsRepository.findMany(tenant.scope)
      await expect(deleteCheckIn(scope, tripId, row.id)).rejects.toBeInstanceOf(
        TripRoleError,
      )
      expect(await checkInsRepository.findMany(tenant.scope)).toEqual(before)
      await addTripMember(tenant.scope, {
        tripId,
        userId: moderatorId,
        role: 'editor',
      })
      await deleteCheckIn(scope, tripId, row.id)
      expect(await checkInsRepository.findMany(tenant.scope)).toEqual([])
    },
  )

  it('hides another workspace’s standalone rows in every context', async () => {
    const other = await harness.seedTenant('foreign-check-ins')
    const row = await createCheckIn(other.scope, { name: 'Foreign standalone' })
    const before = await checkInsRepository.findMany(other.scope)
    for (const context of [null, tripId]) {
      await expect(
        deleteCheckIn(tenant.scope, context, row.id),
      ).rejects.toBeInstanceOf(NotFoundError)
    }
    expect(await checkInsRepository.findMany(other.scope)).toEqual(before)
    expect(await checkInsRepository.findMany(tenant.scope)).toEqual([])
  })

  it('preserves standalone author and workspace moderation privileges', async () => {
    const memberId = await tenant.addUser('Traveller')
    const member = tenant.scopeFor(memberId)
    const own = await createCheckIn(member, { name: 'Own standalone' })
    const other = await createCheckIn(tenant.scope, {
      name: 'Other standalone',
    })
    const before = await checkInsRepository.findMany(tenant.scope)
    await expect(deleteCheckIn(member, null, other.id)).rejects.toBeInstanceOf(
      ForbiddenError,
    )
    expect(await checkInsRepository.findMany(tenant.scope)).toEqual(before)
    await deleteCheckIn(member, null, own.id)
    for (const role of ['owner', 'admin'] as const) {
      const moderatorId = await tenant.addUser(`Moderator ${role}`, role)
      const row = await createCheckIn(member, {
        tripId: null,
        name: 'Moderated standalone',
      })
      await deleteCheckIn(tenant.scopeFor(moderatorId, role), null, row.id)
    }
    await deleteCheckIn(tenant.scope, null, other.id)
    expect(await checkInsRepository.findMany(tenant.scope)).toEqual([])
  })
})
