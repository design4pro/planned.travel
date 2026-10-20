/**
 * The server-side helpers that evict sockets from a trip's room: which room is called, for whom, and
 * that an unreachable room is a logged warning rather than a failed request.
 *
 * `../context` imports `cloudflare:workers`, which does not resolve in the plain-Node project this
 * suite runs in, so the Worker environment is replaced with a recording `TRIP_ROOM` namespace.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as Observability from '#/server/observability'
import type { TenantScope } from '#/server/repos'

const stubs = vi.hoisted(() => ({
  requests: [] as Array<{ room: string; url: string; body: string }>,
  roomStatus: 200,
  roomThrows: false,
  warnings: [] as Array<{ message: string; fields: Record<string, unknown> }>,
}))

vi.mock('cloudflare:workers', () => ({
  env: {
    TRIP_ROOM: {
      idFromName: (name: string) => name,
      get: (id: string) => ({
        fetch: async (request: Request) => {
          if (stubs.roomThrows) {
            throw new Error('TRIP_ROOM is unreachable')
          }
          stubs.requests.push({
            room: id,
            url: request.url,
            body: await request.text(),
          })
          return new Response(null, { status: stubs.roomStatus })
        },
      }),
    },
  },
}))

vi.mock('#/server/auth/env', () => ({}))
vi.mock('#/server/auth/session', () => ({ requireOrg: async () => null }))
vi.mock('#/server/db/client', () => ({ getDb: () => null }))
vi.mock('#/server/observability', async (importOriginal) => {
  const actual = await importOriginal<typeof Observability>()
  return {
    ...actual,
    loggerFromEnv: () => ({
      warn: (message: string, fields: Record<string, unknown>) => {
        stubs.warnings.push({ message, fields })
      },
    }),
  }
})

const { closeRoom, closeRoomFor, resetRoom } = await import('../context')

const scope = {
  ctx: { userId: 'owner-1', organizationId: 'org-1' },
} as unknown as TenantScope

beforeEach(() => {
  stubs.requests = []
  stubs.roomStatus = 200
  stubs.roomThrows = false
  stubs.warnings = []
})

describe('evicting sockets from a trip room', () => {
  it('closes one person’s sockets in the named trip’s room only', async () => {
    await closeRoomFor(scope, 'trip-1', 'user-7')

    expect(stubs.requests).toEqual([
      {
        room: 'trip-1',
        url: 'https://trip-room.internal/trip-1/close',
        body: JSON.stringify({ userId: 'user-7' }),
      },
    ])
  })

  it('closes the whole room of the named trip', async () => {
    await closeRoom(scope, 'trip-1')

    expect(stubs.requests).toEqual([
      {
        room: 'trip-1',
        url: 'https://trip-room.internal/trip-1/close',
        body: '',
      },
    ])
  })

  it('logs and carries on when the room refuses, naming trip, workspace and person by id', async () => {
    stubs.roomStatus = 500

    await expect(
      closeRoomFor(scope, 'trip-1', 'user-7'),
    ).resolves.toBeUndefined()

    expect(stubs.warnings).toEqual([
      {
        message: 'trip room eviction failed',
        fields: expect.objectContaining({
          tripId: 'trip-1',
          organizationId: 'org-1',
          userId: 'user-7',
        }),
      },
    ])
  })

  it('logs and carries on when the room cannot be reached at all', async () => {
    stubs.roomThrows = true

    await expect(closeRoom(scope, 'trip-1')).resolves.toBeUndefined()

    expect(stubs.warnings).toHaveLength(1)
    expect(stubs.warnings[0].fields).toMatchObject({
      tripId: 'trip-1',
      organizationId: 'org-1',
    })
    expect(stubs.warnings[0].fields).not.toHaveProperty('userId')
  })
})

describe('resetting a deleted trip room', () => {
  it('resets only the named trip room', async () => {
    await resetRoom(scope, 'trip-1')
    expect(stubs.requests).toEqual([
      {
        room: 'trip-1',
        url: 'https://trip-room.internal/trip-1/reset',
        body: '',
      },
    ])
  })

  it.each(['transport', 'response'])(
    'logs a %s failure without failing deletion',
    async (failure) => {
      stubs.roomThrows = failure === 'transport'
      stubs.roomStatus = 500
      await expect(resetRoom(scope, 'trip-1')).resolves.toBeUndefined()
      expect(stubs.warnings).toEqual([
        {
          message: 'trip room eviction failed',
          fields: expect.objectContaining({
            tripId: 'trip-1',
            organizationId: 'org-1',
          }),
        },
      ])
      expect(stubs.warnings[0].fields).not.toHaveProperty('userId')
    },
  )
})
