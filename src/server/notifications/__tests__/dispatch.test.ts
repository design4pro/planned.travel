/**
 * Notification dispatch — the composition layer between a write path and the inbox.
 *
 * Almost everything here runs against the real thing: a fully migrated in-memory
 * database, real repositories, real tenant scoping. The module mock exists for one
 * reason only — the fan-out bound at the bottom needs 501 recipients, and seeding
 * 501 users to prove a chunk size would measure the harness rather than the
 * chunker. With `stubs.memberIds` unset every mocked function delegates to the
 * real implementation, so the behaviour tests are not fixtures.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createLogger, createMemorySink } from '#/server/observability'
import { NotFoundError } from '#/server/repos/context'
import { createHarness } from '#/server/repos/__tests__/harness'

import type * as Repos from '#/server/repos'
import type { Notification, TripMember } from '#/server/db/types'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'

/* ------------------------------------------------------------------ mocking */

const stubs = vi.hoisted(() => ({
  /** When set, membership, profiles and the in-app write are faked at this size. */
  memberIds: null as Array<string> | null,
  notifyManyCalls: [] as Array<Array<string>>,
  profileCalls: [] as Array<Array<string>>,
}))

vi.mock('#/server/repos', async (importOriginal) => {
  const actual = await importOriginal<typeof Repos>()
  return {
    ...actual,
    listTripMembers: async (
      ...args: Parameters<typeof actual.listTripMembers>
    ): Promise<Array<TripMember>> => {
      const forced = stubs.memberIds
      if (forced === null) return actual.listTripMembers(...args)
      return forced.map(
        (userId) =>
          ({ id: `tm_${userId}`, userId, role: 'member' }) as TripMember,
      )
    },
    listUserProfiles: async (
      scope: TenantScope,
      userIds: ReadonlyArray<string>,
    ): Promise<Array<Repos.MemberProfile>> => {
      stubs.profileCalls.push([...userIds])
      if (stubs.memberIds === null)
        return actual.listUserProfiles(scope, userIds)
      return userIds.map(
        (userId) =>
          ({
            userId,
            email: `${userId}@example.test`,
            name: userId,
          }) as Repos.MemberProfile,
      )
    },
    filterEnabledRecipients: async (
      ...args: Parameters<typeof actual.filterEnabledRecipients>
    ): Promise<Array<string>> =>
      stubs.memberIds === null
        ? actual.filterEnabledRecipients(...args)
        : [...args[1]],
    notifyMany: async (
      ...args: Parameters<typeof actual.notifyMany>
    ): Promise<Array<Notification>> => {
      stubs.notifyManyCalls.push([...args[1]])
      return stubs.memberIds === null ? actual.notifyMany(...args) : []
    },
  }
})

const {
  EMAIL_BODY_BYTE_CAP,
  EMAIL_CHUNK_SIZE,
  IN_APP_CHUNK_SIZE,
  PROFILE_CHUNK_SIZE,
  QUEUE_BATCH_BYTE_CAP,
  dispatch,
  dispatchQuietly,
  notificationTaskId,
} = await import('../dispatch')

/* -------------------------------------------------------------------- queue */

/** A `TASKS` double that records what it was handed, or refuses everything. */
function recordingQueue(mode: 'accept' | 'reject' = 'accept') {
  const batches: Array<Array<{ body: unknown; delaySeconds?: number }>> = []
  return {
    batches,
    /** Every envelope across every batch, flattened. */
    envelopes(): Array<{
      id: string
      payload: { to: Array<string>; subject: string }
    }> {
      return batches.flatMap((batch) =>
        batch.map(
          (message) =>
            message.body as {
              id: string
              payload: { to: Array<string>; subject: string }
            },
        ),
      )
    },
    async send(): Promise<unknown> {
      throw new Error('dispatch must batch, never send one at a time')
    },
    async sendBatch(
      messages: Array<{ body: unknown; delaySeconds?: number }>,
    ): Promise<unknown> {
      if (mode === 'reject') throw new Error('queue unavailable')
      batches.push([...messages])
      return undefined
    },
  }
}

function memoryLogger() {
  const sink = createMemorySink()
  return { sink, logger: createLogger({ level: 'debug', sink }) }
}

/* ----------------------------------------------------------------- fixtures */

interface World {
  readonly tenant: SeededTenant
  readonly scope: TenantScope
  readonly ownerId: string
  readonly otherId: string
  readonly tripId: string
}

