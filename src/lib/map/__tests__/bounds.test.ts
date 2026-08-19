import { describe, expect, it } from 'vitest'

import {
  DEFAULT_FIT_PADDING,
  MAX_MERCATOR_LATITUDE,
  WORLD_BOUNDS,
  boundsCenter,
  boundsContains,
  boundsForPoints,
  boundsFromTuple,
  boundsKey,
  boundsSpan,
  boundsToTuple,
  clampLatitude,
  clampPadding,
  expandBounds,
  isValidLngLat,
  padBounds,
  resolvePadding,
  unionBounds,
  wrapLongitude,
} from '../bounds'

import type { LngLat } from '../bounds'

const KYOTO: LngLat = [135.7681, 35.0116]
const TOKYO: LngLat = [139.6917, 35.6895]
const HONOLULU: LngLat = [-157.8583, 21.3069]

describe('isValidLngLat', () => {
  it('accepts a well-formed pair', () => {
    expect(isValidLngLat(KYOTO)).toBe(true)
    expect(isValidLngLat([0, 0])).toBe(true)
  })

  it('rejects everything MapLibre would choke on', () => {
    expect(isValidLngLat(null)).toBe(false)
    expect(isValidLngLat([135])).toBe(false)
    expect(isValidLngLat([Number.NaN, 0])).toBe(false)
    expect(isValidLngLat([0, Number.POSITIVE_INFINITY])).toBe(false)
    expect(isValidLngLat([0, 91])).toBe(false)
    expect(isValidLngLat(['135', '35'])).toBe(false)
  })
})

describe('wrapLongitude', () => {
  it('normalises onto [-180, 180)', () => {
    expect(wrapLongitude(0)).toBe(0)
    expect(wrapLongitude(190)).toBe(-170)
    expect(wrapLongitude(-190)).toBe(170)
    expect(wrapLongitude(540)).toBe(-180)
    // The two forms of the antimeridian collapse to one.
    expect(wrapLongitude(180)).toBe(-180)
    expect(wrapLongitude(-180)).toBe(-180)
  })
})

describe('clampLatitude', () => {
  it('holds inside what Web Mercator can draw', () => {
    expect(clampLatitude(0)).toBe(0)
    expect(clampLatitude(90)).toBe(MAX_MERCATOR_LATITUDE)
    expect(clampLatitude(-90)).toBe(-MAX_MERCATOR_LATITUDE)
  })
})

describe('boundsForPoints', () => {
  it('returns null when there is nothing to frame', () => {
    expect(boundsForPoints([])).toBeNull()
    expect(boundsForPoints([[Number.NaN, 0]])).toBeNull()
  })

  it('skips invalid points instead of poisoning the rectangle', () => {
    const bounds = boundsForPoints([KYOTO, [Number.NaN, 12], TOKYO])
    expect(bounds).toEqual({
      west: 135.7681,
      south: 35.0116,
      east: 139.6917,
      north: 35.6895,
    })
  })

  it('collapses to a point for a single place', () => {
    const bounds = boundsForPoints([KYOTO])
    expect(bounds).toEqual({
      west: 135.7681,
      south: 35.0116,
      east: 135.7681,
      north: 35.0116,
    })
    expect(boundsSpan(bounds!)).toEqual({ lng: 0, lat: 0 })
  })

  it('crosses the antimeridian the short way', () => {
    const bounds = boundsForPoints([TOKYO, HONOLULU])
    expect(bounds).not.toBeNull()
    // 139.69 → 202.14 spans 62°, the Pacific hop. The naive answer would be
    // -157.86 → 139.69: 297° of the wrong way round the planet.
    expect(bounds!.west).toBeCloseTo(139.6917, 4)
    expect(bounds!.east).toBeCloseTo(202.1417, 4)
    expect(boundsSpan(bounds!).lng).toBeCloseTo(62.45, 2)
  })

  it('keeps the plain rectangle when it is already the shorter one', () => {
    const bounds = boundsForPoints([
      [-10, 40],
      [10, 50],
    ])
    expect(bounds).toEqual({ west: -10, south: 40, east: 10, north: 50 })
  })

  it('clamps latitudes it cannot draw', () => {
    const bounds = boundsForPoints([
      [0, 89],
      [10, -89],
    ])
    expect(bounds!.north).toBe(MAX_MERCATOR_LATITUDE)
    expect(bounds!.south).toBe(-MAX_MERCATOR_LATITUDE)
  })
})

