import { describe, expect, it } from 'vitest'

import {
  UNMAPPED_COUNTRY_CODES,
  UNMAPPED_TERRITORY_CODES,
  countryBounds,
  countryFeatures,
  hasCountryOutline,
  worldLandFeatures,
} from '../countries'
import { worldOutlines } from '../world'

import type { MapOptions } from 'maplibre-gl'

/**
 * The `data` a MapLibre `geojson` source accepts, recovered from the option type
 * MapLibre does export — the same trick `../style` uses, because the style-spec
 * vocabulary is not re-exported.
 */
type GeoJsonSourceData = NonNullable<
  Extract<
    NonNullable<
      Exclude<NonNullable<MapOptions['style']>, string>['sources']
    >[string],
    { type: 'geojson' }
  >['data']
>

/** Every officially-assigned ISO2 code the bundled geometry cannot fill. */
const UNMAPPED_CODES = [...UNMAPPED_COUNTRY_CODES, ...UNMAPPED_TERRITORY_CODES]

describe('countryFeatures', () => {
  it('emits exactly one identified feature per bundled country', () => {
    const { type, features } = countryFeatures()
    const outlines = worldOutlines()

    expect(type).toBe('FeatureCollection')
    expect(features.length).toBe(outlines.size)
    expect(features.length).toBeGreaterThanOrEqual(174)

    const codes = new Set<string>()
    for (const feature of features) {
      expect(feature.type).toBe('Feature')
      // The id is what `setFeatureState` addresses; the property is what a paint
      // expression reads. They must never drift apart.
      expect(feature.id).toBe(feature.properties.code)
      expect(feature.properties.code).toMatch(/^[A-Z]{2}$/)
      expect(outlines.has(feature.properties.code)).toBe(true)
      codes.add(feature.properties.code)
    }
    expect(codes.size).toBe(features.length)
  })

  it('builds once and hands back the same instance', () => {
    expect(countryFeatures()).toBe(countryFeatures())
  })

  it('closes every ring so a fill has no seam', () => {
    for (const feature of countryFeatures().features) {
      const { code } = feature.properties
      expect(feature.geometry.type, code).toBe('MultiPolygon')
      expect(feature.geometry.coordinates.length, code).toBeGreaterThan(0)
      for (const polygon of feature.geometry.coordinates) {
        // One outer ring per polygon: a second ring would read as a hole and
        // punch an island out of its own country.
        expect(polygon.length, code).toBe(1)
        const ring = polygon[0]
        expect(ring.length, code).toBeGreaterThanOrEqual(4)
        const first = ring[0]
        const last = ring[ring.length - 1]
        expect(first[0], code).toBe(last[0])
        expect(first[1], code).toBe(last[1])
      }
    }
  })

  it('keeps every coordinate inside the coordinate system', () => {
    for (const feature of countryFeatures().features) {
      const { code } = feature.properties
      for (const polygon of feature.geometry.coordinates) {
        for (const ring of polygon) {
          for (const [lng, lat] of ring) {
            expect(Number.isFinite(lng), code).toBe(true)
            expect(lng, code).toBeGreaterThanOrEqual(-180)
            expect(lng, code).toBeLessThanOrEqual(180)
            expect(lat, code).toBeGreaterThanOrEqual(-90)
            expect(lat, code).toBeLessThanOrEqual(90)
          }
        }
      }
    }
  })

  it('carries the countries a tracker actually needs', () => {
    const codes = new Set(
      countryFeatures().features.map((feature) => feature.properties.code),
    )
    for (const code of ['GB', 'FR', 'IT', 'ES', 'PT', 'JP', 'US', 'AR']) {
      expect(codes.has(code), code).toBe(true)
    }
  })

  it('is a payload MapLibre will take as a geojson source', () => {
    const data: GeoJsonSourceData = countryFeatures()
    expect(data).toBe(countryFeatures())
  })
})

describe('worldLandFeatures', () => {
  it('merges every country into one anonymous feature', () => {
    const { type, features } = worldLandFeatures()

    expect(type).toBe('FeatureCollection')
    expect(features.length).toBe(1)
    expect(features[0].geometry.type).toBe('MultiPolygon')
    expect(Object.keys(features[0].properties)).toEqual([])
  })

  it('holds one polygon per drawable ring', () => {
    const expected = countryFeatures().features.reduce(
      (total, feature) => total + feature.geometry.coordinates.length,
      0,
    )
    expect(worldLandFeatures().features[0].geometry.coordinates.length).toBe(
      expected,
    )
  })

  it('shares its rings with the per-country view instead of copying them', () => {
    // The whole point of the second view: 285 references, not another 8,937
    // coordinate pairs retained for the life of the tab.
    const polygons = new Set(
      worldLandFeatures().features[0].geometry.coordinates,
    )
    for (const feature of countryFeatures().features) {
      for (const polygon of feature.geometry.coordinates) {
        expect(polygons.has(polygon), feature.properties.code).toBe(true)
      }
    }
  })

  it('builds once and hands back the same instance', () => {
    expect(worldLandFeatures()).toBe(worldLandFeatures())
  })

  it('is a payload MapLibre will take as a geojson source', () => {
    const data: GeoJsonSourceData = worldLandFeatures()
    expect(data).toBe(worldLandFeatures())
  })
})

