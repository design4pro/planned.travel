/**
 * Reads for the four traveller-level surfaces that are not scoped to one trip:
 * the vacation planner, the atlas, the travel journal and saved collections.
 */
import { createServerFn } from '@tanstack/react-start'
import { COLLECTION_PLACE_STATUSES } from '#/server/db/schema'
import { canManageCollection } from '#/server/repos/collections'
import { z } from 'zod'

import {
  atlasCountryRecords,
  countCollectionPlacesByCountry,
  countCountriesByContinent,
  countTripsByCountry,
  countVisitedPlacesByCountry,
  countVisitedRegions,
  createCollection,
  createJourney,
  ensurePlan,
  getCollection,
  getJourneyStory,
  getPlanOverview,
  journalCoverage,
  listBucketList,
  listCollectionPlacesWithLabels,
  listCollectionsWithCounts,
  listJourneysWithCounts,
  listLabels,
  listMoods,
  listPastTrips,
  listRecentEntries,
  listTravelStats,
  listUnattachedPhotos,
  listTripsWithoutJourney,
  listUserProfiles,
  listVisitedCountries,
  tallyMoods,
} from '#/server/repos'
import { ABSENT } from '#/lib/absence'
import { nullWhenMissing } from '#/server/fns/-lib/absence'
import { appScope } from './context'
import { createCollectionSchema } from './library-wire'
import { currentYear, isoOf, isoOfRequired, todayIso } from '#/server/serialise'

import type { OrAbsent } from '#/lib/absence'

const idInput = z.string().trim().min(1).max(64)

export interface PersonRef {
  readonly userId: string
  readonly name: string
  readonly image: string | null
}

async function peopleFor(
  scope: Awaited<ReturnType<typeof appScope>>,
  userIds: ReadonlyArray<string>,
): Promise<Array<PersonRef>> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) {
    return []
  }
  const profiles = await listUserProfiles(scope, unique)
  const byUser = new Map(profiles.map((row) => [row.userId, row]))
  return unique.map((userId) => ({
    userId,
    name: byUser.get(userId)?.name ?? 'Removed traveller',
    image: byUser.get(userId)?.image ?? null,
  }))
}

/* ------------------------------------------------------------------- vacay */

export interface VacayEntryRow {
  readonly id: string
  readonly userId: string
  readonly date: string
  readonly kind: string
  readonly note: string | null
}

export interface VacayPayload {
  readonly year: number
  readonly weekStartsOn: number
  readonly plan: {
    readonly id: string
    readonly name: string
    readonly blockWeekends: boolean
    readonly holidaysEnabled: boolean
    readonly companyHolidaysEnabled: boolean
    readonly carryOverEnabled: boolean
    readonly defaultEntitlementDays: number
  }
  readonly entries: ReadonlyArray<VacayEntryRow>
  readonly companyHolidays: ReadonlyArray<{
    readonly id: string
    readonly date: string
    readonly label: string | null
  }>
  readonly calendars: ReadonlyArray<{
    readonly id: string
    readonly region: string
    readonly label: string | null
    readonly colour: string
  }>
  readonly balances: ReadonlyArray<{
    readonly userId: string
    readonly entitlementDays: number
    readonly carriedOverDays: number
    readonly usedDays: number
    readonly remainingDays: number
  }>
  readonly colours: ReadonlyArray<{
    readonly userId: string
    readonly colour: string
  }>
  readonly people: ReadonlyArray<PersonRef>
  readonly viewerUserId: string
}

