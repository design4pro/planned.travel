// @vitest-environment jsdom
// The panel is a Radix dialog and the action block mounts a second one for its
// destructive confirmation, so both need the pointer-capture and scroll stubs
// jsdom does not implement.
import '#/components/ui/__tests__/test-env'

import * as React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { MapProvider } from '#/components/map/map-context'
import { VISITED_COUNTRY_LAYER_IDS } from '#/components/map/visited-countries'
import { countryFeatures } from '#/lib/map/countries'
import {
  CountryOverlay,
  anchorLandmass,
  anchorSpan,
  chromeFreeAreas,
  countryLandmasses,
  placeCountrySurface,
  surfaceAreas,
} from '../country-overlay'

import type {
  CountryOverlayCountry,
  CountryOverlayProps,
  SurfaceArea,
  SurfaceBox,
} from '../country-overlay'
import type { MapContextValue, MapLibreMap } from '#/components/map/map-context'
import type { MapBounds } from '#/lib/map'

/**
 * The four writes and the router, stood in for.
 *
 * `#/server/fns/atlas` reaches the request scope through `cloudflare:workers`,
 * which does not resolve in jsdom, and `useAction` inside the action block needs
 * a router above it. Neither is the subject here: this file is about where the
 * surfaces go, what they say, and how few renders they cost.
 */
const atlas = vi.hoisted(() => ({
  mark: vi.fn(),
  unmark: vi.fn(),
  add: vi.fn(),
  drop: vi.fn(),
}))
const router = vi.hoisted(() => ({ invalidate: vi.fn() }))

vi.mock('#/server/fns/atlas', () => ({
  loadCountryVisitFn: vi.fn(),
  updateCountryVisitFn: vi.fn(),
  loadCountryRegionsFn: vi.fn().mockResolvedValue({ regions: [], total: 0 }),
  markRegionVisitedFn: vi.fn(),
  unmarkRegionVisitedFn: vi.fn(),
  markCountryVisitedFn: atlas.mark,
  unmarkCountryVisitedFn: atlas.unmark,
  addCountryToBucketListFn: atlas.add,
  removeCountryFromBucketListFn: atlas.drop,
}))
vi.mock('@tanstack/react-router', () => ({ useRouter: () => router }))

/* ------------------------------------------------------------------ the map */

interface FakeEvent {
  readonly point: { readonly x: number; readonly y: number }
  readonly lngLat: { readonly lng: number; readonly lat: number }
}

/**
 * Enough MapLibre for the paint layer beneath the overlay and for the overlay's
 * own three listeners, plus the two answers the placement pass needs: the
 * container it projects into and the canvas focus comes back to.
 */
class FakeMap {
  readonly container = document.createElement('div')
  readonly canvas = document.createElement('div')
  readonly sources = new Map<string, { setData: (data: unknown) => void }>()
  readonly layers = new Set<string>()
  readonly featureStates: Array<{
    id: string
    state: Record<string, unknown>
  }> = []
  /** Every source/layer mutation, so a re-render that re-ran an effect is visible. */
  readonly ops: Array<string> = []
  hits: Array<{ id: unknown }> = []
  zoom = 1

  private readonly handlers = new Map<string, Set<(event: FakeEvent) => void>>()

  constructor() {
    this.canvas.tabIndex = 0
    this.container.appendChild(this.canvas)
    document.body.appendChild(this.container)
  }

  addSource(id: string, definition: Record<string, unknown>): void {
    this.ops.push(`addSource:${id}`)
    let data = definition.data
    this.sources.set(id, {
      setData(next: unknown) {
        data = next
      },
    })
    void data
  }

  getSource(id: string): { setData: (data: unknown) => void } | undefined {
    return this.sources.get(id)
  }

  removeSource(id: string): void {
    this.ops.push(`removeSource:${id}`)
    this.sources.delete(id)
  }

  addLayer(layer: { id: string }): void {
    this.ops.push(`addLayer:${layer.id}`)
    this.layers.add(layer.id)
  }

  getLayer(id: string): { id: string } | undefined {
    return this.layers.has(id) ? { id } : undefined
  }

  removeLayer(id: string): void {
    this.ops.push(`removeLayer:${id}`)
    this.layers.delete(id)
  }

  setFeatureState(
    target: { source: string; id: string },
    state: Record<string, unknown>,
  ): void {
    this.featureStates.push({ id: target.id, state })
  }

  queryRenderedFeatures(): Array<{ id: unknown }> {
    return this.hits
  }

  getZoom(): number {
    return this.zoom
  }

  getContainer(): HTMLElement {
    return this.container
  }

  getCanvas(): HTMLElement {
    return this.canvas
  }

  project(position: [number, number]): { x: number; y: number } {
    return { x: (position[0] + 180) * 2, y: (90 - position[1]) * 2 }
  }

  on(type: string, handler: (event: FakeEvent) => void): this {
    const set = this.handlers.get(type) ?? new Set()
    set.add(handler)
    this.handlers.set(type, set)
    return this
  }

  off(type: string, handler: (event: FakeEvent) => void): this {
    this.handlers.get(type)?.delete(handler)
    return this
  }

  emit(type: string, event: FakeEvent = pointerAt(0, 45)): void {
    for (const handler of [...(this.handlers.get(type) ?? [])]) handler(event)
  }
}

function pointerAt(lng: number, lat: number): FakeEvent {
  return { point: { x: 10, y: 10 }, lngLat: { lng, lat } }
}

function context(map: FakeMap): MapContextValue {
  return {
    map: map as unknown as MapLibreMap,
    gl: null,
    ready: true,
    basemap: 'unavailable',
    engine: 'running',
    archive: null,
    theme: 'light',
    styleEpoch: 0,
    retryBasemap: () => {},
  }
}

/* ---------------------------------------------------------------- the props */

const FRANCE: CountryOverlayCountry = {
  countryCode: 'FR',
  tripCount: 3,
  placeCount: 12,
  firstTripOn: '2019-07-14',
  lastTripOn: '2026-09-06',
  visit: {
    firstVisitedOn: '2019-07-14',
    lastVisitedOn: '2026-09-08',
    visitCount: 3,
    note: null,
  },
}

/**
 * The United States as the demo workspace seeds it: two visits, no itinerary.
 *
 * This is the shape most of a real record is in — the map fills the country
 * because somebody marked it, and no trip was ever planned in this product to
 * go with it — and it is the shape the overlay used to drop on the floor. The
 * row carries its visits nested under `visit` because the action block wants
 * them as an object, and for three rounds the two card call sites listed the
 * four trip columns beside it and never reached in. So there is a fixture for
 * it here, at the seam, rather than only in the card's own tests: the card was
 * never the thing that was broken.
 */
const UNITED_STATES: CountryOverlayCountry = {
  countryCode: 'US',
  tripCount: 0,
  placeCount: 0,
  firstTripOn: null,
  lastTripOn: null,
  visit: {
    firstVisitedOn: '2016-08-14',
    lastVisitedOn: '2023-03-02',
    visitCount: 2,
    note: null,
  },
}

/** How many times the screen above the overlay has rendered. */
let screenRenders = 0

interface HarnessProps extends Partial<CountryOverlayProps> {
  readonly map: FakeMap
}

/**
 * The screen, reduced to the two things it owes the overlay: a host layer for
 * the surfaces, and the selection.
 *
 * It counts its own renders, because "hovering does not re-render the atlas
 * screen" is a claim about this component and not about the overlay inside it.
 *
 * The two bare controls either side of the host stand in for the rest of the
 * page — the header above the map, the shelf below it. They exist so that
 * "a reader can tab out of the panel" is a claim with somewhere to land.
 */
