import { Link } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { PRIMARY_NAV, isPathActive } from './nav-model'

import type { NavItem } from './nav-model'

/** Token easing, expressed as the cubic-bezier array motion expects. */
const EASE_OUT_QUINT = [0.23, 1, 0.32, 1] as const

export interface PillNavProps {
  pathname: string
  items?: ReadonlyArray<NavItem>
  className?: string
}

/**
 * Segmented control on a tinted track. The active thumb is a single shared
 * element, so switching sections slides it rather than cross-fading two pills —
 * transform only, and instant for anyone who asked for reduced motion.
 */
export function PillNav({
  pathname,
  items = PRIMARY_NAV,
  className,
}: PillNavProps) {
  const t = useTranslate()
  const reduceMotion = useReducedMotion()
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.26, ease: EASE_OUT_QUINT }

  return (
    <nav
      aria-label={t('shell.nav.primary')}
      className={cn(
        'flex items-center gap-0.5 rounded-full bg-track p-1',
        className,
      )}
    >
      {items.map((item) => {
        const active = isPathActive(item.matches, pathname)
        return (
          <Link
            key={item.id}
            to={item.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              // 40px, the ladder's `md`, because this bar also holds the theme
              // toggle, the bell and the "New trip" button and they all sit on
              // one line. `font-medium` stays: a nav pill is not a button, and
              // the weight is what says so.
              'relative isolate inline-flex h-10 items-center gap-2 rounded-full px-3.5 text-label font-medium focus-ring',
              'transition-colors duration-base ease-out-quint lg:px-4',
              active ? 'text-ink' : 'text-ink-3 hover:text-ink-2',
            )}
          >
            {active ? (
              <motion.span
                aria-hidden
                layoutId="pill-nav-thumb"
                transition={transition}
                className="absolute inset-0 -z-10 rounded-full bg-track-thumb shadow-card"
              />
            ) : null}
            <item.icon
              aria-hidden
              strokeWidth={2}
              className={cn(
                'size-4 transition-colors duration-base ease-out-quint',
                active ? 'text-brand' : 'text-ink-4',
              )}
            />
            <span>{t(item.label)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
