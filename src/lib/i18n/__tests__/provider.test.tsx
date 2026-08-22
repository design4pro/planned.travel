import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { messages as arMessages } from '../messages/ar'
import { messages as enMessages } from '../messages/en'
import { messages as plMessages } from '../messages/pl'
import {
  I18nProvider,
  useDirection,
  useLocale,
  useTranslate,
} from '../provider'

function Readout() {
  const t = useTranslate()
  const locale = useLocale()
  const dir = useDirection()
  return (
    <p data-testid="readout" lang={locale} dir={dir}>
      {t('language.current', { name: t('language.label') })}
    </p>
  )
}

describe('the i18n provider', () => {
  it('renders the catalogue it was handed', () => {
    render(
      <I18nProvider locale="pl" messages={plMessages}>
        <Readout />
      </I18nProvider>,
    )
    expect(screen.getByTestId('readout').textContent).toBe(
      'Bieżący język: Język',
    )
  })

  it('publishes the locale and its direction', () => {
    render(
      <I18nProvider locale="ar" messages={arMessages}>
        <Readout />
      </I18nProvider>,
    )
    const readout = screen.getByTestId('readout')
    expect(readout.getAttribute('lang')).toBe('ar')
    expect(readout.getAttribute('dir')).toBe('rtl')
  })

  it('marks a left-to-right locale as such, explicitly', () => {
    render(
      <I18nProvider locale="en" messages={enMessages}>
        <Readout />
      </I18nProvider>,
    )
    expect(screen.getByTestId('readout').getAttribute('dir')).toBe('ltr')
  })

  it('refuses to translate outside a provider rather than falling back', () => {
    // §8.2 forbids the silent English fallback; a screen mounted without the
    // provider is a wiring bug and has to look like one. React re-reports the
    // throw through `console.error`, which is expected here and only here.
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Readout />)).toThrow(/I18nProvider/)
  })
})
