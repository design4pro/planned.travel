/**
 * Who the trip room is told a connection is: the whole authorisation boundary of the socket.
 *
 * The room trusts the identity the Worker asserts, so the only place a trip viewer can be kept
 * read-only is the `role` this handler hands it. Every case asserts the identity the (stub)
 * namespace receives, decoded from the header the room would read. The session layer is stubbed;
 * the repositories are real, over the migrated in-memory database, so the role comes from a stored
 * `trip_members` row and the trip is resolved inside the caller's workspace.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TRIP_ROOM_IDENTITY_HEADER,
  TRIP_ROOM_WORKSPACE_CHANGED_CODE,
  TRIP_ROOM_WORKSPACE_CHANGED_REASON,
  decodeTripRoomIdentity,
  encodeTripRoomIdentity,
} from '#/server/do/protocol'
import {
  addTripMember,
  archiveTrip,
  createTrip,
  getTrip,
  tripRoleFor,
  updateTripMember,
} from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'

import { serveTripRoom } from '../connect'

import type * as Repos from '#/server/repos'
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

// Real repositories, observed: the claim comparison must come before either lookup.
vi.mock('#/server/repos', async (importOriginal) => {
  const actual = await importOriginal<typeof Repos>()
  return {
    ...actual,
    getTrip: vi.fn(actual.getTrip),
    tripRoleFor: vi.fn(actual.tripRoleFor),
  }
})

/** A namespace that records the identity each connection is handed, and answers 101-less 200. */
function recordingNamespace(): {
  namespace: TripRoomNamespace
  identities: Array<TripRoomIdentity>
  reached: () => number
} {
  const identities: Array<TripRoomIdentity> = []
  let gets = 0
  const namespace: TripRoomNamespace = {
    idFromName: (name) => ({ name }) as unknown as DurableObjectId,
    get: () => {
      gets += 1
      return {
        fetch: async (request: Request) => {
          const decoded = decodeTripRoomIdentity(
            request.headers.get(TRIP_ROOM_IDENTITY_HEADER),
          )
          if (decoded.ok) identities.push(decoded.value)
          return new Response('upgraded', { status: 200 })
        },
      }
    },
  }
  return { namespace, identities, reached: () => gets }
}

function upgrade(tripId: string, query = ''): Request {
  return new Request(`https://planned.travel/api/trip-room/${tripId}${query}`, {
    headers: { upgrade: 'websocket' },
  })
}

interface FakeServerSocket {
  accepted: number
  closed: Array<{ code: number; reason: string }>
  accept: () => void
  close: (code: number, reason: string) => void
}

/**
 * The Worker's own end of a socket it answers itself. `WebSocketPair` and a 101 `Response` exist
 * only in workerd, so both are stubbed: the pair hands out recording sockets, and the response
 * keeps the client end it was given.
 */
