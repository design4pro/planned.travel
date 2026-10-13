/**
 * A recorded NASA POWER climatology point answer for Oslo (59.9, 10.8), taken on 2026-10-12 with
 * `parameters=T2M,T2M_RANGE,PRECTOTCORR` and `community=AG`, trimmed to the fields this
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
      T2M: {
        JAN: -5.94,
        FEB: -5.43,
        MAR: -1.84,
        APR: 4.1,
        MAY: 9.64,
        JUN: 13.85,
        JUL: 16.15,
        AUG: 14.78,
        SEP: 10.49,
        OCT: 4.47,
        NOV: -0.47,
        DEC: -4.94,
        ANN: 4.62,
      },
      T2M_RANGE: {
        JAN: 4.98,
        FEB: 6.0,
        MAR: 7.11,
        APR: 8.51,
        MAY: 9.22,
        JUN: 8.92,
        JUL: 8.41,
        AUG: 8.01,
        SEP: 7.74,
        OCT: 5.81,
        NOV: 4.25,
        DEC: 4.66,
        ANN: 6.97,
      },
    },
  },
  header: {
    title: 'NASA/POWER Source Native Resolution Climatology Climatologies',
    fill_value: -999.0,
    time_standard: 'LST',
  },
} as const
