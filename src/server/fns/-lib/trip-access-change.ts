/**
 * The one owner of "a trip's access or state changed, so close the sockets that were admitted under
 * the old answer".
 *
 * The trip room reads a socket's role once, at connect, and an open socket keeps it. Every write that
 * changes who may read or write a trip, or whether the trip is open at all, therefore ends by closing
 * the sockets it outdated, and {@link evictionsFor} is the single table that says which: one person
 * (a member added, a role changed, a member removed or leaving), the whole room (a visibility narrowed
 * to private, an archive, a restore) or the room erased (a delete). A handler states the change and
 * this module derives the scope, so a new verb cannot forget it (#1181).
 *
 * **Input is a row a write returned, never request data.** The room is keyed by trip id alone, so a
 * change carries the rows the repository resolved: the added or updated membership, the trip as the
 * write returned it. A refused write throws before a change exists, which is what makes a refusal
 * evict nothing.
 *
 * **Strictly after the commit.** Call {@link settleTripAccessChange} once the write has resolved: a
 * close before it would let the client reconnect and read the old role again. A room that cannot be
 * reached is logged by the close itself (ids only) and never fails the write.
 *
 * **The room is reached at call time.** `#/server/fns/context` imports `cloudflare:workers`, and the
 * route modules that call this are in the client graph, so nothing here imports it statically.
 */
import type { Trip, TripMember } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'

/** A membership row as a write returned it: the person, the trip and the role they now hold. */
type MemberRow = Pick<TripMember, 'tripId' | 'userId' | 'role'>

/** A trip row as a write returned it. */
type TripRow = Pick<Trip, 'id' | 'visibility'>

/** A write that changed a trip's access or state, as the rows it returned. */
export type TripAccessChange =
  | { readonly kind: 'member-added'; readonly member: MemberRow }
  | {
      readonly kind: 'role-changed'
      readonly before: MemberRow
      readonly after: MemberRow
    }
  | { readonly kind: 'member-removed'; readonly member: MemberRow }
  | { readonly kind: 'member-left'; readonly member: MemberRow }
  | {
      readonly kind: 'visibility-changed'
      readonly before: TripRow
      readonly after: TripRow
    }
  | { readonly kind: 'trip-archived'; readonly trip: TripRow }
  | { readonly kind: 'trip-restored'; readonly trip: TripRow }
  | { readonly kind: 'trip-deleted'; readonly trip: TripRow }

/** What to close in a trip's room: one person's sockets, every socket, or every socket and the stored state. */
export type TripEviction =
  | {
      readonly scope: 'person'
      readonly tripId: string
      readonly userId: string
    }
  | { readonly scope: 'room'; readonly tripId: string }
  | { readonly scope: 'erase'; readonly tripId: string }

/**
 * The room operations an eviction needs. Required by {@link applyTripAccessChange}: there is no
 * default and no no-op, so the room cannot silently stop being closed.
 */
export interface TripRoomEviction {
  closeRoomFor: (
    scope: TenantScope,
    tripId: string,
    userId: string,
  ) => Promise<void>
  closeRoom: (scope: TenantScope, tripId: string) => Promise<void>
  resetRoom: (scope: TenantScope, tripId: string) => Promise<void>
}

/** The eviction table. Pure, so what each verb closes is read here and nowhere else. */
export function evictionsFor(
  change: TripAccessChange,
): ReadonlyArray<TripEviction> {
  switch (change.kind) {
    case 'member-added':
    case 'member-removed':
    case 'member-left':
      return [personOf(change.member)]
    case 'role-changed':
      return change.before.role === change.after.role
        ? []
        : [personOf(change.after)]
    case 'visibility-changed':
      // Workspace members who stop being able to read the trip were never on it, so the room cannot
      // name them: every socket goes, and they reconnect through the connect handler.
      return change.before.visibility === 'organization' &&
        change.after.visibility === 'private'
        ? [{ scope: 'room', tripId: change.after.id }]
        : []
    case 'trip-archived':
    case 'trip-restored':
      return [{ scope: 'room', tripId: change.trip.id }]
    case 'trip-deleted':
      return [{ scope: 'erase', tripId: change.trip.id }]
  }
}

function personOf(member: MemberRow): TripEviction {
  return { scope: 'person', tripId: member.tripId, userId: member.userId }
}

/** Closes what {@link evictionsFor} names, through the given room. */
export async function applyTripAccessChange(
  scope: TenantScope,
  change: TripAccessChange,
  room: TripRoomEviction,
): Promise<void> {
  for (const eviction of evictionsFor(change)) {
    switch (eviction.scope) {
      case 'person':
        await room.closeRoomFor(scope, eviction.tripId, eviction.userId)
        break
      case 'room':
        await room.closeRoom(scope, eviction.tripId)
        break
      case 'erase':
        await room.resetRoom(scope, eviction.tripId)
        break
    }
  }
}

/** The production wiring: {@link applyTripAccessChange} through the Worker's trip room. */
export async function settleTripAccessChange(
  scope: TenantScope,
  change: TripAccessChange,
): Promise<void> {
  if (evictionsFor(change).length === 0) {
    return
  }
  await applyTripAccessChange(
    scope,
    change,
    await import('#/server/fns/context'),
  )
}
