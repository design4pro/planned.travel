import { expect, test } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'
import { visit, watchConsole } from './console.ts'
import { APP_ROUTES } from './routes.ts'
import type { RouteCase } from './routes.ts'
import { MAP_READY_TIMEOUT_MS } from './settle.ts'

/**
 * What `e2e/places-and-maps.spec.ts` needs to read a camera: the routes, the seeded trips by name,
 * and the map's own account of where it is looking.
 *
 * The camera is read from the MapLibre instance rather than from pixels. A screenshot can say a frame
 * changed; only `getCenter()` and `getZoom()` can say it moved to the wrong place, and they say it in
 * numbers a failure message can quote.
 */

/**
 * The three opening frames, each held by a different seeded trip and addressed by the title the
 * `/trips` index shows. Ids are never restated: they are the fixture's business, and a title is what
 * a reader clicks.
 */
export const SEEDED_TRIPS = {
  /** Thirty-odd places across Honshu — the frame that has to hold them all. */
  spanning: 'Tokyo & Kyoto',
  /** Exactly one mapped place — the rectangle of zero area. */
  single: 'Porto, one long lunch',
  /** No coordinates at all — the world fallback. */
  unmapped: 'Patagonia traverse',
} as const

function fromTable(name: string): RouteCase {
  const route = APP_ROUTES.find((candidate) => candidate.name === name)
  if (route === undefined) throw new Error(`APP_ROUTES has no ${name} entry`)
  return route
}

export const ATLAS = fromTable('atlas')
const TRIPS = fromTable('trips')

/** The planner for one trip. It mounts a live map, so it settles on the canvas. */
export function planRoute(tripId: string): RouteCase {
  return {
    name: 'trip-plan',
    path: `/trips/${tripId}/plan`,
    ready: 'nav[aria-label="Trip sections"]',
    map: true,
  }
}

/**
 * Open a route on its own page, grade its console, and hand the page over in between.
 *
 * One watcher per page, attached before the navigation it grades — the discipline `watchConsole()`
 * documents. The planner and the atlas declare a live map and so tolerate the software rasteriser's
 * GL advisory; `/trips` declares none, and a shared watcher would grade one of them by the wrong table.
 */
export async function onRoute<T>(
  context: BrowserContext,
  route: RouteCase,
  act: (page: Page) => Promise<T>,
): Promise<T> {
  const page = await context.newPage()
  try {
    const watched = watchConsole(page, route)
    await visit(page, route, 'light')
    const result = await act(page)
    const output = watched()
    expect(
      output.fatal,
      `${route.path}: the console must be clean through this step`,
    ).toEqual([])
    if (output.tolerated.length > 0) {
      test.info().annotations.push({
        type: 'tolerated console output',
        description: `${route.path}: ${output.tolerated.join('\n')}`,
      })
    }
    return result
  } finally {
    await page.close()
  }
}

/**
 * The id behind the trip tile a reader would click, found by the link's accessible name.
 *
 * Exactly one link has to carry the name: a title that matched two tiles would open whichever came
 * first and assert the camera of a trip nobody asked about.
 */