function Harness({ map, ...overrides }: HarnessProps) {
  screenRenders += 1
  const [host, setHost] = React.useState<HTMLDivElement | null>(null)
  return (
    <MapProvider value={context(map)}>
      <button type="button">Above the map</button>
      <div ref={setHost} data-testid="surface-host" />
      <CountryOverlay
        visits={[{ countryCode: 'FR', lastVisitedOn: '2026-09-08' }]}
        countries={[FRANCE]}
        bucketList={[]}
        selectedCode={null}
        selectionToken={0}
        onSelect={() => {}}
        padding={{ top: 76, right: 60, bottom: 424, left: 16 }}
        container={host}
        {...overrides}
      />
      <button type="button">Below the map</button>
    </MapProvider>
  )
}

/**
 * Everything inside one element a Tab press can reach, in document order.
 *
 * `tabIndex` reflects the attribute and not the state, so a disabled button
 * still reports `0` — the filter has to say so explicitly or this helper stops
 * agreeing with the browser exactly where the interesting case is.
 */
function tabStops(root: HTMLElement): ReadonlyArray<HTMLElement> {
  return [...root.querySelectorAll<HTMLElement>('*')].filter(
    (node) => node.tabIndex >= 0 && !node.hasAttribute('disabled'),
  )
}

function mount(map: FakeMap, overrides: Partial<CountryOverlayProps> = {}) {
  screenRenders = 0
  const view = render(<Harness map={map} {...overrides} />)
  // The paint layer only answers a pointer once its fill layer exists.
  expect(map.layers.has(VISITED_COUNTRY_LAYER_IDS.fill)).toBe(true)
  return view
}

/** Moves the pointer over one country, the way MapLibre reports it. */
function moveOver(map: FakeMap, code: string | null, lng = 2, lat = 47): void {
  map.hits = code === null ? [] : [{ id: code }]
  act(() => {
    map.emit('mousemove', pointerAt(lng, lat))
  })
}

/**
 * Radix restores focus a macrotask after a focus scope unmounts, so a panel torn
 * down by the previous test's cleanup steals focus in the middle of this one —
 * which is a property of the harness rather than of the overlay, and exactly the
 * kind of cross-test coupling that turns a real assertion into a coin toss.
 * Draining the queue between tests is what makes each one start from rest.
 */
beforeEach(async () => {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  })
  vi.clearAllMocks()
  router.invalidate.mockResolvedValue(undefined)
  for (const fn of [atlas.mark, atlas.unmark, atlas.add, atlas.drop]) {
    fn.mockResolvedValue(undefined)
  }
})

/* ------------------------------------------------------------- the geometry */

