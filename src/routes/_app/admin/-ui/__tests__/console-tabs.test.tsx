import { render, screen, waitFor } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { describe, expect, it, vi } from 'vitest'
import { ConsoleTabs } from '../console-tabs'

vi.mock('#/lib/i18n', () => ({ useTranslate: () => (key: string) => key }))

function makeRouter(path: string) {
  const root = createRootRoute({
    component: () => (
      <>
        <ConsoleTabs />
        <Outlet />
      </>
    ),
  })
  const rooms = [
    '/admin',
    '/admin/members',
    '/admin/audit',
    '/admin/membership',
  ].map((roomPath) =>
    createRoute({
      getParentRoute: () => root,
      path: roomPath,
      component: () => (
        <section id="workspace-console-room" tabIndex={-1}>
          {roomPath}
        </section>
      ),
    }),
  )
  return createRouter({
    routeTree: root.addChildren(rooms),
    history: createMemoryHistory({ initialEntries: [path] }),
    isServer: false,
  })
}

describe('workspace console navigation', () => {
  it.each(['/admin', '/admin/members', '/admin/audit'])(
    'marks exactly the current room at %s',
    async (path) => {
      const router = makeRouter(path)
      render(<RouterProvider router={router} />)
      const nav = await screen.findByRole('navigation', {
        name: 'shell.admin.nav.label',
      })
      expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
      expect(
        nav.querySelector('[aria-current="page"]')?.getAttribute('href'),
      ).toBe(path)
    },
  )
  it('does not match a lookalike, and moves focus only when the room changes', async () => {
    const router = makeRouter('/admin')
    render(<RouterProvider router={router} />)
    await screen.findByRole('navigation')
    const first = document.getElementById('workspace-console-room')
    expect(document.activeElement).not.toBe(first)
    await router.navigate({ to: '/admin/members' })
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe('/admin/members'),
    )
    const link = screen.getByRole('link', { name: 'shell.admin.nav.audit' })
    link.focus()
    await router.invalidate()
    expect(document.activeElement).toBe(link)
    await router.navigate({ to: '/admin/membership' as '/admin' })
    await waitFor(() =>
      expect(
        screen
          .getByRole('navigation')
          .querySelectorAll('[aria-current="page"]'),
      ).toHaveLength(0),
    )
  })
})
