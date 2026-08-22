import type { Catalogue } from '../types'

/**
 * Arabic (`ar`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'اللغة',
  'language.description':
    'اختر اللغة التي تريد استخدامها في جميع أنحاء planned.travel.',
  'language.current': 'اللغة الحالية: {name}',
} satisfies Catalogue
