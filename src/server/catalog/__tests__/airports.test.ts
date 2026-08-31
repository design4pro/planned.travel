/**
 * The airport catalogue's prefix read, driven against a database that holds `airports` and nothing
 * else.
 *
 * That emptiness is the tenant-isolation assertion this ticket ships in place of the usual one.
 * `airports` carries no `organization_id`, so there is no scope to cross and no "A cannot read B's
 * rows" case to write; what can go wrong instead is the read reaching sideways — through the tenant
 * repository layer, or into a table that does carry a tenant column. Here it cannot: the fixture
 * creates one table, so a statement naming any other fails with `no such table` and takes the case
 * with it. Every query the module issues is captured as well, and asserted to name `airports` and
 * no tenant column, so a read that touched a second table would fail twice rather than once. The
 * static half of the same claim — that nothing under `src/server/catalog/**` can *reach*
 * `src/server/repos/**` at any depth — is `./isolation.test.ts`, which walks this directory's
 * module graph and picks up `../airports.ts` without being edited.
 *
 * The DDL is generated from the Drizzle schema (`drizzle-kit/api`) rather than hand-written, for
 * the reason `./platform-tables.ts` gives: the real column types, the real unique indexes and the
 * real `latLngChecks` are what the read runs against, and a hand-copied `CREATE TABLE` drifts.
 * That fixture is not reused because it builds four tables this test wants absent, and because it
 * cannot record the SQL it runs.
 *
 * The cases are chosen against the three ways a type-ahead over public data fails quietly:
 *
 * - **A code the catalogue does not carry resolves to nothing and blocks no write.** The dataset is
 *   a build-time cut of a public source, so it is always behind the world. An unknown code has to
 *   come back empty, never throw, and never be the reason a traveller cannot record a flight.
 * - **The cap holds.** A two-letter prefix matches hundreds of rows in the real artefact; a read
 *   with no ceiling would put all of them on the wire behind every keystroke.
 * - **A wildcard typed into the box is a character, not an operator.** `%` reaches SQLite's `LIKE`
 *   as a pattern unless it is escaped, and the failure is silent: the box fills with the whole
 *   catalogue instead of erroring.
 */

import { DatabaseSync } from 'node:sqlite'
import {
  generateSQLiteDrizzleJson,
  generateSQLiteMigration,
} from 'drizzle-kit/api'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { afterEach, describe, expect, it } from 'vitest'
import { airports } from '#/server/db/schema'
import {
  AIRPORT_MATCH_LIMIT,
  AIRPORT_TERM_MAX_LENGTH,
  findAirportByCode,
  searchAirports,
} from '../airports'
import type { Database, NewAirport } from '#/server/db/types'

/** Generating the schema snapshot is the slow part, so it happens once per test process. */
let ddl: Promise<Array<string>> | undefined

function schemaStatements(): Promise<Array<string>> {
  ddl ??= (async () => {
    const empty = await generateSQLiteDrizzleJson({})
    const current = await generateSQLiteDrizzleJson({ airports })
    return generateSQLiteMigration(empty, current)
  })()
  return ddl
}

interface Catalogue {
  readonly db: Database
  /** Every statement the module has issued, in order. */
  readonly queries: Array<string>
  close: () => void
}

async function createCatalogue(rows: Array<NewAirport>): Promise<Catalogue> {
  const sqlite = new DatabaseSync(':memory:')
  for (const statement of await schemaStatements()) sqlite.exec(statement)

  const queries: Array<string> = []
  const run = (
    query: string,
    params: ReadonlyArray<unknown>,
    method: string,
  ) => {
    queries.push(query)
    const statement = sqlite.prepare(query)
    const bound = params.map((param) =>
      param === null || param === undefined
        ? null
        : param instanceof Date
          ? param.getTime()
          : typeof param === 'boolean'
            ? Number(param)
            : (param as string | number),
    )
    if (method === 'run') {
      statement.run(...bound)
      return { rows: [] }
    }
    // Drizzle maps result rows positionally, so rows must come back as arrays.
    statement.setReturnArrays(true)
    const all = statement.all(...bound) as unknown as Array<Array<unknown>>
    return { rows: method === 'get' ? (all[0] ?? []) : all }
  }

  const db: Database = drizzle(
    async (query, params, method) => run(query, params, method),
    async (batch) =>
      batch.map((entry) => run(entry.sql, entry.params, entry.method)),
  )

  if (rows.length > 0) await db.insert(airports).values(rows)
  // The seeding above is the fixture's, not the module's, so the log starts where the read does.
  queries.length = 0

  return { db, queries, close: () => sqlite.close() }
}

