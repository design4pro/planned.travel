import { describe, expect, it } from 'vitest'

import {
  ABSENT_FACT_LABEL,
  ABSENT_FACT_MARK,
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
    expect(facts.trips.value).toBe('1,204')
    expect(facts.places.value).toBe('12')
  })

  it('agrees the unit with the count', () => {
    const one = countryFacts({ ...FRANCE, tripCount: 1, placeCount: 1 })
    expect(one.trips.label).toBe('Trip')
    expect(one.places.label).toBe('Place')

    const many = countryFacts({ ...FRANCE, tripCount: 2, placeCount: 0 })
    expect(many.trips.label).toBe('Trips')
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
      expect(facts.trips.value).toBe('0')
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
  })

  describe('visited', () => {
    it('is true on a trip alone', () => {
      expect(countryFacts({ ...ALGERIA, tripCount: 1 }).visited).toBe(true)
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
