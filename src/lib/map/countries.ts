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
 * - **A country's rectangle is a frame, not a measurement.** Once the finer cut
 *   lands, the tightest rectangle around France is 118° wide and almost all of
 *   it is the Atlantic. {@link frameBounds} builds the frame outwards from the
 *   principal landmass instead, so "show me France" is France and the overseas
 *   départements stay drawn, filled and hoverable.
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
 * **Measured, against a ceiling of 384KiB raw and 128KiB gzip.** Every figure
 * below is a real measurement, gzip at level 9 — but the three rows do not
 * measure the same kind of thing, and an earlier version of this paragraph said
 * they did, so each row states its own provenance:
 *
 * - **1:110m, bundled** measures the `ENCODED` payload string in `./world`
 *   exactly as it ships. It was cut with Douglas–Peucker at **0.08°**, which is
 *   that module's tolerance and not this script's, and it is not rebuilt here.
 *   Its raw figure is the string alone, because a bundled payload has no
 *   manifest line to carry; the two asset rows are whole files.
 * - **1:50m, shipped** and **1:10m, rejected** are both output of
 *   `scripts/build-country-outlines.mjs`, at its own **0.02°** tolerance, on the
 *   same grid and through the same encoder. The shipped row is the committed
 *   asset byte for byte. The rejected row is a throwaway build of the 1:10m
 *   source, which the script takes without pretending the result is the pinned
 *   dataset:
 *
 *   ```sh
 *   node scripts/build-country-outlines.mjs --source-id natural-earth-10m \
 *     --source https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries.geojson \
 *     --out /tmp/country-outlines-10m.txt
 *   ```
 *
 * | cut | tolerance | codes | rings | vertices | raw | gzip |
 * |---|---|---|---|---|---|---|
 * | 1:110m, bundled | 0.08° | 175 | 285 | 8,652 | 62,983 B / 61.5KiB | 25.2KiB |
 * | **1:50m, shipped** | **0.02°** | **237** | **1,617** | **50,413** | **309,993 B / 302.7KiB** | **107.7KiB** |
 * | 1:10m, rejected | 0.02° | 238 | 4,082 | 116,779 | 667,570 B / 651.9KiB | 221.0KiB |
 *
 * A test re-measures both the shipped row and the bundled row on every run and
 * holds them to those bytes and to the ceiling, so the table stays true after
 * the next rebuild rather than only on the day it was written.
 *
 * 1:10m is rejected on measurement, not on principle. It is 2.3× the vertices
 * and 2.05× the transfer — 173% of the gzip ceiling on its own — and it buys
 * nothing visible: the outlines are quantised to a hundredth of a degree,
 * {@link COUNTRY_SOURCE_MAX_ZOOM} stops the source sub-dividing at zoom 5, and
 * the atlas fades its country fill out by zoom 6, so every extra vertex lands
 * inside a pixel that is already painted. It also loses Vatican City, whose
 * 1:10m ring collapses on that grid where the 1:50m one does not. For scale: the
 * reference product ships the same feature as ~4.3MB gzipped and ~30MB of
 * GeoJSON decoded on every atlas load. This is 2.5% of that.
 *
 * That the bytes stay out of the Worker is checkable rather than asserted — but
 * the check needs building with some care, because two things that are *not* the
 * payload look like it to a careless grep. The first is {@link COUNTRY_DETAIL_URL}:
 * a page that will later fetch the asset ships the string that names it, and a
 * string is not 300KB of coordinates. The second is this comment block, which
 * the SSR build preserves verbatim — so a proof that spells its own needle out
 * matches itself, which is exactly how the first version of this paragraph came
 * to be false.
 *
 * So take the needle from the asset. Its manifest line is the payload's first
 * line, and a test pins that no file under `src/` or `scripts/` contains it, so
 * a hit anywhere in a build output can only be a copy of the payload:
 *
 * ```sh
 * pnpm build
 * needle=$(head -1 public/atlas/country-outlines-50m.v1.txt)
 * grep -rlF "$needle" dist/server       # silent: no copy in the Worker bundle
 * grep -rlF "$needle" dist/client       # one path: the asset, served as an asset
 * find dist -name '*country-outlines*'  # the same single path, under dist/client
 * ```
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

