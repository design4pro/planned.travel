/**
 * The room client's close helpers: which request reaches which trip's object, and what a refusal
 * does. A stub namespace stands in for `env.TRIP_ROOM`, so what is asserted is the wire shape the
 * room's `close` route reads (`trip-room.test.ts` holds the other half).
 */
import { describe, expect, it } from 'vitest'

import { TRIP_ROOM_REVOKED_AT_HEADER } from '../protocol'
import {
  closeTripRoom,
  closeTripRoomFor,
  resetTripRoom,
  resetTripRooms,
} from '../trip-room-client'

import type { TripRoomNamespace } from '../trip-room-client'

function stubNamespace(status = 200) {
  const requests: Array<{
    room: string
    url: string
    method: string
    body: string
    revokedAt?: string
  }> = []
  const namespace: TripRoomNamespace = {
    idFromName: (name) => name as unknown as DurableObjectId,
    get: (id) => ({
      fetch: async (request) => {
        requests.push({
          room: id as unknown as string,
          url: request.url,
          method: request.method,
          body: await request.text(),
          revokedAt:
            request.headers.get(TRIP_ROOM_REVOKED_AT_HEADER) ?? undefined,
        })
        return new Response(null, { status })
      },
    }),
  }
  return { namespace, requests }
}

const NOW = 1_700_000_000_000

describe('closing a trip room from the app Worker', () => {
  it('closes the whole room with no body, stamping revokedAt in a header', async () => {
    const { namespace, requests } = stubNamespace()

    await closeTripRoom(namespace, 'trip-1', () => NOW)

    expect(requests).toEqual([
      {
        room: 'trip-1',
        url: 'https://trip-room.internal/trip-1/close',
        method: 'POST',
        body: '',
        revokedAt: String(NOW),
      },
    ])
  })

  it('closes one person’s sockets by naming them in the body, stamping revokedAt in a header', async () => {
    const { namespace, requests } = stubNamespace()

    await closeTripRoomFor(namespace, 'trip-1', 'user-7', () => NOW)

    expect(requests).toEqual([
      {
        room: 'trip-1',
        url: 'https://trip-room.internal/trip-1/close',
        method: 'POST',
        body: JSON.stringify({ userId: 'user-7' }),
        revokedAt: String(NOW),
      },
    ])
  })

  it('takes revokedAt when the request is sent, after the awaited write', async () => {
    const { namespace, requests } = stubNamespace()
    let clock = 1
    const write = async () => {
      clock = NOW
    }

    await write()
    await closeTripRoom(namespace, 'trip-1', () => clock)

    expect(requests[0].revokedAt).toBe(String(NOW))
  })

  it('throws when the room refuses, so the caller can log it', async () => {
    const { namespace } = stubNamespace(500)

    await expect(
      closeTripRoomFor(namespace, 'trip-1', 'user-7'),
    ).rejects.toThrow('Trip room close failed with 500')
    await expect(closeTripRoom(namespace, 'trip-1')).rejects.toThrow(
      'Trip room close failed with 500',
    )
  })
})

describe('resetting trip rooms from the app Worker', () => {
  it('posts to the reset route of the trip’s own object', async () => {
    const { namespace, requests } = stubNamespace()

    await resetTripRoom(namespace, 'trip-1')

    expect(requests).toEqual([
      {
        room: 'trip-1',
        url: 'https://trip-room.internal/trip-1/reset',
        method: 'POST',
        body: '',
      },
    ])
  })

  it('resets every trip it is given, once each', async () => {
    const { namespace, requests } = stubNamespace()

    await resetTripRooms(namespace, ['trip-1', 'trip-2', 'trip-1', 'trip-3'])

    expect(requests.map((request) => request.room).sort()).toEqual([
      'trip-1',
      'trip-2',
      'trip-3',
    ])
  })

  it('tries every room even when one refuses, then fails naming the trips that did', async () => {
    const reached: Array<string> = []
    const namespace: TripRoomNamespace = {
      idFromName: (name) => name as unknown as DurableObjectId,
      get: (id) => ({
        fetch: async () => {
          reached.push(id as unknown as string)
          return new Response(null, {
            status: (id as unknown as string) === 'trip-2' ? 500 : 200,
          })
        },
      }),
    }

    await expect(
      resetTripRooms(namespace, ['trip-1', 'trip-2', 'trip-3']),
    ).rejects.toThrow(/trip-2/)
    expect(reached.sort()).toEqual(['trip-1', 'trip-2', 'trip-3'])
  })

  it('throws when the room refuses a single reset', async () => {
    const { namespace } = stubNamespace(500)

    await expect(resetTripRoom(namespace, 'trip-1')).rejects.toThrow(
      'Trip room reset failed with 500',
    )
  })
})
