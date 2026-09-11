/**
 * The journeys, folded into a board that was already built without them.
 *
 * The arithmetic under test is a single sentence — a journey's `sort_order` is where it sits
 * among its **departure** day's stops and notes — and every case here is that sentence meeting
 * something the day already does: a fraction inside a gap, a number outside the day entirely, two
 * journeys in one gap, a clock that outranks both, and the renumbering `reorderPlanFn` performs
 * behind this module's back.
 *
 * The last case is the one that measures the design. The two writes are not atomic with each
 * other, so the only thing that keeps a journey beside its neighbours across a reorder is that the
 * run `journeyWrites` produces names those neighbours by id rather than by number.
 */
import { describe, expect, it } from 'vitest'

import { legItemId } from '#/components/planner'
import {
  journeyWrites,
  timeOfTransports,
  transportRowsOf,
  withTransportItems,
  withTransports,
} from '../plan-transport-model'

import type { PlanOrder, PlannerRow } from '#/components/planner'
import type {
  PlanTransport,
  PlanTransportsPayload,
} from '../../-server/plan-transports'
import type { PlanModel } from '../plan-model'

const DAY_IDS = ['d1', 'd2', 'd3']

const journey = (
  id: string,
  extra: Partial<PlanTransport> = {},
): PlanTransport => ({
  kind: 'transport',
  id,
  mode: 'train',
  status: 'confirmed',
  serviceNumber: 'Nozomi 21',
  fromName: 'Tokyo',
  toName: 'Kyoto',
  departureDayId: 'd1',
  arrivalDayId: 'd1',
  departureTime: null,
  arrivalTime: null,
  priceMinor: null,
  currency: null,
  position: 0,
  ...extra,
})

const payload = (
  transports: ReadonlyArray<PlanTransport>,
): PlanTransportsPayload => ({ tripId: 't1', canWrite: true, transports })

/** The board as `orderFromPayload` leaves it: stops and notes, and no journeys. */
const order = (days: Record<string, ReadonlyArray<string>>): PlanOrder => ({
  days: Object.entries(days).map(([dayId, itemIds]) => ({ dayId, itemIds })),
  ideaIds: [],
})

/** The ids of one day, after the journeys have been threaded in. */
function readDay(next: PlanOrder, dayId: string): ReadonlyArray<string> {
  return next.days.find((day) => day.dayId === dayId)?.itemIds ?? []
}

/** The board with one journey at `position`, and that journey's draggable id. */
function threaded(
  itemIds: ReadonlyArray<string>,
  transports: ReadonlyArray<PlanTransport>,
) {
  const rows = transportRowsOf(payload(transports), DAY_IDS)
  return {
    rows,
    itemIds: readDay(withTransports(order({ d1: itemIds }), rows), 'd1'),
  }
}

const leg = (id: string, dayId = 'd1') => legItemId('transport', dayId, id)

describe('transportRowsOf', () => {
  it('formats each end once, and the range when the journey lands the same day', () => {
    const rows = transportRowsOf(
      payload([
        journey('j1', {
          departureTime: '09:00',
          arrivalTime: '12:30',
          priceMinor: 13320,
          currency: 'JPY',
        }),
        journey('j2', {
          arrivalDayId: 'd3',
          departureTime: '22:10',
          arrivalTime: '06:45',
        }),
      ]),
      DAY_IDS,
    )

    expect(rows.map((row) => [row.itemId, row.time])).toEqual([
      [leg('j1'), '09:00 – 12:30'],
      [leg('j2'), '22:10'],
      [leg('j2', 'd2'), null],
      [leg('j2', 'd3'), '06:45'],
    ])
    expect(rows[0].price).toBe('¥13,320')
    // A leg of a chain carries no fare of its own, and neither does a journey priced nowhere.
    expect(rows[1].price).toBeNull()
  })
})

