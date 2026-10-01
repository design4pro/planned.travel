/**
 * The Plan board, read: "given these payloads, Day N reads X".
 *
 * Every case goes through `planBoard`, the one interface a Day is read through. The arithmetic
 * under test is a single sentence — a Day is one number line across stops, notes and journeys,
 * each at the position the server stored, and a clock outranks a position — meeting the things a
 * real day does: a fraction inside a gap, a number outside the day entirely, two journeys in one
 * gap, a stored position that drifted off `0..n-1`.
 */
import { describe, expect, it } from 'vitest'

import { legItemId } from '#/components/planner'
import { planBoard } from '../plan-board'
import {
  board,
  day,
  journey,
  note,
  notes,
  stop,
  transports,
} from './plan-board-fixtures'

import type { PlanBoardStop } from '../../-server/plan'
import type { PlanTransport } from '../../-server/plan-transports'

const leg = (id: string, dayId = 'd1') => legItemId('transport', dayId, id)

/** Three days, the stops given for each, and the journeys the trip holds. */
function read(
  stops: Record<string, ReadonlyArray<PlanBoardStop>>,
  journeys: ReadonlyArray<PlanTransport> = [],
  noteRows: ReadonlyArray<ReturnType<typeof note>> = [],
) {
  return planBoard(
    board(
      ['d1', 'd2', 'd3'].map((dayId, index) =>
        day(dayId, index + 1, stops[dayId] ?? []),
      ),
    ),
    notes(noteRows),
    transports(journeys),
  )
}

/** One day's ids, in the order a reader sees them. */
const dayOf = (result: ReturnType<typeof read>, dayId: string) =>
  result.serverOrder.days.find((entry) => entry.dayId === dayId)?.itemIds ?? []

/** A day of stops `a1, a2, …` at the positions given (`0..n-1` by default). */
const stops = (
  positions: ReadonlyArray<number>,
  times: ReadonlyArray<string | null> = [],
) =>
  positions.map((position, index) =>
    stop(`a${index + 1}`, `p${index + 1}`, position, times[index] ?? null),
  )

describe('planBoard — a Day without journeys', () => {
  it('reads a day that carries times in clock order, note among stops', () => {
    const result = read(
      {
        d1: [stop('a1', 'p1', 0, '09:00'), stop('a2', 'p2', 2, '08:00')],
      },
      [],
      // Untimed and stored after the 09:00 stop, so it inherits 09:00 and travels
      // with it rather than floating to the top of the day.
      [note('n1', 'd1', 1)],
    )

    expect(dayOf(result, 'd1')).toEqual(['a2', 'a1', 'note:n1'])
  })

  it('leaves a day with no times in the order the tables stored it', () => {
    const result = read(
      { d1: stops([0, 2]) },
      [],
      [note('n1', 'd1', 1), note('n2', 'd1', 3)],
    )

    expect(dayOf(result, 'd1')).toEqual(['a1', 'note:n1', 'a2', 'note:n2'])
  })

  it('keeps the unscheduled places as ideas', () => {
    const payload = { ...board([day('d1', 1, [])]), unscheduledIds: ['p9'] }

    expect(
      planBoard(payload, notes([]), transports()).serverOrder.ideaIds,
    ).toEqual(['idea:p9'])
  })
})

