import { afterEach, describe, expect, it, vi } from 'vitest'

import { zonedToUtc } from '../zone'

const iso = (instant: Date | null): string | null =>
  instant === null ? null : instant.toISOString()

describe('zonedToUtc', () => {
  it('turns 09:00 in Asia/Tokyo into midnight UTC', () => {
    expect(iso(zonedToUtc('2026-04-10', '09:00', 'Asia/Tokyo'))).toBe(
      '2026-04-10T00:00:00.000Z',
    )
  })

  it('reads a negative offset', () => {
    expect(iso(zonedToUtc('2026-01-15', '09:00', 'America/New_York'))).toBe(
      '2026-01-15T14:00:00.000Z',
    )
  })

  it('reads a half-hour offset', () => {
    expect(iso(zonedToUtc('2026-04-10', '09:00', 'Asia/Kolkata'))).toBe(
      '2026-04-10T03:30:00.000Z',
    )
  })

  it('reads a bare GMT from longOffset as offset zero', () => {
    expect(iso(zonedToUtc('2026-01-15', '09:00', 'UTC'))).toBe(
      '2026-01-15T09:00:00.000Z',
    )
    // London in winter prints "GMT" with no numeric part.
    expect(iso(zonedToUtc('2026-01-15', '09:00', 'Europe/London'))).toBe(
      '2026-01-15T09:00:00.000Z',
    )
  })

  describe('across a European daylight-saving change', () => {
    it('uses the offset in force on the date', () => {
      expect(iso(zonedToUtc('2026-03-28', '10:00', 'Europe/Warsaw'))).toBe(
        '2026-03-28T09:00:00.000Z',
      )
      expect(iso(zonedToUtc('2026-03-30', '10:00', 'Europe/Warsaw'))).toBe(
        '2026-03-30T08:00:00.000Z',
      )
      expect(iso(zonedToUtc('2026-10-24', '10:00', 'Europe/Warsaw'))).toBe(
        '2026-10-24T08:00:00.000Z',
      )
      expect(iso(zonedToUtc('2026-10-26', '10:00', 'Europe/Warsaw'))).toBe(
        '2026-10-26T09:00:00.000Z',
      )
    })

    it('takes the offset just before the gap for a time that does not exist', () => {
      // 2026-03-29 02:00 -> 03:00 in Warsaw: 02:30 never happens. Before the gap the offset is +01:00.
      expect(iso(zonedToUtc('2026-03-29', '02:30', 'Europe/Warsaw'))).toBe(
        '2026-03-29T01:30:00.000Z',
      )
    })

    it('takes the first occurrence of a time that happens twice', () => {
      // 2026-10-25 03:00 -> 02:00 in Warsaw: 02:30 happens at +02:00 (00:30Z) and again at +01:00.
      expect(iso(zonedToUtc('2026-10-25', '02:30', 'Europe/Warsaw'))).toBe(
        '2026-10-25T00:30:00.000Z',
      )
    })

    it('keeps the times next to the change ordinary', () => {
      expect(iso(zonedToUtc('2026-03-29', '01:59', 'Europe/Warsaw'))).toBe(
        '2026-03-29T00:59:00.000Z',
      )
      expect(iso(zonedToUtc('2026-03-29', '03:00', 'Europe/Warsaw'))).toBe(
        '2026-03-29T01:00:00.000Z',
      )
      expect(iso(zonedToUtc('2026-10-25', '03:00', 'Europe/Warsaw'))).toBe(
        '2026-10-25T02:00:00.000Z',
      )
    })
  })

  it('treats a zone Intl rejects as no zone', () => {
    expect(zonedToUtc('2026-04-10', '09:00', 'Mars/Olympus_Mons')).toBeNull()
    expect(zonedToUtc('2026-04-10', '09:00', '')).toBeNull()
  })

  it('refuses a date or a time that is not one', () => {
    expect(zonedToUtc('tomorrow', '09:00', 'Asia/Tokyo')).toBeNull()
    expect(zonedToUtc('2026-04-10', 'noon', 'Asia/Tokyo')).toBeNull()
  })

  describe('formatter reuse', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('constructs one Intl.DateTimeFormat per zone, not one per call', () => {
      const Real = Intl.DateTimeFormat
      const construct = vi.fn()
      // A class (not an arrow) so `new` works; it defers to the real formatter.
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(function (
        ...args: ConstructorParameters<typeof Real>
      ) {
        construct()
        return new Real(...args)
      } as unknown as typeof Intl.DateTimeFormat)

      for (let day = 1; day <= 20; day += 1) {
        zonedToUtc(
          `2026-05-${String(day).padStart(2, '0')}`,
          '08:00',
          'Australia/Perth',
        )
      }

      expect(construct).toHaveBeenCalledTimes(1)
    })
  })
})
