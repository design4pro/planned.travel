import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  visitedCountries,
  visitedRegions,
  travelStats,
  bucketListItems,
  userSettings,
  notificationPreferences,
  collections,
  collectionPlaces,
  journeys,
  journeyEntries,
  journeyPhotos,
  vacayPlans,
  vacayPlanMembers,
  vacayUserYears,
  vacayEntries,
  vacayUserColours,
  auditLog,
} from '#/server/db/schema'
import { createErasureScope } from '#/server/erasure/scope'
import { createTenantRepository } from '../base'
import { eraseUserPersonalData } from '../personal-erasure'
import { eraseUserCollections } from '../collections-erasure'
import { eraseUserJourneys } from '../journey-erasure'
import { eraseUserVacation } from '../vacay-erasure'
import { eraseUserAudit } from '../audit-erasure'
import { createHarness } from './harness'
import type { Harness } from './harness'

let h: Harness
beforeEach(async () => {
  h = await createHarness()
})
afterEach(() => h.close())

it('removes every personal-data table beyond a batch, preserves another identity and workspace, and is repeatable', async () => {
  const a = await h.seedTenant('a'),
    b = await h.seedTenant('b')
  for (const t of [a, b])
    for (const userId of ['person', 'other']) {
      await createTenantRepository(visitedCountries, 'country').insert(
        t.scope,
        { userId, countryCode: 'PL' },
      )
      await createTenantRepository(visitedRegions, 'region').insert(t.scope, {
        userId,
        countryCode: 'PL',
        regionCode: 'PL-14',
        regionName: 'Mazovia',
      })
      await createTenantRepository(travelStats, 'stats').insert(t.scope, {
        userId,
        computedAt: new Date(),
      })
      await createTenantRepository(userSettings, 'settings').insert(t.scope, {
        userId,
      })
      await createTenantRepository(
        notificationPreferences,
        'preference',
      ).insert(t.scope, {
        userId,
        eventType: 'chat.message',
        channel: 'in_app',
      })
      for (let i = 0; i < 105; i++)
        await createTenantRepository(bucketListItems, 'item').insert(t.scope, {
          userId,
          name: String(i),
        })
    }
  const scope = createErasureScope(h.db, a.organizationId)
  await eraseUserPersonalData(scope, 'person', 'erased_one')
  await eraseUserPersonalData(scope, 'person', 'erased_one')
  for (const table of [
    visitedCountries,
    visitedRegions,
    travelStats,
    userSettings,
    notificationPreferences,
    bucketListItems,
  ]) {
    const repo = createTenantRepository(table, 'personal')
    expect(
      (await repo.findMany(a.scope)).every((r) => r.userId === 'other'),
    ).toBe(true)
    expect(await repo.count(b.scope)).toBe(table === bucketListItems ? 210 : 2)
  }
})

it('removes private collections, preserves contributions and anonymises saved places, with distinct tombstones and tenant isolation', async () => {
  const a = await h.seedTenant('a'),
    b = await h.seedTenant('b')
  const parents = createTenantRepository(collections, 'collection'),
    places = createTenantRepository(collectionPlaces, 'place')
  for (const t of [a, b]) {
    for (const [slug, ownerUserId, authors] of [
      ['private', 'person', ['person']],
      ['shared', 'person', ['person', 'second', 'other']],
      ['foreign', 'other', ['person', 'second']],
    ] as const) {
      const c = await parents.insert(t.scope, { slug, name: slug, ownerUserId })
      for (const savedBy of authors)
        await places.insert(t.scope, {
          collectionId: c.id,
          savedBy,
          name: savedBy,
        })
    }
  }
  const scope = createErasureScope(h.db, a.organizationId)
  await eraseUserCollections(scope, 'person', 'erased_one')
  await eraseUserCollections(scope, 'second', 'erased_two')
  await eraseUserCollections(scope, 'person', 'erased_one')
  expect(
    (await parents.findMany(a.scope))
      .map((r) => [r.slug, r.ownerUserId])
      .sort(),
  ).toEqual([
    ['foreign', 'other'],
    ['shared', 'erased_one'],
  ])
  expect((await places.findMany(a.scope)).map((r) => r.savedBy).sort()).toEqual(
    ['erased_one', 'erased_two', 'erased_two', 'other'],
  )
  expect(await parents.count(b.scope)).toBe(3)
  expect(
    (await places.findMany(b.scope)).filter((r) => r.savedBy === 'person'),
  ).toHaveLength(3)
})

