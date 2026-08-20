// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  resetBasemapAvailability,
  resetPmtilesProtocol,
} from '#/lib/map/pmtiles'
import { MAP_ENGINE_TIMEOUT_MS, useMapContext } from '../map-context'
import {
  BASEMAP_SOURCE_ID,
  GRATICULE_SOURCE_ID,
  WORLD_LAND_SOURCE_ID,
} from '#/lib/map/style'
import {
  REGIONAL_BOUNDS,
  pmtilesHeaderBytes,
} from '#/lib/map/__tests__/archive-fixture'

/**
 * MapLibre needs a WebGL context, which jsdom does not have — so the library is
 * replaced with a recorder. That still leaves the whole of this component's own
 * behaviour under test: which style it chooses, what it tells the reader when the
 * archive is missing, and whether it really tears the map down on unmount.
 */
const harness = vi.hoisted(() => {
  interface StyleLike {
    readonly sources: Record<string, unknown>
  }

  class FakeMap {
    readonly options: {
      style: StyleLike
      locale?: Record<string, string>
      container?: HTMLElement
    }
    readonly styles: Array<StyleLike> = []
    readonly handlers = new Map<string, Set<() => void>>()
    // The real MapLibre gives this element `role="region"`, a `tabindex` and an
    // `aria-label` from the `Map.Title` locale string, so the fake starts from
    // the same attributes — the nesting they cause is what is under test.
    readonly canvas = document.createElement('canvas')
    removed = false
    minZoom = 0
    maxZoom = 22

    constructor(options: {
      style: StyleLike
      locale?: Record<string, string>
      container?: HTMLElement
    }) {
      this.options = options
      this.styles.push(options.style)
      this.canvas.setAttribute('role', 'region')
      this.canvas.setAttribute('tabindex', '0')
      this.canvas.setAttribute(
        'aria-label',
        options.locale?.['Map.Title'] ?? 'Map',
      )
      // The real MapLibre renders into the element it is handed, so the fake
      // puts its canvas there too: the landmark nesting only exists once the
      // canvas is actually inside our labelled region.
      options.container?.appendChild(this.canvas)
      harness.maps.push(this)
      // Queued from the constructor, so it runs in the same microtask chain the
      // bootstrap does — before React can possibly commit this instance, let
      // alone run an effect against it. What it sees is therefore exactly what
      // an early `idle` would have found: a record of whether the map was
      // subscribed to before its first frame, or a commit too late.
      void Promise.resolve().then(() => {
        harness.earlyListeners = [...this.handlers.keys()]
      })
    }

    getCanvas(): HTMLCanvasElement {
      return this.canvas
    }

    on(type: string, handler: () => void): this {
      const set = this.handlers.get(type) ?? new Set()
      set.add(handler)
      this.handlers.set(type, set)
      return this
    }

    off(type: string, handler: () => void): this {
      this.handlers.get(type)?.delete(handler)
      return this
    }

    emit(type: string): void {
      // Copied before iterating: the readiness marker's own handler removes
      // itself the first time it runs.
      for (const handler of [...(this.handlers.get(type) ?? [])]) handler()
    }

    setStyle(style: StyleLike): void {
      this.styles.push(style)
    }

    remove(): void {
      this.removed = true
    }

    setMinZoom(value: number): void {
      this.minZoom = value
    }

    setMaxZoom(value: number): void {
      this.maxZoom = value
    }

    getZoom(): number {
      return 4
    }

    getMinZoom(): number {
      return this.minZoom
    }

    getMaxZoom(): number {
      return this.maxZoom
    }

    getBearing(): number {
      return 0
    }
  }

  return {
    maps: [] as Array<FakeMap>,
    FakeMap,
    earlyListeners: [] as Array<string>,
  }
})

vi.mock('maplibre-gl', () => ({
  Map: harness.FakeMap,
  Marker: class {},
  addProtocol: vi.fn(),
  removeProtocol: vi.fn(),
  setWorkerUrl: vi.fn(),
}))

// The real module resolves MapLibre's worker through Vite's `?worker&url`, which
// only the bundler can answer. The URL itself is not what these cases are about.
vi.mock('#/lib/map/worker', () => ({
  MAPLIBRE_WORKER_URL: '/maplibre-gl-worker.mjs',
}))

