import * as React from 'react'
import { useRouter, useRouterState } from '@tanstack/react-router'

import {
  AtlasPanel,
  AtlasPanelSkeleton,
  CountryOverlay,
  CountrySearch,
} from '#/components/atlas'
import { ErrorPanel } from '#/components/layout/error-state'
import { GlassPanel, Skeleton } from '#/components/ui'
import {
  MAP_CONTROLS_WIDTH,
  MapAttribution,
  MapCanvas,
  MapControls,
  VISITED_COUNTRY_ZOOM,
  fitMapToBounds,
  useMapContext,
} from '#/components/map'
import { useI18n, useTranslate } from '#/lib/i18n'
import { formatNumber } from '#/lib/format'
import {
  SHELF_CLASS,
  SHELF_VAR,
  SLICE_HEIGHT_CLASS,
  WORLD_CENTRE,
  cameraPadding,
  canvasBox,
  worldZoom,
} from '#/lib/atlas/layout'
import { countryBounds, hasCountryOutline } from '#/lib/map'
import { cn } from '#/lib/cn'
import { WORLD_COUNTRY_COUNT } from '../-server/library'
import { WorldCoverageMap } from './world-map'

import type {
  AtlasPanelTab,
  CountryOverlayCountry,
  CountryOverlayGoal,
  CountryOverlayStatus,
} from '#/components/atlas'
import type { MapVisitedCountry } from '#/components/map'
import type { CountrySearchVisit } from '#/lib/atlas/country-search'
import type { ViewportBox } from '#/lib/atlas/layout'
import type { EdgePadding } from '#/lib/map'
import type { AtlasPayload } from '../-server/library'

/**
 * The atlas, assembled: one map that owns the viewport, and everything the map
 * cannot say floating over it.
 *
 * Every decision in here exists because a world tracker is a map first. The
 * screen this replaced was a scrolling dashboard whose map was a 620×280
 * non-interactive plate in a card — about a seventh of the page — under four
 * counters and above three lists. It answered "how many" well and "where" barely
 * at all.
 *
 * **The viewport slice, spelled out.** `AppFrame bleed` hands the page a bare
 * `<main>`: no max width, no padding, and — importantly — none of the bottom
 * gutter that normally clears the mobile tab bar. So the height is written here,
 * and `/atlas` has no sub-nav, which is why `--subnav-h` is absent from an
 * expression that otherwise looks like the trip planner's. The expression itself
 * lives in `#/lib/atlas/layout` with a test on it, because it has to account for
 * more than the two tokens it looks like it needs: the app header is `border-b`
 * and the tab bar is `border-t`, and the two hairlines that nobody subtracted
 * put the document at `100svh + 1px` from `lg` up and ran the map two pixels
 * under a translucent tab bar on a phone. Nothing inside scrolls the document —
 * every list is its own scroll container — so the page cannot grow behind the map
 * at any width from 360 to 2560.
 *
 * **One world, never a row of them.** MapLibre renders copies of the world
 * either side of the antimeridian by default, and a 2560px screen at world zoom
 * gets two and a bit of them — every visited country highlighted two and a bit
 * times, which is a data map lying about its own data. `setRenderWorldCopies(false)`
 * is applied the moment the style is up. The other half of that is the camera:
 * the container is measured first, and the map opens at the zoom that makes one
 * world exactly span its longer edge, which is also the floor. `worldZoom()` and
 * the centre it is paired with are in `#/lib/atlas/layout`, because the static
 * world behind the canvas has to draw the very same frame.
 *
 * **The shelf's height is measured, never guessed.** Four numbers used to claim
 * to be the shelf — `25rem` in a class, `27.5rem` in a custom property, `9rem`
 * for the collapsed variant and a literal `424` in the camera padding — related
 * only by a comment, and two of them disagreed. Now the panel is measured and
 * published as `--atlas-shelf`; the zoom cluster, the credit and the camera's
 * bottom inset are all derived from that one value, so they cannot drift and the
 * collapsed shelf needs no second set of numbers at all.
 *
 * **All the chrome in one column.** The search pill, the zoom cluster, the credit
 * and the panel are positioned inside a single `max-w-content` well rather than
 * against the viewport's own edges. Below that width nothing changes; above it —
 * a 2560px screen has 1120px spare — it is what keeps the composition together
 * instead of stranding the zoom cluster half a metre from the panel it belongs to.
 *
 * **The camera has exactly one owner per gesture.** A list row asks for a frame,
 * because the reader picked a country from a list and cannot see where it is.
 * The search field flies itself, because it already owns that promise. This
 * screen's own frames stop at `VISITED_COUNTRY_ZOOM.fadeStart`, where the country
 * fills are still at full strength; the interactive ceiling above it has the fill
 * down to a fifth, which answers "show me Portugal" with a grey shape.
 * A click on the map moves nothing: the reader is already looking at the country
 * they clicked, and yanking the camera under a pointer is hostile. Frames are
 * driven by a monotonic token rather than by the selected code, so choosing the
 * same country twice takes the reader there twice and a re-render never moves
 * the map at all.
 *
 * **Selection is one piece of state, reached four ways.** Map click, list row,
 * search result and the record all read and write the same `selected` code, and
 * choosing anywhere opens the record. Alongside it travels a monotonic
 * `selectionToken`, because the map's own panel has to tell "France was chosen
 * again" from "the chosen country is still France" — a reader who dismisses the
 * panel and presses the same country is asking for it back.
 *
 * **The map answers on the map.** `CountryOverlay` owns everything a pointer or
 * a press means over the canvas: the hover card, the panel that carries the same
 * facts plus the two writes, and the paint layer that reports both. It renders
 * into {@link SURFACE_LAYER}, a sibling of the shelf rather than a child of the
 * canvas, so a phone's panel can borrow the shelf's four hundred pixels when the
 * clear map is shorter than the card. Choosing a country no longer forces the
 * drawer open: that was what left a 393px handset a hundred and fifty pixels of
 * world with the country it had just been asked about underneath the panel
 * describing it.
 *
 * **The world is drawn twice, on purpose, and only ever visible once.** Behind
 * the canvas sits the static SVG world (`./world-map`), from the same bundled
 * outlines, the same `--color-country-*` tokens and now the same frame. The
 * canvas is mounted with a transparent ground, so before the first painted frame
 * the reader sees the world rather than an empty rectangle, and if the renderer
 * never starts — no WebGL2, or a canvas that never draws — it stays, under the
 * canvas's own designed notice. It fades out the moment MapLibre reports its
 * style loaded.
 *
 * **Exactly one map is ever announced.** Two things on this screen can be "the
 * world map": the canvas region and the drawn SVG behind it. While the renderer
 * is coming up the canvas owns the name and the SVG is decoration; when the
 * renderer refuses — no WebGL2 — the canvas hides itself from the accessibility
 * tree and the SVG, which is now the only map there is, takes the name back.
 * Neither state announces the same map twice, and neither announces an empty
 * region.
 *
 * **The chrome is not the map's child.** The search pill and the zoom cluster
 * used to be rendered inside `MapCanvas`, which holds its children back until a
 * MapLibre instance exists. That put them out of the server-rendered document
 * altogether and out of the no-WebGL2 fallback *permanently* — a country search
 * that only answers once a GPU says yes. They go in the canvas's `chrome` slot
 * instead: inside the map's context, so they still drive the camera when there
 * is one, and inside the document from the very first byte. The zoom cluster is
 * the one piece that stands down when the renderer refuses, because there is
 * then nothing to zoom; the search, the panel, the record and the list all still
 * work, and the notice says why the world is a drawing.
 *
 * **The canvas overhangs its frame by a pixel.** With world copies off, the
 * antimeridian is the canvas's own left and right edge, and both the generated
 * graticule and every country ring that touches the date line draw a line on it —
 * half inside the frame, half outside, which reads as a seam. `canvasBox()` hands
 * the camera the wider box, so both the live canvas and the static world behind
 * it push that line just past the clip.
 */

