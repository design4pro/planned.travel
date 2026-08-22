import type { Catalogue } from '../types'

/**
 * Italian (`it`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Lingua',
  'language.description':
    'Scegli la lingua che vuoi usare in tutto planned.travel.',
  'language.current': 'Lingua attuale: {name}',
} satisfies Catalogue
