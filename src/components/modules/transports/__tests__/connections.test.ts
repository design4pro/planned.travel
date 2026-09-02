import { describe, expect, it } from 'vitest'

import {
  analyseConnections,
  formatGap,
  legArrivalAt,
  legDepartureAt,
  legTimingError,
  minimumConnectionMinutes,
  sortLegsByDeparture,
  summariseConnections,
} from '../connections'

import type { LegLike } from '../connections'

function leg(overrides: Partial<LegLike> & { id: string }): LegLike {
  return {
    title: `Leg ${overrides.id}`,
    mode: 'train',
    departureName: null,
    departureCode: null,
    departureDate: null,
    departureTime: null,
    arrivalName: null,
    arrivalCode: null,
    arrivalDate: null,
    arrivalTime: null,
    ...overrides,
  }
}

describe('formatGap', () => {
  it('renders minutes under an hour', () => {
    expect(formatGap(40)).toBe('40m')
  })

  it('renders hours and minutes', () => {
    expect(formatGap(205)).toBe('3h 25m')
  })

  it('drops the minutes when they are zero', () => {
    expect(formatGap(120)).toBe('2h')
  })

  it('renders days once past twenty-four hours', () => {
    expect(formatGap(1500)).toBe('1d 1h')
    expect(formatGap(2880)).toBe('2d')
  })

  it('reads a negative gap as a magnitude, so callers own the wording', () => {
    expect(formatGap(-45)).toBe('45m')
  })
})

describe('legDepartureAt / legArrivalAt', () => {
  it('reads a date and time as a wall-clock instant', () => {
    const at = legDepartureAt(
      leg({ id: 'a', departureDate: '2026-04-16', departureTime: '10:30' }),
    )
    expect(at).toBe(Date.parse('2026-04-16T10:30:00.000Z'))
  })

  it('treats a missing time as the start of the day', () => {
    const at = legDepartureAt(leg({ id: 'a', departureDate: '2026-04-16' }))
    expect(at).toBe(Date.parse('2026-04-16T00:00:00.000Z'))
  })

  it('returns null without a date', () => {
    expect(legDepartureAt(leg({ id: 'a', departureTime: '10:30' }))).toBeNull()
    expect(legArrivalAt(leg({ id: 'a' }))).toBeNull()
  })

  it('returns null for a malformed date rather than an invalid instant', () => {
    expect(
      legDepartureAt(leg({ id: 'a', departureDate: '16/04/2026' })),
    ).toBeNull()
  })
})

describe('sortLegsByDeparture', () => {
  it('puts dated legs in departure order', () => {
    const ordered = sortLegsByDeparture([
      leg({ id: 'later', departureDate: '2026-04-18', departureTime: '09:00' }),
      leg({
        id: 'earlier',
        departureDate: '2026-04-16',
        departureTime: '09:00',
      }),
    ])
    expect(ordered.map((entry) => entry.id)).toEqual(['earlier', 'later'])
  })

  it('sorts same-day legs by time', () => {
    const ordered = sortLegsByDeparture([
      leg({ id: 'pm', departureDate: '2026-04-16', departureTime: '18:00' }),
      leg({ id: 'am', departureDate: '2026-04-16', departureTime: '08:00' }),
    ])
    expect(ordered.map((entry) => entry.id)).toEqual(['am', 'pm'])
  })

  it('keeps undated legs last, in the order they arrived', () => {
    const ordered = sortLegsByDeparture([
      leg({ id: 'idea-1' }),
      leg({ id: 'dated', departureDate: '2026-04-16' }),
      leg({ id: 'idea-2' }),
    ])
    expect(ordered.map((entry) => entry.id)).toEqual([
      'dated',
      'idea-1',
      'idea-2',
    ])
  })

  it('is stable for two legs departing at the same instant', () => {
    const ordered = sortLegsByDeparture([
      leg({ id: 'first', departureDate: '2026-04-16', departureTime: '08:00' }),
      leg({
        id: 'second',
        departureDate: '2026-04-16',
        departureTime: '08:00',
      }),
    ])
    expect(ordered.map((entry) => entry.id)).toEqual(['first', 'second'])
  })

  it('does not mutate the input', () => {
    const legs = [
      leg({ id: 'b', departureDate: '2026-04-18' }),
      leg({ id: 'a', departureDate: '2026-04-16' }),
    ]
    sortLegsByDeparture(legs)
    expect(legs.map((entry) => entry.id)).toEqual(['b', 'a'])
  })
})

