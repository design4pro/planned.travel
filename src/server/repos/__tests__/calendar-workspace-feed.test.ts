import { afterEach, beforeEach, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { member } from '#/server/db/auth-schema'
import { tripMembers, trips } from '#/server/db/schema'
import { createHarness, subscribeTenant } from './harness'
import { createTrip } from '../trips'
import {
  enableFeed,
  getFeed,
  listFeeds,
  readFeedSource,
  rotateFeed,
} from '../calendar-feeds'
import type { Harness, SeededTenant } from './harness'

let h: Harness
let a: SeededTenant
beforeEach(async () => {
  h = await createHarness()
  a = await h.seedTenant('workspace-calendar')
  await subscribeTenant(a.scope, 'crew')
})
afterEach(() => h.close())

it('selects only current non-archived memberships in this tenant using a bounded sub-select', async () => {
  const other = await h.seedTenant('other')
  await createTrip(other.scope, { title: 'Foreign', currency: 'EUR' })
  const stranger = await a.addUser('stranger')
  const visible = await createTrip(a.scopeFor(stranger), {
    title: 'Visible only',
    currency: 'EUR',
    visibility: 'organization',
  })
  await createTrip(a.scopeFor(stranger), {
    title: 'Private only',
    currency: 'EUR',
  })
  const archived = await createTrip(a.scope, {
    title: 'Archived',
    currency: 'EUR',
  })
  await h.db
    .update(trips)
    .set({ isArchived: true })
    .where(eq(trips.id, archived.id))
  const undated = await createTrip(a.scope, {
    title: 'Undated',
    currency: 'EUR',
  })
  const dated = await createTrip(a.scope, {
    title: 'Newest',
    currency: 'EUR',
    startDate: '2026-12-12',
    endDate: '2026-12-12',
  })
  h.statements.length = 0
  const source = await readFeedSource(a.scope, { kind: 'member-trips' })
  expect(source.trips.map((t) => t.id)).toEqual([dated.id, undated.id])
  expect(h.statements[0]).toMatch(/in \(select/i)
  await h.db.delete(tripMembers).where(eq(tripMembers.tripId, dated.id))
  expect(
    (await readFeedSource(a.scope, { kind: 'member-trips' })).trips.map(
      (t) => t.id,
    ),
  ).toEqual([undated.id])
  expect(source.trips.some((t) => t.id === visible.id)).toBe(false)
})

it('caps the latest dated trips at fifty with undated trips last', async () => {
  for (let index = 0; index < 52; index++) {
    const year = 2026 + index
    await createTrip(a.scope, {
      title: String(year),
      currency: 'EUR',
      startDate: `${year}-01-01`,
      endDate: `${year}-01-01`,
    })
  }
  const source = await readFeedSource(a.scope, { kind: 'member-trips' })
  expect(source.trips).toHaveLength(50)
  expect(source.trips[0].title).toBe('2077')
  expect(source.trips.at(-1)?.title).toBe('2028')
})

it('manages a separate workspace credential without exposing another tenant or owner', async () => {
  const foreign = await h.seedTenant('foreign-feed')
  const owner = await enableFeed(a.scope, { scope: 'workspace' })
  const enabledAgain = await enableFeed(a.scope, { scope: 'workspace' })
  expect(enabledAgain.feedId).toBe(owner.feedId)
  expect(enabledAgain.secret).not.toBe(owner.secret)
  const other = await enableFeed(foreign.scope, { scope: 'workspace' })
  const stranger = await a.addUser('feed-stranger')
  const strangerScope = a.scopeFor(stranger)
  await enableFeed(strangerScope, { scope: 'workspace' })
  expect(await listFeeds(a.scope, { scope: 'workspace' })).toHaveLength(1)
  expect((await getFeed(a.scope, owner.feedId)).on).toBe(true)
  await expect(getFeed(a.scope, other.feedId)).rejects.toThrow()
  await expect(rotateFeed(foreign.scope, owner.feedId)).rejects.toThrow()
  await expect(rotateFeed(strangerScope, owner.feedId)).rejects.toThrow()
  const rotated = await rotateFeed(a.scope, owner.feedId)
  expect(rotated.secret).not.toBe(owner.secret)
  expect(rotated.tripTitle).toBe('planned.travel')
  await h.db.delete(member).where(eq(member.userId, a.ownerUserId))
  expect((await getFeed(a.scope, owner.feedId)).on).toBe(false)
  await expect(rotateFeed(a.scope, owner.feedId)).rejects.toThrow()
})
