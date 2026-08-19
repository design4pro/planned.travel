// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {
  resetBasemapAvailability,
  resetPmtilesProtocol,
} from '#/lib/map/pmtiles'

import type { MapCategory, MapPlace } from '../types'

/**
 * The same MapLibre recorder as `map-canvas.test.tsx`, plus a marker that really
 * appends its element to the container — which is what lets these tests assert on
 * the pins the planner will actually see, portal and all.
 */
const harness = vi.hoisted(() => {
  class FakeMap {
    readonly container: HTMLElement
    readonly canvas: HTMLCanvasElement
    readonly handlers = new Map<string, Set<() => void>>()
    readonly fits: Array<{ bounds: unknown; options: unknown }> = []
    zoom = 4

    // The real MapLibre renders into the element it is handed, and markers are
    // appended to it — so the fake has to use the same element, or nothing a
    // marker draws would be in the document for a query to find.
    constructor(options: { container: HTMLElement }) {
      this.container = options.container
      // jsdom lays nothing out, so every element measures 0×0 — and a camera fit
      // is skipped against a canvas with no area, exactly as it is mid-resize in a
      // real browser. A real map container always has one, so give it one here.
      this.canvas = document.createElement('canvas')
      for (const node of [this.container, this.canvas]) {
        for (const [prop, value] of [
          ['clientWidth', 1440],
          ['clientHeight', 900],
        ] as const) {
          Object.defineProperty(node, prop, { configurable: true, value })
        }
      }
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

    getContainer(): HTMLElement {
      return this.container
    }

    getCanvas(): HTMLCanvasElement {
      return this.canvas
    }

    resize(): this {
      return this
    }

    getZoom(): number {
      return this.zoom
    }

    getMinZoom(): number {
      return 1
    }

    getMaxZoom(): number {
      return 19
    }

    getBearing(): number {
      return 0
    }

    setMinZoom(): void {}
    setMaxZoom(): void {}
    setStyle(): void {}
    remove(): void {}

    project(): { x: number; y: number } {
      return { x: 400, y: 400 }
    }

    easeTo(options: unknown): void {
      harness.eases.push(options)
    }

    fitBounds(bounds: unknown, options: unknown): void {
      this.fits.push({ bounds, options })
    }
  }

  class FakeMarker {
    readonly element: HTMLElement

    constructor(options: { element: HTMLElement }) {
      this.element = options.element
    }

    setLngLat(): this {
      return this
    }

    addTo(map: FakeMap): this {
      // `appendChild`, not `append`: the Workers `Element` type this project also
      // compiles against declares its own `append` and wins overload resolution.
      map.getContainer().appendChild(this.element)
      return this
    }

    remove(): void {
      this.element.remove()
    }
  }

  return {
    maps: [] as Array<FakeMap>,
    eases: [] as Array<unknown>,
    FakeMap,
    FakeMarker,
  }
})

vi.mock('maplibre-gl', () => ({
  Map: harness.FakeMap,
  Marker: harness.FakeMarker,
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
const { PlaceMarkers } = await import('../place-marker')
const { FitBounds } = await import('../fit-bounds')

const CATEGORIES: ReadonlyArray<MapCategory> = [
  {
    id: 'c1',
    name: 'Landmarks',
    slug: 'landmarks',
    colour: '#256256',
    icon: 'landmark',
  },
]

const KYOTO: MapPlace = {
  id: 'p1',
  name: 'Fushimi Inari Taisha',
  lng: 135.7727,
  lat: 34.9671,
  categoryId: 'c1',
  address: '68 Fukakusa Yabunouchicho',
  rating: 5,
  dayNumber: 1,
}

const TOKYO: MapPlace = {
  id: 'p2',
  name: 'Sensoji',
  lng: 139.7967,
  lat: 35.7148,
  categoryId: 'c1',
  dayNumber: 3,
}

function serveArchive(): void {
  const header = new ArrayBuffer(8)
  new Uint8Array(header).set([0x50, 0x4d, 0x54, 0x69, 0x6c, 0x65, 0x73, 3])
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockImplementation(async () => new Response(header)),
  )
}

function lastMap() {
  const map = harness.maps.at(-1)
  if (map === undefined) throw new Error('no map was created')
  return map
}

beforeEach(() => {
  harness.maps.length = 0
  harness.eases.length = 0
  resetBasemapAvailability()
  resetPmtilesProtocol()
  serveArchive()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PlaceMarkers', () => {
  it('draws a pin per place, with its day badge and full accessible name', async () => {
    render(
      <MapCanvas label="Trip map">
        <PlaceMarkers places={[KYOTO, TOKYO]} categories={CATEGORIES} />
      </MapCanvas>,
    )

    const pin = await screen.findByRole('button', {
      name: 'Fushimi Inari Taisha, Landmarks, day 1, 68 Fukakusa Yabunouchicho, rated 5 out of 5',
    })
    expect(pin.textContent).toContain('1')
    expect(await screen.findByRole('button', { name: /Sensoji/ })).toBeDefined()
  })

  it('merges places that would overlap into one cluster badge', async () => {
    const twin: MapPlace = {
      ...TOKYO,
      id: 'p3',
      name: 'Asakusa Shrine',
      lng: 139.7968,
    }
    render(
      <MapCanvas label="Trip map">
        <PlaceMarkers places={[TOKYO, twin]} categories={CATEGORIES} />
      </MapCanvas>,
    )

    expect(
      await screen.findByRole('button', { name: /2 places/ }),
    ).toBeDefined()
    expect(screen.queryByRole('button', { name: /Sensoji/ })).toBeNull()
  })

  it('never swallows the selected place into a cluster', async () => {
    const twin: MapPlace = {
      ...TOKYO,
      id: 'p3',
      name: 'Asakusa Shrine',
      lng: 139.7968,
    }
    render(
      <MapCanvas label="Trip map">
        <PlaceMarkers
          places={[TOKYO, twin]}
          categories={CATEGORIES}
          selectedId="p2"
        />
      </MapCanvas>,
    )

    expect(await screen.findByRole('button', { name: /Sensoji/ })).toBeDefined()
  })

  it('draws every place individually when clustering is switched off', async () => {
    const twin: MapPlace = {
      ...TOKYO,
      id: 'p3',
      name: 'Asakusa Shrine',
      lng: 139.7968,
    }
    render(
      <MapCanvas label="Trip map">
        <PlaceMarkers
          places={[TOKYO, twin]}
          categories={CATEGORIES}
          clustering={false}
        />
      </MapCanvas>,
    )

    expect(await screen.findByRole('button', { name: /Sensoji/ })).toBeDefined()
    expect(screen.getByRole('button', { name: /Asakusa Shrine/ })).toBeDefined()
  })

  it('reports the place that was clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <MapCanvas label="Trip map">
        <PlaceMarkers
          places={[KYOTO]}
          categories={CATEGORIES}
          onSelect={onSelect}
        />
      </MapCanvas>,
    )

    await user.click(
      await screen.findByRole('button', { name: /Fushimi Inari/ }),
    )
    expect(onSelect).toHaveBeenCalledWith(KYOTO)
  })

  it('opens the hover card on focus, so it is reachable by keyboard', async () => {
    render(
      <MapCanvas label="Trip map">
        <PlaceMarkers places={[KYOTO]} categories={CATEGORIES} />
      </MapCanvas>,
    )

    const pin = await screen.findByRole('button', { name: /Fushimi Inari/ })
    expect(screen.queryByText('68 Fukakusa Yabunouchicho')).toBeNull()

    pin.focus()
    await waitFor(() => {
      expect(screen.getByText('68 Fukakusa Yabunouchicho')).toBeDefined()
    })
    // The card repeats the trigger's name, so it is hidden from the reader.
    expect(
      screen
        .getByText('68 Fukakusa Yabunouchicho')
        .closest('[aria-hidden="true"]'),
    ).not.toBeNull()
  })

  it('zooms a cluster to the level where it breaks apart', async () => {
    const user = userEvent.setup()
    const twin: MapPlace = {
      ...TOKYO,
      id: 'p3',
      name: 'Asakusa Shrine',
      lng: 139.7968,
    }
    render(
      <MapCanvas label="Trip map">
        <PlaceMarkers places={[TOKYO, twin]} categories={CATEGORIES} />
      </MapCanvas>,
    )

    await user.click(await screen.findByRole('button', { name: /2 places/ }))
    expect(harness.eases).toHaveLength(1)
    expect(harness.eases[0]).toMatchObject({ zoom: expect.any(Number) })
  })

  it('removes its markers from the map when it unmounts', async () => {
    const { unmount } = render(
      <MapCanvas label="Trip map">
        <PlaceMarkers places={[KYOTO, TOKYO]} categories={CATEGORIES} />
      </MapCanvas>,
    )

    await screen.findByRole('button', { name: /Fushimi Inari/ })
    const map = lastMap()
    expect(map.getContainer().childElementCount).toBe(2)

    unmount()
    expect(map.getContainer().childElementCount).toBe(0)
  })
})

describe('FitBounds', () => {
  it('frames the trip once the style has loaded', async () => {
    render(
      <MapCanvas label="Trip map">
        <FitBounds
          points={[
            [KYOTO.lng, KYOTO.lat],
            [TOKYO.lng, TOKYO.lat],
          ]}
        />
      </MapCanvas>,
    )

    await waitFor(() => expect(harness.maps).toHaveLength(1))
    const map = lastMap()
    expect(map.fits).toHaveLength(0)

    map.emit('load')
    await waitFor(() => expect(map.fits).toHaveLength(1))
    expect(map.fits[0].bounds).toEqual([
      [135.7727, 34.9671],
      [139.7967, 35.7148],
    ])
  })

  it('keeps the floating panels clear of the fitted rectangle', async () => {
    render(
      <MapCanvas label="Trip map">
        <FitBounds
          points={[
            [KYOTO.lng, KYOTO.lat],
            [TOKYO.lng, TOKYO.lat],
          ]}
          padding={{ left: 360 }}
        />
      </MapCanvas>,
    )

    await waitFor(() => expect(harness.maps).toHaveLength(1))
    const map = lastMap()
    map.emit('load')
    await waitFor(() => expect(map.fits).toHaveLength(1))
    // The caller's inset reaches the camera intact: 360px on the left is the rail
    // the pins have to stay clear of, and the other three edges keep the default.
    const { padding } = map.fits[0].options as {
      padding: Record<'top' | 'right' | 'bottom' | 'left', number>
    }
    expect(padding.left).toBe(360)
    expect(padding.top).toBeGreaterThan(0)
    expect(padding.left + padding.right).toBeLessThan(1440)
    expect(padding.top + padding.bottom).toBeLessThan(900)
  })

  it('does nothing at all when disabled', async () => {
    render(
      <MapCanvas label="Trip map">
        <FitBounds points={[[KYOTO.lng, KYOTO.lat]]} enabled={false} />
      </MapCanvas>,
    )

    await waitFor(() => expect(harness.maps).toHaveLength(1))
    const map = lastMap()
    map.emit('load')
    expect(map.fits).toHaveLength(0)
  })

  it('does not drag the camera back when the caller rebuilds an identical list', async () => {
    const view = (
      <MapCanvas label="Trip map">
        <FitBounds
          points={[
            [KYOTO.lng, KYOTO.lat],
            [TOKYO.lng, TOKYO.lat],
          ]}
        />
      </MapCanvas>
    )
    const { rerender } = render(view)

    await waitFor(() => expect(harness.maps).toHaveLength(1))
    const map = lastMap()
    map.emit('load')
    await waitFor(() => expect(map.fits).toHaveLength(1))

    rerender(
      <MapCanvas label="Trip map">
        <FitBounds
          points={[
            [KYOTO.lng, KYOTO.lat],
            [TOKYO.lng, TOKYO.lat],
          ]}
        />
      </MapCanvas>,
    )
    expect(map.fits).toHaveLength(1)
  })
})
