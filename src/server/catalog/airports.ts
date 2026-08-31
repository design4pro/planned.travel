/**
 * The airport catalogue's read side — a prefix lookup over `airports`, and nothing that writes.
 *
 * ## Which exception this is, and why it is the one being used
 *
 * `CLAUDE.md` and `docs/SPEC.md` §6 say all SQL lives in `src/server/repos` and goes through the
 * tenant-scoped base repository, with `src/server/catalog` as the single stated exception. This
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
 * `scripts/build-airports.mjs` and loaded out of band, and this module has no insert, no update and
 * no delete.
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
 * city — and not an infix or a word search. A leading wildcard cannot use an index, and this is a
 * table of tens of thousands of rows queried on every keystroke. A term that appears in the middle
 * of a name is deliberately not found; a `LIKE '%term%'` over the whole catalogue behind a
 * type-ahead is the shape that reads fine in a test with four rows and scans the table in
 * production.
 *
 * The result is capped at {@link AIRPORT_MATCH_LIMIT}, and the cap is a ceiling rather than a
 * default: a caller may ask for fewer and cannot ask for more. A two-letter prefix matches hundreds
 * of rows in the real artefact, and a list nobody can read is not a better answer than a short one.
 *
 * The term is escaped before it reaches `LIKE`. `%` and `_` are pattern operators there, so a
 * traveller typing either would otherwise match rows they did not ask for — silently, since the
 * query succeeds and simply answers the wrong question.
 */

import { sql } from 'drizzle-orm'
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
 * exact code first, then the two code prefixes, then a name, then a city — the last of these is
 * the `case`'s `else`, since the `where` admits nothing a city prefix has not matched — each tier
 * broken by name and then by id so two runs over the same rows answer in the same order. Without it `LIMIT` would
 * cut an arbitrary twenty rows out of an unordered scan and the exact code a traveller typed could
 * be the one left out.
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

  const rank = sql<number>`case
    when ${airports.iataCode} = ${code} then 0
    when ${airports.icaoCode} = ${code} then 1
    when ${startsWith(airports.iataCode, pattern)} then 2
    when ${startsWith(airports.icaoCode, pattern)} then 3
    when ${startsWith(airports.name, pattern)} then 4
    else 5
  end`

  return db
    .select(MATCH_COLUMNS)
    .from(airports)
    .where(
      sql`${startsWith(airports.iataCode, pattern)}
        or ${startsWith(airports.icaoCode, pattern)}
        or ${startsWith(airports.name, pattern)}
        or ${startsWith(airports.city, pattern)}`,
    )
    .orderBy(rank, airports.name, airports.id)
    .limit(limit)
}

/**
 * The airport carrying exactly this code, or `null`.
 *
 * Three characters are read as IATA and four as ICAO — the two lengths the source dataset carries,
 * both unique in the committed artefact. Anything else is not a code, and is answered without a
 * query rather than with an equality against a column that is `NULL` for most of the world.
 */
export async function findAirportByCode(
  db: Database,
  code: string,
): Promise<AirportMatch | null> {
  const normalised = code.trim().toUpperCase()
  const column =
    normalised.length === IATA_CODE_LENGTH
      ? airports.iataCode
      : normalised.length === ICAO_CODE_LENGTH
        ? airports.icaoCode
        : null
  if (column === null || !/^[A-Z0-9]+$/.test(normalised)) return null

  const rows = await db
    .select(MATCH_COLUMNS)
    .from(airports)
    .where(sql`${column} = ${normalised}`)
    .limit(1)

  return rows[0] ?? null
}
