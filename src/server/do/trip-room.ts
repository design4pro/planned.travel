/**
 * `TripRoom` — one Durable Object instance per trip.
 *
 * Why per trip: collaboration load shards by the thing people actually
 * collaborate on. Two hundred trips editing at once are two hundred independent
 * objects, each with its own single-threaded write path, its own storage and its
 * own hibernation lifecycle. Nothing global is contended, so the realtime layer
 * scales by adding trips, not by adding capacity.
 *
 * Sockets use the **WebSocket Hibernation API**: the object accepts the socket
 * with `state.acceptWebSocket()` and then goes away. It is only billed and only
 * resident while a frame is actually being handled, and a room can hold idle
 * collaborators between periodic access checks. Connection state that must survive
 * hibernation lives in the socket's attachment; room state lives in storage.
 *
 * The Durable Object is a coordination and fan-out layer, not the system of
 * record: D1 (through `server/repos`) remains the durable truth. The room keeps
 * a bounded commit log so a reconnecting client can catch up with a delta
 * instead of refetching the whole trip.
 */

import {
  TRIP_ROOM_ALARM_INTERVAL_MS,
  TRIP_ROOM_CLOSED_CODE,
  TRIP_ROOM_CLOSED_REASON,
  TRIP_ROOM_IDENTITY_HEADER,
  TRIP_ROOM_IDLE_TTL_MS,
  TRIP_ROOM_LOG_CAPACITY,
  TRIP_ROOM_MAX_SNAPSHOT_ENTITIES,
  TRIP_ROOM_MAX_SOCKET_AGE_MS,
  TRIP_ROOM_PING_FRAME,
  TRIP_ROOM_PONG_FRAME,
  TRIP_ROOM_PROTOCOL_VERSION,
  TRIP_ROOM_RATE_LIMIT,
  TRIP_ROOM_REFUSAL_CLOSE_DELAY_MS,
  TRIP_ROOM_REVOCATION_SKEW_MS,
  TRIP_ROOM_REVOCATION_TTL_MS,
  TRIP_ROOM_REVOKED_AT_HEADER,
  TRIP_ROOM_TOMBSTONE_TTL_MS,
  decodeTripRoomIdentity,
  encodeServerMessage,
  entityKey,
  parseClientMessage,
  tripPatchSchema,
} from './protocol'
import { createLogger } from '../observability/logger'
import type { Logger } from '../observability/logger'
import type {
  CommitEntry,
  CommitField,
  EntityRef,
  EntitySnapshot,
  OverwriteNotice,
  PresenceFocus,
  PresenceMember,
  ServerMessage,
  TripPatch,
  TripRoomErrorCode,
  TripRoomIdentity,
} from './protocol'

/* ------------------------------------------------------------------ ports -- */

/**
 * The slice of `DurableObjectStorage` the room uses. Narrowing the dependency
 * keeps the object unit-testable in a plain Node test environment — a real
 * `DurableObjectState` satisfies these shapes structurally.
 */
export interface TripRoomStorage {
  get: <T>(key: string) => Promise<T | undefined>
  put: <T>(entries: Record<string, T>) => Promise<void>
  list: <T>(options?: {
    prefix?: string
    start?: string
    end?: string
    limit?: number
    reverse?: boolean
  }) => Promise<Map<string, T>>
  delete: (keys: Array<string>) => Promise<number>
  deleteAll: () => Promise<void>
  getAlarm: () => Promise<number | null>
  setAlarm: (scheduledTime: number) => Promise<void>
  deleteAlarm: () => Promise<void>
}

export interface TripRoomSocket {
  send: (message: string) => void
  close: (code?: number, reason?: string) => void
  serializeAttachment: (value: unknown) => void
  deserializeAttachment: () => unknown
}

export interface TripRoomState {
  storage: TripRoomStorage
  acceptWebSocket: (ws: TripRoomSocket, tags?: Array<string>) => void
  getWebSockets: (tag?: string) => Array<TripRoomSocket>
  setWebSocketAutoResponse?: (pair: unknown) => void
}

export interface TripRoomEnv {
  ENVIRONMENT?: string
  LOG_LEVEL?: string
}

export interface TripRoomOptions {
  logger?: Logger
  now?: () => number
  newId?: () => string
}

/* ------------------------------------------------------------- room state -- */

interface RoomMeta {
  /** Monotonic, incremented once per committed entity change. */
  version: number
  /** Lowest version still present in the commit log. */
  logStart: number
  updatedAt: number
}

interface StoredEntity {
  entity: EntityRef
  deleted: boolean
  deletedAt: number | null
  version: number
  updatedAt: number
  fields: Record<string, CommitField>
}