describe('expandBounds', () => {
  it('gives a single place a neighbourhood of context', () => {
    const point = boundsForPoints([KYOTO])!
    const grown = expandBounds(point)
    expect(boundsSpan(grown).lng).toBeCloseTo(0.04, 6)
    expect(boundsSpan(grown).lat).toBeCloseTo(0.04, 6)
    expect(boundsCenter(grown)[0]).toBeCloseTo(KYOTO[0], 6)
    expect(boundsCenter(grown)[1]).toBeCloseTo(KYOTO[1], 6)
  })

  it('leaves a rectangle that is already big enough alone', () => {
    const wide = { west: 0, south: 0, east: 10, north: 10 }
    expect(expandBounds(wide)).toEqual(wide)
  })
})

describe('padBounds', () => {
  it('grows by a fraction of the current extent', () => {
    const padded = padBounds({ west: 0, south: 0, east: 10, north: 20 }, 0.1)
    expect(padded).toEqual({ west: -1, south: -2, east: 11, north: 22 })
  })
})

describe('unionBounds', () => {
  it('covers both inputs', () => {
    expect(
      unionBounds(
        { west: 0, south: 0, east: 5, north: 5 },
        { west: -2, south: 3, east: 3, north: 9 },
      ),
    ).toEqual({ west: -2, south: 0, east: 5, north: 9 })
  })
})

describe('boundsContains', () => {
  const bounds = { west: 135, south: 34, east: 140, north: 36 }

  it('tests a plain rectangle', () => {
    expect(boundsContains(bounds, KYOTO)).toBe(true)
    expect(boundsContains(bounds, HONOLULU)).toBe(false)
    expect(boundsContains(bounds, [137, 40])).toBe(false)
  })

  it('tests one that crosses the antimeridian', () => {
    const pacific = boundsForPoints([TOKYO, HONOLULU])!
    expect(boundsContains(pacific, TOKYO)).toBe(true)
    expect(boundsContains(pacific, HONOLULU)).toBe(true)
    expect(boundsContains(pacific, [0, 30])).toBe(false)
  })

  it('rejects an invalid point', () => {
    expect(boundsContains(bounds, [Number.NaN, 35])).toBe(false)
  })
})

describe('tuple round trip', () => {
  it('is lossless in MapLibre order', () => {
    const bounds = { west: 1, south: 2, east: 3, north: 4 }
    expect(boundsToTuple(bounds)).toEqual([
      [1, 2],
      [3, 4],
    ])
    expect(boundsFromTuple(boundsToTuple(bounds))).toEqual(bounds)
  })
})

describe('boundsKey', () => {
  it('is equal for equal values regardless of identity', () => {
    expect(boundsKey({ west: 1, south: 2, east: 3, north: 4 })).toBe(
      boundsKey({ west: 1, south: 2, east: 3, north: 4 }),
    )
    expect(boundsKey(null)).toBe('none')
    expect(boundsKey(WORLD_BOUNDS)).not.toBe('none')
  })

  it('ignores differences below the fifth decimal, which is a metre', () => {
    expect(boundsKey({ west: 1.000001, south: 2, east: 3, north: 4 })).toBe(
      boundsKey({ west: 1, south: 2, east: 3, north: 4 }),
    )
  })
})

describe('resolvePadding', () => {
  it('fills the edges the caller did not name', () => {
    expect(resolvePadding({ left: 360 })).toEqual({
      ...DEFAULT_FIT_PADDING,
      left: 360,
    })
    expect(resolvePadding()).toEqual(DEFAULT_FIT_PADDING)
  })
})

describe('clampPadding', () => {
  it('leaves padding that fits untouched', () => {
    const padding = { top: 48, right: 380, bottom: 48, left: 360 }
    expect(clampPadding(padding, { width: 1440, height: 900 })).toEqual(padding)
  })

  it('scales insets down proportionally on a phone', () => {
    // 320 + 40 = 360 of padding on a 360px-wide screen leaves nothing to draw.
    const clamped = clampPadding(
      { top: 16, right: 40, bottom: 16, left: 320 },
      {
        width: 360,
        height: 640,
      },
    )
    expect(clamped.left + clamped.right).toBeLessThanOrEqual(360 - 64)
    expect(clamped.left).toBeGreaterThan(clamped.right)
    // The vertical axis had room, so it is left as it was.
    expect(clamped.top).toBe(16)
    expect(clamped.bottom).toBe(16)
  })

  it('survives a container with no size at all', () => {
    const clamped = clampPadding(DEFAULT_FIT_PADDING, { width: 0, height: 0 })
    expect(clamped).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  })
})
