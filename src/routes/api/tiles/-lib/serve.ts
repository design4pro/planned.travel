/**
 * Range-aware R2 reader behind `/api/tiles/*`.
 *
 * MapLibre reads a Protomaps archive by issuing hundreds of small HTTP Range
 * requests against one multi-gigabyte object, so the two properties that matter
 * are correctness of partial responses and never paying R2 twice for the same
 * bytes. Every read therefore goes through the Cache API first, keyed by the
 * resolved object key plus the *coalesced absolute* byte range, and object
 * metadata (size + entity tag) is cached the same way so even a range we have
 * not served before can be validated without touching the bucket.
 *
 * The bindings arrive as narrow structural interfaces rather than `R2Bucket` and
 * `Cache` so the whole handler can be exercised in a plain Node test.
 */

import {
  METADATA_MAX_AGE,
  TILES_PATH_PREFIX,
  cacheControlFor,
  contentTypeForKey,
  resolveArchive,
} from './archive'
import {
  buildMultipartBody,
  multipartContentType,
  newMultipartBoundary,
} from './multipart'
import {
  etagMatches,
  formatContentRange,
  formatUnsatisfiedRange,
  parseRangeHeader,
  rangeCacheToken,
  rangeLength,
  resolveRanges,
  totalRangeLength,
} from './range'
import type { MultipartPart } from './multipart'
import type { ByteRange } from './range'

export interface TileObjectMeta {
  readonly size: number
  /** Quoted entity tag, ready to put straight into an `ETag` header. */
  readonly httpEtag: string
  readonly uploaded: Date
}

export interface TileObjectBody extends TileObjectMeta {
  readonly body: ReadableStream
  arrayBuffer: () => Promise<ArrayBuffer>
}

export interface TileObjectStore {
  head: (key: string) => Promise<TileObjectMeta | null>
  get: (
    key: string,
    options?: { readonly range?: { offset: number; length: number } },
  ) => Promise<TileObjectBody | null>
}

/** The slice of the Cache API this handler needs. */
export interface TileCache {
  match: (request: Request) => Promise<Response | undefined>
  put: (request: Request, response: Response) => Promise<void>
  delete: (request: Request) => Promise<boolean>
}

export interface TilesRuntime {
  readonly store: TileObjectStore
  readonly cache: TileCache
  /** Value of the `TILES_ARCHIVE_KEY` var the alias resolves to. */
  readonly defaultArchiveKey: string
  waitUntil: (promise: Promise<unknown>) => void
  /** Reported instead of thrown: a cache fault must never fail a tile read. */
  onError?: (context: string, error: unknown) => void
}

/** Largest body we will hold in the edge cache, per entry. */
export const MAX_CACHEABLE_BYTES = 24 * 1024 * 1024

/** Largest `multipart/byteranges` body we will assemble. */
export const MAX_MULTIPART_BYTES = 8 * 1024 * 1024

const ALLOWED_METHODS = 'GET, HEAD, OPTIONS'
const EXPOSED_HEADERS = 'accept-ranges, content-length, content-range, etag'

/** Markers that describe a cached entry; stripped before the client sees it. */
const HEADER_CONTENT_RANGE = 'x-tiles-content-range'
const HEADER_MULTIPART = 'x-tiles-multipart'
const HEADER_CACHE = 'x-tiles-cache'

interface TileMeta {
  readonly size: number
  readonly etag: string
  readonly uploaded: string
}

function isTileMeta(value: unknown): value is TileMeta {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<Record<keyof TileMeta, unknown>>
  return (
    typeof candidate.size === 'number' &&
    Number.isSafeInteger(candidate.size) &&
    candidate.size >= 0 &&
    typeof candidate.etag === 'string' &&
    candidate.etag.length > 0 &&
    typeof candidate.uploaded === 'string'
  )
}

function applyCors(headers: Headers): void {
  headers.set('access-control-allow-origin', '*')
  headers.set('access-control-expose-headers', EXPOSED_HEADERS)
}

