/**
 * Where everything sits, and what moving one thing costs.
 *
 * The planner's board is a set of ordered lists: one per day, plus the ideas
 * column for places that have not been given a day yet. Dragging a row is
 * therefore two separate problems — what the board should look like a frame later,
 * and what the server has to be told — and this module answers both as one pure
 * function so the optimistic render and the write can never disagree about a move.
 *
 * Deliberately about **ids only**. The board's rows carry photographs, times,
 * badges and category colours; none of that has any bearing on ordering, and
 * keeping it out means this module is exhaustively testable without constructing a
 * single view model. The screen re-materialises rows from the returned id lists.
 *
 * Two invariants are enforced here rather than discovered at the database:
 *
 * - **A place appears at most once per day.** `day_assignments` has a unique index
 *   on `(day_id, place_id)`, so dropping Shibuya Crossing onto a day that already
 *   has it would fail at the write with a constraint error the reader cannot act
 *   on. It is refused up front instead, with a reason the screen can say out loud.
 * - **The day run is never touched.** A move rewrites `day_id` and `order_index`
 *   and nothing else, so the trip's contiguous `1..n` day spine — which only
 *   `syncTripDays` is allowed to write — cannot be perturbed by a drag.
 * - **A time outranks a position.** One day is one number line holding stops and
 *   notes together (PRD #104 decision 9), and {@link mergeDayTimeline} is the whole
 *   of how that line is read back: positions decide the sequence, times reorder it,
 *   and an untimed row rides along with the timed row above it. A move that would
 *   contradict a time is refused as a question rather than applied.
 */

/** Container id of the ideas column. Days use their own row id. */
export const IDEAS_CONTAINER = 'ideas'

const IDEA_PREFIX = 'idea:'

/**
 * Draggable id for an unscheduled place.
 *
 * A stop is identified by its assignment row and an idea has no assignment row, so
 * the two id spaces are kept apart by a prefix. That is what lets one drag handler
 * tell "reorder this stop" from "schedule this place" without a second lookup.
 */
export function ideaItemId(placeId: string): string {
  return IDEA_PREFIX + placeId
}

/** True for a draggable id produced by {@link ideaItemId}. */
export function isIdeaItemId(itemId: string): boolean {
  return itemId.startsWith(IDEA_PREFIX)
}

/** The place behind an idea's draggable id. */
export function placeIdOfIdeaItem(itemId: string): string {
  return itemId.slice(IDEA_PREFIX.length)
}

const NOTE_PREFIX = 'note:'

/**
 * Draggable id for a day note.
 *
 * The third id space, added by the same mechanism as the second and no other: a stop
 * is its assignment row's bare id, an idea is a place behind {@link IDEA_PREFIX}, and
 * a note is a `day_notes` row behind this one. Keeping notes prefixed is what lets a
 * day hold one sequence of both without a lookup deciding, per id, which table it
 * came from — and it is why nothing that already worked had to be re-keyed.
 */
export function noteItemId(noteId: string): string {
  return NOTE_PREFIX + noteId
}

/** True for a draggable id produced by {@link noteItemId}. */
export function isNoteItemId(itemId: string): boolean {
  return itemId.startsWith(NOTE_PREFIX)
}

/** The note behind a note's draggable id. */
export function noteIdOfNoteItem(itemId: string): string {
  return itemId.slice(NOTE_PREFIX.length)
}

/** One day's stops, in visiting order, as assignment ids. */
export interface DayOrder {
  readonly dayId: string
  readonly itemIds: ReadonlyArray<string>
}

/** The whole board's arrangement. */
export interface PlanOrder {
  readonly days: ReadonlyArray<DayOrder>
  readonly ideaIds: ReadonlyArray<string>
}

/** Where a drag ended up. */
export interface PlanTarget {
  /** A day id, or {@link IDEAS_CONTAINER}. */
  readonly container: string
  /** Position within that container. Clamped, so a caller may pass anything. */
  readonly index: number
}

/**
 * What the server has to do about a move.
 *
 * One variant per repository call the planner is allowed to make, so the screen's
 * write path is a `switch` with no room for an unhandled case.
 */
export type PlanChange =
  /**
   * Items that changed day or position. Carries the *resulting* order of every
   * affected day, so the server writes `0..n-1` and the indices are renormalised on
   * every drag rather than drifting toward fractions.
   *
   * `itemIds`, not `assignmentIds`: a day is one number line holding stops and notes
   * together, so this list carries both id spaces and the write path discriminates
   * each entry with {@link isNoteItemId}.
   */
  | {
      readonly kind: 'reorder'
      readonly days: ReadonlyArray<{
        readonly dayId: string
        readonly itemIds: ReadonlyArray<string>
      }>
    }
  /** An idea became a stop: create the assignment at this position. */
  | {
      readonly kind: 'schedule'
      readonly placeId: string
      readonly dayId: string
      readonly index: number
    }
  /** A stop went back to the ideas column: delete the assignment. */
  | { readonly kind: 'unschedule'; readonly assignmentId: string }
  /** The ideas column was re-ranked: rewrite `places.sort_order`. */
  | { readonly kind: 'rank-ideas'; readonly placeIds: ReadonlyArray<string> }

