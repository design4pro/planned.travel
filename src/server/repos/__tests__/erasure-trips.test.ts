import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { member, user } from '#/server/db/auth-schema'
import { trips, tripMembers, tripFiles, auditLog } from '#/server/db/schema'
import { createErasureScope } from '#/server/erasure/scope'
import { createTenantRepository } from '../base'
import { eraseUserTrips } from '../trips-erasure'
import { upsertSubscription } from '../billing'
import {
  createTrip,
  deleteTrip,
  removeTripMember,
  TripLastOwnerError,
  tripMembersRepository,
  updateTripMember,
} from '../trips'
import { createHarness } from './harness'
import type { BatchStatement } from '../batch'
import type { Harness } from './harness'

let harness: Harness
beforeEach(async () => {
  harness = await createHarness()
})
afterEach(() => harness.close())
const tripRepo = createTenantRepository(trips, 'trip')
const members = createTenantRepository(tripMembers, 'trip member')
const files = createTenantRepository(tripFiles, 'file')

it('classifies departed banned creators, queues keys before deleting and leaves the same person in another workspace untouched', async () => {
  const a = await harness.seedTenant('a')
  const b = await harness.seedTenant('b')
  await upsertSubscription(a.scope, { quotaOverrides: { trips: 1000 } })
  const target = await a.addUser('Target')
  await b.addMembership(target)
  const targetScope = a.scopeFor(target)
  const privateTrip = await createTrip(targetScope, {
    title: 'Private',
    slug: 'private',
  })
  const publicTrip = await createTrip(targetScope, {
    title: 'Public',
    slug: 'public',
    visibility: 'public',
  })
  const organizationTrip = await createTrip(targetScope, {
    title: 'Org',
    slug: 'org',
    visibility: 'organization',
  })
  const theirs = await createTrip(b.scopeFor(target), {
    title: 'Other',
    slug: 'other',
  })
  const key = `trips/${a.organizationId}/${privateTrip.id}/file`
  await files.insert(a.scope, {
    tripId: privateTrip.id,
    uploadedBy: target,
    filename: 'file',
    storageKey: key,
    contentType: 'text/plain',
    sizeBytes: 1,
  })
  await tripRepo.requireUpdate(a.scope, privateTrip.id, {
    coverImageKey: key + '-cover',
  })
  await members.removeWhere(a.scope, eq(tripMembers.userId, target))
  await harness.db
    .delete(member)
    .where(
      and(
        eq(member.userId, target),
        eq(member.organizationId, a.organizationId),
      ),
    )
  await harness.db.update(user).set({ banned: true }).where(eq(user.id, target))
  const prepared: string[] = []
  const scope = createErasureScope(harness.db, a.organizationId)
  const prepare = async (input: {
    tripId: string
    storageKeys: ReadonlyArray<string>
  }) => {
    expect(await tripRepo.exists(a.scope, input.tripId)).toBe(true)
    if (input.tripId === privateTrip.id)
      expect(new Set(input.storageKeys)).toEqual(new Set([key, key + '-cover']))
    prepared.push(input.tripId)
  }
  await eraseUserTrips(scope, target, 'erased_target', prepare)
  expect(new Set(prepared)).toEqual(new Set([privateTrip.id, publicTrip.id]))
  expect(await tripRepo.exists(a.scope, privateTrip.id)).toBe(false)
  expect(await tripRepo.exists(a.scope, publicTrip.id)).toBe(false)
  expect(
    (await tripRepo.requireById(a.scope, organizationTrip.id)).createdBy,
  ).toBe('erased_target')
  expect(
    await members.findOne(a.scope, eq(tripMembers.tripId, organizationTrip.id)),
  ).toMatchObject({ userId: a.ownerUserId, role: 'owner' })
  expect((await tripRepo.requireById(b.scope, theirs.id)).createdBy).toBe(
    target,
  )
  await eraseUserTrips(scope, target, 'erased_target', prepare)
  expect(prepared).toHaveLength(2)
  await expect(deleteTrip(targetScope, organizationTrip.id)).rejects.toThrow()
})

