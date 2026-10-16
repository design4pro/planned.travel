import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { calendarFeeds, tripMembers } from '#/server/db/schema'
import { member, user } from '#/server/db/auth-schema'
import { hashFeedSecret } from '#/server/calendar/secret'
import { enableFeed, getFeed, revokeFeed, findLiveFeedByDigestUnscoped, openFeedScope, feedTripAccess, touchFeed } from '../calendar-feeds'
import { createTrip } from '../trips'
import { NotFoundError } from '../context'
import { createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

describe('owner-bound live calendar feeds', () => {
  let h: Harness
  let a: SeededTenant
  let b: SeededTenant
  beforeEach(async () => { h = await createHarness(); a = await h.seedTenant('a'); b = await h.seedTenant('b') })
  async function make() {
    const trip = await createTrip(a.scope, { title: 'Lisbon', currency: 'EUR' })
    return { trip, enabled: await enableFeed(a.scope, { scope: 'trip', tripId: trip.id }) }
  }
  it('rearms one row in one upsert, concurrently and after revoke, resetting its access stamp', async () => {
    const { trip, enabled } = await make()
    await touchFeed(a.scope, enabled.feedId, new Date())
    await revokeFeed(a.scope, enabled.feedId)
    const [one, two] = await Promise.all([enableFeed(a.scope, { scope: 'trip', tripId: trip.id }), enableFeed(a.scope, { scope: 'trip', tripId: trip.id })])
    expect(one.feedId).toBe(two.feedId)
    expect(one.secret).not.toBe(two.secret)
    expect(await h.db.select().from(calendarFeeds)).toHaveLength(1)
    expect(await getFeed(a.scope, enabled.feedId)).toMatchObject({ on: true, lastServedAt: null })
    expect(await findLiveFeedByDigestUnscoped(h.db, await hashFeedSecret(enabled.secret))).toBeNull()
  })
  it('isolates management by tenant and owner, and requires trip membership even for visible trips', async () => {
    const { trip, enabled } = await make()
    const other = a.scopeFor(await a.addUser('other'))
    for (const scope of [other, b.scope]) {
      await expect(getFeed(scope, enabled.feedId)).rejects.toBeInstanceOf(NotFoundError)
      await expect(revokeFeed(scope, enabled.feedId)).rejects.toBeInstanceOf(NotFoundError)
      await expect(touchFeed(scope, enabled.feedId, new Date())).rejects.toBeInstanceOf(NotFoundError)
      await expect(enableFeed(scope, { scope: 'trip', tripId: trip.id })).rejects.toBeInstanceOf(NotFoundError)
    }
  })
  it('resolves only coordinates and opens the resolved tenant, never the caller tenant', async () => {
    const { enabled } = await make()
    const found = await findLiveFeedByDigestUnscoped(h.db, await hashFeedSecret(enabled.secret))
    expect(found).not.toBeNull()
    if (!found) throw new Error('missing feed')
    expect(Object.keys(found).sort()).toEqual(['id','lastServedAt','organizationId','scope','tripId','userId'].sort())
    expect((await openFeedScope(h.db, found))?.ctx.organizationId).toBe(a.organizationId)
    expect(await feedTripAccess(b.scope, found)).toBe(false)
    await revokeFeed(a.scope, found.id)
    expect(await findLiveFeedByDigestUnscoped(h.db, await hashFeedSecret(enabled.secret))).toBeNull()
    expect(await findLiveFeedByDigestUnscoped(h.db, 'unknown')).toBeNull()
  })
  it('refuses a ban, a missing membership and a feed armed before the current membership', async () => {
    const { enabled } = await make()
    const found = await findLiveFeedByDigestUnscoped(h.db, await hashFeedSecret(enabled.secret))
    if (!found) throw new Error('missing feed')
    await h.db.update(user).set({ banned: true, banExpires: null }).where(eq(user.id, a.ownerUserId))
    expect(await openFeedScope(h.db, found)).toBeNull()
    expect(await getFeed(a.scope, found.id)).toMatchObject({ on: false })
    await h.db.update(user).set({ banExpires: new Date(0) }).where(eq(user.id, a.ownerUserId))
    expect(await openFeedScope(h.db, found)).not.toBeNull()
    await h.db.update(member).set({ createdAt: new Date(Date.now() + 1000) }).where(eq(member.userId, a.ownerUserId))
    expect(await openFeedScope(h.db, found)).toBeNull()
    await h.db.delete(member).where(eq(member.userId, a.ownerUserId))
    expect(await openFeedScope(h.db, found)).toBeNull()
  })
  it('refuses a trip membership newer than the secret, while equal stamps remain armed', async () => {
    const { trip, enabled } = await make()
    const found = await findLiveFeedByDigestUnscoped(h.db, await hashFeedSecret(enabled.secret))
    if (!found) throw new Error('missing feed')
    const [row] = await h.db.select().from(calendarFeeds)
    await h.db.update(tripMembers).set({ createdAt: row.rotatedAt ?? row.createdAt }).where(eq(tripMembers.tripId, trip.id))
    expect(await feedTripAccess(a.scope, found)).toBe(true)
    await h.db.update(tripMembers).set({ createdAt: new Date(Date.now() + 1000) }).where(eq(tripMembers.tripId, trip.id))
    expect(await feedTripAccess(a.scope, found)).toBe(false)
    expect(await getFeed(a.scope, found.id)).toMatchObject({ on: false })
  })
})
