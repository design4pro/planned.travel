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
 *
 * ## Two cuts, and the budget for the finer one
 *
 * The bundle above is Natural Earth 1:110m, and it is a silhouette: Spain is one
 * 42-vertex ring with neither the Canaries nor the Balearics, France is three
 * rings, and 75 assigned ISO codes have no shape at all. That is the right
 * trade for the two callers that need land *synchronously* — the server-rendered
 * world map, which inlines the paths into the document, and the style's ground
 * underlay, which draws before any tile can arrive — and the wrong trade for a
 * tracker that colours countries one at a time.
 *
 * So there is a second cut, built by `scripts/build-country-outlines.mjs` from
 * Natural Earth 1:50m and served as a version-stamped static file. It is
 * **fetched, never imported**: an `import()` of a 300KB string is still an edge
 * in the module graph, so it would be emitted into the SSR bundle and counted
 * against the Worker's compressed size limit, for a payload no server-rendered
 * page ever draws. As a file under `public/atlas/` it is a Workers Asset — one
 * copy, in `dist/client`, served from cache without waking the Worker at all.
 * {@link loadCountryDetail} is the door; {@link COUNTRY_DETAIL_URL} is the key.
 *
 * **Measured, against a ceiling of 384KiB raw and 128KiB gzip:**
 *
 * | cut | codes | rings | vertices | raw | gzip |
 * |---|---|---|---|---|---|
 * | 1:110m, bundled | 175 | 285 | 8,652 | 62KB | ~25KB |
 * | **1:50m, shipped** | **237** | **1,617** | **50,413** | **302.7KiB** | **107.7KiB** |
 * | 1:10m, rejected | 238 | 4,082 | 116,779 | 651.9KiB | 221.0KiB |
 *
 * 1:10m is rejected on measurement, not on principle. Through the same script at
 * the same tolerance it is 2.3× the vertices and 2.05× the transfer — over the
 * ceiling on its own — and it buys nothing visible: the outlines are quantised
 * to a hundredth of a degree, {@link COUNTRY_SOURCE_MAX_ZOOM} stops the source
 * sub-dividing at zoom 5, and the atlas fades its country fill out by zoom 6, so
 * every extra vertex lands inside a pixel that is already painted. It also loses
 * Vatican City, whose 1:10m ring collapses on that grid where the 1:50m one does
 * not. For scale: the reference product ships the same feature as ~4.3MB gzipped
 * and ~30MB of GeoJSON decoded on every atlas load. This is 2.5% of that.
 *
 * Decoding the finer payload costs about 12ms in Node — 7ms to walk the deltas,
 * 5ms to close, clamp and freeze 1,617 rings — and it happens once, off the
 * first-paint path, after the fetch resolves.
 */

import { boundsForPoints, clampLatitude } from './bounds'
import { decodeOutlines, worldOutlines } from './world'

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
 * The zoom past which a country source stops sub-dividing.
 *
 * Both cuts quantise to a hundredth of a degree, about a kilometre, and the
 * finer one is simplified to two hundredths — one tile pixel at zoom 5, where a
 * pixel spans 0.022° of longitude at the equator. Tiling past the grid the
 * vertices sit on only buys memory: the same coordinates, cut into four times as
 * many tiles per level. Overzooming the z5 tiles draws exactly the same shape.
 *
 * So this is not a number to raise by hand when the geometry gets finer. It
 * follows the grid, and the finer cut deliberately shares the grid — see the
 * budget table at the top of the file for why a finer grid was not worth buying.
 */
export const COUNTRY_SOURCE_MAX_ZOOM = 5