it('promotes editors before viewers with deterministic date and id ties and writes a notice without personal fields', async () => {
  const a = await harness.seedTenant('a')
  await upsertSubscription(a.scope, { quotaOverrides: { trips: 1000 } })
  const target = await a.addUser('Target')
  const editor = await a.addUser('Editor')
  const viewer = await a.addUser('Viewer')
  const trip = await createTrip(a.scopeFor(target), {
    title: 'Shared',
    slug: 'shared',
  })
  await members.insert(a.scope, {
    id: 'editor-b',
    tripId: trip.id,
    userId: editor,
    role: 'editor',
    joinedAt: new Date(2),
    createdAt: new Date(3),
  })
  await members.insert(a.scope, {
    id: 'viewer-a',
    tripId: trip.id,
    userId: viewer,
    role: 'viewer',
    joinedAt: new Date(1),
    createdAt: new Date(1),
  })
  await eraseUserTrips(
    createErasureScope(harness.db, a.organizationId),
    target,
    'erased_target',
    async () => {
      throw new Error('shared trip must stay')
    },
  )
  expect(await members.findById(a.scope, 'editor-b')).toMatchObject({
    role: 'owner',
  })
  expect(await members.findById(a.scope, 'viewer-a')).toMatchObject({
    role: 'viewer',
  })
  const notices = await createTenantRepository(auditLog, 'audit').findMany(
    a.scope,
  )
  expect(notices).toHaveLength(1)
  expect(JSON.stringify(notices)).not.toContain(target)
  expect(notices[0]).toMatchObject({
    actorUserId: 'system:erasure',
    entityId: trip.id,
    metadata: null,
    ip: null,
    userAgent: null,
  })
})

it('does not cascade until cleanup has been durably prepared and can retry a failed preparation', async () => {
  const a = await harness.seedTenant('a')
  const trip = await createTrip(a.scope, { title: 'Private', slug: 'private' })
  await files.insert(a.scope, {
    tripId: trip.id,
    uploadedBy: a.ownerUserId,
    filename: 'file',
    storageKey: `trips/${a.organizationId}/${trip.id}/file`,
    contentType: 'text/plain',
  })
  const scope = createErasureScope(harness.db, a.organizationId)
  await expect(
    eraseUserTrips(scope, a.ownerUserId, 'erased_target', async () => {
      throw new Error('queue unavailable')
    }),
  ).rejects.toThrow('queue unavailable')
  expect(await tripRepo.exists(a.scope, trip.id)).toBe(true)
  expect(await files.count(a.scope)).toBe(1)
  await eraseUserTrips(scope, a.ownerUserId, 'erased_target', async (input) => {
    expect(input.storageKeys).toHaveLength(1)
  })
  expect(await tripRepo.exists(a.scope, trip.id)).toBe(false)
})

it('walks beyond one trip page without truncation', async () => {
  const a = await harness.seedTenant('a')
  const b = await harness.seedTenant('b')
  for (let i = 0; i < 105; i++)
    await tripRepo.insert(a.scope, {
      createdBy: 'person',
      title: 'Trip',
      slug: String(i),
    })
  const theirs = await tripRepo.insert(b.scope, {
    createdBy: 'person',
    title: 'Trip',
    slug: 'other',
  })
  const prepared: string[] = []
  await eraseUserTrips(
    createErasureScope(harness.db, a.organizationId),
    'person',
    'erased_target',
    async (input) => {
      prepared.push(input.tripId)
    },
  )
  expect(new Set(prepared).size).toBe(105)
  expect(await tripRepo.count(a.scope)).toBe(0)
  expect(await tripRepo.exists(b.scope, theirs.id)).toBe(true)
})

