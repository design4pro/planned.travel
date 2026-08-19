import { beforeEach, describe, expect, it } from 'vitest'
import { serveTiles } from '../serve'
import type {
  TileCache,
  TileObjectBody,
  TileObjectMeta,
  TileObjectStore,
  TilesRuntime,
} from '../serve'

const ARCHIVE_KEY = 'basemaps/planet-2026-08.pmtiles'
const DEFAULT_KEY = 'basemaps/planet.pmtiles'
const ORIGIN = 'https://planned.travel'
const UPLOADED = new Date('2026-08-01T00:00:00.000Z')

/** Deterministic bytes: object[i] === i % 251, so any slice is checkable. */
function objectBytes(size: number): Uint8Array {
  return Uint8Array.from({ length: size }, (_, index) => index % 251)
}

interface Harness {
  readonly runtime: TilesRuntime
  readonly counts: { heads: number; gets: number }
  settle: () => Promise<void>
}

function harness(
  objects: Map<string, Uint8Array> = new Map([
    [ARCHIVE_KEY, objectBytes(1024)],
    [DEFAULT_KEY, objectBytes(512)],
  ]),
): Harness {
  const counts = { heads: 0, gets: 0 }
  const pending: Array<Promise<unknown>> = []
  const entries = new Map<string, Response>()

  function metaOf(bytes: Uint8Array, key: string): TileObjectMeta {
    return {
      size: bytes.byteLength,
      httpEtag: `"${key}-${bytes.byteLength}"`,
      uploaded: UPLOADED,
    }
  }

  const store: TileObjectStore = {
    head: async (key) => {
      counts.heads += 1
      const bytes = objects.get(key)
      return bytes === undefined ? null : metaOf(bytes, key)
    },
    get: async (key, options) => {
      counts.gets += 1
      const bytes = objects.get(key)
      if (bytes === undefined) return null
      const range = options?.range
      const slice =
        range === undefined
          ? bytes
          : bytes.slice(range.offset, range.offset + range.length)
      const body: TileObjectBody = {
        ...metaOf(bytes, key),
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(slice)
            controller.close()
          },
        }),
        arrayBuffer: async () => {
          const buffer = new ArrayBuffer(slice.byteLength)
          new Uint8Array(buffer).set(slice)
          return buffer
        },
      }
      return body
    },
  }

  const cache: TileCache = {
    match: async (request) => entries.get(request.url)?.clone(),
    put: async (request, response) => {
      entries.set(request.url, response)
    },
    delete: async (request) => entries.delete(request.url),
  }

  return {
    counts,
    runtime: {
      store,
      cache,
      defaultArchiveKey: DEFAULT_KEY,
      waitUntil: (promise) => {
        pending.push(promise)
      },
    },
    settle: async () => {
      await Promise.all(pending.splice(0, pending.length))
    },
  }
}

function tileRequest(
  path: string,
  init: { method?: string; headers?: Record<string, string> } = {},
): Request {
  return new Request(`${ORIGIN}${path}`, init)
}

async function bodyBytes(response: Response): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer())
}

