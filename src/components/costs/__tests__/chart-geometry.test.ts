import { describe, expect, it } from 'vitest'

import { formatPercent } from '#/lib/format'
import {
  MIN_SWEEP_DEGREES,
  allocatePercents,
  formatSharePercent,
  memberSegments,
  ringGeometry,
  ringPath,
} from '../chart-geometry'

import type { MemberSegment, RingSegment } from '../chart-geometry'

function row(key: string, spentMinor: number) {
  return { key, spentMinor }
}

function segmentsOf(rows: ReadonlyArray<ReturnType<typeof row>>) {
  const geometry = ringGeometry(rows)
  if (geometry.kind !== 'ring') {
    throw new Error('expected a ring')
  }
  return geometry.segments
}

function totalSweep(segments: ReadonlyArray<RingSegment>): number {
  return segments.reduce((sum, segment) => sum + segment.sweepDegrees, 0)
}

describe('ringGeometry', () => {
  it('is empty for a total of zero, never a division by zero', () => {
    expect(ringGeometry([])).toEqual({ kind: 'empty' })
    expect(ringGeometry([row('a', 0), row('b', 0)])).toEqual({ kind: 'empty' })
  })

  it('skips a value that is not a positive finite number', () => {
    const segments = segmentsOf([
      row('a', -5),
      row('b', Number.NaN),
      row('c', Number.POSITIVE_INFINITY),
      row('d', 100),
      row('e', 0),
    ])

    expect(segments.map((segment) => segment.key)).toEqual(['d'])
  })

  it('is empty when every value is skipped', () => {
    expect(ringGeometry([row('a', -1), row('b', Number.NaN)])).toEqual({
      kind: 'empty',
    })
  })

  it('closes the ring: sweeps total 360 with no gap and no overlap', () => {
    const segments = segmentsOf([
      row('a', 4120),
      row('b', 1333),
      row('c', 71),
      row('d', 999),
      row('e', 12),
    ])

    expect(segments[0].startDegrees).toBe(0)
    for (const [index, segment] of segments.entries()) {
      if (index > 0) {
        expect(segment.startDegrees).toBe(segments[index - 1].endDegrees)
      }
      expect(segment.endDegrees - segment.startDegrees).toBeCloseTo(
        segment.sweepDegrees,
        9,
      )
    }
    expect(segments.at(-1)?.endDegrees).toBe(360)
    expect(totalSweep(segments)).toBeCloseTo(360, 9)
  })

  it('keeps the order it was given, whatever the totals', () => {
    const first = segmentsOf([row('a', 10), row('b', 90), row('c', 50)])
    const second = segmentsOf([row('a', 900), row('b', 1), row('c', 50)])

    expect(first.map((segment) => segment.key)).toEqual(['a', 'b', 'c'])
    expect(second.map((segment) => segment.key)).toEqual(['a', 'b', 'c'])
    expect(first[0].startDegrees).toBe(0)
    expect(second[0].startDegrees).toBe(0)
  })

  it('reports the real share of each segment', () => {
    const segments = segmentsOf([row('a', 1), row('b', 3)])

    expect(segments[0].share).toBeCloseTo(0.25, 12)
    expect(segments[1].share).toBeCloseTo(0.75, 12)
  })

  it('draws a single category as a full ring', () => {
    const segments = segmentsOf([row('a', 0), row('b', 750)])

    expect(segments).toHaveLength(1)
    expect(segments[0].full).toBe(true)
    expect(segments[0].sweepDegrees).toBe(360)
    expect(segments[0].endDegrees).toBe(360)
  })

  it('raises a sliver to the floor and lets the rest absorb it', () => {
    const segments = segmentsOf([
      row('a', 1),
      row('b', 500_000),
      row('c', 499_999),
    ])

    expect(segments[0].sweepDegrees).toBeGreaterThanOrEqual(MIN_SWEEP_DEGREES)
    expect(segments[0].sweepDegrees).toBeCloseTo(MIN_SWEEP_DEGREES, 12)
    expect(segments[1].sweepDegrees).toBeLessThan(180)
    expect(totalSweep(segments)).toBeCloseTo(360, 9)
    expect(segments.at(-1)?.endDegrees).toBe(360)
  })

  it('applies the floor to more than one sliver at once', () => {
    const segments = segmentsOf([
      row('a', 1),
      row('b', 2),
      row('c', 1_000_000),
      row('d', 1),
    ])

    for (const key of ['a', 'b', 'd']) {
      const segment = segments.find((candidate) => candidate.key === key)
      expect(segment?.sweepDegrees).toBeGreaterThanOrEqual(MIN_SWEEP_DEGREES)
    }
    expect(totalSweep(segments)).toBeCloseTo(360, 9)
    expect(segments.at(-1)?.endDegrees).toBe(360)
  })

  it('never emits a segment without a sweep', () => {
    const segments = segmentsOf(
      Array.from({ length: 8 }, (_, index) => row(`k${index}`, index + 1)),
    )

    for (const segment of segments) {
      expect(segment.sweepDegrees).toBeGreaterThan(0)
    }
  })
})

