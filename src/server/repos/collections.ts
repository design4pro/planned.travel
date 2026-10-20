/**
 * Collections — saved places that live outside any single trip: the "one day" list, the shortlist for
 * a city, the restaurants a colleague recommended.
 *
 * A collection place is a **copy**, not a reference: it keeps `sourceTripId` / `sourcePlaceId` for
 * provenance but survives the deletion of the trip it came from, which is the whole point of saving
 * something for later.
 */

import { and, asc, count, desc, eq, inArray, like, ne, notExists, or } from 'drizzle-orm'
import { z } from 'zod'
import {
  COLLECTION_PLACE_STATUSES,
  COLLECTION_VISIBILITIES,
  PLACE_SOURCES,
  collectionLabels,
  collectionPlaceLabels,
  collectionPlaces,
  collections,
} from '#/server/db/schema'
import { allOf, assertQuota, createTenantRepository, createTenantTableAccess, tenantFilter } from './base'
import { categoriesRepository } from './categories'
import { ForbiddenError, hasAtLeastRole } from './context'
import { placesRepository } from './places'
import {
  colourSchema,
  countryCodeSchema,
  currencySchema,
  definedOnly,
  idSchema,
  longTextSchema,
  minorAmountSchema,
  shortTextSchema,
  slugSchema,
  slugify,
  sortOrderSchema,
  titleSchema,
  urlSchema,
  latitudeSchema,
  longitudeSchema,
} from './validation'
import type { Collection, CollectionLabel, CollectionPlace } from '#/server/db/types'
import type { TenantScope } from './base'

export const collectionsRepository = createTenantRepository(collections, 'collection')
export const collectionPlacesRepository = createTenantRepository(
  collectionPlaces,
  'collection place',
)
export const collectionLabelsRepository = createTenantRepository(collectionLabels, 'label')
export const collectionPlaceLabelsAccess = createTenantTableAccess(
  collectionPlaceLabels,
  'place label',
)

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const statusSchema = z.enum(COLLECTION_PLACE_STATUSES)

export const createCollectionInput = z.object({
  name: titleSchema,
  slug: slugSchema.optional(),
  description: longTextSchema.nullish(),
  colour: colourSchema.optional(),
  icon: shortTextSchema.min(1).optional(),
  coverImageUrl: urlSchema.nullish(),
  visibility: z.enum(COLLECTION_VISIBILITIES).optional(),
  sortOrder: sortOrderSchema.optional(),
})
export type CreateCollectionInput = z.infer<typeof createCollectionInput>

export const updateCollectionInput = z.object({
  name: titleSchema.optional(),
  slug: slugSchema.optional(),
  description: longTextSchema.nullish(),
  colour: colourSchema.optional(),
  icon: shortTextSchema.min(1).optional(),
  coverImageUrl: urlSchema.nullish(),
  visibility: z.enum(COLLECTION_VISIBILITIES).optional(),
  sortOrder: sortOrderSchema.optional(),
})
export type UpdateCollectionInput = z.infer<typeof updateCollectionInput>

const collectionPlaceFields = {
  categoryId: idSchema.nullish(),
  name: titleSchema,
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
  priceMinor: minorAmountSchema.nullish(),
  currency: currencySchema.nullish(),
  status: statusSchema.optional(),
  source: z.enum(PLACE_SOURCES).optional(),
  externalId: shortTextSchema.nullish(),
  sortOrder: sortOrderSchema.optional(),
}

export const addCollectionPlaceInput = z.object({
  collectionId: idSchema,
  ...collectionPlaceFields,
})
export type AddCollectionPlaceInput = z.infer<typeof addCollectionPlaceInput>

export const updateCollectionPlaceInput = z.object({
  ...collectionPlaceFields,
  name: titleSchema.optional(),
})
export type UpdateCollectionPlaceInput = z.infer<typeof updateCollectionPlaceInput>

export const createLabelInput = z.object({
  collectionId: idSchema,
  name: titleSchema,
  colour: colourSchema.optional(),
  sortOrder: sortOrderSchema.optional(),
})
export type CreateLabelInput = z.infer<typeof createLabelInput>

/* -------------------------------------------------------------------------------------------------
 * Slugs
 * ---------------------------------------------------------------------------------------------- */

