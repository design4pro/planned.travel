/**
 * The `pmtiles://` protocol, wired to our own tile endpoint.
 *
 * MapLibre cannot read a Protomaps archive on its own: `pmtiles://` is a custom
 * protocol whose handler translates a tile request into a byte range on one big
 * file. Registering it here — pointed at `/api/tiles/*`, which streams ranges out
 * of the `TILES` R2 bucket through the Cache API — is what keeps every tile
 * request first-party. No third-party tile host ever sees a reader's IP address,
 * their trip, or where they are looking.
 *
 * The archive is a deploy artefact rather than a repository asset, so it is
 * routinely *absent* — most obviously in local development. That is treated as a
 * first-class state, not an error: {@link basemapAvailability} answers the
 * question once per URL, cheaply, and the caller swaps to `fallbackStyle()` so
 * the map still renders and still holds its pins in the right places.
 */

import {
  DEFAULT_ARCHIVE_ALIAS,
  tileArchiveUrl,
  tileEndpoints,
  pmtilesSourceUrl,
} from '#/routes/api/tiles/-client'
import {
  PMTILES_HEADER_LENGTH,
  PMTILES_TILE_TYPE_MVT,
  parsePmtilesHeader,
} from './coverage'

import type { AddProtocolAction } from 'maplibre-gl'
import type { TileEndpointOptions } from '#/routes/api/tiles/-client'
import type { PmtilesHeader } from './coverage'

export {
  DEFAULT_ARCHIVE_ALIAS,
  tileArchiveUrl,
  tileEndpoints,
  pmtilesSourceUrl,
}
export type { TileEndpointOptions }

/** The scheme MapLibre styles use to name an archive. */
export const PMTILES_PROTOCOL = 'pmtiles'

/* -------------------------------------------------------------------------------------------------
 * Protocol registration
 * ---------------------------------------------------------------------------------------------- */

let registration: Promise<void> | null = null

/**
 * Registers `pmtiles://` with MapLibre, once per document.
 *
 * Both libraries are imported dynamically: `maplibre-gl` reaches for `window` as
 * it initialises, so it must never be pulled into the server bundle, and this
 * keeps ~200KB of protocol code off the critical path until a map actually
 * mounts. The promise is memoised, so a page with three maps registers once.
 */
export function registerPmtilesProtocol(): Promise<void> {
  registration ??= (async (): Promise<void> => {
    const [maplibre, pmtiles] = await Promise.all([
      import('maplibre-gl'),
      import('pmtiles'),
    ])

    const protocol = new pmtiles.Protocol({
      // Skip the metadata section: it costs an extra request per archive and we
      // supply attribution from the style rather than reading it from the file.
      metadata: false,
      // A missing tile inside a present archive means "nothing here" — ocean,
      // desert, an unmapped valley — and must render as empty, not as an error.
      errorOnMissingTile: false,
    })

    const load: AddProtocolAction = (request, abortController) =>
      protocol.tile(request, abortController)

    maplibre.addProtocol(PMTILES_PROTOCOL, load)
  })()

  return registration
}

/**
 * Forgets the registration. Only useful in tests — MapLibre keeps protocols on a
 * module-level registry that outlives any single map.
 */
export function resetPmtilesProtocol(): void {
  registration = null
}

/* -------------------------------------------------------------------------------------------------
 * Availability
 * ---------------------------------------------------------------------------------------------- */

/** Why a basemap could not be used. */
export type BasemapUnavailableReason =
  /** The endpoint answered 404: no archive is published under that key. */
  | 'missing'
  /** Something is there, but it is not a v3 Protomaps archive. */
  | 'unsupported'
  /** The request never completed — offline, aborted, or a 5xx. */
  | 'network'

export type BasemapProbe =
  | {
      readonly status: 'available'
      readonly url: string
      /** The archive's own extent and zoom range, read from its header. */
      readonly header: PmtilesHeader
    }
  | {
      readonly status: 'unavailable'
      readonly url: string
      readonly reason: BasemapUnavailableReason
    }

export interface BasemapProbeOptions extends TileEndpointOptions {
  /** Injected in tests. Defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch
  readonly signal?: AbortSignal
}

/**
 * Asks whether the basemap archive is really there — and what is in it.
 *
 * Deliberately a ranged `GET` of the first 127 bytes rather than a `HEAD`: a
 * `HEAD` proves an object exists, while the v3 header proves it is a Protomaps
 * archive *and* states the bounding box and zoom range it was cut to. That
 * distinction is what lets both degraded states be honest instead of hopeful — a
 * truncated upload would otherwise pass and then fail one tile at a time, and a
 * regional archive would otherwise look like a broken planet.
 *
 * A raster archive is rejected as `unsupported`: it would load and then refuse
 * every vector layer in our style.
 *
 * Never throws. A failed probe is an answer, not an exception.
 */
export async function probeBasemap(
  options: BasemapProbeOptions = {},
): Promise<BasemapProbe> {
  const url = tileArchiveUrl(options)
  const fetchImpl = options.fetchImpl ?? globalThis.fetch

  if (typeof fetchImpl !== 'function') {
    return { status: 'unavailable', url, reason: 'network' }
  }

  try {
    const response = await fetchImpl(url, {
      headers: { range: `bytes=0-${PMTILES_HEADER_LENGTH - 1}` },
      signal: options.signal,
    })

    if (response.status === 404 || response.status === 403) {
      return { status: 'unavailable', url, reason: 'missing' }
    }
    if (!response.ok && response.status !== 206) {
      return { status: 'unavailable', url, reason: 'network' }
    }

    const header = parsePmtilesHeader(new Uint8Array(await response.arrayBuffer()))
    if (header === null || header.tileType !== PMTILES_TILE_TYPE_MVT) {
      return { status: 'unavailable', url, reason: 'unsupported' }
    }
    return { status: 'available', url, header }
  } catch {
    // Offline, aborted, blocked by an extension: all the same answer.
    return { status: 'unavailable', url, reason: 'network' }
  }
}

const probes = new Map<string, Promise<BasemapProbe>>()

/**
 * {@link probeBasemap}, memoised by archive URL.
 *
 * A trip page can mount and unmount its map several times as the reader moves
 * between tabs; the answer does not change within a session, so it is asked once.
 */
export function basemapAvailability(
  options: BasemapProbeOptions = {},
): Promise<BasemapProbe> {
  const url = tileArchiveUrl(options)
  const existing = probes.get(url)
  if (existing !== undefined) return existing

  const probe = probeBasemap(options).then((result) => {
    // A network blip should not poison the session: only a definitive answer is
    // worth keeping, so transient failures are re-asked next time.
    if (result.status === 'unavailable' && result.reason === 'network') {
      probes.delete(url)
    }
    return result
  })

  probes.set(url, probe)
  return probe
}

/** Drops memoised answers — used by the retry affordance and by tests. */
export function resetBasemapAvailability(): void {
  probes.clear()
}
