// @vitest-environment jsdom
import * as React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import {
  COUNTRY_CODE_PROPERTY,
  COUNTRY_SOURCE_MAX_ZOOM,
  UNMAPPED_COUNTRY_CODES,
  countryFeatures,
  countrySource,
  hasCountryOutline,
} from '#/lib/map/countries'
import { mapPalette } from '#/lib/map/palette'
import { MAP_LAYER_IDS } from '#/lib/map/style'
import { MapProvider } from '../map-context'
import {
  VISITED_COUNTRY_LAYER_IDS,
  VISITED_COUNTRY_SOURCE_ID,
  VisitedCountries,
} from '../visited-countries'

import type { MapContextValue, MapLibreMap } from '../map-context'
import type { VisitedCountriesProps } from '../visited-countries'
import type { VisitedCountry } from '../types'

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
  readonly queries: Array<{ layers?: ReadonlyArray<string> }> = []
  /** What the next hit test answers with. */
  hits: Array<{ id: unknown }> = []

  private readonly handlers = new Map<
    string,
    Set<(event: FakeMouseEvent) => void>
  >()

  addSource(id: string, source: Record<string, unknown>): void {
    this.ops.push({ kind: 'addSource', id })
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

  emit(type: string, event: FakeMouseEvent = { point: { x: 10, y: 10 } }): void {
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

const VISITS: ReadonlyArray<VisitedCountry> = [
  { countryCode: 'FR', lastVisitedOn: daysAgo(30) },
  { countryCode: 'IT', lastVisitedOn: daysAgo(9 * 365) },
  { countryCode: 'JP', lastVisitedOn: null },
]

/** Every literal colour inside a paint block, so "no hex here" is checkable. */
function hexes(paint: unknown): Array<string> {
  return JSON.stringify(paint).match(/#[0-9a-f]{6}/g) ?? []
}

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

  it('stands the layer down before the outlines outrun their own precision', () => {
    const map = new FakeMap()
    render(tree(map, { visits: VISITS }))

    for (const id of Object.values(VISITED_COUNTRY_LAYER_IDS)) {
      const layer = layerOf(map, id)
      expect(layer.maxzoom).toBe(6)
      // The fade has to reach zero by the same zoom, or the layer would blink
      // out at full strength instead of handing over to the basemap.
      expect(layer.paint?.['fill-opacity'] ?? layer.paint?.['line-opacity'])
        .toEqual(['interpolate', ['linear'], ['zoom'], 4, 1, 6, 0])
    }
  })

  it('sits under the basemap labels when there are labels to sit under', () => {
    const withLabels = new FakeMap()
    withLabels.addBasemapLabels()
    render(tree(withLabels, { visits: VISITS }))
    expect(withLabels.insertedBefore.get(VISITED_COUNTRY_LAYER_IDS.fill)).toBe(
      MAP_LAYER_IDS.labelAnchor,
    )

    // The fallback style ships no label layer at all, and naming a layer that
    // does not exist is an error MapLibre would raise.
    const bare = new FakeMap()
    render(tree(bare, { visits: VISITS }))
    expect(bare.insertedBefore.get(VISITED_COUNTRY_LAYER_IDS.fill)).toBe(
      undefined,
    )
    expect(bare.insertedBefore.get(VISITED_COUNTRY_LAYER_IDS.outline)).toBe(
      undefined,
    )
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
    expect(map.queries.at(-1)?.layers).toEqual([
      VISITED_COUNTRY_LAYER_IDS.fill,
    ])
  })

  it('clears the selection when the click lands on open water', () => {
    const map = new FakeMap()
    const onSelect = vi.fn()
    render(tree(map, { visits: VISITS, onSelect }))

    map.hits = []
    map.emit('click')
    expect(onSelect).toHaveBeenCalledWith(null)
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
      { source: VISITED_COUNTRY_SOURCE_ID, id: 'FR', state: { selected: true } },
    ])

    rerender(tree(map, { visits: VISITS, selectedCode: 'IT' }))
    expect(map.featureStates.slice(1)).toEqual([
      {
        source: VISITED_COUNTRY_SOURCE_ID,
        id: 'FR',
        state: { selected: false },
      },
      { source: VISITED_COUNTRY_SOURCE_ID, id: 'IT', state: { selected: true } },
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
})
