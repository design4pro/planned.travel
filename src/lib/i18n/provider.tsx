import { createContext, useContext, useMemo } from 'react'

import { createStoredTranslator, createTranslator } from './catalogue'
import { directionOf } from './locales'

import type { ReactNode } from 'react'
import type { Direction, Locale } from './locales'
import type { Catalogue, Translate, TranslateStored } from './types'

/**
 * The React seam for the message layer.
 *
 * The provider takes an *already loaded* catalogue. It never fetches, never
 * suspends and never falls back, because by the time React renders, the locale
 * has already been negotiated on the server and its messages resolved —
 * `docs/SPEC.md` §8.3 allows exactly one render in one language, with no flash
 * and no second pass to correct it. Handing this component a promise would
 * reintroduce the flash it exists to prevent.
 *
 * `dir` is published alongside `locale` so the shell can put it on `<html>` and
 * a component that needs to reason about direction — a mirrored chevron, a
 * slide-in that must travel the other way — asks one hook instead of parsing
 * the tag itself.
 */

export interface I18nContextValue {
  /** The negotiated locale, identical on the server and after hydration. */
  readonly locale: Locale
  /** Writing direction of that locale's script. */
  readonly dir: Direction
  /** The bound translator. */
  readonly t: Translate
  /**
   * The bound renderer for keys that only exist at run time — a stored
   * notification row's `titleKey` and `params`. `null` for a key this catalogue
   * does not carry, never English.
   */
  readonly tStored: TranslateStored
}

const I18nContext = createContext<I18nContextValue | null>(null)
I18nContext.displayName = 'I18nContext'

export interface I18nProviderProps {
  readonly locale: Locale
  readonly messages: Catalogue
  readonly children: ReactNode
}

export function I18nProvider({
  locale,
  messages,
  children,
}: I18nProviderProps) {
  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      dir: directionOf(locale),
      t: createTranslator(locale, messages),
      tStored: createStoredTranslator(locale, messages),
    }),
    [locale, messages],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/**
 * Everything the message layer exposes to a component.
 *
 * Throws rather than degrading to English outside a provider: a screen that
 * silently renders the source locale is the failure mode §8.2 was written to
 * prevent, and it is far cheaper to find at the first render than in a
 * screenshot of a half-translated page.
 */
export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext)
  if (value === null) {
    throw new Error('useI18n must be used inside <I18nProvider>')
  }
  return value
}

/** The translator, for the common case where a component only renders copy. */
export function useTranslate(): Translate {
  return useI18n().t
}

/**
 * The renderer for a key read out of the database rather than written in a
 * component — a notification row keeps `titleKey`, `bodyKey` and a `params`
 * record, so the sentence is composed in the reader's language at render time
 * rather than frozen in whatever language the writer was using.
 */
export function useStoredTranslate(): TranslateStored {
  return useI18n().tStored
}

/** The active locale, for formatters and for `lang` attributes. */
export function useLocale(): Locale {
  return useI18n().locale
}

/** The active writing direction. */
export function useDirection(): Direction {
  return useI18n().dir
}
