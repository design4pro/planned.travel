#!/usr/bin/env node

/**
 * Builds the airport catalogue artefact loaded into the `airports` table.
 *
 *   node scripts/build-airports.mjs
 *     [--source <path|url>] [--source-id <token>]
 *     [--zones <path|url>] [--zones-id <token>]
 *     [--out <path>] [--check]
 *
 * With no arguments it fetches the two pinned sources, writes
 * `public/atlas/airports-iata.v1.txt` and prints what it cut. `--source` and `--zones` take local
 * mirrors of the same files, for an offline build; `--check` rebuilds and fails if the committed
 * artefact differs. It is **not** run at request time and **not** at deploy time — it is run when
 * the dataset is refreshed, and the artefact it writes is reviewed as a diff like any other change.
 *
 * `--source-id` and `--zones-id` rename the provenance tokens the manifest line carries, and they
 * exist for one purpose: building from a fixture in a test without writing a file whose first line
 * claims a provenance it does not have. A build meant for `public/atlas/` never passes either.
 *
 * This follows the idiom `scripts/build-country-outlines.mjs` established: a pinned public-domain
 * source, a deterministic cut, a committed artefact, a `--check` mode. Node built-ins only — the
 * repository's dependency set is frozen (docs/SPEC.md §3), so the CSV reader below is thirty lines
 * rather than a package.
 *
 * ## Why a build-time artefact and not a provider
 *
 * ADR 0010. The dataset is public domain, so there is no licence to negotiate, no tier to buy and
 * no runtime call to make. A provider would put a third party on the path of a keystroke and a bill
 * on the path of a type-ahead; a committed file puts the whole dataset one prefix query away in
 * D1 and costs nothing per lookup. It is also the only shape in which the dataset can be *reviewed*
 * — a diff of the artefact says exactly what changed between two refreshes.
 *
 * ## Sources, both public domain, both pinned
 *
 * **Airports.** OurAirports, whose maintainers place the data in the public domain, mirrored as CSV
 * at `davidmegginson/ourairports-data`. That repository publishes no tags — it is regenerated
 * daily — so the pin is a commit SHA rather than a tag, which is the same guarantee by a different
 * name: two runs of this script read the same bytes. The alternatives were rejected on licence
 * rather than on coverage: OpenFlights is ODbL, and `mwgg/Airports` is MIT; both would put a new
 * mandatory attribution on a surface that currently owes none.
 *
 * **Zones.** The IANA time zone database's `zone1970.tab`, from the reference repository at the
 * release tag. The tz database is explicitly in the public domain.
 *
 * ## The cut: one row per IATA code
 *
 * OurAirports carries about 86,000 rows, most of them heliports, closed fields and small strips
 * with no code at all. The consumer is a type-ahead over **a code a traveller types**, and the code
 * on a ticket is an IATA code, so the rule is: keep every row that carries a well-formed IATA code
 * and is not `closed`. That is roughly 9,000 rows — every airport with scheduled service and then
 * some — and it is one sentence rather than a list of `type` values chosen to hit a size target.
 *
 * ICAO codes ride along because the source carries them and a traveller reading a flight plan may
 * type one; about a seventh of the kept rows have none, which is why the column is nullable.
 *
 * ## The zone, and the airports that deliberately do not get one
 *
 * `airports.timezone` is what lets a resolved code fill in the clock a departure is written
 * against, and OurAirports does not carry it. It is derived here from `zone1970.tab` by the only
 * rule that can be *proved* from that file: **if the country has exactly one zone, that is the
 * zone; otherwise the row carries none.** About two fifths of the cut get a zone this way.
 *
 * The rejected alternative was nearest-representative-point, which `zone1970.tab` looks like it
 * supports and does not. Measured on the pinned release: Dallas is nearer Denver's representative
 * point than Chicago's, so `DFW` would be filled with `America/Denver` — an hour wrong, on a field
 * a traveller has no reason to re-read. An empty zone is a field they fill; a wrong zone is a
 * flight they miss. The type-ahead is a shortcut over free text and never a gate in front of it, so
 * an unfilled zone costs one interaction and nothing else — `03-S2`'s editor already makes the zone
 * an explicit choice with the platform's own list behind it.
 *
 * ## Determinism
 *
 * Two runs produce byte-identical output, and so does a source that lists the same rows in a
 * different order. Both pins are immutable, the ordering is by IATA code — unique across the cut,
 * so the order is total — every number is an integer on a stated grid, and nothing is stamped with
 * a clock. `--check` re-builds and diffs against the committed artefact.
 *
 * ## The artefact
 *
 * A manifest line of space-separated `key=value` pairs, then one tab-separated row per airport:
 *
 *     iata  icao  lat  lng  country  zone  city  name
 *
 * Coordinates are integers at 1e-5 degrees, which is about a metre — finer than the difference
 * between a terminal and a runway, and the same "integers on a grid" encoding the country-outlines
 * artefact uses. The two nullable text fields sit in the middle so no line can end in a separator.
 * A line per row rather than one long payload because this file is reviewed as a diff: a refresh
 * that adds four airports should read as four added lines.
 */

