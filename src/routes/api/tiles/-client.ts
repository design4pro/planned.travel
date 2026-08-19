/**
 * Typed URL builders for the tile endpoint.
 *
 * The MapLibre setup imports these instead of hand-writing `/api/tiles/...`
 * strings, so the route prefix, the basemap alias and the glyph/sprite layout
 * are all stated once — next to the handler that has to honour them.
 *
 * This module is isomorphic: no bindings, no Cloudflare imports, safe in the
 * browser bundle.
 */

import { DEFAULT_ARCHIVE_ALIAS, TILES_PATH_PREFIX } from './-lib/archive'

export { DEFAULT_ARCHIVE_ALIAS, TILES_PATH_PREFIX }

/** Bucket prefix holding MapLibre glyph ranges. */
const GLYPHS_PREFIX = 'glyphs'

/** Bucket prefix holding MapLibre sprite sheets. */
const SPRITES_PREFIX = 'sprites'

export interface TileEndpointOptions {
  /**
   * Object key of a specific archive, e.g. `basemaps/planet-2026-08.pmtiles`.
   * Defaults to the mutable alias, which resolves to `TILES_ARCHIVE_KEY`.
   * Naming a key directly opts the URL into immutable year-long caching.
   */
  readonly archive?: string
  /**
   * Absolute origin to prefix, for contexts without a document base — SSR head
   * links, for instance. Omit it in the browser to keep URLs same-origin.
   */
  readonly origin?: string
  /** Sprite sheet basename under `sprites/`. Defaults to `basemap`. */
  readonly sprite?: string
}

export interface TileEndpoints {
  /** Plain HTTP URL of the archive; supports Range requests. */
  readonly archive: string
  /** `pmtiles://`-prefixed form for `maplibre-gl` vector sources. */
  readonly pmtiles: string
  /** MapLibre `glyphs` template, with its `{fontstack}`/`{range}` tokens. */
  readonly glyphs: string
  /** MapLibre `sprite` base URL — MapLibre appends `.json` / `@2x.png`. */
  readonly sprite: string
}

function join(origin: string | undefined, key: string): string {
  const path = TILES_PATH_PREFIX + key
  return origin === undefined ? path : origin.replace(/\/+$/, '') + path
}

/** URL for any object served by the tile endpoint. */
export function tileAssetUrl(key: string, origin?: string): string {
  return join(origin, key)
}

/** URL of a Protomaps archive. */
export function tileArchiveUrl(options: TileEndpointOptions = {}): string {
  return join(options.origin, options.archive ?? DEFAULT_ARCHIVE_ALIAS)
}

/** Vector-source URL understood by the `pmtiles` MapLibre protocol handler. */
export function pmtilesSourceUrl(options: TileEndpointOptions = {}): string {
  return `pmtiles://${tileArchiveUrl(options)}`
}

/** Every URL a MapLibre style needs from R2, in one object. */
export function tileEndpoints(
  options: TileEndpointOptions = {},
): TileEndpoints {
  return {
    archive: tileArchiveUrl(options),
    pmtiles: pmtilesSourceUrl(options),
    glyphs: join(options.origin, `${GLYPHS_PREFIX}/{fontstack}/{range}.pbf`),
    sprite: join(
      options.origin,
      `${SPRITES_PREFIX}/${options.sprite ?? 'basemap'}`,
    ),
  }
}
