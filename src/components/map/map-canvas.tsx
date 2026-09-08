/**
 * The base map.
 *
 * Five things make this component more than a `new maplibregl.Map()` wrapper, and
 * each of them is a bug the screens above it would otherwise hit:
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
 *    bytes. With no archive the map is built on `fallbackStyle`, which draws the
 *    whole planet — sea, land and coastline — from the outlines bundled with the
 *    app, and the reader is told the street detail is missing. When there *is* an
 *    archive but it was cut to a region — which ours is — the vector style gets
 *    that same ground underneath it, so the world outside the cut is still a map.
 *    Either way the camera works and every pin sits at its true coordinate; the
 *    reader is never shown a grey void and left to interpret it.
 * 4. **Real cleanup.** `map.remove()` on unmount, every listener attached to the
 *    map it belongs to, and an in-flight dynamic import that cannot resurrect a
 *    disposed component.
 * 5. **An honest answer when the renderer itself never starts.** MapLibre needs a
 *    WebGL2 context; a browser that cannot give it one gets no map, no frame, and
 *    — without the probe below — a spinner that turns forever. That is a
 *    *different* failure from a missing archive, it is reported separately as
 *    {@link MapContextValue.engine}, and it is the one case where the map is
 *    replaced rather than degraded. Every other way of never drawing is caught by
 *    one clock, started when the surface mounts so that it covers the WebGL2
 *    probe, both dynamic imports, the archive probe and the construction itself.
 */

import 'maplibre-gl/dist/maplibre-gl.css'

import * as React from 'react'

import { cn } from '#/lib/cn'
import { useTheme } from '#/lib/theme'
import { Spinner } from '#/components/ui'
import { basemapStyle, fallbackStyle } from '#/lib/map/style'
import { resolveBasemap, useBasemap } from '#/lib/map/basemap'
import { isGlobalArchive } from '#/lib/map/coverage'
import {
  basemapAvailability,
  registerPmtilesProtocol,
  resetBasemapAvailability,
} from '#/lib/map/pmtiles'
import { boundsToTuple, clampPadding, resolvePadding } from '#/lib/map/bounds'
import {
  AttributionSlotProvider,
  MAP_ENGINE_TIMEOUT_MS,
  MapProvider,
} from './map-context'
import { BasemapNotice, MapEngineNotice } from './basemap-notice'
import { useAtlasCopy } from './copy'
import { MapAttribution } from './map-attribution'

import type { MapOptions } from 'maplibre-gl'
import type { BasemapId } from '#/lib/map/basemap'
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

/**
 * The bottom inset the canvas's own notice is designed at, in the pixels
 * {@link MapCanvasProps.padding} speaks — `bottom-4`, the same 16px gutter the
 * rest of the map chrome sits on.
 *
 * The notice only ever moves *up* from here, and only when a screen has declared
 * that more of the bottom edge is covered. A screen that declares nothing gets
 * the designed position.
 */
const NOTICE_INSET = 16

/**
 * Half the engine notice's own height, at the widest copy it carries.
 *
 * Only used as the floor below which its centre cannot travel, so that the
 * panel's top edge never crosses the inset a screen has declared. Measured
 * rather than guessed: the "no WebGL2" copy is four lines at 320px, which with
 * the panel's padding comes to 192px.
 */
const NOTICE_HALF_HEIGHT = 96

/**
 * How long the archive probe gets before the map is built without it.
 *
 * The probe is one ranged `GET` against our own tile route, and its answer
 * decides which style the map is created with — so a request that hangs holds up
 * the map itself. A tiles endpoint that never answers is a *worse* failure than
 * one that 404s, and it deserves the same treatment: give up, build the map on
 * the bundled outlines, and say the basemap is unavailable.
 *
 * Deliberately shorter than {@link MAP_ENGINE_TIMEOUT_MS}, so a hung endpoint
 * degrades to a drawn world rather than to "the map has not drawn yet".
 */
