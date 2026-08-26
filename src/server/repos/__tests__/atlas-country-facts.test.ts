/**
 * The per-country figures the atlas card prints: trips, visited places and the months the record
 * spans.
 *
 * These are the numbers a reader will check against their own memory, so the tests are written
 * against the claim each field makes rather than against the query that answers it. A trip count
 * counts trips - not the visit tally `markCountryVisited` maintains, not a trip that has not left
 * yet, and not the same trip twice because its itinerary named the country twice. A visited-place
 * count counts places ticked off inside that country, not everything shortlisted for it. And a
 * country nobody has travelled to yet reports zero rather than going missing.
 *
 * Two absences are easy to get wrong and both are covered below. `GROUP BY` names only the groups
 * it found rows for, so the country marked visited by hand - the whole point of the atlas's manual
 * half - is in neither aggregate, and a card that reads a missing key gets `undefined` where a
 * numeral belongs. The mirror image is the country a trip merely named: it must not reach the
 * record, because that array is what the map paints its visited fill from and what the panel
 * counts under "countries visited", and a plan that mentioned a country is not a traveller who
 * went there. Its figures stay readable in the aggregate that produced them.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPlace } from '../places'
import { createTrip } from '../trips'
import {
  achieveBucketListItem,
  atlasCountryRecords,
  countCountriesByContinent,
  countTripsByCountry,
  countVisitedPlacesByCountry,
  countVisitedRegions,
  createBucketListItem,
  getAtlasSummary,
  listBucketList,
  listVisitedCountries,
  markCountryVisited,
  markRegionVisited,
} from '../atlas'
import { countryFactColumns, countryFacts } from '#/lib/atlas/country-facts'
import { visitSpan } from '#/lib/atlas/visit-span'
import { formatMonthYear, formatNumber } from '#/lib/format'
import { visitedCountries as demoVisitedCountries } from '#/routes/api/dev/-seed/dataset/workspace'
import { createHarness, subscribeTenant } from './harness'
import type { AtlasCountryRecord } from '../atlas'
import type { BucketListItem } from '#/server/db/types'
import type { Harness, SeededTenant } from './harness'
import type { TenantScope } from '../base'

/**
 * Both surfaces under test resolve their tenant through a module that imports
 * `cloudflare:workers`, which has no meaning outside the Worker runtime. Neither
 * is *called* through that door here - the loader's fold is a pure function and
 * `atlasCountryState` takes the scope as an argument - so the door is stubbed
 * rather than opened, and every query below still runs against the real schema
 * in the real harness.
 */
vi.mock('#/routes/_app/-server/context', () => ({
  appScope: (): Promise<never> => {
    throw new Error('Route loaders are not driven by this suite.')
  },
}))
vi.mock('#/server/fns/context', () => ({
  appScope: (): Promise<never> => {
    throw new Error('Server functions are not driven by this suite.')
  },
}))

const { ATLAS_BUCKET_LIST_LIMIT, bucketListCountriesOf } = await import(
  '#/routes/_app/-server/library'
)
const { atlasCountryState } = await import('#/server/fns/atlas')

/** The day every count in this file stops at, so a passing run does not depend on the calendar. */
const TODAY = '2026-08-20'

interface SeedTripInput {
  readonly title: string
  readonly countryCodes: ReadonlyArray<string>
  readonly startDate?: string
  readonly endDate?: string
  /** `[countryCode, isVisited]` for each place on the trip. */
  readonly places?: ReadonlyArray<readonly [string, boolean]>
}

async function seedTrip(scope: TenantScope, input: SeedTripInput): Promise<string> {
  const trip = await createTrip(scope, {
    title: input.title,
    countryCodes: [...input.countryCodes],
    startDate: input.startDate,
    endDate: input.endDate,
  })
  for (const [countryCode, isVisited] of input.places ?? []) {
    await createPlace(scope, {
      tripId: trip.id,
      name: `${input.title} · ${countryCode}`,
      countryCode,
      isVisited,
    })
  }
  return trip.id
}

/** The three reads the atlas loader fans out, folded exactly as the loader folds them. */
async function atlasRecords(
  scope: TenantScope,
  userId: string,
): Promise<Array<AtlasCountryRecord>> {
  const [visited, tripTallies, placeTallies] = await Promise.all([
    listVisitedCountries(scope, userId),
    countTripsByCountry(scope, { until: TODAY }),
    countVisitedPlacesByCountry(scope),
  ])
  return atlasCountryRecords(visited, tripTallies, placeTallies)
}

function recordFor(
  records: ReadonlyArray<AtlasCountryRecord>,
  countryCode: string,
): AtlasCountryRecord | undefined {
  return records.find((row) => row.countryCode === countryCode)
}

