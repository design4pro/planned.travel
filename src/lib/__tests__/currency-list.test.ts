import { describe, expect, it } from 'vitest'

import {
  FAVOURITE_CURRENCIES,
  currencyMatches,
  mergeCurrencies,
  platformCurrencyCodes,
} from '../currency-list'

describe('mergeCurrencies', () => {
  it('leads with the favourites, in their curated order', () => {
    expect(mergeCurrencies(['ZAR', 'NOK']).slice(0, 9)).toEqual([
      ...FAVOURITE_CURRENCIES,
    ])
  })

  it('lists a favourite once even when the runtime set carries it', () => {
    const merged = mergeCurrencies(['USD', 'EUR', 'NOK', 'NOK', 'ZAR'])
    expect(merged.filter((code) => code === 'USD')).toHaveLength(1)
    expect(merged.filter((code) => code === 'NOK')).toHaveLength(1)
    expect(merged.slice(9)).toEqual(['NOK', 'ZAR'])
  })

  it('degrades to the favourites alone when the platform list is absent', () => {
    expect(mergeCurrencies([])).toEqual([...FAVOURITE_CURRENCIES])
  })

  it('keeps a stored code the platform does not know selectable', () => {
    expect(mergeCurrencies([], 'xyz').at(-1)).toBe('XYZ')
  })
})

describe('currencyMatches', () => {
  it('matches on the code, ignoring case', () => {
    expect(currencyMatches('NOK', 'Norwegian krone', 'nok')).toBe(true)
  })

  it('matches on the name', () => {
    expect(currencyMatches('NOK', 'Norwegian krone', 'krone')).toBe(true)
  })

  it('refuses what neither carries', () => {
    expect(currencyMatches('NOK', 'Norwegian krone', 'zloty')).toBe(false)
  })

  it('matches everything for a blank query', () => {
    expect(currencyMatches('NOK', 'Norwegian krone', '  ')).toBe(true)
  })
})

describe('platformCurrencyCodes', () => {
  it('answers nothing, not an error, when the runtime cannot', () => {
    const original = Intl.supportedValuesOf
    Intl.supportedValuesOf = () => {
      throw new RangeError('unsupported')
    }
    try {
      expect(platformCurrencyCodes()).toEqual([])
    } finally {
      Intl.supportedValuesOf = original
    }
  })
})
