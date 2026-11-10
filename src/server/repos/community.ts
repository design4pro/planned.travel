/**
 * Private gallery consent records. listExpiredGalleryPreviewsUnscoped is the FU-3 ids/timing-only,
 * indexed bounded discovery read; its sole production caller is src/server/community/expiry.ts.
 */
import { asc, eq, exists, gt, inArray, lte, sql } from 'drizzle-orm'
import { member } from '#/server/db/auth-schema'
import {
  categories,
  days,
  dayAssignments,
  galleryPreviews,
  places,
  trips,
  newId,
} from '#/server/db/schema'
import { workspaceDeletionAbsent } from '#/server/catalog/workspace-deletions'
import {
  galleryPreviewInput,
  GALLERY_MAX_BYTES,
  GALLERY_PREVIEW_TTL_MS,
  parseGallerySnapshot,
} from '#/server/community/snapshot'
import {
  allOf,
  createTenantRepository,
  prepareTenantInsert,
  tenantFilter,
} from './base'
import { NotFoundError } from './context'
import { readableTripFilter } from './trips'
import type {
  GalleryPreview,
  GalleryPreviewInput,
  GalleryPreviewResult,
} from '#/server/community/snapshot'
import type { TenantScope } from './base'
import type { Database } from '#/server/db/types'

const previews = createTenantRepository(galleryPreviews, 'gallery preview')
function authorizedTrip(scope: TenantScope, tripId: string) {
  return allOf(
    tenantFilter(scope, trips, eq(trips.id, tripId), readableTripFilter(scope)),
    exists(
      scope.db
        .select({ id: member.id })
        .from(member)
        .where(
          tenantFilter(
            scope,
            member,
            eq(member.userId, scope.ctx.userId),
            inArray(member.role, ['owner', 'admin']),
          ),
        ),
    ),
    workspaceDeletionAbsent(scope.ctx.organizationId),
  )
}

/** One SQLite source snapshot, bounded before any JSON aggregation. SQL CASE is lazy. */
function canonicalCapture(scope: TenantScope, input: GalleryPreviewInput) {
  const dayScope = tenantFilter(scope, days, eq(days.tripId, trips.id))
  const assignmentScope = tenantFilter(
    scope,
    dayAssignments,
    eq(dayAssignments.tripId, trips.id),
  )
  const placeScope = tenantFilter(scope, places, eq(places.tripId, trips.id))
  return sql`(select case when
    (select count(*) from (select 1 from ${days} where ${dayScope} limit 367)) <= 366
    and (select count(*) from (select 1 from ${dayAssignments} where ${assignmentScope} limit 1001)) <= 1000
    and (select count(*) from (select 1 from ${places} where ${placeScope} limit 1001)) <= 1000
    and not exists (select 1 from ${days} where ${dayScope} and (typeof(${days.dayNumber}) <> 'integer' or ${days.dayNumber} not between 1 and 9007199254740991))
    and not exists (select 1 from ${dayAssignments} where ${assignmentScope} and (typeof(${dayAssignments.orderIndex}) not in ('integer', 'real') or abs(${dayAssignments.orderIndex}) > 1.7976931348623157e308))
    and case when json_valid(coalesce(${trips.countryCodes}, '[]')) then
      json_type(coalesce(${trips.countryCodes}, '[]')) = 'array' and not exists
      (select 1 from json_each(coalesce(${trips.countryCodes}, '[]')) where type <> 'text' or length(value) <> 2 or value glob '*[^A-Z]*')
      else 0 end
    then json_object(
      'version', 1, 'publicTitle', ${input.publicTitle}, 'summary', ${input.summary},
      'attribution', ${input.attribution}, 'showDates', json(${input.showDates ? 'true' : 'false'}),
      'countryCodes', json(coalesce(${trips.countryCodes}, '[]')),
      'days', json((select json_group_array(json(day_document)) from (
        select json_patch(json_object('order', ${days.dayNumber},
          'places', json((select json_group_array(json(place_document)) from (
            select json_patch(json_object('name', ${places.name}, 'category', (
              select ${categories.name} from ${categories} where ${tenantFilter(scope, categories, eq(categories.id, places.categoryId))}
            ), 'order', ${dayAssignments.orderIndex}),
              case when ${places.lat} is not null and ${places.lng} is not null then
                json_object('coordinates', json_object('lat', ${places.lat}, 'lng', ${places.lng})) else '{}' end
            ) as place_document
            from ${dayAssignments} inner join ${places} on ${places.id} = ${dayAssignments.placeId} and ${placeScope}
            where ${assignmentScope} and ${dayAssignments.dayId} = ${days.id}
            order by ${dayAssignments.orderIndex}, ${dayAssignments.id}, ${places.id}
          )))
        ), json_patch(case when ${days.title} is null then '{}' else json_object('title', ${days.title}) end,
          case when ${input.showDates} and ${days.date} is not null then json_object('date', ${days.date}) else '{}' end)) as day_document
        from ${days} where ${dayScope} order by ${days.dayNumber}, ${days.id}
      )))
    ) else null end from ${trips} where ${authorizedTrip(scope, input.tripId)})`
}

