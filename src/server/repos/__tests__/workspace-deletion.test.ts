/**
 * Deleting a workspace (#1057): what goes, what is refused, and what the refusal leaves behind.
 *
 * Run on the DDL D1 is running (`{ ddl: 'migrations' }`) rather than the one `schema.ts` declares:
 * the cascade out of `organization` is the whole mechanism, and `drizzle-kit`'s `ADD COLUMN` does
 * not write every `ON DELETE` rule, so a gap between the two would be invisible on the default.
 */
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { member, organization } from '#/server/db/auth-schema'
import { newId, subscriptions } from '#/server/db/schema'
import {
  findLivePaidSubscription,
  getSubscription,
  setUsage,
  upsertSubscription,
} from '../billing'
import { sweepWorkspaceObjects } from '#/server/storage/workspace-objects'
import { fakeBucket } from '#/server/storage/__tests__/fake-bucket'
import { createScope } from '../base'
import { NotFoundError, ForbiddenError } from '../context'
import { recordFile } from '../files'
import {
  addPhoto,
  createJourney,
  journeyPhotosRepository,
  listWorkspaceJourneyPhotoKeys,
} from '../journey'
import {
  WorkspaceHasLiveSubscriptionError,
  WorkspaceNotEmptyError,
  deleteWorkspace,
} from '../members'
import { createPlace } from '../places'
import { createTrip, listWorkspaceTripIds } from '../trips'
import { captureError, createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { SUBSCRIPTION_STATUSES } from '#/server/db/schema'

type Status = (typeof SUBSCRIPTION_STATUSES)[number]

let harness: Harness

beforeEach(async () => {
  harness = await createHarness({ ddl: 'migrations' })
})
afterEach(() => harness.close())

/** A trip with a place and a file, a journey with a photo, a usage counter: rows in several modules. */
async function seedContent(tenant: SeededTenant, label: string) {
  const trip = await createTrip(tenant.scope, {
    title: `Trip ${label}`,
    currency: 'EUR',
  })
  await createPlace(tenant.scope, {
    tripId: trip.id,
    name: `Place ${label}`,
    lat: 38.7,
    lng: -9.1,
  })
  await recordFile(tenant.scope, {
    tripId: trip.id,
    storageKey: `trips/${tenant.organizationId}/${trip.id}/f-${label}.pdf`,
    filename: `${label}.pdf`,
    contentType: 'application/pdf',
    sizeBytes: 10,
  })
  const journey = await createJourney(tenant.scope, {
    title: `Journey ${label}`,
  })
  await addPhoto(tenant.scope, {
    journeyId: journey.id,
    storageKey: `journeys/${tenant.organizationId}/${label}.jpg`,
    thumbnailKey: `journeys/${tenant.organizationId}/${label}.thumb.jpg`,
    contentType: 'image/jpeg',
  })
  await setUsage(tenant.scope, { metric: 'trips', value: 1 })
  return { tripId: trip.id }
}

/** Rows per tenant table for one organization, from the database itself so no table is forgotten. */
function rowCounts(organizationId: string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const name of harness.tableNames()) {
    const columns = harness.sqlite
      .prepare(`pragma table_info("${name}")`)
      .all() as Array<{ name: string }>
    if (!columns.some((column) => column.name === 'organization_id')) continue
    const row = harness.sqlite
      .prepare(`select count(*) as n from "${name}" where organization_id = ?`)
      .get(organizationId) as { n: number }
    counts[name] = row.n
  }
  return counts
}

function organizationRows(organizationId: string) {
  return harness.db
    .select()
    .from(organization)
    .where(eq(organization.id, organizationId))
}

