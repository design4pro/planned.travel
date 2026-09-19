/**
 * Coordinate text → a latitude/longitude pair.
 *
 * The strings people actually have in their clipboard come in four notations: a
 * decimal pair, a hemisphere-lettered pair, degrees-minutes-seconds and an RFC 5870
 * `geo:` URI. This module reads exactly those and refuses everything else, because
 * the failure it exists to prevent is a wrong answer that looks right: it never swaps
 * halves, never resolves a sign/letter contradiction and never pulls numbers out of
 * prose. A refusal is `null`, and the caller treats every `null` the same way.
 *
 * "Position" here is a geographic pair, not a stop's place in a day's order
 * (`CONTEXT.md`), which is why the type is `GeoPosition`.
 *
 * Every pattern is anchored and has no nested or adjacent unbounded quantifiers, so
 * matching is linear in the input; the length cap means a long paste never reaches a
 * pattern at all. Pure and isomorphic: no DOM, no dependency.
 */

export interface GeoPosition {
  readonly lat: number
  readonly lng: number
}

/** Longer than any real position in any of the four notations. */
const MAX_LENGTH = 256

const NUMBER = String.raw`\d+(?:\.\d+)?`
const SIGNED = String.raw`[+-]?${NUMBER}`
/** Between the halves: a comma with optional whitespace, or whitespace alone. */
const SEPARATOR = String.raw`(?:\s*,\s*|\s+)`

const DECIMAL_PAIR = new RegExp(`^(${SIGNED})${SEPARATOR}(${SIGNED})$`)

/**
 * `N34.9671` or `34.9671 N` / `34.9671°N`: the letter on exactly one side, checked after
 * the match. A letter never comes with a sign, so the number is unsigned.
 */
function letteredHalf(letters: string): string {
  return String.raw`(?:([${letters}])\s*)?(${NUMBER})(?:\s*(?:°\s*)?([${letters}]))?`
}

const LETTERED_PAIR = new RegExp(
  `^${letteredHalf('NS')}${SEPARATOR}${letteredHalf('EW')}$`,
  'i',
)

/** `34°58'01.6"N`, seconds optional, minutes optional, the letter required. */
function dmsHalf(letters: string): string {
  return String.raw`(${NUMBER})\s*°\s*(?:(${NUMBER})\s*['′’]\s*(?:(${NUMBER})\s*["″”]\s*)?)?([${letters}])`
}

const DMS_PAIR = new RegExp(
  `^${dmsHalf('NS')}${SEPARATOR}${dmsHalf('EW')}$`,
  'i',
)

const GEO_PATH = new RegExp(`^(${SIGNED}),(${SIGNED})(?:,${SIGNED})?$`)
const GEO_SCHEME = /^geo:/i

/**
 * Reads the whole of `text` as one position in one of four notations — a decimal pair,
 * a hemisphere-lettered pair, degrees-minutes-seconds, or an RFC 5870 `geo:` URI — and
 * returns it, or `null` when the text is not exactly one of those. Never swaps halves,
 * never resolves a sign/letter contradiction, never extracts numbers from prose.
 */
export function parsePosition(text: string): GeoPosition | null {
  if (text.length > MAX_LENGTH) return null
  const trimmed = text.trim()
  if (GEO_SCHEME.test(trimmed)) return parseGeoUri(trimmed.slice(4))
  return parseDecimal(trimmed) ?? parseLettered(trimmed) ?? parseDms(trimmed)
}

/**
 * The string a coordinate field holds after a paste: at most six decimals (~0.1 m),
 * trailing zeros dropped, a `.` decimal point, never exponent notation. `Number()` of the
 * result is the rounded value, so the existing `parseCoordinate` reads it unchanged.
 */
export function formatCoordinate(value: number): string {
  const fixed = value.toFixed(6).replace(/\.?0+$/, '')
  return fixed === '-0' ? '0' : fixed
}

/** Range-checks the raw pair, then rounds it to what the fields will hold. */
function position(lat: number, lng: number): GeoPosition | null {
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return {
    lat: Number(formatCoordinate(lat)),
    lng: Number(formatCoordinate(lng)),
  }
}

function parseDecimal(text: string): GeoPosition | null {
  const match = DECIMAL_PAIR.exec(text)
  if (match === null) return null
  return position(Number(match[1]), Number(match[2]))
}

/** `S` and `W` are the negative hemispheres. */
function hemisphere(value: number, letter: string): number {
  const negative = letter.toUpperCase() === 'S' || letter.toUpperCase() === 'W'
  return negative ? -value : value
}

/** The one letter a lettered half carries, or `null` for none or two. */
function soleLetter(
  lead: string | undefined,
  trail: string | undefined,
): string | null {
  if (lead === undefined) return trail ?? null
  return trail === undefined ? lead : null
}

function parseLettered(text: string): GeoPosition | null {
  const match: ReadonlyArray<string | undefined> | null =
    LETTERED_PAIR.exec(text)
  if (match === null) return null
  const [, latLead, lat, latTrail, lngLead, lng, lngTrail] = match
  const latLetter = soleLetter(latLead, latTrail)
  const lngLetter = soleLetter(lngLead, lngTrail)
  if (latLetter === null || lngLetter === null) return null
  return position(
    hemisphere(Number(lat), latLetter),
    hemisphere(Number(lng), lngLetter),
  )
}

/**
 * Degrees, then minutes, then seconds. A finer unit is only meaningful when the coarser
 * one is whole: `34°58.5'30"` counts the half-minute twice, so it is refused.
 */
function dmsValue(
  degrees: string,
  minutes: string | undefined,
  seconds: string | undefined,
): number | null {
  if (minutes !== undefined && degrees.includes('.')) return null
  if (seconds !== undefined && minutes?.includes('.')) return null
  const m = Number(minutes ?? 0)
  const s = Number(seconds ?? 0)
  if (m >= 60 || s >= 60) return null
  return Number(degrees) + m / 60 + s / 3600
}

function parseDms(text: string): GeoPosition | null {
  const match: ReadonlyArray<string | undefined> | null = DMS_PAIR.exec(text)
  if (match === null) return null
  const [, latD = '', latM, latS, latLetter = ''] = match
  const [lngD = '', lngM, lngS, lngLetter = ''] = match.slice(5)
  const lat = dmsValue(latD, latM, latS)
  const lng = dmsValue(lngD, lngM, lngS)
  if (lat === null || lng === null) return null
  return position(hemisphere(lat, latLetter), hemisphere(lng, lngLetter))
}

/**
 * RFC 5870: `geo:lat,lng[,alt][;param…]`. Altitude and `u=` are read and discarded.
 * A query is refused because Android's `geo:0,0?q=…` hides the real position there
 * and leaves Null Island in the path, and a `crs` other than WGS 84 is refused because
 * its numbers are not ours.
 */
function parseGeoUri(rest: string): GeoPosition | null {
  if (rest.includes('?')) return null
  const [path, ...params] = rest.split(';')
  for (const param of params) {
    const [name, value = ''] = param.split('=')
    if (name === '') return null
    if (name.toLowerCase() === 'crs' && value.toLowerCase() !== 'wgs84') {
      return null
    }
  }
  const match = GEO_PATH.exec(path)
  if (match === null) return null
  return position(Number(match[1]), Number(match[2]))
}
