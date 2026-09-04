import { describe, expect, it } from 'vitest'

import {
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  emptyTransportDraft,
  endpointLabels,
  hasTransportErrors,
  isTransportMode,
  isTransportStatus,
  kilometresToMetres,
  metresToKilometres,
  modeLabel,
  suggestTransportTitle,
  transportStatusLabel,
  usesCodes,
  usesSeat,
  usesService,
  validateTransportDraft,
} from '../leg-form'

import type { TransportDraft } from '../leg-form'

function draft(overrides: Partial<TransportDraft> = {}): TransportDraft {
  return {
    ...emptyTransportDraft('EUR'),
    title: 'Flight to Tokyo',
    ...overrides,
  }
}

describe('mode and status vocabulary', () => {
  it('accepts every mode and status the schema stores', () => {
    for (const mode of TRANSPORT_MODES) {
      expect(isTransportMode(mode)).toBe(true)
      expect(modeLabel(mode).length).toBeGreaterThan(0)
    }
    for (const status of TRANSPORT_STATUSES) {
      expect(isTransportStatus(status)).toBe(true)
      expect(transportStatusLabel(status).length).toBeGreaterThan(0)
    }
  })

  it('labels an unknown token rather than rendering it raw', () => {
    expect(modeLabel('hovercraft')).toBe('modules.transports.mode.fallback')
    expect(transportStatusLabel('maybe')).toBe(
      'modules.transports.mode.fallback',
    )
  })

  it('asks for codes only where a traveller would read one off a ticket', () => {
    expect(usesCodes('flight')).toBe(true)
    expect(usesCodes('train')).toBe(true)
    expect(usesCodes('walk')).toBe(false)
    expect(usesCodes('taxi')).toBe(false)
  })

  it('asks for a service number only where services are numbered', () => {
    expect(usesService('flight')).toBe(true)
    expect(usesService('car')).toBe(false)
  })

  it('asks for a seat only where seats are assigned', () => {
    expect(usesSeat('train')).toBe(true)
    expect(usesSeat('ferry')).toBe(false)
  })

  it('names each end of a transport the way the mode does', () => {
    expect(endpointLabels('flight')).toEqual({
      from: 'modules.transports.end.fromAirport',
      to: 'modules.transports.end.toAirport',
    })
    expect(endpointLabels('ferry').from).toContain('port')
    expect(endpointLabels('train').from).toBe(
      'modules.transports.end.fromStation',
    )
    expect(endpointLabels('car')).toEqual({
      from: 'modules.transports.end.from',
      to: 'modules.transports.end.to',
    })
  })
})

describe('suggestTransportTitle', () => {
  it('builds a name from the carrier and both codes', () => {
    expect(
      suggestTransportTitle(
        draft({ carrier: 'SAS', departureCode: 'lhr', arrivalCode: 'hnd' }),
      ),
    ).toEqual({
      key: 'modules.transports.title.fromTo',
      params: { operator: 'SAS', from: 'LHR', to: 'HND' },
      operatorKey: null,
    })
  })

  it('falls back to the mode when there is no carrier', () => {
    expect(
      suggestTransportTitle(
        draft({
          mode: 'train',
          departureName: 'Tokyo',
          arrivalName: 'Kyoto',
        }),
      ),
    ).toEqual({
      key: 'modules.transports.title.fromTo',
      params: { from: 'Tokyo', to: 'Kyoto' },
      operatorKey: 'modules.transports.mode.train',
    })
  })

  it('prefers a code over a name', () => {
    expect(
      suggestTransportTitle(
        draft({
          carrier: 'JR',
          departureName: 'Tokyo Station',
          departureCode: 'TYO',
          arrivalName: 'Kyoto',
        }),
      ),
    ).toEqual({
      key: 'modules.transports.title.fromTo',
      params: { operator: 'JR', from: 'TYO', to: 'Kyoto' },
      operatorKey: null,
    })
  })

  it('copes with only one end filled in', () => {
    expect(
      suggestTransportTitle(draft({ carrier: 'SAS', arrivalCode: 'HND' })),
    ).toEqual({
      key: 'modules.transports.title.to',
      params: { operator: 'SAS', to: 'HND' },
      operatorKey: null,
    })
    expect(
      suggestTransportTitle(draft({ carrier: 'SAS', departureCode: 'LHR' })),
    ).toEqual({
      key: 'modules.transports.title.from',
      params: { operator: 'SAS', from: 'LHR' },
      operatorKey: null,
    })
  })

  it('suggests nothing when neither end is known', () => {
    expect(suggestTransportTitle(draft({ carrier: 'SAS' }))).toBeNull()
  })
})

