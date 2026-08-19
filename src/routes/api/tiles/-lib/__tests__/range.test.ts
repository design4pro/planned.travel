import { describe, expect, it } from 'vitest'
import {
  MAX_RANGE_SPECS,
  coalesceRanges,
  etagMatches,
  formatContentRange,
  formatUnsatisfiedRange,
  parseRangeHeader,
  rangeCacheToken,
  rangeLength,
  resolveRanges,
  totalRangeLength,
} from '../range'
import type { RangeSpec } from '../range'

function specsOf(header: string): ReadonlyArray<RangeSpec> {
  const parsed = parseRangeHeader(header)
  if (parsed.kind !== 'specs') {
    throw new Error(`expected specs, got ${parsed.kind}`)
  }
  return parsed.specs
}

describe('parseRangeHeader', () => {
  it('treats a missing header as absent', () => {
    expect(parseRangeHeader(null)).toEqual({ kind: 'absent' })
  })

  it('parses a bounded range', () => {
    expect(specsOf('bytes=0-499')).toEqual([
      { kind: 'bounded', start: 0, end: 499 },
    ])
  })

  it('parses a single-byte range', () => {
    expect(specsOf('bytes=0-0')).toEqual([
      { kind: 'bounded', start: 0, end: 0 },
    ])
  })

  it('parses an open-ended range', () => {
    expect(specsOf('bytes=500-')).toEqual([{ kind: 'open', start: 500 }])
  })

  it('parses a suffix range', () => {
    expect(specsOf('bytes=-500')).toEqual([{ kind: 'suffix', length: 500 }])
  })

  it('parses a multi-range set and keeps client order', () => {
    expect(specsOf('bytes=200-299,0-99')).toEqual([
      { kind: 'bounded', start: 200, end: 299 },
      { kind: 'bounded', start: 0, end: 99 },
    ])
  })

  it('tolerates whitespace around the unit and the specs', () => {
    expect(specsOf('  bytes= 0-9 , 20-29 ')).toEqual([
      { kind: 'bounded', start: 0, end: 9 },
      { kind: 'bounded', start: 20, end: 29 },
    ])
  })

  it('accepts the unit case-insensitively', () => {
    expect(specsOf('Bytes=0-9')).toEqual([
      { kind: 'bounded', start: 0, end: 9 },
    ])
  })

  it.each([
    ['items=0-9', 'unknown unit'],
    ['bytes=', 'no specs'],
    ['bytes=abc', 'non-numeric'],
    ['bytes=-', 'bare dash'],
    ['bytes=10-5', 'inverted bounds'],
    ['bytes=0-9,', 'trailing comma'],
    ['bytes=0-9,,20-29', 'empty spec'],
    ['bytes=0-9 20-29', 'missing comma'],
    ['bytes=1-2-3', 'three bounds'],
    ['bytes=+5-9', 'signed bound'],
    ['bytes=0x10-0x20', 'hexadecimal bounds'],
    ['bytes=99999999999999999999-', 'bound past the safe integer range'],
  ])('ignores an unusable header (%s: %s)', (header) => {
    expect(parseRangeHeader(header)).toEqual({ kind: 'absent' })
  })

  it('accepts exactly the spec cap', () => {
    const header = `bytes=${Array.from(
      { length: MAX_RANGE_SPECS },
      (_, index) => `${index * 10}-${index * 10 + 4}`,
    ).join(',')}`
    expect(specsOf(header)).toHaveLength(MAX_RANGE_SPECS)
  })

  it('rejects one spec more than the cap', () => {
    const header = `bytes=${Array.from(
      { length: MAX_RANGE_SPECS + 1 },
      (_, index) => `${index * 10}-${index * 10 + 4}`,
    ).join(',')}`
    expect(parseRangeHeader(header)).toEqual({
      kind: 'excessive',
      count: MAX_RANGE_SPECS + 1,
    })
  })

  it('counts specs before parsing them, so garbage cannot hide a long set', () => {
    const header = `bytes=${'0-1,'.repeat(MAX_RANGE_SPECS)}nonsense`
    expect(parseRangeHeader(header).kind).toBe('excessive')
  })
})

