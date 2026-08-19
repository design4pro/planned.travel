import { describe, expect, it } from 'vitest'

import {
  emptyOptimistic,
  isSettling,
  moveItem,
  optimisticReducer,
} from '../optimistic'

import type { OptimisticState } from '../optimistic'

function claim(
  state: OptimisticState<boolean>,
  id: number,
  entries: Array<[string, boolean]>,
): OptimisticState<boolean> {
  return optimisticReducer(state, { type: 'claim', id, entries })
}

describe('optimisticReducer', () => {
  it('paints a claimed value immediately', () => {
    const state = claim(emptyOptimistic<boolean>(), 1, [['a', true]])

    expect(state.values.get('a')).toBe(true)
    expect(isSettling(state)).toBe(true)
  })

  it('leaves rows it was not told about alone', () => {
    const state = claim(emptyOptimistic<boolean>(), 1, [['a', true]])

    expect(state.values.has('b')).toBe(false)
  })

  it('withdraws only the settled claim, so a sibling tick survives a failure', () => {
    let state = claim(emptyOptimistic<boolean>(), 1, [['a', true]])
    state = claim(state, 2, [['b', true]])

    state = optimisticReducer(state, { type: 'settle', id: 1 })

    expect(state.values.has('a')).toBe(false)
    expect(state.values.get('b')).toBe(true)
    expect(isSettling(state)).toBe(true)
  })

  it('lets the later claim for a row win', () => {
    let state = claim(emptyOptimistic<boolean>(), 1, [['a', true]])
    state = claim(state, 2, [['a', false]])

    expect(state.values.get('a')).toBe(false)
  })

  it('does not resurrect an earlier value when the earlier request settles late', () => {
    let state = claim(emptyOptimistic<boolean>(), 1, [['a', true]])
    state = claim(state, 2, [['a', false]])

    state = optimisticReducer(state, { type: 'settle', id: 1 })

    expect(state.values.get('a')).toBe(false)
  })

  it('falls back to the server value once the last claim settles', () => {
    let state = claim(emptyOptimistic<boolean>(), 1, [['a', true]])
    state = claim(state, 2, [['a', false]])

    state = optimisticReducer(state, { type: 'settle', id: 2 })
    state = optimisticReducer(state, { type: 'settle', id: 1 })

    expect(state.values.size).toBe(0)
    expect(isSettling(state)).toBe(false)
  })

  it('covers every row of a bulk claim and withdraws them together', () => {
    let state = claim(emptyOptimistic<boolean>(), 7, [
      ['a', true],
      ['b', true],
      ['c', true],
    ])
    expect(state.values.size).toBe(3)

    state = optimisticReducer(state, { type: 'settle', id: 7 })
    expect(state.values.size).toBe(0)
  })

  it('ignores an empty claim rather than tracking a no-op', () => {
    const initial = emptyOptimistic<boolean>()
    const state = claim(initial, 1, [])

    expect(state).toBe(initial)
  })

  it('ignores settling an id it never issued', () => {
    const state = claim(emptyOptimistic<boolean>(), 1, [['a', true]])

    expect(optimisticReducer(state, { type: 'settle', id: 99 })).toBe(state)
  })

  it('clears everything on demand and is stable when already clear', () => {
    const state = claim(emptyOptimistic<boolean>(), 1, [['a', true]])
    const cleared = optimisticReducer(state, { type: 'clear' })

    expect(cleared.values.size).toBe(0)
    expect(cleared.claims).toHaveLength(0)
    expect(optimisticReducer(cleared, { type: 'clear' })).toBe(cleared)
  })

  it('carries a non-boolean payload — the reorder case', () => {
    const state = optimisticReducer(emptyOptimistic<ReadonlyArray<string>>(), {
      type: 'claim',
      id: 1,
      entries: [['list-1', ['c', 'a', 'b']]],
    })

    expect(state.values.get('list-1')).toEqual(['c', 'a', 'b'])
  })
})

describe('moveItem', () => {
  it('moves an item down', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })

  it('moves an item up', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('never mutates the input', () => {
    const input = ['a', 'b', 'c']
    moveItem(input, 0, 2)
    expect(input).toEqual(['a', 'b', 'c'])
  })

  it('returns the same order for a no-op move', () => {
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })

  it('refuses an out-of-range index rather than scrambling the order', () => {
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
  })

  it('handles an empty list', () => {
    expect(moveItem([], 0, 0)).toEqual([])
  })
})
