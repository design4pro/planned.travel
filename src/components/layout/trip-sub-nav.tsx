import { Link, useRouterState } from '@tanstack/react-router'
import { ChevronLeft, Share2 } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { cn } from '#/lib/cn'
import { TRIP_TABS } from './nav-model'

const EASE_OUT_QUINT = [0.23, 1, 0.32, 1] as const

export interface TripSubNavProps {
  tripId: string
  tripName: string
}

/**
 * The in-trip tab bar, on a near-black inverse band so the trip's own workspace
 * reads as a distinct place inside the app. Tabs scroll horizontally on narrow
 * viewports; the trip title moves to its own row there rather than truncating
 * to nothing.
 */
export function TripSubNav({ tripId, tripName }: TripSubNavProps) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const reduceMotion = useReducedMotion()
  const transition = reduceMotion ? { duration: 0 } : { duration: 0.26, ease: EASE_OUT_QUINT }

  return (
    <div className="sticky top-[calc(var(--safe-top)+var(--nav-h)+var(--impersonation-h))] z-nav border-b border-inverse-edge bg-inverse text-inverse-on">
      {/* Narrow viewports get the trip context on its own line. */}
      <div className="mx-auto flex h-11 max-w-content items-center gap-2 px-4 sm:px-6 lg:hidden">
        <BackToTrips />
        <p className="min-w-0 flex-1 truncate font-display text-label font-bold">{tripName}</p>
        <ShareLink tripId={tripId} compact />
      </div>

      <div className="mx-auto flex max-w-content items-center gap-3 px-4 sm:px-6 lg:px-8">
        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          <BackToTrips />
          <span aria-hidden className="h-4 w-px bg-inverse-edge" />
          <p className="max-w-56 truncate font-display text-label font-bold">{tripName}</p>
        </div>

        <nav aria-label="Trip sections" className="min-w-0 flex-1">
          <ul className="scrollbar-none flex h-subnav items-center gap-1 overflow-x-auto">
            {TRIP_TABS.map((tab) => {
              const href = tab.to.replace('$tripId', tripId)
              const active = pathname === href || pathname.startsWith(`${href}/`)
              return (
                <li key={tab.id} className="shrink-0">
                  <Link
                    to={tab.to}
                    params={{ tripId }}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative isolate inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-label font-medium focus-ring',
                      'transition-colors duration-base ease-out-quint',
                      active
                        ? 'text-brand-on'
                        : 'text-inverse-muted hover:bg-inverse-surface hover:text-inverse-on',
                    )}
                  >
                    {active ? (
                      <motion.span
                        aria-hidden
                        layoutId="trip-tab-thumb"
                        transition={transition}
                        className="absolute inset-0 -z-10 rounded-full bg-brand"
                      />
                    ) : null}
                    <tab.icon aria-hidden strokeWidth={2} className="size-4" />
                    {tab.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <ShareLink tripId={tripId} className="hidden lg:inline-flex" />
      </div>
    </div>
  )
}

function BackToTrips() {
  return (
    <Link
      to="/trips"
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1 rounded-full pl-1.5 pr-2.5 text-label font-medium text-inverse-muted focus-ring',
        'transition-colors duration-base ease-out-quint hover:bg-inverse-surface hover:text-inverse-on',
      )}
    >
      <ChevronLeft aria-hidden className="size-4" />
      Trips
    </Link>
  )
}

function ShareLink({
  tripId,
  compact = false,
  className,
}: {
  tripId: string
  compact?: boolean
  className?: string
}) {
  return (
    <Link
      to="/trips/$tripId/collab"
      params={{ tripId }}
      aria-label="Share this trip"
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-2 rounded-full border border-inverse-edge bg-inverse-surface px-3 text-label font-medium text-inverse-on focus-ring',
        'transition-colors duration-base ease-out-quint hover:bg-inverse-surface/70',
        className,
      )}
    >
      <Share2 aria-hidden className="size-4" />
      {compact ? null : 'Share'}
    </Link>
  )
}
