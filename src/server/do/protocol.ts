/**
 * Wire protocol for the per-trip realtime room (`TripRoom` Durable Object).
 *
 * This module is isomorphic on purpose: the browser imports the same schemas the
 * Durable Object validates with, so a protocol change cannot drift between the
 * two sides. It has no Cloudflare imports and no side effects.
 *
 * Conflict model — last write wins, per field, ordered by the room's monotonic
 * `version`. Every trip has exactly one Durable Object, so all writes for that
 * trip are serialised through one thread: "last" is unambiguous. Each field
 * remembers the version and author that last set it, which lets the room tell a
 * client that its write overwrote someone else's (or was itself overwritten)
 * instead of silently losing an edit.
 */

import { z } from 'zod'

export const TRIP_ROOM_PROTOCOL_VERSION = 1

/** Hard cap on a single inbound frame. Larger frames are rejected, not truncated. */
export const TRIP_ROOM_MAX_MESSAGE_BYTES = 32_768

/** Patches per `patch` message. Keeps one commit's storage writes bounded. */
export const TRIP_ROOM_MAX_PATCHES_PER_MESSAGE = 50

/** Fields per patch. */
export const TRIP_ROOM_MAX_FIELDS_PER_PATCH = 64

/** Commits retained for reconnect catch-up before a client must full-sync. */
export const TRIP_ROOM_LOG_CAPACITY = 512

/** Entities the room will replay in one `sync`; beyond this the client refetches. */
export const TRIP_ROOM_MAX_SNAPSHOT_ENTITIES = 2000

/** Token bucket applied per connection, enforced inside the room. */
export const TRIP_ROOM_RATE_LIMIT = { windowMs: 1_000, maxMessages: 40 } as const

/** Tombstones are pruned this long after the delete. */
export const TRIP_ROOM_TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1000

/** A room with no sockets and no activity for this long erases its sync state. */
export const TRIP_ROOM_IDLE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/** How often the room's alarm runs housekeeping while it holds state. */
export const TRIP_ROOM_ALARM_INTERVAL_MS = 5 * 60 * 1000

/**
 * Maximum socket age before access is checked again. With the five-minute alarm interval,
 * a missed revocation close or an in-flight connect keeps its old role for about 20 minutes.
 */
export const TRIP_ROOM_MAX_SOCKET_AGE_MS = 15 * 60 * 1000

/**
 * The close the room sends after an access or trip state change (`/close`), or when a socket
 * exceeds the maximum age and must check access again. The reason, not the code, tells the client
 * apart from the other 1012 closes (no session, protocol mismatch): only this one means the
 * screen's role-dependent data may be stale, so only this one
 * makes the hook re-read its loader.
 */
export const TRIP_ROOM_CLOSED_CODE = 1012
export const TRIP_ROOM_CLOSED_REASON = 'Room closed'

/**
 * The close the app Worker itself sends, before the room is involved, when a tab's workspace claim
 * (`?workspace=`, see `src/lib/workspace-claim.ts`) is not the session's workspace. A browser
 * WebSocket cannot read the status of a refused upgrade, so the answer travels as an accepted
 * socket that is closed at once: the only place a close code and reason reach the page. The code is
 * in the 4xxx application range, and the reason is fixed text that names nothing - not the
 * workspace the session is in, not the trip. The client matches on the reason, as it does for
 * `TRIP_ROOM_CLOSED_REASON`, and stops reconnecting: no retry can succeed from a stale tab.
 */
export const TRIP_ROOM_WORKSPACE_CHANGED_CODE = 4001
export const TRIP_ROOM_WORKSPACE_CHANGED_REASON = 'Workspace changed'

/** Client keepalive interval. The room answers pings without leaving hibernation. */
export const TRIP_ROOM_PING_INTERVAL_MS = 25_000

export const TRIP_ENTITY_KINDS = [
  'trip',
  'day',
  'stop',
  'route',
  'reservation',
  'expense',
  'packing-item',
  'note',
  'journal-entry',
] as const

export type TripEntityKind = (typeof TRIP_ENTITY_KINDS)[number]

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | Array<JsonValue>
  | { [key: string]: JsonValue }

export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
)

export const entityRefSchema = z.object({
  kind: z.enum(TRIP_ENTITY_KINDS),
  id: z.string().min(1).max(64),
})

