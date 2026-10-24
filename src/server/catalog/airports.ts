/**
 * The airport catalogue's read side — a prefix lookup over `airports` and the airport nearest a point,
 * and nothing that writes.
 *
 * ## Which exception this is, and why it is the one being used
 *
 * `AGENTS.md` and `docs/SPEC.md` §6 say all SQL lives in `src/server/repos` and goes through the
 * tenant-scoped base repository, with `src/server/catalog` as a stated exception. This
 * module uses that exception, and states which one it is because stating it is the price of using
 * it: `airports` carries no `organization_id`. It is platform reference data — a build-time cut of
 * a public-domain source, identical for every workspace and owned by none — so there is no tenant
 * discriminator for `tenantFilter()` to put in a `WHERE` clause, and handing the tenant layer a
 * fabricated scope to reach a table it cannot filter would destroy the one guarantee that layer
 * exists to give. So: a plain {@link Database}, no `TenantScope`, no reach into
 * `src/server/repos/**` — a property of the module graph rather than of this file's text, which is
 * why `__tests__/isolation.test.ts` walks the graph from every module in this directory, this one
 * included, instead of grepping for a spelling.
 *
 * There is no authorisation check here either, and that is the same fact from the other side. A
 * timetable, a runway and a three-letter code are public; the rows carry nothing a signed-in
 * traveller could learn about another workspace, because they carry nothing about any workspace.
 * §5's global-table clauses — an explicit actor, `requirePermission`, an audit row — bind the
 * *write* paths of the global tables. Nothing here writes: the artefact is built by
 * `scripts/build-airports.mjs` when the dataset is refreshed and loaded by `scripts/seed/airports.mjs`
 * when a checkout is provisioned or a deployment carries a new cut — both out of band, neither on a
 * request path — and this module has no insert, no update and no delete.
 *
 * ## The type-ahead is a shortcut over free text and never a gate in front of it
 *
 * The catalogue is a cut of a public dataset taken on the day the artefact was built, so it is
 * always behind the world. An airport that opened last week is one this table does not carry, and a
 * traveller must still be able to record a flight to it. Every read here therefore resolves an
 * unknown code to an **empty result** rather than to an error: {@link searchAirports} returns `[]`
 * and {@link findAirportByCode} returns `null`. Neither is ever the reason a write is refused,
 * because neither is on a write path at all — no caller may turn "the catalogue does not know this
 * code" into "this code is invalid".
 *
 * ## Prefix, cap, and the two things they protect
 *
 * The read is a **prefix** match — `LIKE 'term%'` on the IATA code, the ICAO code, the name and the
 * city — and not an infix or a word search. This is a table of thousands of rows queried on every
 * keystroke, and a prefix is what an index can serve: SQLite turns `LIKE 'term%'` into a range over
 * an index whose collation matches the comparison, which with `case_sensitive_like` off means
 * `NOCASE`. So each of the four columns carries a `NOCASE` index — `airports_iata_prefix_idx`,
 * `airports_icao_prefix_idx`, `airports_name_idx` and `airports_city_idx` — and the read plans as
 * one indexed probe per column rather than a scan; `__tests__/airports.test.ts` asserts that plan
 * by index name. The two unique code indexes stay `BINARY`, because {@link findAirportByCode}'s
 * equality compares with the column's own collation and a `NOCASE` index could not serve it. A
 * leading wildcard can use none of this, so a term that appears in the middle of a name is
 * deliberately not found; a `LIKE '%term%'` over the whole catalogue behind a type-ahead is the
 * shape that reads fine in a test with four rows and scans the table in production. The one
 * exception is {@link findNearestAirport}: `airports` has no index on the coordinates, so its
 * latitude/longitude window is a bounded scan of the table (see that function).
 *
 * The result is capped at {@link AIRPORT_MATCH_LIMIT}, and the cap is a ceiling rather than a
 * default: a caller may ask for fewer and cannot ask for more. A two-letter prefix matches hundreds
 * of rows in the real artefact, and a list nobody can read is not a better answer than a short one.
 *
 * The term is escaped before it reaches `LIKE`. `%` and `_` are pattern operators there, so a
 * traveller typing either would otherwise match rows they did not ask for — silently, since the
 * query succeeds and simply answers the wrong question.
 *
 * Case folds the way SQLite's `LIKE` folds, which is ASCII and nothing else: `lhr` finds `LHR`, and
 * `ålesund` does not find `Ålesund`. Roughly nine hundred of the committed artefact's rows carry a
 * non-ASCII letter, so that is a real edge and not a theoretical one. Closing it needs a folded
 * column written at build time — neither `lower()` nor `LIKE` folds beyond ASCII without ICU, which
 * D1 does not carry — so it is a schema change rather than something this seam can do, and the
 * picker above it keeps working because a term that finds nothing is free text a traveller keeps.
 */