describe('minimumConnectionMinutes', () => {
  it('asks for more time to catch a flight than a tram', () => {
    expect(minimumConnectionMinutes('flight')).toBeGreaterThan(
      minimumConnectionMinutes('tram'),
    )
  })

  it('falls back to a default for an unknown mode', () => {
    expect(minimumConnectionMinutes('hovercraft')).toBe(15)
  })
})

describe('analyseConnections', () => {
  const landsAtNoon = leg({
    id: 'flight',
    title: 'Flight to Tokyo',
    mode: 'flight',
    departureCode: 'LHR',
    departureDate: '2026-04-16',
    departureTime: '08:00',
    arrivalCode: 'HND',
    arrivalName: 'Haneda',
    arrivalDate: '2026-04-16',
    arrivalTime: '12:00',
  })

  it('reports a comfortable gap', () => {
    const [connection] = analyseConnections([
      landsAtNoon,
      leg({
        id: 'train',
        title: 'Train to Kyoto',
        mode: 'train',
        departureCode: 'HND',
        departureDate: '2026-04-16',
        departureTime: '15:25',
      }),
    ])

    expect(connection.severity).toBe('ok')
    expect(connection.gapMinutes).toBe(205)
    expect(connection.headline).toEqual({
      key: 'modules.transports.junction.ok.headline',
      params: { gap: '3h 25m' },
    })
    expect(connection.placeMismatch).toBe(false)
  })

  it('flags a departure before the previous arrival as impossible', () => {
    const [connection] = analyseConnections([
      landsAtNoon,
      leg({
        id: 'train',
        title: 'Train to Kyoto',
        mode: 'train',
        departureCode: 'HND',
        departureDate: '2026-04-16',
        departureTime: '11:00',
      }),
    ])

    expect(connection.severity).toBe('impossible')
    expect(connection.gapMinutes).toBe(-60)
    expect(connection.headline.key).toBe(
      'modules.transports.junction.impossible.headline',
    )
    expect(connection.detail).toEqual({
      key: 'modules.transports.junction.impossible.detail',
      params: { to: 'Train to Kyoto', from: 'Flight to Tokyo' },
    })
  })

  it('flags a gap shorter than the mode needs as tight', () => {
    const [connection] = analyseConnections([
      landsAtNoon,
      leg({
        id: 'onward',
        title: 'Flight to Osaka',
        mode: 'flight',
        departureCode: 'HND',
        departureDate: '2026-04-16',
        departureTime: '13:00',
      }),
    ])

    expect(connection.severity).toBe('tight')
    expect(connection.gapMinutes).toBe(60)
    expect(connection.headline).toEqual({
      key: 'modules.transports.junction.tight.headline',
      params: { gap: '1h' },
    })
  })

  it('accepts the same gap when the onward mode needs less time', () => {
    const [connection] = analyseConnections([
      landsAtNoon,
      leg({
        id: 'metro',
        title: 'Metro into town',
        mode: 'metro',
        departureCode: 'HND',
        departureDate: '2026-04-16',
        departureTime: '13:00',
      }),
    ])

    expect(connection.severity).toBe('ok')
  })

  it('notices when the next leg leaves from somewhere else', () => {
    const [connection] = analyseConnections([
      landsAtNoon,
      leg({
        id: 'train',
        title: 'Train to Kyoto',
        mode: 'train',
        departureCode: 'NRT',
        departureDate: '2026-04-16',
        departureTime: '17:00',
      }),
    ])

    expect(connection.placeMismatch).toBe(true)
    expect(connection.detail).toEqual({
      key: 'modules.transports.junction.ok.detail',
      params: { landing: 'HND', boarding: 'NRT' },
    })
  })

  it('matches endpoints by name when neither carries a code', () => {
    const [connection] = analyseConnections([
      leg({
        id: 'a',
        arrivalName: 'Hakone-Yumoto',
        arrivalDate: '2026-04-17',
        arrivalTime: '10:00',
        departureDate: '2026-04-17',
        departureTime: '08:00',
      }),
      leg({
        id: 'b',
        departureName: 'hakone-yumoto',
        departureDate: '2026-04-17',
        departureTime: '12:00',
      }),
    ])

    expect(connection.placeMismatch).toBe(false)
  })

  it('does not call an unrecorded endpoint a mismatch', () => {
    const [connection] = analyseConnections([
      leg({
        id: 'a',
        departureDate: '2026-04-17',
        departureTime: '08:00',
        arrivalDate: '2026-04-17',
        arrivalTime: '10:00',
      }),
      leg({ id: 'b', departureDate: '2026-04-17', departureTime: '12:00' }),
    ])

    expect(connection.placeMismatch).toBe(false)
  })

  it('falls back to the departure instant when a leg records no arrival', () => {
    const [connection] = analyseConnections([
      leg({ id: 'a', departureDate: '2026-04-16', departureTime: '08:00' }),
      leg({
        id: 'b',
        mode: 'flight',
        departureDate: '2026-04-16',
        departureTime: '08:30',
      }),
    ])

    // Without the fallback there is nothing to subtract and the hand-over would
    // be reported as unknown; with it, the 30 minutes are measured and found
    // short of the 90 a flight needs.
    expect(connection.gapMinutes).toBe(30)
    expect(connection.severity).toBe('tight')
  })

  it('says so when there are no times to compare', () => {
    const [connection] = analyseConnections([
      leg({ id: 'a', departureDate: '2026-04-16', departureTime: '08:00' }),
      leg({ id: 'b' }),
    ])

    expect(connection.severity).toBe('unknown')
    expect(connection.gapMinutes).toBeNull()
  })

  it('produces one fewer entry than there are legs', () => {
    const legs = [
      leg({ id: 'a', departureDate: '2026-04-16' }),
      leg({ id: 'b', departureDate: '2026-04-17' }),
      leg({ id: 'c', departureDate: '2026-04-18' }),
    ]
    expect(analyseConnections(legs)).toHaveLength(2)
  })

  it('returns nothing for zero or one leg', () => {
    expect(analyseConnections([])).toEqual([])
    expect(analyseConnections([leg({ id: 'only' })])).toEqual([])
  })

  it('analyses in travel order even when the input is not sorted', () => {
    const connections = analyseConnections([
      leg({
        id: 'second',
        departureDate: '2026-04-17',
        departureTime: '09:00',
      }),
      leg({
        id: 'first',
        departureDate: '2026-04-16',
        departureTime: '09:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '11:00',
      }),
    ])

    expect(connections[0].fromId).toBe('first')
    expect(connections[0].toId).toBe('second')
  })
})