describe('ringPath', () => {
  const geometry = (rows: ReadonlyArray<ReturnType<typeof row>>) =>
    segmentsOf(rows)

  it('draws a full ring as two half-turns per edge, never start equals end', () => {
    const [segment] = geometry([row('a', 100)])
    const path = ringPath(segment, 50, 50, 48, 30)

    expect(path.match(/A/g)).toHaveLength(4)
    expect(path).not.toContain('NaN')
  })

  it('draws a segment as one outer and one inner arc', () => {
    const [segment] = geometry([row('a', 25), row('b', 75)])
    const path = ringPath(segment, 50, 50, 48, 30)

    expect(path.match(/A/g)).toHaveLength(2)
    // A quarter turn is a small arc on both edges.
    expect(path).toContain('A48 48 0 0 1')
    expect(path).toContain('A30 30 0 0 0')
  })

  it('sets the large-arc flag past half a turn', () => {
    const [, big] = geometry([row('a', 25), row('b', 75)])
    const path = ringPath(big, 50, 50, 48, 30)

    expect(path).toContain('A48 48 0 1 1')
    expect(path).toContain('A30 30 0 1 0')
  })

  it('starts at 12 o clock and runs clockwise', () => {
    const [first] = geometry([row('a', 25), row('b', 75)])
    const path = ringPath(first, 50, 50, 48, 30)

    // Outer edge from the top (50, 2) to three o clock (98, 50).
    expect(path.startsWith('M50 2')).toBe(true)
    expect(path).toContain('A48 48 0 0 1 98 50')
  })
})

