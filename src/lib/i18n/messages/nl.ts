import type { Catalogue } from '../types'

/**
 * Dutch (`nl`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Taal',
  'language.description':
    'Kies de taal die je overal in planned.travel wilt gebruiken.',
  'language.current': 'Huidige taal: {name}',
} satisfies Catalogue