/**
 * Assigned ISO codes with no geometry anywhere on the map.
 *
 * Two of them, and neither is a place a traveller books a flight to: Bouvet
 * Island, an uninhabited glacier in the South Atlantic whose nearest drawn land
 * is Antarctica 15° away, and the United States Minor Outlying Islands, nine
 * scattered atolls whose nearest drawn land is 16° off. Natural Earth's 1:50m
 * cut has no polygon for either, so nothing on the map represents them.
 *
 * The companion list is the other half of the answer and the more interesting
 * one: {@link UNMAPPED_TERRITORY_CODES} names the codes whose land *is* drawn,
 * inside the country that administers it. Together they are every
 * officially-assigned code the finer cut cannot fill — thirteen, down from the
 * seventy-five the bundled 1:110m cut leaves unfillable.
 *
 * These describe the finest cut we ship, which arrives over the network. Until
 * it does, the bundled cut is what the map draws and it is much coarser, so
 * {@link hasCountryOutline} — not this list — is the runtime question.
 *
 * Sorted, so a reader can find a code by eye. Verified against the shipped asset
 * by test.
 */
export const UNMAPPED_COUNTRY_CODES: ReadonlyArray<string> = ['BV', 'UM']

/**
 * Assigned ISO codes whose land is drawn, but not under their own name.
 *
 * Natural Earth's Admin 0 cut is the *sovereign* one, so a dependency's
 * coastline belongs to the feature of the country that administers it: Réunion,
 * Mayotte, Guadeloupe, Martinique and French Guiana are all part of France's
 * shape, Svalbard part of Norway's, the Cocos and Christmas Islands part of
 * Australia's, Bonaire part of the Netherlands', Tokelau part of New Zealand's,
 * and Gibraltar sits inside Spain's coastline at this scale. Every one of them
 * has geometry within a degree of where it belongs — it simply answers to
 * another code.
 *
 * That is a deliberate choice rather than a limitation of the source. Natural
 * Earth also publishes a map-units cut that splits France into the metropole
 * plus each overseas département under its own code, and adopting it would fill
 * eleven of these thirteen. It would also redefine what "France" means on a map
 * that colours what you have visited, while drawing exactly the same land. The
 * sovereign cut is what a country tracker colours, so these codes are listed
 * rather than carved out.
 *
 * Sorted, so a reader can find a code by eye. Verified against the shipped asset
 * by test.
 */
