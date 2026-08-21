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

import { beforeEach, describe, expect, it } from 'vitest'
import { createPlace } from '../places'
import { createTrip } from '../trips'
import {
  atlasCountryRecords,
  countCountriesByContinent,
  countTripsByCountry,
  countVisitedPlacesByCountry,
  countVisitedRegions,
  getAtlasSummary,
  listVisitedCountries,
  markCountryVisited,
  markRegionVisited,
} from '../atlas'
import { createHarness, subscribeTenant } from './harness'
import type { AtlasCountryRecord } from '../atlas'
import type { Harness, SeededTenant } from './harness'
import type { TenantScope } from '../base'

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
