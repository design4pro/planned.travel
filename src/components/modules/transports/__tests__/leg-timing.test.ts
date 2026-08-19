import { describe, expect, it } from 'vitest'

import { legDurationMinutes } from '../leg-timing'

describe('legDurationMinutes', () => {
  it('measures a same-day leg', () => {
    expect(
      legDurationMinutes({
        departureDate: '2026-04-16',
        departureTime: '08:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '12:30',
      }),
    ).toBe(270)
  })

  it('measures an overnight leg', () => {
    expect(
      legDurationMinutes({
        departureDate: '2026-04-16',
        departureTime: '22:00',
        arrivalDate: '2026-04-17',
        arrivalTime: '06:30',
      }),
    ).toBe(510)
  })

  it('reads a missing time as the start of its day', () => {
    expect(
      legDurationMinutes({
        departureDate: '2026-04-16',
        departureTime: '',
        arrivalDate: '2026-04-17',
        arrivalTime: '',
      }),
    ).toBe(1440)
  })

  it('says nothing while either date is still blank', () => {
    expect(
      legDurationMinutes({
        departureDate: '',
        departureTime: '08:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '12:00',
      }),
    ).toBeNull()
    expect(
      legDurationMinutes({
        departureDate: '2026-04-16',
        departureTime: '08:00',
        arrivalDate: '',
        arrivalTime: '',
      }),
    ).toBeNull()
  })

  it('says nothing for a leg that arrives before it departs', () => {
    expect(
      legDurationMinutes({
        departureDate: '2026-04-16',
        departureTime: '12:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '08:00',
      }),
    ).toBeNull()
  })

  it('says nothing for a zero-length leg rather than reporting "0m"', () => {
    expect(
      legDurationMinutes({
        departureDate: '2026-04-16',
        departureTime: '08:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '08:00',
      }),
    ).toBeNull()
  })

  it('says nothing for a malformed date', () => {
    expect(
      legDurationMinutes({
        departureDate: '16/04/2026',
        departureTime: '08:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '12:00',
      }),
    ).toBeNull()
  })
})
