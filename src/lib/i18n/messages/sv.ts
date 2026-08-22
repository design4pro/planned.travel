import type { Catalogue } from '../types'

/**
 * Swedish (`sv`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Språk',
  'language.description':
    'Välj det språk du vill använda i hela planned.travel.',
  'language.current': 'Nuvarande språk: {name}',
} satisfies Catalogue
