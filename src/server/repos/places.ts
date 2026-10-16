/**
 * Places — everything a trip might visit, whether or not it has been scheduled onto a day.
 *
 * The planner treats this table as the trip's inventory: the map renders it, the day board drags
 * from it, and {@link listUnscheduledPlaces} is what fills the "ideas" column.
 */

import { and, asc, count, desc, eq, inArray, isNotNull, like, notInArray, or } from 'drizzle-orm'
import { z } from 'zod'
import {
  PLACE_SOURCES,
  TRANSPORT_MODES,
  dayAssignments,
  placeTags,
  places,
  tags,
} from '#/server/db/schema'
import { UNLIMITED } from '#/server/db/types'
import { assertQuota, createTenantRepository, createTenantTableAccess, resolveQuotas, tenantFilter } from './base'
import { runBatch } from './batch'
import { categoriesRepository } from './categories'
import { NotFoundError } from './context'
import { assertTripRole, requireTrip } from './trips'
import {
  countryCodeSchema,
  currencySchema,
  definedOnly,
  idSchema,
  latitudeSchema,
  longTextSchema,
  longitudeSchema,
  minorAmountSchema,
  nonNegativeIntSchema,
  shortTextSchema,
  sortOrderSchema,
  timeSchema,
  titleSchema,
  urlSchema,
} from './validation'
import type { SQL } from 'drizzle-orm'
import type { OpeningHours } from '#/server/db/schema'
import type { Place, Tag } from '#/server/db/types'
import type { TenantScope } from './base'
import type { TripRole } from './trips'

/** Shared by the repository writers and the planner's write guard. */
export const PLACE_WRITE_ROLES: ReadonlyArray<TripRole> = ['owner', 'editor']

async function requirePlaceWriteRole(scope: TenantScope, tripId: string): Promise<void> {
  await requireTrip(scope, tripId)
  await assertTripRole(scope, tripId, PLACE_WRITE_ROLES)
}

async function requireEditablePlace(scope: TenantScope, placeId: string): Promise<Place> {
  const place = await placesRepository.requireById(scope, placeId)
  await requirePlaceWriteRole(scope, place.tripId)
  return place
}

export const placesRepository = createTenantRepository(places, 'place')
export const placeTagsAccess = createTenantTableAccess(placeTags, 'place tag')

export interface PlacesMeter {
  readonly used: number
  readonly limit: number | null
}

/** Organisation-wide usage and the live ceiling read by the places write guard. */
export async function placesMeter(scope: TenantScope): Promise<PlacesMeter> {
  const [used, { limits }] = await Promise.all([
    placesRepository.count(scope),
    resolveQuotas(scope),
  ])
  return { used, limit: limits.places === UNLIMITED ? null : limits.places }
}

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const openingHoursSchema: z.ZodType<OpeningHours> = z.array(
  z.object({
    day: z.number().int().min(0).max(6),
    opens: timeSchema,
    closes: timeSchema,
  }),
)

const placeFields = {
  name: titleSchema,
  categoryId: idSchema.nullish(),
  description: longTextSchema.nullish(),
  notes: longTextSchema.nullish(),
  lat: latitudeSchema.nullish(),
  lng: longitudeSchema.nullish(),
  address: shortTextSchema.nullish(),
  city: shortTextSchema.nullish(),
  countryCode: countryCodeSchema.nullish(),
  website: urlSchema.nullish(),
  phone: shortTextSchema.nullish(),
  imageUrl: urlSchema.nullish(),
  openingHours: openingHoursSchema.nullish(),
  priceMinor: minorAmountSchema.nullish(),
  currency: currencySchema.nullish(),
  rating: z.number().int().min(1).max(5).nullish(),
  durationMinutes: nonNegativeIntSchema.max(10_080).optional(),
  transportMode: z.enum(TRANSPORT_MODES).optional(),
  source: z.enum(PLACE_SOURCES).optional(),
  externalId: shortTextSchema.nullish(),
  isVisited: z.boolean().optional(),
  sortOrder: sortOrderSchema.optional(),
}

export const createPlaceInput = z.object({ tripId: idSchema, ...placeFields })
export type CreatePlaceInput = z.infer<typeof createPlaceInput>

export const updatePlaceInput = z.object({ ...placeFields, name: titleSchema.optional() })
export type UpdatePlaceInput = z.infer<typeof updatePlaceInput>

export const listPlacesInput = z.object({
  tripId: idSchema,
  categoryId: idSchema.optional(),
  tagIds: z.array(idSchema).min(1).optional(),
  visited: z.boolean().optional(),
  mapped: z.boolean().optional(),
  search: shortTextSchema.min(1).optional(),
  limit: z.number().int().min(1).max(500).optional(),
})
export type ListPlacesInput = z.infer<typeof listPlacesInput>

export const reorderPlacesInput = z
  .array(z.object({ placeId: idSchema, sortOrder: sortOrderSchema }))
  .min(1)
  .max(500)
