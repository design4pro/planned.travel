/**
 * The English translator the module unit tests read their sentences through.
 *
 * The same choice `console-translate.ts` describes, made the same way: the pure helpers under
 * `src/components/modules/` take a `Translate` because a hook cannot be called from a select's
 * label function or from a test, and resolving the real English catalogue is stronger than a
 * key-returning stub — a stub still passes when the wiring points a field at the wrong key.
 *
 * Not a `.test.ts`, so vitest collects no suite from it, and inside `__tests__`, so the source rules
 * that grep the shipped i18n module skip it.
 */

import { createTranslator } from '../catalogue'
import En from '../messages/en/modules'

import type { Catalogue, Translate } from '../types'

/** `'transports.dayNumber'` in the file is `'modules.transports.dayNumber'` to `t()`. */
const MODULES_CATALOGUE: Catalogue = Object.fromEntries(
  Object.entries(En).map(([key, message]) => [`modules.${key}`, message]),
)

export const modulesTranslate: Translate = createTranslator(
  'en',
  MODULES_CATALOGUE,
)
