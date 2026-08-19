import { describe, expect, it } from 'vitest'

import {
  EMPTY_ROUTES,
  distanceMetres,
  routeCollection,
  routeLengthMetres,
  tripLengthMetres,
} from '../routes'

import type { LngLat } from '../bounds'
import type { RouteDay } from '../routes'

const SENSOJI: LngLat = [139.7966, 35.7148]
const SKYTREE: LngLat = [139.8107, 35.7101]
const SHIBUYA: LngLat = [139.7004, 35.6595]

describe('routeCollection', () => {
  it('draws one line per day, never one line for the trip', () => {
    const days: ReadonlyArray<RouteDay> = [
      { dayNumber: 1, points: [SENSOJI, SKYTREE] },
      { dayNumber: 2, points: [SHIBUYA, SENSOJI] },
    ]
    const collection = routeCollection(days)

    expect(collection.features).toHaveLength(2)
    expect(collection.features.map((feature) => feature.properties.day)).toEqual(
      [1, 2],
    )
  })

  it('orders features chronologically whatever order it is handed', () => {
    const collection = routeCollection([
      { dayNumber: 3, points: [SENSOJI, SKYTREE] },
      { dayNumber: 1, points: [SHIBUYA, SENSOJI] },
    ])
    expect(collection.features.map((feature) => feature.id)).toEqual([1, 3])
  })

  it('keeps the stop order it was given — the day is walked in that order', () => {
    const [feature] = routeCollection([
      { dayNumber: 1, points: [SHIBUYA, SENSOJI, SKYTREE] },
    ]).features
    expect(feature.geometry.coordinates).toEqual([
      [139.7004, 35.6595],
      [139.7966, 35.7148],
      [139.8107, 35.7101],
    ])
    expect(feature.properties.legs).toBe(2)
  })

  it('draws nothing for a day with one stop — a single stop has no route', () => {
    expect(routeCollection([{ dayNumber: 1, points: [SENSOJI] }]).features).toEqual(
      [],
    )
    expect(routeCollection([{ dayNumber: 1, points: [] }]).features).toEqual([])
  })

  it('collapses repeated coordinates, so two stops in one building draw no stub', () => {
    const [feature] = routeCollection([
      { dayNumber: 1, points: [SENSOJI, SENSOJI, SKYTREE] },
    ]).features
    expect(feature.geometry.coordinates).toHaveLength(2)
    expect(feature.properties.legs).toBe(1)
  })

  it('drops a day whose stops all share one coordinate', () => {
    expect(
      routeCollection([{ dayNumber: 1, points: [SENSOJI, SENSOJI] }]).features,
    ).toEqual([])
  })

  it('skips coordinates that are not coordinates', () => {
    const [feature] = routeCollection([
      {
        dayNumber: 1,
        points: [SENSOJI, [Number.POSITIVE_INFINITY, 35], SKYTREE],
      },
    ]).features
    expect(feature.geometry.coordinates).toHaveLength(2)
  })

  it('is valid, empty GeoJSON for an empty itinerary', () => {
    expect(routeCollection([])).toEqual(EMPTY_ROUTES)
    expect(EMPTY_ROUTES.type).toBe('FeatureCollection')
  })
})

describe('distances', () => {
  it('measures a known short hop to within a per-cent', () => {
    // Sensō-ji to Tokyo Skytree is about 1.3km on the ground.
    const metres = distanceMetres(SENSOJI, SKYTREE)
    expect(metres).toBeGreaterThan(1_250)
    expect(metres).toBeLessThan(1_400)
  })

  it('is zero for a point measured against itself', () => {
    expect(distanceMetres(SENSOJI, SENSOJI)).toBe(0)
  })

  it('is symmetric', () => {
    expect(distanceMetres(SENSOJI, SHIBUYA)).toBeCloseTo(
      distanceMetres(SHIBUYA, SENSOJI),
      6,
    )
  })

  it('sums a day as the walk between its stops in order', () => {
    const direct = routeLengthMetres([SHIBUYA, SKYTREE])
    const viaSensoji = routeLengthMetres([SHIBUYA, SENSOJI, SKYTREE])
    // The triangle inequality: detouring is never shorter.
    expect(viaSensoji).toBeGreaterThan(direct)
  })

  it('measures nothing for a day that cannot be walked', () => {
    expect(routeLengthMetres([])).toBe(0)
    expect(routeLengthMetres([SENSOJI])).toBe(0)
  })

  it('adds the days up for the trip', () => {
    const days: ReadonlyArray<RouteDay> = [
      { dayNumber: 1, points: [SENSOJI, SKYTREE] },
      { dayNumber: 2, points: [SHIBUYA, SENSOJI] },
    ]
    expect(tripLengthMetres(days)).toBeCloseTo(
      routeLengthMetres(days[0].points) + routeLengthMetres(days[1].points),
      6,
    )
  })
})