it.each([
  { label: 'joined date', aJoined: 2, aCreated: 1, bJoined: 3, bCreated: 1 },
  {
    label: 'created date after equal join',
    aJoined: 2,
    aCreated: 3,
    bJoined: 2,
    bCreated: 4,
  },
  {
    label: 'id after equal dates',
    aJoined: 2,
    aCreated: 3,
    bJoined: 2,
    bCreated: 3,
  },
  {
    label: 'missing join uses earlier creation',
    aJoined: null,
    aCreated: 1,
    bJoined: 2,
    bCreated: 1,
  },
  {
    label: 'missing join uses later creation',
    aJoined: 2,
    aCreated: 1,
    bJoined: null,
    bCreated: 3,
  },
])(
  'orders promotion by $label',
  async ({ aJoined, aCreated, bJoined, bCreated }) => {
    const a = await harness.seedTenant('a')
    const trip = await createTrip(a.scope, { title: 'Shared', slug: 'shared' })
    const first = await a.addUser('First')
    const second = await a.addUser('Second')
    for (const [id, userId, joined, created] of [
      ['candidate-a', first, aJoined, aCreated],
      ['candidate-b', second, bJoined, bCreated],
    ] as const) {
      await members.insert(a.scope, {
        id,
        tripId: trip.id,
        userId,
        role: 'editor',
        joinedAt: joined === null ? null : new Date(joined),
        createdAt: new Date(created),
      })
    }
    await eraseUserTrips(
      createErasureScope(harness.db, a.organizationId),
      a.ownerUserId,
      'erased_target',
      async () => {
        throw new Error('shared')
      },
    )
    expect((await members.requireById(a.scope, 'candidate-a')).role).toBe(
      'owner',
    )
    expect((await members.requireById(a.scope, 'candidate-b')).role).toBe(
      'editor',
    )
  },
)

it('hands a solo organization-visible trip to the longest-standing remaining workspace owner', async () => {
  const a = await harness.seedTenant('a')
  const target = await a.addUser('Target')
  const longstandingOwner = await a.addUser('Longstanding owner', 'owner')
  await harness.db
    .update(member)
    .set({ createdAt: new Date(1) })
    .where(eq(member.userId, longstandingOwner))
  const trip = await createTrip(a.scopeFor(target), {
    title: 'Org',
    slug: 'org',
    visibility: 'organization',
  })
  await eraseUserTrips(
    createErasureScope(harness.db, a.organizationId),
    target,
    'erased_target',
    async () => {
      throw new Error('organization trip must stay')
    },
  )
  expect(
    await members.findOne(a.scope, eq(tripMembers.tripId, trip.id)),
  ).toMatchObject({ userId: longstandingOwner, role: 'owner' })
})

it('deletes a solo organization-visible trip when the workspace has no other member', async () => {
  const a = await harness.seedTenant('a')
  const trip = await createTrip(a.scope, {
    title: 'Org',
    slug: 'org',
    visibility: 'organization',
  })
  const prepared: string[] = []
  await eraseUserTrips(
    createErasureScope(harness.db, a.organizationId),
    a.ownerUserId,
    'erased_target',
    async (input) => {
      prepared.push(input.tripId)
    },
  )
  expect(prepared).toEqual([trip.id])
  expect(await tripRepo.exists(a.scope, trip.id)).toBe(false)
})

it('reprepares identical cleanup after D1 fails following a successful durable handoff', async () => {
  const a = await harness.seedTenant('a')
  const trip = await createTrip(a.scope, { title: 'Private', slug: 'private' })
  await files.insert(a.scope, {
    tripId: trip.id,
    uploadedBy: a.ownerUserId,
    filename: 'file',
    storageKey: `trips/${a.organizationId}/${trip.id}/file`,
    contentType: 'text/plain',
  })
  const prepared: Array<ReadonlyArray<string>> = []
  const prepare = async (input: { storageKeys: ReadonlyArray<string> }) => {
    prepared.push(input.storageKeys)
  }
  const scope = createErasureScope(harness.db, a.organizationId)
  harness.sqlite.exec(
    "CREATE TRIGGER fail_delete BEFORE DELETE ON trips BEGIN SELECT RAISE(ABORT, 'D1 delete refused'); END",
  )
  await expect(
    eraseUserTrips(scope, a.ownerUserId, 'erased_target', prepare),
  ).rejects.toThrow()
  expect(await files.count(a.scope)).toBe(1)
  expect(await tripRepo.exists(a.scope, trip.id)).toBe(true)
  harness.sqlite.exec('DROP TRIGGER fail_delete')
  await eraseUserTrips(scope, a.ownerUserId, 'erased_target', prepare)
  expect(prepared).toHaveLength(2)
  expect(prepared[1]).toEqual(prepared[0])
  expect(await tripRepo.exists(a.scope, trip.id)).toBe(false)
})