interface SessionAttachment {
  connectionId: string
  identity: TripRoomIdentity
  joinedAt: number
  lastSeenAt: number
  focus: PresenceFocus | null
  /** `hello` handshake completed. Patches before that are refused. */
  joined: boolean
  /**
   * The room asked this socket to close. The runtime stops delivering frames once it has, but a
   * closing socket stays listed until the handshake finishes, so the room does not rely on that: an
   * evicted socket is never joined, never counted in presence and never answered.
   */
  evicted: boolean
  rate: { windowStart: number; count: number }
}

const META_KEY = 'meta'
const ENTITY_PREFIX = 'e:'
const LOG_PREFIX = 'l:'
const REVOCATION_PREFIX = 'w:'
const ROOM_REVOCATION_KEY = `${REVOCATION_PREFIX}room`
const LOG_SEQ_WIDTH = 12
const PRESENCE_TOUCH_INTERVAL_MS = 5_000
const CLOSE_RATE_LIMITED = 1013
const CLOSE_ROOM_CLOSED = TRIP_ROOM_CLOSED_CODE

function logKey(version: number): string {
  return `${LOG_PREFIX}${String(version).padStart(LOG_SEQ_WIDTH, '0')}`
}

function personRevocationKey(userId: string): string {
  return `${REVOCATION_PREFIX}u:${userId}`
}

function entityStorageKey(ref: EntityRef): string {
  return `${ENTITY_PREFIX}${entityKey(ref)}`
}

const emptyMeta: RoomMeta = { version: 0, logStart: 1, updatedAt: 0 }

/* ------------------------------------------------------------------- room -- */

export class TripRoom implements DurableObject {
  private readonly state: TripRoomState
  private readonly logger: Logger
  private readonly now: () => number
  private readonly newId: () => string
  /** Serialises commits so two in-flight frames cannot interleave a read-modify-write. */
  private tail: Promise<unknown> = Promise.resolve()
  private meta: RoomMeta | null = null
  private tripId = 'unknown'
  /**
   * Set after reset erases content. A retained barrier already has its pruning alarm; a socket's
   * later close must not arm an alarm on an otherwise empty room. A new connection resumes use.
   */
  private erased = false

  constructor(state: TripRoomState, env: TripRoomEnv, options: TripRoomOptions = {}) {
    this.state = state
    this.now = options.now ?? (() => Date.now())
    this.newId = options.newId ?? (() => crypto.randomUUID())
    this.logger =
      options.logger ??
      createLogger({
        level: env.LOG_LEVEL === 'debug' ? 'debug' : 'info',
        context: {
          component: 'durable-object',
          route: 'trip-room',
          environment: env.ENVIRONMENT,
        },
      })

    // Keepalive pings are answered by the runtime itself, so an idle room with
    // twenty open sockets never wakes up just to say "pong".
    if (typeof WebSocketRequestResponsePair !== 'undefined' && state.setWebSocketAutoResponse) {
      state.setWebSocketAutoResponse(
        new WebSocketRequestResponsePair(TRIP_ROOM_PING_FRAME, TRIP_ROOM_PONG_FRAME),
      )
    }
  }

  /* ------------------------------------------------------------ http api -- */

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const route = url.pathname.replace(/^.*\/(?=[^/]*$)/, '')