export const loadVacay = createServerFn({ method: 'GET' })
  .validator(
    z.object({ year: z.number().int().min(1970).max(2200).optional() }),
  )
  .handler(async ({ data }): Promise<VacayPayload> => {
    const scope = await appScope()
    const year = data.year ?? currentYear()

    const plan = await ensurePlan(scope)
    const overview = await getPlanOverview(scope, plan.id, year)

    const people = await peopleFor(scope, [
      overview.plan.ownerUserId,
      ...overview.members.map((row) => row.userId),
      ...overview.entries.map((row) => row.userId),
    ])

    return {
      year: overview.year,
      // Monday: the schema default, and what every reference month grid uses.
      weekStartsOn: 1,
      viewerUserId: scope.ctx.userId,
      people,
      plan: {
        id: overview.plan.id,
        name: overview.plan.name,
        blockWeekends: overview.plan.blockWeekends,
        holidaysEnabled: overview.plan.holidaysEnabled,
        companyHolidaysEnabled: overview.plan.companyHolidaysEnabled,
        carryOverEnabled: overview.plan.carryOverEnabled,
        defaultEntitlementDays: overview.plan.defaultEntitlementDays,
      },
      entries: overview.entries.map((row) => ({
        id: row.id,
        userId: row.userId,
        date: row.date,
        kind: row.kind,
        note: row.note,
      })),
      companyHolidays: overview.companyHolidays.map((row) => ({
        id: row.id,
        date: row.date,
        label: row.label,
      })),
      calendars: overview.calendars.map((row) => ({
        id: row.id,
        region: row.region,
        label: row.label,
        colour: row.colour,
      })),
      balances: overview.balances.map((row) => ({
        userId: row.userId,
        entitlementDays: row.entitlementDays,
        carriedOverDays: row.carriedOverDays,
        usedDays: row.usedDays,
        remainingDays: row.remainingDays,
      })),
      colours: overview.colours.map((row) => ({
        userId: row.userId,
        colour: row.colour,
      })),
    }
  })

/* ------------------------------------------------------------------- atlas */

export interface AtlasPayload {
  readonly countryCount: number
  readonly regionCount: number
  readonly visitCount: number
  readonly byContinent: ReadonlyArray<{
    readonly continent: string
    readonly countryCount: number
  }>
  /**
   * One row per country the traveller has *recorded*, and no others, carrying
   * both readings of "how much of this country is in the record".
   *
   * Membership is the whole contract: this array is what the map paints its
   * visited fill from, what the panel lists under "countries visited" and what
   * `countryCount` above counts, so a country is here if and only if
   * `visited_countries` names it. A trip whose itinerary mentioned a country
   * asserts that a plan went there, not that the traveller did, and it does not
   * put a row here; its figures stay legible on their own terms in the trip
   * aggregate behind the loader.
   *
   * The two readings must not be confused either, and the field names are the
   * whole defence against confusing them. `visitCount` is a tally:
   * `markCountryVisited` adds one every time a visit is recorded, by a trip, a
   * ticked-off bucket-list goal or the traveller's own hand, and it can
   * therefore be larger *or* smaller than the number of journeys. `tripCount`
   * counts trips - distinct trips in this workspace whose itinerary names the
   * country and which have already begun. A card that printed the tally under
   * the heading "trips" would be wrong about the one number a traveller can
   * check from memory.
   *
   * The `-VisitedOn` pair and the `-TripOn` pair are the same distinction in
   * dates: the first is when a visit was recorded, the second is when the trips
   * behind it actually started, and the card prints the second as months.
   *
   * A country marked visited by hand is in neither aggregate, and its honest
   * figures there are zeros and no months rather than gaps - so every row below
   * carries all four, and no reader has to write `?? 0`.
   */
  readonly countries: ReadonlyArray<{
    readonly countryCode: string
    readonly continent: string | null
    readonly firstVisitedOn: string | null
    readonly lastVisitedOn: string | null
    /** Recorded visits - the tally, not a journey count. */
    readonly visitCount: number
    readonly note: string | null
    /** Trips that have started and name this country. */
    readonly tripCount: number
    /** Saved places inside it that the traveller has ticked off as seen. */
    readonly visitedPlaceCount: number
    /** The start date of the earliest of those trips, `YYYY-MM-DD`. */
    readonly firstTripOn: string | null
    /** The start date of the latest of those trips, `YYYY-MM-DD`. */
    readonly lastTripOn: string | null
  }>
  /**
   * Every country the bucket list names, whichever end of the list it sits at.
   *
   * `bucketList` below is capped, and a cap is fine for a panel that shows the
   * head of a list - but it is not fine for the question "is this country
   * already on it?", which the map asks about whatever country is under the
   * pointer and which must not answer "no" merely because the entry is row
   * forty-one. This array is capped by the world instead: one row per country,
   * never more than there are countries, and about twenty bytes each.
   *
   * `itemId` is the entry a caller would take back off the list, chosen the way
   * `atlasCountryState` chooses it - the live aspiration in front of an
   * already-achieved one, and the lowest id between rivals, so both agree.
   */
  readonly bucketListCountries: ReadonlyArray<{
    readonly countryCode: string
    readonly itemId: string
    readonly isAchieved: boolean
  }>
  /**
   * The head of the bucket list, at most {@link ATLAS_BUCKET_LIST_LIMIT} rows.
   *
   * Bounded because this payload is dehydrated into the SSR document on every
   * request and rendered into a plain `<ul>` that neither virtualises nor
   * paginates: a traveller with four hundred entries paid for all four hundred
   * on every load of a screen whose subject is the map. The two figures below
   * are counted over the whole list, so the panel states the truth about a list
   * it is only showing the top of.
   */
  readonly bucketList: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly kind: string
    readonly countryCode: string | null
    readonly targetYear: number | null
    readonly isAchieved: boolean
  }>
  /** How many bucket-list rows exist, whether or not they travelled. */
  readonly bucketListTotal: number
  /** How many of those are ticked off — again over the whole list. */
  readonly bucketListAchieved: number
  readonly stats: ReadonlyArray<{
    readonly statYear: number
    readonly tripCount: number
    readonly placeCount: number
    readonly cityCount: number
    readonly countryCount: number
    readonly dayCount: number
    readonly distanceMetres: number
    readonly yearStreak: number
  }>
}