describe('summariseConnections', () => {
  it('counts each kind of problem', () => {
    const summary = summariseConnections(
      analyseConnections([
        leg({
          id: 'a',
          mode: 'flight',
          departureDate: '2026-04-16',
          departureTime: '08:00',
          arrivalCode: 'HND',
          arrivalDate: '2026-04-16',
          arrivalTime: '12:00',
        }),
        leg({
          id: 'b',
          mode: 'flight',
          departureCode: 'NRT',
          departureDate: '2026-04-16',
          departureTime: '12:30',
          arrivalDate: '2026-04-16',
          arrivalTime: '14:00',
        }),
        leg({
          id: 'c',
          mode: 'train',
          departureDate: '2026-04-16',
          departureTime: '13:00',
        }),
      ]),
    )

    expect(summary.checked).toBe(2)
    expect(summary.tight).toBe(1)
    expect(summary.impossible).toBe(1)
    expect(summary.mismatched).toBe(1)
  })

  it('reports nothing to check for an empty plan', () => {
    expect(summariseConnections([])).toEqual({
      impossible: 0,
      tight: 0,
      mismatched: 0,
      checked: 0,
    })
  })
})

describe('legTimingError', () => {
  it('accepts a leg that arrives after it departs', () => {
    expect(
      legTimingError({
        departureDate: '2026-04-16',
        departureTime: '08:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '12:00',
      }),
    ).toBeNull()
  })

  it('rejects a leg that arrives before it departs', () => {
    expect(
      legTimingError({
        departureDate: '2026-04-16',
        departureTime: '12:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '08:00',
      }),
    ).toBe('modules.transports.error.arrivesBeforeDeparts')
  })

  it('stays quiet while a date is still blank', () => {
    expect(
      legTimingError({
        departureDate: '',
        departureTime: '12:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '08:00',
      }),
    ).toBeNull()
  })

  it('reads a blank arrival time as the end of the day, so a same-day leg passes', () => {
    expect(
      legTimingError({
        departureDate: '2026-04-16',
        departureTime: '18:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '',
      }),
    ).toBeNull()
  })

  it('still rejects an arrival date before the departure date', () => {
    expect(
      legTimingError({
        departureDate: '2026-04-18',
        departureTime: '',
        arrivalDate: '2026-04-16',
        arrivalTime: '',
      }),
    ).toBe('modules.transports.error.arrivesBeforeDeparts')
  })
})
