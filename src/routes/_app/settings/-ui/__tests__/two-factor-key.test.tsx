import '#/components/ui/__tests__/test-env'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import Ui from '#/lib/i18n/messages/en/ui'
import { TwoFactorKey } from '../two-factor-key'

const uri = 'otpauth://totp/test?secret=ABCDEFGH2345'
function display(value: string) {
  return render(
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('settings', Settings),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      <TwoFactorKey uri={value} />
    </I18nProvider>,
  )
}
afterEach(cleanup)
describe('two-factor setup key matrix', () => {
  it('keeps the drawing, text, copy and URI inside the Replay boundary', () => {
    const { container } = display(uri)
    const drawing = screen.getByRole('img', {
      name: 'Setup code. The same key is available as text',
    })
    expect(drawing.closest('[data-sentry-block]')).not.toBeNull()
    expect(drawing.getAttribute('viewBox')).toBe('0 0 37 37')
    expect(drawing.getAttribute('aria-label')).not.toMatch(
      /below|above|beside|left|right/i,
    )
    expect(container.textContent).toContain('ABCD EFGH 2345')
    expect(screen.getByRole('button', { name: 'Copy key' })).toBeTruthy()
    expect(
      screen
        .getByRole('link', { name: 'Open in your authenticator app' })
        .getAttribute('href'),
    ).toBe(uri)
    expect(drawing.outerHTML).not.toContain('ABCDEFGH')
    expect(drawing.outerHTML).toContain('var(--color-ink)')
    expect(drawing.outerHTML).toContain('var(--color-surface)')
    for (const module of drawing.querySelectorAll('rect[x]')) {
      expect(Number(module.getAttribute('x'))).toBeGreaterThanOrEqual(4)
      expect(Number(module.getAttribute('y'))).toBeGreaterThanOrEqual(4)
      expect(Number(module.getAttribute('x'))).toBeLessThan(33)
      expect(Number(module.getAttribute('y'))).toBeLessThan(33)
    }
  })

  it('keeps text and a localized explanation when UTF-8 capacity is exceeded', () => {
    display(`${uri}&issuer=${'é'.repeat(107)}`)
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.getByText('ABCD EFGH 2345')).toBeTruthy()
    expect(
      screen.getByText(
        'We could not draw a code for this key. Enter the setup key in your app.',
      ),
    ).toBeTruthy()
  })

  it('replaces the matrix as the URI changes, and recovers from overflow', () => {
    const { rerender } = display(uri)
    const before = screen.getByRole('img').innerHTML
    rerender(
      <I18nProvider
        locale="en"
        messages={namespaceCatalogue('settings', Settings)}
      >
        <TwoFactorKey uri={`${uri}&issuer=another`} />
      </I18nProvider>,
    )
    expect(screen.getByRole('img').innerHTML).not.toBe(before)
    rerender(
      <I18nProvider
        locale="en"
        messages={namespaceCatalogue('settings', Settings)}
      >
        <TwoFactorKey uri={`${uri}&issuer=${'x'.repeat(214)}`} />
      </I18nProvider>,
    )
    expect(screen.queryByRole('img')).toBeNull()
    rerender(
      <I18nProvider
        locale="en"
        messages={namespaceCatalogue('settings', Settings)}
      >
        <TwoFactorKey uri={uri} />
      </I18nProvider>,
    )
    expect(screen.getByRole('img').innerHTML).toBe(before)
  })
})
