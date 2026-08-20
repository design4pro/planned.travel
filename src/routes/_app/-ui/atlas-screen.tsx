import * as React from 'react'

import {
  AtlasPanel,
  AtlasPanelSkeleton,
  CountrySearch,
} from '#/components/atlas'
import { ErrorPanel } from '#/components/layout/error-state'
import { GlassPanel, Skeleton } from '#/components/ui'
import {
  MapAttribution,
  MapCanvas,
  MapControls,
  VISITED_COUNTRY_ZOOM,
  VisitedCountries,
  fitMapToBounds,
  useMapContext,
} from '#/components/map'
import { countryBounds, hasCountryOutline } from '#/lib/map'
import { cn } from '#/lib/cn'
import { WORLD_COUNTRY_COUNT } from '../-server/library'
import { WorldCoverageMap } from './world-map'

import type { AtlasPanelTab } from '#/components/atlas'
import type { MapVisitedCountry } from '#/components/map'
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
 * expression that otherwise looks like the trip planner's. Below `lg` the mobile
 * tab bar (4rem) and the home indicator (`--safe-bottom`) come off; from `lg` up
 * the tab bar is gone and they do not. Nothing inside scrolls the document —
 * every list is its own scroll container — so the page cannot grow behind the
 * map at any width from 360 to 2560.
 *
 * **One world, never a row of them.** MapLibre renders copies of the world
 * either side of the antimeridian by default, and a 2560px screen at world zoom
 * gets two and a bit of them — every visited country highlighted two and a bit
 * times, which is a data map lying about its own data. `setRenderWorldCopies(false)`
 * is applied the moment the style is up. The other half of that is the camera:
 * the container is measured first, and the map opens at the zoom that makes one
 * world exactly span its longer edge, which is also the floor. See
 * {@link WORLD_CENTER} for why that is the only frame MapLibre will actually
 * hold.
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
 * choosing anywhere opens the record. Hover only adds emphasis, in the paint
 * layer, where `VisitedCountries` handles it — it is never the only route to a
 * country, because `mousemove` does not exist on a phone.
 *
 * **The world is drawn twice, on purpose, and only ever visible once.** Behind
 * the canvas sits the static SVG world (`./world-map`), from the same bundled
 * outlines and the same `--color-country-*` tokens. The canvas is mounted with a
 * transparent ground, so before the first painted frame the reader sees the world
 * rather than an empty rectangle, and if the renderer never starts — no WebGL2,
 * or a canvas that never draws — it stays, under the canvas's own designed
 * notice. It fades out and goes `aria-hidden` the moment MapLibre reports its
 * style loaded, so exactly one map is ever announced.
 */

/* -------------------------------------------------------------------- layout */

/**
 * The viewport slice. Shared by the loaded, pending and error screens, so a slow
 * read and a failed one occupy the very same box the map will.
 */
const SLICE = cn(
  'relative isolate w-full overflow-hidden bg-canvas',
  'h-[calc(100svh-var(--safe-top)-var(--nav-h)-4rem-var(--safe-bottom))]',
  'lg:h-[calc(100svh-var(--safe-top)-var(--nav-h))]',
)

/** The floating panel's box: gutters, and the product's own content ceiling. */
const PANEL_BOX = cn(
  'absolute inset-x-3 bottom-3 mx-auto max-w-content',
  'lg:inset-x-4 lg:bottom-4',
)

/**
 * The search pill: the top row on a phone, minus the 56px the zoom stack takes
 * on the right plus a gutter; a fixed column at the top left from `lg`.
 */
const SEARCH_BOX = cn(
  // `w-auto` is load-bearing: the pill's own root is `w-full`, which on an
  // absolutely positioned element beats a left/right pair and pushed it 84px
  // past the right edge of the screen, straight under the zoom stack.
  'absolute top-3 right-18 left-3 w-auto z-map-overlay',
  'lg:top-4 lg:right-auto lg:left-4 lg:w-88',
)

/**
 * Where the chrome sits, and why it is not the same place at both sizes.
 *
 * A phone has no room for a zoom stack above a drawer that can be a third of the
 * screen tall — open the drawer on a short handset and the controls end up on top
 * of the search field. So below `lg` they move to the top right, opposite a
 * search pill that gives up 72px for them, where no drawer height can ever reach
 * them; from `lg` up they return to the bottom right, lifted clear of the shelf
 * by `--atlas-controls`. That offset is 27.5rem: the shelf's own 25rem plus its
 * gutter plus a gap, named once rather than spelled out at three call sites.
 */