/** The world total the atlas counts against — UN member states plus observers. */
export const WORLD_COUNTRY_COUNT = 195

/**
 * How many bucket-list rows the atlas ships.
 *
 * The panel's bucket tab is a scroll container about 300px tall inside a shelf
 * that covers a third of the map; forty rows is already several screens of
 * scrolling past the fold, and every row beyond them is bytes in the streamed
 * document that no reader will reach on this screen. The list is ordered
 * outstanding-first, so the head is the part that answers "what is still on it".
 */
export const ATLAS_BUCKET_LIST_LIMIT = 40

/**
 * The bucket-list entry a country would be taken off by, over the whole list.
 *
 * The same choice `atlasCountryState` makes when a handler answers for one
 * country: a live aspiration in front of one already ticked off, and the lowest
 * id between two rivals, because `bucket_list_items` carries no unique index and
 * a data set can hold both. Deciding it the same way in both places is what
 * stops the map and the write path disagreeing about which row they mean - the
 * map would offer to remove one row and the write would answer about another.
 *
 * "Lowest" therefore has to mean what it means over there, and over there it is
 * `id.localeCompare(id)`, not `<`. The two are genuinely different orders on the
 * ids this schema mints: `newId()` appends a nanoid over `A-Za-z0-9_-`, and on
 * that alphabet `'a_b' < 'aXb'` is false while `'a_b'.localeCompare('aXb')` is
 * negative, because `_` sorts after `X` by code point and before it by collation.
 * A workspace holding two live goals for the same country is all it takes to
 * land on such a pair, so this comparator is the collating one on purpose.
 *
 * Exported because it is the only implementation of the question the map asks of
 * every country under the pointer - "is this one already on the list, and by
 * which row?" - and an answer that is only ever read through a route loader is an
 * answer nothing can hold against the write path. Its suite does exactly that.
 */
export function bucketListCountriesOf(
  items: ReadonlyArray<{
    readonly id: string
    readonly kind: string
    readonly countryCode: string | null
    readonly isAchieved: boolean
  }>,
): Array<{ countryCode: string; itemId: string; isAchieved: boolean }> {
  const byCode = new Map<string, { id: string; isAchieved: boolean }>()

  for (const row of items) {
    if (row.kind !== 'country' || row.countryCode === null) {
      continue
    }
    const code = row.countryCode.toUpperCase()
    const held = byCode.get(code)
    const wins =
      held === undefined ||
      (held.isAchieved && !row.isAchieved) ||
      (held.isAchieved === row.isAchieved && row.id.localeCompare(held.id) < 0)
    if (wins) {
      byCode.set(code, { id: row.id, isAchieved: row.isAchieved })
    }
  }

  return [...byCode]
    .map(([countryCode, entry]) => ({
      countryCode,
      itemId: entry.id,
      isAchieved: entry.isAchieved,
    }))
    .sort((left, right) => left.countryCode.localeCompare(right.countryCode))
}

