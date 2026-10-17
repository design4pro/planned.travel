import { AsyncLocalStorage } from 'node:async_hooks'
import { requestHandler } from '@tanstack/react-start/server'
import { beforeEach, expect, it, vi } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import { createTrip } from '#/server/repos/trips'
import {
  enableFeed,
  findLiveFeedByDigestUnscoped,
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
const { rotateCalendarFeedFn } = await import('../calendar')

beforeEach(() => {
  runtime.scope = null
})

async function call(data: { feedId: string }) {
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
    await storage.run({ startOptions: {}, request }, () =>
      rotateCalendarFeedFn({ data }),
    )
    return new Response(null, { status: 204 })
  })(request, {})
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