describe('placeCountrySurface', () => {
  const area: SurfaceBox = { x: 0, y: 0, width: 1000, height: 600 }
  const size = { width: 300, height: 200 }

  it('puts the surface above the shape when there is room', () => {
    const spot = placeCountrySurface({
      anchor: { x: 400, y: 300, width: 100, height: 60 },
      size,
      areas: [area],
    })
    expect(spot?.side).toBe('top')
    // Above the shape, clear of it by the gap, and centred on it.
    expect(spot?.y).toBe(300 - 8 - 200)
    expect(spot?.x).toBe(450 - 150)
    expect(spot?.clear).toBe(true)
  })

  it('flips below the shape rather than covering it', () => {
    const spot = placeCountrySurface({
      anchor: { x: 400, y: 20, width: 100, height: 60 },
      size,
      areas: [area],
    })
    expect(spot?.side).toBe('bottom')
    expect(spot?.y).toBe(20 + 60 + 8)
  })

  it('goes beside the shape when neither above nor below fits', () => {
    const spot = placeCountrySurface({
      anchor: { x: 400, y: 0, width: 100, height: 600 },
      size,
      areas: [area],
    })
    expect(spot?.side).toBe('right')
    expect(spot?.x).toBe(400 + 100 + 8)
  })

  it('never overlaps the shape it describes, wherever the shape sits', () => {
    for (const x of [0, 120, 480, 700, 940]) {
      for (const y of [0, 90, 300, 520, 590]) {
        const anchor = { x, y, width: 60, height: 40 }
        const spot = placeCountrySurface({ anchor, size, areas: [area] })
        expect(spot).not.toBeNull()
        if (spot === null || !spot.clear) continue
        const apart =
          spot.x + size.width <= anchor.x ||
          spot.x >= anchor.x + anchor.width ||
          spot.y + size.height <= anchor.y ||
          spot.y >= anchor.y + anchor.height
        expect(apart, `overlapped the shape at ${x},${y}`).toBe(true)
      }
    }
  })

  it('keeps the surface inside the area for a shape at the edge', () => {
    const spot = placeCountrySurface({
      anchor: { x: 990, y: 300, width: 10, height: 10 },
      size,
      areas: [{ x: 16, y: 76, width: 900, height: 400 }],
    })
    expect(spot).not.toBeNull()
    if (spot === null) return
    expect(spot.x).toBeGreaterThanOrEqual(16)
    expect(spot.x + size.width).toBeLessThanOrEqual(916)
  })

  it('drops the tip rather than pointing it at open water', () => {
    const centred = placeCountrySurface({
      anchor: { x: 400, y: 300, width: 100, height: 60 },
      size,
      areas: [area],
    })
    expect(centred?.tip).toBe(150)

    const clamped = placeCountrySurface({
      anchor: { x: 4, y: 300, width: 8, height: 8 },
      size,
      areas: [{ x: 0, y: 0, width: 1000, height: 600 }],
    })
    expect(clamped?.tip).toBeNull()
  })

  it('falls back to the looser area only when the strict one has no room', () => {
    const strict: SurfaceBox = { x: 0, y: 0, width: 400, height: 150 }
    const relaxed: SurfaceBox = { x: 0, y: 0, width: 400, height: 600 }
    const spot = placeCountrySurface({
      anchor: { x: 100, y: 100, width: 40, height: 40 },
      size: { width: 300, height: 380 },
      areas: [strict, relaxed],
    })
    expect(spot?.clear).toBe(true)
    expect((spot?.y ?? 0) + 380).toBeLessThanOrEqual(600)
    expect((spot?.y ?? 0) + 380).toBeGreaterThan(150)
  })

  it('reports that it could not clear the shape rather than refusing to place', () => {
    const spot = placeCountrySurface({
      anchor: { x: 0, y: 0, width: 400, height: 300 },
      size: { width: 380, height: 280 },
      areas: [{ x: 0, y: 0, width: 400, height: 300 }],
    })
    expect(spot?.clear).toBe(false)
    expect(spot?.tip).toBeNull()
  })

  it('has nothing to say with no area at all', () => {
    expect(
      placeCountrySurface({
        anchor: { x: 0, y: 0, width: 10, height: 10 },
        size,
        areas: [],
      }),
    ).toBeNull()
  })

  /**
   * The phone's whole composition, stated as arithmetic.
   *
   * A 360px handset leaves about 570 usable pixels of map, and a panel carrying
   * a fact grid and two writes wants five hundred and forty of them — so at full
   * height no side of the country ever fits and the surface used to be centred
   * on the very shape it describes, covering four fifths of the map. Given a
   * floor it may not go below, it gives up height instead and sits beneath the
   * country with the country still on screen.
   */
  describe('when the surface may be squeezed', () => {
    // A phone: 286 of clear width, 566 of clear height, a country in the middle.
    const phone: SurfaceBox = { x: 11, y: 137, width: 286, height: 566 }
    const country: SurfaceBox = { x: 90, y: 210, width: 130, height: 140 }
    const tall = { width: 286, height: 546 }

    it('gives up height rather than covering the shape', () => {
      const spot = placeCountrySurface({
        anchor: country,
        size: tall,
        areas: [phone],
        minHeight: 288,
      })
      expect(spot?.clear).toBe(true)
      expect(spot?.side).toBe('bottom')
      // Below the shape, by the gap, and no further down than the area allows.
      expect(spot?.y).toBe(country.y + country.height + 8)
      expect(spot?.height).toBe(
        phone.y + phone.height - (country.y + country.height + 8),
      )
      expect((spot?.height ?? 0) + (spot?.y ?? 0)).toBeLessThanOrEqual(
        phone.y + phone.height,
      )
    })

    it('still points its tip at the shape it was squeezed for', () => {
      const spot = placeCountrySurface({
        anchor: country,
        size: tall,
        areas: [phone],
        minHeight: 288,
      })
      expect(spot?.tip).not.toBeNull()
    })

    it('takes the side with the most room, not the first that fits', () => {
      // A country low on the map: 275 above it and 211 below, and both clear the
      // floor — so the answer is the roomier one rather than the first offered.
      const spot = placeCountrySurface({
        anchor: { x: 90, y: 420, width: 130, height: 64 },
        size: tall,
        areas: [phone],
        minHeight: 200,
      })
      expect(spot?.side).toBe('top')
      expect(spot?.height).toBe(420 - 8 - phone.y)
    })

    /**
     * Some maps are shorter than the surface plus the country.
     *
     * An iPhone in Safari leaves 529 pixels of world once its two bars are out,
     * and no panel carrying a fact card and two writes clears a framed country
     * inside that at a height worth having. Centred on the shape it covers the
     * country *and* the world either side of it. Docked, it takes the edge the
     * country is furthest from and stops as close to the country as the floor
     * allows, so the search pill and a third of the world stay above it.
     */
    it('docks to the far edge rather than sit on top of the shape', () => {
      const spot = placeCountrySurface({
        // A country high on a short map: 137 → 220 above it, 458 → 703 below.
        anchor: { x: 90, y: 220, width: 130, height: 238 },
        size: tall,
        areas: [phone],
        minHeight: 288,
      })
      expect(spot?.clear, 'it overlaps, and says so').toBe(false)
      expect(spot?.side).toBe('bottom')
      expect(
        spot?.tip,
        'the middle of the country is still above it, so the tip still points at it',
      ).not.toBeNull()
      expect(spot?.height).toBe(288)
      expect(
        (spot?.y ?? 0) + (spot?.height ?? 0),
        'flush with the edge it docked to',
      ).toBe(phone.y + phone.height)
      expect(
        spot?.y,
        'and it leaves the top of the country and the world above it on screen',
      ).toBeGreaterThan(220)
    })

    /**
     * The phone's real numbers, and the one dock that may not point.
     *
     * A 360px handset frames a country 128px tall in 444 of clear map, and the
     * sheet's floor stops it 228px down — under the middle of the country. A tip
     * on that edge would be pointing at land the surface is standing on, so it is
     * dropped; the flag and the name in the card are what say which country it
     * is, and the map behind still has it outlined.
     */
    it('drops the tip when the dock reaches past the middle of the shape', () => {
      const spot = placeCountrySurface({
        anchor: { x: 124, y: 167, width: 160, height: 128 },
        size: { width: 336, height: 368 },
        areas: [{ x: 12, y: 72, width: 336, height: 444 }],
        minHeight: 288,
      })
      expect(spot?.side).toBe('bottom')
      expect(spot?.height).toBe(288)
      expect(spot?.tip).toBeNull()
    })

    /**
     * The desktop's real numbers, and the reason the shelf is no longer touched.
     *
     * 1440×900 leaves 335 pixels of map above the shelf and a panel carrying the
     * card *and* both writes is 674×275, so no side of a framed country fits and
     * the surface used to answer that by taking the looser area whole — flat
     * across the shelf's tab strip, with the tab named "Country" unpressable.
     * Docked down the left of the clear map it takes thirty pixels of the west
     * coast, leaves the country and the shelf alone, and still points at it.
     */
    it('docks beside a framed country rather than over the shelf', () => {
      const strict: SurfaceBox = { x: 16, y: 76, width: 1356, height: 335 }
      const shelf: SurfaceBox = { x: 16, y: 76, width: 1356, height: 743 }
      const spot = placeCountrySurface({
        anchor: { x: 655, y: 76, width: 210, height: 169 },
        size: { width: 674, height: 275 },
        areas: [strict, shelf],
        minHeight: 288,
      })
      expect(spot?.side).toBe('left')
      expect(spot?.x).toBe(strict.x)
      expect(
        (spot?.y ?? 0) + (spot?.height ?? 275),
        'entirely above the shelf, which starts where the strict area ends',
      ).toBeLessThanOrEqual(strict.y + strict.height)
      expect(
        spot?.tip,
        'the country is out to the right of it, so it points that way',
      ).not.toBeNull()
      expect(
        spot?.height,
        'and it never had to give up a pixel of height to do it',
      ).toBeNull()
    })

    it('docks to the top for a country low on the map', () => {
      const spot = placeCountrySurface({
        anchor: { x: 90, y: 460, width: 130, height: 200 },
        size: tall,
        areas: [phone],
        minHeight: 288,
      })
      expect(spot?.side).toBe('top')
      expect(spot?.y).toBe(phone.y)
      expect(spot?.height).toBe(460 - 8 - phone.y)
    })

    it('centres on the shape only when the map cannot hold the floor at all', () => {
      const spot = placeCountrySurface({
        anchor: { x: 90, y: 150, width: 130, height: 100 },
        size: tall,
        areas: [{ x: 11, y: 137, width: 286, height: 200 }],
        minHeight: 288,
      })
      expect(spot?.clear).toBe(false)
      expect(spot?.height).toBeNull()
    })

    it('never squeezes a surface that could have fitted whole', () => {
      const spot = placeCountrySurface({
        anchor: { x: 400, y: 300, width: 100, height: 60 },
        size,
        areas: [area],
        minHeight: 100,
      })
      expect(spot?.side).toBe('top')
      expect(
        spot?.height,
        'a surface placed at the height it asked for reports no ceiling',
      ).toBeNull()
    })

    it('keeps the strict area ahead of the looser one even when it holds less', () => {
      const strict: SurfaceBox = { x: 0, y: 0, width: 400, height: 400 }
      const relaxed: SurfaceBox = { x: 0, y: 0, width: 400, height: 600 }
      const spot = placeCountrySurface({
        anchor: { x: 100, y: 100, width: 40, height: 40 },
        size: { width: 300, height: 500 },
        areas: [strict, relaxed],
        minHeight: 200,
      })
      // 148 → 400 inside the strict area is 252; the looser one would have given
      // 452. The chrome is there to be cleared, not to be outbid.
      expect(spot?.height).toBe(252)
      expect((spot?.y ?? 0) + (spot?.height ?? 0)).toBeLessThanOrEqual(400)
    })

    it('leaves a surface with no floor to fall back on centred, as before', () => {
      const spot = placeCountrySurface({
        anchor: country,
        size: tall,
        areas: [phone],
      })
      expect(spot?.clear).toBe(false)
      expect(spot?.height).toBeNull()
    })
  })

  /**
   * The other surface, which is neither map nor chrome.
   *
   * The areas are cut from the screen's own insets, so they can say where the
   * search pill and the shelf are and nothing at all about the click panel: it
   * is anchored to a country of its own, it comes and goes, and it moves on
   * every frame of a pan. A hover card solved without it landed *behind* it,
   * with two cards about two countries stacked on the same pixels.
   */
  describe('when another surface is in the way', () => {
    const panel: SurfaceBox = { x: 300, y: 320, width: 400, height: 240 }

    it('takes another side rather than landing on it', () => {
      const anchor = { x: 400, y: 300, width: 100, height: 60 }
      // Above the shape is the first side offered, and with nothing in the way
      // it is the one taken — so the case only bites when that side is occupied.
      expect(placeCountrySurface({ anchor, size, areas: [area] })?.side).toBe(
        'top',
      )

      const spot = placeCountrySurface({
        anchor,
        size,
        areas: [area],
        avoid: { x: 300, y: 0, width: 400, height: 300 },
      })
      expect(spot?.clear).toBe(true)
      expect(spot?.side).toBe('bottom')
      expect(spot?.y).toBe(300 + 60 + 8)
    })

    it('never shares a pixel with the rectangle it was told to avoid', () => {
      for (const x of [0, 120, 480, 700, 940]) {
        for (const y of [0, 90, 300, 520, 590]) {
          const spot = placeCountrySurface({
            anchor: { x, y, width: 60, height: 40 },
            size,
            areas: [area],
            avoid: panel,
          })
          expect(spot).not.toBeNull()
          if (spot === null || !spot.clear) continue
          const apart =
            spot.x + size.width <= panel.x ||
            spot.x >= panel.x + panel.width ||
            spot.y + size.height <= panel.y ||
            spot.y >= panel.y + panel.height
          expect(apart, `landed on the panel at ${x},${y}`).toBe(true)
        }
      }
    })

    it('reports that it could not clear it, so decoration can stand down', () => {
      const spot = placeCountrySurface({
        anchor: { x: 400, y: 280, width: 100, height: 40 },
        size,
        areas: [{ x: 0, y: 0, width: 320, height: 600 }],
        avoid: { x: 0, y: 0, width: 320, height: 600 },
      })
      expect(spot?.clear).toBe(false)
    })

    it('changes nothing for a surface that was given no obstacle', () => {
      const anchor = { x: 400, y: 300, width: 100, height: 60 }
      expect(placeCountrySurface({ anchor, size, areas: [area] })).toEqual(
        placeCountrySurface({ anchor, size, areas: [area], avoid: null }),
      )
    })

    it('keeps a squeezed surface off it as well', () => {
      const anchor = { x: 20, y: 200, width: 300, height: 60 }
      const phone: SurfaceBox = { x: 0, y: 0, width: 340, height: 600 }
      const squeezed = {
        anchor,
        size: { width: 336, height: 540 },
        areas: [phone],
        minHeight: 288,
      }
      // With the lower half free the sheet is squeezed onto it and reports that
      // it cleared the shape.
      const free = placeCountrySurface(squeezed)
      expect(free?.clear).toBe(true)
      expect(free?.side).toBe('bottom')

      // With the lower half occupied the squeeze pass declines it, and what
      // comes back is the docked answer that says so. Only a surface which must
      // stay reachable ever takes that one; the hover card is not drawn.
      const blocked = placeCountrySurface({
        ...squeezed,
        avoid: { x: 0, y: 300, width: 340, height: 300 },
      })
      expect(blocked?.clear).toBe(false)
    })
  })
})

