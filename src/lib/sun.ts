/**
 * Sunrise and sunset, worked out and never fetched.
 *
 * The standard NOAA solar-position algorithm (the one behind the NOAA Solar Calculator), for a
 * latitude, a longitude, a calendar date and a time zone. It is pure - no I/O, no clock - so it
 * costs no request and no allowance, works for every kind of reading and for any date, and runs
 * the same on the server and in the browser.
 *
 * The times are wall-clock `HH:mm` in the zone given, which for a trip is the trip's one zone. On a
 * trip that crosses zones the far leg's times are wrong by the offset: that is a limitation of the
 * single-zone trip model, recorded in the per-day weather spec, not something to correct here.
 *
 * Where the sun does not cross the horizon that day (polar night, midnight sun) there is nothing
 * to report, and both sides come back `null`.
 */

import { dayKeyIn, resolveTimeZone } from '#/lib/time'
import { clockIn } from '#/lib/timezones'

/** Sunrise and sunset as local `HH:mm`, or `null` for a side the day does not have. */
export interface SunTimes {
  readonly sunrise: string | null
  readonly sunset: string | null
}

const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000
const MINUTE_MS = 60_000
/** The Julian day of the Unix epoch, and of the J2000 epoch the algorithm counts centuries from. */
const JD_UNIX_EPOCH = 2_440_587.5
const JD_J2000 = 2_451_545
/** The sun's apparent zenith at the horizon: the 90 degrees plus refraction and the solar radius. */
const HORIZON_ZENITH_DEG = 90.833

const rad = (degrees: number): number => (degrees * Math.PI) / 180
const deg = (radians: number): number => (radians * 180) / Math.PI

/** Julian centuries since J2000 of a Julian day. */
const centuries = (julianDay: number): number => (julianDay - JD_J2000) / 36_525

function geomMeanLongSun(t: number): number {
  const l0 = 280.466_46 + t * (36_000.769_83 + t * 0.000_303_2)
  return ((l0 % 360) + 360) % 360
}

function geomMeanAnomalySun(t: number): number {
  return 357.529_11 + t * (35_999.050_29 - 0.000_153_7 * t)
}

function eccentricityEarthOrbit(t: number): number {
  return 0.016_708_634 - t * (0.000_042_037 + 0.000_000_126_7 * t)
}

function sunEquationOfCenter(t: number): number {
  const m = rad(geomMeanAnomalySun(t))
  return (
    Math.sin(m) * (1.914_602 - t * (0.004_817 + 0.000_014 * t)) +
    Math.sin(2 * m) * (0.019_993 - 0.000_101 * t) +
    Math.sin(3 * m) * 0.000_289
  )
}

function sunApparentLong(t: number): number {
  const trueLong = geomMeanLongSun(t) + sunEquationOfCenter(t)
  const omega = 125.04 - 1934.136 * t
  return trueLong - 0.005_69 - 0.004_78 * Math.sin(rad(omega))
}

function obliquityCorrection(t: number): number {
  const seconds = 21.448 - t * (46.815 + t * (0.000_59 - t * 0.001_813))
  const mean = 23 + (26 + seconds / 60) / 60
  return mean + 0.002_56 * Math.cos(rad(125.04 - 1934.136 * t))
}

/** The sun's declination in degrees. */
function sunDeclination(t: number): number {
  return deg(
    Math.asin(
      Math.sin(rad(obliquityCorrection(t))) * Math.sin(rad(sunApparentLong(t))),
    ),
  )
}

/** The equation of time in minutes. */
function equationOfTime(t: number): number {
  const half = Math.tan(rad(obliquityCorrection(t)) / 2)
  const y = half * half
  const l0 = rad(geomMeanLongSun(t))
  const e = eccentricityEarthOrbit(t)
  const m = rad(geomMeanAnomalySun(t))
  return (
    4 *
    deg(
      y * Math.sin(2 * l0) -
        2 * e * Math.sin(m) +
        4 * e * y * Math.sin(m) * Math.cos(2 * l0) -
        0.5 * y * y * Math.sin(4 * l0) -
        1.25 * e * e * Math.sin(2 * m),
    )
  )
}

