import '#/components/ui/__tests__/test-env'
import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider, useTranslate } from '#/lib/i18n'
import En from '#/lib/i18n/messages/en/auth'
import Pl from '#/lib/i18n/messages/pl/auth'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import { AuthShell } from '../auth-shell'
import { useAuthSchemas, useRevalidateAuthErrors, visibleError } from '../form'
import type { Locale } from '#/lib/i18n'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}))
vi.mock('#/components/layout/theme-toggle', () => ({
  ThemeToggle: () => <button>Theme</button>,
}))
afterEach(cleanup)

function provider(locale: Locale, children: React.ReactNode) {
  return (
    <I18nProvider
      locale={locale}
      messages={namespaceCatalogue('auth', locale === 'pl' ? Pl : En)}
    >
      {children}
    </I18nProvider>
  )
}
function Shell({ done = false }: { done?: boolean }) {
  const t = useTranslate()
  return (
    <AuthShell
      eyebrow="Test"
      heading={done ? t('auth.forgot.sent.heading') : t('auth.login.heading')}
      description="Test"
    >
      <input aria-label="Email" />
    </AuthShell>
  )
}
const submit = vi.fn()
function Form() {
  const schemas = useAuthSchemas()
  const form = useForm({
    defaultValues: { email: '', password: '', rememberMe: false },
    validators: { onChange: schemas.login },
    onSubmit: submit,
  })
  useRevalidateAuthErrors(form)
  return (
    <form>
      {(['email', 'password'] as const).map((name) => (
        <form.Field key={name} name={name}>
          {(field) => (
            <div>
              <input
                aria-label={name}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
              />
              <span>{visibleError(field.state.meta)}</span>
            </div>
          )}
        </form.Field>
      ))}
    </form>
  )
}

describe('Auth locale changes', () => {
  it('keeps focus for a translated heading and focuses a real replacement heading', async () => {
    const { rerender } = render(provider('en', <Shell />))
    const input = screen.getByRole('textbox')
    input.focus()
    rerender(provider('pl', <Shell />))
    expect(document.activeElement).toBe(input)
    rerender(provider('pl', <Shell done />))
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1 }),
    )
  })
  it('does not steal focus on first paint or after a locale change with the same heading', () => {
    const view = (locale: Locale) =>
      provider(
        locale,
        <AuthShell eyebrow="Test" heading="Same" description="Test">
          <input aria-label="Email" autoFocus />
        </AuthShell>,
      )
    const { rerender } = render(view('en'))
    expect(document.activeElement).toBe(screen.getByRole('textbox'))
    rerender(view('pl'))
    expect(document.activeElement).toBe(screen.getByRole('textbox'))
  })
  it('revalidates visible errors in the new language, preserves values and never submits or reveals untouched errors', async () => {
    const user = userEvent.setup()
    const { rerender } = render(provider('en', <Form />))
    await user.type(screen.getByLabelText('email'), 'invalid')
    await user.tab()
    expect(screen.getByText(En['validation.emailInvalid'])).toBeDefined()
    rerender(provider('pl', <Form />))
    await waitFor(() =>
      expect(screen.queryByText(En['validation.emailInvalid'])).toBeNull(),
    )
    expect(screen.getByText(Pl['validation.emailInvalid'])).toBeDefined()
    expect((screen.getByLabelText('email') as HTMLInputElement).value).toBe(
      'invalid',
    )
    expect((screen.getByLabelText('password') as HTMLInputElement).value).toBe(
      '',
    )
    expect(screen.queryByText(Pl['validation.passwordRequired'])).toBeNull()
    expect(submit).not.toHaveBeenCalled()
  })
})
