import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import type { Harness } from '#/server/repos/__tests__/harness'
import { createLogger, createMemorySink } from '#/server/observability/logger'
import { SUBSCRIPTION_STATUSES } from '#/lib/plans'
import { insertWorkspaceDeletion } from '#/server/catalog/workspace-deletions'
import {
  TEST_SUBSCRIPTION_ID,
  polarSubscription,
} from '#/server/billing/__tests__/harness'
import { taskHandlers } from '../../consumer'
import { buildTaskEnvelope } from '../../jobs'
import { TaskPermanentError, TaskRetryableError } from '../../types'
import type { TaskContext, TaskBindings } from '../../types'
import { createWorkspaceLateSubscriptionHandler } from '../workspace-late-subscription'

let db: Harness
beforeEach(async () => {
  db = await createHarness({ ddl: 'migrations' })
})
afterEach(() => db.close())

function setup(organizationId = 'missing') {
  const sink = createMemorySink()
  const env: TaskBindings = {
    DB: {} as D1Database,
    POLAR_ACCESS_TOKEN: 'test-token',
    POLAR_SERVER: 'sandbox',
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
  }
  const context: TaskContext = {
    env,
    orgId: organizationId,
    taskId: 'late',
    attempt: 1,
    now: () => Date.now(),
    logger: createLogger({ level: 'error', sink }),
    callProvider: vi.fn((_label, send) => send()),
  }
  const current = polarSubscription({
    customer: { id: 'customer', external_id: organizationId },
  })
  const fetch = vi
    .fn()
    .mockImplementation(async (_url, init) =>
      Response.json(
        init.method === 'PATCH'
          ? { ...current, cancel_at_period_end: true }
          : current,
      ),
    )
  const handler = createWorkspaceLateSubscriptionHandler(() => db.db, fetch)
  const payload = {
    kind: 'workspace-late-subscription' as const,
    organizationId,
    providerEventId: 'event',
    providerSubscriptionId: TEST_SUBSCRIPTION_ID,
  }
  return {
    context,
    current,
    fetch,
    payload,
    sink,
    run: () => handler(payload, context),
  }
}

it('registers the inert kind and accepts its billing envelope', () => {
  const { payload } = setup()
  expect(taskHandlers['workspace-late-subscription']).toBeDefined()
  expect(
    buildTaskEnvelope({
      kind: payload.kind,
      orgId: payload.organizationId,
      payload,
    }).kind,
  ).toBe(payload.kind)
})

it.each([false, true])(
  'does nothing for an existing workspace (fenced: %s)',
  async (fenced) => {
    const tenant = await db.seedTenant('kept')
    if (fenced)
      await insertWorkspaceDeletion(db.db, {
        organizationId: tenant.organizationId,
        initiator: 'owner',
        requestedBy: tenant.ownerUserId,
      })
    const h = setup(tenant.organizationId)
    expect(await h.run()).toMatchObject({ outcome: 'organization-exists' })
    expect(h.fetch).not.toHaveBeenCalled()
  },
)

it.each(SUBSCRIPTION_STATUSES)(
  'only schedules period-end cancellation for live %s subscriptions',
  async (status) => {
    await db.seedTenant('other')
    const h = setup()
    h.current.status = status
    await h.run()
    const live = ['trialing', 'active', 'past_due', 'paused'].includes(status)
    expect(h.fetch).toHaveBeenCalledTimes(live ? 2 : 1)
    if (live) {
      expect(h.fetch.mock.calls[1]).toEqual([
        `https://sandbox-api.polar.sh/v1/subscriptions/${TEST_SUBSCRIPTION_ID}`,
        expect.objectContaining({
          method: 'PATCH',
          body: '{"cancel_at_period_end":true}',
        }),
      ])
      expect(
        h.sink.records.some(
          (record) => record.msg === 'workspace-late-subscription',
        ),
      ).toBe(true)
    }
    expect(h.context.callProvider).toHaveBeenCalledTimes(live ? 2 : 1)
  },
)

it('does not write when a delayed delivery is already ending', async () => {
  const h = setup()
  h.current.cancel_at_period_end = true
  await h.run()
  expect(h.fetch).toHaveBeenCalledTimes(1)
})

