import * as React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { I18nProvider } from '#/lib/i18n'
import { namespaceCatalogue } from '#/lib/i18n/__tests__/namespace-translate'
import Shell from '#/lib/i18n/messages/en/shell'
import { Route as Parent } from '../../route'
import { Route as Members } from '../../members'
import { Route as Audit } from '../../audit'

const state = vi.hoisted(() => ({ load: vi.fn(), failRoom: false }))
vi.mock('../../../-server/overview', () => ({ loadAdmin: state.load }))
vi.mock('../console-panels', () => ({
  planLabel: () => 'Free',
  ConsolePanels: () => {
    if (state.failRoom) throw new Error('render failed')
    return <div>Protected roster</div>
  },
}))
vi.mock('#/components/layout/app-frame', () => ({
  AppFrame: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
  AppSections: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

afterEach(() => {
  vi.resetAllMocks()
  state.failRoom = false
})

async function mount(path: string) {
  const root = createRootRoute({ component: Outlet })
  const app = createRoute({
    getParentRoute: () => root,
    id: '_app',
    component: Outlet,
  })
  const parent = createRoute({
    getParentRoute: () => app,
    path: 'admin',
    loader: Parent.options.loader as () => Promise<unknown>,
    component: Parent.options.component,
    errorComponent: Parent.options.errorComponent,
  })
  const members = createRoute({
    getParentRoute: () => parent,
    path: 'members',
    component: Members.options.component,
    errorComponent: Members.options.errorComponent,
  })
  const audit = createRoute({
    getParentRoute: () => parent,
    path: 'audit',
    component: Audit.options.component,
    errorComponent: Audit.options.errorComponent,
  })
  const router = createRouter({
    routeTree: root.addChildren([
      app.addChildren([parent.addChildren([members, audit])]),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPendingMinMs: 0,
  })
  await router.load()
  render(
    <I18nProvider locale="en" messages={namespaceCatalogue('shell', Shell)}>
      <RouterProvider router={router} />
    </I18nProvider>,
  )
  return router
}

const payload = {
  organization: { name: 'Own workspace', createdAt: new Date().toISOString() },
  plan: 'free',
}

it('removes the protected room after demotion and revalidation', async () => {
  state.load.mockResolvedValueOnce(payload).mockResolvedValueOnce(null)
  const router = await mount('/admin/members')
  expect(await screen.findByText('Protected roster')).toBeTruthy()
  await act(async () => {
    await router.invalidate()
  })
  await waitFor(() => expect(screen.queryByText('Protected roster')).toBeNull())
  expect(
    screen.queryByRole('navigation', { name: 'Workspace administration' }),
  ).toBeNull()
})

it('shows the aggregate error without a protected room when the parent load fails', async () => {
  state.load.mockRejectedValue(new Error('load failed'))
  await mount('/admin/members')
  expect(await screen.findByText('The admin console did not load')).toBeTruthy()
  expect(screen.queryByText('Protected roster')).toBeNull()
})

it('keeps the shared header and navigation when a child render fails', async () => {
  state.load.mockResolvedValue(payload)
  state.failRoom = true
  await mount('/admin/audit')
  expect(await screen.findByText('Recent activity did not load')).toBeTruthy()
  expect(screen.getByText('Own workspace')).toBeTruthy()
  expect(
    screen.getByRole('navigation', { name: 'Workspace administration' }),
  ).toBeTruthy()
})