describe('timeOfTransports', () => {
  /**
   * The clock rule compares instants, and a one-day journey *renders* a range — so the index the
   * merge and the move guard read is built from the payload, never from the rendered row.
   */
  it('gives each end its own instant, and a crossed day none at all', () => {
    const byItem = timeOfTransports(
      payload([
        journey('j1', {
          arrivalDayId: 'd3',
          departureTime: '22:10',
          arrivalTime: '06:45',
        }),
        journey('j2', { departureTime: '09:00', arrivalTime: '12:30' }),
      ]),
    )

    expect([...byItem.entries()]).toEqual([
      [leg('j1'), '22:10'],
      [leg('j1', 'd3'), '06:45'],
      // One day, one row: the arrival never mints a second entry that would outrank its own
      // departure on the same id.
      [leg('j2'), '09:00'],
    ])
  })
})

describe('withTransports', () => {
  it('threads a journey into the gap its fraction names', () => {
    expect(
      threaded(['a1', 'a2'], [journey('j1', { position: 0.5 })]).itemIds,
    ).toEqual(['a1', leg('j1'), 'a2'])
  })

  it('puts a journey below zero ahead of every stop', () => {
    expect(
      threaded(['a1', 'a2'], [journey('j1', { position: -0.5 })]).itemIds,
    ).toEqual([leg('j1'), 'a1', 'a2'])
  })

  it('puts a journey past the last stop last', () => {
    expect(
      threaded(['a1', 'a2'], [journey('j1', { position: 9 })]).itemIds,
    ).toEqual(['a1', 'a2', leg('j1')])
  })

  it('keeps two journeys in one gap in their stored order', () => {
    expect(
      threaded(
        ['a1', 'a2'],
        [journey('j1', { position: 0.75 }), journey('j2', { position: 0.25 })],
      ).itemIds,
    ).toEqual(['a1', leg('j2'), leg('j1'), 'a2'])
  })

  /**
   * `sort_order` defaults to `0`, so this is the resting state of every journey nobody has
   * dragged: it sits behind the stop that opens its day rather than in front of it.
   */
  it('puts a journey whose number equals a stop position after that stop', () => {
    expect(
      threaded(['a1', 'a2', 'a3'], [journey('j1', { position: 1 })]).itemIds,
    ).toEqual(['a1', 'a2', leg('j1'), 'a3'])
  })

  it('renders a day whose only rows are journeys', () => {
    expect(threaded([], [journey('j1', { position: 0 })]).itemIds).toEqual([
      leg('j1'),
    ])
  })

  it('leaves a day with no journeys exactly as it was', () => {
    const before = order({ d1: ['a1', 'a2'], d2: ['a3'] })
    const rows = transportRowsOf(payload([journey('j1')]), DAY_IDS)

    expect(readDay(withTransports(before, rows), 'd2')).toEqual(['a3'])
    // Nothing to thread anywhere is the same board, not a rebuilt one.
    expect(withTransports(before, [])).toBe(before)
  })

  describe('a journey that spans the days between its ends', () => {
    const SPAN = payload([
      journey('j1', {
        arrivalDayId: 'd3',
        departureTime: '22:10',
        arrivalTime: '06:45',
        position: 0.5,
      }),
    ])
    const rows = transportRowsOf(SPAN, DAY_IDS)
    const times = timeOfTransports(SPAN)
    const STOPS = new Map([
      ['a3', '08:00'],
      ['a4', '10:00'],
    ])
    const timeOfItem = (itemId: string) =>
      times.get(itemId) ?? STOPS.get(itemId) ?? null

    const next = withTransports(
      order({ d1: ['a1', 'a2'], d2: ['b1'], d3: ['a3', 'a4'] }),
      rows,
      timeOfItem,
    )

    /** A crossed day is not the day the number was measured against, so it opens the day. */
    it('opens a crossed day with the travelling row', () => {
      expect(readDay(next, 'd2')).toEqual([leg('j1', 'd2'), 'b1'])
    })

    /** The arrival has a clock of its own, and a time outranks a position. */
    it('places the arriving row by its arrival time', () => {
      expect(readDay(next, 'd3')).toEqual([leg('j1', 'd3'), 'a3', 'a4'])
    })

    it('still places the departing row by its stored fraction', () => {
      expect(readDay(next, 'd1')).toEqual(['a1', leg('j1'), 'a2'])
    })
  })
})

