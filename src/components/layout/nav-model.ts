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

import type { LucideIcon } from 'lucide-react'

/**
 * Narrow unions rather than the router's full path union: every target here is
 * param-free, so `<Link>` never demands a `params` object.
 */
export type PrimaryNavTo = '/dashboard' | '/vacay' | '/atlas' | '/journey'

export interface NavItem {
  readonly id: string
  readonly label: string
  /** Bottom tab bars have far less room than the desktop pill nav. */
  readonly shortLabel: string
  readonly to: PrimaryNavTo
  readonly icon: LucideIcon
  /** URL prefixes that light this item up, so deep pages keep their context. */
  readonly matches: ReadonlyArray<string>
}

/** The four product surfaces, in the order they appear in the pill nav. */
export const PRIMARY_NAV: ReadonlyArray<NavItem> = [
  {
    id: 'trips',
    label: 'My Trips',
    shortLabel: 'Trips',
    to: '/dashboard',
    icon: Briefcase,
    matches: ['/dashboard', '/trips', '/collections'],
  },
  {
    id: 'vacay',
    label: 'Vacay',
    shortLabel: 'Vacay',
    to: '/vacay',
    icon: CalendarDays,
    matches: ['/vacay'],
  },
  {
    id: 'atlas',
    label: 'Atlas',
    shortLabel: 'Atlas',
    to: '/atlas',
    icon: Globe,
    matches: ['/atlas'],
  },
  {
    id: 'journey',
    label: 'Journey',
    shortLabel: 'Journey',
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
  readonly label: string
  readonly to: TripTabTo
  readonly icon: LucideIcon
}

export const TRIP_TABS: ReadonlyArray<TripTab> = [
  { id: 'plan', label: 'Plan', to: '/trips/$tripId/plan', icon: Map },
  { id: 'transports', label: 'Transports', to: '/trips/$tripId/transports', icon: PlaneTakeoff },
  { id: 'book', label: 'Book', to: '/trips/$tripId/book', icon: Ticket },
  { id: 'lists', label: 'Lists', to: '/trips/$tripId/lists', icon: ListChecks },
  { id: 'costs', label: 'Costs', to: '/trips/$tripId/costs', icon: Coins },
  { id: 'files', label: 'Files', to: '/trips/$tripId/files', icon: Paperclip },
  { id: 'collab', label: 'Collab', to: '/trips/$tripId/collab', icon: Users },
]
