/**
 * A bound translator over the `auth` namespace, for the tests in this directory.
 *
 * Not a `.test.ts`, so vitest does not collect it - it is the one copy of the
 * two lines that turn a namespace file into the qualified-key catalogue `t()`
 * reads (`src/lib/i18n/catalogue.ts` does the same merge for the product), and
 * both suites here need it.
 */
import { createTranslator } from '#/lib/i18n'
import en from '#/lib/i18n/messages/en/auth'

import type { Catalogue, Locale, Message, Translate } from '#/lib/i18n'

/** `field.email` → `auth.field.email`, which is how a screen addresses it. */
export function authCatalogue(
  messages: Readonly<Record<string, Message>> = en,
): Catalogue {
  return Object.fromEntries(
    Object.entries(messages).map(([key, message]) => [`auth.${key}`, message]),
  )
}

/** The translator a screen would hold, for a chosen locale and catalogue. */
export function authTranslator(
  locale: Locale,
  messages: Readonly<Record<string, Message>> = en,
): Translate {
  return createTranslator(locale, authCatalogue(messages))
}
