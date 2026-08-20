/**
 * Bounds maths for the map.
 *
 * Every camera decision in the planner comes from a set of places, and the
 * arithmetic that turns those places into a rectangle has three edge cases worth
 * having in one tested place: a single place (a rectangle of zero area), a trip
 * that straddles the antimeridian (Tokyo → Honolulu), and the floating panels
 * that cover part of the viewport and must not be fitted *into*.
 *
 * Pure functions only — no MapLibre, no DOM. Longitude is always first, matching
 * GeoJSON and MapLibre.
 */

import { MAX_MERCATOR_LATITUDE } from './graticule'

export { MAX_MERCATOR_LATITUDE }

/** `[longitude, latitude]`, in that order. */
export type LngLat = readonly [number, number]

/** An axis-aligned rectangle. `east` may exceed 180° when it crosses the antimeridian. */
export interface MapBounds {
  readonly west: number
  readonly south: number
  readonly east: number
  readonly north: number
}

/** The `[[west, south], [east, north]]` form MapLibre's `fitBounds` accepts. */
export type BoundsTuple = readonly [LngLat, LngLat]

/** Viewport insets, in CSS pixels, that the camera must keep clear. */
export interface EdgePadding {
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly left: number
}

/** The whole world, clamped to what Web Mercator can draw. */
export const WORLD_BOUNDS: MapBounds = {
  west: -180,
  south: -MAX_MERCATOR_LATITUDE,
  east: 180,
  north: MAX_MERCATOR_LATITUDE,
}

/** Fallback padding when a caller does not name one, on the 4px grid. */
export const DEFAULT_FIT_PADDING: EdgePadding = {
  top: 48,
  right: 48,
  bottom: 48,
  left: 48,
}

/** True for a pair that is safe to hand to MapLibre. */
export function isValidLngLat(point: unknown): point is LngLat {
  if (!Array.isArray(point) || point.length < 2) return false
  const [lng, lat] = point as ReadonlyArray<unknown>
  return (
    typeof lng === 'number' &&
    typeof lat === 'number' &&
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -360 &&
    lng <= 360
  )
}

/**
 * Wraps a longitude into `[-180, 180)`.
 *
 * Values already in range are returned untouched rather than run through the
 * modulo: `((139.6917 + 180) % 360 + 360) % 360 - 180` is not exactly 139.6917 in
 * binary floating point, and a coordinate that survives a round trip unchanged is
 * worth more than the two lines it costs.
 */
export function wrapLongitude(lng: number): number {
  // `-180` and `180` are the same meridian; normalise on the western form.
  if (lng === 180) return -180
  if (lng > -180 && lng < 180) return lng
  const wrapped = ((((lng + 180) % 360) + 360) % 360) - 180
  return wrapped === 180 ? -180 : wrapped
}

/** Clamps a latitude to what Web Mercator can render. */
export function clampLatitude(lat: number): number {
  return Math.min(MAX_MERCATOR_LATITUDE, Math.max(-MAX_MERCATOR_LATITUDE, lat))
}

/**
 * How much narrower the shifted solution has to be before it is believed.
 *
 * For a set of points that does not cross the antimeridian the two solutions
 * describe the same rectangle, and floating point does not know that. Western
 * Sahara's outline measures 8.389999999999999° across unshifted and
 * 8.389999999999986° shifted — the same span, one ulp apart, because shifting
 * every vertex by 360° and subtracting again is not lossless. A bare `<` reads
 * that as "the shifted answer is narrower", picks it for a country wholly in the
 * western hemisphere, and rebuilds its edges on the far side of the line:
 * -17.060000000000002…-8.670000000000016 in place of -17.06…-8.67.
 *
 * A tenth of a millimetre of drift is not the problem. The problem is that the
 * shifted branch is the antimeridian branch, and taking it for a country that
 * never goes near the line means the camera is being aimed by a rounding error.
 * Every crossing that genuinely needs that branch wins it by degrees — Russia
 * 170° against 360°, Fiji 2.9° against 360° — so the margin can be demanded.
 *
 * 1e-9° is roughly 0.1mm at the equator: far below the 0.01° the bundled country
 * outlines are quantised to, and far above the ~1e-14 noise of the shift.
 */
