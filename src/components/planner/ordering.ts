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
   * Assignments that changed day or position. Carries the *resulting* order of
   * every affected day, so the server writes `0..n-1` and the indices are
   * renormalised on every drag rather than drifting toward fractions.
   */
  | {
      readonly kind: 'reorder'
      readonly days: ReadonlyArray<{
        readonly dayId: string
        readonly assignmentIds: ReadonlyArray<string>
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

/** Total scheduled stops across every day. */
export function scheduledCount(order: PlanOrder): number {
  return order.days.reduce((total, day) => total + day.itemIds.length, 0)
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
  return lookup?.(itemId) ?? null
}

export interface MoveOptions {
  /**
   * Resolves the place behind a scheduled stop, so the "one place per day" rule
   * can be checked before the write instead of after it fails.
   */
  readonly placeOfItem?: PlaceOfItem
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
          assignmentIds: days.find((day) => day.dayId === dayId)?.itemIds ?? [],
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
