import type { Catalogue } from '../types'

/**
 * Turkish (`tr`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Dil',
  'language.description':
    'planned.travel genelinde kullanmak istediğiniz dili seçin.',
  'language.current': 'Geçerli dil: {name}',
} satisfies Catalogue