function textResponse(
  status: number,
  message: string,
  extra?: Headers,
): Response {
  const headers = new Headers(extra)
  headers.set('content-type', 'text/plain; charset=utf-8')
  headers.set('cache-control', 'no-store')
  applyCors(headers)
  return new Response(`${message}\n`, { status, headers })
}

function preflightResponse(): Response {
  const headers = new Headers()
  headers.set('access-control-allow-methods', ALLOWED_METHODS)
  headers.set('access-control-allow-headers', 'range, if-none-match, if-range')
  headers.set('access-control-max-age', String(METADATA_MAX_AGE))
  applyCors(headers)
  return new Response(null, { status: 204, headers })
}

function internalUrl(
  origin: string,
  key: string,
  param: string,
  value: string,
): Request {
  const url = new URL(origin + TILES_PATH_PREFIX + key)
  url.searchParams.set(param, value)
  return new Request(url.toString(), { method: 'GET' })
}

function metaCacheKey(origin: string, key: string): Request {
  return internalUrl(origin, key, '__meta', '1')
}

function sliceCacheKey(
  origin: string,
  key: string,
  ranges: ReadonlyArray<ByteRange> | null,
): Request {
  return internalUrl(origin, key, '__bytes', rangeCacheToken(ranges))
}

function report(runtime: TilesRuntime, context: string, error: unknown): void {
  runtime.onError?.(context, error)
}

/** Fire-and-forget cache write: a failed `put` degrades speed, never results. */
function cacheInBackground(
  runtime: TilesRuntime,
  key: Request,
  response: Response,
): void {
  runtime.waitUntil(
    runtime.cache.put(key, response).catch((error: unknown) => {
      report(runtime, 'tiles.cache.put', error)
    }),
  )
}

function forgetInBackground(runtime: TilesRuntime, key: Request): void {
  runtime.waitUntil(
    runtime.cache.delete(key).catch((error: unknown) => {
      report(runtime, 'tiles.cache.delete', error)
    }),
  )
}

async function matchCache(
  runtime: TilesRuntime,
  key: Request,
): Promise<Response | undefined> {
  try {
    return await runtime.cache.match(key)
  } catch (error) {
    report(runtime, 'tiles.cache.match', error)
    return undefined
  }
}

async function readCachedMeta(response: Response): Promise<TileMeta | null> {
  try {
    const parsed: unknown = await response.json()
    return isTileMeta(parsed) ? parsed : null
  } catch {
    return null
  }
}

