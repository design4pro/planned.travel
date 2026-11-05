import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SettingsNav } from '../../../-ui/settings-nav'

const state = vi.hoisted(() => ({ isAdmin: false }))
vi.mock('@tanstack/react-router', () => ({
  useRouteContext: () => ({
    shell: { session: { user: { isAdmin: state.isAdmin } } },
  }),
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string
    children: React.ReactNode
  }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))
vi.mock('#/components/ui', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('#/lib/i18n', () => ({ useTranslate: () => (key: string) => key }))

describe('workspace console entry in settings', () => {
  it('is absent for members and present for administrators', () => {
    state.isAdmin = false
    const view = render(<SettingsNav />)
    expect(
      screen.queryByRole('link', { name: /settings.nav.admin/ }),
    ).toBeNull()
    state.isAdmin = true
    view.rerender(<SettingsNav />)
    expect(
      screen
        .getByRole('link', { name: /settings.nav.admin/ })
        .getAttribute('href'),
    ).toBe('/admin')
  })
})
