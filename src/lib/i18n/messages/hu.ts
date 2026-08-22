import type { Catalogue } from '../types'

/**
 * Hungarian (`hu`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Nyelv',
  'language.description':
    'Válaszd ki azt a nyelvet, amelyet a planned.travel egészében használni szeretnél.',
  'language.current': 'Jelenlegi nyelv: {name}',
} satisfies Catalogue
