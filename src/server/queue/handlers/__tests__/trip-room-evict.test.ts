/**
 * The `trip-room-evict` handler: which rooms are told to close which person when they lose their
 * place in a workspace (#1073), that another workspace's rooms are never touched, and that a room
 * which cannot be reached fails the job (so the queue retries it) after every other room was tried.
 *
 * Everything below the handler is real - the harness's migrated SQLite database, two tenants and the
 * repositories - except the two seams the handler is built over: the database handle, and a
 * recording `TRIP_ROOM` namespace.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { addTripMember, createTrip } from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import { createLogger, createMemorySink } from '#/server/observability/logger'
import { taskHandlers } from '../../consumer'
import { buildTaskEnvelope } from '../../jobs'
import { TaskConfigurationError, tripRoomEvictPayloadSchema } from '../../types'
import {
  ROOM_EVICTION_WARN_THRESHOLD,
  createTripRoomEvictHandler,
  handleTripRoomEvict,
} from '../trip-room-evict'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { LogRecord } from '#/server/observability/logger'
import type { TaskBindings, TaskContext } from '../../types'

const NOW = Date.parse('2026-10-10T09:00:00.000Z')

function recordingNamespace(failing: ReadonlySet<string> = new Set()) {
  const closed: Array<{ room: string; body: string }> = []
  let inFlight = 0
  let peak = 0
  const namespace: NonNullable<TaskBindings['TRIP_ROOM']> = {
    idFromName: (name) => name as unknown as DurableObjectId,
    get: (id) => ({
      fetch: async (request) => {
        const room = id as unknown as string
        inFlight += 1
        peak = Math.max(peak, inFlight)
        await Promise.resolve()
        inFlight -= 1
        if (failing.has(room)) return new Response(null, { status: 500 })
        closed.push({ room, body: await request.text() })
        return new Response(null, { status: 200 })
      },
    }),
  }
  return { namespace, closed, peak: () => peak }
}

function fakeEnv(overrides: Partial<TaskBindings> = {}): TaskBindings {
  return {
    KV: {
      get: async () => null,
      put: async () => undefined,
      delete: async () => undefined,
      list: async () => ({ keys: [], list_complete: true }),
    },
    FILES: {
      get: async () => null,
      put: async () => undefined,
      head: async () => null,
      delete: async () => undefined,
      list: async () => ({ objects: [], truncated: false }),
    },
    TASKS: { send: async () => undefined, sendBatch: async () => undefined },
    DB: {} as TaskBindings['DB'],
    ...overrides,
  }
}

let harness: Harness
let alpha: SeededTenant
let beta: SeededTenant
let personId: string
let sink: ReturnType<typeof createMemorySink>

function context(orgId: string, env: TaskBindings): TaskContext {
  return {
    env,
    logger: createLogger({ level: 'info', sink }),
    now: () => NOW,
    attempt: 1,
    taskId: 'task-under-test',
    orgId,
    callProvider: (_label, send) => send(),
  }
}

const evict = (orgId: string, env: TaskBindings, userId: string = personId) =>
  createTripRoomEvictHandler(() => harness.db)({ userId }, context(orgId, env))

const tripIn = (tenant: SeededTenant, title: string, open = false) =>
  createTrip(tenant.scope, {
    title,
    currency: 'EUR',
    ...(open ? { visibility: 'organization' as const } : {}),
  })

function records(level: LogRecord['level']): Array<LogRecord> {
  return sink.records.filter((record) => record.level === level)
}

beforeEach(async () => {
  sink = createMemorySink()
  harness = await createHarness()
  alpha = await harness.seedTenant('alpha')
  beta = await harness.seedTenant('beta')
  await subscribeTenant(alpha.scope, 'crew', 5)
  await subscribeTenant(beta.scope, 'crew', 5)
  personId = await alpha.addUser('Person')
  await beta.addMembership(personId)
})

afterEach(() => {
  harness.close()
})

describe('the trip-room-evict envelope', () => {
  it('is registered with the consumer and validates strictly', () => {
    expect(taskHandlers['trip-room-evict']).toBe(handleTripRoomEvict)
    expect(tripRoomEvictPayloadSchema.safeParse({ userId: 'u' }).success).toBe(
      true,
    )
    expect(
      tripRoomEvictPayloadSchema.safeParse({ userId: 'u', tripId: 't' })
        .success,
    ).toBe(false)
    expect(
      buildTaskEnvelope({
        kind: 'trip-room-evict',
        orgId: 'org',
        payload: { userId: 'u' },
      }).kind,
    ).toBe('trip-room-evict')
  })
})

describe('closing a departed person’s trip-room sockets', () => {
  it('closes the person in every room they could open in the envelope’s workspace, and no other', async () => {
    const open = await tripIn(alpha, 'Open trip', true)
    const joined = await tripIn(alpha, 'Joined trip')
    await addTripMember(alpha.scope, {
      tripId: joined.id,
      userId: personId,
      role: 'viewer',
    })
    await tripIn(alpha, 'Private, not theirs')
    const betaTrip = await tripIn(beta, 'Other workspace, open', true)
    const { namespace, closed } = recordingNamespace()

    const metrics = await evict(
      alpha.organizationId,
      fakeEnv({ TRIP_ROOM: namespace }),
    )

    expect(closed.map((call) => call.room).sort()).toEqual(
      [open.id, joined.id].sort(),
    )
    expect(
      closed.every(
        (call) => call.body === JSON.stringify({ userId: personId }),
      ),
    ).toBe(true)
    expect(closed.map((call) => call.room)).not.toContain(betaTrip.id)
    expect(metrics).toEqual({ rooms: 2, failed: 0 })
  })

  it('still reaches the trips a person was on after their membership row is gone', async () => {
    const joined = await tripIn(alpha, 'Joined trip')
    await addTripMember(alpha.scope, {
      tripId: joined.id,
      userId: personId,
      role: 'editor',
    })
    harness.sqlite
      .prepare('delete from member where organization_id = ? and user_id = ?')
      .run(alpha.organizationId, personId)
    const { namespace, closed } = recordingNamespace()

    await evict(alpha.organizationId, fakeEnv({ TRIP_ROOM: namespace }))

    expect(closed.map((call) => call.room)).toEqual([joined.id])
  })

  it('includes an archived trip, which a viewer can still connect to', async () => {
    const archived = await createTrip(alpha.scope, {
      title: 'Archived',
      currency: 'EUR',
      visibility: 'organization',
      isArchived: true,
    })
    const { namespace, closed } = recordingNamespace()

    await evict(alpha.organizationId, fakeEnv({ TRIP_ROOM: namespace }))

    expect(closed.map((call) => call.room)).toEqual([archived.id])
  })

  it('tries every room, logs the refusing one with ids only, and fails the job so it is retried', async () => {
    const first = await tripIn(alpha, 'First', true)
    const second = await tripIn(alpha, 'Second', true)
    const { namespace, closed } = recordingNamespace(new Set([first.id]))

    await expect(
      evict(alpha.organizationId, fakeEnv({ TRIP_ROOM: namespace })),
    ).rejects.toThrow(/1 of 2/)

    expect(closed.map((call) => call.room)).toEqual([second.id])
    const warnings = records('warn')
    expect(warnings).toHaveLength(1)
    expect(warnings[0].msg).toBe('trip room eviction failed')
    expect(warnings[0]).toMatchObject({
      tripId: first.id,
      organizationId: alpha.organizationId,
      userId: personId,
    })
    const logged = JSON.stringify(sink.records)
    expect(logged).not.toContain('example.test')
    expect(logged).not.toContain('"Person"')
  })

  it('calls at most a handful of rooms at once', async () => {
    for (let index = 0; index < 20; index += 1) {
      await tripIn(alpha, `Trip ${index}`, true)
    }
    const { namespace, closed, peak } = recordingNamespace()

    const metrics = await evict(
      alpha.organizationId,
      fakeEnv({ TRIP_ROOM: namespace }),
    )

    expect(closed).toHaveLength(20)
    expect(peak()).toBeLessThanOrEqual(10)
    expect(metrics).toEqual({ rooms: 20, failed: 0 })
    expect(records('warn')).toEqual([])
  })

  it('warns, and still closes every room, above the size that should be sharded', async () => {
    const tripIds = Array.from(
      { length: ROOM_EVICTION_WARN_THRESHOLD + 1 },
      (_, index) => `trip-${index}`,
    )
    const { namespace, closed } = recordingNamespace()
    const handler = createTripRoomEvictHandler(
      () => harness.db,
      async () => tripIds,
    )

    await handler(
      { userId: personId },
      context(alpha.organizationId, fakeEnv({ TRIP_ROOM: namespace })),
    )

    expect(closed).toHaveLength(tripIds.length)
    expect(records('warn').map((record) => record.msg)).toEqual([
      'trip room eviction fan-out is large',
    ])
  })

  it('does nothing for a workspace with no rooms', async () => {
    const { namespace, closed } = recordingNamespace()

    await expect(
      evict(alpha.organizationId, fakeEnv({ TRIP_ROOM: namespace })),
    ).resolves.toEqual({ rooms: 0, failed: 0 })
    expect(closed).toEqual([])
  })

  it('is a configuration error, not a retry, when the room namespace is missing', async () => {
    await expect(evict(alpha.organizationId, fakeEnv())).rejects.toBeInstanceOf(
      TaskConfigurationError,
    )
  })
})
