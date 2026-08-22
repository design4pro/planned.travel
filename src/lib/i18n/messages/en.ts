import type { Message } from '../types'

/**
 * The English source catalogue — the schema every other locale is checked
 * against (`docs/SPEC.md` §8.2). Keys are flat and dotted, namespaced by the
 * surface that renders them.
 *
 * `as const` is load-bearing: it keeps each value as a string literal type, and
 * that literal is what `TranslateArgs` reads the `{placeholder}` names out of.
 * Drop it and `t('language.current')` stops demanding a `name`.
 */
export const messages = {
  'language.label': 'Language',
  'language.description':
    'Choose the language you want to use across planned.travel.',
  'language.current': 'Current language: {name}',
} as const satisfies Record<string, Message>

/** The schema. `MessageKey` and `Catalogue` in `../types` are derived from it. */
export type EnCatalogue = typeof messages
