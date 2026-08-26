// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'

import {
  COUNTRY_CODE_PROPERTY,
  COUNTRY_DETAIL_URL,
  COUNTRY_SOURCE_MAX_ZOOM,
  UNMAPPED_COUNTRY_CODES,
  countryFeatures,
  countrySource,
  hasCountryOutline,
} from '#/lib/map/countries'
import { mapPalette } from '#/lib/map/palette'
import { FALLBACK_LAYER_IDS, MAP_LAYER_IDS } from '#/lib/map/style'
import { MapProvider } from '../map-context'
import {
  VISITED_COUNTRY_LAYER_IDS,
  VISITED_COUNTRY_SOURCE_ID,
  VISITED_COUNTRY_ZOOM,
  VisitedCountries,
  useCountryDetail,
} from '../visited-countries'

import type { countryDetail } from '#/lib/map/countries'
import type { MapContextValue, MapLibreMap } from '../map-context'
import type { VisitedCountriesProps } from '../visited-countries'
import type { MapVisitedCountry } from '../types'

/**
 * The same fake-Map recorder the rest of the map suite uses, extended with the
 * source, layer, feature-state and hit-test calls this layer makes.
 *
 * No `vi.mock('maplibre-gl')` here, unlike `map-canvas.test.tsx`: this component
 * imports the library for its types only, so there is nothing to replace at
 * runtime. What it does need is a map whose style can be *dropped* the way a
 * theme switch drops one, which is the case the recorder exists for.
 */

interface LayerRecord {
  readonly id: string
  readonly type: string
  readonly source?: string
  readonly maxzoom?: number
  readonly paint?: Record<string, unknown>
}

type Op =
  | { readonly kind: 'addSource'; readonly id: string }
  | { readonly kind: 'addLayer'; readonly id: string }
  | { readonly kind: 'removeLayer'; readonly id: string }
  | { readonly kind: 'removeSource'; readonly id: string }

interface FeatureStateCall {
  readonly source: string
  readonly id: string
  readonly state: Record<string, unknown>
}

interface PaintCall {
  readonly id: string
  readonly property: string
}

interface FakeMouseEvent {
  readonly point: { readonly x: number; readonly y: number }
}

/** What `getSource` hands back: enough of a GeoJSON source to record `setData`. */
class FakeSource {
  readonly definition: Record<string, unknown>
  data: unknown
  setDataCalls = 0

  constructor(definition: Record<string, unknown>) {
    this.definition = definition
    this.data = definition.data
  }

  setData(data: unknown): void {
    this.data = data
    this.setDataCalls += 1
  }
}

class FakeMap {
  readonly ops: Array<Op> = []
  readonly sources = new Map<string, FakeSource>()
  readonly layers = new Map<string, LayerRecord>()
  readonly insertedBefore = new Map<string, string | undefined>()
  readonly featureStates: Array<FeatureStateCall> = []
  /** Which layer was recoloured, and on which ramp. */
  readonly paintCalls: Array<PaintCall> = []
  /**
   * The payload behind every `addSource` this map has ever taken.
   *
   * Deliberately *not* cleared by {@link dropStyle}, unlike {@link ops}: the
   * question a theme switch raises is how many times one collection was tiled
   * across the whole toggle, and an `ops` log that starts again with each style
   * document cannot answer it.
   */
  readonly sourceInstalls: Array<unknown> = []
  readonly queries: Array<{ layers?: ReadonlyArray<string> }> = []
  /** What the next hit test answers with. */
  hits: Array<{ id: unknown }> = []
  /** The camera, which decides whether the layer answers a pointer at all. */
  zoom = 1

  private readonly handlers = new Map<
    string,
    Set<(event: FakeMouseEvent) => void>
  >()

  addSource(id: string, source: Record<string, unknown>): void {
    this.ops.push({ kind: 'addSource', id })
    this.sourceInstalls.push(source.data)
    this.sources.set(id, new FakeSource(source))
  }

  getSource(id: string): FakeSource | undefined {
    return this.sources.get(id)
  }

  removeSource(id: string): void {
    this.ops.push({ kind: 'removeSource', id })
    this.sources.delete(id)
  }

  addLayer(layer: LayerRecord, before?: string): void {
    this.ops.push({ kind: 'addLayer', id: layer.id })
    this.layers.set(layer.id, layer)
    this.insertedBefore.set(layer.id, before)
  }

  getLayer(id: string): LayerRecord | undefined {
    return this.layers.get(id)
  }

  removeLayer(id: string): void {
    this.ops.push({ kind: 'removeLayer', id })
    this.layers.delete(id)
  }

  /**
   * The one thing a live layer can be told in place: a new colour ramp.
   *
   * MapLibre throws on an unknown layer id rather than ignoring the call, so
   * this does too — a repaint aimed at a layer the style has already taken away
   * is the bug, not something to swallow.
   */
  setPaintProperty(id: string, property: string, value: unknown): void {
    const layer = this.layers.get(id)
    if (layer === undefined) throw new Error(`no ${id} layer to paint`)
    this.paintCalls.push({ id, property })
    this.layers.set(id, {
      ...layer,
      paint: { ...layer.paint, [property]: value },
    })
  }

  setFeatureState(
    target: { source: string; id: string },
    state: Record<string, unknown>,
  ): void {
    this.featureStates.push({ source: target.source, id: target.id, state })
  }

  queryRenderedFeatures(
    _point: unknown,
    options: { layers?: ReadonlyArray<string> },
  ): Array<{ id: unknown }> {
    this.queries.push(options)
    return this.hits
  }

  getZoom(): number {
    return this.zoom
  }

  on(type: string, handler: (event: FakeMouseEvent) => void): this {
    const set = this.handlers.get(type) ?? new Set()
    set.add(handler)
    this.handlers.set(type, set)
    return this
  }

  off(type: string, handler: (event: FakeMouseEvent) => void): this {
    this.handlers.get(type)?.delete(handler)
    return this
  }

  emit(
    type: string,
    event: FakeMouseEvent = { point: { x: 10, y: 10 } },
  ): void {
    for (const handler of [...(this.handlers.get(type) ?? [])]) handler(event)
  }

  /** How many listeners are still attached, so a leak is visible to a test. */
  listenerCount(): number {
    let total = 0
    for (const set of this.handlers.values()) total += set.size
    return total
  }

  /** Everything a real `setStyle` takes with it when the theme changes. */
  dropStyle(): void {
    this.sources.clear()
    this.layers.clear()
    this.ops.length = 0
  }

  /** Pretends the vector basemap is up, so there are labels to insert under. */
  addBasemapLabels(): void {
    this.layers.set(MAP_LAYER_IDS.labelAnchor, {
      id: MAP_LAYER_IDS.labelAnchor,
      type: 'symbol',
    })
  }

  /** The no-archive style: sea, land, a coast hairline, then the graticule. */
  addFallbackGround(): void {
    for (const id of [
      FALLBACK_LAYER_IDS.background,
      FALLBACK_LAYER_IDS.land,
      FALLBACK_LAYER_IDS.coast,
      FALLBACK_LAYER_IDS.graticule,
      FALLBACK_LAYER_IDS.graticuleMajor,
    ]) {
      this.layers.set(id, { id, type: 'line' })
    }
  }
}

function context(
  map: FakeMap,
  overrides: Partial<MapContextValue> = {},
): MapContextValue {
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
    ...overrides,
  }
}

function tree(
  map: FakeMap,
  props: VisitedCountriesProps,
  overrides: Partial<MapContextValue> = {},
): React.ReactElement {
  return (
    <MapProvider value={context(map, overrides)}>
      <VisitedCountries {...props} />
    </MapProvider>
  )
}