describe('atlas country facts', () => {
  let harness: Harness
  let tenant: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('atlas')
    // A plan that sells more than the free tier's two trips: these tests are about counting
    // several of them, not about the quota boundary, which has its own suite.
    await subscribeTenant(tenant.scope, 'solo')
  })

  it('counts several trips and several visited places for one country', async () => {
    await markCountryVisited(tenant.scope, {
      countryCode: 'PT',
      continent: 'Europe',
      visitedOn: '2019-09-21',
      note: 'Porto first, Lisbon later.',
    })
    await seedTrip(tenant.scope, {
      title: 'Porto',
      countryCodes: ['PT'],
      startDate: '2019-09-21',
      endDate: '2019-09-28',
      places: [
        ['PT', true],
        ['PT', true],
        ['PT', false],
      ],
    })
    await seedTrip(tenant.scope, {
      title: 'Lisbon',
      countryCodes: ['PT'],
      startDate: '2026-08-17',
      endDate: '2026-08-23',
      places: [['PT', true]],
    })
    // One trip, two countries: it counts once on each side, and Spain's months are its own.
    await markCountryVisited(tenant.scope, {
      countryCode: 'ES',
      continent: 'Europe',
      visitedOn: '2023-05-04',
    })
    await seedTrip(tenant.scope, {
      title: 'Iberian rail',
      countryCodes: ['PT', 'ES'],
      startDate: '2023-05-04',
      endDate: '2023-05-14',
      places: [
        ['PT', true],
        ['ES', true],
      ],
    })

    const records = await atlasRecords(tenant.scope, tenant.ownerUserId)

    expect(recordFor(records, 'PT')).toEqual({
      countryCode: 'PT',
      continent: 'Europe',
      firstVisitedOn: '2019-09-21',
      lastVisitedOn: '2019-09-21',
      visitCount: 1,
      note: 'Porto first, Lisbon later.',
      tripCount: 3,
      visitedPlaceCount: 4,
      firstTripOn: '2019-09-21',
      lastTripOn: '2026-08-17',
    })
    // The tally and the trip count are different numbers about the same country, and the card
    // would be lying if it printed one under the other's heading.
    expect(recordFor(records, 'PT')?.visitCount).not.toBe(recordFor(records, 'PT')?.tripCount)

    expect(recordFor(records, 'ES')).toMatchObject({
      countryCode: 'ES',
      tripCount: 1,
      visitedPlaceCount: 1,
      firstTripOn: '2023-05-04',
      lastTripOn: '2023-05-04',
    })
  })

  it('reports zero trips, zero places and no months for a country marked visited by hand', async () => {
    await markCountryVisited(tenant.scope, {
      countryCode: 'PE',
      continent: 'South America',
      visitedOn: '2014-02-11',
    })
    await seedTrip(tenant.scope, {
      title: 'Lisbon',
      countryCodes: ['PT'],
      startDate: '2026-08-17',
      places: [['PT', true]],
    })

    const [tripTallies, placeTallies] = await Promise.all([
      countTripsByCountry(tenant.scope, { until: TODAY }),
      countVisitedPlacesByCountry(tenant.scope),
    ])

    // Neither aggregate names Peru at all - the fold is what turns that into a number.
    expect(tripTallies.map((row) => row.countryCode)).toEqual(['PT'])
    expect(placeTallies.map((row) => row.countryCode)).toEqual(['PT'])

    const records = await atlasRecords(tenant.scope, tenant.ownerUserId)
    expect(recordFor(records, 'PE')).toEqual({
      countryCode: 'PE',
      continent: 'South America',
      firstVisitedOn: '2014-02-11',
      lastVisitedOn: '2014-02-11',
      visitCount: 1,
      note: null,
      tripCount: 0,
      visitedPlaceCount: 0,
      firstTripOn: null,
      lastTripOn: null,
    })
  })

  it('leaves a country the trips merely named out of the visited record', async () => {
    await markCountryVisited(tenant.scope, {
      countryCode: 'AR',
      continent: 'South America',
      visitedOn: '2021-12-04',
    })
    // The same trip crossed into Chile, and no one wrote Chile down.
    await seedTrip(tenant.scope, {
      title: 'Patagonia traverse',
      countryCodes: ['AR', 'CL'],
      startDate: '2021-12-04',
      endDate: '2021-12-20',
      places: [
        ['CL', true],
        ['CL', true],
        ['AR', true],
      ],
    })

    const records = await atlasRecords(tenant.scope, tenant.ownerUserId)

    // Presence in this array is what "visited" means to the map's fill and to the panel's
    // countries-visited count, so an itinerary that mentioned Chile does not put it here.
    expect(records.map((row) => row.countryCode)).toEqual(['AR'])
    expect(recordFor(records, 'CL')).toBeUndefined()
    expect(recordFor(records, 'AR')).toEqual({
      countryCode: 'AR',
      continent: 'South America',
      firstVisitedOn: '2021-12-04',
      lastVisitedOn: '2021-12-04',
      visitCount: 1,
      note: null,
      tripCount: 1,
      visitedPlaceCount: 1,
      firstTripOn: '2021-12-04',
      lastTripOn: '2021-12-04',
    })

    // Chile's own figures are not lost: they stay in the aggregate that produced them, where
    // nothing reads them as a claim that the traveller has been there.
    const [tripTallies, placeTallies] = await Promise.all([
      countTripsByCountry(tenant.scope, { until: TODAY }),
      countVisitedPlacesByCountry(tenant.scope),
    ])
    expect(tripTallies.find((row) => row.countryCode === 'CL')).toEqual({
      countryCode: 'CL',
      tripCount: 1,
      firstTripOn: '2021-12-04',
      lastTripOn: '2021-12-04',
    })
    expect(placeTallies.find((row) => row.countryCode === 'CL')).toEqual({
      countryCode: 'CL',
      visitedPlaceCount: 2,
    })
  })

  it('folds two visited rows that differ only in the case of the country code', async () => {
    await markCountryVisited(tenant.scope, { countryCode: 'PT', visitedOn: '2019-09-21' })
    await markCountryVisited(tenant.scope, {
      countryCode: 'ES',
      continent: 'Europe',
      visitedOn: '2015-04-11',
      note: 'Written before the code was normalised.',
    })

    // Rewritten under the repository: the unique index is on the stored string, so a row saved
    // before codes were upper-cased sits happily beside its own country.
    const rows = await listVisitedCountries(tenant.scope, tenant.ownerUserId)
    const spanish = rows.find((row) => row.countryCode === 'ES')
    expect(spanish).toBeDefined()
    harness.sqlite
      .prepare('update visited_countries set country_code = ? where id = ?')
      .run('pt', spanish?.id ?? '')

    const records = await atlasRecords(tenant.scope, tenant.ownerUserId)

    expect(records).toHaveLength(1)
    expect(records[0]).toEqual({
      countryCode: 'PT',
      continent: 'Europe',
      firstVisitedOn: '2015-04-11',
      lastVisitedOn: '2019-09-21',
      visitCount: 2,
      note: 'Written before the code was normalised.',
      tripCount: 0,
      visitedPlaceCount: 0,
      firstTripOn: null,
      lastTripOn: null,
    })
  })

  it('leaves out trips that have not started, and trips that name no day at all', async () => {
    // Both countries are on the record, so the only thing separating their figures is whether
    // the trip behind them has happened.
    await markCountryVisited(tenant.scope, { countryCode: 'JP', continent: 'Asia' })
    await markCountryVisited(tenant.scope, { countryCode: 'MA', continent: 'Africa' })
    await seedTrip(tenant.scope, {
      title: 'Kyoto in autumn',
      countryCodes: ['JP'],
      startDate: '2026-10-09',
      endDate: '2026-10-20',
      places: [['JP', false]],
    })
    await seedTrip(tenant.scope, { title: 'Patagonia one day', countryCodes: ['AR'] })
    await seedTrip(tenant.scope, {
      title: 'Marrakech',
      countryCodes: ['MA'],
      startDate: '2025-11-08',
      endDate: '2025-11-15',
    })

    const tripTallies = await countTripsByCountry(tenant.scope, { until: TODAY })

    expect(tripTallies).toEqual([
      { countryCode: 'MA', tripCount: 1, firstTripOn: '2025-11-08', lastTripOn: '2025-11-08' },
    ])
    // A trip booked for October names no month on a card about the past, and an undated draft
    // names none at all - so Japan's card prints no trips rather than a future one.
    const records = await atlasRecords(tenant.scope, tenant.ownerUserId)
    expect(recordFor(records, 'JP')).toMatchObject({
      tripCount: 0,
      visitedPlaceCount: 0,
      firstTripOn: null,
      lastTripOn: null,
    })
    expect(recordFor(records, 'MA')).toMatchObject({
      tripCount: 1,
      firstTripOn: '2025-11-08',
      lastTripOn: '2025-11-08',
    })
  })

  it('counts a country named twice by one itinerary once, whatever case it was stored in', async () => {
    const trip = await createTrip(tenant.scope, {
      title: 'Alpine loop',
      startDate: '2024-07-01',
      endDate: '2024-07-10',
    })
    // Written straight to the column: the JSON array is untyped, and a row that predates the
    // repository's own normalisation is exactly what the `upper()` in the group key is for.
    harness.sqlite
      .prepare('update trips set country_codes = ? where id = ?')
      .run(JSON.stringify(['at', 'AT', 'ch']), trip.id)

    expect(await countTripsByCountry(tenant.scope, { until: TODAY })).toEqual([
      { countryCode: 'AT', tripCount: 1, firstTripOn: '2024-07-01', lastTripOn: '2024-07-01' },
      { countryCode: 'CH', tripCount: 1, firstTripOn: '2024-07-01', lastTripOn: '2024-07-01' },
    ])
  })

  it('survives a trip whose country column is not valid JSON', async () => {
    const broken = await createTrip(tenant.scope, {
      title: 'Imported by hand',
      startDate: '2022-03-02',
    })
    harness.sqlite
      .prepare('update trips set country_codes = ? where id = ?')
      .run('IS,NO', broken.id)
    await seedTrip(tenant.scope, {
      title: 'Reykjavik',
      countryCodes: ['IS'],
      startDate: '2022-02-05',
    })

    expect(await countTripsByCountry(tenant.scope, { until: TODAY })).toEqual([
      { countryCode: 'IS', tripCount: 1, firstTripOn: '2022-02-05', lastTripOn: '2022-02-05' },
    ])
  })

  it('counts only places ticked off, and only where a country was recorded', async () => {
    await seedTrip(tenant.scope, {
      title: 'Rome',
      countryCodes: ['IT'],
      startDate: '2013-06-01',
      places: [
        ['IT', true],
        ['IT', false],
      ],
    })
    const trip = await createTrip(tenant.scope, {
      title: 'Somewhere unfiled',
      startDate: '2013-08-01',
    })
    await createPlace(tenant.scope, {
      tripId: trip.id,
      name: 'A bar with no country',
      isVisited: true,
    })

    expect(await countVisitedPlacesByCountry(tenant.scope)).toEqual([
      { countryCode: 'IT', visitedPlaceCount: 1 },
    ])
  })

  it('refuses a day that is not a real calendar date', async () => {
    await expect(
      countTripsByCountry(tenant.scope, { until: '2026-02-31' }),
    ).rejects.toThrow(/calendar date/u)
  })

  it('never counts another organisation’s trips or places', async () => {
    const other = await harness.seedTenant('rival')
    await subscribeTenant(other.scope, 'solo')

    await markCountryVisited(tenant.scope, { countryCode: 'PT', continent: 'Europe' })
    await seedTrip(tenant.scope, {
      title: 'Ours',
      countryCodes: ['PT'],
      startDate: '2026-08-17',
      places: [['PT', true]],
    })
    await markCountryVisited(other.scope, { countryCode: 'PT', continent: 'Europe' })
    await seedTrip(other.scope, {
      title: 'Theirs',
      countryCodes: ['PT', 'ES'],
      startDate: '2024-01-05',
      places: [
        ['PT', true],
        ['PT', true],
        ['ES', true],
      ],
    })

    const ours = await atlasRecords(tenant.scope, tenant.ownerUserId)
    expect(ours.map((row) => row.countryCode)).toEqual(['PT'])
    expect(recordFor(ours, 'PT')).toMatchObject({
      tripCount: 1,
      visitedPlaceCount: 1,
      firstTripOn: '2026-08-17',
      lastTripOn: '2026-08-17',
    })

    const theirs = await atlasRecords(other.scope, other.ownerUserId)
    expect(theirs.map((row) => row.countryCode)).toEqual(['PT'])
    expect(recordFor(theirs, 'PT')).toMatchObject({
      tripCount: 1,
      visitedPlaceCount: 2,
      firstTripOn: '2024-01-05',
      lastTripOn: '2024-01-05',
    })
    // Spain was on the rival's itinerary and on nobody's record, so it is on neither atlas - and
    // its two visited places are counted for the rival's scope alone.
    expect(recordFor(theirs, 'ES')).toBeUndefined()
    expect(recordFor(ours, 'ES')).toBeUndefined()
    expect(await countVisitedPlacesByCountry(other.scope)).toEqual([
      { countryCode: 'ES', visitedPlaceCount: 1 },
      { countryCode: 'PT', visitedPlaceCount: 2 },
    ])
    expect(await countVisitedPlacesByCountry(tenant.scope)).toEqual([
      { countryCode: 'PT', visitedPlaceCount: 1 },
    ])

    // And a member of a third organisation reading with their own scope sees the same wall.
    const colleague = await harness.seedTenant('third')
    expect(await atlasRecords(colleague.scope, colleague.ownerUserId)).toEqual([])
    expect(await countTripsByCountry(colleague.scope, { until: TODAY })).toEqual([])
    expect(await countVisitedPlacesByCountry(colleague.scope)).toEqual([])
  })
})

