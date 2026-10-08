/**
 * A recorded MET Norway Locationforecast 2.0 `compact` answer for Oslo (59.9139, 10.7522), taken on
 * 2026-10-08 at 19:05 UTC and trimmed to the fields this repository reads. Nothing is invented: the steps, their spacing and their end are the
 * provider's.
 *
 * Three properties of the real answer are what the tests lean on, and each is worth knowing before
 * editing the file:
 *
 * - the series starts at the current hour (2026-10-08T18:00Z), so today is a partial day;
 * - the spacing is one hour for the first 55 steps and six hours after, so no day beyond the third
 *   has an hourly step;
 * - the last step (2026-10-18T18:00Z) carries an `instant` block and nothing after it, so the last
 *   date the series touches is a partial day.
 *
 * The response headers that matter, `Expires` and `Last-Modified`, are not part of the body; the
 * tests state them where they use them.
 */
// prettier-ignore
export const OSLO_FORECAST = {
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [10.7522, 59.9139, 5] },
  properties: {
    meta: { updated_at: '2026-10-08T18:29:44Z' },
    timeseries: [
      { time: '2026-10-08T18:00:00Z', data: { instant: { details: { air_temperature: 7.5 } }, next_1_hours: { summary: { symbol_code: 'lightrain' } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_night' } }, next_12_hours: { summary: { symbol_code: 'fair_night' } } } },
      { time: '2026-10-08T19:00:00Z', data: { instant: { details: { air_temperature: 7.5 } }, next_1_hours: { summary: { symbol_code: 'lightrain' } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_night' } }, next_12_hours: { summary: { symbol_code: 'fair_night' } } } },
      { time: '2026-10-08T20:00:00Z', data: { instant: { details: { air_temperature: 7.7 } }, next_1_hours: { summary: { symbol_code: 'cloudy' } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_night' } }, next_12_hours: { summary: { symbol_code: 'fair_night' } } } },
      { time: '2026-10-08T21:00:00Z', data: { instant: { details: { air_temperature: 7.9 } }, next_1_hours: { summary: { symbol_code: 'partlycloudy_night' } }, next_6_hours: { summary: { symbol_code: 'fair_night' } }, next_12_hours: { summary: { symbol_code: 'fair_day' } } } },
      { time: '2026-10-08T22:00:00Z', data: { instant: { details: { air_temperature: 8.2 } }, next_1_hours: { summary: { symbol_code: 'partlycloudy_night' } }, next_6_hours: { summary: { symbol_code: 'fair_night' } }, next_12_hours: { summary: { symbol_code: 'fair_day' } } } },
      { time: '2026-10-08T23:00:00Z', data: { instant: { details: { air_temperature: 8.2 } }, next_1_hours: { summary: { symbol_code: 'partlycloudy_night' } }, next_6_hours: { summary: { symbol_code: 'clearsky_night' } }, next_12_hours: { summary: { symbol_code: 'fair_day' } } } },
      { time: '2026-10-09T00:00:00Z', data: { instant: { details: { air_temperature: 7.7 } }, next_1_hours: { summary: { symbol_code: 'fair_night' } }, next_6_hours: { summary: { symbol_code: 'clearsky_night' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-09T01:00:00Z', data: { instant: { details: { air_temperature: 7.1 } }, next_1_hours: { summary: { symbol_code: 'clearsky_night' } }, next_6_hours: { summary: { symbol_code: 'clearsky_night' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-09T02:00:00Z', data: { instant: { details: { air_temperature: 6.7 } }, next_1_hours: { summary: { symbol_code: 'clearsky_night' } }, next_6_hours: { summary: { symbol_code: 'fair_night' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-09T03:00:00Z', data: { instant: { details: { air_temperature: 6.2 } }, next_1_hours: { summary: { symbol_code: 'clearsky_night' } }, next_6_hours: { summary: { symbol_code: 'fair_day' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-09T04:00:00Z', data: { instant: { details: { air_temperature: 5.7 } }, next_1_hours: { summary: { symbol_code: 'clearsky_night' } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-09T05:00:00Z', data: { instant: { details: { air_temperature: 4.9 } }, next_1_hours: { summary: { symbol_code: 'clearsky_night' } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-09T06:00:00Z', data: { instant: { details: { air_temperature: 4.5 } }, next_1_hours: { summary: { symbol_code: 'clearsky_day' } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-09T07:00:00Z', data: { instant: { details: { air_temperature: 5.1 } }, next_1_hours: { summary: { symbol_code: 'clearsky_day' } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-09T08:00:00Z', data: { instant: { details: { air_temperature: 7.1 } }, next_1_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-09T09:00:00Z', data: { instant: { details: { air_temperature: 8.5 } }, next_1_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-09T10:00:00Z', data: { instant: { details: { air_temperature: 9.3 } }, next_1_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-09T11:00:00Z', data: { instant: { details: { air_temperature: 10.2 } }, next_1_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-09T12:00:00Z', data: { instant: { details: { air_temperature: 10.8 } }, next_1_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-09T13:00:00Z', data: { instant: { details: { air_temperature: 10.9 } }, next_1_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-09T14:00:00Z', data: { instant: { details: { air_temperature: 11.0 } }, next_1_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-09T15:00:00Z', data: { instant: { details: { air_temperature: 10.5 } }, next_1_hours: { summary: { symbol_code: 'cloudy' } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'lightrain' } } } },
      { time: '2026-10-09T16:00:00Z', data: { instant: { details: { air_temperature: 9.7 } }, next_1_hours: { summary: { symbol_code: 'cloudy' } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'lightrain' } } } },
      { time: '2026-10-09T17:00:00Z', data: { instant: { details: { air_temperature: 8.6 } }, next_1_hours: { summary: { symbol_code: 'cloudy' } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'lightrain' } } } },
      { time: '2026-10-09T18:00:00Z', data: { instant: { details: { air_temperature: 8.0 } }, next_1_hours: { summary: { symbol_code: 'cloudy' } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'lightrain' } } } },
      { time: '2026-10-09T19:00:00Z', data: { instant: { details: { air_temperature: 7.5 } }, next_1_hours: { summary: { symbol_code: 'cloudy' } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'lightrain' } } } },
      { time: '2026-10-09T20:00:00Z', data: { instant: { details: { air_temperature: 7.3 } }, next_1_hours: { summary: { symbol_code: 'cloudy' } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'lightrain' } } } },
      { time: '2026-10-09T21:00:00Z', data: { instant: { details: { air_temperature: 7.2 } }, next_1_hours: { summary: { symbol_code: 'cloudy' } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-09T22:00:00Z', data: { instant: { details: { air_temperature: 7.2 } }, next_1_hours: { summary: { symbol_code: 'cloudy' } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-09T23:00:00Z', data: { instant: { details: { air_temperature: 7.1 } }, next_1_hours: { summary: { symbol_code: 'cloudy' } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T00:00:00Z', data: { instant: { details: { air_temperature: 6.7 } }, next_1_hours: { summary: { symbol_code: 'cloudy' } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T01:00:00Z', data: { instant: { details: { air_temperature: 6.5 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T02:00:00Z', data: { instant: { details: { air_temperature: 6.2 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T03:00:00Z', data: { instant: { details: { air_temperature: 5.7 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T04:00:00Z', data: { instant: { details: { air_temperature: 5.2 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T05:00:00Z', data: { instant: { details: { air_temperature: 4.8 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T06:00:00Z', data: { instant: { details: { air_temperature: 4.8 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T07:00:00Z', data: { instant: { details: { air_temperature: 4.6 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'heavyrain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T08:00:00Z', data: { instant: { details: { air_temperature: 4.6 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'heavyrain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T09:00:00Z', data: { instant: { details: { air_temperature: 4.8 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'heavyrain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T10:00:00Z', data: { instant: { details: { air_temperature: 4.9 } }, next_1_hours: { summary: { symbol_code: 'heavyrain' } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T11:00:00Z', data: { instant: { details: { air_temperature: 4.9 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T12:00:00Z', data: { instant: { details: { air_temperature: 5.2 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'lightrain' } } } },
      { time: '2026-10-10T13:00:00Z', data: { instant: { details: { air_temperature: 5.5 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T14:00:00Z', data: { instant: { details: { air_temperature: 5.6 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T15:00:00Z', data: { instant: { details: { air_temperature: 5.5 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T16:00:00Z', data: { instant: { details: { air_temperature: 5.5 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T17:00:00Z', data: { instant: { details: { air_temperature: 5.4 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-10T18:00:00Z', data: { instant: { details: { air_temperature: 5.4 } }, next_1_hours: { summary: { symbol_code: 'rain' } }, next_6_hours: { summary: { symbol_code: 'lightrain' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-10T19:00:00Z', data: { instant: { details: { air_temperature: 5.5 } }, next_1_hours: { summary: { symbol_code: 'lightrain' } } } },
      { time: '2026-10-10T20:00:00Z', data: { instant: { details: { air_temperature: 5.5 } }, next_1_hours: { summary: { symbol_code: 'lightrain' } } } },
      { time: '2026-10-10T21:00:00Z', data: { instant: { details: { air_temperature: 5.4 } }, next_1_hours: { summary: { symbol_code: 'lightrain' } } } },
      { time: '2026-10-10T22:00:00Z', data: { instant: { details: { air_temperature: 5.4 } }, next_1_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-10T23:00:00Z', data: { instant: { details: { air_temperature: 5.3 } }, next_1_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-11T00:00:00Z', data: { instant: { details: { air_temperature: 5.4 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-11T06:00:00Z', data: { instant: { details: { air_temperature: 6.2 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-11T12:00:00Z', data: { instant: { details: { air_temperature: 6.5 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-11T18:00:00Z', data: { instant: { details: { air_temperature: 7.4 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_night' } } } },
      { time: '2026-10-12T00:00:00Z', data: { instant: { details: { air_temperature: 6.2 } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_night' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-12T06:00:00Z', data: { instant: { details: { air_temperature: 3.5 } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-12T12:00:00Z', data: { instant: { details: { air_temperature: 8.0 } }, next_6_hours: { summary: { symbol_code: 'fair_day' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-12T18:00:00Z', data: { instant: { details: { air_temperature: 7.8 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'lightrain' } } } },
      { time: '2026-10-13T00:00:00Z', data: { instant: { details: { air_temperature: 9.0 } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-13T06:00:00Z', data: { instant: { details: { air_temperature: 11.0 } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'lightrain' } } } },
      { time: '2026-10-13T12:00:00Z', data: { instant: { details: { air_temperature: 11.6 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-13T18:00:00Z', data: { instant: { details: { air_temperature: 13.6 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_night' } } } },
      { time: '2026-10-14T00:00:00Z', data: { instant: { details: { air_temperature: 11.6 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-14T06:00:00Z', data: { instant: { details: { air_temperature: 10.2 } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-14T12:00:00Z', data: { instant: { details: { air_temperature: 12.9 } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-14T18:00:00Z', data: { instant: { details: { air_temperature: 12.7 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_night' } } } },
      { time: '2026-10-15T00:00:00Z', data: { instant: { details: { air_temperature: 11.6 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-15T06:00:00Z', data: { instant: { details: { air_temperature: 9.9 } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-15T12:00:00Z', data: { instant: { details: { air_temperature: 12.4 } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_day' } }, next_12_hours: { summary: { symbol_code: 'lightrainshowers_day' } } } },
      { time: '2026-10-15T18:00:00Z', data: { instant: { details: { air_temperature: 11.2 } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'lightrainshowers_night' } } } },
      { time: '2026-10-16T00:00:00Z', data: { instant: { details: { air_temperature: 9.4 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'fair_day' } } } },
      { time: '2026-10-16T06:00:00Z', data: { instant: { details: { air_temperature: 8.2 } }, next_6_hours: { summary: { symbol_code: 'clearsky_day' } }, next_12_hours: { summary: { symbol_code: 'fair_day' } } } },
      { time: '2026-10-16T12:00:00Z', data: { instant: { details: { air_temperature: 10.9 } }, next_6_hours: { summary: { symbol_code: 'clearsky_day' } }, next_12_hours: { summary: { symbol_code: 'fair_day' } } } },
      { time: '2026-10-16T18:00:00Z', data: { instant: { details: { air_temperature: 9.0 } }, next_6_hours: { summary: { symbol_code: 'fair_night' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_night' } } } },
      { time: '2026-10-17T00:00:00Z', data: { instant: { details: { air_temperature: 5.8 } }, next_6_hours: { summary: { symbol_code: 'partlycloudy_night' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-17T06:00:00Z', data: { instant: { details: { air_temperature: 6.7 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'lightrainshowers_day' } } } },
      { time: '2026-10-17T12:00:00Z', data: { instant: { details: { air_temperature: 9.9 } }, next_6_hours: { summary: { symbol_code: 'rainshowers_day' } }, next_12_hours: { summary: { symbol_code: 'rain' } } } },
      { time: '2026-10-17T18:00:00Z', data: { instant: { details: { air_temperature: 8.9 } }, next_6_hours: { summary: { symbol_code: 'rain' } }, next_12_hours: { summary: { symbol_code: 'lightrain' } } } },
      { time: '2026-10-18T00:00:00Z', data: { instant: { details: { air_temperature: 8.2 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-18T06:00:00Z', data: { instant: { details: { air_temperature: 7.8 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } }, next_12_hours: { summary: { symbol_code: 'partlycloudy_day' } } } },
      { time: '2026-10-18T12:00:00Z', data: { instant: { details: { air_temperature: 9.6 } }, next_6_hours: { summary: { symbol_code: 'cloudy' } } } },
      { time: '2026-10-18T18:00:00Z', data: { instant: { details: { air_temperature: 9.6 } } } },
    ],
  },
}
