/**
 * The eviction table for a trip's access or state changes: which verb closes whose sockets, that a
 * refused or unchanged write closes none, and that an unreachable room never fails the write.
 *
 * The table and `applyTripAccessChange` are driven through a recording port. The last block runs
 * `settleTripAccessChange` against the real `../context` over a `TRIP_ROOM` namespace that throws,
 * so each kind of close is shown to be quiet end to end.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as Observability from '#/server/observability'
import type { TenantScope } from '#/server/repos'
import type {
  TripAccessChange,
  TripRoomEviction,
} from '../-lib/trip-access-change'

const stubs = vi.hoisted(() => ({
  roomThrows: false,
  requests: [] as Array<{ room: string; url: string }>,
  warnings: [] as Array<Record<string, unknown>>,
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
          stubs.requests.push({ room: id, url: request.url })
          return new Response(null, { status: 200 })
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
      warn: (_message: string, fields: Record<string, unknown>) => {
        stubs.warnings.push(fields)
      },
    }),
  }
})

// Loaded once up front: the first import of the bridge is slow enough to time out a test.
await import('#/server/fns/context')

const { applyTripAccessChange, evictionsFor, settleTripAccessChange } =
  await import('../-lib/trip-access-change')

const scope = {
  ctx: { userId: 'actor-1', organizationId: 'org-1' },
} as unknown as TenantScope

const member = (role: string, userId = 'user-7') => ({
  tripId: 'trip-1',
  userId,
  role,
})
const trip = (visibility: string) => ({ id: 'trip-1', visibility })

const person = { scope: 'person', tripId: 'trip-1', userId: 'user-7' }
const room = { scope: 'room', tripId: 'trip-1' }

beforeEach(() => {
  stubs.roomThrows = false
  stubs.requests = []
  stubs.warnings = []
})

describe('which sockets a trip access change closes', () => {
  it.each(['viewer', 'editor', 'owner'])(
    'closes the added person, whatever the role (%s)',
    (role) => {
      expect(
        evictionsFor({ kind: 'member-added', member: member(role) }),
      ).toEqual([person])
    },
  )

  it('closes the person whose role changed, and nobody when it did not', () => {
    expect(
      evictionsFor({
        kind: 'role-changed',
        before: member('viewer'),
        after: member('editor'),
      }),
    ).toEqual([person])
    expect(
      evictionsFor({
        kind: 'role-changed',
        before: member('editor'),
        after: member('editor'),
      }),
    ).toEqual([])
  })

  it('closes the removed row’s person, and the leaver’s own', () => {
    expect(
      evictionsFor({ kind: 'member-removed', member: member('editor') }),
    ).toEqual([person])
    expect(
      evictionsFor({ kind: 'member-left', member: member('viewer') }),
    ).toEqual([person])
  })

  it.each([
    ['organization', 'private', [room]],
    ['organization', 'organization', []],
    ['private', 'private', []],
    ['private', 'organization', []],
  ] as const)('visibility %s -> %s closes %j', (from, to, expected) => {
    expect(
      evictionsFor({
        kind: 'visibility-changed',
        before: trip(from),
        after: trip(to),
      }),
    ).toEqual(expected)
  })

  it('closes the whole room on archive and restore, and erases it on delete', () => {
    expect(
      evictionsFor({ kind: 'trip-archived', trip: trip('private') }),
    ).toEqual([room])
    expect(
      evictionsFor({ kind: 'trip-restored', trip: trip('private') }),
    ).toEqual([room])
    expect(
      evictionsFor({ kind: 'trip-deleted', trip: trip('private') }),
    ).toEqual([{ scope: 'erase', tripId: 'trip-1' }])
  })
})

describe('applying a change through a room port', () => {
  const recordingPort = (): {
    calls: Array<string>
    port: TripRoomEviction
  } => {
    const calls: Array<string> = []
    return {
      calls,
      port: {
        closeRoomFor: async (_scope, tripId, userId) => {
          calls.push(`person:${tripId}:${userId}`)
        },
        closeRoom: async (_scope, tripId) => {
          calls.push(`room:${tripId}`)
        },
        resetRoom: async (_scope, tripId) => {
          calls.push(`erase:${tripId}`)
        },
      },
    }
  }

  it.each([
    [
      { kind: 'member-added', member: member('editor') },
      ['person:trip-1:user-7'],
    ],
    [{ kind: 'trip-archived', trip: trip('private') }, ['room:trip-1']],
    [{ kind: 'trip-deleted', trip: trip('private') }, ['erase:trip-1']],
    [
      {
        kind: 'role-changed',
        before: member('editor'),
        after: member('editor'),
      },
      [],
    ],
  ] as const satisfies ReadonlyArray<
    readonly [TripAccessChange, Array<string>]
  >)('calls the port for %j', async (change, expected) => {
    const { calls, port } = recordingPort()

    await applyTripAccessChange(scope, change, port)

    expect(calls).toEqual(expected)
  })

  it('lets a failing port reach the caller, so a stub cannot swallow a missed close', async () => {
    const { port } = recordingPort()
    const failing: TripRoomEviction = {
      ...port,
      closeRoomFor: async () => {
        throw new Error('port failed')
      },
    }

    await expect(
      applyTripAccessChange(
        scope,
        { kind: 'member-added', member: member('editor') },
        failing,
      ),
    ).rejects.toThrow('port failed')
  })
})

describe('settling a change against the real room bridge', () => {
  it.each([
    [
      'one person',
      { kind: 'member-removed', member: member('editor') },
      'close',
    ],
    [
      'the whole room',
      { kind: 'trip-archived', trip: trip('private') },
      'close',
    ],
    [
      'the erased room',
      { kind: 'trip-deleted', trip: trip('private') },
      'reset',
    ],
  ] as const satisfies ReadonlyArray<
    readonly [string, TripAccessChange, string]
  >)(
    'closes %s in the named trip’s room only',
    async (_label, change, path) => {
      await settleTripAccessChange(scope, change)

      expect(stubs.requests).toEqual([
        { room: 'trip-1', url: `https://trip-room.internal/trip-1/${path}` },
      ])
    },
  )

  it.each([
    ['one person', { kind: 'member-added', member: member('editor') }],
    ['the whole room', { kind: 'trip-restored', trip: trip('private') }],
    ['the erased room', { kind: 'trip-deleted', trip: trip('private') }],
  ] as const satisfies ReadonlyArray<readonly [string, TripAccessChange]>)(
    'answers normally when the room cannot be reached for %s, logging ids only',
    async (_label, change) => {
      stubs.roomThrows = true

      await expect(
        settleTripAccessChange(scope, change),
      ).resolves.toBeUndefined()

      expect(stubs.warnings).toHaveLength(1)
      expect(stubs.warnings[0]).toMatchObject({
        tripId: 'trip-1',
        organizationId: 'org-1',
      })
    },
  )

  it('reaches no room at all for a change that closes nothing', async () => {
    stubs.roomThrows = true

    await settleTripAccessChange(scope, {
      kind: 'visibility-changed',
      before: trip('private'),
      after: trip('organization'),
    })

    expect(stubs.requests).toEqual([])
    expect(stubs.warnings).toEqual([])
  })
})
