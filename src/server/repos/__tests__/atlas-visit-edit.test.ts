import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as atlas from '../atlas'
import { NotFoundError } from '../context'
import { createTrip } from '../trips'
import { statsPeriod } from '#/lib/atlas/stats-period'
import { createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

let harness: Harness
let tenant: SeededTenant
beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('visit-edit')
})
afterEach(() => harness.close())

const edit = {
  countryCode: 'FR',
  firstVisitedOn: '2024-02-29',
  lastVisitedOn: null,
  note: '  Paris  ',
}

it('corrects and clears metadata without changing identity or count', async () => {
  const original = await atlas.markCountryVisited(tenant.scope, {
    countryCode: 'FR',
    continent: 'Europe',
  })
  const region = await atlas.markRegionVisited(tenant.scope, {
    countryCode: 'FR',
    regionCode: 'IDF',
    regionName: 'Île-de-France',
  })
  const result = await atlas.updateCountryVisit(tenant.scope, edit)
  expect(result.visit).toMatchObject({
    id: original.id,
    continent: 'Europe',
    visitCount: 1,
    firstVisitedOn: '2024-02-29',
    note: 'Paris',
  })
  const cleared = await atlas.updateCountryVisit(tenant.scope, {
    ...edit,
    firstVisitedOn: null,
    note: '  ',
  })
  expect(cleared.visit).toMatchObject({
    id: original.id,
    firstVisitedOn: null,
    lastVisitedOn: null,
    note: null,
    visitCount: 1,
    continent: 'Europe',
  })
  expect(
    await atlas.listVisitedRegions(tenant.scope, tenant.ownerUserId),
  ).toEqual([region])
  expect(
    (
      await atlas.updateCountryVisit(tenant.scope, {
        ...edit,
        firstVisitedOn: null,
        note: null,
      })
    ).changed,
  ).toBe(false)
})

it('cannot read or change a colleague or another organization, or recreate an absent visit', async () => {
  const colleague = tenant.scopeFor(await tenant.addUser('colleague'))
  const other = await harness.seedTenant('other-visit-edit')
  for (const scope of [colleague, other.scope]) {
    const row = await atlas.markCountryVisited(scope, { countryCode: 'FR' })
    await expect(
      atlas.updateCountryVisit(tenant.scope, edit),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(await atlas.listVisitedCountries(scope, scope.ctx.userId)).toEqual([
      row,
    ])
  }
  expect(
    await atlas.listVisitedCountries(tenant.scope, tenant.ownerUserId),
  ).toEqual([])
})

it.each([
  { firstVisitedOn: '2025-02-29' },
  { firstVisitedOn: '2024-13-01' },
  { firstVisitedOn: '2024-02-29', lastVisitedOn: '2023-01-01' },
  { note: 'x'.repeat(2001) },
  { userId: 'someone-else' },
])('invalid input writes nothing: %j', async (invalid) => {
  const row = await atlas.markCountryVisited(tenant.scope, {
    countryCode: 'FR',
  })
  await expect(
    atlas.updateCountryVisit(tenant.scope, { ...edit, ...invalid }),
  ).rejects.toThrow()
  expect(
    await atlas.listVisitedCountries(tenant.scope, tenant.ownerUserId),
  ).toEqual([row])
})

it('does not recreate a visit deleted between lookup and update', async () => {
  const row = await atlas.markCountryVisited(tenant.scope, {
    countryCode: 'FR',
  })
  const update = atlas.visitedCountriesRepository.updateWhere
  const spy = vi
    .spyOn(atlas.visitedCountriesRepository, 'updateWhere')
    .mockImplementationOnce(async (...args) => {
      await atlas.unmarkCountryVisited(tenant.scope, row.id)
      return update(...args)
    })
  try {
    await expect(
      atlas.updateCountryVisit(tenant.scope, edit),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(
      await atlas.listVisitedCountries(tenant.scope, tenant.ownerUserId),
    ).toEqual([])
  } finally {
    spy.mockRestore()
  }
})

it('keeps yearly countries trip-derived and manual years out of the period selector', async () => {
  await createTrip(tenant.scope, {
    title: 'Spain',
    startDate: '2023-01-01',
    endDate: '2023-01-02',
    countryCodes: ['ES'],
  })
  await atlas.markCountryVisited(tenant.scope, {
    countryCode: 'FR',
    visitedOn: '2022-01-01',
  })
  await atlas.updateCountryVisit(tenant.scope, edit)
  for (const year of [0, 2022, 2023, 2024])
    await atlas.recomputeTravelStats(tenant.scope, tenant.ownerUserId, year)
  const rows = await atlas.listTravelStats(tenant.scope, tenant.ownerUserId)
  expect(rows.find((row) => row.statYear === 2023)?.countryCount).toBe(1)
  expect(rows.find((row) => row.statYear === 2024)?.countryCount).toBe(0)
  expect(statsPeriod(rows, 0).periods).toEqual([0, 2023])
})
