/**
 * The planner's materialiser.
 *
 * Where a Day's order comes from is `plan-board.test.ts`. `planModel` owes the
 * map a guarantee the type system cannot state — that `PlannerDay.rows` is stops and only stops, because the route line draws every row it
 * is handed and a note has no coordinate to draw.
 */
import { describe, expect, it } from 'vitest'

import { createTranslator } from '#/lib/i18n'
import englishAtlas from '#/lib/i18n/messages/en/atlas'
import polishAtlas from '#/lib/i18n/messages/pl/atlas'
import { planBoard } from '../plan-board'
import { planModel } from '../plan-model'
import {
  board,
  day,
  note,
  notes,
  stop,
  transports,
} from './plan-board-fixtures'

import type { Locale, NamespaceMessages, Translate } from '#/lib/i18n'
import type { PlanNotesPayload } from '../../-server/day-notes'
import type { PlanBoardPayload, PlanBoardStay } from '../../-server/plan'

/**
 * The shipped `atlas` catalogue of one locale, bound the way the screen binds it.
 *
 * Real translations rather than stubs: `atlas.map.pin.day` is the key an untitled
 * day now renders through, and reading it out of `pl` is what proves the rail
 * speaks the reader's language instead of the source one.
 */
function translator(locale: Locale, source: NamespaceMessages) {
  return createTranslator(
    locale,
    Object.fromEntries(
      Object.entries(source).map(([key, message]) => [`atlas.${key}`, message]),
    ),
  )
}

const en = translator('en', englishAtlas)
const pl = translator('pl', polishAtlas)

/** The board as the screen first draws it: the server's own arrangement, no journeys. */
function modelOf(
  payload: PlanBoardPayload,
  noteRows: PlanNotesPayload,
  t: Translate,
  locale?: Locale,
) {
  const read = planBoard(payload, noteRows, transports(), locale)
  return read.model(read.serverOrder, t)
}

describe('planModel', () => {
  const PAYLOAD = board([
    day('d1', 1, [stop('a1', 'p1', 0, '09:00'), stop('a2', 'p2', 2)]),
    day('d2', 2, []),
  ])
  const NOTES = notes([note('n1', 'd1', 1), note('n2', 'd2', 0)])

  function model() {
    return modelOf(PAYLOAD, NOTES, en)
  }

  it('renders each day as one sequence of stops and notes', () => {
    expect(
      model().days.map((entry) =>
        entry.items.map((item) => {
          if (item.kind === 'note') return item.note.id
          if (item.kind === 'transport') return item.transport.itemId
          return item.row.itemId
        }),
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
      planBoard(PAYLOAD, NOTES, transports()).serverOrder,
      en,
      undefined,
      planBoard(PAYLOAD, notes([note('n2', 'd2', 0)]), transports())
        .notesByItem,
    ).days[0]

    expect(day1.items.map((item) => item.kind)).toEqual(['stop', 'stop'])
  })

  /**
   * The rail header, the day section's `aria-label` and the add-note control all
   * read `PlannerDay.title`, so an untitled day naming itself in English was one
   * hardcoded template literal leaking into three accessible names at once.
   */
  describe('an untitled day', () => {
    const EMPTY = notes([])

    const renderedTitle = (
      title: string | null,
      t: Translate,
      locale: Locale,
    ): string => {
      const payload = board([day('d1', 3, [], title)])
      return modelOf(payload, EMPTY, t, locale).days[0].title
    }

    it('names itself from the catalogue, in the language on screen', () => {
      expect(renderedTitle(null, en, 'en')).toBe('Day 3')
      expect(renderedTitle(null, pl, 'pl')).toBe('Dzień 3')
    })

    it('never overrides the title a day carries of its own', () => {
      expect(renderedTitle('Kyoto on foot', pl, 'pl')).toBe('Kyoto on foot')
    })
  })
})

describe('planModel — a stay', () => {
  /** In on day 1, out on day 3, as `getTripItinerary` files it: under every day it covers. */
  const STAY: PlanBoardStay = {
    id: 's1',
    name: 'Hotel Gracery Shinjuku',
    startDayId: 'd1',
    endDayId: 'd3',
    checkInTime: '15:00:00',
    checkInEndTime: '18:00',
    checkOutTime: '11:00',
    reservationId: 'r1',
  }
  const PAYLOAD = board(
    [1, 2, 3].map((n) => ({
      ...day(`d${n}`, n, n === 1 ? [stop('a1', 'p1', 0)] : []),
      stays: [STAY],
    })),
  )
  const EMPTY = notes([])
  const days = modelOf(PAYLOAD, EMPTY, en).days

  it('reaches every day it covers, carrying its days, its times and its booking', () => {
    for (const entry of days) {
      expect(entry.stays).toEqual([
        {
          id: 's1',
          name: 'Hotel Gracery Shinjuku',
          startDayId: 'd1',
          endDayId: 'd3',
          checkIn: '15:00 – 18:00',
          checkOut: '11:00',
          reservationId: 'r1',
        },
      ])
    }
  })

  it('contributes no row to any day’s sequence', () => {
    expect(days.map((entry) => entry.items.length)).toEqual([1, 0, 0])
    expect(days.map((entry) => entry.rows.length)).toEqual([1, 0, 0])
  })
})
