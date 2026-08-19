/**
 * The world as one feature per country.
 *
 * The ground underlay a map style draws is a single property-less MultiPolygon:
 * the right shape for painting land, and the wrong shape for everything else. A
 * data-driven fill needs to know *which* country it is painting, a hover needs a
 * stable feature id to hang a `feature-state` on, and a search result needs a
 * rectangle to fly the camera to. This module is that second view of the same
 * bundled geometry — the 285 rings from `./world`, cut per ISO 3166-1 alpha-2
 * code and closed so MapLibre can fill them.
 *
 * Three details are load-bearing:
 *
 * - **Every ring is its own polygon.** GeoJSON reads the second ring of a
 *   polygon as a hole, and the bundled outlines are all *outer* rings, so a
 *   country's islands have to be separate polygons inside one MultiPolygon or
 *   Hokkaido would be punched out of Japan.
 * - **Bounds are solved in a wrapped longitude space.** Rings are pre-cut at the
 *   antimeridian, so Russia carries one ring ending at 180° and another starting
 *   at -180°. Taking the naive minimum and maximum of those gives -180…180 — the
 *   whole planet — for Russia, Fiji and anything else that straddles the line.
 *   {@link countryBounds} defers to `boundsForPoints`, which solves longitude
 *   twice and keeps the narrower answer.
 * - **Closed rings are built once and shared.** `./world` stores 8,652 vertices
 *   as open rings; closing them costs 285 fresh arrays holding 8,937 coordinate
 *   pairs. {@link worldLandFeatures} is a second *view* of those same arrays
 *   rather than a second copy, so the merged-land payload a style needs for its
 *   ground underlay costs 285 references, not another 8,937 pairs.
 *
 * Memoised at module scope for a reason specific to this payload: a MapLibre
 * `geojson` source only re-tiles when its `data` changes by reference, and a
 * theme switch replaces the whole style document, so every runtime layer tears
 * its source down and asks for the payload again. Returning a fresh object would
 * re-tile 175 MultiPolygons on each of those, for no visual difference.
 */

import { boundsForPoints } from './bounds'
import { worldOutlines } from './world'

import type { MapBounds } from './bounds'
import type { WorldOutline, WorldRing } from './world'

/**
 * MultiPolygon coordinates: polygons, each a list of rings, each a list of
 * `[longitude, latitude]` pairs.
 *
 * Deliberately mutable so the values satisfy MapLibre's own GeoJSON types
 * without a cast. Treat anything memoised here as immutable regardless.
 */
export type MultiPolygonCoordinates = Array<Array<Array<[number, number]>>>

/**
 * One country, ready for a MapLibre `geojson` source.
 *
 * `id` repeats `properties.code` because the two are read from different places:
 * `feature-state` addresses a feature by `id`, while a paint expression reads
 * `['get', 'code']`. A `geojson` source must be added with `promoteId: 'code'`
 * for the string id to survive tiling.
 */
export interface CountryFeature {
  readonly type: 'Feature'
  readonly id: string
  readonly geometry: {
    readonly type: 'MultiPolygon'
    readonly coordinates: MultiPolygonCoordinates
  }
  readonly properties: { readonly code: string }
}

/** Every country the bundled geometry can draw, as one source payload. */
export interface CountryFeatureCollection {
  readonly type: 'FeatureCollection'
  readonly features: Array<CountryFeature>
}

/** All bundled land merged into one anonymous shape, for a ground underlay. */
export interface LandFeature {
  readonly type: 'Feature'
  readonly geometry: {
    readonly type: 'MultiPolygon'
    readonly coordinates: MultiPolygonCoordinates
  }
  readonly properties: Record<string, never>
}

/** The single-feature payload a style's ground underlay source wants. */
export interface LandFeatureCollection {
  readonly type: 'FeatureCollection'
  readonly features: Array<LandFeature>
}

/**
 * UN member states with no bundled outline.
 *
 * Natural Earth's 1:110m cut drops anything smaller than about a pixel at world
 * scale, which is 29 of the 195 states the tracker counts: the micro-states, the
 * lesser Antilles and most of the Pacific. A country in here can be visited,
 * counted and listed, but it cannot be filled on the map.
 *
 * This is the sovereign half of the answer only. A traveller records dependent
 * territories too, and the 1:110m cut drops most of those as well — see
 * {@link UNMAPPED_TERRITORY_CODES} for the rest, and {@link hasCountryOutline}
 * for the question a caller usually means to ask.
 *
 * Sorted, so a reader can find a code by eye. Verified against `./world` by test.
 */
export const UNMAPPED_COUNTRY_CODES: ReadonlyArray<string> = [
  'AD',
  'AG',
  'BB',
  'BH',
  'CV',
  'DM',
  'FM',
  'GD',
  'KI',
  'KM',
  'KN',
  'LC',
  'LI',
  'MC',
  'MH',
  'MT',
  'MU',
  'MV',
  'NR',
  'PW',
  'SC',
  'SG',
  'SM',
  'ST',
  'TO',
  'TV',
  'VA',
  'VC',
  'WS',
]

