/**
 * Server-side helpers for talking to a trip's Durable Object.
 *
 * Route handlers and server functions use these instead of hand-building
 * requests, so the room's URL scheme and identity envelope live in one place.
 * The namespace is taken as a narrow structural type: any caller can pass
 * `env.TRIP_ROOM`, and tests can pass a stub.
 */

import { TRIP_ROOM_IDENTITY_HEADER, encodeTripRoomIdentity } from './protocol'
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

async function postClose(namespace: TripRoomNamespace, tripId: string, body?: string): Promise<void> {
  const response = await stubFor(namespace, tripId).fetch(
    new Request(tripRoomUrl(tripId, 'close'), { method: 'POST', body }),
  )
  if (!response.ok) {
    throw new Error(`Trip room close failed with ${response.status}`)
  }
}

/**
 * Evicts every connected client, e.g. after a trip is archived, restored or deleted. The shipped
 * client reconnects through the connect handler, which re-checks the stored role.
 */
export function closeTripRoom(namespace: TripRoomNamespace, tripId: string): Promise<void> {
  return postClose(namespace, tripId)
}

/**
 * Evicts one person's sockets — every tab and device — and nobody else's, e.g. after their role on
 * the trip changed or they were taken off it. The room finds them by the identity tag it put on each
 * socket at connect.
 */
export function closeTripRoomFor(namespace: TripRoomNamespace, tripId: string, userId: string): Promise<void> {
  return postClose(namespace, tripId, JSON.stringify({ userId }))
}

/**
 * Closes a room's sockets and erases its stored state (see `TripRoom.handleReset`). For a trip that
 * is gone or whose people are being erased: a live room never clears itself. Call it **after** the
 * trip's rows are gone, so a socket that reconnects is refused at the connect handler instead of
 * rebuilding the room from rows that are about to be deleted.
 */
export async function resetTripRoom(namespace: TripRoomNamespace, tripId: string): Promise<void> {
  const response = await stubFor(namespace, tripId).fetch(
    new Request(tripRoomUrl(tripId, 'reset'), { method: 'POST' }),
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
