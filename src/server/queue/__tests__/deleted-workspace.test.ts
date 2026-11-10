import { eq } from 'drizzle-orm'
import { expect, it, vi } from 'vitest'
import { organization } from '#/server/db/auth-schema'
import { createHarness } from '#/server/repos/__tests__/harness'
import { getOrganization } from '#/server/repos/members'
import { createLogger, createMemorySink } from '#/server/observability/logger'
import { consumeTaskBatch, createTaskHandlers } from '../consumer'
import { buildTaskEnvelope } from '../jobs'
import { createPdfExportHandler } from '../handlers/pdf-export'
import { createTravelStatsHandler } from '../handlers/travel-stats'
import { createTripPurgeHandler } from '../handlers/trip-purge'
import { createTripCopyHandler } from '../handlers/trip-copy'
import { createTripRoomEvictHandler } from '../handlers/trip-room-evict'
import { createWorkspaceLateSubscriptionHandler } from '../handlers/workspace-late-subscription'
import { createParticipantBackfillHandler } from '../handlers/participant-backfill'
import { createBillingHandlers } from '../handlers/billing'
import { createTrip, requireTrip } from '#/server/repos/trips'
import type { TaskBindings } from '../types'

it('settles workspace tasks after the cascade without dead letters or effects on a surviving workspace', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  try {
    const a = await h.seedTenant('alpha')
    const b = await h.seedTenant('beta')
    const trip = await createTrip(b.scope, { title: 'Surviving trip' })
    await h.db.delete(organization).where(eq(organization.id, a.organizationId))
    const writes: Array<string> = []
    const removed: Array<string> = []
    const env: TaskBindings = {
      DB: {} as D1Database,
      KV: {
        get: async () => null,
        put: async (key) => {
          writes.push(key)
        },
        delete: async () => undefined,
        list: async () => ({ keys: [], list_complete: true }),
      },
      FILES: {
        get: async () => {
          throw new Error('Deleted source must not be read')
        },
        put: async () => {
          throw new Error('No artifact or dead letter')
        },
        delete: async (keys) => {
          removed.push(...(typeof keys === 'string' ? [keys] : keys))
        },
        head: async () => null,
        list: async () => ({ objects: [], truncated: false }),
      },
      TASKS: {
        send: async () => {
          throw new Error('No follow-up')
        },
        sendBatch: async () => {
          throw new Error('No follow-up')
        },
      },
      TRIP_ROOM: {
        idFromName: () => {
          throw new Error('No surviving room may be addressed')
        },
        get: () => {
          throw new Error('No surviving room may be addressed')
        },
      },
    }
    let acked = 0
    const body = buildTaskEnvelope({
      kind: 'booking-import',
      orgId: a.organizationId,
      id: 'gone-import',
      payload: {
        tripId: 'gone-trip',
        requestedBy: a.ownerUserId,
        sourceKey: `trips/${a.organizationId}/gone-trip/source.ics`,
        sourceName: 'source.ics',
        format: 'ics',
      },
    })
    const db = () => h.db
    const billing = createBillingHandlers(db)
    const registry = {
      ...createTaskHandlers(db),
      'pdf-export': createPdfExportHandler(db),
      'travel-stats': createTravelStatsHandler(db),
      'trip-purge': createTripPurgeHandler(db),
      'trip-copy': createTripCopyHandler(db),
      'trip-room-evict': createTripRoomEvictHandler(db),
      'billing.subscription.changed': billing.subscriptionChanged,
      'billing.invoice.paid': billing.invoicePaid,
    }
    const base = { orgId: a.organizationId }
    const event = {
      organizationId: a.organizationId,
      providerEventId: '6f1f1e3a-2c9b-4f0d-9a3e-71b0c5d2a8e4',
    }
    const bodies = [
      body,
      buildTaskEnvelope({
        ...base,
        kind: 'pdf-export',
        payload: {
          tripId: trip.id,
          requestedBy: a.ownerUserId,
          document: {
            title: 'Retained envelope',
            sections: [{ heading: 'Day', rows: [] }],
          },
        },
      }),
      buildTaskEnvelope({
        ...base,
        kind: 'travel-stats',
        payload: { userId: b.ownerUserId, statYear: 2026 },
      }),
      buildTaskEnvelope({
        ...base,
        kind: 'trip-purge',
        payload: {
          keys: [
            `trips/${a.organizationId}/gone`,
            `trips/${b.organizationId}/keep`,
          ],
        },
      }),
      buildTaskEnvelope({
        ...base,
        kind: 'trip-copy',
        payload: {
          sourceTripId: trip.id,
          targetTripId: trip.id,
          requestedBy: a.ownerUserId,
        },
      }),
      buildTaskEnvelope({
        ...base,
        kind: 'trip-room-evict',
        payload: { userId: b.ownerUserId },
      }),
      buildTaskEnvelope({
        ...base,
        kind: 'billing.subscription.changed',
        payload: {
          ...event,
          kind: 'billing.subscription.changed',
          planId: 'crew',
          previousPlanId: 'free',
          status: 'active',
        },
      }),
      buildTaskEnvelope({
        ...base,
        kind: 'billing.invoice.paid',
        payload: {
          ...event,
          kind: 'billing.invoice.paid',
          providerOrderId: 'order',
          amountPaid: 1200,
          currency: 'EUR',
        },
      }),
    ]
    const result = await consumeTaskBatch(
      {
        messages: bodies.map((envelope, index) => ({
          id: `delivery-${index}`,
          body: envelope,
          attempts: 5,
          ack: () => {
            acked += 1
          },
          retry: () => {
            throw new Error('No retry')
          },
        })),
      },
      env,
      createLogger({ level: 'error', sink: createMemorySink() }),
      {
        registry,
      },
    )
    expect(result).toMatchObject({
      acked: 8,
      deadLettered: 0,
      retried: 0,
      abandoned: 2,
    })
    expect(acked).toBe(8)
    expect(writes).toHaveLength(6)
    expect(writes.every((key) => key.startsWith('task:done:'))).toBe(true)
    expect(removed).toEqual([`trips/${a.organizationId}/gone`])
    expect((await requireTrip(b.scope, trip.id)).title).toBe('Surviving trip')
    expect((await getOrganization(b.scope)).id).toBe(b.organizationId)
  } finally {
    h.close()
  }
})