    switch (route) {
      case 'connect':
        return this.handleConnect(request)
      case 'snapshot':
        return this.handleSnapshot(request)
      case 'commit':
        return this.handleServerCommit(request)
      case 'close':
        return this.handleClose(request)
      case 'reset':
        return this.handleReset(request)
      default:
        return json({ error: `Unknown trip room route: ${route}` }, 404)
    }
  }

  private async handleConnect(request: Request): Promise<Response> {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return json({ error: 'Expected a WebSocket upgrade' }, 426)
    }
    // Identity is asserted by the app Worker, which has already resolved the
    // caller's stored trip role into the room role. The room is only reachable through its binding, never publicly.
    const identity = decodeTripRoomIdentity(
      request.headers.get(TRIP_ROOM_IDENTITY_HEADER) ??
        new URL(request.url).searchParams.get('identity'),
    )
    if (!identity.ok) {
      return json({ error: identity.message, code: identity.code }, 401)
    }
    this.tripId = identity.value.tripId
    this.erased = false
    // Read before the socket is accepted and with no await in between: a close that lands after this
    // read finds the accepted socket and evicts it.
    const revoked = await this.isRevoked(identity.value)

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]
    const now = this.now()
    const attachment: SessionAttachment = {
      connectionId: this.newId(),
      identity: identity.value,
      joinedAt: now,
      lastSeenAt: now,
      focus: null,
      joined: false,
      evicted: revoked,
      rate: { windowStart: now, count: 0 },
    }

    // Tag by user id so a later `getWebSockets(userId)` can find one person's
    // sockets without deserialising every attachment.
    this.state.acceptWebSocket(server, [identity.value.user.id])
    server.serializeAttachment(attachment)

    if (revoked) {
      // Answered 101 and closed straight after, like any other eviction: a browser socket cannot
      // read a refused upgrade, and the close reason is what makes the client reconnect through the
      // app Worker. The socket is never joined, so it is no presence and gets no frame. The close
      // waits for the upgrade to finish (see TRIP_ROOM_REFUSAL_CLOSE_DELAY_MS).
      setTimeout(
        () => {
          try {
            server.close(CLOSE_ROOM_CLOSED, TRIP_ROOM_CLOSED_REASON)
          } catch {
            // A peer or another close may have finished before the upgrade delay elapsed.
          }
        },
        TRIP_ROOM_REFUSAL_CLOSE_DELAY_MS,
      )
      await this.ensureAlarm()
      this.logger.info('trip room connect refused: minted before a revocation', {
        tripId: identity.value.tripId,
        orgId: identity.value.orgId,
        userId: identity.value.user.id,
        connectionId: attachment.connectionId,
      })
      return new Response(null, { status: 101, webSocket: client })
    }
    await this.ensureAlarm()

    this.logger.debug('trip room socket accepted', {
      tripId: identity.value.tripId,
      orgId: identity.value.orgId,
      userId: identity.value.user.id,
      connectionId: attachment.connectionId,
      role: identity.value.role,
    })

    return new Response(null, { status: 101, webSocket: client })
  }

  private async handleSnapshot(request: Request): Promise<Response> {
    const limit = clampLimit(new URL(request.url).searchParams.get('limit'))
    const meta = await this.loadMeta()
    const snapshot = await this.readSnapshot(limit)
    return json({
      version: meta.version,
      entities: snapshot.entities,
      truncated: snapshot.truncated,
      peers: this.presence(),
    })
  }

  private async handleServerCommit(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json({ error: 'Use POST to commit' }, 405)
    }
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return json({ error: 'Body is not valid JSON' }, 400)
    }
    const parsed = serverCommitBodySchema(body)
    if (!parsed.ok) {
      return json({ error: parsed.message }, 400)
    }
    this.tripId = parsed.value.tripId ?? this.tripId

    const result = await this.commit(parsed.value.patches, {
      userId: parsed.value.authorId,
      connectionId: 'server',
    })
    this.broadcast({ t: 'commit', version: result.version, entries: result.entries })
    return json({ version: result.version, entries: result.entries })
  }

  /**
   * Evicts sockets so the next connect goes back through the app Worker, which re-reads the stored
   * trip role. An empty body closes the whole room; `{ userId }` closes that one person's sockets
   * (every tab and device, found by the identity tag) and tells the people who stay.
   *
   * The close also records a revocation watermark (the `revokedAt` the app Worker stamped, see
   * {@link isRevoked}) so a connect that was already in flight, and reaches the room after this
   * found no socket, is refused. A close without a valid `revokedAt` still evicts and records nothing.
   */
  private async handleClose(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json({ error: 'Use POST to close a room' }, 405)
    }
    const text = await request.text()
    const revokedAt = revokedAtOf(request.headers.get(TRIP_ROOM_REVOKED_AT_HEADER), this.now())
    if (text.length === 0) {
      await this.recordRevocation(ROOM_REVOCATION_KEY, revokedAt)
      this.evict(this.state.getWebSockets())
      return json({ closed: true })
    }
    const userId = closeTargetOf(text)
    if (userId === null) {
      return json({ error: '`userId` must be a non-empty string' }, 400)
    }
    await this.recordRevocation(personRevocationKey(userId), revokedAt)
    this.evict(this.state.getWebSockets(userId))
    return json({ closed: true })
  }

  /**
   * A connect is stale when it was minted before the latest close that applies to it: the later of
   * the room's watermark and the person's. Stamps come from the app Worker; the room clock bounds
   * their lifetime and allowed skew. A connect with no `issuedAt` (an older app Worker) is stale
   * only where an unexpired watermark exists; {@link alarm} prunes expired storage.
   */
  private async isRevoked(identity: TripRoomIdentity): Promise<boolean> {
    const [room, person] = await Promise.all([
      this.state.storage.get<number>(ROOM_REVOCATION_KEY),
      this.state.storage.get<number>(personRevocationKey(identity.user.id)),
    ])
    const marks = [room, person].filter((mark): mark is number => this.validWatermark(mark))
    if (marks.length === 0) return false
    const watermark = Math.max(...marks)
    return identity.issuedAt === undefined || identity.issuedAt < watermark + TRIP_ROOM_REVOCATION_SKEW_MS
  }

  /** Moves a watermark forward only, and keeps the alarm running so it is pruned. Never throws. */
  private async recordRevocation(key: string, revokedAt: number | null): Promise<void> {
    if (revokedAt === null) {
      this.logger.warn('trip room close without a valid revokedAt: evicted, no watermark recorded', {
        tripId: this.tripId,
      })
      return
    }
    try {
      await this.withLock(async () => {
        const existing = await this.state.storage.get<number>(key)
        await this.state.storage.put({
          [key]: this.validWatermark(existing) ? Math.max(existing, revokedAt) : revokedAt,
        })
      })
      await this.ensureAlarm()
    } catch (error) {
      this.logger.error('trip room revocation watermark not recorded', error, { tripId: this.tripId })
    }
  }

  /**
   * Closes every socket and erases entity fields, person watermarks and the commit log,
   * each stamped with the id of whoever wrote it (`by`). D1 is the record, so nothing is lost that
   * a rebuild cannot restore; an active room never clears itself, which is why waiting for the idle
   * erase in {@link alarm} is not an answer to a deletion. Queued behind in-flight commits, so none
   * of them writes into the room after it was emptied. Only the latest unexpired timestamp survives,
   * promoted to a room-wide barrier so erasure retains no person identifiers.
   */
  private async handleReset(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json({ error: 'Use POST to reset a room' }, 405)
    }
    this.evict(this.state.getWebSockets())
    const revokedAt = revokedAtOf(request.headers.get(TRIP_ROOM_REVOKED_AT_HEADER), this.now())
    await this.withLock(async () => {
      const marks = await this.state.storage.list<number>({ prefix: REVOCATION_PREFIX })
      const retained = [...marks.values()].filter((mark) => this.validWatermark(mark))
      if (revokedAt !== null) retained.push(revokedAt)
      // Persist before erasing: a failed write must not discard a newer barrier, even on retry.
      if (retained.length > 0) {
        await this.state.storage.put({ [ROOM_REVOCATION_KEY]: Math.max(...retained) })
        await this.ensureAlarm()
      }
      const keys = await this.state.storage.list()
      const erased = [...keys.keys()].filter((key) => retained.length === 0 || key !== ROOM_REVOCATION_KEY)
      await this.deleteKeys(erased)
      this.meta = null
      this.erased = true
      if (retained.length === 0) await this.state.storage.deleteAlarm()
    })
    return json({ reset: true })
  }

  private evict(sockets: ReadonlyArray<TripRoomSocket>): void {
    const departed: Array<string> = []
    for (const socket of sockets) {
      const session = readAttachment(socket)
      if (session) {
        socket.serializeAttachment({ ...session, joined: false, evicted: true } satisfies SessionAttachment)
        if (session.joined) departed.push(session.connectionId)
      }
      try {
        socket.close(CLOSE_ROOM_CLOSED, TRIP_ROOM_CLOSED_REASON)
      } catch {
        // A socket already gone is exactly the state we wanted.
      }
    }
    for (const connectionId of departed) {
      this.broadcast({ t: 'presence', peers: this.presence(), left: connectionId })
    }
  }

  /* ------------------------------------------------- websocket lifecycle -- */

  async webSocketMessage(ws: TripRoomSocket, message: string | ArrayBuffer): Promise<void> {
    const session = readAttachment(ws)
    if (!session) {
      this.send(ws, { t: 'error', code: 'not-joined', message: 'Socket has no session' })
      ws.close(CLOSE_ROOM_CLOSED, 'No session')
      return
    }
    if (session.evicted) {
      this.evict([ws])
      return
    }
    this.tripId = session.identity.tripId

    const now = this.now()
    if (!this.allowFrame(ws, session, now)) return

    const parsed = parseClientMessage(message)
    if (!parsed.ok) {
      this.send(ws, { t: 'error', code: parsed.code, message: parsed.message })
      return
    }

    switch (parsed.value.t) {
      case 'ping':
        this.send(ws, { t: 'pong' })
        return

      case 'hello': {
        if (parsed.value.protocol !== TRIP_ROOM_PROTOCOL_VERSION) {
          this.send(ws, {
            t: 'error',
            code: 'protocol-mismatch',
            message: `Room speaks protocol ${TRIP_ROOM_PROTOCOL_VERSION}`,
          })
          ws.close(CLOSE_ROOM_CLOSED, 'Protocol mismatch')
          return
        }
        await this.handleHello(ws, session, parsed.value.sinceVersion)
        return
      }

      case 'focus': {
        const next: SessionAttachment = { ...session, focus: parsed.value.focus, lastSeenAt: now }
        ws.serializeAttachment(next)
        this.broadcast({ t: 'presence', peers: this.presence() }, session.connectionId)
        return
      }

      case 'patch': {
        if (!session.joined) {
          this.send(ws, {
            t: 'error',
            code: 'not-joined',
            message: 'Send `hello` before patching',
            requestId: parsed.value.requestId,
          })
          return
        }
        if (session.identity.role !== 'editor') {
          this.send(ws, {
            t: 'error',
            code: 'read-only',
            message: 'This connection is read-only',
            requestId: parsed.value.requestId,
          })
          return
        }
        await this.applyClientPatch(ws, session, parsed.value.requestId, parsed.value.patches)
        return
      }
    }
  }

  async webSocketClose(
    ws: TripRoomSocket,
    code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    const session = readAttachment(ws)
    if (session) {
      this.logger.debug('trip room socket closed', {
        tripId: session.identity.tripId,
        connectionId: session.connectionId,
        userId: session.identity.user.id,
        code,
      })
    }
    try {
      ws.close(code >= 1000 && code < 5000 ? code : 1000, 'Closing')
    } catch {
      // Already closed by the peer.
    }
    if (session?.joined) {
      ws.serializeAttachment({ ...session, joined: false } satisfies SessionAttachment)
      this.broadcast(
        { t: 'presence', peers: this.presence(ws), left: session.connectionId },
        session.connectionId,
      )
    }
    if (!this.erased) await this.ensureAlarm()
  }

  async webSocketError(ws: TripRoomSocket, error: unknown): Promise<void> {
    const session = readAttachment(ws)
    this.logger.warn('trip room socket error', {
      tripId: session?.identity.tripId ?? this.tripId,
      connectionId: session?.connectionId,
      errorMessage: error instanceof Error ? error.message : String(error),
    })
    if (session?.joined) {
      ws.serializeAttachment({ ...session, joined: false } satisfies SessionAttachment)
      this.broadcast(
        { t: 'presence', peers: this.presence(ws), left: session.connectionId },
        session.connectionId,
      )
    }
  }

  /* ---------------------------------------------------------- housekeeping -- */

  /**
   * Periodic maintenance: trim the commit log to its capacity, drop expired
   * tombstones, evict over-age sockets, and erase a room nobody has touched for a week.
   * Reschedules itself only while there is something left to look after.
   */
  async alarm(): Promise<void> {
    return this.withLock(async () => {
      const meta = await this.loadMeta()
      const now = this.now()
      this.evict(
        this.state.getWebSockets().filter((socket) => {
          const session = readAttachment(socket)
          return (
            session !== null &&
            ((session.evicted && now - session.joinedAt >= TRIP_ROOM_REFUSAL_CLOSE_DELAY_MS) ||
              now - session.joinedAt > TRIP_ROOM_MAX_SOCKET_AGE_MS)
          )
        }),
      )
      const sockets = this.state.getWebSockets().length

      const removed = await this.pruneLog(meta)
      const tombstones = await this.pruneTombstones(now)
      const watermarks = await this.pruneWatermarks(now)

      const idle = sockets === 0 && meta.updatedAt > 0 && now - meta.updatedAt > TRIP_ROOM_IDLE_TTL_MS
      if (idle) {
        const keys = await this.state.storage.list()
        const content = [...keys.keys()].filter((key) => !key.startsWith(REVOCATION_PREFIX))
        await this.deleteKeys(content)
        this.meta = null
        if (watermarks.left > 0) await this.ensureAlarm()
        this.logger.info('trip room state erased after idle ttl', {
          tripId: this.tripId,
          idleMs: now - meta.updatedAt,
        })
        return
      }

      if (removed > 0 || tombstones > 0 || watermarks.pruned > 0) {
        this.logger.debug('trip room housekeeping', {
          tripId: this.tripId,
          prunedCommits: removed,
          prunedTombstones: tombstones,
          prunedWatermarks: watermarks.pruned,
          sockets,
        })
      }

      if (sockets > 0 || meta.version > 0 || watermarks.left > 0) {
        await this.ensureAlarm()
      }
    })
  }

  private async pruneLog(meta: RoomMeta): Promise<number> {
    const keepFrom = meta.version - TRIP_ROOM_LOG_CAPACITY + 1
    if (keepFrom <= meta.logStart) return 0
    const stale = await this.state.storage.list<CommitEntry>({
      prefix: LOG_PREFIX,
      end: logKey(keepFrom),
    })
    if (stale.size === 0) {
      await this.writeMeta({ ...meta, logStart: keepFrom })
      return 0
    }
    const removed = await this.state.storage.delete([...stale.keys()])
    await this.writeMeta({ ...meta, logStart: keepFrom })
    return removed
  }

  private async pruneTombstones(now: number): Promise<number> {
    const entities = await this.state.storage.list<StoredEntity>({ prefix: ENTITY_PREFIX })
    const expired: Array<string> = []
    for (const [key, entity] of entities) {
      if (entity.deleted && entity.deletedAt !== null && now - entity.deletedAt > TRIP_ROOM_TOMBSTONE_TTL_MS) {
        expired.push(key)
      }
    }
    if (expired.length === 0) return 0
    return this.state.storage.delete(expired)
  }

  private async pruneWatermarks(now: number): Promise<{ pruned: number; left: number }> {
    const marks = await this.state.storage.list<number>({ prefix: REVOCATION_PREFIX })
    const expired = [...marks].filter(([, mark]) => !this.validWatermark(mark, now))
    await this.deleteKeys(expired.map(([key]) => key))
    return { pruned: expired.length, left: marks.size - expired.length }
  }

  /** Durable Object KV deletes accept at most 128 keys per call. */
  private async deleteKeys(keys: Array<string>): Promise<void> {
    for (let offset = 0; offset < keys.length; offset += 128) {
      await this.state.storage.delete(keys.slice(offset, offset + 128))
    }
  }

  private validWatermark(mark: unknown, now = this.now()): mark is number {
    return typeof mark === 'number' && Number.isSafeInteger(mark) && mark >= 0 &&
      mark <= now + TRIP_ROOM_REVOCATION_SKEW_MS && now - mark <= TRIP_ROOM_REVOCATION_TTL_MS
  }

  private async ensureAlarm(): Promise<void> {
    const existing = await this.state.storage.getAlarm()
    if (existing === null) {
      await this.state.storage.setAlarm(this.now() + TRIP_ROOM_ALARM_INTERVAL_MS)
    }
  }

  /* ---------------------------------------------------------- handshaking -- */

  private async handleHello(
    ws: TripRoomSocket,
    session: SessionAttachment,
    sinceVersion: number | undefined,
  ): Promise<void> {
    const now = this.now()
    const next: SessionAttachment = { ...session, joined: true, lastSeenAt: now }
    ws.serializeAttachment(next)

    const meta = await this.loadMeta()
    const you = toMember(next)
    const welcome: ServerMessage = {
      t: 'welcome',
      protocol: TRIP_ROOM_PROTOCOL_VERSION,
      connectionId: next.connectionId,
      tripId: next.identity.tripId,
      version: meta.version,
      you,
      peers: this.presence().filter((peer) => peer.connectionId !== next.connectionId),
    }

    if (sinceVersion !== undefined && sinceVersion < meta.version) {
      if (sinceVersion + 1 >= meta.logStart) {
        welcome.commits = await this.readCommitsSince(sinceVersion)
      } else {
        const snapshot = await this.readSnapshot(TRIP_ROOM_MAX_SNAPSHOT_ENTITIES)
        welcome.snapshot = {
          version: meta.version,
          entities: snapshot.entities,
          truncated: snapshot.truncated,
        }
      }
    }

    this.send(ws, welcome)
    this.broadcast({ t: 'presence', peers: this.presence(), joined: next.connectionId }, next.connectionId)
    await this.ensureAlarm()
  }

  private async applyClientPatch(
    ws: TripRoomSocket,
    session: SessionAttachment,
    requestId: string,
    patches: Array<TripPatch>,
  ): Promise<void> {
    try {
      const result = await this.commit(patches, {
        userId: session.identity.user.id,
        connectionId: session.connectionId,
      })
      this.send(ws, {
        t: 'ack',
        requestId,
        version: result.version,
        applied: result.entries.map((entry) => ({
          entity: entry.entity,
          fields: Object.keys(entry.fields),
        })),
        overwrote: result.overwrote,
      })
      this.broadcast(
        { t: 'commit', version: result.version, entries: result.entries },
        session.connectionId,
      )
    } catch (error) {
      this.logger.error('trip room commit failed', error, {
        tripId: session.identity.tripId,
        orgId: session.identity.orgId,
        connectionId: session.connectionId,
        requestId,
      })
      this.send(ws, {
        t: 'error',
        code: 'internal',
        message: 'The room could not apply that change',
        requestId,
      })
    }
  }

  /* -------------------------------------------------------------- commits -- */

  /**
   * Applies patches with per-field last-write-wins semantics and returns the
   * commit entries to fan out. Runs under the room's mutex, so the
   * read-modify-write of each entity is atomic with respect to other frames.
   */
  private commit(
    patches: Array<TripPatch>,
    author: { userId: string; connectionId: string },
  ): Promise<{ version: number; entries: Array<CommitEntry>; overwrote: Array<OverwriteNotice> }> {
    return this.withLock(async () => {
      const meta = await this.loadMeta()
      const now = this.now()
      let version = meta.version
      const entries: Array<CommitEntry> = []
      const overwrote: Array<OverwriteNotice> = []
      const writes: Record<string, StoredEntity | CommitEntry | RoomMeta> = {}
      const touched = new Map<string, StoredEntity>()

      for (const patch of patches) {
        const key = entityStorageKey(patch.entity)
        const stored =
          touched.get(key) ??
          (await this.state.storage.get<StoredEntity>(key)) ??
          emptyEntity(patch.entity)
        version += 1

        if (patch.op === 'delete') {
          const next: StoredEntity = {
            entity: patch.entity,
            deleted: true,
            deletedAt: now,
            version,
            updatedAt: now,
            fields: {},
          }
          touched.set(key, next)
          writes[key] = next
          const entry: CommitEntry = {
            version,
            entity: patch.entity,
            op: 'delete',
            fields: {},
            at: now,
            by: author.userId,
            byConnection: author.connectionId,
          }
          entries.push(entry)
          writes[logKey(version)] = entry
          continue
        }

        const fields: Record<string, CommitField> = { ...stored.fields }
        const committed: Record<string, CommitField> = {}
        for (const [field, value] of Object.entries(patch.fields)) {
          // A field absent from the stored entity has no prior writer to race.
          const existing = Object.hasOwn(fields, field) ? fields[field] : undefined
          if (
            existing !== undefined &&
            existing.by !== author.userId &&
            patch.baseVersion !== undefined &&
            existing.version > patch.baseVersion
          ) {
            overwrote.push({
              entity: patch.entity,
              field,
              previousBy: existing.by,
              previousVersion: existing.version,
            })
          }
          const next: CommitField = { value, version, at: now, by: author.userId }
          fields[field] = next
          committed[field] = next
        }

        const revived = stored.deleted
        const nextEntity: StoredEntity = {
          entity: patch.entity,
          deleted: false,
          deletedAt: null,
          version,
          updatedAt: now,
          fields,
        }
        touched.set(key, nextEntity)
        writes[key] = nextEntity

        const entry: CommitEntry = {
          version,
          entity: patch.entity,
          op: 'upsert',
          fields: committed,
          at: now,
          by: author.userId,
          byConnection: author.connectionId,
          ...(revived ? { revived: true } : {}),
        }
        entries.push(entry)
        writes[logKey(version)] = entry
      }

      const nextMeta: RoomMeta = {
        version,
        logStart: meta.version === 0 ? 1 : meta.logStart,
        updatedAt: now,
      }
      writes[META_KEY] = nextMeta

      // One `put` of the whole commit: entities, log entries and meta land
      // together, so a room can never advance its version without its log.
      await this.state.storage.put(writes)
      this.meta = nextMeta

      return { version, entries, overwrote }
    })
  }

  private async readCommitsSince(sinceVersion: number): Promise<Array<CommitEntry>> {
    const entries = await this.state.storage.list<CommitEntry>({
      prefix: LOG_PREFIX,
      start: logKey(sinceVersion + 1),
      limit: TRIP_ROOM_LOG_CAPACITY,
    })
    return [...entries.values()]
  }

  private async readSnapshot(
    limit: number,
  ): Promise<{ entities: Array<EntitySnapshot>; truncated: boolean }> {
    const stored = await this.state.storage.list<StoredEntity>({
      prefix: ENTITY_PREFIX,
      limit: limit + 1,
    })
    const entities: Array<EntitySnapshot> = []
    let truncated = false
    for (const entity of stored.values()) {
      if (entities.length >= limit) {
        truncated = true
        break
      }
      entities.push({
        entity: entity.entity,
        deleted: entity.deleted,
        version: entity.version,
        updatedAt: entity.updatedAt,
        fields: entity.fields,
      })
    }
    return { entities, truncated }
  }

  /* ------------------------------------------------------------- presence -- */

  /** Current members, optionally excluding a socket that is going away. */
  private presence(exclude?: TripRoomSocket): Array<PresenceMember> {
    const members: Array<PresenceMember> = []
    for (const socket of this.state.getWebSockets()) {
      if (socket === exclude) continue
      const session = readAttachment(socket)
      if (!session || !session.joined) continue
      members.push(toMember(session))
    }
    return members.sort((a, b) => a.joinedAt - b.joinedAt)
  }

  private allowFrame(ws: TripRoomSocket, session: SessionAttachment, now: number): boolean {
    const window =
      now - session.rate.windowStart >= TRIP_ROOM_RATE_LIMIT.windowMs
        ? { windowStart: now, count: 1 }
        : { windowStart: session.rate.windowStart, count: session.rate.count + 1 }

    if (window.count > TRIP_ROOM_RATE_LIMIT.maxMessages) {
      this.logger.warn('trip room rate limit tripped', {
        tripId: session.identity.tripId,
        orgId: session.identity.orgId,
        userId: session.identity.user.id,
        connectionId: session.connectionId,
        frames: window.count,
      })
      this.send(ws, { t: 'error', code: 'rate-limited', message: 'Slow down' })
      ws.close(CLOSE_RATE_LIMITED, 'Rate limited')
      return false
    }

    const shouldTouch = now - session.lastSeenAt > PRESENCE_TOUCH_INTERVAL_MS
    ws.serializeAttachment({
      ...session,
      rate: window,
      lastSeenAt: shouldTouch ? now : session.lastSeenAt,
    } satisfies SessionAttachment)
    return true
  }

  /* -------------------------------------------------------------- plumbing -- */

  private send(ws: TripRoomSocket, message: ServerMessage): void {
    try {
      ws.send(encodeServerMessage(message))
    } catch (error) {
      this.logger.debug('trip room send failed', {
        tripId: this.tripId,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    }
  }

  private broadcast(message: ServerMessage, exceptConnectionId?: string): void {
    const frame = encodeServerMessage(message)
    for (const socket of this.state.getWebSockets()) {
      const session = readAttachment(socket)
      if (!session || !session.joined) continue
      if (exceptConnectionId !== undefined && session.connectionId === exceptConnectionId) continue
      try {
        socket.send(frame)
      } catch {
        // Dropped sockets are cleaned up by `webSocketClose`.
      }
    }
  }

  private async loadMeta(): Promise<RoomMeta> {
    if (this.meta) return this.meta
    const stored = await this.state.storage.get<RoomMeta>(META_KEY)
    this.meta = stored ?? { ...emptyMeta }
    return this.meta
  }

  private async writeMeta(meta: RoomMeta): Promise<void> {
    this.meta = meta
    await this.state.storage.put({ [META_KEY]: meta })
  }

  private withLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.tail.then(fn, fn)
    this.tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}

/* ---------------------------------------------------------------- helpers -- */

function emptyEntity(entity: EntityRef): StoredEntity {
  return { entity, deleted: false, deletedAt: null, version: 0, updatedAt: 0, fields: {} }
}

function toMember(session: SessionAttachment): PresenceMember {
  return {
    connectionId: session.connectionId,
    user: session.identity.user,
    joinedAt: session.joinedAt,
    lastSeenAt: session.lastSeenAt,
    focus: session.focus,
  }
}

function readAttachment(ws: TripRoomSocket): SessionAttachment | null {
  const raw = ws.deserializeAttachment()
  if (typeof raw !== 'object' || raw === null) return null
  const candidate = raw as Partial<SessionAttachment>
  if (typeof candidate.connectionId !== 'string' || !candidate.identity) return null
  return {
    connectionId: candidate.connectionId,
    identity: candidate.identity,
    joinedAt: candidate.joinedAt ?? 0,
    lastSeenAt: candidate.lastSeenAt ?? 0,
    focus: candidate.focus ?? null,
    joined: candidate.joined ?? false,
    evicted: candidate.evicted ?? false,
    rate: candidate.rate ?? { windowStart: 0, count: 0 },
  }
}

function clampLimit(raw: string | null): number {
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return TRIP_ROOM_MAX_SNAPSHOT_ENTITIES
  return Math.min(parsed, TRIP_ROOM_MAX_SNAPSHOT_ENTITIES)
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/** Accept app Worker timestamps at most one skew margin ahead of the room's clock. */
function revokedAtOf(raw: string | null, now: number): number | null {
  if (raw === null || !/^\d{1,15}$/.test(raw)) return null
  const stamp = Number(raw)
  return stamp <= now + TRIP_ROOM_REVOCATION_SKEW_MS ? stamp : null
}

/** The person a `close` request names, or `null` when the body does not name one. */
function closeTargetOf(text: string): string | null {
  try {
    const body: unknown = JSON.parse(text)
    if (typeof body !== 'object' || body === null) return null
    const { userId } = body as { userId?: unknown }
    return typeof userId === 'string' && userId.length > 0 ? userId : null
  } catch {
    return null
  }
}

interface ServerCommitBody {
  tripId?: string
  authorId: string
  patches: Array<TripPatch>
}

/**
 * Validates a server-side commit (a queue job or a server function pushing a
 * change that originated outside a socket).
 */
function serverCommitBodySchema(
  body: unknown,
): { ok: true; value: ServerCommitBody } | { ok: false; message: string } {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, message: 'Body must be an object' }
  }
  const candidate = body as { tripId?: unknown; authorId?: unknown; patches?: unknown }
  if (typeof candidate.authorId !== 'string' || candidate.authorId.length === 0) {
    return { ok: false, message: '`authorId` is required' }
  }
  if (!Array.isArray(candidate.patches) || candidate.patches.length === 0) {
    return { ok: false, message: '`patches` must be a non-empty array' }
  }
  const patches: Array<TripPatch> = []
  for (const raw of candidate.patches) {
    const parsed = tripPatchSchema.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid patch' }
    }
    patches.push(parsed.data)
  }
  return {
    ok: true,
    value: {
      tripId: typeof candidate.tripId === 'string' ? candidate.tripId : undefined,
      authorId: candidate.authorId,
      patches,
    },
  }
}

export type { TripRoomErrorCode }
