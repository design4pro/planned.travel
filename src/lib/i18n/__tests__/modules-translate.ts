/**
 * The English translator the trip modules' unit tests read their sentences through.
 *
 * The module screens keep their rules in plain functions that name a message rather than write one —
 * `booking-form.ts` says why a draft will not save, `connections.ts` whether a hand-over can be
 * caught — and this resolves what they named. See `./namespace-translate` for why the catalogue is
 * real rather than stubbed.
 *
 * Not a `.test.ts`, so vitest collects no suite from it, and inside `__tests__`, so the source rules
 * that grep the shipped i18n module skip it.
 */

import En from '../messages/en/modules'
import { namespaceTranslate } from './namespace-translate'

import type { Translate } from '../types'

export const modulesTranslate: Translate = namespaceTranslate('modules', En)
