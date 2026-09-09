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

/**
 * A day note, as its row renders it.
 *
 * `icon` is a plain string and not a {@link DayNoteIcon}: the enum is a *write* constraint added by
 * `01-S2b`, and no migration narrows what earlier rows already hold. The registry in `note-row.tsx`
 * falls back for a name it does not know, exactly as the map's category icon does.
 */
export interface PlannerNote {
  readonly id: string
  readonly dayId: string
  /** The one-line headline. Always present. */
  readonly body: string
  /** Markdown, rendered through `src/lib/markdown`. `null` when the note is one line. */
  readonly detail: string | null
  /** Already formatted, e.g. `18:30`. */
  readonly time: string | null
  /** As stored, e.g. `train-front`. */
  readonly icon: string
}

/**
 * The vocabulary a day note's icon is drawn from.
 *
 * It lives here rather than beside the note's repository because both ends need it and only one of
 * them may hold it: the picker needs the *value*, and importing `src/server/repos/days.ts` into a
 * dialog would pull Drizzle and the whole schema into the browser bundle. `days.ts` re-exports it
 * for its Zod enum — the same seam `src/server/errors/public.ts` already crosses in this direction.
 *
 * The first ten names are the ones the flagship seed already writes through `createDayNote`; the
 * rest are the picker's. Narrowing the list is therefore a breaking change for stored rows and for
 * `pnpm worktree:bootstrap`, not a cosmetic edit. Every name resolves in the pinned `lucide-react`.
 */
export const DAY_NOTE_ICONS = [
  'alarm-clock',
  'clock',
  'flashlight',
  'footprints',
  'info',
  'luggage',
  'package',
  'ticket',
  'train-front',
  'wifi',
  'sticky-note',
  'utensils',
  'bus',
  'bed-double',
  'camera',
  'map-pin',
  'wallet',
  'umbrella',
  'triangle-alert',
] as const

/** One of {@link DAY_NOTE_ICONS}. The type of what a picker sends, never of what a row holds. */
export type DayNoteIcon = (typeof DAY_NOTE_ICONS)[number]

/** The icon a note takes when none was chosen — `day_notes.icon`'s column default. */
export const DEFAULT_DAY_NOTE_ICON: DayNoteIcon = 'sticky-note'

/** True when a row can be pinned on the map. */
export function isMapped(
  row: PlannerRow,
): row is PlannerRow & { readonly lng: number; readonly lat: number } {
  return typeof row.lng === 'number' && typeof row.lat === 'number'
}
