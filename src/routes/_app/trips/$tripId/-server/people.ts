/**
 * A trip's people: one loader, five membership writes and four guest writes.
 *
 * **Every authorisation decision is already made.** `01-S6a`'s guards live inside the repository
 * writers (`src/server/repos/trips.ts`) — the owner assert with its self-removal exemption, the
 * workspace guard, and the last-owner rule that both `removeTripMember` and `updateTripMember`
 * reach. This module contributes the tenant scope, a Zod boundary, the payload shape, the
 * invitation notification and the statistics fan-out, and nothing else. A guard added here would be
 * one that `apply-trip.ts`, a queue consumer and `01-S8`'s picker do not have.
 *
 * **Expected refusals cross the wire as a code, never as a sentence.** `classifyFailure`
 * (`src/server/errors/public.ts`) redacts everything outside `AUTHORED_ERROR_NAMES`, which holds no
 * `RepositoryError`, and `docs/SPEC.md` §9 forbids a server-authored sentence regardless. So the
 * refusals the screen has copy for are caught here and answered as {@link PeopleRefusal};
 * everything else — `FORBIDDEN`, `NOT_FOUND`, a validator — propagates untouched into the shared
 * boundary, which is correct, because this screen offers no control for those states.
 *
 * **The queue is reached from handler bodies only.** This module is under `src/routes` and so is in
 * the client graph: Start strips a server function's body from the browser bundle, and anything
 * this module *exported* would have to resolve there. That is the constraint the spec's
 * `## Amendment` records — it is why {@link enqueueTripStatsFor} lives in `src/server/queue` and why
 * no export here reaches it.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { TRIP_MEMBER_ROLES, TRIP_VISIBILITIES } from '#/server/db/schema'
import { createLogger, serializeError } from '#/server/observability'
import { enqueueTripStatsFor } from '#/server/queue/travel-stats-fanout'
import {
  MAX_TRIP_GUESTS,
  NotFoundError,
  RepositoryError,
  TripGuestMergeTargetError,
  addTripMember,
  assertTripRole,
  createTripGuest,
  listMemberProfiles,
  listTripGuests,
  listTripMembers,
  listTripParticipants,
  listUserProfiles,
  mergeTripGuest,
  notify,
  removeTripGuest,
  removeTripMember,
  renameTripGuest,
  requireTrip,
  shortTextSchema,
  tripRoleFor,
  updateTrip,
  updateTripMember,
} from '#/server/repos'
import { readTripInvite } from '#/server/repos/invites'
import type { TripInviteView } from '#/server/repos/invites'
import { orAbsent } from '#/server/fns/-lib/absence'
import { appScope } from '../../../-server/context'

import type { OrAbsent } from '#/lib/absence'
import type { Trip, TripMember } from '#/server/db/types'
import type { Logger } from '#/server/observability'
import type {
  TenantScope,
  TripGuest,
  TripParticipant,
  TripRole,
} from '#/server/repos'

/* -------------------------------------------------------------------------------------------------
 * Shapes
 * ---------------------------------------------------------------------------------------------- */

/**
 * The union as the repository declares it, re-exported for the screen.
 *
 * `docs/SPEC.md` §6 runs the dependency one way — a route calls a server function, a server function
 * calls a repository — so `listTripParticipants`'s own return type cannot be declared here.
 */
export type { TripParticipant }

/** The three stored values, all of which this payload reports and only two of which it writes. */
export type TripVisibility = (typeof TRIP_VISIBILITIES)[number]

/** Somebody in the workspace who is not yet on the trip. Carries no email — see {@link readTripPeople}. */
export interface InvitablePerson {
  readonly userId: string
  readonly name: string
  readonly image: string | null
}

export interface TripPeoplePayload {
  readonly tripId: string
  readonly visibility: TripVisibility
  readonly viewerUserId: string
  /** `null` for a reader who holds no membership — a real state on an organization-visible trip. */
  readonly viewerRole: TripRole | null
  /** Members owner first, then guests in name order — the guests are read off this list. */
  readonly participants: ReadonlyArray<TripParticipant>
  readonly invitable: ReadonlyArray<InvitablePerson>
  /** How many guests a trip holds, so the refusal can name the bound without importing it. */
  readonly guestLimit: number
  readonly invite: TripInviteView | null
  readonly inviteArchived: boolean
}

/**
 * The repository refusals this screen has copy for, as a closed vocabulary.
 *
 * One value per rule rather than one per verb: removing a trip's last owner and demoting them are
 * the same rule met by two verbs, and from the reader's side it is one sentence. A duplicate guest
 * name is likewise one rule whether it is met by an add or a rename.
 */
