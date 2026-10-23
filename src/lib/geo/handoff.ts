/**
 * The map hand-off: a place, or a day's placed stops in visiting order, as a link into the
 * map application the reader actually navigates with (`CONTEXT.md`, *Map hand-off*).
 *
 * Each target is a documented public URL format, so nothing here is a guess about an
 * app's private scheme:
 *
 * - Google Maps URLs, `developers.google.com/maps/documentation/urls/get-started` — a
 *   search URL for a point, a directions URL for a route.
 * - OpenStreetMap, `wiki.openstreetmap.org/wiki/Browsing` — `mlat`/`mlon` mark a point.
 *   osm.org's route form carries a start and an end only, so a day has no OpenStreetMap
 *   link: one that dropped the stops in between without saying so would be worse than none.
 *
 * `geo:` is deliberately not built: it resolves on Android and nowhere else that matters
 * here (iOS Safari and desktop browsers have no handler), which makes it a dead control
 * for most readers. Coordinates go through `formatCoordinate`, the one formatter for them,
 * so a link carries dot decimals and never a locale comma or an exponent.
 *
 * Pure and isomorphic: no DOM, no network, no runtime dependency (the one import from another
 * layer is a type).
 */

import { formatCoordinate } from './position'

import type { TransportMode } from '#/components/modules/transports/vocabulary'
import type { GeoPosition } from './position'

export type MapService = 'google' | 'openstreetmap'

/** The services a single place is offered in, in the order they are listed. */
export const POINT_SERVICES: ReadonlyArray<MapService> = [
  'google',
  'openstreetmap',
]

/**
 * What each service is called. Brand names are data, not translated text, so a catalogue
 * sentence receives one as a parameter instead of spelling it.
 */
export const MAP_SERVICE_NAME: Readonly<Record<MapService, string>> = {
  google: 'Google Maps',
  openstreetmap: 'OpenStreetMap',
}

/**
 * Intermediate stops one Google Maps directions link may carry.
 *
 * `developers.google.com/maps/documentation/urls/get-started`, parameter `waypoints`: "up
 * to three waypoints supported on mobile browsers, and a maximum of nine waypoints
 * supported otherwise." One link serves every reader and the product does not sniff the
 * user agent, so the lower figure rules: a link that carried more would lose stops on a
 * phone without saying so.
 */
export const GOOGLE_DIRECTIONS_MAX_WAYPOINTS = 3

/** The origin and the destination, plus the waypoints between them. */
export const GOOGLE_DIRECTIONS_MAX_STOPS = GOOGLE_DIRECTIONS_MAX_WAYPOINTS + 2

/** A stop as the planner holds it: either coordinate may be missing. */
export interface HandoffStop {
  readonly lat: number | null
  readonly lng: number | null
}

/**
 * What a day offers. `carried` of `total` placed stops are in the link, so a caller can say
 * "first 5 of 8" instead of letting the link drop the rest.
 */
export interface DayHandoff {
  /** One placed stop gets a point link; two or more get directions. */
  readonly kind: 'point' | 'directions'
  readonly href: string
  readonly carried: number
  readonly total: number
}

const GOOGLE_SEARCH = 'https://www.google.com/maps/search/'
const GOOGLE_DIRECTIONS = 'https://www.google.com/maps/dir/'
const OSM_MAP = 'https://www.openstreetmap.org/'

/** Close enough to read a street, the zoom the OSM link centres at. */
const OSM_POINT_ZOOM = 17

function pair(position: GeoPosition): string {
  return `${formatCoordinate(position.lat)},${formatCoordinate(position.lng)}`
}

/** The position of a stop that has both coordinates, `null` for one that does not. */
export function positionOf(stop: HandoffStop): GeoPosition | null {
  if (stop.lat === null || stop.lng === null) return null
  return { lat: stop.lat, lng: stop.lng }
}

