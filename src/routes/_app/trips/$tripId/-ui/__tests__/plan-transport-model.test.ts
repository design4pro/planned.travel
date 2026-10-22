/**
 * The journeys' write half: the run a day's write names, and what a landed write owes the server.
 *
 * A reorder carries its journeys in the same call as the stops and notes, so the thing that keeps
 * a journey beside its neighbours across a reorder is that the run names those neighbours by id
 * rather than by number. The schedule, unschedule and delete writes do not renumber a day and
 * still restate their journeys afterwards.
 */
import { describe, expect, it } from 'vitest'

import { ideaItemId, legItemId } from '#/components/planner'
import { planBoard } from '../plan-board'
import { reorderPayload } from '../plan-move'
import { journeyWrites, journeyWritesFor } from '../plan-transport-model'
import {
  board,
  day,
  journey,
  note,
  notes,
  stop,
  transports,
} from './plan-board-fixtures'

import type { PlanOrder } from '#/components/planner'
import type { PlanTransport } from '../../-server/plan-transports'

const DAY_IDS = ['d1', 'd2', 'd3']

/**
 * The board the reader sees: one stop per id on each day (stored `0..n-1`), the journeys, and
 * the day-one notes — read through `planBoard`, the way the screen reads them.
 */
function boardOf(
  days: Record<string, ReadonlyArray<string>>,
  journeys: ReadonlyArray<PlanTransport>,
  noteRows: ReadonlyArray<ReturnType<typeof note>> = [],
) {
  return planBoard(
    board(
      DAY_IDS.map((dayId, index) =>
        day(
          dayId,
          index + 1,
          (days[dayId] ?? []).map((id, at) => stop(id, `p-${id}`, at)),
        ),
      ),
    ),
    notes(noteRows),
    transports(journeys),
  )
}

/** The ids of one day, as the board reads it. */
function readDay(next: PlanOrder, dayId: string): ReadonlyArray<string> {
  return next.days.find((entry) => entry.dayId === dayId)?.itemIds ?? []
}

const leg = (id: string, dayId = 'd1') => legItemId('transport', dayId, id)

describe('journeyWrites', () => {
  const result = boardOf({ d1: ['a1', 'a2'], d2: ['b1'], d3: ['c1'] }, [
    journey('j1', { arrivalDayId: 'd3', position: 0.5 }),
  ])
  const rows = result.transportRows
  const order = result.serverOrder

  it('writes the day a journey departs from and no other day it covers', () => {
    expect(journeyWrites(order, DAY_IDS, rows)).toEqual([
      {
        dayId: 'd1',
        items: [
          { kind: 'stop', id: 'a1' },
          { kind: 'transport', id: 'j1' },
          { kind: 'stop', id: 'a2' },
        ],
      },
    ])
  })

  it('names a note by its own id rather than by its draggable one', () => {
    const withNote = boardOf(
      { d1: ['a1'] },
      [journey('j1', { position: 9 })],
      [note('n1', 'd1', 1)],
    )

    expect(
      journeyWrites(withNote.serverOrder, ['d1'], withNote.transportRows)[0]
        .items,
    ).toEqual([
      { kind: 'stop', id: 'a1' },
      { kind: 'note', id: 'n1' },
      { kind: 'transport', id: 'j1' },
    ])
  })

  it('writes nothing for days that hold no departure', () => {
    expect(journeyWrites(order, ['d2', 'd3'], rows)).toEqual([])
  })

  /**
   * The case that measures the design.
   *
   * A write that renumbers a day's stops and notes `0..n-1` leaves any number stored for a
   * journey measured against a ruler that no longer exists. What survives it is that the run
   * names the journey's neighbours by id: the reader dropped the journey after `a2`, and after
   * the renumbering the payload still says so.
   */
  it('restores a journey to the neighbours it had before a write renumbered the day', () => {
    const restored = boardOf({ d1: ['a1', 'a2', 'a3'] }, [
      journey('j1', { position: 1.5 }),
    ])
    expect(readDay(restored.serverOrder, 'd1')).toEqual([
      'a1',
      'a2',
      leg('j1'),
      'a3',
    ])

    // The reader drags `a3` to the front. The stops are renumbered 0..2, and the journey's
    // stored 1.5 would now name an entirely different gap.
    const after: PlanOrder = {
      days: [{ dayId: 'd1', itemIds: ['a3', 'a1', 'a2', leg('j1')] }],
      ideaIds: [],
    }

    expect(journeyWrites(after, ['d1'], [])).toEqual([])
    expect(journeyWrites(after, ['d1'], restored.transportRows)).toEqual([
      {
        dayId: 'd1',
        items: [
          { kind: 'stop', id: 'a3' },
          { kind: 'stop', id: 'a1' },
          { kind: 'stop', id: 'a2' },
          { kind: 'transport', id: 'j1' },
        ],
      },
    ])
  })
})

/**
 * Which board and which days each landed write restates — the choice the four call sites in
 * `plan-screen.tsx` used to make inline, where no test could reach it.
 */
