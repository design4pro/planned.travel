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
  countDistinct,
  desc,
  eq,
  inArray,
  isNull,
  ne,
  notInArray,
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
import { assertQuota, createTenantRepository, tenantFilter } from './base'
import { NotFoundError } from './context'
import { checkInsRepository } from './collab'
import { placesRepository } from './places'
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
import type { Journey, JourneyEntry, JourneyMood, JourneyPhoto } from '#/server/db/types'
import type { TenantScope } from './base'

/** The tenant's own "today", for a ranking that depends on it. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export const journeysRepository = createTenantRepository(journeys, 'journey')
export const journeyEntriesRepository = createTenantRepository(journeyEntries, 'journey entry')
export const journeyPhotosRepository = createTenantRepository(journeyPhotos, 'journey photo')
export const journeyMoodsRepository = createTenantRepository(journeyMoods, 'mood')

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

export const createEntryInput = z.object({ journeyId: idSchema, ...entryFields })
export type CreateEntryInput = z.infer<typeof createEntryInput>

export const updateEntryInput = z.object({ ...entryFields, entryDate: dateSchema.optional() })
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
      and(eq(journeys.slug, candidate), excludeId ? ne(journeys.id, excludeId) : undefined),
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

export async function listJourneys(
  scope: TenantScope,
  options: { readonly status?: (typeof JOURNEY_STATUSES)[number]; readonly ownerUserId?: string } = {},
): Promise<Array<Journey>> {
  return journeysRepository.findMany(scope, {
    where: and(
      options.status ? eq(journeys.status, options.status) : undefined,
      options.ownerUserId ? eq(journeys.ownerUserId, options.ownerUserId) : undefined,
    ),
    orderBy: [desc(journeys.updatedAt)],
  })
}

export async function getJourney(scope: TenantScope, journeyId: string): Promise<Journey | null> {
  return journeysRepository.findById(scope, journeyId)
}

export async function getJourneyBySlug(
  scope: TenantScope,
  slug: string,
): Promise<Journey | null> {
  return journeysRepository.findOne(scope, eq(journeys.slug, slug))
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

  const entriesBy = new Map(entryCounts.map((row) => [row.journeyId, row.value]))
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
    where: eq(journeyEntries.journeyId, journeyId),
    orderBy: [asc(journeyEntries.entryDate), asc(journeyEntries.sortOrder), asc(journeyEntries.id)],
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
): Promise<{ readonly journey: Journey; readonly entries: ReadonlyArray<JourneyEntryWithPhotos> }> {
  const journey = await journeysRepository.requireById(scope, journeyId)
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
      mood: entry.moodId === null ? null : moodsById.get(entry.moodId) ?? null,
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
    .innerJoin(journeys, eq(journeys.id, journeyEntries.journeyId))
    .where(tenantFilter(scope, journeyEntries))
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
      .where(tenantFilter(scope, journeyPhotos, inArray(journeyPhotos.entryId, entryIds)))
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
    mood: row.entry.moodId === null ? null : moodsById.get(row.entry.moodId) ?? null,
    photoCount: photosBy.get(row.entry.id) ?? 0,
  }))
}

/** How the whole journal felt: entry counts per mood, most used first. */
export async function tallyMoods(
  scope: TenantScope,
): Promise<Array<{ readonly mood: JourneyMood; readonly value: number }>> {
  const [rows, moods] = await Promise.all([
    scope.db
      .select({ moodId: journeyEntries.moodId, value: count() })
      .from(journeyEntries)
      .where(tenantFilter(scope, journeyEntries))
      .groupBy(journeyEntries.moodId)
      .orderBy(desc(count())),
    listMoods(scope),
  ])

  const moodsById = new Map(moods.map((mood) => [mood.id, mood]))
  return rows
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

  const taken = written.flatMap((row) => (row.tripId === null ? [] : [row.tripId]))

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
 * The denominator is the trips the reader may open (ADR 0007), not every trip in the
 * workspace: a figure counting trips they cannot see states something they have no way
 * to check. The numerator stays on the bare tenant filter because a journey's own
 * visibility is not a trip's — the whole journal surface reads journeys workspace-wide
 * — so on a workspace holding private trips that have been written up, `written` can
 * exceed `trips`. That is the honest shape of two differently-scoped populations, and
 * narrowing the numerator would be a journey-visibility decision this function does not
 * get to make.
 */
export async function journalCoverage(
  scope: TenantScope,
): Promise<{ readonly trips: number; readonly written: number }> {
  const [tripRows, writtenRows] = await Promise.all([
    scope.db
      .select({ value: count() })
      .from(trips)
      .where(tenantFilter(scope, trips, readableTripFilter(scope))),
    scope.db
      .select({ value: countDistinct(journeys.tripId) })
      .from(journeys)
      .where(tenantFilter(scope, journeys)),
  ])

  return {
    trips: tripRows[0]?.value ?? 0,
    written: writtenRows[0]?.value ?? 0,
  }
}

/** Photos not attached to an entry yet — the journey's media library. */
export async function listUnattachedPhotos(
  scope: TenantScope,
  journeyId: string,
): Promise<Array<JourneyPhoto>> {
  return journeyPhotosRepository.findMany(scope, {
    where: and(eq(journeyPhotos.journeyId, journeyId), isNull(journeyPhotos.entryId)),
    orderBy: [desc(journeyPhotos.takenAt)],
  })
}

export async function listMoods(scope: TenantScope): Promise<Array<JourneyMood>> {
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
  await assertQuota(scope, 'journeys', await journeysRepository.count(scope))
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
  const existing = await journeysRepository.requireById(scope, journeyId)
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
  return journeysRepository.requireUpdate(scope, journeyId, {
    status: 'draft',
    publicToken: null,
  })
}

export async function deleteJourney(scope: TenantScope, journeyId: string): Promise<void> {
  await journeysRepository.requireRemove(scope, journeyId)
}

export async function createEntry(
  scope: TenantScope,
  input: CreateEntryInput,
): Promise<JourneyEntry> {
  const values = createEntryInput.parse(input)
  await journeysRepository.requireById(scope, values.journeyId)
  if (values.moodId) {
    await journeyMoodsRepository.requireById(scope, values.moodId)
  }
  if (values.checkInId) {
    await checkInsRepository.requireById(scope, values.checkInId)
  }
  if (values.sourceTripId) {
    await requireTrip(scope, values.sourceTripId)
  }
  if (values.sourcePlaceId) {
    await placesRepository.requireById(scope, values.sourcePlaceId)
  }
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
  if (values.moodId) {
    await journeyMoodsRepository.requireById(scope, values.moodId)
  }
  return journeyEntriesRepository.requireUpdate(scope, entryId, values)
}

export async function deleteEntry(scope: TenantScope, entryId: string): Promise<void> {
  await journeyEntriesRepository.requireRemove(scope, entryId)
}

export async function addPhoto(scope: TenantScope, input: AddPhotoInput): Promise<JourneyPhoto> {
  const values = addPhotoInput.parse(input)
  await journeysRepository.requireById(scope, values.journeyId)
  if (values.entryId) {
    const entry = await journeyEntriesRepository.requireById(scope, values.entryId)
    if (entry.journeyId !== values.journeyId) {
      throw new NotFoundError('journey entry', values.entryId)
    }
  }
  return journeyPhotosRepository.insert(scope, { ...values, uploadedBy: scope.ctx.userId })
}

export async function attachPhotoToEntry(
  scope: TenantScope,
  photoId: string,
  entryId: string | null,
): Promise<JourneyPhoto> {
  const photo = await journeyPhotosRepository.requireById(scope, photoId)
  if (entryId !== null) {
    const entry = await journeyEntriesRepository.requireById(scope, idSchema.parse(entryId))
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
): Promise<{ readonly storageKey: string; readonly thumbnailKey: string | null }> {
  const photo = await journeyPhotosRepository.requireById(scope, photoId)
  await journeyPhotosRepository.requireRemove(scope, photoId)
  return { storageKey: photo.storageKey, thumbnailKey: photo.thumbnailKey }
}

export async function createMood(
  scope: TenantScope,
  input: CreateMoodInput,
): Promise<JourneyMood> {
  return journeyMoodsRepository.insert(scope, createMoodInput.parse(input))
}

export async function deleteMood(scope: TenantScope, moodId: string): Promise<void> {
  await journeyMoodsRepository.requireRemove(scope, moodId)
}

/** The mood palette a new workspace starts with. Idempotent, keyed by `key`. */
const DEFAULT_MOODS: ReadonlyArray<CreateMoodInput> = [
  { key: 'radiant', label: 'Radiant', emoji: '☀️', colour: '#B26B08', sortOrder: 1 },
  { key: 'calm', label: 'Calm', emoji: '🌿', colour: '#2F6F5E', sortOrder: 2 },
  { key: 'awed', label: 'Awed', emoji: '🏔️', colour: '#2563EB', sortOrder: 3 },
  { key: 'weary', label: 'Weary', emoji: '🌙', colour: '#6E6D65', sortOrder: 4 },
  { key: 'hungry', label: 'Hungry', emoji: '🍜', colour: '#C0392B', sortOrder: 5 },
]

export async function ensureDefaultMoods(scope: TenantScope): Promise<Array<JourneyMood>> {
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
    .where(tenantFilter(scope, journeyEntries, eq(journeyEntries.journeyId, journeyId)))
    .groupBy(journeyEntries.moodId)
    .orderBy(desc(count()))
  return rows.flatMap((row) => (row.moodId === null ? [] : [{ moodId: row.moodId, value: row.value }]))
}

/** Re-reads a set of entries inside the tenant, newest first. */
export async function listEntriesByIds(
  scope: TenantScope,
  entryIds: ReadonlyArray<string>,
): Promise<Array<JourneyEntry>> {
  if (entryIds.length === 0) {
    return []
  }
  return journeyEntriesRepository.findMany(scope, {
    where: inArray(journeyEntries.id, [...entryIds]),
    orderBy: [desc(journeyEntries.entryDate)],
  })
}
