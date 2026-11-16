import { readPlatformAuditByEntity } from '#/server/catalog/audit'
import { createTrip } from '#/server/repos/trips'
import { tripFilesRepository } from '#/server/repos/files'
import { upsertSubscription } from '#/server/repos/billing'
import { expect, it, vi } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import { deleteWorkspace } from '#/server/fns/workspace-delete-writes'
import { requestOwnerWorkspaceDeletion } from '../request'
import { createWorkspaceDeletionRuntime } from '../runtime'
import { createWorkspaceDeletionDelivery } from '../delivery'
import { fakeBucket } from '#/server/storage/__tests__/fake-bucket'
import { createLogger, createMemorySink } from '#/server/observability/logger'
import { getOrganization } from '#/server/repos/members'
import {
  readWorkspaceDeletionOutcome,
  insertWorkspaceDeletion,
  leaseWorkspaceDeletion,
} from '#/server/catalog/workspace-deletions'
import type { TaskBindings } from '#/server/queue/types'

it('runs the real owner write, delivers a Polish receipt, clears identity and leaves another tenant untouched', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  try {
    const a = await h.seedTenant('alpha')
    const b = await h.seedTenant('beta')
    const send = vi.fn<TaskBindings['TASKS']['send']>(async () => {})
    const queue = { send, sendBatch: vi.fn(async () => {}) }
    const env = {
      POLAR_ACCESS_TOKEN: 'test-token',
      POLAR_SERVER: 'sandbox',
      TASKS: queue,
      FILES: fakeBucket([]),
      KV: { delete: async () => {} },
    } as unknown as TaskBindings
    const delivery = createWorkspaceDeletionDelivery(
      queue,
      { appName: 'planned.travel', appUrl: 'https://example.com' },
      async (id) =>
        (await readWorkspaceDeletionOutcome(h.db, id))?.locale ?? null,
    )
    const runtime = createWorkspaceDeletionRuntime(h.db, env, {
      now: () => new Date(),
      logger: createLogger({ level: 'error', sink: createMemorySink() }),
      send: async () =>
        Response.json({
          items: [],
          pagination: { total_count: 0, max_page: 0 },
        }),
      delivery,
    })
    const continuation = vi.fn<(id: string) => Promise<void>>(async () => {})
    const result = await deleteWorkspace(
      {
        scope: a.scope,
        activated: true,
        impersonated: false,
        proof: async () => null,
        start: () =>
          requestOwnerWorkspaceDeletion(
            h.db,
            {
              scope: a.scope,
              name: 'Workspace alpha',
              email: 'owner@example.com',
              locale: 'pl',
            },
            {
              now: () => new Date(),
              advance: runtime.advance,
              enqueue: continuation,
            },
          ),
      },
      { expectedOrganizationId: a.organizationId, name: 'Workspace alpha' },
    )
    expect(result).toEqual({ ok: true, complete: true })
    expect(continuation).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledOnce()
    const message = send.mock.calls[0]?.[0]
    expect(message).toMatchObject({
      kind: 'email',
      orgId: 'system',
      payload: {
        to: ['owner@example.com'],
        subject: 'Obszar roboczy usunięty',
      },
    })
    expect(JSON.stringify(message)).toContain('Workspace alpha')
    await expect(getOrganization(a.scope)).rejects.toThrow()
    expect((await getOrganization(b.scope)).id).toBe(b.organizationId)
    const id = continuation.mock.calls[0]?.[0]
    const leased = await leaseWorkspaceDeletion(h.db, id, new Date())
    if (!leased || leased === 'busy') throw new Error('Expected persisted row')
    expect(
      await readPlatformAuditByEntity(h.db, {
        entityType: 'workspace',
        entityId: a.organizationId,
        limit: 10,
      }),
    ).toMatchObject([
      {
        action: 'platform.workspace.deleted',
        changes: {
          before: {
            plan: 'free',
            subscriptionStatus: 'active',
            trips: 0,
            fileRows: 0,
          },
        },
      },
    ])
    expect(leased.row).toMatchObject({
      receiptTo: null,
      receiptName: null,
      receiptLocale: null,
    })
  } finally {
    h.close()
  }
})