export async function tripIdByName(
  context: BrowserContext,
  title: string,
): Promise<string> {
  return onRoute(context, TRIPS, async (page) => {
    const link = page.getByRole('link', { name: title })
    await expect(link, `/trips lists exactly one "${title}"`).toHaveCount(1)
    const href = (await link.getAttribute('href')) ?? ''
    const tripId = /^\/trips\/([^/?#]+)\/plan$/.exec(href)?.[1]
    if (tripId === undefined) {
      throw new Error(`"${title}" links to ${href}, not to its planner`)
    }
    return tripId
  })
}

/** Degrees, west to east and south to north. */
export type LngLatBox = {
  readonly west: number
  readonly south: number
  readonly east: number
  readonly north: number
}

/** Where the map says it is looking, and what the screen asked it to frame. */
export type Camera = {
  readonly center: readonly [number, number]
  readonly zoom: number
  readonly minZoom: number
  /** The visible rectangle. */
  readonly bounds: LngLatBox
  readonly moving: boolean
  /** The props of the screen's `FitBounds`, or `null` when it mounts none. */
  readonly fit: {
    readonly points: ReadonlyArray<readonly [number, number]>
    readonly maxZoom: number | null
  } | null
}

/**
 * Read the camera out of the live React tree.
 *
 * The map instance is published nowhere in the DOM, and the map code is not to be edited for a test,
 * so the reader walks to it: from the root's *current* fiber — never the one cached on a DOM node,
 * which can be the stale alternate of a later commit — down to the `[data-map-ready]` element, and
 * inside it to the `MapProvider` value and the `FitBounds` props. A string is a reason the read could
 * not be made, so a poll that times out says why.
 */
function cameraIn(): Camera | string {
  type Fiber = {
    readonly tag: number
    readonly child: Fiber | null
    readonly sibling: Fiber | null
    readonly return: Fiber | null
    readonly stateNode: unknown
    readonly memoizedProps: unknown
  }
  type Instance = {
    getCenter: () => { lng: number; lat: number }
    getZoom: () => number
    getMinZoom: () => number
    getBounds: () => {
      getWest: () => number
      getSouth: () => number
      getEast: () => number
      getNorth: () => number
    }
    isMoving: () => boolean
  }

  const marker = document.querySelector('[data-map-ready]')
  if (marker === null) return 'the page rendered no [data-map-ready] marker'
  const key = Object.keys(marker).find((name) =>
    name.startsWith('__reactFiber$'),
  )
  if (key === undefined) return 'the map marker was never hydrated by React'

  let top: Fiber | null = (marker as unknown as Record<string, Fiber>)[key]
  while (top.return !== null) top = top.return
  const HOST_ROOT = 3
  if (top.tag !== HOST_ROOT) return 'the map marker is not under a React root'
  const current = (top.stateNode as { current: Fiber }).current

  let map: Instance | null = null
  let fit: Camera['fit'] = null
  const pending: Array<[Fiber, boolean]> = [[current, false]]
  while (pending.length > 0) {
    const [fiber, inside] = pending.pop() as [Fiber, boolean]
    const within = inside || fiber.stateNode === marker
    const props = fiber.memoizedProps as Record<string, unknown> | null
    if (within && props !== null && typeof props === 'object') {
      const value = props.value as { map?: Instance | null } | undefined
      if (map === null && typeof value?.map?.getCenter === 'function') {
        map = value.map
      }
      // `'maxZoom' in props` is what tells `FitBounds` from the planner's `PlanCoverage` wrapper
      // above it, which carries the same `points` and `fitKey` and would report no ceiling at all.
      if (
        fit === null &&
        Array.isArray(props.points) &&
        typeof props.fitKey === 'string' &&
        'maxZoom' in props
      ) {
        fit = {
          points: props.points as Array<[number, number]>,
          maxZoom: typeof props.maxZoom === 'number' ? props.maxZoom : null,
        }
      }
    }
    if (fiber.sibling !== null) pending.push([fiber.sibling, inside])
    if (fiber.child !== null) pending.push([fiber.child, within])
  }

  if (map === null) return 'the map context under the marker holds no map yet'
  const centre = map.getCenter()
  const box = map.getBounds()
  return {
    center: [centre.lng, centre.lat],
    zoom: map.getZoom(),
    minZoom: map.getMinZoom(),
    bounds: {
      west: box.getWest(),
      south: box.getSouth(),
      east: box.getEast(),
      north: box.getNorth(),
    },
    moving: map.isMoving(),
    fit,
  }
}

/** A camera in one line, for a failure message or an annotation. */
export function describeCamera(camera: Camera): string {
  const { center, zoom, minZoom, bounds, fit } = camera
  const box = [bounds.west, bounds.south, bounds.east, bounds.north]
    .map((value) => value.toFixed(3))
    .join(', ')
  return `centre [${center[0].toFixed(4)}, ${center[1].toFixed(4)}] zoom ${zoom.toFixed(3)} (min ${minZoom.toFixed(3)}) bounds [${box}] fit ${fit === null ? 'none' : `${fit.points.length} points, maxZoom ${String(fit.maxZoom)}`}`
}

/**
 * Hold until the map has come to rest on a frame `judge` accepts, and return that frame.
 *
 * Polled, because the frame is eased (`MAP_FIT_DURATION`) and the planner may frame again once the
 * archive answers whether it covers the trip. `judge` returns `null` for an accepted camera and a
 * reason otherwise; the reason and the numbers behind it are what a timeout reports.
 */
export async function restingCamera(
  page: Page,
  judge: (camera: Camera) => string | null,
): Promise<Camera> {
  let last: Camera | string = 'never read'
  await expect
    .poll(
      async () => {
        last = await page.evaluate(cameraIn)
        if (typeof last === 'string') return last
        const seen = describeCamera(last)
        if (last.moving) return `still moving — ${seen}`
        const reason = judge(last)
        return reason === null ? 'framed' : `${reason} — ${seen}`
      },
      {
        timeout: MAP_READY_TIMEOUT_MS,
        message: 'the camera has to rest on its opening frame',
      },
    )
    .toBe('framed')
  if (typeof last === 'string') throw new Error(last)
  return last
}

/** Whether a point lies inside a visible rectangle that does not cross the antimeridian. */
export function contains(
  box: LngLatBox,
  [lng, lat]: readonly [number, number],
): boolean {
  return (
    lng >= box.west && lng <= box.east && lat >= box.south && lat <= box.north
  )
}
