/**
 * The sort contract of one day, on its own.
 *
 * PRD #104 decision 9 states the merged day as an algorithm rather than as a screen:
 * walk the items in position order carrying the last time seen, let an untimed item
 * inherit that time, sort what came before the first timed item first, and break ties
 * with position. `mergeDayTimeline` is that sentence, and this file is the sentence
 * read back to it — ids, positions and times, no view model anywhere.
 *
 * The two properties at the end are what make the merge safe to run on every render:
 * it is **stable**, so two items that inherit the same time never swap under the
 * reader, and it is **idempotent**, so merging an already-merged day is a fixed
 * point rather than a slow shuffle.
 */
import { describe, expect, it } from 'vitest'

import { mergeDayTimeline } from '../ordering'

import type { TimelineItem } from '../ordering'

/** `id@position` with an optional time, so a failing assertion reads as a day. */
function item(
  id: string,
  position: number,
  time: string | null = null,
): TimelineItem {
  return { id, position, time }
}

function idsOf(items: ReadonlyArray<TimelineItem>): Array<string> {
  return items.map((entry) => entry.id)
}

describe('mergeDayTimeline', () => {
  it('is exactly position order when nothing on the day has a time', () => {
    const day = [item('c', 2), item('a', 0), item('b', 1)]
    expect(idsOf(mergeDayTimeline(day))).toEqual(['a', 'b', 'c'])
  })

  it('is clock order when every item has a time', () => {
    const day = [
      item('lunch', 0, '13:00'),
      item('museum', 1, '09:30'),
      item('dinner', 2, '20:00'),
    ]
    expect(idsOf(mergeDayTimeline(day))).toEqual(['museum', 'lunch', 'dinner'])
  })

  it('keeps an untimed item attached to the timed item above it', () => {
    const day = [
      item('breakfast', 0, '08:00'),
      item('a note about breakfast', 1),
      item('dinner', 2, '20:00'),
    ]
    expect(idsOf(mergeDayTimeline(day))).toEqual([
      'breakfast',
      'a note about breakfast',
      'dinner',
    ])
  })

  it('never lets an inherited item jump above the item it inherited from', () => {
    // The trailing note inherits 20:00 and must stay last, not float to the top the
    // way a naive "untimed sorts first" rule would send it.
    const day = [
      item('museum', 0, '09:30'),
      item('dinner', 1, '20:00'),
      item('trailing note', 2),
    ]
    expect(idsOf(mergeDayTimeline(day))).toEqual([
      'museum',
      'dinner',
      'trailing note',
    ])
  })

  it('sorts everything before the first timed item first', () => {
    const day = [
      item('pack', 0),
      item('check out', 1),
      item('museum', 2, '09:30'),
    ]
    expect(idsOf(mergeDayTimeline(day))).toEqual([
      'pack',
      'check out',
      'museum',
    ])
  })

  it('puts the untimed head before an early morning item, whatever its clock', () => {
    const day = [item('pack', 0), item('airport run', 1, '04:15')]
    expect(idsOf(mergeDayTimeline(day))).toEqual(['pack', 'airport run'])
  })

  it('is stable: two items on the same inherited time keep their positions', () => {
    const day = [
      item('lunch', 0, '13:00'),
      item('first note', 1),
      item('second note', 2),
      item('third note', 3),
    ]
    expect(idsOf(mergeDayTimeline(day))).toEqual([
      'lunch',
      'first note',
      'second note',
      'third note',
    ])
  })

  it('breaks a tie between two items carrying the same clock time by position', () => {
    const day = [item('later', 5, '11:00'), item('earlier', 1, '11:00')]
    expect(idsOf(mergeDayTimeline(day))).toEqual(['earlier', 'later'])
  })

  it('is idempotent: merging a merged day changes nothing', () => {
    const day = [
      item('dinner', 0, '20:00'),
      item('a note', 1),
      item('museum', 2, '09:30'),
      item('pack', 3),
    ]
    const once = mergeDayTimeline(day)
    expect(idsOf(mergeDayTimeline(once))).toEqual(idsOf(once))
  })

  it('never mutates the array it was given', () => {
    const day = [item('b', 1, '18:00'), item('a', 0, '09:00')]
    const snapshot = [...day]
    mergeDayTimeline(day)
    expect(day).toEqual(snapshot)
  })

  it('answers an empty day with an empty day', () => {
    expect(mergeDayTimeline([])).toEqual([])
  })

  it('carries whatever the caller hung off the item', () => {
    const rows = [
      { id: 'note', position: 1, time: null, kind: 'note' as const },
      { id: 'stop', position: 0, time: '09:00', kind: 'stop' as const },
    ]
    expect(mergeDayTimeline(rows).map((row) => row.kind)).toEqual([
      'stop',
      'note',
    ])
  })
})