/**
 * The map's edge is not the end of the surface.
 *
 * `--duration-fast`, spelled out: the exit hold below has to match the class the
 * layer carries, and a test that read the number out of the component would be
 * asserting that the component equals itself.
 */
const EXIT_MS = 150

describe('anchorSpan', () => {
  it('leaves a shape that is entirely on screen alone', () => {
    expect(anchorSpan(200, 320, 0, 1000)).toEqual({
      start: 200,
      size: 120,
      onScreen: true,
    })
  })

  it('keeps only the part of a half-visible shape that is on screen', () => {
    const span = anchorSpan(-400, 120, 0, 1000)
    expect(span).toEqual({ start: 0, size: 120, onScreen: true })
  })

  it('leaves a stub on the edge a shape went out of, rather than nothing', () => {
    const west = anchorSpan(-900, -400, 0, 1000)
    expect(west.onScreen).toBe(false)
    expect(west.start).toBe(0)
    expect(west.size).toBe(12)

    const east = anchorSpan(1400, 1900, 0, 1000)
    expect(east.onScreen).toBe(false)
    expect(east.start).toBe(1000 - 12)
    expect(east.size).toBe(12)
  })

  it('never claims more room than the map has', () => {
    const span = anchorSpan(-500, 1500, 0, 40)
    expect(span).toEqual({ start: 0, size: 40, onScreen: true })
  })

  it('still answers a shape that is exactly on the edge', () => {
    const span = anchorSpan(1000, 1200, 0, 1000)
    expect(span.onScreen).toBe(false)
    expect(span.start + span.size).toBeLessThanOrEqual(1000)
  })
})

describe('surfaceAreas', () => {
  const box: SurfaceBox = { x: 0, y: 0, width: 1440, height: 835 }

  it('states the strict area as the chrome describes it', () => {
    const [strict] = surfaceAreas(box, {
      top: 76,
      right: 60,
      bottom: 424,
      left: 16,
    })
    expect(strict).toEqual({
      kind: 'strict',
      x: 16,
      y: 76,
      width: 1364,
      height: 335,
    })
  })

  it('offers a second area that gives up the shelf and keeps the gutter', () => {
    const areas = surfaceAreas(box, {
      top: 76,
      right: 60,
      bottom: 424,
      left: 16,
    })
    expect(areas).toHaveLength(2)
    expect(areas[1]?.height).toBe(835 - 76 - 16)
  })

  it('offers one area when the shelf costs no more than the gutter', () => {
    expect(
      surfaceAreas(box, { top: 76, right: 60, bottom: 16, left: 16 }),
    ).toHaveLength(1)
  })

  /**
   * The phone's zoom cluster is the top-right corner, and `cameraPadding()`
   * charges it to both `top` and `right`. Charged twice it cost 54px of width —
   * and 54px is exactly what a gutter-to-gutter sheet was short of, so the click
   * panel could never be placed above the shelf at all and every phone answer
   * ended up on top of it.
   *
   * The widened band is its own area rather than a wider strict one, because the
   * inset is not merely spare: below this width the cluster is the map's top
   * *corner*, and the decorative card, which may use no band that buys its room
   * from the chrome, has to keep clear of it. The panel takes the widened band
   * and comes down the map, where the cluster is not.
   */
  it('offers a phone the width the top-right zoom cluster was charged twice for', () => {
    const phone: SurfaceBox = { x: 0, y: 0, width: 360, height: 650 }
    const areas = surfaceAreas(phone, {
      top: 72,
      right: 54,
      bottom: 156,
      left: 12,
    })
    expect(areas).toHaveLength(3)
    expect(areas[0], 'the strict area still clears the cluster').toEqual({
      kind: 'strict',
      x: 12,
      y: 72,
      width: 294,
      height: 422,
    })
    expect(areas[1], 'gutter to gutter, as the shelf is, and above it').toEqual(
      {
        kind: 'gutter',
        x: 12,
        y: 72,
        width: 336,
        height: 422,
      },
    )
    expect(areas[2]?.height, 'and only then, over the shelf').toBe(
      650 - 72 - 12,
    )
  })

  it('keeps the right inset once the cluster has moved under the shelf', () => {
    const areas = surfaceAreas(box, {
      top: 76,
      right: 60,
      bottom: 424,
      left: 16,
    })
    expect(areas[1]?.width).toBe(areas[0]?.width)
  })

  /**
   * Above the product's measure the chrome stops being at the map's edges. The
   * zoom cluster is 560px in from the right of a 2560px screen, and an area that
   * subtracted its inset from the map put the click panel straight over it.
   */
  describe('on a screen wider than the chrome column', () => {
    const wide: SurfaceBox = { x: 0, y: 0, width: 2560, height: 1375 }
    const padding = { top: 76, right: 60, bottom: 424, left: 16 }

    it('stops the strict area at the column, where the zoom cluster is', () => {
      const [strict] = surfaceAreas(wide, padding, 1440)
      // The well is 560 → 2000; the cluster sits inside its right-hand inset.
      expect(strict.x).toBe(16)
      expect(strict.x + strict.width).toBe(2000 - 60)
    })

    it('offers the map beyond the column, where no chrome ever goes', () => {
      const areas = surfaceAreas(wide, padding, 1440)
      const outside = areas.find((area) => area.x === 2000)
      expect(outside?.width).toBe(2560 - 16 - 2000)
      expect(outside?.height).toBe(1375 - 76 - 424)
    })

    it('leaves a map no wider than the column exactly as it was', () => {
      expect(surfaceAreas(box, padding, 1440)).toEqual(
        surfaceAreas(box, padding),
      )
    })

    /**
     * The band beyond the column is chrome-free by construction, and the hover
     * card was denied it anyway.
     *
     * `slice(0, 1)` is the same answer as this for every screen no wider than
     * the column, and the wrong one above it: the search pill, the zoom cluster,
     * the credit and the shelf are all laid out inside the column, so nothing
     * the decorative surface must clear is ever out there.
     */
    it('offers the decorative surface both bands with no chrome on them', () => {
      const free = chromeFreeAreas(surfaceAreas(wide, padding, 1440))
      expect(free.map((band) => band.kind)).toEqual(['strict', 'outside'])
    })

    it('denies it every band that buys its room from the chrome', () => {
      const phone: SurfaceBox = { x: 0, y: 0, width: 360, height: 650 }
      const free = chromeFreeAreas(
        surfaceAreas(phone, { top: 72, right: 54, bottom: 156, left: 12 }),
      )
      expect(
        free.map((band) => band.kind),
        'the gutter reclaims the cluster inset and the relaxed band is the shelf',
      ).toEqual(['strict'])
    })
  })
})