describe('atlas roll-ups the loader reads on their own', () => {
  let harness: Harness
  let tenant: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('atlas')
  })

  /**
   * The atlas loader asks for the continent roll-up and the region count directly rather than
   * through `getAtlasSummary`, which also runs three statements it does not need. That is only
   * safe while the two answers stay identical, so the equality is asserted rather than assumed.
   */
  it('answers exactly what the summary reports', async () => {
    await markCountryVisited(tenant.scope, { countryCode: 'FR', continent: 'Europe' })
    await markCountryVisited(tenant.scope, { countryCode: 'IT', continent: 'Europe' })
    await markCountryVisited(tenant.scope, { countryCode: 'JP', continent: 'Asia' })
    // Recorded without a continent: absent from the roll-up, never a group called "unknown".
    await markCountryVisited(tenant.scope, { countryCode: 'ZZ' })
    await markRegionVisited(tenant.scope, {
      countryCode: 'JP',
      regionCode: 'JP-13',
      regionName: 'Tokyo',
    })
    await markRegionVisited(tenant.scope, {
      countryCode: 'IT',
      regionCode: 'IT-RM',
      regionName: 'Lazio',
    })

    const summary = await getAtlasSummary(tenant.scope, tenant.ownerUserId)

    expect(await countCountriesByContinent(tenant.scope, tenant.ownerUserId)).toEqual([
      { continent: 'Europe', countryCount: 2 },
      { continent: 'Asia', countryCount: 1 },
    ])
    expect(await countCountriesByContinent(tenant.scope, tenant.ownerUserId)).toEqual(
      summary.byContinent,
    )
    expect(await countVisitedRegions(tenant.scope, tenant.ownerUserId)).toBe(2)
    expect(await countVisitedRegions(tenant.scope, tenant.ownerUserId)).toBe(summary.regionCount)
  })

  /**
   * The two surfaces of the atlas, held against each other on the fixture the demo actually ships.
   *
   * The map's card and the shelf's country row read the same record and are written in different
   * files, and for most of a real record they read *different halves* of it: the shelf prints the
   * visit tally, and the card - until this was fixed - printed only the trip aggregates, so a
   * country marked by hand answered "0 trips, no dates" two hundred pixels above its own
   * "3 visits". A product whose two surfaces disagree about the same country has a credibility
   * problem rather than a formatting one, so the agreement is asserted rather than assumed, and it
   * is asserted on the twelve countries the demo workspace seeds rather than on a fixture invented
   * to pass.
   */
  describe('the map card and the shelf agree on the demo fixture', () => {
    /** The demo's atlas, applied through the repository exactly as the seeder applies it. */
    async function seedDemoAtlas(): Promise<Array<AtlasCountryRecord>> {
      for (const country of demoVisitedCountries) {
        for (const visitedOn of country.visits) {
          await markCountryVisited(tenant.scope, {
            countryCode: country.countryCode,
            continent: country.continent,
            visitedOn,
            note: country.note,
          })
        }
      }
      // The one country in the fixture that also has an itinerary behind it, so the trip reading
      // and the visit reading are both exercised by the same pass.
      await seedTrip(tenant.scope, {
        title: 'Lisbon, slowly',
        countryCodes: ['PT'],
        startDate: '2026-08-17',
        endDate: '2026-08-23',
        places: [
          ['PT', true],
          ['PT', true],
        ],
      })
      return atlasRecords(tenant.scope, tenant.ownerUserId)
    }

    it('never prints the no-record card for a country the map fills', async () => {
      const records = await seedDemoAtlas()
      expect(records).toHaveLength(demoVisitedCountries.length)

      for (const record of records) {
        const facts = countryFacts(countryFactColumns(record))
        expect(facts.visited).toBe(true)
        expect(facts.source).not.toBe('none')
        // Whatever the card leads with, it is a number the reader can check against the row on
        // the shelf: the trip count or the visit tally, never an em dash.
        expect(facts.tally.value).toBe(
          formatNumber(
            facts.source === 'visits' ? record.visitCount : record.tripCount,
          ),
        )
        expect(facts.last.value).not.toBeNull()
      }
    })

    it('prints the same tally the shelf prints, for every country with no trip', async () => {
      const records = await seedDemoAtlas()
      const withoutTrips = records.filter((record) => record.tripCount === 0)
      // The state is the fixture's majority, not its edge case - eleven of twelve.
      expect(withoutTrips).toHaveLength(demoVisitedCountries.length - 1)

      for (const record of withoutTrips) {
        const facts = countryFacts(countryFactColumns(record))
        expect(facts.source).toBe('visits')
        // `formatNumber(row.visitCount)` is exactly what the shelf's country row prints.
        expect(facts.tally.value).toBe(formatNumber(record.visitCount))
        expect(facts.tally.label).toBe(record.visitCount === 1 ? 'Visit' : 'Visits')
      }
    })

    /**
     * The two surfaces, side by side, on the same row.
     *
     * The shelf's country row prints `formatNumber(visitCount)` beside `visit`/`visits` and dates
     * the record with {@link visitSpan}; the map's card prints `facts.tally` and coarsens the same
     * two days to months. Nothing here re-derives either reading - both are asked for exactly as
     * their own component asks for them - so a change that moves one and not the other fails here
     * rather than on screen, which is where the contradiction was found.
     */
    it('agrees with the shelf, country by country, on the whole fixture', async () => {
      const records = await seedDemoAtlas()

      for (const record of records) {
        const facts = countryFacts(countryFactColumns(record))
        const span = visitSpan(record.firstVisitedOn, record.lastVisitedOn)
        const shelfTally = formatNumber(record.visitCount)
        const shelfUnit = record.visitCount === 1 ? 'visit' : 'visits'

        if (facts.source === 'visits') {
          expect(facts.tally.value).toBe(shelfTally)
          expect(facts.tally.label.toLowerCase()).toBe(shelfUnit)
        } else {
          // A country with an itinerary leads with its trips, and says so: the number changes
          // meaning only where the unit changes with it.
          expect(facts.tally.value).toBe(formatNumber(record.tripCount))
          expect(facts.tally.label.toLowerCase()).toMatch(/^trips?$/)
        }

        // Whichever record the card is on, neither surface may print a dash where the other
        // prints a date. The shelf works in days and the card in months, so the card's month is
        // the shelf's day coarsened - never a different day, and never nothing.
        expect(span.kind).not.toBe('unrecorded')
        if (span.kind === 'range') {
          expect(facts.last.value).toBe(
            facts.source === 'visits'
              ? formatMonthYear(span.last.iso)
              : formatMonthYear(record.lastTripOn),
          )
        }
        if (span.kind === 'single' && facts.source === 'visits') {
          expect(facts.first.value).toBe(formatMonthYear(span.date.iso))
          expect(facts.last.value).toBe(formatMonthYear(span.date.iso))
        }
      }
    })

    it('reads out the three countries the map fills and the card used to empty', async () => {
      const records = await seedDemoAtlas()
      const summaries = ['FR', 'US', 'TH'].map((code) => {
        const record = recordFor(records, code)
        expect(record).toBeDefined()
        return record === undefined
          ? null
          : countryFacts(countryFactColumns(record))
      })

      expect(summaries.map((facts) => facts?.summary ?? null)).toEqual([
        'France. 3 visits, no places saved. First visit July 2011, last visit September 2024.',
        'United States. 2 visits, no places saved. First visit August 2016, last visit March 2023.',
        'Thailand. 1 visit, no places saved. Visited in November 2017.',
      ])
    })

    it('leaves a country with an itinerary on the trip reading', async () => {
      const records = await seedDemoAtlas()
      const portugal = recordFor(records, 'PT')
      expect(portugal).toMatchObject({ tripCount: 1, visitedPlaceCount: 2, visitCount: 2 })

      expect(portugal).toBeDefined()
      if (portugal === undefined) return
      const facts = countryFacts(countryFactColumns(portugal))
      expect(facts.source).toBe('trips')
      expect(facts.tally.label).toBe('Trip')
      expect(facts.tally.value).toBe('1')
      expect(facts.first.value).toBe('August 2026')
      expect(facts.last.value).toBe('August 2026')
    })
  })

  it('never leaks another organisation’s roll-up', async () => {
    const other = await harness.seedTenant('rival')
    await markCountryVisited(other.scope, { countryCode: 'BR', continent: 'South America' })
    await markRegionVisited(other.scope, {
      countryCode: 'BR',
      regionCode: 'BR-RJ',
      regionName: 'Rio de Janeiro',
    })

    expect(await countCountriesByContinent(tenant.scope, tenant.ownerUserId)).toEqual([])
    expect(await countVisitedRegions(tenant.scope, tenant.ownerUserId)).toBe(0)
    expect(await countCountriesByContinent(other.scope, other.ownerUserId)).toEqual([
      { continent: 'South America', countryCount: 1 },
    ])
    expect(await countVisitedRegions(other.scope, other.ownerUserId)).toBe(1)
  })
})

