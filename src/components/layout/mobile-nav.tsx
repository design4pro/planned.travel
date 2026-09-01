import { Link, useRouterState } from '@tanstack/react-router'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { PRIMARY_NAV, isPathActive } from './nav-model'

/**
 * Bottom tab bar for small viewports — a designed mobile layout, not a squeezed
 * desktop one. Thumb-reachable, safe-area padded, and the active tab is marked
 * by both colour and a short rule so it does not rely on hue alone.
 *
 * **There is no navigation drawer, deliberately.** The shell has exactly four
 * primary sections, which is the number a tab bar shows all of at once at 360px;
 * a drawer would hide all four behind a button, cost a tap and an animation to
 * reach any of them, and add a focus trap and a scrim to keyboard-test. So the
 * three surfaces that mirror under `dir="rtl"` are this bar, `top-nav.tsx` and
 * the `pill-nav.tsx` inside it, and there is no fourth. If a later module needs
 * a sheet, `src/components/ui` already ships one — the chrome does not.
 *
 * Every inset is logical (`start-0`/`end-0` rather than `inset-x-0`), because
 * `ar` turns the whole bar round and the four tabs then read right to left with
 * the active rule still over the tab it belongs to. The label is a single
 * truncating line: several of the twenty-three translations of "Journey" are
 * half again as long as the English, and a wrapping tab would grow the bar's
 * height after paint.
 */
export function MobileNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const t = useTranslate()

  return (
    <nav
      aria-label={t('shell.nav.mobile')}
      className="fixed start-0 end-0 bottom-0 z-nav border-t border-edge-faint bg-canvas/92 pb-safe backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-md items-stretch">
        {PRIMARY_NAV.map((item) => {
          const active = isPathActive(item.matches, pathname)
          return (
            <li key={item.id} className="min-w-0 flex-1">
              <Link
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex h-16 flex-col items-center justify-center gap-1 rounded-lg px-1 focus-ring',
                  'transition-colors duration-base ease-out-quint',
                  active
                    ? 'text-ink'
                    : 'text-ink-4 hover:text-ink-3 active:text-ink-2',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'absolute start-5 end-5 top-0 h-0.5 rounded-full bg-brand',
                    'transition-opacity duration-base ease-out-quint',
                    active ? 'opacity-100' : 'opacity-0',
                  )}
                />
                <item.icon
                  aria-hidden
                  strokeWidth={active ? 2.4 : 2}
                  className={cn('size-5 shrink-0', active && 'text-brand')}
                />
                {/* `text-micro` carries the product's 11px/600/0.08em label
                    tracking, which `:lang(ar)` already zeroes in
                    `src/styles/styles.css` — Arabic gets the same box without
                    the Latin letter-spacing. */}
                <span className="max-w-full truncate text-micro">
                  {t(item.shortLabel)}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
