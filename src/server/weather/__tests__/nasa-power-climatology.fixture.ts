/**
 * A recorded NASA POWER climatology point answer for Oslo (59.9, 10.8), taken on 2026-10-12 with
 * `parameters=T2M_MAX_AVG,T2M_MIN_AVG,PRECTOTCORR` and `community=AG`, trimmed to the fields this
 * repository reads. Nothing is invented: the service answers one figure per month (`JAN` to `DEC`)
 * and an annual one (`ANN`) per parameter, over its 2001 to 2025 climatological period.
 */
export const OSLO_CLIMATOLOGY = {
  type: 'Feature',
  geometry: {
    type: 'Point',
    coordinates: [10.8, 59.9, 258.74],
  },
  properties: {
    parameter: {
      PRECTOTCORR: {
        JAN: 2.5,
        FEB: 2.12,
        MAR: 1.82,
        APR: 2.03,
        MAY: 2.97,
        JUN: 3.2,
        JUL: 3.6,
        AUG: 3.94,
        SEP: 3.19,
        OCT: 3.35,
        NOV: 3.12,
        DEC: 2.52,
        ANN: 2.87,
      },
      T2M_MAX_AVG: {
        JAN: 1.79,
        FEB: 1.66,
        MAR: 7.56,
        APR: 15.55,
        MAY: 21.8,
        JUN: 24.26,
        JUL: 26.04,
        AUG: 24.49,
        SEP: 19.77,
        OCT: 13.62,
        NOV: 7.48,
        DEC: 2.61,
        ANN: 27.5,
      },
      T2M_MIN_AVG: {
        JAN: -18.42,
        FEB: -18.23,
        MAR: -13.41,
        APR: -4.86,
        MAY: -1.24,
        JUN: 4.49,
        JUL: 7.68,
        AUG: 5.95,
        SEP: 1.42,
        OCT: -4.4,
        NOV: -10.79,
        DEC: -15.81,
        ANN: -21.17,
      },
    },
  },
  header: {
    title: 'NASA/POWER Source Native Resolution Climatology Climatologies',
    fill_value: -999.0,
    time_standard: 'LST',
  },
} as const
