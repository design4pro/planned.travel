/**
 * Trips — the aggregate root of the product.
 *
 * Everything else in the itinerary hangs off a trip, so this module also owns the guard the other
 * repositories use before they write a child row: {@link requireTrip}. That is what turns a
 * cross-tenant `tripId` arriving from a client into a `NotFoundError` instead of a row silently
 * re-parented into the caller's own tenant.
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  gte,
  inArray,
  isNull,
  like,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm'
import { z } from 'zod'
import {
  TRIP_MEMBER_ROLES,
  TRIP_STATUSES,
  TRIP_VISIBILITIES,
  shareLinks,
  tripMembers,
  trips,
} from '#/server/db/schema'
import {
  allOf,
  assertQuota,
  createTenantRepository,
  tenantFilter,
} from './base'
import { NotFoundError, RepositoryError } from './context'
import { syncTripDays } from './days'
import {
  colourSchema,
  countryCodeSchema,
  currencySchema,
  dateSchema,
  definedOnly,
  idSchema,
  instantSchema,
  longTextSchema,
  minorAmountSchema,
  nonNegativeIntSchema,
  shortTextSchema,
  slugSchema,
  slugify,
  titleSchema,
  urlSchema,
} from './validation'
import type { SQL } from 'drizzle-orm'
import type { ShareScopes } from '#/server/db/schema'
import type { ShareLink, Trip, TripMember } from '#/server/db/types'
import type { TenantScope } from './base'

export const tripsRepository = createTenantRepository(trips, 'trip')
export const tripMembersRepository = createTenantRepository(
  tripMembers,
  'trip member',
)
export const shareLinksRepository = createTenantRepository(
  shareLinks,
  'share link',
)

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const tripStatusSchema = z.enum(TRIP_STATUSES)
const tripVisibilitySchema = z.enum(TRIP_VISIBILITIES)
const tripMemberRoleSchema = z.enum(TRIP_MEMBER_ROLES)

const tripFields = {
  title: titleSchema,
  slug: slugSchema.optional(),
  summary: shortTextSchema.nullish(),
  description: longTextSchema.nullish(),
  destination: shortTextSchema.nullish(),
  countryCodes: z.array(countryCodeSchema).max(50).nullish(),
  startDate: dateSchema.nullish(),
  endDate: dateSchema.nullish(),
  timezone: shortTextSchema.nullish(),
  currency: currencySchema.optional(),
  status: tripStatusSchema.optional(),
  visibility: tripVisibilitySchema.optional(),
  coverImageKey: shortTextSchema.nullish(),
  coverImageUrl: urlSchema.nullish(),
  accentColour: colourSchema.nullish(),
  budgetTargetMinor: minorAmountSchema.nullish(),
  reminderDays: nonNegativeIntSchema.max(365).optional(),
  isFavourite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
}

/**
 * Creation accepts one field an update never may: the primary key itself.
 *
 * Omit it and the column's `$defaultFn(newId)` mints a time-sortable random key, which is what
 * every real user gets. Supply it and the row is keyed by the caller's own string — the seam the
 * demo fixture uses so a workspace rebuilt from `scripts/seed` keys its trips identically every
 * time. That matters because a trip's cover art is a pure hash of its id, so a regenerated key
 * silently repaints the card and moves any screenshot that photographs it.
 *
 * It is validated like any other id and it is never reachable from a client: `createTripFn`
 * builds its repository input field by field, so no request body can reach this key.
 */
export const createTripInput = z.object({
  ...tripFields,
  id: idSchema.optional(),
})
export type CreateTripInput = z.infer<typeof createTripInput>

/** Deliberately without `id`: a primary key is chosen once, at creation, and never patched. */
export const updateTripInput = z.object({
  ...tripFields,
  title: titleSchema.optional(),
})
export type UpdateTripInput = z.infer<typeof updateTripInput>

export const listTripsInput = z.object({
  status: tripStatusSchema.optional(),
  statuses: z.array(tripStatusSchema).min(1).optional(),
  archived: z.boolean().optional(),
  favourite: z.boolean().optional(),
  search: shortTextSchema.min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: nonNegativeIntSchema.optional(),
})
export type ListTripsInput = z.infer<typeof listTripsInput>

