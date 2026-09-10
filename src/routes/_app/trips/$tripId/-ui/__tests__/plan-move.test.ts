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

import { IDEAS_CONTAINER, noteItemId } from '#/components/planner'
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
})

describe('refusalCopy', () => {
  it('gives every refusal a reader sees its own three keys', () => {
    const spoken = (
      ['duplicate', 'not-in-ideas', 'not-in-another-day'] as const
    )
      .map((reason) => refusalCopy(reason))
      .map((copy) => [copy?.title, copy?.body, copy?.spoken].join('|'))

    expect(spoken).toHaveLength(3)
    expect(new Set(spoken).size).toBe(3)
    for (const keys of spoken) expect(keys).not.toContain('undefined')
  })

  /** A row put back where it was is not an error, and neither is a drag onto nothing. */
  it('says nothing about a refusal the reader caused on purpose', () => {
    expect(refusalCopy('unchanged')).toBeNull()
    expect(refusalCopy('unknown')).toBeNull()
  })
})