/**
 * Minutes after 00:00 UTC of the Julian day `julianDay` (a 0h-UTC day) at which the sun crosses
 * the horizon, or `null` when it does not that day. `rise` picks the side.
 */
function crossingMinutesUtc(
  rise: boolean,
  julianDay: number,
  lat: number,
  lng: number,
): number | null {
  const t = centuries(julianDay)
  const declination = rad(sunDeclination(t))
  const latitude = rad(lat)
  const cosHourAngle =
    Math.cos(rad(HORIZON_ZENITH_DEG)) /
      (Math.cos(latitude) * Math.cos(declination)) -
    Math.tan(latitude) * Math.tan(declination)
  // Outside -1..1 the sun stays below (polar night) or above (midnight sun) the horizon all day.
  if (!(cosHourAngle >= -1 && cosHourAngle <= 1)) {
    return null
  }
  const hourAngle = deg(Math.acos(cosHourAngle)) * (rise ? 1 : -1)
  return 720 - 4 * (lng + hourAngle) - equationOfTime(t)
}

/** The crossing as an instant, refined once at the time the first pass found. */
function crossingInstant(
  rise: boolean,
  midnightUtcMs: number,
  lat: number,
  lng: number,
): number | null {
  const julianDay = midnightUtcMs / DAY_MS + JD_UNIX_EPOCH
  const first = crossingMinutesUtc(rise, julianDay, lat, lng)
  if (first === null) {
    return null
  }
  const second = crossingMinutesUtc(rise, julianDay + first / 1440, lat, lng)
  return second === null ? null : midnightUtcMs + second * MINUTE_MS
}

/**
 * One side of the day as a local clock time, or `null`.
 *
 * The algorithm anchors on the UTC day, which is the zone's own day in most of the world. Where the
 * zone sits far from the longitude's solar time the crossing can land on the neighbouring local
 * date, so the anchor is moved a day until the crossing falls on the date asked about.
 */
function localClock(
  rise: boolean,
  date: string,
  midnightUtcMs: number,
  lat: number,
  lng: number,
  zone: string,
): string | null {
  for (const shift of [0, -1, 1]) {
    const instant = crossingInstant(
      rise,
      midnightUtcMs + shift * DAY_MS,
      lat,
      lng,
    )
    if (instant === null) {
      return null
    }
    // Whole minutes first, so a crossing at 05:40:50 reads 05:41 and not 05:40.
    const rounded = new Date(
      Math.round(instant / MINUTE_MS) * MINUTE_MS,
    ).toISOString()
    if (dayKeyIn(rounded, zone) === date) {
      return clockIn(rounded, zone)
    }
  }
  return null
}

/**
 * Sunrise and sunset on a calendar date at a point, as local `HH:mm` in `timeZone`.
 *
 * `date` is `YYYY-MM-DD`; a value that is not a date, or a latitude or longitude outside the earth,
 * gets `null` on both sides rather than a wrong time. An unknown zone is read as UTC.
 */
export function sunTimes(
  lat: number,
  lng: number,
  date: string,
  timeZone: string,
): SunTimes {
  const match = DATE_KEY.exec(date)
  const none: SunTimes = { sunrise: null, sunset: null }
  if (
    match === null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  ) {
    return none
  }
  const midnightUtcMs = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  )
  // `Date.UTC` rolls 31 February over into March; a date that does not survive the round trip is not one.
  if (new Date(midnightUtcMs).toISOString().slice(0, 10) !== date) {
    return none
  }
  const zone = resolveTimeZone(timeZone)
  return {
    sunrise: localClock(true, date, midnightUtcMs, lat, lng, zone),
    sunset: localClock(false, date, midnightUtcMs, lat, lng, zone),
  }
}
