/** One owner of photo compatibility, precedence and conditional selection versions. */
import { and, eq, exists, inArray, sql } from 'drizzle-orm'
import { member } from '#/server/db/auth-schema'
import {
  placePhotoSelections,
  places,
  tripMembers,
  trips,
} from '#/server/db/schema'
import { allOf, prepareTenantInsert, tenantFilter } from './base'
import { runAtomicBatch } from './batch'
import { categoriesRepository } from './categories'
import { NotFoundError, RepositoryError } from './context'
import { getMembership, stillInWorkspace } from './members'
import { placesRepository, updatePlaceInput } from './places'
import {
  assertExpectedTripCurrency,
  assertTripRole,
  readableTripFilter,
  requireTrip,
  requireWritableTrip,
  TRIP_WRITE_ROLES,
} from './trips'
import { definedOnly, idSchema } from './validation'
import type { PlacePhoto } from '#/lib/place-photo'
import type { TenantScope } from './base'
import type { UpdatePlaceInput } from './places'

/** Chooses opaque candidates; it never certifies ownership, provider approval or byte access. */
export function resolvePhotoChoice<T>(input: {
  readonly explicit?: T | null
  readonly savedDefault?: T | null
  readonly legacy?: T | null
  readonly compatibility: boolean
}): T | null {
  if (input.compatibility) return input.legacy ?? null
  return input.explicit ?? input.savedDefault ?? null
}

async function requirePhotoTrip(scope: TenantScope, tripId: string) {
  if (!(await getMembership(scope, scope.ctx.userId)))
    throw new NotFoundError('trip', tripId)
  return requireTrip(scope, idSchema.parse(tripId))
}

function photoPlaceFilter(
  scope: TenantScope,
  tripId: string,
  writable = false,
) {
  const writer = exists(
    scope.db
      .select({ present: sql`1` })
      .from(tripMembers)
      .where(
        tenantFilter(
          scope,
          tripMembers,
          eq(tripMembers.tripId, trips.id),
          eq(tripMembers.userId, scope.ctx.userId),
          inArray(tripMembers.role, [...TRIP_WRITE_ROLES]),
          stillInWorkspace(scope, tripMembers.userId),
        ),
      ),
  )
  const memberNow = exists(
    scope.db
      .select({ present: sql`1` })
      .from(member)
      .where(tenantFilter(scope, member, eq(member.userId, scope.ctx.userId))),
  )
  return tenantFilter(
    scope,
    places,
    eq(places.tripId, tripId),
    memberNow,
    exists(
      scope.db
        .select({ present: sql`1` })
        .from(trips)
        .where(
          tenantFilter(
            scope,
            trips,
            eq(trips.id, places.tripId),
            readableTripFilter(scope),
            writable ? and(eq(trips.isArchived, false), writer) : undefined,
          ),
        ),
    ),
  )
}

export async function listTripPlacePhotos(
  scope: TenantScope,
  tripId: string,
): Promise<Map<string, PlacePhoto>> {
  await requirePhotoTrip(scope, tripId)
  const rows = await scope.db
    .select({
      id: places.id,
      imageUrl: places.imageUrl,
      mode: placePhotoSelections.mode,
      version: placePhotoSelections.version,
    })
    .from(places)
    .leftJoin(
      placePhotoSelections,
      tenantFilter(
        scope,
        placePhotoSelections,
        eq(placePhotoSelections.placeId, places.id),
        eq(placePhotoSelections.tripId, places.tripId),
      ),
    )
    .where(photoPlaceFilter(scope, tripId))
  return new Map(
    rows.map((row) => {
      const imageUrl = resolvePhotoChoice({
        compatibility: row.mode !== 'fallback',
        legacy: row.imageUrl,
      })
      return [
        row.id,
        {
          imageUrl,
          source: imageUrl === null ? 'fallback' : 'legacy',
          version: row.version ?? 0,
        },
      ]
    }),
  )
}

export async function readPlacePhoto(
  scope: TenantScope,
  tripId: string,
  placeId: string,
): Promise<PlacePhoto> {
  const photo = (await listTripPlacePhotos(scope, tripId)).get(
    idSchema.parse(placeId),
  )
  if (!photo) throw new NotFoundError('place', placeId)
  return photo
}

/** The existing place writer delegates explicit imageUrl changes here, including null. */
export async function updateLegacyPlacePhoto(
  scope: TenantScope,
  placeId: string,
  input: UpdatePlaceInput,
) {
  const { expectedPhotoVersion, expectedTripCurrency, ...values } = definedOnly(
    updatePlaceInput.parse(input),
  )
  const place = await placesRepository.requireById(
    scope,
    idSchema.parse(placeId),
  )
  await requirePhotoTrip(scope, place.tripId)
  const trip = await requireWritableTrip(scope, place.tripId)
  await assertTripRole(scope, place.tripId, TRIP_WRITE_ROLES)
  assertExpectedTripCurrency(trip, expectedTripCurrency)
  if (values.categoryId)
    await categoriesRepository.requireById(scope, values.categoryId)
  if (values.imageUrl === undefined)
    throw new RepositoryError('Photo change required.', 'INVALID_INPUT')
  const mode = values.imageUrl === null ? 'fallback' : 'legacy'
  const currentVersion = sql`coalesce((select ${placePhotoSelections.version} from ${placePhotoSelections} where ${tenantFilter(scope, placePhotoSelections, eq(placePhotoSelections.placeId, placeId))}), 0)`
  const allowed = exists(
    scope.db
      .select({ present: sql`1` })
      .from(places)
      .where(
        allOf(
          photoPlaceFilter(scope, place.tripId, true),
          eq(places.id, placeId),
          expectedPhotoVersion === undefined
            ? undefined
            : sql`${currentVersion} = ${expectedPhotoVersion}`,
          expectedTripCurrency === undefined
            ? undefined
            : exists(
                scope.db
                  .select({ present: sql`1` })
                  .from(trips)
                  .where(
                    tenantFilter(
                      scope,
                      trips,
                      eq(trips.id, place.tripId),
                      eq(trips.currency, expectedTripCurrency),
                    ),
                  ),
              ),
        ),
      ),
  )
  const now = new Date()
  const [, updated] = await runAtomicBatch(scope, [
    prepareTenantInsert(
      scope,
      placePhotoSelections,
      { tripId: place.tripId, placeId, version: 1, mode, updatedAt: now },
      allowed,
    )
      .onConflictDoUpdate({
        target: [
          placePhotoSelections.organizationId,
          placePhotoSelections.placeId,
        ],
        set: {
          version: sql`${placePhotoSelections.version} + 1`,
          mode,
          updatedAt: now,
        },
      })
      .returning(),
    // changes() binds this write to the immediately preceding winning CAS in the same atomic batch.
    scope.db
      .update(places)
      .set({ ...values, updatedAt: now })
      .where(
        tenantFilter(scope, places, eq(places.id, placeId), sql`changes() = 1`),
      )
      .returning(),
  ])
  const result = updated.at(0)
  if (!result)
    throw new RepositoryError(
      'Photo selection changed or is no longer writable.',
      'PHOTO_CONFLICT',
    )
  return result
}
