import { describe, expect, it } from 'vitest'

import {
  BOOKING_TYPES,
  bookingShape,
  bookingTypeLabel,
  emptyBookingDraft,
  formatMinorForInput,
  hasBookingErrors,
  isBookingStatus,
  isBookingType,
  minorUnitDigits,
  parseMoneyToMinor,
  showsField,
  validateBookingDraft,
} from '../booking-form'

import type { BookingDraft } from '../booking-form'

function draft(overrides: Partial<BookingDraft> = {}): BookingDraft {
  return { ...emptyBookingDraft('EUR'), title: 'Hotel Gracery', ...overrides }
}

describe('type guards', () => {
  it('accepts the types and statuses the schema stores', () => {
    expect(isBookingType('accommodation')).toBe(true)
    expect(isBookingType('spaceship')).toBe(false)
    expect(isBookingStatus('confirmed')).toBe(true)
    expect(isBookingStatus('maybe')).toBe(false)
  })

  it('labels an unrecognised type rather than crashing on it', () => {
    expect(bookingTypeLabel('accommodation')).toBe(
      'shell.bookingType.accommodation',
    )
    expect(bookingTypeLabel('nonsense')).toBe('shell.bookingType.other')
  })
})

describe('per-type shapes', () => {
  it('gives every type a shape', () => {
    for (const type of BOOKING_TYPES) {
      const shape = bookingShape(type)
      expect(shape.label.length).toBeGreaterThan(0)
      expect(shape.fields.length).toBeGreaterThan(0)
      expect(shape.hint.length).toBeGreaterThan(0)
    }
  })

  it('only requires fields the type actually shows', () => {
    for (const type of BOOKING_TYPES) {
      const shape = bookingShape(type)
      for (const field of shape.required) {
        expect(shape.fields).toContain(field)
      }
    }
  })

  it('shows a stay its check-out date and a ticket no end date', () => {
    expect(showsField('accommodation', 'endDate')).toBe(true)
    expect(showsField('ticket', 'endDate')).toBe(false)
  })

  it('does not ask a travel booking how many guests', () => {
    expect(showsField('transport', 'guests')).toBe(false)
    expect(showsField('restaurant', 'guests')).toBe(true)
  })

  it('names the provider field after the thing being booked', () => {
    expect(bookingShape('accommodation').providerLabel).toBe(
      'modules.book.field.host',
    )
    expect(bookingShape('restaurant').providerLabel).toBe(
      'modules.book.field.restaurant',
    )
    expect(bookingShape('transport').providerLabel).toBe(
      'modules.book.field.carrier',
    )
  })
})

describe('minorUnitDigits', () => {
  it('knows a two-decimal currency', () => {
    expect(minorUnitDigits('EUR')).toBe(2)
    expect(minorUnitDigits('GBP')).toBe(2)
  })

  it('knows a zero-decimal currency', () => {
    expect(minorUnitDigits('JPY')).toBe(0)
  })

  it('falls back to two for anything unusable', () => {
    expect(minorUnitDigits('')).toBe(2)
    expect(minorUnitDigits('not-a-code')).toBe(2)
  })
})

describe('parseMoneyToMinor', () => {
  it('reads a plain decimal', () => {
    expect(parseMoneyToMinor('12.50', 'EUR')).toBe(1250)
  })

  it('reads a comma as a decimal point', () => {
    expect(parseMoneyToMinor('12,50', 'EUR')).toBe(1250)
  })

  it('reads a dot-grouped, comma-decimal amount', () => {
    expect(parseMoneyToMinor('1.250,50', 'EUR')).toBe(125050)
  })

  it('reads a comma-grouped, dot-decimal amount', () => {
    expect(parseMoneyToMinor('1,250.50', 'EUR')).toBe(125050)
  })

  it('reads a space-grouped amount', () => {
    expect(parseMoneyToMinor('1 250,50', 'EUR')).toBe(125050)
  })

  it('reads a lone comma with three digits after it as grouping', () => {
    expect(parseMoneyToMinor('1,250', 'EUR')).toBe(125000)
  })

  it('reads a lone dot as the decimal point, in the locale the app is set in', () => {
    expect(parseMoneyToMinor('1.250', 'EUR')).toBe(125)
    expect(parseMoneyToMinor('19.99', 'EUR')).toBe(1999)
  })

  it('rejects two dots, which cannot be one amount', () => {
    expect(parseMoneyToMinor('1.250.50', 'EUR')).toBeNull()
  })

  it('scales a zero-decimal currency without dividing by a hundred', () => {
    expect(parseMoneyToMinor('7490', 'JPY')).toBe(7490)
  })

  it('reads an empty field as zero, which the caller renders as not recorded', () => {
    expect(parseMoneyToMinor('', 'EUR')).toBe(0)
    expect(parseMoneyToMinor('   ', 'EUR')).toBe(0)
  })

  it('rejects text that is not an amount', () => {
    expect(parseMoneyToMinor('about fifty', 'EUR')).toBeNull()
    expect(parseMoneyToMinor('€50', 'EUR')).toBeNull()
    expect(parseMoneyToMinor('-10', 'EUR')).toBeNull()
    expect(parseMoneyToMinor('.', 'EUR')).toBeNull()
  })

  it('rounds rather than truncating a third decimal', () => {
    expect(parseMoneyToMinor('10.005', 'EUR')).toBe(1001)
  })
})

