/**
 * Journey — the travel journal: a published story made of dated entries, photos and moods.
 *
 * A journey may be linked to a trip but does not depend on one, so a traveller can write up a trip
 * that was never planned in the app. Publishing mints a `publicToken`; revoking clears it, which is
 * what makes a shared link stop working immediately.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  ne,
  not,
  notInArray,
  sql,
} from 'drizzle-orm'
import { z } from 'zod'
import {
  COLLECTION_VISIBILITIES,
  JOURNEY_ENTRY_TYPES,
  JOURNEY_STATUSES,
  journeyEntries,
  journeyMoods,
  journeyPhotos,
  journeys,
  trips,
} from '#/server/db/schema'
import {
  allOf,
  anyOf,
  assertQuota,
  createTenantRepository,
  tenantFilter,
} from './base'
import { NotFoundError, RepositoryError, assertCanAdminister } from './context'
import { checkInsRepository } from './collab'
import { stillInWorkspace } from './members'
import { placesRepository, requirePlaceOfTrip } from './places'
import { readableTripFilter, readableTrips, requireTrip } from './trips'
import {
  colourSchema,
  dateSchema,
  definedOnly,
  idSchema,
  instantSchema,
  latitudeSchema,
  longTextSchema,
  longitudeSchema,
  nonNegativeIntSchema,
  shortTextSchema,
  slugSchema,
  slugify,
  sortOrderSchema,
  timeSchema,
  titleSchema,
  urlSchema,
} from './validation'
import type { SQL } from 'drizzle-orm'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type {
  Journey,
  JourneyEntry,
  JourneyMood,
  JourneyPhoto,
} from '#/server/db/types'
import type { TenantScope } from './base'

/** The tenant's own "today", for a ranking that depends on it. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export const journeysRepository = createTenantRepository(journeys, 'journey')
export const journeyEntriesRepository = createTenantRepository(
  journeyEntries,
  'journey entry',
)
export const journeyPhotosRepository = createTenantRepository(
  journeyPhotos,
  'journey photo',
)
export const journeyMoodsRepository = createTenantRepository(
  journeyMoods,
  'mood',
)

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

export const createJourneyInput = z.object({
  tripId: idSchema.nullish(),
  title: titleSchema,
  slug: slugSchema.optional(),
  subtitle: shortTextSchema.nullish(),
  description: longTextSchema.nullish(),
  coverImageUrl: urlSchema.nullish(),
  coverGradient: shortTextSchema.nullish(),
  visibility: z.enum(COLLECTION_VISIBILITIES).optional(),
  startedOn: dateSchema.nullish(),
  endedOn: dateSchema.nullish(),
})
export type CreateJourneyInput = z.infer<typeof createJourneyInput>

export const updateJourneyInput = z.object({
  title: titleSchema.optional(),
  slug: slugSchema.optional(),
  subtitle: shortTextSchema.nullish(),
  description: longTextSchema.nullish(),
  coverImageUrl: urlSchema.nullish(),
  coverGradient: shortTextSchema.nullish(),
  visibility: z.enum(COLLECTION_VISIBILITIES).optional(),
  status: z.enum(JOURNEY_STATUSES).optional(),
  startedOn: dateSchema.nullish(),
  endedOn: dateSchema.nullish(),
})
export type UpdateJourneyInput = z.infer<typeof updateJourneyInput>

const entryFields = {
  moodId: idSchema.nullish(),
  checkInId: idSchema.nullish(),
  sourceTripId: idSchema.nullish(),
  sourcePlaceId: idSchema.nullish(),
  type: z.enum(JOURNEY_ENTRY_TYPES).optional(),
  title: titleSchema.nullish(),
  body: longTextSchema.nullish(),
  entryDate: dateSchema,
  entryTime: timeSchema.nullish(),
  locationName: shortTextSchema.nullish(),
  lat: latitudeSchema.nullish(),
  lng: longitudeSchema.nullish(),
  weather: shortTextSchema.nullish(),
  temperatureCelsius: z.number().finite().min(-100).max(100).nullish(),
  tags: z.array(shortTextSchema.min(1)).max(30).nullish(),
  sortOrder: sortOrderSchema.optional(),
}

export const createEntryInput = z.object({
  journeyId: idSchema,
  ...entryFields,
})
export type CreateEntryInput = z.infer<typeof createEntryInput>

export const updateEntryInput = z.object({
  ...entryFields,
  entryDate: dateSchema.optional(),
})
export type UpdateEntryInput = z.infer<typeof updateEntryInput>

export const addPhotoInput = z.object({
  journeyId: idSchema,
  entryId: idSchema.nullish(),
  storageKey: z.string().trim().min(1).max(512),
  thumbnailKey: z.string().trim().min(1).max(512).nullish(),
  caption: shortTextSchema.nullish(),
  contentType: shortTextSchema.min(1),
  sizeBytes: nonNegativeIntSchema.optional(),
  width: nonNegativeIntSchema.max(100_000).nullish(),
  height: nonNegativeIntSchema.max(100_000).nullish(),
  takenAt: instantSchema.nullish(),
  lat: latitudeSchema.nullish(),
  lng: longitudeSchema.nullish(),
  sortOrder: sortOrderSchema.optional(),
})
export type AddPhotoInput = z.infer<typeof addPhotoInput>

export const createMoodInput = z.object({
  key: slugSchema,
  label: titleSchema,
  emoji: z.string().trim().min(1).max(16),
  colour: colourSchema.optional(),
  sortOrder: sortOrderSchema.optional(),
})
export type CreateMoodInput = z.infer<typeof createMoodInput>

/* -------------------------------------------------------------------------------------------------
 * Slugs
 * ---------------------------------------------------------------------------------------------- */

