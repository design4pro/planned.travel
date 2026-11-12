import '#/components/ui/__tests__/test-env'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import { wideLayoutPreference } from '#/lib/wide-layout'
import { Route } from '../../appearance'
import type * as RouterModule from '@tanstack/react-router'

const mocks = vi.hoisted(() => ({ save: vi.fn(), invalidate: vi.fn() }))
vi.mock('@tanstack/react-router', async (load) => ({
  ...(await load<typeof RouterModule>()),
  useRouter: () => ({ invalidate: mocks.invalidate }),
}))
vi.mock('../../../-server/settings', () => ({
  loadAppearance: vi.fn(),
  saveAppearance: mocks.save,
}))
vi.mock('../../../-ui/basemap-picker', () => ({ BasemapPicker: () => null }))
vi.mock('../route-error', () => ({ RouteError: () => null }))

afterEach(() => {
  cleanup()
  wideLayoutPreference.write(false)
  localStorage.clear()
  vi.restoreAllMocks()
})

it('offers a keyboard switch with a hint and applies off/on/off without an account write', async () => {
  vi.spyOn(Route, 'useLoaderData').mockReturnValue({
    reduceMotion: false,
    maskConfirmationCodes: false,
    mapStyleOverride: null,
  } as ReturnType<typeof Route.useLoaderData>)
  const Page = Route.options.component
  if (!Page) throw new Error('Missing appearance page')
  render(
    <I18nProvider
      locale="en"
      messages={namespaceCatalogue('settings', Settings)}
    >
      <Page />
    </I18nProvider>,
  )
  const control = screen.getByRole('switch', { name: 'Wide layout' })
  expect(
    document.getElementById(control.getAttribute('aria-describedby') ?? '')
      ?.textContent,
  ).toBe(Settings['appearance.layout.hint'])
  const user = userEvent.setup()
  control.focus()
  for (const next of [true, false]) {
    await user.keyboard(' ')
    expect(control.getAttribute('aria-checked')).toBe(String(next))
    expect(document.documentElement.hasAttribute('data-wide-layout')).toBe(next)
    expect(document.activeElement).toBe(control)
  }
  expect(mocks.save).not.toHaveBeenCalled()
  expect(mocks.invalidate).not.toHaveBeenCalled()
})
