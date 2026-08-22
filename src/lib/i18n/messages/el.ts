import type { Catalogue } from '../types'

/**
 * Greek (`el`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Γλώσσα',
  'language.description':
    'Επιλέξτε τη γλώσσα που θέλετε να χρησιμοποιείτε σε όλο το planned.travel.',
  'language.current': 'Τρέχουσα γλώσσα: {name}',
} satisfies Catalogue
