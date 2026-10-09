/**
 * The room client's close helpers: which request reaches which trip's object, and what a refusal
 * does. A stub namespace stands in for `env.TRIP_ROOM`, so what is asserted is the wire shape the
 * room's `close` route reads (`trip-room.test.ts` holds the other half).
 */
import { describe, expect, it } from 'vitest'

import { closeTripRoom, closeTripRoomFor } from '../trip-room-client'

import type { TripRoomNamespace } from '../trip-room-client'

function stubNamespace(status = 200) {
  const requests: Array<{
    room: string
    url: string
    method: string
    body: string
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
        })
        return new Response(null, { status })
      },
    }),
  }
  return { namespace, requests }
}

describe('closing a trip room from the app Worker', () => {
  it('closes the whole room with no body', async () => {
    const { namespace, requests } = stubNamespace()

    await closeTripRoom(namespace, 'trip-1')

    expect(requests).toEqual([
      {
        room: 'trip-1',
        url: 'https://trip-room.internal/trip-1/close',
        method: 'POST',
        body: '',
      },
    ])
  })

  it('closes one person’s sockets by naming them in the body', async () => {
    const { namespace, requests } = stubNamespace()

    await closeTripRoomFor(namespace, 'trip-1', 'user-7')

    expect(requests).toEqual([
      {
        room: 'trip-1',
        url: 'https://trip-room.internal/trip-1/close',
        method: 'POST',
        body: JSON.stringify({ userId: 'user-7' }),
      },
    ])
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
