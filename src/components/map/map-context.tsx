/**
 * The React handle on a live MapLibre instance.
 *
 * Everything that draws on the map — markers, controls, camera behaviour — needs
 * the same two things: the `Map` object, and the module it came from (MapLibre is
 * loaded dynamically, so `Marker` is only reachable through the resolved module).
 * Both travel through this context, which `MapCanvas` always renders, even before
 * the map exists. Children therefore never have to guard against being outside a
 * provider, only against the map not being ready yet.
 */

import * as React from 'react'

import type * as MapLibre from 'maplibre-gl'
import type { MapLibreMap } from 'maplibre-gl'
import type { ResolvedTheme } from '#/lib/theme'
import type { MapBounds } from '#/lib/map/bounds'
import type { PmtilesHeader } from '#/lib/map/coverage'

/** The dynamically imported `maplibre-gl` module. */
export type MapLibreModule = typeof MapLibre

export type { MapLibreMap }

/** Whether the vector basemap could be reached. */
export type BasemapStatus = 'loading' | 'available' | 'unavailable'

/**
 * Whether the WebGL renderer itself ever came up — a different question from
 * whether there is a basemap to draw with it.
 *
 * The two failures look identical on screen and have nothing else in common. A
 * missing `.pmtiles` archive is a deploy artefact problem: the map still runs,
 * the camera still moves, every coordinate is still true, and the bundled
 * outlines still draw the world. A renderer that never started is the browser
 * refusing: no WebGL2 context, a blocked GPU, a lost context, a `load` event
 * that never arrives. Then there is no canvas content at all, and a consumer has
 * to put something else on the screen rather than wait forever on a spinner.
 *
 * - `starting` — probing, importing, or waiting for the first `load`.
 * - `running` — the style loaded and the canvas is drawing.
 * - `unsupported` — this browser cannot give us a WebGL2 context, so no map was
 *   created at all.
 * - `stalled` — the map was created but nothing drew inside
 *   {@link MAP_ENGINE_TIMEOUT_MS}. Recoverable: it flips to `running` if a late
 *   `load` arrives.
 */
export type MapEngineStatus = 'starting' | 'running' | 'unsupported' | 'stalled'

/**
 * How long a created map has to draw something before it is reported `stalled`.
 *
 * Long enough that a cold worker start and a first tile fetch on a slow
 * connection are not called a failure; short enough that a reader is not left
 * watching a spinner over an empty rectangle.
 */
export const MAP_ENGINE_TIMEOUT_MS = 6000

export interface MapContextValue {
  /** `null` until MapLibre has loaded and the canvas exists. */
  readonly map: MapLibreMap | null
  /** `null` until the dynamic import resolves. */
  readonly gl: MapLibreModule | null
  /** `true` once the style has finished loading and layers can be added. */
  readonly ready: boolean
  readonly basemap: BasemapStatus
  /**
   * Whether the renderer started. Read this before deciding that an empty map
   * means an empty trip: `unsupported` and `stalled` both mean nothing will ever
   * be drawn, and the screen owes the reader a non-canvas answer.
   */
  readonly engine: MapEngineStatus
  /**
   * What the published archive says about itself: the rectangle it was cut to and
   * the zoom range it holds. `null` until the probe answers, and whenever it
   * answers that there is nothing there.
   *
   * This is what makes "no street detail here" a fact rather than a guess — see
   * `useArchiveCoverage`.
   */
  readonly archive: PmtilesHeader | null
  readonly theme: ResolvedTheme
  /**
   * Increments every time the style document is replaced — which a theme switch
   * does. Replacing a style drops every source and layer added at runtime, so a
   * caller that adds its own belongs in an effect keyed on this number.
   */
  readonly styleEpoch: number
  /** Re-probes the archive and restyles if it has appeared. */
  readonly retryBasemap: () => void
}

const EMPTY: MapContextValue = {
  map: null,
  gl: null,
  ready: false,
  basemap: 'loading',
  engine: 'starting',
  archive: null,
  theme: 'light',
  styleEpoch: 0,
  retryBasemap: () => {},
}

const MapContext = React.createContext<MapContextValue>(EMPTY)

export const MapProvider = MapContext.Provider

/** The full context. Safe to call on the server and before the map mounts. */
export function useMapContext(): MapContextValue {
  return React.useContext(MapContext)
}

/** The map instance, or `null` while it is still coming up. */
export function useMapInstance(): MapLibreMap | null {
  return React.useContext(MapContext).map
}

/**
 * The map events this surface subscribes to. A closed list rather than every
 * name MapLibre emits, so the hook below stays a one-liner for callers and the
 * set of things the product reacts to stays reviewable.
 */
export type MapEventName =
  | 'load'
  | 'idle'
  | 'move'
  | 'moveend'
  | 'zoom'
  | 'zoomend'
  | 'rotate'
  | 'rotateend'
  | 'resize'
  | 'style.load'
  | 'click'

/**
 * Subscribes to a map event for as long as the component is mounted.
 *
 * The listener is held in a ref, so an inline closure does not re-subscribe on
 * every render while still seeing fresh props.
 */
export function useMapListener(type: MapEventName, listener: () => void): void {
  const map = useMapInstance()
  const ref = React.useRef(listener)
  ref.current = listener

  React.useEffect(() => {
    if (map === null) return
    const handler = (): void => {
      ref.current()
    }
    map.on(type, handler)
    return () => {
      map.off(type, handler)
    }
  }, [map, type])
}

/**
 * The current zoom, rounded so a continuous pinch does not re-render the tree on
 * every frame. Marker clustering depends on this value and nothing else.
 */
export function useMapZoom(precision = 2): number | null {
  const map = useMapInstance()
  const [zoom, setZoom] = React.useState<number | null>(null)

  React.useEffect(() => {
    if (map === null) {
      setZoom(null)
      return
    }
    const factor = 10 ** precision
    const read = (): void => {
      const next = Math.round(map.getZoom() * factor) / factor
      setZoom((current) => (current === next ? current : next))
    }
    read()
    map.on('zoom', read)
    return () => {
      map.off('zoom', read)
    }
  }, [map, precision])

  return zoom
}

/** The current bearing in degrees, for a compass that points at true north. */
export function useMapBearing(): number {
  const map = useMapInstance()
  const [bearing, setBearing] = React.useState(0)

  React.useEffect(() => {
    if (map === null) return
    const read = (): void => {
      const next = Math.round(map.getBearing())
      setBearing((current) => (current === next ? current : next))
    }
    read()
    map.on('rotate', read)
    return () => {
      map.off('rotate', read)
    }
  }, [map])

  return bearing
}

/** A settled camera position. */
export interface MapCamera {
  readonly center: readonly [number, number]
  readonly zoom: number
  readonly bearing: number
  readonly pitch: number
  readonly bounds: MapBounds
}

/**
 * The camera after it comes to rest.
 *
 * Reported on `moveend` rather than on `move`, so a component that persists the
 * view or fetches by viewport does it once per gesture instead of sixty times a
 * second.
 */
export function useMapCamera(): MapCamera | null {
  const map = useMapInstance()
  const [camera, setCamera] = React.useState<MapCamera | null>(null)

  React.useEffect(() => {
    if (map === null) {
      setCamera(null)
      return
    }
    const read = (): void => {
      const center = map.getCenter()
      const bounds = map.getBounds()
      setCamera({
        center: [center.lng, center.lat],
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        bounds: {
          west: bounds.getWest(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          north: bounds.getNorth(),
        },
      })
    }
    read()
    map.on('moveend', read)
    return () => {
      map.off('moveend', read)
    }
  }, [map])

  return camera
}