describe('withTransportItems', () => {
  const row = (itemId: string): PlannerRow => ({
    itemId,
    placeId: `p-${itemId}`,
    assignmentId: itemId,
    name: `Place ${itemId}`,
    location: null,
    time: null,
    duration: null,
    categoryId: null,
    imageUrl: null,
    rating: null,
    note: null,
    reservationStatus: 'none',
    lng: 139.79,
    lat: 35.71,
    visited: false,
    dayNumber: 1,
  })

  const model = (itemIds: ReadonlyArray<string>): PlanModel => ({
    days: [
      {
        dayId: 'd1',
        dayNumber: 1,
        title: 'Day 1',
        dateLabel: null,
        items: itemIds.map((itemId) => ({ kind: 'stop', row: row(itemId) })),
        rows: itemIds.map(row),
        stays: [],
      },
    ],
    ideas: [],
    categories: [],
    rowsByItem: new Map(),
    rowsByPlace: new Map(),
    dayNumberByPlace: new Map(),
    scheduledCount: itemIds.length,
    stopCountByCategory: {},
  })

  const rows = transportRowsOf(
    payload([journey('j1', { position: 0.5 })]),
    DAY_IDS,
  )
  const next = withTransportItems(
    model(['a1', 'a2']),
    withTransports(order({ d1: ['a1', 'a2'] }), rows),
    rows,
  )

  it('puts the journey back into the sequence the arrangement names', () => {
    expect(
      next.days[0].items.map((item) => {
        if (item.kind === 'transport') return item.transport.itemId
        if (item.kind === 'note') return item.note.id
        return item.row.itemId
      }),
    ).toEqual(['a1', leg('j1'), 'a2'])
  })

  /** The map's route line draws every row it is handed, and a journey is not a place. */
  it('leaves the rows the route line reads untouched', () => {
    expect(next.days[0].rows.map((entry) => entry.itemId)).toEqual(['a1', 'a2'])
  })
})

describe('journeyWrites', () => {
  const SPAN = payload([journey('j1', { arrivalDayId: 'd3', position: 0.5 })])
  const rows = transportRowsOf(SPAN, DAY_IDS)
  const board = withTransports(
    order({ d1: ['a1', 'a2'], d2: ['b1'], d3: ['c1'] }),
    rows,
  )

  it('writes the day a journey departs from and no other day it covers', () => {
    expect(journeyWrites(board, DAY_IDS, rows)).toEqual([
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
    const withNote = withTransports(
      order({ d1: ['a1', 'note:n1'] }),
      transportRowsOf(payload([journey('j1', { position: 9 })]), DAY_IDS),
    )

    expect(
      journeyWrites(
        withNote,
        ['d1'],
        transportRowsOf(payload([journey('j1', { position: 9 })]), DAY_IDS),
      )[0].items,
    ).toEqual([
      { kind: 'stop', id: 'a1' },
      { kind: 'note', id: 'n1' },
      { kind: 'transport', id: 'j1' },
    ])
  })

  it('writes nothing for days that hold no departure', () => {
    expect(journeyWrites(board, ['d2', 'd3'], rows)).toEqual([])
  })

  /**
   * The case that measures the design.
   *
   * `reorderPlanFn` renumbers a day's stops and notes `0..n-1` without consulting a single
   * journey, so any number this module had stored is measured against a ruler that no longer
   * exists. What survives it is that the run names the journey's neighbours by id: the reader
   * dropped the journey after `a2`, and after the renumbering the payload still says so.
   */
  it('restores a journey to the neighbours it had before a reorder renumbered the day', () => {
    const before = withTransports(
      order({ d1: ['a1', 'a2', 'a3'] }),
      transportRowsOf(payload([journey('j1', { position: 1.5 })]), DAY_IDS),
    )
    expect(readDay(before, 'd1')).toEqual(['a1', 'a2', leg('j1'), 'a3'])

    // The reader drags `a3` to the front. `reorderPlanFn` renumbers the stops 0..2 and knows
    // nothing about the journey, whose stored 1.5 now names an entirely different gap.
    const after: PlanOrder = order({ d1: ['a3', 'a1', 'a2', leg('j1')] })

    expect(journeyWrites(after, ['d1'], [])).toEqual([])
    expect(
      journeyWrites(
        after,
        ['d1'],
        transportRowsOf(payload([journey('j1', { position: 1.5 })]), DAY_IDS),
      ),
    ).toEqual([
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