/**
 * The east edge of a screen wider than the chrome column, which is where a
 * preference between kinds of room stops being the right question.
 *
 * The strict band ends at the column's right edge and the outside band carries
 * on to the map's; they are a horizontal partition rather than a ranking, and a
 * shape standing in the second of them was being offered the first — which
 * clamps: `offerSide` brings the surface back inside the area it was given, so
 * the answer looked placed and clear while sitting five hundred pixels west of
 * the country it named, with no tip, over open water.
 */
describe('placeCountrySurface across a partitioned map', () => {
  const strict: SurfaceArea = {
    kind: 'strict',
    x: 16,
    y: 76,
    width: 1924,
    height: 875,
  }
  const outside: SurfaceArea = {
    kind: 'outside',
    x: 2000,
    y: 76,
    width: 544,
    height: 875,
  }
  /** Australia's rectangle on a 2560px world map, near enough. */
  const australia: SurfaceBox = { x: 2150, y: 620, width: 350, height: 210 }
  const card = { width: 90, height: 36 }

  it('places a card for a country beyond the column beside that country', () => {
    const spot = placeCountrySurface({
      anchor: australia,
      size: card,
      areas: [strict, outside],
    })
    expect(spot?.clear).toBe(true)
    expect(
      spot?.x,
      'inside the band the shape stands in, not clamped to the column',
    ).toBeGreaterThanOrEqual(outside.x)
    expect(
      spot?.tip,
      'and close enough to still point at the shape it names',
    ).not.toBeNull()
    expect(
      Math.abs(
        (spot?.x ?? 0) + card.width / 2 - (australia.x + australia.width / 2),
      ),
      'centred on the shape to within the room the band leaves',
    ).toBeLessThan(60)
  })

  it('leaves a country inside the column in the strict band', () => {
    const spot = placeCountrySurface({
      anchor: { x: 900, y: 400, width: 120, height: 90 },
      size: card,
      areas: [strict, outside],
    })
    expect(spot?.x).toBeLessThan(outside.x)
    expect(spot?.tip).not.toBeNull()
  })

  it('keeps the band order when a shape straddles both of them', () => {
    // Two thirds of it inside the column, so the column is where it goes: the
    // partition is decided by which band holds most of the shape, not by which
    // edge it happens to touch.
    const spot = placeCountrySurface({
      anchor: { x: 1700, y: 400, width: 360, height: 200 },
      size: card,
      areas: [strict, outside],
    })
    expect(spot?.x).toBeLessThan(outside.x)
  })

  it('falls back to the column when the outside band is too narrow to hold it', () => {
    const spot = placeCountrySurface({
      anchor: australia,
      size: { width: 674, height: 275 },
      areas: [strict, outside],
      minHeight: 288,
    })
    expect(spot?.x).toBeLessThan(outside.x)
    expect(spot?.clear).toBe(true)
  })

  /**
   * The order that is a ranking rather than a partition, and must survive this.
   *
   * A phone's widened band is 52px wider on the right than its strict one, so a
   * country at the eastern edge of a 360px map holds more of the widened band
   * than of the strict one — and the band that reaches down *over the shelf*
   * shares that width. Ordering on width alone would therefore have promoted the
   * shelf band ahead of the strict one for exactly those countries, which is the
   * defect the area order exists to prevent: a panel lying across the tab strip
   * that names the country it is about.
   */
  it('never promotes the band that reaches over the shelf', () => {
    const strictPhone: SurfaceArea = {
      kind: 'strict',
      x: 12,
      y: 72,
      width: 294,
      height: 422,
    }
    const gutter: SurfaceArea = {
      kind: 'gutter',
      x: 12,
      y: 72,
      width: 336,
      height: 422,
    }
    const shelf: SurfaceArea = {
      kind: 'relaxed',
      x: 12,
      y: 72,
      width: 336,
      height: 566,
    }
    const spot = placeCountrySurface({
      // Hard against the east edge, where only the two widened bands hold it.
      anchor: { x: 300, y: 200, width: 48, height: 60 },
      size: { width: 336, height: 368 },
      areas: [strictPhone, gutter, shelf],
      minHeight: 288,
    })
    expect(
      (spot?.y ?? 0) + (spot?.height ?? 368),
      'the shelf is reached only when nothing above it can hold the surface',
    ).toBeLessThanOrEqual(strictPhone.y + strictPhone.height)
  })

  /**
   * A country dragged off the map leaves a stub clamped to the edge it went out
   * of, and no band holds any of it. Nothing is preferred then, and the caller's
   * own order — the strictest first, the shelf last — stands exactly as before.
   */
  it('keeps the caller order when no band holds any of the shape', () => {
    const shelf: SurfaceArea = {
      kind: 'relaxed',
      x: 16,
      y: 76,
      width: 1924,
      height: 1283,
    }
    const stub: SurfaceBox = { x: 16, y: 1240, width: 12, height: 12 }
    const spot = placeCountrySurface({
      anchor: stub,
      size: { width: 300, height: 200 },
      areas: [strict, shelf],
      minHeight: 180,
    })
    expect(
      (spot?.y ?? 0) + (spot?.height ?? 200),
      'the strict band is exhausted before the shelf is looked at',
    ).toBeLessThanOrEqual(strict.y + strict.height)
  })
})

