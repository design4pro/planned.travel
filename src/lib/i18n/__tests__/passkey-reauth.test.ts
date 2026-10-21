import { describe, expect, it } from 'vitest'

import { LOCALE_TAGS } from '../locales'

import type { NamespaceModule } from '../catalogue'
import type { Locale } from '../locales'

/**
 * The stale-session notices on the passkeys screen warn that Sign in again ends the session first
 * (#1188). The warning only helps when it names the action the way the button does, so each
 * locale's sentence has to contain that locale's own button label: a translator who rewords one
 * and not the other leaves the person looking for a button that does not exist.
 */

const modules = import.meta.glob<NamespaceModule>('../messages/*/settings.ts', {
  eager: true,
})

function messagesOf(locale: Locale): Readonly<Record<string, unknown>> {
  const module = modules[`../messages/${locale}/settings.ts`]
  if (module === undefined) {
    throw new Error(`no settings catalogue for ${locale}`)
  }
  return module.default
}

describe('the passkeys stale-session notices', () => {
  it.each(LOCALE_TAGS.map((tag) => [tag]))(
    'name the Sign in again button in %s',
    (locale) => {
      const messages = messagesOf(locale)
      const action = messages['passkeys.signInAgain']
      expect(typeof action).toBe('string')

      for (const key of ['passkeys.add.stale', 'passkeys.delete.stale']) {
        const sentence = messages[key]
        expect(typeof sentence).toBe('string')
        expect(sentence as string).toContain(action as string)
      }
    },
  )
})
