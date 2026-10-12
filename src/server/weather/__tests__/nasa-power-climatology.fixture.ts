/**
 * A recorded NASA POWER climatology point answer for Oslo (59.9, 10.8), taken on 2026-10-12 with
 * `parameters=T2M_MAX,T2M_MIN,PRECTOTCORR` and `community=AG`, trimmed to the fields this
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
      T2M_MAX: {
        JAN: 6.41,
        FEB: 5.54,
        MAR: 16.04,
        APR: 20.79,
        MAY: 27.77,
        JUN: 29.67,
        JUL: 31.24,
        AUG: 29.58,
        SEP: 22.94,
        OCT: 18.84,
        NOV: 12.41,
        DEC: 7.66,
        ANN: 31.24,
      },
      T2M_MIN: {
        JAN: -26.2,
        FEB: -31.41,
        MAR: -20.9,
        APR: -10.66,
        MAY: -3.85,
        JUN: 2.31,
        JUL: 5.72,
        AUG: 2.36,
        SEP: -1.85,
        OCT: -10.21,
        NOV: -21.99,
        DEC: -26.02,
        ANN: -31.41,
      },
    },
  },
  header: {
    title: 'NASA/POWER Source Native Resolution Climatology Climatologies',
    fill_value: -999.0,
    time_standard: 'LST',
  },
} as const
