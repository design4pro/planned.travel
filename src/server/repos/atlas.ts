/**
 * Atlas — the world-map tracker: which countries and regions a traveller has been to, the yearly
 * roll-ups behind the stat cards, and the bucket list of places still to go.
 *
 * `visited_countries` is a **derived but editable** table: {@link markCountryVisited} maintains it as
 * trips and check-ins happen, and the traveller can also correct it by hand, which is why it is stored
 * rather than recomputed on every read. {@link recomputeTravelStats} rebuilds the numeric roll-up from
 * the underlying trips, days, places and expenses.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableName,
  gte,
  inArray,
  isNotNull,
  lte,
  sql,
  sum,
} from 'drizzle-orm'
import { z } from 'zod'
import {
  BUCKET_LIST_KINDS,
  bucketListItems,
  days,
  expenses,
  places,
  transports,
  travelStats,
  trips,
  visitedCountries,
  visitedRegions,
} from '#/server/db/schema'
import { allOf, createTenantRepository, tenantFilter } from './base'
import { memberTripIds } from './trips'
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
export const visitedRegionsRepository = createTenantRepository(
  visitedRegions,
  'visited region',
)
export const travelStatsRepository = createTenantRepository(
  travelStats,
  'travel stats',
)
export const bucketListRepository = createTenantRepository(
  bucketListItems,
  'bucket list item',
)

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
export type CreateBucketListItemInput = z.infer<
  typeof createBucketListItemInput
>

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
export type UpdateBucketListItemInput = z.infer<
  typeof updateBucketListItemInput
>

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
    allOf(
      eq(visitedRegions.userId, userId),
      eq(visitedRegions.regionCode, values.regionCode),
    ),
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
      options.achieved === undefined
        ? undefined
        : eq(bucketListItems.isAchieved, options.achieved),
    ),
    orderBy: [
      asc(bucketListItems.isAchieved),
      asc(bucketListItems.sortOrder),
      asc(bucketListItems.id),
    ],
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

export async function deleteBucketListItem(
  scope: TenantScope,
  itemId: string,
): Promise<void> {
  await bucketListRepository.requireRemove(scope, itemId)
}

/* -------------------------------------------------------------------------------------------------
 * Per-country facts
 *
 * `visited_countries` answers *whether* a traveller has been somewhere and how many times it was
 * recorded. It cannot answer what the atlas card prints next to a country - how many trips went
 * there, how many places inside it were actually seen, and the months the first and the last of
 * those trips fell in. Those live in `trips` and `places`, and both reads below are shaped for the
 * one caller that needs them: the atlas loader, which wants the whole map's worth of figures in a
 * single statement each, not one statement per country.
 * ---------------------------------------------------------------------------------------------- */

/** What the workspace's trips say about one country. Every field is named for what it counts. */
export interface CountryTripTally {
  /** ISO 3166-1 alpha-2, upper-cased. */
  readonly countryCode: string
  /** Distinct trips whose declared countries include this one. Never the visit tally. */
  readonly tripCount: number
  /** The earliest of those trips' start dates, `YYYY-MM-DD`. */
  readonly firstTripOn: string | null
  /** The latest of those trips' start dates, `YYYY-MM-DD`. */
  readonly lastTripOn: string | null
}

export interface CountryTripTallyOptions {
  /**
   * The last day a trip may have started on and still be counted, `YYYY-MM-DD`.
   *
   * Always the caller's "today", which on this Worker is one decision per request
   * (`serverToday()`), so a screen cannot count one country against one day and its neighbour
   * against another.
   */
  readonly until: string
}