describe('deleteWorkspace', () => {
  it('deletes a workspace whose only member is the departing person, with every tenant row', async () => {
    const a = await harness.seedTenant('a')
    await seedContent(a, 'a')

    const before = rowCounts(a.organizationId)
    expect(
      Object.values(before).filter((n) => n > 0).length,
    ).toBeGreaterThanOrEqual(8)

    await deleteWorkspace(a.scope, { departingUserId: a.ownerUserId })

    expect(await organizationRows(a.organizationId)).toEqual([])
    expect(
      Object.values(rowCounts(a.organizationId)).every((n) => n === 0),
    ).toBe(true)
  })

  it('leaves another workspace, and every row of it, untouched', async () => {
    const a = await harness.seedTenant('a')
    const b = await harness.seedTenant('b')
    await seedContent(a, 'a')
    await seedContent(b, 'b')
    await upsertSubscription(b.scope, {
      status: 'active',
      providerSubscriptionId: 'sub_b',
    })
    const bBefore = rowCounts(b.organizationId)

    await deleteWorkspace(a.scope, { departingUserId: a.ownerUserId })

    expect(rowCounts(b.organizationId)).toEqual(bBefore)
    expect(await organizationRows(b.organizationId)).toHaveLength(1)
    expect(await listWorkspaceTripIds(b.scope)).toHaveLength(1)
    expect(await listWorkspaceJourneyPhotoKeys(b.scope)).toHaveLength(2)
  })

  it('cannot be pointed at another workspace by anything the caller passes', async () => {
    const a = await harness.seedTenant('a')
    const b = await harness.seedTenant('b')

    // The only workspace a call can delete is the scope's own; a user id from B changes nothing about that.
    const error = await captureError(() =>
      deleteWorkspace(a.scope, { departingUserId: b.ownerUserId }),
    )

    expect(error).toBeInstanceOf(WorkspaceNotEmptyError)
    expect(await organizationRows(a.organizationId)).toHaveLength(1)
    expect(await organizationRows(b.organizationId)).toHaveLength(1)
  })

  it('deletes a workspace with no member at all when nobody is named', async () => {
    const a = await harness.seedTenant('a')
    await seedContent(a, 'a')
    harness.sqlite
      .prepare('delete from member where organization_id = ?')
      .run(a.organizationId)

    await deleteWorkspace(a.scope)

    expect(await organizationRows(a.organizationId)).toEqual([])
  })

  it('refuses while the owner is still a member and nobody is named', async () => {
    const a = await harness.seedTenant('a')

    const error = await captureError(() => deleteWorkspace(a.scope))

    expect(error).toBeInstanceOf(WorkspaceNotEmptyError)
    expect(await organizationRows(a.organizationId)).toHaveLength(1)
  })

  it('refuses with a second member, naming the workspace, and changes nothing', async () => {
    const a = await harness.seedTenant('a')
    await seedContent(a, 'a')
    await a.addUser('Second')
    const before = rowCounts(a.organizationId)

    const error = await captureError(() =>
      deleteWorkspace(a.scope, { departingUserId: a.ownerUserId }),
    )

    expect(error).toBeInstanceOf(WorkspaceNotEmptyError)
    expect(error.message).toContain('Workspace a')
    expect(rowCounts(a.organizationId)).toEqual(before)
  })

  it('refuses a second member who is not the one named', async () => {
    const a = await harness.seedTenant('a')
    const second = await a.addUser('Second')
    harness.sqlite
      .prepare('delete from member where organization_id = ? and user_id = ?')
      .run(a.organizationId, a.ownerUserId)

    // The only member left is `second`; naming the owner must not delete their workspace.
    const error = await captureError(() =>
      deleteWorkspace(a.scope, { departingUserId: a.ownerUserId }),
    )

    expect(error).toBeInstanceOf(WorkspaceNotEmptyError)
    expect(await organizationRows(a.organizationId)).toHaveLength(1)
    await expect(
      deleteWorkspace(a.scope, { departingUserId: second }),
    ).resolves.toBeUndefined()
  })

  it('refuses a plain member and lets an admin through', async () => {
    const a = await harness.seedTenant('a')
    const memberScope = a.scopeFor(a.ownerUserId, 'member')
    const adminScope = a.scopeFor(a.ownerUserId, 'admin')

    const error = await captureError(() =>
      deleteWorkspace(memberScope, { departingUserId: a.ownerUserId }),
    )

    expect(error).toBeInstanceOf(ForbiddenError)
    expect(await organizationRows(a.organizationId)).toHaveLength(1)
    await deleteWorkspace(adminScope, { departingUserId: a.ownerUserId })
    expect(await organizationRows(a.organizationId)).toEqual([])
  })

  it('reports a workspace that is already gone as not found', async () => {
    const a = await harness.seedTenant('a')
    await deleteWorkspace(a.scope, { departingUserId: a.ownerUserId })

    const error = await captureError(() =>
      deleteWorkspace(a.scope, { departingUserId: a.ownerUserId }),
    )

    expect(error).toBeInstanceOf(NotFoundError)
  })

  it('rejects a malformed departing user id', async () => {
    const a = await harness.seedTenant('a')

    await expect(
      deleteWorkspace(a.scope, { departingUserId: '' }),
    ).rejects.toThrow()
    expect(await organizationRows(a.organizationId)).toHaveLength(1)
  })
})