it('rechecks solo classification atomically when a collaborator joins during cleanup preparation', async () => {
  const a = await harness.seedTenant('a')
  const trip = await createTrip(a.scope, { title: 'Private', slug: 'private' })
  const other = await a.addUser('Joining collaborator')
  const scope = createErasureScope(harness.db, a.organizationId)
  await expect(
    eraseUserTrips(scope, a.ownerUserId, 'erased_target', async () => {
      await members.insert(a.scope, {
        tripId: trip.id,
        userId: other,
        role: 'viewer',
      })
    }),
  ).rejects.toThrow('changed')
  expect(await tripRepo.exists(a.scope, trip.id)).toBe(true)
  expect(await members.findMany(a.scope)).toHaveLength(2)
  await eraseUserTrips(scope, a.ownerUserId, 'erased_target', async () => {
    throw new Error('now shared')
  })
  expect((await members.findMany(a.scope))[0]).toMatchObject({
    userId: other,
    role: 'owner',
  })
})

it('removes the departing owner in the same atomic handoff that prevents the promoted owner leaving', async () => {
  const a = await harness.seedTenant('a')
  const editor = await a.addUser('Editor')
  const viewer = await a.addUser('Viewer')
  const trip = await createTrip(a.scope, { title: 'Shared', slug: 'shared' })
  const candidate = await members.insert(a.scope, {
    tripId: trip.id,
    userId: editor,
    role: 'editor',
  })
  await members.insert(a.scope, {
    tripId: trip.id,
    userId: viewer,
    role: 'viewer',
  })
  const db = harness.db as typeof harness.db & {
    batch: (
      statements: readonly [BatchStatement, ...BatchStatement[]],
    ) => Promise<unknown[]>
  }
  const original = db.batch.bind(db)
  let attempted = false
  let leaveError: unknown
  vi.spyOn(db, 'batch').mockImplementation(async (statements) => {
    const result = await original(statements)
    if (
      !attempted &&
      (await members.findById(a.scope, candidate.id))?.role === 'owner'
    ) {
      attempted = true
      try {
        await removeTripMember(a.scopeFor(editor), candidate.id)
      } catch (error) {
        leaveError = error
      }
    }
    return result
  })
  await eraseUserTrips(
    createErasureScope(harness.db, a.organizationId),
    a.ownerUserId,
    'erased_target',
    async () => {
      throw new Error('shared')
    },
  )
  expect(attempted).toBe(true)
  expect(leaveError).toBeInstanceOf(TripLastOwnerError)
  expect(await members.findById(a.scope, candidate.id)).toMatchObject({
    role: 'owner',
  })
  await eraseUserTrips(
    createErasureScope(harness.db, a.organizationId),
    a.ownerUserId,
    'erased_target',
    async () => {
      throw new Error('shared')
    },
  )
  expect(
    (await members.findMany(a.scope)).filter((row) => row.role === 'owner'),
  ).toHaveLength(1)
})