const ANTIMERIDIAN_TIE_EPSILON = 1e-9

/**
 * The tightest rectangle containing every valid point, or `null` if there are
 * none.
 *
 * Longitude is solved twice — once on the `[-180, 180)` line and once with
 * negative longitudes shifted east by 360° — and the narrower of the two wins,
 * by more than {@link ANTIMERIDIAN_TIE_EPSILON}. That is what makes a Tokyo →
 * Honolulu trip fit across the Pacific instead of zooming out to show the entire
 * planet, and what keeps a country that merely *looks* like a tie in binary
 * floating point on the plain line where it belongs.
 */
export function boundsForPoints(points: Iterable<LngLat>): MapBounds | null {
  let south = Number.POSITIVE_INFINITY
  let north = Number.NEGATIVE_INFINITY

  // Plain: longitudes as given, wrapped into [-180, 180).
  let plainWest = Number.POSITIVE_INFINITY
  let plainEast = Number.NEGATIVE_INFINITY
  // Shifted: negative longitudes moved to [180, 360).
  let shiftWest = Number.POSITIVE_INFINITY
  let shiftEast = Number.NEGATIVE_INFINITY

  let count = 0
  for (const point of points) {
    if (!isValidLngLat(point)) continue
    count += 1
    const lng = wrapLongitude(point[0])
    const lat = clampLatitude(point[1])

    south = Math.min(south, lat)
    north = Math.max(north, lat)

    plainWest = Math.min(plainWest, lng)
    plainEast = Math.max(plainEast, lng)

    const shifted = lng < 0 ? lng + 360 : lng
    shiftWest = Math.min(shiftWest, shifted)
    shiftEast = Math.max(shiftEast, shifted)
  }

  if (count === 0) return null

  const plainSpan = plainEast - plainWest
  const shiftSpan = shiftEast - shiftWest

  if (shiftSpan < plainSpan - ANTIMERIDIAN_TIE_EPSILON) {
    // Both edges are measured values rather than a sum, so the rectangle carries
    // the geometry's own numbers out again. That is safe here precisely because
    // the shifted solution can only win when the set holds a longitude at or
    // east of the prime meridian: if every longitude were negative, both spans
    // would be the same difference of the same set and the tie above would have
    // sent us down the plain branch. Any such longitude shifts to itself, so
    // `shiftWest` is already inside [-180, 180] and only `shiftEast` runs past
    // it — which is exactly how MapLibre expresses an antimeridian crossing to
    // `fitBounds`, and why the eastern edge must never be wrapped or clamped.
    return { west: shiftWest, south, east: shiftEast, north }
  }

  return { west: plainWest, south, east: plainEast, north }
}

/** Longitudinal and latitudinal extent, in degrees. */
export function boundsSpan(bounds: MapBounds): { lng: number; lat: number } {
  return {
    lng: bounds.east - bounds.west,
    lat: bounds.north - bounds.south,
  }
}

/** The middle of a rectangle. */
export function boundsCenter(bounds: MapBounds): LngLat {
  return [
    wrapLongitude((bounds.west + bounds.east) / 2),
    (bounds.south + bounds.north) / 2,
  ]
}

/**
 * Grows a rectangle so that neither axis is narrower than `minSpan` degrees.
 *
 * A single place produces a rectangle of zero area, and `fitBounds` on it snaps
 * to maximum zoom — a street corner where the reader expected a neighbourhood.
 * The default of 0.04° is roughly a 4km window: city-block context.
 */
export function expandBounds(bounds: MapBounds, minSpan = 0.04): MapBounds {
  const span = boundsSpan(bounds)
  const growLng = Math.max(0, minSpan - span.lng) / 2
  const growLat = Math.max(0, minSpan - span.lat) / 2
  return {
    west: bounds.west - growLng,
    east: bounds.east + growLng,
    south: clampLatitude(bounds.south - growLat),
    north: clampLatitude(bounds.north + growLat),
  }
}