describe('validateTransportDraft', () => {
  it('accepts a complete transport', () => {
    expect(
      hasTransportErrors(
        validateTransportDraft(
          draft({
            departureCode: 'LHR',
            departureDate: '2026-04-16',
            departureTime: '08:00',
            arrivalCode: 'HND',
            arrivalDate: '2026-04-17',
            arrivalTime: '06:30',
            distanceKm: '9560',
            price: '640.50',
          }),
        ),
      ),
    ).toBe(false)
  })

  it('insists on a name', () => {
    expect(validateTransportDraft(draft({ title: '  ' })).title).toBeDefined()
  })

  it('rejects a name longer than the column', () => {
    expect(
      validateTransportDraft(draft({ title: 'x'.repeat(200) })).title,
    ).toBeDefined()
  })

  it('rejects a malformed date and time', () => {
    const errors = validateTransportDraft(
      draft({ departureDate: '16/04/2026', departureTime: '25:00' }),
    )
    expect(errors.departureDate).toBeDefined()
    expect(errors.departureTime).toBeDefined()
  })

  it('refuses a time with no date to sit on', () => {
    expect(
      validateTransportDraft(draft({ departureTime: '08:00' })).departureDate,
    ).toBe('modules.transports.error.departureNeedsDate')
    expect(
      validateTransportDraft(draft({ arrivalTime: '08:00' })).arrivalDate,
    ).toBe('modules.transports.error.arrivalNeedsDate')
  })

  it('refuses a transport that arrives before it departs', () => {
    expect(
      validateTransportDraft(
        draft({
          departureDate: '2026-04-16',
          departureTime: '12:00',
          arrivalDate: '2026-04-16',
          arrivalTime: '08:00',
        }),
      ).arrivalDate,
    ).toBe('modules.transports.error.arrivesBeforeDeparts')
  })

  it('does not let the ordering message hide a malformed date', () => {
    const errors = validateTransportDraft(
      draft({
        departureDate: '2026-04-16',
        arrivalDate: 'nonsense',
      }),
    )
    expect(errors.arrivalDate).toBe('modules.transports.error.date')
  })

  it('rejects a station code that is not a code', () => {
    expect(
      validateTransportDraft(draft({ departureCode: 'L' })).departureCode,
    ).toBeDefined()
    expect(
      validateTransportDraft(draft({ arrivalCode: 'TOO-LONG-HERE' }))
        .arrivalCode,
    ).toBeDefined()
    expect(
      validateTransportDraft(draft({ departureCode: 'lhr' })).departureCode,
    ).toBeUndefined()
  })

  it('rejects a distance that is not a number of kilometres', () => {
    expect(
      validateTransportDraft(draft({ distanceKm: 'far' })).distanceKm,
    ).toBeDefined()
    expect(
      validateTransportDraft(draft({ distanceKm: '-5' })).distanceKm,
    ).toBeDefined()
    expect(
      validateTransportDraft(draft({ distanceKm: '9,560' })).distanceKm,
    ).toBeUndefined()
  })

  it('rejects a price it cannot read', () => {
    expect(
      validateTransportDraft(draft({ price: 'about 600' })).price,
    ).toBeDefined()
  })

  it('reports every problem at once', () => {
    const errors = validateTransportDraft(
      draft({ title: '', departureCode: 'X', distanceKm: 'far' }),
    )
    expect(Object.keys(errors).sort()).toEqual([
      'departureCode',
      'distanceKm',
      'title',
    ])
  })
})

describe('distance conversion', () => {
  it('converts kilometres to whole metres', () => {
    expect(kilometresToMetres('9560')).toBe(9_560_000)
    expect(kilometresToMetres('12.5')).toBe(12_500)
  })

  it('accepts a comma decimal', () => {
    expect(kilometresToMetres('12,5')).toBe(12_500)
  })

  it('reads an empty or unusable field as nothing recorded', () => {
    expect(kilometresToMetres('')).toBe(0)
    expect(kilometresToMetres('far')).toBe(0)
    expect(kilometresToMetres('-5')).toBe(0)
  })

  it('round-trips through the input format', () => {
    expect(metresToKilometres(kilometresToMetres('12.5'))).toBe('12.5')
    expect(metresToKilometres(kilometresToMetres('450'))).toBe('450')
  })

  it('shows nothing for an unrecorded distance', () => {
    expect(metresToKilometres(null)).toBe('')
    expect(metresToKilometres(0)).toBe('')
  })
})
