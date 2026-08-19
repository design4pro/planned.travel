/**
 * The world as one feature per country.
 *
 * The ground underlay in `./style` merges every coastline into a single
 * property-less MultiPolygon, which is the right shape for drawing land and the
 * wrong shape for everything else: a data-driven fill needs to know *which*
 * country it is painting, a hover needs a stable feature id to hang a
 * `feature-state` on, and a search result needs a rectangle to fly the camera
 * to. This module is that second view of the same bundled geometry — the same
 * rings from `./world`, cut per ISO 3166-1 alpha-2 code and closed so MapLibre
 * can fill them.
 *
 * Two details are load-bearing:
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
 *
 * Pure and memoised at module scope: a theme switch rebuilds the style document
 * and re-encoding 8,652 vertices on every switch would be a visible stall.
 */

import { boundsForPoints } from './bounds'
import { worldOutlines } from './world'

import type { LngLat, MapBounds } from './bounds'

/**
 * One country, ready for a MapLibre `geojson` source.
 *
 * `id` repeats `properties.code` because the two are read from different places:
 * `feature-state` addresses a feature by `id`, while a paint expression reads
 * `['get', 'code']`.
 *
 * Arrays are deliberately mutable so the value satisfies MapLibre's own GeoJSON
 * types without a cast. Treat the memoised result as immutable regardless.
 */
export interface CountryFeature {
  readonly type: 'Feature'
  readonly id: string
  readonly geometry: {
    readonly type: 'MultiPolygon'
    readonly coordinates: Array<Array<Array<[number, number]>>>
  }
  readonly properties: { readonly code: string }
}

/** Every country the bundled geometry can draw, as one source payload. */
export interface CountryFeatureCollection {
  readonly type: 'FeatureCollection'
  readonly features: Array<CountryFeature>
}

/**
 * Sovereign states with no bundled outline.
 *
 * Natural Earth's 1:110m cut drops anything smaller than about a pixel at world
 * scale, which is 29 of the 195 states the tracker counts: the micro-states, the
 * Caribbean lesser Antilles and most of the Pacific. A country in here can be
 * visited, counted and listed, but it cannot be filled on the map — so callers
 * annotate it rather than let it vanish without a word.
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

let collection: CountryFeatureCollection | null = null

const boundsByCode = new Map<string, MapBounds | null>()

/** Closes a ring, because a fill with an open ring renders with a seam. */
function closedRing(ring: ReadonlyArray<LngLat>): Array<[number, number]> {
  const out: Array<[number, number]> = ring.map(([lng, lat]) => [lng, lat])
  const first = out[0]
  const last = out[out.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    out.push([first[0], first[1]])
  }
  return out
}

/**
 * Every country as its own feature, keyed and identified by ISO alpha-2.
 *
 * Built once and handed back by reference: MapLibre diffs a `geojson` source by
 * identity before it re-tiles, so returning a fresh object on every render would
 * retile 175 polygons for nothing.
 */
export function countryFeatures(): CountryFeatureCollection {
  if (collection !== null) return collection

  const features: Array<CountryFeature> = []
  for (const [code, outline] of worldOutlines()) {
    const coordinates: Array<Array<Array<[number, number]>>> = []
    for (const ring of outline) {
      // Fewer than three vertices enclose no area, so a degenerate ring costs a
      // tessellation that draws nothing.
      if (ring.length < 3) continue
      coordinates.push([closedRing(ring)])
    }
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
 * The rectangle a country fits inside, or `null` for a code we cannot draw.
 *
 * The eastern edge may exceed 180° for a country that crosses the antimeridian —
 * Russia comes back as 19.66…190.1 — which is exactly how MapLibre expresses a
 * crossing to `fitBounds`. Latitudes are clamped to what Web Mercator can render,
 * so Antarctica frames instead of failing.
 *
 * Memoised per code: a fly-to from search re-asks for the same country every time
 * the reader retypes its name.
 */
export function countryBounds(countryCode: string): MapBounds | null {
  const code = countryCode.toUpperCase()
  const cached = boundsByCode.get(code)
  if (cached !== undefined) return cached

  const outline = worldOutlines().get(code)
  const bounds = outline === undefined ? null : boundsForPoints(outline.flat())
  boundsByCode.set(code, bounds)
  return bounds
}
