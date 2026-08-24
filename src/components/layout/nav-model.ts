import {
  Briefcase,
  CalendarDays,
  Coins,
  Compass,
  Globe,
  ListChecks,
  Map,
  Paperclip,
  PlaneTakeoff,
  Ticket,
  Users,
} from 'lucide-react'

import type { MessageKey } from '#/lib/i18n'
import type { LucideIcon } from 'lucide-react'

/**
 * Narrow unions rather than the router's full path union: every target here is
 * param-free, so `<Link>` never demands a `params` object.
 */
export type PrimaryNavTo = '/dashboard' | '/vacay' | '/atlas' | '/journey'

export interface NavItem {
  readonly id: string
  /**
   * Message keys rather than sentences: a module-scope array cannot call a hook,
   * and a literal checked against `MessageKey` fails to compile when it is wrong
   * (`docs/SPEC.md` §8.2 — no key resolves to English at run time).
   */
  readonly label: MessageKey
  /** Bottom tab bars have far less room than the desktop pill nav. */
  readonly shortLabel: MessageKey
  readonly to: PrimaryNavTo
  readonly icon: LucideIcon
  /** URL prefixes that light this item up, so deep pages keep their context. */
  readonly matches: ReadonlyArray<string>
}

/** The four product surfaces, in the order they appear in the pill nav. */
export const PRIMARY_NAV: ReadonlyArray<NavItem> = [
  {
    id: 'trips',
    label: 'shell.nav.trips',
    shortLabel: 'shell.nav.trips.short',
    to: '/dashboard',
    icon: Briefcase,
    matches: ['/dashboard', '/trips', '/collections'],
  },
  {
    id: 'vacay',
    label: 'shell.nav.vacay',
    shortLabel: 'shell.nav.vacay.short',
    to: '/vacay',
    icon: CalendarDays,
    matches: ['/vacay'],
  },
  {
    id: 'atlas',
    label: 'shell.nav.atlas',
    shortLabel: 'shell.nav.atlas.short',
    to: '/atlas',
    icon: Globe,
    matches: ['/atlas'],
  },
  {
    id: 'journey',
    label: 'shell.nav.journey',
    shortLabel: 'shell.nav.journey.short',
    to: '/journey',
    icon: Compass,
    matches: ['/journey'],
  },
]

export function isPathActive(matches: ReadonlyArray<string>, pathname: string): boolean {
  return matches.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/** Every tab inside a single trip. Same param shape, so one union types them all. */
export type TripTabTo =
  | '/trips/$tripId/plan'
  | '/trips/$tripId/transports'
  | '/trips/$tripId/book'
  | '/trips/$tripId/lists'
  | '/trips/$tripId/costs'
  | '/trips/$tripId/files'
  | '/trips/$tripId/collab'

export interface TripTab {
  readonly id: string
  readonly label: MessageKey
  readonly to: TripTabTo
  readonly icon: LucideIcon
}

export const TRIP_TABS: ReadonlyArray<TripTab> = [
  { id: 'plan', label: 'shell.trip.tab.plan', to: '/trips/$tripId/plan', icon: Map },
  {
    id: 'transports',
    label: 'shell.trip.tab.transports',
    to: '/trips/$tripId/transports',
    icon: PlaneTakeoff,
  },
  { id: 'book', label: 'shell.trip.tab.book', to: '/trips/$tripId/book', icon: Ticket },
  { id: 'lists', label: 'shell.trip.tab.lists', to: '/trips/$tripId/lists', icon: ListChecks },
  { id: 'costs', label: 'shell.trip.tab.costs', to: '/trips/$tripId/costs', icon: Coins },
  { id: 'files', label: 'shell.trip.tab.files', to: '/trips/$tripId/files', icon: Paperclip },
  { id: 'collab', label: 'shell.trip.tab.collab', to: '/trips/$tripId/collab', icon: Users },
]
