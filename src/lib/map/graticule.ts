/**
 * A generated graticule — the meridians and parallels drawn when no vector
 * basemap is available.
 *
 * With no archive there are no coastlines to draw, so the honest alternative to
 * a grey void is a sheet of warm paper with drafting lines on it: the reader can
 * still see that the pins sit at real latitudes, and the screen reads as a
 * deliberate state. Pure maths, no network, no dependencies.
 */

/** Web Mercator cannot render the poles; MapLibre clamps to this latitude. */
export const MAX_MERCATOR_LATITUDE = 85.05112878

export type GraticuleKind = 'meridian' | 'parallel'

/**
 * Declared as a type alias rather than an interface so it carries an implicit
 * index signature and therefore satisfies GeoJSON's open `properties` bag.
 */
export type GraticuleProperties = {
  kind: GraticuleKind
  /** The line's own degree value — the meridian's longitude, or the parallel's latitude. */
  degrees: number
  /** Every `majorEvery` lines gets the heavier stroke. The equator is always major. */
  major: boolean
}

export type GraticuleFeature = {
  type: 'Feature'
  geometry: { type: 'LineString'; coordinates: Array<[number, number]> }
  properties: GraticuleProperties
}

export type GraticuleCollection = {
  type: 'FeatureCollection'
  features: Array<GraticuleFeature>
}

export interface GraticuleOptions {
  /** Degrees between lines. Defaults to 15° — twelve o'clock lines and a tidy grid. */
  readonly step?: number
  /** Every nth line is emphasised. Defaults to every 4th, i.e. every 60°. */
  readonly majorEvery?: number
  /**
   * Vertices per meridian. Mercator meridians are straight, so 2 would draw
   * correctly, but a few more keep the line smooth under globe projection.
   */
  readonly segments?: number
}

const DEFAULT_STEP = 15
const DEFAULT_MAJOR_EVERY = 4
const DEFAULT_SEGMENTS = 8

function isMajor(degrees: number, step: number, majorEvery: number): boolean {
  if (degrees === 0) return true
  return Math.round(degrees / step) % majorEvery === 0
}

/**
 * Six decimal places is a tenth of a metre, which is more than a graticule needs.
 * Truncated toward zero rather than rounded: rounding the pole latitude *up*
 * would push the endpoint a fraction past what Mercator can draw.
 */
function round6(value: number): number {
  return Math.trunc(value * 1e6) / 1e6
}

function meridian(
  lng: number,
  step: number,
  majorEvery: number,
  segments: number,
): GraticuleFeature {
  const coordinates: Array<[number, number]> = []
  const span = MAX_MERCATOR_LATITUDE * 2
  for (let index = 0; index <= segments; index += 1) {
    const lat = MAX_MERCATOR_LATITUDE - (span * index) / segments
    coordinates.push([lng, round6(lat)])
  }
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: {
      kind: 'meridian',
      degrees: lng,
      major: isMajor(lng, step, majorEvery),
    },
  }
}

function parallel(
  lat: number,
  step: number,
  majorEvery: number,
): GraticuleFeature {
  // A parallel is a straight horizontal line in Mercator, but it needs enough
  // vertices to stay a great-circle-looking arc if the map is ever reprojected.
  const coordinates: Array<[number, number]> = []
  for (let lng = -180; lng <= 180; lng += 20) {
    coordinates.push([lng, lat])
  }
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: {
      kind: 'parallel',
      degrees: lat,
      major: isMajor(lat, step, majorEvery),
    },
  }
}

/**
 * Builds the graticule as GeoJSON, ready to hand to a MapLibre `geojson` source.
 *
 * Meridians run from -180° to 180° inclusive of -180 and exclusive of 180 (the
 * two coincide), parallels from -75° to 75° in `step` increments plus the
 * equator, which is always present and always major.
 */
export function graticule(options: GraticuleOptions = {}): GraticuleCollection {
  const step = options.step ?? DEFAULT_STEP
  const majorEvery = options.majorEvery ?? DEFAULT_MAJOR_EVERY
  const segments = options.segments ?? DEFAULT_SEGMENTS

  if (!Number.isFinite(step) || step <= 0) {
    throw new RangeError('graticule step must be a positive number of degrees')
  }

  const features: Array<GraticuleFeature> = []

  for (let lng = -180; lng < 180; lng += step) {
    features.push(meridian(lng, step, majorEvery, segments))
  }

  for (let lat = 0; lat < MAX_MERCATOR_LATITUDE; lat += step) {
    features.push(parallel(lat, step, majorEvery))
    if (lat !== 0) features.push(parallel(-lat, step, majorEvery))
  }

  return { type: 'FeatureCollection', features }
}