export const addTripMemberInput = z.object({
  tripId: idSchema,
  userId: idSchema,
  role: tripMemberRoleSchema.optional(),
  colour: colourSchema.nullish(),
  joinedAt: instantSchema.nullish(),
})
export type AddTripMemberInput = z.infer<typeof addTripMemberInput>

export const updateTripMemberInput = z.object({
  role: tripMemberRoleSchema.optional(),
  colour: colourSchema.nullish(),
  joinedAt: instantSchema.nullish(),
})
export type UpdateTripMemberInput = z.infer<typeof updateTripMemberInput>

const shareScopesSchema: z.ZodType<ShareScopes> = z.object({
  map: z.boolean(),
  itinerary: z.boolean(),
  reservations: z.boolean(),
  lists: z.boolean(),
  budget: z.boolean(),
  collab: z.boolean(),
  files: z.boolean(),
})

export const createShareLinkInput = z.object({
  tripId: idSchema,
  token: z.string().trim().min(16).max(64),
  scopes: shareScopesSchema,
  expiresAt: instantSchema.nullish(),
})
export type CreateShareLinkInput = z.infer<typeof createShareLinkInput>

/* -------------------------------------------------------------------------------------------------
 * Guards
 * ---------------------------------------------------------------------------------------------- */

/**
 * Who may see a trip, as one `EXISTS` sub-select (ADR 0007, PRD #104 decision 1).
 *
 * A trip is readable by the acting user when they hold a `trip_members` row on it, or when its
 * `visibility` is `organization` — every member of the workspace may then read it. `public` grants a
 * signed-in reader nothing on its own: it is the share plan's value, for session-less access, and
 * treating it as a second organization-wide door here would silently publish a trip to the workspace
 * the moment a share link was minted.
 *
 * A sub-select rather than a join or a second query, because every trip reader in this module is a
 * list: one query per row is the shape this predicate exists to avoid, and a join would multiply the
 * trip row by its membership. Both sides are `tenantFilter()`-bound, so the membership half can no
 * more cross an organization boundary than the trip half can.
 */
function readableTrips(scope: TenantScope): SQL {
  const isMember = exists(
    scope.db
      .select({ present: sql`1` })
      .from(tripMembers)
      .where(
        tenantFilter(
          scope,
          tripMembers,
          eq(tripMembers.tripId, trips.id),
          eq(tripMembers.userId, scope.ctx.userId),
        ),
      ),
  )
  // `or()` widens to `SQL | undefined` and only returns `undefined` for an empty argument list,
  // which this is not — the same narrowing `allOf` performs for `and()`, done here rather than cast.
  return or(eq(trips.visibility, 'organization'), isMember) ?? isMember
}

/**
 * Whether the acting user may see this trip at all. The question every trip-scoped reader asks
 * before it answers anything else; {@link requireTrip} is the same question with a throw on it.
 */
export async function canReadTrip(
  scope: TenantScope,
  tripId: string,
): Promise<boolean> {
  return (
    (await tripsRepository.count(
      scope,
      allOf(eq(trips.id, tripId), readableTrips(scope)),
    )) > 0
  )
}

/**
 * Resolves a trip the acting user may see, or throws {@link NotFoundError}. Every repository that
 * writes a trip-scoped row calls this first, so an id belonging to another organization is rejected
 * rather than quietly adopted — and, since ADR 0007, so is an id belonging to a private trip in the
 * caller's own organization that they are not a member of.
 *
 * The two cases raise the same error deliberately. "Not yours to see" and "not there" must be
 * indistinguishable from outside, or the error itself tells a reader which trip ids exist.
 */
export async function requireTrip(
  scope: TenantScope,
  tripId: string,
): Promise<Trip> {
  const trip = await tripsRepository.findOne(
    scope,
    allOf(eq(trips.id, tripId), readableTrips(scope)),
  )
  if (trip === null) {
    throw new NotFoundError('trip', tripId)
  }
  return trip
}

