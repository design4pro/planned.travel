/**
 * What a day's weather badge says, as plain data.
 *
 * The server answers in metric and in the provider's vocabulary; this is the one place that turns
 * that into what a reader sees - a whole-degree high and low in their own unit, and one of ten
 * condition groups in place of the provider's forty symbol codes. Keeping it free of React is what
 * lets the conversion and the grouping be tested as arithmetic and as a table.
 */

import type { MessageKey } from '#/lib/i18n'
import type { SunTimes } from '#/lib/sun'
import type {
  DayReading,
  DayWeather,
  EstimateReading,
  ForecastReading,
  RecordedReading,
  WeatherUnit,
} from '#/lib/weather'

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

export type WeatherSlotName = 'night' | 'morning' | 'afternoon' | 'evening'

export const SLOT_LABEL: { readonly [K in WeatherSlotName]: MessageKey } = {
  night: 'trips.plan.weather.panel.slot.night',
  morning: 'trips.plan.weather.panel.slot.morning',
  afternoon: 'trips.plan.weather.panel.slot.afternoon',
  evening: 'trips.plan.weather.panel.slot.evening',
}

/** Which stretch of the day a slot that starts at this local time is. */
const SLOT_BY_START: { readonly [from: string]: WeatherSlotName } = {
  '00:00': 'night',
  '06:00': 'morning',
  '12:00': 'afternoon',
  '18:00': 'evening',
}

export interface WeatherPanelModel {
  /** Which kind of reading this is: a forecast, what was measured on a day that is over, or an estimate. */
  readonly kind: DayReading['kind']
  readonly condition: WeatherCondition | null
  /** `null` when the day has no such figure (a measurement can lack one of its two). */
  readonly max: number | null
  readonly min: number | null
  readonly unit: 'C' | 'F'
  /** Millimetres; `null` when the provider gave no amount: the row is left out, never a zero. */
  readonly precipitationMm: number | null
  /** The chance of it, 0 to 100, or `null` when none was given. */
  readonly probability: number | null
  /** Metres per second, or `null` when none was given. */
  readonly windMs: number | null
  /** `null` when the reading has no slots: the region is omitted, never empty columns. */
  readonly slots: ReadonlyArray<{
    readonly name: WeatherSlotName
    readonly condition: WeatherCondition | null
    readonly temp: number
  }> | null
}

/** A temperature a reading may lack, in the reader's unit; absent stays absent, never `0`. */
function optionalTemperatureIn(
  celsius: number | null,
  unit: WeatherUnit,
): number | null {
  return celsius === null ? null : temperatureIn(celsius, unit)
}

/** The slots of a forecast day, in the reader's unit; a recorded day has none. */
function slotsOf(
  reading: DayReading,
  unit: WeatherUnit,
): WeatherPanelModel['slots'] {
  if (reading.kind !== 'forecast') {
    return null
  }
  const slots = (reading.slots ?? []).flatMap((slot) => {
    const name = SLOT_BY_START[slot.from]
    return name === undefined
      ? []
      : [
          {
            name,
            condition: conditionOf(slot.symbol),
            temp: temperatureIn(slot.tempC, unit),
          },
        ]
  })
  return slots.length === 0 ? null : slots
}

/** The fuller reading of a day, in the reader's unit. */
export function panelModel(
  reading: DayReading,
  unit: WeatherUnit,
): WeatherPanelModel {
  return {
    kind: reading.kind,
    condition: reading.kind === 'forecast' ? conditionOf(reading.symbol) : null,
    max: optionalTemperatureIn(reading.tempMaxC, unit),
    min: optionalTemperatureIn(reading.tempMinC, unit),
    unit: unitSymbol(unit),
    precipitationMm: reading.precipitationMm ?? null,
    probability:
      reading.kind === 'forecast' ? reading.precipitationProbability : null,
    windMs: reading.windMs ?? null,
    slots: slotsOf(reading, unit),
  }
}

export type WeatherBadgeModel =
  | { readonly kind: 'loading' }
  | { readonly kind: 'unavailable' }
  | { readonly kind: 'notYetRecorded' }
  | {
      readonly kind: 'forecast'
      readonly condition: WeatherCondition | null
      readonly max: number
      readonly min: number
      readonly unit: 'C' | 'F'
      /** The reading behind the badge, for the fuller panel it opens. */
      readonly reading: ForecastReading
      /** Sunrise and sunset behind the fuller panel; absent when the answer carried none. */
      readonly sun: SunTimes | null
    }
  | {
      /**
       * A measurement or a long-term average: both are only temperatures, with no sky to claim, and
       * differ in what they are called.
       */
      readonly kind: 'recorded' | 'estimate'
      /** Either may be `null`: such a reading can lack one of its two temperatures, not both. */
      readonly max: number | null
      readonly min: number | null
      readonly unit: 'C' | 'F'
      readonly reading: RecordedReading | EstimateReading
      /** Sunrise and sunset behind the fuller panel; absent when the answer carried none. */
      readonly sun: SunTimes | null
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
    case 'not-yet-recorded':
      return { kind: 'notYetRecorded' }
    case 'ok': {
      const { reading } = weather
      if (reading.kind === 'recorded' || reading.kind === 'estimate') {
        return {
          kind: reading.kind,
          max: optionalTemperatureIn(reading.tempMaxC, unit),
          min: optionalTemperatureIn(reading.tempMinC, unit),
          unit: unitSymbol(unit),
          reading,
          sun: weather.sun ?? null,
        }
      }
      return {
        kind: 'forecast',
        condition: conditionOf(reading.symbol),
        max: temperatureIn(reading.tempMaxC, unit),
        min: temperatureIn(reading.tempMinC, unit),
        unit: unitSymbol(unit),
        reading,
        sun: weather.sun ?? null,
      }
    }
  }
}
