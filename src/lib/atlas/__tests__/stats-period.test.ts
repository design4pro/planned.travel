import { describe, expect, it } from 'vitest'
import { statsPeriod } from '../stats-period'

const lifetime = {
  tripCount: 9,
  placeCount: 80,
  cityCount: 20,
  countryCount: 12,
  dayCount: 90,
  distanceMetres: 9000,
}
const rows = [
  { ...lifetime, statYear: 0, yearStreak: 3 },
  { ...lifetime, statYear: 2013, yearStreak: 99, tripCount: 1 },
  { ...lifetime, statYear: 2014, yearStreak: 99, tripCount: 2 },
  {
    ...lifetime,
    statYear: 2015,
    yearStreak: 99,
    tripCount: 3,
    distanceMetres: 0,
  },
  { ...lifetime, statYear: 2027, yearStreak: 99, tripCount: 0 },
]

describe('the traveller’s statistics period', () => {
  it('offers only years with trips, newest first, after all time', () => {
    expect(statsPeriod(rows, 0).periods).toEqual([0, 2015, 2014, 2013])
  })
  it.each([
    [
      0,
      ['places', 'regions', 'visits', 'trips', 'cities', 'days', 'streak'],
      9,
      9000,
    ],
    [2015, ['places', 'trips', 'cities', 'days', 'countries'], 3, null],
  ])(
    'reads the right figures and tiles for %i',
    (year, tiles, trips, distance) => {
      const model = statsPeriod(rows, year)
      expect(model.tiles).toEqual(tiles)
      expect(model.row?.tripCount).toBe(trips)
      expect(model.distanceMetres).toBe(distance)
      expect(model.row).toMatchObject({
        placeCount: 80,
        cityCount: 20,
        countryCount: 12,
        dayCount: 90,
      })
    },
  )
  it('reads the stored streak only from all time and names its range', () => {
    expect(statsPeriod(rows, 0).streak).toEqual({
      count: 3,
      first: 2013,
      last: 2015,
    })
    expect(statsPeriod(rows, 2013).streak).toBeNull()
  })
  it.each([0, 1, 4])(
    'keeps a stored streak of %i ending at a future trip year',
    (count) => {
      const model = statsPeriod(
        [
          { ...lifetime, statYear: 0, yearStreak: count },
          { ...lifetime, statYear: 2027, yearStreak: 0 },
        ],
        0,
      )
      expect(model.streak).toEqual({ count, first: 2028 - count, last: 2027 })
    },
  )
  it('falls back to all time when the chosen year is gone or has no trips', () => {
    for (const year of [2026, 2027])
      expect(statsPeriod(rows, year).period).toBe(0)
    expect(statsPeriod([], 2015).periods).toEqual([0])
    expect(statsPeriod([], 0).streak?.count).toBe(0)
  })
})