/**
 * The acting user's role on a trip they may already see, or a `FORBIDDEN` {@link RepositoryError}.
 *
 * Distinguishable from {@link NotFoundError} on purpose, and the distinction is safe precisely
 * because it is reached only after {@link requireTrip}: the caller has already proved they may see
 * the trip, so "you may not do that" tells them nothing they did not know. The guard lives in the
 * repository rather than in a handler so it holds for a queue consumer and a future route as well
 * as for a server function — the same argument `ARCHITECTURE.md` §6 makes about quota.
 *
 * A reader of an organization-visible trip holds no membership row at all; that is a refusal, not a
 * crash, so the missing role is reported as `none`.
 */
export async function assertTripRole(
  scope: TenantScope,
  tripId: string,
  allowed: ReadonlyArray<TripMember['role']>,
): Promise<TripMember['role']> {
  const role = await tripRoleFor(scope, tripId, scope.ctx.userId)
  if (role === null || !allowed.includes(role)) {
    throw new RepositoryError(
      `Trip role ${role ?? 'none'} is not permitted here; requires one of: ${allowed.join(', ')}.`,
      'FORBIDDEN',
    )
  }
  return role
}

/* -------------------------------------------------------------------------------------------------
 * Slugs
 * ---------------------------------------------------------------------------------------------- */

const SLUG_ATTEMPTS = 25

