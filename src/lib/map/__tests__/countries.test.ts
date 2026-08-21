import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import { COUNTRY_NAMES } from '#/lib/atlas/country-names'
import { MAX_MERCATOR_LATITUDE, boundsContains } from '../bounds'
import {
  COUNTRY_CODE_PROPERTY,
  COUNTRY_DETAIL_URL,
  COUNTRY_SOURCE_MAX_ZOOM,
  UNMAPPED_COUNTRY_CODES,
  UNMAPPED_TERRITORY_CODES,
  countryBounds,
  countryFeatures,
  countrySource,
  hasCountryOutline,
  parseCountryDetail,
  worldLandFeatures,
} from '../countries'
import { worldOutlines } from '../world'

import type { MapBounds } from '../bounds'
import type {
  CountryDetail,
  countryDetail,
  loadCountryDetail,
  subscribeCountryDetail,
} from '../countries'
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

/**
 * The slack a rectangle is allowed to miss its own geometry by.
 *
 * `boundsForPoints` solves longitude a second time with negative values shifted
 * east by 360°, and reconstructing an edge back through that shift costs about
 * 1e-14° of binary floating point. Outlines are quantised to 1e-2°, so a tenth
 * of a micro-degree — roughly a centimetre — is far below anything the bundled
 * geometry resolves and far above the drift, which is what makes this a
 * meaningful assertion rather than an indulgent one.
 */
const SOLVER_DRIFT = 1e-7

/** Every officially-assigned ISO2 code the bundled geometry cannot fill. */
const UNMAPPED_CODES = [...UNMAPPED_COUNTRY_CODES, ...UNMAPPED_TERRITORY_CODES]

/**
 * The finer cut as it is committed, read from disk rather than from the module.
 *
 * Every assertion about the shipped asset is made against these bytes, so a test
 * cannot pass by agreeing with a decoder that is itself wrong.
 */
const DETAIL_ASSET = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../..',
    `public${COUNTRY_DETAIL_URL}`,
  ),
  'utf8',
)

/** The ceiling the module's budget table states, in bytes. */
const DETAIL_BUDGET = { raw: 384 * 1024, gzip: 128 * 1024 }

/** The codes the shipped asset carries, parsed independently of the module. */
function detailCodes(): ReadonlyArray<string> {
  return DETAIL_ASSET.split('\n')[1]
    .split('|')
    .map((entry) => entry.slice(0, entry.indexOf(':')))
}

/**
 * The surface a fresh module instance is exercised through.
 *
 * Spelled out rather than taken from the module wholesale, because installing
 * the finer cut is module state and every test that does it needs an instance of
 * its own.
 */
interface CountriesModule {
  readonly countryBounds: typeof countryBounds
  readonly countryDetail: typeof countryDetail
  readonly countryFeatures: typeof countryFeatures
  readonly countrySource: typeof countrySource
  readonly hasCountryOutline: typeof hasCountryOutline
  readonly loadCountryDetail: typeof loadCountryDetail
  readonly subscribeCountryDetail: typeof subscribeCountryDetail
  readonly worldLandFeatures: typeof worldLandFeatures
}

/** A module instance of its own, so installing the finer cut cannot leak. */
async function freshCountries(): Promise<CountriesModule> {
  vi.resetModules()
  return import('../countries')
}

/** Serves the committed asset, and counts how often it was asked for. */
function assetFetcher(body: string = DETAIL_ASSET, status = 200) {
  const calls: Array<string> = []
  const fetcher = (url: string) => {
    calls.push(url)
    return Promise.resolve(new Response(body, { status }))
  }
  return { calls, fetcher }
}

/** The codes the geometry can actually draw, counted independently of the module. */
function drawableCodes(): ReadonlyArray<string> {
  const codes: Array<string> = []
  for (const [code, outline] of worldOutlines()) {
    if (outline.some((ring) => ring.length >= 3)) codes.push(code)
  }
  return codes
}