function airport(row: Partial<NewAirport> & { id: string }): NewAirport {
  return {
    name: `${row.id} Airport`,
    ...row,
  }
}

const HEATHROW = airport({
  id: 'apt_lhr',
  iataCode: 'LHR',
  icaoCode: 'EGLL',
  name: 'London Heathrow Airport',
  city: 'London',
  countryCode: 'GB',
  timezone: 'Europe/London',
  lat: 51.4706,
  lng: -0.461941,
})

const GATWICK = airport({
  id: 'apt_lgw',
  iataCode: 'LGW',
  icaoCode: 'EGKK',
  name: 'London Gatwick Airport',
  city: 'London',
  countryCode: 'GB',
  timezone: 'Europe/London',
  lat: 51.148056,
  lng: -0.190278,
})

const CHOPIN = airport({
  id: 'apt_waw',
  iataCode: 'WAW',
  icaoCode: 'EPWA',
  name: 'Warsaw Chopin Airport',
  city: 'Warsaw',
  countryCode: 'PL',
  timezone: 'Europe/Warsaw',
  lat: 52.16575,
  lng: 20.967121,
})

/** No IATA code, which is the shape most of a public-domain dataset has. */
const LODZ = airport({
  id: 'apt_lcj',
  iataCode: null,
  icaoCode: 'EPLL',
  name: 'Lodz Wladyslaw Reymont Airport',
  city: 'Lodz',
  countryCode: 'PL',
  timezone: 'Europe/Warsaw',
})

const CATALOGUE = [HEATHROW, GATWICK, CHOPIN, LODZ]

const open: Array<Catalogue> = []
afterEach(() => {
  for (const fixture of open.splice(0)) fixture.close()
})

async function catalogue(rows: Array<NewAirport> = CATALOGUE) {
  const fixture = await createCatalogue(rows)
  open.push(fixture)
  return fixture
}