import { argv, exit, stderr, stdout } from 'node:process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/* -------------------------------------------------------------------------------------------------
 * Configuration
 * ---------------------------------------------------------------------------------------------- */

/** OurAirports' daily CSV mirror, pinned to a commit because the repository publishes no tags. */
const SOURCE_COMMIT = '9e51f13487de777bdc473a37d271981a2d0b30ca'
const SOURCE_URL = `https://raw.githubusercontent.com/davidmegginson/ourairports-data/${SOURCE_COMMIT}/airports.csv`
const SOURCE_TOKEN = `ourairports-${SOURCE_COMMIT.slice(0, 7)}`

/** The IANA time zone database, pinned to a release tag. */
const ZONES_RELEASE = '2026c'
const ZONES_URL = `https://raw.githubusercontent.com/eggert/tz/${ZONES_RELEASE}/zone1970.tab`
const ZONES_TOKEN = `tzdata-${ZONES_RELEASE}`

/**
 * The two constants above are `*_TOKEN` and not `*_ID` on purpose.
 * `src/lib/map/__tests__/countries.test.ts` proves its manifest line appears in no source file, and
 * checks that the walk backing that proof actually reaches `scripts/` by asserting `const SOURCE_ID
 * =` resolves to exactly one file there. A second declaration of that name would make the control
 * ambiguous and the proof weaker, in a file this ticket does not own.
 */

/**
 * What a provenance token may look like.
 *
 * The manifest line is space-separated `key=value` pairs, so a token carrying a space or an `=`
 * would produce a line the reader takes as extra fields.
 */
const TOKEN_PATTERN = /^[a-z0-9][a-z0-9-]*$/

/** Asset format version. Bumping it means bumping the filename too. */
const FORMAT_VERSION = 1

/** Units per degree. A hundred-thousandth of a degree is about 1.1m at the equator. */
const GRID = 100000

/** Where the artefact lands, relative to the repository root. */
const OUT_PATH = 'public/atlas/airports-iata.v1.txt'

/** The one `type` value that is not a place anyone can fly to. */
const CLOSED = 'closed'

const IATA_PATTERN = /^[A-Z0-9]{3}$/
const ICAO_PATTERN = /^[A-Z0-9]{4}$/
const COUNTRY_PATTERN = /^[A-Z]{2}$/

/* -------------------------------------------------------------------------------------------------
 * Sources
 * ---------------------------------------------------------------------------------------------- */

/** Repository root, resolved from this file so the script runs from anywhere. */
function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..')
}

/** Reads one source from a pinned URL, or from a local path. */
async function readSource(source) {
  if (/^https?:\/\//.test(source)) {
    const response = await fetch(source)
    if (!response.ok) {
      throw new Error(`${source} responded ${response.status}`)
    }
    return response.text()
  }
  return readFile(resolve(repoRoot(), source), 'utf8')
}

/* -------------------------------------------------------------------------------------------------
 * Parsing
 * ---------------------------------------------------------------------------------------------- */