async function reserveSlug(
  scope: TenantScope,
  desired: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(desired, 'collection')
  for (let attempt = 1; attempt <= 25; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base.slice(0, 74)}-${attempt}`
    const clashes = await collectionsRepository.count(
      scope,
      and(eq(collections.slug, candidate), excludeId ? ne(collections.id, excludeId) : undefined),
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

export async function listCollections(scope: TenantScope): Promise<Array<Collection>> {
  return collectionsRepository.findMany(scope, {
    orderBy: [asc(collections.sortOrder), desc(collections.updatedAt)],
  })
}

export async function getCollection(
  scope: TenantScope,
  collectionId: string,
): Promise<Collection | null> {
  return collectionsRepository.findById(scope, collectionId)
}

export async function getCollectionBySlug(
  scope: TenantScope,
  slug: string,
): Promise<Collection | null> {
  return collectionsRepository.findOne(scope, eq(collections.slug, slug))
}

export interface CollectionSummary extends Collection {
  readonly placeCount: number
  readonly visitedCount: number
}

/** Every collection with its counts — the collections index. */
export async function listCollectionsWithCounts(
  scope: TenantScope,
): Promise<Array<CollectionSummary>> {
  const [rows, totals, visited] = await Promise.all([
    listCollections(scope),
    scope.db
      .select({ collectionId: collectionPlaces.collectionId, value: count() })
      .from(collectionPlaces)
      .where(tenantFilter(scope, collectionPlaces))
      .groupBy(collectionPlaces.collectionId),
    scope.db
      .select({ collectionId: collectionPlaces.collectionId, value: count() })
      .from(collectionPlaces)
      .where(tenantFilter(scope, collectionPlaces, eq(collectionPlaces.status, 'visited')))
      .groupBy(collectionPlaces.collectionId),
  ])

  const totalBy = new Map(totals.map((row) => [row.collectionId, row.value]))
  const visitedBy = new Map(visited.map((row) => [row.collectionId, row.value]))
  return rows.map((row) => ({
    ...row,
    placeCount: totalBy.get(row.id) ?? 0,
    visitedCount: visitedBy.get(row.id) ?? 0,
  }))
}

export const listCollectionPlacesInput = z.object({
  collectionId: idSchema,
  status: statusSchema.optional(),
  labelIds: z.array(idSchema).min(1).optional(),
  countryCode: countryCodeSchema.optional(),
  search: shortTextSchema.min(1).optional(),
})
export type ListCollectionPlacesInput = z.infer<typeof listCollectionPlacesInput>

export async function listCollectionPlaces(
  scope: TenantScope,
  input: ListCollectionPlacesInput,
): Promise<Array<CollectionPlace>> {
  const options = listCollectionPlacesInput.parse(input)
  let labelFilter: Array<string> | undefined

  if (options.labelIds && options.labelIds.length > 0) {
    const links = await collectionPlaceLabelsAccess.findMany(scope, {
      where: inArray(collectionPlaceLabels.labelId, [...options.labelIds]),
    })
    labelFilter = links.map((row) => row.collectionPlaceId)
    if (labelFilter.length === 0) {
      return []
    }
  }

  const needle = options.search ? `%${options.search.toLowerCase()}%` : undefined
  return collectionPlacesRepository.findMany(scope, {
    where: and(
      eq(collectionPlaces.collectionId, options.collectionId),
      options.status ? eq(collectionPlaces.status, options.status) : undefined,
      options.countryCode ? eq(collectionPlaces.countryCode, options.countryCode) : undefined,
      needle
        ? or(
            like(collectionPlaces.name, needle),
            like(collectionPlaces.city, needle),
            like(collectionPlaces.address, needle),
          )
        : undefined,
      labelFilter ? inArray(collectionPlaces.id, labelFilter) : undefined,
    ),
    orderBy: [asc(collectionPlaces.sortOrder), desc(collectionPlaces.id)],
  })
}

export async function listLabels(
  scope: TenantScope,
  collectionId: string,
): Promise<Array<CollectionLabel>> {
  return collectionLabelsRepository.findMany(scope, {
    where: eq(collectionLabels.collectionId, collectionId),
    orderBy: [asc(collectionLabels.sortOrder), asc(collectionLabels.name)],
  })
}

export interface CollectionPlaceWithLabels extends CollectionPlace {
  readonly labelIds: ReadonlyArray<string>
}

/** Places of a collection with their label ids attached — the collection detail grid. */
export async function listCollectionPlacesWithLabels(
  scope: TenantScope,
  collectionId: string,
): Promise<Array<CollectionPlaceWithLabels>> {
  const rows = await listCollectionPlaces(scope, { collectionId })
  if (rows.length === 0) {
    return []
  }
  const links = await collectionPlaceLabelsAccess.findMany(scope, {
    where: inArray(
      collectionPlaceLabels.collectionPlaceId,
      rows.map((row) => row.id),
    ),
  })
  const byPlace = new Map<string, Array<string>>()
  for (const link of links) {
    const bucket = byPlace.get(link.collectionPlaceId)
    if (bucket) {
      bucket.push(link.labelId)
    } else {
      byPlace.set(link.collectionPlaceId, [link.labelId])
    }
  }
  return rows.map((row) => ({ ...row, labelIds: byPlace.get(row.id) ?? [] }))
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

export async function createCollection(
  scope: TenantScope,
  input: CreateCollectionInput,
): Promise<Collection> {
  const values = createCollectionInput.parse(input)
  await assertQuota(scope, 'collections', await collectionsRepository.count(scope))
  const slug = await reserveSlug(scope, values.slug ?? values.name)
  return collectionsRepository.insert(scope, {
    ...values,
    slug,
    ownerUserId: scope.ctx.userId,
  })
}

export function canManageCollection(
  scope: TenantScope,
  collection: Collection,
): boolean {
  return (
    collection.ownerUserId === scope.ctx.userId ||
    hasAtLeastRole(scope.ctx, 'admin')
  )
}

export async function requireOwnedCollection(
  scope: TenantScope,
  collectionId: string,
): Promise<Collection> {
  const collection = await collectionsRepository.requireById(
    scope,
    collectionId,
  )
  if (!canManageCollection(scope, collection)) {
    throw new ForbiddenError('manage this collection', ['owner', 'admin'])
  }
  return collection
}

export async function collectionDeleteSummary(
  scope: TenantScope,
  collectionId: string,
) {
  const collection = await requireOwnedCollection(scope, collectionId)
  const [places, labels] = await Promise.all([
    collectionPlacesRepository.count(
      scope,
      eq(collectionPlaces.collectionId, collectionId),
    ),
    collectionLabelsRepository.count(
      scope,
      eq(collectionLabels.collectionId, collectionId),
    ),
  ])
  return { name: collection.name, places, labels, requiresName: places > 0 }
}

export async function updateCollection(
  scope: TenantScope,
  collectionId: string,
  input: UpdateCollectionInput,
): Promise<Collection> {
  const values = definedOnly(updateCollectionInput.parse(input))
  const existing = await requireOwnedCollection(scope, collectionId)
  const slug =
    values.slug === undefined || values.slug === existing.slug
      ? undefined
      : await reserveSlug(scope, values.slug, collectionId)
  return collectionsRepository.requireUpdate(scope, collectionId, {
    ...values,
    ...(slug === undefined ? {} : { slug }),
  })
}

export async function deleteCollection(scope: TenantScope, collectionId: string): Promise<void> {
  await requireOwnedCollection(scope, collectionId)
  await collectionsRepository.requireRemove(scope, collectionId)
}

export async function deleteCollectionConfirmed(
  scope: TenantScope,
  collectionId: string,
  confirmName?: string,
): Promise<void> {
  await requireOwnedCollection(scope, collectionId)
  const savedPlace = scope.db
    .select({ id: collectionPlaces.id })
    .from(collectionPlaces)
    .where(
      tenantFilter(
        scope,
        collectionPlaces,
        eq(collectionPlaces.collectionId, collectionId),
      ),
    )
    .limit(1)
  const removed = await collectionsRepository.removeWhere(
    scope,
    allOf(
      eq(collections.id, collectionId),
      or(
        confirmName === undefined
          ? undefined
          : eq(collections.name, confirmName),
        notExists(savedPlace),
      ),
    ),
  )
  z.literal(true).parse(removed > 0)
}

export async function addCollectionPlace(
  scope: TenantScope,
  input: AddCollectionPlaceInput,
): Promise<CollectionPlace> {
  const values = addCollectionPlaceInput.parse(input)
  await collectionsRepository.requireById(scope, values.collectionId)
  if (values.categoryId) {
    await categoriesRepository.requireById(scope, values.categoryId)
  }
  return collectionPlacesRepository.insert(scope, {
    ...values,
    savedBy: scope.ctx.userId,
    sortOrder: values.sortOrder ?? (await nextCollectionPlaceSortOrder(scope, values.collectionId)),
  })
}

/** One past the highest `sort_order` in the collection, so saves append rather than pile up. */
async function nextCollectionPlaceSortOrder(
  scope: TenantScope,
  collectionId: string,
): Promise<number> {
  const rows = await collectionPlacesRepository.findMany(scope, {
    where: eq(collectionPlaces.collectionId, collectionId),
    orderBy: [desc(collectionPlaces.sortOrder)],
    limit: 1,
  })
  return (rows.at(0)?.sortOrder ?? -1) + 1
}

/**
 * Copies a trip place into a collection, keeping its provenance. Both ids are resolved inside the
 * tenant first, so a place from another organization cannot be harvested into a local collection.
 */
export async function saveTripPlaceToCollection(
  scope: TenantScope,
  input: { readonly collectionId: string; readonly placeId: string },
): Promise<CollectionPlace> {
  const collection = await collectionsRepository.requireById(
    scope,
    idSchema.parse(input.collectionId),
  )
  const place = await placesRepository.requireById(scope, idSchema.parse(input.placeId))

  return collectionPlacesRepository.insert(scope, {
    collectionId: collection.id,
    categoryId: place.categoryId,
    name: place.name,
    description: place.description,
    notes: place.notes,
    lat: place.lat,
    lng: place.lng,
    address: place.address,
    city: place.city,
    countryCode: place.countryCode,
    website: place.website,
    phone: place.phone,
    imageUrl: place.imageUrl,
    priceMinor: place.priceMinor,
    currency: place.currency,
    status: place.isVisited ? 'visited' : 'idea',
    source: 'collection',
    externalId: place.externalId,
    sourceTripId: place.tripId,
    sourcePlaceId: place.id,
    savedBy: scope.ctx.userId,
  })
}

export async function updateCollectionPlace(
  scope: TenantScope,
  collectionPlaceId: string,
  input: UpdateCollectionPlaceInput,
): Promise<CollectionPlace> {
  const values = definedOnly(updateCollectionPlaceInput.parse(input))
  if (values.categoryId) {
    await categoriesRepository.requireById(scope, values.categoryId)
  }
  return collectionPlacesRepository.requireUpdate(scope, collectionPlaceId, values)
}

export async function setCollectionPlaceStatus(
  scope: TenantScope,
  collectionPlaceId: string,
  status: (typeof COLLECTION_PLACE_STATUSES)[number],
): Promise<CollectionPlace> {
  return collectionPlacesRepository.requireUpdate(scope, collectionPlaceId, {
    status: statusSchema.parse(status),
  })
}

export async function deleteCollectionPlace(
  scope: TenantScope,
  collectionPlaceId: string,
): Promise<void> {
  await collectionPlacesRepository.requireRemove(scope, collectionPlaceId)
}

export async function createLabel(
  scope: TenantScope,
  input: CreateLabelInput,
): Promise<CollectionLabel> {
  const values = createLabelInput.parse(input)
  await collectionsRepository.requireById(scope, values.collectionId)
  return collectionLabelsRepository.insert(scope, values)
}

export async function deleteLabel(scope: TenantScope, labelId: string): Promise<void> {
  await collectionLabelsRepository.requireRemove(scope, labelId)
}

/** Replaces a saved place's labels, dropping any label id that is not in the same collection. */
export async function setCollectionPlaceLabels(
  scope: TenantScope,
  collectionPlaceId: string,
  labelIds: ReadonlyArray<string>,
): Promise<Array<string>> {
  const place = await collectionPlacesRepository.requireById(scope, collectionPlaceId)
  const parsed = z.array(idSchema).max(50).parse([...labelIds])

  const valid =
    parsed.length === 0
      ? []
      : (
          await collectionLabelsRepository.findMany(scope, {
            where: and(
              inArray(collectionLabels.id, parsed),
              eq(collectionLabels.collectionId, place.collectionId),
            ),
          })
        ).map((row) => row.id)

  await collectionPlaceLabelsAccess.removeWhere(
    scope,
    eq(collectionPlaceLabels.collectionPlaceId, collectionPlaceId),
  )
  if (valid.length > 0) {
    await collectionPlaceLabelsAccess.insertMany(
      scope,
      valid.map((labelId) => ({ collectionPlaceId, labelId })),
    )
  }
  return valid
}

/** Saved-place counts per country across the tenant — the collections map. */
export async function countCollectionPlacesByCountry(
  scope: TenantScope,
): Promise<Array<{ readonly countryCode: string; readonly value: number }>> {
  const rows = await scope.db
    .select({ countryCode: collectionPlaces.countryCode, value: count() })
    .from(collectionPlaces)
    .where(tenantFilter(scope, collectionPlaces))
    .groupBy(collectionPlaces.countryCode)
    .orderBy(desc(count()))
  return rows.flatMap((row) =>
    row.countryCode === null ? [] : [{ countryCode: row.countryCode, value: row.value }],
  )
}
