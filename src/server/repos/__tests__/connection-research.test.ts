/**
 * Re-searching a saved connection keeps the journey on the day it was anchored to (#788).
 *
 * The planner draws a record that has legs through its legs alone, each on its `departure_day_id`,
 * and the connection dialog sends legs that name no day. A re-search that wrote those legs as sent
 * therefore took the journey off every day of the plan. The rule under test is the one
 * `saveSearchedConnection` owns: on a re-search, a leg that names no day takes the anchor the
 * journey had before, and a day the caller does name always wins.
 *
 * A new file rather than a block in `transports.test.ts`: the subject is one rule of one writer,
 * and it reads the journey back the way the planner does, through `departingJourneys` (which finds
 * the journeys every write of a day places) and `listTripDayTransports`.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { editTransport } from './edit-transport'
import { captureError, createHarness } from './harness'
import { NotFoundError } from '../context'
import { departingJourneys } from '../day-journeys'
import { listTripDays } from '../days'
import { createTrip } from '../trips'
import {
  createTransport,
  getTransport,
  listTransportLegs,
  listTripDayTransports,
  replaceTransportChain,
  saveSearchedConnection,
} from '../transports'
import type { Day, TransportLeg } from '#/server/db/types'
import type { Harness, SeededTenant } from './harness'

const OSAKA = { name: 'Shin-Osaka', code: 'OSA', timezone: 'Asia/Tokyo' }
const NAGOYA = { name: 'Nagoya', code: 'NGO', timezone: 'Asia/Tokyo' }
const KYOTO = { name: 'Kyoto', code: 'UKY', timezone: 'Asia/Tokyo' }
const TOKYO = { name: 'Tokyo', code: 'TYO', timezone: 'Asia/Tokyo' }

describe('a saved connection that is searched again', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let days: Array<Day>

  /** Saves a connection whose legs name no day, as the connection dialog does. */
  async function saveUnanchored(legCount: number): Promise<string> {
    const stations = [OSAKA, NAGOYA, KYOTO, TOKYO].slice(0, legCount + 1)
    const saved = await saveSearchedConnection(tenant.scope, {
      tripId,
      mode: 'train',
      title: 'Osaka to Tokyo',
      stations,
      legs: stations.slice(1).map(() => ({})),
    })
    return saved.transport.id
  }

  /** The day references of a journey's legs, by position. */
  function anchorsOf(
    legs: ReadonlyArray<TransportLeg>,
  ): Array<{ departure: string | null; arrival: string | null }> {
    return legs.map((leg) => ({
      departure: leg.departureDayId,
      arrival: leg.arrivalDayId,
    }))
  }

  /** Which of these legs a day finds to place: the ones that depart from it, in the order given. */
  async function legsDeparting(
    dayId: string,
    legs: ReadonlyArray<TransportLeg>,
  ): Promise<Array<string>> {
    const departing = new Set(
      (await departingJourneys(tenant.scope, tripId, dayId)).map(
        (entry) => entry.ref.id,
      ),
    )
    return legs.map((leg) => leg.id).filter((id) => departing.has(id))
  }

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('re-search')
    const trip = await createTrip(tenant.scope, {
      title: 'Sanyo line',
      startDate: '2026-04-10',
      endDate: '2026-04-14',
      currency: 'JPY',
    })
    tripId = trip.id
    days = await listTripDays(tenant.scope, trip.id)
  })

  it('keeps an anchored journey on the day it departs from', async () => {
    const transportId = await saveUnanchored(1)
    const [anchored] = await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, TOKYO],
      legs: [{ departureDayId: days[1].id, departureTime: '09:00' }],
    })
    expect(await legsDeparting(days[1].id, [anchored])).toEqual([anchored.id])

    const saved = await saveSearchedConnection(tenant.scope, {
      tripId,
      transportId,
      mode: 'train',
      title: 'Osaka to Tokyo',
      stations: [OSAKA, TOKYO],
      legs: [{ departureTime: '09:30' }],
    })

    expect(saved.legs[0].departureTime).toBe('09:30')
    expect(saved.legs[0].departureDayId).toBe(days[1].id)
    expect(await legsDeparting(days[1].id, saved.legs)).toEqual([
      saved.legs[0].id,
    ])
    const { legs } = await listTripDayTransports(tenant.scope, tripId)
    expect(legs.map((leg) => leg.departureDayId)).toEqual([days[1].id])
  })

  it('keeps each position’s pair and its place in the day when the number of legs is the same', async () => {
    const transportId = await saveUnanchored(2)
    await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, NAGOYA, TOKYO],
      legs: [
        { departureDayId: days[0].id, sortOrder: 2.5 },
        { departureDayId: days[1].id, arrivalDayId: days[2].id },
      ],
    })

    const saved = await saveSearchedConnection(tenant.scope, {
      tripId,
      transportId,
      mode: 'train',
      title: 'Osaka to Tokyo',
      stations: [OSAKA, NAGOYA, TOKYO],
      legs: [{ serviceNumber: 'Hikari 501' }, {}],
    })

    expect(anchorsOf(saved.legs)).toEqual([
      { departure: days[0].id, arrival: null },
      { departure: days[1].id, arrival: days[2].id },
    ])
    expect(saved.legs[0].serviceNumber).toBe('Hikari 501')
    expect(saved.legs[0].sortOrder).toBe(2.5)
  })

  it('carries only the two ends when the number of legs changes', async () => {
    const transportId = await saveUnanchored(2)
    await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, NAGOYA, TOKYO],
      legs: [
        { departureDayId: days[0].id },
        { departureDayId: days[1].id, arrivalDayId: days[2].id },
      ],
    })

    const saved = await saveSearchedConnection(tenant.scope, {
      tripId,
      transportId,
      mode: 'train',
      title: 'Osaka to Tokyo',
      stations: [OSAKA, KYOTO, NAGOYA, TOKYO],
      legs: [{}, {}, {}],
    })

    expect(anchorsOf(saved.legs)).toEqual([
      { departure: days[0].id, arrival: null },
      { departure: null, arrival: null },
      { departure: null, arrival: days[2].id },
    ])
  })

  it('anchors the legs of a journey that had none from the record’s own days', async () => {
    const record = await createTransport(tenant.scope, {
      tripId,
      title: 'Osaka to Tokyo',
      mode: 'train',
      dayId: days[1].id,
      arrivalDayId: days[2].id,
    })

    const saved = await saveSearchedConnection(tenant.scope, {
      tripId,
      transportId: record.id,
      mode: 'train',
      title: 'Osaka to Tokyo',
      stations: [OSAKA, NAGOYA, TOKYO],
      legs: [{}, {}],
    })

    expect(anchorsOf(saved.legs)).toEqual([
      { departure: days[1].id, arrival: null },
      { departure: null, arrival: days[2].id },
    ])
    expect(await legsDeparting(days[1].id, saved.legs)).toEqual([
      saved.legs[0].id,
    ])
  })

  it('gives a one-leg chain both ends of a record that had no legs', async () => {
    const record = await createTransport(tenant.scope, {
      tripId,
      title: 'Night bus',
      mode: 'bus',
      dayId: days[1].id,
      arrivalDayId: days[2].id,
    })

    const saved = await saveSearchedConnection(tenant.scope, {
      tripId,
      transportId: record.id,
      mode: 'bus',
      title: 'Night bus',
      stations: [OSAKA, TOKYO],
      legs: [{}],
    })

    expect(anchorsOf(saved.legs)).toEqual([
      { departure: days[1].id, arrival: days[2].id },
    ])
  })

  it('treats the null day reference the dialog’s empty selects become as naming none', async () => {
    const transportId = await saveUnanchored(1)
    await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, TOKYO],
      legs: [{ departureDayId: days[1].id, arrivalDayId: days[2].id }],
    })

    const saved = await saveSearchedConnection(tenant.scope, {
      tripId,
      transportId,
      mode: 'train',
      title: 'Osaka to Tokyo',
      stations: [OSAKA, TOKYO],
      legs: [{ departureDayId: null, arrivalDayId: null }],
    })

    expect(anchorsOf(saved.legs)).toEqual([
      { departure: days[1].id, arrival: days[2].id },
    ])
  })

  it('never overwrites a day the re-search names', async () => {
    const transportId = await saveUnanchored(1)
    await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, TOKYO],
      legs: [{ departureDayId: days[0].id, arrivalDayId: days[1].id }],
    })

    const saved = await saveSearchedConnection(tenant.scope, {
      tripId,
      transportId,
      mode: 'train',
      title: 'Osaka to Tokyo',
      stations: [OSAKA, TOKYO],
      legs: [{ departureDayId: days[3].id }],
    })

    // The named departure stands; the arrival it would now precede is dropped, not refused.
    expect(anchorsOf(saved.legs)).toEqual([
      { departure: days[3].id, arrival: null },
    ])

    const again = await saveSearchedConnection(tenant.scope, {
      tripId,
      transportId,
      mode: 'train',
      title: 'Osaka to Tokyo',
      stations: [OSAKA, TOKYO],
      legs: [{ departureDayId: days[2].id, arrivalDayId: days[4].id }],
    })
    expect(anchorsOf(again.legs)).toEqual([
      { departure: days[2].id, arrival: days[4].id },
    ])
  })

  it('drops a carried arrival that would land before the departure, and keeps the departure', async () => {
    const transportId = await saveUnanchored(2)
    await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, NAGOYA, TOKYO],
      legs: [
        { departureDayId: days[2].id },
        { departureDayId: days[1].id, arrivalDayId: days[1].id },
      ],
    })

    // One new leg takes the old journey's start and end, which are in the wrong order for one leg.
    const saved = await saveSearchedConnection(tenant.scope, {
      tripId,
      transportId,
      mode: 'train',
      title: 'Osaka to Tokyo',
      stations: [OSAKA, TOKYO],
      legs: [{}],
    })

    expect(anchorsOf(saved.legs)).toEqual([
      { departure: days[2].id, arrival: null },
    ])
  })

  it('drops a carried departure that a named arrival would precede', async () => {
    const transportId = await saveUnanchored(1)
    await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, TOKYO],
      legs: [{ departureDayId: days[3].id }],
    })

    const saved = await saveSearchedConnection(tenant.scope, {
      tripId,
      transportId,
      mode: 'train',
      title: 'Osaka to Tokyo',
      stations: [OSAKA, TOKYO],
      legs: [{ arrivalDayId: days[1].id }],
    })

    expect(anchorsOf(saved.legs)).toEqual([
      { departure: null, arrival: days[1].id },
    ])
  })

  it('leaves the record’s own title, status, booking fields and days as they were', async () => {
    const transportId = await saveUnanchored(1)
    await editTransport(tenant.scope, tripId, transportId, {
      title: 'Osaka to Tokyo',
      status: 'confirmed',
      bookingCode: 'ABC123',
      dayId: days[1].id,
    })
    await replaceTransportChain(tenant.scope, transportId, {
      stations: [OSAKA, TOKYO],
      legs: [{ departureDayId: days[1].id }],
    })

    await saveSearchedConnection(tenant.scope, {
      tripId,
      transportId,
      mode: 'bus',
      title: 'Another title',
      priceMinor: 99,
      currency: 'JPY',
      stations: [OSAKA, TOKYO],
      legs: [{}],
    })

    const record = await getTransport(tenant.scope, transportId)
    expect(record?.title).toBe('Osaka to Tokyo')
    expect(record?.status).toBe('confirmed')
    expect(record?.bookingCode).toBe('ABC123')
    expect(record?.dayId).toBe(days[1].id)
    expect(record?.arrivalDayId).toBeNull()
  })

  it('carries nothing into a connection that is saved as new', async () => {
    const transportId = await saveUnanchored(2)

    const legs = await listTransportLegs(tenant.scope, transportId)
    expect(anchorsOf(legs)).toEqual([
      { departure: null, arrival: null },
      { departure: null, arrival: null },
    ])
    expect((await getTransport(tenant.scope, transportId))?.dayId).toBeNull()
  })

  it('still refuses a named day of another trip', async () => {
    const transportId = await saveUnanchored(1)
    const other = await createTrip(tenant.scope, {
      title: 'Elsewhere',
      startDate: '2026-05-01',
      endDate: '2026-05-02',
      currency: 'JPY',
    })
    const [foreign] = await listTripDays(tenant.scope, other.id)

    const error = await captureError(() =>
      saveSearchedConnection(tenant.scope, {
        tripId,
        transportId,
        mode: 'train',
        title: 'Osaka to Tokyo',
        stations: [OSAKA, TOKYO],
        legs: [{ departureDayId: foreign.id }],
      }),
    )
    expect(error).toBeInstanceOf(NotFoundError)
  })
})
