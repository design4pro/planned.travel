/**
 * The stay's rules as the screen applies them: nights counted from day numbers, the word each day of
 * a stay carries, and the order check that refuses a stay before it is sent.
 */
import { describe, expect, it } from 'vitest'

import {
  emptyBookingDraft,
  stayDayWords,
  stayNights,
  stayRange,
  validateBookingDraft,
} from '../booking-form'

import type { BookingDraft, StayDay } from '../booking-form'

const days: ReadonlyArray<StayDay> = [1, 2, 3, 4, 5].map((dayNumber) => ({
  id: `day-${dayNumber}`,
  dayNumber,
}))

function stayDraft(overrides: Partial<BookingDraft> = {}): BookingDraft {
  return {
    ...emptyBookingDraft('JPY'),
    type: 'accommodation',
    title: 'Hotel Gracery Shinjuku',
    startDayId: 'day-1',
    endDayId: 'day-4',
    ...overrides,
  }
}

describe('stayNights', () => {
  it('counts the nights as the difference between the two day numbers', () => {
    expect(stayNights(1, 4)).toBe(3)
    expect(stayNights(2, 3)).toBe(1)
  })

  it('counts a stay that begins and ends on the same day as zero nights', () => {
    expect(stayNights(3, 3)).toBe(0)
  })
})

describe('stayRange', () => {
  it('resolves both days and the nights between them', () => {
    expect(stayRange('day-2', 'day-5', days)).toEqual({
      first: days[1],
      last: days[4],
      nights: 3,
    })
  })

  it('has no range while a day is missing or the order is wrong', () => {
    expect(stayRange('', 'day-2', days)).toBeNull()
    expect(stayRange('day-4', 'day-2', days)).toBeNull()
  })
})

describe('stayDayWords', () => {
  it('says check in on the first day, check out on the last, and nothing in between', () => {
    expect(stayDayWords(1, 1, 4)).toEqual(['checkIn'])
    expect(stayDayWords(2, 1, 4)).toEqual([])
    expect(stayDayWords(3, 1, 4)).toEqual([])
    expect(stayDayWords(4, 1, 4)).toEqual(['checkOut'])
  })

  it('says both on a stay of a single day', () => {
    expect(stayDayWords(2, 2, 2)).toEqual(['checkIn', 'checkOut'])
  })
})

describe('validateBookingDraft for a stay', () => {
  it('accepts a stay on its days with no typed date', () => {
    expect(validateBookingDraft(stayDraft(), { stayDays: days })).toEqual({})
  })

  it('refuses a stay whose last day precedes its first, before it is sent', () => {
    const errors = validateBookingDraft(
      stayDraft({ startDayId: 'day-3', endDayId: 'day-2' }),
      { stayDays: days },
    )
    expect(errors.endDayId?.key).toBe('modules.book.error.endsBeforeStart')
  })

  it('asks for both days', () => {
    const errors = validateBookingDraft(
      stayDraft({ startDayId: '', endDayId: '' }),
      { stayDays: days },
    )
    expect(errors.startDayId?.key).toBe('modules.book.error.required')
    expect(errors.endDayId?.key).toBe('modules.book.error.required')
  })

  it('refuses a check-in window that closes before it opens', () => {
    const errors = validateBookingDraft(
      stayDraft({ startTime: '15:00', checkInEndTime: '14:00' }),
      { stayDays: days },
    )
    expect(errors.checkInEndTime?.key).toBe(
      'modules.book.error.endTimeBeforeStart',
    )
  })

  it('refuses a check-out before the check-in only when both fall on one day', () => {
    const sameDay = stayDraft({
      endDayId: 'day-1',
      startTime: '15:00',
      endTime: '11:00',
    })
    expect(validateBookingDraft(sameDay, { stayDays: days }).endTime?.key).toBe(
      'modules.book.error.endTimeBeforeStart',
    )
    expect(
      validateBookingDraft(
        { ...sameDay, endDayId: 'day-2' },
        { stayDays: days },
      ).endTime,
    ).toBeUndefined()
  })

  it('keeps the typed-date rules for a stay recorded without its days', () => {
    const errors = validateBookingDraft(stayDraft())
    expect(errors.startDate?.key).toBe('modules.book.error.required')
  })
})