const CHROME = {
  controls:
    'top-3 right-3 bottom-auto lg:top-auto lg:right-4 lg:bottom-(--atlas-controls)',
  /** Clear of the open shelf (25rem plus its gutter and a gap) … */
  controlsOffset: 'lg:[--atlas-controls:27.5rem]',
  /** … and clear of the collapsed one, which is its header and nothing else. */
  controlsOffsetShut: 'lg:[--atlas-controls:9rem]',
  /** Second row on a phone, under the search; the free corner from `lg`. */
  credit:
    'top-18 right-auto left-3 bottom-auto lg:top-4 lg:right-4 lg:left-auto',
} as const

/* -------------------------------------------------------------------- camera */

/** MapLibre's own tile size, and therefore the width of the world at zoom 0. */
const WORLD_TILE_SIZE = 512

/**
 * Where the map opens, and why it is a centre and a zoom rather than a rectangle.
 *
 * Two MapLibre facts decide this, and both were measured rather than assumed.
 *
 * The camera is *always* constrained so the Mercator square covers the container
 * vertically — `latRange` defaults to ±85.05 and cannot be widened — so the world
 * can never be smaller than the canvas is tall. And with `renderWorldCopies` off,
 * which it must be or a wide screen highlights every visited country two and a
 * bit times, nothing fills the space either side of the world: handing
 * `fitBounds` a world rectangle produced a square map letterboxed in 300px of
 * page colour on both flanks.
 *
 * So the opening zoom is stated: the one that makes a single world exactly span
 * the longer edge of the container. On a landscape screen that is the width, so
 * the world reaches both edges with no copies and no gaps; on a phone the height
 * wins and the reader gets a tall slice of the world, pannable, with the search
 * field to jump anywhere in it. It is also the floor, so zooming out can never
 * reach the letterbox.
 *
 * The latitude is 14°S rather than the equator because the shelf covers the foot
 * of the map, and a centred camera puts the middle of the world behind it — the
 * atlas opened on the northern hemisphere alone. 14°S is the southernmost centre
 * that still keeps Iceland, the northernmost country on our own record, above the
 * shelf, and it buys about forty degrees of southern hemisphere for it. The rest
 * is behind translucent glass and one press of the shelf's own collapse button
 * away, which is why that button is offered at every width rather than only on a
 * phone.
 */
const WORLD_CENTER: readonly [number, number] = [0, -14]

/** The zoom at which one world exactly spans the container's longer edge. */
function worldZoomFor(box: {
  readonly width: number
  readonly height: number
}): number {
  const edge = Math.max(box.width, box.height)
  return Number(Math.log2(Math.max(edge, 1) / WORLD_TILE_SIZE).toFixed(3))
}

/**
 * Insets the camera must keep clear, per breakpoint.
 *
 * One declaration, handed to both `MapCanvas` (which uses it to place its own
 * "basemap unavailable" notice) and `CountrySearch` (which clamps its fly-to
 * against it). Two numbers that disagreed put a searched country underneath the
 * panel that was supposed to describe it.
 */
function cameraPadding(wide: boolean, expanded: boolean): Partial<EdgePadding> {
  if (wide) {
    return { top: 96, right: 96, bottom: 424, left: 24 }
  }
  return { top: 76, right: 60, bottom: expanded ? 360 : 108, left: 16 }
}

/* --------------------------------------------------------------- map children */

