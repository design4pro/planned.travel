import type { Catalogue } from '../types'

/**
 * Brazilian Portuguese (`pt-BR`) catalogue, authored from the English source in `./en`.
 * `satisfies Catalogue` makes a missing key and an orphan key both compile
 * errors; `__tests__/parity.test.ts` catches everything type alone cannot.
 */
export const messages = {
  'language.label': 'Idioma',
  'language.description':
    'Escolha o idioma que você quer usar em todo o planned.travel.',
  'language.current': 'Idioma atual: {name}',
} satisfies Catalogue
