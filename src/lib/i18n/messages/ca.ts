import type { Catalogue } from '../types'

/**
 * Catalan (`ca`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Idioma',
  'language.description':
    "Tria l'idioma que vols utilitzar a tot planned.travel.",
  'language.current': 'Idioma actual: {name}',
} satisfies Catalogue
