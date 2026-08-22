import type { Catalogue } from '../types'

/**
 * Traditional Chinese (`zh-Hant`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': '語言',
  'language.description': '選擇您希望在 planned.travel 中使用的語言。',
  'language.current': '目前語言：{name}',
} satisfies Catalogue
