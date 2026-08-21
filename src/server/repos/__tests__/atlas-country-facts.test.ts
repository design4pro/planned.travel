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
 * The last case is the one that matters most and is easiest to get wrong: `GROUP BY` names only the
 * groups it found, so the country marked visited by hand - the whole point of the atlas's manual
 * half - is in neither aggregate, and a card that reads a missing key gets `undefined` where a
 * numeral belongs.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createPlace } from '../places'
import { createTrip } from '../trips'
import {
  countTripsByCountry,
  countVisitedPlacesByCountry,
  countryTravelFactsLookup,
  markCountryVisited,
} from '../atlas'
import { createHarness, subscribeTenant } from './harness'
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

    const [tripTallies, placeTallies] = await Promise.all([
      countTripsByCountry(tenant.scope, { until: TODAY }),
      countVisitedPlacesByCountry(tenant.scope),
    ])
    const factsFor = countryTravelFactsLookup(tripTallies, placeTallies)

    expect(factsFor('PT')).toEqual({
      countryCode: 'PT',
      tripCount: 3,
      visitedPlaceCount: 4,
      firstTripOn: '2019-09-21',
      lastTripOn: '2026-08-17',
    })
    expect(factsFor('ES')).toEqual({
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

    // Neither aggregate names Peru at all - the reader is what turns that into a number.
    expect(tripTallies.map((row) => row.countryCode)).toEqual(['PT'])
    expect(placeTallies.map((row) => row.countryCode)).toEqual(['PT'])

    expect(countryTravelFactsLookup(tripTallies, placeTallies)('PE')).toEqual({
      countryCode: 'PE',
      tripCount: 0,
      visitedPlaceCount: 0,
      firstTripOn: null,
      lastTripOn: null,
    })
  })

  it('leaves out trips that have not started, and trips that name no day at all', async () => {
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
    await createPlace(tenant.scope, { tripId: trip.id, name: 'A bar with no country', isVisited: true })

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

    await seedTrip(tenant.scope, {
      title: 'Ours',
      countryCodes: ['PT'],
      startDate: '2026-08-17',
      places: [['PT', true]],
    })
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

    const ours = countryTravelFactsLookup(
      await countTripsByCountry(tenant.scope, { until: TODAY }),
      await countVisitedPlacesByCountry(tenant.scope),
    )
    expect(ours('PT')).toEqual({
      countryCode: 'PT',
      tripCount: 1,
      visitedPlaceCount: 1,
      firstTripOn: '2026-08-17',
      lastTripOn: '2026-08-17',
    })
    expect(ours('ES').tripCount).toBe(0)
    expect(ours('ES').visitedPlaceCount).toBe(0)

    const theirs = countryTravelFactsLookup(
      await countTripsByCountry(other.scope, { until: TODAY }),
      await countVisitedPlacesByCountry(other.scope),
    )
    expect(theirs('PT')).toEqual({
      countryCode: 'PT',
      tripCount: 1,
      visitedPlaceCount: 2,
      firstTripOn: '2024-01-05',
      lastTripOn: '2024-01-05',
    })
    expect(theirs('ES').tripCount).toBe(1)

    // And a member of one organisation reading with their own scope sees the same wall.
    const colleague = await harness.seedTenant('third')
    expect(await countTripsByCountry(colleague.scope, { until: TODAY })).toEqual([])
    expect(await countVisitedPlacesByCountry(colleague.scope)).toEqual([])
  })
})
