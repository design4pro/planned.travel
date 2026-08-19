import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  basemapAvailability,
  pmtilesSourceUrl,
  probeBasemap,
  resetBasemapAvailability,
  tileArchiveUrl,
  tileEndpoints,
} from '../pmtiles'
import { PMTILES_HEADER_LENGTH } from '../coverage'
import { REGIONAL_BOUNDS, pmtilesHeaderBytes } from './archive-fixture'

import type { ArchiveFixtureOptions } from './archive-fixture'

/**
 * The Workers `BodyInit` this project compiles against does not accept a typed
 * array, so a body is always a real `ArrayBuffer`.
 */
function ok(options: ArchiveFixtureOptions = {}, status = 206): Response {
  return new Response(pmtilesHeaderBytes(options), { status })
}

function stub(respond: () => Response) {
  return vi.fn<typeof fetch>().mockImplementation(async () => respond())
}

afterEach(() => {
  resetBasemapAvailability()
})

describe('URL construction', () => {
  it('defaults to the mutable alias on our own route', () => {
    expect(tileArchiveUrl()).toBe('/api/tiles/basemap.pmtiles')
    expect(pmtilesSourceUrl()).toBe('pmtiles:///api/tiles/basemap.pmtiles')
  })

  it('names an explicit archive key, which is what makes it immutably cacheable', () => {
    expect(tileArchiveUrl({ archive: 'basemaps/planet-2026-08.pmtiles' })).toBe(
      '/api/tiles/basemaps/planet-2026-08.pmtiles',
    )
  })

  it('prefixes an origin for contexts with no document base', () => {
    expect(pmtilesSourceUrl({ origin: 'https://planned.travel' })).toBe(
      'pmtiles://https://planned.travel/api/tiles/basemap.pmtiles',
    )
    // A trailing slash on the origin must not double up.
    expect(tileArchiveUrl({ origin: 'https://planned.travel/' })).toBe(
      'https://planned.travel/api/tiles/basemap.pmtiles',
    )
  })

  it('builds every URL a style needs from one call', () => {
    expect(tileEndpoints()).toEqual({
      archive: '/api/tiles/basemap.pmtiles',
      pmtiles: 'pmtiles:///api/tiles/basemap.pmtiles',
      glyphs: '/api/tiles/glyphs/{fontstack}/{range}.pbf',
      sprite: '/api/tiles/sprites/basemap',
    })
  })
})

describe('probeBasemap', () => {
  it('asks for exactly the header, in one request', async () => {
    const fetchImpl = stub(() => ok())
    const result = await probeBasemap({ fetchImpl })

    expect(result).toMatchObject({
      status: 'available',
      url: '/api/tiles/basemap.pmtiles',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('/api/tiles/basemap.pmtiles')
    expect(init?.headers).toEqual({
      range: `bytes=0-${PMTILES_HEADER_LENGTH - 1}`,
    })
  })

  it('reports the extent the archive was cut to, not just that it exists', async () => {
    const fetchImpl = stub(() => ok({ bounds: REGIONAL_BOUNDS, maxZoom: 14 }))
    const result = await probeBasemap({ fetchImpl })

    expect(result).toMatchObject({
      status: 'available',
      header: {
        maxZoom: 14,
        bounds: { west: 134.2, south: 33.6, east: 140.9, north: 36.8 },
      },
    })
  })

  it('rejects a raster archive, which would refuse every vector layer', async () => {
    const fetchImpl = stub(() => ok({ tileType: 2 }))
    await expect(probeBasemap({ fetchImpl })).resolves.toMatchObject({
      reason: 'unsupported',
    })
  })

  it('reports a missing archive rather than throwing', async () => {
    const fetchImpl = stub(() => new Response(null, { status: 404 }))
    await expect(probeBasemap({ fetchImpl })).resolves.toEqual({
      status: 'unavailable',
      url: '/api/tiles/basemap.pmtiles',
      reason: 'missing',
    })
  })

  it('treats a forbidden object as missing, not as a fault to retry', async () => {
    const fetchImpl = stub(() => new Response(null, { status: 403 }))
    await expect(probeBasemap({ fetchImpl })).resolves.toMatchObject({
      reason: 'missing',
    })
  })

  it('rejects an object that is not a Protomaps archive', async () => {
    const fetchImpl = stub(
      () => new Response(new ArrayBuffer(PMTILES_HEADER_LENGTH), { status: 206 }),
    )
    await expect(probeBasemap({ fetchImpl })).resolves.toMatchObject({
      reason: 'unsupported',
    })
  })

  it('rejects a spec version this build cannot read', async () => {
    const fetchImpl = stub(() => ok({ specVersion: 2 }))
    await expect(probeBasemap({ fetchImpl })).resolves.toMatchObject({
      reason: 'unsupported',
    })
  })

  it('rejects a truncated upload, which a HEAD request would have passed', async () => {
    const fetchImpl = stub(() => ok({ length: 64 }))
    await expect(probeBasemap({ fetchImpl })).resolves.toMatchObject({
      reason: 'unsupported',
    })
  })

  it('reports a server fault as a network problem', async () => {
    const fetchImpl = stub(() => new Response(null, { status: 503 }))
    await expect(probeBasemap({ fetchImpl })).resolves.toMatchObject({
      reason: 'network',
    })
  })

  it('never throws when the request itself fails', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => {
      throw new TypeError('Failed to fetch')
    })
    await expect(probeBasemap({ fetchImpl })).resolves.toMatchObject({
      reason: 'network',
    })
  })

  it('accepts a full 200 response as well as a partial one', async () => {
    const fetchImpl = stub(() => ok({}, 200))
    await expect(probeBasemap({ fetchImpl })).resolves.toMatchObject({
      status: 'available',
    })
  })
})

describe('basemapAvailability', () => {
  it('asks once per archive, however many maps mount', async () => {
    const fetchImpl = stub(() => ok())
    const [first, second] = await Promise.all([
      basemapAvailability({ fetchImpl }),
      basemapAvailability({ fetchImpl }),
    ])

    expect(first).toEqual(second)
    expect(await basemapAvailability({ fetchImpl })).toEqual(first)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('keys the answer by archive, so a rotation is not masked', async () => {
    const fetchImpl = stub(() => ok())
    await basemapAvailability({ fetchImpl })
    await basemapAvailability({ fetchImpl, archive: 'basemaps/other.pmtiles' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('remembers a definitive "missing" so the notice does not flicker', async () => {
    const fetchImpl = stub(() => new Response(null, { status: 404 }))
    await basemapAvailability({ fetchImpl })
    await basemapAvailability({ fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('re-asks after a transient network failure', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(() => {
        throw new TypeError('Failed to fetch')
      })
      .mockImplementation(async () => ok())

    await expect(basemapAvailability({ fetchImpl })).resolves.toMatchObject({
      reason: 'network',
    })
    await expect(basemapAvailability({ fetchImpl })).resolves.toMatchObject({
      status: 'available',
    })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('forgets everything when reset, which is what the retry button does', async () => {
    const fetchImpl = stub(() => ok())
    await basemapAvailability({ fetchImpl })
    resetBasemapAvailability()
    await basemapAvailability({ fetchImpl })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
