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

import { Route } from '../../atlas'

const read = vi.hoisted(() => vi.fn())
vi.mock('../../-server/library', () => ({ loadAtlas: read }))
vi.mock('#/components/layout/app-frame', () => ({
  AppFrame: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('../atlas-screen', () => ({
  AtlasScreen: () => <div data-testid="atlas-screen">Atlas figures</div>,
  AtlasScreenPending: () => <div>Loading atlas</div>,
  AtlasScreenError: () => <div role="alert">Atlas route failed</div>,
}))

afterEach(() => vi.clearAllMocks())

it('replaces the mounted atlas with its route error component when the second loader read fails', async () => {
  read
    .mockResolvedValueOnce({ stats: [] })
    .mockRejectedValueOnce(new Error('reload unavailable'))
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
  const router = createRouter({
    routeTree: root.addChildren([app.addChildren([atlas])]),
    history: createMemoryHistory({ initialEntries: ['/atlas'] }),
    defaultPendingMinMs: 0,
  })
  await router.load()
  render(<RouterProvider router={router} />)
  expect(await screen.findByTestId('atlas-screen')).toBeTruthy()
  await act(async () => {
    await router.invalidate()
  })
  await waitFor(() => expect(screen.queryByTestId('atlas-screen')).toBeNull())
  expect(screen.getByRole('alert').textContent).toBe('Atlas route failed')
  expect(read).toHaveBeenCalledTimes(2)
  expect(router.state.matches.at(-1)?.status).toBe('error')
})
