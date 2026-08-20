import { describe, expect, it } from 'vitest'

import { MAP_PALETTES } from '../palette'
import { worldLandFeatures } from '../countries'
import {
  BASEMAP_SOURCE_ID,
  FALLBACK_LAYER_IDS,
  GRATICULE_SOURCE_ID,
  GRATICULE_WORLD_OPACITY,
  GRATICULE_WORLD_ZOOM,
  GROUND_FADE_MAX_ZOOM,
  GROUND_MIN_ZOOM,
  MAP_FONT_MEDIUM,
  MAP_FONT_SEMIBOLD,
  MAP_LAYER_IDS,
  WORLD_LAND_SOURCE_ID,
  basemapStyle,
  fallbackStyle,
  mapStyleFor,
} from '../style'

import type { MapStyle } from '../style'
import type { ResolvedTheme } from '#/lib/theme'

const THEMES: ReadonlyArray<ResolvedTheme> = ['light', 'dark']

/** Every string anywhere in a value, so a style can be searched exhaustively. */
function strings(value: unknown, into: Array<string> = []): Array<string> {
  if (typeof value === 'string') {
    into.push(value)
  } else if (Array.isArray(value)) {
    for (const entry of value) strings(entry, into)
  } else if (value !== null && typeof value === 'object') {
    for (const entry of Object.values(value)) strings(entry, into)
  }
  return into
}

function layerIds(style: MapStyle): Array<string> {
  return style.layers.map((layer) => layer.id)
}

function indexOf(style: MapStyle, id: string): number {
  return layerIds(style).indexOf(id)
}

