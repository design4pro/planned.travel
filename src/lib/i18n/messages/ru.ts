import type { Catalogue } from '../types'

/**
 * Russian (`ru`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Язык',
  'language.description':
    'Выберите язык, который хотите использовать во всём planned.travel.',
  'language.current': 'Текущий язык: {name}',
} satisfies Catalogue
