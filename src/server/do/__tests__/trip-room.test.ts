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
import { TRIP_ROOM_PROTOCOL_VERSION } from '../protocol'

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
    send: (message) => {
      socket.sent.push(JSON.parse(message) as { t: string })
    },
    close: () => undefined,
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

/** A room with one connected, joined socket per entry of `roles`, in order. */
async function joinedRoom(roles: Array<'editor' | 'viewer'>) {
  const storage = fakeStorage()
  const sockets = roles.map((role, index) =>
    fakeSocket(identityWith(role, `user-${index}`), `conn-${index}`),
  )
  const state: TripRoomState = {
    storage,
    acceptWebSocket: () => undefined,
    getWebSockets: () => sockets,
  }
  const room = new TripRoom(state, {})
  for (const socket of sockets) {
    await room.webSocketMessage(socket, HELLO)
  }
  for (const socket of sockets) socket.sent.length = 0
  storage.writes = 0
  return { room, storage, sockets }
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