describe('basemapStyle', () => {
  it.each(THEMES)('is a valid v8 style document in %s', (theme) => {
    const style = basemapStyle({ theme })
    expect(style.version).toBe(8)
    expect(style.layers.length).toBeGreaterThan(15)
    expect(Object.keys(style.sources)).toEqual([BASEMAP_SOURCE_ID])
  })

  it.each(THEMES)('gives every layer a unique id in %s', (theme) => {
    const ids = layerIds(basemapStyle({ theme }))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('serves tiles from our own endpoint, never a third party', () => {
    const style = basemapStyle({ theme: 'light' })
    const source = style.sources[BASEMAP_SOURCE_ID]
    expect(source).toMatchObject({
      type: 'vector',
      url: 'pmtiles:///api/tiles/basemap.pmtiles',
    })

    for (const value of strings(style)) {
      expect(value).not.toMatch(/^https?:\/\//)
    }
  })

  it.each(THEMES)(
    'declares no glyph server in %s, so labels rasterise locally in our own font',
    (theme) => {
      // With no `glyphs` URL MapLibre draws every codepoint with TinySDF from the
      // `text-font` stack read as a CSS family — our real Geist, no SDF pack, and
      // no request that can 404 into a console full of per-character warnings.
      expect(basemapStyle({ theme })).not.toHaveProperty('glyphs')
    },
  )

  it('names an explicit archive key and an absolute origin when asked', () => {
    const style = basemapStyle({
      theme: 'dark',
      origin: 'https://planned.travel',
      archive: 'basemaps/planet-2026-08.pmtiles',
    })
    expect(style.sources[BASEMAP_SOURCE_ID]).toMatchObject({
      url: 'pmtiles://https://planned.travel/api/tiles/basemaps/planet-2026-08.pmtiles',
    })
  })

  it('declares no sprite, because the cartography is label-only', () => {
    expect(basemapStyle({ theme: 'light' })).not.toHaveProperty('sprite')
  })

  it.each(THEMES)('draws only colours from the %s palette', (theme) => {
    const palette = MAP_PALETTES[theme]
    const allowed = new Set(
      strings(palette).filter((value) => value.startsWith('#')),
    )
    const used = strings(basemapStyle({ theme })).filter((value) =>
      /^#[0-9a-f]{3,8}$/i.test(value),
    )

    expect(used.length).toBeGreaterThan(20)
    for (const colour of used) {
      expect(allowed).toContain(colour)
    }
  })

  it('paints light and dark as genuinely different cartography', () => {
    const light = strings(basemapStyle({ theme: 'light' })).filter((v) =>
      v.startsWith('#'),
    )
    const dark = strings(basemapStyle({ theme: 'dark' })).filter((v) =>
      v.startsWith('#'),
    )
    expect(light).toHaveLength(dark.length)
    // Not one single colour is shared between the two themes.
    expect(light.filter((colour) => dark.includes(colour))).toEqual([])
  })

  it('orders layers ground → water → roads → type', () => {
    const style = basemapStyle({ theme: 'light' })
    expect(indexOf(style, MAP_LAYER_IDS.background)).toBe(0)
    expect(indexOf(style, MAP_LAYER_IDS.earth)).toBeLessThan(
      indexOf(style, MAP_LAYER_IDS.water),
    )
    expect(indexOf(style, MAP_LAYER_IDS.water)).toBeLessThan(
      indexOf(style, MAP_LAYER_IDS.roads),
    )
    expect(indexOf(style, MAP_LAYER_IDS.roads)).toBeLessThan(
      indexOf(style, MAP_LAYER_IDS.labelAnchor),
    )
    expect(indexOf(style, MAP_LAYER_IDS.labelAnchor)).toBeLessThan(
      indexOf(style, MAP_LAYER_IDS.localityLabels),
    )
  })

  it('draws each road tier as a casing under its fill', () => {
    const ids = layerIds(basemapStyle({ theme: 'light' }))
    for (const tier of [
      'pt-road-minor',
      'pt-road-medium',
      'pt-road-major',
      'pt-road-highway',
    ]) {
      expect(ids).toContain(`${tier}-casing`)
      expect(ids.indexOf(`${tier}-casing`)).toBeLessThan(ids.indexOf(tier))
    }
  })

  it('sets every label in the product UI font', () => {
    const style = basemapStyle({ theme: 'light', poiLabels: true })
    const symbols = style.layers.filter((layer) => layer.type === 'symbol')
    expect(symbols.length).toBeGreaterThan(5)
    for (const layer of symbols) {
      const font = layer.layout?.['text-font']
      expect(font).toBeDefined()
      expect(JSON.stringify(font)).toContain('Geist')
    }
    expect(MAP_FONT_MEDIUM[0]).toBe('Geist Medium')
    expect(MAP_FONT_SEMIBOLD[0]).toBe('Geist SemiBold')
    // Every stack falls back to a face with wide script coverage.
    expect(MAP_FONT_MEDIUM.at(-1)).toBe('Noto Sans Regular')
  })

  it('drops buildings and POI labels when the caller does not want them', () => {
    const bare = layerIds(basemapStyle({ theme: 'light', buildings: false }))
    expect(bare).not.toContain(MAP_LAYER_IDS.buildings)
    expect(bare).not.toContain('pt-label-poi')

    const full = layerIds(basemapStyle({ theme: 'light', poiLabels: true }))
    expect(full).toContain(MAP_LAYER_IDS.buildings)
    expect(full).toContain('pt-label-poi')
  })

  it('drops road labels on request but keeps place labels', () => {
    const ids = layerIds(basemapStyle({ theme: 'light', roadLabels: false }))
    expect(ids).not.toContain('pt-label-road')
    expect(ids).toContain(MAP_LAYER_IDS.localityLabels)
  })
})

describe('basemapStyle ground underlay', () => {
  it('is off by default, so a planet archive pays nothing for it', () => {
    const style = basemapStyle({ theme: 'light' })
    expect(Object.keys(style.sources)).toEqual([BASEMAP_SOURCE_ID])
    expect(layerIds(style)).not.toContain('pt-ground')
  })

  it.each(THEMES)(
    'adds our own sea, coastlines and graticule under the tiles in %s',
    (theme) => {
      const style = basemapStyle({ theme, ground: true })

      expect(Object.keys(style.sources).sort()).toEqual(
        [BASEMAP_SOURCE_ID, GRATICULE_SOURCE_ID, WORLD_LAND_SOURCE_ID].sort(),
      )
      const ids = layerIds(style)
      expect(ids.slice(0, 5)).toEqual([
        'pt-ground',
        'pt-ground-land',
        'pt-ground-coast',
        'pt-ground-graticule',
        'pt-ground-graticule-major',
      ])
      // Exactly one background layer: the underlay replaces the stock one rather
      // than stacking a second opaque fill over it.
      expect(
        style.layers.filter((layer) => layer.type === 'background'),
      ).toHaveLength(1)
      expect(ids).not.toContain(MAP_LAYER_IDS.background)
    },
  )

  it('keeps the underlay beneath every vector layer', () => {
    const ids = layerIds(basemapStyle({ theme: 'light', ground: true }))
    const groundIndexes = ids
      .map((id, index) => (id.startsWith('pt-ground') ? index : -1))
      .filter((index) => index >= 0)
    const lastGround = Math.max(...groundIndexes)
    expect(lastGround).toBeLessThan(ids.indexOf(MAP_LAYER_IDS.earth))
    expect(lastGround).toBeLessThan(ids.indexOf(MAP_LAYER_IDS.water))
  })

  it('fades the underlay out before its nine-kilometre coastlines could lie', () => {
    const style = basemapStyle({ theme: 'light', ground: true })
    const land = style.layers.find((layer) => layer.id === 'pt-ground-land')
    expect(JSON.stringify(land)).toContain(
      JSON.stringify([
        'interpolate',
        ['linear'],
        ['zoom'],
        GROUND_MIN_ZOOM,
        1,
        GROUND_FADE_MAX_ZOOM,
        0,
      ]),
    )
  })

  it('lands the ground on the out-of-data colour once the underlay has gone', () => {
    const style = basemapStyle({ theme: 'light', ground: true })
    const ground = style.layers.find((layer) => layer.id === 'pt-ground')
    const serialised = JSON.stringify(ground)
    expect(serialised).toContain(MAP_PALETTES.light.water)
    expect(serialised).toContain(MAP_PALETTES.light.background)
  })

  it('still names the archive, so attribution is never lost with the underlay on', () => {
    const style = basemapStyle({ theme: 'light', ground: true })
    expect(strings(style).join(' ')).toContain('openstreetmap.org/copyright')
  })
})

describe('fallbackStyle', () => {
  it.each(THEMES)(
    'draws the whole world from bundled geometry, with no network, in %s',
    (theme) => {
      const style = fallbackStyle({ theme })
      expect(style.version).toBe(8)
      expect(Object.keys(style.sources).sort()).toEqual(
        [WORLD_LAND_SOURCE_ID, GRATICULE_SOURCE_ID].sort(),
      )
      // Nothing to request: no glyphs, no sprite, no tiles.
      expect(style).not.toHaveProperty('glyphs')
      expect(style).not.toHaveProperty('sprite')
      for (const value of strings(style)) {
        expect(value).not.toContain('pmtiles://')
        expect(value).not.toMatch(/^https?:\/\//)
      }
    },
  )

  it.each(THEMES)('fills land from the bundled outlines in %s', (theme) => {
    const style = fallbackStyle({ theme })
    const source = style.sources[WORLD_LAND_SOURCE_ID]
    expect(source).toMatchObject({ type: 'geojson' })

    const land = style.layers.find(
      (layer) => layer.id === FALLBACK_LAYER_IDS.land,
    )
    expect(land).toMatchObject({
      type: 'fill',
      source: WORLD_LAND_SOURCE_ID,
      paint: { 'fill-color': MAP_PALETTES[theme].earth },
    })

    // A coastline needs something to be a coastline *of*.
    expect(
      style.layers.find((layer) => layer.id === FALLBACK_LAYER_IDS.coast),
    ).toMatchObject({
      type: 'line',
      source: WORLD_LAND_SOURCE_ID,
      paint: { 'line-color': MAP_PALETTES[theme].waterEdge },
    })
  })

  it('shares one merged-land payload with the ground underlay', () => {
    // By reference, not by value: this is what stops the two views holding two
    // copies of the same 8,937 coordinate pairs, and it is also what keeps a
    // `geojson` source from re-tiling the world on every theme switch.
    const shared = worldLandFeatures()
    expect(fallbackStyle({ theme: 'light' }).sources[WORLD_LAND_SOURCE_ID]).toMatchObject(
      { data: shared },
    )
    expect(
      basemapStyle({ theme: 'light', ground: true }).sources[
        WORLD_LAND_SOURCE_ID
      ],
    ).toMatchObject({ data: shared })
    expect(
      fallbackStyle({ theme: 'dark' }).sources[WORLD_LAND_SOURCE_ID],
    ).toMatchObject({ data: shared })
  })

  it('has no symbol layer, so it never asks for a glyph range it lacks', () => {
    for (const theme of THEMES) {
      const style = fallbackStyle({ theme })
      expect(style.layers.filter((layer) => layer.type === 'symbol')).toEqual(
        [],
      )
    }
  })

  it.each(THEMES)('paints a sea beneath the land in %s', (theme) => {
    // Without water on screen an island sits on the page ground, and every
    // contrast figure the palette measures against `water` describes a colour
    // that is nowhere to be seen.
    const style = fallbackStyle({ theme })
    const background = style.layers[0]
    expect(background.type).toBe('background')
    expect(JSON.stringify(background)).toContain(MAP_PALETTES[theme].water)

    const ids = layerIds(style)
    expect(ids.indexOf(FALLBACK_LAYER_IDS.background)).toBeLessThan(
      ids.indexOf(FALLBACK_LAYER_IDS.land),
    )
  })

  it('hands the world over to warm paper before its coastlines could lie', () => {
    // The bundled outlines are generalised to about nine kilometres: honest
    // across a continent, a pin in the sea across a city. Same handover the
    // ground underlay makes, for the same reason.
    const style = fallbackStyle({ theme: 'light' })
    const fade = JSON.stringify([
      'interpolate',
      ['linear'],
      ['zoom'],
      GROUND_MIN_ZOOM,
      1,
      GROUND_FADE_MAX_ZOOM,
      0,
    ])
    for (const id of [FALLBACK_LAYER_IDS.land, FALLBACK_LAYER_IDS.coast]) {
      expect(
        JSON.stringify(style.layers.find((layer) => layer.id === id)),
      ).toContain(fade)
    }

    const background = JSON.stringify(style.layers[0])
    expect(background).toContain(MAP_PALETTES.light.water)
    expect(background).toContain(MAP_PALETTES.light.earth)
  })

  it('draws sea, land, coast and grid in that order', () => {
    expect(layerIds(fallbackStyle({ theme: 'light' }))).toEqual([
      FALLBACK_LAYER_IDS.background,
      FALLBACK_LAYER_IDS.land,
      FALLBACK_LAYER_IDS.coast,
      FALLBACK_LAYER_IDS.graticule,
      FALLBACK_LAYER_IDS.graticuleMajor,
    ])
  })

  it('gives every layer a unique id', () => {
    const ids = layerIds(fallbackStyle({ theme: 'dark' }))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('stands the grid down at world scale, where the coastlines do the work', () => {
    const style = fallbackStyle({ theme: 'light' })
    const grid = style.layers.find(
      (layer) => layer.id === FALLBACK_LAYER_IDS.graticule,
    )
    expect(JSON.stringify(grid)).toContain(
      JSON.stringify([
        'interpolate',
        ['linear'],
        ['zoom'],
        GRATICULE_WORLD_ZOOM,
        GRATICULE_WORLD_OPACITY,
        GROUND_MIN_ZOOM,
        1,
      ]),
    )
  })
})

describe('mapStyleFor', () => {
  it('picks the vector style only when the archive is really there', () => {
    expect(
      Object.keys(
        mapStyleFor({ theme: 'light', basemapAvailable: true }).sources,
      ),
    ).toEqual([BASEMAP_SOURCE_ID])
    expect(
      Object.keys(
        mapStyleFor({ theme: 'light', basemapAvailable: false }).sources,
      ),
    ).toEqual([WORLD_LAND_SOURCE_ID, GRATICULE_SOURCE_ID])
  })
})
