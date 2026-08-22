import type { Catalogue } from '../types'

/**
 * Czech (`cs`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Jazyk',
  'language.description':
    'Vyberte jazyk, který chcete používat v celé aplikaci planned.travel.',
  'language.current': 'Aktuální jazyk: {name}',
} satisfies Catalogue
