/**
 * What a drag on the planner board means, decided away from the screen.
 *
 * `movePlanItem` answers "where does the board sit a frame later"; this module answers
 * the three questions the screen has on top of that and cannot answer inside a
 * `useCallback` a test can reach: whether the move is refused for a reason this screen
 * owns rather than the engine, whether it is a **question** rather than a refusal, and
 * what the write is when it is neither.
 *
 * Pure, and free of React: the whole policy is one function over ids, so "a journey cannot
 * change day", "a timed row asks before it moves" and "confirming sends exactly one
 * call carrying the cleared time" are assertions rather than a screen harness.
 */

import {
  IDEAS_CONTAINER,
  containerOf,
  isLegItemId,
  isNoteItemId,
  movePlanItem,
  noteIdOfNoteItem,
} from '#/components/planner'
import { dayRun, departingItemIds } from './plan-transport-model'

import type { z } from 'zod'
import type { MessageKey } from '#/lib/i18n'
import type {
  PlaceOfItem,
  PlanChange,
  PlanMoveRefusal,
  PlanOrder,
  PlanTarget,
  PlannerTransport,
  TimeOfItem,
} from '#/components/planner'
import type { reorderPlanInputSchema } from '../-server/plan'

/**
 * Why a move did not happen — the engine's refusals, plus the one this screen owns.
 *
 * A journey cannot change day: its day comes from its departure and arrival dates, which
 * are the Transports tab's to change, and the write drops a journey it is asked to move
 * to a day it does not depart from. The engine does not know that, and should not — it is
 * a rule about where a journey comes from, not about ordering — so the screen refuses it
 * before delegating rather than letting the board claim a move the write would discard.
 *
 * A note is not refused: `reorderPlanFn` gives every row the day it was named under, so a
 * note dropped on another day is a plain reorder of both days.
 */
export type PlanMoveReason = PlanMoveRefusal | 'not-in-another-day'

export type PlanMoveOutcome =
  | { readonly kind: 'refused'; readonly reason: PlanMoveReason }
  /**
   * The item carries a time that this position contradicts (PRD #104 decision 9).
   * Not an end: the screen asks whether to drop the time, and an agreeing reader comes
   * back through {@link planMoveOutcome} with `dropTime`.
   */
  | {
      readonly kind: 'ask-drop-time'
      readonly itemId: string
      readonly time: string
    }
  | {
      readonly kind: 'commit'
      readonly order: PlanOrder
      readonly change: PlanChange
    }

export interface PlanMoveOptions {
  readonly placeOfItem?: PlaceOfItem
  readonly timeOfItem?: TimeOfItem
  /** The reader answered the question: run the move as if this item had no time. */
  readonly dropTime?: boolean
}

/** The clock as it reads once one item's time is gone. */
function without(timeOfItem: TimeOfItem, itemId: string): TimeOfItem {
  return (id) => (id === itemId ? null : timeOfItem(id))
}

/**
 * The whole drag policy, as one pure function.
 *
 * Order matters: the cross-day journey is refused first, because the answer does not
 * depend on where in the day it was dropped and delegating would only produce a
 * plausible-looking `commit` the write path discards.
 */
export function planMoveOutcome(
  order: PlanOrder,
  itemId: string,
  target: PlanTarget,
  options: PlanMoveOptions = {},
): PlanMoveOutcome {
  const from = containerOf(order, itemId)
  if (
    isLegItemId(itemId) &&
    from !== null &&
    target.container !== IDEAS_CONTAINER &&
    target.container !== from
  ) {
    return { kind: 'refused', reason: 'not-in-another-day' }
  }

  const timeOfItem =
    options.timeOfItem !== undefined && options.dropTime === true
      ? without(options.timeOfItem, itemId)
      : options.timeOfItem

  const result = movePlanItem(order, itemId, target, {
    placeOfItem: options.placeOfItem,
    timeOfItem,
  })

  if (result.ok) {
    return { kind: 'commit', order: result.order, change: result.change }
  }

  // A journey is never asked the question: a departure time belongs to a timetable and
  // not to the board, so there is nothing a reader could agree to drop.
  if (result.reason === 'timed' && !isLegItemId(itemId)) {
    const time = options.timeOfItem?.(itemId) ?? null
    // The engine only refuses `'timed'` for an item that carries one, so this is a
    // narrowing rather than a fallback — but a refusal with no time to name is one the
    // reader cannot be asked about, and it stays a refusal.
    if (time !== null) return { kind: 'ask-drop-time', itemId, time }
  }

  return { kind: 'refused', reason: result.reason }
}