/* -------------------------------------------------------------------- layout */

/**
 * The viewport slice. Shared by the loaded, pending and error screens, so a slow
 * read and a failed one occupy the very same box the map will.
 */
const SLICE = cn(
  'relative isolate w-full overflow-hidden bg-canvas',
  SLICE_HEIGHT_CLASS.base,
  SLICE_HEIGHT_CLASS.lg,
  SHELF_CLASS.fallback,
  SHELF_CLASS.clear,
)

/**
 * The well every floating element is positioned in.
 *
 * `--content-max` is the measure the rest of the product is laid out to, and the
 * panel was already centred in it. The map chrome was not: it was pinned to the
 * slice, so at 2560 the search pill, the credit and the zoom cluster sat 560px
 * outside the column the panel occupied. One shared positioning layer puts all
 * four on the same grid at every width, and changes nothing at or below 1440.
 *
 * `pointer-events-none` is not optional: this box covers the whole map, and a
 * transparent full-size div over a canvas eats every pan and every click. Each
 * child turns them back on for itself.
 */
const WELL = cn(
  'pointer-events-none absolute top-0 bottom-0 mx-auto max-w-content',
  // A pixel in from each edge of the overhanging box below, which puts it back
  // on the slice's own edges: the overhang belongs to the drawing, not to the
  // chrome floating over it. Symmetric, so it needs no logical form.
  'right-px left-px',
)

/**
 * The box both maps are drawn in: the slice, a pixel wider on each side.
 *
 * With `renderWorldCopies` off, the world's own edge — the antimeridian — lands
 * exactly on the drawing's left and right edge, and two things are drawn on that
 * line: the generated graticule's first meridian, at -180°, and the outline
 * stroke of every country ring that touches the date line, Antarctica and Russia
 * among them. Half of each falls inside the frame and the other half outside,
 * which reads as a one-pixel seam down the edge of the screen rather than as the
 * feature it is. So the drawing overhangs and the slice, which clips, hides it.
 * `canvasBox()` hands the camera the same two pixels, so the world still spans
 * the frame exactly.
 */