export const loadAtlas = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AtlasPayload> => {
    const scope = await appScope()
    const userId = scope.ctx.userId
    const today = todayIso()

    // Seven reads in one `Promise.all`, and seven D1 statements: every entry
    // below is exactly one query, so the fan-out is the subrequest count rather
    // than a floor on it. That matters because `getAtlasSummary`, which this
    // loader used to open with, is one call and five statements, and the atlas
    // needed four of the eight figures it returns. Counting honestly, the screen
    // was costing eight statements before the per-country facts existed:
    //
    //   getAtlasSummary  visited countries · visited-region count · continent
    //                    roll-up · bucket total + achieved            = 5
    //   listVisitedCountries   the same visited rows, read a second time  = 1
    //   listBucketList · listTravelStats                                 = 2
    //
    // It now costs seven, with the two aggregates added: the duplicated read of
    // `visited_countries` is gone, and the two bucket counts with it - this
    // loader already holds the whole bucket list and counts it in memory, so
    // asking D1 to count it again was a round trip spent on an answer already in
    // hand. The two roll-ups the summary did have to run are now named exports
    // of the same repository (`countVisitedRegions`, `countCountriesByContinent`)
    // rather than inline statements, so there is still one implementation of the
    // continent grouping and `getAtlasSummary` keeps returning what it always
    // did for the dashboard tile that still wants all eight figures at once. The
    // other two figures it used to hand over - how many countries, how many
    // recorded visits - are `.length` and a sum over rows this handler is already
    // holding, which is a fold rather than a second answer to a query.
    //
    // Seven sits inside the 3-8 D1 queries ARCHITECTURE §2.1 budgets for a warm
    // authenticated document, which is the only per-request D1 figure this
    // project has committed to.
    //
    // The two aggregates are worth their round trip and their bytes. Each is a
    // single grouped statement over the whole workspace - not one per country,
    // and not one per hover - and they overlap the five already in flight, so
    // they cost latency only if they are the slowest of the seven. The bytes are
    // four small fields per country: two integers and two `YYYY-MM-DD` days, on
    // a list as long as the traveller's own record. That is well under a
    // kilobyte for a well-travelled traveller, and
    // it buys the map its whole reason for existing - a country's figures are
    // already in the document when the pointer reaches it, so hovering costs no
    // request, survives a dropped connection after first paint, and cannot flash
    // a skeleton over the shape the reader is already looking at. Fetching them
    // per country instead would be one RPC per pointer crossing.
    //
    // `today` is read once, from the request's own clock (`serverToday()` behind
    // `todayIso()`), and handed to the trip aggregate: every country on the
    // screen is counted against the same day, and a development request can pin
    // that day so the visual gate photographs the same figures on every calendar
    // date.
    const [
      countries,
      regionCount,
      byContinent,
      bucket,
      stats,
      tripsByCountry,
      placesByCountry,
    ] = await Promise.all([
      listVisitedCountries(scope, userId),
      countVisitedRegions(scope, userId),
      countCountriesByContinent(scope, userId),
      listBucketList(scope, userId),
      listTravelStats(scope, userId),
      countTripsByCountry(scope, { until: today }),
      countVisitedPlacesByCountry(scope),
    ])

    // Counted off the folded record rather than off the raw rows, so the figure
    // above the map is the length of the list under it. The two can only differ
    // where a workspace holds the same country twice in different case - the
    // unique index is on the stored string - and there the folded answer is the
    // true one: the traveller has been to one country, not two.
    const records = atlasCountryRecords(
      countries,
      tripsByCountry,
      placesByCountry,
    )

    return {
      countryCount: records.length,
      regionCount,
      visitCount: records.reduce((total, row) => total + row.visitCount, 0),
      byContinent,
      countries: records,
      bucketListCountries: bucketListCountriesOf(bucket),
      // Sliced, and reduced to the six fields the panel prints: `achievedOn` and
      // the item's own note were dehydrated into every document and rendered by
      // nothing.
      bucketList: bucket.slice(0, ATLAS_BUCKET_LIST_LIMIT).map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        countryCode: row.countryCode,
        targetYear: row.targetYear,
        isAchieved: row.isAchieved,
      })),
      bucketListTotal: bucket.length,
      bucketListAchieved: bucket.filter((row) => row.isAchieved).length,
      stats: stats.map((row) => ({
        statYear: row.statYear,
        tripCount: row.tripCount,
        placeCount: row.placeCount,
        cityCount: row.cityCount,
        countryCount: row.countryCount,
        dayCount: row.dayCount,
        distanceMetres: row.distanceMetres,
        yearStreak: row.yearStreak,
      })),
    }
  },
)

