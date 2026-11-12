import { eq } from 'drizzle-orm'
import { newId } from '#/server/db/schema'
import { member } from '#/server/db/auth-schema'
import { expect, it, vi } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import { createTrip, requireTrip } from '#/server/repos/trips'
import { getOrganization } from '#/server/repos/members'
import {
  insertWorkspaceDeletion,
  leaseWorkspaceDeletion,
} from '#/server/catalog/workspace-deletions'
import { createLogger, createMemorySink } from '#/server/observability/logger'
import { consumeTaskBatch, createTaskHandlers } from '#/server/queue/consumer'
import { buildTaskEnvelope } from '#/server/queue/jobs'
import { createWorkspaceDeletionRuntime } from '../runtime'
import { TaskPermanentError, TaskRetryableError } from '#/server/queue/types'
import type { TaskBindings } from '#/server/queue/types'

it('uses ledger authority for real room closure, deletion and queue-independent recovery', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  let clock = Date.now()
  try {
    const a = await h.seedTenant('alpha')
    const b = await h.seedTenant('beta')
    const trip = await createTrip(a.scope, { title: 'Deleted trip' })
    const kept = await createTrip(b.scope, { title: 'Kept trip' })
    const closed: Array<string> = []
    const invalidated: Array<string> = []
    const env = bindings(closed, invalidated)
    const row = await insertWorkspaceDeletion(
      h.db,
      {
        organizationId: a.organizationId,
        initiator: 'owner',
        requestedBy: a.ownerUserId,
      },
      new Date(clock),
    )
    const runtime = createWorkspaceDeletionRuntime(h.db, env, {
      now: () => new Date(clock),
      logger: createLogger({ level: 'error', sink: createMemorySink() }),
      send: async () =>
        Response.json({
          items: [],
          pagination: { total_count: 0, max_page: 0 },
        }),
    })
    // A fresh record is not cron work; the queue/request advance takes its first bounded step.
    expect(await runtime.recover()).toEqual([])
    expect(await runtime.advance(row.id)).toBe('advanced')
    expect(closed).toEqual([trip.id])
    clock += 900_001
    expect(await runtime.recover()).toEqual([
      { status: 'fulfilled', value: 'advanced' },
    ])
    await expect(getOrganization(a.scope)).rejects.toThrow()
    expect((await requireTrip(b.scope, kept.id)).id).toBe(kept.id)
    expect(invalidated).toHaveLength(1)
    expect(closed).not.toContain(kept.id)
    // Audit/reconciliation/sweeps are reached by the direct recovery branch, without queue hops.
    for (let step = 0; step < 3; step += 1) {
      clock += 900_001
      await runtime.recover()
    }
    const terminal = await leaseWorkspaceDeletion(h.db, row.id, new Date(clock))
    expect(terminal).toBeNull()
  } finally {
    h.close()
  }
})

function bindings(
  closed: Array<string> = [],
  invalidated: Array<string> = [],
): TaskBindings {
  return {
    DB: {} as D1Database,
    POLAR_ACCESS_TOKEN: 'test-token',
    POLAR_SERVER: 'sandbox',
    KV: {
      get: async () => null,
      put: async () => undefined,
      delete: async (key) => {
        invalidated.push(key)
      },
      list: async () => ({ keys: [], list_complete: true }),
    },
    FILES: {
      get: async () => null,
      put: async () => undefined,
      head: async () => null,
      delete: async () => undefined,
      list: async () => ({ objects: [], truncated: false }),
    },
    TASKS: {
      send: async () => {
        throw new Error('Recovery must not use the queue')
      },
      sendBatch: async () => {
        throw new Error('Recovery must not use the queue')
      },
    },
    TRIP_ROOM: {
      idFromName: (id) => {
        closed.push(id)
        return {} as DurableObjectId
      },
      get: () => ({ fetch: async () => new Response(null) }),
    },
  }
}