/** Why a move was refused. */
export type PlanMoveRefusal =
  /** The item or the target container is not on this board. */
  | 'unknown'
  /** The move is a no-op — same container, same position. */
  | 'unchanged'
  /** The target day already holds this place, which the schema forbids. */
  | 'duplicate'
  /**
   * A note was dropped into the ideas column. The ideas column is the trip's
   * unscheduled *place* inventory and a note has no meaning outside a day, so this
   * is a product statement rather than a limitation.
   */
  | 'not-in-ideas'
  /**
   * A timed item was dropped where its own time says it does not belong — before an
   * item with an earlier time, or after one with a later one.
   *
   * The only refusal here that is a **question** rather than an end (PRD #104
   * decision 9): the engine will not move a timed row against its clock on its own,
   * because a time is authoritative for as long as the item has one. The screen turns
   * it into "move this and drop its 14:30?", and agreeing re-issues the move with the
   * time cleared in the same write. The board is unchanged either way.
   */
  | 'timed'

export type PlanMoveResult =
  | {
      readonly ok: true
      readonly order: PlanOrder
      readonly change: PlanChange
      /** The container the item came from, for a caller that wants to say so. */
      readonly from: string
    }
  | { readonly ok: false; readonly reason: PlanMoveRefusal }

/* -------------------------------------------------------------------------------------------------
 * Reading the board
 * ---------------------------------------------------------------------------------------------- */

/** Every container id, ideas last — the tab and drop order the screen uses. */
export function containerIds(order: PlanOrder): Array<string> {
  return [...order.days.map((day) => day.dayId), IDEAS_CONTAINER]
}

/** The container holding an item, or `null` when nothing does. */
export function containerOf(order: PlanOrder, itemId: string): string | null {
  if (order.ideaIds.includes(itemId)) return IDEAS_CONTAINER
  for (const day of order.days) {
    if (day.itemIds.includes(itemId)) return day.dayId
  }
  return null
}

/** The ids in one container, or `null` when the container is not on the board. */
export function itemsIn(
  order: PlanOrder,
  container: string,
): ReadonlyArray<string> | null {
  if (container === IDEAS_CONTAINER) return order.ideaIds
  return order.days.find((day) => day.dayId === container)?.itemIds ?? null
}

/** Position of an item inside its own container, or `-1`. */
export function indexOf(order: PlanOrder, itemId: string): number {
  const container = containerOf(order, itemId)
  if (container === null) return -1
  return itemsIn(order, container)?.indexOf(itemId) ?? -1
}

/**
 * Total scheduled **stops** across every day.
 *
 * Notes are skipped: a day's sequence holds both, and "12 places planned" is a count
 * of places. Counting the sequence would quietly inflate it the first time a reader
 * writes a note.
 */
export function scheduledCount(order: PlanOrder): number {
  return order.days.reduce(
    (total, day) =>
      total + day.itemIds.filter((itemId) => !isNoteItemId(itemId)).length,
    0,
  )
}

/* -------------------------------------------------------------------------------------------------
 * One day, in the order it is read
 * ---------------------------------------------------------------------------------------------- */

/**
 * The least a row has to say about itself to take its place in a day.
 *
 * `position` is the stored number — `day_assignments.order_index` for a stop,
 * `day_notes.sort_order` for a note, one number line across both — and `time` is the
 * `HH:MM` the row carries, or `null`. Nothing else is read, which is what makes a
 * third kind of item (a transport leg) one variant elsewhere and no change here.
 */
export interface TimelineItem {
  readonly id: string
  readonly position: number
  readonly time: string | null
}

/**
 * One day's items in the order a reader sees them (PRD #104 decision 9).
 *
 * Sort by position, then walk once carrying the last time seen: an item with a time
 * sets the carry, an item without one inherits it, and anything before the first
 * timed item inherits nothing. Then sort by inherited time — the inheritance-free
 * head first — with position as the tiebreak.
 *
 * The three properties that fall out are the point of doing it this way:
 *
 * - A day with no times at all is exactly its position order, so nothing about the
 *   board changes for a trip that never opens the time field.
 * - An untimed row stays attached to the timed row above it instead of floating to
 *   the top, because it inherits rather than sorting as "no time".
 * - It is stable and idempotent. Positions decide every tie, so merging an
 *   already-merged day is a fixed point and no reader ever watches a list settle.
 *
 * Pure, and generic over whatever the caller hangs off the item, so the screen can
 * merge view models and the tests can merge three-field literals.
 */