/* ----------------------------------------------------------------- journey */

export interface JourneyCard {
  readonly id: string
  readonly title: string
  readonly slug: string
  readonly subtitle: string | null
  readonly status: string
  readonly visibility: string
  readonly coverImageUrl: string | null
  readonly coverGradient: string | null
  readonly startedOn: string | null
  readonly endedOn: string | null
  readonly entryCount: number
  readonly photoCount: number
  readonly updatedAt: string
}

export const loadJourneys = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ readonly journeys: ReadonlyArray<JourneyCard> }> => {
    const scope = await appScope()
    const rows = await listJourneysWithCounts(scope)

    return {
      journeys: rows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        subtitle: row.subtitle,
        status: row.status,
        visibility: row.visibility,
        coverImageUrl: row.coverImageUrl,
        coverGradient: row.coverGradient,
        startedOn: row.startedOn,
        endedOn: row.endedOn,
        entryCount: row.entryCount,
        photoCount: row.photoCount,
        updatedAt: isoOfRequired(row.updatedAt),
      })),
    }
  },
)

/**
 * The journal index's second half: what is actually written, and what is not.
 *
 * The covers alone leave a page that says how many journeys exist and nothing about
 * them. These three reads are the difference between a gallery and a journal:
 * the latest entries, how the days felt across everything, and the trips still
 * waiting for a first word.
 */
export interface JournalOverview {
  readonly recent: ReadonlyArray<{
    readonly id: string
    readonly journeyId: string
    readonly journeyTitle: string
    readonly title: string | null
    readonly excerpt: string | null
    readonly type: string
    readonly entryDate: string
    readonly locationName: string | null
    readonly photoCount: number
    readonly mood: {
      readonly label: string
      readonly emoji: string
      readonly colour: string
    } | null
  }>
  readonly moods: ReadonlyArray<{
    readonly label: string
    readonly emoji: string
    readonly colour: string
    readonly count: number
  }>
  readonly unwritten: ReadonlyArray<{
    readonly id: string
    readonly title: string
    readonly startDate: string | null
    readonly endDate: string | null
    readonly status: string
  }>
  /** Trips in the workspace, and how many of them a journey covers. */
  readonly coverage: { readonly trips: number; readonly written: number }
  /**
   * The server's today, so "ended two months ago" is computed from one clock. A
   * client-side `new Date()` would disagree with the server's render and make the
   * first paint flicker.
   */
  readonly today: string
}

/** The first line of an entry, for a list that shows one line of it. */
function excerptOf(body: string | null): string | null {
  if (body === null) return null
  const trimmed = body.trim()
  if (trimmed === '') return null
  return trimmed.length > 180 ? `${trimmed.slice(0, 179)}…` : trimmed
}

export const loadJournalOverview = createServerFn({ method: 'GET' }).handler(
  async (): Promise<JournalOverview> => {
    const scope = await appScope()
    const [recent, moods, unwritten, coverage] = await Promise.all([
      listRecentEntries(scope, { limit: 6 }),
      tallyMoods(scope),
      listTripsWithoutJourney(scope, { today: todayIso(), limit: 4 }),
      journalCoverage(scope),
    ])

    return {
      recent: recent.map((row) => ({
        id: row.entry.id,
        journeyId: row.journeyId,
        journeyTitle: row.journeyTitle,
        title: row.entry.title,
        excerpt: excerptOf(row.entry.body),
        type: row.entry.type,
        entryDate: row.entry.entryDate,
        locationName: row.entry.locationName,
        photoCount: row.photoCount,
        mood:
          row.mood === null
            ? null
            : {
                label: row.mood.label,
                emoji: row.mood.emoji,
                colour: row.mood.colour,
              },
      })),
      moods: moods.map((row) => ({
        label: row.mood.label,
        emoji: row.mood.emoji,
        colour: row.mood.colour,
        count: row.value,
      })),
      unwritten,
      coverage,
      today: todayIso(),
    }
  },
)

export interface JourneyEntryCard {
  readonly id: string
  readonly type: string
  readonly title: string | null
  readonly body: string | null
  readonly entryDate: string
  readonly entryTime: string | null
  readonly locationName: string | null
  readonly weather: string | null
  readonly temperatureCelsius: number | null
  readonly tags: ReadonlyArray<string>
  readonly authorUserId: string
  readonly mood: {
    readonly label: string
    readonly emoji: string
    readonly colour: string
  } | null
  readonly photos: ReadonlyArray<{
    readonly id: string
    readonly caption: string | null
    readonly storageKey: string
    readonly takenAt: string | null
  }>
}