it('keeps receipt PII and state until an actual delivery adapter accepts it', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  let clock = Date.now()
  try {
    const a = await h.seedTenant('receipt')
    const row = await insertWorkspaceDeletion(
      h.db,
      {
        organizationId: a.organizationId,
        initiator: 'owner',
        requestedBy: a.ownerUserId,
        receiptTo: 'owner@example.com',
        receiptName: 'Private workspace',
      },
      new Date(clock),
    )
    const sink = createMemorySink()
    const options = {
      now: () => new Date(clock),
      logger: createLogger({ level: 'error', sink }),
      send: async () =>
        Response.json({
          items: [],
          pagination: { total_count: 0, max_page: 0 },
        }),
    }
    const env = bindings()
    const runtime = createWorkspaceDeletionRuntime(h.db, env, options)
    expect(await runtime.advance(row.id)).toBe('advanced')
    expect(await runtime.advance(row.id)).toBe('advanced')
    await expect(runtime.advance(row.id)).rejects.toThrow(
      'Workspace deletion step unavailable',
    )
    expect(
      sink.records.some(
        (record) => record.msg === 'workspace-deletion.step-unavailable',
      ),
    ).toBe(true)
    expect(JSON.stringify(sink.records)).not.toContain('owner@example.com')
    expect(JSON.stringify(sink.records)).not.toContain('Private workspace')
    const lease = await leaseWorkspaceDeletion(h.db, row.id, new Date(clock))
    if (!lease || lease === 'busy') throw new Error('Missing retryable row')
    expect(lease.row).toMatchObject({
      state: 'rows_deleted',
      receiptTo: 'owner@example.com',
      receiptName: 'Private workspace',
      lastError: 'step-unavailable',
    })
    clock += 300_001
    let delivered = 0
    const activated = createWorkspaceDeletionRuntime(h.db, env, {
      ...options,
      delivery: {
        refusalNotice: async () => {
          throw new Error('Unexpected refusal')
        },
        receipt: async (leased) => {
          expect(leased.id).toBe(row.id)
          delivered += 1
        },
        resumeErasure: async () => {
          throw new Error('Not erasure')
        },
      },
    })
    expect(await activated.advance(row.id)).toBe('pending')
    expect(delivered).toBe(1)
    const cleared = await leaseWorkspaceDeletion(h.db, row.id, new Date(clock))
    if (!cleared || cleared === 'busy') throw new Error('Missing cleared row')
    expect(cleared.row).toMatchObject({
      state: 'rows_deleted',
      receiptTo: null,
      receiptName: null,
    })
  } finally {
    h.close()
  }
})

it('erases each erasure room before deleting its trip and retains rows when room reset fails', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  const clock = Date.now()
  try {
    const a = await h.seedTenant('erasure')
    const trip = await createTrip(a.scope, { title: 'Erase room' })
    await h.db.delete(member).where(eq(member.organizationId, a.organizationId))
    const row = await insertWorkspaceDeletion(
      h.db,
      {
        organizationId: a.organizationId,
        initiator: 'erasure',
        erasureId: 'erase-owner',
      },
      new Date(clock),
    )
    const env = bindings()
    let resetFails = true
    const requests: Array<Request> = []
    env.TRIP_ROOM = {
      idFromName: () => ({}) as DurableObjectId,
      get: () => ({
        fetch: async (request) => {
          requests.push(request)
          return new Response(null, { status: resetFails ? 503 : 200 })
        },
      }),
    }
    const runtime = createWorkspaceDeletionRuntime(h.db, env, {
      now: () => new Date(clock),
      logger: createLogger({ level: 'error', sink: createMemorySink() }),
      send: async () =>
        Response.json({
          items: [],
          pagination: { total_count: 0, max_page: 0 },
        }),
    })
    await expect(runtime.advance(row.id)).rejects.toThrow(
      'Workspace deletion step unavailable',
    )
    expect((await requireTrip(a.scope, trip.id)).id).toBe(trip.id)
    resetFails = false
    expect(await runtime.advance(row.id)).toBe('advanced')
    await expect(requireTrip(a.scope, trip.id)).rejects.toThrow()
    expect(requests).toHaveLength(2)
    expect(requests.every((request) => request.url.endsWith('/reset'))).toBe(
      true,
    )
  } finally {
    h.close()
  }
})

