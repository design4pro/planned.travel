import { describe, expect, it } from 'vitest'
import { loadCatalogue } from '../catalogue'
import { LOCALE_TAGS } from '../locales'
import { RECOVERY_CATALOGUES } from '../recovery-catalogues'

describe('bundled root recovery copy', () => {
  it.each(LOCALE_TAGS)(
    '%s stays in sync with the ordinary catalogue',
    async (locale) => {
      const ordinary = await loadCatalogue(locale)
      const recovery = Object.fromEntries(
        Object.entries(ordinary).filter(
          ([key]) =>
            key.startsWith('shell.error.') ||
            key.startsWith('shell.session.') ||
            key.startsWith('shell.feedback.') ||
            key === 'shell.nav.homeLink' ||
            key === 'ui.status.working' ||
            key === 'ui.action.remove',
        ),
      )
      expect(RECOVERY_CATALOGUES[locale]).toEqual(recovery)
    },
  )
})