export type ReorderPlacesInput = z.infer<typeof reorderPlacesInput>

/* -------------------------------------------------------------------------------------------------
 * Queries
 * ---------------------------------------------------------------------------------------------- */

/** A trip's places in board order. */
export async function listTripPlaces(
  scope: TenantScope,
  input: ListPlacesInput,
): Promise<Array<Place>> {
  const options = listPlacesInput.parse(input)
  const parts: Array<SQL | undefined> = [eq(places.tripId, options.tripId)]

  if (options.categoryId) {
    parts.push(eq(places.categoryId, options.categoryId))
  }
  if (options.visited !== undefined) {
    parts.push(eq(places.isVisited, options.visited))
  }
  if (options.mapped === true) {
    parts.push(and(isNotNull(places.lat), isNotNull(places.lng)))
  }
  if (options.search) {
    const needle = `%${options.search.toLowerCase()}%`
    parts.push(or(like(places.name, needle), like(places.address, needle), like(places.city, needle)))
  }
  if (options.tagIds && options.tagIds.length > 0) {
    const tagged = await scope.db
      .select({ placeId: placeTags.placeId })
      .from(placeTags)
      .where(tenantFilter(scope, placeTags, inArray(placeTags.tagId, [...options.tagIds])))
    const ids = tagged.map((row) => row.placeId)
    if (ids.length === 0) {
      return []
    }
    parts.push(inArray(places.id, ids))
  }

  return placesRepository.findMany(scope, {
    where: and(...parts),
    orderBy: [asc(places.sortOrder), asc(places.id)],
    limit: options.limit,
  })
}

/**
 * Resolves a place and asserts it belongs to `tripId`, so a place from another trip - or another
 * tenant - is refused as an id that is not there instead of being linked. The itinerary and the
 * expense writers call it; a repository that stores a `place_id` and does not is a gap.
 */
export async function requirePlaceOfTrip(
  scope: TenantScope,
  tripId: string,
  placeId: string,
): Promise<Place> {
  const place = await placesRepository.requireById(scope, placeId)
  if (place.tripId !== tripId) {
    throw new NotFoundError('place', placeId)
  }
  return place
}

export async function getPlace(scope: TenantScope, placeId: string): Promise<Place | null> {
  return placesRepository.findById(scope, placeId)
}

/**
 * Places that are not on any day yet. Uses a scoped `NOT IN` over the assignment table rather than an
 * anti-join so the tenant predicate applies to both sides independently.
 */
export async function listUnscheduledPlaces(
  scope: TenantScope,
  tripId: string,
): Promise<Array<Place>> {
  const assigned = await scope.db
    .select({ placeId: dayAssignments.placeId })
    .from(dayAssignments)
    .where(tenantFilter(scope, dayAssignments, eq(dayAssignments.tripId, tripId)))
  const assignedIds = assigned.map((row) => row.placeId)

  return placesRepository.findMany(scope, {
    where: and(
      eq(places.tripId, tripId),
      assignedIds.length > 0 ? notInArray(places.id, assignedIds) : undefined,
    ),
    orderBy: [asc(places.sortOrder), asc(places.id)],
  })
}

export interface PlaceWithTags extends Place {
  readonly tags: ReadonlyArray<Tag>
}

/** A trip's places with their tags attached, in board order — the planner's inventory panel. */
export async function listTripPlacesWithTags(
  scope: TenantScope,
  tripId: string,
): Promise<Array<PlaceWithTags>> {
  const rows = await listTripPlaces(scope, { tripId })
  if (rows.length === 0) {
    return []
  }
  const links = await scope.db
    .select({
      placeId: placeTags.placeId,
      id: tags.id,
      organizationId: tags.organizationId,
      name: tags.name,
      slug: tags.slug,
      colour: tags.colour,
      createdAt: tags.createdAt,
      updatedAt: tags.updatedAt,
    })
    .from(placeTags)
    .innerJoin(tags, eq(tags.id, placeTags.tagId))
    // Nested tenant filters: both sides of the join are pinned to the caller's organization.
    .where(
      tenantFilter(
        scope,
        placeTags,
        tenantFilter(
          scope,
          tags,
          inArray(
            placeTags.placeId,
            rows.map((row) => row.id),
          ),
        ),
      ),
    )
    .orderBy(asc(tags.name))

  const byPlace = new Map<string, Array<Tag>>()
  for (const { placeId, ...tag } of links) {
    const bucket = byPlace.get(placeId)
    if (bucket) {
      bucket.push(tag)
    } else {
      byPlace.set(placeId, [tag])
    }
  }
  return rows.map((row) => ({ ...row, tags: byPlace.get(row.id) ?? [] }))
}

export interface PlaceCategoryCount {
  readonly categoryId: string | null
  readonly value: number
}

