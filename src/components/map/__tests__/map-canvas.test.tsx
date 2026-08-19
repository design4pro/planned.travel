// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  resetBasemapAvailability,
  resetPmtilesProtocol,
} from '#/lib/map/pmtiles'
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
    readonly options: { style: StyleLike }
    readonly styles: Array<StyleLike> = []
    readonly handlers = new Map<string, Set<() => void>>()
    removed = false
    minZoom = 0
    maxZoom = 22

    constructor(options: { style: StyleLike }) {
      this.options = options
      this.styles.push(options.style)
      harness.maps.push(this)
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

    await waitFor(() => expect(harness.maps).toHaveLength(1))
    expect(Object.keys(lastMap().options.style.sources)).toEqual([
      BASEMAP_SOURCE_ID,
    ])
    expect(screen.queryByText('Basemap unavailable')).toBeNull()
    expect(screen.getByRole('link', { name: 'OpenStreetMap' })).toBeDefined()
  })

  it('draws a ground of its own when the archive is only a region', async () => {
    serveArchive(REGIONAL_BOUNDS)
    render(<MapCanvas label="Trip map" />)

    await waitFor(() => expect(harness.maps).toHaveLength(1))
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

    await waitFor(() => expect(harness.maps).toHaveLength(1))
    expect(Object.keys(lastMap().options.style.sources)).toEqual([
      BASEMAP_SOURCE_ID,
    ])
  })

  it('still renders, on the graticule style, when the archive is absent', async () => {
    serveNothing()
    render(<MapCanvas label="Trip map" />)

    await waitFor(() => expect(harness.maps).toHaveLength(1))
    // The map is built either way — pins must keep their positions.
    expect(Object.keys(lastMap().options.style.sources)).toEqual([
      GRATICULE_SOURCE_ID,
    ])
    expect(await screen.findByText('Basemap unavailable')).toBeDefined()
    // No attribution for data we are not showing.
    expect(screen.queryByRole('link', { name: 'OpenStreetMap' })).toBeNull()
  })

  it('applies the caller zoom range without rebuilding the map', async () => {
    serveArchive()
    const { rerender } = render(
      <MapCanvas label="Trip map" minZoom={3} maxZoom={17} />,
    )
    await waitFor(() => expect(harness.maps).toHaveLength(1))
    expect(lastMap().minZoom).toBe(3)

    rerender(<MapCanvas label="Trip map" minZoom={5} maxZoom={17} />)
    expect(lastMap().minZoom).toBe(5)
    expect(harness.maps).toHaveLength(1)
  })

  it('reports readiness once the style has loaded', async () => {
    serveArchive()
    const onMapReady = vi.fn()
    render(<MapCanvas label="Trip map" onMapReady={onMapReady} />)

    await waitFor(() => expect(harness.maps).toHaveLength(1))
    act(() => {
      lastMap().emit('load')
    })
    expect(onMapReady).toHaveBeenCalledTimes(1)
  })

  it('shows the notice when the style itself fails before it loads', async () => {
    serveArchive()
    render(<MapCanvas label="Trip map" />)
    await waitFor(() => expect(harness.maps).toHaveLength(1))

    act(() => {
      lastMap().emit('error')
    })
    expect(await screen.findByText('Basemap unavailable')).toBeDefined()
  })

  it('ignores an error once the map is up, because one bad tile is not a broken map', async () => {
    serveArchive()
    render(<MapCanvas label="Trip map" />)
    await waitFor(() => expect(harness.maps).toHaveLength(1))

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
    expect(Object.keys(lastMap().options.style.sources)).toEqual([
      GRATICULE_SOURCE_ID,
    ])

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

  it('removes the map on unmount, leaving nothing running', async () => {
    serveArchive()
    const { unmount } = render(<MapCanvas label="Trip map" />)
    await waitFor(() => expect(harness.maps).toHaveLength(1))

    const map = lastMap()
    expect(map.removed).toBe(false)
    unmount()
    expect(map.removed).toBe(true)
  })
})
