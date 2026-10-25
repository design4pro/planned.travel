/**
 * The trip room's write gate: who may patch, and what a refused patch leaves behind.
 *
 * The room trusts the identity the app Worker asserts (`src/routes/api/trip-room/-lib/connect.ts`
 * decides the role); what it owns is acting on that role. A `viewer` connection is read-only, and
 * "read-only" has to mean no storage write, no version move and no frame to anyone else, not only
 * an error to the sender. The room is driven through its own `TripRoomState` / `TripRoomSocket`
 * ports, with no Worker and no `WebSocketPair`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createLogger, createMemorySink } from '../../observability/logger'
import { TripRoom } from '../trip-room'
import {
  TRIP_ROOM_CLOSED_REASON,
  TRIP_ROOM_ALARM_INTERVAL_MS,
  TRIP_ROOM_IDENTITY_HEADER,
  TRIP_ROOM_MAX_SOCKET_AGE_MS,
  TRIP_ROOM_PROTOCOL_VERSION,
  TRIP_ROOM_REVOCATION_SKEW_MS,
  TRIP_ROOM_REVOCATION_TTL_MS,
  TRIP_ROOM_REVOKED_AT_HEADER,
} from '../protocol'

import type {
  TripRoomSocket,
  TripRoomState,
  TripRoomStorage,
} from '../trip-room'
import type { TripRoomIdentity } from '../protocol'

const TRIP_ID = 'trip-1'

/** In-memory `TripRoomStorage` that also counts what was written, so "wrote nothing" is checkable. */
function fakeStorage(): TripRoomStorage & {
  writes: number
  alarmDeleted: number
  alarmSet: number
  alarmAt: number | null
  data: Map<string, unknown>
} {
  const data = new Map<string, unknown>()
  const storage = {
    writes: 0,
    alarmDeleted: 0,
    alarmSet: 0,
    alarmAt: null as number | null,
    data,
    get: async <T>(key: string) => data.get(key) as T | undefined,
    put: async <T>(entries: Record<string, T>) => {
      storage.writes += 1
      for (const [key, value] of Object.entries(entries)) data.set(key, value)
    },
    list: async <T>(options: { prefix?: string } = {}) => {
      const out = new Map<string, T>()
      for (const [key, value] of [...data.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        if (options.prefix === undefined || key.startsWith(options.prefix)) {
          out.set(key, value as T)
        }
      }
      return out
    },
    delete: async (keys: Array<string>) => {
      storage.writes += 1
      return keys.filter((key) => data.delete(key)).length
    },
    deleteAll: async () => {
      storage.writes += 1
      data.clear()
    },
    getAlarm: async () => null,
    setAlarm: async (scheduledTime: number) => {
      storage.alarmAt = scheduledTime
      storage.alarmSet += 1
    },
    deleteAlarm: async () => {
      storage.alarmDeleted += 1
    },
  }
  return storage
}

interface FakeSocket extends TripRoomSocket {
  sent: Array<{ t: string; [key: string]: unknown }>
  /** The code of the `close` the room asked for, or `null` while the socket is open. */
  closedWith: number | null
  closedReason: string | null
}

function fakeSocket(
  identity: TripRoomIdentity,
  connectionId: string,
): FakeSocket {
  let attachment: unknown = {
    connectionId,
    identity,
    joinedAt: 0,
    lastSeenAt: 0,
    focus: null,
    joined: false,
    rate: { windowStart: 0, count: 0 },
  }
  const socket: FakeSocket = {
    sent: [],
    closedWith: null,
    closedReason: null,
    send: (message) => {
      socket.sent.push(JSON.parse(message) as { t: string })
    },
    close: (code, reason) => {
      socket.closedWith = code ?? 1005
      socket.closedReason = reason ?? null
    },
    serializeAttachment: (value) => {
      attachment = value
    },
    deserializeAttachment: () => attachment,
  }
  return socket
}

function identityWith(
  role: 'editor' | 'viewer',
  userId: string,
): TripRoomIdentity {
  return {
    tripId: TRIP_ID,
    orgId: 'org-1',
    role,
    user: { id: userId, name: userId, initials: 'U', hue: 10, avatarUrl: null },
  }
}

const HELLO = JSON.stringify({
  t: 'hello',
  protocol: TRIP_ROOM_PROTOCOL_VERSION,
})
const PATCH = JSON.stringify({
  t: 'patch',
  requestId: 'req-1',
  patches: [
    {
      entity: { kind: 'stop', id: 'stop-1' },
      op: 'upsert',
      fields: { title: 'Alfama' },
    },
  ],
})

/**
 * A room with one connected, joined socket per entry, in order.
 *
 * `getWebSockets` honours the tag the way the runtime does — the room tags each socket with its
 * person's id — and keeps a closed socket in the list, because the runtime does too until the close
 * handshake finishes: the room must not count on a closed socket having left.
 */
async function joinedRoomOf(
  people: Array<{ role: 'editor' | 'viewer'; userId: string }>,
) {
  const storage = fakeStorage()
  const sockets = people.map(({ role, userId }, index) =>
    fakeSocket(identityWith(role, userId), `conn-${index}`),
  )
  const state: TripRoomState = {
    storage,
    acceptWebSocket: () => undefined,
    getWebSockets: (tag) =>
      tag === undefined
        ? sockets
        : sockets.filter(
            (socket) =>
              (socket.deserializeAttachment() as { identity: TripRoomIdentity })
                .identity.user.id === tag,
          ),
  }
  const room = new TripRoom(state, {})
  for (const socket of sockets) {
    await room.webSocketMessage(socket, HELLO)
  }
  for (const socket of sockets) socket.sent.length = 0
  storage.writes = 0
  return { room, storage, sockets }
}

/** A room with one connected, joined socket per entry of `roles`, in order, each a different person. */
function joinedRoom(roles: Array<'editor' | 'viewer'>) {
  return joinedRoomOf(
    roles.map((role, index) => ({ role, userId: `user-${index}` })),
  )
}

describe('the trip room write gate', () => {
  it('keeps not-joined for a patch sent before hello, whatever the role', async () => {
    const storage = fakeStorage()
    const state: TripRoomState = {
      storage,
      acceptWebSocket: () => undefined,
      getWebSockets: () => [],
    }
    const room = new TripRoom(state, {})

    for (const role of ['editor', 'viewer'] as const) {
      const socket = fakeSocket(identityWith(role, 'ana'), `early-${role}`)
      await room.webSocketMessage(socket, PATCH)
      expect(socket.sent).toEqual([
        expect.objectContaining({ t: 'error', code: 'not-joined', requestId: 'req-1' }),
      ])
    }
    expect(storage.writes).toBe(0)
  })

  it('refuses a viewer socket’s patch without writing, moving the version or telling anyone else', async () => {
    const { room, storage, sockets } = await joinedRoom(['viewer', 'editor'])
    const [viewer, editor] = sockets

    await room.webSocketMessage(viewer, PATCH)

    expect(viewer.sent).toEqual([
      expect.objectContaining({
        t: 'error',
        code: 'read-only',
        message: 'This connection is read-only',
        requestId: 'req-1',
      }),
    ])
    expect(storage.writes).toBe(0)
    expect(storage.data.size).toBe(0)
    expect(editor.sent).toEqual([])

    const snapshot = await room.fetch(new Request('https://room/snapshot'))
    await expect(snapshot.json()).resolves.toMatchObject({
      version: 0,
      entities: [],
    })
  })

  it('commits an editor socket’s patch and sends it to the other sockets', async () => {
    const { room, storage, sockets } = await joinedRoom(['editor', 'viewer'])
    const [editor, viewer] = sockets

    await room.webSocketMessage(editor, PATCH)

    expect(editor.sent).toEqual([
      expect.objectContaining({ t: 'ack', requestId: 'req-1', version: 1 }),
    ])
    expect(viewer.sent).toEqual([
      expect.objectContaining({
        t: 'commit',
        version: 1,
        entries: [
          expect.objectContaining({ entity: { kind: 'stop', id: 'stop-1' } }),
        ],
      }),
    ])
    expect(storage.writes).toBeGreaterThan(0)
  })
})

const CLOSE_ROOM_CLOSED = 1012

function closeRequest(body?: unknown): Request {
  return new Request('https://room/close', {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function commitRequest(): Request {
  return new Request('https://room/commit', {
    method: 'POST',
    body: JSON.stringify({
      tripId: TRIP_ID,
      authorId: 'user-0',
      patches: [
        {
          entity: { kind: 'stop', id: 'stop-9' },
          op: 'upsert',
          fields: { title: 'Prater' },
        },
      ],
    }),
  })
}

describe('closing one person’s sockets', () => {
  it('closes every socket of that person and no one else’s', async () => {
    const { room, sockets } = await joinedRoomOf([
      { role: 'editor', userId: 'ana' },
      { role: 'editor', userId: 'ana' },
      { role: 'editor', userId: 'ben' },
    ])
    const [phone, laptop, ben] = sockets

    const response = await room.fetch(closeRequest({ userId: 'ana' }))

    expect(response.status).toBe(200)
    expect(phone.closedWith).toBe(CLOSE_ROOM_CLOSED)
    expect(laptop.closedWith).toBe(CLOSE_ROOM_CLOSED)
    // The client re-reads its loader on exactly this reason (use-trip-room.ts).
    expect(phone.closedReason).toBe(TRIP_ROOM_CLOSED_REASON)
    expect(ben.closedWith).toBeNull()
  })

  it('tells the people who stay that the person left, without listing them', async () => {
    const { room, sockets } = await joinedRoomOf([
      { role: 'editor', userId: 'ana' },
      { role: 'editor', userId: 'ben' },
    ])
    const [, ben] = sockets

    await room.fetch(closeRequest({ userId: 'ana' }))

    const presence = ben.sent.filter((frame) => frame.t === 'presence')
    expect(presence).toEqual([
      expect.objectContaining({ t: 'presence', left: 'conn-0' }),
    ])
    expect(
      (presence[0].peers as Array<{ connectionId: string }>).map(
        (peer) => peer.connectionId,
      ),
    ).toEqual(['conn-1'])
  })

  it('answers a closed socket’s next patch with nothing: no write, no version, no frame to a peer', async () => {
    const { room, storage, sockets } = await joinedRoomOf([
      { role: 'editor', userId: 'ana' },
      { role: 'editor', userId: 'ben' },
    ])
    const [ana, ben] = sockets
    await room.fetch(closeRequest({ userId: 'ana' }))
    ana.sent.length = 0
    ben.sent.length = 0
    storage.writes = 0

    await room.webSocketMessage(ana, PATCH)
    await room.webSocketMessage(ana, HELLO)

    expect(ana.sent).toEqual([])
    expect(ben.sent).toEqual([])
    expect(storage.writes).toBe(0)
    const snapshot = await room.fetch(new Request('https://room/snapshot'))
    await expect(snapshot.json()).resolves.toMatchObject({ version: 0 })
  })

  it('sends a closed person no further commit or presence frame', async () => {
    const { room, sockets } = await joinedRoomOf([
      { role: 'editor', userId: 'ana' },
      { role: 'editor', userId: 'ben' },
    ])
    const [ana, ben] = sockets
    await room.fetch(closeRequest({ userId: 'ana' }))
    ana.sent.length = 0
    ben.sent.length = 0

    await room.fetch(commitRequest())
    await room.webSocketMessage(
      ben,
      JSON.stringify({
        t: 'focus',
        focus: { entity: { kind: 'stop', id: 'stop-1' }, field: null },
      }),
    )

    expect(ana.sent).toEqual([])
    expect(ben.sent.map((frame) => frame.t)).toEqual(['commit'])
  })

  it('leaves the room alone when the person has no socket in it', async () => {
    const { room, sockets } = await joinedRoomOf([
      { role: 'editor', userId: 'ben' },
    ])

    const response = await room.fetch(closeRequest({ userId: 'nobody' }))

    expect(response.status).toBe(200)
    expect(sockets[0].closedWith).toBeNull()
    expect(sockets[0].sent).toEqual([])
  })

  it('refuses a body that names no person rather than closing the whole room', async () => {
    const { room, sockets } = await joinedRoomOf([
      { role: 'editor', userId: 'ben' },
    ])

    const response = await room.fetch(closeRequest({ userId: '' }))

    expect(response.status).toBe(400)
    expect(sockets[0].closedWith).toBeNull()
  })
})

describe('closing the whole room', () => {
  it('closes every socket and answers a later frame from any of them with nothing', async () => {
    const { room, storage, sockets } = await joinedRoomOf([
      { role: 'editor', userId: 'ana' },
      { role: 'viewer', userId: 'ben' },
    ])
    const [ana, ben] = sockets

    const response = await room.fetch(closeRequest())

    expect(response.status).toBe(200)
    expect(ana.closedWith).toBe(CLOSE_ROOM_CLOSED)
    expect(ben.closedWith).toBe(CLOSE_ROOM_CLOSED)
    expect(ana.closedReason).toBe(TRIP_ROOM_CLOSED_REASON)

    ana.sent.length = 0
    ben.sent.length = 0
    storage.writes = 0
    await room.webSocketMessage(ana, PATCH)
    await room.fetch(commitRequest())
    expect(ana.sent).toEqual([])
    expect(ben.sent).toEqual([])
    // Only the sockets are gone: a server commit is still taken, for the next person to connect.
    expect(storage.writes).toBeGreaterThan(0)
  })
})

function resetRequest(method = 'POST'): Request {
  return new Request('https://room/reset', { method })
}

describe('resetting the room', () => {
  it('closes every socket and erases the stored state, entity fields and commit log alike', async () => {
    const { room, storage, sockets } = await joinedRoomOf([
      { role: 'editor', userId: 'ana' },
      { role: 'viewer', userId: 'ben' },
    ])
    await room.fetch(commitRequest())
    expect(storage.data.size).toBeGreaterThan(0)

    const response = await room.fetch(resetRequest())

    expect(response.status).toBe(200)
    for (const socket of sockets) {
      expect(socket.closedWith).toBe(CLOSE_ROOM_CLOSED)
      expect(socket.closedReason).toBe(TRIP_ROOM_CLOSED_REASON)
    }
    // Nothing stamped with a user id survives: D1 is the record and the room rebuilds from it.
    expect(storage.data.size).toBe(0)
    expect(storage.alarmDeleted).toBe(1)
    const snapshot = await (
      await room.fetch(new Request('https://room/snapshot'))
    ).json()
    expect(snapshot).toMatchObject({ version: 0, entities: [] })
  })

  it('does not arm a new alarm when the evicted sockets close afterwards', async () => {
    const { room, storage, sockets } = await joinedRoomOf([
      { role: 'editor', userId: 'ana' },
    ])
    await room.fetch(resetRequest())
    const armedBefore = storage.alarmSet

    for (const socket of sockets) await room.webSocketClose(socket, CLOSE_ROOM_CLOSED, '', true)

    expect(storage.alarmSet).toBe(armedBefore)
  })

  it('takes only a POST', async () => {
    const { room, storage } = await joinedRoomOf([
      { role: 'editor', userId: 'ana' },
    ])
    await room.fetch(commitRequest())

    const response = await room.fetch(resetRequest('GET'))

    expect(response.status).toBe(405)
    expect(storage.data.size).toBeGreaterThan(0)
  })

  it('succeeds on a room that never held anything', async () => {
    const { room, storage } = await joinedRoomOf([])

    expect((await room.fetch(resetRequest())).status).toBe(200)
    expect(storage.data.size).toBe(0)
  })
})

describe('socket age backstop', () => {
  const maximumAge = TRIP_ROOM_MAX_SOCKET_AGE_MS

  it('arms housekeeping at connect before hello', async () => {
    const storage = fakeStorage()
    const server = fakeSocket(identityWith('editor', 'ana'), 'accepted')
    const sockets: Array<TripRoomSocket> = []
    const state: TripRoomState = {
      storage,
      acceptWebSocket: (socket) => {
        sockets.push(socket)
      },
      getWebSockets: () => sockets,
    }
    const NativeResponse = Response
    vi.stubGlobal(
      'WebSocketPair',
      class {
        0 = fakeSocket(identityWith('editor', 'ana'), 'client')
        1 = server
      },
    )
    vi.stubGlobal(
      'Response',
      class extends NativeResponse {
        constructor(body: BodyInit | null, init: ResponseInit) {
          super(body, {
            ...init,
            status: init.status === 101 ? 200 : init.status,
          })
        }
      },
    )
    try {
      const room = new TripRoom(
        state,
        {},
        { now: () => 123, newId: () => 'accepted' },
      )
      await room.fetch(
        new Request('https://room/connect', {
          headers: {
            upgrade: 'websocket',
            'x-planned-trip-identity': JSON.stringify(
              identityWith('editor', 'ana'),
            ),
          },
        }),
      )
      expect(sockets).toEqual([server])
      expect(server.deserializeAttachment()).toMatchObject({
        joinedAt: 123,
        joined: false,
      })
      expect(storage.alarmSet).toBe(1)
      expect(storage.alarmAt).toBe(123 + TRIP_ROOM_ALARM_INTERVAL_MS)
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('expires joined and unjoined attachments after hibernation, announces departure and reschedules', async () => {
    let now = 1000
    const storage = fakeStorage()
    const old = fakeSocket(identityWith('editor', 'ana'), 'old')
    const silent = fakeSocket(identityWith('viewer', 'ben'), 'silent')
    const young = fakeSocket(identityWith('editor', 'cy'), 'young')
    const sockets = [old, silent, young]
    const state: TripRoomState = {
      storage,
      acceptWebSocket: () => undefined,
      getWebSockets: () =>
        sockets.filter((socket) => socket.closedWith === null),
    }
    const stamp = (socket: FakeSocket, joinedAt: number) => {
      socket.serializeAttachment({
        ...(socket.deserializeAttachment() as object),
        joinedAt,
      })
    }
    stamp(old, now)
    stamp(silent, now)
    const first = new TripRoom(state, {}, { now: () => now })
    await first.webSocketMessage(old, HELLO)
    now += maximumAge
    stamp(young, now)
    await first.webSocketMessage(young, HELLO)
    // Reconstruct the room with only persisted socket attachments, as after hibernation.
    const resumed = new TripRoom(state, {}, { now: () => now })
    await resumed.alarm()
    expect(old.closedWith).toBeNull() // Exactly the limit is not older than it.
    now += 1
    young.sent.length = 0
    const armedBefore = storage.alarmSet
    await resumed.alarm()
    for (const expired of [old, silent]) {
      expect(expired.closedWith).toBe(CLOSE_ROOM_CLOSED)
      expect(expired.closedReason).toBe(TRIP_ROOM_CLOSED_REASON)
    }
    expect(young.closedWith).toBeNull()
    expect(young.sent).toEqual([
      expect.objectContaining({ t: 'presence', left: 'old' }),
    ])
    expect(storage.alarmSet).toBe(armedBefore + 1)
    expect(storage.alarmAt).toBe(now + TRIP_ROOM_ALARM_INTERVAL_MS)
    young.sent.length = 0
    await resumed.webSocketMessage(old, HELLO)
    await resumed.webSocketMessage(old, PATCH)
    await resumed.fetch(commitRequest())
    expect(old.sent.filter((frame) => frame.t === 'commit')).toEqual([])
  })
})

describe('refusing a connect minted before a revocation reached the room', () => {
  const REVOKED_AT = 1_700_000_000_000
  const BEFORE = REVOKED_AT - 5_000
  const SKEW = TRIP_ROOM_REVOCATION_SKEW_MS

  let now = REVOKED_AT
  let pending: FakeSocket
  let storage: ReturnType<typeof fakeStorage>
  let accepted: Array<FakeSocket>
  let room: TripRoom
  let sink: ReturnType<typeof createMemorySink>

  beforeEach(() => {
    now = REVOKED_AT
    storage = fakeStorage()
    accepted = []
    sink = createMemorySink()
    const state: TripRoomState = {
      storage,
      acceptWebSocket: (socket) => {
        accepted.push(socket as FakeSocket)
      },
      getWebSockets: (tag) =>
        tag === undefined
          ? accepted
          : accepted.filter(
              (socket) =>
                (
                  socket.deserializeAttachment() as {
                    identity: TripRoomIdentity
                  }
                ).identity.user.id === tag,
            ),
    }
    const NativeResponse = Response
    vi.stubGlobal(
      'WebSocketPair',
      class {
        0 = fakeSocket(identityWith('editor', 'client'), 'client')
        1 = pending
      },
    )
    vi.stubGlobal(
      'Response',
      class extends NativeResponse {
        constructor(body: BodyInit | null, init: ResponseInit) {
          super(body, {
            ...init,
            status: init.status === 101 ? 200 : init.status,
          })
        }
      },
    )
    let ids = 0
    room = new TripRoom(
      state,
      {},
      {
        now: () => now,
        newId: () => `conn-${ids++}`,
        logger: createLogger({ sink }),
      },
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Opens a socket for `userId` through the room's connect route; `via` picks header or query. */
  async function connect(
    userId: string,
    issuedAt: number | undefined,
    via: 'header' | 'query' = 'header',
  ): Promise<FakeSocket> {
    const identity = {
      ...identityWith('editor', userId),
      ...(issuedAt === undefined ? {} : { issuedAt }),
    }
    const encoded = JSON.stringify(identity)
    pending = fakeSocket(identity, 'pending')
    const response =
      via === 'header'
        ? await room.fetch(
            new Request('https://room/connect', {
              headers: {
                upgrade: 'websocket',
                [TRIP_ROOM_IDENTITY_HEADER]: encoded,
              },
            }),
          )
        : await room.fetch(
            new Request(
              `https://room/connect?identity=${encodeURIComponent(encoded)}`,
              { headers: { upgrade: 'websocket' } },
            ),
          )
    expect(response.status).toBe(200)
    return pending
  }

  function closeAt(revokedAt: number | string | null, body?: unknown) {
    return room.fetch(
      new Request('https://room/close', {
        method: 'POST',
        headers:
          revokedAt === null
            ? {}
            : { [TRIP_ROOM_REVOKED_AT_HEADER]: String(revokedAt) },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    )
  }

  function expectRefused(socket: FakeSocket) {
    expect(socket.closedWith).toBe(CLOSE_ROOM_CLOSED)
    expect(socket.closedReason).toBe(TRIP_ROOM_CLOSED_REASON)
    expect(socket.sent).toEqual([])
  }

  it('refuses the stale connect of the person a close named, and not another person’s', async () => {
    await closeAt(REVOKED_AT, { userId: 'ana' })

    const ana = await connect('ana', BEFORE)
    const ben = await connect('ben', BEFORE)

    expectRefused(ana)
    expect(ben.closedWith).toBeNull()
  })

  it('refuses everyone’s stale connect after a whole-room close', async () => {
    await closeAt(REVOKED_AT)

    expectRefused(await connect('ana', BEFORE))
    expectRefused(await connect('ben', BEFORE))
  })

  it('applies the later of the room’s watermark and the person’s, and never moves one back', async () => {
    await closeAt(REVOKED_AT + 20_000)
    await closeAt(REVOKED_AT, { userId: 'ana' })
    expect(storage.data.get('w:room')).toBe(REVOKED_AT + 20_000)

    expectRefused(await connect('ana', REVOKED_AT + 10_000))

    await closeAt(REVOKED_AT + 40_000, { userId: 'ben' })
    await closeAt(REVOKED_AT + 30_000, { userId: 'ben' })
    expect(storage.data.get('w:u:ben')).toBe(REVOKED_AT + 40_000)
    expectRefused(await connect('ben', REVOKED_AT + 35_000))
    expectRefused(await connect('ana', REVOKED_AT + 15_000))
  })

  it('refuses up to the watermark plus the skew margin and accepts from it', async () => {
    await closeAt(REVOKED_AT)

    expectRefused(await connect('ana', REVOKED_AT + SKEW - 1))
    const exact = await connect('ana', REVOKED_AT + SKEW)
    expect(exact.closedWith).toBeNull()
  })

  it('refuses a connect with no issuedAt where a watermark applies and accepts it elsewhere', async () => {
    const free = await connect('ana', undefined)
    expect(free.closedWith).toBeNull()

    await closeAt(REVOKED_AT, { userId: 'ana' })

    expectRefused(await connect('ana', undefined))
    expect((await connect('ben', undefined)).closedWith).toBeNull()
  })

  it('refuses through the ?identity= query exactly as through the header', async () => {
    await closeAt(REVOKED_AT)

    expectRefused(await connect('ana', BEFORE, 'query'))
    const fresh = await connect('ana', REVOKED_AT + SKEW, 'query')
    expect(fresh.closedWith).toBeNull()
  })

  it('never joins, announces or counts a refused socket, and ignores what it sends', async () => {
    const peer = await connect('ben', BEFORE)
    await room.webSocketMessage(peer, HELLO)
    peer.sent.length = 0
    await closeAt(REVOKED_AT, { userId: 'ana' })
    peer.sent.length = 0
    storage.writes = 0

    const ana = await connect('ana', BEFORE)
    await room.webSocketMessage(ana, HELLO)
    await room.webSocketMessage(ana, PATCH)
    expectRefused(ana)
    await room.webSocketClose(ana, CLOSE_ROOM_CLOSED, TRIP_ROOM_CLOSED_REASON, true)

    expect(peer.sent.filter((frame) => frame.t !== 'presence' || 'joined' in frame)).toEqual([])
    expect(storage.data.has('meta')).toBe(false)
    const snapshot = await room.fetch(new Request('https://room/snapshot'))
    await expect(snapshot.json()).resolves.toMatchObject({ peers: [{ user: { id: 'ben' } }] })
    expect(sink.records.filter((r) => r.msg.includes('refused'))).toEqual([
      expect.objectContaining({ tripId: TRIP_ID, orgId: 'org-1', userId: 'ana' }),
    ])
    expect(JSON.stringify(sink.records)).not.toContain('@')
  })

  it('still evicts a close without a valid revokedAt, records nothing and warns', async () => {
    const ana = await connect('ana', BEFORE)
    const ben = await connect('ben', BEFORE)

    for (const missing of [null, 'soon', '-5', '12.5', '']) {
      const response = await closeAt(missing, { userId: 'ana' })
      expect(response.status).toBe(200)
    }
    await closeAt(null)

    expect(ana.closedWith).toBe(CLOSE_ROOM_CLOSED)
    expect(ben.closedWith).toBe(CLOSE_ROOM_CLOSED)
    expect([...storage.data.keys()].filter((key) => key.startsWith('w:'))).toEqual([])
    expect(sink.records.filter((r) => r.level === 'warn')).toHaveLength(6)
    expect((await connect('ana', undefined)).closedWith).toBeNull()
  })

  it('keeps the existing userId validation: a body naming no person is a 400 and records nothing', async () => {
    const response = await closeAt(REVOKED_AT, { userId: '' })

    expect(response.status).toBe(400)
    expect([...storage.data.keys()].filter((key) => key.startsWith('w:'))).toEqual([])
  })

  it('schedules the alarm for a close in a version-0 room, keeps it while a watermark is left and prunes it after the TTL', async () => {
    await closeAt(REVOKED_AT)
    expect(storage.alarmAt).toBe(REVOKED_AT + TRIP_ROOM_ALARM_INTERVAL_MS)

    now = REVOKED_AT + TRIP_ROOM_REVOCATION_TTL_MS
    storage.alarmAt = null
    await room.alarm()
    expect(storage.data.has('w:room')).toBe(true)
    expect(storage.alarmAt).toBe(now + TRIP_ROOM_ALARM_INTERVAL_MS)

    now += 1
    storage.alarmAt = null
    await room.alarm()
    expect(storage.data.has('w:room')).toBe(false)
    expect(storage.alarmAt).toBeNull()
    expect((await connect('ana', undefined)).closedWith).toBeNull()
  })
})
