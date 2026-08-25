import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { AppFrame } from '#/components/layout/app-frame'
import { RootErrorBoundary } from '#/components/layout/error-state'
import { ImpersonationBar } from '#/components/layout/impersonation-bar'
import { MobileNav } from '#/components/layout/mobile-nav'
import { NotFoundPanel } from '#/components/layout/not-found'
import { TopNav } from '#/components/layout/top-nav'
import { SHELL_BOTTOM_CLASS } from '#/lib/atlas/layout'
import { cn } from '#/lib/cn'
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

/**
 * The impersonation warning bar is rendered here and only here.
 *
 * `docs/ACCESS.md` §6.1 and `docs/SPEC.md` §5 both bound "every screen" to this
 * wrapper: it is the only one with a session in scope, so no route inside it can
 * omit the bar and no route can scroll it away. It is deliberately *not* threaded
 * into `src/routes/__root.tsx` — the `(auth)` tree and the public marketing pages
 * render under `RootDocument`, whose router context carries no session, and
 * putting an auth read in front of every anonymous page to cover a case that
 * should not arise is the cost §6.1 declines.
 *
 * It is first in this subtree so the End impersonation button is the shell's
 * first tab stop, with the reading order and the visual order the same thing.
 * `data-impersonated` raises `--impersonation-h` from `0rem` for everything
 * inside, which is how the whole shell moves down by exactly one bar and how a
 * shell without one keeps precisely the geometry it had.
 *
 * **Both edges of the viewport are reserved here, and only here.** The top one
 * is the bar's row; the bottom one is `MobileNav`, which is `fixed` below `lg`
 * and therefore displaces nothing and covers the last row of whatever is behind
 * it. The wrapper around the outlet gives that box real height —
 * {@link SHELL_BOTTOM_CLASS}, assembled from the same `MOBILE_TAB_BAR` list
 * every chrome expression in the product reads — so no route can render under
 * the tab bar and no route has to remember not to. Per-route padding cannot
 * stand in for it: `AppFrame`'s `bleed` branch has none by design, and a screen
 * that renders no `AppFrame` at all still renders inside this shell.
 *
 * `data-app-shell` is the marker the stylesheet's `scroll-padding-bottom` is
 * scoped by. That reservation is the same box in scroll geometry rather than in
 * layout — where the browser stops when it scrolls something into view — and it
 * belongs to this document alone, not to the marketing tree or the auth tree.
 */
function AppShell() {
  const { shell } = Route.useRouteContext()
  const impersonated = shell.session.impersonatedBy !== null

  return (
    <div
      className="flex min-h-svh flex-col bg-canvas"
      data-app-shell=""
      data-impersonated={impersonated ? '' : undefined}
    >
      <ImpersonationBar session={shell.session} />
      <TopNav
        session={shell.session}
        unreadCount={shell.unreadCount}
        belowImpersonationBar={impersonated}
      />
      <div className={cn('flex flex-1 flex-col', SHELL_BOTTOM_CLASS)}>
        <Outlet />
      </div>
      <MobileNav />
    </div>
  )
}
