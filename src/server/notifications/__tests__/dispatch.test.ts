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
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ZodError } from 'zod'

import { createLogger, createMemorySink } from '#/server/observability'
import { NotFoundError } from '#/server/repos/context'
import { ID_FILTER_CHUNK } from '#/server/repos/trips'
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
  notifyManyInputs: [] as Array<unknown>,
  profileCalls: [] as Array<Array<string>>,
  preferenceCalls: [] as Array<Array<string>>,
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
    ): Promise<Array<string>> => {
      stubs.preferenceCalls.push([...args[1]])
      return stubs.memberIds === null
        ? actual.filterEnabledRecipients(...args)
        : [...args[1]]
    },
    notifyMany: async (
      ...args: Parameters<typeof actual.notifyMany>
    ): Promise<Array<Notification>> => {
      stubs.notifyManyCalls.push([...args[1]])
      stubs.notifyManyInputs.push(args[2])
      return stubs.memberIds === null ? actual.notifyMany(...args) : []
    },
  }
})

const {
  D1_MAX_BOUND_PARAMETERS,
  EMAIL_BODY_BYTE_CAP,
  EMAIL_CHUNK_SIZE,
  IN_APP_CHUNK_SIZE,
  NOTIFICATION_ROW_PARAMETERS,
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
    stubs.notifyManyInputs = []
    stubs.profileCalls = []
    stubs.preferenceCalls = []
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
     * A crowd larger than every limit downstream of dispatch, so each chunker has to be doing its
     * job for the fan-out to land at all.
     *
     * The smallest of those limits is D1's, not a validator's: a `notifications` row binds sixteen
     * parameters and D1 refuses a statement carrying more than a hundred, so an unchunked
     * `notifyMany` writes no row at all for a trip with seven reachable members — and
     * `dispatchQuietly` swallows the refusal, which is what makes it worth a test. 501 also clears
     * the `z.array(idSchema).max(500)` `notifyMany` parses *before* de-duplicating, and the 200
     * `listUserProfiles` validates. Seeding 501 real users would measure the harness, so
     * membership, profiles, preferences and the in-app write are the doubles at the top of this
     * file.
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

    /**
     * The chunk size, held against the statement it actually produces rather than against a
     * comment — the rule `docs/plans/01-trips-core.md` states for every multi-row write.
     *
     * The payload is not written out here: it is the one the last real dispatch handed `notifyMany`,
     * replayed against a Drizzle handle that answers nothing and only counts what was bound. A
     * thirteenth column on the row therefore fails this test rather than production.
     */
    it('binds a statement D1 accepts for a full in-app chunk', async () => {
      stubs.memberIds = null
      await dispatch(alpha.scope, messageEvent(alpha), { queue: null })
      const input = stubs.notifyManyInputs.at(0)
      expect(input).toBeDefined()

      const { createScope, notifyMany } =
        await vi.importActual<typeof Repos>('#/server/repos')
      const bound: Array<number> = []
      const counting = createScope(
        drizzle(async (_query, params) => {
          bound.push(params.length)
          return { rows: [] }
        }),
        { userId: alpha.ownerId, organizationId: 'org_probe', role: 'owner' },
      )

      await notifyMany(
        counting,
        Array.from({ length: IN_APP_CHUNK_SIZE }, (_, index) => `usr_${index}`),
        input as Parameters<typeof notifyMany>[2],
      )

      expect(bound).toEqual([IN_APP_CHUNK_SIZE * NOTIFICATION_ROW_PARAMETERS])
      expect(bound[0]).toBeLessThanOrEqual(D1_MAX_BOUND_PARAMETERS)
      // And one more row would not fit, which is what makes this the largest safe chunk.
      expect(
        (IN_APP_CHUNK_SIZE + 1) * NOTIFICATION_ROW_PARAMETERS,
      ).toBeGreaterThan(D1_MAX_BOUND_PARAMETERS)
    })

    it('writes every in-app row across chunks D1 will bind', async () => {
      await dispatch(alpha.scope, messageEvent(alpha), { queue: null })

      expect(stubs.notifyManyCalls).toHaveLength(
        Math.ceil(CROWD / IN_APP_CHUNK_SIZE),
      )
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

    it('reads addresses and preferences in id lists D1 will bind', async () => {
      await dispatch(alpha.scope, messageEvent(alpha), {
        queue: recordingQueue(),
      })

      expect(stubs.profileCalls).toHaveLength(
        Math.ceil(CROWD / ID_FILTER_CHUNK),
      )
      for (const call of stubs.profileCalls) {
        expect(call.length).toBeLessThanOrEqual(ID_FILTER_CHUNK)
      }

      // Both channels, each asked in chunks: an `IN (...)` list of 501 ids is a statement D1
      // refuses just as surely as a 501-row insert.
      expect(stubs.preferenceCalls).toHaveLength(
        2 * Math.ceil(CROWD / ID_FILTER_CHUNK),
      )
      for (const call of stubs.preferenceCalls) {
        expect(call.length).toBeLessThanOrEqual(ID_FILTER_CHUNK)
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

  /**
   * The workspace half of the union (#304). A billing event has no trip, so its recipients come
   * from `member` rather than `trip_members` — and from the part of it that can act on a plan
   * change or a failed charge.
   */
  describe('an organization-scoped event', () => {
    function billingEvent(over: Record<string, unknown> = {}) {
      return {
        kind: 'billing.plan_changed',
        entityType: 'subscription',
        entityId: 'evt_1',
        scope: 'organization' as const,
        titleParams: { organizationName: 'Workspace alpha', plan: 'Crew' },
        bodyParams: { organizationName: 'Workspace alpha', plan: 'Crew' },
        ...over,
      }
    }

    it('reaches the workspace’s owners and admins, and no plain member', async () => {
      const adminId = await alpha.tenant.addUser('Admin alpha', 'admin')
      await alpha.tenant.addUser('Plain alpha')

      const result = await dispatch(alpha.scope, billingEvent(), {
        queue: null,
      })

      expect([...result.recipients].sort()).toEqual(
        [alpha.ownerId, adminId].sort(),
      )
      expect(result.inAppWritten).toBe(2)
    })

    it('does not reach a trip member who is not in the workspace’s leadership', async () => {
      // `otherId` is a `trip_members` row on alpha's trip and a plain `member` of the workspace —
      // exactly the person the trip branch would have included and this branch must not.
      const result = await dispatch(alpha.scope, billingEvent(), {
        queue: null,
      })

      expect(result.recipients).not.toContain(alpha.otherId)
    })

    it('refuses a workspace event that carries a trip', async () => {
      // Strict on both halves: mixing the shapes is a parse error, never a silently ignored field.
      await expect(
        dispatch(alpha.scope, billingEvent({ tripId: alpha.tripId }), {
          queue: null,
        }),
      ).rejects.toBeInstanceOf(ZodError)
    })

    it('refuses a trip event that carries no trip', async () => {
      await expect(
        dispatch(alpha.scope, billingEvent({ scope: 'trip' }), { queue: null }),
      ).rejects.toBeInstanceOf(ZodError)
    })
  })
})