describe('allocatePercents', () => {
  it('returns zeros for nothing to allocate', () => {
    expect(allocatePercents([])).toEqual([])
    expect(allocatePercents([0, 0])).toEqual([0, 0])
    expect(allocatePercents([-3, Number.NaN])).toEqual([0, 0])
  })

  it('sums to exactly 100 by largest remainder', () => {
    expect(allocatePercents([1, 1, 1])).toEqual([34, 33, 33])
    expect(allocatePercents([50, 30, 20])).toEqual([50, 30, 20])
  })

  it('keeps eight near-equal shares within one point of their real share', () => {
    const values = [100, 100, 100, 100, 100, 100, 100, 100]
    const percents = allocatePercents(values)

    expect(percents.reduce((sum, value) => sum + value, 0)).toBe(100)
    for (const percent of percents) {
      expect(Math.abs(percent - 12.5)).toBeLessThan(1)
    }
  })

  it('breaks ties by row order', () => {
    expect(allocatePercents([100, 100, 100, 100, 100, 100, 100, 100])).toEqual([
      13, 13, 13, 13, 12, 12, 12, 12,
    ])
  })

  it('gives the leftover to the biggest fractional parts', () => {
    // 62.5, 18.75, 18.75 -> floors 62, 18, 18 = 98; two points left for .75, .75 and .5.
    expect(allocatePercents([80, 24, 24])).toEqual([62, 19, 19])
  })

  it('never gives a row 100 while another row has spend', () => {
    // 99.7 and 0.3: the point goes to the sliver, so no row claims the whole.
    expect(allocatePercents([997, 3])).toEqual([99, 1])
    expect(allocatePercents([1, 99_999])).toEqual([1, 99])
  })

  it('still gives a lone row all 100', () => {
    expect(allocatePercents([0, 5_000])).toEqual([0, 100])
  })

  it('gives a skipped value zero and still sums to 100', () => {
    const percents = allocatePercents([2, -1, 1])

    expect(percents[1]).toBe(0)
    expect(percents.reduce((sum, value) => sum + value, 0)).toBe(100)
  })

  it('sums to 100 for any run of integer amounts', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const values = Array.from(
        { length: 8 },
        (_, index) => ((seed * 7919 + index * 104_729) % 9973) + 1,
      )
      const percents = allocatePercents(values)
      const total = values.reduce((sum, value) => sum + value, 0)

      expect(percents.reduce((sum, value) => sum + value, 0)).toBe(100)
      for (const [index, percent] of percents.entries()) {
        expect(Math.abs(percent - (values[index] / total) * 100)).toBeLessThan(
          1,
        )
      }
    }
  })
})

describe('formatSharePercent', () => {
  it('reads a share under one percent as below one, from the real share', () => {
    expect(formatSharePercent(0.004, 0, 'en')).toEqual({
      belowOne: true,
      text: '1%',
    })
    expect(formatSharePercent(0.0099, 1, 'en').belowOne).toBe(true)
  })

  it('never reads a zero share as below one', () => {
    expect(formatSharePercent(0, 0, 'en')).toEqual({
      belowOne: false,
      text: '0%',
    })
  })

  it('renders the allocated whole percent otherwise', () => {
    expect(formatSharePercent(0.0101, 1, 'en')).toEqual({
      belowOne: false,
      text: '1%',
    })
    expect(formatSharePercent(0.317, 32, 'en')).toEqual({
      belowOne: false,
      text: '32%',
    })
    expect(formatSharePercent(1, 100, 'en').text).toBe('100%')
  })

  it('formats the percent in the reader locale', () => {
    expect(formatSharePercent(0.5, 50, 'de').text).toBe(
      formatPercent(0.5, 'de'),
    )
  })
})

function member(userId: string, shareMinor: number) {
  return { userId, name: userId.toUpperCase(), shareMinor }
}

function summary(segments: ReadonlyArray<MemberSegment>): Array<string> {
  return segments.map((segment) => {
    switch (segment.kind) {
      case 'member':
        return segment.userId
      case 'others':
        return `others:${segment.count}`
      case 'unassigned':
        return 'unassigned'
    }
  })
}

function percentsOf(segments: ReadonlyArray<MemberSegment>): Array<number> {
  return segments.map((segment) => segment.percent)
}

