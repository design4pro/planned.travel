/**
 * The drag policy, away from the screen.
 *
 * Three behaviours are the ones most likely to be got wrong and the three least
 * reachable through `plan-screen.tsx`, which would first need a map, a router and a
 * trip: the cross-day note refusal that must happen *before* the engine, the payload
 * that has to name a note as a note, and the refusal vocabulary the live region reads.
 * All three are decided in `plan-move.ts`, so all three are assertions here.
 */
import { describe, expect, it } from 'vitest'

import { IDEAS_CONTAINER, legItemId, noteItemId } from '#/components/planner'
import { planMoveOutcome, refusalCopy, reorderPayload } from '../plan-move'

import type { PlanOrder } from '#/components/planner'

const N1 = noteItemId('n1')

/** Two days: one holding a stop, a note and a stop; one holding a single stop. */
const ORDER: PlanOrder = {
  days: [
    { dayId: 'd1', itemIds: ['a1', N1, 'a2'] },
    { dayId: 'd2', itemIds: ['a3'] },
  ],
  ideaIds: [],
}

const PLACES: Readonly<Record<string, string>> = {
  a1: 'p1',
  a2: 'p2',
  a3: 'p1',
}

const placeOfItem = (itemId: string): string | null => PLACES[itemId] ?? null

/** Every row of `d1` carries a time, in the order the day stores them. */
const TIMES: Readonly<Record<string, string>> = {
  a1: '09:00',
  [N1]: '11:00',
  a2: '14:00',
}

const timeOfItem = (itemId: string): string | null => TIMES[itemId] ?? null

describe('planMoveOutcome', () => {
  it('refuses a note dropped on another day, without asking the engine', () => {
    const outcome = planMoveOutcome(
      ORDER,
      N1,
      { container: 'd2', index: 0 },
      { placeOfItem },
    )

    expect(outcome).toEqual({ kind: 'refused', reason: 'not-in-another-day' })
  })

  it('refuses a note dropped into the ideas rail, as the engine does', () => {
    const outcome = planMoveOutcome(ORDER, N1, {
      container: IDEAS_CONTAINER,
      index: 0,
    })

    expect(outcome).toEqual({ kind: 'refused', reason: 'not-in-ideas' })
  })

  it('refuses a place the target day already holds', () => {
    // `a3` is the same place as `a1`, one day over.
    const outcome = planMoveOutcome(
      ORDER,
      'a3',
      { container: 'd1', index: 0 },
      { placeOfItem },
    )

    expect(outcome).toEqual({ kind: 'refused', reason: 'duplicate' })
  })

  it('commits a note moved within its own day', () => {
    const outcome = planMoveOutcome(
      ORDER,
      N1,
      { container: 'd1', index: 0 },
      { placeOfItem },
    )

    expect(outcome.kind).toBe('commit')
    if (outcome.kind !== 'commit') return
    expect(outcome.order.days[0].itemIds).toEqual([N1, 'a1', 'a2'])
    expect(outcome.change).toEqual({
      kind: 'reorder',
      days: [{ dayId: 'd1', itemIds: [N1, 'a1', 'a2'] }],
    })
  })

  it('asks about the time of a note dropped against the clock', () => {
    // 11:00 above 09:00.
    const outcome = planMoveOutcome(
      ORDER,
      N1,
      { container: 'd1', index: 0 },
      { placeOfItem, timeOfItem },
    )

    expect(outcome).toEqual({
      kind: 'ask-drop-time',
      itemId: N1,
      time: '11:00',
    })
  })

  /**
   * The behaviour this phase changes for a reader who never writes a note: before
   * the merged day, a stop dragged against its own clock simply moved.
   */
  it('asks about the time of a stop dropped above an earlier stop', () => {
    // 14:00 above 09:00.
    const outcome = planMoveOutcome(
      ORDER,
      'a2',
      { container: 'd1', index: 0 },
      { placeOfItem, timeOfItem },
    )

    expect(outcome).toEqual({
      kind: 'ask-drop-time',
      itemId: 'a2',
      time: '14:00',
    })
  })

  it('never asks about a row that carries no time of its own', () => {
    const outcome = planMoveOutcome(
      ORDER,
      N1,
      { container: 'd1', index: 2 },
      { placeOfItem, timeOfItem: (id) => (id === N1 ? null : timeOfItem(id)) },
    )

    expect(outcome.kind).toBe('commit')
  })

  it('commits the same move once the reader agrees to drop the time', () => {
    const outcome = planMoveOutcome(
      ORDER,
      N1,
      { container: 'd1', index: 0 },
      { placeOfItem, timeOfItem, dropTime: true },
    )

    expect(outcome.kind).toBe('commit')
    if (outcome.kind !== 'commit') return
    expect(outcome.change).toEqual({
      kind: 'reorder',
      days: [{ dayId: 'd1', itemIds: [N1, 'a1', 'a2'] }],
    })
  })
})

