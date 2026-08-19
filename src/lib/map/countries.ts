/**
 * The world as one feature per country.
 *
 * A ground underlay wants a single property-less MultiPolygon: the right shape
 * for painting land, and the wrong shape for everything else. A data-driven fill
 * needs to know *which* country it is painting, a hover needs a stable feature id
 * to hang a `feature-state` on, and a search result needs a rectangle to fly the
 * camera to. This module answers all of those from one build of the bundled
 * geometry — the 285 rings from `./world`, cut per ISO 3166-1 alpha-2 code,
 * clamped to what Web Mercator can draw and closed so MapLibre can fill them.
 *
 * Two views, one implementation:
 *
 * - {@link countryFeatures} is the per-country payload, identified by ISO2. Pair
 *   it with {@link countrySource}, which is the only way to add it that keeps the
 *   string id addressable after tiling.
 * - {@link worldLandFeatures} is the same land merged and anonymised, and its
 *   consumer is the ground underlay in `./style` — the `world-land` source that
 *   draws coastlines when no tile archive is reachable. It holds the *same ring
 *   arrays* the per-country view holds, so a screen that draws both pays 285
 *   extra references rather than a second copy of 8,937 coordinate pairs.
 *
 * Three details are load-bearing:
 *
 * - **Every ring is its own polygon.** GeoJSON reads the second ring of a
 *   polygon as a hole, and the bundled outlines are all *outer* rings, so a
 *   country's islands have to be separate polygons inside one MultiPolygon or
 *   Hokkaido would be punched out of Japan.
 * - **Latitude is clamped to the Mercator limit before anything else sees it.**
 *   Antarctica's outline closes across the South Pole, and Web Mercator projects
 *   ±90° to infinity. The clamp happens in the geometry, not only in the bounds,
 *   so a fill and its fly-to describe the same country.
 * - **Bounds are solved in a wrapped longitude space.** Rings are pre-cut at the
 *   antimeridian, so Russia carries one ring ending at 180° and another starting
 *   at -180°. Taking the naive minimum and maximum of those gives -180…180 — the
 *   whole planet — for Russia, Fiji and anything else that straddles the line.
 *   {@link countryBounds} defers to `boundsForPoints`, which solves longitude
 *   twice and keeps the narrower answer, and then handles the one shape that
 *   genuinely encircles the planet.
 *
 * Memoised at module scope for a reason specific to this payload: a MapLibre
 * `geojson` source only re-tiles when its `data` changes by reference, and a
 * theme switch replaces the whole style document, so every runtime layer tears
 * its source down and asks for the payload again. Returning a fresh object would
 * re-tile 175 MultiPolygons on each of those, for no visual difference. Because
 * the payloads are shared and long-lived, everything handed out here is frozen:
 * the declared types stay mutable so MapLibre's own GeoJSON vocabulary accepts
 * them without a cast, but a stray in-place edit throws instead of quietly
 * corrupting both views for the life of the tab.
 */

import { boundsForPoints, clampLatitude } from './bounds'
import { worldOutlines } from './world'

import type { MapBounds } from './bounds'
import type { WorldOutline, WorldRing } from './world'
import type { MapOptions } from 'maplibre-gl'

/**
 * MultiPolygon coordinates: polygons, each a list of rings, each a list of
 * `[longitude, latitude]` pairs.
 *
 * Deliberately mutable so the values satisfy MapLibre's own GeoJSON types
 * without a cast. Everything memoised here is frozen at runtime regardless.
 */
export type MultiPolygonCoordinates = Array<Array<Array<[number, number]>>>

/**
 * One country, ready for a MapLibre `geojson` source.
 *
 * `id` repeats `properties.code` because the two are read from different places:
 * `feature-state` addresses a feature by `id`, while a paint expression reads
 * `['get', 'code']`. Tiling only carries the string id across when the source
 * declares `promoteId`, which is why {@link countrySource} exists.
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
 * A `geojson` source definition, recovered from the one option type MapLibre
 * exports — the same route `./style` takes, because the style-spec vocabulary is
 * not re-exported from the package root.
 */
export type CountrySource = Extract<
  NonNullable<
    Exclude<NonNullable<MapOptions['style']>, string>['sources']
  >[string],
  { type: 'geojson' }
>