/* -------------------------------------------------------------------------------------------------
 * Framing
 * ---------------------------------------------------------------------------------------------- */

/**
 * How much a rectangle may grow for nothing.
 *
 * A camera never fits a rectangle to the pixel: `DEFAULT_FIT_PADDING` keeps 48
 * CSS pixels clear on every edge, which on a 900px-tall canvas is about a tenth
 * of the axis. A rectangle that grows 7% on each axis — 15% of its area — is
 * still inside the gutter the fit was going to leave anyway, so whether it holds
 * that ring or not is a difference the reader cannot see. Below this, a ring is
 * taken without further argument.
 *
 * Six rings on the whole planet are taken by this clause and no other, and they
 * are exactly the kind of thing an argument about them would be a waste of:
 * Tasmania (13.5% of Australia's frame), Kaliningrad (4.8% of Russia's),
 * Canada's high Arctic islands (11.9%) and three Antarctic outliers.
 */
const FRAME_FREE_GROWTH = 0.15

/**
 * How far off the frame a ring may sit and still count as part of the shape.
 *
 * Measured between rectangles, with longitude corrected for latitude. The atlas
 * frames a country at zoom 5.6 at the very most — {@link COUNTRY_SOURCE_MAX_ZOOM}
 * and the fill's own fade see to that — where a degree and a half of longitude
 * is about 130 CSS pixels: an island that close reads as attached to the coast
 * beside it, and cropping it out of its own country is worse than the zoom step
 * it costs. Measured on the shipped cut, this clause is the only thing that
 * takes Corsica (0.31° off metropolitan France), Shetland (1.23° off Great
 * Britain), Bornholm (1.17° off Zealand), Jeju (0.76° off South Korea) and 55
 * more. The nearest refusals are Amami-Ōshima, 1.72° off Kyushu, and the
 * Chatham Islands, 3.41° off New Zealand.
 */
const FRAME_NEAR_DEGREES = 1.5

/**
 * How much frame a ring may cost, per unit of land it adds.
 *
 * The clause that keeps a country with two real halves whole, and the only one
 * that can buy a ring an ocean away. Measured on the shipped cut, against the
 * frame each ring was actually offered — cost is the fraction the rectangle
 * grows by, and the offer is the ring's area against the land already framed:
 *
 * - Sumatra costs Indonesia 2.19 and offers 0.81; Indonesian Papua costs 1.46
 *   and offers 0.40; Mindanao costs the Philippines 2.40 and offers 0.89;
 *   Peninsular Malaysia costs 0.97 and offers 0.67; Svalbard costs Norway 0.40
 *   and offers 0.13. All five are bought, and no other clause would have taken
 *   any of them.
 * - Alaska asks the contiguous states for 1.80 and offers 0.19. French Guiana
 *   asks France for 34.5 and offers 0.16, Réunion 43.1 for 0.005. All refused.
 *
 * That puts the honest band at 3.67 — Papua, the tightest purchase — up to 9.2,
 * where Alaska would start dragging the United States across the Pacific. The
 * only ring anywhere between 5 and 9 is a 0.004°² islet north of Saipan, so the
 * number can sit near the bottom of the band without the choice being a fit to
 * one country.
 */
const FRAME_LAND_WEIGHT = 5

/**
 * The smallest area a rectangle is allowed to be divided by.
 *
 * Both cuts quantise to a hundredth of a degree, so one grid cell is 1e-4
 * square degrees and nothing the payload can express is smaller. Monaco, the
 * Vatican and a Maldivian atoll all land there, and without a floor the first
 * ring of one of them would divide by zero and refuse every other ring it owns.
 */
