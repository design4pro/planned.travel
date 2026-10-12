import { describe, expect, it } from 'vitest'

import {
  badgeModel,
  conditionOf,
  panelModel,
  precipitationIn,
  temperatureIn,
  unitSymbol,
  windIn,
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
    expect(badgeModel(OK(4.2, 11.6, 'rainshowers'), 'metric')).toMatchObject({
      kind: 'forecast',
      condition: 'rain',
      max: 12,
      min: 4,
      unit: 'C',
    })
    expect(badgeModel(OK(4.2, 11.6, 'rainshowers'), 'imperial')).toMatchObject({
      kind: 'forecast',
      condition: 'rain',
      max: 53,
      min: 40,
      unit: 'F',
    })
  })

  it('keeps the temperatures for a day whose symbol is unknown, with no condition', () => {
    expect(badgeModel(OK(1, 2, null), 'metric')).toMatchObject({
      kind: 'forecast',
      condition: null,
    })
  })
})

describe('precipitationIn', () => {
  it('keeps millimetres to one decimal for a metric reader', () => {
    expect(precipitationIn(5.14, 'metric')).toEqual({ value: 5.1, unit: 'mm' })
    expect(precipitationIn(0, 'metric')).toEqual({ value: 0, unit: 'mm' })
  })

  it('converts to inches, to two decimals, for an imperial reader', () => {
    expect(precipitationIn(25.4, 'imperial')).toEqual({ value: 1, unit: 'in' })
    expect(precipitationIn(5.1, 'imperial')).toEqual({ value: 0.2, unit: 'in' })
    expect(precipitationIn(1, 'imperial')).toEqual({ value: 0.04, unit: 'in' })
  })
})

describe('windIn', () => {
  it('turns metres per second into whole kilometres per hour', () => {
    expect(windIn(5, 'metric')).toEqual({ value: 18, unit: 'km/h' })
    expect(windIn(0.4, 'metric')).toEqual({ value: 1, unit: 'km/h' })
  })

  it('turns metres per second into whole miles per hour', () => {
    expect(windIn(5, 'imperial')).toEqual({ value: 11, unit: 'mph' })
    expect(windIn(10, 'imperial')).toEqual({ value: 22, unit: 'mph' })
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
      precipitation: { value: 5.1, unit: 'mm' },
      probability: 70,
      wind: { value: 18, unit: 'km/h' },
      slots: [
        { name: 'night', condition: 'cloudy', temp: 5 },
        { name: 'morning', condition: 'rain', temp: 6 },
        { name: 'afternoon', condition: 'partlyCloudy', temp: 12 },
        { name: 'evening', condition: 'clear', temp: 8 },
      ],
    })
  })

  it('draws the same reading in Fahrenheit, inches and miles per hour', () => {
    expect(panelModel(READING, 'imperial')).toMatchObject({
      max: 53,
      min: 40,
      unit: 'F',
      precipitation: { value: 0.2, unit: 'in' },
      wind: { value: 11, unit: 'mph' },
      slots: [{ temp: 42 }, { temp: 43 }, { temp: 53 }, { temp: 47 }],
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

    expect(model.precipitation).toBeNull()
    expect(model.probability).toBeNull()
    expect(model.wind).toBeNull()
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
    expect(badgeModel(RECORDED, 'metric')).toMatchObject({
      kind: 'recorded',
      max: 8,
      min: 2,
      unit: 'C',
    })
    expect(badgeModel(RECORDED, 'imperial')).toMatchObject({
      max: 47,
      min: 35,
      unit: 'F',
    })
  })

  it('keeps an absent temperature absent, never a zero', () => {
    const model = badgeModel(
      {
        ...RECORDED,
        reading: {
          kind: 'recorded',
          source: 'nasa-power',
          tempMinC: null,
          tempMaxC: 8.4,
          precipitationMm: null,
          windMs: null,
        },
      },
      'metric',
    )

    expect(model).toMatchObject({ kind: 'recorded', max: 8, min: null })
  })

  it('has a panel with no sky, no chance of rain and no slots', () => {
    if (RECORDED.status !== 'ok') throw new Error('unreachable')
    expect(panelModel(RECORDED.reading, 'metric')).toMatchObject({
      kind: 'recorded',
      condition: null,
      probability: null,
      slots: null,
      precipitation: { value: 0.2, unit: 'mm' },
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
