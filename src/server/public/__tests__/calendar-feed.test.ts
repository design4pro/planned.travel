import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { member, user } from '#/server/db/auth-schema'
import { createTrip } from '#/server/repos/trips'
import { enableFeed } from '#/server/repos/calendar-feeds'
import { createHarness } from '#/server/repos/__tests__/harness'
import { serveCalendarFeed } from '../calendar-feed'
import type { CalendarFeedRuntime } from '../calendar-feed'

describe('session-less calendar feed', () => {
  let runtime: CalendarFeedRuntime
  let secret: string
  let feedId: string
  let ownerId: string
  let store: Map<string,string>
  beforeEach(async () => {
    const h = await createHarness()
    const a = await h.seedTenant('a')
    const trip = await createTrip(a.scope, { title: 'Private Lisbon', startDate: '2026-10-10', endDate: '2026-10-12', currency: 'EUR' })
    const feed = await enableFeed(a.scope, { scope: 'trip', tripId: trip.id })
    secret = feed.secret; feedId = feed.feedId; ownerId = a.ownerUserId
    store = new Map()
    runtime = { db: h.db, store: { get: async (key) => store.get(key) ?? null, put: async (key,value) => { store.set(key,value) } }, baseUrl: 'https://planned.example', waitUntil: () => {} }
  })
  function request(token = secret, method = 'GET', cookie = '') { return new Request(`https://planned.example/api/feed/${token}.ics`, { method, headers: { 'cf-connecting-ip': '192.0.2.1', cookie } }) }
  async function signature(response: Response) { return [response.status, [...response.headers], await response.text()] }
  it('serves no-session and session requests identically with private headers, and HEAD without body', async () => {
    const response = await serveCalendarFeed(request(),runtime)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(await response.text()).toContain('Private Lisbon')
    expect(await signature(await serveCalendarFeed(request(), runtime))).toEqual(await signature(await serveCalendarFeed(request(secret,'GET','session=other'),runtime)))
    const head = await serveCalendarFeed(request(secret,'HEAD'),runtime)
    expect(head.status).toBe(200); expect(await head.text()).toBe('')
  })
  it('refuses every resolution failure byte identically', async () => {
    const baseline = await signature(await serveCalendarFeed(request('x'),runtime))
    expect(await signature(await serveCalendarFeed(request('x'.repeat(32)),runtime))).toEqual(baseline)
    await runtime.db.update(user).set({ banned: true, banExpires: null }).where(eq(user.id, ownerId))
    expect(await signature(await serveCalendarFeed(request(),runtime))).toEqual(baseline)
    await runtime.db.delete(member).where(eq(member.userId,ownerId))
    expect(await signature(await serveCalendarFeed(request(),runtime))).toEqual(baseline)
    expect((await serveCalendarFeed(request(secret,'HEAD'),runtime)).status).toBe(404)
  })
  it('limits misses without charging live feeds to shared provider IPs, and fails open only for KV', async () => {
    for (let i=0;i<20;i++) expect((await serveCalendarFeed(request('x'.repeat(32)),runtime)).status).toBe(404)
    expect((await serveCalendarFeed(request('x'.repeat(32)),runtime)).status).toBe(429)
    expect((await serveCalendarFeed(request(),runtime)).status).toBe(200)
    runtime.store.get = async () => { throw new Error('KV unavailable') }
    expect((await serveCalendarFeed(request(),runtime)).status).toBe(200)
    expect((await serveCalendarFeed(request('x'.repeat(32)),runtime)).status).toBe(404)
  })
  it('gives a live feed its own 60-per-minute budget with Retry-After', async () => {
    for (let i=0;i<60;i++) expect((await serveCalendarFeed(request(),runtime)).status).toBe(200)
    const limited = await serveCalendarFeed(request(),runtime)
    expect(limited.status).toBe(429); expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0)
    expect([...store.keys()].some(key => key.includes(secret))).toBe(false)
    expect([...store.keys()].some(key => key.includes(feedId))).toBe(true)
  })
})
