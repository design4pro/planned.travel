// @vitest-environment jsdom
import '#/components/ui/__tests__/test-env'

import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { I18nProvider } from '#/lib/i18n'
import marketing from '#/lib/i18n/messages/en/marketing'
import { MarketingFooter, MarketingHeader } from '../../marketing/chrome'
import { AppFrame } from '../app-frame'
import { TopNav } from '../top-nav'

import type { Catalogue } from '#/lib/i18n'
import type { ReactNode } from 'react'
import type { ShellSession } from '../session'

/**
 * The router, the catalogue and the account widgets, stood in for. What is left
 * is this file's subject: the class a shell row carries for its side padding.
 */
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({
    select,
  }: {
    select: (state: { location: { pathname: string } }) => unknown
  }) => select({ location: { pathname: '/dashboard' } }),
  Link: ({
    children,
    to: _to,
    ...rest
  }: { to: string } & React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...rest}>{children}</a>
  ),
}))
vi.mock('#/components/layout/visitor-language-switcher', () => ({
  VisitorLanguageSwitcher: () => null,
}))
vi.mock('../notification-bell', () => ({ NotificationBell: () => null }))
vi.mock('../pill-nav', () => ({ PillNav: () => null }))
vi.mock('../theme-toggle', () => ({ ThemeToggle: () => null }))
vi.mock('../user-menu', () => ({ UserMenu: () => null }))

afterEach(cleanup)

const EN: Catalogue = Object.fromEntries(
  Object.entries(marketing).map(([key, message]) => [
    `marketing.${key}`,
    message,
  ]),
)

const SESSION = {} as ShellSession

function renderTranslated(ui: ReactNode) {
  return render(
    <I18nProvider locale="en" messages={EN}>
      {ui}
    </I18nProvider>,
  )
}

/**
 * A row's side padding is `max(gutter, inset)` in one declaration (`gutter-x`),
 * so no second `px-*` utility can compete with it, neither in stylesheet order
 * nor in `cn()`.
 */
function expectSafeGutter(row: Element | null) {
  expect(row, 'the row').not.toBeNull()
  const classes = (row?.getAttribute('class') ?? '').split(/\s+/)
  expect(classes).toContain('gutter-x')
  expect(classes.filter((name) => /(^|:)px-/.test(name))).toEqual([])
}

describe('the shell pads for the side safe-area insets', () => {
  it('on the signed-in header row, not on the header itself', () => {
    const { container } = renderTranslated(<TopNav session={SESSION} />)
    const header = container.querySelector('header')
    expect(header?.className).not.toContain('gutter-x')
    expectSafeGutter(header?.firstElementChild ?? null)
  })

  it('on the marketing header row, not on the header itself', () => {
    const { container } = renderTranslated(<MarketingHeader />)
    const header = container.querySelector('header')
    expect(header?.className).not.toContain('gutter-x')
    expectSafeGutter(header?.firstElementChild ?? null)
  })

  it('on the marketing footer row', () => {
    const { container } = renderTranslated(<MarketingFooter />)
    expectSafeGutter(
      container.querySelector('footer')?.firstElementChild ?? null,
    )
  })

  it('on the content well', () => {
    const { container } = render(<AppFrame>x</AppFrame>)
    expectSafeGutter(container.querySelector('main'))
  })

  it('and leaves the full-bleed well alone', () => {
    const { container } = render(<AppFrame bleed>x</AppFrame>)
    expect(container.querySelector('main')?.className).not.toContain('gutter-x')
  })
})
