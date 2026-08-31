import { describe, expect, it } from 'vitest'

import { groupBookingsByDate } from '../grouping'

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