export interface JourneyStoryPayload {
  readonly journey: JourneyCard
  readonly entries: ReadonlyArray<JourneyEntryCard>
  readonly moods: ReadonlyArray<{
    readonly id: string
    readonly label: string
    readonly emoji: string
    readonly colour: string
  }>
  readonly unattachedPhotos: number
  readonly people: ReadonlyArray<PersonRef>
}

export const loadJourneyStory = createServerFn({ method: 'GET' })
  .validator(z.object({ journeyId: idInput }))
  .handler(async ({ data }): Promise<OrAbsent<JourneyStoryPayload>> => {
    const scope = await appScope()

    const [story, moods, unattached] = await Promise.all([
      nullWhenMissing(() => getJourneyStory(scope, data.journeyId)),
      listMoods(scope),
      listUnattachedPhotos(scope, data.journeyId),
    ])
    if (story === null) return ABSENT

    const people = await peopleFor(
      scope,
      story.entries.map((entry) => entry.entry.authorUserId),
    )

    const photoCount = story.entries.reduce(
      (total, entry) => total + entry.photos.length,
      0,
    )

    return {
      found: true,
      moods: moods.map((mood) => ({
        id: mood.id,
        label: mood.label,
        emoji: mood.emoji,
        colour: mood.colour,
      })),
      unattachedPhotos: unattached.length,
      people,
      journey: {
        id: story.journey.id,
        title: story.journey.title,
        slug: story.journey.slug,
        subtitle: story.journey.subtitle,
        status: story.journey.status,
        visibility: story.journey.visibility,
        coverImageUrl: story.journey.coverImageUrl,
        coverGradient: story.journey.coverGradient,
        startedOn: story.journey.startedOn,
        endedOn: story.journey.endedOn,
        entryCount: story.entries.length,
        photoCount: photoCount + unattached.length,
        updatedAt: isoOfRequired(story.journey.updatedAt),
      },
      entries: story.entries.map(({ entry, photos, mood }) => ({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        body: entry.body,
        entryDate: entry.entryDate,
        entryTime: entry.entryTime,
        locationName: entry.locationName,
        weather: entry.weather,
        temperatureCelsius: entry.temperatureCelsius,
        tags: entry.tags ?? [],
        authorUserId: entry.authorUserId,
        mood:
          mood === null
            ? null
            : { label: mood.label, emoji: mood.emoji, colour: mood.colour },
        photos: photos.map((photo) => ({
          id: photo.id,
          caption: photo.caption,
          storageKey: photo.storageKey,
          takenAt: isoOf(photo.takenAt),
        })),
      })),
    }
  })

/* ------------------------------------------------------------- collections */

export interface CollectionCard {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly description: string | null
  readonly colour: string
  readonly icon: string
  /** Still returned for one release: a tab on the previous bundle renders it (BACKWARD_COMPATIBILITY.md section 2). No screen shows it. */
  readonly visibility: string
  readonly coverImageUrl: string | null
  readonly placeCount: number
  readonly updatedAt: string
}

export const loadCollections = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{
    readonly collections: ReadonlyArray<CollectionCard>
    readonly byCountry: ReadonlyArray<{
      readonly countryCode: string
      readonly value: number
    }>
  }> => {
    const scope = await appScope()

    const [rows, byCountry] = await Promise.all([
      listCollectionsWithCounts(scope),
      countCollectionPlacesByCountry(scope),
    ])

    return {
      byCountry,
      collections: rows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        colour: row.colour,
        icon: row.icon,
        visibility: row.visibility,
        coverImageUrl: row.coverImageUrl,
        placeCount: row.placeCount,
        updatedAt: isoOfRequired(row.updatedAt),
      })),
    }
  },
)

export interface SavedPlaceRow {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly city: string | null
  readonly address: string | null
  readonly countryCode: string | null
  readonly status: (typeof COLLECTION_PLACE_STATUSES)[number]
  readonly priceMinor: number | null
  readonly currency: string | null
  readonly website: string | null
  readonly imageUrl: string | null
  readonly labelIds: ReadonlyArray<string>
  readonly savedBy: string
  readonly createdAt: string
}