vi.mock('pmtiles', () => ({
  Protocol: class {
    tile = (): void => {}
  },
}))

const { MapCanvas, MAP_ARCHIVE_PROBE_TIMEOUT_MS } =
  await import('../map-canvas')
const { MapAttribution } = await import('../map-attribution')

/** Publishes the two independent statuses so a case can tell them apart. */
function StatusProbe() {
  const { engine, basemap } = useMapContext()
  return (
    <>
      <output data-testid="engine">{engine}</output>
      <output data-testid="basemap">{basemap}</output>
    </>
  )
}

/**
 * Waits for the map to be *committed*, not merely constructed.
 *
 * `harness.maps` is pushed from MapLibre's constructor, which runs inside the
 * async bootstrap — several React commits before the instance reaches the
 * context and the effects that read it. Waiting for the loading state to clear
 * is what makes every case below deterministic.
 */
async function mapMounted(): Promise<void> {
  await waitFor(() => {
    expect(harness.maps).toHaveLength(1)
    expect(screen.queryByText(/Loading map/)).toBeNull()
  })
}

/** The readiness marker a screenshot gate waits on. */
function readyMarker(container: HTMLElement): string | null {
  return container.firstElementChild?.getAttribute('data-map-ready') ?? null
}

/**
 * Serves a v3 archive header. Global by default: most of these cases are about
 * the map, not about coverage, and a planet archive is the case with no extra
 * layers in it.
 */
function serveArchive(
  bounds?: readonly [number, number, number, number],
): void {
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(pmtilesHeaderBytes({ bounds })),
      ),
  )
}

function serveNothing(): void {
  vi.stubGlobal(
    'fetch',
    vi
      .fn<typeof fetch>()
      .mockImplementation(async () => new Response(null, { status: 404 })),
  )
}

/**
 * An endpoint that accepts the request and never answers, but does honour an
 * abort — which is what a real `fetch` does. This is the hung tiles route the
 * probe deadline exists for.
 */
function serveSlowly(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'))
          })
        }),
    ),
  )
}

/**
 * The worse version of the same failure: a request that ignores its abort
 * signal too, so nothing downstream of the probe can ever run. Only the
 * start-up clock can answer for this one.
 */
function serveNever(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {})),
  )
}

/** The most recently constructed fake map. */
function lastMap() {
  const map = harness.maps.at(-1)
  if (map === undefined) throw new Error('no map was created')
  return map
}

