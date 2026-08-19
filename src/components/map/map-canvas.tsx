/**
 * The base map.
 *
 * Four things make this component more than a `new maplibregl.Map()` wrapper, and
 * each of them is a bug the planner screen would otherwise hit:
 *
 * 1. **SSR safety.** `maplibre-gl` touches `window` while it initialises, so it
 *    is imported dynamically inside an effect. Nothing in the render path — or in
 *    the Worker bundle — ever reaches for a browser global.
 * 2. **Theme reactivity.** A light/dark switch replaces the style document
 *    through `setStyle`, which diffs against the live style: the vector source
 *    and its already-fetched tiles survive, so the map recolours in place instead
 *    of remounting and refetching.
 * 3. **Graceful degradation, twice over.** The archive is probed once before the
 *    map is created, and the probe reads its header rather than just its first
 *    bytes. When there is no archive the map is built on the graticule style and
 *    the reader is told. When there *is* one but it was cut to a region — which
 *    ours is — the vector style gets our own sea, coastlines and graticule
 *    underneath it, so the world outside the cut is still a map. Either way the
 *    camera works and every pin sits at its true coordinate; the reader is never
 *    shown a grey void and left to interpret it.
 * 4. **Real cleanup.** `map.remove()` on unmount, every listener attached to the
 *    map it belongs to, and an in-flight dynamic import that cannot resurrect a
 *    disposed component.
 */

import 'maplibre-gl/dist/maplibre-gl.css'

import * as React from 'react'

import { cn } from '#/lib/cn'
import { useTheme } from '#/lib/theme'
import { Spinner } from '#/components/ui'
import { basemapStyle, fallbackStyle } from '#/lib/map/style'
import { isGlobalArchive } from '#/lib/map/coverage'
import {
  basemapAvailability,
  registerPmtilesProtocol,
  resetBasemapAvailability,
} from '#/lib/map/pmtiles'
import { boundsToTuple, clampPadding, resolvePadding } from '#/lib/map/bounds'
import { MapProvider } from './map-context'
import { BasemapNotice } from './basemap-notice'
import { MapAttribution } from './map-attribution'

import type { MapOptions } from 'maplibre-gl'
import type { EdgePadding, LngLat, MapBounds } from '#/lib/map/bounds'
import type { PmtilesHeader } from '#/lib/map/coverage'
import type { GraticuleOptions } from '#/lib/map/graticule'
import type {
  BasemapStatus,
  MapContextValue,
  MapLibreMap,
  MapLibreModule,
} from './map-context'

/** Zoom floor. Below this the world repeats and the map stops being a map. */
export const MAP_MIN_ZOOM = 1.2

/** Zoom ceiling, one step past the archive's own detail. */
export const MAP_MAX_ZOOM = 19

export interface MapCanvasProps {
  /**
   * Accessible name for the map region. Required: an unlabelled interactive
   * canvas is announced as nothing at all.
   */
  readonly label: string
  /** `[longitude, latitude]`. Ignored when `bounds` is given. */
  readonly center?: LngLat
  readonly zoom?: number
  /** Initial camera as a rectangle — takes precedence over `center`/`zoom`. */
  readonly bounds?: MapBounds | null
  /** Insets the initial `bounds` fit must keep clear, in CSS pixels. */
  readonly padding?: Partial<EdgePadding>
  readonly minZoom?: number
  readonly maxZoom?: number
  /** `false` freezes the camera — for a thumbnail or a print view. */
  readonly interactive?: boolean
  /** Building footprints from z14. Default `true`. */
  readonly buildings?: boolean
  /** Basemap POI labels. Default `false`: our own pins are the points of interest. */
  readonly poiLabels?: boolean
  /**
   * Shape of the drafting grid drawn when no archive is available.
   *
   * The default 15° step is right for a world view and invisible at city scale —
   * a four-degree frame contains no 15° line at all, which turns the honest
   * "positions only" sheet into a blank white panel. A caller that knows the
   * extent it is framing should size the step to it.
   */
  readonly graticule?: GraticuleOptions
  /**
   * Requires a modifier key to zoom with the wheel, so a map embedded in a
   * scrolling page cannot swallow the scroll.
   */
  readonly cooperativeGestures?: boolean
  readonly className?: string
  /** Called once, when the style has finished loading. */
  readonly onMapReady?: (map: MapLibreMap) => void
  /** Overlays, markers and controls. Rendered inside the map context. */
  readonly children?: React.ReactNode
}