describe('journeyWritesFor', () => {
  // a1 · a2 · j1 · a3 on the first day, one stop on the second.
  const result = boardOf({ d1: ['a1', 'a2', 'a3'], d2: ['b1'] }, [
    journey('j1', { position: 1.5 }),
  ])
  const rows = result.transportRows
  const before = result.serverOrder
  const d1 = (...items: ReadonlyArray<{ kind: string; id: string }>) => [
    { dayId: 'd1', items },
  ]
  const stopRef = (id: string) => ({ kind: 'stop', id })
  const j1 = { kind: 'transport', id: 'j1' }

  it('restates the day a deleted stop left, against the day without it', () => {
    expect(
      journeyWritesFor({ kind: 'delete', before, itemId: 'a2' }, rows),
    ).toEqual(d1(stopRef('a1'), j1, stopRef('a3')))
  })

  it('writes nothing when the deleted place was only an idea', () => {
    const withIdea: PlanOrder = { ...before, ideaIds: [ideaItemId('p1')] }

    expect(
      journeyWritesFor(
        { kind: 'delete', before: withIdea, itemId: ideaItemId('p1') },
        rows,
      ),
    ).toEqual([])
  })

  it('restates the day an unscheduled stop left, which only the board before names', () => {
    const next: PlanOrder = {
      days: [
        { dayId: 'd1', itemIds: ['a1', leg('j1'), 'a3'] },
        { dayId: 'd2', itemIds: ['b1'] },
      ],
      ideaIds: [ideaItemId('p2')],
    }

    expect(
      journeyWritesFor(
        { kind: 'unschedule', before, next, itemId: 'a2' },
        rows,
      ),
    ).toEqual(d1(stopRef('a1'), j1, stopRef('a3')))
  })

  it('names a scheduled stop by the assignment the write created', () => {
    const next: PlanOrder = {
      days: [
        {
          dayId: 'd1',
          itemIds: ['a1', 'a2', leg('j1'), ideaItemId('p9'), 'a3'],
        },
        { dayId: 'd2', itemIds: ['b1'] },
      ],
      ideaIds: [],
    }

    expect(
      journeyWritesFor(
        {
          kind: 'schedule',
          next,
          placeId: 'p9',
          assignmentId: 'asg9',
          dayId: 'd1',
        },
        rows,
      ),
    ).toEqual(
      d1(stopRef('a1'), stopRef('a2'), j1, stopRef('asg9'), stopRef('a3')),
    )
  })
})

/**
 * `reorderPlanFn`'s input for one reorder: the whole run of every touched day, journeys included,
 * so the stops, the notes and the journeys are one call and one transaction.
 */
describe('reorderPayload with journeys', () => {
  const result = boardOf({ d1: ['a1', 'a2', 'a3'], d2: ['b1'] }, [
    journey('j1', { position: 1.5 }),
  ])
  const rows = result.transportRows

  it('carries the journey in its departure day’s run, between the rows it follows', () => {
    const payload = reorderPayload(
      'trip-1',
      {
        kind: 'reorder',
        days: [{ dayId: 'd1', itemIds: ['a3', 'a1', leg('j1'), 'a2'] }],
      },
      null,
      rows,
    )

    expect(payload.days).toEqual([
      {
        dayId: 'd1',
        items: [
          { kind: 'stop', id: 'a3' },
          { kind: 'stop', id: 'a1' },
          { kind: 'transport', id: 'j1' },
          { kind: 'stop', id: 'a2' },
        ],
      },
    ])
  })

  it('makes a journey-only move the same call, with every stop and note where it was', () => {
    const payload = reorderPayload(
      'trip-1',
      {
        kind: 'reorder',
        days: [{ dayId: 'd1', itemIds: [leg('j1'), 'a1', 'a2', 'a3'] }],
      },
      null,
      rows,
    )

    expect(payload.days[0].items).toEqual([
      { kind: 'transport', id: 'j1' },
      { kind: 'stop', id: 'a1' },
      { kind: 'stop', id: 'a2' },
      { kind: 'stop', id: 'a3' },
    ])
  })

  it('leaves out a journey row that only crosses the day', () => {
    const crossing = boardOf({ d1: ['a1'], d2: ['b1'] }, [
      journey('j2', { arrivalDayId: 'd2', position: 0.5 }),
    ])
    const crossed = crossing.transportRows.find((row) => row.dayId === 'd2')
    expect(crossed?.part).not.toBe('departing')

    const payload = reorderPayload(
      'trip-1',
      {
        kind: 'reorder',
        days: [
          {
            dayId: 'd2',
            itemIds: [crossed?.itemId ?? '', 'b1'],
          },
        ],
      },
      null,
      crossing.transportRows,
    )

    expect(payload.days[0].items).toEqual([{ kind: 'stop', id: 'b1' }])
  })

  it('never asks a journey to drop a time', () => {
    const payload = reorderPayload(
      'trip-1',
      {
        kind: 'reorder',
        days: [{ dayId: 'd1', itemIds: ['a1', leg('j1'), 'a2', 'a3'] }],
      },
      leg('j1'),
      rows,
    )

    expect(payload.days[0].clearTime).toBeUndefined()
  })
})
