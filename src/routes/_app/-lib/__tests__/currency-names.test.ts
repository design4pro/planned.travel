import { describe, expect, it } from 'vitest'

import { CURRENCY_OPTIONS } from '#/lib/money'
import { createTranslator } from '#/lib/i18n/catalogue'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import PlSettings from '#/lib/i18n/messages/pl/settings'
import EnSettings from '#/lib/i18n/messages/en/settings'
import {
  currencyName,
  openedCurrencyLabel,
  openedCurrencyOptions,
  platformCurrencyName,
} from '../currency-names'

const pl = createTranslator('pl', namespaceCatalogue('settings', PlSettings))
const en = createTranslator('en', namespaceCatalogue('settings', EnSettings))

describe('currencyName', () => {
  it('reads a catalogued code from the reader’s catalogue', () => {
    expect(currencyName(pl, 'EUR')).toBe('euro')
    expect(currencyName(pl, 'PLN')).toBe('złoty polski')
  })

  it('returns the bare code for one the catalogue does not name', () => {
    expect(currencyName(pl, 'HUF')).toBe('HUF')
  })
})

describe('platformCurrencyName', () => {
  it('writes an uncatalogued code in the reader’s language', () => {
    expect(platformCurrencyName('pl', 'HUF')).toMatch(/forint/i)
  })

  it('falls back to the code when the platform cannot name it', () => {
    expect(platformCurrencyName('pl', 'not-a-code')).toBe('not-a-code')
  })
})

describe('openedCurrencyLabel', () => {
  it('prints the code, then the catalogue name where there is one', () => {
    expect(openedCurrencyLabel(pl, 'pl', 'EUR')).toBe('EUR — euro')
  })

  it('prints the platform name for a code the catalogue lacks', () => {
    expect(openedCurrencyLabel(pl, 'pl', 'HUF')).toMatch(/^HUF — .*forint/i)
  })
})

describe('openedCurrencyOptions', () => {
  it('keeps the code as the label and puts the reader’s name in the description', () => {
    const options = openedCurrencyOptions(pl, 'pl', ['EUR', 'HUF'])

    expect(options[0]).toEqual({
      value: 'EUR',
      label: 'EUR',
      description: 'euro',
    })
    expect(options[1]?.label).toBe('HUF')
    expect(options[1]?.description).toMatch(/forint/i)
    expect(options[1]?.description).not.toBe('Hungarian forint')
  })

  it('leaves the description out when no name exists, rather than repeating the code', () => {
    expect(openedCurrencyOptions(en, 'en', ['ZZZ'])).toEqual([
      { value: 'ZZZ', label: 'ZZZ' },
    ])
  })

  it('names every currency the pickers offer in the reader’s language', () => {
    const offered = CURRENCY_OPTIONS.map((entry) => entry.code)
    const options = openedCurrencyOptions(pl, 'pl', offered)

    expect(options.map((option) => option.value)).toEqual(offered)
    for (const option of options) {
      expect(option.description, option.value).toBeTruthy()
    }
  })
})
