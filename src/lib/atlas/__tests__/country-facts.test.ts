import { describe, expect, it } from 'vitest'

import {
  ABSENT_FACT_MARK,
  countryFactColumns,
  countryFactCount,
  countryFactMonth,
  countryFacts,
} from '../country-facts'

const FRANCE = {
  countryCode: 'FR',
  tripCount: 3,
  placeCount: 12,
  firstTripOn: '2019-07-14',
  lastTripOn: '2026-09-06',
} as const

const ALGERIA = {
  countryCode: 'DZ',
  tripCount: 0,
  placeCount: 0,
  firstTripOn: null,
  lastTripOn: null,
} as const

/**
 * The case the whole visit half exists for, and the shape most of a real record
 * takes: a country the traveller marked by hand, three times, with no trip in
 * this product behind any of them.
 */
const THAILAND = {
  countryCode: 'TH',
  tripCount: 0,
  placeCount: 0,
  firstTripOn: null,
  lastTripOn: null,
  visitCount: 3,
  firstVisitedOn: '2011-07-14',
  lastVisitedOn: '2024-09-06',
} as const

describe('countryFactCount', () => {
  it('passes a whole count through untouched', () => {
    expect(countryFactCount(0)).toBe(0)
    expect(countryFactCount(17)).toBe(17)
  })

  it('never prints a negative count', () => {
    expect(countryFactCount(-1)).toBe(0)
    expect(countryFactCount(-9999)).toBe(0)
  })

  it('truncates rather than rounds, so a fraction never invents a trip', () => {
    expect(countryFactCount(0.9)).toBe(0)
    expect(countryFactCount(2.6)).toBe(2)
  })

  it('survives a broken aggregate', () => {
    expect(countryFactCount(Number.NaN)).toBe(0)
    expect(countryFactCount(Number.POSITIVE_INFINITY)).toBe(0)
  })
})

describe('countryFactMonth', () => {
  /**
   * The regression this module exists for. `Intl.DateTimeFormat` shortens
   * September to `Sept` in workerd and `Sep` in WebKit, which made every
   * September date on a server-rendered atlas a hydration error in Safari. The
   * assertion is on the exact characters, not on a substring.
   */
  it('prints September the same way on every runtime', () => {
    expect(countryFactMonth('2026-09-06').value).toBe('September 2026')
    expect(countryFactMonth('2026-09-30').value).toBe('September 2026')
  })

  it('coarsens a day column to its month', () => {
    expect(countryFactMonth('2011-03-19').value).toBe('March 2011')
  })

  it('carries a machine-readable year and month', () => {
    expect(countryFactMonth('2026-09-06').iso).toBe('2026-09')
    expect(countryFactMonth('2004-01-02').iso).toBe('2004-01')
  })

  /**
   * The long month name is the other half of the same rule. `Sept` and `Sep`
   * differ between ICU builds; `September` does not, in any runtime this app
   * renders in. Sweeping all twelve pins the whole set rather than the one
   * month that has already burned us, so a future formatter that quietly
   * abbreviates fails here instead of on a reader's Safari.
   */
  it('spells every month out in full, on every runtime', () => {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]
    months.forEach((name, index) => {
      const column = `2026-${String(index + 1).padStart(2, '0')}-15`
      expect(countryFactMonth(column).value).toBe(`${name} 2026`)
    })
  })

  /**
   * The printed month and the `<time dateTime>` beside it are two readings of
   * one column, and a card whose eye and whose machine disagree about which
   * month a trip fell in is worse than one that prints nothing. The pairs below
   * are the three ways they could come apart: the two ends of a year, and an
   * instant sitting either side of midnight UTC.
   */
  it('never lets the printed month and its machine form disagree', () => {
    const pairs = [
      ['2026-01-01', 'January 2026', '2026-01'],
      ['2026-12-31', 'December 2026', '2026-12'],
      ['2026-09-30T23:30:00.000Z', 'September 2026', '2026-09'],
    ] as const
    for (const [column, value, iso] of pairs) {
      expect(countryFactMonth(column)).toEqual({
        value,
        iso,
      })
    }
  })

  /**
   * A stored day is a day, not an instant: `2026-10-01` in Auckland and the
   * same column read in Los Angeles are the same trip. Coarsening by the
   * reader's clock would slide a September trip into October for half the
   * planet, so the date portion is taken literally and the offset is ignored.
   */
  it('does not let a timezone offset move a trip into another month', () => {
    expect(countryFactMonth('2026-10-01T00:30:00+02:00')).toEqual({
      value: 'October 2026',
      iso: '2026-10',
    })
  })

  it('accepts a full instant as readily as a day column', () => {
    expect(countryFactMonth('2026-10-02T09:30:00.000Z')).toEqual({
      value: 'October 2026',
      iso: '2026-10',
    })
  })

  it('reports nothing for an unusable column', () => {
    for (const value of [null, undefined, '', '2011-13-45', 'yesterday']) {
      expect(countryFactMonth(value)).toEqual({
        value: null,
        iso: null,
      })
    }
  })
})

