import { describe, expect, it } from 'vitest'

import { sunTimes } from '../sun'

/**
 * `sunTimes` against the NOAA Solar Calculator.
 *
 * Every expected time below was captured once by running the calculator's own published
 * JavaScript (`gml.noaa.gov/grad/solcalc/main.js`: `getJD` then `calcSunriseSet`, rounded to the
 * minute) for the coordinate, date and UTC offset of the row, and is frozen here. The code under
 * test is the real module with nothing replaced; the tolerance is the two minutes the acceptance
 * criteria allow.
 */

interface Fixture {
  readonly name: string
  readonly lat: number
  readonly lng: number
  readonly date: string
  readonly zone: string
  readonly sunrise: string
  readonly sunset: string
}

const FIXTURES: ReadonlyArray<Fixture> = [
  {
    name: 'Oslo, summer solstice',
    lat: 59.9139,
    lng: 10.7522,
    date: '2026-06-21',
    zone: 'Europe/Oslo',
    sunrise: '03:54',
    sunset: '22:44',
  },
  {
    name: 'Oslo, winter solstice',
    lat: 59.9139,
    lng: 10.7522,
    date: '2026-12-21',
    zone: 'Europe/Oslo',
    sunrise: '09:18',
    sunset: '15:12',
  },
  {
    name: 'Quito, September equinox',
    lat: -0.1807,
    lng: -78.4678,
    date: '2026-09-23',
    zone: 'America/Guayaquil',
    sunrise: '06:03',
    sunset: '18:09',
  },
  {
    name: 'Sydney, December solstice',
    lat: -33.8688,
    lng: 151.2093,
    date: '2026-12-21',
    zone: 'Australia/Sydney',
    sunrise: '05:41',
    sunset: '20:05',
  },
  {
    // The crossing is on the previous UTC day: the east of the date line.
    name: 'Tokyo, early March',
    lat: 35.6762,
    lng: 139.6503,
    date: '2026-03-01',
    zone: 'Asia/Tokyo',
    sunrise: '06:12',
    sunset: '17:36',
  },
  {
    // The crossings are on the next UTC day: the west of the Americas.
    name: 'Los Angeles, summer solstice',
    lat: 34.0522,
    lng: -118.2437,
    date: '2026-06-21',
    zone: 'America/Los_Angeles',
    sunrise: '05:42',
    sunset: '20:08',
  },
  {
    // A zone far east of its longitude's solar time: UTC+13 at 171.75 degrees west.
    name: 'Apia, December solstice',
    lat: -13.8333,
    lng: -171.75,
    date: '2026-12-21',
    zone: 'Pacific/Apia',
    sunrise: '05:57',
    sunset: '18:54',
  },
]

const minutes = (clock: string): number => {
  const [hours, mins] = clock.split(':').map(Number)
  return hours * 60 + mins
}

describe('sunTimes against the NOAA Solar Calculator', () => {
  it.each(FIXTURES)(
    'is within two minutes for $name',
    ({ lat, lng, date, zone, sunrise, sunset }) => {
      const times = sunTimes(lat, lng, date, zone)

      expect(times.sunrise).not.toBeNull()
      expect(times.sunset).not.toBeNull()
      expect(
        Math.abs(minutes(times.sunrise ?? '') - minutes(sunrise)),
      ).toBeLessThanOrEqual(2)
      expect(
        Math.abs(minutes(times.sunset ?? '') - minutes(sunset)),
      ).toBeLessThanOrEqual(2)
    },
  )
})

describe('a day the sun does not cross the horizon', () => {
  const TROMSO = { lat: 69.6492, lng: 18.9553, zone: 'Europe/Oslo' }

  it('has no sunrise at Tromsø in polar night', () => {
    const times = sunTimes(TROMSO.lat, TROMSO.lng, '2026-12-21', TROMSO.zone)

    expect(times.sunrise).toBeNull()
  })

  it('has no sunset at Tromsø in midnight sun', () => {
    const times = sunTimes(TROMSO.lat, TROMSO.lng, '2026-06-21', TROMSO.zone)

    expect(times.sunset).toBeNull()
  })

  it('has neither side at the south pole in the southern winter', () => {
    expect(sunTimes(-90, 0, '2026-06-21', 'UTC')).toEqual({
      sunrise: null,
      sunset: null,
    })
  })
})

describe('input that is not a place and a date', () => {
  it.each([
    ['a date that does not exist', 59.9, 10.7, '2026-02-31'],
    ['text for a date', 59.9, 10.7, 'tomorrow'],
    ['a latitude off the earth', 91, 10.7, '2026-06-21'],
    ['a longitude off the earth', 59.9, 181, '2026-06-21'],
    ['a latitude that is not a number', Number.NaN, 10.7, '2026-06-21'],
  ])('gives nothing for %s', (_name, lat, lng, date) => {
    expect(sunTimes(lat, lng, date, 'UTC')).toEqual({
      sunrise: null,
      sunset: null,
    })
  })

  it('reads a zone the platform does not know as UTC', () => {
    expect(sunTimes(59.9139, 10.7522, '2026-06-21', 'Not/AZone')).toEqual(
      sunTimes(59.9139, 10.7522, '2026-06-21', 'UTC'),
    )
  })

  it('writes midnight as 00, never 24', () => {
    const { sunset } = sunTimes(59.9139, 10.7522, '2026-06-21', 'UTC')

    expect(sunset).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/)
  })
})
