import { createFileRoute } from '@tanstack/react-router'
// Loads the Start module augmentation that adds `server` to route options.
import type {} from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

import {
  getSession,
  isAuthRequirementError,
  requireOrg,
} from '#/server/auth/session'
import { getDb } from '#/server/db/client'
import { connectToTripRoom } from '#/server/do'
import { createScope, getTrip, listTripMembers } from '#/server/repos'

import type { TenantContext } from '#/server/auth/session'
import type { PresenceUser, TripRoomIdentity } from '#/server/do'

/**
 * `GET /api/trip-room/:tripId` — the WebSocket door into a trip's Durable Object.
 *
 * The room itself is only reachable through its binding and trusts whatever
 * identity the app Worker asserts, so this handler is the whole authorisation
 * boundary: it re-reads the session, re-reads the membership (never trusting the
 * cookie's cached role), resolves the trip *inside* that tenant — a trip id from
 * another workspace is a 404 before the socket exists — and only then forwards
 * the upgrade with a signed-in-fact identity attached.
 *
 * A traveller who is not on the trip, and anyone looking at an archived trip,
 * connects as a `viewer`: they receive commits and their patches are refused by
 * the room.
 *
 * Declaring only `server` keeps the handler, the session layer and the Durable
 * Object namespace out of the client bundle.
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

async function get({
  request,
  params,
}: {
  request: Request
  params: { tripId: string }
}): Promise<Response> {
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return json(
      { error: 'This endpoint only accepts a WebSocket upgrade.' },
      426,
    )
  }

  // `TRIP_ROOM` is declared in `wrangler.jsonc` for every environment, so the
  // binding is always present; a deployment without it fails isolate startup long
  // before a request reaches here.
  const namespace = env.TRIP_ROOM

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
  const trip = await getTrip(scope, params.tripId)
  if (trip === null) {
    return json({ error: 'That trip is not in this workspace.' }, 404)
  }

  const members = await listTripMembers(scope, trip.id)
  const onTrip = members.some((member) => member.userId === context.userId)

  const name =
    session.user.name.trim().length > 0
      ? session.user.name.trim()
      : session.user.email
  const user: PresenceUser = {
    id: context.userId,
    name: name.slice(0, 80),
    initials: initialsOf(name),
    hue: hueOf(context.userId),
    avatarUrl: absoluteAvatar(session.user.image),
  }

  const identity: TripRoomIdentity = {
    tripId: trip.id,
    orgId: context.organizationId,
    user,
    role: onTrip && !trip.isArchived ? 'editor' : 'viewer',
  }

  return connectToTripRoom(namespace, identity, request)
}

export const Route = createFileRoute('/api/trip-room/$tripId')({
  server: { handlers: { GET: get } },
})