describe('searchAirports', () => {
  it('matches a prefix of the IATA code and fills the four fields a code resolves to', async () => {
    const { db } = await catalogue()

    const matches = await searchAirports(db, 'LH')

    expect(matches).toEqual([
      {
        id: 'apt_lhr',
        iataCode: 'LHR',
        icaoCode: 'EGLL',
        name: 'London Heathrow Airport',
        city: 'London',
        countryCode: 'GB',
        timezone: 'Europe/London',
        lat: 51.4706,
        lng: -0.461941,
      },
    ])
  })

  it('matches a prefix of the ICAO code, the name and the city as well', async () => {
    const { db } = await catalogue()

    expect((await searchAirports(db, 'EPW')).map((row) => row.id)).toEqual([
      'apt_waw',
    ])
    expect(
      (await searchAirports(db, 'Warsaw Ch')).map((row) => row.id),
    ).toEqual(['apt_waw'])
    expect((await searchAirports(db, 'Lodz')).map((row) => row.id)).toEqual([
      'apt_lcj',
    ])
  })

  it('puts an exact code first, then code prefixes, then names', async () => {
    // `LGW` is Gatwick's code and also the start of nothing else; `L` reaches all four rows, and the
    // order is what a type-ahead shows before the traveller has finished typing.
    const { db } = await catalogue()

    expect((await searchAirports(db, 'LGW')).map((row) => row.id)).toEqual([
      'apt_lgw',
    ])
    expect((await searchAirports(db, 'L')).map((row) => row.id)).toEqual([
      // The two code prefixes, alphabetical by name, then the two name/city prefixes.
      'apt_lgw',
      'apt_lhr',
      'apt_lcj',
    ])
  })

  it('is case-insensitive on both the code and the name', async () => {
    const { db } = await catalogue()

    expect((await searchAirports(db, 'lhr')).map((row) => row.id)).toEqual([
      'apt_lhr',
    ])
    expect(
      (await searchAirports(db, 'warsaw chopin')).map((row) => row.id),
    ).toEqual(['apt_waw'])
  })

  it('returns an empty result for a code the catalogue does not carry', async () => {
    const { db } = await catalogue()

    // The airport that opened after our last build. It resolves to nothing and raises nothing, so
    // the caller is free to keep the free text the traveller typed.
    await expect(searchAirports(db, 'ZZZ')).resolves.toEqual([])
  })

  it('returns an empty result over an empty catalogue rather than throwing', async () => {
    const { db } = await catalogue([])

    await expect(searchAirports(db, 'LHR')).resolves.toEqual([])
  })

  it('asks the database nothing for a blank term', async () => {
    const { db, queries } = await catalogue()

    expect(await searchAirports(db, '   ')).toEqual([])
    expect(await searchAirports(db, '')).toEqual([])
    expect(queries).toEqual([])
  })

  it('treats a wildcard as a character rather than as an operator', async () => {
    const { db } = await catalogue()

    // Unescaped, each of these matches the whole catalogue through SQLite's LIKE.
    await expect(searchAirports(db, '%')).resolves.toEqual([])
    await expect(searchAirports(db, '_')).resolves.toEqual([])
    await expect(searchAirports(db, 'L%N')).resolves.toEqual([])
    // And the escape character itself is not an escape hatch out of the escaping.
    await expect(searchAirports(db, '\\')).resolves.toEqual([])
  })

  it('caps what it returns, and never above the cap however it is asked', async () => {
    const rows = Array.from({ length: AIRPORT_MATCH_LIMIT + 12 }, (_, index) =>
      airport({
        id: `apt_${String(index).padStart(3, '0')}`,
        name: `Cap Field ${String(index).padStart(3, '0')}`,
        city: 'Capital',
      }),
    )
    const { db } = await catalogue(rows)

    expect(await searchAirports(db, 'Cap')).toHaveLength(AIRPORT_MATCH_LIMIT)
    expect(await searchAirports(db, 'Cap', { limit: 5 })).toHaveLength(5)
    expect(
      await searchAirports(db, 'Cap', { limit: AIRPORT_MATCH_LIMIT + 100 }),
    ).toHaveLength(AIRPORT_MATCH_LIMIT)
    expect(await searchAirports(db, 'Cap', { limit: 0 })).toEqual([])
    expect(await searchAirports(db, 'Cap', { limit: -3 })).toEqual([])
  })

  it('asks the database nothing for a term longer than any row can carry', async () => {
    const { db, queries } = await catalogue()

    expect(
      await searchAirports(db, 'L'.repeat(AIRPORT_TERM_MAX_LENGTH + 1)),
    ).toEqual([])
    expect(queries).toEqual([])
  })

  it('reads `airports` and no tenant table', async () => {
    const { db, queries } = await catalogue()

    await searchAirports(db, 'L')
    await findAirportByCode(db, 'LHR')

    expect(queries.length).toBeGreaterThanOrEqual(2)
    for (const query of queries) {
      expect(query).toContain('airports')
      expect(query).not.toContain('organization_id')
    }
  })
})

describe('findAirportByCode', () => {
  it('resolves a three-letter code as IATA and a four-letter code as ICAO', async () => {
    const { db } = await catalogue()

    expect((await findAirportByCode(db, 'waw'))?.id).toBe('apt_waw')
    expect((await findAirportByCode(db, ' EPWA '))?.id).toBe('apt_waw')
  })

  it('resolves an unknown code to null rather than throwing', async () => {
    const { db } = await catalogue()

    await expect(findAirportByCode(db, 'ZZZ')).resolves.toBeNull()
    await expect(findAirportByCode(db, 'ZZZZ')).resolves.toBeNull()
  })

  it('asks the database nothing for something that is not a code', async () => {
    const { db, queries } = await catalogue()

    await expect(findAirportByCode(db, '')).resolves.toBeNull()
    await expect(findAirportByCode(db, 'LO')).resolves.toBeNull()
    await expect(findAirportByCode(db, 'LONDON')).resolves.toBeNull()
    await expect(findAirportByCode(db, 'LH%')).resolves.toBeNull()
    expect(queries).toEqual([])
  })

  it('never resolves a row that carries no code at all', async () => {
    // Both code columns are nullable and most of the dataset leaves IATA empty, so an equality
    // against a `NULL` column must not be reachable from a blank or padded term.
    const { db } = await catalogue()

    await expect(findAirportByCode(db, '   ')).resolves.toBeNull()
  })
})