/**
 * The feature property that carries the ISO2 code.
 *
 * Exported because two separate things must agree on it: the `promoteId` of the
 * source, and any paint expression that reads `['get', COUNTRY_CODE_PROPERTY]`.
 */
export const COUNTRY_CODE_PROPERTY = 'code'

/**
 * The zoom past which the country source stops sub-dividing.
 *
 * `./world` quantises outlines to a hundredth of a degree, about a kilometre. A
 * tile pixel is finer than that from roughly zoom 6, so tiling further only buys
 * memory: the same vertices, cut into four times as many tiles per level.
 * Overzooming the z5 tiles draws exactly the same shape.
 */
export const COUNTRY_SOURCE_MAX_ZOOM = 5

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
 * The longitudinal span past which a shape is treated as encircling the planet.
 *
 * Russia is the widest country that does not, at 170°. Antarctica solves to 356°
 * because its outline stops 4° short of the meridian it was cut on — a rectangle
 * that would report the continent absent from longitudes it plainly occupies.
 * Anything this wide wraps the whole line, so the honest rectangle is the whole
 * line.
 */
const ENCIRCLING_SPAN_DEGREES = 350

let drawable: ReadonlyMap<string, MultiPolygonCoordinates> | null = null
let collection: CountryFeatureCollection | null = null
let land: LandFeatureCollection | null = null
let source: CountrySource | null = null
let boundsByCode: ReadonlyMap<string, MapBounds> | null = null

/**
 * Freezes a value without narrowing its type.
 *
 * `Object.freeze` would rewrite these arrays as `readonly`, and MapLibre's
 * GeoJSON types want mutable ones. The protection is what matters here, not the
 * declaration: these payloads are memoised for the life of the process and two
 * views share their rings, so one in-place edit would corrupt both forever.
 */
function frozen<T extends object>(value: T): T {
  Object.freeze(value)
  return value
}

/**
 * Closes a ring, because a fill with an open ring renders with a seam, and pulls
 * it inside the Mercator limit on the way through.
 *
 * The single implementation: {@link countryFeatures} and
 * {@link worldLandFeatures} both read the arrays this returns, and neither
 * copies them again.
 */
function closedRing(ring: WorldRing): Array<[number, number]> {
  const out: Array<[number, number]> = ring.map(([lng, lat]) =>
    frozen<[number, number]>([lng, clampLatitude(lat)]),
  )
  const first = out[0]
  const last = out[out.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) {
    out.push(frozen<[number, number]>([first[0], first[1]]))
  }
  return frozen(out)
}

/** One closed single-ring polygon per drawable ring of one country. */
function polygonsOf(outline: WorldOutline): MultiPolygonCoordinates {
  const polygons: MultiPolygonCoordinates = []
  for (const ring of outline) {
    // Fewer than three vertices enclose no area, so a degenerate ring costs a
    // tessellation that draws nothing.
    if (ring.length < 3) continue
    polygons.push(frozen([closedRing(ring)]))
  }
  return frozen(polygons)
}

/**
 * The one index every export answers from: ISO2 → drawable polygons.
 *
 * Built once, and deliberately the *only* place that decides whether a country
 * is drawable. Reading `worldOutlines()` directly would let the three public
 * answers drift apart — a country whose rings are all degenerate would have no
 * feature to fill, yet still report an outline and a rectangle to fly to.
 */
function drawableOutlines(): ReadonlyMap<string, MultiPolygonCoordinates> {
  if (drawable !== null) return drawable

  const table = new Map<string, MultiPolygonCoordinates>()
  for (const [code, outline] of worldOutlines()) {
    const polygons = polygonsOf(outline)
    if (polygons.length === 0) continue
    table.set(code, polygons)
  }

  drawable = table
  return drawable
}

/**
 * True when the map can actually fill this code.
 *
 * The general form of the two unmapped lists, and the question a list row or a
 * search result usually wants answered: it takes any string, including a code
 * neither list names, and never grows anything.
 */
export function hasCountryOutline(countryCode: string): boolean {
  return drawableOutlines().has(countryCode.toUpperCase())
}

/**
 * Every country as its own feature, keyed and identified by ISO alpha-2.
 *
 * Built once and handed back by reference — see the note on memoisation at the
 * top of the file. Add it with {@link countrySource} rather than by hand.
 */
