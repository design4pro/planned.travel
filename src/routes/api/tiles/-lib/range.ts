/**
 * HTTP Range request parsing for the tile endpoint (RFC 9110 §14).
 *
 * Kept free of any Cloudflare binding so the whole state machine — malformed
 * headers, open-ended ranges, suffix ranges, overlapping multi-ranges,
 * unsatisfiable ranges — is unit-testable in plain Node.
 */

/** A resolved byte interval. Both bounds are inclusive, as on the wire. */
export interface ByteRange {
  readonly start: number
  readonly end: number
}

/** One `<range-spec>` as written by the client, before it meets a size. */
export type RangeSpec =
  /** `bytes=0-499` */
  | { readonly kind: 'bounded'; readonly start: number; readonly end: number }
  /** `bytes=500-` — everything from `start` to the end of the object. */
  | { readonly kind: 'open'; readonly start: number }
  /** `bytes=-500` — the final `length` bytes of the object. */
  | { readonly kind: 'suffix'; readonly length: number }

export type ParsedRange =
  /**
   * No usable `Range` header. RFC 9110 §14.2 requires a server to ignore a
   * Range field it cannot parse (or whose unit it does not know) and answer
   * with the full representation, so a malformed header lands here too.
   */
  | { readonly kind: 'absent' }
  | { readonly kind: 'specs'; readonly specs: ReadonlyArray<RangeSpec> }
  /**
   * More range specs than we are willing to serve. §14.2 explicitly allows
   * rejecting these: a long list of tiny ranges is either a broken client or
   * an amplification attempt.
   */
  | { readonly kind: 'excessive'; readonly count: number }

export type ResolvedRange =
  | { readonly kind: 'satisfiable'; readonly ranges: ReadonlyArray<ByteRange> }
  | { readonly kind: 'unsatisfiable' }

/** Upper bound on `<range-spec>` count in a single request. */
export const MAX_RANGE_SPECS = 8

const BYTES_UNIT = 'bytes='
const SPEC_PATTERN = /^(\d*)-(\d*)$/

function parseCount(digits: string): number | null {
  if (digits.length === 0 || digits.length > 15) return null
  const value = Number.parseInt(digits, 10)
  return Number.isSafeInteger(value) ? value : null
}

function parseSpec(raw: string): RangeSpec | null {
  const match = SPEC_PATTERN.exec(raw.trim())
  if (!match) return null
  const [, first, second] = match

  if (first.length === 0) {
    const length = parseCount(second)
    return length === null ? null : { kind: 'suffix', length }
  }

  const start = parseCount(first)
  if (start === null) return null
  if (second.length === 0) return { kind: 'open', start }

  const end = parseCount(second)
  if (end === null || end < start) return null
  return { kind: 'bounded', start, end }
}

/**
 * Parses a `Range` header value. A single malformed spec invalidates the whole
 * header — partial acceptance would let a client smuggle a byte count past the
 * `MAX_RANGE_SPECS` guard by hiding it behind a garbage spec.
 */
export function parseRangeHeader(header: string | null): ParsedRange {
  if (header === null) return { kind: 'absent' }

  const trimmed = header.trim()
  if (!trimmed.toLowerCase().startsWith(BYTES_UNIT)) return { kind: 'absent' }

  const body = trimmed.slice(BYTES_UNIT.length)
  if (body.trim().length === 0) return { kind: 'absent' }

  const parts = body.split(',')
  if (parts.length > MAX_RANGE_SPECS) {
    return { kind: 'excessive', count: parts.length }
  }

  const specs: Array<RangeSpec> = []
  for (const part of parts) {
    const spec = parseSpec(part)
    if (spec === null) return { kind: 'absent' }
    specs.push(spec)
  }
  return { kind: 'specs', specs }
}

/** Sorts ascending, then merges overlapping and adjacent intervals. */
export function coalesceRanges(
  ranges: ReadonlyArray<ByteRange>,
): ReadonlyArray<ByteRange> {
  const sorted = [...ranges].sort((a, b) =>
    a.start === b.start ? a.end - b.end : a.start - b.start,
  )
  const merged: Array<ByteRange> = []
  for (const range of sorted) {
    const lastIndex = merged.length - 1
    if (lastIndex >= 0) {
      const last = merged[lastIndex]
      // Adjacent counts as overlapping: `0-9` then `10-19` is one read.
      if (range.start <= last.end + 1) {
        if (range.end > last.end) {
          merged[lastIndex] = { start: last.start, end: range.end }
        }
        continue
      }
    }
    merged.push(range)
  }
  return merged
}

/**
 * Turns client specs into absolute intervals against a known object size.
 *
 * Specs that start past the end of the object are dropped (§14.1.1: a range set
 * is satisfiable if *any* spec is); if every spec is dropped the caller owes the
 * client a 416. Ends are clamped to the last byte, and the survivors are
 * coalesced so a multi-range read never fetches the same byte twice.
 */
export function resolveRanges(
  specs: ReadonlyArray<RangeSpec>,
  size: number,
): ResolvedRange {
  if (size <= 0) return { kind: 'unsatisfiable' }

  const last = size - 1
  const resolved: Array<ByteRange> = []
  for (const spec of specs) {
    if (spec.kind === 'suffix') {
      if (spec.length === 0) continue
      resolved.push({ start: Math.max(0, size - spec.length), end: last })
      continue
    }
    if (spec.start > last) continue
    const end = spec.kind === 'open' ? last : Math.min(spec.end, last)
    resolved.push({ start: spec.start, end })
  }

  if (resolved.length === 0) return { kind: 'unsatisfiable' }
  return { kind: 'satisfiable', ranges: coalesceRanges(resolved) }
}

/** Byte count covered by one interval. */
export function rangeLength(range: ByteRange): number {
  return range.end - range.start + 1
}

/** Byte count covered by a coalesced range set. */
export function totalRangeLength(ranges: ReadonlyArray<ByteRange>): number {
  return ranges.reduce((sum, range) => sum + rangeLength(range), 0)
}

/** `Content-Range` value for a served interval. */
export function formatContentRange(range: ByteRange, size: number): string {
  return `bytes ${range.start}-${range.end}/${size}`
}

/** `Content-Range` value that accompanies a 416 response. */
export function formatUnsatisfiedRange(size: number): string {
  return `bytes */${size}`
}

/**
 * Stable cache-key fragment for a resolved range set. Ranges are already
 * absolute and coalesced, so `bytes=0-99, 50-149` and `bytes=0-149` produce the
 * same fragment and therefore share one cache entry.
 */
export function rangeCacheToken(
  ranges: ReadonlyArray<ByteRange> | null,
): string {
  if (ranges === null) return 'full'
  return ranges.map((range) => `${range.start}-${range.end}`).join(',')
}

function normalizeEntityTag(value: string): string {
  const trimmed = value.trim()
  return trimmed.startsWith('W/') ? trimmed.slice(2) : trimmed
}

/**
 * Weak comparison of an `If-None-Match` / `If-Range` header against an entity
 * tag, per RFC 9110 §8.8.3.2. `If-Range` technically demands strong comparison,
 * but R2 only ever hands us strong tags, so one comparator serves both.
 */
export function etagMatches(header: string | null, etag: string): boolean {
  if (header === null) return false
  const candidate = normalizeEntityTag(etag)
  return header.split(',').some((value) => {
    const normalized = normalizeEntityTag(value)
    return normalized === '*' || normalized === candidate
  })
}
