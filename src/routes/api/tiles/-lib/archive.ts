/**
 * Path → R2 key resolution for `/api/tiles/*`.
 *
 * The R2 `TILES` bucket is public read-only map data: Protomaps `.pmtiles`
 * archives plus the style, sprite and glyph assets MapLibre pulls alongside
 * them. Anything reachable through this route is therefore world-readable by
 * design, which makes key validation the whole security surface: only keys that
 * match the shape below can be requested, so a caller can never walk out of the
 * bucket's map-data namespace or probe for keys shaped like private objects.
 */

/** URL prefix this route is mounted at, including the trailing slash. */
export const TILES_PATH_PREFIX = '/api/tiles/'

/**
 * Stable path that resolves to whatever `TILES_ARCHIVE_KEY` currently points
 * at. Rotating that var swaps the basemap for every client at once, because the
 * edge cache is keyed by the *resolved* key, not by the alias.
 */
export const DEFAULT_ARCHIVE_ALIAS = 'basemap.pmtiles'

/** Deepest key we will resolve, e.g. `basemaps/2026-08/planet.pmtiles`. */
const MAX_KEY_SEGMENTS = 6

/** Longest key we will resolve, well under R2's own 1024-byte limit. */
const MAX_KEY_LENGTH = 512

/**
 * Must start alphanumeric; the remaining characters cover every name MapLibre
 * asks for, including `sprite@2x.png` and glyph font stacks such as
 * `Geist Sans Regular,Noto Sans Regular`. It rejects `.`, `..`, leading dots,
 * slashes, `%`, `?`, `#` and every percent-decoded control character, which is
 * what keeps a request inside the bucket's map-data namespace.
 */
const SEGMENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._,@()-]*$/

const CONTENT_TYPES = new Map<string, string>([
  // Protomaps archives are read almost exclusively through Range requests, so
  // the type is deliberately opaque: nothing should try to sniff or transform
  // a partial archive read.
  ['pmtiles', 'application/octet-stream'],
  ['json', 'application/json; charset=utf-8'],
  // MapLibre glyph ranges.
  ['pbf', 'application/x-protobuf'],
  ['mvt', 'application/vnd.mapbox-vector-tile'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['avif', 'image/avif'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
])

export type ArchiveResolution =
  /** The request used {@link DEFAULT_ARCHIVE_ALIAS}. */
  | { readonly kind: 'alias'; readonly key: string }
  /** The request named a key directly, so it is safe to treat as immutable. */
  | { readonly kind: 'explicit'; readonly key: string }
  | { readonly kind: 'invalid' }

/** Seconds a named key may be cached: keys are published, never overwritten. */
export const IMMUTABLE_MAX_AGE = 31_536_000

/** Seconds a browser may hold the mutable alias before revalidating. */
export const ALIAS_MAX_AGE = 3_600

/** Seconds the edge may hold object metadata (size + entity tag). */
export const METADATA_MAX_AGE = 86_400

/**
 * Extracts and validates the object key from a request path.
 *
 * Returns `null` for anything that is not a well-formed map-data key, including
 * traversal attempts, empty segments and unknown extensions.
 */
export function objectKeyFromPath(pathname: string): string | null {
  if (!pathname.startsWith(TILES_PATH_PREFIX)) return null

  const raw = pathname.slice(TILES_PATH_PREFIX.length)
  if (raw.length === 0 || raw.length > MAX_KEY_LENGTH) return null

  const segments = raw.split('/')
  if (segments.length > MAX_KEY_SEGMENTS) return null

  const decoded: Array<string> = []
  for (const segment of segments) {
    let value: string
    try {
      value = decodeURIComponent(segment)
    } catch {
      // Malformed percent-encoding: never guess at the caller's intent.
      return null
    }
    if (!SEGMENT_PATTERN.test(value)) return null
    decoded.push(value)
  }

  const key = decoded.join('/')
  if (key.length > MAX_KEY_LENGTH) return null
  if (contentTypeForKey(key) === null) return null
  return key
}

/** Resolves a request path to the R2 key that should be read. */
export function resolveArchive(
  pathname: string,
  defaultArchiveKey: string,
): ArchiveResolution {
  const key = objectKeyFromPath(pathname)
  if (key === null) return { kind: 'invalid' }

  if (key === DEFAULT_ARCHIVE_ALIAS) {
    const resolved = objectKeyFromPath(TILES_PATH_PREFIX + defaultArchiveKey)
    return resolved === null
      ? { kind: 'invalid' }
      : { kind: 'alias', key: resolved }
  }

  return { kind: 'explicit', key }
}

/** Response content type for a key, or `null` if the extension is not served. */
export function contentTypeForKey(key: string): string | null {
  const dot = key.lastIndexOf('.')
  if (dot < 0) return null
  return CONTENT_TYPES.get(key.slice(dot + 1)) ?? null
}

/**
 * `Cache-Control` for a resolved key.
 *
 * A named key is immutable — we publish `basemaps/planet-<date>.pmtiles` and
 * never rewrite it, so a year of browser caching is honest. The alias is the
 * one mutable URL in the system: browsers revalidate it hourly, while the edge
 * keeps its long copy because the edge cache key already carries the resolved
 * key and therefore changes the moment the alias is repointed.
 */
export function cacheControlFor(kind: 'alias' | 'explicit'): string {
  if (kind === 'explicit') {
    return `public, max-age=${IMMUTABLE_MAX_AGE}, immutable`
  }
  return `public, max-age=${ALIAS_MAX_AGE}, s-maxage=${IMMUTABLE_MAX_AGE}, stale-while-revalidate=${METADATA_MAX_AGE}`
}
