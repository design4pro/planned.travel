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

import { modulesTranslate as t } from '#/lib/i18n/__tests__/modules-translate'

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

  it('names each end of a leg the way the mode does', () => {
    expect(endpointLabels('flight').from).toBe(
      'modules.transports.end.fromAirport',
    )
    expect(endpointLabels('flight').to).toBe('modules.transports.end.toAirport')
    expect(endpointLabels('ferry').from).toBe('modules.transports.end.fromPort')
    expect(endpointLabels('train').from).toBe(
      'modules.transports.end.fromStation',
    )
  })

  /**
   * The hire-car case, which is the whole point of the relabelling: nobody says
   * a car departs. All five keys come from the one function, so the endpoint
   * legend, the day select and the error under them can never drift apart.
   */
  it('describes a hire car as picked up and returned', () => {
    expect(endpointLabels('car')).toEqual({
      from: 'modules.transports.end.pickUp',
      to: 'modules.transports.end.dropOff',
      fromDay: 'modules.transports.end.pickUpDay',
      toDay: 'modules.transports.end.returnDay',
      dayOrder: 'modules.transports.error.returnDayBeforePickUp',
    })
  })

  it('leaves every other mode on departure and arrival', () => {
    for (const mode of TRANSPORT_MODES) {
      if (mode === 'car') {
        continue
      }
      const labels = endpointLabels(mode)
      expect(labels.fromDay).toBe('modules.transports.end.departureDay')
      expect(labels.toDay).toBe('modules.transports.end.arrivalDay')
      expect(labels.dayOrder).toBe(
        'modules.transports.error.arrivalDayBeforeDeparture',
      )
    }
    expect(endpointLabels('hovercraft')).toEqual({
      from: 'modules.transports.end.from',
      to: 'modules.transports.end.to',
      fromDay: 'modules.transports.end.departureDay',
      toDay: 'modules.transports.end.arrivalDay',
      dayOrder: 'modules.transports.error.arrivalDayBeforeDeparture',
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
    ).toBe('modules.transports.error.arrivalDayBeforeDeparture')
  })

  it('says it in the words the mode uses', () => {
    expect(
      validateLegDraft(
        draft({ mode: 'car', departureDayId: 'day-3', arrivalDayId: 'day-1' }),
        DAYS,
      ).arrivalDayId,
    ).toBe('modules.transports.error.returnDayBeforePickUp')
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
    ).toEqual({
      key: 'modules.transports.title.fromTo',
      params: { operator: 'SAS', from: 'LHR', to: 'HND' },
      operatorKey: null,
    })
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
    ).toEqual({
      key: 'modules.transports.title.fromTo',
      params: { from: 'Tokyo', to: 'Kyoto' },
      operatorKey: 'modules.transports.mode.train',
    })
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
    ).toEqual({
      key: 'modules.transports.title.fromTo',
      params: { operator: 'JR', from: 'TYO', to: 'Kyoto' },
      operatorKey: null,
    })
  })

  it('copes with only one end filled in', () => {
    expect(
      suggestLegTitle(draft({ carrier: 'SAS', arrivalCode: 'HND' })),
    ).toEqual({
      key: 'modules.transports.title.to',
      params: { operator: 'SAS', to: 'HND' },
      operatorKey: null,
    })
    expect(
      suggestLegTitle(draft({ carrier: 'SAS', departureCode: 'LHR' })),
    ).toEqual({
      key: 'modules.transports.title.from',
      params: { operator: 'SAS', from: 'LHR' },
      operatorKey: null,
    })
  })

  it('suggests nothing when neither end is known', () => {
    expect(suggestLegTitle(draft({ carrier: 'SAS' }))).toBeNull()
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
    ).toBe('modules.transports.error.departureNeedsDate')
    expect(validateLegDraft(draft({ arrivalTime: '08:00' })).arrivalDate).toBe(
      'modules.transports.error.arrivalNeedsDate',
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
    ).toBe('modules.transports.error.arrivesBeforeDeparts')
  })

  it('does not let the ordering message hide a malformed date', () => {
    const errors = validateLegDraft(
      draft({
        departureDate: '2026-04-16',
        arrivalDate: 'nonsense',
      }),
    )
    expect(errors.arrivalDate).toBe('modules.transports.error.date')
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
      dayLabel(
        { dayNumber: 3, date: '2026-10-09', title: 'Arashiyama' },
        t,
        'en',
      ),
    ).toBe('Day 3 · Arashiyama')
  })

  /**
   * `Fri 9 Oct`, not `2026-10-09`. A stored date is a machine's spelling of a day
   * and this is a label a person reads, so it goes through the same shared
   * formatter the timeline uses — which answers from a CLDR table rather than
   * from the platform's ICU build (`12-verification-protocol.md` §7.2).
   */
  it('writes the date the way a person reads one when a day has no title', () => {
    expect(
      dayLabel({ dayNumber: 3, date: '2026-10-09', title: null }, t, 'en'),
    ).toBe('Day 3 · Fri 9 Oct')
    expect(
      dayLabel({ dayNumber: 3, date: '2026-10-09', title: '' }, t, 'en'),
    ).toBe('Day 3 · Fri 9 Oct')
  })

  it('says the number alone when there is nothing to disambiguate with', () => {
    expect(dayLabel({ dayNumber: 7, date: null, title: null }, t, 'en')).toBe(
      'Day 7',
    )
  })

  it('falls back to the stored date rather than dropping an unreadable one', () => {
    expect(
      dayLabel({ dayNumber: 2, date: 'not-a-date', title: null }, t, 'en'),
    ).toBe('Day 2 · not-a-date')
  })
})