const DRAWING = 'absolute top-0 bottom-0 -right-px -left-px'

/**
 * Where the map's own hover and click surfaces are drawn.
 *
 * Deliberately a sibling of the map rather than a child of it. `MapCanvas` is
 * `isolate`, so anything inside it is capped at the canvas's own place in the
 * stack no matter what layer token it claims — a card mounted there could never
 * pass over the shelf, and on a 360px phone the shelf is the only place a card
 * carrying a fact grid *and* two actions can borrow four hundred pixels from.
 * Here it is a peer of both, at `--z-map-surface`: one step above the shelf and
 * the search pill, and — because the whole slice is `isolate` too — never above
 * the app header or the mobile tab bar, whatever it claims.
 *
 * `pointer-events-none`, like the chrome well above it: this box covers the
 * entire map, and each surface turns them back on only for itself, so a pan, a
 * drag and a press on open water all still reach the canvas. `@container`
 * because the surfaces size themselves against the map rather than against the
 * window — the panel is a column on a phone and a row from 768px of *map*.
 */
const SURFACE_LAYER = cn(
  'pointer-events-none absolute inset-0 overflow-hidden @container',
  'z-map-surface',
)

/** The floating panel's box: gutters, and the product's own content ceiling. */
const PANEL_BOX = cn(
  'absolute inset-x-3 bottom-3 mx-auto max-w-content',
  'lg:inset-x-4 lg:bottom-4',
)

/**
 * The search pill: the top row on a phone, minus the width the zoom cluster
 * takes on the right plus a gutter; a fixed column at the top left from `lg`.
 */
const SEARCH_BOX = cn(
  // `w-auto` is load-bearing: the pill's own root is `w-full`, which on an
  // absolutely positioned element beats a start/end pair and pushed it 84px
  // past the far edge of the screen, straight under the zoom cluster.
  //
  // Logical insets throughout, so the whole composition mirrors in `ar`: the
  // search takes the inline start at every width and the zoom cluster the
  // inline end, exactly as they do in `en`. The canvas under them is not
  // mirrored — a map is not a paragraph — so each of these states its own side
  // rather than inheriting one.
  'pointer-events-auto absolute top-3 end-18 start-3 w-auto z-map-overlay',
  'lg:top-4 lg:end-auto lg:start-4 lg:w-88',
)

/**
 * Where the rest of the chrome sits, and why it is not the same place at both
 * sizes.
 *
 * A phone has no room for a zoom cluster above a drawer that can be a third of
 * the screen tall — open the drawer on a short handset and the controls end up on
 * top of the search field. So below `lg` they move to the top right, opposite a
 * search pill that gives up 72px for them, where no drawer height can ever reach
 * them; from `lg` up they return to the bottom right, lifted clear of the shelf
 * by `--atlas-clear`, which is the measured shelf plus its gutter and a gap.
 *
 * The credit is the mirror image. Below `lg` the top-left slot is the search
 * pill's, and stacking the credit eight pixels under it put two translucent
 * pills in one optical column; it goes to the bottom-left instead, on the same
 * `--atlas-clear` line as the cluster, which is a lane nothing else claims. From
 * `lg` the top-right corner is genuinely free and it takes that.
 */
const CHROME = {
  controls: cn(
    'pointer-events-auto top-3 end-3 bottom-auto',
    'lg:top-auto lg:end-4 lg:bottom-(--atlas-clear)',
  ),
  credit: cn(
    'top-auto end-auto bottom-(--atlas-clear) start-3',
    'lg:top-4 lg:end-4 lg:bottom-auto lg:start-auto',
  ),
} as const

/* --------------------------------------------------------------- map children */

interface AtlasCameraProps {
  /** Bumped once per frame request. `0` means nothing has been asked for. */
  readonly token: number
  /** The country to frame when the token moves. */
  readonly countryCode: string | null
  readonly padding: EdgePadding
}

/**
 * Frames one country when the screen asks for it.
 *
 * Renders nothing: a component is the cheapest way to get an effect inside the
 * map's context without threading the instance back up through the screen. The
 * code and the padding are read through refs so the effect depends on the
 * *request* and nothing else — listing the code would drag the camera every time
 * a click on the map changed the selection, which is the one gesture that must
 * not move it.
 */
