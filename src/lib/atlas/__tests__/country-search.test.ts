import { describe, expect, it } from 'vitest'

import { COUNTRY_NAMES } from '../country-names'
import {
  COUNTRY_SEARCH_LIMIT,
  countrySearchEntries,
  foldForSearch,
  searchCountries,
} from '../country-search'

import type { CountrySearchVisit } from '../country-search'

function visit(
  countryCode: string,
  overrides: Partial<CountrySearchVisit> = {},
): CountrySearchVisit {
  return {
    countryCode,
    continent: 'Europe',
    firstVisitedOn: '2019-04-02',
    lastVisitedOn: '2024-09-06',
    visitCount: 2,
    ...overrides,
  }
}

/** The codes a query answers with, in the order they came back. */
function codes(
  entries: ReturnType<typeof countrySearchEntries>,
  query: string,
  limit = COUNTRY_SEARCH_LIMIT,
): Array<string> {
  return searchCountries(entries, query, { limit }).matches.map(
    (match) => match.entry.code,
  )
}

describe('foldForSearch', () => {
  it('folds diacritics, case and spacing into one alphabet', () => {
    expect(foldForSearch('Côte d’Ivoire')).toBe("COTE D'IVOIRE")
    expect(foldForSearch('  são   tomé ')).toBe('SAO TOME')
    expect(foldForSearch('Türkiye')).toBe('TURKIYE')
    expect(foldForSearch('Åland')).toBe('ALAND')
    expect(foldForSearch('Curaçao')).toBe('CURACAO')
  })

  it('straightens every apostrophe a reader might type', () => {
    expect(foldForSearch('d’ivoire')).toBe(foldForSearch("d'ivoire"))
    expect(foldForSearch('d‘ivoire')).toBe(foldForSearch("d'ivoire"))
  })

  it('is idempotent, so a folded string folds to itself', () => {
    const once = foldForSearch('Côte d’Ivoire')
    expect(foldForSearch(once)).toBe(once)
  })
})

describe('countrySearchEntries', () => {
  it('indexes the whole world, not only the record', () => {
    const entries = countrySearchEntries([visit('JP')])
    expect(entries).toHaveLength(Object.keys(COUNTRY_NAMES).length)
    expect(entries.filter((entry) => entry.visited)).toHaveLength(1)
  })

  it('carries the record row through onto its entry', () => {
    const entries = countrySearchEntries([visit('JP', { visitCount: 7 })])
    const japan = entries.find((entry) => entry.code === 'JP')
    expect(japan?.visited).toBe(true)
    expect(japan?.visit?.visitCount).toBe(7)
    expect(entries.find((entry) => entry.code === 'PT')?.visit).toBeNull()
  })

  it('normalises a padded, lower-case column', () => {
    const entries = countrySearchEntries([visit(' pt ')])
    expect(entries.find((entry) => entry.code === 'PT')?.visited).toBe(true)
  })

  it('keeps a code the name table does not know', () => {
    const entries = countrySearchEntries([visit('ZZ')])
    const unknown = entries.find((entry) => entry.code === 'ZZ')
    // Named by its own code rather than dropped: a row that exists has to be
    // findable, and the only handle it has left is the code itself.
    expect(unknown?.name).toBe('ZZ')
    expect(unknown?.visited).toBe(true)
  })

  it('takes the first of two rows for one country', () => {
    const entries = countrySearchEntries([
      visit('FR', { visitCount: 3 }),
      visit('FR', { visitCount: 99 }),
    ])
    expect(
      entries
        .filter((entry) => entry.code === 'FR')
        .map((e) => e.visit?.visitCount),
    ).toEqual([3])
  })

  it('folds the name into a key and its words', () => {
    const entries = countrySearchEntries([])
    const ivory = entries.find((entry) => entry.code === 'CI')
    expect(ivory?.key).toBe("COTE D'IVOIRE")
    expect(ivory?.words).toEqual(['COTE', 'D', 'IVOIRE'])
  })

  it('files an accented name under its unaccented letter', () => {
    const entries = countrySearchEntries([])
    const order = entries.map((entry) => entry.code)
    // Côte d'Ivoire sorts among the Cs, not after Z.
    expect(order.indexOf('CI')).toBeGreaterThan(order.indexOf('CA'))
    expect(order.indexOf('CI')).toBeLessThan(order.indexOf('ZW'))
  })
})