const REFUSAL_BY_CODE = {
  TRIP_LAST_OWNER: 'last-owner',
  TRIP_MEMBER_NOT_IN_WORKSPACE: 'not-in-workspace',
  TRIP_GUEST_NAME_TAKEN: 'guest-name-taken',
  TRIP_GUEST_LIMIT: 'guest-limit',
  TRIP_GUEST_MERGE_TARGET: 'guest-merge-target',
  TRIP_MEMBER_EXISTS: 'already-on-trip',
} as const

export type PeopleRefusal =
  (typeof REFUSAL_BY_CODE)[keyof typeof REFUSAL_BY_CODE]

/** What a write answers: the success shape, or a refusal the screen maps onto a catalogue key. */
export type PeopleWrite<T> =
  | ({ readonly ok: true } & T)
  | { readonly ok: false; readonly reason: PeopleRefusal }

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const id = z.string().trim().min(1).max(64)
const role = z.enum(TRIP_MEMBER_ROLES)
/** A guest's whole identity. No `email()`: a guest has no address. */
const guestName = shortTextSchema.min(1)

/**
 * The switch has two positions.
 *
 * `'public'` is the share plan's value (`COL-10`/`COL-11`), so a payload carrying it is a validator
 * refusal before any repository call rather than a silent downgrade to `'private'`.
 *
 * Exported because outside a Start build the boundary validator is not applied on the way in, so
 * the seam test applies it the way the runtime does.
 */
export const setTripVisibilityInput = z.object({
  tripId: id,
  visibility: z.enum(['private', 'organization']),
})

/* -------------------------------------------------------------------------------------------------
 * Refusals
 * ---------------------------------------------------------------------------------------------- */

/** Memoised per isolate: the logger holds no request state. */
let logger: Logger | undefined

function log(): Logger {
  logger ??= createLogger({ context: { component: 'trip-people' } })
  return logger
}

function refusalOf(cause: unknown): PeopleRefusal | null {
  if (!(cause instanceof RepositoryError)) {
    return null
  }
  const known = Object.hasOwn(REFUSAL_BY_CODE, cause.code)
    ? REFUSAL_BY_CODE[cause.code as keyof typeof REFUSAL_BY_CODE]
    : null
  return known
}

/**
 * Runs a write and turns the expected refusals into an answer.
 *
 * One helper for every handler so the catch is written once and the vocabulary cannot drift between
 * them: a refusal this does not recognise is re-thrown, which is what keeps `FORBIDDEN` and
 * `NOT_FOUND` the generic failure they should be.
 *
 * Exported because it *is* the answer the handlers give, and a handler's return value is discarded
 * outside a Start build — so this is the only place the mapping can be asserted as itself rather
 * than as "the row survived".
 */
export async function attempted<T extends object>(
  work: () => Promise<T>,
): Promise<PeopleWrite<T>> {
  try {
    return { ok: true, ...(await work()) }
  } catch (cause) {
    const reason = refusalOf(cause)
    if (reason === null) {
      throw cause
    }
    return { ok: false, reason }
  }
}

/* -------------------------------------------------------------------------------------------------
 * Read
 * ---------------------------------------------------------------------------------------------- */

/** As stored. The column is plain `text` behind a `CHECK`, so an unknown value reads as the default. */
function visibilityOf(trip: Trip): TripVisibility {
  return z.enum(TRIP_VISIBILITIES).catch('private').parse(trip.visibility)
}

/**
 * The caller's own role, narrowed the way `listTripParticipants` narrows a member's.
 *
 * `trip_members.role` is plain `text` behind a `CHECK`, so a value the enum does not carry reads as
 * the least-privileged one. It cannot widen anything: this decides which controls the screen offers,
 * and every write is still guarded by `assertTripRole` re-reading the stored value.
 */
function viewerRoleOf(stored: string | null): TripRole | null {
  return stored === null
    ? null
    : z.enum(TRIP_MEMBER_ROLES).catch('viewer').parse(stored)
}

/**
 * The people screen's whole payload.
 *
 * A plain function rather than the handler's body, because outside a Start build a
 * `createServerFn` handler's return value is unreachable from a unit test — a direct call runs the
 * handler and discards its result. Writes are read back through the repository; a read cannot be,
 * which is why only the read needs this (`day-notes.ts` records the same split).
 *
 * **`invitable` is an answer, not a directory.** The workspace roster minus everybody already on
 * the trip, subtracted on the server so the client never receives a list it has to subtract from —
 * and `[]` for anybody who cannot invite, because a reader who holds no owner role is not handed
 * the workspace's members at all.
 *
 * **No email reaches the payload.** `MemberProfile` carries one; both projections here take `name`
 * and `image` and leave the address in the repository.
 */
