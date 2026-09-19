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
  getTableColumns,
  gte,
  inArray,
  isNull,
  like,
  lte,
  ne,
  not,
  or,
  sql,
} from 'drizzle-orm'
import { z } from 'zod'
import {
  TRIP_MEMBER_ROLES,
  TRIP_STATUSES,
  TRIP_VISIBILITIES,
  dayAssignments,
  dayNotes,
  days,
  newId,
  placeTags,
  places,
  shareLinks,
  tripFavourites,
  tripMembers,
  trips,
} from '#/server/db/schema'
import {
  allOf,
  anyOf,
  assertQuota,
  createTenantRepository,
  inIds,
  tenantFilter,
} from './base'
import {
  isUniqueConstraintViolation,
  NotFoundError,
  RepositoryError,
} from './context'
import { getMembership } from './members'
import {
  dayNotesRepository,
  daysRepository,
  listTripDays,
  syncTripDays,
} from './days'
import { dayAssignmentsRepository } from './itinerary'
import { placeTagsAccess, placesRepository } from './places'
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
import type { Day, ShareLink, Trip, TripMember } from '#/server/db/types'
import type { ListOptions, TenantScope, TenantTable } from './base'

/*
 * The imports above close two cycles — `places.ts` and `itinerary.ts` both import this module for
 * `requireTrip` — and both are safe, because neither side names the other at module scope. What
 * those two evaluate on load is a repository handle and a set of Zod schemas; `requireTrip` and
 * `assertTripRole` are reached from inside a function body, long after every module is initialised.
 * The alternative — a second handle on `places` declared here — is the duplication `base.ts` exists
 * to make unnecessary, and two handles on one table is a worse bargain than an import cycle no
 * evaluation order can observe.
 */

/**
 * Every trip in the tenant, readable or not.
 *
 * Tenant-filtered and nothing more, so it answers the questions that are asked *about the workspace*
 * rather than on a reader's behalf: the quota count, the slug reservation, the plan-usage figure, and
 * the writes, which are gated by {@link requireTrip} before they get here. A read that answers a
 * person goes through {@link readableTrips} instead.
 */
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

/** A collaborator's standing on one trip, as the `CHECK` on `trip_members.role` spells it. */
export type TripRole = (typeof TRIP_MEMBER_ROLES)[number]

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
  isArchived: z.boolean().optional(),
}

/**
 * Creation accepts two fields an update never may: the primary key itself, and the deprecated
 * `isFavourite` (see its note below).
 *
 * The id: omit it and the column's `$defaultFn(newId)` mints a time-sortable random key, which is what
 * every real user gets. Supply it and the row is keyed by the caller's own string — the seam the
 * demo fixture uses so a workspace rebuilt from `scripts/seed` keys its trips identically every
 * time. That matters because a trip's cover art is a pure hash of its id, so a regenerated key
 * silently repaints the card and moves any screenshot that photographs it.
 *
 * The id is validated like any other and it is never reachable from a client: the boundary schema
 * `createTripInputSchema` (`src/routes/_app/-server/trip-lifecycle.ts`) is a `z.strictObject`, so a
 * request body carrying this key is refused rather than forwarded.
 */