it('captures keys before cascades, keeps other authors and journey visibility, and saves cleanup before deletion for retries', async () => {
  const a = await h.seedTenant('a'),
    b = await h.seedTenant('b')
  const js = createTenantRepository(journeys, 'journey'),
    es = createTenantRepository(journeyEntries, 'entry'),
    ps = createTenantRepository(journeyPhotos, 'photo')
  for (const t of [a, b])
    for (const slug of ['private', 'shared', 'foreign']) {
      const j = await js.insert(t.scope, {
        slug,
        title: slug,
        ownerUserId: slug === 'foreign' ? 'other' : 'person',
        visibility: 'private',
      })
      const e = await es.insert(t.scope, {
        journeyId: j.id,
        authorUserId: 'person',
        entryDate: '2026-10-19',
        body: 'private',
      })
      if (slug === 'shared' || slug === 'foreign')
        await es.insert(t.scope, {
          journeyId: j.id,
          authorUserId: 'other',
          entryDate: '2026-10-19',
          body: 'keep',
        })
      await ps.insert(t.scope, {
        journeyId: j.id,
        entryId: e.id,
        uploadedBy: 'other',
        storageKey: `${t.organizationId}/${slug}/cascade`,
        thumbnailKey: `${t.organizationId}/${slug}/thumb`,
        contentType: 'image/jpeg',
      })
      for (let i = 0; i < 105; i++)
        await ps.insert(t.scope, {
          journeyId: j.id,
          uploadedBy: 'person',
          storageKey: `${t.organizationId}/${slug}/${i}`,
          contentType: 'image/jpeg',
        })
    }
  const scope = createErasureScope(h.db, a.organizationId)
  await expect(
    eraseUserJourneys(scope, 'person', 'erased_one', async () => {
      throw new Error('durable cleanup failed')
    }),
  ).rejects.toThrow('durable cleanup failed')
  expect(await ps.count(a.scope)).toBe(318)
  const saved: string[] = []
  const keys = await eraseUserJourneys(
    scope,
    'person',
    'erased_one',
    async (pageKeys) => {
      saved.push(...pageKeys)
      expect(await ps.count(a.scope)).toBeGreaterThan(0)
    },
  )
  expect(keys).toHaveLength(321)
  expect(new Set(saved)).toEqual(new Set(keys))
  expect(await ps.count(a.scope)).toBe(0)
  expect((await es.findMany(a.scope)).map((r) => r.body)).toEqual([
    'keep',
    'keep',
  ])
  expect(
    (await js.findMany(a.scope))
      .map((r) => [r.slug, r.ownerUserId, r.visibility])
      .sort(),
  ).toEqual([
    ['foreign', 'other', 'private'],
    ['shared', 'erased_one', 'private'],
  ])
  expect(await js.count(b.scope)).toBe(3)
  expect(await es.count(b.scope)).toBe(5)
  expect(await ps.count(b.scope)).toBe(318)
  expect(
    await eraseUserJourneys(scope, 'person', 'erased_one', async () => {}),
  ).toEqual([])
})

it('preserves invited vacation members and their rows, deletes personal plans and survives two erased owners', async () => {
  const a = await h.seedTenant('a'),
    b = await h.seedTenant('b')
  const plans = createTenantRepository(vacayPlans, 'plan'),
    members = createTenantRepository(vacayPlanMembers, 'member')
  const entries = createTenantRepository(vacayEntries, 'entry'),
    years = createTenantRepository(vacayUserYears, 'year'),
    colours = createTenantRepository(vacayUserColours, 'colour')
  for (const t of [a, b])
    for (const ownerUserId of ['person', 'second', 'other']) {
      const p = await plans.insert(t.scope, { ownerUserId })
      for (const userId of ['person', 'second', 'other']) {
        if (ownerUserId !== 'other')
          await members.insert(t.scope, {
            planId: p.id,
            userId,
            status: 'pending',
          })
        await entries.insert(t.scope, {
          planId: p.id,
          userId,
          date: '2026-10-19',
        })
        await years.insert(t.scope, { planId: p.id, userId, year: 2026 })
        await colours.insert(t.scope, { planId: p.id, userId })
      }
    }
  const scope = createErasureScope(h.db, a.organizationId)
  await eraseUserVacation(scope, 'person', 'erased_one')
  await eraseUserVacation(scope, 'second', 'erased_two')
  await eraseUserVacation(scope, 'person', 'erased_one')
  expect(
    (await plans.findMany(a.scope)).map((r) => r.ownerUserId).sort(),
  ).toEqual(['erased_one', 'erased_two', 'other'])
  for (const table of [
    vacayPlanMembers,
    vacayEntries,
    vacayUserYears,
    vacayUserColours,
  ]) {
    const repo = createTenantRepository(table, 'row')
    expect(
      (await repo.findMany(a.scope)).every((r) => r.userId === 'other'),
    ).toBe(true)
    expect(await repo.count(b.scope)).toBe(table === vacayPlanMembers ? 6 : 9)
  }
  const solo = await plans.insert(a.scope, { ownerUserId: 'solo' })
  await members.insert(a.scope, { planId: solo.id, userId: 'solo' })
  await eraseUserVacation(scope, 'solo', 'erased_solo')
  expect(await plans.findById(a.scope, solo.id)).toBeNull()
})

