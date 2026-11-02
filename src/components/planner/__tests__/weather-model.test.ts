import { describe, expect, it } from 'vitest'

import {
  badgeModel,
  conditionOf,
  panelModel,
  temperatureIn,
  unitSymbol,
} from '../weather-model'

import type { DayReading, DayWeather } from '#/lib/weather'

const OK = (
  tempMinC: number,
  tempMaxC: number,
  symbol: string | null,
): DayWeather => ({
  dayId: 'd1',
  status: 'ok',
  reading: {
    kind: 'forecast',
    source: 'met-norway',
    tempMinC,
    tempMaxC,
    symbol,
    precipitationMm: null,
    precipitationProbability: null,
    windMs: null,
    slots: null,
  },
})

/** The reading inside an `ok` answer, which the model hands on to the panel unchanged. */
function readingOf(weather: DayWeather): DayReading {
  if (weather.status !== 'ok') throw new Error('Not an ok answer.')
  return weather.reading
}

const READING: DayReading = {
  kind: 'forecast',
  source: 'met-norway',
  tempMinC: 4.2,
  tempMaxC: 11.6,
  symbol: 'rainshowers',
  precipitationMm: 5.1,
  precipitationProbability: 70,
  windMs: 5,
  slots: [
    { from: '00:00', symbol: 'cloudy', tempC: 5.4 },
    { from: '06:00', symbol: 'rain', tempC: 6.2 },
    { from: '12:00', symbol: 'partlycloudy', tempC: 11.6 },
    { from: '18:00', symbol: 'clearsky', tempC: 8.1 },
  ],
}

describe('temperatureIn', () => {
  it('leaves Celsius alone, rounded to a whole degree', () => {
    expect(temperatureIn(18.4, 'metric')).toBe(18)
    expect(temperatureIn(18.5, 'metric')).toBe(19)
    expect(temperatureIn(-3.6, 'metric')).toBe(-4)
  })

  it('converts to Fahrenheit at render, from the metric reading', () => {
    expect(temperatureIn(0, 'imperial')).toBe(32)
    expect(temperatureIn(100, 'imperial')).toBe(212)
    expect(temperatureIn(-40, 'imperial')).toBe(-40)
    expect(temperatureIn(21.5, 'imperial')).toBe(71)
  })

  it('never yields a negative zero', () => {
    expect(Object.is(temperatureIn(-0.2, 'metric'), 0)).toBe(true)
  })
})

describe('unitSymbol', () => {
  it('is the scale the reader’s distance unit implies', () => {
    expect(unitSymbol('metric')).toBe('C')
    expect(unitSymbol('imperial')).toBe('F')
  })
})

describe('conditionOf', () => {
  it.each([
    ['clearsky', 'clear'],
    ['fair', 'fair'],
    ['partlycloudy', 'partlyCloudy'],
    ['cloudy', 'cloudy'],
    ['fog', 'fog'],
    ['lightrain', 'rain'],
    ['rain', 'rain'],
    ['lightrainshowers', 'rain'],
    ['rainshowers', 'rain'],
    ['heavyrain', 'heavyRain'],
    ['heavyrainshowers', 'heavyRain'],
    ['lightsleet', 'sleet'],
    ['sleet', 'sleet'],
    ['heavysleetshowers', 'sleet'],
    ['lightsnow', 'snow'],
    ['snow', 'snow'],
    ['heavysnowshowers', 'snow'],
    ['rainandthunder', 'thunder'],
    ['heavyrainandthunder', 'thunder'],
    ['lightssleetshowersandthunder', 'thunder'],
    ['snowandthunder', 'thunder'],
  ])('groups the provider symbol %s as %s', (symbol, condition) => {
    expect(conditionOf(symbol)).toBe(condition)
  })

  it('is null for a symbol it does not know, and for none', () => {
    expect(conditionOf('dustdevil')).toBeNull()
    expect(conditionOf(null)).toBeNull()
  })
})

