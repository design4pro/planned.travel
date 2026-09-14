/**
 * The airport catalogue's loader, driven as a program over a fixture artefact.
 *
 * The table this fills ships empty, and the one screen that treats the catalogue as a gate rather
 * than a shortcut — the connection search's stop picker, which needs coordinates a traveller
 * cannot type — is unusable until it is filled. That is a whole feature riding on a script, so the
 * properties below are the ones that make the script trustworthy without a database:
 *
 * - **The generated SQL says what the artefact says**, field for field, including the two
 *   encodings that are easy to get quietly wrong: an integer at 1e-5 read back as degrees, and an
 *   empty column read as `NULL` rather than as `''`.
 * - **A name with an apostrophe survives**, because roughly a hundred rows of the committed cut
 *   carry one and a naive quote would turn each into a syntax error — or, worse, into SQL.
 * - **The load upserts and then sweeps**, which is how a refresh drops an airport that closed
 *   without the table ever being empty — `d1 execute` promises no transaction across a file, and
 *   this runs against production on every deploy.
 * - **Two runs of the same artefact address the same rows.** The id is derived from the IATA code,
 *   so a refresh reads as the rows it changed rather than as nine thousand rewritten ones.
 * - **A malformed artefact is refused whole**, rather than loaded half-way.
 * - **The manifest's `rows=` describes the file it heads**, because that number is what `--verify`
 *   holds a deployed database to: a count that does not describe the artefact would either pass a
 *   database that never got the refresh or fail one that did.
 *
 * Loading into a real D1 is `pnpm db:airports:local`, and `scripts/worktree/bootstrap.sh` checks
 * the result; every property that can be asserted without one is asserted here.
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'seed', 'airports.mjs')

const MANIFEST =
  'version=1 source=fixture zones=fixture grid=100000 rows=3 zoned=2'

/** Three rows chosen for what they encode: a full row, a blank-heavy row, and an apostrophe. */
const FIXTURE = [
  MANIFEST,
  [
    'WAW',
    'EPWA',
    '5216570',
    '2096710',
    'PL',
    'Europe/Warsaw',
    'Warsaw',
    'Warsaw Chopin Airport',
  ].join('\t'),
  ['AAA', '', '-1735260', '-14550999', 'PF', '', 'Anaa', 'Anaa Airport'].join(
    '\t',
  ),
  [
    'COE',
    'KCOE',
    '4776380',
    '-11682050',
    'US',
    '',
    "Coeur d'Alene",
    "Coeur d'Alene Airport",
  ].join('\t'),
  '',
].join('\n')

const directories = []

function workspace() {
  const directory = mkdtempSync(join(tmpdir(), 'seed-airports-'))
  directories.push(directory)
  return directory
}

