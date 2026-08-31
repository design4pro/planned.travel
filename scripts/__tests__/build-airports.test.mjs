/**
 * The airport catalogue's build script, driven as a program over fixture sources.
 *
 * A build script whose determinism is untested is a build script that drifts. This one produces a
 * committed artefact that is reviewed as a diff, so the failure it has to be held to is not "the
 * build threw" — it is "the build ran twice and wrote two different files", which shows up as a
 * 9,000-line diff nobody can read and which no other check in this repository would notice.
 *
 * So the cases below assert the three properties the artefact exists for, on fixtures rather than
 * over the network:
 *
 * - **The cut is exact.** One small source in, one exact file out, asserted byte for byte. That
 *   pins the filter (an IATA code, not closed), the ordering, the encoding, the sanitising and the
 *   zone rule at once — change any of them and this test says which.
 * - **The build is a function of the source alone.** Two runs agree, and a shuffled source produces
 *   the same bytes, because the ordering is derived from the data rather than from the order rows
 *   happened to arrive in.
 * - **`--check` fails when the committed file drifts**, and passes when it does not. Without the
 *   second half the first is satisfied by a check that always fails.
 *
 * The committed artefact is then held to the invariants the builder guarantees — sorted, unique,
 * eight fields a line, integer coordinates, a real IANA zone — which is what catches a hand-edit of
 * a generated file. Regenerating it from the pinned URLs is the refresh-time gate and needs the
 * network, so it is `node scripts/build-airports.mjs --check` rather than a case here; every
 * property that can be asserted without the network is asserted here.
 */

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const SCRIPT = join(HERE, '..', 'build-airports.mjs')
const ARTEFACT = join(
  HERE,
  '..',
  '..',
  'public',
  'atlas',
  'airports-iata.v1.txt',
)

const TAB = '\t'

/** The OurAirports header, verbatim, so the fixture is read by column name as the real one is. */
const CSV_HEADER =
  '"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft","continent","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"'

/**
 * Eight source rows, each carrying one decision:
 *
 * `WAW` and `LHR` are ordinary rows in single-zone countries. `JFK` and `FRA` are in countries the
 * zone table gives more than one zone, so they take no zone. `EPLL` has no IATA code and `CLS` is
 * closed, so neither is in the cut. `NAT` carries a doubled space, a tab and non-ASCII letters in
 * its name. `ISL` has no ICAO code, no city and a country the zone table does not know.
 */
const CSV_ROWS = [
  '1,"EPWA","large_airport","Warsaw Chopin Airport",52.16575,20.967121,362,"EU","PL","PL-MZ","Warsaw","yes","EPWA","WAW","EPWA",,,,',
  '2,"EGLL","large_airport","London Heathrow Airport",51.4706,-0.461941,83,"EU","GB","GB-ENG","London","yes","EGLL","LHR","EGLL",,,,',
  '3,"KJFK","large_airport","John F Kennedy International Airport",40.639447,-73.779317,13,"NA","US","US-NY","New York","yes","KJFK","JFK","KJFK",,,,',
  '4,"EDDF","large_airport","Frankfurt am Main Airport",50.033333,8.570556,364,"EU","DE","DE-HE","Frankfurt am Main","yes","EDDF","FRA","EDDF",,,,',
  '5,"EPLL","medium_airport","Lodz Wladyslaw Reymont Airport",51.721897,19.398201,604,"EU","PL","PL-LD","Lodz","no","EPLL","","EPLL",,,,',
  '6,"XXXX","closed","Closed Field",10.5,20.25,0,"AF","PL","PL-MZ","Nowhere","no","XXXX","CLS","XXXX",,,,',
  `7,"SBSG","medium_airport","Rio Grande, São  Gonçalo${TAB}Airport",-5.768056,-35.366111,0,"SA","BR","BR-RN","Natal","yes","SBSG","NAT","SBSG",,,,`,
  '8,"AAAA","seaplane_base","Island Base",-0.5,-0.25,0,"OC","XX","XX-01","","no","","ISL","",,,,',
]

/**
 * A `zone1970.tab` in miniature, including the two shapes that make the zone rule what it is: one
 * line naming five countries, and a country appearing on two lines.
 */
