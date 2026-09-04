#!/usr/bin/env node

/**
 * Loads the committed airport catalogue artefact into the `airports` table.
 *
 *   node scripts/seed/airports.mjs [--local | --remote] [--env staging]
 *     [--file <artefact>] [--sql-out <path>] [--batch <rows>]
 *
 * This is the "loaded out of band" half that `src/server/catalog/airports.ts` and the
 * `airports` schema comment both name. `scripts/build-airports.mjs` writes
 * `public/atlas/airports-iata.v1.txt` when the dataset is refreshed; this reads that file and
 * puts it in D1. Without it the table ships empty, and the one surface that treats the
 * catalogue as a gate rather than a shortcut — the connection search's stop picker, which
 * needs coordinates a traveller cannot type — can never resolve a stop.
 *
 * It is **not** run at request time and **not** part of `pnpm build`. It runs when a checkout is
 * provisioned (`scripts/worktree/bootstrap.sh`) and, on a deployed database, between the migration
 * and the Worker upload in both deploy workflows - the same cadence as the migration that creates
 * the table, which is what keeps a refreshed artefact from needing a hand after the merge.
 *
 * ## Upsert, then sweep — and never a moment with an empty table
 *
 * The obvious shape is `DELETE` then `INSERT`, and it is the wrong one here: `d1 execute` makes
 * no promise that a file's statements share a transaction, so on a deployed database that shape
 * has a window in which the catalogue is empty and every type-ahead answers nothing. This runs
 * against production on every deploy, so the window is not hypothetical.
 *
 * Instead every artefact row is written with `INSERT ... ON CONFLICT DO UPDATE`, all carrying the
 * same load stamp, and one `DELETE` afterwards removes whatever the sweep did not touch. That is
 * what expresses the one thing a refresh does besides adding rows — an airport that closed leaves
 * the cut, and a plain upsert would keep serving it for ever — without the table ever being
 * empty, and it makes re-running the script idempotent rather than merely repeatable.
 *
 * The stamp doing the sweeping is `updated_at`, which is what the catalogue module already
 * documents it as: "the artefact's load stamps", saying nothing about the airport. `created_at`
 * is left alone on a row that already exists, so it keeps meaning when this row first appeared.
 *
 * ## Why SQL through wrangler rather than a client
 *
 * The same reason `db:migrate:local` and `db:migrate:remote` are wrangler: it is the one tool
 * that reaches both the Miniflare state directory and the deployed database, and the repository
 * has no D1 client dependency to add (docs/SPEC.md §3 freezes the dependency set). So this
 * writes a plain `.sql` file and hands it over. `--sql-out` stops after writing it, which is
 * how the test drives the generator without a database.
 *
 * Node built-ins only, like every other script in this directory.
 */

import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { argv, exit, stderr, stdout } from 'node:process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The artefact `scripts/build-airports.mjs` writes. */
const ARTEFACT = 'public/atlas/airports-iata.v1.txt'

/** The tab-separated column order the artefact's header documents. */
const IATA = 0
const ICAO = 1
const LAT = 2
const LNG = 3
const COUNTRY = 4
const ZONE = 5
const CITY = 6
const NAME = 7
const FIELDS = 8

/** Coordinates are integers at 1e-5 degrees. The artefact's manifest states the same grid. */
const GRID = 100_000

/**
 * Rows per `INSERT`.
 *
 * D1 caps how much SQL one statement may carry, and 9,000 rows in a single `VALUES` list is
 * over it. Two hundred and fifty keeps each statement well inside the limit while still making
 * the whole load about forty statements rather than nine thousand round trips.
 */
const BATCH_ROWS = 250

function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
}

/* -------------------------------------------------------------------------------------------------
 * The artefact
 * ---------------------------------------------------------------------------------------------- */

/**
 * The artefact's rows, with its manifest line dropped and every field checked.
 *
 * Strict about shape on purpose: this file is generated, so a row that does not have eight
 * fields or a coordinate that is not an integer means the artefact is not the one this script
 * was written against, and loading it half-way is worse than refusing.
 */
function parseArtefact(text) {
  const lines = text.split('\n').filter((line) => line !== '')
  const header = lines.shift()
  if (header === undefined || !header.startsWith('version=1')) {
    throw new Error(`${ARTEFACT}: expected a version=1 manifest line`)
  }

  return lines.map((line, index) => {
    const fields = line.split('\t')
    if (fields.length !== FIELDS) {
      throw new Error(
        `${ARTEFACT}: line ${index + 2} has ${fields.length} fields, expected ${FIELDS}`,
      )
    }
    return {
      iataCode: blankToNull(fields[IATA]),
      icaoCode: blankToNull(fields[ICAO]),
      lat: degrees(fields[LAT], index),
      lng: degrees(fields[LNG], index),
      countryCode: blankToNull(fields[COUNTRY]),
      timezone: blankToNull(fields[ZONE]),
      city: blankToNull(fields[CITY]),
      name: fields[NAME],
    }
  })
}

function blankToNull(value) {
  return value === '' ? null : value
}

function degrees(value, index) {
  if (value === '') return null
  if (!/^-?\d+$/u.test(value)) {
    throw new Error(
      `${ARTEFACT}: line ${index + 2} has a non-integer coordinate: ${value}`,
    )
  }
  return Number(value) / GRID
}

/* -------------------------------------------------------------------------------------------------
 * The SQL
 * ---------------------------------------------------------------------------------------------- */