/** Runs the script in `--sql-out` mode, which stops before it would reach a database. */
function generate(artefact) {
  const directory = workspace()
  const source = join(directory, 'artefact.txt')
  const target = join(directory, 'out.sql')
  writeFileSync(source, artefact)

  const result = spawnSync(
    process.execPath,
    [SCRIPT, '--file', source, '--sql-out', target, '--batch', '2'],
    { encoding: 'utf8' },
  )
  return {
    status: result.status,
    stderr: result.stderr,
    sql: result.status === 0 ? readFileSync(target, 'utf8') : '',
  }
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('scripts/seed/airports.mjs', () => {
  it('writes every field the artefact carries, decoded', () => {
    const { status, sql } = generate(FIXTURE)

    expect(status).toBe(0)
    // Integers at 1e-5 come back as degrees, and an unzoned row carries NULL rather than ''.
    expect(sql).toContain(
      "('air_waw', 'WAW', 'EPWA', 'Warsaw Chopin Airport', 'Warsaw', 'PL', 'Europe/Warsaw', 52.1657, 20.9671,",
    )
    expect(sql).toContain(
      "('air_aaa', 'AAA', NULL, 'Anaa Airport', 'Anaa', 'PF', NULL, -17.3526, -145.50999,",
    )
  })

  it('keeps a name with an apostrophe, escaped rather than truncated', () => {
    const { sql } = generate(FIXTURE)

    expect(sql).toContain("'Coeur d''Alene Airport'")
    // And the escape is the only thing that changed about it.
    expect(sql).not.toContain("'Coeur d'Alene")
  })

  it('never leaves the table empty, and sweeps what the artefact dropped', () => {
    const { sql } = generate(FIXTURE)

    // No blanket delete up front: that is the window this shape exists to avoid.
    expect(sql).not.toMatch(/^DELETE FROM `airports`;$/mu)
    expect(sql).toMatch(/ON CONFLICT\(`id`\) DO UPDATE SET/u)
    // `OR REPLACE` would delete on the two unique indexes as well, so an ICAO that moved between
    // airports would silently take the other one's row with it.
    expect(sql).not.toMatch(/OR REPLACE|OR IGNORE/iu)

    // The sweep is last, and it is keyed on the stamp every row above just took.
    const stamp = /`updated_at` <> (\d+);\n$/u.exec(sql)
    expect(stamp).not.toBeNull()
    expect(sql).toContain(`, ${stamp?.[1]}, ${stamp?.[1]})`)
  })

  it('leaves created_at alone on a row that is already there', () => {
    const { sql } = generate(FIXTURE)

    // Every column the artefact owns is reassigned on conflict; `created_at` is not one of them,
    // so it keeps meaning when the row first appeared rather than when it was last loaded.
    expect(sql).toContain('`updated_at` = excluded.`updated_at`')
    expect(sql).not.toContain('`created_at` = excluded.`created_at`')
  })

  it('addresses the same rows on a second run of the same artefact', () => {
    const first = generate(FIXTURE).sql
    const second = generate(FIXTURE).sql

    const ids = (sql) => [...sql.matchAll(/'(air_[a-z]+)'/gu)].map((m) => m[1])
    expect(ids(first)).toEqual(['air_waw', 'air_aaa', 'air_coe'])
    expect(ids(second)).toEqual(ids(first))
  })

  it('batches rather than emitting one statement per row', () => {
    const { sql } = generate(FIXTURE)

    // Three rows at --batch 2 is two statements, so the batching is doing something and the rows
    // are not one INSERT each.
    expect(sql.match(/^INSERT INTO/gmu)).toHaveLength(2)
  })

  it('refuses an artefact with no manifest line', () => {
    const { status, stderr } = generate(
      'WAW\tEPWA\t1\t2\tPL\t\tWarsaw\tChopin\n',
    )

    expect(status).toBe(1)
    expect(stderr).toContain('version=1')
  })

  it('refuses a row that is short a field rather than loading it half-way', () => {
    const { status, stderr } = generate(
      [
        MANIFEST,
        ['WAW', 'EPWA', '1', '2', 'PL', '', 'Warsaw'].join('\t'),
        '',
      ].join('\n'),
    )

    expect(status).toBe(1)
    expect(stderr).toContain('7 fields')
  })

  it('refuses a coordinate that is not an integer on the stated grid', () => {
    const { status, stderr } = generate(
      [
        MANIFEST,
        [
          'WAW',
          'EPWA',
          '52.1657',
          '2096710',
          'PL',
          '',
          'Warsaw',
          'Chopin',
        ].join('\t'),
        '',
      ].join('\n'),
    )

    expect(status).toBe(1)
    expect(stderr).toContain('non-integer coordinate')
  })

  it('refuses an artefact whose manifest miscounts the rows it carries', () => {
    // `rows=3`, two rows: the shape a truncated write leaves behind, and the one that would make
    // `--verify` fail a database that holds exactly what was merged.
    const { status, stderr } = generate(
      FIXTURE.split('\n').slice(0, 3).concat('').join('\n'),
    )

    expect(status).toBe(1)
    expect(stderr).toContain('the manifest declares rows=3, the file carries 2')
  })

  it('refuses a manifest with no row count to check a database against', () => {
    const { status, stderr } = generate(FIXTURE.replace(' rows=3', ''))

    expect(status).toBe(1)
    expect(stderr).toContain('no rows= count')
  })

  it('refuses --verify together with --sql-out, which never opens a database', () => {
    const result = spawnSync(
      process.execPath,
      [SCRIPT, '--verify', '--sql-out', 'out.sql'],
      { encoding: 'utf8' },
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain('--verify reads a database')
  })
})