export async function readTripPeople(
  scope: TenantScope,
  tripId: string,
  inviteKey: string,
): Promise<TripPeoplePayload> {
  const trip = await requireTrip(scope, tripId)
  const [stored, participants] = await Promise.all([
    tripRoleFor(scope, trip.id, scope.ctx.userId),
    listTripParticipants(scope, trip.id),
  ])
  const viewerRole = viewerRoleOf(stored)

  const onTrip = new Set(
    participants
      .filter((row) => row.kind === 'member')
      .map((row) => row.userId),
  )
  const invitable =
    viewerRole === 'owner'
      ? (await listMemberProfiles(scope))
          .filter((profile) => !onTrip.has(profile.userId))
          .map((profile) => ({
            userId: profile.userId,
            name: profile.name,
            image: profile.image,
          }))
      : []

  return {
    tripId: trip.id,
    visibility: visibilityOf(trip),
    viewerUserId: scope.ctx.userId,
    viewerRole,
    participants,
    invitable,
    guestLimit: MAX_TRIP_GUESTS,
    inviteArchived: viewerRole === 'owner' && trip.isArchived,
    invite:
      viewerRole === 'owner'
        ? await readTripInvite(scope, trip.id, inviteKey)
        : null,
  }
}

export const loadTripPeople = createServerFn({ method: 'GET' })
  .validator(z.object({ tripId: id }))
  .handler(async ({ data }): Promise<OrAbsent<TripPeoplePayload>> => {
    const { authSecret } = await import('#/server/auth/env')
    const scope = await appScope()
    return orAbsent(data.tripId, () =>
      readTripPeople(scope, data.tripId, authSecret()),
    )
  })

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

/**
 * The membership row this call is about, proved to be on the trip the caller named.
 *
 * The client addresses a member by the row's own id, and the repository writers resolve the trip
 * from the row — so without this, an owner of one trip could address a membership of another from
 * this screen's handlers. It is a read of the list the screen already renders, not a second guard:
 * the refusal that matters is still `assertTripRole`, inside the writer.
 */
async function memberOnTrip(
  scope: TenantScope,
  tripId: string,
  memberId: string,
): Promise<TripMember> {
  const row = (await listTripMembers(scope, tripId)).find(
    (member) => member.id === memberId,
  )
  if (row === undefined) {
    throw new NotFoundError('Trip member', memberId)
  }
  return row
}

/**
 * Closes a person's open sockets in the trip's room, so a role change, a removal or a leave reaches
 * a tab that is already open instead of waiting for it to reconnect (the room reads the role once,
 * at connect).
 *
 * Called only once the write has succeeded, with the trip and person from the rows the repository
 * resolved. The bridge is reached at call time for the reason `plan.ts` records at `mirrorDayOrder`:
 * `#/server/fns/context` imports `cloudflare:workers`, and this file is in the planner route's module
 * graph. A room that cannot be reached is logged inside the helper and never fails the write.
 */
async function evictFromRoom(
  scope: TenantScope,
  tripId: string,
  userId: string,
): Promise<void> {
  const { closeRoomFor } = await import('#/server/fns/context')
  await closeRoomFor(scope, tripId, userId)
}

/**
 * Tells somebody they are on a trip.
 *
 * Caught, logged once, and the add still answers success: the membership row *is* the write, D1 has
 * already taken it, and raising would report a failure for something that happened — with no caller
 * able to retry the notification on its own. The same posture `discardTarget` takes in
 * `src/server/queue/handlers/trip-copy.ts`.
 */
async function announceInvitation(
  scope: TenantScope,
  trip: Trip,
  recipientUserId: string,
  actorName: string,
): Promise<void> {
  try {
    await notify(scope, {
      recipientUserId,
      type: 'navigate',
      scope: 'trip',
      entityType: 'trip',
      entityId: trip.id,
      titleKey: 'shell.notification.trip.invited.title',
      titleParams: { tripTitle: trip.title },
      bodyKey: 'shell.notification.trip.invited.body',
      bodyParams: { actorName },
      actionUrl: `/trips/${trip.id}`,
    })
  } catch (cause) {
    log().warn('an invitation to a trip was not announced', {
      tripId: trip.id,
      recipientUserId,
      ...serializeError(cause),
    })
  }
}

/**
 * The acting user's display name, for the invitation's `{actorName}`.
 *
 * `scope.ctx` carries the id and the organization role, never the name, so the profile is read. The
 * caller is by construction a member of the workspace they are inviting into, so the empty fallback
 * is unreachable — it is here because the read answers a list and not a row.
 */
