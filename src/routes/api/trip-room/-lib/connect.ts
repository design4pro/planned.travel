import {
  getSession,
  isAuthRequirementError,
  requireOrg,
} from '#/server/auth/session'
import { getDb } from '#/server/db/client'
import { connectToTripRoom } from '#/server/do'
import {
  canWritePlan,
  createScope,
  getTrip,
  tripRoleFor,
} from '#/server/repos'

import type { TenantContext } from '#/server/auth/session'
import type { PresenceUser, TripRoomIdentity, TripRoomNamespace } from '#/server/do'

/**
 * The decisions behind `GET /api/trip-room/:tripId` — the WebSocket door into a trip's Durable Object.
 *
 * The room itself is only reachable through its binding and trusts whatever
 * identity the app Worker asserts, so this handler is the whole authorisation
 * boundary: it re-reads the session, re-reads the caller's stored trip role (never
 * trusting the cookie's cached role), resolves the trip *inside* that tenant — a trip id from
 * another workspace is a 404 before the socket exists — and only then forwards
 * the upgrade with a signed-in-fact identity attached.
 *
 * The room role is the stored **trip role** read through `canWritePlan` — the
 * one "may write the plan" rule every planner read already uses — never the
 * mere fact of membership: an owner or editor of a trip that is not archived
 * connects as an `editor`; a trip viewer, a workspace member with no place on
 * the trip, and anyone looking at an archived trip connect as a `viewer`. A
 * viewer receives commits and their patches are refused by the room, which is
 * the same answer `assertTripRole` gives their write to D1.
 *
 * The role is read once, at connect, and an open socket keeps it - so the writes
 * that change it close the sockets they affect: a new role, a removal or a leave
 * closes that person's sockets (`closeRoomFor`), and an archive, a restore, a delete
 * or a visibility narrowed to private closes the whole room (`closeRoom`), both in
 * `src/server/fns/context.ts`. A person who stops belonging to the workspace
 * (removed, leaving, or banned, signed out or deleted by the platform console) has
 * the sockets they hold in every room of it closed by the `trip-room-evict` task.
 * The shipped client reconnects through this handler, which is what picks up the
 * stored role. The close is best effort: a room that
 * cannot be reached is logged and the old role holds until the socket drops, and so
 * does the role of a connect that was already in flight - its role was read before
 * the write, and its upgrade can reach the room after the close found no socket.
 */

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * The display name the room may show, or `null` when the person has none. The
 * session layer already stands in the email for a missing name, so a name that is
 * only the email counts as no name: an email address is never broadcast to a room.
 */
function displayNameOf(user: { name: string; email: string }): string | null {
  const name = user.name.trim()
  if (name.length === 0) return null
  return name.toLowerCase() === user.email.trim().toLowerCase() ? null : name
}

/** Two letters for the presence avatar, taken from the display name. */
function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/u)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join('')
    .toUpperCase()
  return letters.length > 0 ? letters : '?'
}

/**
 * A stable hue per user id, so one person keeps one presence colour across
 * sessions and devices without storing a preference for it.
 */
function hueOf(userId: string): number {
  let hash = 7
  for (const char of userId) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 360
  }
  return hash
}

/** The room's schema insists on an absolute URL, so anything else is dropped. */
function absoluteAvatar(image: string | null | undefined): string | null {
  if (typeof image !== 'string' || image.length === 0 || image.length > 512) {
    return null
  }
  return /^https?:\/\//.test(image) ? image : null
}

export async function serveTripRoom(
  namespace: TripRoomNamespace,
  request: Request,
  tripId: string,
): Promise<Response> {
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return json(
      { error: 'This endpoint only accepts a WebSocket upgrade.' },
      426,
    )
  }

  const session = await getSession()
  if (session === null) {
    return json({ error: 'Sign in to join this trip.' }, 401)
  }

  // `requireOrg` throws rather than returning null, and an anonymous or
  // workspace-less caller must get a clean status rather than a 500 — this is the
  // one place that failure is expected rather than exceptional.
  let context: TenantContext
  try {
    context = await requireOrg()
  } catch (cause) {
    if (isAuthRequirementError(cause)) {
      return json({ error: cause.message }, 403)
    }
    throw cause
  }

  const scope = createScope(getDb(), context)
  const trip = await getTrip(scope, tripId)
  if (trip === null) {
    return json({ error: 'That trip is not in this workspace.' }, 404)
  }

  const tripRole = await tripRoleFor(scope, trip.id, context.userId)

  const name = displayNameOf(session.user)
  const user: PresenceUser = {
    id: context.userId,
    name: name === null ? null : name.slice(0, 80),
    initials: name === null ? '?' : initialsOf(name),
    hue: hueOf(context.userId),
    avatarUrl: absoluteAvatar(session.user.image),
  }

  const identity: TripRoomIdentity = {
    tripId: trip.id,
    orgId: context.organizationId,
    user,
    role: canWritePlan(trip, tripRole) ? 'editor' : 'viewer',
  }

  return connectToTripRoom(namespace, identity, request)
}