/**
 * Trips per country, with the months the record spans - one grouped statement for the whole map.
 *
 * ## Only trips that have happened
 *
 * A country's card is a record of travel, so a trip that has not begun is not part of it: a
 * fortnight in Japan booked for October is not a trip the traveller has taken, and printing its
 * month under "last trip" on a card about somewhere they went in 2019 states something false in
 * the plainest possible way. So the population is trips whose `start_date` is set and is not after
 * `until`. An undated draft is excluded by the same rule - it names no month, so it can neither
 * be dated nor be said to have happened.
 *
 * ## The workspace's trips, not the member's
 *
 * `trips` is organisation-scoped and this tally keeps it that way: a country card is a record of
 * where the workspace has been, and the traveller-scoped half of the atlas stays where it already
 * is, in `visited_countries`. The stat panel above the map does *not* agree with it any more —
 * {@link recomputeTravelStats} counts only the trips the reader is a member of (ADR 0007), so the
 * trip counts on the two halves of the screen are different figures answering different questions.
 * Whichever surface prints both owes the reader that distinction in words; the labelling is
 * `ADD-06`'s, not this function's.
 *
 * ## One pass over `trips`
 *
 * `trips.country_codes` is a JSON array, which has no index and cannot be joined against. The
 * shape that would be obvious - ask each of the ~175 codes on the map whether the array contains
 * it - is 175 statements, or one statement that re-reads the column 175 times. `json_each` instead
 * expands the array *once per trip row*, turning the column into rows that `GROUP BY` can work on,
 * so the whole map is answered by one pass over `trips` instead of one pass per country.
 *
 * The `json_valid` guard is not decoration: `json_each` raises "malformed JSON" and fails the
 * whole statement on a single bad row, which would take the atlas screen down over one trip
 * imported by hand. A row that is not valid JSON is read as an empty array and drops out of the
 * join, exactly as `NULL` does. Codes are upper-cased in SQL because that is also the grouping
 * key, and a row stored as `pt` must land on `PT` rather than beside it.
 */
export async function countTripsByCountry(
  scope: TenantScope,
  options: CountryTripTallyOptions,
): Promise<Array<CountryTripTally>> {
  const until = dateSchema.parse(options.until)
  const countryCode = sql<string>`upper(trip_country.value)`
  // Qualified by hand: `json_each` exposes an `id` column of its own, so the unqualified `"id"`
  // Drizzle emits for a single-table field list is ambiguous and SQLite refuses the statement.
  const tripsTable = sql.identifier(getTableName(trips))
  const tripId = sql`${tripsTable}.${sql.identifier(trips.id.name)}`
  const tripStart = sql`${tripsTable}.${sql.identifier(trips.startDate.name)}`

  const rows = await scope.db
    .select({
      countryCode,
      tripCount: sql<number>`count(distinct ${tripId})`,
      firstTripOn: sql<string | null>`min(${tripStart})`,
      lastTripOn: sql<string | null>`max(${tripStart})`,
    })
    .from(
      sql`${trips}, json_each(case when json_valid(${trips.countryCodes}) then ${trips.countryCodes} else '[]' end) as trip_country`,
    )
    .where(
      tenantFilter(
        scope,
        trips,
        isNotNull(trips.startDate),
        lte(trips.startDate, until),
      ),
    )
    .groupBy(countryCode)
    .orderBy(countryCode)

  return rows.map((row) => ({
    countryCode: row.countryCode,
    tripCount: Number(row.tripCount),
    firstTripOn: row.firstTripOn,
    lastTripOn: row.lastTripOn,
  }))
}

/** How many saved places inside one country the traveller has ticked off as seen. */
export interface CountryPlaceTally {
  readonly countryCode: string
  readonly visitedPlaceCount: number
}

/**
 * Visited places per country - one grouped statement, straight down `places_org_country_idx`.
 *
 * `is_visited` is the traveller's own assertion that they stood there, which is the figure a card
 * about where someone has been should carry. Counting every saved place instead would put the
 * twenty restaurants shortlisted for a trip that has not left yet on a card whose other three
 * figures are all about the past.
 *
 * The statement filters and groups on `country_code` under a fixed `organization_id`, which is
 * `places_org_country_idx` exactly; `is_visited` is a residual test on the rows the index already
 * narrowed to. Case is folded in JavaScript rather than in SQL on purpose: `upper(country_code)` as
 * the grouping key would throw the index's ordering away and sort every place in the workspace,
 * and the column is written through `countryCodeSchema`, which accepts nothing but upper case. The
 * fold is there for rows written before that rule was.
 */
export async function countVisitedPlacesByCountry(
  scope: TenantScope,
): Promise<Array<CountryPlaceTally>> {
  const rows = await scope.db
    .select({ countryCode: places.countryCode, value: count() })
    .from(places)
    .where(
      tenantFilter(
        scope,
        places,
        isNotNull(places.countryCode),
        eq(places.isVisited, true),
      ),
    )
    .groupBy(places.countryCode)
    .orderBy(places.countryCode)

  const tally = new Map<string, number>()
  for (const row of rows) {
    if (row.countryCode === null) {
      continue
    }
    const code = row.countryCode.toUpperCase()
    tally.set(code, (tally.get(code) ?? 0) + row.value)
  }

  return [...tally]
    .map(([countryCode, visitedPlaceCount]) => ({
      countryCode,
      visitedPlaceCount,
    }))
    .sort((left, right) => left.countryCode.localeCompare(right.countryCode))
}

