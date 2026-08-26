import { describe, expect, it } from 'vitest'

import { LOCALE_TAGS } from '../locales'
import { plural, pluralCategories } from '../plural'

/**
 * `Intl.PluralRules` is the one locale-dependent platform call this directory
 * makes, and `docs/SPEC.md` §8.5 only permits that where the runtimes have been
 * proven to agree. These expectations are the CLDR rules written out, so the
 * test fails if a runtime ever answers differently rather than quietly
 * inheriting whatever ICU it was built against.
 */
describe('plural categories', () => {
  it('gives Arabic all six categories', () => {
    expect(plural('ar', 0)).toBe('zero')
    expect(plural('ar', 1)).toBe('one')
    expect(plural('ar', 2)).toBe('two')
    expect(plural('ar', 3)).toBe('few')
    expect(plural('ar', 11)).toBe('many')
    expect(plural('ar', 100)).toBe('other')
    expect([...pluralCategories('ar')].sort()).toEqual([
      'few',
      'many',
      'one',
      'other',
      'two',
      'zero',
    ])
  })

  it('splits Slavic counts into one/few/many/other', () => {
    for (const locale of ['pl', 'cs', 'ru', 'uk'] as const) {
      expect(plural(locale, 1)).toBe('one')
      expect(plural(locale, 3)).toBe('few')
      expect([...pluralCategories(locale)].sort()).toContain('many')
    }
    // Where the four diverge: Czech files fractions under `many`, and the East
    // Slavic pair files 5 and 11 there while Polish agrees on 5 but not on 22.
    expect(plural('pl', 5)).toBe('many')
    expect(plural('pl', 22)).toBe('few')
    expect(plural('cs', 5)).toBe('other')
    expect(plural('cs', 1.5)).toBe('many')
    expect(plural('ru', 5)).toBe('many')
    expect(plural('ru', 11)).toBe('many')
    expect(plural('ru', 22)).toBe('few')
    expect(plural('uk', 5)).toBe('many')
    expect(plural('uk', 21)).toBe('one')
  })

  it('gives the count-blind languages one category and only one', () => {
    for (const locale of [
      'id',
      'ja',
      'ko',
      'vi',
      'zh-Hans',
      'zh-Hant',
    ] as const) {
      expect(pluralCategories(locale)).toEqual(['other'])
      for (const count of [0, 1, 2, 5, 11, 21, 100, 1.5]) {
        expect(plural(locale, count)).toBe('other')
      }
    }
  })

  it('follows the Romance rule where zero and one share a form', () => {
    expect(plural('fr', 0)).toBe('one')
    expect(plural('fr', 1)).toBe('one')
    expect(plural('fr', 2)).toBe('other')
    expect(plural('pt-BR', 0)).toBe('one')
    expect(plural('pt-BR', 2)).toBe('other')
    // English and its Germanic neighbours do not.
    expect(plural('en', 0)).toBe('other')
    expect(plural('de', 0)).toBe('other')
    expect(plural('es', 0)).toBe('other')
  })

  it('resolves a category for every locale we ship', () => {
    for (const locale of LOCALE_TAGS) {
      const categories = pluralCategories(locale)
      expect(categories).toContain('other')
      for (const count of [0, 1, 2, 3, 5, 11, 21, 100]) {
        expect(categories).toContain(plural(locale, count))
      }
    }
  })

  it('folds a broken count to `other` instead of throwing mid-render', () => {
    expect(plural('pl', Number.NaN)).toBe('other')
    expect(plural('ar', Number.POSITIVE_INFINITY)).toBe('other')
  })
})