/* ------------------------------------------- bucket-list membership index */

/**
 * The other half of what the map asks about the country under the pointer: not "have you been
 * there" but "is it already on the list, and which row would I take it off by?".
 *
 * That question has exactly one implementation - `bucketListCountriesOf` in the atlas loader - and
 * it is a different reading of the same table from the one the panel renders. The panel gets
 * `bucketList`, the first {@link ATLAS_BUCKET_LIST_LIMIT} rows, which is a fine answer to "what is
 * still on it" and a wrong answer to "is this one on it": a country at row forty-one is on the
 * list, and a surface that answered "no" would offer to add a goal that already exists.
 *
 * The second failure is quieter and worse. `bucket_list_items` has no unique index on the country,
 * so one country can hold several goals, and two places in this codebase choose between them - the
 * loader here, for the row the map offers to remove, and `atlasCountryState` behind every write,
 * for the row a removal actually removes. If those two ever choose differently the reader presses
 * Remove, the write reports success about a different row, and the country stays on the list. So
 * every case below is asserted against *both*, and the tie-break is exercised on an id pair the
 * two orderings genuinely disagree about rather than on ids that happen to agree.
 */
describe('the bucket-list membership index the map reads', () => {
  let harness: Harness
  let tenant: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('atlas')
  })

  /** Two-letter codes shaped like ISO-3166-1 alpha-2, for filling a list past its cap. */
  const CODE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

  /**
   * An id with a chosen suffix, minted through a function rather than written as a literal.
   *
   * The two ids below are compared against each other at runtime, and that comparison is a claim
   * about the runtime. Written as literals the compiler would settle it at type level and carry
   * the assertion away with it, so the pair goes through here and stays plain `string`.
   */
  function goalId(suffix: string): string {
    return `bkt_${suffix}`
  }

  /**
   * Two ids the two candidate tie-breaks disagree about.
   *
   * `_` sorts after `X` by code point and before it by collation, and `newId()` mints its suffix
   * over an alphabet that holds both - so a workspace with two live goals for one country really
   * can land on such a pair.
   */
  const CODE_POINT_FIRST = goalId('aXb')
  const COLLATION_FIRST = goalId('a_b')

  function syntheticCode(position: number): string {
    const high = CODE_LETTERS[Math.floor(position / CODE_LETTERS.length)]
    return `${high}${CODE_LETTERS[position % CODE_LETTERS.length]}`
  }

  /** A bucket-list row, added through the repository the panel's own form adds one through. */
  async function seedGoal(
    scope: TenantScope,
    input: {
      readonly countryCode?: string | null
      readonly kind?: 'country' | 'region' | 'place'
      readonly name?: string
      readonly sortOrder?: number
    },
  ): Promise<BucketListItem> {
    return createBucketListItem(scope, {
      kind: input.kind ?? 'country',
      name: input.name ?? `Somewhere · ${input.countryCode ?? 'unplaced'}`,
      countryCode: input.countryCode ?? null,
      sortOrder: input.sortOrder,
    })
  }

  /** The whole list, as the loader reads it before folding it. */
  async function goalsOf(scope: TenantScope, userId: string): Promise<Array<BucketListItem>> {
    return listBucketList(scope, userId)
  }

  /** The index, built exactly as the loader builds it. */
  async function indexOf(
    scope: TenantScope,
    userId: string,
  ): Promise<Array<{ countryCode: string; itemId: string; isAchieved: boolean }>> {
    return bucketListCountriesOf(await goalsOf(scope, userId))
  }

  function rowFor(
    index: ReadonlyArray<{ countryCode: string; itemId: string; isAchieved: boolean }>,
    countryCode: string,
  ): { countryCode: string; itemId: string; isAchieved: boolean } | null {
    return index.find((row) => row.countryCode === countryCode) ?? null
  }

  /** What the write path would say about the same country, read back from D1 in the same shape. */
  async function writePathGoal(
    scope: TenantScope,
    countryCode: string,
  ): Promise<{ itemId: string; isAchieved: boolean } | null> {
    const state = await atlasCountryState(scope, countryCode)
    return state.bucketGoal === null
      ? null
      : { itemId: state.bucketGoal.id, isAchieved: state.bucketGoal.isAchieved }
  }

  /** Rewrites a primary key, which is the only way to pin the ids a tie-break has to compare. */
  function renameGoal(from: string, to: string): void {
    harness.sqlite.prepare('update bucket_list_items set id = ? where id = ?').run(to, from)
  }

  it('answers for a country the capped list never reaches', async () => {
    const written = new Map<string, string>()
    for (let position = 0; position <= ATLAS_BUCKET_LIST_LIMIT; position += 1) {
      const countryCode = syntheticCode(position)
      const goal = await seedGoal(tenant.scope, { countryCode, sortOrder: position })
      written.set(countryCode, goal.id)
    }
    const beyond = syntheticCode(ATLAS_BUCKET_LIST_LIMIT)

    const bucket = await goalsOf(tenant.scope, tenant.ownerUserId)
    expect(bucket).toHaveLength(ATLAS_BUCKET_LIST_LIMIT + 1)
    // The payload's `bucketList` is this slice, and it stops one row short of the country below.
    const capped = bucket.slice(0, ATLAS_BUCKET_LIST_LIMIT)
    expect(capped.some((row) => row.countryCode === beyond)).toBe(false)

    const index = bucketListCountriesOf(bucket)
    expect(index).toHaveLength(ATLAS_BUCKET_LIST_LIMIT + 1)
    expect(rowFor(index, beyond)).toEqual({
      countryCode: beyond,
      itemId: written.get(beyond),
      isAchieved: false,
    })
    // And the row it names is the row a removal would take off, so the map's offer is honest.
    expect(await writePathGoal(tenant.scope, beyond)).toEqual({
      itemId: written.get(beyond),
      isAchieved: false,
    })
  })

  it('leaves out every row that is not a country goal', async () => {
    const region = await seedGoal(tenant.scope, {
      kind: 'region',
      countryCode: 'IT',
      name: 'The Dolomites in winter',
    })
    const place = await seedGoal(tenant.scope, {
      kind: 'place',
      countryCode: 'IT',
      name: 'Tre Cime at first light',
    })
    // A country goal that never got a code - a name typed before the picker offered one.
    const unplaced = await seedGoal(tenant.scope, {
      countryCode: null,
      name: 'Wherever the northern lights are',
    })
    const country = await seedGoal(tenant.scope, { countryCode: 'IT', name: 'Italy' })

    const index = await indexOf(tenant.scope, tenant.ownerUserId)

    expect(index).toEqual([{ countryCode: 'IT', itemId: country.id, isAchieved: false }])
    const named = index.map((row) => row.itemId)
    expect(named).not.toContain(region.id)
    expect(named).not.toContain(place.id)
    expect(named).not.toContain(unplaced.id)
    // The write path draws the same line: a region inside Italy is not Italy on the list.
    expect(await writePathGoal(tenant.scope, 'IT')).toEqual({
      itemId: country.id,
      isAchieved: false,
    })
  })

  it('answers for a country whose row was stored before codes were upper-cased', async () => {
    const goal = await seedGoal(tenant.scope, { countryCode: 'FR', name: 'France' })
    harness.sqlite
      .prepare('update bucket_list_items set country_code = ? where id = ?')
      .run('fr', goal.id)

    expect(await indexOf(tenant.scope, tenant.ownerUserId)).toEqual([
      { countryCode: 'FR', itemId: goal.id, isAchieved: false },
    ])
    expect(await writePathGoal(tenant.scope, 'FR')).toEqual({
      itemId: goal.id,
      isAchieved: false,
    })
  })

  it('offers the goal still to be reached, whichever of the two was written first', async () => {
    // Ticked off first, set again afterwards.
    const doneFirst = await seedGoal(tenant.scope, { countryCode: 'MX', name: 'Mexico, once' })
    await achieveBucketListItem(tenant.scope, doneFirst.id, '2019-03-02')
    const liveSecond = await seedGoal(tenant.scope, { countryCode: 'MX', name: 'Mexico, again' })

    // The same pair in the other order.
    const liveFirst = await seedGoal(tenant.scope, { countryCode: 'KE', name: 'Kenya, still' })
    const doneSecond = await seedGoal(tenant.scope, { countryCode: 'KE', name: 'Kenya, done' })
    await achieveBucketListItem(tenant.scope, doneSecond.id, '2021-07-14')

    const index = await indexOf(tenant.scope, tenant.ownerUserId)

    expect(rowFor(index, 'MX')).toEqual({
      countryCode: 'MX',
      itemId: liveSecond.id,
      isAchieved: false,
    })
    expect(rowFor(index, 'KE')).toEqual({
      countryCode: 'KE',
      itemId: liveFirst.id,
      isAchieved: false,
    })
    const named = index.map((row) => row.itemId)
    expect(named).not.toContain(doneFirst.id)
    expect(named).not.toContain(doneSecond.id)
    expect(await writePathGoal(tenant.scope, 'MX')).toEqual({
      itemId: liveSecond.id,
      isAchieved: false,
    })
    expect(await writePathGoal(tenant.scope, 'KE')).toEqual({
      itemId: liveFirst.id,
      isAchieved: false,
    })
  })

  it('still names a country whose only goal is already ticked off', async () => {
    const goal = await seedGoal(tenant.scope, { countryCode: 'CU', name: 'Cuba' })
    await achieveBucketListItem(tenant.scope, goal.id, '2018-01-09')

    // On the list and reached: the map must not offer to add it a second time.
    expect(await indexOf(tenant.scope, tenant.ownerUserId)).toEqual([
      { countryCode: 'CU', itemId: goal.id, isAchieved: true },
    ])
    expect(await writePathGoal(tenant.scope, 'CU')).toEqual({ itemId: goal.id, isAchieved: true })
  })

  it('breaks a tie between two live goals exactly as the write path breaks it', async () => {
    const north = await seedGoal(tenant.scope, { countryCode: 'IS', name: 'Iceland, the north' })
    const south = await seedGoal(tenant.scope, { countryCode: 'IS', name: 'Iceland, the south' })

    // The two orderings pick different rows out of this pair, so it is the pair that proves the
    // two surfaces agree rather than merely coincide.
    expect(CODE_POINT_FIRST < COLLATION_FIRST).toBe(true)
    expect(CODE_POINT_FIRST.localeCompare(COLLATION_FIRST)).toBeGreaterThan(0)
    renameGoal(north.id, CODE_POINT_FIRST)
    renameGoal(south.id, COLLATION_FIRST)

    const index = await indexOf(tenant.scope, tenant.ownerUserId)
    const written = await writePathGoal(tenant.scope, 'IS')

    expect(rowFor(index, 'IS')).toEqual({
      countryCode: 'IS',
      itemId: COLLATION_FIRST,
      isAchieved: false,
    })
    expect(written).toEqual({ itemId: COLLATION_FIRST, isAchieved: false })
  })

  it('answers one row per country, in country-code order', async () => {
    for (const countryCode of ['PE', 'JP', 'FR']) {
      await seedGoal(tenant.scope, { countryCode })
    }
    await seedGoal(tenant.scope, { countryCode: 'FR', name: 'France, again' })

    const index = await indexOf(tenant.scope, tenant.ownerUserId)
    expect(index.map((row) => row.countryCode)).toEqual(['FR', 'JP', 'PE'])
  })

  it('answers nothing at all for a list with no country on it', async () => {
    await seedGoal(tenant.scope, {
      kind: 'place',
      countryCode: 'JP',
      name: 'A ryokan with its own onsen',
    })

    expect(await indexOf(tenant.scope, tenant.ownerUserId)).toEqual([])
    expect(bucketListCountriesOf([])).toEqual([])
    expect(await writePathGoal(tenant.scope, 'JP')).toBeNull()
  })

  it('never answers with another organisation’s bucket-list row', async () => {
    const other = await harness.seedTenant('rival')
    const ours = await seedGoal(tenant.scope, { countryCode: 'FR', name: 'France, ours' })
    const theirs = await seedGoal(other.scope, { countryCode: 'FR', name: 'France, theirs' })
    await seedGoal(other.scope, { countryCode: 'BR', name: 'Brazil, theirs' })

    expect(await indexOf(tenant.scope, tenant.ownerUserId)).toEqual([
      { countryCode: 'FR', itemId: ours.id, isAchieved: false },
    ])
    expect(await indexOf(other.scope, other.ownerUserId)).toEqual([
      { countryCode: 'BR', itemId: expect.any(String), isAchieved: false },
      { countryCode: 'FR', itemId: theirs.id, isAchieved: false },
    ])
    expect(await writePathGoal(tenant.scope, 'BR')).toBeNull()

    // A third organisation reading with its own scope sees the same wall from the other side.
    const colleague = await harness.seedTenant('third')
    expect(await indexOf(colleague.scope, colleague.ownerUserId)).toEqual([])
    expect(await writePathGoal(colleague.scope, 'FR')).toBeNull()
  })

  it('never answers with a colleague’s bucket list inside the same organisation', async () => {
    const colleagueId = await tenant.addUser('Ana', 'member')
    const colleagueScope = tenant.scopeFor(colleagueId, 'member')
    const ours = await seedGoal(tenant.scope, { countryCode: 'NO', name: 'Norway, mine' })
    const hers = await seedGoal(colleagueScope, { countryCode: 'NO', name: 'Norway, hers' })

    // The atlas is one person's record of where they mean to go, not the workspace's.
    expect(await indexOf(tenant.scope, tenant.ownerUserId)).toEqual([
      { countryCode: 'NO', itemId: ours.id, isAchieved: false },
    ])
    expect(await indexOf(colleagueScope, colleagueId)).toEqual([
      { countryCode: 'NO', itemId: hers.id, isAchieved: false },
    ])
    expect(await writePathGoal(tenant.scope, 'NO')).toEqual({
      itemId: ours.id,
      isAchieved: false,
    })
    expect(await writePathGoal(colleagueScope, 'NO')).toEqual({
      itemId: hers.id,
      isAchieved: false,
    })
  })

  it('agrees with the write path about every country on a list that holds every awkward row', async () => {
    // Enough live goals to push the interesting ones past the cap.
    for (let position = 0; position < ATLAS_BUCKET_LIST_LIMIT; position += 1) {
      await seedGoal(tenant.scope, { countryCode: syntheticCode(position), sortOrder: position })
    }
    // A country reached and set again, past the cap.
    const reached = await seedGoal(tenant.scope, { countryCode: 'MX', name: 'Mexico, once' })
    await achieveBucketListItem(tenant.scope, reached.id, '2019-03-02')
    await seedGoal(tenant.scope, { countryCode: 'MX', name: 'Mexico, again', sortOrder: 99 })
    // A country whose only goal is ticked off.
    const done = await seedGoal(tenant.scope, { countryCode: 'CU', name: 'Cuba' })
    await achieveBucketListItem(tenant.scope, done.id, '2018-01-09')
    // Two live rivals whose ids the two orderings disagree about.
    const north = await seedGoal(tenant.scope, { countryCode: 'IS', name: 'Iceland, the north' })
    const south = await seedGoal(tenant.scope, { countryCode: 'IS', name: 'Iceland, the south' })
    renameGoal(north.id, CODE_POINT_FIRST)
    renameGoal(south.id, COLLATION_FIRST)
    // A row written before codes were upper-cased, and two rows that are not countries at all.
    const lowercased = await seedGoal(tenant.scope, { countryCode: 'FR', name: 'France' })
    harness.sqlite
      .prepare('update bucket_list_items set country_code = ? where id = ?')
      .run('fr', lowercased.id)
    await seedGoal(tenant.scope, { kind: 'region', countryCode: 'IT', name: 'The Dolomites' })
    await seedGoal(tenant.scope, { countryCode: null, name: 'Wherever the ice is' })
    // And a rival organisation holding the same countries.
    const other = await harness.seedTenant('rival')
    await seedGoal(other.scope, { countryCode: 'FR', name: 'France, theirs' })
    await seedGoal(other.scope, { countryCode: 'IT', name: 'Italy, theirs' })

    const index = await indexOf(tenant.scope, tenant.ownerUserId)

    // The index reaches past the cap, which is the whole reason it exists.
    expect(index.length).toBeGreaterThan(ATLAS_BUCKET_LIST_LIMIT)
    for (const row of index) {
      expect(await writePathGoal(tenant.scope, row.countryCode)).toEqual({
        itemId: row.itemId,
        isAchieved: row.isAchieved,
      })
    }
    // And the countries it leaves out are exactly the ones the write path leaves out too: a
    // region goal, a goal with no country, and a rival's list.
    for (const countryCode of ['IT', 'ZW', 'BR']) {
      expect(rowFor(index, countryCode)).toBeNull()
      expect(await writePathGoal(tenant.scope, countryCode)).toBeNull()
    }
  })
})
