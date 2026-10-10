/**
 * Who the trip room is told a connection is: the whole authorisation boundary of the socket.
 *
 * The room trusts the identity the Worker asserts, so the only place a trip viewer can be kept
 * read-only is the `role` this handler hands it. Every case asserts the identity the (stub)
 * namespace receives, decoded from the header the room would read. The session layer is stubbed;
 * the repositories are real, over the migrated in-memory database, so the role comes from a stored
 * `trip_members` row and the trip is resolved inside the caller's workspace.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TRIP_ROOM_IDENTITY_HEADER,
  decodeTripRoomIdentity,
  encodeTripRoomIdentity,
} from '#/server/do/protocol'
import {
  addTripMember,
  archiveTrip,
  createTrip,
  updateTripMember,
} from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'

import { serveTripRoom } from '../connect'

import type { TripRoomIdentity } from '#/server/do/protocol'
import type { TripRoomNamespace } from '#/server/do'
import type { TenantContext } from '#/server/auth/session'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

const stubs = vi.hoisted(() => ({
  signedIn: true,
  userName: 'Ada Lovelace',
  ctx: null as TenantContext | null,
  db: null as unknown,
}))

vi.mock('#/server/auth/session', async () => {
  const { AuthRequirementError, isAuthRequirementError } =
    await import('#/server/auth/tenant')
  return {
    isAuthRequirementError,
    getSession: async () =>
      stubs.signedIn
        ? {
            user: {
              name: stubs.userName,
              email: 'ada@example.test',
              image: null,
            },
          }
        : null,
    requireOrg: async () => {
      if (stubs.ctx === null) {
        throw new AuthRequirementError(
          'no-active-organization',
          'Choose a workspace before continuing.',
        )
      }
      return stubs.ctx
    },
  }
})

vi.mock('#/server/db/client', () => ({ getDb: () => stubs.db }))

/** A namespace that records the identity each connection is handed, and answers 101-less 200. */
function recordingNamespace(): {
  namespace: TripRoomNamespace
  identities: Array<TripRoomIdentity>
} {
  const identities: Array<TripRoomIdentity> = []
  const namespace: TripRoomNamespace = {
    idFromName: (name) => ({ name }) as unknown as DurableObjectId,
    get: () => ({
      fetch: async (request: Request) => {
        const decoded = decodeTripRoomIdentity(
          request.headers.get(TRIP_ROOM_IDENTITY_HEADER),
        )
        if (decoded.ok) identities.push(decoded.value)
        return new Response('upgraded', { status: 200 })
      },
    }),
  }
  return { namespace, identities }
}

function upgrade(tripId: string): Request {
  return new Request(`https://planned.travel/api/trip-room/${tripId}`, {
    headers: { upgrade: 'websocket' },
  })
}

