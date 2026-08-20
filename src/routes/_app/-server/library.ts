/**
 * Reads for the four traveller-level surfaces that are not scoped to one trip:
 * the vacation planner, the atlas, the travel journal and saved collections.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  countCollectionPlacesByCountry,
  createCollection,
  createJourney,
  ensurePlan,
  getAtlasSummary,
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
import { appScope } from './context'
import { currentYear, isoOf, isoOfRequired, todayIso } from './serialise'

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
  readonly countries: ReadonlyArray<{
    readonly countryCode: string
    readonly continent: string | null
    readonly firstVisitedOn: string | null
    readonly lastVisitedOn: string | null
    readonly visitCount: number
    readonly note: string | null
  }>
  readonly bucketList: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly kind: string
    readonly countryCode: string | null
    readonly targetYear: number | null
    readonly isAchieved: boolean
    readonly achievedOn: string | null
    readonly note: string | null
  }>
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

export const loadAtlas = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AtlasPayload> => {
    const scope = await appScope()
    const userId = scope.ctx.userId

    // Four reads, and every one of them is on screen. A fifth - the six most
    // recent trips - travelled in this payload and was rendered by nothing after
    // the atlas became a map; on Workers each query is a subrequest and every
    // field here is bytes dehydrated into the SSR document, so an unread one is
    // paid for on every request. `listPastTrips` itself stays: the journey
    // loader below still asks for it.
    const [summary, countries, bucket, stats] = await Promise.all([
      getAtlasSummary(scope, userId),
      listVisitedCountries(scope, userId),
      listBucketList(scope, userId),
      listTravelStats(scope, userId),
    ])

    return {
      countryCount: summary.countryCount,
      regionCount: summary.regionCount,
      visitCount: summary.visitCount,
      byContinent: summary.byContinent,
      countries: countries.map((row) => ({
        countryCode: row.countryCode,
        continent: row.continent,
        firstVisitedOn: row.firstVisitedOn,
        lastVisitedOn: row.lastVisitedOn,
        visitCount: row.visitCount,
        note: row.note,
      })),
      bucketList: bucket.map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        countryCode: row.countryCode,
        targetYear: row.targetYear,
        isAchieved: row.isAchieved,
        achievedOn: row.achievedOn,
        note: row.note,
      })),
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
  .handler(async ({ data }): Promise<JourneyStoryPayload> => {
    const scope = await appScope()

    const [story, moods, unattached] = await Promise.all([
      getJourneyStory(scope, data.journeyId),
      listMoods(scope),
      listUnattachedPhotos(scope, data.journeyId),
    ])

    const people = await peopleFor(
      scope,
      story.entries.map((entry) => entry.entry.authorUserId),
    )

    const photoCount = story.entries.reduce(
      (total, entry) => total + entry.photos.length,
      0,
    )

    return {
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
  readonly status: string
  readonly priceMinor: number | null
  readonly currency: string | null
  readonly website: string | null
  readonly imageUrl: string | null
  readonly labelIds: ReadonlyArray<string>
  readonly savedBy: string
  readonly createdAt: string
}

export interface CollectionDetailPayload {
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

const COLLECTION_STATUSES = [
  'idea',
  'shortlisted',
  'planned',
  'visited',
  'rejected',
] as const

export const loadCollectionDetail = createServerFn({ method: 'GET' })
  .validator(z.object({ collectionId: idInput }))
  .handler(async ({ data }): Promise<CollectionDetailPayload> => {
    const scope = await appScope()

    const collection = await getCollection(scope, data.collectionId)
    if (collection === null) {
      throw new Error('That collection no longer exists.')
    }

    const [places, labels] = await Promise.all([
      listCollectionPlacesWithLabels(scope, collection.id),
      listLabels(scope, collection.id),
    ])

    const people = await peopleFor(
      scope,
      places.map((row) => row.savedBy),
    )

    return {
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
      byStatus: COLLECTION_STATUSES.map((status) => ({
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
        status: row.status,
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
  .validator(
    z.object({
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(2000),
      colour: z
        .string()
        .trim()
        .regex(/^#[0-9a-fA-F]{6}$/),
      visibility: z.enum(['private', 'organization', 'public']),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly collectionId: string }> => {
    const scope = await appScope()
    const collection = await createCollection(scope, {
      name: data.name,
      description: data.description === '' ? null : data.description,
      colour: data.colour,
      visibility: data.visibility,
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