export interface CollectionDetailPayload {
  readonly canManage: boolean
  readonly collection: CollectionCard
  readonly labels: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly colour: string
  }>
  readonly places: ReadonlyArray<SavedPlaceRow>
  readonly byStatus: ReadonlyArray<{
    readonly status: string
    readonly value: number
  }>
  readonly people: ReadonlyArray<PersonRef>
}

export const loadCollectionDetail = createServerFn({ method: 'GET' })
  .validator(z.object({ collectionId: idInput }))
  .handler(async ({ data }): Promise<OrAbsent<CollectionDetailPayload>> => {
    const scope = await appScope()

    const collection = await getCollection(scope, data.collectionId)
    if (collection === null) return ABSENT

    const [places, labels] = await Promise.all([
      listCollectionPlacesWithLabels(scope, collection.id),
      listLabels(scope, collection.id),
    ])

    const people = await peopleFor(
      scope,
      places.map((row) => row.savedBy),
    )

    return {
      found: true,
      canManage: canManageCollection(scope, collection),
      people,
      labels: labels.map((row) => ({
        id: row.id,
        name: row.name,
        colour: row.colour,
      })),
      collection: {
        id: collection.id,
        name: collection.name,
        slug: collection.slug,
        description: collection.description,
        colour: collection.colour,
        icon: collection.icon,
        visibility: collection.visibility,
        coverImageUrl: collection.coverImageUrl,
        placeCount: places.length,
        updatedAt: isoOfRequired(collection.updatedAt),
      },
      byStatus: COLLECTION_PLACE_STATUSES.map((status) => ({
        status,
        value: places.filter((row) => row.status === status).length,
      })),
      places: places.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        city: row.city,
        address: row.address,
        countryCode: row.countryCode,
        status: z.enum(COLLECTION_PLACE_STATUSES).parse(row.status),
        priceMinor: row.priceMinor,
        currency: row.currency,
        website: row.website,
        imageUrl: row.imageUrl,
        labelIds: row.labelIds,
        savedBy: row.savedBy,
        createdAt: isoOfRequired(row.createdAt),
      })),
    }
  })

/* ------------------------------------------------------------------- writes */

const dateOrEmpty = z
  .string()
  .trim()
  .regex(/^(\d{4}-\d{2}-\d{2})?$/)

/** Starts a journal. The story itself is written entry by entry afterwards. */
export const createJourneyFn = createServerFn({ method: 'POST' })
  .validator(
    z
      .object({
        title: z.string().trim().min(1).max(120),
        subtitle: z.string().trim().max(160),
        tripId: z.string().trim().max(64),
        startedOn: dateOrEmpty,
        endedOn: dateOrEmpty,
      })
      .refine(
        (value) =>
          value.startedOn === '' ||
          value.endedOn === '' ||
          value.endedOn >= value.startedOn,
        {
          message: 'The end date cannot be before the start date.',
          path: ['endedOn'],
        },
      ),
  )
  .handler(async ({ data }): Promise<{ readonly journeyId: string }> => {
    const scope = await appScope()
    const journey = await createJourney(scope, {
      title: data.title,
      subtitle: data.subtitle === '' ? null : data.subtitle,
      tripId: data.tripId === '' ? null : data.tripId,
      startedOn: data.startedOn === '' ? null : data.startedOn,
      endedOn: data.endedOn === '' ? null : data.endedOn,
    })
    return { journeyId: journey.id }
  })

/** Starts a collection of saved places. */
export const createCollectionFn = createServerFn({ method: 'POST' })
  .validator(createCollectionSchema)
  .handler(async ({ data }): Promise<{ readonly collectionId: string }> => {
    const scope = await appScope()
    // `visibility` is never passed: the column's own default shares it with the workspace.
    const collection = await createCollection(scope, {
      name: data.name,
      description: data.description === '' ? null : data.description,
      colour: data.colour,
    })
    return { collectionId: collection.id }
  })

/** The trips a journal can be attached to, newest first. */
export const loadJourneyTripOptions = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{
    readonly trips: ReadonlyArray<{
      readonly id: string
      readonly title: string
    }>
  }> => {
    const scope = await appScope()
    const rows = await listPastTrips(scope, { today: todayIso(), limit: 30 })
    return { trips: rows.map((trip) => ({ id: trip.id, title: trip.title })) }
  },
)
