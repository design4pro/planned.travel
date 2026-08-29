import { defineKeyedPreference } from './local-preference'

/**
 * Which section of a trip a reader left open, remembered per trip.
 *
 * Isomorphic and free of storage access of its own: the vocabulary below is a
 * plain record and every read and write goes through the browser-preference
 * module, which is the one place that knows a `Storage` object exists.
 *
 * The tab ids and their routes are declared here rather than derived from
 * `TRIP_TABS`, so the memory stays free of the sub-navigation's icons and
 * message keys; the two are held in step by `src/lib/__tests__/trip-tab.test.ts`,
 * which fails the day an eighth tab arrives without a decision being taken here.
 */
export const TRIP_TAB_ROUTES = {
  plan: '/trips/$tripId/plan',
  transports: '/trips/$tripId/transports',
  book: '/trips/$tripId/book',
  lists: '/trips/$tripId/lists',
  costs: '/trips/$tripId/costs',
  files: '/trips/$tripId/files',
  collab: '/trips/$tripId/collab',
} as const satisfies Record<string, `/trips/$tripId/${string}`>

export type TripTabId = keyof typeof TRIP_TAB_ROUTES

/**
 * Every tab id, in the order the strip renders them — the record's own keys, so
 * a tab cannot be added to one and forgotten in the other.
 */
export const TRIP_TAB_IDS: ReadonlyArray<TripTabId> = Object.keys(
  TRIP_TAB_ROUTES,
) as Array<TripTabId>

/** The plan *is* the trip: it is where a trip opens when nothing says otherwise. */
export const DEFAULT_TRIP_TAB: TripTabId = 'plan'

export function isTripTabId(value: unknown): value is TripTabId {
  return typeof value === 'string' && Object.hasOwn(TRIP_TAB_ROUTES, value)
}

/**
 * One `local` record keyed by trip id, holding the twenty-four trips most
 * recently opened. `local` because `TRP-07` asks for the tab to be *persisted*:
 * a reader who works a trip's costs on Monday is owed the costs tab on
 * Thursday, not the plan.
 *
 * Layout-affecting first paint (see `local-preference.ts`): this preference
 * paints nothing. It is read once, in the browser only, as a redirect decision
 * — the strip never renders one tab and then another.
 */
export const TRIP_TAB_PREFERENCE = defineKeyedPreference<TripTabId>({
  key: 'planned.trip-tab',
  area: 'local',
  limit: 24,
  fallback: DEFAULT_TRIP_TAB,
  parse: (raw) => {
    const value: unknown = JSON.parse(raw)
    return isTripTabId(value) ? value : undefined
  },
})

/** The tab this trip was last left on, or the plan when there is no answer. */
export function readRememberedTripTab(tripId: string): TripTabId {
  return TRIP_TAB_PREFERENCE.read(tripId)
}

export function rememberTripTab(tripId: string, tab: TripTabId): void {
  TRIP_TAB_PREFERENCE.write(tripId, tab)
}
