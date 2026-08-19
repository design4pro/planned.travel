import { describe, expect, it } from 'vitest'

import {
  groupByCategory,
  isItemPriority,
  isListKind,
  isUngrouped,
  knownCategories,
  listKindLabel,
  matchesFilter,
  matchesOwner,
  progressOf,
  selectAllState,
} from '../list-utils'

import type { ListItemLike } from '../list-utils'

function item(overrides: Partial<ListItemLike> & { id: string }): ListItemLike {
  return {
    name: `Item ${overrides.id}`,
    category: null,
    quantity: 1,
    weightGrams: null,
    isDone: false,
    assignedTo: null,
    priority: 'normal',
    ...overrides,
  }
}

describe('kind and priority guards', () => {
  it('accepts the kinds the schema stores', () => {
    expect(isListKind('packing')).toBe(true)
    expect(isListKind('groceries')).toBe(false)
  })

  it('labels an unknown kind rather than rendering the raw token', () => {
    expect(listKindLabel('todo')).toBe('To-do')
    expect(listKindLabel('nonsense')).toBe('List')
  })

  it('accepts the priorities the schema stores', () => {
    expect(isItemPriority('high')).toBe(true)
    expect(isItemPriority('urgent')).toBe(false)
  })
})

describe('matchesFilter', () => {
  it('keeps everything under "all"', () => {
    expect(matchesFilter(true, 'all')).toBe(true)
    expect(matchesFilter(false, 'all')).toBe(true)
  })

  it('keeps only unticked rows under "open"', () => {
    expect(matchesFilter(false, 'open')).toBe(true)
    expect(matchesFilter(true, 'open')).toBe(false)
  })

  it('keeps only ticked rows under "done"', () => {
    expect(matchesFilter(true, 'done')).toBe(true)
    expect(matchesFilter(false, 'done')).toBe(false)
  })
})

describe('matchesOwner', () => {
  it('keeps every list under "everyone"', () => {
    expect(matchesOwner(null, 'me', 'everyone')).toBe(true)
    expect(matchesOwner('someone', 'me', 'everyone')).toBe(true)
  })

  it('keeps only unowned lists under "shared"', () => {
    expect(matchesOwner(null, 'me', 'shared')).toBe(true)
    expect(matchesOwner('me', 'me', 'shared')).toBe(false)
  })

  it('keeps only the viewer’s own lists under "mine"', () => {
    expect(matchesOwner('me', 'me', 'mine')).toBe(true)
    expect(matchesOwner('someone', 'me', 'mine')).toBe(false)
    expect(matchesOwner(null, 'me', 'mine')).toBe(false)
  })
})

describe('groupByCategory', () => {
  it('groups by category in first-use order', () => {
    const groups = groupByCategory([
      item({ id: '1', category: 'Clothes' }),
      item({ id: '2', category: 'Tech' }),
      item({ id: '3', category: 'Clothes' }),
    ])

    expect(groups.map((group) => group.category)).toEqual(['Clothes', 'Tech'])
    expect(groups[0]?.items.map((entry) => entry.id)).toEqual(['1', '3'])
  })

  it('keeps the traveller’s own order inside a group', () => {
    const groups = groupByCategory([
      item({ id: 'c', category: 'Clothes' }),
      item({ id: 'a', category: 'Clothes' }),
      item({ id: 'b', category: 'Clothes' }),
    ])

    expect(groups[0]?.items.map((entry) => entry.id)).toEqual(['c', 'a', 'b'])
  })

  it('collects un-categorised items into one trailing group', () => {
    const groups = groupByCategory([
      item({ id: '1' }),
      item({ id: '2', category: 'Tech' }),
      item({ id: '3' }),
    ])

    expect(groups.map((group) => group.category)).toEqual(['Tech', null])
    expect(groups[1]?.items.map((entry) => entry.id)).toEqual(['1', '3'])
  })

  it('treats blank and whitespace-only categories as un-categorised', () => {
    const groups = groupByCategory([
      item({ id: '1', category: '   ' }),
      item({ id: '2', category: '' }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.category).toBeNull()
  })

  it('trims a category so " Tech" and "Tech" are one group', () => {
    const groups = groupByCategory([
      item({ id: '1', category: ' Tech' }),
      item({ id: '2', category: 'Tech ' }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.category).toBe('Tech')
  })

  it('returns nothing for an empty list', () => {
    expect(groupByCategory([])).toEqual([])
  })
})

describe('isUngrouped', () => {
  it('is true when nothing is categorised, so no headings are drawn', () => {
    expect(isUngrouped(groupByCategory([item({ id: '1' })]))).toBe(true)
    expect(isUngrouped(groupByCategory([]))).toBe(true)
  })

  it('is false as soon as one item carries a category', () => {
    expect(
      isUngrouped(groupByCategory([item({ id: '1', category: 'Tech' })])),
    ).toBe(false)
  })

  it('is false for a mix, so the loose group gets its own heading', () => {
    expect(
      isUngrouped(
        groupByCategory([
          item({ id: '1', category: 'Tech' }),
          item({ id: '2' }),
        ]),
      ),
    ).toBe(false)
  })
})

describe('knownCategories', () => {
  it('lists each category once, alphabetically', () => {
    expect(
      knownCategories([
        item({ id: '1', category: 'Tech' }),
        item({ id: '2', category: 'Clothes' }),
        item({ id: '3', category: 'Tech' }),
      ]),
    ).toEqual(['Clothes', 'Tech'])
  })

  it('ignores blanks', () => {
    expect(
      knownCategories([item({ id: '1', category: '  ' }), item({ id: '2' })]),
    ).toEqual([])
  })
})

describe('progressOf', () => {
  it('counts ticked against total', () => {
    const progress = progressOf([
      item({ id: '1', isDone: true }),
      item({ id: '2' }),
      item({ id: '3' }),
    ])

    expect(progress).toMatchObject({ total: 3, done: 1, open: 2 })
    expect(progress.ratio).toBeCloseTo(1 / 3)
    expect(progress.complete).toBe(false)
  })

  it('reports a finished list as complete', () => {
    expect(progressOf([item({ id: '1', isDone: true })]).complete).toBe(true)
  })

  it('never reports an empty list as complete, and never divides by zero', () => {
    const progress = progressOf([])
    expect(progress.ratio).toBe(0)
    expect(progress.complete).toBe(false)
  })

  it('multiplies weight by quantity', () => {
    expect(
      progressOf([item({ id: '1', weightGrams: 250, quantity: 3 })])
        .weightGrams,
    ).toBe(750)
  })

  it('treats a missing weight as nothing rather than as a hole', () => {
    expect(
      progressOf([
        item({ id: '1', weightGrams: null }),
        item({ id: '2', weightGrams: 100 }),
      ]).weightGrams,
    ).toBe(100)
  })

  it('reads a zero quantity as one, so a weight is never lost', () => {
    expect(
      progressOf([item({ id: '1', weightGrams: 100, quantity: 0 })])
        .weightGrams,
    ).toBe(100)
  })
})

describe('selectAllState', () => {
  it('is unchecked when nothing is ticked', () => {
    expect(selectAllState([item({ id: '1' }), item({ id: '2' })])).toBe(false)
  })

  it('is checked when everything is ticked', () => {
    expect(selectAllState([item({ id: '1', isDone: true })])).toBe(true)
  })

  it('is mixed for a partial list', () => {
    expect(
      selectAllState([item({ id: '1', isDone: true }), item({ id: '2' })]),
    ).toBe('indeterminate')
  })

  it('is unchecked for an empty list rather than mixed', () => {
    expect(selectAllState([])).toBe(false)
  })
})