describe('serveTiles', () => {
  let app: Harness

  beforeEach(() => {
    app = harness()
  })

  it('serves a whole archive with range support advertised', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`),
      app.runtime,
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(response.headers.get('content-type')).toBe(
      'application/octet-stream',
    )
    expect(response.headers.get('cache-control')).toBe(
      'public, max-age=31536000, immutable',
    )
    expect(response.headers.get('etag')).toBe(`"${ARCHIVE_KEY}-1024"`)
    expect((await bodyBytes(response)).byteLength).toBe(1024)
  })

  it('serves a bounded range as 206 with the exact bytes', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, {
        headers: { range: 'bytes=100-199' },
      }),
      app.runtime,
    )
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 100-199/1024')
    const bytes = await bodyBytes(response)
    expect(bytes.byteLength).toBe(100)
    expect(bytes[0]).toBe(100 % 251)
  })

  it('resolves an open-ended range against the object size', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, {
        headers: { range: 'bytes=1000-' },
      }),
      app.runtime,
    )
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 1000-1023/1024')
    expect((await bodyBytes(response)).byteLength).toBe(24)
  })

  it('resolves a suffix range from the end of the object', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, {
        headers: { range: 'bytes=-16' },
      }),
      app.runtime,
    )
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 1008-1023/1024')
  })

  it('answers a multi-range request with multipart/byteranges', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, {
        headers: { range: 'bytes=0-9,100-109' },
      }),
      app.runtime,
    )
    expect(response.status).toBe(206)
    const contentType = response.headers.get('content-type') ?? ''
    expect(contentType).toMatch(
      /^multipart\/byteranges; boundary=[0-9a-f]{32}$/,
    )
    expect(response.headers.get('content-range')).toBeNull()

    const boundary = contentType.split('boundary=')[1] ?? ''
    const text = await response.text()
    expect(text).toContain('Content-Range: bytes 0-9/1024')
    expect(text).toContain('Content-Range: bytes 100-109/1024')
    expect(text.endsWith(`--${boundary}--\r\n`)).toBe(true)
  })

  it('coalesces overlapping ranges into a single 206', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, {
        headers: { range: 'bytes=0-99,50-149' },
      }),
      app.runtime,
    )
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 0-149/1024')
    expect(app.counts.gets).toBe(1)
  })

  it('serves repeat range reads from the cache without touching the bucket', async () => {
    const path = `/api/tiles/${ARCHIVE_KEY}`
    const headers = { range: 'bytes=0-63' }
    const first = await serveTiles(tileRequest(path, { headers }), app.runtime)
    expect(first.headers.get('x-tiles-cache')).toBe('miss')
    await first.arrayBuffer()
    await app.settle()

    const before = { ...app.counts }
    const second = await serveTiles(tileRequest(path, { headers }), app.runtime)
    expect(second.status).toBe(206)
    expect(second.headers.get('x-tiles-cache')).toBe('hit')
    expect(second.headers.get('content-range')).toBe('bytes 0-63/1024')
    expect((await bodyBytes(second)).byteLength).toBe(64)
    expect(app.counts).toEqual(before)
  })

  it('caches object metadata, so a new range costs one bucket read', async () => {
    const path = `/api/tiles/${ARCHIVE_KEY}`
    const first = await serveTiles(
      tileRequest(path, { headers: { range: 'bytes=0-9' } }),
      app.runtime,
    )
    await first.arrayBuffer()
    await app.settle()
    expect(app.counts.heads).toBe(1)

    const second = await serveTiles(
      tileRequest(path, { headers: { range: 'bytes=500-509' } }),
      app.runtime,
    )
    await second.arrayBuffer()
    expect(second.status).toBe(206)
    expect(app.counts.heads).toBe(1)
    expect(app.counts.gets).toBe(2)
  })

  it('answers If-None-Match with 304 and never reads the body', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, {
        headers: { 'if-none-match': `"${ARCHIVE_KEY}-1024"` },
      }),
      app.runtime,
    )
    expect(response.status).toBe(304)
    expect(response.headers.get('etag')).toBe(`"${ARCHIVE_KEY}-1024"`)
    expect(app.counts.gets).toBe(0)
  })

  it('ignores a stale If-Range and serves the full representation', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, {
        headers: { range: 'bytes=0-9', 'if-range': '"stale"' },
      }),
      app.runtime,
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-range')).toBeNull()
  })

  it('honours a matching If-Range', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, {
        headers: {
          range: 'bytes=0-9',
          'if-range': `"${ARCHIVE_KEY}-1024"`,
        },
      }),
      app.runtime,
    )
    expect(response.status).toBe(206)
  })

  it('returns 416 with the object size when no range is satisfiable', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, {
        headers: { range: 'bytes=4096-8192' },
      }),
      app.runtime,
    )
    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe('bytes */1024')
    expect(app.counts.gets).toBe(0)
  })

  it('rejects an excessive range set', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, {
        headers: { range: 'bytes=0-1,2-3,4-5,6-7,8-9,10-11,12-13,14-15,16-17' },
      }),
      app.runtime,
    )
    expect(response.status).toBe(400)
    expect(app.counts.gets).toBe(0)
  })

  it('ignores an unparseable range header', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, {
        headers: { range: 'bytes=nonsense' },
      }),
      app.runtime,
    )
    expect(response.status).toBe(200)
  })

  it('serves the alias from the configured archive key', async () => {
    const response = await serveTiles(
      tileRequest('/api/tiles/basemap.pmtiles'),
      app.runtime,
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe(`"${DEFAULT_KEY}-512"`)
    expect(response.headers.get('cache-control')).toContain('max-age=3600')
    expect((await bodyBytes(response)).byteLength).toBe(512)
  })

  it('ignores Range on HEAD and advertises the full length', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, {
        method: 'HEAD',
        headers: { range: 'bytes=0-9' },
      }),
      app.runtime,
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-length')).toBe('1024')
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(response.body).toBeNull()
    expect(app.counts.gets).toBe(0)
  })

  it('answers a CORS preflight without looking at the key', async () => {
    const response = await serveTiles(
      tileRequest('/api/tiles/whatever', { method: 'OPTIONS' }),
      app.runtime,
    )
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-methods')).toBe(
      'GET, HEAD, OPTIONS',
    )
    expect(app.counts.heads).toBe(0)
  })

  it('rejects a write method with an Allow header', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, { method: 'DELETE' }),
      app.runtime,
    )
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, HEAD, OPTIONS')
  })

  it('404s a key it will not serve, without touching the bucket', async () => {
    const response = await serveTiles(
      tileRequest('/api/tiles/%2e%2e/secrets.pmtiles'),
      app.runtime,
    )
    expect(response.status).toBe(404)
    expect(app.counts.heads).toBe(0)
  })

  it('404s a missing object', async () => {
    const response = await serveTiles(
      tileRequest('/api/tiles/basemaps/absent.pmtiles'),
      app.runtime,
    )
    expect(response.status).toBe(404)
    expect(app.counts.heads).toBe(1)
  })

  it('exposes the range headers to cross-origin map clients', async () => {
    const response = await serveTiles(
      tileRequest(`/api/tiles/${ARCHIVE_KEY}`, {
        headers: { range: 'bytes=0-9' },
      }),
      app.runtime,
    )
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(response.headers.get('access-control-expose-headers')).toContain(
      'content-range',
    )
  })

  it('drops a cached slice whose entity tag no longer matches the object', async () => {
    const objects = new Map([[ARCHIVE_KEY, objectBytes(1024)]])
    const app2 = harness(objects)
    const path = `/api/tiles/${ARCHIVE_KEY}`
    const headers = { range: 'bytes=0-9' }
    const first = await serveTiles(tileRequest(path, { headers }), app2.runtime)
    await first.arrayBuffer()
    await app2.settle()

    // Republish the archive at the same key: size changes, so does the tag.
    objects.set(ARCHIVE_KEY, objectBytes(2048))
    const meta = new Request(`${ORIGIN}/api/tiles/${ARCHIVE_KEY}?__meta=1`)
    await app2.runtime.cache.delete(meta)

    const second = await serveTiles(
      tileRequest(path, { headers }),
      app2.runtime,
    )
    expect(second.headers.get('x-tiles-cache')).toBe('miss')
    expect(second.headers.get('content-range')).toBe('bytes 0-9/2048')
    expect(second.headers.get('etag')).toBe(`"${ARCHIVE_KEY}-2048"`)
  })
})
