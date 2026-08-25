/**
 * The continent a country sits on, named in the reader's language.
 *
 * `visited_countries.continent` is free text validated by `shortTextSchema`, so
 * the column can hold anything a write put there — and what our own writes put
 * there is one of the seven names in `#/lib/atlas/continents`. Those seven are
 * the ones a reader ever sees, so they are the ones translated; anything else
 * is passed through as data rather than dropped, because a row that says
 * "Macaronesia" is somebody's answer and not a bug.
 *
 * Matching is case- and space-insensitive against the canonical spelling for
 * the same reason the panel's roll-up folds them: the column is not an enum, so
 * `north america` and `North America` are one continent.
 */

import { humaniseToken, trimmedOrNull } from '#/lib/format'

import type { MessageKey, Translate } from '#/lib/i18n'

/** The seven the product itself writes, keyed by their folded spelling. */
const CONTINENT_KEYS = new Map<string, MessageKey>([
  ['africa', 'atlas.continent.africa'],
  ['antarctica', 'atlas.continent.antarctica'],
  ['asia', 'atlas.continent.asia'],
  ['europe', 'atlas.continent.europe'],
  ['northamerica', 'atlas.continent.northAmerica'],
  ['oceania', 'atlas.continent.oceania'],
  ['southamerica', 'atlas.continent.southAmerica'],
])

/** `North America` → `northamerica`, so spacing and case cannot split a row. */
export function continentKey(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '')
}

/**
 * The printable name for a stored continent, or `null` when the column is
 * empty — which is a different answer from "we do not know which", and the
 * caller decides which of the two it wants to say.
 */
export function continentLabel(
  value: string | null | undefined,
  t: Translate,
): string | null {
  const trimmed = trimmedOrNull(value ?? null)
  if (trimmed === null) {
    return null
  }
  const key = CONTINENT_KEYS.get(continentKey(trimmed))
  return key === undefined ? humaniseToken(trimmed) : t(key)
}

/**
 * The same, with the "not recorded" sentence in place of the null — for a slot
 * that must always carry words, such as a row's accessible name.
 */
export function continentLabelOrUnknown(
  value: string | null | undefined,
  t: Translate,
): string {
  return continentLabel(value, t) ?? t('atlas.continent.unknown')
}