describe('countryBounds', () => {
  it('frames an ordinary country tightly', () => {
    const bounds = countryBounds('JP')
    expect(bounds).not.toBeNull()
    if (bounds === null) return
    expect(bounds.west).toBeCloseTo(129.41, 2)
    expect(bounds.east).toBeCloseTo(145.54, 2)
    expect(bounds.south).toBeCloseTo(31.03, 2)
    expect(bounds.north).toBeCloseTo(45.55, 2)
  })

  it('does not open onto the whole planet at the antimeridian', () => {
    // The naive minimum and maximum of pre-cut rings is -180…180 for all three.
    for (const code of ['RU', 'FJ', 'NZ']) {
      const bounds = countryBounds(code)
      expect(bounds, code).not.toBeNull()
      if (bounds === null) continue
      expect(bounds.west, code).toBeGreaterThan(-180)
      expect(bounds.east - bounds.west, code).toBeLessThan(180)
      expect(bounds.east, code).toBeGreaterThan(bounds.west)
    }
  })

  it('lets the eastern edge run past 180 for a crossing country', () => {
    const russia = countryBounds('RU')
    expect(russia).not.toBeNull()
    if (russia === null) return
    expect(russia.west).toBeCloseTo(19.66, 2)
    expect(russia.east).toBeCloseTo(190.1, 2)

    const fiji = countryBounds('FJ')
    expect(fiji).not.toBeNull()
    if (fiji === null) return
    expect(fiji.west).toBeCloseTo(177.29, 2)
    expect(fiji.east).toBeCloseTo(180.21, 2)
  })

  it('keeps New Zealand west of the line it never crosses', () => {
    const bounds = countryBounds('NZ')
    expect(bounds).not.toBeNull()
    if (bounds === null) return
    expect(bounds.west).toBeGreaterThan(160)
    expect(bounds.east).toBeLessThan(180)
    expect(bounds.north).toBeLessThan(0)
  })

  it('clamps a polar country to what Mercator can draw', () => {
    const bounds = countryBounds('AQ')
    expect(bounds).not.toBeNull()
    if (bounds === null) return
    expect(bounds.south).toBeGreaterThan(-90)
  })

  it('is case insensitive and memoised per code', () => {
    expect(countryBounds('jp')).toBe(countryBounds('JP'))
  })

  it('resolves every bundled code and nothing else', () => {
    for (const code of worldOutlines().keys()) {
      expect(countryBounds(code), code).not.toBeNull()
    }
    for (const code of UNMAPPED_CODES) {
      expect(countryBounds(code), code).toBeNull()
    }
  })

  it('is null for a code the geometry does not carry', () => {
    expect(countryBounds('ZZ')).toBeNull()
    expect(countryBounds('SG')).toBeNull()
  })

  it('answers hostile input without remembering it', () => {
    // The table is built from `worldOutlines()`, never from the argument, so a
    // search box typing into this cannot grow anything.
    const before = countryBounds('JP')
    for (let index = 0; index < 500; index += 1) {
      expect(countryBounds(`unknown-${index}`)).toBeNull()
    }
    expect(countryBounds('')).toBeNull()
    expect(countryBounds('JP')).toBe(before)
  })
})

describe('hasCountryOutline', () => {
  it('agrees with what the features actually carry', () => {
    for (const feature of countryFeatures().features) {
      expect(hasCountryOutline(feature.properties.code)).toBe(true)
    }
    for (const code of UNMAPPED_CODES) {
      expect(hasCountryOutline(code), code).toBe(false)
    }
  })

  it('is case insensitive and safe for any string', () => {
    expect(hasCountryOutline('jp')).toBe(true)
    expect(hasCountryOutline('sg')).toBe(false)
    expect(hasCountryOutline('')).toBe(false)
    expect(hasCountryOutline('not a code')).toBe(false)
  })
})

describe('unmapped code lists', () => {
  it('name only codes the bundled geometry really lacks', () => {
    const outlines = worldOutlines()
    for (const code of UNMAPPED_CODES) {
      expect(code).toMatch(/^[A-Z]{2}$/)
      expect(outlines.has(code), code).toBe(false)
    }
  })

  it('are sorted sets with no duplicates and no overlap', () => {
    for (const list of [UNMAPPED_COUNTRY_CODES, UNMAPPED_TERRITORY_CODES]) {
      expect([...list]).toEqual([...list].sort())
      expect(new Set(list).size).toBe(list.length)
    }
    expect(new Set(UNMAPPED_CODES).size).toBe(UNMAPPED_CODES.length)
  })

  it('cover the states a traveller can plausibly visit and we cannot draw', () => {
    for (const code of ['SG', 'MT', 'MV', 'MC', 'BH', 'MU']) {
      expect(UNMAPPED_COUNTRY_CODES).toContain(code)
    }
    // Pinned: the list is the difference between the 195 states the tracker
    // counts and the 166 of them Natural Earth's 1:110m cut keeps. Growing it
    // silently would mean a visited country vanished from the map instead.
    expect(UNMAPPED_COUNTRY_CODES.length).toBe(29)
  })

  it('cover the territories a traveller can plausibly visit too', () => {
    // The gap the sovereign list alone leaves open: ordinary holidays.
    for (const code of ['HK', 'GP', 'RE', 'KY', 'GU', 'FO', 'VI', 'MO']) {
      expect(UNMAPPED_TERRITORY_CODES).toContain(code)
    }
    // The territories the 1:110m cut *does* keep must not be listed as missing.
    for (const code of ['GL', 'PR', 'NC', 'FK', 'TF', 'EH', 'PS']) {
      expect(UNMAPPED_TERRITORY_CODES).not.toContain(code)
      expect(hasCountryOutline(code), code).toBe(true)
    }
    expect(UNMAPPED_TERRITORY_CODES.length).toBe(46)
  })

  it('account for every officially-assigned ISO2 code', () => {
    // 249 officially-assigned alpha-2 codes; the bundled geometry draws 174 of
    // them plus the user-assigned XK for Kosovo. If either list drifts, this is
    // the sum that stops adding up.
    const drawn = [...worldOutlines().keys()].filter((code) => code !== 'XK')
    expect(drawn.length + UNMAPPED_CODES.length).toBe(249)
  })
})
