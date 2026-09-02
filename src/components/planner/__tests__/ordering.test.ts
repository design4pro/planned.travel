import { describe, expect, it } from 'vitest'

import {
  IDEAS_CONTAINER,
  containerIds,
  containerOf,
  ideaItemId,
  indexOf,
  isIdeaItemId,
  itemsIn,
  movePlanItem,
  movePlanItemToDay,
  placeIdOfIdeaItem,
  removePlanItem,
  scheduledCount,
} from '../ordering'

import type { PlanOrder } from '../ordering'

/**
 * A three-day board. Assignment ids are `a<day><n>` and the place behind each is
 * `p<letter>`, so a duplicate is visible at a glance in a failing assertion.
 */
const PLACES: Readonly<Record<string, string>> = {
  a11: 'pa',
  a12: 'pb',
  a21: 'pc',
  a22: 'pd',
  a23: 'pa',
}

const options = {
  placeOfItem: (itemId: string): string | null => PLACES[itemId] ?? null,
}

const board: PlanOrder = {
  days: [
    { dayId: 'd1', itemIds: ['a11', 'a12'] },
    { dayId: 'd2', itemIds: ['a21', 'a22', 'a23'] },
    { dayId: 'd3', itemIds: [] },
  ],
  ideaIds: [ideaItemId('px'), ideaItemId('py')],
}

/** Narrows a result to its success shape, failing the test if it was refused. */
function succeed(result: ReturnType<typeof movePlanItem>) {
  if (!result.ok) throw new Error(`move was refused: ${result.reason}`)
  return result
}

describe('item ids', () => {
  it('keeps ideas and stops in separate id spaces', () => {
    expect(isIdeaItemId(ideaItemId('px'))).toBe(true)
    expect(isIdeaItemId('a11')).toBe(false)
    expect(placeIdOfIdeaItem(ideaItemId('px'))).toBe('px')
  })

  it('survives a place id that looks like a prefix', () => {
    expect(placeIdOfIdeaItem(ideaItemId('idea:weird'))).toBe('idea:weird')
  })
})

describe('reading the board', () => {
  it('finds the container of a stop and of an idea', () => {
    expect(containerOf(board, 'a22')).toBe('d2')
    expect(containerOf(board, ideaItemId('px'))).toBe(IDEAS_CONTAINER)
    expect(containerOf(board, 'nope')).toBeNull()
  })

  it('lists the ids of a container, and nothing for a container off the board', () => {
    expect(itemsIn(board, 'd1')).toEqual(['a11', 'a12'])
    expect(itemsIn(board, IDEAS_CONTAINER)).toHaveLength(2)
    expect(itemsIn(board, 'd9')).toBeNull()
  })

  it('reports a position within its own container', () => {
    expect(indexOf(board, 'a23')).toBe(2)
    expect(indexOf(board, 'missing')).toBe(-1)
  })

  it('orders containers with the ideas column last', () => {
    expect(containerIds(board)).toEqual(['d1', 'd2', 'd3', IDEAS_CONTAINER])
  })

  it('counts only what is scheduled', () => {
    expect(scheduledCount(board)).toBe(5)
  })
})

describe('reordering inside one day', () => {
  it('behaves exactly like arrayMove when dragging down', () => {
    const result = succeed(
      movePlanItem(board, 'a21', { container: 'd2', index: 2 }, options),
    )
    expect(itemsIn(result.order, 'd2')).toEqual(['a22', 'a23', 'a21'])
  })

  it('behaves exactly like arrayMove when dragging up', () => {
    const result = succeed(
      movePlanItem(board, 'a23', { container: 'd2', index: 0 }, options),
    )
    expect(itemsIn(result.order, 'd2')).toEqual(['a23', 'a21', 'a22'])
  })

  it('asks the server to renumber only the day that changed', () => {
    const { change } = succeed(
      movePlanItem(board, 'a21', { container: 'd2', index: 1 }, options),
    )
    expect(change).toEqual({
      kind: 'reorder',
      days: [{ dayId: 'd2', assignmentIds: ['a22', 'a21', 'a23'] }],
    })
  })

  it('refuses a drop that changes nothing', () => {
    expect(
      movePlanItem(board, 'a21', { container: 'd2', index: 0 }, options),
    ).toEqual({ ok: false, reason: 'unchanged' })
  })

  it('clamps an index past the end instead of leaving a hole', () => {
    const result = succeed(
      movePlanItem(board, 'a21', { container: 'd2', index: 99 }, options),
    )
    expect(itemsIn(result.order, 'd2')).toEqual(['a22', 'a23', 'a21'])
  })

  it('clamps a negative index to the front', () => {
    const result = succeed(
      movePlanItem(board, 'a23', { container: 'd2', index: -5 }, options),
    )
    expect(itemsIn(result.order, 'd2')?.[0]).toBe('a23')
  })

  it('leaves every other day untouched', () => {
    const result = succeed(
      movePlanItem(board, 'a21', { container: 'd2', index: 2 }, options),
    )
    expect(itemsIn(result.order, 'd1')).toEqual(['a11', 'a12'])
    expect(result.order.ideaIds).toEqual(board.ideaIds)
  })
})

