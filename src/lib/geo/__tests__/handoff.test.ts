import { describe, expect, it } from 'vitest'

import {
  GOOGLE_DIRECTIONS_MAX_STOPS,
  GOOGLE_DIRECTIONS_MAX_WAYPOINTS,
  MAP_SERVICE_NAME,
  dayHandoff,
  pointLink,
} from '../handoff'

/**
 * The map hand-off: the link a stop or a day offers into the map application the reader
 * navigates with.
 *
 * The builder is pure, so everything the controls rely on is claimed here: the exact
 * URL shape of each documented format, that the coordinates reuse `formatCoordinate`,
 * that an unplaced stop never reaches a URL or shifts the others, and that a day over
 * the waypoint limit says how much it carries instead of dropping stops silently.
 */

const FUSHIMI = { lat: 34.9671, lng: 135.7727 }
const KINKAKUJI = { lat: 35.0394, lng: 135.7292 }
const ARASHIYAMA = { lat: 35.0094, lng: 135.6668 }
const UNPLACED = { lat: null, lng: null }

/** A day of `count` placed stops, each at its own whole-degree latitude. */
function stopsOf(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    lat: index + 1,
    lng: 10,
  }))
}

describe('pointLink — one position, in either named service', () => {
  it('builds the documented Google Maps search URL', () => {
    expect(pointLink('google', FUSHIMI)).toBe(
      'https://www.google.com/maps/search/?api=1&query=34.9671%2C135.7727',
    )
  })

  it('builds an OpenStreetMap link that marks the point and centres on it', () => {
    expect(pointLink('openstreetmap', FUSHIMI)).toBe(
      'https://www.openstreetmap.org/?mlat=34.9671&mlon=135.7727#map=17/34.9671/135.7727',
    )
  })

  it('writes negative halves with a minus sign and a dot', () => {
    const link = pointLink('google', { lat: -33.8568, lng: -151.2153 })
    expect(link).toContain('query=-33.8568%2C-151.2153')
  })

  it('never writes exponent notation or a trailing zero', () => {
    const link = pointLink('google', { lat: 0.0000001, lng: 12.5 })
    expect(link).toContain('query=0%2C12.5')
    expect(link).not.toMatch(/e[+-]?\d/i)
  })

  it('names its services as data, not as translated copy', () => {
    expect(MAP_SERVICE_NAME).toEqual({
      google: 'Google Maps',
      openstreetmap: 'OpenStreetMap',
    })
  })
})

describe('dayHandoff — the day, in visiting order', () => {
  it('offers nothing for a day with no placed stop', () => {
    expect(dayHandoff([])).toBeNull()
    expect(dayHandoff([UNPLACED, UNPLACED])).toBeNull()
  })

  it('offers a point link, not directions, for exactly one placed stop', () => {
    expect(dayHandoff([UNPLACED, FUSHIMI, UNPLACED])).toEqual({
      kind: 'point',
      href: pointLink('google', FUSHIMI),
      carried: 1,
      total: 1,
    })
  })

  it('offers directions from the first stop to the last for two', () => {
    const handoff = dayHandoff([FUSHIMI, KINKAKUJI])
    expect(handoff).toEqual({
      kind: 'directions',
      href: 'https://www.google.com/maps/dir/?api=1&origin=34.9671%2C135.7727&destination=35.0394%2C135.7292',
      carried: 2,
      total: 2,
    })
  })

  it('carries the middle stops as pipe-separated waypoints, in order', () => {
    const handoff = dayHandoff([FUSHIMI, KINKAKUJI, ARASHIYAMA])
    expect(handoff?.href).toBe(
      'https://www.google.com/maps/dir/?api=1&origin=34.9671%2C135.7727&destination=35.0094%2C135.6668&waypoints=35.0394%2C135.7292',
    )

    const four = dayHandoff([FUSHIMI, KINKAKUJI, ARASHIYAMA, FUSHIMI])
    const waypoints = new URL(four?.href ?? '').searchParams.get('waypoints')
    expect(waypoints).toBe('35.0394,135.7292|35.0094,135.6668')
    expect(four?.href).toContain('waypoints=35.0394%2C135.7292%7C35.0094')
  })

  it('skips a stop without coordinates without shifting the others', () => {
    const withGap = dayHandoff([
      FUSHIMI,
      UNPLACED,
      KINKAKUJI,
      { lat: 35.1, lng: null },
      ARASHIYAMA,
    ])
    expect(withGap).toEqual(dayHandoff([FUSHIMI, KINKAKUJI, ARASHIYAMA]))
    expect(withGap?.total).toBe(3)
  })

  it('keeps visiting order across the antimeridian', () => {
    const handoff = dayHandoff([
      { lat: -17.7, lng: 179.9 },
      { lat: -16.8, lng: -179.9 },
    ])
    const params = new URL(handoff?.href ?? '').searchParams
    expect(params.get('origin')).toBe('-17.7,179.9')
    expect(params.get('destination')).toBe('-16.8,-179.9')
  })
})

describe('dayHandoff — the waypoint limit', () => {
  it('pins the limit that holds on a phone, where the pavement is', () => {
    // developers.google.com/maps/documentation/urls/get-started, "waypoints": up to three
    // on mobile browsers, nine elsewhere. One link serves both, so the lower figure rules.
    expect(GOOGLE_DIRECTIONS_MAX_WAYPOINTS).toBe(3)
    expect(GOOGLE_DIRECTIONS_MAX_STOPS).toBe(5)
  })

  it('carries exactly the maximum without saying it left anything out', () => {
    const handoff = dayHandoff(stopsOf(GOOGLE_DIRECTIONS_MAX_STOPS))
    expect(handoff).toMatchObject({
      kind: 'directions',
      carried: GOOGLE_DIRECTIONS_MAX_STOPS,
      total: GOOGLE_DIRECTIONS_MAX_STOPS,
    })
    const params = new URL(handoff?.href ?? '').searchParams
    expect(params.get('waypoints')?.split('|')).toHaveLength(
      GOOGLE_DIRECTIONS_MAX_WAYPOINTS,
    )
  })

  it('carries the first stops in order and counts the rest when one over', () => {
    const handoff = dayHandoff(stopsOf(GOOGLE_DIRECTIONS_MAX_STOPS + 1))
    expect(handoff).toMatchObject({
      kind: 'directions',
      carried: GOOGLE_DIRECTIONS_MAX_STOPS,
      total: GOOGLE_DIRECTIONS_MAX_STOPS + 1,
    })
    const params = new URL(handoff?.href ?? '').searchParams
    expect(params.get('origin')).toBe('1,10')
    expect(params.get('waypoints')).toBe('2,10|3,10|4,10')
    expect(params.get('destination')).toBe('5,10')
  })

  it('counts placed stops only, so unplaced ones never use up the allowance', () => {
    const handoff = dayHandoff([
      UNPLACED,
      ...stopsOf(GOOGLE_DIRECTIONS_MAX_STOPS),
      UNPLACED,
    ])
    expect(handoff).toMatchObject({
      carried: GOOGLE_DIRECTIONS_MAX_STOPS,
      total: GOOGLE_DIRECTIONS_MAX_STOPS,
    })
  })
})
