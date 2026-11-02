import * as React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'

import userEvent from '@testing-library/user-event'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import Atlas from '#/lib/i18n/messages/en/atlas'

import type * as AtlasScreenModule from '../atlas-screen'

import { Route } from '../../atlas'

const read = vi.hoisted(() => vi.fn())
const mutate = vi.hoisted(() => vi.fn())
vi.mock('../../-server/library', () => ({ loadAtlas: read }))
vi.mock('#/components/layout/app-frame', () => ({
  AppFrame: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('#/components/atlas', () => ({}))
vi.mock('#/components/atlas/world-map', () => ({
  WorldCoverageMap: () => null,
}))
vi.mock('#/components/map', () => ({}))
vi.mock('../atlas-screen', async (importOriginal) => ({
  ...(await importOriginal<typeof AtlasScreenModule>()),
  AtlasScreen: ({ atlas }: { atlas: { revision: string } }) => (
    <div data-testid="atlas-screen">
      <h1>Atlas {atlas.revision}</h1>
      <button onClick={mutate}>Country action</button>
    </div>
  ),
  AtlasScreenPending: () => <div>Loading atlas</div>,
}))

afterEach(() => vi.resetAllMocks())

async function mount() {
  const root = createRootRoute({ component: Outlet })
  const app = createRoute({
    getParentRoute: () => root,
    id: '_app',
    component: Outlet,
  })
  const atlas = createRoute({
    // The production loader ignores context; erase its generated parent type.
    loader: Route.options.loader as () => Promise<unknown>,
    component: Route.options.component,
    errorComponent: Route.options.errorComponent,
    pendingComponent: Route.options.pendingComponent,
    getParentRoute: () => app,
    path: 'atlas',
  })
  const dashboard = createRoute({
    getParentRoute: () => app,
    path: 'dashboard',
    component: () => <h1>Dashboard</h1>,
  })
  const router = createRouter({
    routeTree: root.addChildren([app.addChildren([atlas, dashboard])]),
    history: createMemoryHistory({ initialEntries: ['/atlas'] }),
    defaultPendingMinMs: 0,
  })
  await router.load()
  render(
    <I18nProvider
      locale="en"
      messages={{
        ...namespaceCatalogue('shell', Shell),
        ...namespaceCatalogue('atlas', Atlas),
      }}
    >
      <RouterProvider router={router} />
    </I18nProvider>,
  )
  return router
}

it('hands focus from a removed country control to real recovery and restores fresh content on keyboard retry', async () => {
  const user = userEvent.setup()
  read
    .mockResolvedValueOnce({ revision: 'old' })
    .mockRejectedValueOnce(new Error('refresh unavailable'))
    .mockResolvedValueOnce({ revision: 'fresh' })
  const router = await mount()
  expect(await screen.findByTestId('atlas-screen')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Country action' }))
  expect(mutate).toHaveBeenCalledTimes(1)
  await act(async () => {
    await router.invalidate()
  })
  await waitFor(() => expect(screen.queryByTestId('atlas-screen')).toBeNull())
  const recovery = screen.getByRole('region', {
    name: 'The atlas did not load',
  })
  expect(document.activeElement).toBe(recovery)
  await user.tab()
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: 'Try again' }),
  )
  expect(screen.getByRole('link', { name: /dashboard/i })).toBeTruthy()
  expect(read).toHaveBeenCalledTimes(2)
  expect(router.state.matches.at(-1)?.status).toBe('error')
  await user.keyboard('{Enter}')
  expect(await screen.findByText('Atlas fresh')).toBeTruthy()
  expect(
    document.activeElement?.contains(
      screen.getByRole('heading', { name: 'Atlas fresh' }),
    ),
  ).toBe(true)
  expect(read).toHaveBeenCalledTimes(3)
  expect(mutate).toHaveBeenCalledTimes(1)
})

it('keeps initial and repeated failures recoverable without losing focus', async () => {
  const user = userEvent.setup()
  const repeatedFailure = new Error('still unavailable')
  read
    .mockRejectedValueOnce(new Error('unavailable'))
    .mockRejectedValueOnce(repeatedFailure)
  const router = await mount()
  const recovery = await screen.findByRole('region', {
    name: 'The atlas did not load',
  })
  expect(document.activeElement).toBe(recovery)
  await user.tab()
  await user.keyboard('{Enter}')
  await waitFor(() => expect(read).toHaveBeenCalledTimes(2))
  await waitFor(() =>
    expect(router.state.matches.at(-1)?.error).toBe(repeatedFailure),
  )
  await waitFor(() =>
    expect(
      document.activeElement ===
        screen.getByRole('button', { name: 'Try again' }) ||
        document.activeElement ===
          screen.getByRole('region', { name: 'The atlas did not load' }),
    ).toBe(true),
  )
  screen.getByRole('link', { name: /dashboard/i }).focus()
  await user.keyboard('{Enter}')
  expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeTruthy()
  expect(router.state.location.pathname).toBe('/dashboard')
})
