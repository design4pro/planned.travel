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
 * The DDL is the **shipped migration's**, not a hand-written `CREATE TABLE` and not one generated
 * from `schema.ts`. A hand-copied one drifts, and a generated one carries every column `schema.ts`
 * declares whether or not `pnpm db:generate` was ever run — so a read selecting a column D1 has
 * never been told about would pass here and fail in the Worker. `drizzle/*.sql` is replayed in
 * journal order through `src/server/db/__tests__/migration-files.ts`, filtered to the statements
 * that name this one table, and the `the fixture` block below asserts what came out
 * matches what `schema.ts` declares — which is what keeps that filter honest as well.
 *
 * `./platform-tables.ts` is not reused because it builds four tables this test wants absent, and
 * because it cannot record the SQL it runs.
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

import { getTableConfig } from 'drizzle-orm/sqlite-core'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { afterEach, describe, expect, it } from 'vitest'
import { airports } from '#/server/db/schema'
import {
  openReplayDatabase,
  shippedMigrations,
  statementsOf,
} from '#/server/db/__tests__/migration-files'
import {
  AIRPORT_MATCH_LIMIT,
  AIRPORT_TERM_MAX_LENGTH,
  findAirportByCode,
  searchAirports,
} from '../airports'
import type { DatabaseSync } from 'node:sqlite'
import type { Database, NewAirport } from '#/server/db/types'

/**
 * The identifier as drizzle-kit writes it, including the copy-and-swap name it would use if a
 * later migration ever rebuilt this table.
 */
const AIRPORTS_IDENTIFIER = /`(?:__new_)?airports`/

/** Every shipped statement that names this table, in journal order. Read once per test process. */
let ddl: Array<string> | undefined

function migrationStatements(): Array<string> {
  ddl ??= shippedMigrations()
    .flatMap((migration) => statementsOf(migration.sql))
    .filter((statement) => AIRPORTS_IDENTIFIER.test(statement))
  return ddl
}

/** One bound parameter, in the shapes `node:sqlite` accepts. No nested ternary, per house rule. */
function toBoundValue(param: unknown): null | number | string {
  if (param === null || param === undefined) return null
  if (param instanceof Date) return param.getTime()
  if (typeof param === 'boolean') return Number(param)
  return param as string | number
}

interface Catalogue {
  readonly db: Database
  /** Every statement the module has issued, in order. */
  readonly queries: Array<string>
  close: () => void
}

function openCatalogueDatabase(): DatabaseSync {
  const sqlite = openReplayDatabase()
  for (const statement of migrationStatements()) sqlite.exec(statement)
  return sqlite
}

async function createCatalogue(rows: Array<NewAirport>): Promise<Catalogue> {
  const sqlite = openCatalogueDatabase()

  const queries: Array<string> = []
  const run = (
    query: string,
    params: ReadonlyArray<unknown>,
    method: string,
  ) => {
    queries.push(query)
    const statement = sqlite.prepare(query)
    const bound = params.map(toBoundValue)
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

/** Non-ASCII letters, which 904 of the committed artefact's 9,057 rows carry. */
const ALESUND = airport({
  id: 'apt_aes',
  iataCode: 'AES',
  icaoCode: 'ENAL',
  name: 'Ålesund Airport',
  city: 'Ålesund',
  countryCode: 'NO',
  timezone: 'Europe/Berlin',
})

const CATALOGUE = [HEATHROW, GATWICK, CHOPIN, LODZ, ALESUND]

const open: Array<Catalogue> = []
afterEach(() => {
  for (const fixture of open.splice(0)) fixture.close()
})

async function catalogue(rows: Array<NewAirport> = CATALOGUE) {
  const fixture = await createCatalogue(rows)
  open.push(fixture)
  return fixture
}

describe('the fixture', () => {
  it('builds the table the shipped migrations build, and only that table', () => {
    // Two claims in one, and both are load-bearing for every case below. The statement filter has
    // to have found the migration — an empty replay would leave the read failing on `no such
    // table` rather than answering — and the replay has to have built *nothing else*, because a
    // second table is what the queries below are asserted to be unable to reach.
    const sqlite = openCatalogueDatabase()
    try {
      const tables = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
        )
        .all()
        .map((row) => String(row.name))

      expect(tables).toEqual(['airports'])
    } finally {
      sqlite.close()
    }
  })

  it('carries every column `schema.ts` declares, which is what `db:generate` guarantees', () => {
    // The failure this catches is a column added to `schema.ts` with `pnpm db:generate` never run:
    // Drizzle would select it, this suite would pass against a generated DDL that has it, and the
    // Worker would fail against a D1 that does not. Replaying the migration is what makes the two
    // able to disagree; this is where the disagreement is reported.
    const sqlite = openCatalogueDatabase()
    try {
      const onDisk = sqlite
        .prepare('SELECT name FROM pragma_table_info(?)')
        .all('airports')
        .map((row) => String(row.name))
        .sort()
      const declared = getTableConfig(airports)
        .columns.map((column) => column.name)
        .sort()

      expect(onDisk).toEqual(declared)
    } finally {
      sqlite.close()
    }
  })
})

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

  it('sorts a city-only match behind a name match', async () => {
    // The rank's `else` arm, which no case over the shared catalogue reaches: every city there is
    // also the start of its airport's name. So this needs a fixture where one row matches by name
    // and another by city alone — and the city-only row is named to sort *first* alphabetically, so
    // that if the two tiers ever collapsed into one the name tie-break would swap the answer.
    const { db } = await catalogue([
      airport({ id: 'apt_cty', name: 'Ardwell Field', city: 'Kirkwall' }),
      airport({ id: 'apt_nam', name: 'Kirkwall Airport', city: 'Orkney' }),
    ])

    expect((await searchAirports(db, 'Kirk')).map((row) => row.id)).toEqual([
      'apt_nam',
      'apt_cty',
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

  it('still asks for a term of exactly the greatest length a row can carry', async () => {
    // The other side of the same boundary. Without it a guard written `>=` passes the case above
    // and silently refuses to search for the longest names the artefact actually holds — the
    // longest it carries is 90 characters, six under this bound.
    const { db, queries } = await catalogue()

    expect(
      await searchAirports(db, 'L'.repeat(AIRPORT_TERM_MAX_LENGTH)),
    ).toEqual([])
    expect(queries).toHaveLength(1)
  })

  it('folds case over ASCII and not beyond it', async () => {
    // SQLite's LIKE folds A-Z and nothing else, and D1 carries no ICU to widen it. That is a
    // property of the seam a traveller can hit — the artefact holds 904 rows with a non-ASCII
    // letter — so it is pinned rather than left to be rediscovered as a bug report. A change to a
    // folded search column should turn this case red and be made deliberately.
    const { db } = await catalogue()

    expect((await searchAirports(db, 'Ålesund')).map((row) => row.id)).toEqual([
      'apt_aes',
    ])
    // Only the leading letter differs in case, and it is outside the range LIKE folds.
    expect(await searchAirports(db, 'ålesund')).toEqual([])
    // The ASCII half of the same term still folds, which is what makes the line above the boundary
    // rather than "non-ASCII terms never match".
    expect((await searchAirports(db, 'ÅLESUND')).map((row) => row.id)).toEqual([
      'apt_aes',
    ])
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