describe('memberSegments', () => {
  it('has nothing to show for no members or no shares', () => {
    expect(memberSegments([], 1_000)).toEqual([])
    expect(memberSegments([member('a', 0)], 0)).toEqual([])
  })

  it('drops members with a zero share', () => {
    const segments = memberSegments(
      [member('a', 500), member('b', 0), member('c', 500)],
      1_000,
    )

    expect(summary(segments)).toEqual(['a', 'c'])
  })

  it('measures each share against the spend and sums the percents to 100', () => {
    const segments = memberSegments(
      [member('a', 300), member('b', 300), member('c', 400)],
      1_000,
    )

    expect(summary(segments)).toEqual(['c', 'a', 'b'])
    expect(segments.map((segment) => segment.share)).toEqual([0.4, 0.3, 0.3])
    expect(percentsOf(segments)).toEqual([40, 30, 30])
  })

  it('orders by share descending and breaks a tie by ascending user id', () => {
    const segments = memberSegments(
      [member('c', 100), member('a', 100), member('b', 100), member('d', 700)],
      1_000,
    )

    expect(summary(segments)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('adds one "Not split between anyone" segment when the shares fall short', () => {
    const segments = memberSegments([member('a', 600), member('b', 300)], 1_000)

    expect(summary(segments)).toEqual(['a', 'b', 'unassigned'])
    expect(segments[2].share).toBeCloseTo(0.1, 10)
    expect(percentsOf(segments)).toEqual([60, 30, 10])
  })

  it('has no remainder segment when the shares cover the spend exactly', () => {
    const segments = memberSegments([member('a', 600), member('b', 400)], 1_000)

    expect(summary(segments)).toEqual(['a', 'b'])
  })

  it('measures against the sum of the shares when they exceed the spend', () => {
    const segments = memberSegments([member('a', 900), member('b', 300)], 1_000)

    expect(summary(segments)).toEqual(['a', 'b'])
    expect(segments.map((segment) => segment.share)).toEqual([0.75, 0.25])
    expect(percentsOf(segments)).toEqual([75, 25])
  })

  it('measures against the sum when the spend is not a positive number', () => {
    const segments = memberSegments(
      [member('a', 500), member('b', 500)],
      Number.NaN,
    )

    expect(percentsOf(segments)).toEqual([50, 50])
  })

  it('shows four members as they are', () => {
    const segments = memberSegments(
      [member('a', 400), member('b', 300), member('c', 200), member('d', 100)],
      1_000,
    )

    expect(summary(segments)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('groups everyone past the top three into one "others" segment', () => {
    const segments = memberSegments(
      [
        member('a', 300),
        member('b', 250),
        member('c', 200),
        member('d', 150),
        member('e', 100),
      ],
      1_000,
    )

    expect(summary(segments)).toEqual(['a', 'b', 'c', 'others:2'])
    expect(segments[3].share).toBeCloseTo(0.25, 10)
    expect(percentsOf(segments)).toEqual([30, 25, 20, 25])
  })

  it('has at most five segments: three, others and the remainder', () => {
    const segments = memberSegments(
      [
        member('a', 200),
        member('b', 150),
        member('c', 120),
        member('d', 90),
        member('e', 60),
        member('f', 30),
      ],
      1_000,
    )

    expect(summary(segments)).toEqual(['a', 'b', 'c', 'others:3', 'unassigned'])
    expect(segments).toHaveLength(5)
  })

  it('counts only members with a share when it groups the others', () => {
    const segments = memberSegments(
      [
        member('a', 400),
        member('b', 300),
        member('c', 200),
        member('d', 100),
        member('e', 0),
      ],
      1_000,
    )

    expect(summary(segments)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('always sums the whole percents to 100', () => {
    const segments = memberSegments(
      [member('a', 1), member('b', 1), member('c', 1)],
      3,
    )
    const shortOfSpend = memberSegments(
      [member('a', 1), member('b', 1), member('c', 1)],
      4,
    )

    expect(percentsOf(segments).reduce((sum, p) => sum + p, 0)).toBe(100)
    expect(percentsOf(shortOfSpend).reduce((sum, p) => sum + p, 0)).toBe(100)
  })

  it('keeps the real share beside the allocated percent for a sliver', () => {
    const segments = memberSegments(
      [member('a', 9_990), member('b', 10)],
      10_000,
    )

    expect(segments[1].share).toBeCloseTo(0.001, 10)
    expect(percentsOf(segments)).toEqual([99, 1])
    expect(
      formatSharePercent(segments[1].share, segments[1].percent, 'en').belowOne,
    ).toBe(true)
  })

  it('returns the one segment of a single member and leaves hiding it to the bar', () => {
    expect(summary(memberSegments([member('a', 1_000)], 1_000))).toEqual(['a'])
  })
})
