/**
 * The trip room's write gate: who may patch, and what a refused patch leaves behind.
 *
 * The room trusts the identity the app Worker asserts (`src/routes/api/trip-room/-lib/connect.ts`
 * decides the role); what it owns is acting on that role. A `viewer` connection is read-only, and
 * "read-only" has to mean no storage write, no version move and no frame to anyone else, not only
 * an error to the sender. The room is driven through its own `TripRoomState` / `TripRoomSocket`
 * ports, with no Worker and no `WebSocketPair`.
 */
import { describe, expect, it } from 'vitest'

import { TripRoom } from '../trip-room'
import {
  TRIP_ROOM_CLOSED_REASON,
  TRIP_ROOM_PROTOCOL_VERSION,
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
  data: Map<string, unknown>
} {
  const data = new Map<string, unknown>()
  const storage = {
    writes: 0,
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
    setAlarm: async () => undefined,
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
  it('refuses a viewer socket’s patch without writing, moving the version or telling anyone else', async () => {
    const { room, storage, sockets } = await joinedRoom(['viewer', 'editor'])
    const [viewer, editor] = sockets

    await room.webSocketMessage(viewer, PATCH)

    expect(viewer.sent).toEqual([
      expect.objectContaining({
        t: 'error',
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