it('anonymises only related audit rows, removes personal metadata but keeps filenames and unrelated workspace history', async () => {
  const a = await h.seedTenant('a'),
    b = await h.seedTenant('b'),
    repo = createTenantRepository(auditLog, 'audit')
  for (const t of [a, b])
    for (let i = 0; i < 105; i++)
      await repo.insert(t.scope, {
        actorUserId: i % 2 ? 'person' : 'other',
        entityId: i % 2 ? 'thing' : 'person',
        action: 'user.updated',
        ip: '127.0.0.1',
        userAgent: 'agent',
        metadata: {
          name: 'Name',
          email: 'mail',
          actorName: 'Name',
          filename: 'name.pdf',
          count: 1,
        },
      })
  await repo.insert(a.scope, {
    actorUserId: 'other',
    action: 'user.updated',
    metadata: { name: 'Other' },
  })
  const scope = createErasureScope(h.db, a.organizationId)
  await eraseUserAudit(scope, 'person', 'erased_one')
  await eraseUserAudit(scope, 'person', 'erased_one')
  const rows = await repo.findMany(a.scope)
  expect(rows).toHaveLength(106)
  expect(
    rows
      .filter((r) => r.metadata?.filename)
      .every(
        (r) =>
          r.actorUserId !== 'person' &&
          r.entityId !== 'person' &&
          r.ip === null &&
          r.userAgent === null &&
          JSON.stringify(r.metadata) === '{"filename":"name.pdf","count":1}',
      ),
  ).toBe(true)
  expect(rows.find((r) => r.metadata?.name === 'Other')).toBeDefined()
  expect(
    (await repo.findMany(b.scope)).every(
      (r) => r.ip === '127.0.0.1' && r.metadata?.email === 'mail',
    ),
  ).toBe(true)
})

it('rejects ordinary scopes for every tenant scrub before doing any work', async () => {
  const a = await h.seedTenant('a')
  for (const scrub of [
    eraseUserPersonalData,
    eraseUserCollections,
    eraseUserVacation,
    eraseUserAudit,
  ])
    await expect(scrub(a.scope, 'person', 'erased_one')).rejects.toThrow(
      'Invalid erasure',
    )
  await expect(
    eraseUserJourneys(a.scope, 'person', 'erased_one', async () => {}),
  ).rejects.toThrow('Invalid erasure')
})

it('scrubs collections and vacation rows beyond a batch without truncation', async () => {
  const a = await h.seedTenant('a')
  const cs = createTenantRepository(collections, 'collection')
  const places = createTenantRepository(collectionPlaces, 'place')
  const plans = createTenantRepository(vacayPlans, 'plan')
  const entries = createTenantRepository(vacayEntries, 'entry')
  const plan = await plans.insert(a.scope, { ownerUserId: 'other' })
  for (let i = 0; i < 105; i++) {
    const c = await cs.insert(a.scope, {
      ownerUserId: 'person',
      name: String(i),
      slug: String(i),
    })
    await places.insert(a.scope, {
      collectionId: c.id,
      savedBy: 'person',
      name: 'Private',
    })
    await entries.insert(a.scope, {
      planId: plan.id,
      userId: 'person',
      date: `day-${i}`,
    })
  }
  const scope = createErasureScope(h.db, a.organizationId)
  await eraseUserCollections(scope, 'person', 'erased_one')
  await eraseUserVacation(scope, 'person', 'erased_one')
  expect(await cs.count(a.scope)).toBe(0)
  expect(await places.count(a.scope)).toBe(0)
  expect(await entries.count(a.scope)).toBe(0)
  expect(await plans.count(a.scope)).toBe(1)
})

it('captures a photo arriving during manifest persistence before any entry cascade', async () => {
  const a = await h.seedTenant('a')
  const js = createTenantRepository(journeys, 'journey')
  const es = createTenantRepository(journeyEntries, 'entry')
  const ps = createTenantRepository(journeyPhotos, 'photo')
  const j = await js.insert(a.scope, {
    ownerUserId: 'person',
    title: 'Journal',
    slug: 'journal',
  })
  const e = await es.insert(a.scope, {
    journeyId: j.id,
    authorUserId: 'person',
    entryDate: '2026-10-19',
  })
  await ps.insert(a.scope, {
    journeyId: j.id,
    entryId: e.id,
    uploadedBy: 'person',
    storageKey: 'first',
    contentType: 'image/jpeg',
  })
  let arrived = false
  const manifest: string[] = []
  await eraseUserJourneys(
    createErasureScope(h.db, a.organizationId),
    'person',
    'erased_one',
    async (keys) => {
      manifest.push(...keys)
      if (!arrived) {
        arrived = true
        await ps.insert(a.scope, {
          journeyId: j.id,
          entryId: e.id,
          uploadedBy: 'other',
          storageKey: 'late',
          contentType: 'image/jpeg',
        })
      }
    },
  )
  expect(manifest.sort()).toEqual(['first', 'late'])
  expect(await js.count(a.scope)).toBe(0)
})
