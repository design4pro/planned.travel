/**
 * What the published archive actually contains.
 *
 * A `.pmtiles` archive is not necessarily the planet. Production publishes the
 * whole planet (docs/DEPLOY.md §7.3), but a local checkout runs on a regional cut
 * — the Tokyo–Hakone–Kyoto–Osaka corridor — where a trip to Lisbon is simply not
 * in it, and a regional fallback stays a legitimate answer to a storage bill. So
 * a partial archive is a normal condition of this code, not a fault, and the one
 * thing a map must never do about it is show an empty rectangle and let the
 * reader work it out.
 *
 * So the extent is *read from the file* rather than guessed at: bytes 102–117 of
 * a v3 header carry the bounding box the archive was built with, in hundred-
 * nanodegree integers. Eight bytes already have to be fetched to prove the object
 * is an archive at all (`./pmtiles`), so reading the whole 127-byte header costs
 * nothing extra and turns "is there a basemap" into "and does it cover *this*
 * trip".
 *
 * What the answer is *for*: the vector style gains a ground of its own beneath the
 * tiles (see `./style`), and the screen shows a note saying which one thing is
 * missing. It deliberately does not restrict the camera — the shape of a trip is the
 * primary information on a planner, and the frame that shows it is the right frame
 * whether or not there are streets under it.
 *
 * Pure parsing and pure set arithmetic — no MapLibre, no DOM, no fetch. The
 * request that feeds it lives in `./pmtiles`.
 */

import { boundsContains, isValidLngLat, wrapLongitude } from './bounds'

import type { LngLat, MapBounds } from './bounds'

/** Bytes in a PMTiles v3 header. Fixed by the specification. */
export const PMTILES_HEADER_LENGTH = 127

/** Spec version the `pmtiles` package in this project can read. */
export const PMTILES_SPEC_VERSION = 3

/** `PMTiles` in ASCII — the first seven bytes of every archive. */
const MAGIC = [0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73] as const

/** Coordinates are stored as signed integers of 1e-7 degrees. */
const COORDINATE_SCALE = 10_000_000

/** Byte offsets of the fields this module reads. */
const OFFSET = {
  specVersion: 7,
  tileType: 99,
  minZoom: 100,
  maxZoom: 101,
  minLon: 102,
  minLat: 106,
  maxLon: 110,
  maxLat: 114,
  centerZoom: 118,
  centerLon: 119,
  centerLat: 123,
} as const

/**
 * `tile_type` values from the spec. Only `mvt` is usable as a basemap: a raster
 * archive would load and then refuse every vector layer in our style.
 */
export const PMTILES_TILE_TYPE_MVT = 1

/** The part of a v3 header a map needs. */
export interface PmtilesHeader {
  readonly specVersion: number
  /** 1 = MVT (vector), 2 = PNG, 3 = JPEG, 4 = WebP, 5 = AVIF. */
  readonly tileType: number
  readonly minZoom: number
  readonly maxZoom: number
  /** The rectangle the archive was cut to. */
  readonly bounds: MapBounds
  readonly center: LngLat
  readonly centerZoom: number
}

/**
 * Reads a v3 header, or returns `null` for anything that is not one.
 *
 * `null` covers every failure the same way on purpose — a truncated upload, a
 * PNG, a spec-4 archive from the future, an HTML error page served with a 200 —
 * because the caller's response to all of them is identical: fall back to a map
 * that does not need tiles.
 */
