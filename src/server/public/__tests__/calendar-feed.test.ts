import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { member, user } from '#/server/db/auth-schema'
import { createTrip } from '#/server/repos/trips'
import { calendarFeeds, tripMembers, trips } from '#/server/db/schema'
import * as secrets from '#/server/calendar/secret'
import { enableFeed, revokeFeed } from '#/server/repos/calendar-feeds'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import { serveCalendarFeed } from '../calendar-feed'
import type { CalendarFeedRuntime } from '../calendar-feed'

describe('session-less calendar feed', () => {
  let h: Awaited<ReturnType<typeof createHarness>>
  let a: Awaited<ReturnType<typeof h.seedTenant>>
  let tripId: string
  let runtime: CalendarFeedRuntime
  let secret: string
  let feedId: string
  let ownerId: string
  let store: Map<string, string>
  beforeEach(async () => {
    h = await createHarness()
    a = await h.seedTenant('a')
    const trip = await createTrip(a.scope, {
      title: 'Private Lisbon',
      startDate: '2026-10-10',
      endDate: '2026-10-12',
      currency: 'EUR',
    })
    tripId = trip.id
    const feed = await enableFeed(a.scope, { scope: 'trip', tripId: trip.id })
    secret = feed.secret
    feedId = feed.feedId
    ownerId = a.ownerUserId
    store = new Map()
    runtime = {
      db: h.db,
      store: {
        get: async (key) => store.get(key) ?? null,
        put: async (key, value) => {
          store.set(key, value)
        },
      },
      baseUrl: 'https://planned.example',
      now: (() => {
        const instant = new Date()
        return () => instant
      })(),
      waitUntil: () => {},
    }
  })
  afterEach(() => {
    vi.restoreAllMocks()
    h.close()
  })
  function request(token = secret, method = 'GET', cookie = '') {
    return new Request(`https://planned.example/api/feed/${token}.ics`, {
      method,
      headers: { 'cf-connecting-ip': '192.0.2.1', cookie },
    })
  }
  async function signature(response: Response) {
    return [response.status, [...response.headers], await response.text()]
  }
  it('serves no-session and session requests identically with private headers, and HEAD without body', async () => {
    const response = await serveCalendarFeed(request(), runtime)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(await response.text()).toContain('Private Lisbon')
    expect(
      await signature(await serveCalendarFeed(request(), runtime)),
    ).toEqual(
      await signature(
        await serveCalendarFeed(
          request(secret, 'GET', 'session=other'),
          runtime,
        ),
      ),
    )
    const head = await serveCalendarFeed(request(secret, 'HEAD'), runtime)
    expect(head.status).toBe(200)
    expect(await head.text()).toBe('')
  })
  it('refuses every resolution failure byte identically', async () => {
    const baseline = await signature(
      await serveCalendarFeed(request('x'), runtime),
    )
    expect(
      await signature(
        await serveCalendarFeed(request('x'.repeat(32)), runtime),
      ),
    ).toEqual(baseline)
    await runtime.db
      .update(user)
      .set({ banned: true, banExpires: null })
      .where(eq(user.id, ownerId))
    expect(
      await signature(await serveCalendarFeed(request(), runtime)),
    ).toEqual(baseline)
    await runtime.db.delete(member).where(eq(member.userId, ownerId))
    expect(
      await signature(await serveCalendarFeed(request(), runtime)),
    ).toEqual(baseline)
    expect(
      (await serveCalendarFeed(request(secret, 'HEAD'), runtime)).status,
    ).toBe(404)
  })
  it('limits misses without charging live feeds to shared provider IPs, and fails open only for KV', async () => {
    for (let i = 0; i < 20; i++)
      expect(
        (await serveCalendarFeed(request('x'.repeat(32)), runtime)).status,
      ).toBe(404)
    expect(
      (await serveCalendarFeed(request('x'.repeat(32)), runtime)).status,
    ).toBe(429)
    expect((await serveCalendarFeed(request(), runtime)).status).toBe(200)
    runtime.store.get = async () => {
      throw new Error('KV unavailable')
    }
    expect((await serveCalendarFeed(request(), runtime)).status).toBe(200)
    expect(
      (await serveCalendarFeed(request('x'.repeat(32)), runtime)).status,
    ).toBe(404)
  })
  it('gives a live feed its own 60-per-minute budget with Retry-After', async () => {
    for (let i = 0; i < 60; i++)
      expect((await serveCalendarFeed(request(), runtime)).status).toBe(200)
    const limited = await serveCalendarFeed(request(), runtime)
    expect(limited.status).toBe(429)
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect([...store.keys()].some((key) => key.includes(secret))).toBe(false)
    expect([...store.keys()].some((key) => key.includes(feedId))).toBe(true)
  })
  it.each(['x', 'x'.repeat(31), 'x'.repeat(33), '!'.repeat(32)])(
    'rejects malformed credentials before hashing, SQL or KV: %s',
    async (token) => {
      const hash = vi.spyOn(secrets, 'hashFeedSecret')
      const get = vi.spyOn(runtime.store, 'get')
      const put = vi.spyOn(runtime.store, 'put')
      h.statements.length = 0
      expect((await serveCalendarFeed(request(token), runtime)).status).toBe(
        404,
      )
      expect(hash).not.toHaveBeenCalled()
      expect(h.statements).toEqual([])
      expect(get).not.toHaveBeenCalled()
      expect(put).not.toHaveBeenCalled()
    },
  )

  it.each([
    'revoked',
    'rotated',
    'removed owner',
    'readded owner',
    'permanent ban',
    'temporary ban',
    'removed trip member',
    'readded trip member',
    'unreadable trip',
    'corrupt feed',
    'database error',
  ])('uses the same refusal bytes and miss budget for %s', async (failure) => {
    const baseline = await signature(
      await serveCalendarFeed(request('z'.repeat(32)), runtime),
    )
    store.clear()
    const stamp = new Date(Date.now() + 1000)
    switch (failure) {
      case 'revoked':
        await revokeFeed(a.scope, feedId)
        break
      case 'rotated':
        await enableFeed(a.scope, { scope: 'trip', tripId })
        break
      case 'removed owner':
        await runtime.db.delete(member).where(eq(member.userId, ownerId))
        break
      case 'readded owner':
        await runtime.db.delete(member).where(eq(member.userId, ownerId))
        await a.addMembership(ownerId, 'owner')
        await runtime.db
          .update(member)
          .set({ createdAt: stamp })
          .where(eq(member.userId, ownerId))
        break
      case 'permanent ban':
        await runtime.db
          .update(user)
          .set({ banned: true, banExpires: null })
          .where(eq(user.id, ownerId))
        break
      case 'temporary ban':
        await runtime.db
          .update(user)
          .set({ banned: true, banExpires: stamp })
          .where(eq(user.id, ownerId))
        break
      case 'removed trip member':
        await runtime.db
          .delete(tripMembers)
          .where(eq(tripMembers.userId, ownerId))
        break
      case 'readded trip member': {
        const [previous] = await runtime.db
          .select()
          .from(tripMembers)
          .where(eq(tripMembers.userId, ownerId))
        await runtime.db
          .delete(tripMembers)
          .where(eq(tripMembers.id, previous.id))
        await runtime.db
          .insert(tripMembers)
          .values({ ...previous, createdAt: stamp })
        break
      }
      case 'unreadable trip': {
        const other = await h.seedTenant('other')
        await runtime.db
          .update(trips)
          .set({ organizationId: other.organizationId })
          .where(eq(trips.id, tripId))
        break
      }
      case 'corrupt feed':
        h.sqlite.exec(
          "PRAGMA ignore_check_constraints = ON; UPDATE calendar_feeds SET scope = 'broken'",
        )
        break
      case 'database error':
        h.sqlite.exec('DROP TABLE calendar_feeds')
        break
    }
    expect(
      await signature(await serveCalendarFeed(request(), runtime)),
    ).toEqual(baseline)
    expect([...store.values()]).toEqual(['1'])
    expect([...store.keys()][0]).toContain(':miss:192.0.2.1:')
    const head = await serveCalendarFeed(request(secret, 'HEAD'), runtime)
    expect(head.status).toBe(404)
    expect(await head.text()).toBe('')
    expect([...store.values()]).toEqual(['2'])
  })

  it('does not let a valid session or unavailable KV revive a revoked credential', async () => {
    await revokeFeed(a.scope, feedId)
    runtime.store.get = async () => {
      throw new Error('offline')
    }
    runtime.store.put = async () => {
      throw new Error('offline')
    }
    expect(
      (
        await serveCalendarFeed(
          request(secret, 'GET', 'planned.session_token=valid'),
          runtime,
        )
      ).status,
    ).toBe(404)
  })

  it('queues the first touch, none within an hour, and another at the hourly boundary', async () => {
    const now = new Date(Date.now() + 1000)
    const pending: Array<Promise<unknown>> = []
    runtime = {
      ...runtime,
      now: () => now,
      waitUntil: (promise) => {
        pending.push(promise)
      },
    }
    expect((await serveCalendarFeed(request(), runtime)).status).toBe(200)
    expect(pending).toHaveLength(1)
    await Promise.all(pending)
    const [row] = await runtime.db
      .select({ last: calendarFeeds.lastServedAt })
      .from(calendarFeeds)
      .where(eq(calendarFeeds.id, feedId))
    expect(row.last).toEqual(now)
    now.setTime(now.getTime() + 3599999)
    await serveCalendarFeed(request(), runtime)
    expect(pending).toHaveLength(1)
    now.setTime(now.getTime() + 1)
    await serveCalendarFeed(request(), runtime)
    expect(pending).toHaveLength(2)
    await Promise.all(pending)
  })

  it('logs only safe fields even when SQL errors contain the URL, secret and digest', async () => {
    const digest = await secrets.hashFeedSecret(secret)
    const log = vi.fn()
    runtime = { ...runtime, log }
    await serveCalendarFeed(request(), runtime)
    vi.spyOn(runtime.db, 'select').mockImplementation(() => {
      throw new Error(`${request().url} ${secret} ${digest}`)
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect((await serveCalendarFeed(request(), runtime)).status).toBe(404)
    expect(log.mock.calls).toEqual([
      ['served', { feedId, status: 200 }],
      ['resolution-failed', { status: 404 }],
    ])
    const captured = JSON.stringify([
      log.mock.calls,
      warn.mock.calls,
      error.mock.calls,
    ])
    for (const forbidden of [secret, digest, request().url])
      expect(captured).not.toContain(forbidden)
  })

  it('rejects unsupported methods without resolving a credential', async () => {
    h.statements.length = 0
    const response = await serveCalendarFeed(request(secret, 'POST'), runtime)
    expect(response.status).toBe(405)
    expect(response.headers.get('allow')).toBe('GET, HEAD')
    expect(h.statements).toEqual([])
  })

  it('serves more than the IP miss ceiling across independent live feeds on one IP', async () => {
    await subscribeTenant(a.scope, 'solo')
    for (let i = 0; i < 25; i++) {
      const trip = await createTrip(a.scope, {
        title: `Trip ${i}`,
        currency: 'EUR',
      })
      const feed = await enableFeed(a.scope, { scope: 'trip', tripId: trip.id })
      expect(
        (await serveCalendarFeed(request(feed.secret), runtime)).status,
      ).toBe(200)
    }
    expect([...store.keys()].every((key) => key.includes(':feed:'))).toBe(true)
  })
})
