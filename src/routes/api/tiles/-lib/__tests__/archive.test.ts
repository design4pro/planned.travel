import { describe, expect, it } from 'vitest'
import {
  ALIAS_MAX_AGE,
  DEFAULT_ARCHIVE_ALIAS,
  IMMUTABLE_MAX_AGE,
  cacheControlFor,
  contentTypeForKey,
  objectKeyFromPath,
  resolveArchive,
} from '../archive'

const DEFAULT_KEY = 'basemaps/planet.pmtiles'

describe('objectKeyFromPath', () => {
  it('reads a nested key', () => {
    expect(objectKeyFromPath('/api/tiles/basemaps/planet.pmtiles')).toBe(
      'basemaps/planet.pmtiles',
    )
  })

  it('percent-decodes each segment', () => {
    expect(
      objectKeyFromPath('/api/tiles/glyphs/Geist%20Sans%20Regular/0-255.pbf'),
    ).toBe('glyphs/Geist Sans Regular/0-255.pbf')
  })

  it('accepts a retina sprite sheet', () => {
    expect(objectKeyFromPath('/api/tiles/sprites/basemap@2x.png')).toBe(
      'sprites/basemap@2x.png',
    )
  })

  it.each([
    ['/api/tiles/', 'empty key'],
    ['/tiles/planet.pmtiles', 'wrong prefix'],
    ['/api/tiles/%2e%2e/secrets.pmtiles', 'encoded traversal'],
    ['/api/tiles/.hidden.pmtiles', 'leading dot'],
    ['/api/tiles/basemaps//planet.pmtiles', 'empty segment'],
    ['/api/tiles/planet.pmtiles%00', 'embedded NUL'],
    ['/api/tiles/%zz.pmtiles', 'malformed percent-encoding'],
    ['/api/tiles/backup.sql', 'extension that is not map data'],
    ['/api/tiles/planet', 'no extension'],
    ['/api/tiles/a/b/c/d/e/f/g.pmtiles', 'too deep'],
  ])('rejects %s (%s)', (path) => {
    expect(objectKeyFromPath(path)).toBeNull()
  })

  it('rejects a key longer than the limit', () => {
    const long = `${'a'.repeat(600)}.pmtiles`
    expect(objectKeyFromPath(`/api/tiles/${long}`)).toBeNull()
  })
})

describe('resolveArchive', () => {
  it('resolves the alias to the configured archive key', () => {
    expect(
      resolveArchive(`/api/tiles/${DEFAULT_ARCHIVE_ALIAS}`, DEFAULT_KEY),
    ).toEqual({ kind: 'alias', key: DEFAULT_KEY })
  })

  it('passes an explicit key through', () => {
    expect(
      resolveArchive('/api/tiles/basemaps/planet-2026-08.pmtiles', DEFAULT_KEY),
    ).toEqual({ kind: 'explicit', key: 'basemaps/planet-2026-08.pmtiles' })
  })

  it('refuses to serve a misconfigured default archive key', () => {
    expect(
      resolveArchive(`/api/tiles/${DEFAULT_ARCHIVE_ALIAS}`, '../etc/passwd'),
    ).toEqual({ kind: 'invalid' })
  })

  it('rejects an invalid path', () => {
    expect(resolveArchive('/api/tiles/wallet.key', DEFAULT_KEY)).toEqual({
      kind: 'invalid',
    })
  })
})

describe('contentTypeForKey', () => {
  it.each([
    ['basemaps/planet.pmtiles', 'application/octet-stream'],
    ['styles/day.json', 'application/json; charset=utf-8'],
    ['glyphs/Geist Sans Regular/0-255.pbf', 'application/x-protobuf'],
    ['sprites/basemap@2x.png', 'image/png'],
    ['hillshade/12/2048/1365.webp', 'image/webp'],
  ])('types %s', (key, expected) => {
    expect(contentTypeForKey(key)).toBe(expected)
  })

  it('returns null for an unserved extension', () => {
    expect(contentTypeForKey('dump.sqlite')).toBeNull()
  })
})

describe('cacheControlFor', () => {
  it('marks a named key immutable for a year', () => {
    expect(cacheControlFor('explicit')).toBe(
      `public, max-age=${IMMUTABLE_MAX_AGE}, immutable`,
    )
  })

  it('keeps the alias revalidating in the browser but long-lived at the edge', () => {
    const value = cacheControlFor('alias')
    expect(value).toContain(`max-age=${ALIAS_MAX_AGE}`)
    expect(value).toContain(`s-maxage=${IMMUTABLE_MAX_AGE}`)
    expect(value).not.toContain('immutable')
  })
})