describe('moving between days', () => {
  it('takes the stop out of one day and puts it in another at the drop position', () => {
    const result = succeed(
      movePlanItem(board, 'a12', { container: 'd2', index: 1 }, options),
    )
    expect(itemsIn(result.order, 'd1')).toEqual(['a11'])
    expect(itemsIn(result.order, 'd2')).toEqual(['a21', 'a12', 'a22', 'a23'])
  })

  it('renumbers both days, so neither is left with a gap', () => {
    const { change } = succeed(
      movePlanItem(board, 'a12', { container: 'd3', index: 0 }, options),
    )
    expect(change).toEqual({
      kind: 'reorder',
      days: [
        { dayId: 'd3', assignmentIds: ['a12'] },
        { dayId: 'd1', assignmentIds: ['a11'] },
      ],
    })
  })

  it('accepts a drop on an empty day', () => {
    const result = succeed(
      movePlanItem(board, 'a11', { container: 'd3', index: 0 }, options),
    )
    expect(itemsIn(result.order, 'd3')).toEqual(['a11'])
  })

  it('refuses a place the target day already holds', () => {
    // `a11` is place `pa`, and day 2 already has `pa` as `a23`.
    expect(
      movePlanItem(board, 'a11', { container: 'd2', index: 0 }, options),
    ).toEqual({ ok: false, reason: 'duplicate' })
  })

  it('still allows the move when the same place is on a different day', () => {
    const result = succeed(
      movePlanItem(board, 'a11', { container: 'd3', index: 0 }, options),
    )
    expect(itemsIn(result.order, 'd3')).toEqual(['a11'])
  })

  it('never rewrites the day run itself', () => {
    const result = succeed(
      movePlanItem(board, 'a12', { container: 'd2', index: 0 }, options),
    )
    expect(result.order.days.map((day) => day.dayId)).toEqual([
      'd1',
      'd2',
      'd3',
    ])
  })

  it('sends a row to the end of a day from the row menu', () => {
    const result = succeed(movePlanItemToDay(board, 'a11', 'd3', options))
    expect(itemsIn(result.order, 'd3')).toEqual(['a11'])
    expect(result.from).toBe('d1')
  })

  it('refuses a menu move onto a day that is not on this trip', () => {
    expect(movePlanItemToDay(board, 'a11', 'd9', options)).toEqual({
      ok: false,
      reason: 'unknown',
    })
  })
})

describe('scheduling an idea', () => {
  it('creates an assignment at the position it was dropped', () => {
    const result = succeed(
      movePlanItem(
        board,
        ideaItemId('px'),
        { container: 'd2', index: 1 },
        options,
      ),
    )
    expect(result.change).toEqual({
      kind: 'schedule',
      placeId: 'px',
      dayId: 'd2',
      index: 1,
    })
    expect(itemsIn(result.order, 'd2')).toEqual([
      'a21',
      ideaItemId('px'),
      'a22',
      'a23',
    ])
    expect(result.order.ideaIds).toEqual([ideaItemId('py')])
  })

  it('refuses an idea for a place the day already has', () => {
    const withIdea: PlanOrder = {
      ...board,
      ideaIds: [ideaItemId('pa')],
    }
    expect(
      movePlanItem(
        withIdea,
        ideaItemId('pa'),
        { container: 'd2', index: 0 },
        options,
      ),
    ).toEqual({ ok: false, reason: 'duplicate' })
  })
})

describe('unscheduling a stop', () => {
  it('deletes the assignment and returns the place to the ideas column', () => {
    const result = succeed(
      movePlanItem(
        board,
        'a11',
        { container: IDEAS_CONTAINER, index: 0 },
        options,
      ),
    )
    expect(result.change).toEqual({ kind: 'unschedule', assignmentId: 'a11' })
    expect(result.order.ideaIds).toEqual([
      ideaItemId('pa'),
      ideaItemId('px'),
      ideaItemId('py'),
    ])
    expect(itemsIn(result.order, 'd1')).toEqual(['a12'])
  })

  it('refuses when it cannot tell which place the assignment points at', () => {
    expect(
      movePlanItem(board, 'a11', { container: IDEAS_CONTAINER, index: 0 }),
    ).toEqual({ ok: false, reason: 'unknown' })
  })
})

describe('re-ranking the ideas column', () => {
  it('rewrites the place order rather than touching any assignment', () => {
    const result = succeed(
      movePlanItem(
        board,
        ideaItemId('py'),
        { container: IDEAS_CONTAINER, index: 0 },
        options,
      ),
    )
    expect(result.change).toEqual({
      kind: 'rank-ideas',
      placeIds: ['py', 'px'],
    })
    expect(result.order.days).toEqual(board.days)
  })
})

describe('refusals', () => {
  it('refuses an item that is not on the board', () => {
    expect(
      movePlanItem(board, 'ghost', { container: 'd1', index: 0 }, options),
    ).toEqual({ ok: false, reason: 'unknown' })
  })

  it('refuses a container that is not on the board', () => {
    expect(
      movePlanItem(board, 'a11', { container: 'nowhere', index: 0 }, options),
    ).toEqual({ ok: false, reason: 'unknown' })
  })

  it('never mutates the board it was given', () => {
    const snapshot = JSON.stringify(board)
    movePlanItem(board, 'a11', { container: 'd2', index: 0 }, options)
    movePlanItem(board, 'a12', { container: 'd3', index: 0 }, options)
    expect(JSON.stringify(board)).toBe(snapshot)
  })
})

describe('removePlanItem', () => {
  it('takes a row off the board wherever it was', () => {
    expect(itemsIn(removePlanItem(board, 'a22'), 'd2')).toEqual(['a21', 'a23'])
    expect(removePlanItem(board, ideaItemId('px')).ideaIds).toEqual([
      ideaItemId('py'),
    ])
  })

  it('is a no-op for something already gone', () => {
    expect(removePlanItem(board, 'ghost')).toEqual(board)
  })
})