/** Place counts per category for one trip — the map legend and the "what kind of trip is this" chart. */
export async function countTripPlacesByCategory(
  scope: TenantScope,
  tripId: string,
): Promise<Array<PlaceCategoryCount>> {
  const rows = await scope.db
    .select({ categoryId: places.categoryId, value: count() })
    .from(places)
    .where(tenantFilter(scope, places, eq(places.tripId, tripId)))
    .groupBy(places.categoryId)
    .orderBy(desc(count()))
  return rows
}

export async function countTripPlaces(scope: TenantScope, tripId: string): Promise<number> {
  return placesRepository.count(scope, eq(places.tripId, tripId))
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

/**
 * Adds a place to a trip's inventory. Without an explicit `sortOrder` it goes to the end of the board,
 * so places added in the same millisecond keep a stable, meaningful order.
 */
export async function createPlace(scope: TenantScope, input: CreatePlaceInput): Promise<Place> {
  const values = createPlaceInput.parse(input)
  await requirePlaceWriteRole(scope, values.tripId)
  if (values.categoryId) {
    await categoriesRepository.requireById(scope, values.categoryId)
  }
  await assertQuota(scope, 'places', await placesRepository.count(scope))
  return placesRepository.insert(scope, {
    ...values,
    sortOrder: values.sortOrder ?? (await nextPlaceSortOrder(scope, values.tripId)),
  })
}

/** One past the highest `sort_order` on the trip. */
async function nextPlaceSortOrder(scope: TenantScope, tripId: string): Promise<number> {
  const rows = await placesRepository.findMany(scope, {
    where: eq(places.tripId, tripId),
    orderBy: [desc(places.sortOrder)],
    limit: 1,
  })
  return (rows.at(0)?.sortOrder ?? -1) + 1
}

export async function updatePlace(
  scope: TenantScope,
  placeId: string,
  input: UpdatePlaceInput,
): Promise<Place> {
  const values = definedOnly(updatePlaceInput.parse(input))
  await requireEditablePlace(scope, placeId)
  if (values.categoryId) {
    await categoriesRepository.requireById(scope, values.categoryId)
  }
  return placesRepository.requireUpdate(scope, placeId, values)
}

export async function setPlaceVisited(
  scope: TenantScope,
  placeId: string,
  isVisited: boolean,
): Promise<Place> {
  await requireEditablePlace(scope, placeId)
  return placesRepository.requireUpdate(scope, placeId, { isVisited })
}

export async function deletePlace(scope: TenantScope, placeId: string): Promise<void> {
  await requireEditablePlace(scope, placeId)
  await placesRepository.requireRemove(scope, placeId)
}

/** Persists a drag-and-drop reorder as one batch, so the board never renders a half-applied order. */
export async function reorderPlaces(
  scope: TenantScope,
  input: ReorderPlacesInput,
): Promise<Array<Place>> {
  const moves = reorderPlacesInput.parse(input)
  const known = await placesRepository.findByIds(
    scope,
    moves.map((move) => move.placeId),
  )
  for (const tripId of new Set(known.map((row) => row.tripId))) {
    await requirePlaceWriteRole(scope, tripId)
  }
  const knownIds = new Set(known.map((row) => row.id))
  const applicable = moves.filter((move) => knownIds.has(move.placeId))
  if (applicable.length === 0) {
    return []
  }

  await runBatch(
    scope,
    applicable.map((move) =>
      scope.db
        .update(places)
        .set({ sortOrder: move.sortOrder })
        .where(tenantFilter(scope, places, eq(places.id, move.placeId))),
    ),
  )

  return placesRepository.findByIds(
    scope,
    applicable.map((move) => move.placeId),
  )
}

/**
 * Replaces a place's tag set. Tag ids are re-read inside the tenant first, so a foreign tag id is
 * dropped instead of being linked across the boundary.
 */
export async function setPlaceTags(
  scope: TenantScope,
  placeId: string,
  tagIds: ReadonlyArray<string>,
): Promise<Array<string>> {
  await requireEditablePlace(scope, placeId)
  const parsed = z.array(idSchema).max(50).parse([...tagIds])
  const known =
    parsed.length === 0
      ? []
      : (await scope.db
          .select({ id: tags.id })
          .from(tags)
          .where(tenantFilter(scope, tags, inArray(tags.id, parsed)))
        ).map((row) => row.id)

  await placeTagsAccess.removeWhere(scope, eq(placeTags.placeId, placeId))
  if (known.length > 0) {
    await placeTagsAccess.insertMany(
      scope,
      known.map((tagId) => ({ placeId, tagId })),
    )
  }
  return known
}

export async function listPlaceTagIds(
  scope: TenantScope,
  placeId: string,
): Promise<Array<string>> {
  const rows = await placeTagsAccess.findMany(scope, { where: eq(placeTags.placeId, placeId) })
  return rows.map((row) => row.tagId)
}
