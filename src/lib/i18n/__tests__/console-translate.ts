/**
 * The English translator the console's unit tests read their sentences through.
 *
 * Every describer in `src/components/console/` takes a `Translate` as its first argument, because a
 * hook cannot be called from a table cell's helper or from a test. That leaves each of those tests a
 * choice: stub the translator and assert on catalogue keys, or resolve the real English catalogue
 * and assert on the sentences a reader sees. This is the second, and it is the stronger of the two —
 * a key-returning stub would still pass if the wiring pointed a field at the wrong key.
 *
 * Not a `.test.ts`, so vitest collects no suite from it, and inside `__tests__`, so the source rules
 * that grep the shipped i18n module skip it.
 */

import { createTranslator } from '../catalogue'
import En from '../messages/en/console'

import type { Catalogue, Translate } from '../types'

/** `'nav.overview'` in the file is `'console.nav.overview'` to `t()`. */
const CONSOLE_CATALOGUE: Catalogue = Object.fromEntries(
  Object.entries(En).map(([key, message]) => [`console.${key}`, message]),
)

export const consoleTranslate: Translate = createTranslator(
  'en',
  CONSOLE_CATALOGUE,
)
