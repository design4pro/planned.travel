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

/** A forecast for one local day, metric. */
export interface DayReading {
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
}

/**
 * One day of a trip, as the planner draws it.
 *
 * `none` is a day with nothing to show - no date, no location, or a day outside the forecast
 * window - and renders exactly as it did before weather existed. `unavailable` is a day that should
 * have a reading and does not: the provider failed, timed out or answered something unreadable, or
 * the workspace has spent its allowance. The two must never look alike, and neither is a zero.
 */
export type DayWeather =
  | { readonly dayId: string; readonly status: 'none' }
  | { readonly dayId: string; readonly status: 'unavailable' }
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