function AtlasCamera({ token, countryCode, padding }: AtlasCameraProps) {
  const { map, ready } = useMapContext()
  const codeRef = React.useRef(countryCode)
  codeRef.current = countryCode
  const paddingRef = React.useRef(padding)
  paddingRef.current = padding

  React.useEffect(() => {
    if (token === 0 || map === null || !ready) return
    const code = codeRef.current
    if (code === null) return
    const bounds = countryBounds(code)
    // Seventy-five ISO codes have no polygon in the bundled 1:110m cut. There is
    // nothing to frame, the record says so in words, and the camera stays put
    // rather than flying somewhere arbitrary.
    if (bounds === null) return
    fitMapToBounds(map, bounds, {
      padding: paddingRef.current,
      // `fadeStart`, not `interactiveMax`. The fills hold full strength at and
      // below this zoom and are down to a fifth of it by the time the layer
      // stops answering a pointer — so framing at the interactive ceiling
      // answered "show me Portugal" with a grey shape on a basemap that has no
      // tiles out there either. Full strength is the whole point of the move.
      maxZoom: VISITED_COUNTRY_ZOOM.fadeStart,
    })
  }, [map, ready, token])

  return null
}

/* ------------------------------------------------------------------ map chrome */

interface AtlasChromeProps {
  readonly countries: ReadonlyArray<CountrySearchVisit>
  readonly selectedCode: string | null
  readonly onSelect: (countryCode: string | null) => void
  readonly padding: EdgePadding
  /**
   * Told when the renderer settles into a state it will not leave. The screen
   * needs the answer for the static world behind the canvas, which becomes the
   * only map on the page the moment the canvas admits it will never draw one.
   */
  readonly onEngineFailedChange: (failed: boolean) => void
}

/**
 * Everything floating over the map that is not the panel.
 *
 * Rendered through `MapCanvas`'s `chrome` slot rather than as its child, which
 * is what puts it in the server-rendered document and keeps it there on a
 * machine that cannot give MapLibre a WebGL2 context. Inside the slot it is
 * still inside the map's context, so the search flies the camera and the zoom
 * cluster zooms exactly as before; with no map they both fall back to the
 * `map: null` behaviour every control in that module already ships.
 *
 * The zoom cluster is withdrawn once the renderer has definitively refused. A
 * toolbar that is present, enabled and inert is a worse answer than no toolbar
 * beside a notice that explains the drawing — and there is genuinely nothing to
 * zoom: what is left on screen is a fixed-scale SVG. Everything that still works
 * without a renderer stays: the search, its results, the record, the list.
 */
function AtlasChrome({
  countries,
  selectedCode,
  onSelect,
  padding,
  onEngineFailedChange,
}: AtlasChromeProps) {
  const { engine } = useMapContext()
  const failed = engine === 'unsupported' || engine === 'stalled'

  React.useEffect(() => {
    onEngineFailedChange(failed)
  }, [failed, onEngineFailedChange])

  return (
    <div className={WELL}>
      <CountrySearch
        countries={countries}
        selectedCode={selectedCode}
        onSelect={onSelect}
        padding={padding}
        className={cn(
          // `GlassPanel`'s floating default is `z-dropdown`, which sits above
          // the app nav. Map chrome belongs below it.
          SEARCH_BOX,
          // The 72px the pill gives up on a phone belongs to the zoom cluster.
          // With no cluster there is nothing to give it up for, and the gap
          // reads as a control that failed to draw.
          failed && 'end-3',
        )}
      />

      {failed ? null : (
        <MapControls
          // `custom`: every inset this screen needs is logical and stated
          // below, and a physical corner from the module would win over it in
          // the cascade. See `MapCorner`.
          position="custom"
          // Zoom and compass, and deliberately no "find my location".
          //
          // Two reasons, and the second one is the screen's own contract. This
          // map's ceiling is `VISITED_COUNTRY_ZOOM.fadeEnd`, so locating a
          // reader can only ever answer "you are in the country you are in" —
          // a button that spends a permission prompt to say nothing. And the
          // button exists only after a `navigator` probe that cannot run during
          // a server render, so on a cluster anchored to its *bottom* edge it
          // arrives as a 34px growth after hydration: a layout shift after
          // paint, on the one screen in the product that must not have one.
          showLocate={false}
          className={CHROME.controls}
        />
      )}

      {/* ODbL. Credited in the product's own type, at a size that can be read,
          and clear of both the search pill and the panel. Renders nothing until
          there are tiles to credit — with none, the basemap notice carries it. */}
      <MapAttribution className={CHROME.credit} />
    </div>
  )
}

/* -------------------------------------------------------------------- viewport */

/**
 * Runs before the browser paints on the client and never on the server.
 *
 * Both measurements below place something: the camera's opening zoom is a
 * function of the container, and the chrome's clearance is a function of the
 * shelf. Measured in `useEffect` they land one painted frame late, which is a
 * visible jump and a layout shift after paint for exactly the elements this
 * screen is supposed to hold still. `useLayoutEffect` lands before the paint —
 * and calling it during a server render is what React warns about, so on the
 * server it is the passive one, which never runs there anyway.
 */
const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

/**
 * An element's own box in CSS pixels, or `null` before it has been measured.
 *
 * Used twice: for the slice, whose longer edge decides the opening zoom, and for
 * the glass shelf, whose height decides where the rest of the chrome sits.
 */
