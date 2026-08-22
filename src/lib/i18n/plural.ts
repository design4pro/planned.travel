import type { Locale } from './locales'

/**
 * Plural category selection, and the one place in this directory that is
 * allowed to ask the platform a locale-dependent question.
 *
 * `docs/SPEC.md` §8.5 makes runtime agreement the hardest constraint on this
 * task, so the exemption is earned rather than assumed: `Intl.PluralRules`
 * returns byte-identical categories in workerd, WebKit and Chromium for all 23
 * shipped locales across integers and fractions. It answers with a fixed
 * six-value enum rather than with prose, which is exactly why it does not
 * drift the way `Intl.DisplayNames` and abbreviated month names do.
 *
 * Rules are memoised per locale. Constructing an `Intl.PluralRules` is the
 * expensive part, and an SSR pass renders many plural messages in one locale.
 */

const cache = new Map<Locale, Intl.PluralRules>()

function rulesFor(locale: Locale): Intl.PluralRules {
  const cached = cache.get(locale)
  if (cached !== undefined) {
    return cached
  }
  const rules = new Intl.PluralRules(locale)
  cache.set(locale, rules)
  return rules
}

/**
 * The CLDR category a count falls into for this locale — `one`/`other` for
 * English, all six for Arabic, `other` alone for Japanese.
 *
 * A non-finite count would make `Intl.PluralRules` throw mid-render, so it is
 * folded to `other`: a broken number must not take a page down.
 */
export function plural(locale: Locale, count: number): Intl.LDMLPluralRule {
  if (!Number.isFinite(count)) {
    return 'other'
  }
  return rulesFor(locale).select(count)
}

/**
 * Every category this locale can produce, in CLDR order. Catalogue authors and
 * the parity test use it to know which branches a plural message must carry.
 */
export function pluralCategories(
  locale: Locale,
): ReadonlyArray<Intl.LDMLPluralRule> {
  return rulesFor(locale).resolvedOptions().pluralCategories
}