/**
 * RFC 4180 in thirty lines: quoted fields, doubled quotes inside them, and newlines inside quotes.
 *
 * The source has all three — an airport called `Rio Grande do Norte/São Gonçalo…` is the tame case
 * and a name carrying a comma is the common one — so a `split(',')` reads the file into the wrong
 * columns and silently produces a plausible artefact.
 */
function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]

    if (quoted) {
      if (character !== '"') {
        field += character
      } else if (text[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = false
      }
      continue
    }

    if (character === '"') quoted = true
    else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else field += character
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/**
 * The CSV as records keyed by header name, which is how the columns are read below.
 *
 * A row whose width does not match the header is a **failure**, not a row to skip. A download that
 * was truncated, or a quoting bug in this file's parser, would otherwise read half the file into
 * the wrong columns and write an artefact that looks entirely plausible — the count in the report
 * would be lower and nothing would say so. Blank lines are the one exception, because a text file
 * ending in one is not malformed.
 */
function records(text) {
  const [header, ...rest] = parseCsv(text)
  if (header === undefined) throw new Error('source has no header row')

  const rows = []
  for (const [index, row] of rest.entries()) {
    if (row.length === 1 && row[0].length === 0) continue
    if (row.length !== header.length) {
      throw new Error(
        `source line ${index + 2} has ${row.length} fields, header has ${header.length}`,
      )
    }
    rows.push(Object.fromEntries(header.map((name, at) => [name, row[at]])))
  }
  return rows
}

/**
 * Country code to IANA zone, for the countries `zone1970.tab` gives exactly one.
 *
 * The file's first column is a comma-separated list of country codes — one line covers Réunion, the
 * Seychelles, Oman, the UAE and the French Southern Territories — and a country may appear on
 * several lines, which is what makes it more than one zone. Both shapes are counted, and only a
 * country whose lines name a single distinct zone gets an answer.
 */
function zonesByCountry(tab) {
  const seen = new Map()
  for (const line of tab.split('\n')) {
    if (line.startsWith('#') || line.trim().length === 0) continue
    const fields = line.split('\t')
    const zone = (fields[2] ?? '').trim()
    if (zone.length === 0) continue
    for (const country of fields[0].split(',')) {
      const code = country.trim().toUpperCase()
      if (!COUNTRY_PATTERN.test(code)) continue
      const zones = seen.get(code) ?? new Set()
      zones.add(zone)
      seen.set(code, zones)
    }
  }

  const resolved = new Map()
  for (const [code, zones] of seen) {
    if (zones.size === 1) resolved.set(code, [...zones][0])
  }
  return resolved
}

/* -------------------------------------------------------------------------------------------------
 * The cut
 * ---------------------------------------------------------------------------------------------- */

/**
 * One text field, reduced to a single line of single-spaced text.
 *
 * The artefact is tab-separated and line-delimited, so a tab or a newline arriving from the source
 * would not corrupt the build — it would corrupt every row after it, at read time, in a file
 * nobody re-reads. Collapsing all whitespace also makes the field a function of its content rather
 * than of the upstream file's typing, so a doubled space fixed upstream is not a diff here.
 */
function oneLine(value) {
  return value.replace(/\s+/gu, ' ').trim()
}

/** A coordinate as an integer on the grid, or the empty string when the source has none. */
function coordinate(value, bound) {
  const degrees = Number.parseFloat(value)
  if (!Number.isFinite(degrees) || Math.abs(degrees) > bound) return ''
  return String(Math.round(degrees * GRID))
}

/** The artefact's text and a report on what was cut, from the two source texts. */
function build(csv, tab, { sourceId, zonesId }) {
  const zones = zonesByCountry(tab)
  const rows = records(csv)
  const kept = new Map()
  let closed = 0
  let uncoded = 0

  for (const record of rows) {
    if ((record.type ?? '').trim() === CLOSED) {
      closed += 1
      continue
    }
    const iata = (record.iata_code ?? '').trim().toUpperCase()
    if (!IATA_PATTERN.test(iata)) {
      uncoded += 1
      continue
    }
    if (kept.has(iata)) {
      throw new Error(
        `source carries ${iata} twice; the catalogue keys one row per IATA code`,
      )
    }

    const icaoCandidate = (record.icao_code ?? '').trim().toUpperCase()
    const icao = ICAO_PATTERN.test(icaoCandidate) ? icaoCandidate : ''
    const countryCandidate = (record.iso_country ?? '').trim().toUpperCase()
    const country = COUNTRY_PATTERN.test(countryCandidate)
      ? countryCandidate
      : ''

    kept.set(iata, [
      iata,
      icao,
      coordinate(record.latitude_deg ?? '', 90),
      coordinate(record.longitude_deg ?? '', 180),
      country,
      zones.get(country) ?? '',
      oneLine(record.municipality ?? ''),
      oneLine(record.name ?? ''),
    ])
  }

  const icaoCodes = new Set()
  for (const [iata, fields] of kept) {
    if (fields[1].length === 0) continue
    if (icaoCodes.has(fields[1])) {
      throw new Error(
        `source carries ${fields[1]} twice, most recently on ${iata}`,
      )
    }
    icaoCodes.add(fields[1])
  }

  const lines = [...kept.keys()].sort().map((iata) => kept.get(iata).join('\t'))
  const zoned = [...kept.values()].filter(
    (fields) => fields[5].length > 0,
  ).length

  const manifest = [
    `version=${FORMAT_VERSION}`,
    `source=${sourceId}`,
    `zones=${zonesId}`,
    `grid=${GRID}`,
    `rows=${lines.length}`,
    `zoned=${zoned}`,
  ].join(' ')

  return {
    text: `${manifest}\n${lines.join('\n')}\n`,
    report: {
      read: rows.length,
      kept: lines.length,
      zoned,
      closed,
      uncoded,
      countries: new Set([...kept.values()].map((fields) => fields[4])).size,
      singleZoneCountries: zones.size,
    },
  }
}

/* -------------------------------------------------------------------------------------------------
 * Entry point
 * ---------------------------------------------------------------------------------------------- */

function parseArgs(args) {
  const options = {
    source: SOURCE_URL,
    sourceId: SOURCE_TOKEN,
    zones: ZONES_URL,
    zonesId: ZONES_TOKEN,
    out: OUT_PATH,
    check: false,
  }
  const flags = {
    '--source': 'source',
    '--source-id': 'sourceId',
    '--zones': 'zones',
    '--zones-id': 'zonesId',
    '--out': 'out',
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--check') {
      options.check = true
      continue
    }
    const key = flags[arg]
    if (key === undefined) throw new Error(`unknown argument: ${arg}`)
    const value = args[(index += 1)]
    if (value === undefined) throw new Error(`${arg} needs a value`)
    options[key] = value
  }

  for (const [flag, token] of [
    ['--source-id', options.sourceId],
    ['--zones-id', options.zonesId],
  ]) {
    if (!TOKEN_PATTERN.test(token)) {
      throw new Error(`${flag} must match ${String(TOKEN_PATTERN)}: ${token}`)
    }
  }
  return options
}

async function main() {
  const options = parseArgs(argv.slice(2))
  const target = resolve(repoRoot(), options.out)
  const [csv, tab] = await Promise.all([
    readSource(options.source),
    readSource(options.zones),
  ])
  const { text, report } = build(csv, tab, options)

  if (options.check) {
    const current = await readFile(target, 'utf8').catch(() => null)
    if (current === text) {
      stdout.write(`${options.out} is up to date (${report.kept} airports)\n`)
      return
    }
    stderr.write(
      `${options.out} differs from a fresh build. Run the script without --check.\n`,
    )
    exit(1)
  }

  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, text)

  stdout.write(
    [
      `wrote ${options.out}`,
      `  airports   ${options.source} (${options.sourceId})`,
      `  zones      ${options.zones} (${options.zonesId})`,
      `  rows       ${report.read} read, ${report.kept} kept`,
      `             ${report.closed} closed, ${report.uncoded} without an IATA code`,
      `  zones      ${report.zoned} zoned from ${report.singleZoneCountries} single-zone countries`,
      `  countries  ${report.countries}`,
      `  size       ${Buffer.byteLength(text)} bytes raw`,
      '',
    ].join('\n'),
  )
}

main().catch((error) => {
  stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  exit(1)
})