describe('resolveRanges', () => {
  it('clamps a bounded range that runs past the end of the object', () => {
    expect(resolveRanges(specsOf('bytes=90-999'), 100)).toEqual({
      kind: 'satisfiable',
      ranges: [{ start: 90, end: 99 }],
    })
  })

  it('resolves an open-ended range against the object size', () => {
    expect(resolveRanges(specsOf('bytes=60-'), 100)).toEqual({
      kind: 'satisfiable',
      ranges: [{ start: 60, end: 99 }],
    })
  })

  it('resolves a suffix range from the end of the object', () => {
    expect(resolveRanges(specsOf('bytes=-10'), 100)).toEqual({
      kind: 'satisfiable',
      ranges: [{ start: 90, end: 99 }],
    })
  })

  it('clamps a suffix longer than the object to the whole object', () => {
    expect(resolveRanges(specsOf('bytes=-500'), 100)).toEqual({
      kind: 'satisfiable',
      ranges: [{ start: 0, end: 99 }],
    })
  })

  it('is unsatisfiable when every spec starts past the end', () => {
    expect(resolveRanges(specsOf('bytes=100-200'), 100)).toEqual({
      kind: 'unsatisfiable',
    })
  })

  it('is unsatisfiable for a zero-length object', () => {
    expect(resolveRanges(specsOf('bytes=0-10'), 0)).toEqual({
      kind: 'unsatisfiable',
    })
  })

  it('is unsatisfiable for a zero-length suffix', () => {
    expect(resolveRanges(specsOf('bytes=-0'), 100)).toEqual({
      kind: 'unsatisfiable',
    })
  })

  it('keeps the satisfiable specs and drops the rest', () => {
    expect(resolveRanges(specsOf('bytes=0-9,500-600'), 100)).toEqual({
      kind: 'satisfiable',
      ranges: [{ start: 0, end: 9 }],
    })
  })

  it('sorts and merges overlapping specs', () => {
    expect(resolveRanges(specsOf('bytes=50-149,0-99'), 1000)).toEqual({
      kind: 'satisfiable',
      ranges: [{ start: 0, end: 149 }],
    })
  })

  it('merges adjacent specs into one interval', () => {
    expect(resolveRanges(specsOf('bytes=0-9,10-19'), 1000)).toEqual({
      kind: 'satisfiable',
      ranges: [{ start: 0, end: 19 }],
    })
  })

  it('keeps a one-byte gap as two intervals', () => {
    expect(resolveRanges(specsOf('bytes=0-9,11-19'), 1000)).toEqual({
      kind: 'satisfiable',
      ranges: [
        { start: 0, end: 9 },
        { start: 11, end: 19 },
      ],
    })
  })

  it('absorbs a spec fully contained in an earlier one', () => {
    expect(resolveRanges(specsOf('bytes=0-99,20-30'), 1000)).toEqual({
      kind: 'satisfiable',
      ranges: [{ start: 0, end: 99 }],
    })
  })
})

describe('coalesceRanges', () => {
  it('leaves a single range untouched', () => {
    expect(coalesceRanges([{ start: 4, end: 8 }])).toEqual([
      { start: 4, end: 8 },
    ])
  })

  it('orders equal starts by ascending end before merging', () => {
    expect(
      coalesceRanges([
        { start: 0, end: 5 },
        { start: 0, end: 20 },
      ]),
    ).toEqual([{ start: 0, end: 20 }])
  })

  it('does not mutate its input', () => {
    const input = [
      { start: 10, end: 19 },
      { start: 0, end: 9 },
    ]
    coalesceRanges(input)
    expect(input[0]).toEqual({ start: 10, end: 19 })
  })
})

describe('range measurement and formatting', () => {
  it('counts an inclusive interval', () => {
    expect(rangeLength({ start: 0, end: 0 })).toBe(1)
    expect(rangeLength({ start: 10, end: 19 })).toBe(10)
  })

  it('sums a range set', () => {
    expect(
      totalRangeLength([
        { start: 0, end: 9 },
        { start: 100, end: 104 },
      ]),
    ).toBe(15)
  })

  it('formats a served interval', () => {
    expect(formatContentRange({ start: 0, end: 99 }, 1024)).toBe(
      'bytes 0-99/1024',
    )
  })

  it('formats the unsatisfied form', () => {
    expect(formatUnsatisfiedRange(1024)).toBe('bytes */1024')
  })
})

describe('rangeCacheToken', () => {
  it('marks a full read', () => {
    expect(rangeCacheToken(null)).toBe('full')
  })

  it('is stable for equivalent range sets', () => {
    const overlapping = resolveRanges(specsOf('bytes=50-149,0-99'), 1000)
    const single = resolveRanges(specsOf('bytes=0-149'), 1000)
    if (overlapping.kind !== 'satisfiable' || single.kind !== 'satisfiable') {
      throw new Error('expected both range sets to be satisfiable')
    }
    expect(rangeCacheToken(overlapping.ranges)).toBe(
      rangeCacheToken(single.ranges),
    )
  })

  it('separates distinct range sets', () => {
    expect(
      rangeCacheToken([
        { start: 0, end: 9 },
        { start: 20, end: 29 },
      ]),
    ).toBe('0-9,20-29')
  })
})

describe('etagMatches', () => {
  const etag = '"abc123"'

  it('does not match a missing header', () => {
    expect(etagMatches(null, etag)).toBe(false)
  })

  it('matches an identical tag', () => {
    expect(etagMatches('"abc123"', etag)).toBe(true)
  })

  it('matches the wildcard', () => {
    expect(etagMatches('*', etag)).toBe(true)
  })

  it('matches weakly, ignoring the W/ prefix on either side', () => {
    expect(etagMatches('W/"abc123"', etag)).toBe(true)
    expect(etagMatches('"abc123"', 'W/"abc123"')).toBe(true)
  })

  it('matches one tag inside a list', () => {
    expect(etagMatches('"other", W/"abc123"', etag)).toBe(true)
  })

  it('does not match a different tag', () => {
    expect(etagMatches('"abc124"', etag)).toBe(false)
  })

  it('does not treat a quoted substring as a match', () => {
    expect(etagMatches('"abc"', etag)).toBe(false)
  })
})
