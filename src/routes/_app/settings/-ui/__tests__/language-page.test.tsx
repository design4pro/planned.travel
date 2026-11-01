import '#/components/ui/__tests__/test-env'
import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Settings from '#/lib/i18n/messages/en/settings'
import { Route } from '../../language'
import type { ReactNode } from 'react'
import type * as RouterModule from '@tanstack/react-router'
import type * as I18nModule from '#/lib/i18n'

const mocks = vi.hoisted(() => ({
  save: vi.fn(async () => ({ locale: 'ar' })),
  invalidate: vi.fn(async () => {
    document.documentElement.lang = 'ar'
    document.documentElement.dir = 'rtl'
  }),
  warning:
    vi.fn<(title: ReactNode, options: { description: ReactNode }) => void>(),
  success: vi.fn(),
}))
vi.mock('@tanstack/react-router', async (load) => ({
  ...(await load<typeof RouterModule>()),
  useRouter: () => ({ invalidate: mocks.invalidate, state: { matches: [] } }),
}))
vi.mock('../../../-server/settings', () => ({
  saveLanguagePreference: mocks.save,
}))
vi.mock('../../-server/preferences', () => ({ loadLanguageSettings: vi.fn() }))
vi.mock('../../../-ui/settings-nav', () => ({
  SettingsSection: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('../route-error', () => ({ RouteError: () => null }))
vi.mock('sonner', () => ({
  toast: { warning: mocks.warning, success: mocks.success, error: vi.fn() },
}))
vi.mock('#/lib/i18n', async (load) => ({
  ...(await load<typeof I18nModule>()),
  loadCatalogue: () => Promise.reject(new Error('catalogue offline')),
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  document.documentElement.removeAttribute('lang')
  document.documentElement.removeAttribute('dir')
})

it('marks saved-but-reload copy with its captured language after the document becomes Arabic', async () => {
  vi.spyOn(Route, 'useLoaderData').mockReturnValue({
    override: 'en',
    workspace: 'en',
    currency: 'EUR',
  })
  const Page = Route.options.component
  if (!Page) throw new Error('Missing language page')
  render(
    <I18nProvider
      locale="en"
      messages={namespaceCatalogue('settings', Settings)}
    >
      <Page />
    </I18nProvider>,
  )
  fireEvent.click(screen.getByRole('radio', { name: 'العربية' }))
  await waitFor(() => expect(mocks.warning).toHaveBeenCalledOnce())
  expect(mocks.save).toHaveBeenCalledWith({ data: { locale: 'ar' } })
  expect(mocks.invalidate).toHaveBeenCalledWith({ forcePending: true })
  expect(mocks.success).not.toHaveBeenCalled()
  expect(document.documentElement.lang).toBe('ar')
  const [title, options] = mocks.warning.mock.calls[0]
  render(
    <div>
      {title}
      {options.description}
    </div>,
  )
  for (const text of [
    Settings['language.reload.title'],
    Settings['language.reload.body'].replace('{language}', 'العربية'),
  ]) {
    expect(screen.getByText(text).matches('[lang="en"][dir="ltr"]')).toBe(true)
  }
  expect(
    screen.getByRole('radio', { name: 'العربية' }).getAttribute('aria-checked'),
  ).toBe('true')
})