async function seedWorld(harness: Harness, label: string): Promise<World> {
  const { addTripMember, createTrip, upsertSubscription } =
    await import('#/server/repos')
  const tenant = await harness.seedTenant(label)
  await upsertSubscription(tenant.scope, {
    plan: 'pro',
    status: 'active',
    seats: 5,
  })
  const otherId = await tenant.addUser(`Second ${label}`)
  const trip = await createTrip(tenant.scope, {
    title: `Lisbon ${label}`,
    currency: 'EUR',
  })
  await addTripMember(tenant.scope, { tripId: trip.id, userId: otherId })
  return {
    tenant,
    scope: tenant.scope,
    ownerId: tenant.ownerUserId,
    otherId,
    tripId: trip.id,
  }
}

function messageEvent(world: World, over: Record<string, unknown> = {}) {
  return {
    kind: 'collab.message',
    tripId: world.tripId,
    entityType: 'collab_message',
    entityId: 'msg_1',
    actorUserId: world.ownerId,
    titleParams: { actorName: 'Owner', tripTitle: 'Lisbon' },
    bodyParams: { preview: 'Bring a jumper.' },
    ...over,
  }
}

/* -------------------------------------------------------------------- tests */

describe('dispatch', () => {
  let harness: Harness
  let alpha: World

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await seedWorld(harness, 'alpha')
  })

  afterEach(() => {
    stubs.memberIds = null
    stubs.notifyManyCalls = []
    stubs.profileCalls = []
    harness.close()
  })

  it('notifies the other trip members and never the actor', async () => {
    const { listNotifications } = await import('#/server/repos')

    const result = await dispatch(alpha.scope, messageEvent(alpha), {
      queue: null,
    })

    expect(result.recipients).toEqual([alpha.otherId])
    expect(result.inAppWritten).toBe(1)

    const forActor = await listNotifications(alpha.scope, alpha.ownerId)
    expect(forActor.items).toHaveLength(0)
    const forOther = await listNotifications(alpha.scope, alpha.otherId)
    expect(forOther.items).toHaveLength(1)
    expect(forOther.items[0]?.titleKey).toBe('collab.message')
  })

  it('writes a row for a member with no preference row at all', async () => {
    const { listNotifications, listPreferences } =
      await import('#/server/repos')

    // Absence means enabled: `isChannelEnabled` answers `row?.isEnabled ?? true`, so travellers
    // opt out and never in. A test written the other way round would encode the opposite product.
    expect(await listPreferences(alpha.scope, alpha.otherId)).toHaveLength(0)

    await dispatch(alpha.scope, messageEvent(alpha), { queue: null })

    expect(
      (await listNotifications(alpha.scope, alpha.otherId)).items,
    ).toHaveLength(1)
  })

  it('writes no in-app row for a member who opted out of the channel', async () => {
    const { listNotifications, setPreference } = await import('#/server/repos')
    await setPreference(alpha.scope, {
      userId: alpha.otherId,
      eventType: 'collab.message',
      channel: 'in_app',
      isEnabled: false,
    })

    const result = await dispatch(alpha.scope, messageEvent(alpha), {
      queue: null,
    })

    // Still a recipient of the event — the opt-out removes the channel, not the person.
    expect(result.recipients).toEqual([alpha.otherId])
    expect(result.inAppWritten).toBe(0)
    expect(
      (await listNotifications(alpha.scope, alpha.otherId)).items,
    ).toHaveLength(0)
  })

  it('excludes nobody when the event names no actor', async () => {
    const { listNotifications } = await import('#/server/repos')

    const result = await dispatch(
      alpha.scope,
      messageEvent(alpha, {
        actorUserId: undefined,
        kind: 'trip.starting_soon',
      }),
      { queue: null },
    )

    expect(new Set(result.recipients)).toEqual(
      new Set([alpha.ownerId, alpha.otherId]),
    )
    expect(
      (await listNotifications(alpha.scope, alpha.ownerId)).items,
    ).toHaveLength(1)
    expect(
      (await listNotifications(alpha.scope, alpha.otherId)).items,
    ).toHaveLength(1)
  })

  it('enqueues one envelope per recipient, addressed to that recipient alone', async () => {
    const queue = recordingQueue()

    const result = await dispatch(alpha.scope, messageEvent(alpha), {
      queue,
      appUrl: 'https://planned.travel/',
    })

    expect(result.emailsEnqueued).toBe(1)
    const envelopes = queue.envelopes()
    expect(envelopes).toHaveLength(1)
    expect(envelopes[0]?.id).toBe(
      notificationTaskId('collab.message', 'msg_1', alpha.otherId),
    )
    expect(envelopes[0]?.payload.to).toHaveLength(1)
    expect(envelopes[0]?.payload.to[0]).toContain('@example.test')
    // The subject is the catalogue's sentence, not a key and not a hardcoded string.
    expect(envelopes[0]?.payload.subject).toBe('Owner wrote in Lisbon')
  })

  it('sends no envelope to a member who opted out of email, and still writes their row', async () => {
    const { listNotifications, setPreference } = await import('#/server/repos')
    const queue = recordingQueue()
    await setPreference(alpha.scope, {
      userId: alpha.otherId,
      eventType: 'collab.message',
      channel: 'email',
      isEnabled: false,
    })

    const result = await dispatch(alpha.scope, messageEvent(alpha), { queue })

    expect(result.emailsEnqueued).toBe(0)
    expect(queue.batches).toHaveLength(0)
    expect(
      (await listNotifications(alpha.scope, alpha.otherId)).items,
    ).toHaveLength(1)
  })

  it('keeps the in-app rows when the queue rejects', async () => {
    const { listNotifications } = await import('#/server/repos')
    const { logger, sink } = memoryLogger()

    const result = await dispatch(alpha.scope, messageEvent(alpha), {
      queue: recordingQueue('reject'),
      logger,
    })

    expect(result.inAppWritten).toBe(1)
    expect(result.emailsEnqueued).toBe(0)
    expect(
      (await listNotifications(alpha.scope, alpha.otherId)).items,
    ).toHaveLength(1)
    expect(sink.records.filter((row) => row.level === 'warn')).toHaveLength(1)
  })

  it('logs once for a channel with no transport and writes the in-app row anyway', async () => {
    const { listNotifications } = await import('#/server/repos')
    const { logger, sink } = memoryLogger()

    const result = await dispatch(
      alpha.scope,
      messageEvent(alpha, { channels: ['in_app', 'push', 'webhook'] }),
      { queue: recordingQueue(), logger },
    )

    expect(result.unservedChannels).toEqual(['push', 'webhook'])
    expect(result.inAppWritten).toBe(1)
    expect(result.emailsEnqueued).toBe(0)
    expect(
      (await listNotifications(alpha.scope, alpha.otherId)).items,
    ).toHaveLength(1)
    expect(
      sink.records.filter(
        (row) => row.msg === 'notification channel has no transport',
      ),
    ).toHaveLength(1)
  })

  it('swallows and logs the authorisation failure when called quietly', async () => {
    const beta = await seedWorld(harness, 'beta')
    const { logger, sink } = memoryLogger()

    const result = await dispatchQuietly(
      alpha.scope,
      messageEvent(alpha, { tripId: beta.tripId }),
      { queue: null, logger },
    )

    expect(result).toBeNull()
    expect(sink.records.map((row) => row.msg)).toContain(
      'notification dispatch failed',
    )
  })

  it('resolves the actor name itself when the caller leaves it out', async () => {
    const { listNotifications } = await import('#/server/repos')

    await dispatch(
      alpha.scope,
      messageEvent(alpha, {
        titleParams: { tripTitle: 'Lisbon' },
        bodyParams: undefined,
      }),
      { queue: null },
    )

    const row = (await listNotifications(alpha.scope, alpha.otherId)).items.at(
      0,
    )
    expect(row?.titleParams).toMatchObject({
      actorName: 'Owner alpha',
      tripTitle: 'Lisbon',
    })
  })

  it('narrows to the audience, and an outsider on it reaches nobody', async () => {
    const { listNotifications } = await import('#/server/repos')
    const beta = await seedWorld(harness, 'beta')

    const result = await dispatch(
      alpha.scope,
      messageEvent(alpha, {
        kind: 'expense.added',
        // One real member of this trip, one member of another tenant. The audience intersects
        // membership, so the second is not addressable — this is the reason a recipient list is
        // never a dispatch input in the first place.
        audienceUserIds: [alpha.otherId, beta.otherId],
      }),
      { queue: null },
    )

    expect(result.recipients).toEqual([alpha.otherId])
    expect(
      (await listNotifications(alpha.scope, beta.otherId)).items,
    ).toHaveLength(0)
    expect(
      (await listNotifications(beta.scope, beta.otherId)).items,
    ).toHaveLength(0)
  })

  it('holds the rendered pair under the byte cap it sizes the batches against', async () => {
    const queue = recordingQueue()

    await dispatch(
      alpha.scope,
      messageEvent(alpha, { bodyParams: { preview: '&'.repeat(64 * 1024) } }),
      { queue },
    )

    const message = queue.batches[0]?.[0]?.body as {
      payload: { html: string; text: string; subject: string }
    }
    const bytes = new TextEncoder().encode(
      message.payload.html + message.payload.text,
    ).byteLength
    expect(bytes).toBeLessThanOrEqual(EMAIL_BODY_BYTE_CAP)
    // Truncated, not dropped: a body shrunk to nothing would satisfy a byte cap and tell the
    // reader nothing, and it is what a shrink step that ignores the double charge produces.
    expect(bytes).toBeGreaterThan(EMAIL_BODY_BYTE_CAP / 2)
    expect(message.payload.text).toContain('&&&')
    // The subject is never the thing that gets cut.
    expect(message.payload.subject).toBe('Owner wrote in Lisbon')
  })

  describe('fan-out bounds', () => {
    /**
     * 501 is the number that matters: `notifyMany` parses its recipient array through
     * `z.array(idSchema).max(500)` *before* de-duplicating, so the 501st recipient would throw a
     * `ZodError` and write no row at all — turning a successful trip message into a failed one on
     * a large workspace. Seeding 501 real users would measure the harness, so membership,
     * profiles and the two writes are the doubles at the top of this file.
     */
    const CROWD = 501

    beforeEach(() => {
      stubs.memberIds = [
        alpha.ownerId,
        ...Array.from(
          { length: CROWD },
          (_, index) => `usr_${String(index).padStart(4, '0')}`,
        ),
      ]
    })

    it('writes every in-app row across chunks that each respect the validator', async () => {
      await dispatch(alpha.scope, messageEvent(alpha), { queue: null })

      expect(stubs.notifyManyCalls).toHaveLength(2)
      for (const call of stubs.notifyManyCalls) {
        expect(call.length).toBeLessThanOrEqual(IN_APP_CHUNK_SIZE)
      }

      const written = stubs.notifyManyCalls.flat()
      expect(written).toHaveLength(CROWD)
      expect(new Set(written).size).toBe(CROWD)
      expect(written).not.toContain(alpha.ownerId)
    })

    it('enqueues every envelope in batches under both the message and the byte cap', async () => {
      const queue = recordingQueue()

      // A preview at the body cap, which is what the chunk size was sized against: 25 messages of
      // just under 9 KiB clear 256 KB with margin, and 501 in one batch miss it by an order of
      // magnitude. A short body would let an unchunked producer pass this test.
      const result = await dispatch(
        alpha.scope,
        messageEvent(alpha, { bodyParams: { preview: 'x'.repeat(16 * 1024) } }),
        { queue },
      )

      expect(result.emailsEnqueued).toBe(CROWD)
      expect(queue.batches).toHaveLength(Math.ceil(CROWD / EMAIL_CHUNK_SIZE))
      for (const batch of queue.batches) {
        expect(batch.length).toBeLessThanOrEqual(EMAIL_CHUNK_SIZE)
        // Bytes, not messages: the 256 KB ceiling is the one that binds first, and it is the
        // assertion an unchunked producer fails. Counting messages alone would not notice.
        const bytes = new TextEncoder().encode(
          JSON.stringify(batch.map((message) => message.body)),
        ).byteLength
        expect(bytes).toBeLessThan(QUEUE_BATCH_BYTE_CAP)
      }

      const envelopes = queue.envelopes()
      expect(new Set(envelopes.map((envelope) => envelope.id)).size).toBe(CROWD)
      for (const envelope of envelopes) {
        expect(envelope.payload.to).toHaveLength(1)
        expect(envelope.id.length).toBeLessThanOrEqual(128)
      }
    })

    it('resolves addresses in chunks its own repository accepts', async () => {
      await dispatch(alpha.scope, messageEvent(alpha), {
        queue: recordingQueue(),
      })

      expect(stubs.profileCalls).toHaveLength(
        Math.ceil(CROWD / PROFILE_CHUNK_SIZE),
      )
      for (const call of stubs.profileCalls) {
        expect(call.length).toBeLessThanOrEqual(PROFILE_CHUNK_SIZE)
      }
    })
  })

  it('rejects a trip from another tenant before it reads membership', async () => {
    const beta = await seedWorld(harness, 'beta')
    const { notificationsRepository } = await import('#/server/repos')

    await expect(
      dispatch(alpha.scope, messageEvent(alpha, { tripId: beta.tripId }), {
        queue: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundError)

    expect(await notificationsRepository.count(beta.scope)).toBe(0)
    expect(await notificationsRepository.count(alpha.scope)).toBe(0)
  })
})