describe('the subscription gate', () => {
  const live: ReadonlyArray<Status> = [
    'trialing',
    'active',
    'past_due',
    'unpaid',
    'paused',
  ]
  const notLive: ReadonlyArray<Status> = [
    'canceled',
    'incomplete',
    'incomplete_expired',
  ]

  it.each(live)('blocks on a paid subscription that is %s', async (status) => {
    const a = await harness.seedTenant('a')
    await upsertSubscription(a.scope, {
      status,
      providerSubscriptionId: 'sub_a',
    })

    const error = await captureError(() =>
      deleteWorkspace(a.scope, { departingUserId: a.ownerUserId }),
    )

    expect(error).toBeInstanceOf(WorkspaceHasLiveSubscriptionError)
    expect(error.message).toContain('Workspace a')
    expect(error.message).toMatch(/billing portal/)
    expect(await organizationRows(a.organizationId)).toHaveLength(1)
    expect((await getSubscription(a.scope))?.status).toBe(status)
  })

  it.each(notLive)(
    'does not block on a paid subscription that is %s',
    async (status) => {
      const a = await harness.seedTenant('a')
      await upsertSubscription(a.scope, {
        status,
        providerSubscriptionId: 'sub_a',
      })

      await deleteWorkspace(a.scope, { departingUserId: a.ownerUserId })

      expect(await organizationRows(a.organizationId)).toEqual([])
    },
  )

  it('does not block on a subscription already set to end with the period', async () => {
    const a = await harness.seedTenant('a')
    await upsertSubscription(a.scope, {
      status: 'active',
      providerSubscriptionId: 'sub_a',
      cancelAtPeriodEnd: true,
    })

    expect(await findLivePaidSubscription(a.scope)).toBeNull()
    await deleteWorkspace(a.scope, { departingUserId: a.ownerUserId })
    expect(await organizationRows(a.organizationId)).toEqual([])
  })

  it('does not block on a free row, which has no provider subscription', async () => {
    const a = await harness.seedTenant('a')
    await upsertSubscription(a.scope, { plan: 'free', status: 'active' })

    await deleteWorkspace(a.scope, { departingUserId: a.ownerUserId })

    expect(await organizationRows(a.organizationId)).toEqual([])
  })

  it('does not block on a workspace with no subscription row at all', async () => {
    const a = await harness.seedTenant('a')

    await deleteWorkspace(a.scope, { departingUserId: a.ownerUserId })

    expect(await organizationRows(a.organizationId)).toEqual([])
  })

  it('does not read another workspace’s subscription', async () => {
    const a = await harness.seedTenant('a')
    const b = await harness.seedTenant('b')
    await upsertSubscription(b.scope, {
      status: 'active',
      providerSubscriptionId: 'sub_b',
    })

    expect(await findLivePaidSubscription(a.scope)).toBeNull()
    await deleteWorkspace(a.scope, { departingUserId: a.ownerUserId })
    expect(await organizationRows(a.organizationId)).toEqual([])
    expect(await findLivePaidSubscription(b.scope)).not.toBeNull()
  })

  it('cancels and refunds nothing: the row it refused on is exactly as it was', async () => {
    const a = await harness.seedTenant('a')
    const row = await upsertSubscription(a.scope, {
      status: 'active',
      providerSubscriptionId: 'sub_a',
    })

    await captureError(() =>
      deleteWorkspace(a.scope, { departingUserId: a.ownerUserId }),
    )

    expect(await getSubscription(a.scope)).toEqual(row)
  })
})

