import { describe, expect, it } from 'vitest'

import { legDurationMinutes, legElapsedMinutes } from '../leg-timing'

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

describe('legElapsedMinutes', () => {
  /**
   * The eastbound case that reads plausibly and is still wrong.
   *
   * 10:00 in London is 09:00Z; 13:00 in New York is 17:00Z. Eight hours in the air, and the
   * subtraction of the two wall clocks says three - short by exactly the five hours between the
   * two zones, in the one label whose entire purpose is to correct for them.
   */
  it('measures a westward flight across five zones', () => {
    expect(
      legElapsedMinutes(
        {
          departureDate: '2026-04-16',
          departureTime: '10:00',
          arrivalDate: '2026-04-16',
          arrivalTime: '13:00',
        },
        { from: 'Europe/London', to: 'America/New_York' },
      ),
    ).toBe(480)
  })

  /**
   * And the case the naive subtraction does not merely mis-measure but loses. Arriving at a clock
   * reading *earlier* than the one departed makes `legDurationMinutes` answer `null`, so the hint
   * disappears for precisely the journeys it exists to explain.
   */
  it('measures a flight that lands before the clock it left', () => {
    const leg = {
      departureDate: '2026-04-16',
      departureTime: '09:00',
      arrivalDate: '2026-04-16',
      arrivalTime: '08:00',
    }

    expect(legDurationMinutes(leg)).toBeNull()
    expect(
      legElapsedMinutes(leg, {
        from: 'Europe/London',
        to: 'America/New_York',
      }),
    ).toBe(240)
  })

  /** Eastward, where the clock jumps forward and the naive reading overstates the flight. */
  it('measures a short hop east', () => {
    const leg = {
      departureDate: '2026-04-16',
      departureTime: '09:00',
      arrivalDate: '2026-04-16',
      arrivalTime: '11:00',
    }

    expect(legDurationMinutes(leg)).toBe(120)
    expect(
      legElapsedMinutes(leg, { from: 'Asia/Shanghai', to: 'Asia/Seoul' }),
    ).toBe(60)
  })

  it('agrees with the naive reading when both ends share a clock', () => {
    const leg = {
      departureDate: '2026-04-16',
      departureTime: '08:00',
      arrivalDate: '2026-04-16',
      arrivalTime: '12:30',
    }

    expect(
      legElapsedMinutes(leg, { from: 'Europe/Warsaw', to: 'Europe/Warsaw' }),
    ).toBe(legDurationMinutes(leg))
  })

  /**
   * Each end is read on its own date, so a leg that straddles a switch is measured across it. The
   * EU moves to summer time on 29 March 2026; a Warsaw departure the night before is on `+01:00`
   * and the Warsaw arrival the morning after is on `+02:00`, which is what makes the wall clocks
   * say eight hours for a journey of seven.
   */
  it('measures across a daylight-saving switch', () => {
    expect(
      legElapsedMinutes(
        {
          departureDate: '2026-03-28',
          departureTime: '23:00',
          arrivalDate: '2026-03-29',
          arrivalTime: '07:00',
        },
        { from: 'Europe/Warsaw', to: 'Europe/Warsaw' },
      ),
    ).toBe(420)
  })

  it('says nothing while either end names no clock', () => {
    const leg = {
      departureDate: '2026-04-16',
      departureTime: '10:00',
      arrivalDate: '2026-04-16',
      arrivalTime: '13:00',
    }

    expect(
      legElapsedMinutes(leg, { from: '', to: 'America/New_York' }),
    ).toBeNull()
    expect(
      legElapsedMinutes(leg, { from: 'Europe/London', to: '  ' }),
    ).toBeNull()
  })

  it('says nothing for a leg that truly arrives before it departs', () => {
    expect(
      legElapsedMinutes(
        {
          departureDate: '2026-04-16',
          departureTime: '13:00',
          arrivalDate: '2026-04-16',
          arrivalTime: '10:00',
        },
        { from: 'America/New_York', to: 'Europe/London' },
      ),
    ).toBeNull()
  })
})