const DAY_MS = 86_400_000

/** A day, relative to the moment the suite runs, so no case waits on the clock. */
function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10)
}

const VISITS: ReadonlyArray<MapVisitedCountry> = [
  { countryCode: 'FR', lastVisitedOn: daysAgo(30) },
  { countryCode: 'IT', lastVisitedOn: daysAgo(9 * 365) },
  { countryCode: 'JP', lastVisitedOn: null },
]

/** Every literal colour inside a paint block, so "no hex here" is checkable. */
function hexes(paint: unknown): Array<string> {
  return JSON.stringify(paint).match(/#[0-9a-f]{6}/g) ?? []
}

/** Which ramps were recoloured in place, as `layer.property`. */
function repaints(map: FakeMap): Array<string> {
  return map.paintCalls.map((call) => `${call.id}.${call.property}`)
}

/** The three outline weights at one end of the zoom ramp. */
interface OutlineStep {
  readonly rest: number
  readonly hover: number
  readonly selected: number
}

/**
 * The hairline weights, read back out of the layer's own `line-width`.
 *
 * Zoom has to be the input of the *outer* `interpolate`, so the state branch is
 * evaluated at each stop rather than wrapping the interpolation — which means
 * the widths are only reachable by walking the expression the way MapLibre
 * would. Reading them from the layer rather than from a constant is the point:
 * a test that imported the table would pass on a layer painted with something
 * else entirely.
 */
function outlineWidths(map: FakeMap): {
  readonly stops: Array<number>
  readonly near: OutlineStep
  readonly far: OutlineStep
} {
  const width = layerOf(map, VISITED_COUNTRY_LAYER_IDS.outline).paint?.[
    'line-width'
  ] as [string, unknown, unknown, number, unknown, number, unknown]
  const [operator, , input, nearZoom, nearCase, farZoom, farCase] = width
  expect(operator).toBe('interpolate')
  expect(input).toEqual(['zoom'])

  const step = (branch: unknown): OutlineStep => {
    const [, , selected, , hover, rest] = branch as [
      string,
      unknown,
      number,
      unknown,
      number,
      number,
    ]
    return { rest, hover, selected }
  }
  return {
    stops: [nearZoom, farZoom],
    near: step(nearCase),
    far: step(farCase),
  }
}

/** The two colour ramps a theme switch has to move, and nothing else. */
const COLOUR_RAMPS = [
  `${VISITED_COUNTRY_LAYER_IDS.fill}.fill-color`,
  `${VISITED_COUNTRY_LAYER_IDS.outline}.line-color`,
]

interface DataFeature {
  readonly id: unknown
  readonly geometry: unknown
  readonly properties: Record<string, unknown>
}

/** The payload the layer handed to the source, as features by ISO code. */
function featuresOf(data: unknown): Map<string, DataFeature> {
  const collection = data as { features: ReadonlyArray<DataFeature> }
  const table = new Map<string, DataFeature>()
  for (const feature of collection.features) {
    table.set(String(feature.id), feature)
  }
  return table
}

function sourceOf(map: FakeMap): FakeSource {
  const source = map.getSource(VISITED_COUNTRY_SOURCE_ID)
  if (source === undefined) throw new Error('the source was never added')
  return source
}

function layerOf(map: FakeMap, id: string): LayerRecord {
  const layer = map.getLayer(id)
  if (layer === undefined) throw new Error(`the ${id} layer was never added`)
  return layer
}

/* ------------------------------------------------------------------ network */

/** The repository root, resolved from this file so the run directory is free. */
const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
)

/**
 * The finer cut as it is committed, not as a fixture.
 *
 * The swap is only worth testing against the bytes the browser will actually be
 * served: a hand-written stub would agree with whatever the decoder does, and
 * the whole point of the assertions below is that France really does arrive
 * carrying Guadeloupe and Réunion on one feature.
 */
const DETAIL_ASSET = readFileSync(
  resolve(REPO_ROOT, `public${COUNTRY_DETAIL_URL}`),
  'utf8',
)

/**
 * Replaces the network for the duration of one test, and records what was asked
 * for.
 *
 * The layer reaches the asset through `loadCountryDetail()`'s default fetcher —
 * there is no prop to inject one through, because a component that took its own
 * transport would be a component a screen could wire up wrongly. So the global
 * is what a test controls, which is also the only honest stand-in for "the
 * network did not answer".
 */
function stubFetch(answer: (url: string) => Promise<Response>): Array<string> {
  const asked: Array<string> = []
  vi.stubGlobal('fetch', (url: string) => {
    asked.push(url)
    return answer(url)
  })
  return asked
}

/** A network that is simply not there, which is the default every test gets. */
function offline(): Array<string> {
  return stubFetch(() => Promise.reject(new Error('no network in this test')))
}

/** A network that serves the committed asset. */
function serveDetail(): Array<string> {
  return stubFetch(() => Promise.resolve(new Response(DETAIL_ASSET)))
}

/**
 * A network that has taken the request and not answered it yet.
 *
 * The slow case and the failed case are one requirement — the reader is given a
 * whole map either way — but they are not one code path, and a request left in
 * flight is the one a real reader on a train meets. `deliver` closes it, so a
 * test can assert about the map both before and after the wait.
 */
function deferDetail(): {
  readonly asked: Array<string>
  readonly deliver: () => void
} {
  let answer: (() => void) | null = null
  const asked = stubFetch(
    () =>
      new Promise<Response>((resolve_) => {
        answer = () => {
          resolve_(new Response(DETAIL_ASSET))
        }
      }),
  )
  return {
    asked,
    deliver: () => {
      if (answer === null) throw new Error('nothing has asked for the cut yet')
      answer()
    },
  }
}

/**
 * Let the finer-cut request settle, and let React commit what it caused.
 *
 * A macrotask rather than a microtask flush: the request, the decode and the
 * `useSyncExternalStore` notification are three separate turns, and draining the
 * queue once would land between them.
 */
async function settleDetail(): Promise<void> {
  await act(async () => {
    await new Promise((resolve_) => {
      setTimeout(resolve_, 0)
    })
  })
}

/** Every console channel a stray diagnostic could reach the reader through. */
const CONSOLE_CHANNELS = ['debug', 'error', 'info', 'log', 'warn'] as const

/** Silences the console and hands back everything it was asked to say. */
function watchConsole(): () => Array<string> {
  const said: Array<string> = []
  for (const channel of CONSOLE_CHANNELS) {
    vi.spyOn(console, channel).mockImplementation((...args: Array<unknown>) => {
      said.push(`${channel}: ${args.map(String).join(' ')}`)
    })
  }
  return () => said
}

/**
 * The slice of `#/lib/map/countries` a fresh module instance is read through.
 *
 * Spelled out rather than taken wholesale, because naming the answers that move
 * when the finer cut installs is the useful documentation — and because the
 * repo forbids `typeof import()` annotations.
 */
interface FreshCountries {
  readonly COUNTRY_DETAIL_URL: string
  readonly countryDetail: typeof countryDetail
  readonly countryFeatures: typeof countryFeatures
  readonly hasCountryOutline: typeof hasCountryOutline
}

/** Every longitude one feature's geometry touches. */
function longitudesOf(geometry: unknown): Array<number> {
  const { coordinates } = geometry as {
    coordinates: Array<Array<Array<[number, number]>>>
  }
  const found: Array<number> = []
  for (const polygon of coordinates) {
    for (const ring of polygon) {
      for (const [lng] of ring) found.push(lng)
    }
  }
  return found
}

/** How many rings one feature's geometry is made of. */
function ringCount(geometry: unknown): number {
  const { coordinates } = geometry as {
    coordinates: Array<Array<Array<[number, number]>>>
  }
  let rings = 0
  for (const polygon of coordinates) rings += polygon.length
  return rings
}

