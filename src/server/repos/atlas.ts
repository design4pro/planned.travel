/**
 * Atlas — the world-map tracker: which countries and regions a traveller has been to, the yearly
 * roll-ups behind the stat cards, and the bucket list of places still to go.
 *
 * `visited_countries` is a **derived but editable** table: {@link markCountryVisited} maintains it as
 * trips and check-ins happen, and the traveller can also correct it by hand, which is why it is stored
 * rather than recomputed on every read. {@link recomputeTravelStats} rebuilds the numeric roll-up from
 * the underlying trips, days, places and expenses.
 */

import { and, asc, count, desc, eq, gte, inArray, lte, sum } from 'drizzle-orm'
import { z } from 'zod'
import {
  BUCKET_LIST_KINDS,
  bucketListItems,
  days,
  expenses,
  places,
  travelStats,
  trips,
  visitedCountries,
  visitedRegions,
} from '#/server/db/schema'
import { allOf, createTenantRepository, tenantFilter } from './base'
import {
  countryCodeSchema,
  dateSchema,
  definedOnly,
  idSchema,
  latitudeSchema,
  longTextSchema,
  longitudeSchema,
  nonNegativeIntSchema,
  shortTextSchema,
  sortOrderSchema,
  titleSchema,
  yearSchema,
} from './validation'
import type { ContinentCounts } from '#/server/db/schema'
import type {
  BucketListItem,
  TravelStat,
  VisitedCountry,
  VisitedRegion,
} from '#/server/db/types'
import type { TenantScope } from './base'

export const visitedCountriesRepository = createTenantRepository(
  visitedCountries,
  'visited country',
)
export const visitedRegionsRepository = createTenantRepository(visitedRegions, 'visited region')
export const travelStatsRepository = createTenantRepository(travelStats, 'travel stats')
export const bucketListRepository = createTenantRepository(bucketListItems, 'bucket list item')

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

export const markCountryVisitedInput = z.object({
  userId: idSchema.optional(),
  countryCode: countryCodeSchema,
  continent: shortTextSchema.nullish(),
  visitedOn: dateSchema.optional(),
  note: longTextSchema.nullish(),
})
export type MarkCountryVisitedInput = z.infer<typeof markCountryVisitedInput>

export const markRegionVisitedInput = z.object({
  userId: idSchema.optional(),
  countryCode: countryCodeSchema,
  regionCode: z.string().trim().min(1).max(16),
  regionName: titleSchema,
  visitedOn: dateSchema.optional(),
})
export type MarkRegionVisitedInput = z.infer<typeof markRegionVisitedInput>

export const createBucketListItemInput = z.object({
  userId: idSchema.optional(),
  kind: z.enum(BUCKET_LIST_KINDS).optional(),
  name: titleSchema,
  countryCode: countryCodeSchema.nullish(),
  regionCode: shortTextSchema.nullish(),
  lat: latitudeSchema.nullish(),
  lng: longitudeSchema.nullish(),
  note: longTextSchema.nullish(),
  targetYear: yearSchema.nullish(),
  sortOrder: sortOrderSchema.optional(),
})
export type CreateBucketListItemInput = z.infer<typeof createBucketListItemInput>

export const updateBucketListItemInput = z.object({
  kind: z.enum(BUCKET_LIST_KINDS).optional(),
  name: titleSchema.optional(),
  countryCode: countryCodeSchema.nullish(),
  regionCode: shortTextSchema.nullish(),
  lat: latitudeSchema.nullish(),
  lng: longitudeSchema.nullish(),
  note: longTextSchema.nullish(),
  targetYear: yearSchema.nullish(),
  sortOrder: sortOrderSchema.optional(),
})
export type UpdateBucketListItemInput = z.infer<typeof updateBucketListItemInput>

export const upsertTravelStatsInput = z.object({
  userId: idSchema.optional(),
  statYear: nonNegativeIntSchema.max(2200).optional(),
  tripCount: nonNegativeIntSchema.optional(),
  placeCount: nonNegativeIntSchema.optional(),
  cityCount: nonNegativeIntSchema.optional(),
  countryCount: nonNegativeIntSchema.optional(),
  regionCount: nonNegativeIntSchema.optional(),
  dayCount: nonNegativeIntSchema.optional(),
  distanceMetres: nonNegativeIntSchema.optional(),
  spendMinor: nonNegativeIntSchema.optional(),
  currency: z.string().trim().length(3).optional(),
  yearStreak: nonNegativeIntSchema.optional(),
  lastTripId: idSchema.nullish(),
})
export type UpsertTravelStatsInput = z.infer<typeof upsertTravelStatsInput>