function stubWebSocketPair(): {
  server: FakeServerSocket
  client: object
  restore: () => void
} {
  const server: FakeServerSocket = {
    accepted: 0,
    closed: [],
    accept: () => {
      server.accepted += 1
    },
    close: (code, reason) => {
      server.closed.push({ code, reason })
    },
  }
  const client = { role: 'client' }
  const NativeResponse = Response
  vi.stubGlobal(
    'WebSocketPair',
    class {
      0 = client
      1 = server
    },
  )
  vi.stubGlobal(
    'Response',
    class extends NativeResponse {
      readonly webSocket: WebSocket | null
      constructor(
        body: BodyInit | null,
        init: ResponseInit & { webSocket?: unknown },
      ) {
        super(body, {
          ...init,
          status: init.status === 101 ? 200 : init.status,
        })
        this.webSocket =
          (init.webSocket as WebSocket | null | undefined) ?? null
      }
    },
  )
  return { server, client, restore: () => vi.unstubAllGlobals() }
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
    impersonatedBy: string | null = null,
  ): void {
    stubs.ctx = {
      userId,
      organizationId: alpha.organizationId,
      role: workspaceRole,
      impersonatedBy,
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
    vi.mocked(getTrip).mockClear()
    vi.mocked(tripRoleFor).mockClear()
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

  describe('under an impersonated session (docs/ACCESS.md §6.4)', () => {
    // The room stamps a commit with the person it was opened for and records nothing about an
    // operator, so a socket opened under an impersonated session never gets to commit.
    it('admits the trip owner as a viewer when an operator is wearing the session', async () => {
      actAs(alpha.ownerUserId, 'owner', 'operator-1')
      const { namespace, identities } = recordingNamespace()

      const response = await serveTripRoom(namespace, upgrade(tripId), tripId)

      expect(response.status).toBe(200)
      expect(identities[0]?.role).toBe('viewer')
      expect(identities[0]?.user.id).toBe(alpha.ownerUserId)
    })

    it('admits a trip editor as a viewer when an operator is wearing the session', async () => {
      const editorId = await joinAs('Eddie', 'editor')
      actAs(editorId, 'member', 'operator-1')
      const { namespace, identities } = recordingNamespace()

      await serveTripRoom(namespace, upgrade(tripId), tripId)

      expect(identities[0]?.role).toBe('viewer')
    })

    it('still admits the same person as an editor when no operator is wearing the session', async () => {
      expect(await roleOf(alpha.ownerUserId)).toBe('editor')
    })

    it('does not put the operator in the identity the room is handed', async () => {
      actAs(alpha.ownerUserId, 'owner', 'operator-1')
      const { namespace, identities } = recordingNamespace()

      await serveTripRoom(namespace, upgrade(tripId), tripId)

      expect(JSON.stringify(identities[0])).not.toContain('operator-1')
    })
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

  describe('the issuedAt stamp', () => {
    const ISSUED_AT = 1_700_000_000_000

    it('hands the room the injected clock’s reading as issuedAt', async () => {
      actAs(alpha.ownerUserId)
      const { namespace, identities } = recordingNamespace()

      await serveTripRoom(namespace, upgrade(tripId), tripId, () => ISSUED_AT)

      expect(identities[0]?.issuedAt).toBe(ISSUED_AT)
    })

    it('takes the clock once, before the trip and the stored role are read', async () => {
      actAs(alpha.ownerUserId)
      const { namespace } = recordingNamespace()
      const order: Array<string> = []
      const realTrip = vi.mocked(getTrip).getMockImplementation()
      const realRole = vi.mocked(tripRoleFor).getMockImplementation()
      vi.mocked(getTrip).mockImplementationOnce((...args) => {
        order.push('trip')
        return realTrip!(...args)
      })
      vi.mocked(tripRoleFor).mockImplementationOnce((...args) => {
        order.push('role')
        return realRole!(...args)
      })

      await serveTripRoom(namespace, upgrade(tripId), tripId, () => {
        order.push('clock')
        return ISSUED_AT
      })

      expect(order).toEqual(['clock', 'trip', 'role'])
    })

    it('cannot be set by an identity header or an identity query the browser sends', async () => {
      actAs(alpha.ownerUserId)
      const forgedIdentity = encodeTripRoomIdentity({
        tripId,
        orgId: alpha.organizationId,
        user: {
          id: alpha.ownerUserId,
          name: 'Ada',
          initials: 'A',
          hue: 1,
          avatarUrl: null,
        },
        role: 'editor',
        issuedAt: 4_000_000_000_000,
      })
      const forged = new Request(
        `https://planned.travel/api/trip-room/${tripId}?identity=${encodeURIComponent(forgedIdentity)}`,
        {
          headers: {
            upgrade: 'websocket',
            [TRIP_ROOM_IDENTITY_HEADER]: forgedIdentity,
          },
        },
      )
      const { namespace, identities } = recordingNamespace()

      await serveTripRoom(namespace, forged, tripId, () => ISSUED_AT)

      expect(identities[0]?.issuedAt).toBe(ISSUED_AT)
    })
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
      impersonatedBy: null,
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

  describe('a tab that states the workspace it is showing', () => {
    let pair: ReturnType<typeof stubWebSocketPair>

    beforeEach(() => {
      pair = stubWebSocketPair()
    })

    afterEach(() => {
      pair.restore()
    })

    function claiming(workspaceId: string, id: string = tripId): Request {
      return upgrade(id, `?workspace=${encodeURIComponent(workspaceId)}`)
    }

    /** Asserts the room was never reached and nothing about the trip was looked up. */
    function expectRoomUntouched(room: {
      identities: Array<TripRoomIdentity>
      reached: () => number
    }): void {
      expect(room.reached()).toBe(0)
      expect(room.identities).toEqual([])
      expect(vi.mocked(getTrip)).not.toHaveBeenCalled()
      expect(vi.mocked(tripRoleFor)).not.toHaveBeenCalled()
    }

    it('accepts the upgrade itself and closes it at once when the claim is another workspace', async () => {
      actAs(alpha.ownerUserId)
      const room = recordingNamespace()
      const { namespace } = room

      const response = (await serveTripRoom(
        namespace,
        claiming('some-other-workspace-id'),
        tripId,
      )) as Response & { webSocket?: unknown }

      expect(response.webSocket).toBe(pair.client)
      expect(pair.server.accepted).toBe(1)
      expect(pair.server.closed).toEqual([
        {
          code: TRIP_ROOM_WORKSPACE_CHANGED_CODE,
          reason: TRIP_ROOM_WORKSPACE_CHANGED_REASON,
        },
      ])
      expectRoomUntouched(room)
    })

    it('uses a close code in the application range and a reason that names nothing', () => {
      expect(TRIP_ROOM_WORKSPACE_CHANGED_CODE).toBeGreaterThanOrEqual(4000)
      expect(TRIP_ROOM_WORKSPACE_CHANGED_CODE).toBeLessThan(5000)
      expect(TRIP_ROOM_WORKSPACE_CHANGED_REASON).not.toContain(
        alpha.organizationId,
      )
      expect(TRIP_ROOM_WORKSPACE_CHANGED_REASON).not.toContain(tripId)
    })

    it('connects as before when the claim is the workspace the session is in', async () => {
      actAs(alpha.ownerUserId)
      const { namespace, identities } = recordingNamespace()

      const response = await serveTripRoom(
        namespace,
        claiming(alpha.organizationId),
        tripId,
      )

      expect(response.status).toBe(200)
      expect(identities).toHaveLength(1)
      expect(identities[0]?.orgId).toBe(alpha.organizationId)
      expect(pair.server.closed).toEqual([])
    })

    it.each([
      ['missing', ''],
      ['empty', '?workspace='],
      ['too long', `?workspace=${'a'.repeat(65)}`],
      ['outside the id alphabet', '?workspace=not%20an%20id%21'],
    ])(
      'behaves exactly as today when the claim is %s',
      async (_name, query) => {
        actAs(alpha.ownerUserId)
        const { namespace, identities } = recordingNamespace()

        const response = await serveTripRoom(
          namespace,
          upgrade(tripId, query),
          tripId,
        )

        expect(response.status).toBe(200)
        expect(identities).toHaveLength(1)
        expect(pair.server.accepted).toBe(0)
        expect(pair.server.closed).toEqual([])
      },
    )

    it('still answers 404 for a trip of another workspace when the claim matches', async () => {
      const beta = await harness.seedTenant('beta')
      stubs.ctx = {
        userId: beta.ownerUserId,
        organizationId: beta.organizationId,
        role: 'owner',
        impersonatedBy: null,
      }
      const { namespace, identities } = recordingNamespace()

      const response = await serveTripRoom(
        namespace,
        claiming(beta.organizationId),
        tripId,
      )

      expect(response.status).toBe(404)
      expect(identities).toEqual([])
      expect(pair.server.accepted).toBe(0)
    })

    it('answers a mismatching claim the same for a trip that exists elsewhere and one that exists nowhere', async () => {
      const beta = await harness.seedTenant('beta')
      stubs.ctx = {
        userId: beta.ownerUserId,
        organizationId: beta.organizationId,
        role: 'owner',
        impersonatedBy: null,
      }
      const room = recordingNamespace()
      const { namespace } = room

      // `tripId` exists only in alpha; the caller is in beta and claims alpha.
      const existing = await serveTripRoom(
        namespace,
        claiming(alpha.organizationId),
        tripId,
      )
      const unknown = await serveTripRoom(
        namespace,
        claiming(alpha.organizationId, 'no-such-trip'),
        'no-such-trip',
      )

      expect(existing.status).toBe(unknown.status)
      expect(pair.server.closed).toEqual([
        {
          code: TRIP_ROOM_WORKSPACE_CHANGED_CODE,
          reason: TRIP_ROOM_WORKSPACE_CHANGED_REASON,
        },
        {
          code: TRIP_ROOM_WORKSPACE_CHANGED_CODE,
          reason: TRIP_ROOM_WORKSPACE_CHANGED_REASON,
        },
      ])
      expectRoomUntouched(room)
    })

    it('closes a claim naming a workspace the caller is not in like any other mismatch', async () => {
      actAs(alpha.ownerUserId)
      const stranger = await harness.seedTenant('stranger')
      const room = recordingNamespace()
      const { namespace } = room

      await serveTripRoom(namespace, claiming(stranger.organizationId), tripId)

      expect(pair.server.closed).toEqual([
        {
          code: TRIP_ROOM_WORKSPACE_CHANGED_CODE,
          reason: TRIP_ROOM_WORKSPACE_CHANGED_REASON,
        },
      ])
      expectRoomUntouched(room)
    })

    it('never lets the claim choose the workspace the room is addressed in', async () => {
      const beta = await harness.seedTenant('beta')
      actAs(alpha.ownerUserId)
      const { namespace, identities } = recordingNamespace()

      await serveTripRoom(namespace, claiming(beta.organizationId), tripId)

      expect(identities).toEqual([])
      expect(vi.mocked(getTrip)).not.toHaveBeenCalled()
    })

    it('answers 401 before it compares anything when signed out', async () => {
      stubs.signedIn = false
      const room = recordingNamespace()
      const { namespace } = room

      const response = await serveTripRoom(
        namespace,
        claiming('some-other-workspace-id'),
        tripId,
      )

      expect(response.status).toBe(401)
      expect(pair.server.accepted).toBe(0)
      expectRoomUntouched(room)
    })

    it('answers 403 before it compares anything when the caller has no workspace', async () => {
      stubs.ctx = null
      const room = recordingNamespace()
      const { namespace } = room

      const response = await serveTripRoom(
        namespace,
        claiming('some-other-workspace-id'),
        tripId,
      )

      expect(response.status).toBe(403)
      expect(pair.server.accepted).toBe(0)
      expectRoomUntouched(room)
    })

    it('answers 426 before it compares anything when the request is not an upgrade', async () => {
      actAs(alpha.ownerUserId)
      const room = recordingNamespace()
      const { namespace } = room

      const response = await serveTripRoom(
        namespace,
        new Request(
          `https://planned.travel/api/trip-room/${tripId}?workspace=some-other-workspace-id`,
        ),
        tripId,
      )

      expect(response.status).toBe(426)
      expect(pair.server.accepted).toBe(0)
      expectRoomUntouched(room)
    })
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