export function countryFeatures(): CountryFeatureCollection {
  if (collection !== null) return collection

  const features: Array<CountryFeature> = []
  for (const [code, coordinates] of drawableOutlines()) {
    features.push(
      frozen<CountryFeature>({
        type: 'Feature',
        id: code,
        geometry: frozen({ type: 'MultiPolygon', coordinates }),
        properties: frozen({ [COUNTRY_CODE_PROPERTY]: code }),
      }),
    )
  }

  collection = frozen<CountryFeatureCollection>({
    type: 'FeatureCollection',
    features: frozen(features),
  })
  return collection
}

/**
 * The country payload as a source MapLibre will keep the ids of.
 *
 * A `geojson` source drops a string `id` during tiling unless it is told which
 * property to promote, and the symptom is silent: `setFeatureState` succeeds,
 * the paint expression never sees the state, and the hover simply does nothing.
 * Handing out the whole source definition — data, `promoteId` and the zoom
 * ceiling together — is what stops a caller assembling three-quarters of it.
 *
 * Frozen and memoised, so it is safe to name directly in an effect's
 * dependencies. Spread it to override a field.
 */
export function countrySource(): CountrySource {
  if (source !== null) return source

  source = frozen<CountrySource>({
    type: 'geojson',
    data: countryFeatures(),
    promoteId: COUNTRY_CODE_PROPERTY,
    maxzoom: COUNTRY_SOURCE_MAX_ZOOM,
  })
  return source
}

/**
 * The same land, merged into one anonymous MultiPolygon.
 *
 * What the ground underlay in `./style` draws: no identity, no properties, one
 * feature to paint. The polygons are the *same arrays* {@link countryFeatures}
 * holds, so this view adds 285 references rather than a second copy of 8,937
 * coordinate pairs. Both payloads are frozen, so sharing them cannot backfire.
 */
export function worldLandFeatures(): LandFeatureCollection {
  if (land !== null) return land

  const coordinates: MultiPolygonCoordinates = []
  for (const polygons of drawableOutlines().values()) {
    for (const polygon of polygons) coordinates.push(polygon)
  }

  land = frozen<LandFeatureCollection>({
    type: 'FeatureCollection',
    features: frozen([
      frozen<LandFeature>({
        type: 'Feature',
        geometry: frozen({
          type: 'MultiPolygon',
          coordinates: frozen(coordinates),
        }),
        properties: frozen({}),
      }),
    ]),
  })
  return land
}

/**
 * The rectangle one country's polygons fit inside.
 *
 * `boundsForPoints` solves the antimeridian by keeping the narrower of two
 * longitude solutions, which is right for every country that crosses the line
 * and wrong for the one that surrounds the pole: Antarctica is present at every
 * longitude, and the tightest rectangle around its vertices claims otherwise.
 */
function outlineBounds(polygons: MultiPolygonCoordinates): MapBounds | null {
  const points: Array<[number, number]> = []
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const point of ring) points.push(point)
    }
  }

  const bounds = boundsForPoints(points)
  if (bounds === null) return null
  if (bounds.east - bounds.west < ENCIRCLING_SPAN_DEGREES) return frozen(bounds)

  return frozen<MapBounds>({
    west: -180,
    south: bounds.south,
    east: 180,
    north: bounds.north,
  })
}

/**
 * Every drawable country's rectangle, solved once.
 *
 * Built eagerly over the whole geometry rather than filled in per lookup, so the
 * table is keyed by what the map can draw and never by what a caller asked for.
 * A search box feeding this every keystroke therefore cannot grow it.
 */
function boundsTable(): ReadonlyMap<string, MapBounds> {
  if (boundsByCode !== null) return boundsByCode

  const table = new Map<string, MapBounds>()
  for (const [code, polygons] of drawableOutlines()) {
    const bounds = outlineBounds(polygons)
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
 * matching the geometry {@link countryFeatures} emits, so Antarctica frames
 * instead of failing.
 *
 * Case-insensitive, and the same code always returns the identical object: a
 * fly-to from search re-asks for the same country every time the reader retypes
 * its name.
 */
export function countryBounds(countryCode: string): MapBounds | null {
  return boundsTable().get(countryCode.toUpperCase()) ?? null
}