export function mergeDayTimeline<TItem extends TimelineItem>(
  items: ReadonlyArray<TItem>,
): Array<TItem> {
  // `sort` is stable, so items sharing a position keep the order they arrived in.
  const byPosition = [...items].sort((a, b) => a.position - b.position)

  const walked: Array<{
    item: TItem
    order: number
    inherited: string | null
  }> = []
  let carried: string | null = null
  for (const [order, item] of byPosition.entries()) {
    if (item.time !== null) carried = item.time
    walked.push({ item, order, inherited: carried })
  }

  return walked
    .sort((a, b) => {
      if (a.inherited === b.inherited) return a.order - b.order
      // The head of the day — everything above the first time — sorts first.
      if (a.inherited === null) return -1
      if (b.inherited === null) return 1
      return a.inherited < b.inherited ? -1 : 1
    })
    .map((entry) => entry.item)
}

/* -------------------------------------------------------------------------------------------------
 * Moving
 * ---------------------------------------------------------------------------------------------- */

function replaceDay(
  order: PlanOrder,
  dayId: string,
  itemIds: ReadonlyArray<string>,
): ReadonlyArray<DayOrder> {
  return order.days.map((day) =>
    day.dayId === dayId ? { dayId, itemIds } : day,
  )
}

/**
 * The place a draggable id refers to.
 *
 * For an idea it is encoded in the id. For a stop the caller has to say, because
 * only the board knows which place an assignment points at — hence the lookup
 * argument. A move that cannot resolve a place simply skips the duplicate guard
 * rather than refusing, so an incomplete lookup degrades to the database's own
 * constraint instead of blocking a legitimate drag.
 */
export type PlaceOfItem = (itemId: string) => string | null

function placeOf(
  itemId: string,
  lookup: PlaceOfItem | undefined,
): string | null {
  if (isIdeaItemId(itemId)) return placeIdOfIdeaItem(itemId)
  // A note is not a visit to anywhere, so it can never collide with a place.
  if (isNoteItemId(itemId)) return null
  return lookup?.(itemId) ?? null
}

/** Resolves the `HH:MM` a row carries, or `null` for a row that carries none. */
export type TimeOfItem = (itemId: string) => string | null

export interface MoveOptions {
  /**
   * Resolves the place behind a scheduled stop, so the "one place per day" rule
   * can be checked before the write instead of after it fails.
   */
  readonly placeOfItem?: PlaceOfItem
  /**
   * Resolves the time a row carries, so a move against the clock can be turned into
   * the reader's question before the write instead of quietly reordering a day that
   * {@link mergeDayTimeline} would then sort straight back.
   *
   * Absent, the `'timed'` rule never fires and every move behaves as it did before
   * the merged day — which is what lets a caller that has no times adopt this module
   * without adopting the question.
   */
  readonly timeOfItem?: TimeOfItem
}

/**
 * True when dropping a row carrying `time` at `index` would put it after something
 * later on the clock, or before something earlier.
 *
 * `remaining` is the destination without the moved row, so everything at a lower
 * index lands above it and everything from `index` on lands below.
 */
function contradictsClock(
  remaining: ReadonlyArray<string>,
  index: number,
  time: string,
  timeOfItem: TimeOfItem,
): boolean {
  return remaining.some((id, at) => {
    const other = timeOfItem(id)
    if (other === null) return false
    return at < index ? other > time : other < time
  })
}

/**
 * Moves one row and reports what that costs.
 *
 * The target index is clamped rather than validated: a drop lands wherever the
 * pointer was, and a caller should not have to reason about whether that is one
 * past the end of a list. Within a single container, remove-then-insert-at-index
 * is exactly `arrayMove`, which is what keeps the sortable preview and the
 * committed order identical.
 */
