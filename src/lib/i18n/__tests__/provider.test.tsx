import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  I18nProvider,
  useDirection,
  useLocale,
  useStoredTranslate,
  useTranslate,
} from '../provider'

import type { Catalogue } from '../types'

/**
 * The provider is checked through `useStoredTranslate` rather than through
 * `useTranslate`. Both read the same bound catalogue; only the second is typed
 * against the English key union, which is empty until the nine content items
 * write `messages/en/<namespace>.ts` — so a test that called `t('…')` today
 * would not compile, and that is the guarantee §8.2 asks for rather than a gap.
 */

const CATALOGUE: Catalogue = {
  'settings.language.current': 'Aktualny język: {name}',
  'settings.language.label': 'Polski',
}

function Readout() {
  const t = useTranslate()
  const tStored = useStoredTranslate()
  const locale = useLocale()
  const dir = useDirection()
  return (
    <p data-testid="readout" lang={locale} dir={dir} data-typed={typeof t}>
      {tStored('settings.language.current', {
        name: tStored('settings.language.label') ?? '',
      })}
    </p>
  )
}

describe('the i18n provider', () => {
  it('renders the catalogue it was handed', () => {
    render(
      <I18nProvider locale="pl" messages={CATALOGUE}>
        <Readout />
      </I18nProvider>,
    )
    expect(screen.getByTestId('readout').textContent).toBe(
      'Aktualny język: Polski',
    )
  })

  it('publishes the locale and its direction', () => {
    render(
      <I18nProvider locale="ar" messages={CATALOGUE}>
        <Readout />
      </I18nProvider>,
    )
    const readout = screen.getByTestId('readout')
    expect(readout.getAttribute('lang')).toBe('ar')
    expect(readout.getAttribute('dir')).toBe('rtl')
  })

  it('marks a left-to-right locale as such, explicitly', () => {
    render(
      <I18nProvider locale="en" messages={CATALOGUE}>
        <Readout />
      </I18nProvider>,
    )
    expect(screen.getByTestId('readout').getAttribute('dir')).toBe('ltr')
  })

  it('publishes a translator bound to the locale it was given', () => {
    render(
      <I18nProvider locale="pl" messages={CATALOGUE}>
        <Readout />
      </I18nProvider>,
    )
    expect(screen.getByTestId('readout').getAttribute('data-typed')).toBe(
      'function',
    )
  })

  it('refuses to translate outside a provider rather than falling back', () => {
    // §8.2 forbids the silent English fallback; a screen mounted without the
    // provider is a wiring bug and has to look like one. React re-reports the
    // throw through `console.error`, which is expected here and only here.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Readout />)).toThrow(/I18nProvider/)
  })
})