describe('badgeModel', () => {
  it('draws nothing for a day with nothing to show', () => {
    expect(badgeModel({ dayId: 'd1', status: 'none' }, 'metric')).toBeNull()
  })

  it('names a day that should have a reading and has none', () => {
    expect(
      badgeModel({ dayId: 'd1', status: 'unavailable' }, 'metric'),
    ).toEqual({ kind: 'unavailable' })
  })

  it('is loading while the answer is not in', () => {
    expect(badgeModel({ status: 'loading' }, 'metric')).toEqual({
      kind: 'loading',
    })
  })

  it('carries the high, the low and the condition in the reader’s unit', () => {
    const weather = OK(4.2, 11.6, 'rainshowers')
    expect(badgeModel(weather, 'metric')).toEqual({
      kind: 'forecast',
      condition: 'rain',
      max: 12,
      min: 4,
      unit: 'C',
      reading: readingOf(weather),
      sun: null,
    })
    expect(badgeModel(weather, 'imperial')).toEqual({
      kind: 'forecast',
      condition: 'rain',
      max: 53,
      min: 40,
      unit: 'F',
      reading: readingOf(weather),
      sun: null,
    })
  })

  it('keeps the temperatures for a day whose symbol is unknown, with no condition', () => {
    const weather = OK(1, 2, null)
    expect(badgeModel(weather, 'metric')).toEqual({
      kind: 'forecast',
      condition: null,
      max: 2,
      min: 1,
      unit: 'C',
      reading: readingOf(weather),
      sun: null,
    })
  })
})

describe('panelModel', () => {
  it('carries every figure of the reading in the reader’s unit', () => {
    expect(panelModel(READING, 'metric')).toEqual({
      kind: 'forecast',
      condition: 'rain',
      max: 12,
      min: 4,
      unit: 'C',
      precipitationMm: 5.1,
      probability: 70,
      windMs: 5,
      slots: [
        { name: 'night', condition: 'cloudy', temp: 5 },
        { name: 'morning', condition: 'rain', temp: 6 },
        { name: 'afternoon', condition: 'partlyCloudy', temp: 12 },
        { name: 'evening', condition: 'clear', temp: 8 },
      ],
    })
  })

  it('draws the same reading in Fahrenheit, with the other figures left metric for the formatters', () => {
    expect(panelModel(READING, 'imperial')).toEqual({
      kind: 'forecast',
      condition: 'rain',
      max: 53,
      min: 40,
      unit: 'F',
      precipitationMm: 5.1,
      probability: 70,
      windMs: 5,
      slots: [
        { name: 'night', condition: 'cloudy', temp: 42 },
        { name: 'morning', condition: 'rain', temp: 43 },
        { name: 'afternoon', condition: 'partlyCloudy', temp: 53 },
        { name: 'evening', condition: 'clear', temp: 47 },
      ],
    })
  })

  it('leaves out what the provider did not say, instead of showing a zero', () => {
    const model = panelModel(
      {
        ...READING,
        precipitationMm: null,
        precipitationProbability: null,
        windMs: null,
      },
      'metric',
    )

    expect(model.precipitationMm).toBeNull()
    expect(model.probability).toBeNull()
    expect(model.windMs).toBeNull()
  })

  it('has no slots region when the reading has no slots', () => {
    expect(panelModel({ ...READING, slots: null }, 'metric').slots).toBeNull()
    expect(panelModel({ ...READING, slots: [] }, 'metric').slots).toBeNull()
  })

  it('shows only the slots a reading has, in the order it gives them', () => {
    const model = panelModel(
      {
        ...READING,
        slots: [
          { from: '12:00', symbol: 'cloudy', tempC: 10 },
          { from: '18:00', symbol: null, tempC: 8 },
        ],
      },
      'metric',
    )

    expect(model.slots).toEqual([
      { name: 'afternoon', condition: 'cloudy', temp: 10 },
      { name: 'evening', condition: null, temp: 8 },
    ])
  })

  it('skips a slot that starts at a time it has no name for, and has no strip when none is left', () => {
    const model = panelModel(
      {
        ...READING,
        slots: [
          { from: '03:00', symbol: 'cloudy', tempC: 5 },
          { from: '12:00', symbol: 'cloudy', tempC: 10 },
        ],
      },
      'metric',
    )
    expect(model.slots).toEqual([
      { name: 'afternoon', condition: 'cloudy', temp: 10 },
    ])

    expect(
      panelModel(
        { ...READING, slots: [{ from: '03:00', symbol: 'cloudy', tempC: 5 }] },
        'metric',
      ).slots,
    ).toBeNull()
  })
})