async function reserveSlug(
  scope: TenantScope,
  desired: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(desired, 'journey')
  for (let attempt = 1; attempt <= 25; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base.slice(0, 74)}-${attempt}`
    const clashes = await journeysRepository.count(
      scope,
      and(
        eq(journeys.slug, candidate),
        excludeId ? ne(journeys.id, excludeId) : undefined,
      ),
    )
    if (clashes === 0) {
      return candidate
    }
  }
  return `${base.slice(0, 68)}-${Date.now().toString(36)}`
}

/* -------------------------------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------------------------------- */

/**
 * Who may read a journey (ADR 0020, narrowed by ADR 0034): whoever may read the trip it names, and
 * every member of the workspace when it names none — except a journey whose trip was deleted, which
 * is its owner's alone. `trip_id` is nulled by that deletion and cannot tell the two apart, so
 * `trip_deleted_at` does.
 *
 * A journey is reachable without its trip ever being read — by id, from the journal index, from the
 * recent-entries strip — so ADR 0007 does not reach it on its own, and until #456 a member who could
 * not open a private trip could still read its whole write-up. An `EXISTS` over `trips` carrying
 * {@link readableTripFilter}, so the trip's own answer is the journey's answer and the two can never
 * disagree; both halves are `tenantFilter()`-bound.
 *
 * `journeys.visibility` is deliberately not read: nothing in the product sets it, so every row holds
 * its `private` default, and honouring it would hide every journey from all but its author.
 */
function readableJourneyFilter(scope: TenantScope): SQL {
  const tripIsReadable = exists(
    scope.db
      .select({ present: sql`1` })
      .from(trips)
      .where(
        tenantFilter(
          scope,
          trips,
          eq(trips.id, journeys.tripId),
          readableTripFilter(scope),
        ),
      ),
  )
  const tripless = allOf(
    isNull(journeys.tripId),
    anyOf(
      isNull(journeys.tripDeletedAt),
      eq(journeys.ownerUserId, scope.ctx.userId),
    ),
  )
  return anyOf(tripless, tripIsReadable)
}

/**
 * {@link readableJourneyFilter} for a row that names its journey by id — an entry or a photo reached
 * without `journeys` in the query. Until #521 those were read and written under the tenant filter
 * alone, so the id of a journey on a trip the caller cannot read was enough to act on it.
 */
function inReadableJourney(scope: TenantScope, journeyId: SQLiteColumn): SQL {
  return exists(
    scope.db
      .select({ present: sql`1` })
      .from(journeys)
      .where(
        tenantFilter(
          scope,
          journeys,
          eq(journeys.id, journeyId),
          readableJourneyFilter(scope),
        ),
      ),
  )
}

/**
 * The journeys the quota counts: every row, less an orphan (ADR 0034) whose owner no longer holds a
 * `member` row in this workspace. Nobody can read, open or delete such a journey, so the slot it
 * holds could never be given back. Worked out when the quota is checked rather than when a person
 * leaves, because people leave through Better Auth's organization endpoints and through the console
 * deleting the user, neither of which passes through this module — and so that the orphan counts
 * again if its owner returns. Nothing is deleted or moved. A journey that never had a trip carries no
 * `trip_deleted_at` and keeps counting, whoever owns it.
 */
function countedJourneyFilter(scope: TenantScope): SQL {
  const ownerHasLeft = not(stillInWorkspace(scope, journeys.ownerUserId))
  return not(
    allOf(
      isNull(journeys.tripId),
      isNotNull(journeys.tripDeletedAt),
      ownerHasLeft,
    ),
  )
}

/**
 * The number the journeys quota is enforced against, and the one the admin overview's journeys meter
 * reports as `used`: `createJourney` and the meter both read it here, so they cannot drift apart.
 *
 * It counts every journey row of the workspace, less the orphans {@link countedJourneyFilter} lets
 * go of, on purpose and not what the caller can read: a journey on a trip the caller is not on, or
 * an orphan owned by another member, holds a slot all the same. A `used` higher than the journeys the
 * caller can list is therefore the meter working. What the quota should count is narrowed in
 * {@link countedJourneyFilter}, and this function follows it.
 */
export function countQuotaJourneys(scope: TenantScope): Promise<number> {
  return journeysRepository.count(scope, countedJourneyFilter(scope))
}

/** A journey the caller may read, or the `NotFoundError` a foreign tenant's id raises. */
async function requireJourney(
  scope: TenantScope,
  journeyId: string,
): Promise<Journey> {
  const journey = await getJourney(scope, journeyId)
  if (journey === null) {
    throw new NotFoundError('journey', journeyId)
  }
  return journey
}

async function requireEntry(
  scope: TenantScope,
  entryId: string,
): Promise<JourneyEntry> {
  const entry = await journeyEntriesRepository.findOne(
    scope,
    allOf(
      eq(journeyEntries.id, entryId),
      inReadableJourney(scope, journeyEntries.journeyId),
    ),
  )
  if (entry === null) {
    throw new NotFoundError('journey entry', entryId)
  }
  return entry
}

async function requirePhoto(
  scope: TenantScope,
  photoId: string,
): Promise<JourneyPhoto> {
  const photo = await journeyPhotosRepository.findOne(
    scope,
    allOf(
      eq(journeyPhotos.id, photoId),
      inReadableJourney(scope, journeyPhotos.journeyId),
    ),
  )
  if (photo === null) {
    throw new NotFoundError('journey photo', photoId)
  }
  return photo
}

export async function listJourneys(
  scope: TenantScope,
  options: {
    readonly status?: (typeof JOURNEY_STATUSES)[number]
    readonly ownerUserId?: string
  } = {},
): Promise<Array<Journey>> {
  return journeysRepository.findMany(scope, {
    where: allOf(
      readableJourneyFilter(scope),
      options.status ? eq(journeys.status, options.status) : undefined,
      options.ownerUserId
        ? eq(journeys.ownerUserId, options.ownerUserId)
        : undefined,
    ),
    orderBy: [desc(journeys.updatedAt)],
  })
}

export async function getJourney(
  scope: TenantScope,
  journeyId: string,
): Promise<Journey | null> {
  return journeysRepository.findOne(
    scope,
    allOf(readableJourneyFilter(scope), eq(journeys.id, journeyId)),
  )
}

export async function getJourneyBySlug(
  scope: TenantScope,
  slug: string,
): Promise<Journey | null> {
  return journeysRepository.findOne(
    scope,
    allOf(readableJourneyFilter(scope), eq(journeys.slug, slug)),
  )
}

export interface JourneySummary extends Journey {
  readonly entryCount: number
  readonly photoCount: number
}

/** Journeys with their entry and photo counts — the journal index. */
export async function listJourneysWithCounts(
  scope: TenantScope,
): Promise<Array<JourneySummary>> {
  const [rows, entryCounts, photoCounts] = await Promise.all([
    listJourneys(scope),
    scope.db
      .select({ journeyId: journeyEntries.journeyId, value: count() })
      .from(journeyEntries)
      .where(tenantFilter(scope, journeyEntries))
      .groupBy(journeyEntries.journeyId),
    scope.db
      .select({ journeyId: journeyPhotos.journeyId, value: count() })
      .from(journeyPhotos)
      .where(tenantFilter(scope, journeyPhotos))
      .groupBy(journeyPhotos.journeyId),
  ])

  const entriesBy = new Map(
    entryCounts.map((row) => [row.journeyId, row.value]),
  )
  const photosBy = new Map(photoCounts.map((row) => [row.journeyId, row.value]))
  return rows.map((row) => ({
    ...row,
    entryCount: entriesBy.get(row.id) ?? 0,
    photoCount: photosBy.get(row.id) ?? 0,
  }))
}

export async function listJourneyEntries(
  scope: TenantScope,
  journeyId: string,
): Promise<Array<JourneyEntry>> {
  return journeyEntriesRepository.findMany(scope, {
    where: allOf(
      eq(journeyEntries.journeyId, journeyId),
      inReadableJourney(scope, journeyEntries.journeyId),
    ),
    orderBy: [
      asc(journeyEntries.entryDate),
      asc(journeyEntries.sortOrder),
      asc(journeyEntries.id),
    ],
  })
}

export interface JourneyEntryWithPhotos {
  readonly entry: JourneyEntry
  readonly photos: ReadonlyArray<JourneyPhoto>
  readonly mood: JourneyMood | null
}

/** A journey's entries in date order, each with its photos and mood — the journal reader. */
export async function getJourneyStory(
  scope: TenantScope,
  journeyId: string,
): Promise<{
  readonly journey: Journey
  readonly entries: ReadonlyArray<JourneyEntryWithPhotos>
}> {
  const journey = await requireJourney(scope, journeyId)
  const entries = await listJourneyEntries(scope, journeyId)

  const [photos, moods] = await Promise.all([
    journeyPhotosRepository.findMany(scope, {
      where: eq(journeyPhotos.journeyId, journeyId),
      orderBy: [asc(journeyPhotos.sortOrder), asc(journeyPhotos.id)],
    }),
    listMoods(scope),
  ])

  const photosByEntry = new Map<string, Array<JourneyPhoto>>()
  for (const photo of photos) {
    if (photo.entryId === null) {
      continue
    }
    const bucket = photosByEntry.get(photo.entryId)
    if (bucket) {
      bucket.push(photo)
    } else {
      photosByEntry.set(photo.entryId, [photo])
    }
  }
  const moodsById = new Map(moods.map((mood) => [mood.id, mood]))

  return {
    journey,
    entries: entries.map((entry) => ({
      entry,
      photos: photosByEntry.get(entry.id) ?? [],
      mood:
        entry.moodId === null ? null : (moodsById.get(entry.moodId) ?? null),
    })),
  }
}

export interface JournalEntryDigest {
  readonly entry: JourneyEntry
  readonly journeyId: string
  readonly journeyTitle: string
  readonly journeyStatus: string
  readonly mood: JourneyMood | null
  readonly photoCount: number
}

/**
 * The newest entries across every journey, newest first.
 *
 * The journal index is otherwise a wall of covers that says nothing about what is
 * *in* the journals. This is the read behind "what did you last write" — the entry,
 * the journey it belongs to, how the day felt and how many photographs came with it.
 */
export async function listRecentEntries(
  scope: TenantScope,
  options: { readonly limit?: number } = {},
): Promise<Array<JournalEntryDigest>> {
  const rows = await scope.db
    .select({
      entry: journeyEntries,
      journeyTitle: journeys.title,
      journeyStatus: journeys.status,
    })
    .from(journeyEntries)
    .innerJoin(
      journeys,
      tenantFilter(scope, journeys, eq(journeys.id, journeyEntries.journeyId)),
    )
    .where(tenantFilter(scope, journeyEntries, readableJourneyFilter(scope)))
    .orderBy(desc(journeyEntries.entryDate), desc(journeyEntries.createdAt))
    .limit(options.limit ?? 6)

  if (rows.length === 0) {
    return []
  }

  const entryIds = rows.map((row) => row.entry.id)
  const [photoCounts, moods] = await Promise.all([
    scope.db
      .select({ entryId: journeyPhotos.entryId, value: count() })
      .from(journeyPhotos)
      .where(
        tenantFilter(
          scope,
          journeyPhotos,
          inArray(journeyPhotos.entryId, entryIds),
        ),
      )
      .groupBy(journeyPhotos.entryId),
    listMoods(scope),
  ])

  const photosBy = new Map(photoCounts.map((row) => [row.entryId, row.value]))
  const moodsById = new Map(moods.map((mood) => [mood.id, mood]))

  return rows.map((row) => ({
    entry: row.entry,
    journeyId: row.entry.journeyId,
    journeyTitle: row.journeyTitle,
    journeyStatus: row.journeyStatus,
    mood:
      row.entry.moodId === null
        ? null
        : (moodsById.get(row.entry.moodId) ?? null),
    photoCount: photosBy.get(row.entry.id) ?? 0,
  }))
}

/**
 * How the journal felt: entry counts per mood, most used first — over the journeys the reader may
 * read, since an aggregate over a story they cannot open leaks it as surely as listing it.
 */
export async function tallyMoods(
  scope: TenantScope,
): Promise<Array<{ readonly mood: JourneyMood; readonly value: number }>> {
  const [rows, moods] = await Promise.all([
    scope.db
      .select({ moodId: journeyEntries.moodId, value: count() })
      .from(journeyEntries)
      .innerJoin(
        journeys,
        tenantFilter(
          scope,
          journeys,
          eq(journeys.id, journeyEntries.journeyId),
        ),
      )
      .where(tenantFilter(scope, journeyEntries, readableJourneyFilter(scope)))
      .groupBy(journeyEntries.moodId)
      .orderBy(desc(count())),
    listMoods(scope),
  ])

  const moodsById = new Map(moods.map((mood) => [mood.id, mood]))
  return (
    rows
      .flatMap((row) => {
        if (row.moodId === null) return []
        const mood = moodsById.get(row.moodId)
        return mood === undefined ? [] : [{ mood, value: row.value }]
      })
      // Most used first, and a tie broken by the tenant's own mood order rather than
      // by whatever the group-by happened to return — a strip that reshuffles itself
      // between two reads of the same data reads as a bug.
      .sort(
        (left, right) =>
          right.value - left.value ||
          left.mood.sortOrder - right.mood.sortOrder ||
          left.mood.label.localeCompare(right.mood.label),
      )
  )
}

export interface UnwrittenTrip {
  readonly id: string
  readonly title: string
  readonly startDate: string | null
  readonly endDate: string | null
  readonly status: string
}

/**
 * Trips nobody has written up yet, in the order a journal keeper reaches for them.
 *
 * A journal's real backlog is not "invent something": it is the trip you took and
 * never wrote about. So the trip that has just *ended* comes first, then the one
 * happening right now, then the next one on the calendar, and last a trip with no
 * dates at all. That ranking cannot be expressed as one `ORDER BY` against a date
 * column — descending puts next year's trip above last month's — so a small window
 * is read in date order and ranked here.
 */
export async function listTripsWithoutJourney(
  scope: TenantScope,
  options: { readonly today?: string; readonly limit?: number } = {},
): Promise<Array<UnwrittenTrip>> {
  const today = dateSchema.parse(options.today ?? todayIso())
  const limit = options.limit ?? 4

  const written = await scope.db
    .select({ tripId: journeys.tripId })
    .from(journeys)
    .where(tenantFilter(scope, journeys))

  const taken = written.flatMap((row) =>
    row.tripId === null ? [] : [row.tripId],
  )

  const candidates = await readableTrips(scope).findMany({
    where: taken.length === 0 ? undefined : notInArray(trips.id, taken),
    orderBy: [desc(trips.endDate), desc(trips.startDate)],
    limit: Math.max(limit * 8, 32),
  })

  /** 0 finished · 1 under way · 2 still ahead · 3 undated. */
  const groupOf = (trip: {
    readonly startDate: string | null
    readonly endDate: string | null
  }): number => {
    if (trip.endDate !== null && trip.endDate < today) return 0
    if (trip.startDate !== null && trip.startDate <= today) return 1
    if (trip.startDate === null && trip.endDate === null) return 3
    return 2
  }

  return candidates
    .map((trip) => ({ trip, group: groupOf(trip) }))
    .sort((left, right) => {
      if (left.group !== right.group) return left.group - right.group
      // Finished and running trips read newest first; the ones still ahead read
      // soonest first, because that is the one about to need writing.
      return left.group === 2
        ? (left.trip.startDate ?? '').localeCompare(right.trip.startDate ?? '')
        : (right.trip.endDate ?? '').localeCompare(left.trip.endDate ?? '')
    })
    .slice(0, limit)
    .map(({ trip }) => ({
      id: trip.id,
      title: trip.title,
      startDate: trip.startDate,
      endDate: trip.endDate,
      status: trip.status,
    }))
}

/**
 * How much of the travel history has been written up.
 *
 * Two numbers, because "three journeys" means nothing without "out of eleven trips".
 * Journeys not tied to a trip — a walk, a weekend, something never planned in the
 * app — are deliberately not counted as coverage; they cannot be, there is nothing
 * for them to cover.
 *
 * Both numbers count *trips*, so both are the reader's own (ADR 0007): a figure counting
 * trips they cannot open states something they have no way to check. The numerator is the
 * half that is easy to get wrong, because it is reached through `journeys` — "how many
 * trips have been written up" is a question about trips whichever table you start from, so
 * counting distinct `journeys.trip_id` under the bare tenant filter counted private trips
 * just as surely as the denominator did. Asking both of `readableTrips` instead makes
 * `written <= trips` structural rather than something a caller has to clamp.
 *
 * Whether the *journey* on an unreadable trip is listed is a separate question, answered by
 * {@link readableJourneyFilter} (ADR 0020); this counts trips, so it asks `readableTrips`.
 */
export async function journalCoverage(
  scope: TenantScope,
): Promise<{ readonly trips: number; readonly written: number }> {
  /** Written up: one correlated row in `journeys` is enough, however many there are. */
  const writtenUp = exists(
    scope.db
      .select({ present: sql`1` })
      .from(journeys)
      .where(tenantFilter(scope, journeys, eq(journeys.tripId, trips.id))),
  )

  const [readable, written] = await Promise.all([
    readableTrips(scope).count(),
    readableTrips(scope).count(writtenUp),
  ])

  return { trips: readable, written }
}

/** Photos not attached to an entry yet — the journey's media library. */
export async function listUnattachedPhotos(
  scope: TenantScope,
  journeyId: string,
): Promise<Array<JourneyPhoto>> {
  return journeyPhotosRepository.findMany(scope, {
    where: allOf(
      eq(journeyPhotos.journeyId, journeyId),
      isNull(journeyPhotos.entryId),
      inReadableJourney(scope, journeyPhotos.journeyId),
    ),
    orderBy: [desc(journeyPhotos.takenAt)],
  })
}

export async function listMoods(
  scope: TenantScope,
): Promise<Array<JourneyMood>> {
  return journeyMoodsRepository.findMany(scope, {
    orderBy: [asc(journeyMoods.sortOrder), asc(journeyMoods.label)],
  })
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

export async function createJourney(
  scope: TenantScope,
  input: CreateJourneyInput,
): Promise<Journey> {
  const values = createJourneyInput.parse(input)
  if (values.tripId) {
    await requireTrip(scope, values.tripId)
  }
  await assertQuota(scope, 'journeys', await countQuotaJourneys(scope))
  const slug = await reserveSlug(scope, values.slug ?? values.title)
  return journeysRepository.insert(scope, {
    ...values,
    slug,
    ownerUserId: scope.ctx.userId,
  })
}

export async function updateJourney(
  scope: TenantScope,
  journeyId: string,
  input: UpdateJourneyInput,
): Promise<Journey> {
  const values = definedOnly(updateJourneyInput.parse(input))
  const existing = await requireJourney(scope, journeyId)
  const slug =
    values.slug === undefined || values.slug === existing.slug
      ? undefined
      : await reserveSlug(scope, values.slug, journeyId)
  return journeysRepository.requireUpdate(scope, journeyId, {
    ...values,
    ...(slug === undefined ? {} : { slug }),
  })
}

/** Publishes a journey with a caller-supplied token (minted with `crypto.getRandomValues`). */
export async function publishJourney(
  scope: TenantScope,
  journeyId: string,
  publicToken: string,
): Promise<Journey> {
  await requireJourney(scope, journeyId)
  return journeysRepository.requireUpdate(scope, journeyId, {
    status: 'published',
    publicToken: z.string().trim().min(16).max(64).parse(publicToken),
  })
}

/** Unpublishes a journey and clears its token, so any shared link stops resolving. */
export async function unpublishJourney(
  scope: TenantScope,
  journeyId: string,
): Promise<Journey> {
  await requireJourney(scope, journeyId)
  return journeysRepository.requireUpdate(scope, journeyId, {
    status: 'draft',
    publicToken: null,
  })
}

export async function deleteJourney(
  scope: TenantScope,
  journeyId: string,
): Promise<void> {
  await requireJourney(scope, journeyId)
  await journeysRepository.requireRemove(scope, journeyId)
}

/** Validate source links together without binding them to the journal's parent trip. */
async function requireEntrySources(
  scope: TenantScope,
  sources: Pick<
    CreateEntryInput,
    'sourceTripId' | 'sourcePlaceId' | 'checkInId'
  >,
): Promise<void> {
  const { sourceTripId, sourcePlaceId, checkInId } = sources
  if (sourceTripId) {
    await requireTrip(scope, sourceTripId)
  }
  let placeTripId: string | null = null
  if (sourcePlaceId) {
    const place = sourceTripId
      ? await requirePlaceOfTrip(scope, sourceTripId, sourcePlaceId)
      : await placesRepository.requireById(scope, sourcePlaceId)
    placeTripId = place.tripId
    if (placeTripId) {
      await requireTrip(scope, placeTripId)
    }
  }
  if (checkInId) {
    const checkIn = await checkInsRepository.requireById(scope, checkInId)
    if (checkIn.tripId) {
      await requireTrip(scope, checkIn.tripId)
    }
    if (
      (sourceTripId && checkIn.tripId !== sourceTripId) ||
      (placeTripId && checkIn.tripId && placeTripId !== checkIn.tripId)
    ) {
      throw new NotFoundError('check-in', checkInId)
    }
  }
}

export async function createEntry(
  scope: TenantScope,
  input: CreateEntryInput,
): Promise<JourneyEntry> {
  const values = createEntryInput.parse(input)
  await requireJourney(scope, values.journeyId)
  if (values.moodId) {
    await journeyMoodsRepository.requireById(scope, values.moodId)
  }
  await requireEntrySources(scope, values)
  return journeyEntriesRepository.insert(scope, {
    ...values,
    authorUserId: scope.ctx.userId,
  })
}

export async function updateEntry(
  scope: TenantScope,
  entryId: string,
  input: UpdateEntryInput,
): Promise<JourneyEntry> {
  const values = definedOnly(updateEntryInput.parse(input))
  const entry = await requireEntry(scope, entryId)
  if (values.moodId) {
    await journeyMoodsRepository.requireById(scope, values.moodId)
  }
  if (
    values.sourceTripId !== undefined ||
    values.sourcePlaceId !== undefined ||
    values.checkInId !== undefined
  ) {
    await requireEntrySources(scope, { ...entry, ...values })
    // Bind validation to its snapshot so overlapping partial writes cannot mix source tuples.
    const [updated] = await journeyEntriesRepository.updateWhere(
      scope,
      allOf(
        eq(journeyEntries.id, entryId),
        sql`${journeyEntries.sourceTripId} is ${entry.sourceTripId}`,
        sql`${journeyEntries.sourcePlaceId} is ${entry.sourcePlaceId}`,
        sql`${journeyEntries.checkInId} is ${entry.checkInId}`,
      ),
      values,
    )
    if (!updated) {
      throw new RepositoryError(
        'Journey entry sources changed during update; retry.',
        'JOURNEY_ENTRY_SOURCES_CHANGED',
      )
    }
    return updated
  }
  return journeyEntriesRepository.requireUpdate(scope, entryId, values)
}

export async function deleteEntry(
  scope: TenantScope,
  entryId: string,
): Promise<void> {
  await requireEntry(scope, entryId)
  await journeyEntriesRepository.requireRemove(scope, entryId)
}

export async function addPhoto(
  scope: TenantScope,
  input: AddPhotoInput,
): Promise<JourneyPhoto> {
  const values = addPhotoInput.parse(input)
  await requireJourney(scope, values.journeyId)
  if (values.entryId) {
    const entry = await journeyEntriesRepository.requireById(
      scope,
      values.entryId,
    )
    if (entry.journeyId !== values.journeyId) {
      throw new NotFoundError('journey entry', values.entryId)
    }
  }
  return journeyPhotosRepository.insert(scope, {
    ...values,
    uploadedBy: scope.ctx.userId,
  })
}

export async function attachPhotoToEntry(
  scope: TenantScope,
  photoId: string,
  entryId: string | null,
): Promise<JourneyPhoto> {
  const photo = await requirePhoto(scope, photoId)
  if (entryId !== null) {
    const entry = await journeyEntriesRepository.requireById(
      scope,
      idSchema.parse(entryId),
    )
    if (entry.journeyId !== photo.journeyId) {
      throw new NotFoundError('journey entry', entryId)
    }
  }
  return journeyPhotosRepository.requireUpdate(scope, photoId, { entryId })
}

/** Removes a photo row and returns its storage keys so the caller can sweep R2. */
export async function deletePhoto(
  scope: TenantScope,
  photoId: string,
): Promise<{
  readonly storageKey: string
  readonly thumbnailKey: string | null
}> {
  const photo = await requirePhoto(scope, photoId)
  await journeyPhotosRepository.requireRemove(scope, photoId)
  return { storageKey: photo.storageKey, thumbnailKey: photo.thumbnailKey }
}

/**
 * Every R2 key the workspace's journey photos name, thumbnails included. Collected before the
 * workspace is deleted: the keys live only in the rows that go with it, and are not under any
 * prefix of the workspace, so `sweepWorkspaceObjects` is handed them. Keys only; administrators only.
 */
export async function listWorkspaceJourneyPhotoKeys(
  scope: TenantScope,
): Promise<Array<string>> {
  assertCanAdminister(scope.ctx, 'list the journey photo keys of the workspace')
  const rows = await scope.db
    .select({
      storageKey: journeyPhotos.storageKey,
      thumbnailKey: journeyPhotos.thumbnailKey,
    })
    .from(journeyPhotos)
    .where(tenantFilter(scope, journeyPhotos))
  return rows.flatMap((row) =>
    row.thumbnailKey === null
      ? [row.storageKey]
      : [row.storageKey, row.thumbnailKey],
  )
}

export async function createMood(
  scope: TenantScope,
  input: CreateMoodInput,
): Promise<JourneyMood> {
  return journeyMoodsRepository.insert(scope, createMoodInput.parse(input))
}

export async function deleteMood(
  scope: TenantScope,
  moodId: string,
): Promise<void> {
  await journeyMoodsRepository.requireRemove(scope, moodId)
}

/** The mood palette a new workspace starts with. Idempotent, keyed by `key`. */
const DEFAULT_MOODS: ReadonlyArray<CreateMoodInput> = [
  {
    key: 'radiant',
    label: 'Radiant',
    emoji: '☀️',
    colour: '#B26B08',
    sortOrder: 1,
  },
  { key: 'calm', label: 'Calm', emoji: '🌿', colour: '#2F6F5E', sortOrder: 2 },
  { key: 'awed', label: 'Awed', emoji: '🏔️', colour: '#2563EB', sortOrder: 3 },
  {
    key: 'weary',
    label: 'Weary',
    emoji: '🌙',
    colour: '#6E6D65',
    sortOrder: 4,
  },
  {
    key: 'hungry',
    label: 'Hungry',
    emoji: '🍜',
    colour: '#C0392B',
    sortOrder: 5,
  },
]

export async function ensureDefaultMoods(
  scope: TenantScope,
): Promise<Array<JourneyMood>> {
  const existing = await listMoods(scope)
  const known = new Set(existing.map((row) => row.key))
  const missing = DEFAULT_MOODS.filter((row) => !known.has(row.key))
  if (missing.length === 0) {
    return existing
  }
  await journeyMoodsRepository.insertMany(scope, missing)
  return listMoods(scope)
}

/** Entry counts per mood for one journey — the mood strip in the journal header. */
export async function countEntriesByMood(
  scope: TenantScope,
  journeyId: string,
): Promise<Array<{ readonly moodId: string; readonly value: number }>> {
  const rows = await scope.db
    .select({ moodId: journeyEntries.moodId, value: count() })
    .from(journeyEntries)
    .where(
      tenantFilter(
        scope,
        journeyEntries,
        eq(journeyEntries.journeyId, journeyId),
        inReadableJourney(scope, journeyEntries.journeyId),
      ),
    )
    .groupBy(journeyEntries.moodId)
    .orderBy(desc(count()))
  return rows.flatMap((row) =>
    row.moodId === null ? [] : [{ moodId: row.moodId, value: row.value }],
  )
}

/** Re-reads a set of entries the caller may read, newest first; an unreadable one is dropped. */
export async function listEntriesByIds(
  scope: TenantScope,
  entryIds: ReadonlyArray<string>,
): Promise<Array<JourneyEntry>> {
  if (entryIds.length === 0) {
    return []
  }
  return journeyEntriesRepository.findMany(scope, {
    where: allOf(
      inArray(journeyEntries.id, [...entryIds]),
      inReadableJourney(scope, journeyEntries.journeyId),
    ),
    orderBy: [desc(journeyEntries.entryDate)],
  })
}