it('the registered consumer ignores envelope tenant authority and advances only the leased ledger row', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  vi.stubGlobal('fetch', async () =>
    Response.json({ items: [], pagination: { total_count: 0, max_page: 0 } }),
  )
  try {
    const a = await h.seedTenant('ledger')
    const b = await h.seedTenant('envelope')
    const removed = await createTrip(a.scope, { title: 'Ledger trip' })
    const kept = await createTrip(b.scope, { title: 'Envelope trip' })
    const row = await insertWorkspaceDeletion(h.db, {
      organizationId: a.organizationId,
      initiator: 'owner',
      requestedBy: a.ownerUserId,
    })
    const closed: Array<string> = []
    const env = bindings(closed)
    const sent: Array<unknown> = []
    env.TASKS.send = async (body) => {
      sent.push(body)
    }
    const body = buildTaskEnvelope({
      kind: 'workspace-deletion',
      orgId: b.organizationId,
      payload: { deletionId: row.id },
    })
    const result = await consumeTaskBatch(
      {
        messages: [
          {
            id: 'forged-tenant',
            body,
            attempts: 1,
            ack: () => undefined,
            retry: () => {
              throw new Error('No retry')
            },
          },
        ],
      },
      env,
      createLogger({ level: 'error', sink: createMemorySink() }),
      { registry: createTaskHandlers(() => h.db) },
    )
    expect(result).toMatchObject({ acked: 1, retried: 0, deadLettered: 0 })
    expect(closed).toEqual([removed.id])
    await expect(requireTrip(a.scope, removed.id)).rejects.toThrow()
    expect((await requireTrip(b.scope, kept.id)).id).toBe(kept.id)
    expect(sent).toEqual([
      expect.objectContaining({
        orgId: 'system',
        kind: 'workspace-deletion',
        payload: { deletionId: row.id },
      }),
    ])
  } finally {
    vi.unstubAllGlobals()
    h.close()
  }
})

it.each([
  ['retry', 1],
  ['retry', 5],
  ['permanent', 1],
  ['permanent', 5],
  ['polar', 1],
  ['polar', 5],
  ['checkpoint', 1],
  ['checkpoint', 5],
] as const)(
  'sanitizes %s errors at every registered-consumer sink on attempt %i',
  async (failure, attempts) => {
    const h = await createHarness({ ddl: 'migrations' })
    const marker = 'SENSITIVE-provider-body-owner@example.com'
    const sink = createMemorySink()
    const kvWrites: Array<unknown> = []
    const objects: Array<unknown> = []
    vi.stubGlobal('fetch', async () =>
      Response.json({ items: [], pagination: { total_count: 0, max_page: 0 } }),
    )
    try {
      const a = await h.seedTenant('sanitize')
      const row = await insertWorkspaceDeletion(h.db, {
        organizationId: a.organizationId,
        initiator: 'owner',
        requestedBy: a.ownerUserId,
      })
      const env = bindings()
      const logger = createLogger({ level: 'debug', sink })
      const runtime = createWorkspaceDeletionRuntime(h.db, env, {
        now: () => new Date(),
        logger,
        send: async () =>
          Response.json({
            items: [],
            pagination: { total_count: 0, max_page: 0 },
          }),
      })
      expect(await runtime.advance(row.id)).toBe('advanced')
      if (failure === 'polar') {
        expect(await runtime.advance(row.id)).toBe('advanced')
        vi.stubGlobal(
          'fetch',
          async () => new Response(marker, { status: 401 }),
        )
      } else {
        env.KV.delete = async () => {
          if (failure === 'permanent')
            throw new TaskPermanentError(marker, { cause: new Error(marker) })
          throw new TaskRetryableError(marker, {
            retryAfterSeconds: 73,
            cause: new Error(marker),
          })
        }
        if (failure === 'checkpoint')
          h.sqlite.exec(
            `create trigger checkpoint_failure before update on workspace_deletions when NEW.last_error = 'step-unavailable' begin select raise(ABORT, '${marker}'); end`,
          )
      }
      env.KV.put = async (key, value) => {
        kvWrites.push({ key, value })
      }
      env.FILES.put = async (key, value) => {
        objects.push({ key, value })
      }
      const retry = vi.fn()
      const body = buildTaskEnvelope({
        kind: 'workspace-deletion',
        orgId: 'system',
        payload: { deletionId: row.id },
      })
      const result = await consumeTaskBatch(
        {
          messages: [
            { id: 'sanitization', body, attempts, ack: vi.fn(), retry },
          ],
        },
        env,
        logger,
        { registry: createTaskHandlers(() => h.db) },
      )
      const dead = failure === 'permanent' || attempts === 5
      expect(result).toMatchObject(
        dead
          ? { retried: 0, deadLettered: 1 }
          : { retried: 1, deadLettered: 0 },
      )
      if (!dead && failure === 'retry')
        expect(retry).toHaveBeenCalledWith({ delaySeconds: 73 })
      if (dead) {
        expect(kvWrites).toHaveLength(1)
        expect(objects).toHaveLength(1)
      }
      expect(
        kvWrites.some((entry) => JSON.stringify(entry).includes('task:done:')),
      ).toBe(false)
      expect(
        JSON.stringify({ logs: sink.records, kvWrites, objects }),
      ).not.toContain(marker)
      expect(
        JSON.stringify({ logs: sink.records, kvWrites, objects }),
      ).toContain('Workspace deletion step unavailable')
      expect(
        h.sqlite
          .prepare(
            'select state, last_error, refusal_reason from workspace_deletions where id = ?',
          )
          .get(row.id),
      ).toMatchObject({
        state: failure === 'polar' ? 'rows_deleted' : 'drained',
        last_error: failure === 'checkpoint' ? null : 'step-unavailable',
        refusal_reason: null,
      })
    } finally {
      vi.unstubAllGlobals()
      h.close()
    }
  },
)