/* -------------------------------------------------------------------------------------------------
 * The write
 * ---------------------------------------------------------------------------------------------- */

type ReorderChange = Extract<PlanChange, { kind: 'reorder' }>

export type ReorderPlanInput = z.infer<typeof reorderPlanInputSchema>

/** A draggable id as the write path names it: the `note:` prefix decides the kind. */
function timelineItem(itemId: string): { kind: 'stop' | 'note'; id: string } {
  return isNoteItemId(itemId)
    ? { kind: 'note', id: noteIdOfNoteItem(itemId) }
    : { kind: 'stop', id: itemId }
}

/**
 * `reorderPlanFn`'s input for one reorder.
 *
 * Each day carries its whole run, journeys included: the server places a journey against the
 * numbering the same write gives the stops and notes, so a reorder is one call and one
 * transaction and no follow-up can fail on its own. A journey-only move is the same call.
 *
 * `clearTime` is a draggable id rather than a flag, and it is attached to the day that
 * actually holds the item, because the server refuses a payload that drops the time of
 * a row it is not being asked to move. A journey never carries one: a departure time
 * belongs to a timetable, and `planMoveOutcome` refuses before it is ever asked.
 */
export function reorderPayload(
  tripId: string,
  change: ReorderChange,
  clearTime: string | null,
  transportRows: ReadonlyArray<PlannerTransport>,
): ReorderPlanInput {
  const departing = departingItemIds(transportRows)
  return {
    tripId,
    days: change.days.map((day) => {
      const items = dayRun(day.itemIds, departing)
      if (
        clearTime === null ||
        isLegItemId(clearTime) ||
        !day.itemIds.includes(clearTime)
      ) {
        return { dayId: day.dayId, items }
      }
      return { dayId: day.dayId, items, clearTime: [timelineItem(clearTime)] }
    }),
  }
}

/* -------------------------------------------------------------------------------------------------
 * Saying why
 * ---------------------------------------------------------------------------------------------- */

/** A refusal's toast headline, its explanation, and the sentence spoken out loud. */
export interface RefusalCopy {
  readonly title: MessageKey
  readonly body: MessageKey
  readonly spoken: MessageKey
}

/**
 * What a reader is told about a refusal, or `null` when they are told nothing.
 *
 * `'unchanged'` and `'unknown'` are silent by design — a row put back exactly where it
 * was is not an error, and neither is a drag that resolved to nothing.
 *
 * `itemId` is **required** rather than optional so that no caller can forget it and show
 * a note's sentence to somebody who dragged a Shinkansen: "a note belongs to a day" is true
 * of a note and simply wrong about a train. A journey answers from its own three sentences,
 * and `'timed'` has copy at all only because of it — until now `'timed'` was never a
 * refusal a reader saw, because it became the dialog. A note has none for
 * `'not-in-another-day'`: it is never refused that.
 */
export function refusalCopy(
  reason: PlanMoveReason,
  itemId: string,
): RefusalCopy | null {
  if (isLegItemId(itemId)) return journeyRefusalCopy(reason)
  switch (reason) {
    case 'duplicate':
      return {
        title: 'trips.plan.move.refused.duplicate',
        body: 'trips.plan.move.refused.duplicateBody',
        spoken: 'trips.plan.move.spoken.duplicate',
      }
    case 'not-in-ideas':
      return {
        title: 'trips.plan.move.refused.notInIdeas',
        body: 'trips.plan.move.refused.notInIdeasBody',
        spoken: 'trips.plan.move.spoken.notInIdeas',
      }
    default:
      return null
  }
}

/** The same refusals, said about a journey. */
function journeyRefusalCopy(reason: PlanMoveReason): RefusalCopy | null {
  switch (reason) {
    case 'not-in-ideas':
      return {
        title: 'trips.plan.move.refused.journeyNotInIdeas',
        body: 'trips.plan.move.refused.journeyNotInIdeasBody',
        spoken: 'trips.plan.move.spoken.journeyNotInIdeas',
      }
    case 'not-in-another-day':
      return {
        title: 'trips.plan.move.refused.journeyNotInAnotherDay',
        body: 'trips.plan.move.refused.journeyNotInAnotherDayBody',
        spoken: 'trips.plan.move.spoken.journeyNotInAnotherDay',
      }
    case 'timed':
      return {
        title: 'trips.plan.move.refused.journeyTimed',
        body: 'trips.plan.move.refused.journeyTimedBody',
        spoken: 'trips.plan.move.spoken.journeyTimed',
      }
    default:
      return null
  }
}