export async function previewGallerySubmission(
  scope: TenantScope,
  raw: GalleryPreviewInput,
  now = Date.now(),
): Promise<GalleryPreviewResult> {
  const input = galleryPreviewInput.parse(raw)
  const document = canonicalCapture(scope, input)
  const id = newId()
  const expiresAt = now + GALLERY_PREVIEW_TTL_MS
  const rows = await prepareTenantInsert(
    scope,
    galleryPreviews,
    {
      id,
      tripId: input.tripId,
      actorUserId: scope.ctx.userId,
      document,
      expiresAt,
    },
    sql`${document} is not null and length(cast(${document} as blob)) <= ${GALLERY_MAX_BYTES}`,
  )
    .onConflictDoUpdate({
      target: [
        galleryPreviews.organizationId,
        galleryPreviews.actorUserId,
        galleryPreviews.tripId,
      ],
      set: { id, document: sql`excluded.document`, expiresAt },
    })
    .returning()
  const row = rows[0]
  if (!row) {
    const authorized = await scope.db
      .select({ id: trips.id })
      .from(trips)
      .where(authorizedTrip(scope, input.tripId))
      .limit(1)
    if (!authorized.length) throw new NotFoundError('trip', input.tripId)
    return { status: 'too-large' }
  }
  return {
    status: 'ready',
    previewId: row.id,
    expiresAt: row.expiresAt,
    document: parseGallerySnapshot(row.document),
  }
}

export async function readGalleryPreview(
  scope: TenantScope,
  id: string,
  tripId: string,
  now = Date.now(),
): Promise<GalleryPreview | null> {
  const row = await previews.findOne(
    scope,
    allOf(
      eq(galleryPreviews.id, id),
      eq(galleryPreviews.actorUserId, scope.ctx.userId),
      eq(galleryPreviews.tripId, tripId),
      gt(galleryPreviews.expiresAt, now),
      exists(
        scope.db
          .select({ id: trips.id })
          .from(trips)
          .where(authorizedTrip(scope, tripId)),
      ),
    ),
  )
  return row
    ? {
        previewId: row.id,
        expiresAt: row.expiresAt,
        document: parseGallerySnapshot(row.document),
      }
    : null
}

export async function expireGalleryPreviews(
  scope: TenantScope,
  now: number,
): Promise<number> {
  const due = scope.db
    .select({ id: galleryPreviews.id })
    .from(galleryPreviews)
    .where(
      tenantFilter(scope, galleryPreviews, lte(galleryPreviews.expiresAt, now)),
    )
    .orderBy(asc(galleryPreviews.expiresAt), asc(galleryPreviews.id))
    .limit(100)
  return previews.removeWhere(scope, inArray(galleryPreviews.id, due))
}

export async function listExpiredGalleryPreviewsUnscoped(
  db: Database,
  now: number,
) {
  return db
    .select({
      organizationId: galleryPreviews.organizationId,
      expiresAt: galleryPreviews.expiresAt,
    })
    .from(galleryPreviews)
    .where(lte(galleryPreviews.expiresAt, now))
    .orderBy(asc(galleryPreviews.expiresAt), asc(galleryPreviews.id))
    .limit(100)
}
