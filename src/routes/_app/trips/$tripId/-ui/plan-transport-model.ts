/**
 * The journeys' write half: the run a day's write names, and what a landed write owes the server.
 *
 * Reading a Day — where each journey row sits — is `plan-board.ts`. Every function here is pure,
 * and the fractions are the server's: a journey's `sort_order` is where it sits among its
 * **departure** day's stops and notes, and the rows it shows on the other days it covers are
 * placed on the client and never stored.
 *
 * A reorder carries its journeys in the same call as the stops and notes (`reorderPlanFn`), so it
 * needs no follow-up; the schedule, unschedule and delete writes do not renumber a day and still
 * restate their day's journeys on their own (#816).
 */

import {
  IDEAS_CONTAINER,
  containerOf,
  ideaItemId,
  isNoteItemId,
  legRefOfLegItem,
  noteIdOfNoteItem,
  removePlanItem,
} from '#/components/planner'

import type { PlanOrder, PlannerTransport } from '#/components/planner'

/** One row of a day's run, in the four id spaces the server validates. */
export interface DayRunRef {
  readonly kind: 'stop' | 'note' | 'transport' | 'leg'
  readonly id: string
}

/** One day's run, as `reorderDayTransportsFn` takes it. */
export interface JourneyWrite {
  readonly dayId: string
  readonly items: ReadonlyArray<DayRunRef>
}

/** The draggable ids of the journeys that depart from the day they are drawn on. */
export function departingItemIds(
  rows: ReadonlyArray<PlannerTransport>,
): ReadonlySet<string> {
  return new Set(
    rows.filter((row) => row.part === 'departing').map((row) => row.itemId),
  )
}

/**
 * One day as the server names it: its stops, its notes and the journeys that depart from it.
 *
 * The run carries the day exactly as the board now reads it, and the server takes from it only
 * which row each journey follows; the fractions themselves are derived on the server, so a client
 * can never inject a position of its own choosing. The rows a journey shows on days it merely
 * crosses are dropped, because they are placed on the client and have nothing to write.
 */
export function dayRun(
  itemIds: ReadonlyArray<string>,
  departing: ReadonlySet<string>,
): Array<DayRunRef> {
  return itemIds.flatMap((itemId): Array<DayRunRef> => {
    const leg = legRefOfLegItem(itemId)
    if (leg !== null) {
      return departing.has(itemId) ? [{ kind: leg.kind, id: leg.id }] : []
    }
    return [refOf(itemId)]
  })
}

/**
 * The follow-up writes a change to these days needs, and no others.
 *
 * A journey is written only by a write of the day it *departs* from. Restating it from any
 * other day it covers would overwrite a number measured against one day's stops with one
 * measured against another's, and each day's restatement would then undo the other's.
 */
export function journeyWrites(
  order: PlanOrder,
  dayIds: ReadonlyArray<string>,
  rows: ReadonlyArray<PlannerTransport>,
): Array<JourneyWrite> {
  const departing = departingItemIds(rows)
  if (departing.size === 0) return []

  const writes: Array<JourneyWrite> = []
  for (const dayId of new Set(dayIds)) {
    const day = order.days.find((entry) => entry.dayId === dayId)
    if (day === undefined) continue
    if (!day.itemIds.some((itemId) => departing.has(itemId))) continue

    writes.push({ dayId, items: dayRun(day.itemIds, departing) })
  }
  return writes
}

/**
 * A write the board has just landed, as far as the journeys beside it care.
 *
 * `before` is the board the write was made against and `next` the board it leaves behind. A
 * delete carries no `next`: its board is `before` with the stop taken out.
 */
export type JourneyRestatement =
  | {
      readonly kind: 'schedule'
      readonly next: PlanOrder
      readonly placeId: string
      readonly assignmentId: string
      readonly dayId: string
    }
  | {
      readonly kind: 'unschedule'
      readonly before: PlanOrder
      readonly next: PlanOrder
      readonly itemId: string
    }
  | {
      readonly kind: 'delete'
      readonly before: PlanOrder
      readonly itemId: string
    }

/**
 * The journey writes one landed write owes, which is {@link journeyWrites} asked about the right
 * board and the right days.
 *
 * - A schedule restates the day it lands on — but its board still calls the new stop by its
 *   `idea:` id, which the run would drop as a row the day does not hold, so the stop is renamed to
 *   the assignment the write actually created first.
 * - An unschedule and a delete restate the day the stop *left*, which only the board before the
 *   write can name; the ideas column holds no journeys, so a stop taken from there owes nothing.
 */
export function journeyWritesFor(
  change: JourneyRestatement,
  rows: ReadonlyArray<PlannerTransport>,
): Array<JourneyWrite> {
  switch (change.kind) {
    case 'schedule':
      return journeyWrites(
        renameItem(
          change.next,
          ideaItemId(change.placeId),
          change.assignmentId,
        ),
        [change.dayId],
        rows,
      )
    case 'unschedule':
      return journeyWrites(
        change.next,
        dayOfItem(change.before, change.itemId),
        rows,
      )
    case 'delete':
      return journeyWrites(
        removePlanItem(change.before, change.itemId),
        dayOfItem(change.before, change.itemId),
        rows,
      )
  }
}

/** The day holding an item — or none when it sits in the ideas column. */
function dayOfItem(order: PlanOrder, itemId: string): Array<string> {
  const container = containerOf(order, itemId)
  return container === null || container === IDEAS_CONTAINER ? [] : [container]
}

/** The same arrangement with one draggable id renamed. */
function renameItem(order: PlanOrder, from: string, to: string): PlanOrder {
  return {
    ideaIds: order.ideaIds,
    days: order.days.map((day) => ({
      dayId: day.dayId,
      itemIds: day.itemIds.map((itemId) => (itemId === from ? to : itemId)),
    })),
  }
}

/** A stop or a note, as the run names it. */
function refOf(itemId: string): { kind: 'stop' | 'note'; id: string } {
  return isNoteItemId(itemId)
    ? { kind: 'note', id: noteIdOfNoteItem(itemId) }
    : { kind: 'stop', id: itemId }
}
