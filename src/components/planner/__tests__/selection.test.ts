import { describe, expect, it } from 'vitest'

import {
  emphasisFor,
  initialSelection,
  selectionReducer,
} from '../selection'

import type { PlannerSelection, SelectionAction } from '../selection'

/** Applies a sequence, which is how selection bugs actually present. */
function run(
  actions: ReadonlyArray<SelectionAction>,
  from: PlannerSelection = initialSelection,
): PlannerSelection {
  return actions.reduce(selectionReducer, from)
}

describe('selecting from the map', () => {
  it('selects the place and focuses the day it belongs to', () => {
    const state = run([{ type: 'pin-click', placeId: 'pa', dayId: 'd2' }])
    expect(state.placeId).toBe('pa')
    expect(state.dayId).toBe('d2')
  })

  it('does not move the camera — the reader is already looking at the pin', () => {
    const state = run([{ type: 'pin-click', placeId: 'pa', dayId: 'd2' }])
    expect(state.cameraToken).toBe(0)
    expect(state.cameraTarget).toBeNull()
  })

  it('lets go when the same pin is clicked again', () => {
    const state = run([
      { type: 'pin-click', placeId: 'pa', dayId: 'd2' },
      { type: 'pin-click', placeId: 'pa', dayId: 'd2' },
    ])
    expect(state.placeId).toBeNull()
    expect(state.dayId).toBeNull()
  })

  it('moves the selection when a different pin is clicked', () => {
    const state = run([
      { type: 'pin-click', placeId: 'pa', dayId: 'd1' },
      { type: 'pin-click', placeId: 'pb', dayId: 'd2' },
    ])
    expect(state).toMatchObject({ placeId: 'pb', dayId: 'd2' })
  })

  it('accepts a pin with no day — an unscheduled place still selects', () => {
    const state = run([{ type: 'pin-click', placeId: 'px', dayId: null }])
    expect(state).toMatchObject({ placeId: 'px', dayId: null })
  })
})

describe('selecting from the rail', () => {
  it('selects, focuses the day, and asks the camera to move', () => {
    const state = run([{ type: 'row-click', placeId: 'pa', dayId: 'd2' }])
    expect(state).toMatchObject({
      placeId: 'pa',
      dayId: 'd2',
      cameraToken: 1,
      cameraTarget: 'pa',
    })
  })

  it('is not a toggle: clicking the selected row takes you there again', () => {
    const state = run([
      { type: 'row-click', placeId: 'pa', dayId: 'd2' },
      { type: 'row-click', placeId: 'pa', dayId: 'd2' },
    ])
    expect(state.placeId).toBe('pa')
    expect(state.cameraToken).toBe(2)
  })

  it('advances the token once per request, so an effect never re-fires on a render', () => {
    const state = run([
      { type: 'row-click', placeId: 'pa', dayId: 'd1' },
      { type: 'hover-in', placeId: 'pb' },
      { type: 'hover-out', placeId: 'pb' },
      { type: 'focus-day', dayId: 'd3' },
    ])
    expect(state.cameraToken).toBe(1)
  })
})

describe('hovering', () => {
  it('marks the hovered place without disturbing the selection', () => {
    const state = run([
      { type: 'pin-click', placeId: 'pa', dayId: 'd1' },
      { type: 'hover-in', placeId: 'pb', dayId: 'd2' },
    ])
    expect(state.placeId).toBe('pa')
    expect(state.hoverId).toBe('pb')
    // A selection outranks a hover for which day is being read.
    expect(state.dayId).toBe('d1')
  })

  it('focuses the hovered day only while nothing is selected', () => {
    const state = run([{ type: 'hover-in', placeId: 'pb', dayId: 'd2' }])
    expect(state.dayId).toBe('d2')
  })

  it('clears on leaving', () => {
    const state = run([
      { type: 'hover-in', placeId: 'pb' },
      { type: 'hover-out', placeId: 'pb' },
    ])
    expect(state.hoverId).toBeNull()
  })

  it('ignores a late leave for a row the pointer has already left', () => {
    const state = run([
      { type: 'hover-in', placeId: 'pa' },
      { type: 'hover-in', placeId: 'pb' },
      // The `pa` row's leave event arrives after the `pb` row's enter.
      { type: 'hover-out', placeId: 'pa' },
    ])
    expect(state.hoverId).toBe('pb')
  })

  it('returns the identical state for a repeated enter, so React can bail out', () => {
    const first = run([{ type: 'hover-in', placeId: 'pb' }])
    expect(selectionReducer(first, { type: 'hover-in', placeId: 'pb' })).toBe(
      first,
    )
  })

  it('returns the identical state for an irrelevant leave', () => {
    const first = run([{ type: 'hover-in', placeId: 'pb' }])
    expect(selectionReducer(first, { type: 'hover-out', placeId: 'pz' })).toBe(
      first,
    )
  })
})

