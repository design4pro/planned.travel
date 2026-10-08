/**
 * Day locations: where a trip's days are, as far as the data says.
 *
 * The weather reads this and nothing else of the itinerary, so what it answers is the whole contract:
 * the stay that covers a day wins, the first stop is the fallback, a place without both coordinates
 * is no location at all, and a trip the reader may not open yields nothing before any day is read.
 * Whose trip it is - the tenant boundary - lives in `tenant-isolation.test.ts`.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { NotFoundError } from '../context'
import { listTripDays } from '../days'
import {
  createAccommodation,
  createAssignment,
  readDayLocations,
} from '../itinerary'
import { createPlace } from '../places'
import { addTripMember, createTrip } from '../trips'
import { createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

describe('day locations', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let dayIds: Array<string>

  async function place(name: string, lat: number | null, lng: number | null) {
    return createPlace(tenant.scope, { tripId, name, lat, lng })
  }

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('alpha')
    const trip = await createTrip(tenant.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
    })
    tripId = trip.id
    dayIds = (await listTripDays(tenant.scope, tripId)).map((day) => day.id)
  })

  it('answers one entry per day, in day order, with the day date and no location for an empty day', async () => {
    const result = await readDayLocations(tenant.scope, tripId)

    expect(result.map((row) => row.dayId)).toEqual(dayIds)
    expect(result.map((row) => row.date)).toEqual([
      '2026-04-10',
      '2026-04-11',
      '2026-04-12',
      '2026-04-13',
    ])
    expect(result.every((row) => row.location === null)).toBe(true)
  })

  it('uses the first stop of the day when no stay covers it', async () => {
    const museum = await place('Museum', 38.7, -9.1)
    const cafe = await place('Cafe', 38.8, -9.2)
    await createAssignment(tenant.scope, {
      tripId,
      dayId: dayIds[1],
      placeId: museum.id,
    })
    await createAssignment(tenant.scope, {
      tripId,
      dayId: dayIds[1],
      placeId: cafe.id,
    })

    const result = await readDayLocations(tenant.scope, tripId)

    expect(result[1].location).toEqual({ lat: 38.7, lng: -9.1 })
    expect(result[0].location).toBeNull()
  })

  it('prefers the stay that covers the day over a stop', async () => {
    const hotel = await place('Hotel', 41.1, -8.6)
    const museum = await place('Museum', 38.7, -9.1)
    await createAccommodation(tenant.scope, {
      tripId,
      startDayId: dayIds[0],
      endDayId: dayIds[2],
      placeId: hotel.id,
      name: 'Hotel',
    })
    await createAssignment(tenant.scope, {
      tripId,
      dayId: dayIds[1],
      placeId: museum.id,
    })

    const result = await readDayLocations(tenant.scope, tripId)

    expect(result.map((row) => row.location)).toEqual([
      { lat: 41.1, lng: -8.6 },
      { lat: 41.1, lng: -8.6 },
      { lat: 41.1, lng: -8.6 },
      null,
    ])
  })

  it('breaks a tie between overlapping stays by the one starting that day, then the latest start', async () => {
    const early = await place('Early', 10, 10)
    const middle = await place('Middle', 20, 20)
    const late = await place('Late', 30, 30)
    await createAccommodation(tenant.scope, {
      tripId,
      startDayId: dayIds[0],
      endDayId: dayIds[3],
      placeId: early.id,
      name: 'Early',
    })
    await createAccommodation(tenant.scope, {
      tripId,
      startDayId: dayIds[1],
      endDayId: dayIds[3],
      placeId: middle.id,
      name: 'Middle',
    })
    await createAccommodation(tenant.scope, {
      tripId,
      startDayId: dayIds[2],
      endDayId: dayIds[3],
      placeId: late.id,
      name: 'Late',
    })

    const result = await readDayLocations(tenant.scope, tripId)

    expect(result.map((row) => row.location?.lat)).toEqual([10, 20, 30, 30])
  })

  it('skips a stay with no place and falls through to the next candidate', async () => {
    const museum = await place('Museum', 38.7, -9.1)
    await createAccommodation(tenant.scope, {
      tripId,
      startDayId: dayIds[0],
      endDayId: dayIds[1],
      name: 'Friend’s couch',
    })
    await createAssignment(tenant.scope, {
      tripId,
      dayId: dayIds[0],
      placeId: museum.id,
    })

    const result = await readDayLocations(tenant.scope, tripId)

    expect(result[0].location).toEqual({ lat: 38.7, lng: -9.1 })
    expect(result[1].location).toBeNull()
  })

  it.each([
    ['no latitude', null, -9.1],
    ['no longitude', 38.7, null],
    ['neither', null, null],
  ])('does not count a place with %s as a location', async (_, lat, lng) => {
    const vague = await place('Somewhere in Portugal', lat, lng)
    const exact = await place('Museum', 38.7, -9.1)
    await createAccommodation(tenant.scope, {
      tripId,
      startDayId: dayIds[0],
      endDayId: dayIds[0],
      placeId: vague.id,
      name: 'Vague stay',
    })
    await createAssignment(tenant.scope, {
      tripId,
      dayId: dayIds[0],
      placeId: vague.id,
    })
    await createAssignment(tenant.scope, {
      tripId,
      dayId: dayIds[0],
      placeId: exact.id,
    })

    const result = await readDayLocations(tenant.scope, tripId)

    expect(result[0].location).toEqual({ lat: 38.7, lng: -9.1 })
  })

  it('keeps an undated day with a null date, so the caller can tell it has no forecast', async () => {
    const undated = await createTrip(tenant.scope, { title: 'Someday' })
    const days = await listTripDays(tenant.scope, undated.id)

    const result = await readDayLocations(tenant.scope, undated.id)

    expect(result.map((row) => row.dayId)).toEqual(days.map((day) => day.id))
    expect(result.every((row) => row.date === null)).toBe(true)
  })

  it('exposes only the day, its date and a coordinate - no place, stay or member', async () => {
    const museum = await place('Museum', 38.7, -9.1)
    await createAssignment(tenant.scope, {
      tripId,
      dayId: dayIds[0],
      placeId: museum.id,
    })

    const result = await readDayLocations(tenant.scope, tripId)

    expect(Object.keys(result[0]).sort()).toEqual(['date', 'dayId', 'location'])
    expect(Object.keys(result[0].location ?? {}).sort()).toEqual(['lat', 'lng'])
  })

  describe('on a private trip', () => {
    let stranger: ReturnType<SeededTenant['scopeFor']>
    let strangerId: string

    beforeEach(async () => {
      strangerId = await tenant.addUser('stranger')
      stranger = tenant.scopeFor(strangerId)
    })

    it('refuses a member of the workspace who is not on the trip, before reading any day', async () => {
      harness.statements.length = 0

      await expect(readDayLocations(stranger, tripId)).rejects.toBeInstanceOf(
        NotFoundError,
      )
      expect(
        harness.statements.filter((sql) =>
          /"days"|"day_assignments"/.test(sql),
        ),
      ).toEqual([])
    })

    it('lets a viewer read it', async () => {
      await addTripMember(tenant.scope, {
        tripId,
        userId: strangerId,
        role: 'viewer',
      })

      const result = await readDayLocations(stranger, tripId)

      expect(result).toHaveLength(dayIds.length)
    })
  })
})