it('rejects incompatible erasure admission and preserves a ledger when queue acceptance fails', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  try {
    const a = await h.seedTenant('alpha')
    const input = {
      scope: a.scope,
      name: 'Workspace alpha',
      email: 'owner@example.com',
      locale: 'en' as const,
    }
    const advance = vi.fn(async () => 'advanced' as const)
    await expect(
      requestOwnerWorkspaceDeletion(h.db, input, {
        now: () => new Date(),
        advance,
        enqueue: async () => {
          throw new Error('queue unavailable')
        },
      }),
    ).rejects.toThrow('queue unavailable')
    expect(advance).not.toHaveBeenCalled()
    const row = await insertWorkspaceDeletion(h.db, {
      organizationId: a.organizationId,
      initiator: 'owner',
      requestedBy: a.ownerUserId,
    })
    expect(row.receiptTo).toBe('owner@example.com')
    expect(row.state).toBe('requested')
    const b = await h.seedTenant('beta')
    await insertWorkspaceDeletion(h.db, {
      organizationId: b.organizationId,
      initiator: 'erasure',
      erasureId: 'erase',
    })
    await expect(
      requestOwnerWorkspaceDeletion(
        h.db,
        { ...input, scope: b.scope },
        { now: () => new Date(), advance, enqueue: async () => {} },
      ),
    ).rejects.toThrow('Incompatible')
    expect(advance).not.toHaveBeenCalled()
  } finally {
    h.close()
  }
})

it.each([
  'billing-unavailable',
  'has-other-members',
  'live-subscription',
] as const)(
  'returns durable %s refusal and permits a new owner attempt',
  async (reason) => {
    const h = await createHarness({ ddl: 'migrations' })
    try {
      const a = await h.seedTenant('alpha')
      if (reason === 'has-other-members') await a.addUser('member')
      if (reason === 'live-subscription')
        await upsertSubscription(a.scope, {
          plan: 'starter',
          status: 'active',
          providerSubscriptionId: 'subscription',
        })
      let unavailable = reason === 'billing-unavailable'
      const send = vi.fn<TaskBindings['TASKS']['send']>(async () => {})
      const queue = { send, sendBatch: vi.fn(async () => {}) }
      const env = {
        POLAR_ACCESS_TOKEN: 'test-token',
        POLAR_SERVER: 'sandbox',
        TASKS: queue,
        FILES: fakeBucket([]),
        KV: { delete: async () => {} },
      } as unknown as TaskBindings
      const delivery = createWorkspaceDeletionDelivery(
        queue,
        { appName: 'planned.travel', appUrl: 'https://example.com' },
        async (id) =>
          (await readWorkspaceDeletionOutcome(h.db, id))?.locale ?? null,
      )
      const runtime = createWorkspaceDeletionRuntime(h.db, env, {
        now: () => new Date(),
        logger: createLogger({ level: 'error', sink: createMemorySink() }),
        send: async () => {
          if (unavailable) throw new Error('provider unavailable')
          return Response.json({
            items: [],
            pagination: { total_count: 0, max_page: 0 },
          })
        },
        delivery,
      })
      const ids: string[] = []
      const run = () =>
        deleteWorkspace(
          {
            scope: a.scope,
            activated: true,
            impersonated: false,
            proof: async () => null,
            start: () =>
              requestOwnerWorkspaceDeletion(
                h.db,
                {
                  scope: a.scope,
                  name: 'Workspace alpha',
                  email: 'owner@example.com',
                  locale: 'en',
                },
                {
                  now: () => new Date(),
                  advance: runtime.advance,
                  enqueue: async (id) => {
                    ids.push(id)
                  },
                },
              ),
          },
          { expectedOrganizationId: a.organizationId, name: 'Workspace alpha' },
        )
      expect(await run()).toEqual({ ok: false, reason })
      expect((await getOrganization(a.scope)).id).toBe(a.organizationId)
      expect(send).toHaveBeenCalledOnce()
      expect(await readWorkspaceDeletionOutcome(h.db, ids[0])).toMatchObject({
        state: 'refused',
        reason,
        locale: null,
      })
      if (reason === 'billing-unavailable') {
        unavailable = false
        expect(await run()).toEqual({ ok: true, complete: true })
        expect(ids[0]).not.toBe(ids[1])
      }
    } finally {
      h.close()
    }
  },
)

