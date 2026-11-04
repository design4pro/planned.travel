import { afterEach, describe, expect, it } from 'vitest'
import {
  dayAssignments,
  days,
  places,
  reservations,
  trips,
} from '#/server/db/schema'
import { listMascotScheduled } from '../mascot-scheduled'
import { createHarness } from './harness'
import type { Harness } from './harness'

let harness: Harness | undefined
afterEach(() => harness?.close())

describe('mascot scheduled candidates', () => {
  it('filters unreadable, archived and foreign trips before the limit', async () => {
    harness = await createHarness()
    const tenant = await harness.seedTenant('mascot-scheduled')
    const foreign = await harness.seedTenant('mascot-foreign')
    for (const [id, organizationId, createdBy, visibility, isArchived] of [
      [
        'visible',
        tenant.organizationId,
        tenant.ownerUserId,
        'organization',
        false,
      ],
      ['private', tenant.organizationId, tenant.ownerUserId, 'private', false],
      [
        'archived',
        tenant.organizationId,
        tenant.ownerUserId,
        'organization',
        true,
      ],
      [
        'foreign',
        foreign.organizationId,
        foreign.ownerUserId,
        'organization',
        false,
      ],
    ] as const) {
      await harness.db.insert(trips).values({
        id,
        organizationId,
        createdBy,
        title: id,
        slug: id,
        visibility,
        isArchived,
      })
      await harness.db.insert(reservations).values({
        id,
        organizationId,
        tripId: id,
        title: id,
        status: 'confirmed',
        startDate: '2026-01-08',
      })
    }
    for (let i = 0; i < 51; i++) {
      await harness.db.insert(reservations).values({
        id: `r${String(i).padStart(2, '0')}`,
        organizationId: tenant.organizationId,
        tripId: 'visible',
        title: 'secret',
        status: 'confirmed',
        startDate: '2026-01-09',
      })
    }
    await harness.db.insert(days).values({
      id: 'day',
      organizationId: tenant.organizationId,
      tripId: 'visible',
      dayNumber: 1,
      date: '2026-01-08',
    })
    for (const status of ['none', 'cancelled', 'completed']) {
      await harness.db.insert(places).values({
        id: `place-${status}`,
        organizationId: tenant.organizationId,
        tripId: 'visible',
        name: status,
      })
      await harness.db.insert(dayAssignments).values({
        id: `event-${status}`,
        organizationId: tenant.organizationId,
        tripId: 'visible',
        dayId: 'day',
        placeId: `place-${status}`,
        reservationStatus: status,
      })
    }
    await harness.db.insert(places).values({
      id: 'foreign-place',
      organizationId: foreign.organizationId,
      tripId: 'foreign',
      name: 'foreign',
    })
    await harness.db.insert(dayAssignments).values({
      id: 'cross-tenant-place',
      organizationId: tenant.organizationId,
      tripId: 'visible',
      dayId: 'day',
      placeId: 'foreign-place',
    })
    const result = await listMascotScheduled(tenant.scope, '2026-01-08')
    expect(result).toHaveLength(50)
    expect(result[0]).toEqual({
      source: 'event',
      id: 'event-none',
      tripId: 'visible',
      occurrence: '2026-01-08',
    })
    expect(result[1]).toEqual({
      source: 'reservation',
      id: 'visible',
      tripId: 'visible',
      occurrence: '2026-01-08',
    })
    expect(result.map((row) => row.id)).not.toContain('cross-tenant-place')
    expect(result.map((row) => row.id)).not.toContain('private')
    expect(result.map((row) => row.id)).not.toContain('archived')
    expect(result.map((row) => row.id)).not.toContain('foreign')
    expect(result.map((row) => row.id)).not.toContain('r48')
    expect(result.map((row) => row.id)).not.toContain('event-cancelled')
    expect(result.map((row) => row.id)).not.toContain('event-completed')
  })
  it('checks real inclusive dates before limiting', async () => {
    harness = await createHarness()
    const tenant = await harness.seedTenant('mascot-dates')
    await harness.db
      .insert(trips)
      .values({
        id: 'trip',
        organizationId: tenant.organizationId,
        createdBy: tenant.ownerUserId,
        title: 'Trip',
        slug: 'trip',
        visibility: 'organization',
      })
    for (let i = 0; i < 51; i++) {
      await harness.db
        .insert(reservations)
        .values({
          id: `invalid-${i}`,
          organizationId: tenant.organizationId,
          tripId: 'trip',
          title: 'Invalid',
          status: 'confirmed',
          startDate: '2024-02-30',
        })
    }
    for (const [id, startDate] of [
      ['first', '2024-02-28'],
      ['last', '2024-03-06'],
      ['late', '2024-03-07'],
    ]) {
      await harness.db
        .insert(reservations)
        .values({
          id,
          organizationId: tenant.organizationId,
          tripId: 'trip',
          title: id,
          status: 'confirmed',
          startDate,
        })
    }
    expect(
      (await listMascotScheduled(tenant.scope, '2024-02-28')).map(
        (row) => row.id,
      ),
    ).toEqual(['first', 'last'])
  })
})