import { and, eq, gte, isNotNull, lte, or, sql } from 'drizzle-orm'
import { airports } from '#/server/db/schema'
import type { SQL } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { Database } from '#/server/db/types'

/* -------------------------------------------------------------------------------------------------
 * Bounds
 * ---------------------------------------------------------------------------------------------- */

/**
 * The most rows one lookup may return, whatever it was asked for.
 *
 * Twenty is a list a person can scan without scrolling a combobox popover, and it is far under
 * what a short prefix matches: over the committed artefact `LO` reaches 121 rows and `SAN` 205.
 */
export const AIRPORT_MATCH_LIMIT = 20

/**
 * The longest term worth sending to the database.
 *
 * Measured against the committed artefact rather than picked: the longest name it carries is 90
 * characters and the longest city 42, so nothing longer than this can be the prefix of any row. A
 * term above it is answered `[]` without a query, which keeps an unbounded string arriving from a
 * client out of a bound parameter.
 */
export const AIRPORT_TERM_MAX_LENGTH = 96

/** IATA codes are three characters and ICAO codes are four, in the source dataset and here. */
const IATA_CODE_LENGTH = 3
const ICAO_CODE_LENGTH = 4

/* -------------------------------------------------------------------------------------------------
 * The row a lookup answers with
 * ---------------------------------------------------------------------------------------------- */

/**
 * One catalogue row, narrowed to what a resolved code fills in.
 *
 * `created_at` and `updated_at` are the artefact's load stamps and say nothing about the airport,
 * so they are not selected. Both codes are nullable because most of a public-domain dataset carries
 * no IATA code; the committed cut keeps only the rows that do, and the column stays nullable for
 * the rows a later cut may add.
 */
export interface AirportMatch {
  readonly id: string
  readonly iataCode: string | null
  readonly icaoCode: string | null
  readonly name: string
  readonly city: string | null
  readonly countryCode: string | null
  readonly timezone: string | null
  readonly lat: number | null
  readonly lng: number | null
}

const MATCH_COLUMNS = {
  id: airports.id,
  iataCode: airports.iataCode,
  icaoCode: airports.icaoCode,
  name: airports.name,
  city: airports.city,
  countryCode: airports.countryCode,
  timezone: airports.timezone,
  lat: airports.lat,
  lng: airports.lng,
}

/* -------------------------------------------------------------------------------------------------
 * Pattern building
 * ---------------------------------------------------------------------------------------------- */

/**
 * The `LIKE` pattern for a prefix, with the three characters that would otherwise be operators
 * escaped. The escape character escapes itself, which is why it is in the class.
 */
function prefixPattern(term: string): string {
  return `${term.replace(/[\\%_]/g, (character) => `\\${character}`)}%`
}

/** `column LIKE 'pattern' ESCAPE '\'`, which `like()` cannot express — it emits no `ESCAPE`. */
function startsWith(column: AnySQLiteColumn, pattern: string): SQL {
  return sql`${column} like ${pattern} escape '\\'`
}

/* -------------------------------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------------------------------- */

export interface SearchAirportsOptions {
  /** Clamped into `[0, AIRPORT_MATCH_LIMIT]`. Absent means the cap. */
  readonly limit?: number
}