describe('countryLandmasses', () => {
  const payload = countryFeatures()

  it('solves a rectangle per landmass and remembers it', () => {
    const first = countryLandmasses(payload, 'fr')
    expect(first.length).toBeGreaterThan(0)
    expect(countryLandmasses(payload, 'FR')).toBe(first)
  })

  it('has nothing for a code the world cannot draw', () => {
    expect(countryLandmasses(payload, 'ZZ')).toEqual([])
  })

  it('anchors on the landmass the pointer is over, not on the whole country', () => {
    const metropolitan: MapBounds = {
      west: -5,
      south: 41,
      east: 9.6,
      north: 51.1,
    }
    const guadeloupe: MapBounds = {
      west: -61.8,
      south: 15.8,
      east: -61.2,
      north: 16.5,
    }
    const masses = [metropolitan, guadeloupe]

    expect(anchorLandmass(masses, [-61.5, 16.2])).toBe(guadeloupe)
    expect(anchorLandmass(masses, [2.3, 48.9])).toBe(metropolitan)
    // With no pointer at all — a country chosen by name — the principal
    // landmass, never an island in another ocean.
    expect(anchorLandmass(masses, null)).toBe(metropolitan)
    expect(anchorLandmass([], null)).toBeNull()
  })

  it('keeps a pointer inside a country that crosses the date line', () => {
    const russia: MapBounds = {
      west: 19.6,
      south: 41.2,
      east: 190.1,
      north: 81,
    }
    const island: MapBounds = { west: -1, south: -1, east: 1, north: 1 }
    expect(anchorLandmass([russia, island], [-179, 65])).toBe(russia)
  })
})

/* -------------------------------------------------------------- the surfaces */

describe('CountryOverlay hover', () => {
  it('shows the full fact card for a country on the record', () => {
    const map = new FakeMap()
    mount(map)
    moveOver(map, 'FR')

    const card = screen.getByTestId('surface-host').querySelector('article')
    expect(card).not.toBeNull()
    expect(card?.getAttribute('data-country')).toBe('FR')
    expect(card?.textContent).toContain('France')
    expect(card?.textContent).toContain('12')
    expect(card?.textContent).toContain('September 2026')
  })

  it('shows a name-only pill for a country that is not on the record', () => {
    const map = new FakeMap()
    mount(map)
    moveOver(map, 'DE', 10.4, 51.2)

    const host = screen.getByTestId('surface-host')
    expect(host.querySelector('article')).toBeNull()
    const pill = host.querySelector('[data-variant="compact"]')
    expect(pill?.textContent).toBe('Germany')
  })

  it('prints the visit record for a country the map fills with no trip behind it', () => {
    const map = new FakeMap()
    mount(map, { countries: [FRANCE, UNITED_STATES] })
    moveOver(map, 'US', -98, 39)

    const card = screen.getByTestId('surface-host').querySelector('article')
    expect(card?.getAttribute('data-country')).toBe('US')
    // The reading the map is already making with its fill, said in words.
    expect(card?.dataset.record).toBe('visits')
    expect(card?.dataset.visited).toBe('true')
    const cells = [...(card?.querySelectorAll('dt, dd') ?? [])].map(
      (node) => node.textContent,
    )
    expect(cells).toEqual([
      'Visits',
      '2',
      'Workspace places',
      '0',
      'First visit',
      'August 2016',
      'Last visit',
      'March 2023',
    ])
    // The defect this file exists around, stated as its own assertion: a
    // country the map has painted must not print an absence.
    expect(card?.textContent).not.toContain('Not recorded')
  })

  it('keeps the trip reading for a country with an itinerary behind it', () => {
    const map = new FakeMap()
    mount(map, { countries: [FRANCE, UNITED_STATES] })
    moveOver(map, 'FR')

    const card = screen.getByTestId('surface-host').querySelector('article')
    expect(card?.dataset.record).toBe('trips')
    expect(
      [...(card?.querySelectorAll('dt') ?? [])].map((node) => node.textContent),
    ).toEqual([
      'Workspace trips',
      'Workspace places',
      'First trip',
      'Last trip',
    ])
  })

  it('is decoration: nothing in it is announced or reachable', () => {
    const map = new FakeMap()
    mount(map)
    moveOver(map, 'FR')

    const surface = screen
      .getByTestId('surface-host')
      .querySelector('[data-part="country-hover"]')
    expect(surface?.getAttribute('aria-hidden')).toBe('true')
    expect(surface?.querySelectorAll('button, a, [tabindex]')).toHaveLength(0)
  })

  it('changes state once per country crossing, never per pointer frame', () => {
    const map = new FakeMap()
    mount(map)
    const settled = screenRenders
    const ops = map.ops.length

    for (let frame = 0; frame < 40; frame += 1) {
      moveOver(map, 'FR', 2 + frame * 0.01, 47)
    }
    expect(
      screen.getByTestId('surface-host').querySelector('article'),
    ).not.toBeNull()

    // The screen above never hears about a crossing at all, and the paint layer
    // below never re-runs the effects that build the source and its two layers.
    expect(screenRenders).toBe(settled)
    expect(map.ops.length).toBe(ops)

    moveOver(map, 'DE', 10.4, 51.2)
    moveOver(map, null)
    expect(screenRenders).toBe(settled)
    expect(map.ops.length).toBe(ops)
  })

  it('stands down while the pointer is a finger', () => {
    const map = new FakeMap()
    mount(map)
    act(() => {
      map.emit('touchstart')
    })
    moveOver(map, 'FR')

    expect(
      screen.getByTestId('surface-host').querySelector('article'),
    ).toBeNull()
  })

  it('stands down once the layer has faded past its interactive ceiling', () => {
    const map = new FakeMap()
    mount(map)
    map.zoom = 6
    act(() => {
      map.emit('zoom')
    })
    moveOver(map, 'FR')

    expect(
      screen.getByTestId('surface-host').querySelector('article'),
    ).toBeNull()
  })

  it('does not say the same country twice while its panel is open', () => {
    const map = new FakeMap()
    mount(map, { selectedCode: 'FR', selectionToken: 1 })
    moveOver(map, 'FR')

    const host = screen.getByTestId('surface-host')
    expect(host.querySelectorAll('[data-part="country-hover"]')).toHaveLength(0)
    expect(host.querySelectorAll('[data-part="country-panel"]')).toHaveLength(1)
  })
})