export const MAP_ARCHIVE_PROBE_TIMEOUT_MS = 4000

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
  /**
   * Chrome that exists whether or not a map ever does — a search field, a zoom
   * cluster, a credit.
   *
   * The difference from {@link MapCanvasProps.children} is not decoration, it is
   * *when they are allowed to exist*. Children are held back until the instance
   * is up, because `MapMarker` portals its subtree into MapLibre's marker pane
   * and that pane does not exist during SSR. Nothing in this slot may portal —
   * and in exchange it is rendered on the server, on the first client pass and
   * for the whole of a browser that cannot give MapLibre a WebGL2 context at
   * all. A country search that only answers once a canvas succeeds is not a
   * designed fallback; it is a screen with a hole in it.
   *
   * Rendered inside the same context and the same credit slot as the children,
   * so a control in here reads the map exactly as one below it does — and gets
   * `map: null` while there is none, which every control in this module already
   * handles.
   */
  readonly chrome?: React.ReactNode
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
 * Asks whether the archive is there, with a deadline.
 *
 * {@link basemapAvailability} never rejects — a failed probe is one of its
 * answers — but it will wait as long as the network makes it wait, and the map
 * cannot be created until it answers. So the request gets its own controller:
 * the caller's lifetime aborts it on unmount, and
 * {@link MAP_ARCHIVE_PROBE_TIMEOUT_MS} aborts it when the endpoint has had long
 * enough. An aborted probe reports `network`, which is not memoised, so the
 * retry affordance can genuinely re-ask.
 */
async function probeArchive(
  lifetime: AbortSignal,
): Promise<PmtilesHeader | null> {
  const attempt = new AbortController()
  const giveUp = (): void => {
    attempt.abort()
  }
  lifetime.addEventListener('abort', giveUp, { once: true })
  const deadline = setTimeout(giveUp, MAP_ARCHIVE_PROBE_TIMEOUT_MS)

  try {
    const probe = await basemapAvailability({ signal: attempt.signal })
    return probe.status === 'available' ? probe.header : null
  } finally {
    clearTimeout(deadline)
    lifetime.removeEventListener('abort', giveUp)
  }
}

/**
 * Identity of the style document currently applied.
 *
 * Four inputs decide it: the theme, the chosen basemap, whether there is an
 * archive, and whether that archive is regional enough to need our own ground
 * drawn underneath. Comparing the key rather than the object is what keeps a
 * re-render from calling `setStyle` with a freshly-built copy of the style
 * already on screen.
 *
 * The basemap belongs here for the same reason the theme does, and getting it
 * wrong in either direction is a defect no unit test sees: left out, changing the
 * map style in settings never repaints a mounted map; folded in too eagerly,
 * every render calls `setStyle` and the map flickers and drops the layers its
 * consumers added at runtime.
 */
