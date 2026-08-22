import type { Catalogue } from '../types'

/**
 * Polish (`pl`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Język',
  'language.description':
    'Wybierz język, którego chcesz używać w całym planned.travel.',
  'language.current': 'Bieżący język: {name}',
} satisfies Catalogue
