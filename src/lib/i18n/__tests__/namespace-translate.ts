/**
 * One namespace's real English messages, as the tests need them: a catalogue for a provider, or a
 * translator for a function that takes one.
 *
 * The pure functions under `src/components/` take a `Translate` as an argument, because a hook
 * cannot be called from a table cell's helper or from a test. That leaves each of those tests a
 * choice: stub the translator and assert on catalogue keys, or resolve the real English catalogue
 * and assert on the sentences a reader sees. This is the second, and it is the stronger of the two —
 * a key-returning stub still passes when the wiring points a field at the wrong key, and it still
 * passes when a parameter that is itself a key reaches the sentence unresolved, which is exactly the
 * bug it was written to miss.
 *
 * The namespace is a parameter rather than a copied constant because `t()` reads qualified keys
 * (`'modules.book.error.required'`) while a namespace file is authored unqualified
 * (`'book.error.required'`), and that requalification is the whole mechanism: one owner for it, not
 * one per namespace.
 *
 * `Namespace` constrains the prefix to the eleven §9 fixes, so a name no namespace file uses is a
 * compile error. It does *not* bind the prefix to the file passed beside it — `NamespaceMessages` is
 * a plain string-keyed bag, so pairing one namespace's name with another's messages compiles.
 * Nothing here can catch that, and nothing needs to: every key would resolve to itself, so the first
 * assertion in the suite fails and says so.
 *
 * Not a `.test.ts`, so vitest collects no suite from it, and inside `__tests__`, so the source rules
 * that grep the shipped i18n module skip it.
 */

import { createTranslator } from '../catalogue'

import type {
  Catalogue,
  Namespace,
  NamespaceMessages,
  Translate,
} from '../types'

/** One namespace file, keyed the way `I18nProvider` and `t()` read it. Merge several by spreading. */
export function namespaceCatalogue(
  namespace: Namespace,
  messages: NamespaceMessages,
): Catalogue {
  return Object.fromEntries(
    Object.entries(messages).map(([key, message]) => [
      `${namespace}.${key}`,
      message,
    ]),
  )
}

export function namespaceTranslate(
  namespace: Namespace,
  messages: NamespaceMessages,
): Translate {
  return createTranslator('en', namespaceCatalogue(namespace, messages))
}