it('retries receipt acceptance with the same identity, retaining PII until accepted and refusing legacy locale guessing', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  try {
    const a = await h.seedTenant('alpha')
    const row = await insertWorkspaceDeletion(h.db, {
      organizationId: a.organizationId,
      initiator: 'owner',
      requestedBy: a.ownerUserId,
      receiptTo: 'owner@example.com',
      receiptName: '<Private>',
      receiptLocale: 'ar',
    })
    const send = vi
      .fn<TaskBindings['TASKS']['send']>()
      .mockRejectedValueOnce(new Error('queue unavailable'))
      .mockResolvedValue(undefined)
    const queue = { send, sendBatch: vi.fn(async () => {}) }
    const delivery = createWorkspaceDeletionDelivery(
      queue,
      { appName: 'planned.travel', appUrl: 'https://example.com' },
      async () => 'ar',
    )
    const env = {
      POLAR_ACCESS_TOKEN: 'test-token',
      POLAR_SERVER: 'sandbox',
      TASKS: queue,
      FILES: fakeBucket([]),
      KV: { delete: async () => {} },
    } as unknown as TaskBindings
    const runtime = createWorkspaceDeletionRuntime(h.db, env, {
      now: () => new Date(),
      logger: createLogger({ level: 'error', sink: createMemorySink() }),
      send: async () =>
        Response.json({
          items: [],
          pagination: { total_count: 0, max_page: 0 },
        }),
      delivery,
    })
    await runtime.advance(row.id)
    await runtime.advance(row.id)
    await expect(runtime.advance(row.id)).rejects.toThrow(
      'Workspace deletion step unavailable',
    )
    expect(await readWorkspaceDeletionOutcome(h.db, row.id)).toMatchObject({
      state: 'rows_deleted',
      locale: 'ar',
    })
    await runtime.advance(row.id)
    expect(send.mock.calls[0]?.[0]).toMatchObject({
      id: `workspace-deletion:${row.id}:receipt`,
      // The enqueue timestamp may differ; delivery identity remains stable.
      kind: 'email',
    })
    const message = send.mock.calls[1]?.[0]
    expect(JSON.stringify(message)).toContain('lang=\\"ar\\"')
    expect(JSON.stringify(message)).toContain('dir=\\"rtl\\"')
    expect(JSON.stringify(message)).toContain('&lt;Private&gt;')
    expect(await readWorkspaceDeletionOutcome(h.db, row.id)).toMatchObject({
      locale: null,
    })
    await expect(
      delivery.receipt({ ...row, receiptLocale: null }),
    ).rejects.toThrow('identity unavailable')
    await expect(
      delivery.receipt({ ...row, initiator: 'erasure' }),
    ).rejects.toThrow('Erasure')
  } finally {
    h.close()
  }
})

it('snapshots tenant counts once and preserves them when a live request is reused', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  try {
    const a = await h.seedTenant('alpha')
    const b = await h.seedTenant('beta')
    for (const tenant of [a, b]) {
      const trip = await createTrip(tenant.scope, { title: 'Trip' })
      await tripFilesRepository.insert(tenant.scope, {
        tripId: trip.id,
        storageKey: `${tenant.organizationId}/file`,
        filename: 'file.pdf',
        contentType: 'application/pdf',
        uploadedBy: tenant.ownerUserId,
      })
    }
    await createTrip(b.scope, { title: 'Second foreign trip' })
    const input = {
      scope: a.scope,
      name: 'Workspace alpha',
      email: 'owner@example.com',
      locale: 'en' as const,
    }
    const ports = {
      now: () => new Date(),
      advance: async () => 'busy' as const,
      enqueue: async () => {},
    }
    expect(await requestOwnerWorkspaceDeletion(h.db, input, ports)).toEqual({
      ok: true,
      complete: false,
    })
    const row = await insertWorkspaceDeletion(h.db, {
      organizationId: a.organizationId,
      initiator: 'owner',
      requestedBy: a.ownerUserId,
    })
    expect(row.snapshot).toEqual({
      plan: 'free',
      subscriptionStatus: 'active',
      trips: 1,
      fileRows: 1,
    })
    // A second request reads new counts but must never overwrite the first accepted snapshot.
    await createTrip(a.scope, { title: 'Later trip' })
    await requestOwnerWorkspaceDeletion(h.db, input, ports)
    const reused = await insertWorkspaceDeletion(h.db, {
      organizationId: a.organizationId,
      initiator: 'owner',
      requestedBy: a.ownerUserId,
    })
    expect(reused.id).toBe(row.id)
    expect(reused.snapshot).toEqual(row.snapshot)
    expect((await getOrganization(b.scope)).id).toBe(b.organizationId)
  } finally {
    h.close()
  }
})
