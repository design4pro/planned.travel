import { describe, expect, it } from 'vitest'

import {
  IDEAS_CONTAINER,
  containerIds,
  containerOf,
  ideaItemId,
  indexOf,
  isIdeaItemId,
  isNoteItemId,
  itemsIn,
  movePlanItem,
  movePlanItemToDay,
  noteIdOfNoteItem,
  noteItemId,
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

  it('keeps notes in a third space that neither of the other two claims', () => {
    expect(isNoteItemId(noteItemId('n1'))).toBe(true)
    expect(isNoteItemId('a11')).toBe(false)
    expect(isNoteItemId(ideaItemId('px'))).toBe(false)
    expect(isIdeaItemId(noteItemId('n1'))).toBe(false)
    expect(noteIdOfNoteItem(noteItemId('note:weird'))).toBe('note:weird')
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

/* -------------------------------------------------------------------------------------------------
 * The merged day (PRD #104 decision 9)
 * ---------------------------------------------------------------------------------------------- */

/**
 * A two-day board whose first day interleaves stops and notes, with times on two of
 * the stops. `PLACES` above does not know these ids, which is exactly right: a note
 * has no place, so the duplicate guard has nothing to ask about it.
 */
const merged: PlanOrder = {
  days: [
    {
      dayId: 'd1',
      itemIds: ['m11', noteItemId('n1'), 'm12', noteItemId('n2')],
    },
    { dayId: 'd2', itemIds: ['m21'] },
  ],
  ideaIds: [ideaItemId('px')],
}

const TIMES: Readonly<Record<string, string>> = {
  m11: '09:00',
  m12: '17:00',
  m21: '12:00',
}

const timed = {
  placeOfItem: (itemId: string): string | null =>
    itemId === 'm11' || itemId === 'm12' || itemId === 'm21' ? itemId : null,
  timeOfItem: (itemId: string): string | null => TIMES[itemId] ?? null,
}

describe('a note in the merged day', () => {
  it('moves within its own day like any other row', () => {
    const result = succeed(
      movePlanItem(
        merged,
        noteItemId('n2'),
        { container: 'd1', index: 0 },
        timed,
      ),
    )
    expect(itemsIn(result.order, 'd1')).toEqual([
      noteItemId('n2'),
      'm11',
      noteItemId('n1'),
      'm12',
    ])
    expect(result.change).toEqual({
      kind: 'reorder',
      days: [
        {
          dayId: 'd1',
          assignmentIds: [noteItemId('n2'), 'm11', noteItemId('n1'), 'm12'],
        },
      ],
    })
  })

  it('moves to another day, taking its position with it', () => {
    const result = succeed(
      movePlanItem(
        merged,
        noteItemId('n1'),
        { container: 'd2', index: 0 },
        timed,
      ),
    )
    expect(itemsIn(result.order, 'd2')).toEqual([noteItemId('n1'), 'm21'])
    expect(itemsIn(result.order, 'd1')).toEqual([
      'm11',
      'm12',
      noteItemId('n2'),
    ])
  })

  it('is refused into the ideas column, which holds places and nothing else', () => {
    expect(
      movePlanItem(
        merged,
        noteItemId('n1'),
        { container: IDEAS_CONTAINER, index: 0 },
        timed,
      ),
    ).toEqual({ ok: false, reason: 'not-in-ideas' })
  })

  it('leaves the board exactly as it was when it is refused', () => {
    const snapshot = structuredClone(merged)
    movePlanItem(
      merged,
      noteItemId('n1'),
      { container: IDEAS_CONTAINER, index: 0 },
      timed,
    )
    expect(merged).toEqual(snapshot)
  })

  it('has no place, so the duplicate guard never fires on it', () => {
    const result = succeed(
      movePlanItemToDay(merged, noteItemId('n1'), 'd2', timed),
    )
    expect(itemsIn(result.order, 'd2')).toEqual(['m21', noteItemId('n1')])
  })
})

describe('a timed row dragged against its own clock', () => {
  it('is refused with `timed` when it would land after a later item', () => {
    // 17:00 dropped above 09:00.
    expect(
      movePlanItem(merged, 'm12', { container: 'd1', index: 0 }, timed),
    ).toEqual({ ok: false, reason: 'timed' })
  })

  it('is refused with `timed` when it would land before an earlier item', () => {
    // 09:00 dropped below 17:00.
    expect(
      movePlanItem(merged, 'm11', { container: 'd1', index: 3 }, timed),
    ).toEqual({ ok: false, reason: 'timed' })
  })

  it('is refused across days too, where the contradiction is the target day’s', () => {
    // 09:00 dropped after the 12:00 that is already on d2.
    expect(
      movePlanItem(merged, 'm11', { container: 'd2', index: 1 }, timed),
    ).toEqual({ ok: false, reason: 'timed' })
  })

  it('returns the board unchanged, so the screen can ask instead of undo', () => {
    const snapshot = structuredClone(merged)
    movePlanItem(merged, 'm12', { container: 'd1', index: 0 }, timed)
    expect(merged).toEqual(snapshot)
  })

  it('allows the move when the clock agrees with the new position', () => {
    const result = succeed(
      movePlanItem(merged, 'm11', { container: 'd2', index: 0 }, timed),
    )
    expect(itemsIn(result.order, 'd2')).toEqual(['m11', 'm21'])
  })

  it('never fires for an untimed row, whatever it is dropped between', () => {
    const result = succeed(
      movePlanItem(
        merged,
        noteItemId('n2'),
        { container: 'd1', index: 1 },
        timed,
      ),
    )
    expect(itemsIn(result.order, 'd1')).toEqual([
      'm11',
      noteItemId('n2'),
      noteItemId('n1'),
      'm12',
    ])
  })

  it('never fires without a time lookup, so nothing that shipped can start refusing', () => {
    const result = succeed(
      movePlanItem(merged, 'm12', { container: 'd1', index: 0 }),
    )
    expect(itemsIn(result.order, 'd1')?.[0]).toBe('m12')
  })

  it('still refuses a duplicate place before it ever looks at a clock', () => {
    const board2: PlanOrder = {
      days: [
        { dayId: 'd1', itemIds: ['m11'] },
        { dayId: 'd2', itemIds: ['m21'] },
      ],
      ideaIds: [],
    }
    const sameLookups = {
      placeOfItem: (): string => 'one place',
      timeOfItem: (itemId: string): string | null => TIMES[itemId] ?? null,
    }
    expect(
      movePlanItem(board2, 'm11', { container: 'd2', index: 1 }, sameLookups),
    ).toEqual({ ok: false, reason: 'duplicate' })
  })
})
