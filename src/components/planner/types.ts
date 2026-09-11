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

import type { MessageKey } from '#/lib/i18n'

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

/**
 * One thing in a day's sequence.
 *
 * **This union is an extension point, and it was used as one.** A day is one number
 * line (PRD #104 decision 9) and `mergeDayTimeline` reads only `{ id, position, time }`
 * from whatever sits on it. The third kind — the transport row `BKG-10` brings from
 * `03-reservations-and-transport.md` — landed in `03-S5` as exactly what this comment
 * predicted: *one variant here, one id prefix in `ordering.ts`, and one renderer under
 * `DaySection`*, with no change to the merge, to the drag adapter's contract, or to the
 * repository's two-table batch beyond its own table.
 *
 * Anything that would make a fourth kind require reshaping this type — a boolean instead
 * of `kind`, a shared bag of optional fields instead of variants — is the design this
 * comment exists to prevent.
 */
export type PlannerItem =
  | { readonly kind: 'stop'; readonly row: PlannerRow }
  | { readonly kind: 'note'; readonly note: PlannerNote }
  | { readonly kind: 'transport'; readonly transport: PlannerTransport }

/** A day of the itinerary, with everything its rail section shows. */
export interface PlannerDay {
  readonly dayId: string
  readonly dayNumber: number
  readonly title: string
  /** Already formatted, e.g. `Tue 23 Jun`. `null` when the trip has no dates. */
  readonly dateLabel: string | null
  /**
   * The day's whole sequence, in the order a reader sees it.
   *
   * The one list `DaySection` renders. There is deliberately no second array holding
   * the same notes: two projections of one record are how they start to disagree.
   */
  readonly items: ReadonlyArray<PlannerItem>
  /**
   * The day's stops only, in sequence order.
   *
   * Kept beside {@link items} because the map's per-day route line is drawn from stop
   * coordinates and must never learn about notes — `routeDaysOf` and `mapPlacesOf` read
   * this and nothing else.
   */
  readonly rows: ReadonlyArray<PlannerRow>
  /** Accommodation names covering this day. */
  readonly stays: ReadonlyArray<string>
}

/** The stops of a sequence, for a caller that wants only places. */
export function stopsOf(items: ReadonlyArray<PlannerItem>): Array<PlannerRow> {
  return items.filter((item) => item.kind === 'stop').map((item) => item.row)
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
 * Which part of a journey one day sees.
 *
 * A journey covering days *d₁ … dₙ* is `departing` on *d₁*, `arriving` on *dₙ* and
 * `travelling` on everything between. It is the part rather than the label, because the
 * label is absent on a one-day journey and the placement rules still need to tell the
 * three apart.
 */
export type JourneyPart = 'departing' | 'travelling' | 'arriving'

/**
 * One journey, as one of its days renders it.
 *
 * A view model in the same idiom as {@link PlannerRow} and {@link PlannerNote}: the time and the
 * fare arrive already formatted, and `mode` and `status` arrive exactly as stored — both columns
 * carry a `CHECK` constraint, but no migration narrows the rows written before one, so the row's
 * registries fall back for a name they do not know rather than the payload claiming a guarantee it
 * does not have.
 *
 * A journey covering three days is three of these, sharing one `id` and differing in `dayId`,
 * `part` and `time`. `itemId` is therefore day-qualified — `@dnd-kit` needs three distinct
 * draggable ids for three rows — and only the `departing` one is draggable at all: a journey has
 * one `sort_order`, and a number on a day's line has one ruler.
 */
export interface PlannerTransport {
  /** The day-qualified draggable identity, from `ordering.legItemId`. */
  readonly itemId: string
  /** Which table the row came from: a whole record, or one leg of a chain. */
  readonly kind: 'transport' | 'leg'
  /** The `transports` or `transport_legs` row id, shared by every day the journey covers. */
  readonly id: string
  readonly dayId: string
  readonly part: JourneyPart
  /**
   * What this day's part is called, or `null` when the journey covers one day — naming a part only
   * makes sense when there is more than one.
   */
  readonly phase: MessageKey | null
  /** As stored, e.g. `flight`. The renderer's glyph registry falls back. */
  readonly mode: string
  /** As stored, e.g. `confirmed`. The status pill's vocabulary falls back. */
  readonly status: string
  readonly serviceNumber: string | null
  readonly fromName: string | null
  readonly toName: string | null
  /** Already formatted — the departure, the arrival, or the range on a one-day journey. */
  readonly time: string | null
  /** Already formatted, e.g. `¥13,320`. `null` when the journey carries no fare of its own. */
  readonly price: string | null
  /**
   * `sort_order` as stored — the fractional position among the departure day's stops and notes.
   *
   * Meaningful on the `departing` row and on no other: the rows a journey shows on the days it
   * merely crosses are placed on the client and never stored.
   */
  readonly position: number
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
