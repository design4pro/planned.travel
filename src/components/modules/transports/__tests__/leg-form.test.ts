import { describe, expect, it } from 'vitest'

import {
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  emptyLegDraft,
  endpointLabels,
  hasLegErrors,
  isTransportMode,
  isTransportStatus,
  kilometresToMetres,
  metresToKilometres,
  modeLabel,
  suggestLegTitle,
  transportStatusLabel,
  usesCodes,
  usesSeat,
  usesService,
  validateLegDraft,
} from '../leg-form'

import type { LegDraft } from '../leg-form'

function draft(overrides: Partial<LegDraft> = {}): LegDraft {
  return { ...emptyLegDraft('EUR'), title: 'Flight to Tokyo', ...overrides }
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
    expect(modeLabel('hovercraft')).toBe('Leg')
    expect(transportStatusLabel('maybe')).toBe('Leg')
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

  it('names each end of a leg the way the mode does', () => {
    expect(endpointLabels('flight')).toEqual({
      from: 'From airport',
      to: 'To airport',
    })
    expect(endpointLabels('ferry').from).toContain('port')
    expect(endpointLabels('train').from).toContain('station')
    expect(endpointLabels('car')).toEqual({ from: 'From', to: 'To' })
  })
})

describe('suggestLegTitle', () => {
  it('builds a name from the carrier and both codes', () => {
    expect(
      suggestLegTitle(
        draft({ carrier: 'SAS', departureCode: 'lhr', arrivalCode: 'hnd' }),
      ),
    ).toBe('SAS from LHR to HND')
  })

  it('falls back to the mode when there is no carrier', () => {
    expect(
      suggestLegTitle(
        draft({
          mode: 'train',
          departureName: 'Tokyo',
          arrivalName: 'Kyoto',
        }),
      ),
    ).toBe('Train from Tokyo to Kyoto')
  })

  it('prefers a code over a name', () => {
    expect(
      suggestLegTitle(
        draft({
          carrier: 'JR',
          departureName: 'Tokyo Station',
          departureCode: 'TYO',
          arrivalName: 'Kyoto',
        }),
      ),
    ).toBe('JR from TYO to Kyoto')
  })

  it('copes with only one end filled in', () => {
    expect(suggestLegTitle(draft({ carrier: 'SAS', arrivalCode: 'HND' }))).toBe(
      'SAS to HND',
    )
    expect(
      suggestLegTitle(draft({ carrier: 'SAS', departureCode: 'LHR' })),
    ).toBe('SAS from LHR')
  })

  it('suggests nothing when neither end is known', () => {
    expect(suggestLegTitle(draft({ carrier: 'SAS' }))).toBe('')
  })
})

describe('validateLegDraft', () => {
  it('accepts a complete leg', () => {
    expect(
      hasLegErrors(
        validateLegDraft(
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
    expect(validateLegDraft(draft({ title: '  ' })).title).toBeDefined()
  })

  it('rejects a name longer than the column', () => {
    expect(
      validateLegDraft(draft({ title: 'x'.repeat(200) })).title,
    ).toBeDefined()
  })

  it('rejects a malformed date and time', () => {
    const errors = validateLegDraft(
      draft({ departureDate: '16/04/2026', departureTime: '25:00' }),
    )
    expect(errors.departureDate).toBeDefined()
    expect(errors.departureTime).toBeDefined()
  })

  it('refuses a time with no date to sit on', () => {
    expect(
      validateLegDraft(draft({ departureTime: '08:00' })).departureDate,
    ).toBe('A departure time needs the date it is on.')
    expect(validateLegDraft(draft({ arrivalTime: '08:00' })).arrivalDate).toBe(
      'An arrival time needs the date it is on.',
    )
  })

  it('refuses a leg that arrives before it departs', () => {
    expect(
      validateLegDraft(
        draft({
          departureDate: '2026-04-16',
          departureTime: '12:00',
          arrivalDate: '2026-04-16',
          arrivalTime: '08:00',
        }),
      ).arrivalDate,
    ).toBe('This leg arrives before it departs.')
  })

  it('does not let the ordering message hide a malformed date', () => {
    const errors = validateLegDraft(
      draft({
        departureDate: '2026-04-16',
        arrivalDate: 'nonsense',
      }),
    )
    expect(errors.arrivalDate).toBe('A date is written YYYY-MM-DD.')
  })

  it('rejects a station code that is not a code', () => {
    expect(
      validateLegDraft(draft({ departureCode: 'L' })).departureCode,
    ).toBeDefined()
    expect(
      validateLegDraft(draft({ arrivalCode: 'TOO-LONG-HERE' })).arrivalCode,
    ).toBeDefined()
    expect(
      validateLegDraft(draft({ departureCode: 'lhr' })).departureCode,
    ).toBeUndefined()
  })

  it('rejects a distance that is not a number of kilometres', () => {
    expect(
      validateLegDraft(draft({ distanceKm: 'far' })).distanceKm,
    ).toBeDefined()
    expect(
      validateLegDraft(draft({ distanceKm: '-5' })).distanceKm,
    ).toBeDefined()
    expect(
      validateLegDraft(draft({ distanceKm: '9,560' })).distanceKm,
    ).toBeUndefined()
  })

  it('rejects a price it cannot read', () => {
    expect(validateLegDraft(draft({ price: 'about 600' })).price).toBeDefined()
  })

  it('reports every problem at once', () => {
    const errors = validateLegDraft(
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
