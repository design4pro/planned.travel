/**
 * The weather contract the server answers with and the planner draws.
 *
 * Plain data and no I/O, so that `src/server/weather/` and `src/components/planner/` can both name
 * it without either importing the other. A reading carries metric values only; the reader's unit is
 * applied where it is drawn, because the cached entry behind it is shared by every workspace and
 * must not depend on who asked.
 *
 * Nothing here names a place, a stay, a member or a time anybody looked a point up: the response is
 * a function of the trip's days and of the provider's forecast, and a workspace that shares a
 * coordinate with another must not be able to tell from it that the other one exists.
 */

/** Which unit a reader sees temperatures in; the reader's existing distance unit decides. */
export type WeatherUnit = 'metric' | 'imperial'

/**
 * One six-hour stretch of a day: its start in the trip's local time (`00:00`, `06:00`, `12:00` or
 * `18:00`), the sky and the temperature over it. Six hours because that is the finest step the
 * provider carries for every day of a forecast, so every day has the same four.
 */
export interface DaySlot {
  /** Local `HH:mm` at which the slot starts. */
  readonly from: string
  readonly symbol: string | null
  /** The mean of the slot's forecast temperatures, in degrees Celsius. */
  readonly tempC: number
}

/** A forecast for one local day, metric. */
export interface ForecastReading {
  readonly kind: 'forecast'
  readonly source: 'met-norway'
  /** The day's lowest and highest forecast temperature, in degrees Celsius. */
  readonly tempMinC: number
  readonly tempMaxC: number
  /**
   * The provider's symbol for the day with its day/night suffix removed (`partlycloudy`), or
   * `null` when the day carries none. The planner maps it onto a condition group.
   */
  readonly symbol: string | null
  /** What falls over the day, in millimetres, or `null` when the provider gave no amount. */
  readonly precipitationMm: number | null
  /** The chance of it, 0 to 100, or `null` when the provider gave none - which the compact product never does. */
  readonly precipitationProbability: number | null
  /** The strongest wind of the day, in metres per second. */
  readonly windMs: number | null
  /**
   * The slots of the day that have a forecast, earliest first; at most four, and fewer for today
   * once part of it has gone. `null` when the day has none: the panel omits the region then, and
   * never draws a column with nothing in it.
   */
  readonly slots: ReadonlyArray<DaySlot> | null
}

/**
 * What was measured on a day that is already past, metric. A field the provider had nothing for is
 * `null`, never a number, and at least one of the two temperatures is present: a day with neither
 * is `unavailable` and has no reading at all. There is no sky, no chance of rain and no slots - a
 * measurement has none, and none is worked out from the high and the low.
 */
export interface RecordedReading {
  readonly kind: 'recorded'
  readonly source: 'nasa-power'
  readonly tempMinC: number | null
  readonly tempMaxC: number | null
  /** What fell over the day, in millimetres. */
  readonly precipitationMm: number | null
  /** The mean wind over the day at two metres, in metres per second. */
  readonly windMs: number | null
}

/** What a day's weather is, by where the day sits in time. */
export type DayReading = ForecastReading | RecordedReading

/**
 * One day of a trip, as the planner draws it.
 *
 * `none` is a day with nothing to show - no date, no location, or a day outside the forecast
 * window - and renders exactly as it did before weather existed. `unavailable` is a day that should
 * have a reading and does not: the provider failed, timed out or answered something unreadable, or
 * the workspace has spent its allowance. `not-yet-recorded` is a past day the provider has not
 * published yet: it is neither of the other two, because nothing failed and nothing is missing for
 * good, and it is never filled in from a forecast. The three must never look alike, and none is a
 * zero.
 */
export type DayWeather =
  | { readonly dayId: string; readonly status: 'none' }
  | { readonly dayId: string; readonly status: 'unavailable' }
  | { readonly dayId: string; readonly status: 'not-yet-recorded' }
  | {
      readonly dayId: string
      readonly status: 'ok'
      readonly reading: DayReading
    }

export interface TripWeather {
  /** The reader's distance unit, which is also the unit their temperatures are drawn in. */
  readonly distanceUnit: WeatherUnit
  readonly days: ReadonlyArray<DayWeather>
}
