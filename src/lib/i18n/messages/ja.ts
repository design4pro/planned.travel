import type { Catalogue } from '../types'

/**
 * Japanese (`ja`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': '言語',
  'language.description':
    'planned.travel 全体で使用する言語を選択してください。',
  'language.current': '現在の言語: {name}',
} satisfies Catalogue
