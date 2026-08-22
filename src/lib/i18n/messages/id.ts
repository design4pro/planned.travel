import type { Catalogue } from '../types'

/**
 * Indonesian (`id`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Bahasa',
  'language.description':
    'Pilih bahasa yang ingin Anda gunakan di seluruh planned.travel.',
  'language.current': 'Bahasa saat ini: {name}',
} satisfies Catalogue
