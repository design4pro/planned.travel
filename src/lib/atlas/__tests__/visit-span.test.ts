import { describe, expect, it } from 'vitest'

import { UNRECORDED_VISIT_LABEL, visitSpan } from '../visit-span'

describe('visitSpan', () => {
  describe('a country visited once', () => {
    it('collapses to a single date', () => {
      const span = visitSpan('2010-03-19', '2010-03-19')
      expect(span.kind).toBe('single')
      if (span.kind !== 'single') return
      expect(span.date.label).toBe('19 Mar 2010')
      expect(span.date.iso).toBe('2010-03-19')
    })

    it('never prints the same day twice', () => {
      const span = visitSpan('2022-02-05', '2022-02-05')
      const occurrences = span.summary.split('5 Feb 2022').length - 1
      expect(occurrences).toBe(1)
      expect(span.summary).toBe('Visited 5 Feb 2022')
    })

    it('treats two spellings of the same day as one visit', () => {
      const span = visitSpan('2019-04-02', '2019-04-02T09:30:00.000Z')
      expect(span.kind).toBe('single')
    })
  })

  describe('a country visited across years', () => {
    it('keeps both ends whole, in day precision', () => {
      const span = visitSpan('2011-07-14', '2024-09-06')
      expect(span.kind).toBe('range')
      if (span.kind !== 'range') return
      expect(span.first.label).toBe('14 Jul 2011')
      expect(span.last.label).toBe('6 Sept 2024')
      expect(span.summary).toBe('14 Jul 2011 – 6 Sept 2024')
    })

    it('counts the whole days between the two visits', () => {
      const span = visitSpan('2016-08-14', '2023-03-02')
      if (span.kind !== 'range') throw new Error('expected a range')
      expect(span.days).toBe(2391)
      expect(span.gap).toBe('7 years apart')
    })

    it('normalises a row whose dates arrived the wrong way round', () => {
      const span = visitSpan('2024-09-06', '2011-07-14')
      if (span.kind !== 'range') throw new Error('expected a range')
      expect(span.first.iso).toBe('2011-07-14')
      expect(span.last.iso).toBe('2024-09-06')
      expect(span.days).toBeGreaterThan(0)
    })
  })

  describe('the gap between two visits', () => {
    it('stays in days while days are still meaningful', () => {
      const span = visitSpan('2026-06-01', '2026-06-13')
      if (span.kind !== 'range') throw new Error('expected a range')
      expect(span.gap).toBe('12 days apart')
      // Day precision is the point: the month-and-year rendering the reference
      // uses would print "Jun 2026" twice and lose the trip entirely.
      expect(span.first.label).not.toBe(span.last.label)
    })

    it('uses the singular for a single day', () => {
      const span = visitSpan('2026-06-01', '2026-06-02')
      if (span.kind !== 'range') throw new Error('expected a range')
      expect(span.gap).toBe('1 day apart')
    })

    it('coarsens to months past two of them', () => {
      const span = visitSpan('2025-01-10', '2025-09-10')
      if (span.kind !== 'range') throw new Error('expected a range')
      expect(span.gap).toBe('8 months apart')
    })

    it('coarsens to years past two of them', () => {
      const span = visitSpan('2013-06-01', '2026-06-13')
      if (span.kind !== 'range') throw new Error('expected a range')
      expect(span.gap).toBe('13 years apart')
    })
  })

  describe('a half-recorded pair', () => {
    it('reports a first visit with no last visit', () => {
      const span = visitSpan('2015-04-11', null)
      expect(span.kind).toBe('partial')
      if (span.kind !== 'partial') return
      expect(span.edge).toBe('first')
      expect(span.summary).toBe('First visit 11 Apr 2015')
    })

    it('reports a last visit with no first visit', () => {
      const span = visitSpan(null, '2015-04-11')
      if (span.kind !== 'partial') throw new Error('expected a partial span')
      expect(span.edge).toBe('last')
      expect(span.summary).toBe('Last visit 11 Apr 2015')
    })

    /**
     * Two cards side by side must not head the same column with two different
     * words. The later end is "Last visit" whatever shape it arrived in.
     */
    it('names the later end identically in a range and in a partial', () => {
      const partial = visitSpan(null, '2015-04-11')
      const ranged = visitSpan('2011-07-14', '2024-09-06')
      if (partial.kind !== 'partial' || ranged.kind !== 'range') {
        throw new Error('expected a partial and a range')
      }
      expect(partial.summary.startsWith('Last visit')).toBe(true)
      expect(
        visitSpan('2015-04-11', null).summary.startsWith('First visit'),
      ).toBe(true)
      expect(ranged.summary).toBe('14 Jul 2011 – 6 Sept 2024')
    })

    it('is never promoted to a range', () => {
      expect(visitSpan('2015-04-11', undefined).kind).not.toBe('range')
    })
  })

  describe('a pair with nothing recorded', () => {
    it('says so in words rather than a dash', () => {
      const span = visitSpan(null, null)
      expect(span.kind).toBe('unrecorded')
      expect(span.summary).toBe(UNRECORDED_VISIT_LABEL)
      expect(span.summary).toBe('Dates not recorded')
      expect(span.summary.trim().length).toBeGreaterThan(0)
      expect(span.summary).not.toMatch(/^[-–—]$/)
    })

    it('treats undefined the same as null', () => {
      expect(visitSpan(undefined, undefined).kind).toBe('unrecorded')
    })
  })

  describe('input the database should never have held', () => {
    it.each([
      ['an empty column', ''],
      ['a truncated column', '2011-07'],
      ['prose', 'not-a-date'],
      ['an impossible day', '2011-13-45'],
      ['a stray placeholder', '----------'],
    ])('discards %s', (_label, value) => {
      expect(visitSpan(value, null).kind).toBe('unrecorded')
      expect(visitSpan(null, value).kind).toBe('unrecorded')
      expect(visitSpan(value, value).kind).toBe('unrecorded')
    })

    it('keeps the usable half of a half-corrupt pair', () => {
      const span = visitSpan('not-a-date', '2021-12-04')
      if (span.kind !== 'partial') throw new Error('expected a partial span')
      expect(span.edge).toBe('last')
      expect(span.date.label).toBe('4 Dec 2021')
    })
  })

  it('formats every end in the pinned en-GB/UTC style', () => {
    // A time zone west of UTC would roll the day back if the parse were local.
    const span = visitSpan('2023-12-28', '2025-11-08')
    if (span.kind !== 'range') throw new Error('expected a range')
    expect(span.first.label).toBe('28 Dec 2023')
    expect(span.first.iso).toBe('2023-12-28')
    expect(span.last.label).toBe('8 Nov 2025')
  })
})
