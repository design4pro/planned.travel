import { definePreference } from '#/lib/local-preference'
import { daysBetween, daysUntil } from '#/lib/format'

/**
 * How the trip index is read, and the one figure the dashboard's prominent card draws from its dates
 * (`01-S7`).
 *
 * Isomorphic and pure apart from the preference declaration, which touches storage only through
 * `local-preference.ts`. The server imports {@link elapsedFraction} from here, so nothing in this
 * module may read a clock: today is always an argument.
 */

/** The two readings of the trip index, in the order the switch renders them. */
export const TRIP_VIEW_MODES = ['grid', 'list'] as const

export type TripViewMode = (typeof TRIP_VIEW_MODES)[number]

/** What `/trips` paints when neither the URL nor the reader has said otherwise. */
export const DEFAULT_TRIP_VIEW: TripViewMode = 'grid'

export function isTripViewMode(value: unknown): value is TripViewMode {
  return (
    typeof value === 'string' &&
    (TRIP_VIEW_MODES as ReadonlyArray<string>).includes(value)
  )
}

/** The remembered half of the index: the mode, and whether the archive was left open. */
export interface TripsViewPreference {
  readonly mode: TripViewMode
  readonly archiveOpen: boolean
}

const TRIPS_VIEW_FALLBACK: TripsViewPreference = {
  mode: DEFAULT_TRIP_VIEW,
  archiveOpen: false,
}

/**
 * Field by field rather than all or nothing: a mode this build does not know reads as the grid
 * without also closing an archive the reader left open.
 */
function parseTripsView(raw: string): TripsViewPreference | undefined {
  const value: unknown = JSON.parse(raw)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const record = value as { mode?: unknown; archiveOpen?: unknown }
  return {
    mode: isTripViewMode(record.mode) ? record.mode : DEFAULT_TRIP_VIEW,
    archiveOpen: record.archiveOpen === true,
  }
}

/**
 * The single record the switch writes, the `beforeLoad` seed reads and the archive fold keeps its
 * state in, so the three can never disagree about which key they mean.
 *
 * `local`, because `TRP-01` asks for the mode to be *persisted*: a reader who prefers the list is
 * owed the list tomorrow morning, not the grid. Layout-affecting first paint (see
 * `local-preference.ts`): the mode is never painted from storage. It reaches the screen only
 * through the URL, which the server reads too; the archive fold opens after hydration, below the
 * fold of every viewport, so it moves nothing on screen.
 */
export const TRIPS_VIEW_PREFERENCE = definePreference<TripsViewPreference>({
  key: 'planned.trips-view',
  area: 'local',
  fallback: TRIPS_VIEW_FALLBACK,
  parse: parseTripsView,
})

/**
 * The URL-wins rule: a search that already names a mode is returned **unchanged** — the same
 * object — so a shared link means what it says whatever the reader prefers. Without one, the
 * remembered mode is added, unless it is the default, which the URL already means by saying
 * nothing.
 *
 * Identity is the answer's signal: the caller redirects only when it gets a different object back.
 */
export function withRememberedView<
  TSearch extends Readonly<Record<string, unknown>> & {
    readonly view?: TripViewMode
  },
>(search: TSearch, remembered: TripViewMode): TSearch {
  if (search.view !== undefined || remembered === DEFAULT_TRIP_VIEW) {
    return search
  }
  return { ...search, view: remembered }
}

/**
 * How far through its dates a trip is on `today`, in `0..1`, or `null` without both dates.
 *
 * Counted in whole days, inclusively: day `k` of an `n`-day trip is `k / n`, so the last day of a
 * trip reads as full rather than as one day short, and a one-day trip is full on its day. Zero
 * before the start, one after the end.
 *
 * `today` is an argument so the server can pass `serverToday()` and the figure stays pinned by
 * `x-pt-server-today` in development; a component cannot compute it from a clock it does not have.
 */
export function elapsedFraction(
  startDate: string | null,
  endDate: string | null,
  today: string,
): number | null {
  const length = daysBetween(startDate, endDate)
  const startsIn = daysUntil(startDate, today)
  if (length === null || startsIn === null || length < 1) {
    return null
  }
  const dayOfTrip = 1 - startsIn
  return Math.min(Math.max(dayOfTrip / length, 0), 1)
}