/** A link that opens one point in `service`. */
export function pointLink(service: MapService, position: GeoPosition): string {
  const lat = formatCoordinate(position.lat)
  const lng = formatCoordinate(position.lng)
  if (service === 'openstreetmap') {
    const query = new URLSearchParams({ mlat: lat, mlon: lng })
    return `${OSM_MAP}?${query}#map=${OSM_POINT_ZOOM}/${lat}/${lng}`
  }
  return `${GOOGLE_SEARCH}?${new URLSearchParams({ api: '1', query: pair(position) })}`
}

/**
 * The link a day offers for its stops in the order given: `null` with no placed stop, a
 * point link with one, Google Maps directions with two or more. A stop without both
 * coordinates is skipped and never shifts the others; past
 * {@link GOOGLE_DIRECTIONS_MAX_STOPS} the first stops in order are carried and `carried`
 * says how many.
 */
export function dayHandoff(
  stops: ReadonlyArray<HandoffStop>,
): DayHandoff | null {
  const placed = stops.flatMap((stop) => positionOf(stop) ?? [])
  const first = placed[0]
  if (first === undefined) return null
  if (placed.length === 1) {
    return {
      kind: 'point',
      href: pointLink('google', first),
      carried: 1,
      total: 1,
    }
  }

  const carried = placed.slice(0, GOOGLE_DIRECTIONS_MAX_STOPS)
  const query = new URLSearchParams({
    api: '1',
    origin: pair(first),
    destination: pair(carried[carried.length - 1] ?? first),
  })
  const waypoints = carried.slice(1, -1)
  if (waypoints.length > 0)
    query.set('waypoints', waypoints.map(pair).join('|'))

  return {
    kind: 'directions',
    href: `${GOOGLE_DIRECTIONS}?${query}`,
    carried: carried.length,
    total: placed.length,
  }
}

/**
 * The Transport modes that split a day: a flight, a ferry or a train leaves the area one
 * map link can serve, so the stops either side of it are not routed together. A local mode
 * (a bus, a taxi, a walk) stays within it, and `other` says nothing about distance.
 *
 * Typed from the Transport mode vocabulary, so a mode renamed there is a compile error
 * here. The decision is by mode alone: names and times are free text and nothing is
 * computed from coordinates (ADR 0019).
 */
export const JOURNEY_SPLIT_MODES: ReadonlyArray<TransportMode> = [
  'flight',
  'ferry',
  'train',
]

/**
 * What a day's displayed sequence holds, as far as the hand-off reads it. `PlannerItem`
 * satisfies it structurally, so the planner passes `day.items` as it is. `mode` is a plain
 * string because the column's `CHECK` was added after rows existed.
 */
export type DayHandoffItem =
  | { readonly kind: 'stop'; readonly row: HandoffStop }
  | {
      readonly kind: 'transport'
      readonly transport: { readonly mode: string }
    }
  | { readonly kind: 'note' }

function splitsDay(item: DayHandoffItem): boolean {
  if (item.kind !== 'transport') return false
  return (JOURNEY_SPLIT_MODES as ReadonlyArray<string>).includes(
    item.transport.mode,
  )
}

/**
 * The links a day offers: its displayed sequence cut at every {@link JOURNEY_SPLIT_MODES}
 * Transport, each stretch handled by {@link dayHandoff}. A day no journey splits gives the
 * one link it always gave; a stretch with no placed stop gives none, so a journey first or
 * last in the day, or next to another, cuts nothing visible. The cut is by position in the
 * sequence the reader sees, never by a part, a time or a coordinate.
 */
export function dayHandoffs(
  items: ReadonlyArray<DayHandoffItem>,
): ReadonlyArray<DayHandoff> {
  const stretches: Array<Array<HandoffStop>> = [[]]
  for (const item of items) {
    if (splitsDay(item)) stretches.push([])
    else if (item.kind === 'stop')
      stretches[stretches.length - 1]?.push(item.row)
  }
  return stretches.flatMap((stops) => dayHandoff(stops) ?? [])
}
