/**
 * Scheduling a place, unscheduling a stop and deleting a place each restate their day's journeys
 * inside their own write (#816).
 *
 * The three writes never renumber a day (a schedule stores a midpoint, the other two leave a hole),
 * but a journey's `sort_order` is a relation to the stops around it, so each owes its day's
 * journeys a fresh position. What is asserted here is what the two-call design could not promise:
 * the stop change and every journey position land together, or none of them do.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { NotFoundError, RepositoryError } from '../context'
import { createDay, createDayNote, listTripDays } from '../days'
import {
  createAssignment,
  deletePlaceWithJourneys,
  listDayAssignments,
  scheduleAssignment,
  unscheduleAssignment,
} from '../itinerary'
import { createPlace, getPlace } from '../places'
import {
  TripArchivedError,
  TripRoleError,
  addTripMember,
  archiveTrip,
  createTrip,
} from '../trips'
import {
  createTransport,
  listTransportLegs,
  replaceTransportChain,
} from '../transports'
import { captureError, createHarness } from './harness'
import type { Day } from '#/server/db/types'
import type { Harness, SeededTenant } from './harness'

describe('the writes that restate a day’s journeys in their own batch', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let days: Array<Day>

  async function placeOf(name: string): Promise<string> {
    const place = await createPlace(tenant.scope, { tripId, name })
    return place.id
  }

  async function stopAt(
    dayId: string,
    orderIndex: number,
  ): Promise<{ assignmentId: string; placeId: string }> {
    const placeId = await placeOf(`Place ${dayId}/${orderIndex}`)
    const assignment = await createAssignment(tenant.scope, {
      tripId,
      dayId,
      placeId,
      orderIndex,
    })
    return { assignmentId: assignment.id, placeId }
  }

  async function journeyAt(dayId: string, sortOrder: number): Promise<string> {
    const created = await createTransport(tenant.scope, {
      tripId,
      title: 'The 14:05',
      mode: 'train',
      dayId,
    })
    harness.sqlite
      .prepare('update transports set sort_order = ? where id = ?')
      .run(sortOrder, created.id)
    return created.id
  }

  function sortOrderOf(table: 'transports' | 'transport_legs', id: string) {
    const row = harness.sqlite
      .prepare(`select sort_order from ${table} where id = ?`)
      .get(id) as { sort_order: number } | undefined
    return row?.sort_order
  }

  /** Every position the trip stores, on the four columns a day's number line is made of. */
  async function positions(): Promise<Record<string, number>> {
    const snapshot: Record<string, number> = {}
    for (const day of days) {
      for (const row of await listDayAssignments(tenant.scope, day.id)) {
        snapshot[`stop/${row.id}`] = row.orderIndex
      }
    }
    const tables = ['transports', 'transport_legs', 'day_notes'] as const
    for (const table of tables) {
      const rows = harness.sqlite
        .prepare(`select id, sort_order as position from ${table}`)
        .all() as Array<{ id: string; position: number }>
      for (const row of rows) snapshot[`${table}/${row.id}`] = row.position
    }
    return snapshot
  }

  async function refuseEveryJourneyUpdate(): Promise<void> {
    harness.sqlite.exec(
      `create trigger refuse_journey_move before update on transports
       begin select raise(abort, 'forced failure'); end`,
    )
  }

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('restated')
    const trip = await createTrip(tenant.scope, {
      title: 'Kansai run',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      currency: 'JPY',
    })
    tripId = trip.id
    days = await listTripDays(tenant.scope, trip.id)
  })

  describe('scheduling a place', () => {
    it('numbers the journeys over the stop it creates, in the same write', async () => {
      const dayId = days[0].id
      await stopAt(dayId, 0)
      await stopAt(dayId, 1)
      const journey = await journeyAt(dayId, 0.5)
      const placeId = await placeOf('Fushimi Inari')

      const scheduled = await scheduleAssignment(tenant.scope, {
        tripId,
        dayId,
        placeId,
        orderIndex: 0.5,
      })

      // Stored order wins when the caller sends no run: the new stop sits at 0.5, the journey
      // that tied with it follows it, between 0.5 and the next stop at 1.
      expect(sortOrderOf('transports', journey)).toBe(0.75)
      expect(scheduled.days).toEqual([
        { dayId, journeys: [{ kind: 'transport', id: journey }] },
      ])
      const stored = await listDayAssignments(tenant.scope, dayId)
      expect(stored.map((row) => row.id)).toContain(scheduled.assignmentId)
    })

    it('puts the journey where the run puts the new stop, which names it by its place id', async () => {
      const dayId = days[0].id
      const first = await stopAt(dayId, 0)
      const last = await stopAt(dayId, 1)
      const journey = await journeyAt(dayId, 0.5)
      const placeId = await placeOf('Fushimi Inari')

      const scheduled = await scheduleAssignment(tenant.scope, {
        tripId,
        dayId,
        placeId,
        orderIndex: 0.5,
        items: [
          { kind: 'stop', id: first.assignmentId },
          { kind: 'transport', id: journey },
          { kind: 'stop', id: placeId },
          { kind: 'stop', id: last.assignmentId },
        ],
      })

      // The journey stays behind the first stop: between 0 and the new stop's 0.5.
      expect(sortOrderOf('transports', journey)).toBe(0.25)
      expect(scheduled.days[0].journeys).toEqual([
        { kind: 'transport', id: journey },
      ])
    })

    it('says nothing about a day that has no journey', async () => {
      const dayId = days[0].id
      await stopAt(dayId, 0)
      const placeId = await placeOf('Fushimi Inari')

      const scheduled = await scheduleAssignment(tenant.scope, {
        tripId,
        dayId,
        placeId,
        orderIndex: 1,
      })

      expect(scheduled.days).toEqual([])
    })

    it('leaves the stop and every position as they were when a journey statement fails', async () => {
      const dayId = days[0].id
      await stopAt(dayId, 0)
      await stopAt(dayId, 1)
      await journeyAt(dayId, 0.5)
      const placeId = await placeOf('Fushimi Inari')
      const before = await positions()
      await refuseEveryJourneyUpdate()

      const error = await captureError(() =>
        scheduleAssignment(tenant.scope, {
          tripId,
          dayId,
          placeId,
          orderIndex: 0.5,
        }),
      )

      expect(String(error)).toContain('forced failure')
      expect(await positions()).toEqual(before)
    })

    it('writes the stop and the journeys in a single batch', async () => {
      const dayId = days[0].id
      await stopAt(dayId, 0)
      await journeyAt(dayId, 0.5)
      const placeId = await placeOf('Fushimi Inari')

      harness.statements.length = 0
      await scheduleAssignment(tenant.scope, {
        tripId,
        dayId,
        placeId,
        orderIndex: 1,
      })

      const writes = harness.statements.filter(
        (sql) => sql.startsWith('insert') || sql.startsWith('update'),
      )
      expect(writes.map((sql) => sql.split(' ').slice(0, 3).join(' '))).toEqual(
        ['insert into "day_assignments"', 'update "transports" set'],
      )
    })

    it('refuses a viewer and writes nothing', async () => {
      const dayId = days[0].id
      await stopAt(dayId, 0)
      await journeyAt(dayId, 0.5)
      const placeId = await placeOf('Fushimi Inari')
      const viewerId = await tenant.addUser('Viewer')
      await addTripMember(tenant.scope, {
        tripId,
        userId: viewerId,
        role: 'viewer',
      })
      const before = await positions()

      const error = await captureError(() =>
        scheduleAssignment(tenant.scopeFor(viewerId), {
          tripId,
          dayId,
          placeId,
          orderIndex: 1,
        }),
      )

      expect(error).toBeInstanceOf(RepositoryError)
      expect(await positions()).toEqual(before)
    })
  })

  describe('unscheduling a stop', () => {
    it('removes the stop and shares the gap it left among the journeys around it', async () => {
      const dayId = days[0].id
      const first = await stopAt(dayId, 0)
      const middle = await stopAt(dayId, 1)
      const last = await stopAt(dayId, 2)
      const early = await journeyAt(dayId, 0.5)
      const late = await journeyAt(dayId, 1.5)

      const written = await unscheduleAssignment(tenant.scope, {
        tripId,
        assignmentId: middle.assignmentId,
      })

      const remaining = await listDayAssignments(tenant.scope, dayId)
      expect(remaining.map((row) => row.id)).toEqual([
        first.assignmentId,
        last.assignmentId,
      ])
      // Both journeys now follow the first stop and share the gap up to the last one at 2.
      expect(sortOrderOf('transports', early)).toBeCloseTo(2 / 3, 5)
      expect(sortOrderOf('transports', late)).toBeCloseTo(4 / 3, 5)
      expect(written).toEqual([
        {
          dayId,
          journeys: [
            { kind: 'transport', id: early },
            { kind: 'transport', id: late },
          ],
        },
      ])
    })

    it('places a chained journey’s leg on the day it departs from', async () => {
      const dayId = days[0].id
      await stopAt(dayId, 0)
      const gone = await stopAt(dayId, 1)
      const chained = await createTransport(tenant.scope, {
        tripId,
        title: 'The Hikari',
        mode: 'train',
      })
      await replaceTransportChain(tenant.scope, chained.id, {
        stations: [{ name: 'Kyoto' }, { name: 'Nagoya' }],
        legs: [{ departureDayId: dayId, sortOrder: 1.5 }],
      })
      const [leg] = await listTransportLegs(tenant.scope, chained.id)

      const written = await unscheduleAssignment(tenant.scope, {
        tripId,
        assignmentId: gone.assignmentId,
      })

      // One stop left at 0 and an open end one unit wide: the leg sits at the middle of 0..1.
      expect(sortOrderOf('transport_legs', leg.id)).toBe(0.5)
      expect(written[0].journeys).toEqual([{ kind: 'leg', id: leg.id }])
    })

    it('leaves the stop and every position as they were when a journey statement fails', async () => {
      const dayId = days[0].id
      await stopAt(dayId, 0)
      const gone = await stopAt(dayId, 1)
      await journeyAt(dayId, 1.5)
      const before = await positions()
      await refuseEveryJourneyUpdate()

      const error = await captureError(() =>
        unscheduleAssignment(tenant.scope, {
          tripId,
          assignmentId: gone.assignmentId,
        }),
      )

      expect(String(error)).toContain('forced failure')
      expect(await positions()).toEqual(before)
    })

    it('refuses a stop that belongs to another trip of the workspace', async () => {
      const other = await createTrip(tenant.scope, {
        title: 'Another trip',
        startDate: '2026-05-01',
        endDate: '2026-05-02',
        currency: 'JPY',
      })
      const otherDays = await listTripDays(tenant.scope, other.id)
      const place = await createPlace(tenant.scope, {
        tripId: other.id,
        name: 'Elsewhere',
      })
      const foreign = await createAssignment(tenant.scope, {
        tripId: other.id,
        dayId: otherDays[0].id,
        placeId: place.id,
        orderIndex: 0,
      })

      const error = await captureError(() =>
        unscheduleAssignment(tenant.scope, {
          tripId,
          assignmentId: foreign.id,
        }),
      )

      expect(error).toBeInstanceOf(NotFoundError)
      expect(
        await listDayAssignments(tenant.scope, otherDays[0].id),
      ).toHaveLength(1)
    })

    it('writes nothing for a day without journeys beyond the delete itself', async () => {
      const dayId = days[0].id
      const gone = await stopAt(dayId, 0)

      harness.statements.length = 0
      const written = await unscheduleAssignment(tenant.scope, {
        tripId,
        assignmentId: gone.assignmentId,
      })

      expect(written).toEqual([])
      expect(
        harness.statements.filter((sql) => sql.startsWith('update')),
      ).toEqual([])
    })
  })

  describe('on an archived trip, or for a viewer', () => {
    async function viewerScope() {
      const viewerId = await tenant.addUser('Viewer')
      await addTripMember(tenant.scope, {
        tripId,
        userId: viewerId,
        role: 'viewer',
      })
      return tenant.scopeFor(viewerId)
    }

    it.each(['schedule', 'unschedule', 'delete'] as const)(
      '%s is refused for an archived trip and changes nothing',
      async (kind) => {
        const dayId = days[0].id
        const held = await stopAt(dayId, 0)
        await journeyAt(dayId, 0.5)
        const placeId = await placeOf('Fushimi Inari')
        await archiveTrip(tenant.scope, tripId)
        const before = await positions()

        const error = await captureError(() => {
          switch (kind) {
            case 'schedule':
              return scheduleAssignment(tenant.scope, {
                tripId,
                dayId,
                placeId,
                orderIndex: 1,
              })
            case 'unschedule':
              return unscheduleAssignment(tenant.scope, {
                tripId,
                assignmentId: held.assignmentId,
              })
            case 'delete':
              return deletePlaceWithJourneys(tenant.scope, {
                tripId,
                placeId: held.placeId,
              })
          }
        })

        expect(error).toBeInstanceOf(TripArchivedError)
        expect(await positions()).toEqual(before)
      },
    )

    it('refuses a viewer an unschedule and a delete, and writes nothing', async () => {
      const dayId = days[0].id
      const held = await stopAt(dayId, 0)
      await journeyAt(dayId, 0.5)
      const viewer = await viewerScope()
      const before = await positions()

      expect(
        await captureError(() =>
          unscheduleAssignment(viewer, {
            tripId,
            assignmentId: held.assignmentId,
          }),
        ),
      ).toBeInstanceOf(TripRoleError)
      expect(
        await captureError(() =>
          deletePlaceWithJourneys(viewer, { tripId, placeId: held.placeId }),
        ),
      ).toBeInstanceOf(TripRoleError)
      expect(await positions()).toEqual(before)
    })
  })

  describe('which journeys a day places', () => {
    it('writes nothing for a journey that only arrives on the day', async () => {
      const arrivalDay = days[1].id
      const journey = await journeyAt(days[0].id, 0)
      harness.sqlite
        .prepare('update transports set arrival_day_id = ? where id = ?')
        .run(arrivalDay, journey)
      await stopAt(arrivalDay, 0)
      const placeId = await placeOf('Fushimi Inari')

      const scheduled = await scheduleAssignment(tenant.scope, {
        tripId,
        dayId: arrivalDay,
        placeId,
        orderIndex: 1,
      })

      // Its `sort_order` belongs to the departure day's ruler; this day measures against another.
      expect(sortOrderOf('transports', journey)).toBe(0)
      expect(scheduled.days).toEqual([])
    })

    it('leaves a record of the day out of the run when it is drawn as its legs', async () => {
      // The record keeps the `day_id` it was created with — `replaceTransportChain` does not clear
      // it — and a journey drawn as its legs is never also drawn whole.
      const dayId = days[0].id
      const chained = await journeyAt(dayId, 0)
      await replaceTransportChain(tenant.scope, chained, {
        stations: [{ name: 'Kyoto' }, { name: 'Nagoya' }, { name: 'Tokyo' }],
        legs: [{ departureDayId: days[1].id }, { departureDayId: days[2].id }],
      })
      await stopAt(dayId, 0)
      const gone = await stopAt(dayId, 1)
      const whole = await journeyAt(dayId, 1.5)

      const written = await unscheduleAssignment(tenant.scope, {
        tripId,
        assignmentId: gone.assignmentId,
      })

      expect(written).toEqual([
        { dayId, journeys: [{ kind: 'transport', id: whole }] },
      ])
      expect(sortOrderOf('transports', chained)).toBe(0)
      expect(sortOrderOf('transports', whole)).toBe(0.5)
    })

    it('refuses a day belonging to another trip', async () => {
      const other = await createTrip(tenant.scope, { title: 'Osaka weekend' })
      const foreignDay = await createDay(tenant.scope, {
        tripId: other.id,
        dayNumber: 1,
      })
      const placeId = await placeOf('Fushimi Inari')

      expect(
        await captureError(() =>
          scheduleAssignment(tenant.scope, {
            tripId,
            dayId: foreignDay.id,
            placeId,
            orderIndex: 0,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
    })
  })

  describe('deleting a place', () => {
    it('deletes the place and its stops and re-places the journeys of every day it was on', async () => {
      const [dayOne, dayTwo] = days
      const placeId = await placeOf('Kiyomizu-dera')
      await createAssignment(tenant.scope, {
        tripId,
        dayId: dayOne.id,
        placeId,
        orderIndex: 1,
      })
      await createAssignment(tenant.scope, {
        tripId,
        dayId: dayTwo.id,
        placeId,
        orderIndex: 0,
      })
      await stopAt(dayOne.id, 0)
      await stopAt(dayOne.id, 2)
      const onOne = await journeyAt(dayOne.id, 1.5)
      const onTwo = await journeyAt(dayTwo.id, 0.5)

      const written = await deletePlaceWithJourneys(tenant.scope, {
        tripId,
        placeId,
      })

      expect(await getPlace(tenant.scope, placeId)).toBeNull()
      expect(await listDayAssignments(tenant.scope, dayTwo.id)).toEqual([])
      // Day one keeps its other stops at 0 and 2: the journey follows the first of them.
      expect(sortOrderOf('transports', onOne)).toBe(1)
      // Day two has no stop left: an open day puts the journey at 0.5 between 0 and 1.
      expect(sortOrderOf('transports', onTwo)).toBe(0.5)
      expect(written.map((day) => day.dayId).sort()).toEqual(
        [dayOne.id, dayTwo.id].sort(),
      )
    })

    it('leaves the place, its stops and every position as they were when a journey statement fails', async () => {
      const dayId = days[0].id
      const { placeId } = await stopAt(dayId, 1)
      await journeyAt(dayId, 1.5)
      const before = await positions()
      await refuseEveryJourneyUpdate()

      const error = await captureError(() =>
        deletePlaceWithJourneys(tenant.scope, { tripId, placeId }),
      )

      expect(String(error)).toContain('forced failure')
      expect(await getPlace(tenant.scope, placeId)).not.toBeNull()
      expect(await positions()).toEqual(before)
    })

    it('refuses a place of another trip', async () => {
      const other = await createTrip(tenant.scope, {
        title: 'Another trip',
        startDate: '2026-05-01',
        endDate: '2026-05-02',
        currency: 'JPY',
      })
      const foreign = await createPlace(tenant.scope, {
        tripId: other.id,
        name: 'Elsewhere',
      })

      const error = await captureError(() =>
        deletePlaceWithJourneys(tenant.scope, {
          tripId,
          placeId: foreign.id,
        }),
      )

      expect(error).toBeInstanceOf(NotFoundError)
      expect(await getPlace(tenant.scope, foreign.id)).not.toBeNull()
    })

    it('deletes a place that is on no day, with no journey statement', async () => {
      const placeId = await placeOf('Unscheduled')
      await createDayNote(tenant.scope, {
        tripId,
        dayId: days[0].id,
        body: 'Untouched',
        sortOrder: 0,
      })

      harness.statements.length = 0
      const written = await deletePlaceWithJourneys(tenant.scope, {
        tripId,
        placeId,
      })

      expect(written).toEqual([])
      expect(await getPlace(tenant.scope, placeId)).toBeNull()
    })
  })
})
