/**
 * Guests — the people on a trip who have no account.
 *
 * The only module that knows what a guest is: the record and its four owner-only writes, the two
 * rules that make the record worth having (a duplicate name is **refused**, never suffixed, and a
 * trip holds at most {@link MAX_TRIP_GUESTS}), the participant read model that puts guests beside
 * members, and the irreversible guest-into-member merge with the registry later plans relink
 * through (`01-S6b`, spec `.ai/specs/implemented/2026-09-17-a-guest-on-a-trip.md`).
 *
 * Every write resolves the trip with {@link requireTrip} and then asserts the `owner` role, inside
 * the repository, so the decision holds for a route, a seed script and a queue consumer alike — the
 * posture `01-S6a` established for members. No guest write notifies anybody: a guest has no account
 * and no address, which is what being a guest means.
 *
 * `listTripParticipants` lives here rather than in `trips.ts` so the dependency runs one way: this
 * module imports the trip guards, and `trips.ts` never imports this one.
 */

import { asc, count, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import {
  TRIP_MEMBER_ROLES,
  tripGuests,
  tripMembers,
  trips,
} from '#/server/db/schema'
import { allOf, createTenantRepository, tenantFilter } from './base'
import { runBatch } from './batch'
import { NotFoundError, RepositoryError } from './context'
import { listUserProfiles } from './members'
import {
  assertTripRole,
  listTripMembers,
  readableTripFilter,
  requireTrip,
  tripMembersRepository,
} from './trips'
import { colourSchema, idSchema, shortTextSchema } from './validation'
import type { TenantScope } from './base'
import type { BatchStatement } from './batch'
import type { TripParticipant } from './trips'

export const tripGuestsRepository = createTenantRepository(
  tripGuests,
  'trip guest',
)

export type TripGuest = typeof tripGuests.$inferSelect

/**
 * The most guests one trip holds.
 *
 * A repository invariant, not a quota: a guest cannot sign in and is not a seat, so nothing is sold
 * here. The bound exists because every participant surface — the pickers, the split rows — lists
 * guests beside members, and past fifty those lists stop being readable. Read-then-write, so two
 * owners adding the fiftieth guest in the same instant can reach fifty-one; that trip is benign and
 * an owner can remove one, so no in-statement predicate defends it.
 */
export const MAX_TRIP_GUESTS = 50

/** Thrown when a guest name matches one already on the trip after trimming and case folding. */
export class TripGuestNameTakenError extends RepositoryError {
  constructor(readonly displayName: string) {
    super(
      'A guest with that name is already on this trip.',
      'TRIP_GUEST_NAME_TAKEN',
    )
  }
}

/** Thrown when a trip already holds {@link MAX_TRIP_GUESTS} guests. Carries the bound it names. */
export class TripGuestLimitError extends RepositoryError {
  readonly limit = MAX_TRIP_GUESTS

  constructor() {
    super(`A trip holds at most ${MAX_TRIP_GUESTS} guests.`, 'TRIP_GUEST_LIMIT')
  }
}

/** Thrown when a merge names somebody who is not a member of the guest's trip. */
export class TripGuestMergeTargetError extends RepositoryError {
  constructor() {
    super(
      'A guest merges only into a member of the same trip.',
      'TRIP_GUEST_MERGE_TARGET',
    )
  }
}

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const guestNameSchema = shortTextSchema.min(1)

const createTripGuestInput = z.strictObject({
  tripId: idSchema,
  displayName: guestNameSchema,
  colour: colourSchema.nullish(),
})

export type CreateTripGuestInput = z.input<typeof createTripGuestInput>

/**
 * The form two names are compared in.
 *
 * Folded in TypeScript rather than in SQL because SQLite's `lower()` folds ASCII only: it would
 * refuse `ANNA` beside `anna` and accept `ÉLODIE` beside `élodie`. The bound makes this affordable —
 * the comparison reads at most fifty rows, and `createTripGuest` reads them anyway for the bound.
 */
export function foldGuestName(name: string): string {
  return name.trim().normalize('NFC').toLowerCase()
}

/**
 * Refuses `displayName` when another guest on the trip already answers to it.
 *
 * This is the rule; `trip_guests_trip_name_unq` is only the backstop. The index is `BINARY`, so it
 * catches the byte-identical race and nothing else — two owners adding `Anna` and `ANNA` in the same
 * instant both pass this check and both insert. Closing that needs a stored folded column, which the
 * spec files as a requirement on the next schema stage; until then the result is two rows an owner
 * can see, rename and merge.
 */
function assertNameFree(
  guests: ReadonlyArray<TripGuest>,
  displayName: string,
  exceptGuestId?: string,
): void {
  const folded = foldGuestName(displayName)
  const taken = guests.some(
    (guest) =>
      guest.id !== exceptGuestId && foldGuestName(guest.displayName) === folded,
  )
  if (taken) {
    throw new TripGuestNameTakenError(displayName)
  }
}

/* -------------------------------------------------------------------------------------------------
 * The record
 * ---------------------------------------------------------------------------------------------- */

/**
 * A trip's guests in name order.
 *
 * Tenant-filtered and nothing more, like `listTripMembers`: a trip id from another organization
 * answers `[]`. A reader that has to refuse a foreign trip rather than report an empty one goes
 * through {@link listTripParticipants}, which resolves the trip first.
 */
export async function listTripGuests(
  scope: TenantScope,
  tripId: string,
): Promise<Array<TripGuest>> {
  return tripGuestsRepository.findMany(scope, {
    where: eq(tripGuests.tripId, tripId),
    orderBy: [asc(tripGuests.displayName), asc(tripGuests.id)],
  })
}

/** Puts a guest on a trip, refusing a duplicate name before the bound and both before the insert. */
export async function createTripGuest(
  scope: TenantScope,
  input: CreateTripGuestInput,
): Promise<TripGuest> {
  const values = createTripGuestInput.parse(input)
  await requireTrip(scope, values.tripId)
  await assertTripRole(scope, values.tripId, ['owner'])

  // One read serves both rules.
  const guests = await listTripGuests(scope, values.tripId)
  assertNameFree(guests, values.displayName)
  if (guests.length >= MAX_TRIP_GUESTS) {
    throw new TripGuestLimitError()
  }
  return tripGuestsRepository.insert(scope, {
    ...values,
    createdBy: scope.ctx.userId,
  })
}

/**
 * Renames a guest, under the same duplicate rule as an add.
 *
 * The guest's own row is excluded from the comparison, so `Anna` may become `ANNA`. The row is
 * resolved first because the trip the guards are about is the row's, not an argument's.
 */
export async function renameTripGuest(
  scope: TenantScope,
  guestId: string,
  displayName: string,
): Promise<TripGuest> {
  const guest = await tripGuestsRepository.requireById(scope, guestId)
  await requireTrip(scope, guest.tripId)
  await assertTripRole(scope, guest.tripId, ['owner'])

  const name = guestNameSchema.parse(displayName)
  assertNameFree(await listTripGuests(scope, guest.tripId), name, guest.id)
  return tripGuestsRepository.requireUpdate(scope, guestId, {
    displayName: name,
  })
}

/**
 * Takes a guest off a trip. Not a merge: no relinker runs.
 *
 * Whatever points at the guest goes with it — every `guest_id` column a later plan adds is declared
 * `references(() => tripGuests.id, { onDelete: 'cascade' })`, which is the requirement this module
 * leaves on those plans.
 */
export async function removeTripGuest(
  scope: TenantScope,
  guestId: string,
): Promise<void> {
  const guest = await tripGuestsRepository.requireById(scope, guestId)
  await requireTrip(scope, guest.tripId)
  await assertTripRole(scope, guest.tripId, ['owner'])
  await tripGuestsRepository.requireRemove(scope, guestId)
}

/* -------------------------------------------------------------------------------------------------
 * The participant read model
 * ---------------------------------------------------------------------------------------------- */

const tripRoleSchema = z.enum(TRIP_MEMBER_ROLES)

/**
 * Who is on a trip: the members owner first, then the guests in name order — the one participant
 * read model.
 *
 * {@link requireTrip} runs **first**, and the ordering is the whole point: `listTripMembers` and
 * {@link listTripGuests} are tenant-filtered, so a trip id from another organization answers `[]`
 * through both, and a reader that skipped the guard would report "a trip with nobody on it" instead
 * of refusing.
 *
 * A member whose workspace account has gone has no profile row, so they are dropped rather than
 * rendered nameless. A guest has no profile to lose and is never dropped.
 *
 * No email reaches the result. `MemberProfile` carries one; the projection takes `name` and `image`
 * and leaves the address in the repository.
 */
export async function listTripParticipants(
  scope: TenantScope,
  tripId: string,
): Promise<Array<TripParticipant>> {
  await requireTrip(scope, tripId)

  const [members, guests] = await Promise.all([
    listTripMembers(scope, tripId),
    listTripGuests(scope, tripId),
  ])
  const profiles = new Map(
    members.length === 0
      ? []
      : (
          await listUserProfiles(
            scope,
            members.map((row) => row.userId),
          )
        ).map((profile) => [profile.userId, profile]),
  )

  const seated: Array<TripParticipant> = []
  for (const row of members) {
    const profile = profiles.get(row.userId)
    if (profile === undefined) {
      continue
    }
    seated.push({
      kind: 'member',
      memberId: row.id,
      userId: row.userId,
      // The column is plain `text` behind a `CHECK`, so what comes back is a string. A value the
      // enum does not carry reads as the least-privileged role. It cannot widen anything: this
      // field renders a badge, and every write is still guarded by `assertTripRole`.
      role: tripRoleSchema.catch('viewer').parse(row.role),
      colour: row.colour,
      name: profile.name,
      image: profile.image,
    })
  }

  // Owner first, and everybody else in the membership order `listTripMembers` already totalled.
  // A stable partition rather than a sort, so two owners keep that order between them.
  const isOwner = (row: TripParticipant) =>
    row.kind === 'member' && row.role === 'owner'
  return [
    ...seated.filter(isOwner),
    ...seated.filter((row) => !isOwner(row)),
    ...guests.map((guest): TripParticipant => ({
      kind: 'guest',
      guestId: guest.id,
      displayName: guest.displayName,
      colour: guest.colour,
    })),
  ]
}

/**
 * How many people are on each of the given trips — members plus guests — keyed by trip id (`01-S7`).
 *
 * Two grouped statements for the whole list, one per table, because its callers are the trip index
 * and the dashboard, and a query per card is the shape `countTripsByStatus` and `countPlacesPerTrip`
 * already refuse. D1 bills rows read, and both tables lead their composite index with
 * `organization_id`, so each scan is bounded by the tenant.
 *
 * Both statements count only rows of trips the caller may **read**: the ids are narrowed through
 * `readableTripFilter` inside the statement, so a foreign id and a private trip the caller is not on
 * get **no entry at all** — not a zero — and the shape of the answer says nothing about whether such
 * a trip exists.
 */
export async function countTripPeople(
  scope: TenantScope,
  tripIds: ReadonlyArray<string>,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (tripIds.length === 0) {
    return counts
  }
  const readableIds = scope.db
    .select({ id: trips.id })
    .from(trips)
    .where(
      tenantFilter(
        scope,
        trips,
        inArray(trips.id, [...tripIds]),
        readableTripFilter(scope),
      ),
    )

  const [members, guests] = await Promise.all([
    scope.db
      .select({ tripId: tripMembers.tripId, value: count() })
      .from(tripMembers)
      .where(
        tenantFilter(
          scope,
          tripMembers,
          inArray(tripMembers.tripId, readableIds),
        ),
      )
      .groupBy(tripMembers.tripId),
    scope.db
      .select({ tripId: tripGuests.tripId, value: count() })
      .from(tripGuests)
      .where(
        tenantFilter(
          scope,
          tripGuests,
          inArray(tripGuests.tripId, readableIds),
        ),
      )
      .groupBy(tripGuests.tripId),
  ])

  for (const row of [...members, ...guests]) {
    counts.set(row.tripId, (counts.get(row.tripId) ?? 0) + row.value)
  }
  return counts
}

/* -------------------------------------------------------------------------------------------------
 * The merge
 * ---------------------------------------------------------------------------------------------- */

/** What one relinker will move, and the statements that move it. */
export interface GuestRelinkPlan {
  readonly count: number
  readonly statements: ReadonlyArray<BatchStatement>
}

/**
 * Plans the rewrite of one area's `guest_id` references to a member's `user_id`.
 *
 * A relinker **reads and builds; it never writes**. That split is what lets the merge keep both of
 * its promises at once — every relinker in registration order inside one batch, and nothing moved
 * when one of them throws. A relinker that wrote for itself would have committed by the time the
 * next one failed, and D1 has no interactive transaction to take it back (`batch.ts`).
 */
export type GuestRelinker = (
  scope: TenantScope,
  tripId: string,
  guestId: string,
  userId: string,
) => Promise<GuestRelinkPlan>

/** Insertion order is registration order, which is the order the merge runs them in. */
const relinkers = new Map<string, GuestRelinker>()

/**
 * Registers a relinker, at module load, from the module that owns the `guest_id` column.
 *
 * A second registration under one name throws: two areas claiming a name is a bug that should be
 * loud. Returns the function that unregisters it, which is also what lets a test register fakes.
 */
export function registerGuestRelinker(
  name: string,
  relink: GuestRelinker,
): () => void {
  if (relinkers.has(name)) {
    throw new Error(`A guest relinker named "${name}" is already registered.`)
  }
  relinkers.set(name, relink)
  return () => {
    if (relinkers.get(name) === relink) {
      relinkers.delete(name)
    }
  }
}

/**
 * Merges a guest into a member of the same trip — irreversibly.
 *
 * In order: the trip guard, the owner assert, the guest (a guest of another trip is not found), and
 * the target, who must already hold a membership row **on this trip** — handing assignments to
 * somebody with no access to them would be a merge onto nobody. Then every registered relinker plans
 * its move, and one batch runs every statement they produced followed by the guest's delete. A
 * relinker that throws throws before a single statement has run, so the guest and every row stay.
 *
 * Answers the per-relinker counts, so the screen can say what moved. A count is a report, not a
 * guarantee: a row added between a relinker's read and the batch still moves, uncounted.
 */
export async function mergeTripGuest(
  scope: TenantScope,
  tripId: string,
  guestId: string,
  userId: string,
): Promise<Record<string, number>> {
  await requireTrip(scope, tripId)
  await assertTripRole(scope, tripId, ['owner'])

  const guest = await tripGuestsRepository.requireById(scope, guestId)
  if (guest.tripId !== tripId) {
    throw new NotFoundError('trip guest', guestId)
  }
  const target = await tripMembersRepository.findOne(
    scope,
    allOf(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)),
  )
  if (target === null) {
    throw new TripGuestMergeTargetError()
  }

  const plans: Array<readonly [string, GuestRelinkPlan]> = []
  for (const [name, relink] of relinkers) {
    plans.push([name, await relink(scope, tripId, guestId, userId)])
  }

  await runBatch(scope, [
    ...plans.flatMap(([, plan]) => plan.statements),
    scope.db
      .delete(tripGuests)
      .where(tenantFilter(scope, tripGuests, eq(tripGuests.id, guestId))),
  ])
  return Object.fromEntries(plans.map(([name, plan]) => [name, plan.count]))
}