const ZONE_TAB = [
  '# tz zone descriptions, abridged for the fixture',
  '#country-',
  '#codes\tcoordinates\tTZ\tcomments',
  'PL\t+5215+02100\tEurope/Warsaw',
  'DE,DK,NO,SE,SJ\t+5330+01322\tEurope/Berlin',
  'DE\t+4742+00841\tEurope/Busingen',
  'US\t+404251-0740023\tAmerica/New_York\tEastern (most areas)',
  'US\t+415100-0873900\tAmerica/Chicago\tCentral',
  'GB,GG,IM,JE\t+513030-0000731\tEurope/London',
  '',
].join('\n')

/** What the fixture above must produce, in full. */
const EXPECTED = [
  'version=1 source=fixture zones=fixture-zones grid=100000 rows=6 zoned=2',
  `FRA${TAB}EDDF${TAB}5003333${TAB}857056${TAB}DE${TAB}${TAB}Frankfurt am Main${TAB}Frankfurt am Main Airport`,
  `ISL${TAB}${TAB}-50000${TAB}-25000${TAB}XX${TAB}${TAB}${TAB}Island Base`,
  `JFK${TAB}KJFK${TAB}4063945${TAB}-7377932${TAB}US${TAB}${TAB}New York${TAB}John F Kennedy International Airport`,
  `LHR${TAB}EGLL${TAB}5147060${TAB}-46194${TAB}GB${TAB}Europe/London${TAB}London${TAB}London Heathrow Airport`,
  `NAT${TAB}SBSG${TAB}-576806${TAB}-3536611${TAB}BR${TAB}${TAB}Natal${TAB}Rio Grande, São Gonçalo Airport`,
  `WAW${TAB}EPWA${TAB}5216575${TAB}2096712${TAB}PL${TAB}Europe/Warsaw${TAB}Warsaw${TAB}Warsaw Chopin Airport`,
  '',
].join('\n')