it('keeps system delivery, late billing, backfill and missing deletion semantics after the last organization is deleted', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  const provider = vi.fn(async () => Response.json({ id: 'sent' }))
  vi.stubGlobal('fetch', provider)
  try {
    const a = await h.seedTenant('gone')
    await h.db.delete(organization).where(eq(organization.id, a.organizationId))
    const markers = new Map<string, string>()
    const env: TaskBindings = {
      DB: {} as D1Database,
      EMAIL_API_KEY: 'local-test',
      EMAIL_FROM: 'test@example.com',
      EMAIL_API_URL: 'https://email.example.test/messages',
      POLAR_ACCESS_TOKEN: 'local-test',
      POLAR_SERVER: 'sandbox',
      KV: {
        get: async (key) => markers.get(key) ?? null,
        put: async (key, value) => {
          markers.set(key, value)
        },
        delete: async () => undefined,
        list: async () => ({ keys: [], list_complete: true }),
      },
      FILES: {
        get: async () => null,
        put: async () => {
          throw new Error('No dead letter')
        },
        head: async () => null,
        delete: async () => undefined,
        list: async () => ({ objects: [], truncated: false }),
      },
      TASKS: {
        send: async () => {
          throw new Error('No continuation')
        },
        sendBatch: async () => {
          throw new Error('No continuation')
        },
      },
    }
    const db = () => h.db
    const polar = vi.fn(async () => new Response(null, { status: 404 }))
    const registry = {
      ...createTaskHandlers(db),
      'participant-backfill': createParticipantBackfillHandler(db),
      'workspace-late-subscription': createWorkspaceLateSubscriptionHandler(
        db,
        polar,
      ),
    }
    const bodies = [
      buildTaskEnvelope({
        kind: 'email',
        orgId: a.organizationId,
        payload: {
          to: ['owner@example.com'],
          subject: 'Existing delivery',
          html: '<p>Existing delivery</p>',
        },
      }),
      buildTaskEnvelope({
        kind: 'participant-backfill',
        orgId: 'system',
        payload: { runId: 'deleted-workspaces', after: null },
      }),
      buildTaskEnvelope({
        kind: 'workspace-late-subscription',
        orgId: a.organizationId,
        payload: {
          kind: 'workspace-late-subscription',
          organizationId: a.organizationId,
          providerEventId: 'late-event',
          providerSubscriptionId: '6f1f1e3a-2c9b-4f0d-9a3e-71b0c5d2a8e4',
        },
      }),
      buildTaskEnvelope({
        kind: 'workspace-deletion',
        orgId: 'untrusted-tenant',
        payload: { deletionId: 'missing-deletion' },
      }),
    ]
    // The companion case above covers these tenant-specific kinds with the same real consumer.
    const companion = [
      'booking-import',
      'pdf-export',
      'travel-stats',
      'trip-purge',
      'trip-copy',
      'trip-room-evict',
      'billing.subscription.changed',
      'billing.invoice.paid',
    ]
    expect([...bodies.map((body) => body.kind), ...companion].sort()).toEqual(
      Object.keys(registry).sort(),
    )
    const result = await consumeTaskBatch(
      {
        messages: bodies.map((body, index) => ({
          id: `system-${index}`,
          body,
          attempts: 5,
          ack: () => undefined,
          retry: () => {
            throw new Error('No retry')
          },
        })),
      },
      env,
      createLogger({ level: 'error', sink: createMemorySink() }),
      { registry },
    )
    expect(result).toMatchObject({ acked: 4, deadLettered: 0, retried: 0 })
    expect(provider).toHaveBeenCalledTimes(1)
    expect(polar).toHaveBeenCalledTimes(1)
  } finally {
    vi.unstubAllGlobals()
    h.close()
  }
})