it.each(['empty', 'null', 'invalid-json', 'tenant', 'id', 'still-live'])(
  'retries an unconfirmed successful PATCH (%s)',
  async (kind) => {
    const h = setup()
    const updated = { ...h.current, cancel_at_period_end: true }
    if (kind === 'tenant')
      updated.customer = { id: 'foreign', external_id: 'foreign' }
    if (kind === 'id') updated.id = 'foreign'
    if (kind === 'still-live') updated.cancel_at_period_end = false
    h.fetch.mockImplementation(async (_url, init) => {
      if (init.method === 'GET') return Response.json(h.current)
      if (kind === 'empty') return Response.json({})
      if (kind === 'null') return Response.json(null)
      if (kind === 'invalid-json')
        return new Response('unreadable', { status: 200 })
      return Response.json(updated)
    })
    await expect(h.run()).rejects.toBeInstanceOf(TaskRetryableError)
    expect(h.sink.records.some((record) => record.outcome === 'ending')).toBe(
      false,
    )
  },
)

it('accepts a correctly attributed subscription that became non-live during PATCH', async () => {
  const h = setup()
  h.fetch.mockImplementation(async (_url, init) =>
    Response.json(
      init.method === 'PATCH'
        ? { ...h.current, status: 'canceled' }
        : h.current,
    ),
  )
  expect(await h.run()).toMatchObject({ outcome: 'ending' })
})

it('reconciles a committed cancellation after a lost response on redelivery', async () => {
  const h = setup()
  h.fetch.mockImplementation(async (_url, init) => {
    if (init.method === 'GET') return Response.json(h.current)
    h.current.cancel_at_period_end = true
    throw new Error('response lost after commit')
  })
  await expect(h.run()).rejects.toBeInstanceOf(TaskRetryableError)
  const callsAfterLoss = h.fetch.mock.calls.length
  h.context.attempt = 2
  expect(await h.run()).toMatchObject({ outcome: 'not-live' })
  expect(h.fetch).toHaveBeenCalledTimes(callsAfterLoss + 1)
  expect(h.fetch.mock.calls.at(-1)?.[1].method).toBe('GET')
})

it('rejects an envelope/payload tenant mismatch before reading Polar', async () => {
  const h = setup()
  h.payload.organizationId = 'foreign'
  await expect(h.run()).rejects.toBeInstanceOf(TaskPermanentError)
  expect(h.fetch).not.toHaveBeenCalled()
})

it.each(['tenant', 'id', 'malformed'])(
  'never changes an unattributed provider subscription (%s)',
  async (kind) => {
    const h = setup()
    if (kind === 'tenant') h.current.customer.external_id = 'foreign'
    if (kind === 'id') h.current.id = 'foreign'
    if (kind === 'malformed') h.fetch.mockResolvedValue(Response.json({}))
    await expect(h.run()).rejects.toThrow()
    expect(h.fetch).toHaveBeenCalledTimes(1)
  },
)

it.each([403, 404, 409, 429, 500])(
  'handles provider status %s through the public handler',
  async (status) => {
    const h = setup()
    h.fetch.mockImplementation(async (_url, init) =>
      init.method === 'GET'
        ? Response.json(h.current)
        : new Response('{}', { status }),
    )
    if (status === 403 || status === 404) {
      expect(await h.run()).toMatchObject({ outcome: 'provider-gone' })
    } else {
      await expect(h.run()).rejects.toBeInstanceOf(TaskRetryableError)
    }
  },
)

it.each([403, 404])(
  'treats an unreadable subscription with status %s as done without a PATCH',
  async (status) => {
    const h = setup()
    h.fetch.mockImplementation(async () => new Response('{}', { status }))
    expect(await h.run()).toMatchObject({ outcome: 'provider-gone' })
    expect(h.fetch).toHaveBeenCalledTimes(1)
  },
)

it('retries network failures without leaking provider responses or credentials', async () => {
  const h = setup()
  h.fetch.mockRejectedValue(new Error('secret-provider-detail'))
  await expect(h.run()).rejects.toThrow(
    'Late subscription reconciliation is unavailable',
  )
  expect(JSON.stringify(h.sink.records)).not.toContain('secret-provider-detail')
  expect(JSON.stringify(h.sink.records)).not.toContain('test-token')
})

it('refuses missing provider credentials without calling the network', async () => {
  const h = setup()
  delete h.context.env.POLAR_ACCESS_TOKEN
  await expect(h.run()).rejects.toBeInstanceOf(TaskPermanentError)
  expect(h.fetch).not.toHaveBeenCalled()
})
