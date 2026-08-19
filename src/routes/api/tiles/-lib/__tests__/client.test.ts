import { describe, expect, it } from 'vitest'
import { objectKeyFromPath, resolveArchive } from '../archive'
import {
  DEFAULT_ARCHIVE_ALIAS,
  pmtilesSourceUrl,
  tileArchiveUrl,
  tileAssetUrl,
  tileEndpoints,
} from '../../-client'

const DEFAULT_KEY = 'basemaps/planet.pmtiles'

describe('tile URL builders', () => {
  it('points at the mutable alias by default', () => {
    expect(tileArchiveUrl()).toBe(`/api/tiles/${DEFAULT_ARCHIVE_ALIAS}`)
  })

  it('uses a named archive when one is given', () => {
    expect(tileArchiveUrl({ archive: 'basemaps/planet-2026-08.pmtiles' })).toBe(
      '/api/tiles/basemaps/planet-2026-08.pmtiles',
    )
  })

  it('prefixes an absolute origin without doubling the slash', () => {
    expect(tileArchiveUrl({ origin: 'https://planned.travel/' })).toBe(
      `https://planned.travel/api/tiles/${DEFAULT_ARCHIVE_ALIAS}`,
    )
  })

  it('wraps the archive for the pmtiles protocol handler', () => {
    expect(pmtilesSourceUrl()).toBe(
      `pmtiles:///api/tiles/${DEFAULT_ARCHIVE_ALIAS}`,
    )
  })

  it('builds a URL for any bucket object', () => {
    expect(tileAssetUrl('styles/day.json')).toBe('/api/tiles/styles/day.json')
  })

  it('describes every URL a MapLibre style needs', () => {
    expect(tileEndpoints({ sprite: 'basemap' })).toEqual({
      archive: `/api/tiles/${DEFAULT_ARCHIVE_ALIAS}`,
      pmtiles: `pmtiles:///api/tiles/${DEFAULT_ARCHIVE_ALIAS}`,
      glyphs: '/api/tiles/glyphs/{fontstack}/{range}.pbf',
      sprite: '/api/tiles/sprites/basemap',
    })
  })

  it('produces URLs the handler accepts', () => {
    const endpoints = tileEndpoints()
    expect(resolveArchive(endpoints.archive, DEFAULT_KEY)).toEqual({
      kind: 'alias',
      key: DEFAULT_KEY,
    })
    // MapLibre substitutes the tokens before it ever issues the request.
    const glyph = endpoints.glyphs
      .replace('{fontstack}', 'Geist Sans Regular')
      .replace('{range}', '0-255')
    expect(objectKeyFromPath(glyph)).toBe('glyphs/Geist Sans Regular/0-255.pbf')
    expect(objectKeyFromPath(`${endpoints.sprite}@2x.png`)).toBe(
      'sprites/basemap@2x.png',
    )
  })
})
