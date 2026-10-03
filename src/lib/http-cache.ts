/**
 * How long a shared cache may keep a response, read from the response's own headers.
 *
 * HERE Platform Terms, Exhibit 2 §1.3: "you may not use HERE Materials in a manner that
 * pre-fetches, caches, or stores data or Results, except as explicitly allowed by the caching
 * headers (HTTP/1.1 standard) returned by HERE Location Services". ADR 0019 turned that into the
 * rule this module implements and ADR 0011 now follows: **nothing is stored unless HTTP caching
 * would let a shared cache store it**, and then for no longer than the response says. Keying an
 * entry per member does not make the proxy a private cache, so `private` is a refusal here too.
 *
 * It is a pure function over four header values, in `lib/` rather than beside either proxy, so
 * the transit proxy and the road-routing proxy read one rule instead of writing it twice.
 */

/** The shortest `expirationTtl` Workers KV accepts. A shorter lifetime is not worth an entry. */
export const KV_MIN_TTL_SECONDS = 60

/** The four response headers that decide whether and how long a response may be stored. */
export interface CachingHeaders {
  readonly cacheControl: string | null
  readonly expires: string | null
  readonly date: string | null
  readonly age: string | null
}

export function cachingHeadersOf(headers: Headers): CachingHeaders {
  return {
    cacheControl: headers.get('cache-control'),
    expires: headers.get('expires'),
    date: headers.get('date'),
    age: headers.get('age'),
  }
}

/** Directives that forbid a shared cache to store the response, with or without field names. */
const FORBIDDEN_DIRECTIVES: ReadonlySet<string> = new Set([
  'no-store',
  'no-cache',
  'private',
])

/** `name` and `name=value` directives, lower-cased, the value unquoted. */
function directivesOf(cacheControl: string): Map<string, string | null> {
  const directives = new Map<string, string | null>()
  for (const part of cacheControl.split(',')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === '') {
      continue
    }
    const value = rest.length === 0 ? null : rest.join('=').trim()
    directives.set(name.toLowerCase(), value)
  }
  return directives
}

/** A delta-seconds value, or `null` for anything that is not a non-negative integer. */
function deltaSeconds(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) {
    return null
  }
  return Number(value)
}

/** The explicit freshness lifetime: `s-maxage`, else `max-age`, else `Expires` minus `Date`. */
function freshnessSeconds(
  headers: CachingHeaders,
  directives: Map<string, string | null>,
): number | null {
  if (directives.has('s-maxage')) {
    return deltaSeconds(directives.get('s-maxage') ?? null)
  }
  if (directives.has('max-age')) {
    return deltaSeconds(directives.get('max-age') ?? null)
  }
  if (headers.expires === null || headers.date === null) {
    return null
  }
  const expires = Date.parse(headers.expires)
  const date = Date.parse(headers.date)
  if (Number.isNaN(expires) || Number.isNaN(date)) {
    return null
  }
  return Math.floor((expires - date) / 1000)
}

/**
 * Whole seconds a shared cache may keep this response, or `null` when it may not keep it at all.
 *
 * `null` covers every way of not being allowed to: a `no-store`, `no-cache` or `private`
 * directive, no explicit freshness, a freshness that cannot be read, a lifetime that `Age` has
 * already used up, and a lifetime under {@link KV_MIN_TTL_SECONDS}. The caller applies its own
 * ceiling on top (the transit proxy's is 24 hours); this function never raises a lifetime.
 */
export function storableLifetimeSeconds(
  headers: CachingHeaders,
): number | null {
  const directives = directivesOf(headers.cacheControl ?? '')
  for (const name of directives.keys()) {
    if (FORBIDDEN_DIRECTIVES.has(name)) {
      return null
    }
  }

  const freshness = freshnessSeconds(headers, directives)
  if (freshness === null) {
    return null
  }

  let age = 0
  if (headers.age !== null) {
    const parsed = deltaSeconds(headers.age.trim())
    if (parsed === null) {
      return null
    }
    age = parsed
  }

  const lifetime = freshness - age
  return lifetime >= KV_MIN_TTL_SECONDS ? lifetime : null
}
