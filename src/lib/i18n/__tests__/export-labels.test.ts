import { describe, expect, it } from 'vitest'

import { LOCALE_TAGS } from '../locales'

import type { NamespaceModule } from '../catalogue'
import type { Locale } from '../locales'

/**
 * A Download control on the export list is named after what it downloads and when it was made
 * (`files.export.downloadLabelPdf`, `…Html`). Its visible text is only the verb, so the accessible
 * name has to contain that verb in the locale's own words - the "label in name" rule (WCAG 2.5.3) -
 * and a translator who words the label with a different verb breaks speech-control users silently.
 */

const modules = import.meta.glob<NamespaceModule>('../messages/*/modules.ts', {
  eager: true,
})

function messagesOf(locale: Locale): Readonly<Record<string, unknown>> {
  const module = modules[`../messages/${locale}/modules.ts`]
  if (module === undefined) {
    throw new Error(`no modules catalogue for ${locale}`)
  }
  return module.default
}

describe('the export list’s Download labels', () => {
  it.each(LOCALE_TAGS.map((tag) => [tag]))(
    'carry the visible Download word in %s',
    (locale) => {
      const messages = messagesOf(locale)
      const verb = messages['files.export.download']
      expect(typeof verb).toBe('string')

      for (const key of [
        'files.export.downloadLabelPdf',
        'files.export.downloadLabelHtml',
      ]) {
        const label = messages[key]
        expect(typeof label).toBe('string')
        expect(String(label).toLocaleLowerCase(locale)).toContain(
          String(verb).toLocaleLowerCase(locale),
        )
      }
    },
  )
})