/** Everything the two aggregates above know about one country, in one row. */
interface CountryTravelFacts {
  readonly countryCode: string
  readonly tripCount: number
  readonly visitedPlaceCount: number
  readonly firstTripOn: string | null
  readonly lastTripOn: string | null
}

/**
 * Both aggregates folded into one reader, keyed by upper-case country code.
 *
 * A `GROUP BY` only names groups it found rows for, so a country the traveller marked visited by
 * hand - no trip behind it, nothing ticked off inside it - appears in neither result. That absence
 * is not the same thing as an unknown: the honest answer for it is zero trips, zero places and no
 * months, and a caller that has to write `?? 0` four times per country will eventually write it
 * three times. So the reader answers for every code that is asked, and the zeroed row is a
 * deliberate value rather than a hole.
 */
function countryTravelFactsLookup(
  tripTallies: ReadonlyArray<CountryTripTally>,
  placeTallies: ReadonlyArray<CountryPlaceTally>,
): (countryCode: string) => CountryTravelFacts {
  const byCode = new Map<string, CountryTravelFacts>()

  const nothingRecorded = (countryCode: string): CountryTravelFacts => ({
    countryCode,
    tripCount: 0,
    visitedPlaceCount: 0,
    firstTripOn: null,
    lastTripOn: null,
  })

  const upsert = (
    countryCode: string,
    patch: Partial<CountryTravelFacts>,
  ): void => {
    const code = countryCode.trim().toUpperCase()
    byCode.set(code, {
      ...(byCode.get(code) ?? nothingRecorded(code)),
      ...patch,
    })
  }

  for (const row of tripTallies) {
    upsert(row.countryCode, {
      tripCount: row.tripCount,
      firstTripOn: row.firstTripOn,
      lastTripOn: row.lastTripOn,
    })
  }
  for (const row of placeTallies) {
    upsert(row.countryCode, { visitedPlaceCount: row.visitedPlaceCount })
  }

  return (countryCode) => {
    const code = countryCode.trim().toUpperCase()
    return byCode.get(code) ?? nothingRecorded(code)
  }
}

/**
 * One country on the traveller's record, carrying both readings of "how much of this country is
 * in the record" side by side and never folded into each other.
 *
 * The field names carry the whole distinction. The `-Visited-` family and `visitCount` come from
 * `visited_countries`, which {@link markCountryVisited} maintains and the traveller may edit by
 * hand: `visitCount` goes up by one every time a visit is recorded, so it is a tally and can sit
 * either side of the number of journeys. The `-Trip-` family comes from `trips`: distinct trips
 * that named this country and have already begun, and the start dates of the earliest and latest
 * of them, which is what a card prints as months. `visitedPlaceCount` counts saved places inside
 * the country the traveller ticked off as seen.
 */
export interface AtlasCountryRecord {
  /** ISO 3166-1 alpha-2, upper-cased. */
  readonly countryCode: string
  /** As `visited_countries` files it. */
  readonly continent: string | null
  /** When the first visit was *recorded*, `YYYY-MM-DD`. */
  readonly firstVisitedOn: string | null
  /** When the last visit was *recorded*, `YYYY-MM-DD`. */
  readonly lastVisitedOn: string | null
  /** Recorded visits - the tally, not a journey count. */
  readonly visitCount: number
  /** The traveller's own note on the country. */
  readonly note: string | null
  /** Trips that have started and name this country. */
  readonly tripCount: number
  /** Saved places inside it the traveller has ticked off as seen. */
  readonly visitedPlaceCount: number
  /** The start date of the earliest of those trips, `YYYY-MM-DD`. */
  readonly firstTripOn: string | null
  /** The start date of the latest of those trips, `YYYY-MM-DD`. */
  readonly lastTripOn: string | null
}

/** The earlier of two `YYYY-MM-DD` days, where absent loses to present. */
function earlierDay(left: string | null, right: string | null): string | null {
  if (left === null) return right
  if (right === null) return left
  return left < right ? left : right
}

/** The later of two `YYYY-MM-DD` days, where absent loses to present. */
function laterDay(left: string | null, right: string | null): string | null {
  if (left === null) return right
  if (right === null) return left
  return left > right ? left : right
}

