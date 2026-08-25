import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LOCALE,
  LOCALE_TAGS,
  SUPPORTED_LOCALES,
  directionOf,
  isSupportedLocale,
  localeDescriptor,
  nativeNameOf,
} from '../locales'

/**
 * The registry is a contract, not an implementation detail: `docs/SPEC.md` §8
 * fixes all twenty-three rows, and the picker, the negotiator and every
 * `<html lang>` in the product read them from here. The expectations below are
 * transcribed from that table rather than derived from the module, so a typo in
 * the module cannot agree with itself.
 */
const SPEC_TABLE: ReadonlyArray<readonly [string, string, 'ltr' | 'rtl']> = [
  ['ar', 'العربية', 'rtl'],
  ['ca', 'Català', 'ltr'],
  ['cs', 'Čeština', 'ltr'],
  ['de', 'Deutsch', 'ltr'],
  ['el', 'Ελληνικά', 'ltr'],
  ['en', 'English', 'ltr'],
  ['es', 'Español', 'ltr'],
  ['fr', 'Français', 'ltr'],
  ['hu', 'Magyar', 'ltr'],
  ['id', 'Bahasa Indonesia', 'ltr'],
  ['it', 'Italiano', 'ltr'],
  ['ja', '日本語', 'ltr'],
  ['ko', '한국어', 'ltr'],
  ['nl', 'Nederlands', 'ltr'],
  ['pl', 'Polski', 'ltr'],
  ['pt-BR', 'Português (Brasil)', 'ltr'],
  ['ru', 'Русский', 'ltr'],
  ['sv', 'Svenska', 'ltr'],
  ['tr', 'Türkçe', 'ltr'],
  ['uk', 'Українська', 'ltr'],
  ['vi', 'Tiếng Việt', 'ltr'],
  ['zh-Hans', '简体中文', 'ltr'],
  ['zh-Hant', '繁體中文', 'ltr'],
]

describe('the locale registry', () => {
  it('ships exactly the twenty-three locales the spec names', () => {
    expect(SUPPORTED_LOCALES).toHaveLength(23)
    expect(
      SUPPORTED_LOCALES.map((entry) => [
        entry.tag,
        entry.nativeName,
        entry.dir,
      ]),
    ).toEqual(SPEC_TABLE.map((row) => [...row]))
  })

  it('names Arabic as the only right-to-left script', () => {
    const rtl = SUPPORTED_LOCALES.filter((entry) => entry.dir === 'rtl')
    expect(rtl.map((entry) => entry.tag)).toEqual(['ar'])
    expect(directionOf('ar')).toBe('rtl')
    expect(directionOf('en')).toBe('ltr')
    expect(directionOf('zh-Hant')).toBe('ltr')
  })

  it('never names a language in English', () => {
    // Every native name that is not itself English prose must differ from the
    // English exonym, which is the whole point of the column.
    expect(nativeNameOf('pl')).toBe('Polski')
    expect(nativeNameOf('cs')).toBe('Čeština')
    expect(nativeNameOf('el')).toBe('Ελληνικά')
    expect(nativeNameOf('ja')).toBe('日本語')
    expect(nativeNameOf('en')).toBe('English')
  })

  it('uses canonical BCP-47 tags, not the region-coded lookalikes', () => {
    expect(LOCALE_TAGS).toContain('pt-BR')
    expect(LOCALE_TAGS).toContain('el')
    expect(LOCALE_TAGS).toContain('zh-Hans')
    expect(LOCALE_TAGS).toContain('zh-Hant')
    for (const wrong of ['br', 'gr', 'zh', 'zh-TW', 'en-GB', 'pl-PL']) {
      expect(LOCALE_TAGS).not.toContain(wrong)
    }
  })

  it('is sorted by tag, so the picker has one stable order', () => {
    expect([...LOCALE_TAGS]).toEqual(
      [...LOCALE_TAGS].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    )
  })

  it('is frozen at both levels', () => {
    expect(Object.isFrozen(SUPPORTED_LOCALES)).toBe(true)
    expect(Object.isFrozen(LOCALE_TAGS)).toBe(true)
    for (const entry of SUPPORTED_LOCALES) {
      expect(Object.isFrozen(entry)).toBe(true)
    }
  })

  it('sources English and nothing else', () => {
    expect(DEFAULT_LOCALE).toBe('en')
  })

  it('narrows an unknown stored value', () => {
    expect(isSupportedLocale('pl')).toBe(true)
    expect(isSupportedLocale('pt-BR')).toBe(true)
    // Case matters: the canonical tag is what is stored and served.
    expect(isSupportedLocale('PT-br')).toBe(false)
    expect(isSupportedLocale('en-GB')).toBe(false)
    expect(isSupportedLocale('')).toBe(false)
    expect(isSupportedLocale(null)).toBe(false)
    expect(isSupportedLocale(42)).toBe(false)
  })

  it('describes every tag it lists', () => {
    for (const tag of LOCALE_TAGS) {
      const descriptor = localeDescriptor(tag)
      expect(descriptor.tag).toBe(tag)
      expect(descriptor.nativeName.length).toBeGreaterThan(0)
    }
  })
})