describe('a change between the refusal check and the delete', () => {
  /**
   * D1 has no interactive transaction, so the checks are read first and enforced again inside the
   * one `DELETE`. These tests change the database after the reads and before that statement.
   */
  function scopeThatChangesBeforeDelete(
    tenant: SeededTenant,
    change: () => void,
  ) {
    const db = new Proxy(harness.db, {
      get(target, property, receiver) {
        if (property === 'delete') {
          change()
        }
        return Reflect.get(target, property, receiver)
      },
    })
    return createScope(db, {
      userId: tenant.ownerUserId,
      organizationId: tenant.organizationId,
      role: 'owner',
      impersonatedBy: null,
    })
  }

  it('does not delete a workspace somebody joined in the meantime', async () => {
    const a = await harness.seedTenant('a')
    const other = await harness.seedTenant('other')
    const scope = scopeThatChangesBeforeDelete(a, () => {
      harness.sqlite
        .prepare(
          'insert into member (id, organization_id, user_id, role, created_at) values (?, ?, ?, ?, ?)',
        )
        .run(newId(), a.organizationId, other.ownerUserId, 'member', Date.now())
    })

    const error = await captureError(() =>
      deleteWorkspace(scope, { departingUserId: a.ownerUserId }),
    )

    expect(error).toBeInstanceOf(WorkspaceNotEmptyError)
    expect(await organizationRows(a.organizationId)).toHaveLength(1)
  })

  it('does not delete a workspace whose subscription went live in the meantime', async () => {
    const a = await harness.seedTenant('a')
    await upsertSubscription(a.scope, {
      status: 'canceled',
      providerSubscriptionId: 'sub_a',
    })
    const scope = scopeThatChangesBeforeDelete(a, () => {
      harness.sqlite
        .prepare(
          "update subscriptions set status = 'active' where organization_id = ?",
        )
        .run(a.organizationId)
    })

    const error = await captureError(() =>
      deleteWorkspace(scope, { departingUserId: a.ownerUserId }),
    )

    expect(error).toBeInstanceOf(WorkspaceHasLiveSubscriptionError)
    expect(await organizationRows(a.organizationId)).toHaveLength(1)
    const [row] = await harness.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.organizationId, a.organizationId)))
    expect(row?.status).toBe('active')
  })
})

describe('journey photo object ownership', () => {
  it.each(['storageKey', 'thumbnailKey'] as const)(
    'rejects foreign, overlapping and legacy %s independently',
    async (field) => {
      const a = await harness.seedTenant('a')
      const b = await harness.seedTenant('b')
      const journey = await createJourney(a.scope, { title: 'Owned' })
      const prefix = `journeys/${a.organizationId}/`
      for (const unsafe of [
        `journeys/${b.organizationId}/photo.jpg`,
        `journeys/${a.organizationId}b/photo.jpg`,
        'demo/journeys/shared.jpg',
        prefix.slice(0, -1),
      ]) {
        await expect(
          addPhoto(a.scope, {
            journeyId: journey.id,
            storageKey: `${prefix}photo.jpg`,
            thumbnailKey: `${prefix}thumb.jpg`,
            contentType: 'image/jpeg',
            [field]: unsafe,
          }),
        ).rejects.toThrow()
      }
      expect(await listWorkspaceJourneyPhotoKeys(a.scope)).toEqual([])
      expect(await listWorkspaceJourneyPhotoKeys(b.scope)).toEqual([])
    },
  )

  it('accepts owned originals with absent, null and owned thumbnails', async () => {
    const a = await harness.seedTenant('a')
    const journey = await createJourney(a.scope, { title: 'Owned' })
    for (const [index, thumbnailKey] of [
      undefined,
      null,
      `journeys/${a.organizationId}/thumb.jpg`,
    ].entries()) {
      const photo = await addPhoto(a.scope, {
        journeyId: journey.id,
        storageKey: `journeys/${a.organizationId}/${index}.jpg`,
        thumbnailKey,
        contentType: 'image/jpeg',
      })
      expect(photo.thumbnailKey).toBe(thumbnailKey ?? null)
    }
  })

  it('preserves foreign originals, thumbnails and shared legacy objects named by A rows', async () => {
    const a = await harness.seedTenant('a')
    const b = await harness.seedTenant('b')
    const journey = await createJourney(a.scope, { title: 'Legacy' })
    const retained = [
      `journeys/${b.organizationId}/photo.jpg`,
      `journeys/${b.organizationId}/thumb.jpg`,
      `journeys/${a.organizationId}b/photo.jpg`,
      `journeys/${a.organizationId}b/thumb.jpg`,
      'demo/journeys/shared.jpg',
      'demo/journeys/shared-thumb.jpg',
    ]
    // Seed historical rows through the base repository, bypassing today's insertion guard.
    for (let index = 0; index < retained.length; index += 2) {
      await journeyPhotosRepository.insert(a.scope, {
        journeyId: journey.id,
        storageKey: retained[index],
        thumbnailKey: retained[index + 1],
        contentType: 'image/jpeg',
        uploadedBy: a.ownerUserId,
      })
    }
    const owned = `journeys/${a.organizationId}/owned.jpg`
    await addPhoto(a.scope, {
      journeyId: journey.id,
      storageKey: owned,
      contentType: 'image/jpeg',
    })
    const bucket = fakeBucket([owned, ...retained])
    await sweepWorkspaceObjects(
      bucket,
      a.organizationId,
      await listWorkspaceJourneyPhotoKeys(a.scope),
    )
    expect([...bucket.remaining].sort()).toEqual([...retained].sort())
  })
})

