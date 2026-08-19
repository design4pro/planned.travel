import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '#/lib/cn'
import { PRIMARY_NAV, isPathActive } from './nav-model'

/**
 * Bottom tab bar for small viewports — a designed mobile layout, not a squeezed
 * desktop one. Thumb-reachable, safe-area padded, and the active tab is marked
 * by both colour and a short rule so it does not rely on hue alone.
 */
export function MobileNav() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-0 bottom-0 z-nav border-t border-edge-faint bg-canvas/92 pb-safe backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {PRIMARY_NAV.map((item) => {
          const active = isPathActive(item.matches, pathname)
          return (
            <li key={item.id} className="flex-1">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex h-16 flex-col items-center justify-center gap-1 rounded-lg focus-ring',
                  'transition-colors duration-base ease-out-quint',
                  active ? 'text-ink' : 'text-ink-4 active:text-ink-3',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-5 top-0 h-0.5 rounded-full bg-brand',
                    'transition-opacity duration-base ease-out-quint',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <item.icon
                  aria-hidden
                  strokeWidth={active ? 2.4 : 2}
                  className={cn('size-5', active && 'text-brand')}
                />
                <span className="text-[0.6875rem] font-semibold leading-none">
                  {item.shortLabel}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
