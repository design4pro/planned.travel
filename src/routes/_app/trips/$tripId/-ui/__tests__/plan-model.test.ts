/**
 * The planner's adapter, where two tables become one sequence.
 *
 * `orderFromPayload` is the single place `day_assignments.order_index` and
 * `day_notes.sort_order` are read as one number line (PRD #104 decision 9), so the
 * merge's observable promises are asserted here rather than reasoned about: a day that
 * carries times reads in clock order, a day that carries none reads in stored order.
 *
 * `planModel` then owes the map a guarantee the type system cannot state — that
 * `PlannerDay.rows` is stops and only stops, because the route line draws every row it
 * is handed and a note has no coordinate to draw.
 */
import { describe, expect, it } from 'vitest'

import {
  notesByItem,
  orderFromPayload,
  planModel,
  timeByItem,
} from '../plan-model'

import type { PlanNotesPayload } from '../../-server/day-notes'
import type {
  PlanBoardDay,
  PlanBoardPayload,
  PlanBoardPlace,
  PlanBoardStop,
} from '../../-server/plan'

function notes(
  entries: PlanNotesPayload['notes'],
  canWrite = true,
): PlanNotesPayload {
  return { tripId: 't1', canWrite, notes: entries }
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

const stop = (
  assignmentId: string,
  placeId: string,
  position: number,
  startTime: string | null = null,
): PlanBoardStop => ({
  assignmentId,
  placeId,
  position,
  startTime,
  endTime: null,
  durationMinutes: null,
  reservationStatus: 'none',
  notes: null,
})

const place = (id: string): PlanBoardPlace => ({
  id,
  name: `Place ${id}`,
  address: null,
  city: null,
  categoryId: 'c1',
  imageUrl: null,
  website: null,
  description: null,
  rating: null,
  lat: 35.71,
  lng: 139.79,
  isVisited: false,
  durationMinutes: 60,
})

const day = (
  dayId: string,
  dayNumber: number,
  stops: ReadonlyArray<PlanBoardStop>,
): PlanBoardDay => ({
  dayId,
  dayNumber,
  date: null,
  title: `Day ${dayNumber}`,
  stops,
  stays: [],
})

/** A board carrying exactly the places its days point at. */
function board(days: ReadonlyArray<PlanBoardDay>): PlanBoardPayload {
  const placeIds = [
    ...new Set(days.flatMap((entry) => entry.stops.map((one) => one.placeId))),
  ]
  return {
    tripId: 't1',
    editable: true,
    days,
    places: placeIds.map((id) => place(id)),
    unscheduledIds: [],
    categories: [],
  }
}

describe('notesByItem', () => {
  it('keys every note by its draggable id, and prints the time without seconds', () => {
    const byItem = notesByItem(
      notes([
        // As D1 hands it back: seconds included, which the row must not print.
        note('n1', 'd1', 0, {
          time: '18:30:00',
          detail: '## Later\n\nBring the tickets.',
          icon: 'ticket',
        }),
        note('n2', 'd2', 0),
      ]),
    )

    expect([...byItem.keys()]).toEqual(['note:n1', 'note:n2'])
    expect(byItem.get('note:n1')).toEqual({
      id: 'n1',
      dayId: 'd1',
      body: 'Note n1',
      detail: '## Later\n\nBring the tickets.',
      time: '18:30',
      icon: 'ticket',
    })
  })
})

describe('timeByItem', () => {
  it('reads a stop at its start time and skips everything untimed', () => {
    const byItem = timeByItem(
      board([
        day('d1', 1, [stop('a1', 'p1', 0, '09:00:00'), stop('a2', 'p2', 1)]),
      ]),
      notes([note('n1', 'd1', 2, { time: '13:15:00' }), note('n2', 'd1', 3)]),
    )

    expect([...byItem.entries()]).toEqual([
      ['a1', '09:00'],
      ['note:n1', '13:15'],
    ])
  })
})

describe('orderFromPayload', () => {
  it('reads a day that carries times in clock order, note among stops', () => {
    const order = orderFromPayload(
      board([
        day('d1', 1, [
          stop('a1', 'p1', 0, '09:00'),
          stop('a2', 'p2', 2, '08:00'),
        ]),
      ]),
      // Untimed and stored after the 09:00 stop, so it inherits 09:00 and travels
      // with it rather than floating to the top of the day.
      notes([note('n1', 'd1', 1)]),
    )

    expect(order.days).toEqual([
      { dayId: 'd1', itemIds: ['a2', 'a1', 'note:n1'] },
    ])
  })

  it('leaves a day with no times in the order the two tables stored it', () => {
    const order = orderFromPayload(
      board([day('d1', 1, [stop('a1', 'p1', 0), stop('a2', 'p2', 2)])]),
      notes([note('n1', 'd1', 1), note('n2', 'd1', 3)]),
    )

    expect(order.days[0].itemIds).toEqual(['a1', 'note:n1', 'a2', 'note:n2'])
  })
})

describe('planModel', () => {
  const PAYLOAD = board([
    day('d1', 1, [stop('a1', 'p1', 0, '09:00'), stop('a2', 'p2', 2)]),
    day('d2', 2, []),
  ])
  const NOTES = notes([note('n1', 'd1', 1), note('n2', 'd2', 0)])

  function model() {
    return planModel(
      PAYLOAD,
      orderFromPayload(PAYLOAD, NOTES),
      undefined,
      notesByItem(NOTES),
    )
  }

  it('renders each day as one sequence of stops and notes', () => {
    expect(
      model().days.map((entry) =>
        entry.items.map((item) =>
          item.kind === 'note' ? item.note.id : item.row.itemId,
        ),
      ),
    ).toEqual([['a1', 'n1', 'a2'], ['n2']])
  })

  /** The map draws every row it is handed, and a note has nothing to draw. */
  it('keeps notes out of the rows the route line reads', () => {
    expect(
      model().days.map((entry) => entry.rows.map((row) => row.itemId)),
    ).toEqual([['a1', 'a2'], []])
  })

  it('counts places when it counts what is scheduled, never notes', () => {
    expect(model().scheduledCount).toBe(2)
  })

  /**
   * A delete in another tab leaves an id the payload cannot resolve. Skipping it is
   * what keeps the day renderable until the next invalidate reconciles the two.
   */
  it('skips a note the payload no longer carries', () => {
    const day1 = planModel(
      PAYLOAD,
      orderFromPayload(PAYLOAD, NOTES),
      undefined,
      notesByItem(notes([note('n2', 'd2', 0)])),
    ).days[0]

    expect(day1.items.map((item) => item.kind)).toEqual(['stop', 'stop'])
  })
})