describe('planBoard — notes and times', () => {
  it('keys every note by its draggable id, and prints the time without seconds', () => {
    const { notesByItem } = read(
      {},
      [],
      [
        // As D1 hands it back: seconds included, which the row must not print.
        note('n1', 'd1', 0, {
          time: '18:30:00',
          detail: '## Later\n\nBring the tickets.',
          icon: 'ticket',
        }),
        note('n2', 'd2', 0),
      ],
    )

    expect([...notesByItem.keys()]).toEqual(['note:n1', 'note:n2'])
    expect(notesByItem.get('note:n1')).toEqual({
      id: 'n1',
      dayId: 'd1',
      body: 'Note n1',
      detail: '## Later\n\nBring the tickets.',
      time: '18:30',
      icon: 'ticket',
    })
  })

  it('reads a stop at its start time and an untimed item at none', () => {
    const { timeOfItem } = read(
      { d1: stops([0, 1], ['09:00:00', null]) },
      [],
      [note('n1', 'd1', 2, { time: '13:15:00' }), note('n2', 'd1', 3)],
    )

    expect(
      ['a1', 'a2', 'note:n1', 'note:n2'].map((id) => timeOfItem(id)),
    ).toEqual(['09:00', null, '13:15', null])
  })

  /**
   * The clock rule compares instants, and a one-day journey *renders* a range — so the lookup the
   * merge and the move guard read is built from the payload, never from the rendered row.
   */
  it('gives each end of a journey its own instant, and a crossed day none', () => {
    const { timeOfItem } = read({}, [
      journey('j1', {
        arrivalDayId: 'd3',
        departureTime: '22:10',
        arrivalTime: '06:45',
      }),
      journey('j2', { departureTime: '09:00', arrivalTime: '12:30' }),
    ])

    expect(
      [
        leg('j1'),
        leg('j1', 'd2'),
        leg('j1', 'd3'),
        // One day, one row: the arrival never mints a second entry that would outrank its own
        // departure on the same id.
        leg('j2'),
      ].map((id) => timeOfItem(id)),
    ).toEqual(['22:10', null, '06:45', '09:00'])
  })
})