/** Grows a rectangle by a fraction of its own size, for breathing room. */
export function padBounds(bounds: MapBounds, fraction = 0.12): MapBounds {
  const span = boundsSpan(bounds)
  const lng = span.lng * fraction
  const lat = span.lat * fraction
  return {
    west: bounds.west - lng,
    east: bounds.east + lng,
    south: clampLatitude(bounds.south - lat),
    north: clampLatitude(bounds.north + lat),
  }
}

/** The smallest rectangle containing both inputs. */
export function unionBounds(a: MapBounds, b: MapBounds): MapBounds {
  return {
    west: Math.min(a.west, b.west),
    south: Math.min(a.south, b.south),
    east: Math.max(a.east, b.east),
    north: Math.max(a.north, b.north),
  }
}

/** True when the point sits inside the rectangle, antimeridian included. */
export function boundsContains(bounds: MapBounds, point: LngLat): boolean {
  if (!isValidLngLat(point)) return false
  const lat = point[1]
  if (lat < bounds.south || lat > bounds.north) return false

  const lng = wrapLongitude(point[0])
  if (bounds.east <= 180) return lng >= bounds.west && lng <= bounds.east
  // Crossing the antimeridian: test the point on the shifted line too.
  const shifted = lng < bounds.west ? lng + 360 : lng
  return shifted >= bounds.west && shifted <= bounds.east
}

/** MapLibre's `[[west, south], [east, north]]` argument form. */
export function boundsToTuple(bounds: MapBounds): BoundsTuple {
  return [
    [bounds.west, bounds.south],
    [bounds.east, bounds.north],
  ]
}

/** Reads a `[[west, south], [east, north]]` tuple back into a rectangle. */
export function boundsFromTuple(tuple: BoundsTuple): MapBounds {
  return {
    west: tuple[0][0],
    south: tuple[0][1],
    east: tuple[1][0],
    north: tuple[1][1],
  }
}

/**
 * A stable string for a rectangle, so an effect can depend on the *value* of a
 * freshly-built bounds object instead of its identity and stop re-fitting the
 * camera on every render.
 */
export function boundsKey(bounds: MapBounds | null): string {
  if (bounds === null) return 'none'
  const round = (value: number): string => value.toFixed(5)
  return [bounds.west, bounds.south, bounds.east, bounds.north]
    .map(round)
    .join(',')
}

/**
 * Completes a partial inset set.
 *
 * The planner floats an itinerary rail on the left and a places panel on the
 * right; both cover the map, so the camera has to fit the trip into what is
 * actually visible between them. Callers pass the widths they occupy and the
 * unspecified edges fall back to the standard gutter.
 */
export function resolvePadding(
  padding?: Partial<EdgePadding>,
  base: EdgePadding = DEFAULT_FIT_PADDING,
): EdgePadding {
  return {
    top: padding?.top ?? base.top,
    right: padding?.right ?? base.right,
    bottom: padding?.bottom ?? base.bottom,
    left: padding?.left ?? base.left,
  }
}

/**
 * Shrinks padding that would leave no room to draw.
 *
 * `fitBounds` throws — or silently produces a nonsense camera — when the padding
 * exceeds the viewport. On a 360px phone with a 320px rail, that is a real case,
 * so the insets are scaled down proportionally until at least `minVisible`
 * pixels survive on each axis.
 */
export function clampPadding(
  padding: EdgePadding,
  viewport: { readonly width: number; readonly height: number },
  minVisible = 64,
): EdgePadding {
  const scaleAxis = (
    start: number,
    end: number,
    extent: number,
  ): [number, number] => {
    const available = Math.max(0, extent - minVisible)
    const total = start + end
    if (total <= available || total === 0) return [start, end]
    const scale = available / total
    return [Math.floor(start * scale), Math.floor(end * scale)]
  }

  const [left, right] = scaleAxis(padding.left, padding.right, viewport.width)
  const [top, bottom] = scaleAxis(padding.top, padding.bottom, viewport.height)
  return { top, right, bottom, left }
}