function useMeasuredBox(): [
  React.RefObject<HTMLDivElement | null>,
  ViewportBox | null,
] {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [box, setBox] = React.useState<ViewportBox | null>(null)

  useIsomorphicLayoutEffect(() => {
    const node = ref.current
    if (node === null) return

    const read = (): void => {
      setBox((previous) => {
        const next = {
          width: node.clientWidth || window.innerWidth,
          height: node.clientHeight || window.innerHeight,
        }
        return previous !== null &&
          previous.width === next.width &&
          previous.height === next.height
          ? previous
          : next
      })
    }
    read()

    const observer = new ResizeObserver(read)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])

  return [ref, box]
}

const WIDE_QUERY = '(min-width: 1024px)'

/**
 * True on a viewport wide enough for the desktop composition.
 *
 * Read during the first client render rather than in an effect, because the one
 * thing it feeds — the camera's padding — is consumed by `MapCanvas` when it
 * constructs the map, which happens in an effect *below* this component and
 * therefore before any effect here could correct it. On a phone that meant the
 * map was built reserving 360px of shelf it did not have.
 *
 * Reading a media query during render is only safe because nothing rendered
 * depends on it: the padding is a plain object handed to effects and to
 * client-only children, and every element whose *appearance* changes with the
 * breakpoint does so through a Tailwind variant or a custom property instead.
 * The server's answer and the client's may differ and no markup can notice.
 */
function useIsWide(): boolean {
  const [wide, setWide] = React.useState(
    () =>
      typeof window !== 'undefined' && window.matchMedia(WIDE_QUERY).matches,
  )

  React.useEffect(() => {
    const query = window.matchMedia(WIDE_QUERY)
    const read = (): void => setWide(query.matches)
    read()
    query.addEventListener('change', read)
    return () => {
      query.removeEventListener('change', read)
    }
  }, [])

  return wide
}

/* --------------------------------------------------------------------- screen */

export interface AtlasScreenProps {
  readonly atlas: AtlasPayload
}

