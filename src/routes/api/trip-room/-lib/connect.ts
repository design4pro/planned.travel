import {
  getSession,
  isAuthRequirementError,
  requireOrg,
} from '#/server/auth/session'
import {
  WORKSPACE_CLAIM_QUERY,
  parseWorkspaceClaim,
} from '#/lib/workspace-claim'
import { getDb } from '#/server/db/client'
import { connectToTripRoom } from '#/server/do'
import {
  TRIP_ROOM_WORKSPACE_CHANGED_CODE,
  TRIP_ROOM_WORKSPACE_CHANGED_REASON,
} from '#/server/do/protocol'
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
 * **A stale tab is told, not refused.** A tab states the workspace it is showing as `?workspace=`
 * (`WORKSPACE_CLAIM_QUERY`), the same claim every server function carries. After the session and
 * workspace checks and before any trip lookup, a valid claim that is not the effective workspace is
 * answered by the Worker itself: it accepts the upgrade, closes it at once with
 * `TRIP_ROOM_WORKSPACE_CHANGED_CODE` and a fixed reason, and never touches the room. A refused
 * upgrade (404) would be unreadable to a browser socket, which is what left a stale tab
 * reconnecting for ever. The claim only narrows: it is compared, never used to pick the workspace
 * (`TenantContext` still comes from the session alone), a missing or malformed one behaves as it
 * always did, and the answer is the same whether or not the trip exists anywhere, so it reveals
 * nothing about the workspace the session is in or the trip asked for.
 *
 * The room role is the stored **trip role** read through `canWritePlan` — the
 * one "may write the plan" rule every planner read already uses — never the
 * mere fact of membership: an owner or editor of a trip that is not archived
 * connects as an `editor`; a trip viewer, a workspace member with no place on
 * the trip, and anyone looking at an archived trip connect as a `viewer`. A
 * viewer receives commits and their patches are refused by the room, which is
 * the same answer `assertTripRole` gives their write to D1. A session an operator is
 * impersonating (`context.impersonatedBy`) connects as a `viewer` whatever the trip role:
 * a room commit is authored by the person alone, so only a read-only socket keeps
 * docs/ACCESS.md §6.4 true.
 *
 * The role is read once, at connect, and an open socket keeps it - so the writes
 * that change it close the sockets they affect: a new role, a removal or a leave
 * closes that person's sockets (`closeRoomFor`). An archive, a restore or a visibility
 * narrowed to private closes the whole room (`closeRoom`); deletion closes its sockets
 * and erases stored room state (`resetRoom`). All three helpers live in
 * `src/server/fns/context.ts`. A person who stops belonging to the workspace
 * (removed, leaving, or banned, signed out or deleted by the platform console) has
 * the sockets they hold in every room of it closed by the `trip-room-evict` task, and
 * so does a person who ends their own session (a password reset, a password change that
 * revokes the others, a sign-out, a revoke of one, the other or all sessions, #1093),
 * and so does the person an operator ends an impersonation of (#1179):
 * the sockets of all their devices close and the next connect re-runs this handler.
 * Two concurrent sign-outs queue the close twice, which is accepted.
 * The shipped client reconnects through this handler, which is what picks up the
 * stored role. The close is best effort: a room that
 * cannot be reached is logged, and the room's maximum socket age (15 minutes) plus
 * alarm interval (5 minutes) bounds that stale role window to about 20 minutes.
 *
 * **A connect in flight is refused, not accepted with the old role.** The identity carries
 * `issuedAt`, taken from this Worker's clock before anything that decides the role is read. A close
 * carries `revokedAt` from the same clock, taken after the revoking write resolved, and the room
 * remembers it as a watermark (`TripRoom.handleClose`). A connect minted before the watermark plus
 * `TRIP_ROOM_REVOCATION_SKEW_MS` reaches the room, is answered 101 and closed at once with the
 * room-closed code, and the client reconnects through this handler. The room never reads its own
 * clock for that decision. `issuedAt` is set here from this Worker's clock and the identity header is
 * overwritten by `connectToTripRoom`, so nothing the browser sends can set it.
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

/**
 * Answers an upgrade from a stale tab: accepted in the Worker, closed at once, never forwarded.
 * The room's own identity is not built and the reason names nothing.
 */
function closeForChangedWorkspace(): Response {
  const pair = new WebSocketPair()
  const client = pair[0]
  const server = pair[1]
  server.accept()
  server.close(
    TRIP_ROOM_WORKSPACE_CHANGED_CODE,
    TRIP_ROOM_WORKSPACE_CHANGED_REASON,
  )
  return new Response(null, { status: 101, webSocket: client })
}

export async function serveTripRoom(
  namespace: TripRoomNamespace,
  request: Request,
  tripId: string,
  now: () => number = Date.now,
): Promise<Response> {
  // Taken before the session, the trip and the stored role are read, so a revocation stamped after
  // those reads is later than this and the room refuses the connect (#1085).
  const issuedAt = now()
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

  // Advisory: absent or malformed behaves as it always did. A valid claim is compared with the
  // workspace this request resolved, before either lookup below, so the answer cannot depend on
  // which trips exist.
  const claim = parseWorkspaceClaim(
    new URL(request.url).searchParams.get(WORKSPACE_CLAIM_QUERY),
  )
  if (
    claim.status === 'valid' &&
    claim.organizationId !== context.organizationId
  ) {
    return closeForChangedWorkspace()
  }

  const scope = createScope(getDb(), context)
  const trip = await getTrip(scope, tripId)
  if (trip === null) {
    return json({ error: 'That trip is not in this workspace.' }, 404)
  }

  const tripRole = await tripRoleFor(scope, trip.id, context.userId)

  // An impersonated session never commits over the socket: the room stamps a commit with the
  // person it was opened for and records no operator, so there would be nothing to attribute it
  // to (docs/ACCESS.md §6.4). Read off the resolved context, never off the request.
  const canCommit =
    context.impersonatedBy === null && canWritePlan(trip, tripRole)

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
    role: canCommit ? 'editor' : 'viewer',
    issuedAt,
  }

  return connectToTripRoom(namespace, identity, request)
}
