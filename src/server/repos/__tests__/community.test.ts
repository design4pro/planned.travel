import { afterEach, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createHarness } from '#/server/repos/__tests__/harness'
import { createTrip } from '#/server/repos/trips'
import { createScope } from '#/server/repos/base'
import { member } from '#/server/db/auth-schema'
import { galleryPreviews } from '#/server/db/schema'
import {
  previewGallerySubmission,
  readGalleryPreview,
  expireGalleryPreviews,
} from '#/server/repos/community'
import { parseGallerySnapshot } from '#/server/community/snapshot'
import type { Harness } from '#/server/repos/__tests__/harness'

let harness: Harness | undefined
afterEach(() => {
  harness?.close()
  harness = undefined
})
function ready<T extends { status: string }>(
  value: T,
): asserts value is Extract<T, { status: 'ready' }> {
  expect(value.status).toBe('ready')
}
const fields = {
  publicTitle: 'Public',
  summary: 'Summary',
  attribution: 'Traveller',
  showDates: false,
}

it('stores exact canonical bytes, replaces only the actor/trip record and expires it', async () => {
  harness = await createHarness()
  const tenant = await harness.seedTenant('alpha')
  const other = await harness.seedTenant('beta')
  const trip = await createTrip(tenant.scope, {
    title: 'Private',
    currency: 'EUR',
  })
  const first = await previewGallerySubmission(
    tenant.scope,
    { tripId: trip.id, ...fields },
    1000,
  )
  ready(first)
  expect(first.document).toEqual({
    version: 1,
    ...fields,
    countryCodes: [],
    days: [],
  })
  expect(
    await readGalleryPreview(other.scope, first.previewId, trip.id, 1000),
  ).toBeNull()
  const replaced = await previewGallerySubmission(
    tenant.scope,
    { tripId: trip.id, ...fields, publicTitle: 'New' },
    2000,
  )
  ready(replaced)
  expect(
    await readGalleryPreview(tenant.scope, first.previewId, trip.id, 2000),
  ).toBeNull()
  expect(
    await readGalleryPreview(
      tenant.scope,
      replaced.previewId,
      trip.id,
      replaced.expiresAt,
    ),
  ).toBeNull()
  expect(await expireGalleryPreviews(other.scope, replaced.expiresAt)).toBe(0)
  expect(await expireGalleryPreviews(tenant.scope, replaced.expiresAt)).toBe(1)
})

it('refuses current role revocation and private-trip outsiders without replacing the previous preview', async () => {
  harness = await createHarness()
  const tenant = await harness.seedTenant('alpha')
  const trip = await createTrip(tenant.scope, {
    title: 'Private',
    currency: 'EUR',
  })
  const first = await previewGallerySubmission(tenant.scope, {
    tripId: trip.id,
    ...fields,
  })
  ready(first)
  const outsider = await tenant.addUser('outsider', 'admin')
  await expect(
    previewGallerySubmission(tenant.scopeFor(outsider, 'admin'), {
      tripId: trip.id,
      ...fields,
    }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await harness.db
    .update(member)
    .set({ role: 'member' })
    .where(eq(member.userId, tenant.ownerUserId))
  await expect(
    previewGallerySubmission(tenant.scope, { tripId: trip.id, ...fields }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  const rows = await harness.db.select().from(galleryPreviews)
  expect(rows.map((row) => row.id)).toEqual([first.previewId])
  const forged = createScope(harness.db, {
    ...tenant.scope.ctx,
    organizationId: 'missing',
  })
  await expect(
    previewGallerySubmission(forged, { tripId: trip.id, ...fields }),
  ).rejects.toMatchObject({ code: 'NOT_FOUND' })
})

it('rejects unknown fields, dates without consent and oversized UTF-8 documents', () => {
  const document = { version: 1, ...fields, countryCodes: [], days: [] }
  expect(parseGallerySnapshot(JSON.stringify(document))).toEqual(document)
  expect(() =>
    parseGallerySnapshot(JSON.stringify({ ...document, notes: 'secret' })),
  ).toThrow()
  expect(() =>
    parseGallerySnapshot(
      JSON.stringify({
        ...document,
        days: [{ order: 1, date: '2026-01-01', places: [] }],
      }),
    ),
  ).toThrow()
  expect(() =>
    parseGallerySnapshot(
      JSON.stringify({
        ...document,
        days: [{ order: 1, title: 'é'.repeat(262144), places: [] }],
      }),
    ),
  ).toThrow()
})

it('removes the erased actor’s previews while retaining other actors and tenants', async () => {
  const { tripMembers } = await import('#/server/db/schema')
  const { eraseUserTrips } = await import('#/server/repos/trips-erasure')
  harness = await createHarness()
  const tenant = await harness.seedTenant('alpha')
  const other = await harness.seedTenant('beta')
  const trip = await createTrip(tenant.scope, {
    title: 'Shared',
    currency: 'EUR',
  })
  const otherTrip = await createTrip(other.scope, {
    title: 'Other',
    currency: 'EUR',
  })
  const successor = await tenant.addUser('successor', 'owner')
  await harness.db.insert(tripMembers).values({
    organizationId: tenant.organizationId,
    tripId: trip.id,
    userId: successor,
    role: 'owner',
  })
  const first = await previewGallerySubmission(tenant.scope, {
    tripId: trip.id,
    ...fields,
  })
  const retained = await previewGallerySubmission(
    tenant.scopeFor(successor, 'owner'),
    { tripId: trip.id, ...fields },
  )
  const victim = await previewGallerySubmission(other.scope, {
    tripId: otherTrip.id,
    ...fields,
  })
  ready(first)
  ready(retained)
  ready(victim)
  const eraser = createScope(harness.db, {
    ...tenant.scope.ctx,
    userId: 'system:erasure',
  })
  await eraseUserTrips(
    eraser,
    tenant.ownerUserId,
    'erased_actor',
    async () => {},
  )
  expect(
    (await harness.db.select().from(galleryPreviews))
      .map((row) => row.id)
      .sort(),
  ).toEqual([retained.previewId, victim.previewId].sort())
})
