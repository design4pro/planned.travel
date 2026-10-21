/**
 * The zone a trip is read in when it has none of its own: the rule, one case per way it says no.
 *
 * The airports are rows of the real table in the repos harness (the catalogue is plain reference
 * data, so there is no tenant to cross), and the days are hand-written `DayLocation`s, because the
 * rule starts from the day-location read and not from the itinerary behind it.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { airports } from '#/server/db/schema'
import { createHarness } from '#/server/repos/__tests__/harness'
import { deriveTripZone } from '../trip-zone'

import type { Database, NewAirport } from '#/server/db/types'
import type { DayLocation } from '#/server/repos'

let db: Database
let statements: Array<string>

beforeEach(async () => {
  const harness = await createHarness()
  db = harness.db
  statements = harness.statements
})

const OSLO_AIRPORT: NewAirport = {
  id: 'apt_osl',
  iataCode: 'OSL',
  name: 'Oslo Gardermoen',
  countryCode: 'NO',
  timezone: 'Europe/Oslo',
  lat: 60.1939,
  lng: 11.1004,
}

/** A hotel about 37 km from Gardermoen. */
const OSLO_HOTEL = { lat: 59.9139, lng: 10.7522 }

function day(
  location: DayLocation['location'],
  countryCode: string | null = null,
): DayLocation {
  return { dayId: 'day', date: '2026-10-08', location, countryCode }
}

async function stock(...rows: Array<NewAirport>) {
  await db.insert(airports).values(rows)
}

describe('deriveTripZone', () => {
  it('takes the zone of the nearest airport within 100 km', async () => {
    await stock(OSLO_AIRPORT)

    expect(await deriveTripZone(db, [day(OSLO_HOTEL)])).toBe('Europe/Oslo')
  })

  it('reads the first located day of the whole trip, and skips a day with none', async () => {
    await stock(OSLO_AIRPORT, {
      id: 'apt_hnd',
      iataCode: 'HND',
      name: 'Tokyo Haneda',
      countryCode: 'JP',
      timezone: 'Asia/Tokyo',
      lat: 35.5494,
      lng: 139.7798,
    })

    const locations = [
      day(null),
      day(OSLO_HOTEL),
      day({ lat: 35.6, lng: 139.7 }),
    ]

    expect(await deriveTripZone(db, locations)).toBe('Europe/Oslo')
  })

  it('has no zone for a trip with no located day, and asks the database nothing', async () => {
    statements.length = 0

    expect(await deriveTripZone(db, [day(null), day(null)])).toBeNull()
    expect(await deriveTripZone(db, [])).toBeNull()
    expect(statements).toEqual([])
  })

  it('has no zone when no airport lies within 100 km', async () => {
    await stock({ ...OSLO_AIRPORT, lat: 61.5 })

    expect(await deriveTripZone(db, [day(OSLO_HOTEL)])).toBeNull()
  })

  it('has no zone when the nearest airport has none, rather than reaching for the next one', async () => {
    // A border town: the unzoned airport on its own side is nearer than the zoned one across it.
    await stock(
      {
        id: 'apt_near',
        iataCode: 'NEA',
        name: 'Near, in a multi-zone country',
        countryCode: 'NO',
        timezone: null,
        lat: 59.95,
        lng: 10.75,
      },
      OSLO_AIRPORT,
    )

    expect(await deriveTripZone(db, [day(OSLO_HOTEL)])).toBeNull()
  })

  it('has no zone when the place records a country the airport is not in', async () => {
    await stock(OSLO_AIRPORT)

    expect(await deriveTripZone(db, [day(OSLO_HOTEL, 'SE')])).toBeNull()
  })

  it('takes the zone when the place records the airport’s own country, in either case', async () => {
    await stock(OSLO_AIRPORT)

    expect(await deriveTripZone(db, [day(OSLO_HOTEL, 'NO')])).toBe(
      'Europe/Oslo',
    )
    expect(await deriveTripZone(db, [day(OSLO_HOTEL, 'no')])).toBe(
      'Europe/Oslo',
    )
  })

  it('does not cross a border: a place in its own country resolves within it', async () => {
    // Gdańsk-side hotel, a Polish airport nearer than a Russian one across the line.
    await stock(
      {
        id: 'apt_gdn',
        iataCode: 'GDN',
        name: 'Gdańsk',
        countryCode: 'PL',
        timezone: 'Europe/Warsaw',
        lat: 54.3776,
        lng: 18.4662,
      },
      {
        id: 'apt_kgd',
        iataCode: 'KGD',
        name: 'Kaliningrad',
        countryCode: 'RU',
        timezone: null,
        lat: 54.89,
        lng: 20.59,
      },
    )
    const hotel = { lat: 54.4, lng: 18.6 }

    expect(await deriveTripZone(db, [day(hotel, 'PL')])).toBe('Europe/Warsaw')
    expect(
      await deriveTripZone(db, [day({ lat: 54.85, lng: 20.4 }, 'PL')]),
    ).toBeNull()
  })

  it('has no zone for a name Intl does not accept', async () => {
    await stock({ ...OSLO_AIRPORT, timezone: 'Mars/Olympus_Mons' })

    expect(await deriveTripZone(db, [day(OSLO_HOTEL)])).toBeNull()
  })
})