/**
 * A row's primary key, derived from its IATA code rather than minted.
 *
 * The cut is one row per IATA code, so the code is the natural key and a derived id makes two
 * loads of the same artefact produce the same table — which is what lets a refresh be read as
 * the rows it changed. A minted id would rewrite all nine thousand every time.
 */
function idFor(row) {
  if (row.iataCode === null) {
    throw new Error(`${ARTEFACT}: a row with no IATA code cannot be keyed`)
  }
  return `air_${row.iataCode.toLowerCase()}`
}

/** SQLite string literal: the only character with meaning inside one is the quote. */
function literal(value) {
  return value === null ? 'NULL' : `'${value.replaceAll("'", "''")}'`
}

function number(value) {
  return value === null ? 'NULL' : String(value)
}

/** Every column the artefact owns — the whole row apart from `created_at`, which it only seeds. */
const UPDATED_COLUMNS = [
  'iata_code',
  'icao_code',
  'name',
  'city',
  'country_code',
  'timezone',
  'lat',
  'lng',
  'updated_at',
]

/**
 * The whole load as one script: upsert every row of the artefact, then sweep what it did not
 * carry.
 *
 * `now` is a parameter rather than a call so the generator is a function of its inputs — which is
 * what lets the test assert on its output, and what makes the sweep's `<>` legible: every row this
 * load touched carries this stamp, so anything else is a row the artefact no longer has.
 *
 * The conflict target is the primary key, and it is reached rather than guessed: {@link idFor}
 * derives the id from the IATA code, and the cut is one row per IATA code, so a row that is
 * already there is a row with this id. `OR REPLACE` would do the same job by deleting first, and
 * would take the two unique indexes with it — an ICAO that moved between airports would silently
 * delete the other one's row rather than fail.
 */
function buildSql(rows, now, batchRows = BATCH_ROWS) {
  const columns =
    '(`id`, `iata_code`, `icao_code`, `name`, `city`, `country_code`, `timezone`, `lat`, `lng`, `created_at`, `updated_at`)'
  const assignments = UPDATED_COLUMNS.map(
    (column) => `\`${column}\` = excluded.\`${column}\``,
  ).join(', ')

  const statements = []
  for (let start = 0; start < rows.length; start += batchRows) {
    const values = rows
      .slice(start, start + batchRows)
      .map(
        (row) =>
          `(${[
            literal(idFor(row)),
            literal(row.iataCode),
            literal(row.icaoCode),
            literal(row.name),
            literal(row.city),
            literal(row.countryCode),
            literal(row.timezone),
            number(row.lat),
            number(row.lng),
            String(now),
            String(now),
          ].join(', ')})`,
      )
      .join(',\n  ')
    statements.push(
      `INSERT INTO \`airports\` ${columns} VALUES\n  ${values}\nON CONFLICT(\`id\`) DO UPDATE SET ${assignments};`,
    )
  }
  // Whatever the upsert above did not touch is a row the artefact no longer carries.
  statements.push(
    `DELETE FROM \`airports\` WHERE \`updated_at\` <> ${String(now)};`,
  )
  return `${statements.join('\n')}\n`
}

/* -------------------------------------------------------------------------------------------------
 * The program
 * ---------------------------------------------------------------------------------------------- */

function parseArgs(args) {
  const options = {
    remote: false,
    env: null,
    file: ARTEFACT,
    sqlOut: null,
    batch: BATCH_ROWS,
  }
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--local') {
      options.remote = false
      continue
    }
    if (arg === '--remote') {
      options.remote = true
      continue
    }
    const value = args[(index += 1)]
    if (value === undefined) throw new Error(`${arg} needs a value`)
    if (arg === '--env') options.env = value
    else if (arg === '--file') options.file = value
    else if (arg === '--sql-out') options.sqlOut = value
    else if (arg === '--batch') options.batch = Number(value)
    else throw new Error(`unknown argument: ${arg}`)
  }
  if (options.env !== null && !options.remote) {
    throw new Error('--env only applies to --remote')
  }
  return options
}

/** The database name for a target, matching the `db:migrate:*` scripts in `package.json`. */
function databaseFor(env) {
  return env === null ? 'planned-travel-db' : `planned-travel-db-${env}`
}

async function main() {
  const options = parseArgs(argv.slice(2))
  const text = await readFile(resolve(repoRoot(), options.file), 'utf8')
  const rows = parseArtefact(text)
  const sql = buildSql(rows, Date.now(), options.batch)

  if (options.sqlOut !== null) {
    await writeFile(resolve(repoRoot(), options.sqlOut), sql)
    stdout.write(`wrote ${options.sqlOut} (${rows.length} airports)\n`)
    return
  }

  const directory = await mkdtemp(join(tmpdir(), 'airports-'))
  const file = join(directory, 'airports.sql')
  await writeFile(file, sql)

  const args = [
    'wrangler',
    'd1',
    'execute',
    databaseFor(options.env),
    options.remote ? '--remote' : '--local',
    '--file',
    file,
    '--yes',
  ]
  if (options.env !== null) args.push('--env', options.env)

  stdout.write(
    `loading ${rows.length} airports into ${databaseFor(options.env)} (${options.remote ? 'remote' : 'local'})\n`,
  )
  const result = spawnSync('pnpm', ['exec', ...args], {
    cwd: repoRoot(),
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`wrangler d1 execute exited ${String(result.status)}`)
  }
}

main().catch((error) => {
  stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  exit(1)
})
