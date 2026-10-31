/**
 * Server-side helpers for talking to a trip's Durable Object.
 *
 * Route handlers and server functions use these instead of hand-building
 * requests, so the room's URL scheme and identity envelope live in one place.
 * The namespace is taken as a narrow structural type: any caller can pass
 * `env.TRIP_ROOM`, and tests can pass a stub.
 */

import { TRIP_ROOM_IDENTITY_HEADER, TRIP_ROOM_REVOKED_AT_HEADER, encodeTripRoomIdentity } from './protocol'
import type { CommitEntry, EntitySnapshot, PresenceMember, TripPatch, TripRoomIdentity } from './protocol'

export interface TripRoomStub {
  fetch: (request: Request) => Promise<Response>
}

export interface TripRoomNamespace {
  idFromName: (name: string) => DurableObjectId
  get: (id: DurableObjectId) => TripRoomStub
}

/**
 * Internal origin. Durable Object requests never leave the Cloudflare network,
 * but they still need a syntactically valid absolute URL.
 */
const ROOM_ORIGIN = 'https://trip-room.internal'

export function tripRoomUrl(tripId: string, route: 'connect' | 'snapshot' | 'commit' | 'close' | 'reset'): string {
  return `${ROOM_ORIGIN}/${encodeURIComponent(tripId)}/${route}`
}

function stubFor(namespace: TripRoomNamespace, tripId: string): TripRoomStub {
  // One object per trip: the trip id *is* the shard key.
  return namespace.get(namespace.idFromName(tripId))
}

/** Forwards a browser WebSocket upgrade into the trip's room. */
export function connectToTripRoom(
  namespace: TripRoomNamespace,
  identity: TripRoomIdentity,
  request: Request,
): Promise<Response> {
  const headers = new Headers(request.headers)
  headers.set(TRIP_ROOM_IDENTITY_HEADER, encodeTripRoomIdentity(identity))
  return stubFor(namespace, identity.tripId).fetch(
    new Request(tripRoomUrl(identity.tripId, 'connect'), { method: 'GET', headers }),
  )
}

export interface TripRoomSnapshotResponse {
  version: number
  entities: Array<EntitySnapshot>
  truncated: boolean
  peers: Array<PresenceMember>
}

/** Current room state, used to hydrate the collaborative UI on first paint. */
export async function readTripRoomSnapshot(
  namespace: TripRoomNamespace,
  tripId: string,
  limit?: number,
): Promise<TripRoomSnapshotResponse> {
  const url = new URL(tripRoomUrl(tripId, 'snapshot'))
  if (limit !== undefined) url.searchParams.set('limit', String(limit))
  const response = await stubFor(namespace, tripId).fetch(new Request(url.toString()))
  if (!response.ok) {
    throw new Error(`Trip room snapshot failed with ${response.status}`)
  }
  return (await response.json())
}

export interface TripRoomCommitResponse {
  version: number
  entries: Array<CommitEntry>
}

/**
 * Applies a change that did not originate from a socket — a queue job importing
 * bookings, or a server function writing D1 and mirroring the result to peers.
 */
export async function commitToTripRoom(
  namespace: TripRoomNamespace,
  input: { tripId: string; authorId: string; patches: Array<TripPatch> },
): Promise<TripRoomCommitResponse> {
  const response = await stubFor(namespace, input.tripId).fetch(
    new Request(tripRoomUrl(input.tripId, 'commit'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  )
  if (!response.ok) {
    throw new Error(`Trip room commit failed with ${response.status}`)
  }
  return (await response.json())
}

/**
 * Stamps `revokedAt` when the request is built, which is after the caller awaited the revoking
 * write: a connect minted before it may have read the old role, and the room refuses it. The stamp
 * is a header so the body contracts do not change and an older room still evicts.
 */
async function postClose(
  namespace: TripRoomNamespace,
  tripId: string,
  now: () => number,
  body?: string,
): Promise<void> {
  const response = await stubFor(namespace, tripId).fetch(
    new Request(tripRoomUrl(tripId, 'close'), {
      method: 'POST',
      headers: { [TRIP_ROOM_REVOKED_AT_HEADER]: String(now()) },
      body,
    }),
  )
  if (!response.ok) {
    throw new Error(`Trip room close failed with ${response.status}`)
  }
}

/**
 * Evicts every connected client, e.g. after a trip is archived, restored or deleted, and has the
 * room refuse a connect minted before now (see `TripRoom.handleClose`). The shipped client
 * reconnects through the connect handler, which re-checks the stored role. Call it after the write
 * that revokes access resolved.
 */
export function closeTripRoom(
  namespace: TripRoomNamespace,
  tripId: string,
  now: () => number = Date.now,
): Promise<void> {
  return postClose(namespace, tripId, now)
}

/**
 * Evicts one person's sockets — every tab and device — and nobody else's, e.g. after their role on
 * the trip changed or they were taken off it. The room finds them by the identity tag it put on each
 * socket at connect, and refuses that person's connect minted before now. Call it after the write
 * that revokes access resolved.
 */
export function closeTripRoomFor(
  namespace: TripRoomNamespace,
  tripId: string,
  userId: string,
  now: () => number = Date.now,
): Promise<void> {
  return postClose(namespace, tripId, now, JSON.stringify({ userId }))
}

/**
 * Closes a room's sockets and erases its stored state (see `TripRoom.handleReset`). For a trip that
 * is gone or whose people are being erased: a live room never clears itself. Call it **after** the
 * trip's rows are gone, so a socket that reconnects is refused at the connect handler instead of
 * rebuilding the room from rows that are about to be deleted. The timestamp also refuses connects
 * already authorized before deletion; reset retains only a non-personal room barrier.
 */
export async function resetTripRoom(
  namespace: TripRoomNamespace,
  tripId: string,
  now: () => number = Date.now,
): Promise<void> {
  const response = await stubFor(namespace, tripId).fetch(
    new Request(tripRoomUrl(tripId, 'reset'), {
      method: 'POST',
      headers: { [TRIP_ROOM_REVOKED_AT_HEADER]: String(now()) },
    }),
  )
  if (!response.ok) {
    throw new Error(`Trip room reset failed with ${response.status}`)
  }
}

/**
 * Resets the room of every trip given, each once. Every room is tried even when one refuses - a
 * room left holding a person's id is exactly what this exists to prevent - and the call then fails
 * naming the trips that did, so a retry can finish them. Resetting an empty room is harmless.
 */
export async function resetTripRooms(
  namespace: TripRoomNamespace,
  tripIds: ReadonlyArray<string>,
): Promise<void> {
  const failed: Array<string> = []
  for (const tripId of new Set(tripIds)) {
    try {
      await resetTripRoom(namespace, tripId)
    } catch {
      failed.push(tripId)
    }
  }
  if (failed.length > 0) {
    throw new Error(`Trip room reset failed for ${failed.length} trip(s): ${failed.join(', ')}`)
  }
}
