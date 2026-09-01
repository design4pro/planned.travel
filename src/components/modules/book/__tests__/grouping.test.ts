import { describe, expect, it } from 'vitest'

import { MASK_CHARACTER, maskCode } from '../../shared/masked-code'
import { BOOKING_STATUSES } from '../booking-form'
import {
  countBookingTypes,
  filterBookingsByType,
  groupBookingsByDate,
  partitionBookings,
} from '../grouping'

import type { BookingRow } from '#/server/fns/reservations'

function booking(overrides: Partial<BookingRow> & { id: string }): BookingRow {
  return {
    type: 'accommodation',
    status: 'confirmed',
    title: `Booking ${overrides.id}`,
    provider: null,
    location: null,
    confirmationNumber: null,
    url: null,
    startDate: null,
    startTime: null,
    endDate: null,
    endTime: null,
    guests: null,
    priceMinor: null,
    currency: null,
    notes: null,
    dayId: null,
    assignmentId: null,
    hasLedgerLine: false,
    importedAt: null,
    transportId: null,
    ...overrides,
  }
}

describe('groupBookingsByDate', () => {
  it('groups bookings that share a start date', () => {
    const groups = groupBookingsByDate([
      booking({ id: 'a', startDate: '2026-04-16' }),
      booking({ id: 'b', startDate: '2026-04-16' }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.date).toBe('2026-04-16')
    expect(groups[0]?.bookings.map((row) => row.id)).toEqual(['a', 'b'])
  })

  it('puts the dates in calendar order, whatever order they arrive in', () => {
    const groups = groupBookingsByDate([
      booking({ id: 'late', startDate: '2026-04-19' }),
      booking({ id: 'early', startDate: '2026-04-16' }),
      booking({ id: 'middle', startDate: '2026-04-17' }),
    ])

    expect(groups.map((group) => group.date)).toEqual([
      '2026-04-16',
      '2026-04-17',
      '2026-04-19',
    ])
  })

  it('orders a day’s bookings by time', () => {
    const groups = groupBookingsByDate([
      booking({ id: 'dinner', startDate: '2026-04-16', startTime: '20:00' }),
      booking({ id: 'lunch', startDate: '2026-04-16', startTime: '12:30' }),
    ])

    expect(groups[0]?.bookings.map((row) => row.id)).toEqual([
      'lunch',
      'dinner',
    ])
  })

  it('puts a booking with no time after the timed ones on the same day', () => {
    const groups = groupBookingsByDate([
      booking({ id: 'untimed', startDate: '2026-04-16' }),
      booking({ id: 'timed', startDate: '2026-04-16', startTime: '09:00' }),
    ])

    expect(groups[0]?.bookings.map((row) => row.id)).toEqual([
      'timed',
      'untimed',
    ])
  })

  it('collects undated bookings into one trailing group', () => {
    const groups = groupBookingsByDate([
      booking({ id: 'someday' }),
      booking({ id: 'dated', startDate: '2026-04-16' }),
      booking({ id: 'maybe' }),
    ])

    expect(groups.map((group) => group.date)).toEqual(['2026-04-16', null])
    expect(groups[1]?.bookings.map((row) => row.id)).toEqual([
      'someday',
      'maybe',
    ])
  })

  it('treats a truncated date as undated rather than as its own group', () => {
    const groups = groupBookingsByDate([
      booking({ id: 'a', startDate: '2026' }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]?.date).toBeNull()
  })

  it('produces no groups for no bookings', () => {
    expect(groupBookingsByDate([])).toEqual([])
  })

  it('omits the undated group entirely when everything has a date', () => {
    const groups = groupBookingsByDate([
      booking({ id: 'a', startDate: '2026-04-16' }),
    ])

    expect(groups.map((group) => group.date)).toEqual(['2026-04-16'])
  })
})

describe('partitionBookings', () => {
  it('splits the desk into what is settled and what is still outstanding', () => {
    const groups = partitionBookings([
      booking({ id: 'confirmed', status: 'confirmed' }),
      booking({ id: 'pending', status: 'pending' }),
    ])

    expect(groups.settled.map((row) => row.id)).toEqual(['confirmed'])
    expect(groups.outstanding.map((row) => row.id)).toEqual(['pending'])
  })

  /**
   * The partition claim itself, over every status the column may hold: each
   * booking lands in exactly one group, and the two groups add back up to the
   * set they came from.
   */
  it('puts every status in exactly one of the two groups', () => {
    const bookings = BOOKING_STATUSES.map((status) =>
      booking({ id: status, status }),
    )
    const groups = partitionBookings(bookings)

    const settled = new Set(groups.settled.map((row) => row.id))
    const outstanding = new Set(groups.outstanding.map((row) => row.id))

    expect([...settled].filter((id) => outstanding.has(id))).toEqual([])
    expect(settled.size + outstanding.size).toBe(bookings.length)
  })

  /**
   * `reservations.status` is a `text` column, so a row written by a future
   * version of the product can carry a word this build has never heard of. It
   * is outstanding: an unrecognised status is not evidence that anything was
   * settled.
   */
  it('treats a status it does not know as outstanding', () => {
    const groups = partitionBookings([
      booking({ id: 'mystery', status: 'awaiting-deposit' }),
    ])

    expect(groups.outstanding.map((row) => row.id)).toEqual(['mystery'])
    expect(groups.settled).toEqual([])
  })

  it('keeps the incoming order inside each group', () => {
    const groups = partitionBookings([
      booking({ id: 'second', status: 'confirmed' }),
      booking({ id: 'first', status: 'completed' }),
    ])

    expect(groups.settled.map((row) => row.id)).toEqual(['second', 'first'])
  })

  /**
   * The date grouping runs *inside* each settlement group, so a reader chasing
   * two unconfirmed hotels does not read past nine confirmed ones first — and
   * the contract `groupBookingsByDate` already holds still holds in there.
   */
  it('leaves the date grouping inside a group unchanged', () => {
    const groups = partitionBookings([
      booking({ id: 'late', status: 'pending', startDate: '2026-04-19' }),
      booking({ id: 'undated', status: 'pending' }),
      booking({ id: 'early', status: 'pending', startDate: '2026-04-16' }),
    ])

    expect(
      groupBookingsByDate(groups.outstanding).map((group) => group.date),
    ).toEqual(['2026-04-16', '2026-04-19', null])
  })

  it('answers two empty groups for no bookings', () => {
    expect(partitionBookings([])).toEqual({ settled: [], outstanding: [] })
  })
})

describe('countBookingTypes', () => {
  it('counts only the types this trip actually has, commonest first', () => {
    expect(
      countBookingTypes([
        booking({ id: 'a', type: 'restaurant' }),
        booking({ id: 'b', type: 'accommodation' }),
        booking({ id: 'c', type: 'restaurant' }),
      ]),
    ).toEqual([
      { type: 'restaurant', count: 2 },
      { type: 'accommodation', count: 1 },
    ])
  })

  it('breaks a tie by the order the types are declared in', () => {
    expect(
      countBookingTypes([
        booking({ id: 'a', type: 'other' }),
        booking({ id: 'b', type: 'accommodation' }),
      ]).map((entry) => entry.type),
    ).toEqual(['accommodation', 'other'])
  })

  it('counts nothing for no bookings', () => {
    expect(countBookingTypes([])).toEqual([])
  })
})

describe('filterBookingsByType', () => {
  it('keeps everything when nothing is selected', () => {
    const rows = [booking({ id: 'a' }), booking({ id: 'b', type: 'ticket' })]
    expect(filterBookingsByType(rows, []).map((row) => row.id)).toEqual([
      'a',
      'b',
    ])
  })

  it('keeps the selected kinds, and any of several', () => {
    const rows = [
      booking({ id: 'stay', type: 'accommodation' }),
      booking({ id: 'table', type: 'restaurant' }),
      booking({ id: 'ticket', type: 'ticket' }),
    ]

    expect(
      filterBookingsByType(rows, ['restaurant', 'ticket']).map((row) => row.id),
    ).toEqual(['table', 'ticket'])
  })

  /**
   * The empty state products usually forget: a filter that matches nothing
   * answers with nothing, never with the unfiltered list.
   */
  it('returns an empty list when the filter matches nothing', () => {
    expect(
      filterBookingsByType(
        [booking({ id: 'a', type: 'accommodation' })],
        ['transport'],
      ),
    ).toEqual([])
  })
})

describe('maskCode', () => {
  it('masks a code to its own length, so the shape is kept and the value is not', () => {
    const masked = maskCode('ABC123XYZ')
    expect(masked).toHaveLength(9)
    expect(masked).not.toContain('A')
    expect(masked).toBe(MASK_CHARACTER.repeat(9))
  })

  /**
   * An empty code masks to nothing rather than to a row of dots: a mask over an
   * absent value tells the reader a confirmation number exists when none does.
   */
  it('masks an empty code to nothing at all', () => {
    expect(maskCode('')).toBe('')
    expect(maskCode('   ')).toBe('')
  })

  it('counts characters rather than bytes, so a surrogate pair masks to one', () => {
    expect(maskCode('A🙂B')).toHaveLength(3)
  })
})
