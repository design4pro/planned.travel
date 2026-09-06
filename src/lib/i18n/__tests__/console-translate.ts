/**
 * The English translator the console's unit tests read their sentences through.
 *
 * Every describer in `src/components/console/` takes a `Translate` as its first argument; this is
 * what they are given. Why a real catalogue rather than a key-returning stub — and why the namespace
 * has to be reapplied — is in `./namespace-translate`.
 *
 * Not a `.test.ts`, so vitest collects no suite from it, and inside `__tests__`, so the source rules
 * that grep the shipped i18n module skip it.
 */

import En from '../messages/en/console'
import { namespaceTranslate } from './namespace-translate'

import type { Translate } from '../types'

export const consoleTranslate: Translate = namespaceTranslate('console', En)