/* -------------------------------------------------------------------------------------------------
 * Visited countries and regions
 * ---------------------------------------------------------------------------------------------- */

export async function listVisitedCountries(
  scope: TenantScope,
  userId: string,
): Promise<Array<VisitedCountry>> {
  return visitedCountriesRepository.findMany(scope, {
    where: eq(visitedCountries.userId, userId),
    orderBy: [asc(visitedCountries.countryCode)],
  })
}

/**
 * Records a visit, merging into the existing row for that traveller and country: the earliest date
 * wins `firstVisitedOn`, the latest wins `lastVisitedOn`, and the counter goes up by one.
 */
export async function markCountryVisited(
  scope: TenantScope,
  input: MarkCountryVisitedInput,
): Promise<VisitedCountry> {
  const values = markCountryVisitedInput.parse(input)
  const userId = values.userId ?? scope.ctx.userId
  const visitedOn = values.visitedOn ?? null

  const existing = await visitedCountriesRepository.findOne(
    scope,
    allOf(
      eq(visitedCountries.userId, userId),
      eq(visitedCountries.countryCode, values.countryCode),
    ),
  )

  if (!existing) {
    return visitedCountriesRepository.insert(scope, {
      userId,
      countryCode: values.countryCode,
      continent: values.continent,
      firstVisitedOn: visitedOn,
      lastVisitedOn: visitedOn,
      visitCount: 1,
      note: values.note,
    })
  }

  const earliest =
    visitedOn === null
      ? existing.firstVisitedOn
      : existing.firstVisitedOn === null || visitedOn < existing.firstVisitedOn
        ? visitedOn
        : existing.firstVisitedOn
  const latest =
    visitedOn === null
      ? existing.lastVisitedOn
      : existing.lastVisitedOn === null || visitedOn > existing.lastVisitedOn
        ? visitedOn
        : existing.lastVisitedOn

  return visitedCountriesRepository.requireUpdate(scope, existing.id, {
    firstVisitedOn: earliest,
    lastVisitedOn: latest,
    visitCount: existing.visitCount + 1,
    continent: values.continent ?? existing.continent,
    note: values.note ?? existing.note,
  })
}

export async function unmarkCountryVisited(
  scope: TenantScope,
  visitedCountryId: string,
): Promise<void> {
  await visitedCountriesRepository.requireRemove(scope, visitedCountryId)
}

export async function listVisitedRegions(
  scope: TenantScope,
  userId: string,
): Promise<Array<VisitedRegion>> {
  return visitedRegionsRepository.findMany(scope, {
    where: eq(visitedRegions.userId, userId),
    orderBy: [asc(visitedRegions.countryCode), asc(visitedRegions.regionName)],
  })
}

/** Idempotent: a region already recorded for that traveller is left as it is. */
export async function markRegionVisited(
  scope: TenantScope,
  input: MarkRegionVisitedInput,
): Promise<VisitedRegion> {
  const values = markRegionVisitedInput.parse(input)
  const userId = values.userId ?? scope.ctx.userId

  const existing = await visitedRegionsRepository.findOne(
    scope,
    allOf(eq(visitedRegions.userId, userId), eq(visitedRegions.regionCode, values.regionCode)),
  )
  if (existing) {
    return existing
  }
  return visitedRegionsRepository.insert(scope, {
    userId,
    countryCode: values.countryCode,
    regionCode: values.regionCode,
    regionName: values.regionName,
    firstVisitedOn: values.visitedOn ?? null,
  })
}

export async function unmarkRegionVisited(
  scope: TenantScope,
  visitedRegionId: string,
): Promise<void> {
  await visitedRegionsRepository.requireRemove(scope, visitedRegionId)
}

/* -------------------------------------------------------------------------------------------------
 * Bucket list
 * ---------------------------------------------------------------------------------------------- */

export async function listBucketList(
  scope: TenantScope,
  userId: string,
  options: { readonly achieved?: boolean } = {},
): Promise<Array<BucketListItem>> {
  return bucketListRepository.findMany(scope, {
    where: and(
      eq(bucketListItems.userId, userId),
      options.achieved === undefined ? undefined : eq(bucketListItems.isAchieved, options.achieved),
    ),
    orderBy: [asc(bucketListItems.isAchieved), asc(bucketListItems.sortOrder), asc(bucketListItems.id)],
  })
}

