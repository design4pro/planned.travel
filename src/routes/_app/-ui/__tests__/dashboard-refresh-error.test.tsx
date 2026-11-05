import { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { DashboardRefreshError } from '../dashboard-refresh-error'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Ui from '#/lib/i18n/messages/en/ui'

vi.mock('#/components/layout/app-frame', () => ({
  AppFrame: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('#/components/layout/use-open-current-workspace', () => ({
  useOpenCurrentWorkspace: () => ({ open: vi.fn(), opening: false }),
}))
vi.mock('#/components/layout/failure-feedback', () => ({
  FailureFeedback: () => null,
}))
afterEach(cleanup)

it('focuses a failed refresh and returns to the dashboard after retry', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const loadDashboard = vi.fn().mockRejectedValueOnce(new Error('access lost'))
  function Dashboard() {
    const [error, setError] = useState<unknown>(null)
    if (error) throw error
    return (
      <button onClick={() => void loadDashboard().catch(setError)}>
        Refresh dashboard
      </button>
    )
  }
  const root = createRootRoute({ component: Outlet })
  const dashboard = createRoute({
    getParentRoute: () => root,
    path: '/dashboard',
    loader: () => true,
    errorComponent: DashboardRefreshError,
    component: Dashboard,
  })
  const router = createRouter({
    routeTree: root.addChildren([dashboard]),
    history: createMemoryHistory({ initialEntries: ['/dashboard'] }),
    isServer: false,
  })
  render(
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('shell', Shell),
        ...namespaceCatalogue('ui', Ui),
      }}
    >
      <RouterProvider router={router} />
    </I18nProvider>,
  )
  const trigger = await screen.findByRole('button', {
    name: 'Refresh dashboard',
  })
  trigger.focus()
  fireEvent.click(trigger)
  const retry = await screen.findByRole('button', { name: 'Try again' })
  expect(document.activeElement?.contains(retry)).toBe(true)
  fireEvent.click(retry)
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Refresh dashboard' }),
    ).not.toBeNull(),
  )
})
