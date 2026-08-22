import type { Catalogue } from '../types'

/**
 * Spanish (`es`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Idioma',
  'language.description':
    'Elige el idioma que quieres usar en todo planned.travel.',
  'language.current': 'Idioma actual: {name}',
} satisfies Catalogue
