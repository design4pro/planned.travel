/**
 * What a day's weather badge says, as plain data.
 *
 * The server answers in metric and in the provider's vocabulary; this is the one place that turns
 * that into what a reader sees - a whole-degree high and low in their own unit, and one of ten
 * condition groups in place of the provider's forty symbol codes. Keeping it free of React is what
 * lets the conversion and the grouping be tested as arithmetic and as a table.
 */

import type { MessageKey } from '#/lib/i18n'
import type { DayWeather, WeatherUnit } from '#/lib/weather'

/** The plan screen's view of a day: the server's answer, or "not in yet". */
export type DayWeatherView = DayWeather | { readonly status: 'loading' }

export type WeatherCondition =
  | 'clear'
  | 'fair'
  | 'partlyCloudy'
  | 'cloudy'
  | 'fog'
  | 'rain'
  | 'heavyRain'
  | 'sleet'
  | 'snow'
  | 'thunder'

export const CONDITION_LABEL: { readonly [K in WeatherCondition]: MessageKey } =
  {
    clear: 'trips.plan.weather.condition.clear',
    fair: 'trips.plan.weather.condition.fair',
    partlyCloudy: 'trips.plan.weather.condition.partlyCloudy',
    cloudy: 'trips.plan.weather.condition.cloudy',
    fog: 'trips.plan.weather.condition.fog',
    rain: 'trips.plan.weather.condition.rain',
    heavyRain: 'trips.plan.weather.condition.heavyRain',
    sleet: 'trips.plan.weather.condition.sleet',
    snow: 'trips.plan.weather.condition.snow',
    thunder: 'trips.plan.weather.condition.thunder',
  }

/**
 * The condition group of a provider symbol (`heavyrainshowers`, day/night suffix already removed).
 *
 * Read in order of what a traveller would pack for: thunder outranks everything it is combined
 * with, then sleet and snow, then heavy rain before rain. A symbol the table does not recognise is
 * `null` - a day with temperatures and no claim about the sky - rather than a guess.
 */
export function conditionOf(symbol: string | null): WeatherCondition | null {
  if (symbol === null) {
    return null
  }
  if (symbol.includes('thunder')) return 'thunder'
  if (symbol.includes('sleet')) return 'sleet'
  if (symbol.includes('snow')) return 'snow'
  if (symbol.includes('heavyrain')) return 'heavyRain'
  if (symbol.includes('rain')) return 'rain'
  switch (symbol) {
    case 'clearsky':
      return 'clear'
    case 'fair':
      return 'fair'
    case 'partlycloudy':
      return 'partlyCloudy'
    case 'cloudy':
      return 'cloudy'
    case 'fog':
      return 'fog'
    default:
      return null
  }
}

/** A Celsius reading in the reader's unit, rounded to a whole degree and never `-0`. */
export function temperatureIn(celsius: number, unit: WeatherUnit): number {
  const value = unit === 'imperial' ? (celsius * 9) / 5 + 32 : celsius
  return Math.round(value) + 0
}

export function unitSymbol(unit: WeatherUnit): 'C' | 'F' {
  return unit === 'imperial' ? 'F' : 'C'
}

export type WeatherBadgeModel =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | {
      readonly kind: 'forecast'
      readonly condition: WeatherCondition | null
      readonly max: number
      readonly min: number
      readonly unit: 'C' | 'F'
    }

/** What to draw for a day, or `null` when it draws nothing at all. */
export function badgeModel(
  weather: DayWeatherView,
  unit: WeatherUnit,
): WeatherBadgeModel | null {
  switch (weather.status) {
    case 'none':
      return null
    case 'loading':
      return { kind: 'loading' }
    case 'unavailable':
      return { kind: 'unavailable' }
    case 'ok':
      return {
        kind: 'forecast',
        condition: conditionOf(weather.reading.symbol),
        max: temperatureIn(weather.reading.tempMaxC, unit),
        min: temperatureIn(weather.reading.tempMinC, unit),
        unit: unitSymbol(unit),
      }
  }
}
