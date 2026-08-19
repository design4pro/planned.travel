/**
 * The line a day is actually walked along.
 *
 * The reference planner draws pins and nothing else, which leaves the reader to
 * infer the order of a day from a numbered badge on each pin — a puzzle rather
 * than an answer. Joining the stops of one day in visiting order turns the map
 * into the shape of the day: where it doubles back, which stop is the outlier,
 * how much of it is one walk.
 *
 * One line per day, never one line for the trip: joining the last stop of Tuesday
 * to the first stop of Wednesday would draw an overnight as if it were a stroll.
 *
 * Pure geometry — the GeoJSON goes straight to a MapLibre `geojson` source, and
 * this module never touches the map.
 */

import { isValidLngLat } from './bounds'

import type { LngLat } from './bounds'

/** A day's stops in the order they are visited. */
export interface RouteDay {
  /** 1-based itinerary day. Becomes the feature's `day` property. */
  readonly dayNumber: number
  /** Stop coordinates, already in visiting order. */
  readonly points: ReadonlyArray<LngLat>
}

export interface RouteFeature {
  readonly type: 'Feature'
  readonly id: number
  readonly geometry: {
    readonly type: 'LineString'
    readonly coordinates: Array<[number, number]>
  }
  readonly properties: {
    readonly day: number
    /** Legs in this day's line — one fewer than its stops. */
    readonly legs: number
  }
}

export interface RouteCollection {
  readonly type: 'FeatureCollection'
  readonly features: Array<RouteFeature>
}

/** An empty collection, so a source can always be created before data arrives. */
export const EMPTY_ROUTES: RouteCollection = {
  type: 'FeatureCollection',
  features: [],
}

/**
 * Drops repeated coordinates.
 *
 * Two stops in the same building share a coordinate, and a zero-length segment
 * renders as a dot of line cap sitting on top of the pin — visible, meaningless,
 * and impossible to explain.
 */
function withoutRepeats(
  points: ReadonlyArray<LngLat>,
): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (const point of points) {
    if (!isValidLngLat(point)) continue
    const last = out.at(-1)
    if (last !== undefined && last[0] === point[0] && last[1] === point[1]) {
      continue
    }
    out.push([point[0], point[1]])
  }
  return out
}

/**
 * Turns the itinerary into one line per day.
 *
 * Days with fewer than two distinct coordinates produce no feature at all: a
 * single-stop day has no route, and an empty `LineString` is not valid GeoJSON.
 * Features are ordered by day number so the paint order is chronological.
 */
export function routeCollection(
  days: ReadonlyArray<RouteDay>,
): RouteCollection {
  const features: Array<RouteFeature> = []

  for (const day of [...days].sort((a, b) => a.dayNumber - b.dayNumber)) {
    const coordinates = withoutRepeats(day.points)
    if (coordinates.length < 2) continue
    features.push({
      type: 'Feature',
      // A numeric id is what lets MapLibre feature-state highlight one day's
      // line without rebuilding the source on every hover.
      id: day.dayNumber,
      geometry: { type: 'LineString', coordinates },
      properties: { day: day.dayNumber, legs: coordinates.length - 1 },
    })
  }

  return { type: 'FeatureCollection', features }
}

const EARTH_RADIUS_METRES = 6_371_008.8

/** Great-circle distance between two coordinates, in metres. */
export function distanceMetres(from: LngLat, to: LngLat): number {
  const toRadians = (value: number): number => (value * Math.PI) / 180
  const lat1 = toRadians(from[1])
  const lat2 = toRadians(to[1])
  const dLat = lat2 - lat1
  const dLng = toRadians(to[0] - from[0])
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Metres walked along one day's line.
 *
 * Straight-line distance between consecutive stops, which is the honest claim:
 * we have no routing engine, so this is a lower bound on the real walk and the
 * planner labels it as "between stops" rather than as a route length.
 */
export function routeLengthMetres(points: ReadonlyArray<LngLat>): number {
  const coordinates = withoutRepeats(points)
  let total = 0
  for (let index = 1; index < coordinates.length; index += 1) {
    total += distanceMetres(coordinates[index - 1], coordinates[index])
  }
  return total
}

/** Metres across every day of the trip. */
export function tripLengthMetres(days: ReadonlyArray<RouteDay>): number {
  let total = 0
  for (const day of days) total += routeLengthMetres(day.points)
  return total
}