interface AtlasCameraProps {
  /** Bumped once per frame request. `0` means nothing has been asked for. */
  readonly token: number
  /** The country to frame when the token moves. */
  readonly countryCode: string | null
  readonly padding: Partial<EdgePadding>
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

/* -------------------------------------------------------------------- viewport */

/**
 * The container's own box in CSS pixels, or `null` before it has been measured.
 *
 * The opening zoom is a function of it, and `MapCanvas` reads its centre and zoom
 * once at construction, so the canvas is deliberately not rendered until the
 * answer is in. That costs one commit and no layout shift: the box is a fixed
 * slice of the viewport and the static world is already drawn inside it.
 */
function useMeasuredBox(): [
  React.RefObject<HTMLDivElement | null>,
  { readonly width: number; readonly height: number } | null,
] {
  const ref = React.useRef<HTMLDivElement | null>(null)
  const [box, setBox] = React.useState<{
    readonly width: number
    readonly height: number
  } | null>(null)

  React.useEffect(() => {
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
 * breakpoint does so through a Tailwind variant instead. The server's answer and
 * the client's may differ and no markup can notice.
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
  const [containerRef, box] = useMeasuredBox()
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
  const [mapDrawing, setMapDrawing] = React.useState(false)

  const shelfOpen = expanded ?? wide
  const padding = cameraPadding(wide, shelfOpen)

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

  const allTime = atlas.stats.find((row) => row.statYear === 0) ?? null

  /** Opening the record is what selecting a country means, everywhere. */
  const open = React.useCallback((code: string | null) => {
    setSelected(code)
    if (code === null) return
    setTab('country')
    setExpanded(true)
  }, [])

  /** A list row asks for a frame as well; a map click does not need one. */
  const openAndFrame = React.useCallback(
    (code: string) => {
      open(code)
      setCameraToken((token) => token + 1)
    },
    [open],
  )

  const worldLabel =
    atlas.countryCount === 0
      ? 'World map. No countries marked as visited yet.'
      : `World map with ${atlas.countryCount} of ${WORLD_COUNTRY_COUNT} countries marked as visited.`

  return (
    <div
      ref={containerRef}
      className={cn(
        SLICE,
        // Keyed off the reader's explicit opinion rather than off `wide`, so the
        // class is identical on both render passes and hydration has nothing to
        // reconcile. Below `lg` the variant does not apply either way.
        expanded === false ? CHROME.controlsOffsetShut : CHROME.controlsOffset,
      )}
    >
      {/* The ground of last resort, and the first thing the reader sees. It is
          the same geometry and the same tokens the live layer paints with, so
          the hand-off is a change of sharpness rather than of colour. */}
      <WorldCoverageMap
        visited={visitedCodes}
        label={worldLabel}
        decorative={mapDrawing}
        className={cn(
          // A short cut rather than a long cross-fade: the two draw the world
          // at slightly different scales, and holding both on screen would show
          // it twice. 150ms is the token exit duration.
          'absolute inset-0 -z-10 transition-opacity duration-fast ease-out-quint',
          mapDrawing ? 'opacity-0' : 'opacity-100',
        )}
      />

      {box === null ? null : (
        <MapCanvas
          label={worldLabel}
          center={WORLD_CENTER}
          zoom={worldZoomFor(box)}
          padding={padding}
          minZoom={worldZoomFor(box)}
          // The country fills are not drawn past this zoom, so the reader can
          // never arrive somewhere the atlas has nothing to say.
          maxZoom={VISITED_COUNTRY_ZOOM.fadeEnd}
          buildings={false}
          graticule={{ step: 15, majorEvery: 2 }}
          onMapReady={(map) => {
            // `MapCanvas` constructs with `renderWorldCopies: true` and exposes no
            // prop for it, so the single world is asked for through MapLibre's own
            // setter. A wide screen would otherwise show two and a bit copies of
            // the world with every visited country highlighted two and a bit
            // times, which is a data map lying about its own data. It is a
            // transform property rather than a style one, so the theme swap —
            // which replaces the whole style document — cannot undo it.
            map.setRenderWorldCopies(false)
            setMapDrawing(true)
          }}
          // Transparent, so the static world behind it shows through until the
          // renderer paints — and forever, if it never does.
          className="absolute inset-0 bg-transparent"
        >
          <VisitedCountries
            visits={visits}
            selectedCode={selected}
            onSelect={open}
          />

          <AtlasCamera
            token={cameraToken}
            countryCode={selected}
            padding={padding}
          />

          <CountrySearch
            countries={countries}
            selectedCode={selected}
            onSelect={open}
            padding={padding}
            // `GlassPanel`'s floating default is `z-dropdown`, which sits above
            // the app nav. Map chrome belongs below it.
            className={SEARCH_BOX}
          />

          <MapControls position="bottom-right" className={CHROME.controls} />

          {/* ODbL. Credited in the product's own type, at a size that can be
              read, and clear of both the search pill and the panel. */}
          <MapAttribution className={CHROME.credit} />
        </MapCanvas>
      )}

      <AtlasPanel
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
          cityCount: allTime?.cityCount ?? null,
          dayCount: allTime?.dayCount ?? null,
          distanceMetres: allTime?.distanceMetres ?? null,
        }}
        byContinent={atlas.byContinent}
        bucketList={atlas.bucketList}
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
            ? 'h-auto lg:h-100'
            : expanded
              ? 'h-[min(58svh,30rem)] lg:h-100'
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
      <WorldCoverageMap
        visited={[]}
        label=""
        decorative
        className="absolute inset-0 -z-10 opacity-60"
      />

      <GlassPanel
        radius="lg"
        padding="none"
        floating={false}
        aria-hidden="true"
        className={cn(SEARCH_BOX, 'flex w-full min-w-0 flex-col p-1.5')}
      >
        <Skeleton radius="md" className="h-10 w-full" />
      </GlassPanel>

      <AtlasPanelSkeleton className={cn(PANEL_BOX, 'h-auto lg:h-100')} />
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
  return (
    <div className={SLICE}>
      <WorldCoverageMap
        visited={[]}
        label=""
        decorative
        className="absolute inset-0 -z-10 opacity-60"
      />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-md">
          <ErrorPanel error={error} title="The atlas did not load" />
        </div>
      </div>
    </div>
  )
}