export async function createBucketListItem(
  scope: TenantScope,
  input: CreateBucketListItemInput,
): Promise<BucketListItem> {
  const values = createBucketListItemInput.parse(input)
  return bucketListRepository.insert(scope, {
    ...values,
    userId: values.userId ?? scope.ctx.userId,
  })
}

export async function updateBucketListItem(
  scope: TenantScope,
  itemId: string,
  input: UpdateBucketListItemInput,
): Promise<BucketListItem> {
  return bucketListRepository.requireUpdate(
    scope,
    itemId,
    definedOnly(updateBucketListItemInput.parse(input)),
  )
}

/** Ticks a bucket-list item and, for a country goal, records the country as visited. */
export async function achieveBucketListItem(
  scope: TenantScope,
  itemId: string,
  achievedOn?: string,
): Promise<BucketListItem> {
  const item = await bucketListRepository.requireById(scope, itemId)
  const on = achievedOn === undefined ? undefined : dateSchema.parse(achievedOn)
  const updated = await bucketListRepository.requireUpdate(scope, itemId, {
    isAchieved: true,
    achievedOn: on ?? new Date().toISOString().slice(0, 10),
  })
  if (item.countryCode) {
    await markCountryVisited(scope, {
      userId: item.userId,
      countryCode: item.countryCode,
      visitedOn: updated.achievedOn ?? undefined,
    })
  }
  return updated
}

export async function deleteBucketListItem(scope: TenantScope, itemId: string): Promise<void> {
  await bucketListRepository.requireRemove(scope, itemId)
}

/* -------------------------------------------------------------------------------------------------
 * Roll-ups
 * ---------------------------------------------------------------------------------------------- */

export interface ContinentRollUp {
  readonly continent: string
  readonly countryCount: number
}

export interface AtlasSummary {
  readonly userId: string
  readonly countryCount: number
  readonly regionCount: number
  readonly visitCount: number
  readonly byContinent: ReadonlyArray<ContinentRollUp>
  readonly countryCodes: ReadonlyArray<string>
  readonly bucketList: { readonly total: number; readonly achieved: number }
  readonly latestVisit: VisitedCountry | null
}

/** Everything the atlas screen renders above the map, in four scoped reads. */
export async function getAtlasSummary(
  scope: TenantScope,
  userId: string,
): Promise<AtlasSummary> {
  const [countries, regionCount, continentRows, bucket] = await Promise.all([
    listVisitedCountries(scope, userId),
    visitedRegionsRepository.count(scope, eq(visitedRegions.userId, userId)),
    scope.db
      .select({ continent: visitedCountries.continent, value: count() })
      .from(visitedCountries)
      .where(tenantFilter(scope, visitedCountries, eq(visitedCountries.userId, userId)))
      .groupBy(visitedCountries.continent)
      .orderBy(desc(count())),
    Promise.all([
      bucketListRepository.count(scope, eq(bucketListItems.userId, userId)),
      bucketListRepository.count(
        scope,
        allOf(eq(bucketListItems.userId, userId), eq(bucketListItems.isAchieved, true)),
      ),
    ]),
  ])

  const sorted = [...countries].sort((left, right) =>
    (right.lastVisitedOn ?? '').localeCompare(left.lastVisitedOn ?? ''),
  )

  return {
    userId,
    countryCount: countries.length,
    regionCount,
    visitCount: countries.reduce((total, row) => total + row.visitCount, 0),
    byContinent: continentRows.flatMap((row) =>
      row.continent === null ? [] : [{ continent: row.continent, countryCount: row.value }],
    ),
    countryCodes: countries.map((row) => row.countryCode),
    bucketList: { total: bucket[0], achieved: bucket[1] },
    latestVisit: sorted[0] ?? null,
  }
}

/* -------------------------------------------------------------------------------------------------
 * Travel stats
 * ---------------------------------------------------------------------------------------------- */

export async function listTravelStats(
  scope: TenantScope,
  userId: string,
): Promise<Array<TravelStat>> {
  return travelStatsRepository.findMany(scope, {
    where: eq(travelStats.userId, userId),
    orderBy: [desc(travelStats.statYear)],
  })
}

export async function getTravelStats(
  scope: TenantScope,
  userId: string,
  statYear = 0,
): Promise<TravelStat | null> {
  return travelStatsRepository.findOne(
    scope,
    allOf(eq(travelStats.userId, userId), eq(travelStats.statYear, statYear)),
  )
}

