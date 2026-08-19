import { describe, expect, it } from 'vitest'

import { MAX_MERCATOR_LATITUDE, graticule } from '../graticule'

describe('graticule', () => {
  it('draws a 15 degree grid by default', () => {
    const collection = graticule()
    expect(collection.type).toBe('FeatureCollection')

    const meridians = collection.features.filter(
      (f) => f.properties.kind === 'meridian',
    )
    const parallels = collection.features.filter(
      (f) => f.properties.kind === 'parallel',
    )

    // -180 to 165 inclusive, in 15 degree steps: 24 meridians.
    expect(meridians).toHaveLength(24)
    // The equator plus 15..75 north and south: 11 parallels.
    expect(parallels).toHaveLength(11)
  })

  it('never draws the same meridian twice', () => {
    const longitudes = graticule()
      .features.filter((f) => f.properties.kind === 'meridian')
      .map((f) => f.properties.degrees)
    expect(new Set(longitudes).size).toBe(longitudes.length)
    expect(longitudes).toContain(-180)
    expect(longitudes).not.toContain(180)
  })

  it('stays inside what Web Mercator can draw', () => {
    for (const feature of graticule().features) {
      for (const [lng, lat] of feature.geometry.coordinates) {
        expect(lng).toBeGreaterThanOrEqual(-180)
        expect(lng).toBeLessThanOrEqual(180)
        expect(Math.abs(lat)).toBeLessThanOrEqual(MAX_MERCATOR_LATITUDE)
      }
    }
  })

  it('always emphasises the equator and the prime meridian', () => {
    const major = graticule().features.filter((f) => f.properties.major)
    expect(
      major.some(
        (f) => f.properties.kind === 'parallel' && f.properties.degrees === 0,
      ),
    ).toBe(true)
    expect(
      major.some(
        (f) => f.properties.kind === 'meridian' && f.properties.degrees === 0,
      ),
    ).toBe(true)
  })

  it('emphasises every 60 degrees by default', () => {
    const majorLongitudes = graticule()
      .features.filter(
        (f) => f.properties.kind === 'meridian' && f.properties.major,
      )
      .map((f) => f.properties.degrees)
      .sort((a, b) => a - b)
    expect(majorLongitudes).toEqual([-180, -120, -60, 0, 60, 120])
  })

  it('honours a coarser grid', () => {
    const collection = graticule({ step: 30, majorEvery: 3 })
    expect(
      collection.features.filter((f) => f.properties.kind === 'meridian'),
    ).toHaveLength(12)
    const majors = collection.features
      .filter((f) => f.properties.kind === 'meridian' && f.properties.major)
      .map((f) => f.properties.degrees)
    expect(majors).toEqual([-180, -90, 0, 90])
  })

  it('gives every line at least two vertices', () => {
    for (const feature of graticule().features) {
      expect(feature.geometry.coordinates.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('refuses a step it cannot iterate', () => {
    expect(() => graticule({ step: 0 })).toThrow(RangeError)
    expect(() => graticule({ step: -5 })).toThrow(RangeError)
    expect(() => graticule({ step: Number.NaN })).toThrow(RangeError)
  })
})