describe('formatMinorForInput', () => {
  it('round-trips a two-decimal amount', () => {
    expect(formatMinorForInput(125050, 'EUR')).toBe('1250.50')
    expect(parseMoneyToMinor(formatMinorForInput(125050, 'EUR'), 'EUR')).toBe(
      125050,
    )
  })

  it('round-trips a zero-decimal amount', () => {
    expect(formatMinorForInput(7490, 'JPY')).toBe('7490')
  })

  it('renders nothing for an unrecorded price', () => {
    expect(formatMinorForInput(null, 'EUR')).toBe('')
    expect(formatMinorForInput(0, 'EUR')).toBe('')
  })
})

describe('validateBookingDraft', () => {
  it('accepts a complete stay', () => {
    const errors = validateBookingDraft(
      draft({ startDate: '2026-04-16', endDate: '2026-04-19' }),
    )
    expect(hasBookingErrors(errors)).toBe(false)
  })

  it('insists on a title', () => {
    const errors = validateBookingDraft(draft({ title: '   ' }))
    expect(errors.title).toBeDefined()
  })

  it('insists on the date a stay starts', () => {
    const errors = validateBookingDraft(draft({ type: 'accommodation' }))
    expect(errors.startDate).toBeDefined()
  })

  it('insists on the time a table is held', () => {
    const errors = validateBookingDraft(
      draft({ type: 'restaurant', startDate: '2026-04-16' }),
    )
    expect(errors.startTime).toBeDefined()
  })

  it('asks nothing extra of an "other" booking', () => {
    const errors = validateBookingDraft(draft({ type: 'other' }))
    expect(hasBookingErrors(errors)).toBe(false)
  })

  it('refuses a time with no date to sit on', () => {
    const errors = validateBookingDraft(
      draft({ type: 'other', startTime: '19:30' }),
    )
    expect(errors.startDate).toBeDefined()
  })

  it('refuses an end date before the start date', () => {
    const errors = validateBookingDraft(
      draft({ startDate: '2026-04-19', endDate: '2026-04-16' }),
    )
    expect(errors.endDate?.key).toBe('modules.book.error.endsBeforeStart')
  })

  it('refuses an end time before the start time on the same day', () => {
    const errors = validateBookingDraft(
      draft({
        type: 'restaurant',
        startDate: '2026-04-16',
        startTime: '20:00',
        endDate: '2026-04-16',
        endTime: '18:00',
      }),
    )
    expect(errors.endTime?.key).toBe('modules.book.error.endTimeBeforeStart')
  })

  it('accepts an end time earlier in the clock on a later day', () => {
    const errors = validateBookingDraft(
      draft({
        startDate: '2026-04-16',
        startTime: '20:00',
        endDate: '2026-04-17',
        endTime: '10:00',
      }),
    )
    expect(errors.endTime).toBeUndefined()
    expect(errors.endDate).toBeUndefined()
  })

  it('refuses a guest count that is not a whole number in range', () => {
    expect(
      validateBookingDraft(
        draft({
          type: 'restaurant',
          startDate: '2026-04-16',
          startTime: '19:00',
          guests: '2.5',
        }),
      ).guests,
    ).toBeDefined()
    expect(
      validateBookingDraft(
        draft({
          type: 'restaurant',
          startDate: '2026-04-16',
          startTime: '19:00',
          guests: '99999',
        }),
      ).guests,
    ).toBeDefined()
    expect(
      validateBookingDraft(
        draft({
          type: 'restaurant',
          startDate: '2026-04-16',
          startTime: '19:00',
          guests: '4',
        }),
      ).guests,
    ).toBeUndefined()
  })

  it('refuses a price it cannot read', () => {
    const errors = validateBookingDraft(
      draft({ startDate: '2026-04-16', price: 'about a hundred' }),
    )
    expect(errors.price).toBeDefined()
  })

  it('refuses a link that is not http(s)', () => {
    expect(
      validateBookingDraft(
        draft({ startDate: '2026-04-16', url: 'booking.com/abc' }),
      ).url,
    ).toBeDefined()
    expect(
      validateBookingDraft(
        draft({ startDate: '2026-04-16', url: 'https://booking.com/abc' }),
      ).url,
    ).toBeUndefined()
  })

  it('refuses a confirmation number too long for the column', () => {
    const errors = validateBookingDraft(
      draft({ startDate: '2026-04-16', confirmationNumber: 'X'.repeat(240) }),
    )
    expect(errors.confirmationNumber).toBeDefined()
  })

  it('reports every problem at once rather than one at a time', () => {
    const errors = validateBookingDraft(
      draft({
        title: '',
        type: 'restaurant',
        url: 'nope',
        price: 'free-ish',
      }),
    )
    expect(Object.keys(errors).sort()).toEqual([
      'price',
      'startDate',
      'startTime',
      'title',
      'url',
    ])
  })
})