describe('a recorded day', () => {
  const RECORDED: DayWeather = {
    dayId: 'd1',
    status: 'ok',
    reading: {
      kind: 'recorded',
      source: 'nasa-power',
      tempMinC: 1.9,
      tempMaxC: 8.4,
      precipitationMm: 0.2,
      windMs: 0.9,
    },
  }

  it('is a recorded badge in the reader’s unit, with no condition to claim', () => {
    expect(badgeModel(RECORDED, 'metric')).toEqual({
      kind: 'recorded',
      max: 8,
      min: 2,
      unit: 'C',
      reading: readingOf(RECORDED),
      sun: null,
    })
    expect(badgeModel(RECORDED, 'imperial')).toEqual({
      kind: 'recorded',
      max: 47,
      min: 35,
      unit: 'F',
      reading: readingOf(RECORDED),
      sun: null,
    })
  })

  it('keeps an absent temperature absent, never a zero', () => {
    const weather: DayWeather = {
      ...RECORDED,
      reading: {
        kind: 'recorded',
        source: 'nasa-power',
        tempMinC: null,
        tempMaxC: 8.4,
        precipitationMm: null,
        windMs: null,
      },
    }

    expect(badgeModel(weather, 'metric')).toEqual({
      kind: 'recorded',
      max: 8,
      min: null,
      unit: 'C',
      reading: readingOf(weather),
      sun: null,
    })
  })

  it('has a panel with no sky, no chance of rain and no slots', () => {
    if (RECORDED.status !== 'ok') throw new Error('unreachable')
    expect(panelModel(RECORDED.reading, 'metric')).toEqual({
      kind: 'recorded',
      condition: null,
      max: 8,
      min: 2,
      unit: 'C',
      precipitationMm: 0.2,
      probability: null,
      windMs: 0.9,
      slots: null,
    })
  })

  it('draws a not-yet-recorded day as its own badge, distinct from unavailable', () => {
    expect(
      badgeModel({ dayId: 'd1', status: 'not-yet-recorded' }, 'metric'),
    ).toEqual({ kind: 'notYetRecorded' })
    expect(
      badgeModel({ dayId: 'd1', status: 'unavailable' }, 'metric'),
    ).toEqual({
      kind: 'unavailable',
    })
  })
})

describe('an estimated day', () => {
  const ESTIMATE: DayWeather = {
    dayId: 'd1',
    status: 'ok',
    reading: {
      kind: 'estimate',
      source: 'nasa-power',
      tempMinC: 1.9,
      tempMaxC: 8.4,
      precipitationMm: 2.5,
      windMs: null,
    },
  }

  it('is an estimate badge in the reader’s unit, with no condition to claim', () => {
    expect(badgeModel(ESTIMATE, 'metric')).toEqual({
      kind: 'estimate',
      max: 8,
      min: 2,
      unit: 'C',
      reading: readingOf(ESTIMATE),
      sun: null,
    })
    expect(badgeModel(ESTIMATE, 'imperial')).toEqual({
      kind: 'estimate',
      max: 47,
      min: 35,
      unit: 'F',
      reading: readingOf(ESTIMATE),
      sun: null,
    })
  })

  it('keeps an absent temperature absent, never a zero', () => {
    const weather: DayWeather = {
      ...ESTIMATE,
      reading: {
        kind: 'estimate',
        source: 'nasa-power',
        tempMinC: null,
        tempMaxC: 8.4,
        precipitationMm: null,
        windMs: null,
      },
    }

    expect(badgeModel(weather, 'metric')).toEqual({
      kind: 'estimate',
      max: 8,
      min: null,
      unit: 'C',
      reading: readingOf(weather),
      sun: null,
    })
  })

  it('has a panel with no sky, no chance of rain, no wind and no slots', () => {
    if (ESTIMATE.status !== 'ok') throw new Error('unreachable')
    expect(panelModel(ESTIMATE.reading, 'metric')).toEqual({
      kind: 'estimate',
      condition: null,
      max: 8,
      min: 2,
      unit: 'C',
      precipitationMm: 2.5,
      probability: null,
      windMs: null,
      slots: null,
    })
  })
})