it('reselects a surviving viewer atomically when the earlier editor leaves and does not duplicate the notice on retry', async () => {
  const a = await harness.seedTenant('a')
  const editor = await a.addUser('Editor')
  const viewer = await a.addUser('Viewer')
  const trip = await createTrip(a.scope, { title: 'Shared', slug: 'shared' })
  const candidate = await members.insert(a.scope, {
    tripId: trip.id,
    userId: editor,
    role: 'editor',
  })
  await members.insert(a.scope, {
    tripId: trip.id,
    userId: viewer,
    role: 'viewer',
  })
  const db = harness.db as typeof harness.db & {
    batch: (
      statements: readonly [BatchStatement, ...BatchStatement[]],
    ) => Promise<unknown[]>
  }
  const original = db.batch.bind(db)
  let attempted = false
  vi.spyOn(db, 'batch').mockImplementation(async (statements) => {
    if (!attempted) {
      attempted = true
      await removeTripMember(a.scopeFor(editor), candidate.id)
    }
    return original(statements)
  })
  const scope = createErasureScope(harness.db, a.organizationId)
  await eraseUserTrips(scope, a.ownerUserId, 'erased_target', async () => {
    throw new Error('shared')
  })
  expect((await tripRepo.requireById(a.scope, trip.id)).createdBy).toBe(
    'erased_target',
  )
  const audit = createTenantRepository(auditLog, 'audit')
  expect(await audit.count(a.scope)).toBe(1)
  await eraseUserTrips(scope, a.ownerUserId, 'erased_target', async () => {
    throw new Error('shared')
  })
  expect(await members.findMany(a.scope)).toEqual([
    expect.objectContaining({ userId: viewer, role: 'owner' }),
  ])
  expect(await audit.count(a.scope)).toBe(1)
})

it('keeps retry anchors and writes no notice when every successor leaves before the atomic handoff', async () => {
  const a = await harness.seedTenant('a')
  const editor = await a.addUser('Editor')
  const trip = await createTrip(a.scope, { title: 'Shared', slug: 'shared' })
  const candidate = await members.insert(a.scope, {
    tripId: trip.id,
    userId: editor,
    role: 'editor',
  })
  const db = harness.db as typeof harness.db & {
    batch: (
      statements: readonly [BatchStatement, ...BatchStatement[]],
    ) => Promise<unknown[]>
  }
  const original = db.batch.bind(db)
  let attempted = false
  vi.spyOn(db, 'batch').mockImplementation(async (statements) => {
    if (!attempted) {
      attempted = true
      await removeTripMember(a.scopeFor(editor), candidate.id)
    }
    return original(statements)
  })
  const scope = createErasureScope(harness.db, a.organizationId)
  await expect(
    eraseUserTrips(scope, a.ownerUserId, 'erased_target', async () => {
      throw new Error('not solo yet')
    }),
  ).rejects.toThrow('changed')
  expect((await tripRepo.requireById(a.scope, trip.id)).createdBy).toBe(
    a.ownerUserId,
  )
  expect(await members.findMany(a.scope)).toEqual([
    expect.objectContaining({ userId: a.ownerUserId, role: 'owner' }),
  ])
  expect(await createTenantRepository(auditLog, 'audit').count(a.scope)).toBe(0)
  await eraseUserTrips(scope, a.ownerUserId, 'erased_target', async (input) => {
    expect(input.tripId).toBe(trip.id)
  })
  expect(await tripRepo.exists(a.scope, trip.id)).toBe(false)
})

it('replaces an existing co-owner who leaves before the handoff instead of dropping the last owner', async () => {
  const a = await harness.seedTenant('a')
  const coowner = await a.addUser('Co-owner')
  const viewer = await a.addUser('Viewer')
  const trip = await createTrip(a.scope, { title: 'Shared', slug: 'shared' })
  const leaving = await members.insert(a.scope, {
    tripId: trip.id,
    userId: coowner,
    role: 'owner',
  })
  await members.insert(a.scope, {
    tripId: trip.id,
    userId: viewer,
    role: 'viewer',
  })
  const db = harness.db as typeof harness.db & {
    batch: (
      statements: readonly [BatchStatement, ...BatchStatement[]],
    ) => Promise<unknown[]>
  }
  const original = db.batch.bind(db)
  let attempted = false
  vi.spyOn(db, 'batch').mockImplementation(async (statements) => {
    if (!attempted) {
      attempted = true
      await removeTripMember(a.scopeFor(coowner), leaving.id)
    }
    return original(statements)
  })
  await eraseUserTrips(
    createErasureScope(harness.db, a.organizationId),
    a.ownerUserId,
    'erased_target',
    async () => {
      throw new Error('shared')
    },
  )
  expect(await members.findMany(a.scope)).toEqual([
    expect.objectContaining({ userId: viewer, role: 'owner' }),
  ])
  expect(await createTenantRepository(auditLog, 'audit').count(a.scope)).toBe(1)
})