it('retains PII after a committed drain batch and refused notice, then only clears after accepted notice and audit', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  let clock = Date.now()
  try {
    const a = await h.seedTenant('partial')
    const b = await h.seedTenant('survivor')
    const insert = h.sqlite.prepare(
      'insert into trips (id, organization_id, title, slug, currency, created_by, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    for (let n = 0; n < 101; n += 1) {
      const id = newId()
      insert.run(
        id,
        a.organizationId,
        'Drain batch',
        id,
        'EUR',
        a.ownerUserId,
        clock,
        clock,
      )
    }
    const kept = await createTrip(b.scope, { title: 'Survivor' })
    const row = await insertWorkspaceDeletion(
      h.db,
      {
        organizationId: a.organizationId,
        initiator: 'owner',
        requestedBy: a.ownerUserId,
        receiptTo: 'private@example.com',
        receiptName: 'Private workspace',
      },
      new Date(clock),
    )
    const env = bindings()
    let rooms = 0
    env.TRIP_ROOM = {
      idFromName: () => ({}) as DurableObjectId,
      get: () => ({
        fetch: async () => {
          rooms += 1
          if (rooms === 101)
            await h.db.insert(member).values({
              id: 'late-member',
              organizationId: a.organizationId,
              userId: b.ownerUserId,
              role: 'member',
              createdAt: new Date(clock),
            })
          return new Response(null)
        },
      }),
    }
    const sink = createMemorySink()
    const options = {
      now: () => new Date(clock),
      logger: createLogger({ level: 'debug', sink }),
      send: async () =>
        Response.json({
          items: [],
          pagination: { total_count: 0, max_page: 0 },
        }),
    }
    await expect(
      createWorkspaceDeletionRuntime(h.db, env, options).advance(row.id),
    ).rejects.toThrow('Workspace deletion step unavailable')
    // First batch committed; joining before the next guarded delete refused the remainder.
    const survivors = h.sqlite
      .prepare('select id from trips where organization_id = ?')
      .all(a.organizationId)
    expect(survivors).toHaveLength(1)
    expect((await requireTrip(b.scope, kept.id)).id).toBe(kept.id)
    const lease = await leaseWorkspaceDeletion(h.db, row.id, new Date(clock))
    if (!lease || lease === 'busy') throw new Error('Missing refusal intent')
    expect(lease.row).toMatchObject({
      state: 'requested',
      refusalReason: 'has-other-members',
      receiptTo: 'private@example.com',
      receiptName: 'Private workspace',
    })
    await h.db.delete(member).where(eq(member.id, 'late-member'))
    clock += 300_001
    const notice = vi.fn(async (request: { readonly id: string }) => ({
      accepted: true as const,
      id: request.id,
    }))
    const runtime = createWorkspaceDeletionRuntime(h.db, env, {
      ...options,
      delivery: {
        refusalNotice: notice,
        receipt: async () => {
          throw new Error('Not a receipt')
        },
        resumeErasure: async () => {
          throw new Error('Not erasure')
        },
      },
    })
    expect(await runtime.advance(row.id)).toBe('advanced')
    expect(notice).toHaveBeenCalledTimes(1)
    expect(notice.mock.calls[0][0]).toMatchObject({
      kind: 'workspace-deletion-refused',
      id: `workspace-deletion:${row.id}:refused`,
      deletionId: row.id,
      reason: 'has-other-members',
      to: 'private@example.com',
    })
    expect(
      h.sqlite
        .prepare('select id from trips where organization_id = ?')
        .all(a.organizationId),
    ).toEqual(survivors)
    expect((await getOrganization(a.scope)).id).toBe(a.organizationId)
    expect(
      h.sqlite
        .prepare(
          'select state, receipt_to, receipt_name from workspace_deletions where id = ?',
        )
        .get(row.id),
    ).toMatchObject({ state: 'refused', receipt_to: null, receipt_name: null })
    expect(
      sink.records.find(
        (record) => record.msg === 'workspace-deletion.refused',
      ),
    ).toMatchObject({ level: 'error', reason: 'has-other-members' })
    expect(JSON.stringify(sink.records)).not.toContain('private@example.com')
    expect(JSON.stringify(sink.records)).not.toContain('Private workspace')
  } finally {
    h.close()
  }
})