async function actorNameOf(scope: TenantScope): Promise<string> {
  const profile = (await listUserProfiles(scope, [scope.ctx.userId])).at(0)
  return profile?.name ?? ''
}

/**
 * Puts somebody on the trip.
 *
 * The workspace guard is `addTripMember`'s — the picker cannot produce an id from outside the
 * workspace, so the refusal here is for a payload that did not come from it.
 *
 * A membership change is a statistics write (PRD #104 decision 11), and the person added is not yet
 * a member when the fan-out runs, which is why {@link enqueueTripStatsFor} takes the recipient
 * rather than reading the trip's members.
 */
export const addTripMemberFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, userId: id, role }))
  .handler(
    async ({ data }): Promise<PeopleWrite<{ readonly memberId: string }>> => {
      const scope = await appScope()
      return attempted(async () => {
        const trip = await requireTrip(scope, data.tripId)
        const member = await addTripMember(scope, {
          tripId: trip.id,
          userId: data.userId,
          role: data.role,
        })

        await announceInvitation(
          scope,
          trip,
          data.userId,
          await actorNameOf(scope),
        )
        await enqueueTripStatsFor(scope, trip, [data.userId])

        return { memberId: member.id }
      })
    },
  )

/**
 * Changes somebody's standing on the trip.
 *
 * No statistics follow a role change: the person is on the same trips afterwards as before.
 */
export const setTripRoleFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, memberId: id, role }))
  .handler(
    async ({
      data,
    }): Promise<
      PeopleWrite<{ readonly memberId: string; readonly role: TripRole }>
    > => {
      const scope = await appScope()
      return attempted(async () => {
        const row = await memberOnTrip(scope, data.tripId, data.memberId)
        const updated = await updateTripMember(scope, row.id, {
          role: data.role,
        })
        if (updated.role !== row.role) {
          await evictFromRoom(scope, updated.tripId, updated.userId)
        }
        return { memberId: updated.id, role: data.role }
      })
    },
  )

/** Takes somebody off the trip. The statistics go to the person who left, and to nobody else. */
export const removeTripMemberFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, memberId: id }))
  .handler(
    async ({ data }): Promise<PeopleWrite<{ readonly removed: true }>> => {
      const scope = await appScope()
      return attempted(async () => {
        const trip = await requireTrip(scope, data.tripId)
        const row = await memberOnTrip(scope, trip.id, data.memberId)

        await removeTripMember(scope, row.id)
        await evictFromRoom(scope, trip.id, row.userId)
        await enqueueTripStatsFor(scope, trip, [row.userId])

        return { removed: true }
      })
    },
  )

/**
 * Takes the caller off the trip themselves.
 *
 * The same repository writer as a removal, addressed at the caller's own row — which is the row
 * `removeTripMember` exempts from the owner assert, and the row the last-owner guard refuses when
 * they are the trip's only owner.
 */
export const leaveTripFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id }))
  .handler(
    async ({ data }): Promise<PeopleWrite<{ readonly removed: true }>> => {
      const scope = await appScope()
      return attempted(async () => {
        const trip = await requireTrip(scope, data.tripId)
        const row = (await listTripMembers(scope, trip.id)).find(
          (member) => member.userId === scope.ctx.userId,
        )
        if (row === undefined) {
          throw new NotFoundError('Trip member', scope.ctx.userId)
        }

        await removeTripMember(scope, row.id)
        await evictFromRoom(scope, trip.id, row.userId)
        await enqueueTripStatsFor(scope, trip, [row.userId])

        return { removed: true }
      })
    },
  )

/**
 * Decides who can find the trip.
 *
 * Written through `updateTrip`, whose `requireOwnedTrip` is the owner guard PRD #104 decision 6
 * asks for — there is no visibility writer of this module's own. It has no expected refusal, so it
 * keeps a plain return: a non-owner is `FORBIDDEN`, which is the generic failure, and the screen
 * shows no switch to them in the first place.
 */
export const setTripVisibilityFn = createServerFn({ method: 'POST' })
  .validator(setTripVisibilityInput)
  .handler(
    async ({
      data,
    }): Promise<{
      readonly tripId: string
      readonly visibility: TripVisibility
    }> => {
      const scope = await appScope()
      // Read before the write: only the row as it stood knows whether this narrows the trip.
      const before = await requireTrip(scope, data.tripId)
      const trip = await updateTrip(scope, data.tripId, {
        visibility: data.visibility,
      })
      if (
        visibilityOf(before) === 'organization' &&
        visibilityOf(trip) === 'private'
      ) {
        // Workspace members who stop being able to read the trip were never on it, so the room
        // cannot name them: every socket goes, and the members reconnect through the connect handler.
        const { closeRoom } = await import('#/server/fns/context')
        await closeRoom(scope, trip.id)
      }
      return { tripId: trip.id, visibility: visibilityOf(trip) }
    },
  )

