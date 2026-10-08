import { describe, expect, it } from 'vitest'

import {
  badgeModel,
  conditionOf,
  temperatureIn,
  unitSymbol,
} from '../weather-model'

import type { DayWeather } from '#/lib/weather'

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
  },
})

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
    expect(badgeModel(OK(4.2, 11.6, 'rainshowers'), 'metric')).toEqual({
      kind: 'forecast',
      condition: 'rain',
      max: 12,
      min: 4,
      unit: 'C',
    })
    expect(badgeModel(OK(4.2, 11.6, 'rainshowers'), 'imperial')).toEqual({
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