export type EntityRef = z.infer<typeof entityRefSchema>

export function entityKey(ref: EntityRef): string {
  return `${ref.kind}/${ref.id}`
}

export const presenceUserSchema = z.object({
  id: z.string().min(1).max(64),
  /**
   * `null` when the person has no display name of their own: the room never
   * carries a placeholder or their email, and each client words the absence in
   * its own language.
   */
  name: z.string().min(1).max(80).nullable(),
  /** Two-letter fallback used by `AvatarStack` when there is no image. */
  initials: z.string().min(1).max(3),
  /** Presence accent, resolved from the design tokens on the client. */
  hue: z.number().int().min(0).max(359),
  avatarUrl: z.string().url().max(512).nullable().optional(),
})

export type PresenceUser = z.infer<typeof presenceUserSchema>

export const presenceFocusSchema = z.object({
  entity: entityRefSchema,
  field: z.string().min(1).max(64).nullable().optional(),
})

export type PresenceFocus = z.infer<typeof presenceFocusSchema>

export interface PresenceMember {
  connectionId: string
  user: PresenceUser
  joinedAt: number
  lastSeenAt: number
  focus: PresenceFocus | null
}

export const patchOps = ['upsert', 'delete'] as const
export type PatchOp = (typeof patchOps)[number]

export const tripPatchSchema = z.object({
  entity: entityRefSchema,
  op: z.enum(patchOps),
  fields: z.record(z.string().min(1).max(64), jsonValueSchema).default({}),
  /**
   * Room version the client's optimistic state was based on. Used only to
   * detect that a write raced with someone else's; it never blocks the write.
   */
  baseVersion: z.number().int().nonnegative().optional(),
})

export type TripPatch = z.infer<typeof tripPatchSchema>

export const clientMessageSchema = z.discriminatedUnion('t', [
  z.object({
    t: z.literal('hello'),
    protocol: z.number().int().positive(),
    /** Last version this client already applied; enables delta catch-up. */
    sinceVersion: z.number().int().nonnegative().optional(),
  }),
  z.object({
    t: z.literal('patch'),
    requestId: z.string().min(1).max(64),
    patches: z.array(tripPatchSchema).min(1).max(TRIP_ROOM_MAX_PATCHES_PER_MESSAGE),
  }),
  z.object({
    t: z.literal('focus'),
    focus: presenceFocusSchema.nullable(),
  }),
  z.object({ t: z.literal('ping') }),
])

export type ClientMessage = z.infer<typeof clientMessageSchema>

export interface CommitField {
  value: JsonValue
  version: number
  at: number
  by: string
}

export interface CommitEntry {
  version: number
  entity: EntityRef
  op: PatchOp
  /** Fields as accepted by the room, including the version stamp each got. */
  fields: Record<string, CommitField>
  at: number
  by: string
  byConnection: string
  /** True when an `upsert` landed on a tombstone and brought the entity back. */
  revived?: boolean
}

export interface EntitySnapshot {
  entity: EntityRef
  deleted: boolean
  version: number
  updatedAt: number
  fields: Record<string, CommitField>
}

/** A field whose write landed on top of a newer value from another author. */
export interface OverwriteNotice {
  entity: EntityRef
  field: string
  previousBy: string
  previousVersion: number
}

export type TripRoomErrorCode =
  | 'invalid-message'
  | 'protocol-mismatch'
  | 'payload-too-large'
  | 'rate-limited'
  | 'not-joined'
  /**
   * The connection's role cannot write. Distinct from `not-joined` so a client
   * that answers `not-joined` by re-sending `hello` does not loop for a viewer.
   * An addition to the vocabulary, not a wire change: no protocol version bump.
   */
  | 'read-only'
  | 'internal'

export type ServerMessage =
  | {
      t: 'welcome'
      protocol: number
      connectionId: string
      tripId: string
      version: number
      you: PresenceMember
      peers: Array<PresenceMember>
      /** Present when the client asked for a delta and the room could serve one. */
      commits?: Array<CommitEntry>
      /** Present when the room replayed full state instead of a delta. */
      snapshot?: { version: number; entities: Array<EntitySnapshot>; truncated: boolean }
    }
  | { t: 'presence'; peers: Array<PresenceMember>; joined?: string; left?: string }
  | { t: 'commit'; version: number; entries: Array<CommitEntry> }
  | {
      t: 'ack'
      requestId: string
      version: number
      applied: Array<{ entity: EntityRef; fields: Array<string> }>
      overwrote: Array<OverwriteNotice>
    }
  | { t: 'pong' }
  | { t: 'error'; code: TripRoomErrorCode; message: string; requestId?: string }