const scratchDirs = []
afterEach(() => {
  for (const dir of scratchDirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

function workspace({ rows = CSV_ROWS, zones = ZONE_TAB } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'build-airports-'))
  scratchDirs.push(dir)
  const source = join(dir, 'airports.csv')
  const zoneTab = join(dir, 'zone1970.tab')
  writeFileSync(source, `${[CSV_HEADER, ...rows].join('\n')}\n`)
  writeFileSync(zoneTab, zones)
  return { dir, source, zoneTab, out: join(dir, 'airports.v1.txt') }
}

function build(space, extra = []) {
  const run = spawnSync(
    process.execPath,
    [
      SCRIPT,
      '--source',
      space.source,
      '--source-id',
      'fixture',
      '--zones',
      space.zoneTab,
      '--zones-id',
      'fixture-zones',
      '--out',
      space.out,
      ...extra,
    ],
    { encoding: 'utf8' },
  )
  return { status: run.status, output: `${run.stdout}${run.stderr}` }
}

describe('the cut', () => {
  it('writes exactly the artefact the fixture describes', () => {
    const space = workspace()

    expect(build(space).status).toBe(0)
    expect(readFileSync(space.out, 'utf8')).toBe(EXPECTED)
  })

  it('reports what it kept and what it dropped', () => {
    const space = workspace()

    const { output } = build(space)

    expect(output).toContain('8 read')
    expect(output).toContain('6 kept')
    expect(output).toContain('2 zoned')
  })

  it('refuses a source whose rows do not match its header', () => {
    // A truncated download, or a quoting bug in the reader, otherwise fills the columns from the
    // wrong fields and writes an artefact that looks entirely plausible.
    const truncated = workspace({
      rows: [...CSV_ROWS, '9,"EPWX","medium_airport","Half A Row",52.1'],
    })

    const run = build(truncated)

    expect(run.status).toBe(1)
    expect(run.output).toContain('line 10')
  })

  it('refuses a source that repeats a code rather than writing a file that cannot load', () => {
    // Both code columns are unique indexes on `airports`, so a duplicate is a load failure at best
    // and a silently halved catalogue at worst. The build is the place to notice.
    const duplicated = workspace({
      rows: [
        ...CSV_ROWS,
        '9,"EPWX","medium_airport","Second Warsaw",52.1,21.0,0,"EU","PL","PL-MZ","Warsaw","yes","EPWX","WAW","EPWX",,,,',
      ],
    })

    const run = build(duplicated)

    expect(run.status).toBe(1)
    expect(run.output).toContain('WAW')
  })
})

describe('determinism', () => {
  it('produces the same bytes twice', () => {
    const space = workspace()

    build(space)
    const first = readFileSync(space.out, 'utf8')
    build(space)

    expect(readFileSync(space.out, 'utf8')).toBe(first)
  })

  it('produces the same bytes from the same rows in a different order', () => {
    // The ordering is derived from the data, so a source that lists its rows differently is the
    // same source. Without that, a refresh of the upstream file rewrites the whole artefact.
    const forwards = workspace()
    const backwards = workspace({ rows: [...CSV_ROWS].reverse() })

    build(forwards)
    build(backwards)

    expect(readFileSync(backwards.out, 'utf8')).toBe(
      readFileSync(forwards.out, 'utf8'),
    )
  })
})

describe('--check', () => {
  it('passes when the committed file is what a fresh build would write', () => {
    const space = workspace()
    build(space)

    const run = build(space, ['--check'])

    expect(run.status).toBe(0)
    expect(run.output).toContain('up to date')
  })

  it('fails when the committed file has drifted from the source', () => {
    const space = workspace()
    build(space)
    writeFileSync(space.out, `${readFileSync(space.out, 'utf8')}ZZZ\n`)

    const run = build(space, ['--check'])

    expect(run.status).toBe(1)
    expect(run.output).toContain('differs')
  })

  it('fails when there is no committed file at all', () => {
    const run = build(workspace(), ['--check'])

    expect(run.status).toBe(1)
  })
})

describe('the committed artefact', () => {
  const text = readFileSync(ARTEFACT, 'utf8')
  const [manifestLine, ...lines] = text.split('\n')
  const rows = lines.filter((line) => line.length > 0)
  const manifest = Object.fromEntries(
    manifestLine.split(' ').map((pair) => pair.split('=')),
  )

  it('agrees with its own manifest', () => {
    expect(manifest.version).toBe('1')
    expect(manifest.grid).toBe('100000')
    expect(Number(manifest.rows)).toBe(rows.length)
    expect(rows.length).toBeGreaterThan(5000)
  })

  it('names the pinned sources it was cut from', () => {
    expect(manifest.source).toMatch(/^ourairports-[0-9a-f]{7}$/)
    expect(manifest.zones).toMatch(/^tzdata-\d{4}[a-z]$/)
  })

  it('carries eight fields a line, sorted by IATA code and unique on both codes', () => {
    const iata = []
    const icao = []
    for (const line of rows) {
      const fields = line.split(TAB)
      expect(fields, line).toHaveLength(8)
      const [code, icaoCode, lat, lng, country, zone] = fields
      expect(code).toMatch(/^[A-Z0-9]{3}$/)
      if (icaoCode.length > 0) expect(icaoCode).toMatch(/^[A-Z0-9]{4}$/)
      if (lat.length > 0) expect(lat).toMatch(/^-?\d+$/)
      if (lng.length > 0) expect(lng).toMatch(/^-?\d+$/)
      if (country.length > 0) expect(country).toMatch(/^[A-Z]{2}$/)
      if (zone.length > 0) expect(zone).toContain('/')
      iata.push(code)
      if (icaoCode.length > 0) icao.push(icaoCode)
    }

    expect(iata).toEqual([...iata].sort())
    expect(new Set(iata).size).toBe(iata.length)
    expect(new Set(icao).size).toBe(icao.length)
  })

  it('carries only zones this runtime accepts, on the count the manifest claims', () => {
    // A zone the platform cannot resolve is worse than no zone: it reads a time against a clock
    // that does not exist. Every one of them is put through `Intl` rather than pattern-matched.
    const zones = rows
      .map((line) => line.split(TAB)[5])
      .filter((zone) => zone.length > 0)

    expect(zones.length).toBe(Number(manifest.zoned))
    for (const zone of new Set(zones)) {
      expect(
        () => new Intl.DateTimeFormat('en', { timeZone: zone }),
        zone,
      ).not.toThrow()
    }
  })
})