describe('collecting what the rows name before they go', () => {
  it('lists every trip of the workspace and every journey photo key, and only its own', async () => {
    const a = await harness.seedTenant('a')
    const b = await harness.seedTenant('b')
    const { tripId } = await seedContent(a, 'a')
    await createTrip(a.scope, { title: 'Second', currency: 'EUR' })
    await seedContent(b, 'b')

    expect(await listWorkspaceTripIds(a.scope)).toHaveLength(2)
    expect(await listWorkspaceTripIds(a.scope)).toContain(tripId)
    expect(await listWorkspaceJourneyPhotoKeys(a.scope)).toEqual([
      `journeys/${a.organizationId}/a.jpg`,
      `journeys/${a.organizationId}/a.thumb.jpg`,
    ])
  })

  it('is for administrators only', async () => {
    const a = await harness.seedTenant('a')
    const memberScope = a.scopeFor(a.ownerUserId, 'member')

    await expect(listWorkspaceTripIds(memberScope)).rejects.toBeInstanceOf(
      ForbiddenError,
    )
    await expect(
      listWorkspaceJourneyPhotoKeys(memberScope),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })
})

describe('the schema the delete relies on', () => {
  /** Tenant tables that carry an organization id on purpose without being cascaded out with it. */
  const KEPT_AFTER_DELETE: ReadonlyArray<string> = [
    // Metering attribution for the platform's own cost accounting, not tenant content (SPEC §5).
    'provider_usage',
  ]

  it('cascades every table that has an organization_id out of the organization row', () => {
    const uncovered: Array<string> = []
    for (const name of harness.tableNames()) {
      const columns = harness.sqlite
        .prepare(`pragma table_info("${name}")`)
        .all() as Array<{ name: string }>
      if (!columns.some((column) => column.name === 'organization_id')) continue
      if (KEPT_AFTER_DELETE.includes(name)) continue
      const keys = harness.sqlite
        .prepare(`pragma foreign_key_list("${name}")`)
        .all() as Array<{
        from: string
        table: string
        on_delete: string
      }>
      const cascades = keys.some(
        (key) =>
          key.from === 'organization_id' &&
          key.table === 'organization' &&
          key.on_delete === 'CASCADE',
      )
      if (!cascades) uncovered.push(name)
    }
    expect(uncovered).toEqual([])
  })

  it('leaves no member row behind a deleted organization', async () => {
    const a = await harness.seedTenant('a')
    await deleteWorkspace(a.scope, { departingUserId: a.ownerUserId })

    const rows = await harness.db
      .select()
      .from(member)
      .where(eq(member.organizationId, a.organizationId))
    expect(rows).toEqual([])
  })
})