export function AtlasScreen({ atlas }: AtlasScreenProps) {
  const { locale, t } = useI18n()
  const [containerRef, box] = useMeasuredBox()
  const [shelfRef, shelfBox] = useMeasuredBox()
  const wide = useIsWide()

  const [selected, setSelected] = React.useState<string | null>(null)
  const [tab, setTab] = React.useState<AtlasPanelTab>('stats')
  /**
   * `null` until the reader has an opinion: the shelf then follows the
   * breakpoint through CSS, open from `lg` and shut on a phone, without either
   * render pass having to know which it is.
   */
  const [expanded, setExpanded] = React.useState<boolean | null>(null)
  const [cameraToken, setCameraToken] = React.useState(0)
  /**
   * Bumped once per selection gesture, whichever surface made it.
   *
   * The map's own panel needs to know that a country was *chosen*, not merely
   * that the chosen country changed: a reader who dismisses the panel for France
   * and then presses France again is asking for it back, and the selected code
   * never moved.
   */
  const [selectionToken, setSelectionToken] = React.useState(0)
  const [mapDrawing, setMapDrawing] = React.useState(false)
  /**
   * The layer the map's surfaces render into, once it exists.
   *
   * Held as state rather than as a ref because the overlay is a child of the
   * canvas and has to re-render when the host appears — a ref would hand it
   * `null` on the one commit that matters and never tell it otherwise.
   */
  const [surfaceHost, setSurfaceHost] = React.useState<HTMLDivElement | null>(
    null,
  )
  /**
   * Whether the renderer has given up for good.
   *
   * Reported up out of the map's own context by {@link AtlasChrome}, because it
   * decides something outside the canvas: which of the two worlds on this screen
   * is the one a screen reader is told about.
   */
  const [engineFailed, setEngineFailed] = React.useState(false)

  /**
   * The one shelf height, published to CSS and handed to the camera.
   *
   * Absent until it has been measured, and the classes on the slice carry a
   * designed default for exactly that window — so a document with no JavaScript
   * yet still places the chrome correctly, and there is nothing to move once the
   * measurement lands.
   */
  const shelf = shelfBox?.height ?? null
  const shelfStyle = React.useMemo<React.CSSProperties | undefined>(
    () =>
      shelf === null
        ? undefined
        : ({ [SHELF_VAR]: `${shelf}px` } as React.CSSProperties),
    [shelf],
  )

  const padding = React.useMemo(
    () =>
      cameraPadding({
        wide,
        shelf: shelf ?? 0,
        controls: MAP_CONTROLS_WIDTH,
      }),
    [wide, shelf],
  )

  /**
   * `hasOutline` is resolved here, once, and handed down.
   *
   * `hasCountryOutline()` reaches into the bundled world geometry, and the
   * record, the list and the search all need the answer per row. Asking it in a
   * row component would pull the coastline table into a component chunk once per
   * consumer; the screen already has it, because the map does.
   */
  const countries = React.useMemo(
    () =>
      atlas.countries.map((row) => ({
        countryCode: row.countryCode,
        continent: row.continent,
        firstVisitedOn: row.firstVisitedOn,
        lastVisitedOn: row.lastVisitedOn,
        visitCount: row.visitCount,
        note: row.note,
        hasOutline: hasCountryOutline(row.countryCode),
      })),
    [atlas.countries],
  )

  /**
   * The record projected down to what the paint layer needs.
   *
   * `MapVisitedCountry` is the map module's view type, prefixed there precisely
   * because `VisitedCountry` is already the D1 row in `#/server/db/types`. This
   * screen never imports the row type, and if it ever needs to it will alias it
   * rather than let one shadow the other.
   */
  const visits = React.useMemo<ReadonlyArray<MapVisitedCountry>>(
    () =>
      atlas.countries.map((row) => ({
        countryCode: row.countryCode,
        lastVisitedOn: row.lastVisitedOn,
      })),
    [atlas.countries],
  )

  const visitedCodes = React.useMemo(
    () => atlas.countries.map((row) => row.countryCode),
    [atlas.countries],
  )

  /**
   * The same record again, carrying the four figures the shelf never needed.
   *
   * `countries` above is the list's shape and stops at the visit; the card on
   * the map prints trips, saved places and the two trip months as well, and the
   * loader has already counted all four for every country on the record. A
   * second projection rather than a wider first one, because the list is the
   * bigger consumer and `CountriesListCountry` is its contract.
   */
  const overlayCountries = React.useMemo<ReadonlyArray<CountryOverlayCountry>>(
    () =>
      atlas.countries.map((row) => ({
        countryCode: row.countryCode,
        tripCount: row.tripCount,
        placeCount: row.visitedPlaceCount,
        firstTripOn: row.firstTripOn,
        lastTripOn: row.lastTripOn,
        visit: {
          firstVisitedOn: row.firstVisitedOn,
          lastVisitedOn: row.lastVisitedOn,
          visitCount: row.visitCount,
          note: row.note,
        },
      })),
    [atlas.countries],
  )

  /**
   * Every country the bucket list names, not the head of it.
   *
   * The shelf shows a bounded slice, which is right for a list somebody reads
   * and wrong for the question the map asks — "is the country under the pointer
   * already on it?" — because a country at row forty-one would answer no. The
   * loader ships an uncapped, country-shaped index for exactly this.
   */
  const overlayGoals = React.useMemo<ReadonlyArray<CountryOverlayGoal>>(() => {
    // The uncapped index carries no target year, and the capped display list
    // does. Read across the two by country — the same join the shelf makes —
    // rather than let the map say "waiting for its turn" about an entry the
    // reader has put a year against.
    const years = new Map<string, number | null>()
    for (const row of atlas.bucketList) {
      if (row.kind !== 'country') continue
      const code = (row.countryCode ?? '').trim().toUpperCase()
      if (code !== '') years.set(code, row.targetYear)
    }
    return atlas.bucketListCountries.map((row) => ({
      countryCode: row.countryCode,
      id: row.itemId,
      targetYear: years.get(row.countryCode.trim().toUpperCase()) ?? null,
      isAchieved: row.isAchieved,
    }))
  }, [atlas.bucketList, atlas.bucketListCountries])

  const allTime = atlas.stats.find((row) => row.statYear === 0) ?? null

  /**
   * Opening the record is what selecting a country means, everywhere.
   *
   * It no longer forces the shelf open, and that is the phone's whole
   * composition. A press used to expand the drawer to 58svh, which left a
   * 393×659 handset about a hundred and fifty pixels of map — the country the
   * reader had just pressed pushed off the top of the screen by the panel
   * describing it. The map now answers on the map, at the point of contact, so
   * the shelf stays its own header and the world keeps three quarters of the
   * slice. The tab still follows, so opening the shelf shows the same country.
   */
  const open = React.useCallback((code: string | null) => {
    setSelected(code)
    setSelectionToken((token) => token + 1)
    if (code === null) return
    setTab('country')
  }, [])

  /** A list row asks for a frame as well; a map click does not need one. */
  const openAndFrame = React.useCallback(
    (code: string) => {
      open(code)
      setCameraToken((token) => token + 1)
    },
    [open],
  )

  /**
   * Whether the figures on screen are the ones the server currently holds.
   *
   * Every write on this screen ends in `router.invalidate()`, which re-reads the
   * atlas: for that window the trip count, the places count and both trip months
   * beside a country are the ones from before the press. The map's panel says so
   * with the card's own skeleton, at the card's own dimensions, so the swap moves
   * nothing — and says so again if the re-read never comes back, with a retry
   * that runs the very same invalidation.
   *
   * Read off *this route's own match* rather than off the router's global
   * `isLoading`. The global flag is true for any pending navigation, so pressing
   * a link to the trip planner put the card into its skeleton and held it there
   * for the length of a page load that had nothing to do with the atlas — a
   * loading state answering a question nobody asked. `matches.at(-1)` is the leaf,
   * which on this screen is `/_app/atlas` by construction, and `isFetching` is
   * true for exactly the re-read.
   *
   * The failed branch is deliberately kept beside it, and it is honest about what
   * it covers: a loader that throws on the *first* read is caught by the route's
   * own `errorComponent`, which replaces this whole screen. This is the state
   * where the payload on screen is stale and the re-read behind it did not come
   * back — the card says the figures did not arrive rather than printing the old
   * ones as though they were current.
   */
  const router = useRouter()
  const status = useRouterState({
    select: (state): CountryOverlayStatus => {
      const match = state.matches.at(-1)
      if (match === undefined) return 'ready'
      if (match.status === 'error') return 'failed'
      return match.isFetching === false ? 'ready' : 'loading'
    },
  })
  const retry = React.useCallback(() => {
    void router.invalidate()
  }, [router])

  const worldLabel =
    atlas.countryCount === 0
      ? t('atlas.screen.world.empty')
      : t('atlas.screen.world.summary', {
          visited: formatNumber(atlas.countryCount, locale),
          total: formatNumber(WORLD_COUNTRY_COUNT, locale),
        })

  return (
    <div ref={containerRef} className={SLICE} style={shelfStyle}>
      {/* The ground of last resort, and the first thing the reader sees. It is
          the same geometry, the same tokens and the same frame the live layer
          paints with, so the hand-off is a change of sharpness rather than a
          change of position. */}
      <div className={DRAWING}>
        <WorldCoverageMap
          visited={visitedCodes}
          label={worldLabel}
          // Decoration for as long as the canvas over it is a map region with
          // this same name — which is from the first server-rendered byte until
          // the renderer either draws or refuses. It takes the name back only in
          // the state where the canvas has hidden itself: then this drawing is
          // the map, and it is the only thing left to announce.
          decorative={!engineFailed}
          className={cn(
            // A short cut rather than a long cross-fade: 150ms is the token exit
            // duration, and the two are drawing the same world in the same
            // place, so there is nothing to see across the swap.
            'absolute inset-0 -z-10',
            'transition-opacity duration-fast ease-out-quint',
            mapDrawing ? 'opacity-0' : 'opacity-100',
          )}
        />

        {/* Mounted from the first render, not from the first measurement.
            `MapCanvas` reads its opening camera when it constructs the map —
            after two dynamic imports and an archive probe — so the zoom that
            makes one world span this container is ready long before it is
            wanted, and the chrome below travels in the server-rendered document
            instead of waiting on a layout effect that never runs there. */}
        <MapCanvas
          label={worldLabel}
          center={WORLD_CENTRE}
          zoom={box === null ? undefined : worldZoom(canvasBox(box))}
          padding={padding}
          minZoom={box === null ? undefined : worldZoom(canvasBox(box))}
          // The country fills are not drawn past this zoom, so the reader can
          // never arrive somewhere the atlas has nothing to say.
          maxZoom={VISITED_COUNTRY_ZOOM.fadeEnd}
          buildings={false}
          // Drafting lines over the sea, for the state where the archive is
          // regional or absent and the ground layers are the map. Majors every
          // 30 degrees rather than every 60: at world zoom the grid is already
          // down to 22% opacity, and the sparser pair read as two stray lines.
          graticule={{ step: 15, majorEvery: 2 }}
          onMapReady={(map) => {
            // `MapCanvas` constructs with `renderWorldCopies: true` and exposes
            // no prop for it, so the single world is asked for through
            // MapLibre's own setter. A wide screen would otherwise show two and
            // a bit copies of the world with every visited country highlighted
            // two and a bit times, which is a data map lying about its own data.
            // It is a transform property rather than a style one, so the theme
            // swap — which replaces the whole style document — cannot undo it.
            map.setRenderWorldCopies(false)
            setMapDrawing(true)
          }}
          // Transparent, so the static world behind it shows through until the
          // renderer paints — and forever, if it never does.
          className="absolute inset-0 bg-transparent"
          chrome={
            <AtlasChrome
              countries={countries}
              selectedCode={selected}
              onSelect={open}
              padding={padding}
              onEngineFailedChange={setEngineFailed}
            />
          }
        >
          {/* Above the paint layer on purpose: it renders that layer itself,
              and the pointer listener it registers has to reach MapLibre before
              the one that reports a country crossing, or the card for a French
              overseas département would be placed from the position the pointer
              held one frame earlier. */}
          <CountryOverlay
            visits={visits}
            countries={overlayCountries}
            bucketList={overlayGoals}
            selectedCode={selected}
            selectionToken={selectionToken}
            onSelect={open}
            padding={padding}
            container={surfaceHost}
            status={status}
            onRetry={retry}
          />

          <AtlasCamera
            token={cameraToken}
            countryCode={selected}
            padding={padding}
          />
        </MapCanvas>
      </div>

      {/* Written before the shelf so the two are in document order as well as
          in the layer stack, and always mounted so the overlay has somewhere to
          render from its very first commit. */}
      <div
        ref={setSurfaceHost}
        data-part="country-surfaces"
        className={SURFACE_LAYER}
      />

      <AtlasPanel
        ref={shelfRef}
        // The one hook the shelf answers to from outside: the map's surfaces
        // are placed against its box, and a gate that had to find it by class
        // would be asserting against a Tailwind string rather than against the
        // composition.
        data-part="atlas-shelf"
        countries={countries}
        selectedCode={selected}
        onSelect={openAndFrame}
        onClearSelection={() => setSelected(null)}
        tab={tab}
        onTabChange={setTab}
        expanded={expanded}
        onExpandedChange={setExpanded}
        stats={{
          countryCount: atlas.countryCount,
          worldCount: WORLD_COUNTRY_COUNT,
          regionCount: atlas.regionCount,
          visitCount: atlas.visitCount,
          tripCount: allTime?.tripCount ?? null,
          placeCount: allTime?.placeCount ?? null,
          cityCount: allTime?.cityCount ?? null,
          dayCount: allTime?.dayCount ?? null,
          distanceMetres: allTime?.distanceMetres ?? null,
        }}
        byContinent={atlas.byContinent}
        bucketList={atlas.bucketList}
        // The same uncapped index the map overlay reads, and for the same
        // reason. `bucketList` above is the head of the list — forty rows — which
        // is the right shape for something a reader scrolls and the wrong one for
        // "is the selected country already on it?": a country at row forty-one
        // answered no, the shelf offered "Add to list" for an entry that was
        // already there, and the map surface a few hundred pixels above it
        // answered "On the bucket list" about the very same country at the very
        // same moment.
        bucketCountries={atlas.bucketListCountries}
        bucketTotal={atlas.bucketListTotal}
        bucketAchieved={atlas.bucketListAchieved}
        className={cn(
          PANEL_BOX,
          // `h-auto` until the reader has an opinion, so the collapsed phone
          // shelf is exactly its own header and the desktop one is the shelf.
          //
          // Open on a phone it is a drawer, and a drawer is measured against the
          // screen rather than against the grid: 58svh on a tall handset, capped
          // at 30rem so a tablet in portrait does not hand it half the page. The
          // reader asked for it, and one press of the same button gives the map
          // back.
          expanded === null
            ? cn('h-auto', SHELF_CLASS.height)
            : expanded
              ? cn('h-[min(58svh,30rem)]', SHELF_CLASS.height)
              : 'h-auto',
        )}
      />
    </div>
  )
}