/** Writes a stats row, creating it on first use. `statYear` 0 is the all-time roll-up. */
export async function upsertTravelStats(
  scope: TenantScope,
  input: UpsertTravelStatsInput & { readonly byContinent?: ContinentCounts },
): Promise<TravelStat> {
  const { byContinent, ...rest } = input
  const values = upsertTravelStatsInput.parse(rest)
  const userId = values.userId ?? scope.ctx.userId
  const statYear = values.statYear ?? 0

  const existing = await getTravelStats(scope, userId, statYear)
  const patch = definedOnly({ ...values, byContinent, computedAt: new Date() })

  if (existing) {
    return travelStatsRepository.requireUpdate(scope, existing.id, patch)
  }
  return travelStatsRepository.insert(scope, {
    ...patch,
    userId,
    statYear,
    computedAt: new Date(),
  })
}

/**
 * Rebuilds a traveller's stats row for one year (or all time, `statYear = 0`) from the trips they are
 * on: trip count, day count, place count, spend, country and continent spread. Cron and the queue
 * consumer call this; nothing reads it live, because on a busy tenant it is five aggregate queries.
 */
export async function recomputeTravelStats(
  scope: TenantScope,
  userId: string,
  statYear = 0,
): Promise<TravelStat> {
  const yearFilter =
    statYear === 0
      ? undefined
      : allOf(
          gte(trips.startDate, `${statYear}-01-01`),
          lte(trips.startDate, `${statYear}-12-31`),
        )

  const tripRows = await scope.db
    .select({
      id: trips.id,
      currency: trips.currency,
      endDate: trips.endDate,
      countryCodes: trips.countryCodes,
    })
    .from(trips)
    .where(tenantFilter(scope, trips, yearFilter))
    .orderBy(desc(trips.startDate))

  const tripIds = tripRows.map((row) => row.id)

  const [dayCount, placeCount, cityRows, spendRow, countries] = await Promise.all([
    tripIds.length === 0
      ? Promise.resolve(0)
      : countRows(scope.db.select({ value: count() }).from(days).where(
          tenantFilter(scope, days, inArray(days.tripId, tripIds)),
        )),
    tripIds.length === 0
      ? Promise.resolve(0)
      : countRows(
          scope.db
            .select({ value: count() })
            .from(places)
            .where(tenantFilter(scope, places, inArray(places.tripId, tripIds))),
        ),
    tripIds.length === 0
      ? Promise.resolve([])
      : scope.db
          .select({ city: places.city })
          .from(places)
          .where(tenantFilter(scope, places, inArray(places.tripId, tripIds)))
          .groupBy(places.city),
    tripIds.length === 0
      ? Promise.resolve([{ value: null }])
      : scope.db
          .select({ value: sum(expenses.amountMinor) })
          .from(expenses)
          .where(tenantFilter(scope, expenses, inArray(expenses.tripId, tripIds))),
    listVisitedCountries(scope, userId),
  ])

  /**
   * A year row counts the countries *that year's trips* went to, not the
   * traveller's lifetime list.
   *
   * `visited_countries` holds one row per country ever, so reading it for a year
   * put the all-time figure on every yearly row — "2026: 12 countries, 2025: 12
   * countries, 12 all time", which reads as a broken aggregate rather than a
   * history. The year's own trips already name their countries, and they are
   * already loaded above, so the honest number costs nothing extra. The all-time
   * row keeps using the visited list, which is the only place a country visited
   * on no recorded trip can come from.
   */
  const yearCodes =
    statYear === 0
      ? null
      : new Set(
          tripRows.flatMap((row) =>
            (row.countryCodes ?? []).map((code) => code.toUpperCase()),
          ),
        )

  const scopedCountries =
    yearCodes === null
      ? countries
      : countries.filter((country) =>
          yearCodes.has(country.countryCode.toUpperCase()),
        )

  const byContinent: ContinentCounts = {}
  for (const country of scopedCountries) {
    const key = country.continent ?? 'unknown'
    byContinent[key] = (byContinent[key] ?? 0) + 1
  }

  return upsertTravelStats(scope, {
    userId,
    statYear,
    tripCount: tripRows.length,
    dayCount,
    placeCount,
    cityCount: cityRows.filter((row) => row.city !== null).length,
    countryCount: yearCodes === null ? countries.length : yearCodes.size,
    regionCount: await visitedRegionsRepository.count(scope, eq(visitedRegions.userId, userId)),
    spendMinor: Number(spendRow[0]?.value ?? 0),
    currency: tripRows[0]?.currency,
    lastTripId: tripRows[0]?.id ?? null,
    byContinent,
  })
}

async function countRows(query: PromiseLike<Array<{ value: number }>>): Promise<number> {
  const rows = await query
  return rows[0]?.value ?? 0
}
