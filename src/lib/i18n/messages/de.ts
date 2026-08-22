import type { Catalogue } from '../types'

/**
 * German (`de`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Sprache',
  'language.description':
    'Wähle die Sprache, die du überall in planned.travel verwenden möchtest.',
  'language.current': 'Aktuelle Sprache: {name}',
} satisfies Catalogue