describe('countryFeatures', () => {
  it('emits exactly one identified feature per bundled country', () => {
    const { type, features } = countryFeatures()
    const outlines = worldOutlines()

    expect(type).toBe('FeatureCollection')
    expect(features.length).toBe(drawableCodes().length)
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
            // Clamped, not merely valid: Web Mercator sends a pole to
            // infinity, and Antarctica's outline closes across one.
            expect(lat, code).toBeGreaterThanOrEqual(-MAX_MERCATOR_LATITUDE)
            expect(lat, code).toBeLessThanOrEqual(MAX_MERCATOR_LATITUDE)
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

  it('pulls a polar outline inside what Web Mercator can project', () => {
    const antarctica = countryFeatures().features.find(
      (feature) => feature.properties.code === 'AQ',
    )
    expect(antarctica).toBeDefined()
    if (antarctica === undefined) return

    const latitudes = antarctica.geometry.coordinates.flatMap((polygon) =>
      polygon.flatMap((ring) => ring.map(([, lat]) => lat)),
    )
    // The bundled outline closes across the pole itself, which projects to
    // infinity and drops the whole tile.
    expect(latitudes).not.toContain(-90)
    expect(Math.min(...latitudes)).toBe(-MAX_MERCATOR_LATITUDE)
  })

  it('hands out a payload that cannot be corrupted in place', () => {
    // Memoised for the life of the process and shared ring-for-ring with
    // `worldLandFeatures`, so a single stray write would poison both views
    // until the tab is closed.
    const collection = countryFeatures()
    expect(Object.isFrozen(collection)).toBe(true)
    expect(Object.isFrozen(collection.features)).toBe(true)

    const feature = collection.features[0]
    expect(Object.isFrozen(feature)).toBe(true)
    expect(Object.isFrozen(feature.properties)).toBe(true)
    expect(Object.isFrozen(feature.geometry)).toBe(true)
    expect(Object.isFrozen(feature.geometry.coordinates)).toBe(true)

    const polygon = feature.geometry.coordinates[0]
    const ring = polygon[0]
    expect(Object.isFrozen(polygon)).toBe(true)
    expect(Object.isFrozen(ring)).toBe(true)
    expect(Object.isFrozen(ring[0])).toBe(true)

    expect(() => {
      ring[0][0] = 0
    }).toThrow(TypeError)
    expect(() => {
      collection.features.push(feature)
    }).toThrow(TypeError)
    expect(countryFeatures().features.length).toBe(collection.features.length)
  })
})

describe('countrySource', () => {
  it('promotes the code, without which a string id does not survive tiling', () => {
    const source = countrySource()

    expect(source.type).toBe('geojson')
    expect(source.data).toBe(countryFeatures())
    // The silent failure this exists to prevent: `setFeatureState` succeeds,
    // the paint expression never sees the state, and hover does nothing.
    expect(source.promoteId).toBe(COUNTRY_CODE_PROPERTY)
    expect(source.maxzoom).toBe(COUNTRY_SOURCE_MAX_ZOOM)
  })

  it('promotes a property every feature actually carries', () => {
    for (const feature of countryFeatures().features) {
      const promoted = feature.properties[COUNTRY_CODE_PROPERTY]
      expect(promoted, feature.id).toBe(feature.id)
    }
  })

  it('survives the structured clone that carries it to the map worker', () => {
    // Freezing is only safe because MapLibre copies the source options and
    // posts the payload rather than editing it in place.
    const clone = structuredClone(countrySource())
    expect(clone.promoteId).toBe(COUNTRY_CODE_PROPERTY)
    expect(Object.isFrozen(clone)).toBe(false)

    const cloned = clone.data
    expect(typeof cloned).toBe('object')
    if (typeof cloned !== 'object' || cloned === null) return
    expect(cloned).toEqual(countryFeatures())
  })

  it('is frozen and stable enough to name in an effect dependency', () => {
    expect(countrySource()).toBe(countrySource())
    expect(Object.isFrozen(countrySource())).toBe(true)
  })

  it('stops sub-dividing where the bundled geometry stops resolving', () => {
    // Outlines are quantised to a hundredth of a degree; tiling past that only
    // buys memory. Overzoom draws the same shape.
    expect(COUNTRY_SOURCE_MAX_ZOOM).toBeGreaterThan(0)
    expect(COUNTRY_SOURCE_MAX_ZOOM).toBeLessThan(24)
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

  it('is frozen too, because it shares its rings with the other view', () => {
    const collection = worldLandFeatures()
    const geometry = collection.features[0].geometry
    expect(Object.isFrozen(collection)).toBe(true)
    expect(Object.isFrozen(collection.features)).toBe(true)
    expect(Object.isFrozen(geometry.coordinates)).toBe(true)
    expect(() => {
      geometry.coordinates.pop()
    }).toThrow(TypeError)
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
    expect(bounds.south).toBe(-MAX_MERCATOR_LATITUDE)
  })

  it('gives the whole line to the one shape that encircles the planet', () => {
    // The tightest rectangle around Antarctica's vertices is 356° wide, which
    // reads as "absent from the other four" — a continent that is in fact at
    // every longitude there is.
    const bounds = countryBounds('AQ')
    expect(bounds).not.toBeNull()
    if (bounds === null) return
    expect(bounds.west).toBe(-180)
    expect(bounds.east).toBe(180)
    expect(bounds.north).toBeCloseTo(-63.27, 2)
    for (const lng of [-179.5, -90, 0, 90, 178, 179.9]) {
      expect(boundsContains(bounds, [lng, -70]), String(lng)).toBe(true)
    }
  })

  it('gives it to nothing else', () => {
    for (const code of worldOutlines().keys()) {
      if (code === 'AQ') continue
      const bounds = countryBounds(code)
      expect(bounds, code).not.toBeNull()
      if (bounds === null) continue
      // Russia is the widest country that does not wrap the planet, at 170°.
      expect(bounds.east - bounds.west, code).toBeLessThan(180)
    }
  })

  it('frames geometry it actually contains, line and pole included', () => {
    // The claim the module makes and nothing else checked: a country's fill and
    // its fly-to describe the same country. A clamp applied to one and not the
    // other, or a longitude solved on the wrong side of the line, shows up here
    // as a vertex outside the rectangle drawn around it — off by degrees, not by
    // the centimetre `SOLVER_DRIFT` allows for.
    const escaped: Array<string> = []
    for (const feature of countryFeatures().features) {
      const { code } = feature.properties
      const bounds = countryBounds(code)
      expect(bounds, code).not.toBeNull()
      if (bounds === null) continue

      const tolerant: MapBounds = {
        west: bounds.west - SOLVER_DRIFT,
        south: bounds.south - SOLVER_DRIFT,
        east: bounds.east + SOLVER_DRIFT,
        north: bounds.north + SOLVER_DRIFT,
      }
      for (const polygon of feature.geometry.coordinates) {
        for (const ring of polygon) {
          for (const point of ring) {
            if (!boundsContains(tolerant, point)) {
              escaped.push(`${code} ${point[0]},${point[1]}`)
            }
          }
        }
      }
    }
    expect(escaped).toEqual([])
  })

  it('hands out a frozen rectangle', () => {
    const bounds = countryBounds('JP')
    expect(bounds).not.toBeNull()
    expect(Object.isFrozen(bounds)).toBe(true)
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
  it('name the exact codes the finest cut we ship cannot fill', () => {
    // Asserted as a list rather than a count, because the interesting failure is
    // a code moving between "drawn" and "not drawn" while the total holds.
    expect(UNMAPPED_COUNTRY_CODES).toEqual(['BV', 'UM'])
    expect(UNMAPPED_TERRITORY_CODES).toEqual([
      'BQ',
      'CC',
      'CX',
      'GF',
      'GI',
      'GP',
      'MQ',
      'RE',
      'SJ',
      'TK',
      'YT',
    ])
  })

  it('are sorted sets with no duplicates and no overlap', () => {
    for (const list of [UNMAPPED_COUNTRY_CODES, UNMAPPED_TERRITORY_CODES]) {
      expect([...list]).toEqual([...list].sort())
      expect(new Set(list).size).toBe(list.length)
    }
    expect(new Set(UNMAPPED_CODES).size).toBe(UNMAPPED_CODES.length)
  })

  it('are codes, and none of them is in the bundled cut either', () => {
    const outlines = worldOutlines()
    for (const code of UNMAPPED_CODES) {
      expect(code).toMatch(/^[A-Z]{2}$/)
      expect(outlines.has(code), code).toBe(false)
    }
  })

  it('no longer claim the states the finer cut fills', () => {
    // Every one of these was unfillable while the 1:110m cut was the only cut,
    // and every one of them is an ordinary holiday. If the finer asset ever
    // stops carrying them they belong back on a list, not silently missing.
    for (const code of ['SG', 'MT', 'MV', 'MC', 'BH', 'MU', 'VA', 'HK', 'MO']) {
      expect(UNMAPPED_CODES, code).not.toContain(code)
    }
  })

  it('account for every officially-assigned ISO2 code', () => {
    // 249 officially-assigned alpha-2 codes. The finer cut draws 236 of them
    // plus the user-assigned XK for Kosovo, and these lists name the other 13.
    // If either drifts, this is the sum that stops adding up.
    const drawn = [...detailCodes()].filter((code) => code !== 'XK')
    expect(drawn.length + UNMAPPED_CODES.length).toBe(249)
  })
})

describe('one drawable index', () => {
  it('makes the three public answers agree by construction', () => {
    // They used to be derived separately, so a country whose rings were all
    // degenerate would report an outline and a rectangle it could not fill.
    const filled = new Set(
      countryFeatures().features.map((feature) => feature.properties.code),
    )
    expect([...filled].sort()).toEqual([...drawableCodes()].sort())

    for (const code of worldOutlines().keys()) {
      const drawn = filled.has(code)
      expect(hasCountryOutline(code), code).toBe(drawn)
      expect(countryBounds(code) !== null, code).toBe(drawn)
    }
  })

  it('agrees on codes it has never heard of, in any casing', () => {
    for (const code of ['ZZ', 'SG', 'HK', '', 'not a code', 'jp', 'Jp']) {
      const drawn = hasCountryOutline(code)
      expect(countryBounds(code) !== null, code).toBe(drawn)
    }
  })
})

describe('the finer cut', () => {
  let countries: CountriesModule
  let detail: CountryDetail

  beforeAll(async () => {
    countries = await freshCountries()
    detail = await countries.loadCountryDetail(assetFetcher().fetcher)
  })

  const featureFor = (code: string) =>
    detail.features.features.find((feature) => feature.properties.code === code)

  const ringsWithin = (code: string, box: MapBounds) => {
    const feature = featureFor(code)
    if (feature === undefined) return 0
    return feature.geometry.coordinates.filter((polygon) =>
      polygon[0].every((point) => boundsContains(box, point)),
    ).length
  }

  it('is the asset the module points at, and it is inside its budget', () => {
    // The module's header states a ceiling. This is the assertion that keeps the
    // claim true after the next rebuild rather than only on the day it was made.
    const bytes = Buffer.byteLength(DETAIL_ASSET)
    expect(bytes).toBeLessThanOrEqual(DETAIL_BUDGET.raw)
    expect(gzipSync(DETAIL_ASSET, { level: 9 }).length).toBeLessThanOrEqual(
      DETAIL_BUDGET.gzip,
    )
    expect(COUNTRY_DETAIL_URL).toMatch(/^\/atlas\/.+\.v\d+\.txt$/)
  })

  it('states its own provenance, and decodes to exactly what it claims', () => {
    expect(detail.manifest.version).toBe(1)
    expect(detail.manifest.source).toBe('natural-earth-50m')
    // The same hundredth-of-a-degree grid the bundled cut sits on, which is what
    // keeps COUNTRY_SOURCE_MAX_ZOOM at 5 rather than raised by hand.
    expect(detail.manifest.grid).toBe(100)
    expect(detail.manifest.codes).toBe(detailCodes().length)
    // parseCountryDetail throws on a mismatch, so reaching here proves the ring
    // and vertex counts agree too; these pin the size the budget was measured at.
    expect(detail.manifest.rings).toBeGreaterThanOrEqual(1600)
    expect(detail.manifest.vertices).toBeLessThanOrEqual(60_000)
    expect(detail.features.features.length).toBe(detail.manifest.codes)
  })

  it('resolves France to its offshore territories, not just the mainland', () => {
    const france = featureFor('FR')
    expect(france).toBeDefined()
    if (france === undefined) return

    // Three rings in the bundled cut; ten here.
    expect(france.geometry.coordinates.length).toBeGreaterThanOrEqual(10)
    expect(worldOutlines().get('FR')?.length).toBe(3)

    // Guadeloupe and Martinique in the Caribbean, Réunion and Mayotte in the
    // Indian Ocean, French Guiana in South America — the shapes the user's
    // complaint was actually about.
    expect(
      ringsWithin('FR', { west: -62, south: 14, east: -60.5, north: 16.6 }),
    ).toBeGreaterThanOrEqual(4)
    expect(
      ringsWithin('FR', { west: 44.9, south: -21.5, east: 56, north: -12.5 }),
    ).toBeGreaterThanOrEqual(2)
    expect(
      ringsWithin('FR', { west: -55, south: 2, east: -51, north: 6 }),
    ).toBe(1)
  })

  it('gives Spain the Canaries and the Balearics', () => {
    const spain = featureFor('ES')
    expect(spain).toBeDefined()
    if (spain === undefined) return

    // One 42-vertex ring in the bundled cut, and neither archipelago in it.
    expect(worldOutlines().get('ES')?.length).toBe(1)
    expect(spain.geometry.coordinates.length).toBeGreaterThanOrEqual(12)

    // Seven Canary Islands off Morocco, four Balearic Islands in the western
    // Mediterranean.
    expect(
      ringsWithin('ES', { west: -18.5, south: 27, east: -13, north: 29.5 }),
    ).toBeGreaterThanOrEqual(7)
    expect(
      ringsWithin('ES', { west: 1, south: 38.5, east: 4.5, north: 40.5 }),
    ).toBeGreaterThanOrEqual(4)
  })

  it('draws a country the bundled cut cannot draw at all', () => {
    // Sovereign states, dependencies and one micro-state that survives only
    // because the build retries an over-simplified ring unsimplified.
    for (const code of ['SG', 'MT', 'MV', 'MC', 'VA', 'HK', 'MO', 'FO', 'KY']) {
      expect(worldOutlines().has(code), code).toBe(false)
      expect(countries.hasCountryOutline(code), code).toBe(true)
      expect(countries.countryBounds(code), code).not.toBeNull()
    }
  })

  it('accounts for every code the atlas can name', () => {
    // The claim the two unmapped lists make, checked against the country table
    // the rest of the product renders from rather than against itself.
    const unmapped = new Set([
      ...UNMAPPED_COUNTRY_CODES,
      ...UNMAPPED_TERRITORY_CODES,
    ])
    const unaccounted: Array<string> = []
    for (const code of Object.keys(COUNTRY_NAMES)) {
      const drawn = countries.hasCountryOutline(code)
      if (drawn === unmapped.has(code)) unaccounted.push(code)
    }
    expect(unaccounted).toEqual([])
  })

  it('draws the land of every code it cannot address', () => {
    // The eleven territory codes are unfillable because Natural Earth's
    // sovereign cut folds them into the country that administers them — so
    // their land is on the map, within a degree of where it belongs. The two
    // country codes have nothing within ten.
    const nearest = (point: [number, number]) => {
      let best = Infinity
      for (const feature of detail.features.features) {
        for (const polygon of feature.geometry.coordinates) {
          for (const [lng, lat] of polygon[0]) {
            const dx = (lng - point[0]) * Math.cos((point[1] * Math.PI) / 180)
            const dy = lat - point[1]
            best = Math.min(best, Math.hypot(dx, dy))
          }
        }
      }
      return best
    }

    const drawnElsewhere: Record<string, [number, number]> = {
      BQ: [-68.28, 12.18],
      CC: [96.87, -12.17],
      CX: [105.62, -10.48],
      GF: [-53.2, 4],
      GI: [-5.35, 36.13],
      GP: [-61.58, 16.24],
      MQ: [-61.02, 14.64],
      RE: [55.53, -21.13],
      SJ: [16, 78.6],
      TK: [-171.85, -9.2],
      YT: [45.16, -12.82],
    }
    expect(Object.keys(drawnElsewhere).sort()).toEqual([
      ...UNMAPPED_TERRITORY_CODES,
    ])
    for (const [code, point] of Object.entries(drawnElsewhere)) {
      expect(nearest(point), code).toBeLessThan(1)
    }

    for (const [code, point] of Object.entries({
      BV: [3.36, -54.42] as [number, number],
      UM: [-177.38, 28.2] as [number, number],
    })) {
      expect(nearest(point), code).toBeGreaterThan(10)
    }
  })

  it('keeps a rectangle honest once a country spans two hemispheres', () => {
    // France now reaches from Guadeloupe at 61.8°W to Réunion at 55.8°E. The
    // antimeridian solver has two answers for that and only one of them is a
    // rectangle a camera can use.
    const france = countries.countryBounds('FR')
    expect(france).not.toBeNull()
    if (france === null) return
    expect(france.west).toBeLessThan(-60)
    expect(france.east).toBeGreaterThan(55)
    expect(france.east - france.west).toBeLessThan(180)
    expect(boundsContains(france, [2.35, 48.85])).toBe(true)
    expect(boundsContains(france, [55.53, -21.13])).toBe(true)
    expect(boundsContains(france, [-61.02, 14.64])).toBe(true)
  })

  it('keeps the antimeridian and the encircling case intact', () => {
    for (const code of ['RU', 'FJ', 'NZ', 'US']) {
      const bounds = countries.countryBounds(code)
      expect(bounds, code).not.toBeNull()
      if (bounds === null) continue
      expect(bounds.east - bounds.west, code).toBeLessThan(180)
      expect(bounds.east, code).toBeGreaterThan(bounds.west)
    }

    // Antarctica is present at every longitude, and the tightest rectangle
    // around its vertices says otherwise.
    const antarctica = countries.countryBounds('AQ')
    expect(antarctica).not.toBeNull()
    if (antarctica === null) return
    expect(antarctica.west).toBe(-180)
    expect(antarctica.east).toBe(180)
    expect(antarctica.south).toBe(-MAX_MERCATOR_LATITUDE)
  })

  it('gives the whole line to nothing but Antarctica', () => {
    const wrapped: Array<string> = []
    for (const code of detailCodes()) {
      if (code === 'AQ') continue
      const bounds = countries.countryBounds(code)
      expect(bounds, code).not.toBeNull()
      if (bounds === null) continue
      if (bounds.east - bounds.west >= 180) wrapped.push(code)
    }
    expect(wrapped).toEqual([])
  })

  it('frames geometry it actually contains, offshore rings included', () => {
    const escaped: Array<string> = []
    for (const feature of detail.features.features) {
      const { code } = feature.properties
      const bounds = countries.countryBounds(code)
      if (bounds === null) {
        escaped.push(`${code} has no rectangle`)
        continue
      }
      const tolerant: MapBounds = {
        west: bounds.west - SOLVER_DRIFT,
        south: bounds.south - SOLVER_DRIFT,
        east: bounds.east + SOLVER_DRIFT,
        north: bounds.north + SOLVER_DRIFT,
      }
      for (const polygon of feature.geometry.coordinates) {
        for (const point of polygon[0]) {
          if (!boundsContains(tolerant, point)) {
            escaped.push(`${code} ${point[0]},${point[1]}`)
          }
        }
      }
    }
    expect(escaped).toEqual([])
  })

  it('is a source MapLibre will keep the string ids of', () => {
    expect(detail.source.type).toBe('geojson')
    expect(detail.source.data).toBe(detail.features)
    // Without it MapLibre parseInts 'FR' to NaN to 0 and every country in the
    // payload shares one feature-state.
    expect(detail.source.promoteId).toBe(COUNTRY_CODE_PROPERTY)
    // The finer cut sits on the same grid, so it stops sub-dividing at the same
    // zoom. Nothing here was raised by hand.
    expect(detail.source.maxzoom).toBe(COUNTRY_SOURCE_MAX_ZOOM)
  })

  it('emits well-formed, addressable, Mercator-safe features', () => {
    for (const feature of detail.features.features) {
      const { code } = feature.properties
      expect(code, code).toMatch(/^[A-Z]{2}$/)
      expect(feature.id, code).toBe(code)
      expect(feature.geometry.coordinates.length, code).toBeGreaterThan(0)
      for (const polygon of feature.geometry.coordinates) {
        // One outer ring per polygon: a second would read as a hole and punch
        // Corsica out of France.
        expect(polygon.length, code).toBe(1)
        const ring = polygon[0]
        expect(ring.length, code).toBeGreaterThanOrEqual(4)
        expect(ring[0], code).toEqual(ring[ring.length - 1])
        for (const [lng, lat] of ring) {
          expect(lng, code).toBeGreaterThanOrEqual(-180)
          expect(lng, code).toBeLessThanOrEqual(180)
          expect(lat, code).toBeGreaterThanOrEqual(-MAX_MERCATOR_LATITUDE)
          expect(lat, code).toBeLessThanOrEqual(MAX_MERCATOR_LATITUDE)
        }
      }
    }
  })

  it('carries one shape per code, however many source features held it', () => {
    // Australia is three features in Natural Earth — the mainland, the Indian
    // Ocean Territories and Ashmore and Cartier. Two shapes on one id would
    // mean hovering one lit the other.
    const seen = new Set<string>()
    for (const feature of detail.features.features) {
      expect(seen.has(feature.properties.code), feature.properties.code).toBe(
        false,
      )
      seen.add(feature.properties.code)
    }
    const australia = featureFor('AU')
    expect(australia).toBeDefined()
    expect(australia?.geometry.coordinates.length).toBeGreaterThan(40)
  })

  it('draws every country after anything that could swallow it', () => {
    // Outer rings only, so South Africa's ring covers Lesotho and Italy's covers
    // San Marino and the Vatican. A fill layer draws later features on top, and
    // the build orders by extent, so the enclave always wins.
    const order = new Map(
      detail.features.features.map((feature, index) => [
        feature.properties.code,
        index,
      ]),
    )
    for (const [inner, outer] of [
      ['LS', 'ZA'],
      ['SM', 'IT'],
      ['VA', 'IT'],
      ['MC', 'FR'],
      ['AD', 'ES'],
    ]) {
      const innerIndex = order.get(inner)
      const outerIndex = order.get(outer)
      expect(innerIndex, inner).toBeDefined()
      expect(outerIndex, outer).toBeDefined()
      if (innerIndex === undefined || outerIndex === undefined) continue
      expect(innerIndex, `${inner} after ${outer}`).toBeGreaterThan(outerIndex)
    }
  })

  it('leaves the bundled payloads exactly where they were', () => {
    // The server-rendered world map and the ground underlay hold these by
    // reference and cannot await a fetch. Installing the finer cut must not
    // move them.
    expect(countries.countryFeatures().features.length).toBe(
      worldOutlines().size,
    )
    const spain = countries
      .countryFeatures()
      .features.find((feature) => feature.properties.code === 'ES')
    expect(spain?.geometry.coordinates.length).toBe(1)
    expect(countries.worldLandFeatures().features.length).toBe(1)
    expect(countries.countrySource().data).toBe(countries.countryFeatures())
  })
})

describe('loadCountryDetail', () => {
  it('answers false and null until the asset lands, then true and a rectangle', async () => {
    const countries = await freshCountries()
    expect(countries.countryDetail()).toBeNull()
    expect(countries.hasCountryOutline('SG')).toBe(false)
    expect(countries.countryBounds('SG')).toBeNull()

    const detail = await countries.loadCountryDetail(assetFetcher().fetcher)
    expect(countries.countryDetail()).toBe(detail)
    expect(countries.hasCountryOutline('SG')).toBe(true)
    expect(countries.countryBounds('SG')).not.toBeNull()
  })

  it('fetches once however many callers ask, and once more never', async () => {
    const countries = await freshCountries()
    const { calls, fetcher } = assetFetcher()

    const [first, second] = await Promise.all([
      countries.loadCountryDetail(fetcher),
      countries.loadCountryDetail(fetcher),
    ])
    const third = await countries.loadCountryDetail(fetcher)

    expect(calls).toEqual([COUNTRY_DETAIL_URL])
    expect(second).toBe(first)
    expect(third).toBe(first)
  })

  it('names the status it got, and lets the next caller try again', async () => {
    const countries = await freshCountries()
    await expect(
      countries.loadCountryDetail(assetFetcher('', 404).fetcher),
    ).rejects.toThrow(/404/)
    expect(countries.countryDetail()).toBeNull()
    expect(countries.hasCountryOutline('SG')).toBe(false)

    // The rejection must not be memoised: a flaky network is the ordinary case.
    const recovered = await countries.loadCountryDetail(assetFetcher().fetcher)
    expect(recovered.manifest.source).toBe('natural-earth-50m')
    expect(countries.hasCountryOutline('SG')).toBe(true)
  })

  it('refuses a truncated download instead of drawing half a world', async () => {
    const countries = await freshCountries()
    const truncated = DETAIL_ASSET.slice(0, Math.floor(DETAIL_ASSET.length / 2))
    await expect(
      countries.loadCountryDetail(assetFetcher(truncated).fetcher),
    ).rejects.toThrow(/against a manifest of/)
    expect(countries.countryDetail()).toBeNull()
  })

  it('leaves the bundled bounds alone until it succeeds', async () => {
    const countries = await freshCountries()
    const before = countries.countryBounds('ES')
    expect(before).not.toBeNull()
    await expect(
      countries.loadCountryDetail(assetFetcher('', 500).fetcher),
    ).rejects.toThrow(/500/)
    expect(countries.countryBounds('ES')).toBe(before)

    await countries.loadCountryDetail(assetFetcher().fetcher)
    const after = countries.countryBounds('ES')
    expect(after).not.toBeNull()
    if (after === null || before === null) return
    // The Canaries drag the western edge from mainland Iberia out past 18°W.
    expect(before.west).toBeGreaterThan(-10)
    expect(after.west).toBeLessThan(-18)
  })

  it('refuses to guess an origin where there is no browser', async () => {
    // The URL is root-relative because it is an asset of this origin. A Worker
    // has no origin to resolve it against, and the failure it produces on its
    // own names neither this module nor the asset.
    const countries = await freshCountries()
    vi.stubGlobal('window', undefined)
    try {
      await expect(countries.loadCountryDetail()).rejects.toThrow(
        /browser asset/,
      )
    } finally {
      vi.unstubAllGlobals()
    }
    // An injected fetcher supplies the base the default one lacks, so it is
    // still the way a test or a build step reads the same bytes.
    const detail = await countries.loadCountryDetail(assetFetcher().fetcher)
    expect(detail.manifest.source).toBe('natural-earth-50m')
  })
})

describe('subscribeCountryDetail', () => {
  it('tells a listener once, after the finer answers are installed', async () => {
    const countries = await freshCountries()
    const seen: Array<{ outline: boolean; west: number | null }> = []
    countries.subscribeCountryDetail(() => {
      seen.push({
        outline: countries.hasCountryOutline('SG'),
        west: countries.countryBounds('ES')?.west ?? null,
      })
    })

    expect(seen).toEqual([])
    await countries.loadCountryDetail(assetFetcher().fetcher)
    await countries.loadCountryDetail(assetFetcher().fetcher)

    // Once, and with the finer cut already answering — a listener that saw the
    // bundled answers would have nothing to re-render for.
    expect(seen.length).toBe(1)
    expect(seen[0].outline).toBe(true)
    expect(seen[0].west).toBeLessThan(-18)
  })

  it('stays quiet when the load fails, and speaks when the retry lands', async () => {
    const countries = await freshCountries()
    let calls = 0
    countries.subscribeCountryDetail(() => {
      calls += 1
    })

    await expect(
      countries.loadCountryDetail(assetFetcher('', 503).fetcher),
    ).rejects.toThrow(/503/)
    expect(calls).toBe(0)

    await countries.loadCountryDetail(assetFetcher().fetcher)
    expect(calls).toBe(1)
  })

  it('hands back an unsubscribe that actually detaches', async () => {
    const countries = await freshCountries()
    let calls = 0
    const unsubscribe = countries.subscribeCountryDetail(() => {
      calls += 1
    })
    unsubscribe()
    // Idempotent, because a React effect cleanup can run twice under Strict
    // Mode and must not throw the second time.
    unsubscribe()

    await countries.loadCountryDetail(assetFetcher().fetcher)
    expect(calls).toBe(0)
  })

  it('does not skip a neighbour when a listener detaches mid-announcement', async () => {
    const countries = await freshCountries()
    const order: Array<string> = []
    const first = countries.subscribeCountryDetail(() => {
      order.push('first')
      first()
    })
    countries.subscribeCountryDetail(() => {
      order.push('second')
    })

    await countries.loadCountryDetail(assetFetcher().fetcher)
    expect(order).toEqual(['first', 'second'])
  })

  it('never fires for a subscriber that arrives after the cut has landed', async () => {
    const countries = await freshCountries()
    await countries.loadCountryDetail(assetFetcher().fetcher)

    let calls = 0
    countries.subscribeCountryDetail(() => {
      calls += 1
    })
    await countries.loadCountryDetail(assetFetcher().fetcher)

    // There is nothing left to announce; countryDetail() is the answer.
    expect(calls).toBe(0)
    expect(countries.countryDetail()).not.toBeNull()
  })
})

describe('parseCountryDetail', () => {
  it('rejects a payload with no manifest line', () => {
    expect(() => parseCountryDetail('FR:0,0,1,0,0,1')).toThrow(/manifest/)
  })

  it('names the manifest field it could not read', () => {
    expect(() =>
      parseCountryDetail('version=1 source=x\nFR:0,0,1,0,0,1'),
    ).toThrow(/missing grid/)
    // `Number('')` is zero, and a grid of zero divides every coordinate into
    // infinity rather than failing.
    expect(() =>
      parseCountryDetail('version=1 grid= codes=1 rings=1 vertices=3\nZZ:0,0'),
    ).toThrow(/missing grid/)
    expect(() =>
      parseCountryDetail('version=1 grid=0 codes=1 rings=1 vertices=3\nZZ:0,0'),
    ).toThrow(/not a grid/)
  })

  it('decodes a hand-written payload on the grid its manifest declares', () => {
    const detail = parseCountryDetail(
      'version=1 source=test grid=100 codes=1 rings=1 vertices=3\nZZ:0,0,100,0,0,100\n',
    )
    const [feature] = detail.features.features
    expect(feature.id).toBe('ZZ')
    expect(feature.geometry.coordinates[0][0]).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ])
  })

  it('hands out a payload that cannot be corrupted in place', () => {
    const detail = parseCountryDetail(
      'version=1 source=test grid=100 codes=1 rings=1 vertices=3\nZZ:0,0,100,0,0,100\n',
    )
    expect(Object.isFrozen(detail)).toBe(true)
    expect(Object.isFrozen(detail.features.features)).toBe(true)
    expect(() => {
      detail.features.features[0].geometry.coordinates[0][0][0][0] = 9
    }).toThrow(TypeError)
  })
})