interface InitialView {
  readonly center: LngLat
  readonly zoom: number
  readonly bounds: MapBounds | null
  readonly padding: Partial<EdgePadding> | undefined
}

/**
 * The frame for a map with nothing to show yet.
 *
 * This is what a trip with no mapped places gets, so it has to read as "nowhere
 * chosen" rather than as a place. Continental zoom over France did not: a trip to
 * Patagonia opened on a full-frame map of Europe, which looks like the product
 * guessed wrong rather than like it is waiting. A whole-world frame is the honest
 * answer, and it is also the scale our own coastline geometry was generalised for,
 * so the empty state is drawn rather than blank.
 */
const DEFAULT_CENTER: LngLat = [10, 26]
const DEFAULT_ZOOM = 1.3

/**
 * Identity of the style document currently applied.
 *
 * Three inputs decide it: the theme, whether there is an archive, and whether that
 * archive is regional enough to need our own ground drawn underneath. Comparing
 * the key rather than the object is what keeps a re-render from calling `setStyle`
 * with a freshly-built copy of the style already on screen.
 */
function styleKey(theme: string, header: PmtilesHeader | null): string {
  if (header === null) return `${theme}:none`
  return `${theme}:archive:${isGlobalArchive(header.bounds) ? 'global' : 'regional'}`
}

