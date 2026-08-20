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
 * 5. **An honest answer when the renderer itself never starts.** MapLibre needs a
 *    WebGL2 context; a browser that cannot give it one gets no map, no `load`
 *    event, and — without the probe below — a spinner that turns forever. That is
 *    a *different* failure from a missing archive, it is reported separately as
 *    {@link MapContextValue.engine}, and it is the one case where the map is
 *    replaced rather than degraded.
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
import { MAP_ENGINE_TIMEOUT_MS, MapProvider } from './map-context'
import { BasemapNotice, MapEngineNotice } from './basemap-notice'
import { MapAttribution } from './map-attribution'

import type { MapOptions } from 'maplibre-gl'
import type { EdgePadding, LngLat, MapBounds } from '#/lib/map/bounds'
import type { PmtilesHeader } from '#/lib/map/coverage'
import type { GraticuleOptions } from '#/lib/map/graticule'
import type {
  BasemapStatus,
  MapContextValue,
  MapEngineStatus,
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
 * Confirmed once per page: a browser that has given us a WebGL2 context once
 * will give us another, and re-probing per map mount would cost a real context
 * creation for an answer already known. Only the positive is remembered — a
 * refusal can be a GPU process that has since recovered.
 */
let webgl2Confirmed = false

/**
 * True only when this browser claims WebGL2 and then refuses to give us one.
 *
 * MapLibre 6 draws on WebGL2 and nothing else. Handed a canvas it cannot get a
 * context from, it fires an error from inside its own constructor — before any
 * listener of ours can exist, so MapLibre reports it by writing to the console —
 * and returns a map with no painter, which then never fires `load` and cannot
 * even be removed. The symptom is a spinner that turns forever. Probing first
 * turns that into a state worth rendering.
 *
 * The question is asked narrowly on purpose. A platform that does not declare
 * `WebGL2RenderingContext` at all is not answering it — it is a platform with no
 * canvas rendering, not a browser saying no — so nothing is concluded and the
 * map is built as usual. Only a definitive refusal skips construction; every
 * other way of failing to draw is caught by {@link MAP_ENGINE_TIMEOUT_MS}.
 *
 * The probe hands its context straight back. Browsers cap live contexts per page
 * at around sixteen, and the one that matters is the one the map is about to
 * ask for.
 */
function webgl2Refused(): boolean {
  if (webgl2Confirmed) return false
  if (typeof WebGL2RenderingContext !== 'function') return false
  try {
    const context = document.createElement('canvas').getContext('webgl2')
    if (context === null) return true
    context.getExtension('WEBGL_lose_context')?.loseContext()
    webgl2Confirmed = true
    return false
  } catch {
    // A browser that throws rather than answering has told us nothing useful.
    return false
  }
}

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
  const [engine, setEngine] = React.useState<MapEngineStatus>('starting')
  const [settled, setSettled] = React.useState(false)
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
  const labelRef = React.useRef(label)
  labelRef.current = label
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

    let stallTimer: ReturnType<typeof setTimeout> | null = null

    const bootstrap = async (): Promise<void> => {
      // Before the dynamic import and before the archive probe: with no context
      // to render into, neither would ever be looked at.
      if (webgl2Refused()) {
        setEngine('unsupported')
        return
      }

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
        // The canvas is a focusable element, and MapLibre names it from this
        // string. Left at its default it announces as "Map", which on a screen
        // with one map is no name at all and on a screen with two is a trap.
        locale: { 'Map.Title': labelRef.current },
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

      // MapLibre gives the canvas `role="region"` and names it from
      // `Map.Title` — which the `locale` above has already set to the caller's
      // label. The role is the problem: the canvas sits inside our own labelled
      // region, and a region inside a region is announced as two maps with two
      // names. Dropping it leaves one landmark, and leaves the canvas a
      // focusable element with a real accessible name.
      instance.getCanvas().removeAttribute('role')

      let loaded = false

      stallTimer = setTimeout(() => {
        if (disposed() || loaded) return
        setEngine('stalled')
      }, MAP_ENGINE_TIMEOUT_MS)

      instance.on('load', () => {
        loaded = true
        if (stallTimer !== null) clearTimeout(stallTimer)
        if (disposed()) return
        setReady(true)
        setEngine('running')
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
      if (stallTimer !== null) clearTimeout(stallTimer)
      setMap(null)
      setReady(false)
      setEngine('starting')
      setSettled(false)
      created?.remove()
      created = null
    }
    // Only the options MapLibre cannot change after construction. Everything
    // else is applied by the effects below, so a prop change never costs a
    // remount and a refetch.
  }, [buildStyle, cooperativeGestures, interactive])

  /* ------------------------------------------------------- accessible name */

  // `locale` is read once, at construction, so a screen that renames its map —
  // the planner does, from the trip title — would otherwise keep the first name
  // forever.
  React.useEffect(() => {
    if (map === null) return
    map.getCanvas().setAttribute('aria-label', label)
  }, [label, map])

  /* ----------------------------------------------------------- readiness */

  /**
   * The marker a screenshot can wait on.
   *
   * `idle` is MapLibre's own statement that it has finished: the style is
   * loaded, every tile in view has arrived, and no transition is running. It
   * fires again after every later pan, so the flag is latched — a marker that
   * flickered off during a camera move would be worse than no marker at all.
   * The two renderer failures latch it too: nothing further will ever be drawn,
   * so the screen is as settled as it is ever going to be.
   */
  React.useEffect(() => {
    if (settled) return
    if (engine === 'unsupported' || engine === 'stalled') {
      setSettled(true)
      return
    }
    if (map === null) return
    const onIdle = (): void => {
      setSettled(true)
    }
    map.on('idle', onIdle)
    return () => {
      map.off('idle', onIdle)
    }
  }, [engine, map, settled])

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
      engine,
      archive,
      theme,
      styleEpoch,
      retryBasemap,
    }),
    [
      map,
      gl,
      ready,
      basemap,
      engine,
      archive,
      theme,
      styleEpoch,
      retryBasemap,
    ],
  )

  const engineFailed = engine === 'unsupported' || engine === 'stalled'

  return (
    <div
      // Published for a screenshot gate, which otherwise has no way to tell a
      // map that has finished drawing from one that has not started. Flips
      // false → true exactly once, and never back.
      data-map-ready={settled ? 'true' : 'false'}
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

      {map === null && !engineFailed ? (
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
        {engine === 'unsupported' || engine === 'stalled' ? (
          // Replaces the spinner rather than joining it: nothing further is
          // coming, and a spinner that never stops is a lie.
          <MapEngineNotice reason={engine} />
        ) : null}
        {basemap !== 'available' && map !== null && !engineFailed ? (
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