export const createTripInput = z.object({
  ...tripFields,
  id: idSchema.optional(),
  /**
   * @deprecated The favourite is one person's row in `trip_favourites`; write it through
   * `setFavourite` (`src/server/repos/trip-favourites.ts`). The column stays because dropping one
   * is a table rebuild on SQLite — see its `@deprecated` note in `schema.ts` — and this field stays
   * with it only because the dev seed (`routes/api/dev/-seed/apply-trip.ts`) still sets it at
   * creation. It is deliberately not in `tripFields`, so {@link updateTripInput} cannot patch it.
   */
  isFavourite: z.boolean().optional(),
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
 *
 * Exported for {@link readableTrips}, which is how a reader should reach it; a query that needs the
 * bare `SQL` — one grouped aggregate here, and the journey read predicate in `journey.ts`, which asks
 * it of the trip a journey names (ADR 0020) — takes it directly and is visibly doing something the
 * handle could not do for it.
 */
export function readableTripFilter(scope: TenantScope): SQL {
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
  return anyOf(eq(trips.visibility, 'organization'), isMember)
}

/** The three reads a trip reader needs, with {@link readableTripFilter} already inside them. */
export interface ReadableTrips {
  findOne: (where: SQL) => Promise<Trip | null>
  findMany: (options?: ListOptions) => Promise<Array<Trip>>
  count: (where?: SQL) => Promise<number>
}

/**
 * The trips the acting user may see, as a handle rather than as a predicate to remember.
 *
 * ADR 0002's archetype for the tenant filter is that it cannot be removed — it is not something a
 * query says, it is something the handle does — and after ADR 0007 the read predicate carries the
 * same weight and deserves the same treatment. `tripsRepository` answers for *every* trip in the
 * tenant, which is right for the quota count in {@link createTrip}, for the slug reservation, and for
 * the plan-usage figure in `billing/runtime.cloudflare.ts`, and wrong for every reader. While both
 * were spelled `tripsRepository.findMany`, nothing but memory told them apart, and memory had already
 * missed two: `listTripsWithoutJourney` and `journalCoverage` in `journey.ts` offered a workspace
 * member the titles and counts of private trips they cannot open until #196 routed them through here.
 * That is the argument for the handle: the miss was invisible at the call site, and the only thing
 * that makes the next one visible is that a reader has to name `tripsRepository` to get past it.
 */
export function readableTrips(scope: TenantScope): ReadableTrips {
  const readable = readableTripFilter(scope)
  return {
    findOne: (where) => tripsRepository.findOne(scope, allOf(readable, where)),
    findMany: (options = {}) =>
      tripsRepository.findMany(scope, {
        ...options,
        where: allOf(readable, options.where),
      }),
    count: (where) => tripsRepository.count(scope, allOf(readable, where)),
  }
}

/**
 * Which trips the acting user has starred, as one correlated `EXISTS` over `trip_favourites`
 * (PRD #104 decision 5).
 *
 * A predicate over a *trip*, which is why it lives here beside {@link readableTripFilter} rather
 * than with the rows it reads: the trip list needs it inside the same statement as the read
 * predicate and the caller's other filters, so a `limit` counts starred trips instead of filling a
 * page it then discards. `src/server/repos/trip-favourites.ts` owns the row — it is written,
 * listed and counted there — and reads it back through this, so the star and the trip it marks can
 * never disagree about who may see it.
 *
 * Keyed by `scope.ctx.userId`: a shared flag is exactly the shape this replaces.
 */
export function favouritedTripFilter(scope: TenantScope): SQL {
  return exists(
    scope.db
      .select({ present: sql`1` })
      .from(tripFavourites)
      .where(
        tenantFilter(
          scope,
          tripFavourites,
          eq(tripFavourites.tripId, trips.id),
          eq(tripFavourites.userId, scope.ctx.userId),
        ),
      ),
  )
}

/**
 * The trips a given person is a member of, as a sub-select rather than as a list of ids.
 *
 * The population every trip-derived figure on a `travel_stats` row is computed over. ADR 0007 makes
 * a trip private to its members, and a figure that counts a trip the row's owner cannot open states
 * something they have no way to check: a place count that moves when a colleague saves a restaurant
 * on a trip that was never theirs, and a spend total they cannot reconcile against anything on
 * screen.
 *
 * `userId` is a parameter and is never `scope.ctx.userId`, because cron and the queue consumer
 * recompute a row for someone other than themselves. That is the property most at risk from a
 * careless "reuse {@link readableTripFilter}" simplification, and it is the second reason the two
 * live side by side rather than merging: membership alone, not the readability predicate. An
 * organization-visible trip is one a person *may* open, not one they are travelling on, and "trips I
 * am a member of" is also what a traveller means by "my trips".
 *
 * A sub-select rather than a materialized `Array<string>` because D1 refuses a statement carrying
 * more than {@link MAX_BOUND_PARAMETERS} bound parameters and drizzle binds one per id, while the
 * paid plans sell unlimited trips: an id list would make the stat row of a traveller with a few
 * hundred lifetime trips fail where it succeeds today. This side binds two, the tenant and the user,
 * however many trips the traveller is on — three for the whole statement once the consumer has bound
 * its own tenant, against the one-per-id an `inArray` over a materialized list would have cost.
 *
 * Both sides are `tenantFilter()`-bound, so the membership half can no more cross an organization
 * boundary than the statement that consumes it can. The sub-select drives from
 * `trip_members_org_user_idx (organization_id, user_id)`, with both columns constant.
 */
export function memberTripIds(scope: TenantScope, userId: string) {
  return scope.db
    .select({ id: tripMembers.tripId })
    .from(tripMembers)
    .where(tenantFilter(scope, tripMembers, eq(tripMembers.userId, userId)))
}

/**
 * Whether the acting user may see this trip at all. The question every trip-scoped reader asks
 * before it answers anything else; {@link requireTrip} is the same question with a throw on it.
 */
export async function canReadTrip(
  scope: TenantScope,
  tripId: string,
): Promise<boolean> {
  return (await readableTrips(scope).count(eq(trips.id, tripId))) > 0
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
  const trip = await readableTrips(scope).findOne(eq(trips.id, tripId))
  if (trip === null) {
    throw new NotFoundError('trip', tripId)
  }
  return trip
}

/**
 * Thrown when the trip exists and the caller may see it, but it is archived.
 *
 * An archived trip is a record of something that happened, and letting a write rewrite it is how a
 * history stops being one. The message is the whole point of the class: it is authored copy, listed
 * in `AUTHORED_ERROR_NAMES` (`src/server/errors/public.ts`) so the refusal reaches the reader as
 * itself instead of as a generic failure with a Sentry event behind it. It carries no interpolation
 * for the same reason - the sentence crosses the boundary verbatim, so nothing tenant-shaped may be
 * in it.
 *
 * A distinct code rather than `FORBIDDEN`: this is a property of the trip, not of the caller, and
 * the instruction that follows from it - restore the trip - is a different one.
 */
export class TripArchivedError extends RepositoryError {
  constructor() {
    super(
      'This trip is archived. Restore it before making changes.',
      'TRIP_ARCHIVED',
    )
  }
}

/**
 * Resolves a trip the caller may see and may still write to, or throws.
 *
 * {@link requireTrip} answers "may this person see it"; this adds "is it still open for writes",
 * which is the check every planner write shares. It lives beside {@link assertTripRole} rather than
 * in each handler for the reason that guard's docblock gives: the rule is the trip's, so it has to
 * hold for a queue consumer and a future route as well as for the three server-function modules
 * that call it today, and one archived-write refusal with three implementations is the class of
 * defect `docs/SPEC.md` §8 exists to prevent.
 *
 * Role is deliberately not checked here. Whether an archived trip refuses before or after the role
 * is a per-caller decision - `-server/day-notes.ts` documents its own order - so composing the two
 * is the caller's job.
 */
export async function requireWritableTrip(
  scope: TenantScope,
  tripId: string,
): Promise<Trip> {
  const trip = await requireTrip(scope, tripId)
  if (trip.isArchived) {
    throw new TripArchivedError()
  }
  return trip
}

/**
 * Thrown when the caller may see the trip but holds the wrong role on it.
 *
 * `FORBIDDEN` is the same code {@link ForbiddenError} carries for an organization role, because it
 * answers the same question - the context is valid and the role is not enough. Which of the two
 * refused is the class, not the string: nothing outside these repositories reads `code`, and a
 * second name for one answer would make an organization refusal and a trip refusal
 * indistinguishable to anybody who did.
 *
 * The same question does not mean the same answer on screen. This class is authored copy and
 * `ForbiddenError` is not, on purpose: this sentence is drawn from the trip's closed role vocabulary
 * on both sides, while `ForbiddenError` interpolates a free-text `action`. Its docblock records the
 * rest of the reasoning, so the asymmetry is a decision rather than an oversight.
 */
export class TripRoleError extends RepositoryError {
  constructor(
    readonly required: ReadonlyArray<TripRole>,
    readonly actual: TripRole | null,
  ) {
    super(
      `A ${actual ?? 'non-member'} may not change this trip; requires one of: ${required.join(', ')}.`,
      'FORBIDDEN',
    )
  }
}

/**
 * Refuses a writer whose **trip** role is not one of `required`.
 *
 * Membership is not a role. {@link requireTrip} answers "is this trip inside the caller's tenant",
 * which is the boundary the whole data layer is built on and is a different question from "may this
 * person change the plan" - so before this guard existed a viewer could write a transport while
 * `trip-room.ts:358` refused them the very same edit over the collaborative session. Two answers to
 * one question is a defect whichever of them is right, and the restrictive one is right: a viewer
 * reads.
 *
 * Distinguishable from {@link NotFoundError} on purpose, and the distinction is safe precisely
 * because it is reached only after {@link requireTrip}: the caller has already proved they may see
 * the trip, so "you may not do that" tells them nothing they did not know. The guard lives in the
 * repository rather than in a handler so it holds for a queue consumer and a future route as well
 * as for a server function - the same argument `ARCHITECTURE.md` §6 makes about quota.
 *
 * Read paths are deliberately not guarded. A viewer is on the trip to see it, and the tenant filter
 * already decides what they can see.
 *
 * It lives here rather than beside any one area's writers because a trip's roles are the trip's:
 * `transports.ts`, `itinerary.ts` and the lifecycle handlers all call this one, and two
 * implementations of an access rule is the class of defect `docs/SPEC.md` §8 exists to prevent.
 */
export async function assertTripRole(
  scope: TenantScope,
  tripId: string,
  required: ReadonlyArray<TripRole>,
): Promise<void> {
  // The column is plain `text` behind a `CHECK`, so what comes back is a string. Narrowing it
  // through the enum rather than comparing raw text means a value the enum does not carry is *no
  // role* - a refusal - rather than a value that slipped past an `includes` on a widened type.
  // `required` needs no such parse: it is a constant of a calling module, never a value off the wire.
  const stored = tripMemberRoleSchema.safeParse(
    await tripRoleFor(scope, tripId, scope.ctx.userId),
  )
  if (!stored.success || !required.includes(stored.data)) {
    throw new TripRoleError(required, stored.success ? stored.data : null)
  }
}

/**
 * Resolves a trip the acting user both may see and may change, or throws.
 *
 * The two guards in the order every trip write needs them: {@link requireTrip} first, so a caller who
 * may not see the trip is answered with {@link NotFoundError} and learns nothing, and only then
 * {@link assertTripRole}, whose `FORBIDDEN` is safe because by that point they have proved they may.
 * Owner is the whole of the matrix so far (PRD #104 decision 6); a verb that admits an editor takes
 * the pair itself rather than widening this.
 */
async function requireOwnedTrip(
  scope: TenantScope,
  tripId: string,
): Promise<Trip> {
  const trip = await requireTrip(scope, tripId)
  await assertTripRole(scope, tripId, ['owner'])
  return trip
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

/**
 * The caller's own filters, ANDed. Takes the scope for one of them: after decision 5 the favourite
 * is a row of the acting user's, so "starred" is a question about the reader as much as about the
 * trip.
 */
function listFilter(
  scope: TenantScope,
  input: ListTripsInput,
): SQL | undefined {
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
    const starred = favouritedTripFilter(scope)
    parts.push(input.favourite ? starred : not(starred))
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
  return readableTrips(scope).findMany({
    where: listFilter(scope, options),
    orderBy: [desc(trips.updatedAt)],
    limit: options.limit,
    offset: options.offset,
  })
}

export async function getTrip(
  scope: TenantScope,
  tripId: string,
): Promise<Trip | null> {
  return readableTrips(scope).findOne(eq(trips.id, tripId))
}

export async function getTripBySlug(
  scope: TenantScope,
  slug: string,
): Promise<Trip | null> {
  return readableTrips(scope).findOne(eq(trips.slug, slug))
}

/** Trips that have not finished yet, soonest first — the dashboard's "next up" rail. */
export async function listUpcomingTrips(
  scope: TenantScope,
  options: { readonly today: string; readonly limit?: number } = {
    today: todayIso(),
  },
): Promise<Array<Trip>> {
  const today = dateSchema.parse(options.today)
  return readableTrips(scope).findMany({
    where: allOf(
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
  return readableTrips(scope).findMany({
    where: lte(trips.endDate, today),
    orderBy: [desc(trips.endDate)],
    limit: options.limit ?? 20,
  })
}

export interface TripStatusCounts {
  readonly total: number
  readonly byStatus: Record<(typeof TRIP_STATUSES)[number], number>
  readonly archived: number
}

/**
 * One grouped read behind the dashboard's status chips, over the trips the acting user may see.
 *
 * Every figure here carries the predicate, including the archived one below: a count that included
 * a private trip the reader cannot open would be the same leak as listing it, spread over several
 * numbers instead of one row.
 *
 * The Favourites figure used to be the fourth number here and is not a status: it is a count of the
 * caller's own bookmarks, and it lives with them in `countFavourites`
 * (`src/server/repos/trip-favourites.ts`).
 */
export async function countTripsByStatus(
  scope: TenantScope,
): Promise<TripStatusCounts> {
  // The one reader that cannot go through `readableTrips`: a grouped aggregate is not one of its
  // three shapes, so it carries the predicate itself and says so.
  const rows = await scope.db
    .select({ status: trips.status, value: count() })
    .from(trips)
    .where(tenantFilter(scope, trips, readableTripFilter(scope)))
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

  const archived = await readableTrips(scope).count(eq(trips.isArchived, true))

  return { total, byStatus, archived }
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
  const existing = await requireOwnedTrip(scope, tripId)
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
  await requireOwnedTrip(scope, tripId)
  return tripsRepository.requireUpdate(scope, tripId, { isArchived: true })
}

/**
 * Brings a trip back with the lifecycle status it went in with. See {@link archiveTrip}.
 *
 * The one exception is a row shelved by the code this replaced, which wrote `status = 'archived'`
 * over whatever the trip was. That value is not a status the flag can restore *to*: the badge would
 * still read "Archived" and `countTripsByStatus` would still count it there, on a trip the archived
 * list no longer shows. What it went in with is unrecoverable - the old write destroyed it - so the
 * column goes back to the default it carries when nobody has said, rather than staying a fifth
 * answer nothing else agrees with. No new row can reach this branch.
 */
export async function restoreTrip(
  scope: TenantScope,
  tripId: string,
): Promise<Trip> {
  const trip = await requireOwnedTrip(scope, tripId)
  return tripsRepository.requireUpdate(scope, tripId, {
    isArchived: false,
    ...(trip.status === 'archived' ? { status: 'planning' } : {}),
  })
}

/** Deletes the trip; every child row goes with it through `ON DELETE CASCADE`. */
export async function deleteTrip(
  scope: TenantScope,
  tripId: string,
): Promise<void> {
  await requireOwnedTrip(scope, tripId)
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
 * Copying a trip (PRD #104 decisions 3, 4a, 4b, 6 and 9)
 * ---------------------------------------------------------------------------------------------- */

/**
 * D1 refuses a statement carrying more than this many bound parameters.
 *
 * Cloudflare's limit, not a preference. It binds here rather than in `base.ts` because
 * `insertMany` does not chunk — measured, it is a single `.values(records).returning()` — so the
 * divisor belongs at the call site that applies it, and a constant in `base.ts` would read as a
 * promise that the primitive chunks on the caller's behalf.
 */
export const MAX_BOUND_PARAMETERS = 100

/** How many rows of `columns` bound parameters each fit in one statement. */
export function chunkFor(columns: number): number {
  return Math.max(1, Math.floor(MAX_BOUND_PARAMETERS / columns))
}

/**
 * How many parameters one inserted row of `table` binds.
 *
 * The table's whole column count, not the payload's key count — the payload is the number that
 * looks right and is wrong. Drizzle's insert builder walks *every* column of the table for every
 * row: a column the payload carries binds its value, and a column the payload omits binds its
 * `$defaultFn`/`$onUpdateFn` result, which on these tables means `id`, `created_at` and `updated_at`
 * bind a parameter each despite never appearing in a row object. `organization_id` is a column too,
 * so counting the table also covers the one `insertMany` stamps on.
 *
 * It is an upper bound: the columns Drizzle renders as a literal `null` are counted and bind
 * nothing. That only narrows a chunk, which is the safe direction to be wrong in.
 */
function boundParametersPerRow(table: TenantTable): number {
  return Object.keys(getTableColumns(table)).length
}

/**
 * Inserts `rows` into `table` through `insert`, in statements small enough for D1 to accept.
 *
 * `beforeChunk` runs immediately before each statement with the number of rows it carries. The
 * `places` pass uses it to re-assert the ceiling against the live count, because a copy long enough
 * to need several statements is long enough for another writer to cross that ceiling under it.
 */
async function insertChunked<TRow extends object, TResult>(
  table: TenantTable,
  rows: ReadonlyArray<TRow>,
  insert: (chunk: ReadonlyArray<TRow>) => Promise<Array<TResult>>,
  beforeChunk?: (rowsInChunk: number) => Promise<void>,
): Promise<Array<TResult>> {
  if (rows.length === 0) {
    return []
  }
  const size = chunkFor(boundParametersPerRow(table))
  const inserted: Array<TResult> = []
  for (let index = 0; index < rows.length; index += size) {
    const chunk = rows.slice(index, index + size)
    await beforeChunk?.(chunk.length)
    inserted.push(...(await insert(chunk)))
  }
  return inserted
}

export interface StartTripCopyInput {
  readonly title: string
  /** ISO date. Both dates present or both absent — a half-open range is a mistake, not a template. */
  readonly startDate?: string
  readonly endDate?: string
}

const startTripCopyInput = z
  .object({
    title: titleSchema,
    startDate: dateSchema.optional(),
    endDate: dateSchema.optional(),
  })
  // Both or neither. A half-open range would leave a trip with a start and no day run — an undated
  // copy is a template, but a copy dated at one end is a mistake, and the queue consumer that reads
  // this back is in no position to ask.
  .refine(
    (value) =>
      (value.startDate === undefined) === (value.endDate === undefined),
    {
      error: 'Set both dates, or neither.',
    },
  )

/**
 * The synchronous half of a copy: mints the target trip and returns its id, inside one round trip.
 *
 * Everything here is O(1) in the source's size, which is the property that lets it stay in a POST
 * handler at all — the inventory scales with the source and is {@link copyTripContents}'s job, in a
 * queue consumer. What this writes is the trip row, the caller's `owner` membership and, when the
 * copy is dated, the day run `createTrip` would have given a new trip; then it stamps
 * `copy_pending_at`, which is what marks the trip as still being built.
 *
 * **Open to any reader** (PRD #104 decision 6): {@link requireTrip} is the whole check, and no
 * {@link assertTripRole} follows it. A viewer may copy a plan they can see; the copy is their own
 * and they own it.
 *
 * Both quotas are asserted here, before any insert, so a refusal lands where the reader is looking
 * rather than in a consumer they cannot see. `places` is asserted against the live tenant count
 * **plus the source's**: asserting current usage alone would admit a copy that crosses the ceiling
 * on its four-hundredth row, hours later.
 *
 * The fields the target inherits are `destination`, `summary`, `currency` and `country_codes` and
 * no others (spec Q5). `visibility` resets to the column's `private` and the reminder offset to its
 * default: carrying `organization` across would republish a trip to the whole workspace as a side
 * effect of an action whose subject is the plan.
 */
export async function startTripCopy(
  scope: TenantScope,
  tripId: string,
  input: StartTripCopyInput,
): Promise<string> {
  const values = startTripCopyInput.parse(input)
  assertDateOrder(values.startDate, values.endDate)

  const source = await requireTrip(scope, tripId)

  await assertQuota(scope, 'trips', await tripsRepository.count(scope))
  await assertQuota(
    scope,
    'places',
    await placesRepository.count(scope),
    await placesRepository.count(scope, eq(places.tripId, tripId)),
  )

  const slug = await reserveTripSlug(scope, values.title)
  const trip = await tripsRepository.insert(scope, {
    title: values.title,
    slug,
    createdBy: scope.ctx.userId,
    destination: source.destination,
    summary: source.summary,
    currency: source.currency,
    countryCodes: source.countryCodes,
    startDate: values.startDate ?? null,
    endDate: values.endDate ?? null,
    copyPendingAt: new Date(),
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

  return trip.id
}

/** The id maps the core passes build, for the copiers that run after them. */
export interface CopierMaps {
  readonly dayIds: ReadonlyMap<string, string>
  readonly placeIds: ReadonlyMap<string, string>
}

/** What one copier did, for the completion notification and for the caller's own report. */
export interface CopierReport {
  readonly name: string
  readonly rows: number
}

/**
 * Copies one module's rows for a trip. Called after the core passes, with the maps they built.
 *
 * Must be idempotent against a target whose inventory was just rebuilt by a retry — clear this
 * module's own trip-scoped rows before writing them, because `maps` carries new ids on every
 * attempt. See "Retrying a half-finished copy" in
 * `.ai/specs/implemented/2026-09-07-copy-a-trip.md`.
 */
export type TripCopier = (
  scope: TenantScope,
  sourceTripId: string,
  targetTripId: string,
  maps: CopierMaps,
) => Promise<CopierReport>

/**
 * The registry, in registration order.
 *
 * A `Map` rather than an array so re-registering a name replaces the function instead of queueing a
 * second pass: a module imported twice in one test run must not double-copy. Insertion order is
 * iteration order, and because the handler imports the `src/server/repos/index.ts` barrel, every
 * module has registered before the first copy reads this.
 */
const tripCopiers = new Map<string, TripCopier>()

/**
 * Registers a copier for one module's rows. Called at module top level by the repository that owns
 * the table — the seam that keeps a table in one plan while a copy still reproduces the whole plan.
 */
export function registerTripCopier(name: string, fn: TripCopier): void {
  tripCopiers.set(name, fn)
}

export interface TripCopyResult {
  readonly days: number
  readonly places: number
  readonly assignments: number
  /**
   * Assignments whose source day had no target. No assignment row is written for them, which is
   * exactly what "unscheduled" is — `listUnscheduledPlaces` fills the ideas column from the places
   * that have none — so the place comes across and only its slot on a day is lost.
   */
  readonly unscheduled: number
  readonly notes: number
  /** Notes whose source day had no target. A note is bound to its day, so these are dropped. */
  readonly droppedNotes: number
  readonly extras: ReadonlyArray<CopierReport>
}

/**
 * The asynchronous half: clears whatever a previous attempt wrote into the target, then copies the
 * source's inventory into it.
 *
 * **Plan, not record.** Days, places, place tags, day assignments and day notes come across;
 * reservations, transports, expenses, files, conversations, share links and people stay behind
 * (PRD #104 decision 4b). Another area's rows arrive through {@link registerTripCopier} rather than
 * by editing this function.
 *
 * **It does not clear `copy_pending_at`.** That stamp is the handler's last write, after the
 * statistics fan-out and the completion notification, so a null stamp means every downstream effect
 * has landed and not merely that the rows are in.
 *
 * **Each attempt starts from clean.** The queue delivers at least once, and a resumed attempt could
 * not rebuild `placeIds`: two places in one trip may share a name, a `sort_order` and every other
 * copied column, so there is no natural key to correlate the rows an earlier attempt inserted. It
 * would hold target ids only for the rows it wrote itself and would silently drop the tags and
 * assignments of every place the earlier attempt inserted. So the target's inventory is deleted
 * first and the copy starts again. That is safe because while `copy_pending_at` is set the target
 * belongs to this function alone: `startTripCopy` left it with no inventory, the tile is
 * deliberately not a link, and no other write path touches a trip in that state.
 *
 * **Neither trip is role-checked.** {@link requireTrip} on both is the tenant and read boundary; by
 * the time this runs the target is the caller's own trip and the source has been read-checked
 * already, and re-checking a membership the acting member may have lost since would abandon a copy
 * the product has already promised.
 */
export async function copyTripContents(
  scope: TenantScope,
  sourceTripId: string,
  targetTripId: string,
): Promise<TripCopyResult> {
  if (sourceTripId === targetTripId) {
    // Refused rather than made a no-op: the clearing pass below would delete the trip's own plan
    // on the way to reproducing it.
    throw new RepositoryError(
      'A trip cannot be copied into itself.',
      'INVALID_COPY_TARGET',
    )
  }
  await requireTrip(scope, sourceTripId)
  const target = await requireTrip(scope, targetTripId)

  const sourceDays = await listTripDays(scope, sourceTripId)
  const targetDays = await clearTargetInventory(scope, target, sourceDays)

  // Day numbers are the correlation in both directions, so a shorter target run simply has no
  // entry for the source's overflow — which is what truncation is.
  const dayIds = new Map<string, string>()
  for (const day of sourceDays) {
    const targetDayId = targetDays.get(day.dayNumber)
    if (targetDayId !== undefined) {
      dayIds.set(day.id, targetDayId)
    }
  }

  const placeIds = await copyPlaces(scope, sourceTripId, targetTripId)
  await copyPlaceTags(scope, placeIds)
  const assignments = await copyAssignments(
    scope,
    sourceTripId,
    targetTripId,
    dayIds,
    placeIds,
  )
  const notes = await copyDayNotes(scope, sourceTripId, targetTripId, dayIds)

  const maps: CopierMaps = { dayIds, placeIds }
  const extras: Array<CopierReport> = []
  for (const copier of tripCopiers.values()) {
    extras.push(await copier(scope, sourceTripId, targetTripId, maps))
  }

  return {
    days: targetDays.size,
    places: placeIds.size,
    assignments: assignments.written,
    unscheduled: assignments.unscheduled,
    notes: notes.written,
    droppedNotes: notes.dropped,
    extras,
  }
}

/**
 * Empties the target of anything a previous attempt left, and returns its day run keyed by day
 * number.
 *
 * A **dated** target's run came from `startTripCopy` and is the reader's chosen range, so it is kept
 * and re-used. An **undated** one has no run of its own — `syncTripDays` takes its
 * `wanted.length === 0` branch and creates no days at all — so whatever is there was inserted by an
 * earlier attempt, possibly only part of it, and the whole run is rebuilt rather than trusted.
 *
 * Deleting the places cascades their tags and assignments; the notes are deleted explicitly,
 * because a dated target keeps its days and nothing would cascade to them.
 *
 * A kept run still carries the source's day titles and notes across. `startTripCopy` mints the
 * dated run blank, and nothing else in the copy writes to `days`, so without this pass the same
 * source copied *with* dates would arrive with `title = null, notes = null` on every day while
 * copied *without* dates kept both — an asymmetry nobody asked for and no error would report.
 */
async function clearTargetInventory(
  scope: TenantScope,
  target: Trip,
  sourceDays: ReadonlyArray<Day>,
): Promise<Map<number, string>> {
  await placesRepository.removeWhere(scope, eq(places.tripId, target.id))
  await dayNotesRepository.removeWhere(scope, eq(dayNotes.tripId, target.id))

  if (target.startDate && target.endDate) {
    const existing = await listTripDays(scope, target.id)
    const kept = new Map(existing.map((day) => [day.dayNumber, day.id]))
    // One statement per source day that has anything to say, which on an ordinary trip is a
    // handful rather than the whole run; a day the reader's shorter range dropped has no
    // counterpart to write to and is skipped with it.
    for (const day of sourceDays) {
      const id = kept.get(day.dayNumber)
      if (id === undefined || (day.title === null && day.notes === null)) {
        continue
      }
      await daysRepository.updateWhere(scope, eq(days.id, id), {
        title: day.title,
        notes: day.notes,
      })
    }
    return kept
  }

  await daysRepository.removeWhere(scope, eq(days.tripId, target.id))
  const inserted = await insertChunked(
    days,
    sourceDays.map((day) => ({
      tripId: target.id,
      dayNumber: day.dayNumber,
      date: null,
      title: day.title,
      notes: day.notes,
    })),
    (chunk) => daysRepository.insertMany(scope, chunk),
  )
  return new Map(inserted.map((day) => [day.dayNumber, day.id]))
}

/**
 * Copies the source's whole place inventory, and returns source place id → target place id.
 *
 * The `places` ceiling is re-asserted before **every** statement rather than once before the pass.
 * `startTripCopy` already refused a copy that could not fit when the reader asked, but a copy of
 * twenty thousand places runs for minutes in a consumer, and a ceiling another writer crossed in the
 * meantime has to stop this one too. Failing here is the handler's permanent path: the half-built
 * target is deleted and the requester is told.
 *
 * `is_visited` is deliberately **not** carried and falls back to the column's `false`, for the same
 * reason `copyAssignments` drops `reservation_status`: it says the reader has been there, which is
 * the record and not the plan (PRD #104 decision 4b). It is also read by `atlas.ts`'s
 * visited-country tallies, so carrying it would have a trip nobody has taken yet count towards the
 * countries they have.
 */
async function copyPlaces(
  scope: TenantScope,
  sourceTripId: string,
  targetTripId: string,
): Promise<Map<string, string>> {
  const source = await placesRepository.findMany(scope, {
    where: eq(places.tripId, sourceTripId),
    orderBy: [asc(places.sortOrder), asc(places.id)],
  })
  /**
   * The payload mints its own keys rather than leaving them to the column's `$defaultFn`.
   *
   * The map below has to pair every source place with its copy, and `RETURNING` has no defined row
   * order in SQLite — the trap `lists.ts` avoids by re-reading and `expenses.ts` by re-keying. A
   * mis-pairing here would be silent: `copyPlaceTags`, `copyAssignments` and every registered
   * `tripCopier` would hang their rows off the wrong place and nothing would fail. Minting the id
   * with the row makes the pairing a property of the payload, which no statement can reorder.
   */
  const records = source.map((place) => ({
    id: newId(),
    tripId: targetTripId,
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
    openingHours: place.openingHours,
    priceMinor: place.priceMinor,
    currency: place.currency,
    rating: place.rating,
    durationMinutes: place.durationMinutes,
    transportMode: place.transportMode,
    source: place.source,
    externalId: place.externalId,
    sortOrder: place.sortOrder,
  }))
  await insertChunked(
    places,
    records,
    (chunk) => placesRepository.insertMany(scope, chunk),
    async (rowsInChunk) => {
      await assertQuota(
        scope,
        'places',
        await placesRepository.count(scope),
        rowsInChunk,
      )
    },
  )

  const ids = new Map<string, string>()
  for (const [index, place] of source.entries()) {
    const copied = records.at(index)
    if (copied !== undefined) {
      ids.set(place.id, copied.id)
    }
  }
  return ids
}

/**
 * Ids per `IN (...)` list a copy pass hands a repository.
 *
 * A read binds one parameter per id, so this leaves {@link MAX_BOUND_PARAMETERS} room for the tenant
 * predicate and whatever else the query compares. The same reasoning, and the same ninety, as
 * `ID_FILTER_CHUNK_SIZE` in `src/server/notifications/dispatch.ts`.
 */
const ID_FILTER_CHUNK = 90

/**
 * Re-hangs the source's tags on the copied places.
 *
 * `tag_id` is workspace-level, so it is re-used rather than duplicated: a copy is tagged with the
 * very same tags, which is what makes a tag filter find both trips.
 *
 * The read is chunked for the same reason the write is: `placeIds` holds *every* place in the source
 * trip, and a trip is not capped at ninety of them, so a single `IN (...)` over the whole map is a
 * statement D1 refuses. That refusal is neither `NotFoundError` nor `QuotaExceededError`, so the
 * handler would read it as transient and redeliver the copy forever.
 */
async function copyPlaceTags(
  scope: TenantScope,
  placeIds: ReadonlyMap<string, string>,
): Promise<void> {
  if (placeIds.size === 0) {
    return
  }
  const sourceIds = [...placeIds.keys()]
  const rows: Array<{ placeId: string; tagId: string }> = []
  for (let index = 0; index < sourceIds.length; index += ID_FILTER_CHUNK) {
    const source = await placeTagsAccess.findMany(scope, {
      where: inIds(
        placeTags.placeId,
        sourceIds.slice(index, index + ID_FILTER_CHUNK),
      ),
    })
    for (const row of source) {
      const placeId = placeIds.get(row.placeId)
      if (placeId !== undefined) {
        rows.push({ placeId, tagId: row.tagId })
      }
    }
  }
  await insertChunked(placeTags, rows, (chunk) =>
    placeTagsAccess.insertMany(scope, chunk),
  )
}

/**
 * Remaps the source's assignments onto the new days and the new places.
 *
 * An assignment whose source day has no target is **not written**: its place still came across, and
 * a place with no assignment is what the ideas column is made of, so the plan's overflow lands
 * somewhere the reader can see rather than being lost.
 *
 * `reservation_status` is deliberately **not** carried and falls back to the column's `none`. It
 * says whether that stop is booked, which is the record and not the plan (PRD #104 decision 4b);
 * copying `confirmed` onto a trip nobody has booked anything for would be the copy telling the
 * reader something untrue.
 */
async function copyAssignments(
  scope: TenantScope,
  sourceTripId: string,
  targetTripId: string,
  dayIds: ReadonlyMap<string, string>,
  placeIds: ReadonlyMap<string, string>,
): Promise<{ written: number; unscheduled: number }> {
  const source = await dayAssignmentsRepository.findMany(scope, {
    where: eq(dayAssignments.tripId, sourceTripId),
    orderBy: [asc(dayAssignments.orderIndex), asc(dayAssignments.id)],
  })

  const rows = []
  let unscheduled = 0
  for (const assignment of source) {
    const dayId = dayIds.get(assignment.dayId)
    const placeId = placeIds.get(assignment.placeId)
    if (dayId === undefined || placeId === undefined) {
      unscheduled += 1
      continue
    }
    rows.push({
      tripId: targetTripId,
      dayId,
      placeId,
      orderIndex: assignment.orderIndex,
      startTime: assignment.startTime,
      endTime: assignment.endTime,
      durationMinutes: assignment.durationMinutes,
      transportMode: assignment.transportMode,
      notes: assignment.notes,
    })
  }

  await insertChunked(dayAssignments, rows, (chunk) =>
    dayAssignmentsRepository.insertMany(scope, chunk),
  )
  return { written: rows.length, unscheduled }
}

/**
 * Remaps the source's day notes onto the new days.
 *
 * A note whose source day has no target has nowhere to go — a note is bound to its day — so it is
 * dropped and **counted**, and the count reaches the reader in the completion notification.
 */
async function copyDayNotes(
  scope: TenantScope,
  sourceTripId: string,
  targetTripId: string,
  dayIds: ReadonlyMap<string, string>,
): Promise<{ written: number; dropped: number }> {
  const source = await dayNotesRepository.findMany(scope, {
    where: eq(dayNotes.tripId, sourceTripId),
    orderBy: [asc(dayNotes.sortOrder), asc(dayNotes.id)],
  })

  const rows = []
  let dropped = 0
  for (const note of source) {
    const dayId = dayIds.get(note.dayId)
    if (dayId === undefined) {
      dropped += 1
      continue
    }
    rows.push({
      tripId: targetTripId,
      dayId,
      body: note.body,
      detail: note.detail,
      time: note.time,
      icon: note.icon,
      createdBy: scope.ctx.userId,
      sortOrder: note.sortOrder,
    })
  }

  await insertChunked(dayNotes, rows, (chunk) =>
    dayNotesRepository.insertMany(scope, chunk),
  )
  return { written: rows.length, dropped }
}

/** The cover the handler duplicated in R2, recorded on the trip by {@link finishTripCopy}. */
const finishTripCopyInput = z.object({
  coverImageKey: shortTextSchema.nullish(),
  coverImageUrl: urlSchema.nullish(),
})
export type FinishTripCopyInput = z.infer<typeof finishTripCopyInput>

/**
 * The copy handler's last write: clears `copy_pending_at` and records the cover, if any.
 *
 * Separate from {@link updateTrip} because `copy_pending_at` is not a field anyone patches — it is
 * this one transition, and letting the general patch reach the column would let any editor declare a
 * copy finished that is not.
 *
 * **Clearing the stamp is deliberately the very last thing a copy does**, after the statistics
 * envelopes and the completion notification. Clearing it earlier would make a crash between the clear
 * and the notification unrecoverable: the redelivery would find a null stamp, return early, and the
 * reader would never be told the copy finished. With the clear last, a null stamp means every
 * downstream effect has landed — which is what the redelivery guard needs it to mean.
 *
 * The cover rides along rather than taking a write of its own: it is the same moment and the same
 * row, and one statement cannot leave the two disagreeing.
 */
export async function finishTripCopy(
  scope: TenantScope,
  tripId: string,
  cover: FinishTripCopyInput = {},
): Promise<Trip> {
  await requireOwnedTrip(scope, tripId)
  return tripsRepository.requireUpdate(scope, tripId, {
    ...definedOnly(finishTripCopyInput.parse(cover)),
    copyPendingAt: null,
  })
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
    // `created_at` is a millisecond timestamp, so an owner and a member created inside one request
    // tie on it and SQLite may answer a tie in either order. `asc(id)` makes the order total — the
    // same two rows always come back the same way — but not creation order: `newId()`'s time prefix
    // is that same millisecond, so a tie falls to its random tail. Rows written inside one
    // millisecond have no defined order between them. "Owner first" in `listTripParticipants` does
    // not rest on this; it is a partition over whatever order comes back.
    orderBy: [asc(tripMembers.createdAt), asc(tripMembers.id)],
  })
}

/**
 * Who is on a trip, deduplicated — the user ids alone, in {@link listTripMembers}'s order.
 *
 * The recipient set of anything addressed to a trip's people: the `travel-stats` fan-out sends to
 * exactly these, and `readTripForDelete` takes them while the `trip_members` rows still exist,
 * because the delete cascade removes them. One owner for the projection rather than one per caller
 * (`docs/SPEC.md` §8) — and it lives here, with the query it projects, so a caller in the client
 * graph can reach it without reaching the queue binding.
 */
export async function tripMemberUserIds(
  scope: TenantScope,
  tripId: string,
): Promise<Array<string>> {
  const members = await listTripMembers(scope, tripId)
  return [...new Set(members.map((row) => row.userId))]
}

/**
 * The trips on a user's own dashboard, newest first — since ADR 0007 a thin alias for
 * {@link listTrips}.
 *
 * The membership query this used to run is now folded into `listTrips`'s read predicate, which is
 * the wider of the two: it also admits an organization-visible trip the caller holds no membership
 * row on. That is the set this rail wants — the dashboard merges it with `listUpcomingTrips`, which
 * has always been that same wider set — and the narrower per-trip answer is {@link tripRolesFor}.
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

/**
 * Thrown when a membership write would leave a trip without an owner.
 *
 * One class for two verbs — removing a trip's last owner and demoting them — because from the
 * reader's side it is one rule, and a trip with no owner is a trip on which
 * {@link assertTripRole} refuses every write for ever: `updateTrip`, `archiveTrip`, `deleteTrip`
 * and the visibility switch all route through {@link requireOwnedTrip}.
 */
export class TripLastOwnerError extends RepositoryError {
  constructor() {
    super('A trip keeps at least one owner.', 'TRIP_LAST_OWNER')
  }
}

/**
 * Thrown when a trip membership is asked for a user who is not in the caller's workspace.
 *
 * The picker on the people screen cannot produce such an id — it offers workspace members. The
 * guard is for every other caller: a seed script, a queue consumer, `01-S8`'s initial-members
 * picker, or a well-formed id for any account in the database arriving on the wire.
 */
export class TripMemberNotInWorkspaceError extends RepositoryError {
  constructor(readonly userId: string) {
    super(
      'That person is not a member of this workspace.',
      'TRIP_MEMBER_NOT_IN_WORKSPACE',
    )
  }
}

/**
 * Thrown when a trip membership is asked for somebody who is already on the trip.
 *
 * The picker never offers a current member, so this is a stale screen, a crafted payload, or two
 * owners adding the same person at once. The `trip_members_trip_user_unq` index is what refuses; a
 * lookup first would only narrow the race, so the writer names the index's refusal instead.
 */
export class TripMemberExistsError extends RepositoryError {
  constructor(readonly userId: string) {
    super('That person is already on this trip.', 'TRIP_MEMBER_EXISTS')
  }
}

/**
 * "This trip has an `owner` other than this membership row", as a predicate rather than as a count.
 *
 * The last-owner guard has to check **and** act in one statement, and this is the half that makes
 * that possible. A `count()` followed by a write is check-then-act: two owners leaving the same trip
 * in the same instant each read the other, each proceeds, and the trip is left with nobody who may
 * write to it — precisely the state {@link TripLastOwnerError} exists to prevent, reached by racing
 * the code that raises it, and not self-healing: `assertTripRole(scope, tripId, ['owner'])` then
 * refuses `updateTrip`, `archiveTrip`, `deleteTrip` and the visibility switch for ever.
 *
 * D1 has no interactive transaction to hold a count across a write, so the count moves *into* the
 * write's `WHERE`, where SQLite evaluates it inside the statement's own implicit transaction. Zero
 * rows affected is then the refusal, and the two callers below are serialised by the engine rather
 * than by hope.
 *
 * The sub-select reads `trip_members` while the statement around it writes `trip_members`. That is
 * safe because nothing here correlates to the outer row — both arguments are values the caller has
 * already read — so the inner `FROM` shadowing the outer table changes no meaning. Both halves are
 * `tenantFilter()`-bound, as in {@link readableTripFilter}.
 */
function anotherOwnerExists(
  scope: TenantScope,
  tripId: string,
  exceptMemberId: string,
): SQL {
  return exists(
    scope.db
      .select({ present: sql`1` })
      .from(tripMembers)
      .where(
        tenantFilter(
          scope,
          tripMembers,
          eq(tripMembers.tripId, tripId),
          eq(tripMembers.role, 'owner'),
          ne(tripMembers.id, exceptMemberId),
        ),
      ),
  )
}

/**
 * Adds somebody to a trip.
 *
 * Three guards, in the order the boundary needs them. {@link requireTrip} first, so a trip the
 * caller may not see is a {@link NotFoundError} that discloses nothing. Then the owner assert,
 * because inviting is an owner's verb (PRD #104 decision 6) — and it comes before the workspace
 * lookup so a non-owner learns nothing about who is in the workspace. Then the target has to be a
 * member of that workspace: without this, a well-formed id for *any* account in the database became
 * a membership row, which is the tenant boundary crossed by the one column nothing was checking.
 * Somebody already on the trip is refused by the unique index only after all three, so the
 * {@link TripMemberExistsError} it becomes tells nothing to a caller the guards would have stopped.
 */
export async function addTripMember(
  scope: TenantScope,
  input: AddTripMemberInput,
): Promise<TripMember> {
  const values = addTripMemberInput.parse(input)
  await requireTrip(scope, values.tripId)
  await assertTripRole(scope, values.tripId, ['owner'])
  if ((await getMembership(scope, values.userId)) === null) {
    throw new TripMemberNotInWorkspaceError(values.userId)
  }
  try {
    return await tripMembersRepository.insert(scope, {
      ...values,
      invitedBy: scope.ctx.userId,
    })
  } catch (cause) {
    if (isUniqueConstraintViolation(cause)) {
      throw new TripMemberExistsError(values.userId)
    }
    throw cause
  }
}

/**
 * Changes somebody's standing on a trip.
 *
 * The membership row is resolved first because the caller addresses it by its own id and the trip
 * it belongs to is what the guards are about: {@link requireTrip} on that trip, then the owner
 * assert. Demoting the trip's last owner is refused for the same reason removing them is — it
 * reaches the same unownable trip by a different verb, and this slice is what makes a role change
 * reachable at all.
 */
export async function updateTripMember(
  scope: TenantScope,
  memberId: string,
  input: UpdateTripMemberInput,
): Promise<TripMember> {
  const row = await tripMembersRepository.requireById(scope, memberId)
  await requireTrip(scope, row.tripId)
  await assertTripRole(scope, row.tripId, ['owner'])

  const patch = definedOnly(updateTripMemberInput.parse(input))
  const demotesAnOwner =
    row.role === 'owner' && patch.role !== undefined && patch.role !== 'owner'
  if (!demotesAnOwner) {
    return tripMembersRepository.requireUpdate(scope, memberId, patch)
  }

  // The guard travels with the write rather than ahead of it — see `anotherOwnerExists`. `patch`
  // carries `role`, so it is never empty and `updateWhere` never degrades into a read.
  const updated = await tripMembersRepository.updateWhere(
    scope,
    allOf(
      eq(tripMembers.id, memberId),
      anotherOwnerExists(scope, row.tripId, row.id),
    ),
    patch,
  )
  if (updated.length === 0) {
    throw new TripLastOwnerError()
  }
  return updated[0]
}

/**
 * Takes somebody off a trip — or takes the caller off it themselves, which is the same row.
 *
 * The owner assert is skipped, **and only the owner assert**, when the row being removed is the
 * acting user's own: leaving a trip is not an administrative act and a viewer may do it. The
 * exemption lives inside this function rather than beside it, so there is no second path around the
 * guard for `01-S8` or `01-S9` to find.
 *
 * The last-owner guard is not exempted, which is what makes a sole owner's *leave* a refusal too:
 * leaving is self-removal, and a trip nobody owns is the state both verbs exist to prevent.
 */
export async function removeTripMember(
  scope: TenantScope,
  memberId: string,
): Promise<void> {
  const row = await tripMembersRepository.requireById(scope, memberId)
  await requireTrip(scope, row.tripId)
  if (row.userId !== scope.ctx.userId) {
    await assertTripRole(scope, row.tripId, ['owner'])
  }
  if (row.role !== 'owner') {
    await tripMembersRepository.requireRemove(scope, memberId)
    return
  }

  // As in `updateTripMember`: the condition is part of the delete, so the last owner cannot be
  // removed by two requests that each saw the other.
  const removed = await tripMembersRepository.removeWhere(
    scope,
    allOf(
      eq(tripMembers.id, memberId),
      anotherOwnerExists(scope, row.tripId, row.id),
    ),
  )
  if (removed === 0) {
    throw new TripLastOwnerError()
  }
}

/**
 * One person on a trip, whichever kind of person they are.
 *
 * The discriminated union every later participant surface reads — `01-S8`'s initial-members picker,
 * `01-S9`'s participant vocabulary, the expense-split rows in `04-*`. It is declared here and
 * produced by `listTripParticipants` in `trip-guests.ts`, which fills the `guest` variant `01-S6b`
 * (#119) added rows behind: every `kind` switch written since `01-S6a` is exhaustive, so the guests
 * landed as data rather than as a new shape every picker had to learn.
 *
 * `colour` is `trip_members.colour`, the per-trip tint those surfaces use. It is carried here and
 * rendered by none of them yet, because it belongs to the read model they consume and costs one
 * column of one query rather than a second read each.
 */
export type TripParticipant =
  | {
      readonly kind: 'member'
      readonly memberId: string
      readonly userId: string
      readonly role: TripRole
      readonly colour: string | null
      readonly name: string
      readonly image: string | null
    }
  | {
      readonly kind: 'guest'
      readonly guestId: string
      readonly displayName: string
      readonly colour: string | null
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