const MIN_FRAME_AREA = 1e-4

/** One ring, reduced to what the framing solver reads. */
interface FrameRing {
  readonly bounds: MapBounds
  /** Square degrees, corrected for how longitude narrows towards the pole. */
  readonly area: number
  /** Set once the ring has been taken into the frame. */
  taken: boolean
}

/**
 * A ring's area in square degrees, corrected for its latitude.
 *
 * The shoelace formula over raw longitude and latitude, scaled by the cosine of
 * the ring's mean latitude, because a degree of longitude at 70°N is a third of
 * one at the equator and Svalbard would otherwise outweigh Sicily. It is not an
 * area in km² and does not need to be: every comparison made here is between
 * two rings of the same country, and only the ratio is read.
 *
 * Rings are pre-cut at the antimeridian, so none of them spans the seam and the
 * raw longitudes can be walked in the order they are stored.
 */
function ringArea(ring: ReadonlyArray<[number, number]>): number {
  let twice = 0
  let latitudes = 0
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const [previousLng, previousLat] = ring[previous]
    const [lng, lat] = ring[index]
    twice += previousLng * lat - lng * previousLat
    latitudes += lat
  }
  const mean = ((latitudes / ring.length) * Math.PI) / 180
  return Math.abs(twice / 2) * Math.cos(mean)
}

/** A rectangle's area, corrected the way {@link ringArea} corrects a ring's. */
function boundsArea(bounds: MapBounds): number {
  const middle = (((bounds.south + bounds.north) / 2) * Math.PI) / 180
  return (
    (bounds.east - bounds.west) *
    (bounds.north - bounds.south) *
    Math.cos(middle)
  )
}

/**
 * The distance between two rectangles, in degrees, or zero if they touch.
 *
 * Longitude is tried on all three copies of the line so a rectangle that has
 * already crossed the antimeridian — Russia's, once Chukotka is in it — is
 * still measured against an island on the other side of the seam as the short
 * way round. The two gaps combine as a right triangle with longitude scaled by
 * the cosine of the latitude both rectangles sit at, so 1° means about the same
 * distance on the ground in the Arctic as it does at the equator.
 */
function boundsGap(a: MapBounds, b: MapBounds): number {
  const lat = Math.max(0, a.south - b.north, b.south - a.north)
  let lng = Number.POSITIVE_INFINITY
  for (const shift of [-360, 0, 360]) {
    lng = Math.min(
      lng,
      Math.max(0, a.west - (b.east + shift), b.west + shift - a.east),
    )
  }
  const middle = (((a.south + a.north + b.south + b.north) / 4) * Math.PI) / 180
  return Math.hypot(lng * Math.cos(middle), lat)
}

/**
 * A rectangle as the four points that reproduce it.
 *
 * Rectangles are merged through these rather than by `Math.min`/`Math.max` so
 * the antimeridian stays solved in exactly one place: the corners go back
 * through `boundsForPoints`, which searches both longitude solutions and
 * therefore unions Chukotka onto Russia as 190.1°E instead of opening the
 * rectangle westwards across the Atlantic.
 */
function boundsCorners(bounds: MapBounds): Array<[number, number]> {
  return [
    [bounds.west, bounds.south],
    [bounds.west, bounds.north],
    [bounds.east, bounds.south],
    [bounds.east, bounds.north],
  ]
}

