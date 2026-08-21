import { describe, expect, it } from 'vitest'

import {
  decodeOutlines,
  landPath,
  outlineFor,
  ringsToPath,
  worldOutlineCount,
  worldOutlines,
} from '../world'

import type { Projection } from '../world'

/** Plate carrée into a 360×180 box, so a degree is a unit and maths stays readable. */
const identity: Projection = (lng, lat) => [lng + 180, 90 - lat]

describe('worldOutlines', () => {
  it('carries the whole world, keyed by ISO alpha-2', () => {
    const outlines = worldOutlines()
    expect(worldOutlineCount()).toBeGreaterThan(160)
    for (const code of ['JP', 'PT', 'GB', 'US', 'AR', 'AU', 'ZA', 'IS']) {
      expect(outlines.get(code), code).toBeDefined()
    }
    for (const code of outlines.keys()) {
      expect(code).toMatch(/^[A-Z]{2}$/)
    }
  })

  it('decodes once and hands back the same instance', () => {
    expect(worldOutlines()).toBe(worldOutlines())
  })

  it('keeps every vertex inside the coordinate system', () => {
    for (const [code, outline] of worldOutlines()) {
      for (const ring of outline) {
        // Three vertices is the floor for an area; anything less is a stray line.
        expect(ring.length, code).toBeGreaterThanOrEqual(3)
        for (const [lng, lat] of ring) {
          expect(lng, code).toBeGreaterThanOrEqual(-180)
          expect(lng, code).toBeLessThanOrEqual(180)
          expect(lat, code).toBeGreaterThanOrEqual(-90)
          expect(lat, code).toBeLessThanOrEqual(90)
        }
      }
    }
  })

  it('puts each country roughly where it belongs', () => {
    const centre = (code: string) => {
      const rings = outlineFor(code)
      const points = rings.flat()
      const lng = points.reduce((sum, [x]) => sum + x, 0) / points.length
      const lat = points.reduce((sum, [, y]) => sum + y, 0) / points.length
      return { lng, lat }
    }

    const japan = centre('JP')
    expect(japan.lng).toBeGreaterThan(125)
    expect(japan.lng).toBeLessThan(150)
    expect(japan.lat).toBeGreaterThan(24)
    expect(japan.lat).toBeLessThan(46)

    const portugal = centre('PT')
    expect(portugal.lng).toBeLessThan(-6)
    expect(portugal.lat).toBeGreaterThan(36)

    const argentina = centre('AR')
    expect(argentina.lat).toBeLessThan(-20)
  })

  it('keeps an archipelago as separate rings', () => {
    // One ring would mean Honshu and Hokkaido had been joined by a land bridge.
    expect(outlineFor('JP').length).toBeGreaterThan(1)
  })

  it('is case insensitive and empty for a code it does not carry', () => {
    expect(outlineFor('jp')).toBe(outlineFor('JP'))
    expect(outlineFor('ZZ')).toEqual([])
  })
})

describe('ringsToPath', () => {
  it('emits one closed subpath per ring', () => {
    const path = ringsToPath(
      [
        [
          [0, 0],
          [10, 0],
          [10, 10],
        ],
        [
          [20, 20],
          [30, 20],
          [30, 30],
        ],
      ],
      identity,
      0,
    )
    expect(path).toBe('M180 90L190 90L190 80ZM200 70L210 70L210 60Z')
  })

  it('drops a ring that cannot enclose anything', () => {
    expect(
      ringsToPath(
        [
          [
            [0, 0],
            [1, 1],
          ],
        ],
        identity,
        0,
      ),
    ).toBe('')
  })

  it('collapses vertices that quantise onto the same point', () => {
    // Four vertices, three distinct after rounding, so the ring still draws.
    const path = ringsToPath(
      [
        [
          [0, 0],
          [0.1, 0],
          [10, 0],
          [10, 10],
        ],
      ],
      identity,
      0,
    )
    expect(path).toBe('M180 90L190 90L190 80Z')
  })

  it('honours the requested precision', () => {
    const rings = [
      [
        [0.123, 0],
        [10.456, 0],
        [10.456, 10.789],
      ],
    ] as const
    expect(ringsToPath([rings[0]], identity, 2)).toContain('180.12')
    expect(ringsToPath([rings[0]], identity, 0)).toContain('M180 90')
  })
})

describe('landPath', () => {
  it('returns only the geometry that can reach the window', () => {
    const japanWindow = {
      minLng: 128,
      maxLng: 146,
      minLat: 30,
      maxLat: 46,
    }
    const wholeWorld = {
      minLng: -180,
      maxLng: 180,
      minLat: -90,
      maxLat: 90,
    }
    const near = landPath(japanWindow, identity)
    const all = landPath(wholeWorld, identity)

    expect(near.length).toBeGreaterThan(0)
    // Culling has to be a real saving, not a rounding difference.
    expect(near.length).toBeLessThan(all.length / 5)
    expect(all.split('Z').length).toBeGreaterThan(near.split('Z').length)
  })

  it('is empty over open ocean', () => {
    // The South Pacific gyre: no land within thousands of kilometres.
    expect(
      landPath(
        { minLng: -130, maxLng: -125, minLat: -42, maxLat: -38 },
        identity,
      ),
    ).toBe('')
  })
})

describe('decodeOutlines', () => {
  it('walks deltas back into degrees, longitude first', () => {
    // Two rings for one country, the second starting from its own origin.
    const outlines = decodeOutlines('ZZ:0,0,100,0,0,100;500,500,100,0,0,100')
    expect([...outlines.keys()]).toEqual(['ZZ'])

    const [first, second] = outlines.get('ZZ') ?? []
    expect(first).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ])
    expect(second).toEqual([
      [5, 5],
      [6, 5],
      [6, 6],
    ])
  })

  it('reads the payload on the grid it is told about', () => {
    // The finer cut states its grid in its own manifest rather than assuming
    // this module's, so a future asset can change it without a second decoder.
    expect(decodeOutlines('ZZ:1,2,3,4', 1).get('ZZ')).toEqual([
      [
        [1, 2],
        [4, 6],
      ],
    ])
    expect(decodeOutlines('ZZ:1,2,3,4', 1000).get('ZZ')).toEqual([
      [
        [0.001, 0.002],
        [0.004, 0.006],
      ],
    ])
  })

  it('skips a malformed entry instead of inventing a country called nothing', () => {
    // One of the two payloads in this encoding arrives over the network.
    const outlines = decodeOutlines('|:1,2|ZZ:0,0,100,0,0,100|')
    expect([...outlines.keys()]).toEqual(['ZZ'])
  })

  it('drops a trailing coordinate rather than reading it as NaN', () => {
    const ring = decodeOutlines('ZZ:0,0,100,0,50').get('ZZ')?.[0] ?? []
    expect(ring).toEqual([
      [0, 0],
      [1, 0],
    ])
  })

  it('is what the bundled cut itself is decoded with', () => {
    // The claim that there is one decoder, not two: re-encoding a country from
    // the bundle and decoding it again lands on the same coordinates.
    const japan = outlineFor('JP')
    const encoded = japan
      .map((ring) => {
        const deltas: Array<number> = []
        let lastLng = 0
        let lastLat = 0
        for (const [lng, lat] of ring) {
          const x = Math.round(lng * 100)
          const y = Math.round(lat * 100)
          deltas.push(x - lastLng, y - lastLat)
          lastLng = x
          lastLat = y
        }
        return deltas.join(',')
      })
      .join(';')
    expect(decodeOutlines(`JP:${encoded}`).get('JP')).toEqual(japan)
  })
})
