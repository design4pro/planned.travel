import { beforeEach, describe, expect, it } from 'vitest'

import { mintId } from '#/lib/ids'
import { NotFoundError } from '../context'
import { listTripDays } from '../days'
import {
  TripArchivedError,
  TripRoleError,
  addTripMember,
  archiveTrip,
  createTrip,
  restoreTrip,
} from '../trips'
import {
  createTransport,
  deleteTransport,
  listTripTransports,
  listTripLegs,
  reorderDayTransports,
  replaceTransportChain,
  saveSearchedConnection,
  saveTransport,
  setTransportStatus,
} from '../transports'
import { createHarness } from './harness'
import type { TenantScope } from '../base'
import type { Trip } from '#/server/db/types'
import type { Harness, SeededTenant } from './harness'

/** A new Transport's id is refused unless it is generator-shaped and recent, so a draft gets a real one. */
const newDraftId = mintId()

const chain = { stations: [{ name: 'Osaka' }, { name: 'Tokyo' }], legs: [{}] }

describe('archived transport write boundary', () => {
  let harness: Harness
  let tenant: SeededTenant
  let trip: Trip
  let dayId: string
  let transportId: string
  let editor: TenantScope
  let viewer: TenantScope

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('archive-transports')
    trip = await createTrip(tenant.scope, {
      title: 'Japan',
      visibility: 'private',
      startDate: '2026-04-10',
      endDate: '2026-04-11',
    })
    dayId = (await listTripDays(tenant.scope, trip.id))[0].id
    for (const role of ['editor', 'viewer'] as const) {
      const userId = await tenant.addUser(role)
      await addTripMember(tenant.scope, { tripId: trip.id, userId, role })
      if (role === 'editor') editor = tenant.scopeFor(userId)
      else viewer = tenant.scopeFor(userId)
    }
    transportId = (
      await saveTransport(tenant.scope, {
        tripId: trip.id,
        transportId: mintId(),
        intent: 'create',
        record: { title: 'Train', mode: 'train', dayId },
        chain,
      })
    ).transport.id
  })

  const writers = [
    'create',
    'status',
    'delete',
    'chain',
    'save-new',
    'save-edit',
    'search-new',
    'search-edit',
    'reorder',
    'reorder-resolved',
  ] as const
  type Writer = (typeof writers)[number]

  function write(
    kind: Writer,
    scope: TenantScope,
    id = transportId,
    requestedTrip = trip.id,
  ): Promise<unknown> {
    switch (kind) {
      case 'create':
        return createTransport(scope, {
          tripId: requestedTrip,
          title: 'Ferry',
          mode: 'ferry',
        })
      case 'status':
        return setTransportStatus(scope, id, 'confirmed')
      case 'delete':
        return deleteTransport(scope, id)
      case 'chain':
        return replaceTransportChain(scope, id, chain)
      case 'save-new':
      case 'save-edit':
        return saveTransport(scope, {
          tripId: requestedTrip,
          transportId: kind === 'save-new' ? newDraftId : id,
          intent: kind === 'save-new' ? 'create' : 'edit',
          record: { title: 'Changed', mode: 'train' },
          chain,
        })
      case 'search-new':
      case 'search-edit':
        return saveSearchedConnection(scope, {
          tripId: requestedTrip,
          transportId: kind === 'search-new' ? null : id,
          mode: 'train',
          title: 'Connection',
          ...chain,
        })
      case 'reorder':
      case 'reorder-resolved':
        return reorderDayTransports(
          scope,
          {
            tripId: requestedTrip,
            dayId,
            items: [{ kind: 'transport', id: transportId }],
          },
          kind === 'reorder-resolved' ? trip : undefined,
        )
    }
  }

  async function snapshot() {
    return {
      transports: await listTripTransports(tenant.scope, trip.id),
      legs: await listTripLegs(tenant.scope, trip.id),
    }
  }

  it.each(writers)(
    '%s refuses owners and editors without changing rows, then works after restore',
    async (kind) => {
      await archiveTrip(tenant.scope, trip.id)
      const before = await snapshot()
      for (const scope of [tenant.scope, editor, viewer]) {
        await expect(write(kind, scope)).rejects.toBeInstanceOf(
          TripArchivedError,
        )
        await expect(write(kind, scope)).rejects.toMatchObject({
          code: 'TRIP_ARCHIVED',
        })
        expect(await snapshot()).toEqual(before)
      }
      for (const scope of [tenant.scope, editor]) {
        await restoreTrip(tenant.scope, trip.id)
        await write(kind, scope)
        // Deletion is deliberately last for this writer's restored-trip checks.
        if (kind === 'delete') {
          transportId = (
            await createTransport(tenant.scope, {
              tripId: trip.id,
              title: 'Another',
              mode: 'train',
            })
          ).id
        }
        await archiveTrip(tenant.scope, trip.id)
      }
    },
  )

  it.each(writers)('%s refuses viewers on active trips', async (kind) => {
    await expect(write(kind, viewer)).rejects.toBeInstanceOf(TripRoleError)
  })

  it.each(writers)(
    '%s hides private archived trips and foreign workspaces, even with a resolved trip',
    async (kind) => {
      await archiveTrip(tenant.scope, trip.id)
      const outsider = tenant.scopeFor(await tenant.addUser('outsider'))
      const foreign = await harness.seedTenant('foreign')
      for (const scope of [outsider, foreign.scope]) {
        await expect(write(kind, scope)).rejects.toBeInstanceOf(NotFoundError)
      }
    },
  )

  it.each(['status', 'delete', 'chain', 'save-edit', 'search-edit'] as const)(
    '%s preserves missing-id errors on an archived trip',
    async (kind) => {
      await archiveTrip(tenant.scope, trip.id)
      await expect(write(kind, tenant.scope, 'missing')).rejects.toBeInstanceOf(
        NotFoundError,
      )
    },
  )

  it.each(['save-edit', 'search-edit'] as const)(
    '%s refuses mismatched ids before revealing archive state',
    async (kind) => {
      const other = await createTrip(tenant.scope, { title: 'Other trip' })
      await archiveTrip(tenant.scope, other.id)
      await expect(
        write(kind, tenant.scope, transportId, other.id),
      ).rejects.toBeInstanceOf(NotFoundError)
      await archiveTrip(tenant.scope, trip.id)
      await expect(
        write(kind, tenant.scope, transportId, other.id),
      ).rejects.toBeInstanceOf(NotFoundError)
    },
  )
  it.each(['save-edit', 'search-edit'] as const)(
    '%s hides a transport on a private archived trip when the requested trip is readable and active',
    async (kind) => {
      const readable = await createTrip(tenant.scope, {
        title: 'Readable',
        visibility: 'organization',
      })
      const outsider = tenant.scopeFor(
        await tenant.addUser('not-on-private-trip'),
      )
      await archiveTrip(tenant.scope, trip.id)
      const before = await snapshot()
      await expect(
        write(kind, outsider, transportId, readable.id),
      ).rejects.toBeInstanceOf(NotFoundError)
      const foreign = await harness.seedTenant('foreign-mismatch')
      const foreignTrip = await createTrip(foreign.scope, {
        title: 'Foreign readable',
      })
      await expect(
        write(kind, foreign.scope, transportId, foreignTrip.id),
      ).rejects.toBeInstanceOf(NotFoundError)
      expect(await snapshot()).toEqual(before)
    },
  )
})