export function parsePmtilesHeader(bytes: Uint8Array): PmtilesHeader | null {
  if (bytes.length < PMTILES_HEADER_LENGTH) return null

  for (const [index, byte] of MAGIC.entries()) {
    if (bytes[index] !== byte) return null
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const specVersion = view.getUint8(OFFSET.specVersion)
  if (specVersion !== PMTILES_SPEC_VERSION) return null

  const degrees = (offset: number): number =>
    view.getInt32(offset, true) / COORDINATE_SCALE

  const west = degrees(OFFSET.minLon)
  const south = degrees(OFFSET.minLat)
  const east = degrees(OFFSET.maxLon)
  const north = degrees(OFFSET.maxLat)

  // A generator that omitted the bounding box leaves four zeroes, which is a
  // point in the Gulf of Guinea rather than "no restriction". Treated as the
  // whole world: an archive that does not say what it covers must not be read
  // as covering nothing.
  const stated = west !== 0 || south !== 0 || east !== 0 || north !== 0
  const bounds: MapBounds = stated
    ? { west, south, east, north }
    : { west: -180, south: -90, east: 180, north: 90 }

  return {
    specVersion,
    tileType: view.getUint8(OFFSET.tileType),
    minZoom: view.getUint8(OFFSET.minZoom),
    maxZoom: view.getUint8(OFFSET.maxZoom),
    bounds,
    center: [degrees(OFFSET.centerLon), degrees(OFFSET.centerLat)],
    centerZoom: view.getUint8(OFFSET.centerZoom),
  }
}

/**
 * Longitude and latitude spans, in degrees, that count as global.
 *
 * A planet build usually states `-180,-85,180,85`, and some tools round the
 * Mercator limit differently, so the test is "close enough to the whole world"
 * rather than an equality against magic numbers.
 */
const GLOBAL_LNG_SPAN = 355
const GLOBAL_LAT_SPAN = 160

/**
 * True when the archive covers the whole planet.
 *
 * Worth its own answer because it is the case where both coverage affordances —
 * the notice and our own land underlay — are pure overhead and should not be built
 * at all.
 */
export function isGlobalArchive(bounds: MapBounds): boolean {
  return (
    bounds.east - bounds.west >= GLOBAL_LNG_SPAN &&
    bounds.north - bounds.south >= GLOBAL_LAT_SPAN
  )
}

export type CoverageStatus =
  /** No header yet, or none to be had. Say nothing rather than guess. */
  | 'unknown'
  /** Every point asked about is inside the archive. */
  | 'covered'
  /** Some points are inside and some are not. */
  | 'partial'
  /** Nothing asked about is inside the archive. */
  | 'outside'

export interface CoverageReport {
  readonly status: CoverageStatus
  /** Points that could be tested — invalid coordinates are not counted. */
  readonly total: number
  readonly inside: number
  readonly outside: number
  /** The archive's own extent, for a caller that wants to frame it. */
  readonly bounds: MapBounds | null
}

const UNKNOWN: CoverageReport = {
  status: 'unknown',
  total: 0,
  inside: 0,
  outside: 0,
  bounds: null,
}

/**
 * How much of a set of places the archive can actually draw streets for.
 *
 * An empty set reports `covered`, not `unknown`: a trip with no coordinates has
 * nothing that could be missing, so there is nothing to warn about. A global
 * archive short-circuits to `covered` without testing a single point.
 */
export function coverageFor(
  bounds: MapBounds | null,
  points: Iterable<LngLat>,
): CoverageReport {
  if (bounds === null) return UNKNOWN

  if (isGlobalArchive(bounds)) {
    let total = 0
    for (const point of points) {
      if (isValidLngLat(point)) total += 1
    }
    return { status: 'covered', total, inside: total, outside: 0, bounds }
  }

  let inside = 0
  let outside = 0
  for (const point of points) {
    if (!isValidLngLat(point)) continue
    if (boundsContains(bounds, [wrapLongitude(point[0]), point[1]])) {
      inside += 1
    } else {
      outside += 1
    }
  }

  const total = inside + outside
  if (total === 0) {
    return { status: 'covered', total: 0, inside: 0, outside: 0, bounds }
  }

  return {
    status: inside === 0 ? 'outside' : outside === 0 ? 'covered' : 'partial',
    total,
    inside,
    outside,
    bounds,
  }
}