/**
 * The visited list widened with the two aggregates - one row per country the traveller has
 * recorded, and no others.
 *
 * ## Why the record decides the row set
 *
 * The trip and place aggregates cover the whole workspace, so it is tempting to return their union
 * with the record and let each row say which half it came from. That was tried and it is wrong
 * here: this array is what the map paints its visited fill from and what the panel prints under
 * "countries visited", so every extra row is a country claimed as visited that nobody visited, and
 * a flag distinguishing them is only as good as the least careful of the several consumers reading
 * it. Presence in `visited_countries` is the one thing in this schema that means "I have been
 * here" - {@link markCountryVisited} writes it, {@link unmarkCountryVisited} takes it away, and a
 * trip that merely named a country in its itinerary asserts nothing of the kind. So presence in
 * this array carries exactly that meaning, and no consumer has to be told twice.
 *
 * A country the trips went to and nobody wrote down is therefore absent, and its figures stay
 * where they are legible on their own terms: {@link countTripsByCountry} and
 * {@link countVisitedPlacesByCountry} still name it, and a surface that wants to offer "you have
 * been here - shall I record it?" reads those rather than this.
 *
 * ## Why absence from the aggregates is a zero and not a gap
 *
 * The mirror case runs the other way. A `GROUP BY` names only the groups it found rows for, so a
 * country marked visited by hand - no trip behind it, nothing ticked off inside it - is in neither
 * aggregate. The honest answer for it is zero trips, zero places and no months, which is what
 * {@link countryTravelFactsLookup} returns, so every row here carries all four figures and no
 * caller writes `?? 0`.
 *
 * ## Case
 *
 * Codes are folded to upper case because the three inputs are written by three different rules and
 * a country must not appear twice on a map keyed by ISO code. `visited_countries` carries a unique
 * index per organisation, traveller and code, so two of its rows can only collide across case;
 * when they do they are merged the way {@link markCountryVisited} merges a repeat visit - earliest
 * first, latest last, tallies summed - because dropping one of them would silently lose a date the
 * traveller entered.
 */