beforeEach(() => {
  harness.maps.length = 0
  harness.earlyListeners = []
  resetBasemapAvailability()
  resetPmtilesProtocol()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('MapCanvas', () => {
  it('labels the map region and says it is loading before the canvas exists', () => {
    serveArchive()
    render(<MapCanvas label="Trip map" />)
    expect(screen.getByRole('region', { name: 'Trip map' })).toBeDefined()
    expect(screen.getByRole('status').textContent).toContain('Loading map')
  })

  it('builds the map on the vector basemap when the archive is published', async () => {
    serveArchive()
    render(<MapCanvas label="Trip map" />)

    await mapMounted()
    expect(Object.keys(lastMap().options.style.sources)).toEqual([
      BASEMAP_SOURCE_ID,
    ])
    expect(screen.queryByText('Basemap unavailable')).toBeNull()
    expect(screen.getByRole('link', { name: 'OpenStreetMap' })).toBeDefined()
  })

  it('draws a ground of its own when the archive is only a region', async () => {
    serveArchive(REGIONAL_BOUNDS)
    render(<MapCanvas label="Trip map" />)

    await mapMounted()
    // Our own sea, coastlines and graticule, under the real tiles — so the world
    // outside the cut is still a map rather than an empty rectangle.
    expect(Object.keys(lastMap().options.style.sources).sort()).toEqual(
      [BASEMAP_SOURCE_ID, GRATICULE_SOURCE_ID, WORLD_LAND_SOURCE_ID].sort(),
    )
    // Still the real basemap, so the credit is still owed and still shown.
    expect(screen.getByRole('link', { name: 'OpenStreetMap' })).toBeDefined()
    expect(screen.queryByText('Basemap unavailable')).toBeNull()
  })

  it('does not pay for the underlay when the archive is the planet', async () => {
    serveArchive([-180, -85, 180, 85])
    render(<MapCanvas label="Trip map" />)

    await mapMounted()
    expect(Object.keys(lastMap().options.style.sources)).toEqual([
      BASEMAP_SOURCE_ID,
    ])
  })

  it('still renders, on the graticule style, when the archive is absent', async () => {
    serveNothing()
    render(<MapCanvas label="Trip map" />)

    await mapMounted()
    // The map is built either way — pins must keep their positions, and the
    // bundled outlines still draw the world beneath them.
    expect(Object.keys(lastMap().options.style.sources).sort()).toEqual(
      [WORLD_LAND_SOURCE_ID, GRATICULE_SOURCE_ID].sort(),
    )
    expect(await screen.findByText('Basemap unavailable')).toBeDefined()
    // No attribution for data we are not showing.
    expect(screen.queryByRole('link', { name: 'OpenStreetMap' })).toBeNull()
  })

  it('applies the caller zoom range without rebuilding the map', async () => {
    serveArchive()
    const { rerender } = render(
      <MapCanvas label="Trip map" minZoom={3} maxZoom={17} />,
    )
    await mapMounted()
    expect(lastMap().minZoom).toBe(3)

    rerender(<MapCanvas label="Trip map" minZoom={5} maxZoom={17} />)
    expect(lastMap().minZoom).toBe(5)
    expect(harness.maps).toHaveLength(1)
  })

  it('reports readiness once the style has loaded', async () => {
    serveArchive()
    const onMapReady = vi.fn()
    render(<MapCanvas label="Trip map" onMapReady={onMapReady} />)

    await mapMounted()
    act(() => {
      lastMap().emit('load')
    })
    expect(onMapReady).toHaveBeenCalledTimes(1)
  })

  it('shows the notice when the style itself fails before it loads', async () => {
    serveArchive()
    render(<MapCanvas label="Trip map" />)
    await mapMounted()

    act(() => {
      lastMap().emit('error')
    })
    expect(await screen.findByText('Basemap unavailable')).toBeDefined()
  })

  it('ignores an error once the map is up, because one bad tile is not a broken map', async () => {
    serveArchive()
    render(<MapCanvas label="Trip map" />)
    await mapMounted()

    act(() => {
      lastMap().emit('load')
      lastMap().emit('error')
    })
    expect(screen.queryByText('Basemap unavailable')).toBeNull()
  })

  it('swaps to the vector style when a retry finds the archive', async () => {
    const user = userEvent.setup()
    serveNothing()
    render(<MapCanvas label="Trip map" />)

    const retry = await screen.findByRole('button', { name: 'Try again' })
    expect(Object.keys(lastMap().options.style.sources).sort()).toEqual(
      [WORLD_LAND_SOURCE_ID, GRATICULE_SOURCE_ID].sort(),
    )

    serveArchive()
    await user.click(retry)

    await waitFor(() => {
      expect(Object.keys(lastMap().styles.at(-1)?.sources ?? {})).toEqual([
        BASEMAP_SOURCE_ID,
      ])
    })
    // Restyled in place: the same map instance, no refetch of anything else.
    expect(harness.maps).toHaveLength(1)
  })

  it('names the canvas from the caller label, and leaves one region on the page', async () => {
    serveArchive()
    const { rerender } = render(<MapCanvas label="Trip map" />)
    await mapMounted()

    // Named through MapLibre's own locale table, so the focusable canvas has a
    // real accessible name rather than the stock "Map".
    expect(lastMap().options.locale).toEqual({ 'Map.Title': 'Trip map' })
    const canvas = lastMap().getCanvas()
    expect(canvas.getAttribute('aria-label')).toBe('Trip map')
    // A region inside a region is announced as two maps with two names.
    expect(canvas.hasAttribute('role')).toBe(false)
    expect(screen.getAllByRole('region')).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Trip map' })).toBeDefined()

    // `locale` is read once at construction, so a renamed map has to be told.
    rerender(<MapCanvas label="Kyoto map" />)
    expect(canvas.getAttribute('aria-label')).toBe('Kyoto map')
    expect(harness.maps).toHaveLength(1)
  })

  it('publishes a readiness marker on the first idle and latches it', async () => {
    serveArchive()
    const { container } = render(<MapCanvas label="Trip map" />)
    await mapMounted()
    expect(readyMarker(container)).toBe('false')

    act(() => {
      lastMap().emit('idle')
    })
    expect(readyMarker(container)).toBe('true')

    // Every later pan settles into another `idle`. The marker must not flicker,
    // and the listener is gone, so nothing can race the gate.
    expect(lastMap().handlers.get('idle')?.size ?? 0).toBe(0)
    act(() => {
      lastMap().emit('idle')
    })
    expect(readyMarker(container)).toBe('true')
  })

  it('cannot miss the first idle, because it subscribes before the first frame', async () => {
    // The deadlock this rules out: `idle` is fired from inside MapLibre's render
    // loop, on a frame of its own. A subscription made from an effect — one
    // React commit after the map reaches state — can miss it, and then waits for
    // a second `idle` that a map at rest is never going to fire.
    serveArchive()
    render(<MapCanvas label="Trip map" />)
    await mapMounted()

    expect(harness.earlyListeners).toContain('idle')
    expect(harness.earlyListeners).toContain('render')
  })

  it('tells a missing archive apart from a renderer that never started', async () => {
    serveNothing()
    render(
      <MapCanvas label="Trip map">
        <StatusProbe />
      </MapCanvas>,
    )
    await mapMounted()
    act(() => {
      lastMap().emit('load')
    })

    // The archive is gone; the map itself is perfectly fine.
    expect(screen.getByTestId('engine').textContent).toBe('running')
    expect(screen.getByTestId('basemap').textContent).toBe('unavailable')
    expect(screen.getByText('Basemap unavailable')).toBeDefined()
    expect(screen.queryByText('Map rendering unavailable')).toBeNull()
  })

  it('says so, instead of spinning forever, when the browser refuses WebGL2', async () => {
    serveArchive()
    vi.stubGlobal('WebGL2RenderingContext', class {})
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(null)

    try {
      const { container } = render(<MapCanvas label="Trip map" />)
      expect(await screen.findByText('Map rendering unavailable')).toBeDefined()
      // No map is built at all: a MapLibre instance with no painter cannot even
      // be removed again.
      expect(harness.maps).toHaveLength(0)
      expect(screen.queryByText('Loading map')).toBeNull()
      // Settled: nothing further will ever be drawn, so the gate may shoot.
      expect(readyMarker(container)).toBe('true')
    } finally {
      getContext.mockRestore()
    }
  })

  it('reports a stalled renderer, and recovers if a late frame arrives', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      serveArchive()
      const { container } = render(
        <MapCanvas label="Trip map">
          <StatusProbe />
        </MapCanvas>,
      )
      await mapMounted()
      expect(screen.getByTestId('engine').textContent).toBe('starting')

      act(() => {
        vi.advanceTimersByTime(MAP_ENGINE_TIMEOUT_MS + 1)
      })
      expect(screen.getByTestId('engine').textContent).toBe('stalled')
      expect(screen.getByText('The map has not drawn yet')).toBeDefined()
      expect(readyMarker(container)).toBe('true')

      act(() => {
        lastMap().emit('render')
      })
      expect(screen.getByTestId('engine').textContent).toBe('running')
      expect(screen.queryByText('The map has not drawn yet')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not call a slow map stalled once it has painted a frame', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      // `load` waits for every tile in view, so a working map on a slow
      // connection reaches it late. The frame is what proves the renderer runs.
      serveArchive()
      render(
        <MapCanvas label="Trip map">
          <StatusProbe />
        </MapCanvas>,
      )
      await mapMounted()

      act(() => {
        lastMap().emit('render')
      })
      expect(screen.getByTestId('engine').textContent).toBe('running')

      act(() => {
        vi.advanceTimersByTime(MAP_ENGINE_TIMEOUT_MS * 2)
      })
      expect(screen.getByTestId('engine').textContent).toBe('running')
      expect(screen.queryByText('The map has not drawn yet')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('builds the world from bundled outlines when the tile route hangs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      serveSlowly()
      render(
        <MapCanvas label="Trip map">
          <StatusProbe />
        </MapCanvas>,
      )
      // The style the map is created with depends on the probe, so nothing is
      // built until the probe answers — or until its deadline answers for it.
      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalled()
      })
      expect(harness.maps).toHaveLength(0)

      await act(async () => {
        vi.advanceTimersByTime(MAP_ARCHIVE_PROBE_TIMEOUT_MS + 1)
      })
      await mapMounted()

      expect(Object.keys(lastMap().options.style.sources).sort()).toEqual(
        [WORLD_LAND_SOURCE_ID, GRATICULE_SOURCE_ID].sort(),
      )
      expect(screen.getByTestId('basemap').textContent).toBe('unavailable')
      expect(screen.getByText('Basemap unavailable')).toBeDefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('bounds the whole start-up, not only the window after construction', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      // A request that ignores its own abort signal never lets construction
      // happen at all, so a clock armed after construction would never run.
      serveNever()
      const { container } = render(<MapCanvas label="Trip map" />)
      await waitFor(() => {
        expect(screen.getByRole('status').textContent).toContain('Loading map')
      })

      await act(async () => {
        vi.advanceTimersByTime(MAP_ENGINE_TIMEOUT_MS + 1)
      })

      expect(harness.maps).toHaveLength(0)
      expect(screen.getByText('The map has not drawn yet')).toBeDefined()
      expect(screen.queryByText('Loading map')).toBeNull()
      expect(readyMarker(container)).toBe('true')
    } finally {
      vi.useRealTimers()
    }
  })

  it('credits the outlines it is really drawing when there is no archive', async () => {
    serveNothing()
    render(
      <MapCanvas label="Trip map">
        <MapAttribution />
      </MapCanvas>,
    )
    await mapMounted()

    // The world on screen came from the bundled Natural Earth outlines. Naming
    // OpenStreetMap beside a notice that says the basemap is unavailable would
    // credit a source the reader cannot see.
    expect(
      await screen.findByRole('link', { name: 'Natural Earth' }),
    ).toBeDefined()
    expect(screen.queryByRole('link', { name: 'OpenStreetMap' })).toBeNull()
  })

  it('carries that credit inside the notice, never as a pill behind it', async () => {
    serveNothing()
    render(
      <MapCanvas label="Trip map">
        {/* Where the planner puts its credit: the same bottom-centre lane the
            notice claims. Two independently positioned elements there leave the
            pill behind the panel with a few pixels of itself showing. */}
        <MapAttribution className="right-auto bottom-10 left-1/2 -translate-x-1/2" />
      </MapCanvas>,
    )
    await mapMounted()

    const credits = await screen.findAllByRole('link', {
      name: 'Natural Earth',
    })
    expect(credits).toHaveLength(1)

    const notice = screen
      .getByText('Basemap unavailable')
      .closest('[role="status"]')
    expect(notice).not.toBeNull()
    expect(notice?.contains(credits[0] ?? null)).toBe(true)
  })

  it('stands its own credit down when the screen places one itself', async () => {
    serveArchive()
    render(
      <MapCanvas label="Trip map">
        <MapAttribution className="left-1/2" />
      </MapCanvas>,
    )
    await mapMounted()

    // One map, one credit — a duplicate is invisible when the second sits behind
    // a rail, and read out twice by a screen reader either way.
    await waitFor(() => {
      expect(
        screen.getAllByRole('link', { name: 'OpenStreetMap' }),
      ).toHaveLength(1)
    })
  })

  it('keeps its notice out of the edge a screen says its chrome covers', async () => {
    serveNothing()
    // What the planner declares on a phone: an action bar and a credit floating
    // over the bottom 132px of the map. A notice posted at its designed 16px
    // gutter would have its retry button underneath both.
    const { rerender } = render(
      <MapCanvas label="Trip map" padding={{ bottom: 132 }} />,
    )
    await mapMounted()

    const notice = (await screen.findByText('Basemap unavailable')).closest<
      HTMLElement
    >('[role="status"]')
    expect(notice?.style.bottom).toBe('132px')

    // A screen that declares nothing gets the designed position, from the class
    // rather than from an inline override.
    rerender(<MapCanvas label="Trip map" />)
    expect(notice?.style.bottom).toBe('')
  })

  it('removes the map on unmount, leaving nothing running', async () => {
    serveArchive()
    const { unmount } = render(<MapCanvas label="Trip map" />)
    await mapMounted()

    const map = lastMap()
    expect(map.removed).toBe(false)
    unmount()
    expect(map.removed).toBe(true)
  })
})
