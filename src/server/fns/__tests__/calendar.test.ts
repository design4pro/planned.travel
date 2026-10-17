import { AsyncLocalStorage } from 'node:async_hooks'
import { requestHandler } from '@tanstack/react-start/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import { createTrip } from '#/server/repos/trips'
import {
  enableFeed,
  findLiveFeedByDigestUnscoped,
  listFeeds,
} from '#/server/repos/calendar-feeds'
import { hashFeedSecret } from '#/server/calendar/secret'
import type { TenantScope } from '#/server/repos/base'

const runtime = vi.hoisted(() => ({ scope: null as TenantScope | null }))
vi.mock('../context', () => ({
  appScope: () => {
    if (!runtime.scope) throw new Error('unauthenticated')
    return runtime.scope
  },
}))
vi.mock('#/server/auth/env', () => ({ appUrl: () => 'https://app.example' }))
const { rotateCalendarFeedFn, enableCalendarFeedFn } =
  await import('../calendar')

beforeEach(() => {
  runtime.scope = null
})

async function inRequest(callback: () => Promise<unknown>) {
  const key = Symbol.for('tanstack-start:start-storage-context')
  const globals = globalThis as Record<symbol, unknown>
  globals[key] ??= new AsyncLocalStorage()
  const storage = globals[key] as AsyncLocalStorage<{
    startOptions: Record<string, never>
    request: Request
  }>
  const request = new Request('https://app.example/_serverFn/rotate', {
    method: 'POST',
  })
  return requestHandler(async () => {
    await storage.run({ startOptions: {}, request }, () => callback())
    return new Response(null, { status: 204 })
  })(request, {})
}

function call(data: { feedId: string }) {
  return inRequest(() => rotateCalendarFeedFn({ data }))
}

it('validates and authorizes the real rotation POST before changing the credential', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const h = await createHarness()
  const tenant = await h.seedTenant('calendar-fn')
  const trip = await createTrip(tenant.scope, {
    title: 'Lisbon',
    currency: 'EUR',
  })
  const feed = await enableFeed(tenant.scope, {
    scope: 'trip',
    tripId: trip.id,
  })
  const digest = await hashFeedSecret(feed.secret)
  expect((await call({ feedId: feed.feedId })).status).toBe(500)
  expect(await findLiveFeedByDigestUnscoped(h.db, digest)).not.toBeNull()
  runtime.scope = tenant.scope
  expect((await call({ feedId: '' })).status).toBe(500)
  expect(await findLiveFeedByDigestUnscoped(h.db, digest)).not.toBeNull()
  await call({ feedId: feed.feedId })
  expect(await findLiveFeedByDigestUnscoped(h.db, digest)).toBeNull()
  vi.restoreAllMocks()
  h.close()
})

it('accepts optional workspace scope while legacy calls still create trip credentials', async () => {
  const h = await createHarness()
  try {
    const tenant = await h.seedTenant('workspace-fn')
    runtime.scope = tenant.scope
    const trip = await createTrip(tenant.scope, {
      title: 'Trip feed',
      currency: 'EUR',
    })
    // Outside a Start build the handler runs but its return is discarded; inspect persisted effects.
    const legacy = await inRequest(() =>
      enableCalendarFeedFn({ data: { tripId: trip.id } }),
    )
    expect(legacy.status).toBe(204)
    const workspace = await inRequest(() =>
      enableCalendarFeedFn({ data: { tripId: trip.id, scope: 'workspace' } }),
    )
    expect(workspace.status).toBe(204)
    const tripFeeds = await listFeeds(tenant.scope, { tripId: trip.id })
    const workspaceFeeds = await listFeeds(tenant.scope, { scope: 'workspace' })
    expect(tripFeeds).toHaveLength(1)
    expect(workspaceFeeds).toHaveLength(1)
    expect(tripFeeds[0]).toMatchObject({ tripId: trip.id, on: true })
    expect(workspaceFeeds[0]).toMatchObject({ tripId: null, on: true })
    expect(workspaceFeeds[0].id).not.toBe(tripFeeds[0].id)
  } finally {
    h.close()
  }
})
