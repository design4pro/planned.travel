import '#/components/ui/__tests__/test-env'

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ErrorPanel } from '#/components/layout/error-state'
import { encodePublicFailure } from '#/lib/errors'
import {
  I18nProvider,
  createTranslator,
  directionOf,
  loadCatalogue,
} from '#/lib/i18n'
import { Route as Shell } from '../../route'
import { Route as Providers } from '../../providers'
import { Route as Users } from '../../users.index'
import { Route as Account } from '../../users.$userId'

import type { ComponentType, ReactNode } from 'react'
import type { ErrorComponentProps } from '@tanstack/react-router'
import type { Locale } from '#/lib/i18n'

const invalidate = vi.hoisted(() => vi.fn())
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({ options }),
  useRouter: () => ({ invalidate }),
  Link: ({ to, children }: { to: string; children: ReactNode }) => (
    <a href={to}>{children}</a>
  ),
}))
vi.mock('../../-server/access', () => ({ loadConsoleAccess: vi.fn() }))
vi.mock('../../-server/providers', () => ({ loadProviders: vi.fn() }))
vi.mock('../../-server/users', () => ({
  loadConsoleUsers: vi.fn(),
  loadConsoleAccount: vi.fn(),
  CONSOLE_USERS_PAGE_SIZE: 25,
}))
vi.mock('../provider-limit-dialog', () => ({ ProviderLimitDialog: () => null }))
vi.mock('../create-account', () => ({ CreateAccountButton: () => null }))
vi.mock('../user-actions', () => ({ UserActions: () => null }))
vi.mock('../session-actions', () => ({ RevokeSessionButton: () => null }))

const catalogues = {
  pl: await loadCatalogue('pl'),
  ar: await loadCatalogue('ar'),
}
const readers = [
  ['shared', ErrorPanel],
  ['console shell', Shell.options.errorComponent],
  ['providers', Providers.options.errorComponent],
  ['users', Users.options.errorComponent],
  ['account', Account.options.errorComponent],
] as const

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('lang')
  document.documentElement.removeAttribute('dir')
  invalidate.mockClear()
})

function mount(
  Reader: ComponentType<ErrorComponentProps>,
  error: Error,
  locale: 'pl' | 'ar',
) {
  document.documentElement.lang = locale
  document.documentElement.dir = directionOf(locale)
  const messages = catalogues[locale]
  render(
    <I18nProvider locale={locale} messages={messages}>
      <Reader error={error} reset={() => {}} />
    </I18nProvider>,
  )
  return createTranslator(locale, messages)
}

function inheritsDocument(node: HTMLElement, locale: Locale) {
  expect(node.closest('[lang]')).toBe(document.documentElement)
  expect(node.closest('[dir]')).toBe(document.documentElement)
  expect(document.documentElement.lang).toBe(locale)
  expect(document.documentElement.dir).toBe(directionOf(locale))
}

describe.each(readers)('%s error reader', (_name, reader) => {
  const Reader = reader as ComponentType<ErrorComponentProps>
  it.each(['pl', 'ar'] as const)(
    'marks only the server sentence in %s',
    (locale) => {
      const message = 'That account is banned.'
      const t = mount(
        Reader,
        new Error(encodePublicFailure({ kind: 'refusal', message })),
        locale,
      )
      const sentence = screen.getByText(message)
      expect(sentence.closest('[lang="en"][dir="ltr"]')).not.toBeNull()
      inheritsDocument(screen.getByRole('heading'), locale)
      inheritsDocument(
        screen.getByRole('button', { name: t('shell.error.retry') }),
        locale,
      )
      expect(screen.queryByText(t('shell.error.reported'))).toBeNull()
    },
  )
  it('keeps validation visible and marks it as English', () => {
    const message = 'Use at least 10 characters.'
    mount(
      Reader,
      new Error(encodePublicFailure({ kind: 'validation', message })),
      'ar',
    )
    expect(
      screen.getByText(message).closest('[lang="en"][dir="ltr"]'),
    ).not.toBeNull()
  })
  it('translates a shell state without an English override', () => {
    const t = mount(
      Reader,
      new Error(
        encodePublicFailure({
          kind: 'refusal',
          message: 'shell.session.noWorkspace',
        }),
      ),
      'ar',
    )
    inheritsDocument(screen.getByText(t('shell.session.noWorkspace')), 'ar')
    expect(screen.queryByText('shell.session.noWorkspace')).toBeNull()
  })
  it('leaves the fallback unmarked, hides diagnostics and preserves recovery actions', () => {
    const t = mount(
      Reader,
      new Error(
        encodePublicFailure({
          kind: 'unexpected',
          message: 'SELECT secret FROM internal',
          reference: 'r-1011',
        }),
      ),
      'ar',
    )
    expect(screen.queryByText(/SELECT secret/)).toBeNull()
    const fallback =
      _name === 'shared' ? t('shell.error.body') : t('console.failure.fallback')
    inheritsDocument(screen.getByText(fallback), 'ar')
    expect(screen.getByText('r-1011')).toBeDefined()
    expect(
      screen
        .getByRole('link', { name: t('shell.error.dashboard') })
        .getAttribute('href'),
    ).toBe('/dashboard')
    fireEvent.click(
      screen.getByRole('button', { name: t('shell.error.retry') }),
    )
    expect(invalidate).toHaveBeenCalledOnce()
  })
  it.each([
    encodePublicFailure({
      kind: 'unexpected',
      message: 'SELECT secret FROM internal',
    }),
    'planned-travel/failure/1 {broken',
    'planned-travel/failure/2 {"kind":"refusal","message":"Unknown format"}',
  ])('withholds envelope contents without a reference: %s', (raw) => {
    const t = mount(Reader, new Error(raw), 'ar')
    const fallback =
      _name === 'shared' ? t('shell.error.body') : t('console.failure.fallback')
    inheritsDocument(screen.getByText(fallback), 'ar')
    expect(
      screen.queryByText(/SELECT secret|Unknown format|planned-travel/),
    ).toBeNull()
  })

  it('does not attribute client text to the English server', () => {
    const t = mount(Reader, new Error('Client connection lost'), 'pl')
    const text =
      _name === 'shared' ? t('shell.error.body') : 'Client connection lost'
    inheritsDocument(screen.getByText(text), 'pl')
  })
})

it('uses the supplied retry callback instead of invalidating the router', () => {
  const onRetry = vi.fn()
  const messages = catalogues.pl
  const t = createTranslator('pl', messages)
  render(
    <I18nProvider locale="pl" messages={messages}>
      <ErrorPanel error={new Error('offline')} onRetry={onRetry} />
    </I18nProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: t('shell.error.retry') }))
  expect(onRetry).toHaveBeenCalledOnce()
  expect(invalidate).not.toHaveBeenCalled()
})
