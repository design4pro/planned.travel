import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { AppFrame } from '#/components/layout/app-frame'
import { RootErrorBoundary } from '#/components/layout/error-state'
import { MobileNav } from '#/components/layout/mobile-nav'
import { NotFoundPanel } from '#/components/layout/not-found'
import { TopNav } from '#/components/layout/top-nav'
import { loadShell } from './-server/shell'

/**
 * The authenticated shell.
 *
 * The guard lives in `beforeLoad` on purpose: a child route's `beforeLoad` and
 * `loader` only run once this one has resolved, so an anonymous visitor is
 * redirected before a single tenant-scoped query is attempted. The session it
 * resolves is put on the router context, which is how every module screen and
 * every navigation component reads the current user without re-fetching.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const shell = await loadShell()

    if (shell === null) {
      throw redirect({
        // An untyped href, because the sign-in routes live outside this tree.
        href: `/login?redirect=${encodeURIComponent(location.href)}`,
        statusCode: 302,
      })
    }

    return { shell }
  },
  errorComponent: RootErrorBoundary,
  notFoundComponent: () => (
    <AppFrame>
      <NotFoundPanel />
    </AppFrame>
  ),
  component: AppShell,
})

function AppShell() {
  const { shell } = Route.useRouteContext()

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <TopNav session={shell.session} unreadCount={shell.unreadCount} />
      <Outlet />
      <MobileNav />
    </div>
  )
}