describe('CountryOverlay panel', () => {
  it('carries the same facts as the hover card plus both writes', () => {
    const map = new FakeMap()
    mount(map, { selectedCode: 'FR', selectionToken: 1 })

    const panel = screen.getByRole('dialog', { name: 'France' })
    expect(panel.textContent).toContain('12')
    expect(panel.textContent).toContain('September 2026')
    expect(
      within(panel).getByRole('button', {
        name: /^Remove France from your atlas/,
      }),
    ).toBeTruthy()
    expect(
      within(panel).getByRole('button', { name: /^Add to list/ }),
    ).toBeTruthy()
  })

  it('says the same about a visit-only country as the hover card does', () => {
    const map = new FakeMap()
    mount(map, {
      countries: [FRANCE, UNITED_STATES],
      selectedCode: 'US',
      selectionToken: 1,
    })

    const panel = screen.getByRole('dialog', { name: 'United States' })
    const card = panel.querySelector('article')
    expect(card?.dataset.record).toBe('visits')
    expect(
      [...(card?.querySelectorAll('dt, dd') ?? [])].map(
        (node) => node.textContent,
      ),
    ).toEqual([
      'Visits',
      '2',
      'Workspace places',
      '0',
      'First visit',
      'August 2016',
      'Last visit',
      'March 2023',
    ])
    // And still both writes, because a visit recorded by hand is exactly the
    // thing a reader might want to take back.
    expect(
      within(panel).getByRole('button', {
        name: /^Remove United States from your atlas/,
      }),
    ).toBeTruthy()
    expect(
      within(panel).getByRole('button', { name: /^Add to list/ }),
    ).toBeTruthy()
  })

  /**
   * The panel stays inside the slice it was given.
   *
   * Radix renders a dialog through a portal to `document.body` by default, and
   * a panel that took that default would leave the map's isolated stacking
   * context entirely — landing over the app header and, on a phone, over the
   * tab bar, whatever tier its own layer claims. The `container` prop is what
   * holds it in; this is the assertion that says the prop is still honoured.
   */
  it('renders into the host layer rather than portalling to the body', () => {
    const map = new FakeMap()
    mount(map, { selectedCode: 'FR', selectionToken: 1 })

    const panel = document.querySelector('[data-part="country-panel"]')
    expect(panel, 'the panel has to be open to be located').not.toBeNull()
    expect(
      screen.getByTestId('surface-host').contains(panel),
      'the panel lives inside the layer the screen gave the overlay',
    ).toBe(true)
    expect(
      document.body.querySelector(':scope > [data-part="country-panel"]'),
      'nothing here portals to the document body, where it would escape the slice',
    ).toBeNull()
  })

  /**
   * One surface family, two moments — asserted as an equality rather than as
   * two separate readings.
   *
   * The defect this prevents is a call site picking four of the eight columns:
   * it compiles, it renders, and it prints an empty state beside a record that
   * is not empty. Reading each surface against its own expected list cannot
   * catch that, because a bridge written twice can be wrong twice in the same
   * way; comparing the two projections can. Both call sites spread
   * `factColumns`, and this is the assertion that says so.
   *
   * Two mounts rather than one because the overlay deliberately stands hover
   * down while the panel for that country is open — the surfaces never coexist
   * for a single code, which is the behaviour asserted two tests above.
   */
  it('projects the same card from the pointer and from the press', () => {
    const project = (surface: Element | null | undefined) => {
      const card = surface?.querySelector('article') ?? null
      if (card === null) return null
      return {
        country: card.getAttribute('data-country'),
        record: card.getAttribute('data-record'),
        visited: card.getAttribute('data-visited'),
        labels: [...card.querySelectorAll('dt')].map((node) =>
          node.textContent.trim(),
        ),
        values: [...card.querySelectorAll('dd')].map((node) =>
          node.textContent.trim(),
        ),
      }
    }

    // The visit-only country, because that is the row whose two shapes the
    // bridge exists to reconcile: trip aggregates flat, visits nested.
    const hovered = new FakeMap()
    const first = mount(hovered, { countries: [FRANCE, UNITED_STATES] })
    moveOver(hovered, 'US', -98, 39)
    const pointed = project(
      screen
        .getByTestId('surface-host')
        .querySelector('[data-part="country-hover"]'),
    )
    expect(
      pointed,
      'the pointer has to have opened a card to compare',
    ).not.toBeNull()
    expect(pointed?.labels).toHaveLength(4)

    first.unmount()

    const pressed = new FakeMap()
    mount(pressed, {
      countries: [FRANCE, UNITED_STATES],
      selectedCode: 'US',
      selectionToken: 1,
    })
    const panel = project(
      screen
        .getByTestId('surface-host')
        .querySelector('[data-part="country-panel"]'),
    )

    expect(
      panel,
      'pointing and pressing are two moments of one surface, not two answers',
    ).toEqual(pointed)
  })

  it('offers both writes for a country with nothing recorded against it', () => {
    const map = new FakeMap()
    mount(map, { selectedCode: 'DZ', selectionToken: 1 })

    const panel = screen.getByRole('dialog', { name: 'Algeria' })
    expect(within(panel).getByText('Not visited')).toBeTruthy()
    expect(
      within(panel).getByRole('button', { name: /^Mark visited/ }),
    ).toBeTruthy()
    expect(
      within(panel).getByRole('button', { name: /^Add to list/ }),
    ).toBeTruthy()
  })

  it('knows a country already on the bucket list, wherever it sits on it', () => {
    const map = new FakeMap()
    mount(map, {
      selectedCode: 'DZ',
      selectionToken: 1,
      bucketList: [
        {
          countryCode: 'DZ',
          id: 'goal-1',
          targetYear: 2027,
          isAchieved: false,
        },
      ],
    })

    const panel = screen.getByRole('dialog', { name: 'Algeria' })
    expect(within(panel).getByText('On the bucket list')).toBeTruthy()
    expect(within(panel).getByText('Aiming for 2027.')).toBeTruthy()
  })

  it('closes on Escape and hands focus back to the map', async () => {
    const user = userEvent.setup()
    const map = new FakeMap()
    mount(map, { selectedCode: 'FR', selectionToken: 1 })

    const panel = screen.getByRole('dialog', { name: 'France' })
    // Onto the panel itself, which is neither of the two wrong answers. Radix's
    // default is the first control in it, and for a country already on the record
    // that is the undo of somebody's travel history under the space bar; the
    // dismissal is the *last* control, so focusing that left the two writes this
    // surface exists for reachable only by tabbing backwards. The container
    // announces the dialog and its country, and a forward Tab walks into the
    // block rather than straight out of the panel.
    expect(document.activeElement).toBe(panel)
    expect(panel.getAttribute('tabindex')).toBe('-1')

    const stops = tabStops(panel)
    expect(
      stops.at(0),
      'and the first thing forwards is a write, not the way out',
    ).toBe(within(panel).getByRole('button', { name: /^Remove France/ }))

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog', { name: 'France' })).toBeNull()
    expect(document.activeElement).toBe(map.getCanvas())
  })

  /**
   * The panel is non-modal, and non-modal has to mean it.
   *
   * Radix hard-wires `loop` on a dialog's focus scope and its focus scope loops
   * on `loop` alone, whether or not the scope is trapped — so a panel that
   * declared itself non-modal still swallowed every Tab press, and the shelf,
   * the search field and the map behind it could not be reached by keyboard at
   * all while it was open.
   */
  it('lets a reader tab out of it in both directions rather than looping', async () => {
    const user = userEvent.setup()
    const map = new FakeMap()
    mount(map, { selectedCode: 'FR', selectionToken: 1 })

    const panel = screen.getByRole('dialog', { name: 'France' })
    const stops = tabStops(panel)
    const first = stops.at(0)
    const last = stops.at(-1)
    expect(first).toBeDefined()
    expect(last).toBeDefined()
    if (first === undefined || last === undefined) return

    last.focus()
    await user.tab()
    expect(panel.contains(document.activeElement)).toBe(false)
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Below the map' }),
    )

    first.focus()
    await user.tab({ shift: true })
    expect(panel.contains(document.activeElement)).toBe(false)
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Above the map' }),
    )

    // And the panel is still open: tabbing away from a non-modal layer is not a
    // dismissal, it is a reader looking at the shelf that says the same thing.
    expect(screen.getByRole('dialog', { name: 'France' })).toBeTruthy()
  })

  it('keeps a Tab press inside it while it is on a control that is not an edge', async () => {
    const user = userEvent.setup()
    const map = new FakeMap()
    mount(map, { selectedCode: 'FR', selectionToken: 1 })

    const panel = screen.getByRole('dialog', { name: 'France' })
    const stops = tabStops(panel)
    const first = stops.at(0)
    expect(stops.length).toBeGreaterThan(2)
    if (first === undefined) return

    first.focus()
    await user.tab()
    expect(panel.contains(document.activeElement)).toBe(true)
  })

  /** Pending actions remain tab stops, so the panel must still let Shift+Tab leave them. */
  it('finds its edge at a control while a write is pending', async () => {
    const user = userEvent.setup()
    const map = new FakeMap()
    // A write that never settles, so the action stays focusable but inert.
    atlas.mark.mockImplementation(() => new Promise(() => {}))
    mount(map, { selectedCode: 'DZ', selectionToken: 1 })

    const panel = screen.getByRole('dialog', { name: 'Algeria' })
    const mark = within(panel).getByRole('button', { name: /^Mark visited/ })
    await user.click(mark)
    expect(tabStops(panel).at(0)).toBe(mark)
    expect(mark.hasAttribute('disabled')).toBe(false)
    expect(mark.getAttribute('aria-disabled')).toBe('true')
    expect(mark.getAttribute('aria-busy')).toBe('true')
    await user.keyboard('{Enter} ')
    expect(atlas.mark).toHaveBeenCalledTimes(1)

    const first = tabStops(panel).at(0)
    expect(first).toBeDefined()
    if (first === undefined) return
    first.focus()
    await user.tab({ shift: true })
    expect(panel.contains(document.activeElement)).toBe(false)
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Above the map' }),
    )
  })

  it('closes from its own control, and opens again when the country is chosen again', async () => {
    const user = userEvent.setup()
    const map = new FakeMap()
    const view = mount(map, { selectedCode: 'FR', selectionToken: 1 })

    const dismiss = screen.getByRole('button', { name: 'Close France' })
    dismiss.focus()
    await user.keyboard('{Enter}')
    expect(screen.queryByRole('dialog', { name: 'France' })).toBeNull()

    // The same country, chosen again: the code never moved, so only the token
    // can tell the overlay this is a fresh request.
    view.rerender(<Harness map={map} selectedCode="FR" selectionToken={2} />)
    expect(screen.getByRole('dialog', { name: 'France' })).toBeTruthy()
  })

  it('reports a press on the map to the screen rather than swallowing it', () => {
    const map = new FakeMap()
    const onSelect = vi.fn()
    mount(map, { onSelect })

    map.hits = [{ id: 'FR' }]
    act(() => {
      map.emit('click', pointerAt(2, 47))
    })
    expect(onSelect).toHaveBeenCalledWith('FR')

    map.hits = []
    act(() => {
      map.emit('click', pointerAt(-30, 20))
    })
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })

  it('is not open at all once the layer has faded past its ceiling', () => {
    const map = new FakeMap()
    map.zoom = 6
    mount(map, { selectedCode: 'FR', selectionToken: 1 })
    expect(screen.queryByRole('dialog', { name: 'France' })).toBeNull()
  })

  it('shows the card skeleton at the card dimensions while the atlas is re-read', () => {
    const map = new FakeMap()
    mount(map, { selectedCode: 'FR', selectionToken: 1, status: 'loading' })

    const panel = screen.getByRole('dialog', { name: 'France' })
    const facts = panel.querySelector('[data-variant="skeleton"]')
    expect(facts?.getAttribute('aria-busy')).toBe('true')
    expect(within(panel).getByText('Loading France')).toBeTruthy()
    // The writes stay live: the press that started the re-read is still in the
    // reader's hand, and hiding its control would take the spinner with it.
    expect(
      within(panel).getByRole('button', { name: /^Add to list/ }),
    ).toBeTruthy()
  })

  it('says the figures did not arrive rather than printing zeroes', () => {
    const map = new FakeMap()
    const onRetry = vi.fn()
    mount(map, {
      selectedCode: 'FR',
      selectionToken: 1,
      status: 'failed',
      onRetry,
    })

    const panel = screen.getByRole('dialog', { name: 'France' })
    expect(panel.querySelector('[data-variant="error"]')).not.toBeNull()
    expect(panel.textContent).toContain('These figures did not load')
    // Activated rather than pointed at: the retry is a real control, and this
    // is the event a keyboard press produces on one.
    const retry = within(panel).getByRole('button', { name: 'Try again' })
    fireEvent.click(retry)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  /**
   * The map's own controls are not "outside".
   *
   * Radix dismisses a layer on a press anywhere else in the document, and the
   * zoom cluster is rendered beside MapLibre's container rather than inside it —
   * so pressing `+` to read a country more closely threw away the panel that was
   * describing it. Nothing but Escape, the panel's own control and the selection
   * going away closes it now.
   */
  it('survives a press on the chrome around the map', async () => {
    const user = userEvent.setup()
    const map = new FakeMap()
    mount(map, { selectedCode: 'FR', selectionToken: 1 })

    const zoom = document.createElement('button')
    zoom.textContent = 'Zoom in'
    document.body.appendChild(zoom)
    try {
      await user.click(zoom)
      expect(screen.queryByRole('dialog', { name: 'France' })).not.toBeNull()
    } finally {
      zoom.remove()
    }
  })

  /**
   * The one surface that is never withdrawn.
   *
   * `visibility: hidden` does not merely conceal a layer — it makes everything
   * inside it unfocusable. The decorative card may take that answer when there
   * is nowhere clear to put it; the panel holds the reader's focus and both
   * writes, and hiding it dropped focus to the document body and left an open
   * dialog no key could reach.
   */
  it('is never hidden, however little room the map leaves it', () => {
    const map = new FakeMap()
    mount(map, { selectedCode: 'FR', selectionToken: 1 })
    moveOver(map, 'DZ', 3, 28)

    const layers = [
      ...document.querySelectorAll('[data-part="country-surface"]'),
    ]
    const panelLayer = layers.find(
      (node) => node.querySelector('[data-part="country-panel"]') !== null,
    )
    const hoverLayer = layers.find(
      (node) => node.querySelector('[data-part="country-hover"]') !== null,
    )
    expect(panelLayer).toBeDefined()
    expect(hoverLayer).toBeDefined()
    expect(panelLayer?.className).not.toContain('invisible')
    expect(hoverLayer?.className).toContain('invisible')
  })

  /**
   * The exit, which the parent used to make unreachable.
   *
   * The open country was derived from the selection, so the commit that closed
   * the surface also stopped rendering the layer holding it: Radix set
   * `data-state="closed"`, and the pop-out it selects had no frame to play in
   * because the whole subtree had already gone. The layer now outlives the
   * dismissal by exactly the exit duration.
   */
  it('leaves rather than blinking out', () => {
    vi.useFakeTimers()
    try {
      const map = new FakeMap()
      mount(map, { selectedCode: 'FR', selectionToken: 1 })

      fireEvent.click(screen.getByRole('button', { name: 'Close France' }))
      const leaving = document.querySelector('[data-part="country-surface"]')
      expect(leaving, 'the layer stays for its exit').not.toBeNull()
      expect(leaving?.getAttribute('data-state')).toBe('closed')

      act(() => {
        vi.advanceTimersByTime(EXIT_MS)
      })
      expect(
        document.querySelector('[data-part="country-surface"]'),
        'and is gone once it has finished',
      ).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('draws nothing at all until the screen has given it a layer to draw in', () => {
    const map = new FakeMap()
    render(
      <MapProvider value={context(map)}>
        <CountryOverlay
          visits={[]}
          countries={[FRANCE]}
          bucketList={[]}
          selectedCode="FR"
          selectionToken={1}
          onSelect={() => {}}
          padding={{ top: 76, right: 60, bottom: 424, left: 16 }}
          container={null}
        />
      </MapProvider>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