export function movePlanItem(
  order: PlanOrder,
  itemId: string,
  target: PlanTarget,
  options: MoveOptions = {},
): PlanMoveResult {
  const from = containerOf(order, itemId)
  const destination = itemsIn(order, target.container)
  if (from === null || destination === null) {
    return { ok: false, reason: 'unknown' }
  }

  const source = itemsIn(order, from)
  if (source === null) return { ok: false, reason: 'unknown' }

  // A note belongs to a day or to nothing. Checked before anything else about the
  // move, because the answer does not depend on where in the column it was dropped.
  if (target.container === IDEAS_CONTAINER && isNoteItemId(itemId)) {
    return { ok: false, reason: 'not-in-ideas' }
  }

  const sameContainer = from === target.container
  const remaining = sameContainer
    ? destination.filter((id) => id !== itemId)
    : destination
  const index = Math.max(
    0,
    Math.min(Math.trunc(target.index), remaining.length),
  )

  if (sameContainer && source.indexOf(itemId) === index) {
    return { ok: false, reason: 'unchanged' }
  }

  // One place per day. Only ever a cross-container concern: an item already in a
  // day cannot collide with itself, and the ideas column has no such constraint.
  if (!sameContainer && target.container !== IDEAS_CONTAINER) {
    const place = placeOf(itemId, options.placeOfItem)
    if (place !== null) {
      const clash = destination.some(
        (id) => placeOf(id, options.placeOfItem) === place,
      )
      if (clash) return { ok: false, reason: 'duplicate' }
    }
  }

  // A time outranks a position (PRD #104 decision 9). The engine will not move a
  // timed row against its own clock; it says so, and the screen asks the reader
  // whether to drop the time — which comes back as a fresh move on a row that no
  // longer has one.
  if (
    target.container !== IDEAS_CONTAINER &&
    options.timeOfItem !== undefined
  ) {
    const time = options.timeOfItem(itemId)
    if (
      time !== null &&
      contradictsClock(remaining, index, time, options.timeOfItem)
    ) {
      return { ok: false, reason: 'timed' }
    }
  }

  const nextTarget = [...remaining]
  nextTarget.splice(index, 0, itemId)

  /* ------------------------------------------------------- ideas ⇄ ideas */

  if (sameContainer && target.container === IDEAS_CONTAINER) {
    return {
      ok: true,
      from,
      order: { ...order, ideaIds: nextTarget },
      change: {
        kind: 'rank-ideas',
        placeIds: nextTarget.map((id) => placeIdOfIdeaItem(id)),
      },
    }
  }

  /* ---------------------------------------------------------- day ⇄ day */

  if (from !== IDEAS_CONTAINER && target.container !== IDEAS_CONTAINER) {
    const withTarget = replaceDay(order, target.container, nextTarget)
    const days = sameContainer
      ? withTarget
      : withTarget.map((day) =>
          day.dayId === from
            ? { dayId: from, itemIds: source.filter((id) => id !== itemId) }
            : day,
        )

    const touched = sameContainer
      ? [target.container]
      : [target.container, from]
    return {
      ok: true,
      from,
      order: { ...order, days },
      change: {
        kind: 'reorder',
        days: touched.map((dayId) => ({
          dayId,
          itemIds: days.find((day) => day.dayId === dayId)?.itemIds ?? [],
        })),
      },
    }
  }

  /* --------------------------------------------------------- ideas → day */

  if (from === IDEAS_CONTAINER) {
    return {
      ok: true,
      from,
      order: {
        days: replaceDay(order, target.container, nextTarget),
        ideaIds: order.ideaIds.filter((id) => id !== itemId),
      },
      change: {
        kind: 'schedule',
        placeId: placeIdOfIdeaItem(itemId),
        dayId: target.container,
        index,
      },
    }
  }

  /* --------------------------------------------------------- day → ideas */

  const place = placeOf(itemId, options.placeOfItem)
  if (place === null) {
    // The assignment is about to stop existing, so the row has to re-enter the
    // ideas column under its *place* id. Without knowing the place there is no
    // honest board to render, and guessing would put a dead row in the column.
    return { ok: false, reason: 'unknown' }
  }

  const nextIdeas = [...order.ideaIds]
  nextIdeas.splice(index, 0, ideaItemId(place))

  return {
    ok: true,
    from,
    order: {
      days: replaceDay(
        order,
        from,
        source.filter((id) => id !== itemId),
      ),
      ideaIds: nextIdeas,
    },
    change: { kind: 'unschedule', assignmentId: itemId },
  }
}

/**
 * Sends a row to the end of another day — the keyboard and menu path to the same
 * result a drag produces, so "Move to day 4" and dragging to day 4 go through one
 * code path.
 */
export function movePlanItemToDay(
  order: PlanOrder,
  itemId: string,
  dayId: string,
  options: MoveOptions = {},
): PlanMoveResult {
  const items = itemsIn(order, dayId)
  if (items === null) return { ok: false, reason: 'unknown' }
  return movePlanItem(
    order,
    itemId,
    { container: dayId, index: items.length },
    options,
  )
}

/** Removes an item from wherever it is — used after a delete is confirmed. */
export function removePlanItem(order: PlanOrder, itemId: string): PlanOrder {
  return {
    days: order.days.map((day) => ({
      dayId: day.dayId,
      itemIds: day.itemIds.filter((id) => id !== itemId),
    })),
    ideaIds: order.ideaIds.filter((id) => id !== itemId),
  }
}