describe('countryFacts', () => {
  it('resolves the name from the frozen table, not from the platform', () => {
    expect(countryFacts(FRANCE).name).toBe('France')
    expect(countryFacts({ ...FRANCE, countryCode: 'dz' }).name).toBe('Algeria')
  })

  it('normalises the code it was handed', () => {
    expect(countryFacts({ ...FRANCE, countryCode: ' fr ' }).code).toBe('FR')
  })

  it('falls back to the code itself when nothing names it', () => {
    const facts = countryFacts({ ...FRANCE, countryCode: 'ZZ' })
    expect(facts.code).toBe('ZZ')
    expect(facts.name).toBe('ZZ')
  })

  it('prints both figures grouped', () => {
    const facts = countryFacts({ ...FRANCE, tripCount: 1204, placeCount: 12 })
    expect(facts.tally.value).toBe('1,204')
    expect(facts.places.value).toBe('12')
  })

  /**
   * The catalogue is the only copy source. A noun, a unit or a spoken sentence
   * added back here would be an English path nothing translates, so the shape
   * is pinned to structured facts.
   */
  it('returns structured facts and no wording', () => {
    const facts = countryFacts(FRANCE)
    expect(Object.keys(facts).sort()).toEqual([
      'code',
      'first',
      'last',
      'name',
      'places',
      'source',
      'tally',
      'visited',
    ])
    expect(Object.keys(facts.tally).sort()).toEqual(['count', 'value'])
    expect(Object.keys(facts.places).sort()).toEqual(['count', 'value'])
    expect(Object.keys(facts.first).sort()).toEqual(['iso', 'value'])
    expect(Object.keys(facts.last).sort()).toEqual(['iso', 'value'])
  })

  it('carries both months through the pinned formatter', () => {
    const facts = countryFacts(FRANCE)
    expect(facts.first.value).toBe('July 2019')
    expect(facts.last.value).toBe('September 2026')
  })

  describe('a country with nothing recorded', () => {
    it('reports zero rather than an absence', () => {
      const facts = countryFacts(ALGERIA)
      expect(facts.tally.value).toBe('0')
      expect(facts.places.value).toBe('0')
      expect(facts.visited).toBe(false)
    })

    it('leaves both months genuinely null', () => {
      const facts = countryFacts(ALGERIA)
      expect(facts.first.value).toBeNull()
      expect(facts.first.iso).toBeNull()
      expect(facts.last.value).toBeNull()
      expect(facts.last.iso).toBeNull()
    })

    it('names the state, so a card can style it without re-deriving it', () => {
      expect(countryFacts(ALGERIA).source).toBe('none')
    })
  })

  /**
   * The defect this module was widened for. The map fills a country because it
   * is on the visit record, and a card that reads only the trip aggregates then
   * prints two zeros and two dashes over a country the same screen has just
   * painted as visited — while the shelf two hundred pixels below prints its
   * visit tally. Most of a real record is in exactly this state.
   */
  describe('a country visited with no trip behind it', () => {
    it('draws its figures from the visit record instead', () => {
      const facts = countryFacts(THAILAND)
      expect(facts.source).toBe('visits')
      expect(facts.tally.count).toBe(3)
      expect(facts.tally.value).toBe('3')
    })

    it('prints both visit months rather than two dashes', () => {
      const facts = countryFacts(THAILAND)
      expect(facts.first.value).toBe('July 2011')
      expect(facts.last.value).toBe('September 2024')
      expect(facts.last.iso).toBe('2024-09')
    })

    it('counts as visited, which is what the map is already painting', () => {
      expect(countryFacts(THAILAND).visited).toBe(true)
    })

    it('still prints the places it has, in their own cell', () => {
      const facts = countryFacts({ ...THAILAND, placeCount: 4 })
      expect(facts.places.value).toBe('4')
      expect(facts.source).toBe('visits')
    })

    it('is honest when the tally is there and the dates are not', () => {
      const facts = countryFacts({
        ...THAILAND,
        firstVisitedOn: null,
        lastVisitedOn: null,
      })
      expect(facts.source).toBe('visits')
      expect(facts.tally.value).toBe('3')
      expect(facts.first.value).toBeNull()
      expect(facts.last.value).toBeNull()
    })
  })

  /**
   * The mirror rule. An itinerary is the more specific thing to know, so a
   * country that has one keeps the trip reading exactly as it was before the
   * visit columns existed — the visits are still true, and the atlas panel's
   * country record is where they are written out in full.
   */
  describe('a country with both records', () => {
    it('reads from the trips and leaves the visit tally to the shelf', () => {
      const facts = countryFacts({
        ...FRANCE,
        tripCount: 1,
        placeCount: 4,
        firstTripOn: '2026-08-03',
        lastTripOn: '2026-08-03',
        visitCount: 2,
        firstVisitedOn: '2019-09-21',
        lastVisitedOn: '2026-08-17',
      })
      expect(facts.source).toBe('trips')
      expect(facts.tally.value).toBe('1')
      expect(facts.first.value).toBe('August 2026')
      expect(facts.last.value).toBe('August 2026')
    })

    it('prefers a trip date even with no trip counted against it', () => {
      const facts = countryFacts({
        ...THAILAND,
        firstTripOn: '2026-02-01',
        lastTripOn: '2026-02-01',
      })
      expect(facts.source).toBe('trips')
      expect(facts.tally.value).toBe('0')
      expect(facts.first.value).toBe('February 2026')
    })

    it('does not let a saved place alone choose the trip reading', () => {
      const facts = countryFacts({ ...THAILAND, placeCount: 2 })
      expect(facts.source).toBe('visits')
      expect(facts.first.value).toBe('July 2011')
    })
  })

  describe('visited', () => {
    it('is true on a trip alone', () => {
      expect(countryFacts({ ...ALGERIA, tripCount: 1 }).visited).toBe(true)
    })

    it('is true on a recorded visit alone', () => {
      expect(countryFacts({ ...ALGERIA, visitCount: 1 }).visited).toBe(true)
    })

    it('is true on a visit date alone', () => {
      expect(
        countryFacts({ ...ALGERIA, firstVisitedOn: '2024-09-06' }).visited,
      ).toBe(true)
    })

    it('is true on a saved place alone', () => {
      expect(countryFacts({ ...ALGERIA, placeCount: 1 }).visited).toBe(true)
    })

    it('is true on a recorded date alone', () => {
      expect(
        countryFacts({ ...ALGERIA, firstTripOn: '2026-09-06' }).visited,
      ).toBe(true)
    })
  })
})