export function MapCanvas({
  label,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  bounds = null,
  padding,
  minZoom = MAP_MIN_ZOOM,
  maxZoom = MAP_MAX_ZOOM,
  interactive = true,
  buildings = true,
  poiLabels = false,
  graticule,
  cooperativeGestures = false,
  className,
  onMapReady,
  children,
}: MapCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const [gl, setGl] = React.useState<MapLibreModule | null>(null)
  const [map, setMap] = React.useState<MapLibreMap | null>(null)
  const [ready, setReady] = React.useState(false)
  const [basemap, setBasemap] = React.useState<BasemapStatus>('loading')
  const [archive, setArchive] = React.useState<PmtilesHeader | null>(null)
  const [styleEpoch, setStyleEpoch] = React.useState(0)
  const [probeToken, setProbeToken] = React.useState(0)

  const { resolved: theme } = useTheme()

  // Latest values the async bootstrap needs, without making the mount effect
  // depend on props that legitimately change afterwards.
  const themeRef = React.useRef(theme)
  themeRef.current = theme
  const onMapReadyRef = React.useRef(onMapReady)
  onMapReadyRef.current = onMapReady
  const styleOptionsRef = React.useRef({ buildings, poiLabels, graticule })
  styleOptionsRef.current = { buildings, poiLabels, graticule }
  const zoomRangeRef = React.useRef({ minZoom, maxZoom })
  zoomRangeRef.current = { minZoom, maxZoom }

  // The camera the map is *created* with. Later changes are the caller's job,
  // through `FitBounds` or the map handle — silently flying the camera because a
  // prop re-rendered would fight the reader's own panning.
  const initialRef = React.useRef<InitialView>({
    center,
    zoom,
    bounds,
    padding,
  })

  /** The style key currently applied, so the swap effect can skip a no-op. */
  const appliedRef = React.useRef<string | null>(null)

  const buildStyle = React.useCallback(
    (nextTheme: typeof theme, header: PmtilesHeader | null) =>
      header === null
        ? fallbackStyle({
            theme: nextTheme,
            graticule: styleOptionsRef.current.graticule,
          })
        : basemapStyle({
            theme: nextTheme,
            buildings: styleOptionsRef.current.buildings,
            poiLabels: styleOptionsRef.current.poiLabels,
            // A regional archive has a world outside it, and that world has to
            // be drawn by us or it is not drawn at all. A planet build never
            // shows the underlay, so it does not pay for the geometry.
            ground: !isGlobalArchive(header.bounds),
            graticule: styleOptionsRef.current.graticule,
          }),
    [],
  )

  /* ---------------------------------------------------------------- creation */

  React.useEffect(() => {
    const container = containerRef.current
    if (container === null) return

    // An `AbortController` rather than a captured boolean: it cancels the probe
    // request on unmount instead of merely ignoring its result, and its `aborted`
    // getter is honest across an `await` in a way a narrowed local is not.
    const lifetime = new AbortController()
    // Read through a function: a direct `signal.aborted` test gets narrowed by
    // the compiler and every later check is then treated as dead code.
    const disposed = (): boolean => lifetime.signal.aborted
    let created: MapLibreMap | null = null

    const bootstrap = async (): Promise<void> => {
      const [module, worker] = await Promise.all([
        import('maplibre-gl'),
        import('#/lib/map/worker'),
        registerPmtilesProtocol(),
      ])
      if (disposed()) return
      // Before the first `new maplibregl.Map()`, because that is what spawns the
      // worker — and MapLibre's own guess at the worker URL 404s under Vite in
      // both dev and build. See `#/lib/map/worker`.
      module.setWorkerUrl(worker.MAPLIBRE_WORKER_URL)
      setGl(module)

      const probe = await basemapAvailability({ signal: lifetime.signal })
      if (disposed()) return

      const header = probe.status === 'available' ? probe.header : null
      const activeTheme = themeRef.current
      setBasemap(header === null ? 'unavailable' : 'available')
      setArchive(header)
      appliedRef.current = styleKey(activeTheme, header)

      const initial = initialRef.current
      const fitPadding = resolvePadding(initial.padding)

      const options: MapOptions = {
        container,
        style: buildStyle(activeTheme, header),
        center: initial.center as [number, number],
        zoom: initial.zoom,
        minZoom: zoomRangeRef.current.minZoom,
        maxZoom: zoomRangeRef.current.maxZoom,
        interactive,
        // Our own `MapControls` and `MapAttribution` replace both, so MapLibre's
        // chrome is switched off rather than restyled.
        attributionControl: false,
        maplibreLogo: false,
        // A tilted map breaks the flat, editorial reading of the cartography and
        // makes a numbered itinerary much harder to follow, so pitch and roll are
        // off entirely and drag-rotate — the gesture people trigger by accident —
        // goes with them. Two-finger rotation and Shift+arrow rotation stay, which
        // is why `MapControls` still offers a compass to get back to north.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        rollEnabled: false,
        maxPitch: 0,
        // A cross-fade longer than our slowest UI transition reads as lag.
        fadeDuration: 220,
        trackResize: true,
        renderWorldCopies: true,
      }

      if (cooperativeGestures) {
        options.cooperativeGestures = true
      }

      if (initial.bounds !== null) {
        const [[west, south], [east, north]] = boundsToTuple(initial.bounds)
        options.bounds = [
          [west, south],
          [east, north],
        ]
        options.fitBoundsOptions = {
          padding: clampPadding(fitPadding, {
            width: container.clientWidth,
            height: container.clientHeight,
          }),
        }
      }

      const instance = new module.Map(options)
      created = instance

      let loaded = false

      instance.on('load', () => {
        loaded = true
        if (disposed()) return
        setReady(true)
        onMapReadyRef.current?.(instance)
      })

      // Every style swap invalidates runtime-added sources and layers. The
      // counter lets consumers re-add theirs without watching MapLibre events.
      // `style.load` fires once per style document; `styledata` also fires for
      // each source's TileJSON and would make consumers re-add layers repeatedly.
      instance.on('style.load', () => {
        if (disposed()) return
        setStyleEpoch((current) => current + 1)
      })

      // Registering a handler also suppresses MapLibre's own `console.error`.
      // A single missing tile or glyph range is not actionable by the reader; a
      // failure *before* the style loads means the basemap is not usable at all,
      // which is exactly what the notice exists to say.
      instance.on('error', () => {
        if (disposed() || loaded) return
        setBasemap('unavailable')
      })

      setMap(instance)
    }

    void bootstrap()

    return () => {
      lifetime.abort()
      setMap(null)
      setReady(false)
      created?.remove()
      created = null
    }
    // Only the options MapLibre cannot change after construction. Everything
    // else is applied by the effects below, so a prop change never costs a
    // remount and a refetch.
  }, [buildStyle, cooperativeGestures, interactive])

  /* ------------------------------------------------------------- zoom range */

  React.useEffect(() => {
    if (map === null) return
    map.setMinZoom(minZoom)
    map.setMaxZoom(maxZoom)
  }, [map, maxZoom, minZoom])

  /* ------------------------------------------------------------- theme swap */

  React.useEffect(() => {
    if (map === null || basemap === 'loading') return
    const key = styleKey(theme, archive)
    if (appliedRef.current === key) return
    appliedRef.current = key
    // `diff: true` is the default; it keeps the vector source, and with it every
    // tile already in memory, so recolouring costs no network at all.
    map.setStyle(buildStyle(theme, archive))
  }, [archive, basemap, buildStyle, map, theme])

  /* ------------------------------------------------------------------ retry */

  React.useEffect(() => {
    if (probeToken === 0) return
    let cancelled = false
    void basemapAvailability().then((probe) => {
      if (cancelled) return
      setArchive(probe.status === 'available' ? probe.header : null)
      setBasemap(probe.status === 'available' ? 'available' : 'unavailable')
    })
    return () => {
      cancelled = true
    }
  }, [probeToken])

  const retryBasemap = React.useCallback(() => {
    resetBasemapAvailability()
    setBasemap('loading')
    setArchive(null)
    setProbeToken((current) => current + 1)
  }, [])

  const value = React.useMemo<MapContextValue>(
    () => ({
      map,
      gl,
      ready,
      basemap,
      archive,
      theme,
      styleEpoch,
      retryBasemap,
    }),
    [map, gl, ready, basemap, archive, theme, styleEpoch, retryBasemap],
  )

  return (
    <div
      className={cn(
        'relative isolate size-full overflow-hidden bg-canvas',
        className,
      )}
    >
      <div
        ref={containerRef}
        role="region"
        aria-label={label}
        // MapLibre's own stylesheet is unlayered, so every rule in it outranks a
        // Tailwind utility — utilities live in `@layer utilities`, and an
        // unlayered declaration beats any layered one regardless of specificity.
        // Two rules on `.maplibregl-map` bite here, and both are settled with
        // inline declarations, the one thing a class selector cannot beat:
        //
        // - `position: relative` would win over `absolute` the moment MapLibre
        //   adds its class, collapsing this div to its content height and
        //   shrinking the map to a sliver of the screen.
        // - `font: 12px/20px Helvetica` would be inherited by the pin numerals,
        //   which are portalled in here as descendants of MapLibre's marker pane.
        style={{ position: 'absolute', inset: 0, fontFamily: 'var(--font-ui)' }}
      />

      {map === null ? (
        <div
          className="absolute inset-0 grid place-items-center"
          role="status"
          aria-live="polite"
        >
          <span className="flex items-center gap-2 rounded-full bg-glass px-3 py-1.5 text-caption text-ink-3 ring-1 ring-glass-edge ring-inset backdrop-glass">
            <Spinner size="xs" label={null} />
            Loading map
          </span>
        </div>
      ) : null}

      <MapProvider value={value}>
        {/* Held back until the instance exists. Every child here reads the map
            from context, and `MapMarker` portals its subtree into MapLibre's own
            marker pane — a pane that does not exist during SSR or on the first
            client pass. Rendering children in both then moves DOM out from under
            the hydrating tree, which React reports as a mismatch and recovers
            from by discarding the whole map. Mounting them on the commit after
            the map is created keeps server and client output identical. */}
        {map === null ? null : children}
        {basemap !== 'available' && map !== null ? (
          // Kept mounted while a retry is in flight, so pressing "Try again"
          // spins the button in place instead of making the panel vanish and
          // reappear with no explanation.
          <BasemapNotice
            onRetry={retryBasemap}
            retrying={basemap === 'loading'}
          />
        ) : null}
        {basemap === 'available' ? <MapAttribution /> : null}
      </MapProvider>
    </div>
  )
}