describe('searchCountries', () => {
  const entries = countrySearchEntries([
    visit('MT'),
    visit('ID', { continent: 'Asia' }),
    visit('FR'),
  ])

  it('answers a blank query with the record, in name order', () => {
    const outcome = searchCountries(entries, '')
    expect(outcome.matches.map((match) => match.entry.code)).toEqual([
      'FR',
      'ID',
      'MT',
    ])
    expect(outcome.matches.every((match) => match.kind === 'record')).toBe(true)
    expect(outcome.total).toBe(3)
    expect(outcome.query).toBe('')
  })

  it('treats whitespace as a blank query', () => {
    expect(searchCountries(entries, '   ').total).toBe(3)
  })

  it('answers a blank query with the whole record, past the typed cap', () => {
    // The shipped demo record holds twelve countries — two more than a typed
    // query hands back. Every one of them has to be there: a country the reader
    // has been to that their own field cannot list is the defect this pins.
    const twelve = countrySearchEntries(
      [
        'GB',
        'FR',
        'IT',
        'ES',
        'PT',
        'IS',
        'AT',
        'JP',
        'TH',
        'MA',
        'US',
        'AR',
      ].map((code) => visit(code)),
    )
    const outcome = searchCountries(twelve, '')
    expect(outcome.matches).toHaveLength(12)
    expect(outcome.total).toBe(12)
    expect(outcome.matches.length).toBeGreaterThan(COUNTRY_SEARCH_LIMIT)
    // Still name-ordered, and still every code that was handed in.
    expect(outcome.matches.map((match) => match.entry.code)).toEqual([
      'AR',
      'AT',
      'FR',
      'IS',
      'IT',
      'JP',
      'MA',
      'PT',
      'ES',
      'TH',
      'GB',
      'US',
    ])
  })

  it('leaves the record uncapped even when a typed limit is named', () => {
    const outcome = searchCountries(entries, '', { limit: 1 })
    expect(outcome.matches).toHaveLength(3)
    expect(outcome.total).toBe(3)
  })

  it('caps the record only when asked, and still counts it in full', () => {
    const outcome = searchCountries(entries, '', { recordLimit: 2 })
    expect(outcome.matches.map((match) => match.entry.code)).toEqual([
      'FR',
      'ID',
    ])
    expect(outcome.total).toBe(3)
  })

  it('finds an accented country from unaccented typing, and back', () => {
    expect(codes(entries, 'cote')).toContain('CI')
    expect(codes(entries, 'côte')).toContain('CI')
    expect(codes(entries, 'IVOIRE')).toContain('CI')
    expect(codes(entries, 'turkiye')).toContain('TR')
    expect(codes(entries, 'türkiye')).toContain('TR')
    expect(codes(entries, 'sao tome')).toContain('ST')
  })

  it('ranks a name prefix above a substring', () => {
    const answer = codes(entries, 'mal')
    // Malawi, Malaysia, Maldives, Mali, Malta all start with it; Guatemala only
    // contains it, so it cannot outrank any of them.
    const guatemala = answer.indexOf('GT')
    expect(guatemala).toBeGreaterThan(-1)
    for (const code of ['MW', 'MY', 'MV', 'ML', 'MT']) {
      expect(answer.indexOf(code), code).toBeLessThan(guatemala)
    }
  })

  it('ranks a word inside the name above a substring of it', () => {
    const answer = codes(entries, 'guinea')
    // Guinea and Guinea-Bissau lead on the name itself, then the countries whose
    // *second* word is Guinea, and Guinea-Bissau's own hyphenated word never
    // lets Papua New Guinea overtake it.
    expect(answer.slice(0, 2)).toEqual(['GN', 'GW'])
    expect(answer).toContain('PG')
    expect(answer).toContain('GQ')
  })

  it('answers an exact ISO2 code before anything the letters spell', () => {
    // Australia, Austria, Belarus, Cyprus, Mauritius and Russia all contain
    // "us"; only one country *is* US.
    expect(codes(entries, 'us')[0]).toBe('US')
    expect(codes(entries, 'US')[0]).toBe('US')
    expect(codes(entries, ' us ')[0]).toBe('US')
  })

  it('lets the code win even over a visited country that starts with it', () => {
    // Indonesia is on the record and its name starts with the query; IN is
    // still India, because a code is an unambiguous request.
    const answer = codes(entries, 'in')
    expect(answer[0]).toBe('IN')
    expect(answer).toContain('ID')
    expect(answer.indexOf('IN')).toBeLessThan(answer.indexOf('ID'))
  })

  it('ranks a visited country above an unvisited one in the same tier', () => {
    // Malta is on the record, Malawi is not, and alphabetically Malawi is first.
    const answer = codes(entries, 'malt')
    expect(answer[0]).toBe('MT')

    const same = codes(entries, 'mal')
    expect(same.indexOf('MT')).toBeLessThan(same.indexOf('MW'))
  })

  it('does not let the record outrank a stronger reason to match', () => {
    // Guatemala is on the record and only *contains* "mal". Malawi is not on it
    // at all and starts with it, so Malawi still comes first: the reader is
    // typing to narrow, not to be shown their own countries whatever they type.
    const withGuatemala = countrySearchEntries([visit('GT')])
    const answer = codes(withGuatemala, 'mal')
    expect(answer.indexOf('MW')).toBeLessThan(answer.indexOf('GT'))
  })

  it('names the reason each country matched', () => {
    const kinds = new Map(
      searchCountries(entries, 'gui').matches.map((match) => [
        match.entry.code,
        match.kind,
      ]),
    )
    expect(kinds.get('GN')).toBe('name')
    expect(kinds.get('PG')).toBe('word')
    expect(searchCountries(entries, 'jp').matches[0]?.kind).toBe('code')
    expect(searchCountries(entries, 'ustr').matches[0]?.kind).toBe('contains')
  })

  it('says nothing matched rather than guessing', () => {
    const outcome = searchCountries(entries, 'qqqq')
    expect(outcome.matches).toEqual([])
    expect(outcome.total).toBe(0)
    expect(outcome.query).toBe('QQQQ')
  })

  it('caps the rows and still reports the true total', () => {
    const outcome = searchCountries(entries, 'a', { limit: 4 })
    expect(outcome.matches).toHaveLength(4)
    expect(outcome.total).toBeGreaterThan(4)
  })

  it('caps at ten by default', () => {
    expect(searchCountries(entries, 'a').matches.length).toBe(
      COUNTRY_SEARCH_LIMIT,
    )
  })

  it('gives the same query the same answer every time', () => {
    const first = codes(entries, 'gui')
    const second = codes(
      countrySearchEntries([visit('MT'), visit('ID'), visit('FR')]),
      'gui',
    )
    expect(second).toEqual(first)
  })
})
