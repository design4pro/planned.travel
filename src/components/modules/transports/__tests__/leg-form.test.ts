import { describe, expect, it } from 'vitest'

import {
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  dayLabel,
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
    expect(endpointLabels('flight').from).toBe('From airport')
    expect(endpointLabels('flight').to).toBe('To airport')
    expect(endpointLabels('ferry').from).toContain('port')
    expect(endpointLabels('train').from).toContain('station')
  })

  /**
   * The hire-car case, which is the whole point of the relabelling: nobody says
   * a car departs. All four strings come from the one function, so the endpoint
   * legend and the day select can never drift apart.
   */
  it('describes a hire car as picked up and returned', () => {
    expect(endpointLabels('car')).toEqual({
      from: 'Pick-up',
      to: 'Drop-off',
      fromDay: 'Pick-up day',
      toDay: 'Return day',
    })
  })

  it('leaves every other mode on departure and arrival', () => {
    for (const mode of TRANSPORT_MODES) {
      if (mode === 'car') {
        continue
      }
      const labels = endpointLabels(mode)
      expect(labels.fromDay).toBe('Departure day')
      expect(labels.toDay).toBe('Arrival day')
      expect(labels.from).not.toContain('Pick-up')
      expect(labels.to).not.toContain('Drop-off')
    }
    expect(endpointLabels('hovercraft')).toEqual({
      from: 'From',
      to: 'To',
      fromDay: 'Departure day',
      toDay: 'Arrival day',
    })
  })
})

/**
 * The two day references, which are what this form gained: a journey leaves on
 * one day and lands on another, and nothing derives the second from the first.
 */
describe('the days a transport covers', () => {
  const DAYS = [
    { id: 'day-1', dayNumber: 1 },
    { id: 'day-2', dayNumber: 2 },
    { id: 'day-3', dayNumber: 3 },
  ]

  it('starts a draft with neither day chosen', () => {
    expect(emptyLegDraft('EUR').departureDayId).toBe('')
    expect(emptyLegDraft('EUR').arrivalDayId).toBe('')
  })

  it('accepts a draft with no day at all, because an idea has no day', () => {
    expect(hasLegErrors(validateLegDraft(draft(), DAYS))).toBe(false)
    expect(hasLegErrors(validateLegDraft(draft()))).toBe(false)
  })

  it('accepts a night flight that lands the next day', () => {
    expect(
      validateLegDraft(
        draft({ departureDayId: 'day-2', arrivalDayId: 'day-3' }),
        DAYS,
      ).arrivalDayId,
    ).toBeUndefined()
  })

  it('accepts both ends on the same day', () => {
    expect(
      validateLegDraft(
        draft({ departureDayId: 'day-2', arrivalDayId: 'day-2' }),
        DAYS,
      ).arrivalDayId,
    ).toBeUndefined()
  })

  it('refuses an arrival day earlier than the departure day', () => {
    expect(
      validateLegDraft(
        draft({ departureDayId: 'day-3', arrivalDayId: 'day-1' }),
        DAYS,
      ).arrivalDayId,
    ).toBe('The arrival day comes before the departure day.')
  })

  it('says it in the words the mode uses', () => {
    expect(
      validateLegDraft(
        draft({ mode: 'car', departureDayId: 'day-3', arrivalDayId: 'day-1' }),
        DAYS,
      ).arrivalDayId,
    ).toBe('The return day comes before the pick-up day.')
  })

  it('says nothing about one end chosen without the other', () => {
    expect(
      hasLegErrors(validateLegDraft(draft({ departureDayId: 'day-3' }), DAYS)),
    ).toBe(false)
    expect(
      hasLegErrors(validateLegDraft(draft({ arrivalDayId: 'day-1' }), DAYS)),
    ).toBe(false)
  })

  /**
   * A day id the list does not carry cannot be ordered against anything, and a
   * form that refused it would refuse a draft the reader cannot repair. The
   * repository is the rule; this is the convenience.
   */
  it('ignores a day the list does not know', () => {
    expect(
      hasLegErrors(
        validateLegDraft(
          draft({ departureDayId: 'day-3', arrivalDayId: 'gone' }),
          DAYS,
        ),
      ),
    ).toBe(false)
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

/**
 * What a day is called in the two selects. The day number leads, because that is
 * how a person refers to a day of their own trip; what follows disambiguates it.
 */
describe('naming a day of the trip', () => {
  it('leads with the day number and disambiguates with the title', () => {
    expect(
      dayLabel({ dayNumber: 3, date: '2026-10-09', title: 'Arashiyama' }),
    ).toBe('Day 3 · Arashiyama')
  })

  /**
   * `Fri 9 Oct`, not `2026-10-09`. A stored date is a machine's spelling of a day
   * and this is a label a person reads, so it goes through the same shared
   * formatter the timeline uses — which answers from a CLDR table rather than
   * from the platform's ICU build (`12-verification-protocol.md` §7.2).
   */
  it('writes the date the way a person reads one when a day has no title', () => {
    expect(dayLabel({ dayNumber: 3, date: '2026-10-09', title: null })).toBe(
      'Day 3 · Fri 9 Oct',
    )
    expect(dayLabel({ dayNumber: 3, date: '2026-10-09', title: '' })).toBe(
      'Day 3 · Fri 9 Oct',
    )
  })

  it('says the number alone when there is nothing to disambiguate with', () => {
    expect(dayLabel({ dayNumber: 7, date: null, title: null })).toBe('Day 7')
  })

  it('falls back to the stored date rather than dropping an unreadable one', () => {
    expect(dayLabel({ dayNumber: 2, date: 'not-a-date', title: null })).toBe(
      'Day 2 · not-a-date',
    )
  })
})
