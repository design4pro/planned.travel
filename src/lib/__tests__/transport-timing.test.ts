import { describe, expect, it } from 'vitest'

import {
  DATE_PATTERN,
  TIME_PATTERN,
  arrivesBeforeDeparts,
  elapsedMinutes,
  instantAt,
} from '../transport-timing'

import type { LegClocks, LegZones } from '../transport-timing'

function clocks(
  departureDate: string,
  departureTime: string,
  arrivalDate: string,
  arrivalTime: string,
): LegClocks {
  return { departureDate, departureTime, arrivalDate, arrivalTime }
}

const TOKYO_TO_HONOLULU: LegZones = {
  from: 'Asia/Tokyo',
  to: 'Pacific/Honolulu',
}
const LONDON_TO_NEW_YORK: LegZones = {
  from: 'Europe/London',
  to: 'America/New_York',
}

/**
 * One rule, stated once: the two ends are real instants when both name a zone, and wall clocks
 * otherwise. Every row is a Transport or a Leg as a traveller would type it; the zones are its two
 * stations'.
 */
describe.each<{
  readonly name: string
  readonly clocks: LegClocks
  readonly zones?: LegZones
  readonly inverted: boolean
  readonly minutes: number | null
}>([
  {
    name: 'a same-zone journey in order',
    clocks: clocks('2026-04-16', '08:00', '2026-04-16', '12:30'),
    zones: { from: 'Europe/Warsaw', to: 'Europe/Warsaw' },
    inverted: false,
    minutes: 270,
  },
  {
    name: 'a same-zone journey the wrong way round',
    clocks: clocks('2026-04-16', '12:00', '2026-04-16', '08:00'),
    zones: { from: 'Europe/Warsaw', to: 'Europe/Warsaw' },
    inverted: true,
    minutes: null,
  },
  {
    // 21:00 in Tokyo is 12:00Z; 09:00 in Honolulu is 19:00Z. Seven hours, not a paradox.
    name: 'a westbound flight that lands on an earlier clock',
    clocks: clocks('2026-04-16', '21:00', '2026-04-16', '09:00'),
    zones: TOKYO_TO_HONOLULU,
    inverted: false,
    minutes: 420,
  },
  {
    // 09:00 in London is 08:00Z; 03:00 in New York is 07:00Z. It really does land first.
    name: 'a zoned journey that really is inverted',
    clocks: clocks('2026-04-16', '09:00', '2026-04-16', '03:00'),
    zones: LONDON_TO_NEW_YORK,
    inverted: true,
    minutes: null,
  },
  {
    name: 'an eastbound hop the wall clocks overstate',
    clocks: clocks('2026-04-16', '09:00', '2026-04-16', '11:00'),
    zones: { from: 'Asia/Shanghai', to: 'Asia/Seoul' },
    inverted: false,
    minutes: 60,
  },
  {
    // 09:00 in Honolulu is 19:00Z; 10:00 in Tokyo is 01:00Z. The wall clocks look fine and are not.
    name: 'an eastbound journey whose wall clocks hide an inversion',
    clocks: clocks('2026-04-16', '09:00', '2026-04-16', '10:00'),
    zones: { from: 'Pacific/Honolulu', to: 'Asia/Tokyo' },
    inverted: true,
    minutes: null,
  },
  {
    // The EU moves to summer time on 29 March 2026: +01:00 at departure, +02:00 at arrival.
    name: 'a night train across a daylight-saving switch',
    clocks: clocks('2026-03-28', '23:00', '2026-03-29', '07:00'),
    zones: { from: 'Europe/Warsaw', to: 'Europe/Warsaw' },
    inverted: false,
    minutes: 420,
  },
  {
    name: 'a journey with only its departure zone named',
    clocks: clocks('2026-04-16', '21:00', '2026-04-16', '09:00'),
    zones: { from: 'Asia/Tokyo', to: '' },
    inverted: true,
    minutes: null,
  },
  {
    name: 'a journey with only its arrival zone named',
    clocks: clocks('2026-04-16', '10:00', '2026-04-16', '13:00'),
    zones: { from: null, to: 'America/New_York' },
    inverted: false,
    minutes: 180,
  },
  {
    name: 'a journey naming a zone the platform does not know',
    clocks: clocks('2026-04-16', '21:00', '2026-04-16', '09:00'),
    zones: { from: 'Asia/Tokyo', to: 'Mars/Olympus' },
    inverted: true,
    minutes: null,
  },
  {
    name: 'a journey with no zones at all',
    clocks: clocks('2026-04-16', '22:00', '2026-04-17', '06:30'),
    inverted: false,
    minutes: 510,
  },
  {
    name: 'a same-day journey with no times yet',
    clocks: clocks('2026-04-16', '', '2026-04-16', ''),
    inverted: false,
    minutes: null,
  },
  {
    name: 'a same-day journey with no arrival time yet',
    clocks: clocks('2026-04-16', '18:00', '2026-04-16', ''),
    inverted: false,
    minutes: null,
  },
  {
    name: 'a journey whose dates alone are the wrong way round',
    clocks: clocks('2026-04-18', '', '2026-04-16', ''),
    inverted: true,
    minutes: null,
  },
  {
    name: 'a zoned journey with no times yet',
    clocks: clocks('2026-04-16', '', '2026-04-16', ''),
    zones: TOKYO_TO_HONOLULU,
    inverted: false,
    minutes: 1140,
  },
  {
    name: 'a journey with a blank date',
    clocks: clocks('', '12:00', '2026-04-16', '08:00'),
    inverted: false,
    minutes: null,
  },
  {
    name: 'a journey with a malformed date',
    clocks: clocks('16/04/2026', '12:00', '2026-04-16', '08:00'),
    inverted: false,
    minutes: null,
  },
  {
    name: 'a zero-length journey',
    clocks: clocks('2026-04-16', '08:00', '2026-04-16', '08:00'),
    inverted: false,
    minutes: null,
  },
])('$name', ({ clocks: times, zones, inverted, minutes }) => {
  it(inverted ? 'arrives before it departs' : 'is in order', () => {
    expect(arrivesBeforeDeparts(times, zones)).toBe(inverted)
  })

  it(`takes ${minutes ?? 'no'} minutes`, () => {
    expect(elapsedMinutes(times, zones)).toBe(minutes)
  })
})