/**
 * What the finer-cut request was asked for, in the test currently running.
 *
 * Every test starts {@link offline}: the bundled world is the one this suite is
 * mostly about, and a unit test that reaches a real origin is a unit test that
 * fails on an aeroplane. The cases that want the upgrade turn the network on
 * themselves.
 */
let detailRequests: Array<string> = []

beforeEach(() => {
  detailRequests = offline()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('VisitedCountries', () => {
  it('adds the country source and its two layers, and draws no DOM of its own', () => {
    const map = new FakeMap()
    const { container } = render(tree(map, { visits: VISITS }))

    expect(container.innerHTML).toBe('')
    expect(map.ops).toEqual([
      { kind: 'addSource', id: VISITED_COUNTRY_SOURCE_ID },
      { kind: 'addLayer', id: VISITED_COUNTRY_LAYER_IDS.fill },
      { kind: 'addLayer', id: VISITED_COUNTRY_LAYER_IDS.outline },
    ])
    expect(layerOf(map, VISITED_COUNTRY_LAYER_IDS.fill).type).toBe('fill')
    expect(layerOf(map, VISITED_COUNTRY_LAYER_IDS.outline).type).toBe('line')
  })

  it('waits for the style before touching it', () => {
    const map = new FakeMap()
    render(tree(map, { visits: VISITS }, { ready: false }))
    expect(map.ops).toEqual([])
    expect(map.listenerCount()).toBe(0)
  })

  it('hands MapLibre a fresh source object rather than the frozen definition', () => {
    const map = new FakeMap()
    render(tree(map, { visits: VISITS }))
    const definition = sourceOf(map).definition

    // `Style.addSource` writes `collectResourceTiming` onto the object it is
    // given before it builds the tile manager. Against the memoised definition
    // that write throws under ESM strict mode, which is the whole reason the
    // call site spreads.
    expect(() =>
      Object.assign(countrySource(), { collectResourceTiming: true }),
    ).toThrow(TypeError)
    expect(Object.isFrozen(definition)).toBe(false)
    expect(definition).not.toBe(countrySource())
    expect(() =>
      Object.assign(definition, { collectResourceTiming: true }),
    ).not.toThrow()
  })

  it('keeps the string feature ids addressable by promoting the code property', () => {
    const map = new FakeMap()
    render(tree(map, { visits: VISITS }))
    const definition = sourceOf(map).definition

    // Without this, MapLibre coerces 'FR' through parseInt: every country lands
    // on feature id 0 and feature-state lights the wrong one.
    expect(definition.promoteId).toBe(COUNTRY_CODE_PROPERTY)
    expect(definition.maxzoom).toBe(COUNTRY_SOURCE_MAX_ZOOM)
    expect(definition.type).toBe('geojson')
  })

  it('encodes the record in the feature properties, sharing the bundled geometry', () => {
    const map = new FakeMap()
    render(tree(map, { visits: VISITS }))
    const features = featuresOf(sourceOf(map).data)

    expect(features.get('FR')?.properties).toEqual({
      code: 'FR',
      visited: true,
      ramp: 'visitedRecent',
    })
    expect(features.get('IT')?.properties.ramp).toBe('visitedDistant')
    // No date on the record is the middle stop, never a fourth colour.
    expect(features.get('JP')?.properties.ramp).toBe('visited')
    expect(features.get('DE')?.properties).toEqual({
      code: 'DE',
      visited: false,
      ramp: 'visited',
    })

    // Handed through by reference: the payload costs objects, not coordinates.
    const bundled = countryFeatures().features.find(
      (feature) => feature.id === 'FR',
    )
    expect(features.get('FR')?.geometry).toBe(bundled?.geometry)
    expect(features.size).toBe(countryFeatures().features.length)
  })

  it('matches a lower-case code from the record against the geometry', () => {
    const map = new FakeMap()
    render(tree(map, { visits: [{ countryCode: 'pt', lastVisitedOn: null }] }))
    expect(featuresOf(sourceOf(map).data).get('PT')?.properties.visited).toBe(
      true,
    )
  })

  it('carries a country the bundled cut cannot draw without losing the rest', () => {
    const undrawable = UNMAPPED_COUNTRY_CODES[0]
    expect(hasCountryOutline(undrawable)).toBe(false)

    const map = new FakeMap()
    render(
      tree(map, {
        visits: [...VISITS, { countryCode: undrawable, lastVisitedOn: null }],
      }),
    )

    const features = featuresOf(sourceOf(map).data)
    expect(features.has(undrawable)).toBe(false)
    expect(features.get('FR')?.properties.visited).toBe(true)
  })

  it('takes every colour it paints with from the country group of the palette', () => {
    const map = new FakeMap()
    render(tree(map, { visits: VISITS }))
    const country = mapPalette('light').country
    const owned = new Set(Object.values(country))

    const fill = hexes(layerOf(map, VISITED_COUNTRY_LAYER_IDS.fill).paint)
    for (const colour of fill) expect(owned).toContain(colour)
    expect(new Set(fill)).toEqual(
      new Set([
        country.land,
        country.landHover,
        country.visited,
        country.visitedRecent,
        country.visitedDistant,
        country.visitedHover,
        country.visitedSelected,
      ]),
    )

    const outline = hexes(layerOf(map, VISITED_COUNTRY_LAYER_IDS.outline).paint)
    expect(new Set(outline)).toEqual(
      new Set([country.landEdge, country.visitedEdge]),
    )
  })

  it('reads the visited flag from the feature properties, not from a state', () => {
    const map = new FakeMap()
    render(tree(map, { visits: VISITS }))
    const paint = layerOf(map, VISITED_COUNTRY_LAYER_IDS.fill).paint
    expect(JSON.stringify(paint)).toContain('["get","visited"]')
    expect(JSON.stringify(paint)).toContain('["feature-state","hover"]')
    expect(JSON.stringify(paint)).toContain('["feature-state","selected"]')
  })

  it('draws every border at least a whole pixel wide, in three separable steps', () => {
    const map = new FakeMap()
    render(tree(map, { visits: VISITS }))
    const { stops, near, far } = outlineWidths(map)

    // The ramp spans the world view to the zoom the layer stands down at, so
    // the hairline is still growing while the fill fades out from under it.
    expect(stops).toEqual([1, VISITED_COUNTRY_ZOOM.fadeEnd])

    // MapLibre multiplies `line-width` by the device pixel ratio, so anything
    // under 1 is resolved by coverage on a 1x display: the border is blended
    // with the land rather than drawn in `country.landEdge`, and it drops out
    // altogether along a shallow diagonal. Measured over Africa at 1440×900, a
    // half-pixel border averaged 1.33:1 against the land where it landed at
    // all; a whole one carries 47% more border pixels at 1.38:1.
    for (const end of [near, far]) {
      expect(end.rest).toBeGreaterThanOrEqual(1)
      // Each state has to be told apart from the one below it across a whole
      // world at once, so the steps are multiples rather than nudges.
      expect(end.hover).toBeGreaterThanOrEqual(end.rest * 2)
      expect(end.selected).toBeGreaterThan(end.hover)
    }
    // And the far end is heavier than the near one at every state, because by
    // then the outline is the only thing left drawing the country.
    expect(far.rest).toBeGreaterThan(near.rest)
    expect(far.hover).toBeGreaterThan(near.hover)
    expect(far.selected).toBeGreaterThan(near.selected)
  })

  it('stands the layer down before the outlines outrun their own precision', () => {
    const map = new FakeMap()
    render(tree(map, { visits: VISITS }))

    for (const id of Object.values(VISITED_COUNTRY_LAYER_IDS)) {
      const layer = layerOf(map, id)
      expect(layer.maxzoom).toBe(6)
      // The fade has to reach zero by the same zoom, or the layer would blink
      // out at full strength instead of handing over to the basemap.
      expect(
        layer.paint?.['fill-opacity'] ?? layer.paint?.['line-opacity'],
      ).toEqual(['interpolate', ['linear'], ['zoom'], 4, 1, 6, 0])
    }
  })

  it('sits under the basemap labels when there are labels to sit under', () => {
    const withLabels = new FakeMap()
    withLabels.addBasemapLabels()
    render(tree(withLabels, { visits: VISITS }))

    for (const id of Object.values(VISITED_COUNTRY_LAYER_IDS)) {
      expect(withLabels.insertedBefore.get(id)).toBe(MAP_LAYER_IDS.labelAnchor)
    }
  })

  it('sits under the graticule on the style that has no labels at all', () => {
    // The fallback style ships no label layer, and appending on top of it would
    // bury the only cartography it has — the coast hairline and the drafting
    // graticule — under an opaque fill.
    const fallback = new FakeMap()
    fallback.addFallbackGround()
    render(tree(fallback, { visits: VISITS }))

    for (const id of Object.values(VISITED_COUNTRY_LAYER_IDS)) {
      expect(fallback.insertedBefore.get(id)).toBe(FALLBACK_LAYER_IDS.graticule)
    }
  })

  it('appends on top of a style that offers neither anchor', () => {
    // Naming a layer that does not exist is an error MapLibre would raise, so a
    // style neither of ours produced gets the honest guess.
    const bare = new FakeMap()
    render(tree(bare, { visits: VISITS }))

    for (const id of Object.values(VISITED_COUNTRY_LAYER_IDS)) {
      expect(bare.insertedBefore.get(id)).toBe(undefined)
    }
  })

  it('re-adds itself in the new colours after a theme switch replaces the style', () => {
    const map = new FakeMap()
    const { rerender } = render(tree(map, { visits: VISITS }))
    expect(hexes(layerOf(map, VISITED_COUNTRY_LAYER_IDS.fill).paint)).toContain(
      mapPalette('light').country.visited,
    )

    // What `setStyle` really does: the sources and layers added at runtime are
    // simply gone, and the epoch is the only signal that it happened.
    map.dropStyle()
    rerender(tree(map, { visits: VISITS }, { theme: 'dark', styleEpoch: 1 }))

    expect(map.ops).toEqual([
      { kind: 'addSource', id: VISITED_COUNTRY_SOURCE_ID },
      { kind: 'addLayer', id: VISITED_COUNTRY_LAYER_IDS.fill },
      { kind: 'addLayer', id: VISITED_COUNTRY_LAYER_IDS.outline },
    ])
    const repainted = hexes(layerOf(map, VISITED_COUNTRY_LAYER_IDS.fill).paint)
    expect(repainted).toContain(mapPalette('dark').country.visited)
    expect(repainted).not.toContain(mapPalette('light').country.visited)
  })

  it('re-applies the selection after the style is replaced', () => {
    const map = new FakeMap()
    const { rerender } = render(
      tree(map, { visits: VISITS, selectedCode: 'FR' }),
    )
    map.featureStates.length = 0

    map.dropStyle()
    rerender(
      tree(map, { visits: VISITS, selectedCode: 'FR' }, { styleEpoch: 1 }),
    )

    expect(map.featureStates).toContainEqual({
      source: VISITED_COUNTRY_SOURCE_ID,
      id: 'FR',
      state: { selected: true },
    })
  })

  it('recolours in place when the palette changes without a new epoch', () => {
    const map = new FakeMap()
    const { rerender } = render(
      tree(map, { visits: VISITS, selectedCode: 'FR' }),
    )
    const before = map.listenerCount()
    map.ops.length = 0
    map.featureStates.length = 0

    // MapLibre diffs a theme swap into the live style, and there is a commit in
    // between where the palette has changed and the epoch has not. Rebuilding
    // the source in that commit tiles the whole world for a frame `setStyle`
    // then throws away — so colour, and only colour, is applied to the layers
    // that are already on the style.
    rerender(
      tree(map, { visits: VISITS, selectedCode: 'FR' }, { theme: 'dark' }),
    )

    expect(map.ops).toEqual([])
    expect(repaints(map)).toEqual(COLOUR_RAMPS)
    expect(hexes(layerOf(map, VISITED_COUNTRY_LAYER_IDS.fill).paint)).toContain(
      mapPalette('dark').country.visited,
    )
    expect(
      hexes(layerOf(map, VISITED_COUNTRY_LAYER_IDS.fill).paint),
    ).not.toContain(mapPalette('light').country.visited)
    expect(
      hexes(layerOf(map, VISITED_COUNTRY_LAYER_IDS.outline).paint),
    ).toEqual([
      mapPalette('dark').country.visitedEdge,
      mapPalette('dark').country.landEdge,
    ])

    // Nothing else moved. The tiles are the tiles, and the selection is still
    // hanging on the same source it was written to — a recolour cannot disturb
    // feature state, so nothing is cleared and nothing is rewritten.
    expect(sourceOf(map).setDataCalls).toBe(0)
    expect(map.featureStates).toEqual([])
    expect(map.listenerCount()).toBe(before)
  })

  it('keeps a live hover across a recolour, and rebinds it once the style goes', () => {
    const map = new FakeMap()
    const onSelect = vi.fn()
    const { rerender } = render(tree(map, { visits: VISITS, onSelect }))

    map.hits = [{ id: 'FR' }]
    map.emit('mousemove')
    map.featureStates.length = 0

    rerender(tree(map, { visits: VISITS, onSelect }, { theme: 'dark' }))

    // France is still lit on the same source, so the pointer does not blink on
    // its way past a country while the theme catches up.
    map.emit('mousemove')
    expect(map.featureStates).toEqual([])
    map.emit('click')
    expect(onSelect).toHaveBeenCalledWith('FR')

    // The style really going away is the case that *does* drop feature state,
    // and the epoch is what says so: the next move has to write the highlight
    // again, against the source the install effect has just re-added.
    map.dropStyle()
    rerender(
      tree(map, { visits: VISITS, onSelect }, { theme: 'dark', styleEpoch: 1 }),
    )
    map.emit('mousemove')
    expect(map.featureStates).toEqual([
      { source: VISITED_COUNTRY_SOURCE_ID, id: 'FR', state: { hover: true } },
    ])
  })

  it('removes every layer before the source when it goes away', () => {
    const map = new FakeMap()
    const { unmount } = render(tree(map, { visits: VISITS }))
    map.ops.length = 0
    unmount()

    expect(map.ops).toEqual([
      { kind: 'removeLayer', id: VISITED_COUNTRY_LAYER_IDS.outline },
      { kind: 'removeLayer', id: VISITED_COUNTRY_LAYER_IDS.fill },
      { kind: 'removeSource', id: VISITED_COUNTRY_SOURCE_ID },
    ])
    expect(map.listenerCount()).toBe(0)
  })

  it('leaves nothing behind when the style already took the layers with it', () => {
    const map = new FakeMap()
    const { unmount } = render(tree(map, { visits: VISITS }))
    map.dropStyle()

    expect(() => {
      unmount()
    }).not.toThrow()
    expect(map.ops).toEqual([])
  })

  it('reports the country under a click, whatever the hit test repeats', () => {
    const map = new FakeMap()
    const onSelect = vi.fn()
    render(tree(map, { visits: VISITS, onSelect }))

    // One entry per tile the feature crosses, and one per world copy on screen.
    map.hits = [{ id: 'FR' }, { id: 'FR' }, { id: 'FR' }]
    map.emit('click')

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('FR')
    expect(map.queries.at(-1)?.layers).toEqual([VISITED_COUNTRY_LAYER_IDS.fill])
  })

  it('resolves overlapping countries to the one drawn on top', () => {
    const map = new FakeMap()
    const onSelect = vi.fn()
    render(tree(map, { visits: VISITS, onSelect }))

    // Topmost first is MapLibre's own order, and it is the tie-break: two
    // simplified outlines can overlap by a pixel or two along a shared border,
    // and the answer has to be the one the reader sees drawn last. The repeats
    // in between are the same features coming back per tile and per world copy.
    map.hits = [{ id: 'ES' }, { id: 'FR' }, { id: 'ES' }, { id: 'FR' }]
    map.emit('click')
    expect(onSelect).toHaveBeenCalledWith('ES')

    // A foreign id at the top of the stack must not shadow a real answer under
    // it — that would read as open water and clear the selection.
    map.hits = [{ id: 0 }, { id: null }, { id: 'PT' }]
    map.emit('click')
    expect(onSelect).toHaveBeenLastCalledWith('PT')
  })

  it('clears the selection when the click lands on open water', () => {
    const map = new FakeMap()
    const onSelect = vi.fn()
    render(tree(map, { visits: VISITS, onSelect }))

    map.hits = []
    map.emit('click')
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('says nothing about the record once the fill has faded away', () => {
    const map = new FakeMap()
    const onSelect = vi.fn()
    const onHoverChange = vi.fn()
    render(tree(map, { visits: VISITS, onSelect, onHoverChange }))

    map.zoom = VISITED_COUNTRY_ZOOM.interactiveMax + 0.1
    map.hits = [{ id: 'FR' }]
    map.emit('click')
    map.emit('mousemove')

    // Not `null`: at street scale this gesture is a pan on the basemap, and
    // reporting open water would clear a selection a list row or a search result
    // put there. The hit test is not even asked.
    expect(onSelect).not.toHaveBeenCalled()
    expect(onHoverChange).not.toHaveBeenCalled()
    expect(map.queries).toHaveLength(0)
    expect(map.featureStates).toEqual([])
  })

  it('still answers at the last zoom the fill is legible at', () => {
    const map = new FakeMap()
    const onSelect = vi.fn()
    render(tree(map, { visits: VISITS, onSelect }))

    map.zoom = VISITED_COUNTRY_ZOOM.interactiveMax
    map.hits = [{ id: 'IS' }]
    map.emit('click')
    expect(onSelect).toHaveBeenCalledWith('IS')

    // The cut is solved from the fade, not guessed beside it.
    expect(VISITED_COUNTRY_ZOOM.interactiveMax).toBeGreaterThan(
      VISITED_COUNTRY_ZOOM.fadeStart,
    )
    expect(VISITED_COUNTRY_ZOOM.interactiveMax).toBeLessThan(
      VISITED_COUNTRY_ZOOM.fadeEnd,
    )
  })

  it('lets the pointer go when the camera climbs past the fade', () => {
    const map = new FakeMap()
    const onHoverChange = vi.fn()
    render(tree(map, { visits: VISITS, onHoverChange }))

    map.hits = [{ id: 'FR' }]
    map.emit('mousemove')
    expect(onHoverChange).toHaveBeenLastCalledWith('FR')

    map.zoom = VISITED_COUNTRY_ZOOM.fadeEnd + 1
    map.emit('mousemove')
    expect(onHoverChange).toHaveBeenLastCalledWith(null)
    expect(map.featureStates.at(-1)).toEqual({
      source: VISITED_COUNTRY_SOURCE_ID,
      id: 'FR',
      state: { hover: false },
    })
  })

  it('lights exactly one country per pointer move, and lets go of the last', () => {
    const map = new FakeMap()
    const onHoverChange = vi.fn()
    render(tree(map, { visits: VISITS, onHoverChange }))

    map.hits = [{ id: 'FR' }, { id: 'FR' }]
    map.emit('mousemove')
    expect(map.featureStates).toEqual([
      { source: VISITED_COUNTRY_SOURCE_ID, id: 'FR', state: { hover: true } },
    ])
    expect(onHoverChange).toHaveBeenCalledWith('FR')

    // The same country again is not a change, so nothing is re-set.
    map.emit('mousemove')
    expect(map.featureStates).toHaveLength(1)

    map.hits = [{ id: 'IT' }]
    map.emit('mousemove')
    expect(map.featureStates.slice(1)).toEqual([
      { source: VISITED_COUNTRY_SOURCE_ID, id: 'FR', state: { hover: false } },
      { source: VISITED_COUNTRY_SOURCE_ID, id: 'IT', state: { hover: true } },
    ])
  })

  it('calls back once per crossing, however many frames the pointer spends', () => {
    const map = new FakeMap()
    const onHoverChange = vi.fn()
    render(tree(map, { visits: VISITS, onHoverChange }))

    /** One pointer sweep: eight frames of travel without leaving the country. */
    const sweep = (across: number): void => {
      for (let frame = 0; frame < 8; frame += 1) {
        map.emit('mousemove', { point: { x: across + frame, y: 240 } })
      }
    }

    map.hits = [{ id: 'FR' }, { id: 'FR' }]
    sweep(120)
    map.hits = [{ id: 'IT' }]
    sweep(200)
    map.hits = []
    sweep(280)

    // Twenty-four frames of pointer travel, three things worth telling anybody
    // about. This is the whole of the `onHoverChange` contract: a consumer is
    // free to lift the answer into React state, because crossing a border is
    // what fires it and moving the mouse is not. A callback that fired per frame
    // would re-render the atlas — its shelf, its list, its 237-feature payload
    // memo — at the refresh rate of the display.
    expect(onHoverChange.mock.calls).toEqual([['FR'], ['IT'], [null]])
    // And the same restraint on the map: two lights on, two lights off.
    expect(map.featureStates).toEqual([
      { source: VISITED_COUNTRY_SOURCE_ID, id: 'FR', state: { hover: true } },
      { source: VISITED_COUNTRY_SOURCE_ID, id: 'FR', state: { hover: false } },
      { source: VISITED_COUNTRY_SOURCE_ID, id: 'IT', state: { hover: true } },
      { source: VISITED_COUNTRY_SOURCE_ID, id: 'IT', state: { hover: false } },
    ])
    // The hit test itself does run every frame, which is the cheap half of the
    // deal and the reason the expensive half can be skipped.
    expect(map.queries).toHaveLength(24)
  })

  it('drops the hover when the pointer leaves, and when a finger arrives', () => {
    const map = new FakeMap()
    render(tree(map, { visits: VISITS }))
    map.hits = [{ id: 'FR' }]

    map.emit('mousemove')
    map.emit('mouseout')
    expect(map.featureStates.at(-1)).toEqual({
      source: VISITED_COUNTRY_SOURCE_ID,
      id: 'FR',
      state: { hover: false },
    })

    // A tap leaves the last hover lit because nothing takes the pointer away.
    map.emit('mousemove')
    map.emit('touchstart')
    expect(map.featureStates.at(-1)?.state).toEqual({ hover: false })
  })

  it('ignores a hit test answer that is not one of our feature ids', () => {
    const map = new FakeMap()
    const onSelect = vi.fn()
    render(tree(map, { visits: VISITS, onSelect }))

    // A numeric id is what a source without `promoteId` would produce.
    map.hits = [{ id: 0 }, { id: undefined }]
    map.emit('click')
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('paints the selected country through feature-state and releases the last', () => {
    const map = new FakeMap()
    const { rerender } = render(
      tree(map, { visits: VISITS, selectedCode: 'fr' }),
    )
    expect(map.featureStates).toEqual([
      {
        source: VISITED_COUNTRY_SOURCE_ID,
        id: 'FR',
        state: { selected: true },
      },
    ])

    rerender(tree(map, { visits: VISITS, selectedCode: 'IT' }))
    expect(map.featureStates.slice(1)).toEqual([
      {
        source: VISITED_COUNTRY_SOURCE_ID,
        id: 'FR',
        state: { selected: false },
      },
      {
        source: VISITED_COUNTRY_SOURCE_ID,
        id: 'IT',
        state: { selected: true },
      },
    ])
  })

  it('never re-sets the source data to draw a hover or a selection', () => {
    const map = new FakeMap()
    const { rerender } = render(tree(map, { visits: VISITS }))
    const source = sourceOf(map)

    map.hits = [{ id: 'FR' }]
    map.emit('mousemove')
    map.hits = [{ id: 'IT' }]
    map.emit('mousemove')
    map.emit('click')
    rerender(tree(map, { visits: VISITS, selectedCode: 'IT' }))

    // Re-tiling 175 MultiPolygons per pointer move is the failure this layer
    // exists to avoid.
    expect(source.setDataCalls).toBe(0)
  })

  it('sets the source data when the traveller’s record actually changes', () => {
    const map = new FakeMap()
    const { rerender } = render(tree(map, { visits: VISITS }))
    const source = sourceOf(map)

    rerender(tree(map, { visits: VISITS }))
    expect(source.setDataCalls).toBe(0)

    rerender(
      tree(map, {
        visits: [...VISITS, { countryCode: 'IS', lastVisitedOn: daysAgo(10) }],
      }),
    )
    expect(source.setDataCalls).toBe(1)
    expect(featuresOf(source.data).get('IS')?.properties).toEqual({
      code: 'IS',
      visited: true,
      ramp: 'visitedRecent',
    })
  })

  it('writes no feature state to the source it has just removed', () => {
    const map = new FakeMap()
    const { unmount } = render(tree(map, { visits: VISITS }))
    map.hits = [{ id: 'FR' }]
    map.emit('mousemove')
    const written = map.featureStates.length

    unmount()
    // Feature state cannot outlive the source it hangs on, so releasing the
    // hover on the way out would mean addressing a source that is already gone —
    // which MapLibre answers with an error event on the map.
    expect(map.featureStates).toHaveLength(written)
    expect(map.getSource(VISITED_COUNTRY_SOURCE_ID)).toBe(undefined)
  })

  it('draws the bundled world on the first frame, and asks for the finer cut', () => {
    const map = new FakeMap()
    render(tree(map, { visits: VISITS }))

    // Synchronously, in the same commit as the mount: nothing has been fetched,
    // nothing has been awaited, and the reader already has a complete world.
    expect(featuresOf(sourceOf(map).data).size).toBe(
      countryFeatures().features.length,
    )
    expect(sourceOf(map).setDataCalls).toBe(0)
    expect(detailRequests).toEqual([COUNTRY_DETAIL_URL])
  })

  it('asks for the finer cut once, however many maps are on the page', () => {
    render(tree(new FakeMap(), { visits: VISITS }))
    render(tree(new FakeMap(), { visits: VISITS }))

    // `loadCountryDetail` shares one request; a layer that fetched per mount
    // would download 300 KB per map on a screen with two of them.
    expect(detailRequests).toEqual([COUNTRY_DETAIL_URL])
  })

  it('stays a complete, working map when the finer outlines never arrive', async () => {
    const map = new FakeMap()
    const onSelect = vi.fn()
    const onHoverChange = vi.fn()
    const said = watchConsole()
    render(tree(map, { visits: VISITS, onSelect, onHoverChange }))

    await settleDetail()

    // The layer is exactly what it was before the request failed: the bundled
    // world, added once, never re-tiled.
    expect(map.ops).toEqual([
      { kind: 'addSource', id: VISITED_COUNTRY_SOURCE_ID },
      { kind: 'addLayer', id: VISITED_COUNTRY_LAYER_IDS.fill },
      { kind: 'addLayer', id: VISITED_COUNTRY_LAYER_IDS.outline },
    ])
    expect(featuresOf(sourceOf(map).data).size).toBe(
      countryFeatures().features.length,
    )
    expect(sourceOf(map).setDataCalls).toBe(0)

    map.hits = [{ id: 'FR' }]
    map.emit('mousemove')
    expect(onHoverChange).toHaveBeenLastCalledWith('FR')
    expect(map.featureStates).toContainEqual({
      source: VISITED_COUNTRY_SOURCE_ID,
      id: 'FR',
      state: { hover: true },
    })
    map.emit('click')
    expect(onSelect).toHaveBeenCalledWith('FR')

    // Nothing at all in the console. There is no repair a reader could carry
    // out, the map in front of them is whole, and a screen that logs errors
    // nobody can act on teaches everybody to ignore the ones they can.
    expect(said()).toEqual([])
  })

  it('retries the finer cut on the next mount rather than caching the failure', async () => {
    const { unmount } = render(tree(new FakeMap(), { visits: VISITS }))
    await settleDetail()
    unmount()

    render(tree(new FakeMap(), { visits: VISITS }))
    expect(detailRequests).toEqual([COUNTRY_DETAIL_URL, COUNTRY_DETAIL_URL])
  })

  it('leaves a subscriber on the bundled answers when the request fails', async () => {
    const said = watchConsole()
    const seen: Array<unknown> = []

    function Shelf(): null {
      seen.push(useCountryDetail())
      return null
    }

    render(<Shelf />)
    await settleDetail()

    // A screen that subscribes gets exactly what the map got: the bundled world
    // and no announcement, because nothing installed. It re-renders zero extra
    // times, so a failed upgrade cannot cost a pass over a country list either.
    expect(seen).toEqual([null])
    expect(hasCountryOutline('SG')).toBe(false)
    expect(said()).toEqual([])
  })
})

/**
 * The upgrade to the 1:50m cut.
 *
 * Installing the finer outlines is process-wide state in `#/lib/map/countries` —
 * it is fetched once and stays installed for the life of the module, which is
 * exactly what makes it cheap at runtime and leaky in a suite. So every case in
 * here takes a module graph of its own through {@link freshLayer} and the block
 * above keeps asserting about the bundled world it was always asserting about.
 */
describe('VisitedCountries and the finer cut', () => {
  /** The component, the hook, the provider and the geometry, none of them shared. */
  async function freshLayer(): Promise<{
    readonly countries: FreshCountries
    readonly draw: (
      map: FakeMap,
      props: VisitedCountriesProps,
      overrides?: Partial<MapContextValue>,
    ) => React.ReactElement
    /** The same module instance the layer upgrades itself through. */
    readonly subscribe: typeof useCountryDetail
  }> {
    vi.resetModules()
    const countries = await import('#/lib/map/countries')
    const mapContext = await import('../map-context')
    const layer = await import('../visited-countries')

    return {
      countries,
      draw: (map, props, overrides = {}) => (
        <mapContext.MapProvider value={context(map, overrides)}>
          <layer.VisitedCountries {...props} />
        </mapContext.MapProvider>
      ),
      subscribe: layer.useCountryDetail,
    }
  }

  it('replaces the bundled world with one setData, and never re-adds the source', async () => {
    const { countries, draw } = await freshLayer()
    detailRequests = serveDetail()
    const map = new FakeMap()
    render(draw(map, { visits: VISITS }))

    const source = sourceOf(map)
    const bundled = featuresOf(source.data).size
    expect(bundled).toBe(countries.countryFeatures().features.length)

    await settleDetail()

    expect(detailRequests).toEqual([countries.COUNTRY_DETAIL_URL])
    // One re-tile for the whole upgrade, and no source churn: the layers were
    // added once, over a source that was added once and never taken away. A
    // re-added source would have dropped every feature state hanging on it.
    expect(source.setDataCalls).toBe(1)
    expect(map.ops).toEqual([
      { kind: 'addSource', id: VISITED_COUNTRY_SOURCE_ID },
      { kind: 'addLayer', id: VISITED_COUNTRY_LAYER_IDS.fill },
      { kind: 'addLayer', id: VISITED_COUNTRY_LAYER_IDS.outline },
    ])

    const finer = featuresOf(source.data)
    expect(finer.size).toBe(countries.countryDetail()?.manifest.codes)
    expect(finer.size).toBeGreaterThan(bundled)
    // The traveller's record came across with it, unchanged.
    expect(finer.get('FR')?.properties).toEqual({
      code: 'FR',
      visited: true,
      ramp: 'visitedRecent',
    })
    expect(finer.get('DE')?.properties.visited).toBe(false)
  })

  it('is a whole map for as long as the finer cut takes to arrive', async () => {
    const { countries, draw } = await freshLayer()
    const slow = deferDetail()
    detailRequests = slow.asked
    const map = new FakeMap()
    const onHoverChange = vi.fn()
    const onSelect = vi.fn()
    const said = watchConsole()
    render(draw(map, { visits: VISITS, onHoverChange, onSelect }))

    // A turn of the event loop has passed and the request has not answered. On
    // a real connection this is most of a second; there is no spinner, no
    // skeleton and no half-drawn world, because the bundled cut is already on
    // screen and complete.
    await settleDetail()
    expect(detailRequests).toEqual([countries.COUNTRY_DETAIL_URL])
    expect(sourceOf(map).setDataCalls).toBe(0)
    expect(featuresOf(sourceOf(map).data).size).toBe(
      countries.countryFeatures().features.length,
    )

    map.hits = [{ id: 'FR' }]
    map.emit('mousemove')
    expect(onHoverChange).toHaveBeenLastCalledWith('FR')
    map.emit('click')
    expect(onSelect).toHaveBeenCalledWith('FR')

    slow.deliver()
    await settleDetail()

    // The upgrade lands under a pointer that never let go, and costs exactly
    // what it costs when the network is quick: one re-tile, no source churn, and
    // not one feature state rewritten — so France does not blink as its
    // coastline sharpens.
    expect(sourceOf(map).setDataCalls).toBe(1)
    expect(featuresOf(sourceOf(map).data).size).toBe(
      countries.countryDetail()?.manifest.codes,
    )
    expect(map.ops.filter((op) => op.kind === 'removeSource')).toEqual([])
    expect(map.featureStates.at(-1)).toEqual({
      source: VISITED_COUNTRY_SOURCE_ID,
      id: 'FR',
      state: { hover: true },
    })
    // Neither the wait nor the arrival is something the reader is told about.
    expect(said()).toEqual([])
  })

  it('fills a country the bundled cut could not draw at all', async () => {
    const { countries, draw } = await freshLayer()
    detailRequests = serveDetail()
    const visits: ReadonlyArray<MapVisitedCountry> = [
      { countryCode: 'SG', lastVisitedOn: null },
    ]
    const map = new FakeMap()
    render(draw(map, { visits }))

    expect(countries.hasCountryOutline('SG')).toBe(false)
    expect(featuresOf(sourceOf(map).data).has('SG')).toBe(false)

    await settleDetail()

    // Singapore is 50 km² and simply is not in a 1:110m cut. Until the finer
    // outlines land the record can hold it and the map cannot show it.
    expect(countries.hasCountryOutline('SG')).toBe(true)
    expect(featuresOf(sourceOf(map).data).get('SG')?.properties.visited).toBe(
      true,
    )
  })

  it('lights every ring of a country as one shape', async () => {
    const { draw } = await freshLayer()
    detailRequests = serveDetail()
    const map = new FakeMap()
    const onHoverChange = vi.fn()
    render(draw(map, { visits: VISITS, onHoverChange }))

    const before = sourceOf(map).data
    const coarse = featuresOf(before).get('FR')?.geometry
    await settleDetail()
    const france = featuresOf(sourceOf(map).data).get('FR')
    if (france === undefined) throw new Error('France left the payload')

    // Natural Earth's Admin 0 is the sovereign cut, so Guadeloupe (61.8°W) and
    // Réunion (55.8°E) are rings of *France*, not countries beside it. That is
    // the whole reason the upgrade is worth its 300 KB: hovering the mainland
    // and hovering an overseas département are the same country.
    const longitudes = longitudesOf(france.geometry)
    expect(Math.min(...longitudes)).toBeLessThan(-60)
    expect(Math.max(...longitudes)).toBeGreaterThan(55)
    expect(ringCount(france.geometry)).toBeGreaterThan(ringCount(coarse))

    // And they are one feature, so one `setFeatureState` lights all of them —
    // however many tiles and world copies the hit test answers from.
    map.hits = [{ id: 'FR' }, { id: 'FR' }, { id: 'FR' }, { id: 'FR' }]
    map.emit('mousemove')
    expect(map.featureStates).toEqual([
      { source: VISITED_COUNTRY_SOURCE_ID, id: 'FR', state: { hover: true } },
    ])
    expect(onHoverChange).toHaveBeenCalledTimes(1)
    expect(onHoverChange).toHaveBeenCalledWith('FR')
  })

  it('keeps the hover and the selection lit across the swap', async () => {
    const { draw } = await freshLayer()
    detailRequests = serveDetail()
    const map = new FakeMap()
    render(draw(map, { visits: VISITS, selectedCode: 'FR' }))

    map.hits = [{ id: 'IT' }]
    map.emit('mousemove')
    map.featureStates.length = 0

    await settleDetail()

    // Feature state is held on the source cache and re-initialised onto every
    // tile as it reloads, so a `setData` keeps it — provided the ids match, which
    // is what `promoteId` on both payloads guarantees. Nothing is rewritten and
    // nothing is dropped, so the pointer does not blink at the moment the finer
    // coastlines arrive under it.
    expect(map.featureStates).toEqual([])
    expect(sourceOf(map).setDataCalls).toBe(1)
    expect(map.ops.filter((op) => op.kind === 'removeSource')).toEqual([])
  })

  it('tiles the finer cut once for a theme switch, across both of its commits', async () => {
    const { draw } = await freshLayer()
    detailRequests = serveDetail()
    const map = new FakeMap()
    const { rerender } = render(draw(map, { visits: VISITS }))
    await settleDetail()

    const built = sourceOf(map).data
    expect(sourceOf(map).setDataCalls).toBe(1)
    expect(map.sourceInstalls).toHaveLength(1)
    map.ops.length = 0

    // A light/dark toggle reaches this layer as *two* commits, and the first one
    // is the trap. React re-renders with the new palette while MapLibre is still
    // holding the old style document, because `setStyle` is called from the
    // canvas above and `style.load` is a frame or two away. Anything rebuilt
    // here is thrown away by that swap — so 50,413 vertices are not re-tiled to
    // change two colours.
    rerender(draw(map, { visits: VISITS }, { theme: 'dark' }))

    expect(map.ops).toEqual([])
    expect(map.sourceInstalls).toHaveLength(1)
    expect(repaints(map)).toEqual(COLOUR_RAMPS)

    // The second commit is the real one: `setStyle` has landed, every runtime
    // source, layer and feature state is gone with the old style document, and
    // the epoch is the only signal that it happened.
    map.dropStyle()
    rerender(draw(map, { visits: VISITS }, { theme: 'dark', styleEpoch: 1 }))

    const readded = sourceOf(map)
    expect(map.ops).toEqual([
      { kind: 'addSource', id: VISITED_COUNTRY_SOURCE_ID },
      { kind: 'addLayer', id: VISITED_COUNTRY_LAYER_IDS.fill },
      { kind: 'addLayer', id: VISITED_COUNTRY_LAYER_IDS.outline },
    ])
    // One install for the mount and one for the toggle. A third would be the
    // discarded commit above paying full price for a frame nobody sees.
    expect(map.sourceInstalls).toHaveLength(2)
    // The identical object, not an equal one: the collection is memoised on the
    // payload and the record, neither of which a theme touches. Rebuilding it
    // would walk 237 features to hand back the same world in different colours.
    expect(map.sourceInstalls.at(-1)).toBe(built)
    expect(readded.data).toBe(built)
    // And it went in carrying that world, so nothing re-tiles behind the swap.
    expect(readded.setDataCalls).toBe(0)
    // Fetched once, therefore decoded once: the payload is process state, not
    // component state, and a second style epoch cannot pay for it again.
    expect(detailRequests).toEqual([COUNTRY_DETAIL_URL])

    // Re-added under the finer cut's own terms — string ids still addressable,
    // same zoom ceiling — and already wearing the theme that caused the epoch,
    // so there is no second recolour behind the install either.
    expect(readded.definition.promoteId).toBe(COUNTRY_CODE_PROPERTY)
    expect(readded.definition.maxzoom).toBe(COUNTRY_SOURCE_MAX_ZOOM)
    expect(repaints(map)).toEqual(COLOUR_RAMPS)
    expect(hexes(layerOf(map, VISITED_COUNTRY_LAYER_IDS.fill).paint)).toContain(
      mapPalette('dark').country.visited,
    )
    expect(
      hexes(layerOf(map, VISITED_COUNTRY_LAYER_IDS.fill).paint),
    ).not.toContain(mapPalette('light').country.visited)
  })

  it('keeps the record and the offshore rings across a theme switch', async () => {
    const { draw } = await freshLayer()
    detailRequests = serveDetail()
    const map = new FakeMap()
    const onHoverChange = vi.fn()
    const { rerender } = render(
      draw(map, { visits: VISITS, selectedCode: 'IT', onHoverChange }),
    )
    await settleDetail()

    map.dropStyle()
    rerender(
      draw(
        map,
        { visits: VISITS, selectedCode: 'IT', onHoverChange },
        { theme: 'dark', styleEpoch: 1 },
      ),
    )

    // The world that came back is the finer one, with France still carrying
    // Guadeloupe and Réunion on a single feature — so one `setFeatureState`
    // still lights every ring of it, however many tiles the hit test answers
    // from, and however many times the reader has toggled the theme.
    const france = featuresOf(sourceOf(map).data).get('FR')
    if (france === undefined) throw new Error('France left the payload')
    const longitudes = longitudesOf(france.geometry)
    expect(Math.min(...longitudes)).toBeLessThan(-60)
    expect(Math.max(...longitudes)).toBeGreaterThan(55)
    expect(france.properties.visited).toBe(true)

    map.featureStates.length = 0
    map.hits = [{ id: 'FR' }, { id: 'FR' }, { id: 'FR' }]
    map.emit('mousemove')
    expect(map.featureStates).toEqual([
      { source: VISITED_COUNTRY_SOURCE_ID, id: 'FR', state: { hover: true } },
    ])
    expect(onHoverChange).toHaveBeenCalledTimes(1)
    expect(onHoverChange).toHaveBeenCalledWith('FR')
  })

  it('holds the fade, the hit-test ceiling and the layer ceiling where they were', async () => {
    const { draw } = await freshLayer()
    detailRequests = serveDetail()
    const map = new FakeMap()
    const onSelect = vi.fn()
    render(draw(map, { visits: VISITS, onSelect }))
    await settleDetail()

    // The finer cut is simplified at 0.02° and would carry two more zoom levels
    // on the same arithmetic. Spending them would make the interactive range
    // depend on whether one fetch succeeded, so the range stays solved from the
    // coarsest payload this layer can be showing — the bundled one.
    for (const id of Object.values(VISITED_COUNTRY_LAYER_IDS)) {
      const layer = layerOf(map, id)
      expect(layer.maxzoom).toBe(VISITED_COUNTRY_ZOOM.fadeEnd)
      expect(
        layer.paint?.['fill-opacity'] ?? layer.paint?.['line-opacity'],
      ).toEqual(['interpolate', ['linear'], ['zoom'], 4, 1, 6, 0])
    }
    expect(VISITED_COUNTRY_ZOOM).toEqual({
      fadeStart: 4,
      fadeEnd: 6,
      interactiveMax: 5.6,
    })

    map.zoom = VISITED_COUNTRY_ZOOM.interactiveMax
    map.hits = [{ id: 'SG' }]
    map.emit('click')
    expect(onSelect).toHaveBeenLastCalledWith('SG')

    // Past the ceiling the three-state answer is still silence, not water.
    map.zoom = VISITED_COUNTRY_ZOOM.interactiveMax + 0.1
    onSelect.mockClear()
    map.emit('click')
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('tells a screen outside the map that the derived answers moved', async () => {
    const { countries, draw, subscribe } = await freshLayer()
    detailRequests = serveDetail()
    const passes: Array<string> = []

    /** What an atlas shelf really writes: one memo over `hasCountryOutline`. */
    function Shelf({ codes }: { readonly codes: ReadonlyArray<string> }): null {
      const detail = subscribe()
      const rows = React.useMemo(
        () =>
          codes
            .map(
              (code) =>
                `${code}:${countries.hasCountryOutline(code) ? 'drawn' : 'absent'}`,
            )
            .join(' '),
        // The install is the whole reason this dependency is here. Keyed on the
        // record alone, the memo resolves once against the bundled cut and then
        // contradicts the map — a list row offering nothing to frame for a
        // country the fill layer is busy filling.
        [codes, detail],
      )
      passes.push(rows)
      return null
    }

    const map = new FakeMap()
    render(
      <>
        {draw(map, { visits: VISITS })}
        <Shelf codes={['SG', 'MT', 'FR']} />
      </>,
    )

    expect(passes).toEqual(['SG:absent MT:absent FR:drawn'])

    await settleDetail()

    // One further pass, not one per frame: a subscription over process state,
    // and the same single request the layer itself rode on.
    expect(passes).toEqual([
      'SG:absent MT:absent FR:drawn',
      'SG:drawn MT:drawn FR:drawn',
    ])
    expect(detailRequests).toEqual([countries.COUNTRY_DETAIL_URL])
    // And the shelf now agrees with what the map is drawing.
    expect(featuresOf(sourceOf(map).data).has('SG')).toBe(true)
  })

  it('hands a subscriber the installed cut without asking for it again', async () => {
    const { countries, draw, subscribe } = await freshLayer()
    detailRequests = serveDetail()
    const seen: Array<unknown> = []

    function Shelf(): null {
      seen.push(subscribe())
      return null
    }

    render(draw(new FakeMap(), { visits: VISITS }))
    await settleDetail()
    render(<Shelf />)

    // Mounted after the cut landed: the first render already has it, because
    // `countryDetail()` is the synchronous half of the store. No flash of the
    // bundled answer, and no second 300 KB request for a payload the process is
    // already holding.
    expect(seen).toEqual([countries.countryDetail()])
    expect(seen[0]).not.toBe(null)
    expect(detailRequests).toEqual([countries.COUNTRY_DETAIL_URL])
  })
})