/** Auto-response frames: the room answers these without waking from hibernation. */
export const TRIP_ROOM_PING_FRAME = JSON.stringify({ t: 'ping' } satisfies ClientMessage)
export const TRIP_ROOM_PONG_FRAME = JSON.stringify({ t: 'pong' } satisfies ServerMessage)

export type ParseResult<T> = { ok: true; value: T } | { ok: false; code: TripRoomErrorCode; message: string }

function messageByteLength(raw: string): number {
  return new TextEncoder().encode(raw).byteLength
}

/** Validates an inbound frame. Never throws: the room turns failures into `error`. */
export function parseClientMessage(raw: string | ArrayBuffer): ParseResult<ClientMessage> {
  if (typeof raw !== 'string') {
    return { ok: false, code: 'invalid-message', message: 'Binary frames are not supported' }
  }
  if (messageByteLength(raw) > TRIP_ROOM_MAX_MESSAGE_BYTES) {
    return {
      ok: false,
      code: 'payload-too-large',
      message: `Frame exceeds ${TRIP_ROOM_MAX_MESSAGE_BYTES} bytes`,
    }
  }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, code: 'invalid-message', message: 'Frame is not valid JSON' }
  }
  const parsed = clientMessageSchema.safeParse(json)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'invalid-message',
      message: parsed.error.issues[0]?.message ?? 'Frame does not match the protocol',
    }
  }
  for (const patch of parsed.data.t === 'patch' ? parsed.data.patches : []) {
    if (Object.keys(patch.fields).length > TRIP_ROOM_MAX_FIELDS_PER_PATCH) {
      return {
        ok: false,
        code: 'payload-too-large',
        message: `A patch may carry at most ${TRIP_ROOM_MAX_FIELDS_PER_PATCH} fields`,
      }
    }
    if (patch.op === 'upsert' && Object.keys(patch.fields).length === 0) {
      return { ok: false, code: 'invalid-message', message: 'An upsert must set at least one field' }
    }
  }
  return { ok: true, value: parsed.data }
}

export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message)
}

/**
 * Client-side counterpart. Server frames are trusted (they come from our own
 * Durable Object) so this only guards against a version skew during deploys.
 */
export function parseServerMessage(raw: string): ParseResult<ServerMessage> {
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, code: 'invalid-message', message: 'Frame is not valid JSON' }
  }
  if (typeof json !== 'object' || json === null || !('t' in json)) {
    return { ok: false, code: 'invalid-message', message: 'Frame has no message type' }
  }
  return { ok: true, value: json as ServerMessage }
}

/** Identity the app Worker hands to the room when opening a socket. */
export const TRIP_ROOM_IDENTITY_HEADER = 'x-planned-trip-identity'

export const tripRoomIdentitySchema = z.object({
  tripId: z.string().min(1).max(64),
  orgId: z.string().min(1).max(64),
  user: presenceUserSchema,
  /** `viewer` connections receive commits but their patches are rejected. */
  role: z.enum(['editor', 'viewer']),
})

export type TripRoomIdentity = z.infer<typeof tripRoomIdentitySchema>

export function encodeTripRoomIdentity(identity: TripRoomIdentity): string {
  return JSON.stringify(identity)
}

export function decodeTripRoomIdentity(raw: string | null): ParseResult<TripRoomIdentity> {
  if (raw === null) {
    return { ok: false, code: 'not-joined', message: 'Missing room identity header' }
  }
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, code: 'invalid-message', message: 'Identity header is not valid JSON' }
  }
  const parsed = tripRoomIdentitySchema.safeParse(json)
  if (!parsed.success) {
    return {
      ok: false,
      code: 'invalid-message',
      message: parsed.error.issues[0]?.message ?? 'Identity header is malformed',
    }
  }
  return { ok: true, value: parsed.data }
}
