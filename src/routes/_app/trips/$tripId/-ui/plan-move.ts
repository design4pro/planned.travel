/**
 * What a drag on the planner board means, decided away from the screen.
 *
 * `movePlanItem` answers "where does the board sit a frame later"; this module answers
 * the three questions the screen has on top of that and cannot answer inside a
 * `useCallback` a test can reach: whether the move is refused for a reason this screen
 * owns rather than the engine, whether it is a **question** rather than a refusal, and
 * what the write is when it is neither.
 *
 * Pure, and free of React: the whole policy is one function over ids, so "a note cannot
 * change day", "a timed row asks before it moves" and "confirming sends exactly one
 * call carrying the cleared time" are assertions rather than a screen harness.
 */

import {
  IDEAS_CONTAINER,
  containerOf,
  isNoteItemId,
  movePlanItem,
  noteIdOfNoteItem,
} from '#/components/planner'

import type { z } from 'zod'
import type { MessageKey } from '#/lib/i18n'
import type {
  PlaceOfItem,
  PlanChange,
  PlanMoveRefusal,
  PlanOrder,
  PlanTarget,
  TimeOfItem,
} from '#/components/planner'
import type { reorderPlanInputSchema } from '../-server/plan'

/**
 * Why a move did not happen — the engine's refusals, plus the one this screen owns.
 *
 * A note cannot change day because no repository verb relocates one: `day_notes.day_id`
 * is written by the editor, never by a drag. The engine does not know that, and should
 * not — it is a gap in the write path, not a rule about ordering — so the screen refuses
 * it before delegating rather than letting the board claim a move the write would drop.
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
 * Order matters: the cross-day note is refused first, because the answer does not
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
    isNoteItemId(itemId) &&
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

  if (result.reason === 'timed') {
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
 * `clearTime` is a draggable id rather than a flag, and it is attached to the day that
 * actually holds the item, because the server refuses a payload that drops the time of
 * a row it is not being asked to move.
 */
export function reorderPayload(
  tripId: string,
  change: ReorderChange,
  clearTime: string | null = null,
): ReorderPlanInput {
  return {
    tripId,
    days: change.days.map((day) => {
      const items = day.itemIds.map((itemId) => timelineItem(itemId))
      if (clearTime === null || !day.itemIds.includes(clearTime)) {
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
 * was is not an error, and neither is a drag that resolved to nothing. `'timed'` is
 * absent because it is never a refusal a reader sees: it becomes the dialog.
 */
export function refusalCopy(reason: PlanMoveReason): RefusalCopy | null {
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
    case 'not-in-another-day':
      return {
        title: 'trips.plan.move.refused.notInAnotherDay',
        body: 'trips.plan.move.refused.notInAnotherDayBody',
        spoken: 'trips.plan.move.spoken.notInAnotherDay',
      }
    default:
      return null
  }
}