/* -------------------------------------------------------------------- pending */

/**
 * The read is in flight.
 *
 * Drawn as the screen it is about to become — the same viewport slice, the same
 * search pill, the same panel geometry — rather than as the old dashboard's
 * stack of card outlines. A skeleton whose shape differs from the content it
 * replaces guarantees the layout shift after paint that it exists to prevent.
 */
export function AtlasScreenPending() {
  return (
    <div className={SLICE}>
      {/* No countries to light up yet, so the world is drawn as ground. It is
          decorative here: the region that will name itself does not exist. */}
      <div className={DRAWING}>
        <WorldCoverageMap
          visited={[]}
          label=""
          decorative
          className="absolute inset-0 -z-10 opacity-60"
        />

        {/* Inside the drawing box, exactly where the real pill will be: `WELL`
            compensates for the overhang, so it has to be measured against the
            same box in both states or the swap moves the pill a pixel. */}
        <div className={WELL}>
          <GlassPanel
            radius="lg"
            padding="none"
            floating={false}
            aria-hidden="true"
            className={cn(SEARCH_BOX, 'flex w-full min-w-0 flex-col p-1.5')}
          >
            <Skeleton radius="md" className="h-10 w-full" />
          </GlassPanel>
        </div>
      </div>

      <AtlasPanelSkeleton
        className={cn(PANEL_BOX, 'h-auto', SHELF_CLASS.height)}
      />
    </div>
  )
}

/* ---------------------------------------------------------------------- error */

export interface AtlasScreenErrorProps {
  readonly error: unknown
}

/**
 * The read failed.
 *
 * It keeps the bleed slice rather than falling back to a padded page, because a
 * full-bleed route that suddenly grows a scrollbar is its own second failure.
 * The panel is centred on the world, which is still drawn: there is no atlas
 * data, but there is still a map, and a blank field with an apology on it tells
 * the reader less than nothing.
 */
export function AtlasScreenError({ error }: AtlasScreenErrorProps) {
  const t = useTranslate()

  return (
    <div className={SLICE}>
      <div className={DRAWING}>
        <WorldCoverageMap
          visited={[]}
          label=""
          decorative
          className="absolute inset-0 -z-10 opacity-60"
        />
      </div>
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-md">
          <ErrorPanel error={error} title={t('atlas.screen.error.title')} />
        </div>
      </div>
    </div>
  )
}