/**
 * Dependent territories and special areas with no bundled outline.
 *
 * The bundled geometry does carry a handful of territories that are large enough
 * to draw — Greenland, Puerto Rico, New Caledonia, the Falklands, French
 * Southern Territories, Western Sahara — so this is specifically the 46 further
 * officially-assigned ISO 3166-1 alpha-2 codes that it does not. They matter
 * because they are ordinary holiday destinations: Hong Kong, Guadeloupe,
 * Réunion, the Cayman Islands, Guam, the Faroes.
 *
 * Together with {@link UNMAPPED_COUNTRY_CODES} this is every officially-assigned
 * ISO 3166-1 alpha-2 code the map cannot fill, so a caller can annotate a
 * visited row — "no outline at this scale" — instead of silently dropping it.
 *
 * Sorted, so a reader can find a code by eye. Verified against `./world` by test.
 */
export const UNMAPPED_TERRITORY_CODES: ReadonlyArray<string> = [
  'AI',
  'AS',
  'AW',
  'AX',
  'BL',
  'BM',
  'BQ',
  'BV',
  'CC',
  'CK',
  'CW',
  'CX',
  'FO',
  'GF',
  'GG',
  'GI',
  'GP',
  'GS',
  'GU',
  'HK',
  'HM',
  'IM',
  'IO',
  'JE',
  'KY',
  'MF',
  'MO',
  'MP',
  'MQ',
  'MS',
  'NF',
  'NU',
  'PF',
  'PM',
  'PN',
  'RE',
  'SH',
  'SJ',
  'SX',
  'TC',
  'TK',
  'UM',
  'VG',
  'VI',
  'WF',
  'YT',
]

/**
 * True when the map can actually fill this code.
 *
 * The general form of the two lists above, and the question a list row or a
 * search result usually wants answered: it takes any string, including a code
 * neither list names, and never grows anything.
 */
export function hasCountryOutline(countryCode: string): boolean {
  return worldOutlines().has(countryCode.toUpperCase())
}

let collection: CountryFeatureCollection | null = null
let land: LandFeatureCollection | null = null
let boundsByCode: ReadonlyMap<string, MapBounds> | null = null

/**
 * Closes a ring, because a fill with an open ring renders with a seam.
 *
 * The single implementation: {@link countryFeatures} and
 * {@link worldLandFeatures} both read the arrays this returns, and neither
 * copies them again.
 */
function closedRing(ring: WorldRing): Array<[number, number]> {
  const out: Array<[number, number]> = ring.map(([lng, lat]) => [lng, lat])
  const first = out[0]
  const last = out[out.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    out.push([first[0], first[1]])
  }
  return out
}

/** One closed single-ring polygon per drawable ring of one country. */
function polygonsOf(outline: WorldOutline): MultiPolygonCoordinates {
  const polygons: MultiPolygonCoordinates = []
  for (const ring of outline) {
    // Fewer than three vertices enclose no area, so a degenerate ring costs a
    // tessellation that draws nothing.
    if (ring.length < 3) continue
    polygons.push([closedRing(ring)])
  }
  return polygons
}

/**
 * Every country as its own feature, keyed and identified by ISO alpha-2.
 *
 * Built once and handed back by reference — see the note on memoisation at the
 * top of the file.
 */
export function countryFeatures(): CountryFeatureCollection {
  if (collection !== null) return collection

  const features: Array<CountryFeature> = []
  for (const [code, outline] of worldOutlines()) {
    const coordinates = polygonsOf(outline)
    if (coordinates.length === 0) continue
    features.push({
      type: 'Feature',
      id: code,
      geometry: { type: 'MultiPolygon', coordinates },
      properties: { code },
    })
  }

  collection = { type: 'FeatureCollection', features }
  return collection
}

/**
 * The same land, merged into one anonymous MultiPolygon.
 *
 * What a style's ground underlay wants: no identity, no properties, one feature
 * to paint. The polygons are the *same arrays* {@link countryFeatures} holds, so
 * this view adds 285 references rather than a second copy of 8,937 coordinate
 * pairs. Nothing mutates either payload; both are memoised and shared.
 */
export function worldLandFeatures(): LandFeatureCollection {
  if (land !== null) return land

  const coordinates: MultiPolygonCoordinates = []
  for (const feature of countryFeatures().features) {
    for (const polygon of feature.geometry.coordinates)
      coordinates.push(polygon)
  }

  land = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'MultiPolygon', coordinates },
        properties: {},
      },
    ],
  }
  return land
}

/**
 * Every bundled country's rectangle, solved once.
 *
 * Built eagerly over the whole geometry rather than filled in per lookup, so the
 * table is keyed by what `./world` carries and never by what a caller asked for.
 * A search box feeding this every keystroke therefore cannot grow it.
 */
function boundsTable(): ReadonlyMap<string, MapBounds> {
  if (boundsByCode !== null) return boundsByCode

  const table = new Map<string, MapBounds>()
  for (const [code, outline] of worldOutlines()) {
    const bounds = boundsForPoints(outline.flat())
    if (bounds !== null) table.set(code, bounds)
  }

  boundsByCode = table
  return boundsByCode
}

/**
 * The rectangle a country fits inside, or `null` for a code we cannot draw.
 *
 * The eastern edge may exceed 180° for a country that crosses the antimeridian —
 * Russia comes back as 19.66…190.1 — which is exactly how MapLibre expresses a
 * crossing to `fitBounds`. Latitudes are clamped to what Web Mercator can render,
 * so Antarctica frames instead of failing.
 *
 * Case-insensitive, and the same code always returns the identical object: a
 * fly-to from search re-asks for the same country every time the reader retypes
 * its name.
 */
export function countryBounds(countryCode: string): MapBounds | null {
  return boundsTable().get(countryCode.toUpperCase()) ?? null
}