describe('the absent-value mark', () => {
  it('is an em dash', () => {
    expect(ABSENT_FACT_MARK).toBe('—')
  })
})

/**
 * The projection every surface spreads.
 *
 * The four-dash card came from a host picking four of a record's columns by
 * hand, so the reading is written down once and asserted here on the three
 * states a record can be in.
 */
describe('countryFactColumns', () => {
  /** France as the demo workspace seeds it: three visits, no itinerary. */
  const VISITED_RECORD = {
    countryCode: 'FR',
    tripCount: 0,
    visitedPlaceCount: 0,
    firstTripOn: null,
    lastTripOn: null,
    visitCount: 3,
    firstVisitedOn: '2011-07-14',
    lastVisitedOn: '2024-09-06',
  } as const

  it('carries the visit half across, which is the half that used to be dropped', () => {
    expect(countryFactColumns(VISITED_RECORD)).toEqual({
      countryCode: 'FR',
      tripCount: 0,
      placeCount: 0,
      firstTripOn: null,
      lastTripOn: null,
      visitCount: 3,
      firstVisitedOn: '2011-07-14',
      lastVisitedOn: '2024-09-06',
    })
  })

  it('reads a visit-only record as visits and visit months', () => {
    const facts = countryFacts(countryFactColumns(VISITED_RECORD))
    expect(facts.source).toBe('visits')
    expect(facts.visited).toBe(true)
    expect(facts.tally).toMatchObject({ count: 3, value: '3' })
    expect(facts.first.value).toBe('July 2011')
    expect(facts.last.value).toBe('September 2024')
  })

  it('leaves a record with an itinerary on the trip reading', () => {
    const facts = countryFacts(
      countryFactColumns({
        ...VISITED_RECORD,
        countryCode: 'PT',
        tripCount: 1,
        visitedPlaceCount: 4,
        firstTripOn: '2026-08-17',
        lastTripOn: '2026-08-17',
      }),
    )
    expect(facts.source).toBe('trips')
    expect(facts.tally).toMatchObject({ count: 1, value: '1' })
    expect(facts.places.value).toBe('4')
    expect(facts.first.value).toBe('August 2026')
  })

  it('reads an empty row as the state that has earned its dashes', () => {
    const facts = countryFacts(
      countryFactColumns({
        countryCode: 'DZ',
        tripCount: 0,
        visitedPlaceCount: 0,
        firstTripOn: null,
        lastTripOn: null,
        visitCount: 0,
        firstVisitedOn: null,
        lastVisitedOn: null,
      }),
    )
    expect(facts.source).toBe('none')
    expect(facts.visited).toBe(false)
    expect(facts.first.value).toBeNull()
    expect(facts.last.value).toBeNull()
  })

  it('renames only the places column, and folds no figure into another', () => {
    const columns = countryFactColumns({
      ...VISITED_RECORD,
      tripCount: 2,
      visitedPlaceCount: 7,
    })
    expect(columns.placeCount).toBe(7)
    expect(columns.tripCount).toBe(2)
    expect(columns.visitCount).toBe(3)
  })
})
