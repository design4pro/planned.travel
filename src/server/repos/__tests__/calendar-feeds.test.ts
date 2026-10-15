import { beforeEach, describe, expect, it } from 'vitest'
import { createDayNote, listTripDays } from '../days'
import { readFeedSource } from '../calendar-feeds'
import { createAccommodation, createAssignment } from '../itinerary'
import { createPlace } from '../places'
import { createReservation } from '../reservations'
import { createTransport } from '../transports'
import { createTrip } from '../trips'
import { createHarness, subscribeTenant } from './harness'
import type { Harness, SeededTenant } from './harness'

/** A value in a column the calendar must never read, planted so a leak has something to leak. */
const SECRET = {
  confirmationNumber: 'CONF-998877',
  bookingCode: 'BOOK-554433',
  seat: '17C',
  url: 'https://provider.example/booking/secret',
}

/**
 * Columns whose names must not appear in any statement the read sends. (`notes` is left out on
 * purpose: a stop's own note is its event description; the booking notes are never read, and the
 * row-level test above would catch their text.)
 */
const WITHHELD_COLUMNS = [
  'confirmation_number',
  'booking_code',
  'price_minor',
  'seat',
  'url',
  'provider',
]

async function seedTrip(tenant: SeededTenant, title: string) {
  const trip = await createTrip(tenant.scope, {
    title,
    startDate: '2026-04-10',
    endDate: '2026-04-12',
    currency: 'EUR',
  })
  const days = await listTripDays(tenant.scope, trip.id)
  const firstDay = days.at(0)
  const lastDay = days.at(-1)
  if (firstDay === undefined || lastDay === undefined) {
    throw new Error('A dated trip must have a day run.')
  }
  const place = await createPlace(tenant.scope, {
    tripId: trip.id,
    name: `${title} lookout`,
  })
  const stop = await createAssignment(tenant.scope, {
    tripId: trip.id,
    dayId: firstDay.id,
    placeId: place.id,
    startTime: '09:30',
  })
  const note = await createDayNote(tenant.scope, {
    tripId: trip.id,
    dayId: firstDay.id,
    body: 'Buy the transit pass.',
  })
  const stay = await createAccommodation(tenant.scope, {
    tripId: trip.id,
    startDayId: firstDay.id,
    endDayId: lastDay.id,
    name: 'Alfama guesthouse',
    confirmationNumber: SECRET.confirmationNumber,
  })
  const transport = await createTransport(tenant.scope, {
    tripId: trip.id,
    dayId: firstDay.id,
    title: 'Flight to Lisbon',
    mode: 'flight',
    departureDate: '2026-04-10',
    departureTime: '07:05',
    bookingCode: SECRET.bookingCode,
    seat: SECRET.seat,
  })
  const reservation = await createReservation(tenant.scope, {
    tripId: trip.id,
    title: 'Dinner',
    type: 'restaurant',
    status: 'confirmed',
    startDate: '2026-04-11',
    startTime: '20:00',
    confirmationNumber: SECRET.confirmationNumber,
    url: SECRET.url,
    priceMinor: 4500,
    currency: 'EUR',
  })
  return {
    tripId: trip.id,
    dayIds: days.map((day) => day.id),
    placeId: place.id,
    stopId: stop.id,
    noteId: note.id,
    stayId: stay.id,
    transportId: transport.id,
    reservationId: reservation.id,
  }
}

