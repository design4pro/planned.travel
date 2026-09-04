import { describe, expect, it } from 'vitest'

import { transportDurationMinutes } from '../leg-timing'

describe('transportDurationMinutes', () => {
  it('measures a same-day transport', () => {
    expect(
      transportDurationMinutes({
        departureDate: '2026-04-16',
        departureTime: '08:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '12:30',
      }),
    ).toBe(270)
  })

  it('measures an overnight transport', () => {
    expect(
      transportDurationMinutes({
        departureDate: '2026-04-16',
        departureTime: '22:00',
        arrivalDate: '2026-04-17',
        arrivalTime: '06:30',
      }),
    ).toBe(510)
  })

  it('reads a missing time as the start of its day', () => {
    expect(
      transportDurationMinutes({
        departureDate: '2026-04-16',
        departureTime: '',
        arrivalDate: '2026-04-17',
        arrivalTime: '',
      }),
    ).toBe(1440)
  })

  it('says nothing while either date is still blank', () => {
    expect(
      transportDurationMinutes({
        departureDate: '',
        departureTime: '08:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '12:00',
      }),
    ).toBeNull()
    expect(
      transportDurationMinutes({
        departureDate: '2026-04-16',
        departureTime: '08:00',
        arrivalDate: '',
        arrivalTime: '',
      }),
    ).toBeNull()
  })

  it('says nothing for a transport that arrives before it departs', () => {
    expect(
      transportDurationMinutes({
        departureDate: '2026-04-16',
        departureTime: '12:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '08:00',
      }),
    ).toBeNull()
  })

  it('says nothing for a zero-length transport rather than reporting "0m"', () => {
    expect(
      transportDurationMinutes({
        departureDate: '2026-04-16',
        departureTime: '08:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '08:00',
      }),
    ).toBeNull()
  })

  it('says nothing for a malformed date', () => {
    expect(
      transportDurationMinutes({
        departureDate: '16/04/2026',
        departureTime: '08:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '12:00',
      }),
    ).toBeNull()
  })
})