export function atlasCountryRecords(
  visited: ReadonlyArray<VisitedCountry>,
  tripTallies: ReadonlyArray<CountryTripTally>,
  placeTallies: ReadonlyArray<CountryPlaceTally>,
): Array<AtlasCountryRecord> {
  const factsFor = countryTravelFactsLookup(tripTallies, placeTallies)
  const byCode = new Map<string, AtlasCountryRecord>()

  for (const row of visited) {
    const countryCode = row.countryCode.trim().toUpperCase()
    const held = byCode.get(countryCode)
    if (held === undefined) {
      const facts = factsFor(countryCode)
      byCode.set(countryCode, {
        countryCode,
        continent: row.continent,
        firstVisitedOn: row.firstVisitedOn,
        lastVisitedOn: row.lastVisitedOn,
        visitCount: row.visitCount,
        note: row.note,
        tripCount: facts.tripCount,
        visitedPlaceCount: facts.visitedPlaceCount,
        firstTripOn: facts.firstTripOn,
        lastTripOn: facts.lastTripOn,
      })
      continue
    }
    byCode.set(countryCode, {
      ...held,
      continent: held.continent ?? row.continent,
      firstVisitedOn: earlierDay(held.firstVisitedOn, row.firstVisitedOn),
      lastVisitedOn: laterDay(held.lastVisitedOn, row.lastVisitedOn),
      visitCount: held.visitCount + row.visitCount,
      note: held.note ?? row.note,
    })
  }

  return [...byCode.values()].sort((left, right) =>
    left.countryCode.localeCompare(right.countryCode),
  )
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

/** How many regions inside any country this traveller has recorded. One statement. */
export async function countVisitedRegions(
  scope: TenantScope,
  userId: string,
): Promise<number> {
  return visitedRegionsRepository.count(
    scope,
    eq(visitedRegions.userId, userId),
  )
}

/**
 * The visited list rolled up by continent, busiest first - one grouped statement.
 *
 * Named and exported rather than left inline in {@link getAtlasSummary} because the atlas loader
 * wants this roll-up without the two bucket-list counts and the second read of the visited list
 * that summary also runs. The alternative - folding the same grouping in JavaScript at that second
 * call site - would be two implementations of one answer, free to drift on the one case that
 * matters: a country recorded with no continent at all is not a group called "unknown", it is
 * simply absent.
 */
export async function countCountriesByContinent(
  scope: TenantScope,
  userId: string,
): Promise<Array<ContinentRollUp>> {
  const rows = await scope.db
    .select({ continent: visitedCountries.continent, value: count() })
    .from(visitedCountries)
    .where(
      tenantFilter(
        scope,
        visitedCountries,
        eq(visitedCountries.userId, userId),
      ),
    )
    .groupBy(visitedCountries.continent)
    .orderBy(desc(count()))

  return rows.flatMap((row) =>
    row.continent === null
      ? []
      : [{ continent: row.continent, countryCount: row.value }],
  )
}

/** Everything the dashboard's atlas tile renders: four scoped reads, five statements. */
export async function getAtlasSummary(
  scope: TenantScope,
  userId: string,
): Promise<AtlasSummary> {
  const [countries, regionCount, byContinent, bucket] = await Promise.all([
    listVisitedCountries(scope, userId),
    countVisitedRegions(scope, userId),
    countCountriesByContinent(scope, userId),
    Promise.all([
      bucketListRepository.count(scope, eq(bucketListItems.userId, userId)),
      bucketListRepository.count(
        scope,
        allOf(
          eq(bucketListItems.userId, userId),
          eq(bucketListItems.isAchieved, true),
        ),
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
    byContinent,
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
 * on: trip count, day count, place count, spend, distance, country and continent spread. Cron and the
 * queue consumer call this; nothing reads it live, because on a busy tenant it is six aggregate
 * queries.
 *
 * "The trips they are on" is literal, and {@link memberTripIds} is where it is enforced: two members
 * of one workspace who travel separately get two different rows.
 *
 * ## The one figure the rule does not reach
 *
 * `regionCount` is not trip-derived. It is a lifetime count of this traveller's `visited_regions`,
 * written unchanged onto every year row, so 2026, 2025 and all-time all print the same number — the
 * shape the `yearCodes` comment below rejects for countries. It is already per-traveller, so the
 * `00-S4` amendment leaves it alone; year-scoping it through `visited_regions.first_visited_on` moves
 * a figure this amendment did not set out to move, and is a ticket of its own.
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
    .where(
      tenantFilter(
        scope,
        trips,
        yearFilter,
        inArray(trips.id, memberTripIds(scope, userId)),
      ),
    )
    .orderBy(desc(trips.startDate))

  const tripIds = tripRows.map((row) => row.id)

  /**
   * Distance is the one aggregate that is *not* read through `tripIds`.
   *
   * A transport carries its own `departure_date`, and a trip that starts on 30 December has
   * transports in two calendar years; filtering them by the trip's `start_date` would file
   * January's flight under the previous year. So a year row sums the transports that departed in
   * that year, over the same population the trip rows come from — {@link memberTripIds} against
   * `transports.trip_id`, because the transport is reached by its own date rather than through
   * `tripIds`. A transport with no distance recorded
   * contributes nothing, and a year with no distances at all writes `0` rather than leaving the
   * column at whatever a fixture put there.
   */
  const transportYearFilter =
    statYear === 0
      ? undefined
      : allOf(
          gte(transports.departureDate, `${statYear}-01-01`),
          lte(transports.departureDate, `${statYear}-12-31`),
        )

  const [dayCount, placeCount, cityRows, spendRow, distanceRow, countries] =
    await Promise.all([
      tripIds.length === 0
        ? Promise.resolve(0)
        : countRows(
            scope.db
              .select({ value: count() })
              .from(days)
              .where(tenantFilter(scope, days, inArray(days.tripId, tripIds))),
          ),
      tripIds.length === 0
        ? Promise.resolve(0)
        : countRows(
            scope.db
              .select({ value: count() })
              .from(places)
              .where(
                tenantFilter(scope, places, inArray(places.tripId, tripIds)),
              ),
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
            .where(
              tenantFilter(scope, expenses, inArray(expenses.tripId, tripIds)),
            ),
      scope.db
        .select({ value: sum(transports.distanceMetres) })
        .from(transports)
        .where(
          tenantFilter(
            scope,
            transports,
            transportYearFilter,
            inArray(transports.tripId, memberTripIds(scope, userId)),
          ),
        ),
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
    regionCount: await visitedRegionsRepository.count(
      scope,
      eq(visitedRegions.userId, userId),
    ),
    spendMinor: Number(spendRow[0]?.value ?? 0),
    distanceMetres: Number(distanceRow[0]?.value ?? 0),
    currency: tripRows[0]?.currency,
    lastTripId: tripRows[0]?.id ?? null,
    byContinent,
  })
}

async function countRows(
  query: PromiseLike<Array<{ value: number }>>,
): Promise<number> {
  const rows = await query
  return rows[0]?.value ?? 0
}