describe('the trip room connection role', () => {
  let harness: Harness
  let alpha: SeededTenant
  let tripId: string

  /**
   * Acts as `userId` of the alpha workspace for the next connection, with the workspace role the
   * session would carry: the owner by default for the workspace owner, a member for anyone else.
   */
  function actAs(
    userId: string,
    workspaceRole: TenantContext['role'] = userId === alpha.ownerUserId
      ? 'owner'
      : 'member',
  ): void {
    stubs.ctx = {
      userId,
      organizationId: alpha.organizationId,
      role: workspaceRole,
    }
  }

  /** Connects as `userId` and returns the role the room was told. */
  async function roleOf(
    userId: string,
    workspaceRole?: TenantContext['role'],
    request: Request = upgrade(tripId),
  ): Promise<TripRoomIdentity['role']> {
    actAs(userId, workspaceRole)
    const { namespace, identities } = recordingNamespace()
    const response = await serveTripRoom(namespace, request, tripId)
    expect(response.status).toBe(200)
    expect(identities).toHaveLength(1)
    expect(identities[0]?.user.id).toBe(userId)
    return identities[0]?.role ?? 'viewer'
  }

  async function joinAs(
    name: string,
    role: 'owner' | 'editor' | 'viewer',
  ): Promise<string> {
    const userId = await alpha.addUser(name)
    await addTripMember(alpha.scope, { tripId, userId, role })
    return userId
  }

  beforeEach(async () => {
    harness = await createHarness()
    stubs.db = harness.db
    stubs.signedIn = true
    stubs.userName = 'Ada Lovelace'
    alpha = await harness.seedTenant('alpha')
    await subscribeTenant(alpha.scope, 'crew', 5)
    const trip = await createTrip(alpha.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
      visibility: 'organization',
    })
    tripId = trip.id
  })

  it('admits the trip owner as an editor', async () => {
    expect(await roleOf(alpha.ownerUserId)).toBe('editor')
  })

  it('admits a trip editor as an editor', async () => {
    expect(await roleOf(await joinAs('Eddie', 'editor'))).toBe('editor')
  })

  it('admits a trip viewer as a viewer, so the room refuses their patches', async () => {
    expect(await roleOf(await joinAs('Vera', 'viewer'))).toBe('viewer')
  })

  it('admits a workspace member with no trip membership on an organization-visible trip as a viewer', async () => {
    expect(await roleOf(await alpha.addUser('Nina'))).toBe('viewer')
  })

  it('admits everyone as a viewer once the trip is archived, owner and editor included', async () => {
    const editorId = await joinAs('Eddie', 'editor')
    await archiveTrip(alpha.scope, tripId)

    expect(await roleOf(alpha.ownerUserId)).toBe('viewer')
    expect(await roleOf(editorId)).toBe('viewer')
  })

  it('admits a workspace admin with no trip membership as a viewer: the workspace role sets nothing', async () => {
    expect(await roleOf(await alpha.addUser('Ada'), 'admin')).toBe('viewer')
  })

  it('admits a workspace owner who is only a trip viewer as a viewer', async () => {
    expect(await roleOf(await joinAs('Olive', 'viewer'), 'owner')).toBe(
      'viewer',
    )
  })

  it('ignores an identity header the client sends itself', async () => {
    const userId = await joinAs('Vera', 'viewer')
    const forged = new Request(
      `https://planned.travel/api/trip-room/${tripId}`,
      {
        headers: {
          upgrade: 'websocket',
          [TRIP_ROOM_IDENTITY_HEADER]: encodeTripRoomIdentity({
            tripId,
            orgId: alpha.organizationId,
            user: {
              id: userId,
              name: 'Vera',
              initials: 'V',
              hue: 1,
              avatarUrl: null,
            },
            role: 'editor',
          }),
        },
      },
    )

    expect(await roleOf(userId, undefined, forged)).toBe('viewer')
  })

  it('reads the stored role at every connection, so a demotion applies on the next reconnect', async () => {
    const userId = await alpha.addUser('Eddie')
    const member = await addTripMember(alpha.scope, {
      tripId,
      userId,
      role: 'editor',
    })
    expect(await roleOf(userId)).toBe('editor')

    await updateTripMember(alpha.scope, member.id, { role: 'viewer' })

    expect(await roleOf(userId)).toBe('viewer')
  })

  it('addresses the room of the resolved trip', async () => {
    actAs(alpha.ownerUserId)
    const { namespace } = recordingNamespace()
    const idFromName = vi.spyOn(namespace, 'idFromName')

    await serveTripRoom(namespace, upgrade(tripId), tripId)

    expect(idFromName).toHaveBeenCalledWith(tripId)
  })

  it('answers 404 for a trip of another workspace and never reaches the namespace', async () => {
    const beta = await harness.seedTenant('beta')
    stubs.ctx = {
      userId: beta.ownerUserId,
      organizationId: beta.organizationId,
      role: 'owner',
    }
    const { namespace, identities } = recordingNamespace()
    const get = vi.spyOn(namespace, 'get')

    const response = await serveTripRoom(namespace, upgrade(tripId), tripId)

    expect(response.status).toBe(404)
    expect(identities).toEqual([])
    expect(get).not.toHaveBeenCalled()
  })

  it('answers 401 when signed out and never reaches the namespace', async () => {
    stubs.signedIn = false
    const { namespace } = recordingNamespace()
    const get = vi.spyOn(namespace, 'get')

    const response = await serveTripRoom(namespace, upgrade(tripId), tripId)

    expect(response.status).toBe(401)
    expect(get).not.toHaveBeenCalled()
  })

  it('answers 403 when the caller has no workspace and never reaches the namespace', async () => {
    stubs.ctx = null
    const { namespace } = recordingNamespace()
    const get = vi.spyOn(namespace, 'get')

    const response = await serveTripRoom(namespace, upgrade(tripId), tripId)

    expect(response.status).toBe(403)
    expect(get).not.toHaveBeenCalled()
  })

  it('answers 426 to a request that is not a WebSocket upgrade', async () => {
    actAs(alpha.ownerUserId)
    const { namespace } = recordingNamespace()
    const get = vi.spyOn(namespace, 'get')

    const response = await serveTripRoom(
      namespace,
      new Request(`https://planned.travel/api/trip-room/${tripId}`),
      tripId,
    )

    expect(response.status).toBe(426)
    expect(get).not.toHaveBeenCalled()
  })

  describe('who the room is told the person is', () => {
    async function identityOf(): Promise<TripRoomIdentity> {
      actAs(alpha.ownerUserId)
      const { namespace, identities } = recordingNamespace()
      const response = await serveTripRoom(namespace, upgrade(tripId), tripId)
      expect(response.status).toBe(200)
      const identity = identities[0]
      if (identity === undefined) throw new Error('no identity was handed over')
      return identity
    }

    it('hands a person with a display name over exactly as before', async () => {
      const { user } = await identityOf()

      expect(user.name).toBe('Ada Lovelace')
      expect(user.initials).toBe('AL')
      expect(user.avatarUrl).toBeNull()
      expect(Number.isInteger(user.hue)).toBe(true)
    })

    it.each([
      ['empty', ''],
      ['whitespace-only', '   '],
      ['equal to their email', 'ada@example.test'],
      ['their email in other case, padded', '  Ada@Example.TEST '],
    ])(
      'tells the room there is no name when the name is %s',
      async (_, name) => {
        stubs.userName = name

        const { user } = await identityOf()

        expect(user.name).toBeNull()
        expect(user.initials).toBe('?')
        const encoded = encodeTripRoomIdentity(await identityOf())
        expect(encoded).not.toContain('example.test')
        expect(encoded).not.toContain('@')
      },
    )
  })
})
