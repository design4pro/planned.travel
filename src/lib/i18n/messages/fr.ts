import type { Catalogue } from '../types'

/**
 * French (`fr`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Langue',
  'language.description':
    'Choisissez la langue que vous souhaitez utiliser dans tout planned.travel.',
  'language.current': 'Langue actuelle : {name}',
} satisfies Catalogue
