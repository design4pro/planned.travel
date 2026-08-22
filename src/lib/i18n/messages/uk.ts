import type { Catalogue } from '../types'

/**
 * Ukrainian (`uk`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Мова',
  'language.description':
    'Виберіть мову, якою хочете користуватися в усьому planned.travel.',
  'language.current': 'Поточна мова: {name}',
} satisfies Catalogue
