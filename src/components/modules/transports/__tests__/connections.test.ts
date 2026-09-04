import { describe, expect, it } from 'vitest'

import {
  analyseConnections,
  formatGap,
  transportArrivalAt,
  transportDepartureAt,
  transportTimingError,
  minimumConnectionMinutes,
  sortTransportsByDeparture,
  summariseConnections,
} from '../connections'

import type { TransportLike } from '../connections'

function transport(
  overrides: Partial<TransportLike> & { id: string },
): TransportLike {
  return {
    title: `Transport ${overrides.id}`,
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

describe('transportDepartureAt / transportArrivalAt', () => {
  it('reads a date and time as a wall-clock instant', () => {
    const at = transportDepartureAt(
      transport({
        id: 'a',
        departureDate: '2026-04-16',
        departureTime: '10:30',
      }),
    )
    expect(at).toBe(Date.parse('2026-04-16T10:30:00.000Z'))
  })

  it('treats a missing time as the start of the day', () => {
    const at = transportDepartureAt(
      transport({ id: 'a', departureDate: '2026-04-16' }),
    )
    expect(at).toBe(Date.parse('2026-04-16T00:00:00.000Z'))
  })

  it('returns null without a date', () => {
    expect(
      transportDepartureAt(transport({ id: 'a', departureTime: '10:30' })),
    ).toBeNull()
    expect(transportArrivalAt(transport({ id: 'a' }))).toBeNull()
  })

  it('returns null for a malformed date rather than an invalid instant', () => {
    expect(
      transportDepartureAt(transport({ id: 'a', departureDate: '16/04/2026' })),
    ).toBeNull()
  })
})

describe('sortTransportsByDeparture', () => {
  it('puts dated transports in departure order', () => {
    const ordered = sortTransportsByDeparture([
      transport({
        id: 'later',
        departureDate: '2026-04-18',
        departureTime: '09:00',
      }),
      transport({
        id: 'earlier',
        departureDate: '2026-04-16',
        departureTime: '09:00',
      }),
    ])
    expect(ordered.map((entry) => entry.id)).toEqual(['earlier', 'later'])
  })

  it('sorts same-day transports by time', () => {
    const ordered = sortTransportsByDeparture([
      transport({
        id: 'pm',
        departureDate: '2026-04-16',
        departureTime: '18:00',
      }),
      transport({
        id: 'am',
        departureDate: '2026-04-16',
        departureTime: '08:00',
      }),
    ])
    expect(ordered.map((entry) => entry.id)).toEqual(['am', 'pm'])
  })

  it('keeps undated transports last, in the order they arrived', () => {
    const ordered = sortTransportsByDeparture([
      transport({ id: 'idea-1' }),
      transport({ id: 'dated', departureDate: '2026-04-16' }),
      transport({ id: 'idea-2' }),
    ])
    expect(ordered.map((entry) => entry.id)).toEqual([
      'dated',
      'idea-1',
      'idea-2',
    ])
  })

  it('is stable for two transports departing at the same instant', () => {
    const ordered = sortTransportsByDeparture([
      transport({
        id: 'first',
        departureDate: '2026-04-16',
        departureTime: '08:00',
      }),
      transport({
        id: 'second',
        departureDate: '2026-04-16',
        departureTime: '08:00',
      }),
    ])
    expect(ordered.map((entry) => entry.id)).toEqual(['first', 'second'])
  })

  it('does not mutate the input', () => {
    const transports = [
      transport({ id: 'b', departureDate: '2026-04-18' }),
      transport({ id: 'a', departureDate: '2026-04-16' }),
    ]
    sortTransportsByDeparture(transports)
    expect(transports.map((entry) => entry.id)).toEqual(['b', 'a'])
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
  const landsAtNoon = transport({
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
      transport({
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
      transport({
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
      transport({
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
      transport({
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

  it('notices when the next transport leaves from somewhere else', () => {
    const [connection] = analyseConnections([
      landsAtNoon,
      transport({
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
      transport({
        id: 'a',
        arrivalName: 'Hakone-Yumoto',
        arrivalDate: '2026-04-17',
        arrivalTime: '10:00',
        departureDate: '2026-04-17',
        departureTime: '08:00',
      }),
      transport({
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
      transport({
        id: 'a',
        departureDate: '2026-04-17',
        departureTime: '08:00',
        arrivalDate: '2026-04-17',
        arrivalTime: '10:00',
      }),
      transport({
        id: 'b',
        departureDate: '2026-04-17',
        departureTime: '12:00',
      }),
    ])

    expect(connection.placeMismatch).toBe(false)
  })

  it('falls back to the departure instant when a transport records no arrival', () => {
    const [connection] = analyseConnections([
      transport({
        id: 'a',
        departureDate: '2026-04-16',
        departureTime: '08:00',
      }),
      transport({
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
      transport({
        id: 'a',
        departureDate: '2026-04-16',
        departureTime: '08:00',
      }),
      transport({ id: 'b' }),
    ])

    expect(connection.severity).toBe('unknown')
    expect(connection.gapMinutes).toBeNull()
  })

  it('produces one fewer entry than there are transports', () => {
    const transports = [
      transport({ id: 'a', departureDate: '2026-04-16' }),
      transport({ id: 'b', departureDate: '2026-04-17' }),
      transport({ id: 'c', departureDate: '2026-04-18' }),
    ]
    expect(analyseConnections(transports)).toHaveLength(2)
  })

  it('returns nothing for zero or one transport', () => {
    expect(analyseConnections([])).toEqual([])
    expect(analyseConnections([transport({ id: 'only' })])).toEqual([])
  })

  it('analyses in travel order even when the input is not sorted', () => {
    const connections = analyseConnections([
      transport({
        id: 'second',
        departureDate: '2026-04-17',
        departureTime: '09:00',
      }),
      transport({
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
        transport({
          id: 'a',
          mode: 'flight',
          departureDate: '2026-04-16',
          departureTime: '08:00',
          arrivalCode: 'HND',
          arrivalDate: '2026-04-16',
          arrivalTime: '12:00',
        }),
        transport({
          id: 'b',
          mode: 'flight',
          departureCode: 'NRT',
          departureDate: '2026-04-16',
          departureTime: '12:30',
          arrivalDate: '2026-04-16',
          arrivalTime: '14:00',
        }),
        transport({
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

describe('transportTimingError', () => {
  it('accepts a transport that arrives after it departs', () => {
    expect(
      transportTimingError({
        departureDate: '2026-04-16',
        departureTime: '08:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '12:00',
      }),
    ).toBeNull()
  })

  it('rejects a transport that arrives before it departs', () => {
    expect(
      transportTimingError({
        departureDate: '2026-04-16',
        departureTime: '12:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '08:00',
      }),
    ).toBe('modules.transports.error.arrivesBeforeDeparts')
  })

  it('stays quiet while a date is still blank', () => {
    expect(
      transportTimingError({
        departureDate: '',
        departureTime: '12:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '08:00',
      }),
    ).toBeNull()
  })

  it('reads a blank arrival time as the end of the day, so a same-day transport passes', () => {
    expect(
      transportTimingError({
        departureDate: '2026-04-16',
        departureTime: '18:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '',
      }),
    ).toBeNull()
  })

  it('still rejects an arrival date before the departure date', () => {
    expect(
      transportTimingError({
        departureDate: '2026-04-18',
        departureTime: '',
        arrivalDate: '2026-04-16',
        arrivalTime: '',
      }),
    ).toBe('modules.transports.error.arrivesBeforeDeparts')
  })
})