export const UNMAPPED_TERRITORY_CODES: ReadonlyArray<string> = [
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
let detail: CountryDetail | null = null
let detailIndex: ReadonlyMap<string, MultiPolygonCoordinates> | null = null
let detailPending: Promise<CountryDetail> | null = null

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
 * The finest cut installed: the fetched 1:50m detail if it has arrived, and the
 * bundled 1:110m cut until then.
 *
 * Only two answers move when the detail lands — {@link hasCountryOutline} and
 * {@link countryBounds}, the two that describe *a country* rather than *the
 * payload a source was built from*. {@link countryFeatures} and
 * {@link worldLandFeatures} stay on the bundle for the life of the process,
 * because their consumers hold them by reference and a payload that changed
 * underneath a MapLibre source without a `setData` would be a lie.
 */
function fillableOutlines(): ReadonlyMap<string, MultiPolygonCoordinates> {
  return detailIndex ?? drawableOutlines()
}

/**
 * True when the map can actually fill this code.
 *
 * The general form of the two unmapped lists, and the question a list row or a
 * search result usually wants answered: it takes any string, including a code
 * neither list names, and never grows anything.
 *
 * Answers from the finest cut installed, so it says yes to Singapore, Malta and
 * the Maldives once {@link loadCountryDetail} has resolved and no before that.
 * A caller that renders the answer should re-read it when the detail lands.
 */
export function hasCountryOutline(countryCode: string): boolean {
  return fillableOutlines().has(countryCode.toUpperCase())
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
 *
 * Offshore rings are what make the two-solution search earn its keep. With the
 * finer cut installed, France reaches from Guadeloupe at 61.8°W to Réunion at
 * 55.8°E — 118° across a rectangle that contains no French land for most of its
 * width, and 242° if the solver takes the shifted branch by mistake. The United
 * States gains the western Aleutians and only the shifted branch keeps it off
 * the whole line; Chile gains Easter Island; Ecuador the Galápagos. Every one of
 * them still has to come back narrower than {@link ENCIRCLING_SPAN_DEGREES}, and
 * a test asserts it for all of them rather than for the handful named here.
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
  for (const [code, polygons] of fillableOutlines()) {
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
 *
 * Solved over the finest cut installed, so a country's rectangle grows to hold
 * its offshore territories the moment {@link loadCountryDetail} resolves — and
 * so the codes that only the finer cut can draw stop coming back `null`.
 */
export function countryBounds(countryCode: string): MapBounds | null {
  return boundsTable().get(countryCode.toUpperCase()) ?? null
}

/* -------------------------------------------------------------------------------------------------
 * The finer cut
 * ---------------------------------------------------------------------------------------------- */

/**
 * Where the finer outlines are served from.
 *
 * Version-stamped and never overwritten, which is the only way an asset served
 * from a shared cache can be replaced safely: a new cut is a new filename and a
 * new constant, so nothing has to expire. Root-relative, because it is a Workers
 * Asset served from this origin, and reachable from `vite dev` the same way.
 */
export const COUNTRY_DETAIL_URL = '/atlas/country-outlines-50m.v1.txt'

/**
 * The header line of the asset, parsed.
 *
 * The payload states its own provenance and shape so a reader — and a test — can
 * check what arrived rather than trusting the filename. `grid` is units per
 * degree and is what the delta decoder needs; the counts are what the build
 * measured, and a decode that disagrees with them means a truncated download.
 */
export interface CountryDetailManifest {
  readonly version: number
  readonly source: string
  readonly grid: number
  readonly codes: number
  readonly rings: number
  readonly vertices: number
}

/**
 * The finer cut, decoded and ready to hand to MapLibre.
 *
 * `source` is the whole source definition rather than the data alone, for the
 * same reason {@link countrySource} is: `promoteId` is not optional, and a
 * caller assembling three-quarters of a source is a hover that silently does
 * nothing.
 */
export interface CountryDetail {
  readonly manifest: CountryDetailManifest
  readonly features: CountryFeatureCollection
  readonly source: CountrySource
}

/** How the asset is fetched. Injectable so the decode can be tested offline. */
export type CountryDetailFetcher = (url: string) => Promise<Response>

const defaultDetailFetcher: CountryDetailFetcher = (url) => fetch(url)

/** Reads `key=value key=value` into a lookup, ignoring anything malformed. */
function manifestFields(line: string): ReadonlyMap<string, string> {
  const fields = new Map<string, string>()
  for (const token of line.trim().split(/\s+/)) {
    const split = token.indexOf('=')
    if (split <= 0) continue
    fields.set(token.slice(0, split), token.slice(split + 1))
  }
  return fields
}

/**
 * A manifest number, or a throw naming the field — never a silent `NaN`.
 *
 * An absent field and an empty one are both rejected, because `Number('')` is
 * zero and a grid of zero would divide every coordinate into infinity.
 */
function manifestNumber(
  fields: ReadonlyMap<string, string>,
  key: string,
): number {
  const raw = fields.get(key)
  const value = raw === undefined || raw === '' ? Number.NaN : Number(raw)
  if (!Number.isFinite(value)) {
    throw new Error(`country outlines: manifest is missing ${key}`)
  }
  return value
}

/**
 * Turns the asset's text into the payload a map can use.
 *
 * Exported so the decode is testable without a network, and separately from
 * {@link loadCountryDetail} so a failure has one of two obvious causes: the
 * fetch, or the bytes.
 *
 * Validated rather than trusted. The counts in the header are compared against
 * what actually decoded, because a truncated response still parses — the delta
 * encoding has no terminator — and would quietly draw half a world.
 */
export function parseCountryDetail(payload: string): CountryDetail {
  const newline = payload.indexOf('\n')
  if (newline <= 0) throw new Error('country outlines: no manifest line')

  const fields = manifestFields(payload.slice(0, newline))
  const manifest: CountryDetailManifest = {
    version: manifestNumber(fields, 'version'),
    source: fields.get('source') ?? '',
    grid: manifestNumber(fields, 'grid'),
    codes: manifestNumber(fields, 'codes'),
    rings: manifestNumber(fields, 'rings'),
    vertices: manifestNumber(fields, 'vertices'),
  }
  if (manifest.grid <= 0) {
    throw new Error(`country outlines: grid=${manifest.grid} is not a grid`)
  }

  const outlines = decodeOutlines(payload.slice(newline + 1).trim(), manifest.grid)
  const features: Array<CountryFeature> = []
  let rings = 0
  let vertices = 0

  for (const [code, outline] of outlines) {
    for (const ring of outline) {
      // The build already dropped every ring that encloses nothing, so this
      // counts what arrived rather than what survives — a mismatch is a
      // truncated download, not a degenerate island.
      rings += 1
      vertices += ring.length
    }
    const coordinates = polygonsOf(outline)
    if (coordinates.length === 0) continue
    features.push(
      frozen<CountryFeature>({
        type: 'Feature',
        id: code,
        geometry: frozen({ type: 'MultiPolygon', coordinates }),
        properties: frozen({ [COUNTRY_CODE_PROPERTY]: code }),
      }),
    )
  }

  if (
    features.length !== manifest.codes ||
    rings !== manifest.rings ||
    vertices !== manifest.vertices
  ) {
    throw new Error(
      `country outlines: decoded ${features.length}/${rings}/${vertices} against a manifest of ${manifest.codes}/${manifest.rings}/${manifest.vertices}`,
    )
  }

  const decoded = frozen<CountryFeatureCollection>({
    type: 'FeatureCollection',
    features: frozen(features),
  })

  return frozen<CountryDetail>({
    manifest,
    features: decoded,
    source: frozen<CountrySource>({
      type: 'geojson',
      data: decoded,
      // Not optional. Without it MapLibre runs the string id through `parseInt`,
      // `'FR'` becomes `NaN` becomes `0`, and every country in the payload
      // shares one feature-state: hover one, light them all.
      promoteId: COUNTRY_CODE_PROPERTY,
      maxzoom: COUNTRY_SOURCE_MAX_ZOOM,
    }),
  })
}

/**
 * The finer cut, once it has arrived — or `null`.
 *
 * Synchronous and stable: it returns the identical object between loads, so it
 * is safe as a `useSyncExternalStore` snapshot or an effect dependency.
 */
export function countryDetail(): CountryDetail | null {
  return detail
}

/**
 * Fetches, decodes and installs the finer cut.
 *
 * Idempotent and shared: concurrent callers await one request and one decode,
 * and a caller after it has landed gets the installed payload without touching
 * the network. A failure clears the shared promise, so a retry is a retry rather
 * than the same rejection handed out forever.
 *
 * Client-side only, and deliberately so. The URL is root-relative because it is
 * an asset of this origin; a server render has no origin to resolve it against
 * and no map to draw with it, and the whole point of the fetch is that these
 * bytes never enter the Worker.
 *
 * Installing is atomic and it moves three answers together — the payload this
 * resolves with, {@link hasCountryOutline}, and {@link countryBounds}. A caller
 * that swaps its source to `detail.source` therefore has a layer, an outline
 * predicate and a fly-to rectangle that all describe the same world. A caller
 * that ignores the result gets a rectangle that can be wider than the shapes it
 * draws, which is why this returns the source rather than merely announcing it.
 */
export function loadCountryDetail(
  fetcher: CountryDetailFetcher = defaultDetailFetcher,
): Promise<CountryDetail> {
  if (detail !== null) return Promise.resolve(detail)
  if (detailPending !== null) return detailPending

  const request = (async () => {
    const response = await fetcher(COUNTRY_DETAIL_URL)
    if (!response.ok) {
      throw new Error(
        `country outlines: ${COUNTRY_DETAIL_URL} responded ${response.status}`,
      )
    }
    const parsed = parseCountryDetail(await response.text())

    const index = new Map<string, MultiPolygonCoordinates>()
    for (const feature of parsed.features.features) {
      index.set(feature.properties.code, feature.geometry.coordinates)
    }

    detail = parsed
    detailIndex = index
    // The rectangles were solved over the coarser cut and are now wrong by a
    // continent for anything with an offshore territory.
    boundsByCode = null
    return parsed
  })()

  // One promise for everybody, and it clears itself on the way out so the next
  // caller starts a fresh request instead of re-reading an old failure.
  detailPending = request.catch((error: unknown) => {
    detailPending = null
    throw error
  })
  return detailPending
}