it.each(['owner', 'erasure'] as const)(
  'registered queue and cron runtime fail closed for %s refusal without adapters',
  async (initiator) => {
    const h = await createHarness({ ddl: 'migrations' })
    let clock = Date.now()
    const kvWrites: Array<string> = []
    try {
      const a = await h.seedTenant('unactivated')
      const row = await insertWorkspaceDeletion(
        h.db,
        initiator === 'owner'
          ? {
              organizationId: a.organizationId,
              initiator,
              requestedBy: a.ownerUserId,
              receiptTo: 'private@example.com',
            }
          : {
              organizationId: a.organizationId,
              initiator,
              erasureId: 'erase-alpha',
            },
        new Date(clock),
      )
      // Fixture pins a persisted refusal that must never re-enter billing/drain.
      h.sqlite
        .prepare(
          "update workspace_deletions set refusal_reason = 'has-other-members' where id = ?",
        )
        .run(row.id)
      const env = bindings()
      env.KV.put = async (key) => {
        kvWrites.push(key)
      }
      const logger = createLogger({ level: 'error', sink: createMemorySink() })
      const body = buildTaskEnvelope({
        kind: 'workspace-deletion',
        orgId: 'system',
        payload: { deletionId: row.id },
      })
      const result = await consumeTaskBatch(
        {
          messages: [
            {
              id: 'unactivated',
              body,
              attempts: 1,
              ack: () => {
                throw new Error('Must not acknowledge')
              },
              retry: () => {},
            },
          ],
        },
        env,
        logger,
        { registry: createTaskHandlers(() => h.db), now: () => clock },
      )
      expect(result).toMatchObject({ acked: 0, retried: 1, deadLettered: 0 })
      expect(kvWrites.some((key) => key.startsWith('task:done:'))).toBe(false)
      clock += 900_001
      const runtime = createWorkspaceDeletionRuntime(h.db, env, {
        now: () => new Date(clock),
        logger,
        send: async () => {
          throw new Error('No billing call')
        },
      })
      expect((await runtime.recover())[0].status).toBe('rejected')
      expect(
        h.sqlite
          .prepare(
            'select state, erasure_consumer, receipt_to from workspace_deletions where id = ?',
          )
          .get(row.id),
      ).toMatchObject({
        state: 'requested',
        erasure_consumer: null,
        receipt_to: initiator === 'owner' ? 'private@example.com' : null,
      })
    } finally {
      h.close()
    }
  },
)
