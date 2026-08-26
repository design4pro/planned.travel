// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import { I18nProvider } from '#/lib/i18n'
import { COPY_SLOT, splitSlot, useAtlasCopy, useAtlasI18n } from '../copy'

/**
 * The seam between the atlas and the message layer.
 *
 * Two obligations pull in opposite directions and this module has to hold both:
 * a screen must never quietly render English, and a component module must still
 * render with no provider above it, because seventeen suites in these two
 * directories mount these components bare. So the read is optional, and what it
 * falls back to is the **source** catalogue — the same object the `en` locale
 * loads, never a second copy of the words.
 */

function Words() {
  const t = useAtlasCopy()
  const { locale, dir } = useAtlasI18n()
  return (
    <p>
      {t('atlas.map.controls.zoomIn')} · {locale} · {dir}
    </p>
  )
}

describe('useAtlasCopy', () => {
  it('renders the source catalogue with no provider above it', () => {
    render(<Words />)
    expect(screen.getByText(/Zoom in/)).toBeTruthy()
    expect(screen.getByText(/· en · ltr/)).toBeTruthy()
  })

  it('consults only the provider’s catalogue once there is one', () => {
    render(
      <I18nProvider
        locale="ar"
        messages={{ 'atlas.map.controls.zoomIn': 'تكبير' }}
      >
        <Words />
      </I18nProvider>,
    )
    expect(screen.getByText(/تكبير/)).toBeTruthy()
    expect(screen.getByText(/· ar · rtl/)).toBeTruthy()
  })

  /**
   * §8.2 bans the silent fallback to English outright: a catalogue that is
   * missing a key renders the key, which is loud, rather than the source
   * sentence, which is invisible in a screenshot.
   */
  it('renders the key rather than English for a key a catalogue lacks', () => {
    render(
      <I18nProvider locale="ar" messages={{}}>
        <Words />
      </I18nProvider>,
    )
    expect(screen.getByText(/atlas\.map\.controls\.zoomIn/)).toBeTruthy()
  })
})

describe('splitSlot', () => {
  it('splits a rendered message where the element goes', () => {
    expect(splitSlot(`before${COPY_SLOT}after`)).toEqual(['before', 'after'])
  })

  it('keeps a translation that dropped the placeholder as prose', () => {
    expect(splitSlot('a whole sentence')).toEqual(['a whole sentence', ''])
  })

  it('uses a marker no translator can type by accident', () => {
    // A control character: it survives `interpolate()` as an ordinary parameter
    // and can never collide with punctuation somebody wrote.
    expect(COPY_SLOT).toHaveLength(1)
    expect(COPY_SLOT.charCodeAt(0)).toBeLessThan(0x20)
  })
})
