/**
 * A recorded NASA POWER daily point answer for Oslo (59.9, 10.7), taken on 2026-10-12 at 11:42 UTC
 * with `parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,WS2M`, `community=AG`, `time-standard=LST` and the
 * range 2026-10-01 to 2026-10-12, trimmed to the fields this repository reads. Nothing is invented.
 *
 * The property the tests lean on is the end of it: the last three days of the range (10, 11 and 12
 * October) are the provider's fill value, `-999.0`, because POWER had published through 9 October
 * only. That is the publication lag this directory pins as `POWER_LAG_DAYS`, measured on this date.
 */
export const OSLO_DAILY = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [10.7, 59.9, 258.74],
  },
  properties: {
    parameter: {
      T2M_MAX: {
        '20261001': 15.47,
        '20261002': 13.48,
        '20261003': 13.47,
        '20261004': 12.15,
        '20261005': 16.24,
        '20261006': 13.04,
        '20261007': 11.79,
        '20261008': 6.73,
        '20261009': 8.36,
        '20261010': -999.0,
        '20261011': -999.0,
        '20261012': -999.0,
      },
      T2M_MIN: {
        '20261001': 10.11,
        '20261002': 9.59,
        '20261003': 8.02,
        '20261004': 5.1,
        '20261005': 8.97,
        '20261006': 5.37,
        '20261007': 3.56,
        '20261008': 4.61,
        '20261009': 1.91,
        '20261010': -999.0,
        '20261011': -999.0,
        '20261012': -999.0,
      },
      PRECTOTCORR: {
        '20261001': 0.52,
        '20261002': 9.03,
        '20261003': 2.1,
        '20261004': 1.15,
        '20261005': 0.85,
        '20261006': 0.0,
        '20261007': 1.62,
        '20261008': 11.47,
        '20261009': 0.23,
        '20261010': -999.0,
        '20261011': -999.0,
        '20261012': -999.0,
      },
      WS2M: {
        '20261001': 0.95,
        '20261002': 0.52,
        '20261003': 1.06,
        '20261004': 1.05,
        '20261005': 1.47,
        '20261006': 1.26,
        '20261007': 0.64,
        '20261008': 1.87,
        '20261009': 0.85,
        '20261010': -999.0,
        '20261011': -999.0,
        '20261012': -999.0,
      },
    },
  },
  header: {
    title: 'NASA/POWER Source Native Resolution Daily Data',
    api: {
      version: 'v2.10.0',
      name: 'POWER Daily API',
    },
    sources: ['GEOSIT', 'POWER'],
    fill_value: -999.0,
    time_standard: 'LST',
    start: '20261001',
    end: '20261012',
  },
  messages: [],
}
