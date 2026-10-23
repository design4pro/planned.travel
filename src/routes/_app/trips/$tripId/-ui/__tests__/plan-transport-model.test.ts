/**
 * The journeys' write half: the run a day's write names.
 *
 * A reorder carries its journeys in the same call as the stops and notes, so the thing that keeps
 * a journey beside its neighbours across a reorder is that the run names those neighbours by id
 * rather than by number. A schedule carries its day's run the same way; an unschedule and a delete
 * send none.
 */
import { describe, expect, it } from 'vitest'

import { ideaItemId, legItemId } from '#/components/planner'
import { planBoard } from '../plan-board'
import { reorderPayload } from '../plan-move'
import { dayRun, departingItemIds, scheduleRun } from '../plan-transport-model'
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

describe('dayRun', () => {
  const result = boardOf({ d1: ['a1', 'a2'], d2: ['b1'], d3: ['c1'] }, [
    journey('j1', { arrivalDayId: 'd3', position: 0.5 }),
  ])
  const rows = result.transportRows
  const order = result.serverOrder

  it('names the journey on the day it departs from and on no other day it covers', () => {
    const departing = departingItemIds(rows)

    expect(dayRun(readDay(order, 'd1'), departing)).toEqual([
      { kind: 'stop', id: 'a1' },
      { kind: 'transport', id: 'j1' },
      { kind: 'stop', id: 'a2' },
    ])
    expect(dayRun(readDay(order, 'd2'), departing)).toEqual([
      { kind: 'stop', id: 'b1' },
    ])
  })

  it('names a note by its own id rather than by its draggable one', () => {
    const withNote = boardOf(
      { d1: ['a1'] },
      [journey('j1', { position: 9 })],
      [note('n1', 'd1', 1)],
    )

    expect(
      dayRun(
        readDay(withNote.serverOrder, 'd1'),
        departingItemIds(withNote.transportRows),
      ),
    ).toEqual([
      { kind: 'stop', id: 'a1' },
      { kind: 'note', id: 'n1' },
      { kind: 'transport', id: 'j1' },
    ])
  })
})

/**
 * What a schedule sends beside the drop: the run of the day it lands on, the new stop named by
 * its place, because the assignment does not exist until the write mints it.
 */
describe('scheduleRun', () => {
  // a1 · a2 · j1 · a3 on the first day, one stop on the second.
  const result = boardOf({ d1: ['a1', 'a2', 'a3'], d2: ['b1'] }, [
    journey('j1', { position: 1.5 }),
  ])
  const rows = result.transportRows
  const stopRef = (id: string) => ({ kind: 'stop', id })

  it('names the new stop by its place and keeps the journey where the reader dropped it', () => {
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

    expect(scheduleRun(next, 'p9', 'd1', rows)).toEqual([
      stopRef('a1'),
      stopRef('a2'),
      { kind: 'transport', id: 'j1' },
      stopRef('p9'),
      stopRef('a3'),
    ])
  })

  it('sends no run for a day no journey departs from', () => {
    const next: PlanOrder = {
      days: [
        { dayId: 'd1', itemIds: ['a1', 'a2', leg('j1'), 'a3'] },
        { dayId: 'd2', itemIds: ['b1', ideaItemId('p9')] },
      ],
      ideaIds: [],
    }

    expect(scheduleRun(next, 'p9', 'd2', rows)).toBeUndefined()
    expect(scheduleRun(next, 'p9', 'unknown', rows)).toBeUndefined()
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