it('rolls promotion, notice and creator anonymisation back together when departing-member deletion fails', async () => {
  const a = await harness.seedTenant('a')
  const editor = await a.addUser('Editor')
  const trip = await createTrip(a.scope, { title: 'Shared', slug: 'shared' })
  const candidate = await members.insert(a.scope, {
    tripId: trip.id,
    userId: editor,
    role: 'editor',
  })
  harness.sqlite.exec(
    "CREATE TRIGGER fail_handoff BEFORE DELETE ON trip_members BEGIN SELECT RAISE(ABORT, 'handoff unavailable'); END",
  )
  const scope = createErasureScope(harness.db, a.organizationId)
  await expect(
    eraseUserTrips(scope, a.ownerUserId, 'erased_target', async () => {
      throw new Error('shared')
    }),
  ).rejects.toThrow()
  expect((await members.requireById(a.scope, candidate.id)).role).toBe('editor')
  expect((await tripRepo.requireById(a.scope, trip.id)).createdBy).toBe(
    a.ownerUserId,
  )
  expect(await createTenantRepository(auditLog, 'audit').count(a.scope)).toBe(0)
  harness.sqlite.exec('DROP TRIGGER fail_handoff')
  await eraseUserTrips(scope, a.ownerUserId, 'erased_target', async () => {
    throw new Error('shared')
  })
  expect((await members.requireById(a.scope, candidate.id)).role).toBe('owner')
  expect(await createTenantRepository(auditLog, 'audit').count(a.scope)).toBe(1)
})

it.each(['leave', 'demote'] as const)(
  'refuses a stale %s that read editor before erasure promoted the sole remaining owner',
  async (operation) => {
    const a = await harness.seedTenant('a')
    const b = await harness.seedTenant('b')
    const editor = await a.addUser('Editor')
    const trip = await createTrip(a.scope, { title: 'Shared', slug: 'shared' })
    const otherTrip = await createTrip(b.scope, {
      title: 'Other',
      slug: 'other',
    })
    const foreign = await members.findOne(
      b.scope,
      eq(tripMembers.tripId, otherTrip.id),
    )
    if (foreign === null) throw new Error('Missing foreign owner')
    const candidate = await members.insert(a.scope, {
      tripId: trip.id,
      userId: editor,
      role: 'editor',
    })
    const read = tripMembersRepository.requireById.bind(tripMembersRepository)
    let interleaved = false
    const spy = vi
      .spyOn(tripMembersRepository, 'requireById')
      .mockImplementation(async (scope, id) => {
        const row = await read(scope, id)
        if (!interleaved && id === candidate.id) {
          interleaved = true
          await eraseUserTrips(
            createErasureScope(harness.db, a.organizationId),
            a.ownerUserId,
            'erased_target',
            async () => {
              throw new Error('shared')
            },
          )
        }
        return row
      })
    try {
      const scope = a.scopeFor(editor)
      const write = (id: string) =>
        operation === 'leave'
          ? removeTripMember(scope, id)
          : updateTripMember(scope, id, { role: 'viewer' })
      await expect(write(candidate.id)).rejects.toBeInstanceOf(
        TripLastOwnerError,
      )
      expect((await members.requireById(a.scope, candidate.id)).role).toBe(
        'owner',
      )
      await expect(write(foreign.id)).rejects.toThrow('not found')
      expect((await members.requireById(b.scope, foreign.id)).role).toBe(
        'owner',
      )
    } finally {
      spy.mockRestore()
    }
  },
)
