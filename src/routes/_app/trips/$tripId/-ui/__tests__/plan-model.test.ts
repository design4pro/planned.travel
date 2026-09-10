/**
 * The note half of the planner's adapter.
 *
 * `notesByDay` is where the trip's flat note list becomes the run each day section renders, so the
 * day's order is decided here rather than in a component: `(sortOrder, id)`, the same key the
 * repository reads the table with and the same tiebreak `reorderDayTimeline` applies. A day with no
 * notes must come back absent rather than as an empty entry, because the section asks the map for
 * its run and falls back to nothing.
 */
import { describe, expect, it } from 'vitest'

import { notesByDay } from '../plan-model'

import type { PlanNotesPayload } from '../../-server/day-notes'

function payload(
  notes: PlanNotesPayload['notes'],
  canWrite = true,
): PlanNotesPayload {
  return { tripId: 't1', canWrite, notes }
}

const note = (
  id: string,
  dayId: string,
  sortOrder: number,
  extra: Partial<PlanNotesPayload['notes'][number]> = {},
): PlanNotesPayload['notes'][number] => ({
  id,
  dayId,
  body: `Note ${id}`,
  detail: null,
  time: null,
  icon: 'sticky-note',
  sortOrder,
  ...extra,
})

describe('notesByDay', () => {
  it('groups the trip’s notes under the day each one sits on', () => {
    const runs = notesByDay(
      payload([note('n1', 'd1', 0), note('n2', 'd2', 0), note('n3', 'd1', 1)]),
    )

    expect([...runs.keys()].sort()).toEqual(['d1', 'd2'])
    expect(runs.get('d1')?.map((entry) => entry.id)).toEqual(['n1', 'n3'])
    expect(runs.get('d2')?.map((entry) => entry.id)).toEqual(['n2'])
  })

  it('orders a day by position, and breaks a tie by id', () => {
    // A tie is the *default* state — `sort_order` is `NOT NULL DEFAULT 0` — so the tiebreak is
    // what a day looks like until its first move, not an edge case.
    const runs = notesByDay(
      payload([
        note('n-b', 'd1', 0),
        note('n-a', 'd1', 0),
        note('n-c', 'd1', -1),
      ]),
    )

    expect(runs.get('d1')?.map((entry) => entry.id)).toEqual([
      'n-c',
      'n-a',
      'n-b',
    ])
  })

  it('leaves a day with no notes out of the map entirely', () => {
    expect(notesByDay(payload([])).size).toBe(0)
    expect(notesByDay(payload([note('n1', 'd1', 0)])).has('d2')).toBe(false)
  })

  it('formats the time and carries the detail and the icon through', () => {
    const runs = notesByDay(
      payload([
        note('n1', 'd1', 0, {
          // As D1 hands it back: seconds included, which the row must not print.
          time: '18:30:00',
          detail: '## Later\n\nBring the tickets.',
          icon: 'ticket',
        }),
      ]),
    )

    expect(runs.get('d1')?.[0]).toEqual({
      id: 'n1',
      dayId: 'd1',
      body: 'Note n1',
      detail: '## Later\n\nBring the tickets.',
      time: '18:30',
      icon: 'ticket',
    })
  })
})