describe('focusing a day', () => {
  it('emphasises one day without selecting anything', () => {
    const state = run([{ type: 'focus-day', dayId: 'd3' }])
    expect(state.dayId).toBe('d3')
    expect(state.placeId).toBeNull()
  })

  it('bails out when the day is already focused', () => {
    const first = run([{ type: 'focus-day', dayId: 'd3' }])
    expect(selectionReducer(first, { type: 'focus-day', dayId: 'd3' })).toBe(
      first,
    )
  })

  it('can be cleared back to the whole trip', () => {
    const state = run([
      { type: 'focus-day', dayId: 'd3' },
      { type: 'focus-day', dayId: null },
    ])
    expect(state.dayId).toBeNull()
  })
})

describe('recentring', () => {
  it('revisits the current selection', () => {
    const state = run([
      { type: 'pin-click', placeId: 'pa', dayId: 'd1' },
      { type: 'recentre' },
    ])
    expect(state).toMatchObject({ cameraToken: 1, cameraTarget: 'pa' })
  })

  it('does nothing with nothing selected', () => {
    expect(selectionReducer(initialSelection, { type: 'recentre' })).toBe(
      initialSelection,
    )
  })
})

describe('clearing and forgetting', () => {
  it('clears the selection, the hover and the focused day together', () => {
    const state = run([
      { type: 'pin-click', placeId: 'pa', dayId: 'd1' },
      { type: 'hover-in', placeId: 'pb' },
      { type: 'clear' },
    ])
    expect(state).toMatchObject({ placeId: null, hoverId: null, dayId: null })
  })

  it('bails out when there is nothing to clear', () => {
    expect(selectionReducer(initialSelection, { type: 'clear' })).toBe(
      initialSelection,
    )
  })

  it('keeps the camera history, so clearing does not trigger a move', () => {
    const state = run([
      { type: 'row-click', placeId: 'pa', dayId: 'd1' },
      { type: 'clear' },
    ])
    expect(state.cameraToken).toBe(1)
  })

  it('drops a place that stopped existing', () => {
    const state = run([
      { type: 'pin-click', placeId: 'pa', dayId: 'd1' },
      { type: 'hover-in', placeId: 'pa' },
      { type: 'forget', placeId: 'pa' },
    ])
    expect(state.placeId).toBeNull()
    expect(state.hoverId).toBeNull()
  })

  it('ignores a place it was not holding', () => {
    const first = run([{ type: 'pin-click', placeId: 'pa', dayId: 'd1' }])
    expect(selectionReducer(first, { type: 'forget', placeId: 'pz' })).toBe(
      first,
    )
  })
})

describe('emphasisFor', () => {
  it('ranks selection above hover above rest', () => {
    const state = run([
      { type: 'pin-click', placeId: 'pa', dayId: 'd1' },
      { type: 'hover-in', placeId: 'pb' },
    ])
    expect(emphasisFor(state, 'pa')).toBe('selected')
    expect(emphasisFor(state, 'pb')).toBe('hovered')
    expect(emphasisFor(state, 'pc')).toBe('rest')
  })

  it('prefers selection when a place is both selected and hovered', () => {
    const state = run([
      { type: 'pin-click', placeId: 'pa', dayId: 'd1' },
      { type: 'hover-in', placeId: 'pa' },
    ])
    expect(emphasisFor(state, 'pa')).toBe('selected')
  })
})
