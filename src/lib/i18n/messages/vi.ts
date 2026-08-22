import type { Catalogue } from '../types'

/**
 * Vietnamese (`vi`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Ngôn ngữ',
  'language.description':
    'Chọn ngôn ngữ bạn muốn dùng trên toàn bộ planned.travel.',
  'language.current': 'Ngôn ngữ hiện tại: {name}',
} satisfies Catalogue