/**
 * Airports whose code, name or city starts with `term`, best match first.
 *
 * The ordering is the one a type-ahead needs and is computed in SQL so it survives the cap: an
 * exact code first, then the two code prefixes, then a name, then a city — the last of these is the
 * `case`'s `else`, since the `where` admits nothing a city prefix has not matched — each tier broken
 * by name and then by id so two runs over the same rows answer in the same order. Without it
 * `LIMIT` would cut an arbitrary twenty rows out of an unordered scan, and the exact code a
 * traveller typed could be the one left out.
 *
 * The four prefix predicates are built once and used by both clauses, because the `case` is only a
 * ranking of what the `where` admitted: a predicate that appeared in one and not the other would
 * either sort rows into a tier they cannot be in or leave matched rows falling through to `else`.
 */
export async function searchAirports(
  db: Database,
  term: string,
  options: SearchAirportsOptions = {},
): Promise<Array<AirportMatch>> {
  const trimmed = term.trim()
  const limit = Math.min(
    Math.trunc(options.limit ?? AIRPORT_MATCH_LIMIT),
    AIRPORT_MATCH_LIMIT,
  )
  if (trimmed.length === 0 || trimmed.length > AIRPORT_TERM_MAX_LENGTH)
    return []
  if (!Number.isFinite(limit) || limit <= 0) return []

  const pattern = prefixPattern(trimmed)
  const code = trimmed.toUpperCase()
  const byIata = startsWith(airports.iataCode, pattern)
  const byIcao = startsWith(airports.icaoCode, pattern)
  const byName = startsWith(airports.name, pattern)
  const byCity = startsWith(airports.city, pattern)

  const rank = sql<number>`case
    when ${eq(airports.iataCode, code)} then 0
    when ${eq(airports.icaoCode, code)} then 1
    when ${byIata} then 2
    when ${byIcao} then 3
    when ${byName} then 4
    else 5
  end`

  return db
    .select(MATCH_COLUMNS)
    .from(airports)
    .where(or(byIata, byIcao, byName, byCity))
    .orderBy(rank, airports.name, airports.id)
    .limit(limit)
}

/* -------------------------------------------------------------------------------------------------
 * The airport nearest a point
 * ---------------------------------------------------------------------------------------------- */

/** The mean Earth radius the great-circle distance and the bounding window are both worked in. */
export const EARTH_RADIUS_KM = 6371

/**
 * How far from a point an airport may be and still answer for it.
 *
 * 100 km is the distance at which "the airport's clock" stops being a safe stand-in for "the
 * place's clock" for the one reader that asks, the weather's sun times: a region's zone boundary
 * seldom runs closer than that to a single-zone country's airport, and the catalogue only zones an
 * airport whose whole country has one zone.
 */
export const NEAREST_AIRPORT_RADIUS_KM = 100

/** A metre of slack, so an airport exactly at the radius is not lost to the last bit of a sine. */
const RADIUS_TOLERANCE_KM = 0.001

/** Two distances closer than this (a micrometre) are the same distance. */
const TIE_KM = 1e-9

/**
 * Degrees of slack on every edge of the SQL window (about 10 cm). The window and the exact
 * distance are computed through different sines, so an airport exactly at the radius could sit
 * on the far side of the window's edge by the last bit and never reach the exact check.
 */
const WINDOW_SLACK_DEGREES = 1e-6