function styleKey(
  theme: string,
  basemap: BasemapId,
  header: PmtilesHeader | null,
): string {
  const base = `${theme}:${basemap}`
  if (header === null) return `${base}:none`
  return `${base}:archive:${isGlobalArchive(header.bounds) ? 'global' : 'regional'}`
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
  chrome,
}: MapCanvasProps) {
  const t = useAtlasCopy()
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
  // The traveller's map style, published onto a module store by the app shell.
  // Read here rather than passed in, so both mount sites stay free of it.
  const basemapId = useBasemap()

  // Latest values the async bootstrap needs, without making the mount effect
  // depend on props that legitimately change afterwards.
  const themeRef = React.useRef(theme)
  themeRef.current = theme
  const basemapRef = React.useRef(basemapId)
  basemapRef.current = basemapId
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
  //
  // "Later" starts at construction, not at the first render, and the difference
  // is a whole class of wrong opening frames. A screen whose camera is a
  // function of its own container — the atlas opens at the zoom that makes one
  // world span the longer edge — cannot know that number until it has measured,
  // which is one commit after mount. Frozen at first render, such a screen had
  // to keep the canvas out of the tree until the measurement landed, and that
  // is what kept its search field and its zoom cluster out of the server-
  // rendered document. Kept current until the instance exists, the ref is read
  // after two dynamic imports and an archive probe, by which time every
  // layout effect above has long since run.
  const initialRef = React.useRef<InitialView>({
    center,
    zoom,
    bounds,
    padding,
  })
  if (map === null) {
    initialRef.current = { center, zoom, bounds, padding }
  }

  /** The style key currently applied, so the swap effect can skip a no-op. */
  const appliedRef = React.useRef<string | null>(null)

  const buildStyle = React.useCallback(
    (nextTheme: typeof theme, header: PmtilesHeader | null) => {
      // The catalogue decides the cartography, the props decide the geometry.
      //
      // `theme` comes from the entry and not from the argument, which is the
      // whole point of naming Paper and Charcoal beside Automatic: they stay
      // paper and charcoal whatever the chrome is doing. `roadLabels` is the
      // entry's alone — no caller has ever set it, and it is what Quiet is.
      // `poiLabels` deliberately stays the caller's: every entry sets it to
      // `false`, which is already this component's default, so reading it from
      // the entry would change nothing today and would quietly retire a prop
      // that belongs to the screen rather than to the basemap.
      const cartography = resolveBasemap(basemapRef.current, nextTheme)

      return header === null
        ? fallbackStyle({
            // The fallback style carries no label layers at all, so `theme` is
            // the only override that reaches it — enough for Paper to stay paper
            // when the archive is missing.
            theme: cartography.theme,
            graticule: styleOptionsRef.current.graticule,
          })
        : basemapStyle({
            theme: cartography.theme,
            roadLabels: cartography.roadLabels,
            buildings: styleOptionsRef.current.buildings,
            poiLabels: styleOptionsRef.current.poiLabels,
            // A regional archive has a world outside it, and that world has to
            // be drawn by us or it is not drawn at all. A planet build never
            // shows the underlay, so it does not pay for the geometry.
            ground: !isGlobalArchive(header.bounds),
            graticule: styleOptionsRef.current.graticule,
          })
    },
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
    /** Whether the renderer has answered — by painting, or by refusing to. */
    let engineAnswered = false

    // One clock for the whole start-up, armed here rather than after
    // construction: the WebGL2 probe, the two dynamic imports and the archive
    // probe all run first, and a hang in any of them used to be unbounded.
    let stallTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      stallTimer = null
      if (disposed() || engineAnswered) return
      setEngine('stalled')
    }, MAP_ENGINE_TIMEOUT_MS)

    /**
     * Answers the stall question for good, and stops the clock.
     *
     * The flag is what the timer reads, and it is set even when the component
     * has gone: a disposed effect must not leave a clock that reports a failure
     * about a map nobody is looking at.
     */
    const resolveEngine = (status: MapEngineStatus): void => {
      engineAnswered = true
      if (stallTimer !== null) {
        clearTimeout(stallTimer)
        stallTimer = null
      }
      if (disposed()) return
      setEngine(status)
    }

    const bootstrap = async (): Promise<void> => {
      // Before the dynamic import and before the archive probe: with no context
      // to render into, neither would ever be looked at.
      if (webgl2Refused()) {
        resolveEngine('unsupported')
        // Nothing will be drawn, so nothing is showing a basemap. Left on
        // `loading` a consumer would wait on a probe that is never going to be
        // made — the same forever-spinner this branch exists to end.
        setBasemap('unavailable')
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

      const header = await probeArchive(lifetime.signal)
      if (disposed()) return

      const activeTheme = themeRef.current
      setBasemap(header === null ? 'unavailable' : 'available')
      setArchive(header)
      appliedRef.current = styleKey(activeTheme, basemapRef.current, header)

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

      // The renderer's own statement that it exists: `render` fires once per
      // painted frame, from the first one — long before `load`, which waits for
      // every tile in view. A map with a WebGL2 context it cannot use never
      // reaches either, which is precisely what the clock above is for.
      const onFirstFrame = (): void => {
        instance.off('render', onFirstFrame)
        resolveEngine('running')
      }
      instance.on('render', onFirstFrame)

      instance.on('load', () => {
        loaded = true
        // A late `load` after a stall is a recovery: the frames arrived after
        // all, so the notice comes down.
        resolveEngine('running')
        if (disposed()) return
        setReady(true)
        onMapReadyRef.current?.(instance)
      })

      /**
       * The readiness marker, latched on the map's own statement that it has
       * finished — see the `data-map-ready` attribute below.
       *
       * Subscribed here, in the same synchronous block as the constructor,
       * rather than from an effect that reads the map out of state. `idle` is
       * fired from inside MapLibre's render loop, which runs on a later frame:
       * an effect one commit behind can miss it, and a marker that then waits
       * for a *second* `idle` on a map that has stopped moving waits forever.
       * Registering before the first frame closes that window completely.
       *
       * Removed on its first call, so the marker is written exactly once and
       * every later pan — which settles into another `idle` — cannot make it
       * flicker.
       */
      const onIdle = (): void => {
        instance.off('idle', onIdle)
        if (disposed()) return
        setSettled(true)
      }
      instance.on('idle', onIdle)

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

    void bootstrap().catch(() => {
      // A chunk that never arrived, or a MapLibre that threw out of its own
      // constructor: either way nothing was created and nothing will draw.
      // Reported through the same state as any other renderer that never
      // started — and caught rather than left to reject, because an unhandled
      // rejection is a stack trace in the console that no reader can act on.
      resolveEngine('stalled')
    })

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
   * The other half of the readiness marker: a renderer that will never draw.
   *
   * The `idle` path is subscribed at construction, above, because an event
   * cannot be listened for in the past. This is the case with no map to listen
   * to at all — no WebGL2 context, or nothing painted inside the start-up
   * clock. Nothing further is ever coming, so the screen is as settled as it is
   * ever going to be, and a gate that kept waiting would wait out its own
   * timeout on a frame that is already final.
   */
  React.useEffect(() => {
    if (settled) return
    if (engine === 'unsupported' || engine === 'stalled') {
      setSettled(true)
    }
  }, [engine, settled])

  /* ------------------------------------------------------------- zoom range */

  React.useEffect(() => {
    if (map === null) return
    map.setMinZoom(minZoom)
    map.setMaxZoom(maxZoom)
  }, [map, maxZoom, minZoom])

  /* ------------------------------------------------- theme and basemap swap */

  React.useEffect(() => {
    if (map === null || basemap === 'loading') return
    const key = styleKey(theme, basemapId, archive)
    if (appliedRef.current === key) return
    appliedRef.current = key
    // `diff: true` is the default; it keeps the vector source, and with it every
    // tile already in memory, so recolouring costs no network at all.
    map.setStyle(buildStyle(theme, archive))
  }, [archive, basemap, basemapId, buildStyle, map, theme])

  /* ------------------------------------------------------------------ retry */

  React.useEffect(() => {
    if (probeToken === 0) return
    const lifetime = new AbortController()
    void probeArchive(lifetime.signal).then((header) => {
      if (lifetime.signal.aborted) return
      setArchive(header)
      setBasemap(header === null ? 'unavailable' : 'available')
    })
    return () => {
      lifetime.abort()
    }
  }, [probeToken])

  /**
   * How many children have placed their own credit.
   *
   * A map owes exactly one attribution, and a screen that wants it somewhere
   * other than the bottom-right corner — the planner does, because that corner
   * is under a rail — places its own. This is how the default below knows to
   * stand down instead of doubling it up in the accessibility tree.
   */
  const [creditsPlaced, setCreditsPlaced] = React.useState(0)
  const claimCredit = React.useCallback((delta: 1 | -1) => {
    setCreditsPlaced((current) => current + delta)
  }, [])

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
    [map, gl, ready, basemap, engine, archive, theme, styleEpoch, retryBasemap],
  )

  const engineFailed = engine === 'unsupported' || engine === 'stalled'

  /**
   * Where the canvas may post its own notice without it being buried.
   *
   * The screen above floats its chrome over the map — rails, an action bar, a
   * credit it has moved — and it has already said how much of each edge that
   * chrome covers, because the camera needs the very same numbers to fit a trip
   * into what is actually visible. Reusing that declaration is what keeps the
   * "basemap unavailable" panel, and the retry button inside it, out from under a
   * bar the map cannot see. Nothing to keep clear leaves the panel exactly where
   * it is designed to sit.
   */
  const noticeStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    const declared = padding?.bottom
    if (declared === undefined || declared <= NOTICE_INSET) return undefined
    return { bottom: `${declared}px` }
  }, [padding?.bottom])

  /**
   * Where the *engine* notice goes, which is not the middle of the canvas.
   *
   * `MapEngineNotice` centres itself, and centring is right when the canvas is
   * all there is. On a full-bleed screen it is not: the atlas floats a glass
   * shelf across the bottom 400px of the map, and the geometric centre of the
   * canvas is under it — so the one state where the map has nothing to show got
   * its explanation half hidden behind the panel, last line first.
   *
   * The centre of the *unobstructed* box is the honest position, and the screen
   * has already declared where that box is, for the camera. Both insets are
   * accounted for rather than only the bottom one: lifting the panel off a
   * covered footer would otherwise slide it under a search field on a phone,
   * where the top edge is claimed too.
   */
  const engineNoticeStyle = React.useMemo<
    React.CSSProperties | undefined
  >(() => {
    const top = padding?.top ?? 0
    const bottom = padding?.bottom ?? 0
    if (top <= NOTICE_INSET && bottom <= NOTICE_INSET) return undefined
    // `50% + (top - bottom) / 2` is the midpoint of what the chrome leaves. The
    // notice keeps its own `-translate-y-1/2`, so this positions its centre.
    const centre = `calc(50% + ${Math.round((top - bottom) / 2)}px)`
    // And a floor, for the case where the chrome leaves less room than the
    // notice needs — a phone with the atlas drawer open has about 90px of clear
    // map. Clamped this way the panel can only ever be pushed *down* from the
    // top inset, so its first lines are always the readable ones; unclamped, a
    // centre computed from a box smaller than the panel put its heading behind
    // the search field.
    return { top: `max(${top + NOTICE_HALF_HEIGHT}px, ${centre})` }
  }, [padding?.top, padding?.bottom])

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
        // Hidden from the accessibility tree exactly when there is nothing in
        // it and never will be. A renderer that refused a WebGL2 context — or
        // one that never painted — leaves this box empty for good, and a screen
        // that has drawn its own world behind the canvas then announced the same
        // map twice: once as the picture a reader can actually read, once as an
        // empty region with the same name. `MapEngineNotice` below says what
        // happened; this stops the silence from being announced.
        //
        // While the map is merely *coming* it stays a named region: the spinner
        // beside it is `role="status"`, and a region that is about to be filled
        // is not a lie.
        {...(engineFailed
          ? { 'aria-hidden': true }
          : { role: 'region', 'aria-label': label })}
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
            {t('atlas.map.loading')}
          </span>
        </div>
      ) : null}

      <MapProvider value={value}>
        {/* `chrome` always; `children` once the instance exists.

            Every child here reads the map from context, and `MapMarker` portals
            its subtree into MapLibre's own marker pane — a pane that does not
            exist during SSR or on the first client pass. Rendering children in
            both then moves DOM out from under the hydrating tree, which React
            reports as a mismatch and recovers from by discarding the whole map.
            Mounting them on the commit after the map is created keeps server and
            client output identical. Nothing in `chrome` portals, so nothing in
            it needs that protection — and a screen's search field has to exist
            in the document a browser without WebGL2 is left holding. */}
        <AttributionSlotProvider value={claimCredit}>
          {chrome}
          {map === null ? null : children}
        </AttributionSlotProvider>
        {engine === 'unsupported' || engine === 'stalled' ? (
          // Replaces the spinner rather than joining it: nothing further is
          // coming, and a spinner that never stops is a lie.
          <MapEngineNotice reason={engine} style={engineNoticeStyle} />
        ) : null}
        {basemap !== 'available' && map !== null && !engineFailed ? (
          // Kept mounted while a retry is in flight, so pressing "Try again"
          // spins the button in place instead of making the panel vanish and
          // reappear with no explanation.
          <BasemapNotice
            onRetry={retryBasemap}
            retrying={basemap === 'loading'}
            style={noticeStyle}
          />
        ) : null}
        {basemap === 'available' && creditsPlaced === 0 ? (
          // Outside the slot provider, so the default cannot claim the slot it
          // is watching. Guarded on the archive as well, because the credit for
          // the fallback world is carried by the notice above rather than by a
          // second pill stacked behind it — see `BasemapNotice`.
          <MapAttribution />
        ) : null}
      </MapProvider>
    </div>
  )
}
