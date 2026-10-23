/**
 * The journeys' write half: the run a day's write names.
 *
 * Reading a Day — where each journey row sits — is `plan-board.ts`. Every function here is pure,
 * and the fractions are the server's: a journey's `sort_order` is where it sits among its
 * **departure** day's stops and notes, and the rows it shows on the other days it covers are
 * placed on the client and never stored.
 *
 * A reorder carries its journeys in the same call as the stops and notes (`reorderPlanFn`), and so
 * does a schedule (`schedulePlaceFn`); an unschedule and a delete send none, because the day they
 * leave behind is the day as stored, minus the stop (#816).
 */

import {
  ideaItemId,
  isNoteItemId,
  legRefOfLegItem,
  noteIdOfNoteItem,
} from '#/components/planner'

import type { PlanOrder, PlannerTransport } from '#/components/planner'

/** One row of a day's run, in the four id spaces the server validates. */
export interface DayRunRef {
  readonly kind: 'stop' | 'note' | 'transport' | 'leg'
  readonly id: string
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
 * The run a schedule sends with the drop: the day it lands on, the new stop named by its place id.
 *
 * `next` is the board the drop leaves behind, which still calls the new stop by its `idea:` id;
 * the assignment does not exist until the write mints it, so the run names the stop by the place
 * instead and the server swaps in the assignment it creates. `undefined` when no journey departs
 * from the day: there is nothing to place, and the server leaves a day with none as it is.
 */
export function scheduleRun(
  next: PlanOrder,
  placeId: string,
  dayId: string,
  rows: ReadonlyArray<PlannerTransport>,
): Array<DayRunRef> | undefined {
  const departing = departingItemIds(rows)
  const day = next.days.find((entry) => entry.dayId === dayId)
  if (day === undefined) return undefined
  if (!day.itemIds.some((itemId) => departing.has(itemId))) return undefined

  const ideaId = ideaItemId(placeId)
  return dayRun(
    day.itemIds.map((itemId) => (itemId === ideaId ? placeId : itemId)),
    departing,
  )
}

/** A stop or a note, as the run names it. */
function refOf(itemId: string): { kind: 'stop' | 'note'; id: string } {
  return isNoteItemId(itemId)
    ? { kind: 'note', id: noteIdOfNoteItem(itemId) }
    : { kind: 'stop', id: itemId }
}