/** A point on the map, in decimal degrees. */
export interface NearestAirportPoint {
  readonly lat: number
  readonly lng: number
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

/** Great-circle distance in kilometres (haversine), over the degrees the columns hold. */
function distanceKm(a: NearestAirportPoint, b: NearestAirportPoint): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * The SQL window that holds every airport within `radiusKm` of the point, and a few that are not.
 *
 * A degree of latitude is the same length everywhere, but a degree of longitude shrinks with the
 * cosine of the latitude, so the longitude margin is the angular radius divided by that cosine
 * (exactly: `asin(sin(r) / cos(lat))`). Where the cap reaches a pole that margin has no solution
 * and the window is every longitude. A window that crosses the antimeridian is two ranges.
 */
function windowAround(point: NearestAirportPoint, radiusKm: number): SQL {
  const angular = radiusKm / EARTH_RADIUS_KM
  const latMargin = (angular * 180) / Math.PI + WINDOW_SLACK_DEGREES
  const latitude = and(
    gte(airports.lat, Math.max(-90, point.lat - latMargin)),
    lte(airports.lat, Math.min(90, point.lat + latMargin)),
  )

  const ratio = Math.sin(angular) / Math.cos(toRadians(point.lat))
  if (
    !Number.isFinite(ratio) ||
    ratio >= 1 ||
    point.lat + latMargin >= 90 ||
    point.lat - latMargin <= -90
  ) {
    return and(latitude, isNotNull(airports.lng)) as SQL
  }
  const lngMargin = (Math.asin(ratio) * 180) / Math.PI + WINDOW_SLACK_DEGREES
  const west = point.lng - lngMargin
  const east = point.lng + lngMargin
  const longitude =
    west < -180
      ? or(gte(airports.lng, west + 360), lte(airports.lng, east))
      : east > 180
        ? or(gte(airports.lng, west), lte(airports.lng, east - 360))
        : and(gte(airports.lng, west), lte(airports.lng, east))
  return and(latitude, longitude) as SQL
}

/** True when `a` sorts before `b` at one distance: lower IATA code, then ICAO, then id. */
function sortsBefore(a: AirportMatch, b: AirportMatch): boolean {
  const key = (row: AirportMatch) =>
    `${row.iataCode ?? '\uffff'}|${row.icaoCode ?? '\uffff'}|${row.id}`
  return key(a) < key(b)
}

/**
 * The airport nearest to a point, of any kind, or `null` when none lies within `radiusKm`.
 *
 * "Of any kind" is the point: an airport with no zone still answers. The catalogue zones an airport
 * only when its country has exactly one zone, so the nearest *zoned* airport of a place near a
 * border is the neighbouring country's, and the caller reading `timezone` off the answer would take
 * a clock from the wrong side of it. The caller decides what an unzoned answer means.
 *
 * A bounding window in the database narrows the table to a handful of rows without an index
 * (`airports` carries none on the coordinates, and a scan over about nine thousand rows is what
 * this costs), then the exact distance is read in code. Ties go to the lower IATA code so two runs
 * over the same rows agree. A coordinate that is not on the globe is `null` without a query.
 */
export async function findNearestAirport(
  db: Database,
  point: NearestAirportPoint,
  radiusKm: number = NEAREST_AIRPORT_RADIUS_KM,
): Promise<AirportMatch | null> {
  const { lat, lng } = point
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180 ||
    !(radiusKm > 0)
  ) {
    return null
  }

  const candidates = await db
    .select(MATCH_COLUMNS)
    .from(airports)
    .where(windowAround(point, radiusKm))

  let best: { row: AirportMatch; km: number } | null = null
  for (const row of candidates) {
    if (row.lat === null || row.lng === null) continue
    const km = distanceKm(point, { lat: row.lat, lng: row.lng })
    if (km > radiusKm + RADIUS_TOLERANCE_KM) continue
    // Distances within a micrometre are one distance: float error must not decide a tie.
    const tied = best !== null && Math.abs(km - best.km) < TIE_KM
    if (best === null || (tied ? sortsBefore(row, best.row) : km < best.km)) {
      best = { row, km }
    }
  }
  return best?.row ?? null
}

/**
 * The column a code of this length is keyed on, or `null` when no length matches.
 *
 * Three characters are read as IATA and four as ICAO — the two lengths the source dataset carries,
 * both unique in the committed artefact. Every other length is `null`, which is what lets the
 * caller answer without a query rather than with an equality against a column that is `NULL` for
 * most of the world.
 */
function codeColumn(code: string): AnySQLiteColumn | null {
  switch (code.length) {
    case IATA_CODE_LENGTH:
      return airports.iataCode
    case ICAO_CODE_LENGTH:
      return airports.icaoCode
    default:
      return null
  }
}

/**
 * The airport carrying exactly this code, or `null`.
 *
 * The code is normalised and then held to {@link codeColumn} and to the alphabet the source
 * dataset uses, so nothing that is not a code reaches the database at all.
 */
export async function findAirportByCode(
  db: Database,
  code: string,
): Promise<AirportMatch | null> {
  const normalised = code.trim().toUpperCase()
  const column = codeColumn(normalised)
  if (column === null || !/^[A-Z0-9]+$/.test(normalised)) return null

  const rows = await db
    .select(MATCH_COLUMNS)
    .from(airports)
    .where(eq(column, normalised))
    .limit(1)

  return rows[0] ?? null
}
