import type { Catalogue } from '../types'

/**
 * Korean (`ko`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': '언어',
  'language.description': 'planned.travel 전체에서 사용할 언어를 선택하세요.',
  'language.current': '현재 언어: {name}',
} satisfies Catalogue
