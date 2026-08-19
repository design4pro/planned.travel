import { describe, expect, it } from 'vitest'

import {
  PMTILES_HEADER_LENGTH,
  PMTILES_TILE_TYPE_MVT,
  coverageFor,
  isGlobalArchive,
  parsePmtilesHeader,
} from '../coverage'
import { REGIONAL_BOUNDS, pmtilesHeaderBytes } from './archive-fixture'

import type { LngLat, MapBounds } from '../bounds'

/** The corridor the published archive is cut to. */
const REGION: MapBounds = {
  west: 134.2,
  south: 33.6,
  east: 140.9,
  north: 36.8,
}

const TOKYO: LngLat = [139.6917, 35.6895]
const KYOTO: LngLat = [135.7681, 35.0116]
const LISBON: LngLat = [-9.1393, 38.7223]

function bytes(options: Parameters<typeof pmtilesHeaderBytes>[0] = {}) {
  return new Uint8Array(pmtilesHeaderBytes(options))
}

describe('parsePmtilesHeader', () => {
  it('reads the bounding box the archive was built with', () => {
    const header = parsePmtilesHeader(
      bytes({ bounds: REGIONAL_BOUNDS, minZoom: 0, maxZoom: 14 }),
    )

    expect(header).not.toBeNull()
    expect(header?.bounds).toEqual(REGION)
    expect(header?.minZoom).toBe(0)
    expect(header?.maxZoom).toBe(14)
    expect(header?.tileType).toBe(PMTILES_TILE_TYPE_MVT)
  })

  it('round-trips a negative bounding box, which is where a sign error would hide', () => {
    const header = parsePmtilesHeader(
      bytes({ bounds: [-73.2, -41.5, -70.8, -38.9] }),
    )
    expect(header?.bounds).toEqual({
      west: -73.2,
      south: -41.5,
      east: -70.8,
      north: -38.9,
    })
  })

  it('keeps the archive centre, so a caller can open where the data is', () => {
    const header = parsePmtilesHeader(
      bytes({ center: [137.55, 35.2], centerZoom: 7 }),
    )
    expect(header?.center).toEqual([137.55, 35.2])
    expect(header?.centerZoom).toBe(7)
  })

  it('refuses anything that is not a v3 archive', () => {
    expect(parsePmtilesHeader(bytes({ specVersion: 2 }))).toBeNull()
    expect(parsePmtilesHeader(bytes({ specVersion: 4 }))).toBeNull()
    expect(parsePmtilesHeader(new Uint8Array(PMTILES_HEADER_LENGTH))).toBeNull()
  })

  it('refuses a truncated header rather than reading past the buffer', () => {
    expect(parsePmtilesHeader(bytes({ length: 8 }))).toBeNull()
    expect(parsePmtilesHeader(bytes({ length: 126 }))).toBeNull()
    expect(parsePmtilesHeader(new Uint8Array(0))).toBeNull()
  })

  it('reads an unstated bounding box as the whole world, not as nothing', () => {
    const header = parsePmtilesHeader(bytes({ bounds: [0, 0, 0, 0] }))
    expect(header?.bounds).toEqual({
      west: -180,
      south: -90,
      east: 180,
      north: 90,
    })
    expect(isGlobalArchive(header?.bounds ?? REGION)).toBe(true)
  })

  it('parses correctly from a view into a larger buffer', () => {
    // A ranged fetch can hand back a slice, and a `DataView` built without the
    // byte offset would silently read the wrong bytes.
    const padded = new Uint8Array(PMTILES_HEADER_LENGTH + 16)
    padded.set(bytes({ bounds: REGIONAL_BOUNDS }), 16)
    const view = padded.subarray(16)
    expect(parsePmtilesHeader(view)?.bounds).toEqual(REGION)
  })
})

describe('isGlobalArchive', () => {
  it('recognises a planet build however its poles are rounded', () => {
    expect(
      isGlobalArchive({ west: -180, south: -85, east: 180, north: 85 }),
    ).toBe(true)
    expect(
      isGlobalArchive({
        west: -180,
        south: -85.051_128,
        east: 180,
        north: 85.051_128,
      }),
    ).toBe(true)
  })

  it('does not mistake a wide regional cut for the planet', () => {
    expect(isGlobalArchive(REGION)).toBe(false)
    // All of Europe: wide, but nowhere near global in latitude.
    expect(isGlobalArchive({ west: -25, south: 34, east: 45, north: 72 })).toBe(
      false,
    )
  })
})

describe('coverageFor', () => {
  it('says nothing at all when there is no header', () => {
    expect(coverageFor(null, [TOKYO])).toEqual({
      status: 'unknown',
      total: 0,
      inside: 0,
      outside: 0,
      bounds: null,
    })
  })

  it('covers a trip that sits inside the archive', () => {
    const report = coverageFor(REGION, [TOKYO, KYOTO])
    expect(report.status).toBe('covered')
    expect(report.inside).toBe(2)
    expect(report.outside).toBe(0)
  })

  it('reports a trip entirely outside the archive', () => {
    const report = coverageFor(REGION, [LISBON])
    expect(report.status).toBe('outside')
    expect(report.inside).toBe(0)
    expect(report.outside).toBe(1)
  })

  it('reports a split trip as partial, with the counts to say so', () => {
    const report = coverageFor(REGION, [TOKYO, KYOTO, LISBON])
    expect(report).toMatchObject({
      status: 'partial',
      total: 3,
      inside: 2,
      outside: 1,
    })
  })

  it('treats a trip with no coordinates as covered — nothing can be missing', () => {
    expect(coverageFor(REGION, []).status).toBe('covered')
    expect(coverageFor(REGION, []).total).toBe(0)
  })

  it('ignores coordinates that are not coordinates', () => {
    const broken = [
      [Number.NaN, 35] as const,
      [139.7, 200] as const,
      TOKYO,
    ] satisfies ReadonlyArray<LngLat>
    const report = coverageFor(REGION, broken)
    expect(report.total).toBe(1)
    expect(report.status).toBe('covered')
  })

  it('short-circuits a planet archive without testing a point against it', () => {
    const planet: MapBounds = {
      west: -180,
      south: -85,
      east: 180,
      north: 85,
    }
    const report = coverageFor(planet, [TOKYO, LISBON])
    expect(report).toMatchObject({ status: 'covered', total: 2, outside: 0 })
  })

  it('counts a point on the boundary as inside', () => {
    expect(coverageFor(REGION, [[REGION.west, REGION.south]]).status).toBe(
      'covered',
    )
    expect(coverageFor(REGION, [[REGION.east, REGION.north]]).status).toBe(
      'covered',
    )
  })

  it('hands back the archive extent, so a caller can frame what is covered', () => {
    expect(coverageFor(REGION, [LISBON]).bounds).toEqual(REGION)
  })
})