/**
 * The rectangle a camera should frame one country in.
 *
 * Not the rectangle the country fits inside. With the finer cut installed those
 * are different questions and only one of them has a useful answer: France's
 * full extent runs from Guadeloupe at 61.8°W to Réunion at 55.8°E, 118° of
 * which 116 are open ocean, and a camera fitted to it answers "show me France"
 * with the mid-Atlantic. The Netherlands reaches to Bonaire, Portugal to the
 * Azores, Chile to Easter Island, Ecuador to the Galápagos, the United States
 * from the Aleutians to the Virgin Islands. Every one of those territories is
 * still drawn, still filled and still lit by a hover — they are part of the
 * country's shape. They are simply not part of the picture a reader asked for
 * when they typed the country's name.
 *
 * So the frame is built rather than measured. The largest ring goes in first —
 * the principal landmass, which is what the reader came to see — and every
 * other ring is offered to the frame in descending order of area and taken when
 * any of three things is true:
 *
 * - it sits within {@link FRAME_NEAR_DEGREES} of the frame, so it reads as part
 *   of the same coastline at this zoom (Corsica, Shetland, Bornholm, Jeju);
 * - it costs less than {@link FRAME_FREE_GROWTH}, which is inside the padding
 *   the fit leaves anyway (Tasmania, Kaliningrad, the Canadian high Arctic);
 * - or the land it adds pays for the frame it costs, at
 *   {@link FRAME_LAND_WEIGHT} (Sumatra, Indonesian Papua, Svalbard).
 *
 * The pass repeats while anything was taken, because a ring is offered against
 * the frame as it stands rather than against the one it started with, and the
 * order rings arrive in should not decide the answer. It converges quickly and
 * it cannot walk: a ring too far and too small to be worth the frame is refused
 * again on every pass, and the frame stops growing. Solving all 237 countries
 * of the finer cut — 1,617 rings — costs 18ms in Node, once, on the first
 * rectangle asked for after the payload installs; a lookup after that is a
 * `Map.get`.
 *
 * One shape is exempt. Antarctica is present at every longitude, its extent is
 * 356° wide, and no rectangle around a subset of its rings describes it — so a
 * country whose *extent* encircles the planet is framed on the whole line, the
 * same answer this file has always given it.
 */
function frameBounds(polygons: MultiPolygonCoordinates): MapBounds | null {
  const rings: Array<FrameRing> = []
  const points: Array<[number, number]> = []
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const bounds = boundsForPoints(ring)
      if (bounds === null) continue
      rings.push({ bounds, area: ringArea(ring), taken: false })
      for (const point of ring) points.push(point)
    }
  }

  const extent = boundsForPoints(points)
  if (extent === null) return null
  if (extent.east - extent.west >= ENCIRCLING_SPAN_DEGREES) {
    return frozen<MapBounds>({
      west: -180,
      south: extent.south,
      east: 180,
      north: extent.north,
    })
  }

  // Largest first, so the frame starts on the principal landmass and every
  // later decision is measured against something the reader came to see. The
  // rectangle breaks a tie, so two rings of identical area cannot be ordered by
  // the accident of how the payload was written out.
  rings.sort((a, b) => b.area - a.area || a.bounds.west - b.bounds.west)

  const corners = boundsCorners(rings[0].bounds)
  rings[0].taken = true
  let frame = rings[0].bounds
  let frameArea = boundsArea(frame)
  let framedLand = rings[0].area

  let growing = true
  while (growing) {
    growing = false
    for (const ring of rings) {
      if (ring.taken) continue
      const merged = boundsForPoints([...corners, ...boundsCorners(ring.bounds)])
      if (merged === null) continue

      const growth = boundsArea(merged) / Math.max(frameArea, MIN_FRAME_AREA) - 1
      const share = ring.area / Math.max(framedLand, MIN_FRAME_AREA)
      if (
        boundsGap(frame, ring.bounds) > FRAME_NEAR_DEGREES &&
        growth > FRAME_FREE_GROWTH &&
        growth > share * FRAME_LAND_WEIGHT
      ) {
        continue
      }

      corners.push(...boundsCorners(ring.bounds))
      ring.taken = true
      frame = merged
      frameArea = boundsArea(merged)
      framedLand += ring.area
      growing = true
    }
  }

  return frozen(frame)
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
    const bounds = frameBounds(polygons)
    if (bounds !== null) table.set(code, bounds)
  }

  boundsByCode = table
  return boundsByCode
}