/** Finds a slug free within the tenant, appending `-2`, `-3`, … on collision. */
async function reserveTripSlug(
  scope: TenantScope,
  desired: string,
  excludeTripId?: string,
): Promise<string> {
  const base = slugify(desired, 'trip')
  for (let attempt = 1; attempt <= SLUG_ATTEMPTS; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base.slice(0, 74)}-${attempt}`
    const clashes = await tripsRepository.count(
      scope,
      and(
        eq(trips.slug, candidate),
        excludeTripId ? ne(trips.id, excludeTripId) : undefined,
      ),
    )
    if (clashes === 0) {
      return candidate
    }
  }
  return `${base.slice(0, 68)}-${Date.now().toString(36)}`
}

/* -------------------------------------------------------------------------------------------------
 * Queries
 * ---------------------------------------------------------------------------------------------- */

function listFilter(input: ListTripsInput): SQL | undefined {
  const parts: Array<SQL | undefined> = []
  if (input.status) {
    parts.push(eq(trips.status, input.status))
  }
  if (input.statuses && input.statuses.length > 0) {
    parts.push(inArray(trips.status, [...input.statuses]))
  }
  if (input.archived !== undefined) {
    parts.push(eq(trips.isArchived, input.archived))
  }
  if (input.favourite !== undefined) {
    parts.push(eq(trips.isFavourite, input.favourite))
  }
  if (input.search) {
    const needle = `%${input.search.toLowerCase()}%`
    parts.push(
      or(
        like(trips.title, needle),
        like(trips.destination, needle),
        like(trips.summary, needle),
      ),
    )
  }
  return and(...parts)
}

/**
 * Trips the acting user may see, most recently touched first.
 *
 * The read predicate is ANDed into the same statement as the caller's filters rather than applied to
 * its result, so a `limit` counts readable trips and never fills a page with rows that are then
 * dropped.
 */
export async function listTrips(
  scope: TenantScope,
  input: ListTripsInput = {},
): Promise<Array<Trip>> {
  const options = listTripsInput.parse(input)
  return tripsRepository.findMany(scope, {
    where: allOf(readableTrips(scope), listFilter(options)),
    orderBy: [desc(trips.updatedAt)],
    limit: options.limit,
    offset: options.offset,
  })
}

export async function getTrip(
  scope: TenantScope,
  tripId: string,
): Promise<Trip | null> {
  return tripsRepository.findOne(
    scope,
    allOf(eq(trips.id, tripId), readableTrips(scope)),
  )
}

export async function getTripBySlug(
  scope: TenantScope,
  slug: string,
): Promise<Trip | null> {
  return tripsRepository.findOne(
    scope,
    allOf(eq(trips.slug, slug), readableTrips(scope)),
  )
}

/** Trips that have not finished yet, soonest first — the dashboard's "next up" rail. */
export async function listUpcomingTrips(
  scope: TenantScope,
  options: { readonly today: string; readonly limit?: number } = {
    today: todayIso(),
  },
): Promise<Array<Trip>> {
  const today = dateSchema.parse(options.today)
  return tripsRepository.findMany(scope, {
    where: allOf(
      readableTrips(scope),
      eq(trips.isArchived, false),
      or(
        gte(trips.endDate, today),
        and(isNull(trips.endDate), gte(trips.startDate, today)),
      ),
    ),
    orderBy: [asc(trips.startDate), asc(trips.id)],
    limit: options.limit ?? 5,
  })
}

/** Trips already finished, most recent first — the atlas and journey pickers use this. */
export async function listPastTrips(
  scope: TenantScope,
  options: { readonly today?: string; readonly limit?: number } = {},
): Promise<Array<Trip>> {
  const today = dateSchema.parse(options.today ?? todayIso())
  return tripsRepository.findMany(scope, {
    where: allOf(readableTrips(scope), lte(trips.endDate, today)),
    orderBy: [desc(trips.endDate)],
    limit: options.limit ?? 20,
  })
}

export interface TripStatusCounts {
  readonly total: number
  readonly byStatus: Record<(typeof TRIP_STATUSES)[number], number>
  readonly archived: number
  readonly favourites: number
}

/**
 * One grouped read behind the dashboard's status chips, over the trips the acting user may see.
 *
 * Every figure here carries the predicate, including the two below: a count that included a private
 * trip the reader cannot open would be the same leak as listing it, spread over three numbers instead
 * of one row.
 */
export async function countTripsByStatus(
  scope: TenantScope,
): Promise<TripStatusCounts> {
  const rows = await scope.db
    .select({ status: trips.status, value: count() })
    .from(trips)
    .where(tenantFilter(scope, trips, readableTrips(scope)))
    .groupBy(trips.status)

  const byStatus = Object.fromEntries(
    TRIP_STATUSES.map((status) => [status, 0]),
  ) as Record<(typeof TRIP_STATUSES)[number], number>
  let total = 0
  for (const row of rows) {
    total += row.value
    if ((TRIP_STATUSES as ReadonlyArray<string>).includes(row.status)) {
      byStatus[row.status as (typeof TRIP_STATUSES)[number]] = row.value
    }
  }

  const [archived, favourites] = await Promise.all([
    tripsRepository.count(
      scope,
      allOf(readableTrips(scope), eq(trips.isArchived, true)),
    ),
    tripsRepository.count(
      scope,
      allOf(readableTrips(scope), eq(trips.isFavourite, true)),
    ),
  ])

  return { total, byStatus, archived, favourites }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

/**
 * Creates a trip, its unique slug, its owner membership and its day run in one flow. Quota is
 * checked first so a tenant at its plan ceiling never gets a half-built trip.
 *
 * `id` is left off the insert unless the caller named one, so the column's own default generator
 * fires exactly as it does for every real user rather than being handed an `undefined` to fall
 * back from.
 */
export async function createTrip(
  scope: TenantScope,
  input: CreateTripInput,
): Promise<Trip> {
  const { id, ...values } = createTripInput.parse(input)
  assertDateOrder(values.startDate, values.endDate)

  await assertQuota(scope, 'trips', await tripsRepository.count(scope))

  const slug = await reserveTripSlug(scope, values.slug ?? values.title)
  const trip = await tripsRepository.insert(scope, {
    ...values,
    ...(id === undefined ? {} : { id }),
    slug,
    createdBy: scope.ctx.userId,
  })

  await tripMembersRepository.insert(scope, {
    tripId: trip.id,
    userId: scope.ctx.userId,
    role: 'owner',
    joinedAt: new Date(),
  })

  if (trip.startDate && trip.endDate) {
    await syncTripDays(scope, trip.id, {
      startDate: trip.startDate,
      endDate: trip.endDate,
    })
  }

  return trip
}

/**
 * Applies a patch and, when the date range moved, reconciles the trip's day run with it.
 *
 * A trip's metadata is its owner's (PRD #104 decision 6): moving the dates moves every member's day
 * run, so an editor — who owns the plan's *content* — is refused here.
 */
export async function updateTrip(
  scope: TenantScope,
  tripId: string,
  input: UpdateTripInput,
): Promise<Trip> {
  const existing = await requireTrip(scope, tripId)
  await assertTripRole(scope, tripId, ['owner'])
  const values = definedOnly(updateTripInput.parse(input))

  const startDate =
    values.startDate === undefined ? existing.startDate : values.startDate
  const endDate =
    values.endDate === undefined ? existing.endDate : values.endDate
  assertDateOrder(startDate, endDate)

  const slug =
    values.slug === undefined || values.slug === existing.slug
      ? undefined
      : await reserveTripSlug(scope, values.slug, tripId)

  const trip = await tripsRepository.requireUpdate(scope, tripId, {
    ...values,
    ...(slug === undefined ? {} : { slug }),
  })

  if (startDate !== existing.startDate || endDate !== existing.endDate) {
    await syncTripDays(scope, tripId, { startDate, endDate })
  }

  return trip
}

/**
 * Shelves a trip. **Archive is a flag, not a status** (PRD #104 decision 2): this used to write
 * `status = 'archived'` alongside the flag, and `restoreTrip` used to reset the status to
 * `'planning'`, so a completed trip came back from the archive "in planning". Neither writes the
 * column any more, and the `'archived'` value stays in `trips_status_chk` as one nothing writes —
 * removing it from the constraint is a table rebuild on SQLite.
 *
 * Nothing is scheduled or cancelled here. Reminders are a scan (ADR 0005) whose predicate excludes
 * archived trips, so the archive *is* the switch and a scheduler call added here would be the defect.
 */
export async function archiveTrip(
  scope: TenantScope,
  tripId: string,
): Promise<Trip> {
  await requireTrip(scope, tripId)
  await assertTripRole(scope, tripId, ['owner'])
  return tripsRepository.requireUpdate(scope, tripId, { isArchived: true })
}

/** Brings a trip back with the lifecycle status it went in with. See {@link archiveTrip}. */
export async function restoreTrip(
  scope: TenantScope,
  tripId: string,
): Promise<Trip> {
  await requireTrip(scope, tripId)
  await assertTripRole(scope, tripId, ['owner'])
  return tripsRepository.requireUpdate(scope, tripId, { isArchived: false })
}

export async function setTripFavourite(
  scope: TenantScope,
  tripId: string,
  isFavourite: boolean,
): Promise<Trip> {
  return tripsRepository.requireUpdate(scope, tripId, { isFavourite })
}

/** Deletes the trip; every child row goes with it through `ON DELETE CASCADE`. */
export async function deleteTrip(
  scope: TenantScope,
  tripId: string,
): Promise<void> {
  await requireTrip(scope, tripId)
  await assertTripRole(scope, tripId, ['owner'])
  await tripsRepository.requireRemove(scope, tripId)
}

function assertDateOrder(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
) {
  if (startDate && endDate && endDate < startDate) {
    throw new RepositoryError(
      'A trip cannot end before it starts.',
      'INVALID_DATE_RANGE',
    )
  }
}

/* -------------------------------------------------------------------------------------------------
 * Trip membership
 * ---------------------------------------------------------------------------------------------- */

export async function listTripMembers(
  scope: TenantScope,
  tripId: string,
): Promise<Array<TripMember>> {
  return tripMembersRepository.findMany(scope, {
    where: eq(tripMembers.tripId, tripId),
    orderBy: [asc(tripMembers.createdAt)],
  })
}

/**
 * Trips the given user collaborates on, newest first — now a thin alias for {@link listTrips}.
 *
 * Since ADR 0007 `listTrips` already answers "the trips this scope may see", which is the question
 * this function used to answer with a membership query of its own. It is kept for its callers rather
 * than removed, and it keeps its `userId` argument because the dashboard's summary still takes one.
 *
 * A `userId` that is not the acting user's returns nothing. A tenant-scoped read may answer for its
 * own principal and no other — "which trips is my colleague on" is precisely the question decision 1
 * closes — and an empty list refuses it without disclosing whether there was anything to refuse.
 */
export async function listTripsForUser(
  scope: TenantScope,
  userId: string,
  options: { readonly limit?: number } = {},
): Promise<Array<Trip>> {
  if (userId !== scope.ctx.userId) {
    return []
  }
  return listTrips(
    scope,
    options.limit === undefined ? {} : { limit: options.limit },
  )
}

export async function addTripMember(
  scope: TenantScope,
  input: AddTripMemberInput,
): Promise<TripMember> {
  const values = addTripMemberInput.parse(input)
  await requireTrip(scope, values.tripId)
  return tripMembersRepository.insert(scope, {
    ...values,
    invitedBy: scope.ctx.userId,
  })
}

export async function updateTripMember(
  scope: TenantScope,
  memberId: string,
  input: UpdateTripMemberInput,
): Promise<TripMember> {
  return tripMembersRepository.requireUpdate(
    scope,
    memberId,
    definedOnly(updateTripMemberInput.parse(input)),
  )
}

export async function removeTripMember(
  scope: TenantScope,
  memberId: string,
): Promise<void> {
  await tripMembersRepository.requireRemove(scope, memberId)
}

/**
 * The acting user's role on each of the given trips, keyed by trip id.
 *
 * One statement for the whole list, because its caller is a grid: the trip index and the dashboard
 * render a menu per tile whose items depend on the role, and a query per tile is the shape ADR 0007's
 * predicate exists to avoid. A trip the user is not a member of — an organization-visible one they
 * may read — simply has no entry, which is what "no role" is.
 */
export async function tripRolesFor(
  scope: TenantScope,
  tripIds: ReadonlyArray<string>,
): Promise<Map<string, TripMember['role']>> {
  const roles = new Map<string, TripMember['role']>()
  if (tripIds.length === 0) {
    return roles
  }
  const rows = await tripMembersRepository.findMany(scope, {
    where: allOf(
      inArray(tripMembers.tripId, [...tripIds]),
      eq(tripMembers.userId, scope.ctx.userId),
    ),
  })
  for (const row of rows) {
    roles.set(row.tripId, row.role)
  }
  return roles
}

/** The acting user's role on a trip, or `null` when they are not a collaborator. */
export async function tripRoleFor(
  scope: TenantScope,
  tripId: string,
  userId: string,
): Promise<TripMember['role'] | null> {
  const rows = await tripMembersRepository.findMany(scope, {
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)),
    limit: 1,
  })
  return rows[0]?.role ?? null
}

/* -------------------------------------------------------------------------------------------------
 * Share links
 * ---------------------------------------------------------------------------------------------- */

export async function listShareLinks(
  scope: TenantScope,
  tripId: string,
): Promise<Array<ShareLink>> {
  return shareLinksRepository.findMany(scope, {
    where: eq(shareLinks.tripId, tripId),
    orderBy: [desc(shareLinks.createdAt)],
  })
}

export async function createShareLink(
  scope: TenantScope,
  input: CreateShareLinkInput,
): Promise<ShareLink> {
  const values = createShareLinkInput.parse(input)
  await requireTrip(scope, values.tripId)
  return shareLinksRepository.insert(scope, {
    ...values,
    createdBy: scope.ctx.userId,
  })
}

export async function revokeShareLink(
  scope: TenantScope,
  shareLinkId: string,
): Promise<ShareLink> {
  return shareLinksRepository.requireUpdate(scope, shareLinkId, {
    revokedAt: new Date(),
  })
}

/**
 * Records a visit to a share link. Public visitors have no tenant context, so the caller resolves
 * the link by token first and builds a scope from the row's own organization — the one place where a
 * tenant context is derived from data rather than a session, and the reason
 * {@link NotFoundError} is raised here if the link is not live.
 */
export async function touchShareLink(
  scope: TenantScope,
  shareLinkId: string,
): Promise<ShareLink> {
  const link = await shareLinksRepository.requireById(scope, shareLinkId)
  if (
    link.revokedAt !== null ||
    (link.expiresAt !== null && link.expiresAt.getTime() < Date.now())
  ) {
    throw new NotFoundError('share link', shareLinkId)
  }
  return shareLinksRepository.requireUpdate(scope, shareLinkId, {
    viewCount: link.viewCount + 1,
    lastViewedAt: new Date(),
  })
}
