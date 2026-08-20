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
      for (const handler of this.handlers.get(type) ?? []) handler()
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

  return { maps: [] as Array<FakeMap>, FakeMap }
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

const { MapCanvas } = await import('../map-canvas')

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

/** The most recently constructed fake map. */
function lastMap() {
  const map = harness.maps.at(-1)
  if (map === undefined) throw new Error('no map was created')
  return map
}

beforeEach(() => {
  harness.maps.length = 0
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
      lastMap().emit('load')
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

  it('reports a stalled renderer, and recovers if a late load arrives', async () => {
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
        lastMap().emit('load')
      })
      expect(screen.getByTestId('engine').textContent).toBe('running')
      expect(screen.queryByText('The map has not drawn yet')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
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
