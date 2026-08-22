import type { Catalogue } from '../types'

/**
 * Simplified Chinese (`zh-Hans`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': '语言',
  'language.description': '选择您希望在 planned.travel 中使用的语言。',
  'language.current': '当前语言：{name}',
} satisfies Catalogue
