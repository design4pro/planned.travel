import { useEffect } from 'react'
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

import { publishBasemap } from '#/lib/map/basemap'
import { AppFrame } from '#/components/layout/app-frame'
import { RootErrorBoundary } from '#/components/layout/error-state'
import { ImpersonationBar } from '#/components/layout/impersonation-bar'
import { MobileNav } from '#/components/layout/mobile-nav'
import { NotFoundPanel } from '#/components/layout/not-found'
import { TopNav } from '#/components/layout/top-nav'
import { BookImportWidget } from '#/components/modules/book'
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
 * **The top edge of the viewport is the shell's; the bottom edge is not.** The
 * bar's row is reserved here because nothing below the shell knows the bar
 * exists. `MobileNav` is the opposite case: it is `fixed` below `lg`, and the
 * two things that clear it already exist and are not this component's. The
 * content well reserves the gutter — `AppFrame` ships
 * `pb-[calc(var(--safe-bottom)+8.5rem)] lg:pb-16` and says so in its own docblock
 * — and a full-bleed slice stops at the bar's top edge by arithmetic, out of
 * `MOBILE_TAB_BAR` in `src/lib/atlas/layout.ts`. A third reservation around the
 * outlet stacks on both: a second 65px box beneath the 136px the content well
 * already pads leaves 71 + 65 = 136px of canvas visible below the bar instead of
 * the 71px gutter that was designed, on every non-bleed screen below `lg`. It
 * shipped once, and the full-page mobile baselines were re-recorded around it
 * before it was caught.
 *
 * `data-app-shell` is the marker the stylesheet's `scroll-padding-bottom` is
 * scoped by. That is scroll geometry rather than layout — where the browser
 * stops when it scrolls something into view, which no amount of padding on an
 * ancestor can decide — and it belongs to this document alone, not to the
 * marketing tree or the auth tree.
 */
function AppShell() {
  const { shell } = Route.useRouteContext()
  const impersonated = shell.session.impersonatedBy !== null

  /*
   * The traveller's basemap, onto the module store every mounted map reads.
   *
   * In an effect and not in the render body because the store is client-only by
   * construction: module scope in a Worker isolate is shared across requests, so
   * `publishBasemap` refuses to write on the server. An effect runs after
   * hydration, which is also when MapLibre's own bootstrap runs — two dynamic
   * imports inside `MapCanvas`'s mount effect — so no frame is ever painted from
   * the `auto` server snapshot and there is nothing to correct.
   */
  useEffect(() => {
    publishBasemap(shell.mapStyle)
  }, [shell.mapStyle])

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
      <Outlet />
      <MobileNav />
      {/*
       * Mounted here because a confirmation import outlives the desk that started it: the reader
       * closes the dialog, walks to another trip, reloads, and the reading is still running and
       * still visible. Last in the subtree rather than beside the impersonation bar, so the End
       * impersonation button keeps the shell's first tab stop; it renders nothing at all until a
       * job is in the register.
       */}
      <BookImportWidget userId={shell.session.user.id} />
    </div>
  )
}