function metaResponse(meta: TileMeta): Response {
  return new Response(JSON.stringify(meta), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${METADATA_MAX_AGE}`,
    },
  })
}

/**
 * Object size and entity tag, from the edge cache when possible.
 *
 * Caching metadata is what makes a cold *range* cheap: the size is needed to
 * clamp an open-ended or suffix range and to answer `If-None-Match`, and without
 * this entry every new range would cost an R2 `head` on top of its read.
 */
async function loadMeta(
  runtime: TilesRuntime,
  origin: string,
  key: string,
): Promise<TileMeta | null> {
  const cacheKey = metaCacheKey(origin, key)
  const cached = await matchCache(runtime, cacheKey)
  if (cached !== undefined) {
    const parsed = await readCachedMeta(cached)
    if (parsed !== null) return parsed
  }

  const head = await runtime.store.head(key)
  if (head === null) return null

  const meta: TileMeta = {
    size: head.size,
    etag: head.httpEtag,
    uploaded: head.uploaded.toISOString(),
  }
  cacheInBackground(runtime, cacheKey, metaResponse(meta))
  return meta
}

interface StorableOptions {
  readonly body: BodyInit
  readonly contentType: string
  readonly cacheControl: string
  readonly etag: string
  readonly contentRange: string | null
  readonly multipart: boolean
}

/**
 * The 200-shaped representation that goes into the cache.
 *
 * The Cache API refuses to store a 206, so a partial read is stored as a 200
 * whose real status and `Content-Range` are carried in `x-tiles-*` markers and
 * reconstructed by {@link present} on the way out.
 */
function storableResponse(options: StorableOptions): Response {
  const headers = new Headers()
  headers.set('content-type', options.contentType)
  headers.set('cache-control', options.cacheControl)
  headers.set('etag', options.etag)
  headers.set('accept-ranges', 'bytes')
  if (options.contentRange !== null) {
    headers.set(HEADER_CONTENT_RANGE, options.contentRange)
  }
  if (options.multipart) headers.set(HEADER_MULTIPART, '1')
  return new Response(options.body, { status: 200, headers })
}

/** Rebuilds the client-facing response from a stored (or freshly built) entry. */
function present(stored: Response, cacheState: 'hit' | 'miss'): Response {
  const headers = new Headers()
  for (const name of [
    'content-type',
    'cache-control',
    'etag',
    'accept-ranges',
  ]) {
    const value = stored.headers.get(name)
    if (value !== null) headers.set(name, value)
  }
  const contentRange = stored.headers.get(HEADER_CONTENT_RANGE)
  if (contentRange !== null) headers.set('content-range', contentRange)
  const partial =
    contentRange !== null || stored.headers.get(HEADER_MULTIPART) === '1'
  applyCors(headers)
  headers.set(HEADER_CACHE, cacheState)
  return new Response(stored.body, { status: partial ? 206 : 200, headers })
}

function notModified(meta: TileMeta, cacheControl: string): Response {
  const headers = new Headers()
  headers.set('etag', meta.etag)
  headers.set('cache-control', cacheControl)
  headers.set('accept-ranges', 'bytes')
  applyCors(headers)
  return new Response(null, { status: 304, headers })
}

function unsatisfiable(meta: TileMeta): Response {
  const headers = new Headers()
  headers.set('content-range', formatUnsatisfiedRange(meta.size))
  headers.set('etag', meta.etag)
  headers.set('accept-ranges', 'bytes')
  return textResponse(416, 'Requested range not satisfiable', headers)
}

/**
 * `HEAD` never carries a body, and RFC 9110 §14.2 defines range handling for
 * `GET` only, so a `Range` header on `HEAD` is ignored and the full length is
 * advertised instead.
 */
function headResponse(
  meta: TileMeta,
  contentType: string,
  cacheControl: string,
): Response {
  const headers = new Headers()
  headers.set('content-type', contentType)
  headers.set('cache-control', cacheControl)
  headers.set('etag', meta.etag)
  headers.set('accept-ranges', 'bytes')
  headers.set('content-length', String(meta.size))
  applyCors(headers)
  return new Response(null, { status: 200, headers })
}

async function readSlice(
  runtime: TilesRuntime,
  key: string,
  range: ByteRange | null,
): Promise<TileObjectBody | null> {
  if (range === null) return runtime.store.get(key)
  return runtime.store.get(key, {
    range: { offset: range.start, length: rangeLength(range) },
  })
}

async function readMultipart(
  runtime: TilesRuntime,
  key: string,
  ranges: ReadonlyArray<ByteRange>,
): Promise<Array<MultipartPart> | null> {
  const parts: Array<MultipartPart> = []
  for (const range of ranges) {
    const object = await readSlice(runtime, key, range)
    if (object === null) return null
    parts.push({ range, bytes: new Uint8Array(await object.arrayBuffer()) })
  }
  return parts
}

/**
 * Serves one tile request.
 *
 * The order of operations is deliberate: validate the key, then resolve
 * metadata (cache before bucket), then answer conditional and `HEAD` requests
 * without reading a single byte of the object, then resolve the range set, and
 * only then look for — or fetch — the bytes themselves.
 */
export async function serveTiles(
  request: Request,
  runtime: TilesRuntime,
): Promise<Response> {
  if (request.method === 'OPTIONS') return preflightResponse()
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const headers = new Headers({ allow: ALLOWED_METHODS })
    return textResponse(405, 'Method not allowed', headers)
  }

  const url = new URL(request.url)
  const resolution = resolveArchive(url.pathname, runtime.defaultArchiveKey)
  if (resolution.kind === 'invalid') return textResponse(404, 'Not found')

  const { key } = resolution
  const contentType = contentTypeForKey(key) ?? 'application/octet-stream'
  const cacheControl = cacheControlFor(resolution.kind)

  const meta = await loadMeta(runtime, url.origin, key)
  if (meta === null) return textResponse(404, 'Not found')

  const ifNoneMatch = request.headers.get('if-none-match')
  if (etagMatches(ifNoneMatch, meta.etag)) {
    return notModified(meta, cacheControl)
  }

  if (request.method === 'HEAD') {
    return headResponse(meta, contentType, cacheControl)
  }

  // `If-Range` that no longer matches means the client's cached prefix is
  // stale: silently upgrade the partial read to a full one (RFC 9110 §13.1.5).
  const ifRange = request.headers.get('if-range')
  const rangeHeader =
    ifRange !== null && !etagMatches(ifRange, meta.etag)
      ? null
      : request.headers.get('range')

  const parsed = parseRangeHeader(rangeHeader)
  if (parsed.kind === 'excessive') {
    return textResponse(400, 'Too many byte ranges requested')
  }

  let ranges: ReadonlyArray<ByteRange> | null = null
  if (parsed.kind === 'specs') {
    const resolved = resolveRanges(parsed.specs, meta.size)
    if (resolved.kind === 'unsatisfiable') return unsatisfiable(meta)
    ranges = resolved.ranges
    if (ranges.length > 1 && totalRangeLength(ranges) > MAX_MULTIPART_BYTES) {
      return textResponse(400, 'Requested range set is too large')
    }
  }

  const cacheKey = sliceCacheKey(url.origin, key, ranges)
  const hit = await matchCache(runtime, cacheKey)
  if (hit !== undefined) {
    // A tag mismatch means the archive was replaced under a key we cached:
    // drop the entry rather than serving bytes from two different objects.
    if (hit.headers.get('etag') === meta.etag) return present(hit, 'hit')
    forgetInBackground(runtime, cacheKey)
  }

  if (ranges !== null && ranges.length > 1) {
    const parts = await readMultipart(runtime, key, ranges)
    if (parts === null) {
      forgetInBackground(runtime, metaCacheKey(url.origin, key))
      return textResponse(404, 'Not found')
    }
    const boundary = newMultipartBoundary()
    let body: Uint8Array<ArrayBuffer>
    try {
      body = buildMultipartBody({
        parts,
        boundary,
        contentType,
        size: meta.size,
      })
    } catch (error) {
      report(runtime, 'tiles.multipart.build', error)
      return textResponse(503, 'Tile archive changed during read')
    }
    const stored = storableResponse({
      body,
      contentType: multipartContentType(boundary),
      cacheControl,
      etag: meta.etag,
      contentRange: null,
      multipart: true,
    })
    cacheInBackground(runtime, cacheKey, stored.clone())
    return present(stored, 'miss')
  }

  // Multi-range sets were handled above, so this is at most one interval.
  const single = ranges === null ? null : ranges[0]
  const object = await readSlice(runtime, key, single)
  if (object === null) {
    forgetInBackground(runtime, metaCacheKey(url.origin, key))
    return textResponse(404, 'Not found')
  }

  const length = single === null ? meta.size : rangeLength(single)
  const stored = storableResponse({
    body: object.body,
    contentType,
    cacheControl,
    etag: meta.etag,
    contentRange:
      single === null ? null : formatContentRange(single, meta.size),
    multipart: false,
  })

  // A full planet archive is far too large to hold at the edge; only slices and
  // small assets (styles, sprites, glyphs) are worth a cache entry.
  if (length <= MAX_CACHEABLE_BYTES) {
    cacheInBackground(runtime, cacheKey, stored.clone())
  }
  return present(stored, 'miss')
}
