/**
 * From the trip's rows to the planner's view models.
 *
 * The one adapter between the loader's normalised payload and the three surfaces
 * that draw it — the itinerary rail, the ideas rail and the map. Keeping it pure and
 * in one file buys two things: every date and duration is formatted exactly once, and
 * the optimistic board is derived from an arrangement (`PlanOrder`) rather than
 * patched in place, so an in-flight drag and the loader's truth cannot diverge into
 * two half-correct lists.
 *
 * The row index deliberately holds *two* entries per place — one under its assignment
 * id and one under its idea id. A drag between the rails changes which of the two the
 * board asks for before the server has confirmed anything, and having both means the
 * optimistic render never has to invent a row.
 */

import { ideaItemId } from '#/components/planner'
import { formatTimeRange, formatWeekday } from '../../../-lib/format'
import { DEFAULT_LOCALE } from '#/lib/i18n/locales'

import type { Locale } from '#/lib/i18n/locales'

import type { MapCategory, MapPlace } from '#/components/map'
import type {
  PlanOrder,
  PlannerCategory,
  PlannerDay,
  PlannerRow,
} from '#/components/planner'
import type {
  PlanBoardDay,
  PlanBoardPayload,
  PlanBoardPlace,
} from '../-server/plan'

/** Minutes into the compact `2h 30m` the rails use. */
export function formatDuration(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/** Metres into `450 m` / `2.4 km` / `18 km`, matching the route sheet's scale bar. */
export function formatMetres(metres: number): string {
  if (metres < 1000) return `${Math.round(metres / 10) * 10} m`
  const km = metres / 1000
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`
}

/** The arrangement the board starts from: the server's own order. */
export function orderFromPayload(payload: PlanBoardPayload): PlanOrder {
  return {
    days: payload.days.map((day) => ({
      dayId: day.dayId,
      itemIds: day.stops.map((stop) => stop.assignmentId),
    })),
    ideaIds: payload.unscheduledIds.map((placeId) => ideaItemId(placeId)),
  }
}

function titleOf(day: PlanBoardDay): string {
  return day.title ?? `Day ${day.dayNumber}`
}

/**
 * Every row the board could need, keyed by draggable id.
 *
 * A scheduled stop carries its assignment's times, length, note and booking state; an
 * idea carries only the place, because an unscheduled place has no times to carry.
 * `dayNumber` is filled in later from the arrangement rather than stored here — it is
 * a property of where the row currently *is*, and during a drag that is not yet what
 * the server thinks.
 */
function rowIndexOf(payload: PlanBoardPayload): Map<string, PlannerRow> {
  const placeById = new Map(payload.places.map((place) => [place.id, place]))
  const rows = new Map<string, PlannerRow>()

  const base = (
    place: PlanBoardPlace,
  ): Omit<
    PlannerRow,
    | 'itemId'
    | 'assignmentId'
    | 'time'
    | 'duration'
    | 'note'
    | 'reservationStatus'
    | 'dayNumber'
  > => ({
    placeId: place.id,
    name: place.name,
    location: place.address ?? place.city,
    categoryId: place.categoryId,
    imageUrl: place.imageUrl,
    rating: place.rating,
    lng: place.lng,
    lat: place.lat,
    visited: place.isVisited,
  })

  for (const place of payload.places) {
    rows.set(ideaItemId(place.id), {
      ...base(place),
      itemId: ideaItemId(place.id),
      assignmentId: null,
      time: null,
      duration: formatDuration(place.durationMinutes),
      note: null,
      reservationStatus: 'none',
      dayNumber: null,
    })
  }

  for (const day of payload.days) {
    for (const stop of day.stops) {
      const place = placeById.get(stop.placeId)
      if (place === undefined) continue
      rows.set(stop.assignmentId, {
        ...base(place),
        itemId: stop.assignmentId,
        assignmentId: stop.assignmentId,
        time: formatTimeRange(stop.startTime, stop.endTime),
        duration: formatDuration(stop.durationMinutes ?? place.durationMinutes),
        note: stop.notes,
        reservationStatus: stop.reservationStatus,
        dayNumber: day.dayNumber,
      })
    }
  }

  return rows
}

export interface PlanModel {
  readonly days: ReadonlyArray<PlannerDay>
  readonly ideas: ReadonlyArray<PlannerRow>
  readonly categories: ReadonlyArray<PlannerCategory>
  /** Every row the board can show, by draggable id. */
  readonly rowsByItem: ReadonlyMap<string, PlannerRow>
  /** The row currently representing a place, by place id — the map's index. */
  readonly rowsByPlace: ReadonlyMap<string, PlannerRow>
  /** Which day each place sits on right now, for the pin numeral. */
  readonly dayNumberByPlace: ReadonlyMap<string, number>
  readonly scheduledCount: number
  readonly stopCountByCategory: Readonly<Record<string, number>>
}

/**
 * Materialises the board for one arrangement.
 *
 * Pure and cheap: two passes over a few dozen rows. Called on every render of the
 * screen with a memo, and on every frame of a drag with the optimistic arrangement,
 * which is what makes a drop feel instant while the write is still in the air.
 */
export function planModel(
  payload: PlanBoardPayload,
  order: PlanOrder,
  locale: Locale = DEFAULT_LOCALE,
): PlanModel {
  const rowsByItem = rowIndexOf(payload)
  const dayMeta = new Map(payload.days.map((day) => [day.dayId, day]))

  const days: Array<PlannerDay> = []
  const dayNumberByPlace = new Map<string, number>()
  const rowsByPlace = new Map<string, PlannerRow>()
  const stopCountByCategory: Record<string, number> = {}

  for (const entry of order.days) {
    const meta = dayMeta.get(entry.dayId)
    if (meta === undefined) continue

    const rows: Array<PlannerRow> = []
    for (const itemId of entry.itemIds) {
      const row = rowsByItem.get(itemId)
      if (row === undefined) continue
      // The row's day is where the arrangement puts it, not where the payload
      // recorded it — the two differ for exactly as long as a write is in flight.
      const placed: PlannerRow = { ...row, dayNumber: meta.dayNumber }
      rows.push(placed)
      rowsByPlace.set(row.placeId, placed)
      dayNumberByPlace.set(row.placeId, meta.dayNumber)
      if (row.categoryId !== null) {
        stopCountByCategory[row.categoryId] =
          (stopCountByCategory[row.categoryId] ?? 0) + 1
      }
    }

    days.push({
      dayId: meta.dayId,
      dayNumber: meta.dayNumber,
      title: titleOf(meta),
      dateLabel: formatWeekday(meta.date, locale),
      rows,
      stays: meta.stays,
      notes: meta.notes,
    })
  }

  const ideas: Array<PlannerRow> = []
  for (const itemId of order.ideaIds) {
    const row = rowsByItem.get(itemId)
    if (row === undefined) continue
    const unplaced: PlannerRow =
      row.dayNumber === null ? row : { ...row, dayNumber: null }
    ideas.push(unplaced)
    // An idea only claims the map pin when nothing scheduled already has it.
    if (!rowsByPlace.has(row.placeId)) rowsByPlace.set(row.placeId, unplaced)
    if (row.categoryId !== null) {
      stopCountByCategory[row.categoryId] =
        (stopCountByCategory[row.categoryId] ?? 0) + 1
    }
  }

  return {
    days,
    ideas,
    categories: payload.categories.map((category) => ({
      id: category.id,
      name: category.name,
      colour: category.colour,
      icon: category.icon,
    })),
    rowsByItem,
    rowsByPlace,
    dayNumberByPlace,
    scheduledCount: days.reduce((total, day) => total + day.rows.length, 0),
    stopCountByCategory,
  }
}

/** The taxonomy as the map's own filter bar and legend want it. */
export function mapCategories(
  categories: ReadonlyArray<PlannerCategory>,
): Array<MapCategory> {
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.id,
    colour: category.colour,
    icon: category.icon,
  }))
}

/**
 * The pins.
 *
 * Only rows with a real coordinate: an unmapped place is shown in the rail with an
 * explicit "no map position" marker rather than dropped at 0°,0° in the Atlantic.
 */
export function mapPlacesOf(
  rows: Iterable<PlannerRow>,
  dayNumberByPlace: ReadonlyMap<string, number>,
): Array<MapPlace> {
  const places: Array<MapPlace> = []
  for (const row of rows) {
    if (row.lng === null || row.lat === null) continue
    places.push({
      id: row.placeId,
      name: row.name,
      lng: row.lng,
      lat: row.lat,
      categoryId: row.categoryId,
      address: row.location,
      rating: row.rating,
      imageUrl: row.imageUrl,
      dayNumber: dayNumberByPlace.get(row.placeId) ?? null,
      isVisited: row.visited,
    })
  }
  return places
}

/** Case- and accent-insensitive enough for a search box over a few hundred rows. */
function normalise(value: string): string {
  return value
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
}

/**
 * Narrows rows by the search box and the category chips.
 *
 * The same predicate filters the ideas rail and the map's pins, so typing into the
 * search box thins out both halves of the screen at once and the two can never
 * disagree about what is being looked for.
 */
export function filterRows(
  rows: ReadonlyArray<PlannerRow>,
  filters: {
    readonly query: string
    readonly categoryIds: ReadonlyArray<string>
  },
): Array<PlannerRow> {
  const needle = normalise(filters.query.trim())
  const categories = new Set(filters.categoryIds)

  return rows.filter((row) => {
    if (categories.size > 0) {
      if (row.categoryId === null || !categories.has(row.categoryId)) {
        return false
      }
    }
    if (needle === '') return true
    return (
      normalise(row.name).includes(needle) ||
      (row.location !== null && normalise(row.location).includes(needle))
    )
  })
}

/** One entry per day for the map's route lines, in visiting order. */
export function routeDaysOf(days: ReadonlyArray<PlannerDay>): Array<{
  readonly dayNumber: number
  readonly points: Array<[number, number]>
}> {
  return days.map((day) => ({
    dayNumber: day.dayNumber,
    points: day.rows
      .filter(
        (row): row is PlannerRow & { lng: number; lat: number } =>
          row.lng !== null && row.lat !== null,
      )
      .map((row) => [row.lng, row.lat] as [number, number]),
  }))
}