/**
 * The rectangle to frame one country in, or `null` for a code we cannot draw.
 *
 * A camera frame rather than a measurement: it holds the country's principal
 * landmass and everything that reads as part of it, and it leaves an overseas
 * département on the other side of an ocean out. France comes back as
 * metropolitan France and Corsica; Réunion, Mayotte, Guadeloupe, Martinique and
 * French Guiana are still drawn, still filled and still lit by a hover, and are
 * simply not in the picture. See {@link frameBounds} for how that is decided and
 * for the measurements behind it.
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
 * Solved over the finest cut installed, so the rectangle sharpens the moment
 * {@link loadCountryDetail} resolves — Spain gains the Balearics, Japan the
 * Ryukyus as far as Yakushima — and so the codes only the finer cut can draw
 * stop coming back `null`. What it does *not* do is grow by a continent: that
 * was the price of the finer cut, and the framing solver is what stops the
 * atlas paying it.
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

/**
 * The default fetcher, and the one place the client-only rule is enforced.
 *
 * {@link COUNTRY_DETAIL_URL} is root-relative because it is an asset of this
 * origin, and a Worker has no origin to resolve it against: `fetch('/atlas/…')`
 * there fails with a parse error naming neither this module nor the asset. A
 * caller that genuinely wants these bytes on the server — a test, or a build
 * step — injects a fetcher and gets no guard, because it has already supplied
 * the base this one lacks.
 */
const defaultDetailFetcher: CountryDetailFetcher = (url) => {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error(
        `country outlines: ${url} is a browser asset, and loadCountryDetail() has no origin to resolve it against here. Pass a fetcher to read it anywhere else.`,
      ),
    )
  }
  return fetch(url)
}

/** Everything waiting to be told the finer cut landed. */
const detailListeners = new Set<() => void>()

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

  const outlines = decodeOutlines(
    payload.slice(newline + 1).trim(),
    manifest.grid,
  )
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
 * is safe as an effect dependency, and safe as the `getSnapshot` half of a
 * `useSyncExternalStore` whose `subscribe` half is {@link subscribeCountryDetail}.
 */
export function countryDetail(): CountryDetail | null {
  return detail
}

/**
 * Called once, when the finer cut installs.
 *
 * The subscription half of the store, and the reason it exists is that two
 * *derived* answers move at the same instant — {@link hasCountryOutline} and
 * {@link countryBounds} — and both are the kind of thing a component reads
 * during render. A list row that resolved "no outline at this scale" for
 * Singapore from the bundled cut has no other way to be told the map can fill
 * it now, and would keep saying it until something unrelated re-rendered.
 *
 * Fires at most once per process, after the payload is installed and before
 * {@link loadCountryDetail} resolves. Returns its own unsubscribe; subscribing
 * after the cut has landed never fires, because there is nothing left to
 * announce — read {@link countryDetail} for that.
 */
export function subscribeCountryDetail(onInstalled: () => void): () => void {
  detailListeners.add(onInstalled)
  return () => {
    detailListeners.delete(onInstalled)
  }
}

/**
 * Announces the install to everything subscribed, over a snapshot of the set so
 * a listener that unsubscribes itself as it runs cannot skip its neighbour.
 *
 * Deliberately not caught: a throwing listener rejects the load, which is
 * loud rather than silent. The payload is installed by then, so the module is
 * never left half-loaded and a retry resolves with it immediately.
 */
function announceCountryDetail(): void {
  for (const listener of [...detailListeners]) listener()
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
 *
 * A caller that cannot await — a component that already rendered one of those
 * derived answers — subscribes with {@link subscribeCountryDetail} instead.
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
    // Installed first, announced second, so a listener that re-reads the two
    // derived answers sees the finer cut rather than the one it replaced.
    announceCountryDetail()
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