describe('readFeedSource', () => {
  let harness: Harness
  let alpha: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
    await subscribeTenant(alpha.scope, 'crew')
  })

  it('returns the rows of a readable trip, one list per kind of event', async () => {
    const lisbon = await seedTrip(alpha, 'Lisbon in spring')

    const source = await readFeedSource(alpha.scope, {
      kind: 'trips',
      tripIds: [lisbon.tripId],
    })

    expect(source.trips.map((row) => row.id)).toEqual([lisbon.tripId])
    expect(source.trips[0]).toMatchObject({
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
    })
    expect(source.days.map((row) => row.id).sort()).toEqual(
      [...lisbon.dayIds].sort(),
    )
    expect(source.places.map((row) => row.id)).toEqual([lisbon.placeId])
    expect(source.stops.map((row) => row.id)).toEqual([lisbon.stopId])
    expect(source.stops[0]).toMatchObject({ startTime: '09:30' })
    expect(source.dayNotes.map((row) => row.id)).toEqual([lisbon.noteId])
    expect(source.stays.map((row) => row.id)).toEqual([lisbon.stayId])
    expect(source.transports.map((row) => row.id)).toEqual([lisbon.transportId])
    expect(source.reservations.map((row) => row.id)).toEqual([
      lisbon.reservationId,
    ])
    expect(source.reservations[0]).toMatchObject({
      startDate: '2026-04-11',
      startTime: '20:00',
      status: 'confirmed',
    })
  })

  it('carries none of the columns the calendar may not show, on any row', async () => {
    const lisbon = await seedTrip(alpha, 'Lisbon in spring')

    const source = await readFeedSource(alpha.scope, {
      kind: 'trips',
      tripIds: [lisbon.tripId],
    })

    expect(JSON.stringify(source)).not.toMatch(
      /CONF-998877|BOOK-554433|17C|provider\.example/,
    )
    for (const row of [...source.reservations, ...source.transports]) {
      expect(Object.keys(row)).not.toEqual(
        expect.arrayContaining(['confirmationNumber']),
      )
      expect(Object.keys(row)).not.toEqual(
        expect.arrayContaining(['priceMinor']),
      )
    }
  })

  it('names its columns: no statement selects a withheld column or a whole row', async () => {
    const lisbon = await seedTrip(alpha, 'Lisbon in spring')
    harness.statements.length = 0

    await readFeedSource(alpha.scope, {
      kind: 'trips',
      tripIds: [lisbon.tripId],
    })

    // One statement for the trips, then one per kind of content: nine, never one per row.
    expect(harness.statements).toHaveLength(9)
    for (const sql of harness.statements) {
      const selected = sql.slice(0, sql.indexOf(' from '))
      expect(selected).not.toContain('*')
      for (const column of WITHHELD_COLUMNS) {
        expect(selected, column).not.toContain(`"${column}"`)
      }
    }
  })

  it('sends the same nine statements for several trips', async () => {
    const lisbon = await seedTrip(alpha, 'Lisbon in spring')
    const porto = await seedTrip(alpha, 'Porto in autumn')
    harness.statements.length = 0

    const source = await readFeedSource(alpha.scope, {
      kind: 'trips',
      tripIds: [lisbon.tripId, porto.tripId],
    })

    expect(harness.statements).toHaveLength(9)
    expect(source.trips.map((row) => row.id).sort()).toEqual(
      [lisbon.tripId, porto.tripId].sort(),
    )
    expect(source.stops).toHaveLength(2)
  })

  it('reads nothing, and sends no statement, for an empty selection', async () => {
    harness.statements.length = 0

    const source = await readFeedSource(alpha.scope, {
      kind: 'trips',
      tripIds: [],
    })

    expect(source.trips).toEqual([])
    expect(harness.statements).toEqual([])
  })

  it('reads the trips and stops there when none of them is readable', async () => {
    harness.statements.length = 0

    const source = await readFeedSource(alpha.scope, {
      kind: 'trips',
      tripIds: ['no-such-trip'],
    })

    expect(source.trips).toEqual([])
    expect(source.reservations).toEqual([])
    expect(harness.statements).toHaveLength(1)
  })

  it('refuses a list of ids no statement could carry', async () => {
    const ids = Array.from({ length: 91 }, (_, index) => `trip-${index}`)

    await expect(
      readFeedSource(alpha.scope, { kind: 'trips', tripIds: ids }),
    ).rejects.toBeInstanceOf(RangeError)
  })
})
