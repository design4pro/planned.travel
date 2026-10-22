/**
 * Where an email registration ends up: the register screen's hand-off to the verify-email screen
 * and that screen's "Continue anyway" exit. The pages are the real ones, with the router and the
 * auth server stubbed, because both decisions live in the screens and nowhere else. The three
 * cases (no target, a safe target, an unsafe one) are the whole matrix.
 */
import '#/components/ui/__tests__/test-env'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { I18nProvider } from '#/lib/i18n'
import Auth from '#/lib/i18n/messages/en/auth'
import Ui from '#/lib/i18n/messages/en/ui'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import { Route as RegisterRoute } from '../../register'
import { Route as VerifyEmailRoute } from '../../verify-email'

import type { Catalogue } from '#/lib/i18n'
import type { VerificationState } from '../../-server/config'
import type { ComponentType, ReactNode } from 'react'

const EN: Catalogue = {
  ...namespaceCatalogue('auth', Auth),
  ...namespaceCatalogue('ui', Ui),
}

/** What the stubbed routes hand the pages: the search params, loader payload and route context. */
interface PageState {
  search: Record<string, string | undefined>
  verification: VerificationState
}

const page = vi.hoisted((): PageState => ({
  search: {},
  verification: { signedIn: true, verified: false, email: 'ada@example.com' },
}))
const signUpEmail = vi.hoisted(() => vi.fn())

vi.mock('#/components/layout/visitor-language-switcher', () => ({
  VisitorLanguageSwitcher: () => null,
}))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: object) => ({
    options,
    useSearch: () => page.search,
    useLoaderData: () => page.verification,
    useRouteContext: () => ({
      config: { socialProviders: [], signedIn: false, email: null },
    }),
  }),
  redirect: vi.fn(),
  Link: ({
    to,
    search: _search,
    children,
    ...rest
  }: {
    to: string
    search?: unknown
    children?: ReactNode
  }) => (
    <a href={to} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('../../-server/config', () => ({
  loadAuthConfig: vi.fn(),
  loadVerificationState: vi.fn(),
}))
vi.mock('#/lib/auth/client', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>()
  return {
    ...original,
    authClient: {
      signUp: { email: signUpEmail },
      sendVerificationEmail: vi.fn(),
    },
  }
})

const assign = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  page.search = {}
  signUpEmail.mockResolvedValue({ error: null })
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, assign },
  })
})
afterEach(cleanup)

function mount(route: unknown, search: PageState['search']) {
  page.search = search
  const Page = (route as { options: { component: ComponentType } }).options
    .component
  return render(
    <I18nProvider locale="en" messages={EN}>
      <Page />
    </I18nProvider>,
  )
}

async function registerWithEmail(): Promise<void> {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Your name'), 'Ada Lovelace')
  await user.type(screen.getByLabelText('Email address'), 'ada@example.com')
  await user.type(screen.getByLabelText('Password'), 'a-long-passphrase')
  await user.type(
    screen.getByLabelText('Confirm password'),
    'a-long-passphrase',
  )
  await user.click(screen.getByRole('checkbox'))
  await user.click(screen.getByRole('button', { name: 'Create account' }))
}

describe('register: the hand-off after an email sign-up', () => {
  it('carries a safe target to the verify-email screen', async () => {
    mount(RegisterRoute, { redirect: '/accept-invitation/inv_1?x=1' })
    await registerWithEmail()
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1))
    expect(assign).toHaveBeenCalledWith(
      `/verify-email?redirect=${encodeURIComponent('/accept-invitation/inv_1?x=1')}`,
    )
  })

  it('keeps the bare hand-off when there is no target', async () => {
    mount(RegisterRoute, {})
    await registerWithEmail()
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1))
    expect(assign).toHaveBeenCalledWith('/verify-email')
  })

  it('drops an unsafe target instead of carrying it', async () => {
    mount(RegisterRoute, { redirect: '//evil.example/steal' })
    await registerWithEmail()
    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1))
    expect(assign).toHaveBeenCalledWith('/verify-email')
  })

  it('leaves the emailed callback URL untouched, whatever the target', async () => {
    mount(RegisterRoute, { redirect: '/accept-invitation/inv_1' })
    await registerWithEmail()
    await waitFor(() => expect(signUpEmail).toHaveBeenCalledTimes(1))
    expect(signUpEmail).toHaveBeenCalledWith(
      expect.objectContaining({ callbackURL: '/verify-email' }),
    )
  })
})

describe('verify-email: "Continue anyway"', () => {
  function continueHref(): string | null {
    return screen
      .getByRole('link', { name: 'Continue anyway' })
      .getAttribute('href')
  }

  it('goes to a safe target', () => {
    mount(VerifyEmailRoute, { redirect: '/accept-invitation/inv_1?x=1' })
    expect(continueHref()).toBe('/accept-invitation/inv_1?x=1')
  })

  it('goes to the dashboard when there is no target', () => {
    mount(VerifyEmailRoute, {})
    expect(continueHref()).toBe('/dashboard')
  })

  it.each(['https://evil.example/', '//evil.example', '/\\evil.example', 'x'])(
    'falls back to the dashboard for the unsafe target %s',
    (redirect) => {
      mount(VerifyEmailRoute, { redirect })
      expect(continueHref()).toBe('/dashboard')
    },
  )

  it('keeps the dashboard on the screen reached from the emailed link', () => {
    page.verification = {
      signedIn: true,
      verified: true,
      email: 'ada@example.com',
    }
    mount(VerifyEmailRoute, { redirect: '/accept-invitation/inv_1' })
    expect(
      screen
        .getByRole('link', { name: Auth['verify.done.action'] as string })
        .getAttribute('href'),
    ).toBe('/dashboard')
    page.verification = {
      signedIn: true,
      verified: false,
      email: 'ada@example.com',
    }
  })
})