describe('planBoard — journey rows', () => {
  it('formats each end once, and the range when the journey lands the same day', () => {
    const { transportRows: rows } = read({}, [
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
    ])

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

  /**
   * The overnight flight into a trip's first day, which is how the flagship trip opens: the
   * journey is drawn on the day it leaves from, and printing its arrival clock after its
   * departure clock would read as a flight that lands before it takes off.
   */
  it('shows the departure alone rather than a range that runs backwards', () => {
    const { transportRows: rows } = read({}, [
      journey('j1', { departureTime: '13:20', arrivalTime: '09:35' }),
      journey('j2', { departureTime: '09:00', arrivalTime: '09:00' }),
    ])

    expect(rows.map((row) => row.time)).toEqual(['13:20', '09:00'])
  })
})

describe('planBoard — a Day with journeys', () => {
  const withJourney = (position: number, count = 2) =>
    dayOf(
      read({ d1: stops(Array.from({ length: count }, (_, i) => i)) }, [
        journey('j1', { position }),
      ]),
      'd1',
    )

  it('threads a journey into the gap its fraction names', () => {
    expect(withJourney(0.5)).toEqual(['a1', leg('j1'), 'a2'])
  })

  it('puts a journey below zero ahead of every stop', () => {
    expect(withJourney(-0.5)).toEqual([leg('j1'), 'a1', 'a2'])
  })

  it('puts a journey past the last stop last', () => {
    expect(withJourney(9)).toEqual(['a1', 'a2', leg('j1')])
  })

  it('keeps two journeys in one gap in their stored order', () => {
    const result = read({ d1: stops([0, 1]) }, [
      journey('j1', { position: 0.75 }),
      journey('j2', { position: 0.25 }),
    ])

    expect(dayOf(result, 'd1')).toEqual(['a1', leg('j2'), leg('j1'), 'a2'])
  })

  /**
   * `sort_order` defaults to `0`, so this is the resting state of every journey nobody has
   * dragged: it sits behind the stop that opens its day rather than in front of it.
   */
  it('puts a journey whose number equals a stop position after that stop', () => {
    expect(withJourney(1, 3)).toEqual(['a1', 'a2', leg('j1'), 'a3'])
  })

  it('renders a day whose only rows are journeys', () => {
    expect(dayOf(read({}, [journey('j1', { position: 0 })]), 'd1')).toEqual([
      leg('j1'),
    ])
  })

  it('leaves a day with no journeys as its own rows', () => {
    expect(
      dayOf(read({ d1: stops([0, 1]), d2: stops([0]) }, [journey('j1')]), 'd2'),
    ).toEqual(['a1'])
  })

  /**
   * The day's rows are not numbered `0..n-1` between reorders, and the journey's fraction was
   * measured against the numbers the server actually wrote.
   *
   * `schedulePlaceFn` puts a new stop at the midpoint of its neighbours without renumbering the
   * day, so a day of `0, 1` becomes `0, 0.5, 1`. A journey stored at `1.5` belongs behind all
   * three; read against the rows' *ordinals* it would land between the second and the third.
   */
  it('reads the positions the server wrote, not the row ordinals', () => {
    const result = read({ d1: stops([0, 0.5, 1]) }, [
      journey('j1', { position: 1.5 }),
    ])

    expect(dayOf(result, 'd1')).toEqual(['a1', 'a2', 'a3', leg('j1')])
  })

  /**
   * The other direction off `0..n-1`, and the one an ordinal can never express: a stored position
   * below zero.
   *
   * `indexBetween` in `-server/plan.ts` gives a front insert `after − 1`, so scheduling a place
   * ahead of a day numbered `0, 1` stores it at `−1` rather than renumbering the day. The rows then
   * read `−1, 0, 1` while their ordinals read `0, 1, 2`, and a journey stored at `0.5` belongs
   * between the second and the third — where the ordinals would put it after all three.
   */
  it('reads a position the server wrote below zero', () => {
    const result = read({ d1: stops([-1, 0, 1]) }, [
      journey('j1', { position: 0.5 }),
    ])

    expect(dayOf(result, 'd1')).toEqual(['a1', 'a2', leg('j1'), 'a3'])
  })

  it('places a journey among notes on the same number line', () => {
    const result = read(
      { d1: stops([0]) },
      [journey('j1', { position: 9 })],
      [note('n1', 'd1', 1)],
    )

    expect(dayOf(result, 'd1')).toEqual(['a1', 'note:n1', leg('j1')])
  })

  describe('a journey that spans the days between its ends', () => {
    const result = read(
      {
        d1: stops([0, 1]),
        d2: [stop('b1', 'pb1', 0)],
        d3: [stop('a3', 'p3', 0, '08:00'), stop('a4', 'p4', 1, '10:00')],
      },
      [
        journey('j1', {
          arrivalDayId: 'd3',
          departureTime: '22:10',
          arrivalTime: '06:45',
          position: 0.5,
        }),
      ],
    )

    /** A crossed day is not the day the number was measured against, so it opens the day. */
    it('opens a crossed day with the travelling row', () => {
      expect(dayOf(result, 'd2')).toEqual([leg('j1', 'd2'), 'b1'])
    })

    /** The arrival has a clock of its own, and a time outranks a position. */
    it('places the arriving row by its arrival time', () => {
      expect(dayOf(result, 'd3')).toEqual([leg('j1', 'd3'), 'a3', 'a4'])
    })

    it('still places the departing row by its stored fraction', () => {
      expect(dayOf(result, 'd1')).toEqual(['a1', leg('j1'), 'a2'])
    })
  })
})

describe('planBoard — the model of an arrangement', () => {
  const t = ((key: string) => key) as never

  it('draws the journeys the arrangement names, and keeps them off the route line', () => {
    const result = read({ d1: stops([0, 1]) }, [
      journey('j1', { position: 0.5 }),
    ])
    const model = result.model(result.serverOrder, t)

    expect(
      model.days[0].items.map((item) => {
        if (item.kind === 'transport') return item.transport.itemId
        if (item.kind === 'note') return item.note.id
        return item.row.itemId
      }),
    ).toEqual(['a1', leg('j1'), 'a2'])
    expect(model.days[0].rows.map((row) => row.itemId)).toEqual(['a1', 'a2'])
  })

  it('draws an optimistic arrangement the same way, journeys where it puts them', () => {
    const result = read({ d1: stops([0, 1]) }, [
      journey('j1', { position: 0.5 }),
    ])
    const model = result.model(
      {
        ...result.serverOrder,
        days: [{ dayId: 'd1', itemIds: [leg('j1'), 'a2', 'a1'] }],
      },
      t,
    )

    expect(model.days[0].rows.map((row) => row.itemId)).toEqual(['a2', 'a1'])
    expect(model.days[0].items[0].kind).toBe('transport')
  })
})
