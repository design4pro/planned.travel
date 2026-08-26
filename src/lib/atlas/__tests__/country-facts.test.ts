import { describe, expect, it } from 'vitest'

import {
  ABSENT_FACT_LABEL,
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
    expect(countryFactMonth('First trip', '2026-09-06').value).toBe(
      'September 2026',
    )
    expect(countryFactMonth('First trip', '2026-09-30').value).toBe(
      'September 2026',
    )
  })

  it('coarsens a day column to its month', () => {
    expect(countryFactMonth('Last trip', '2011-03-19').value).toBe('March 2011')
  })

  it('carries a machine-readable year and month', () => {
    expect(countryFactMonth('First trip', '2026-09-06').iso).toBe('2026-09')
    expect(countryFactMonth('First trip', '2004-01-02').iso).toBe('2004-01')
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
      expect(countryFactMonth('First trip', column).value).toBe(`${name} 2026`)
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
      expect(countryFactMonth('Last trip', column)).toEqual({
        label: 'Last trip',
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
    expect(countryFactMonth('First trip', '2026-10-01T00:30:00+02:00')).toEqual(
      {
        label: 'First trip',
        value: 'October 2026',
        iso: '2026-10',
      },
    )
  })

  it('accepts a full instant as readily as a day column', () => {
    expect(countryFactMonth('Last trip', '2026-10-02T09:30:00.000Z')).toEqual({
      label: 'Last trip',
      value: 'October 2026',
      iso: '2026-10',
    })
  })

  it('keeps the label and reports nothing for an unusable column', () => {
    for (const value of [null, undefined, '', '2011-13-45', 'yesterday']) {
      expect(countryFactMonth('First trip', value)).toEqual({
        label: 'First trip',
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

  it('agrees the unit with the count', () => {
    const one = countryFacts({ ...FRANCE, tripCount: 1, placeCount: 1 })
    expect(one.tally.label).toBe('Trip')
    expect(one.places.label).toBe('Place')

    const many = countryFacts({ ...FRANCE, tripCount: 2, placeCount: 0 })
    expect(many.tally.label).toBe('Trips')
    expect(many.places.label).toBe('Places')
  })

  it('heads the two date columns consistently', () => {
    const facts = countryFacts(FRANCE)
    expect(facts.first.label).toBe('First trip')
    expect(facts.last.label).toBe('Last trip')
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

    it('says so in words a reader can hear', () => {
      expect(countryFacts(ALGERIA).summary).toBe(
        'Algeria. No trips yet, no places saved. No trip dates recorded.',
      )
    })

    it('names the state, so a card can style it without re-deriving it', () => {
      expect(countryFacts(ALGERIA).source).toBe('none')
    })

    it('keeps the trip wording, which is what an empty card should offer', () => {
      const facts = countryFacts(ALGERIA)
      expect(facts.tally.label).toBe('Trips')
      expect(facts.first.label).toBe('First trip')
      expect(facts.last.label).toBe('Last trip')
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
      expect(facts.tally.label).toBe('Visits')
      expect(facts.tally.count).toBe(3)
      expect(facts.tally.value).toBe('3')
    })

    it('prints both visit months rather than two dashes', () => {
      const facts = countryFacts(THAILAND)
      expect(facts.first.label).toBe('First visit')
      expect(facts.first.value).toBe('July 2011')
      expect(facts.last.label).toBe('Last visit')
      expect(facts.last.value).toBe('September 2024')
      expect(facts.last.iso).toBe('2024-09')
    })

    it('counts as visited, which is what the map is already painting', () => {
      expect(countryFacts(THAILAND).visited).toBe(true)
    })

    it('agrees the unit with the tally', () => {
      const one = countryFacts({ ...THAILAND, visitCount: 1 })
      expect(one.tally.label).toBe('Visit')
    })

    it('still prints the places it has, in their own cell', () => {
      const facts = countryFacts({ ...THAILAND, placeCount: 4 })
      expect(facts.places.value).toBe('4')
      expect(facts.source).toBe('visits')
    })

    it('speaks in visits, not in trips', () => {
      expect(countryFacts(THAILAND).summary).toBe(
        'Thailand. 3 visits, no places saved. First visit July 2011, last visit September 2024.',
      )
    })

    it('says a single month once', () => {
      const facts = countryFacts({
        ...THAILAND,
        visitCount: 1,
        firstVisitedOn: '2017-11-08',
        lastVisitedOn: '2017-11-08',
      })
      expect(facts.summary).toBe(
        'Thailand. 1 visit, no places saved. Visited in November 2017.',
      )
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
      expect(facts.summary).toBe(
        'Thailand. 3 visits, no places saved. No visit dates recorded.',
      )
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
      expect(facts.tally.label).toBe('Trip')
      expect(facts.tally.value).toBe('1')
      expect(facts.first.label).toBe('First trip')
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

    it('does not let a saved place alone choose the trip wording', () => {
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

  describe('summary', () => {
    it('folds the whole card into one sentence', () => {
      expect(countryFacts(FRANCE).summary).toBe(
        'France. 3 trips, 12 places. First trip July 2019, last trip September 2026.',
      )
    })

    it('never reads the same month out twice', () => {
      const facts = countryFacts({
        ...FRANCE,
        tripCount: 1,
        placeCount: 1,
        firstTripOn: '2026-10-02',
        lastTripOn: '2026-10-09',
      })
      expect(facts.summary).toBe(
        'France. 1 trip, 1 place. Travelled in October 2026.',
      )
    })

    it('is honest about a half-recorded span', () => {
      expect(countryFacts({ ...FRANCE, lastTripOn: null }).summary).toBe(
        'France. 3 trips, 12 places. First trip July 2019, last trip not recorded.',
      )
      expect(countryFacts({ ...FRANCE, firstTripOn: null }).summary).toBe(
        'France. 3 trips, 12 places. First trip not recorded, last trip September 2026.',
      )
    })
  })
})

describe('the absent-value pair', () => {
  it('is an em dash and the words that stand in for it', () => {
    expect(ABSENT_FACT_MARK).toBe('—')
    expect(ABSENT_FACT_LABEL).toBe('Not recorded')
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
    expect(facts.tally).toMatchObject({ label: 'Visits', value: '3' })
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
    expect(facts.tally).toMatchObject({ label: 'Trip', value: '1' })
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