describe('reorderPayload', () => {
  it('names a note as a note and a stop as a stop, by its bare row id', () => {
    const payload = reorderPayload('t1', {
      kind: 'reorder',
      days: [{ dayId: 'd1', itemIds: [N1, 'a1', 'a2'] }],
    })

    expect(payload).toEqual({
      tripId: 't1',
      days: [
        {
          dayId: 'd1',
          items: [
            { kind: 'note', id: 'n1' },
            { kind: 'stop', id: 'a1' },
            { kind: 'stop', id: 'a2' },
          ],
        },
      ],
    })
  })

  /**
   * One write, not two: the row is reordered and stripped of its time in the same
   * call, so there is never a frame in which it has a time and the wrong position.
   */
  it('drops the time in the very write that moves the row', () => {
    const payload = reorderPayload(
      't1',
      { kind: 'reorder', days: [{ dayId: 'd1', itemIds: [N1, 'a1', 'a2'] }] },
      N1,
    )

    expect(payload.days).toHaveLength(1)
    expect(payload.days[0].clearTime).toEqual([{ kind: 'note', id: 'n1' }])
    expect(payload.days[0].items).toEqual([
      { kind: 'note', id: 'n1' },
      { kind: 'stop', id: 'a1' },
      { kind: 'stop', id: 'a2' },
    ])
  })

  it('leaves a day the dropped row does not sit in alone', () => {
    const payload = reorderPayload(
      't1',
      {
        kind: 'reorder',
        days: [
          { dayId: 'd1', itemIds: ['a1', 'a2'] },
          { dayId: 'd2', itemIds: [N1, 'a3'] },
        ],
      },
      N1,
    )

    expect(payload.days[0].clearTime).toBeUndefined()
    expect(payload.days[1].clearTime).toEqual([{ kind: 'note', id: 'n1' }])
  })
})

describe('refusalCopy', () => {
  it('gives every refusal a reader sees its own three keys', () => {
    const spoken = (
      ['duplicate', 'not-in-ideas', 'not-in-another-day'] as const
    )
      .map((reason) => refusalCopy(reason, 'a1'))
      .map((copy) => [copy?.title, copy?.body, copy?.spoken].join('|'))

    expect(spoken).toHaveLength(3)
    expect(new Set(spoken).size).toBe(3)
    for (const keys of spoken) expect(keys).not.toContain('undefined')
  })

  /** A row put back where it was is not an error, and neither is a drag onto nothing. */
  it('says nothing about a refusal the reader caused on purpose', () => {
    expect(refusalCopy('unchanged', 'a1')).toBeNull()
    expect(refusalCopy('unknown', 'a1')).toBeNull()
  })
})

describe('a journey on the board', () => {
  const J1 = legItemId('transport', 'd1', 't1')

  /** `d1` gains a journey between its two stops; `d2` is unchanged. */
  const ORDER_WITH_JOURNEY: PlanOrder = {
    days: [
      { dayId: 'd1', itemIds: ['a1', N1, J1, 'a2'] },
      { dayId: 'd2', itemIds: ['a3'] },
    ],
    ideaIds: [],
  }

  it('is refused into another day and into the ideas rail', () => {
    expect(
      planMoveOutcome(ORDER_WITH_JOURNEY, J1, { container: 'd2', index: 0 }),
    ).toEqual({ kind: 'refused', reason: 'not-in-another-day' })

    expect(
      planMoveOutcome(ORDER_WITH_JOURNEY, J1, {
        container: IDEAS_CONTAINER,
        index: 0,
      }),
    ).toEqual({ kind: 'refused', reason: 'not-in-ideas' })
  })

  it('is refused rather than asked when it would move against its own clock', () => {
    // 12:00 dropped above the 09:00 that opens the day.
    const outcome = planMoveOutcome(
      ORDER_WITH_JOURNEY,
      J1,
      { container: 'd1', index: 0 },
      { timeOfItem: (itemId) => (itemId === J1 ? '12:00' : timeOfItem(itemId)) },
    )

    expect(outcome).toEqual({ kind: 'refused', reason: 'timed' })
  })

  it('answers in its own words, and leaves the note’s untouched', () => {
    const journey = (['not-in-ideas', 'not-in-another-day', 'timed'] as const)
      .map((reason) => refusalCopy(reason, J1))
      .map((copy) => [copy?.title, copy?.body, copy?.spoken].join('|'))

    expect(new Set(journey).size).toBe(3)
    for (const keys of journey) {
      expect(keys).not.toContain('undefined')
      expect(keys).toContain('journey')
    }
    // The same reason, asked about a note, still says what it always said.
    expect(refusalCopy('not-in-another-day', N1)?.title).toBe(
      'trips.plan.move.refused.notInAnotherDay',
    )
    // And a stop's `'timed'` is still the dialog's, not a refusal with words.
    expect(refusalCopy('timed', 'a1')).toBeNull()
  })

  it('is left out of the reorder the stops and notes are written with', () => {
    const payload = reorderPayload('trip-1', {
      kind: 'reorder',
      days: [{ dayId: 'd1', itemIds: ['a1', N1, J1, 'a2'] }],
    })

    expect(payload.days[0].items).toEqual([
      { kind: 'stop', id: 'a1' },
      { kind: 'note', id: 'n1' },
      { kind: 'stop', id: 'a2' },
    ])
  })
})