describe('arrivesBeforeDeparts on stored rows', () => {
  it('reads a null date as no order to break', () => {
    expect(
      arrivesBeforeDeparts({
        departureDate: '2026-04-16',
        departureTime: '12:00',
        arrivalDate: null,
        arrivalTime: null,
      }),
    ).toBe(false)
  })

  it('reads a null time as the start of the day at departure and the end at arrival', () => {
    expect(
      arrivesBeforeDeparts({
        departureDate: '2026-04-16',
        departureTime: null,
        arrivalDate: '2026-04-16',
        arrivalTime: null,
      }),
    ).toBe(false)
  })
})

describe('instantAt', () => {
  it('reads a wall clock when no zone is named', () => {
    expect(instantAt('2026-04-16', '10:30')).toBe(Date.UTC(2026, 3, 16, 10, 30))
  })

  it('offsets the clock by the zone on its own date', () => {
    expect(instantAt('2026-04-16', '10:30', 'Asia/Tokyo')).toBe(
      Date.UTC(2026, 3, 16, 1, 30),
    )
  })

  it('reads a missing time as the start of the day', () => {
    expect(instantAt('2026-04-16', '')).toBe(Date.UTC(2026, 3, 16))
    expect(instantAt('2026-04-16', null)).toBe(Date.UTC(2026, 3, 16))
  })

  it('answers null for a date it cannot read', () => {
    expect(instantAt('16/04/2026', '10:30')).toBeNull()
    expect(instantAt(null, '10:30')).toBeNull()
  })
})

describe('the date and time patterns', () => {
  it('accept what the forms and the server write', () => {
    expect(DATE_PATTERN.test('2026-04-16')).toBe(true)
    expect(TIME_PATTERN.test('23:59')).toBe(true)
  })

  it('refuse what they do not', () => {
    expect(DATE_PATTERN.test('16/04/2026')).toBe(false)
    expect(TIME_PATTERN.test('24:00')).toBe(false)
    expect(TIME_PATTERN.test('9:00')).toBe(false)
  })
})
