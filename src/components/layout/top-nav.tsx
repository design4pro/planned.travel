import { Link, useRouterState } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { cn } from '#/lib/cn'
import { Wordmark } from './brand'
import { buttonClass } from './kit'
import { NotificationBell } from './notification-bell'
import { PillNav } from './pill-nav'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'

import type { ShellSession } from './session'

export interface TopNavProps {
  session: ShellSession
  unreadCount?: number
  /**
   * True when the impersonation warning bar is rendered above this nav.
   *
   * The bar is then the topmost chrome and therefore the element that clears the
   * display cutout, so the nav stops padding for it and pins below the bar
   * instead of at the viewport top. Padding for it twice would leave the nav's
   * contents floating in a band of empty canvas on every notched device; not
   * padding at all would put the bar's own copy under the status bar. With no
   * bar the classes are exactly what they always were.
   */
  belowImpersonationBar?: boolean
}

/**
 * The one persistent bar: wordmark, centred section switcher, account actions.
 * Translucent over the canvas so long pages keep a sense of depth while
 * scrolling, and never taller than `--nav-h` so `pt-nav` offsets stay honest.
 */
export function TopNav({
  session,
  unreadCount = 0,
  belowImpersonationBar = false,
}: TopNavProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <header
      className={cn(
        'sticky z-nav border-b border-edge-faint bg-canvas/85 backdrop-blur-xl',
        belowImpersonationBar
          ? 'top-[calc(var(--safe-top)+var(--impersonation-h))]'
          : 'top-0 pt-safe',
      )}
    >
      <div className="mx-auto flex h-nav max-w-content items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          to="/dashboard"
          aria-label="planned.travel dashboard"
          className="shrink-0 rounded-md focus-ring"
        >
          <Wordmark />
        </Link>

        <div className="hidden flex-1 justify-center lg:flex">
          <PillNav pathname={pathname} />
        </div>

        <div className="ml-auto flex items-center gap-1 lg:ml-0">
          <Link
            to="/trips"
            className={cn(
              buttonClass({ variant: 'primary', size: 'sm' }),
              'mr-1 hidden xl:inline-flex',
            )}
          >
            <Plus aria-hidden className="size-4" strokeWidth={2.5} />
            New trip
          </Link>
          <ThemeToggle />
          <NotificationBell unreadCount={unreadCount} />
          <div className="ml-1">
            <UserMenu session={session} />
          </div>
        </div>
      </div>
    </header>
  )
}