/* -------------------------------------------------------------------------------------------------
 * Guests
 * ---------------------------------------------------------------------------------------------- */

/**
 * The guest this call is about, proved to be on the trip the caller named — the guest half of
 * {@link memberOnTrip}, for the same reason: the writers resolve the trip from the row.
 */
async function guestOnTrip(
  scope: TenantScope,
  tripId: string,
  guestId: string,
): Promise<TripGuest> {
  const row = (await listTripGuests(scope, tripId)).find(
    (guest) => guest.id === guestId,
  )
  if (row === undefined) {
    throw new NotFoundError('Trip guest', guestId)
  }
  return row
}

/**
 * Puts a guest on the trip. Nobody is notified and no statistics move: a guest has no account.
 *
 * A duplicate name and the fifty-guest bound are the repository's refusals, answered as codes.
 */
export const addTripGuestFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, displayName: guestName }))
  .handler(
    async ({
      data,
    }): Promise<
      PeopleWrite<{ readonly guestId: string; readonly displayName: string }>
    > => {
      const scope = await appScope()
      return attempted(async () => {
        const guest = await createTripGuest(scope, {
          tripId: data.tripId,
          displayName: data.displayName,
        })
        return { guestId: guest.id, displayName: guest.displayName }
      })
    },
  )

/** Renames a guest, under the same duplicate rule as an add. */
export const renameTripGuestFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, guestId: id, displayName: guestName }))
  .handler(
    async ({
      data,
    }): Promise<
      PeopleWrite<{ readonly guestId: string; readonly displayName: string }>
    > => {
      const scope = await appScope()
      return attempted(async () => {
        const row = await guestOnTrip(scope, data.tripId, data.guestId)
        const guest = await renameTripGuest(scope, row.id, data.displayName)
        return { guestId: guest.id, displayName: guest.displayName }
      })
    },
  )

/** Takes a guest off the trip. Not a merge: nothing is relinked. */
export const removeTripGuestFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, guestId: id }))
  .handler(
    async ({ data }): Promise<PeopleWrite<{ readonly removed: true }>> => {
      const scope = await appScope()
      return attempted(async () => {
        const row = await guestOnTrip(scope, data.tripId, data.guestId)
        await removeTripGuest(scope, row.id)
        return { removed: true }
      })
    },
  )

/**
 * Merges a guest into a member — irreversibly — and reports what moved.
 *
 * The screen's combobox offers membership rows, so a `memberId` arrives; the relinkers rewrite
 * `guest_id` to a `user_id`, so the repository takes that. The membership row is the translation,
 * and a `memberId` that is not a membership of this trip is the same refusal as a target off the
 * trip — which is what it is.
 */
export const mergeTripGuestFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId: id, guestId: id, memberId: id }))
  .handler(
    async ({
      data,
    }): Promise<
      PeopleWrite<{
        readonly memberId: string
        readonly relinked: Readonly<Record<string, number>>
      }>
    > => {
      const scope = await appScope()
      return attempted(() => mergeGuestIntoMember(scope, data))
    },
  )

/**
 * The merge handler's body, as a plain function for the reason {@link readTripPeople} is one: a
 * handler's return value is unreachable outside a Start build, and the counts are the answer.
 */
export async function mergeGuestIntoMember(
  scope: TenantScope,
  input: {
    readonly tripId: string
    readonly guestId: string
    readonly memberId: string
  },
): Promise<{
  readonly memberId: string
  readonly relinked: Readonly<Record<string, number>>
}> {
  // The trip and the owner's standing first, as `mergeTripGuest` checks them: the member list is
  // tenant-scoped but not visibility-scoped, so reading it first would answer a foreign or hidden
  // trip, or a non-owner, with the merge-target refusal instead of not found or forbidden.
  await requireTrip(scope, input.tripId)
  await assertTripRole(scope, input.tripId, ['owner'])
  const target = (await listTripMembers(scope, input.tripId)).find(
    (member) => member.id === input.memberId,
  )
  if (target === undefined) {
    throw new TripGuestMergeTargetError()
  }
  const relinked = await mergeTripGuest(
    scope,
    input.tripId,
    input.guestId,
    target.userId,
  )
  return { memberId: target.id, relinked }
}
