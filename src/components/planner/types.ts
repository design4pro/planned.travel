/**
 * The shapes the planner's rails render.
 *
 * View models, not rows. Everything locale-dependent — a time range, a weekday, a
 * duration — arrives already formatted, because the screen that loads the trip
 * already owns the formatters and passing strings keeps this directory free of
 * both a date library and any dependency on `src/routes`.
 *
 * Structurally close to {@link MapPlace} on purpose: the same trip is drawn twice,
 * and one adapter at the route boundary produces both.
 */

/** A tenant's own taxonomy entry, as the rail needs it. */
export interface PlannerCategory {
  readonly id: string
  readonly name: string
  /** Hex from the tenant's taxonomy. Travels as a CSS custom property. */
  readonly colour: string
  /** `lucide-react` icon name in kebab case, e.g. `bed-double`. */
  readonly icon: string
}

/**
 * One row in a rail — a scheduled stop or an unscheduled idea.
 *
 * One type for both, because they are the same place seen from two columns and a
 * drag turns either into the other. `itemId` is the draggable identity
 * (`ordering.ideaItemId` for an idea, the assignment id for a stop); `placeId` is
 * the identity everything else keys on, including the map.
 */
export interface PlannerRow {
  readonly itemId: string
  readonly placeId: string
  /** Assignment row behind a stop. `null` for an idea. */
  readonly assignmentId: string | null
  readonly name: string
  /** Street address, falling back to the city. */
  readonly location: string | null
  /** Already formatted, e.g. `10:00 – 12:00`. */
  readonly time: string | null
  /** Already formatted, e.g. `2h 30m`. */
  readonly duration: string | null
  readonly categoryId: string | null
  readonly imageUrl: string | null
  /** 1–5, as stored. `null` when unrated. */
  readonly rating: number | null
  /** The assignment's note, not the place's description. */
  readonly note: string | null
  /** `none` | `pending` | `confirmed` | … from `RESERVATION_STATUSES`. */
  readonly reservationStatus: string
  readonly lng: number | null
  readonly lat: number | null
  readonly visited: boolean
  /** 1-based itinerary day, `null` for an idea. */
  readonly dayNumber: number | null
}

/** A day of the itinerary, with everything its rail section shows. */
export interface PlannerDay {
  readonly dayId: string
  readonly dayNumber: number
  readonly title: string
  /** Already formatted, e.g. `Tue 23 Jun`. `null` when the trip has no dates. */
  readonly dateLabel: string | null
  readonly rows: ReadonlyArray<PlannerRow>
  /** Accommodation names covering this day. */
  readonly stays: ReadonlyArray<string>
  readonly notes: ReadonlyArray<{
    readonly id: string
    readonly body: string
    /** Already formatted, e.g. `18:30`. */
    readonly time: string | null
  }>
}

/** True when a row can be pinned on the map. */
export function isMapped(
  row: PlannerRow,
): row is PlannerRow & { readonly lng: number; readonly lat: number } {
  return typeof row.lng === 'number' && typeof row.lat === 'number'
}
