/**
 * The statistics fan-out for a **membership** change, and the producer underneath it.
 *
 * The fan-out for a *trip* write is asserted end-to-end through the lifecycle handlers, in
 * `src/routes/_app/-server/__tests__/trip-lifecycle-side-effects.test.ts`, and that is still the
 * authority on the envelopes themselves. This file covers what that route cannot reach:
 * `enqueueTripStatsFor`, whose whole reason for existing is that a membership change addresses
 * somebody who is *not* in the trip's member list at the moment it is enqueued — the person just
 * added is not a member yet when the add is recorded, and the person just removed is one no longer
 * (PRD #104 decision 11) — and `requestTravelStatsRecompute`, the one producer both it and the
 * atlas's visited countries now go through.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTrip } from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import { ALL_TIME_STAT_YEAR } from '#/server/queue/types'
import { QUEUE_BATCH_MAX } from '../jobs'
import {
  enqueueTripStatsFor,
  affectedStatYears,
  enqueueTripRollup,
  requestTravelStatsRecompute,
} from '../travel-stats-fanout'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TaskEnvelopeOf } from '#/server/queue/types'

/**
 * Every envelope the fan-out handed the binding — `sent` flattened across batches, `batchSizes` the
 * boundaries themselves, which is the only way to see the Queues cap being honoured.
 */
const stubs = vi.hoisted(() => ({
  sent: [] as Array<unknown>,
  batchSizes: [] as Array<number>,
  /**
   * How many times the producer reached for the binding at all. The empty-fan-out guard is only
   * worth its line if it stops that reach, and a batch count cannot see the difference.
   */
  bindingReads: 0,
  /** When true, the binding refuses the way an unreachable one does. */
  rejects: false,
}))

/**
 * The `TASKS` binding. `#/server/auth/env` imports `cloudflare:workers` at module scope, a specifier
 * that does not resolve in the plain-Node project this suite runs in, so it is replaced wholesale.
 */
vi.mock('#/server/auth/env', () => ({
  taskQueue: () => {
    stubs.bindingReads += 1
    return {
      sendBatch: async (messages: Array<{ body: unknown }>) => {
        if (stubs.rejects) {
          throw new Error('TASKS binding is unreachable')
        }
        stubs.batchSizes.push(messages.length)
        stubs.sent.push(...messages.map((message) => message.body))
        return undefined
      },
    }
  },
}))

describe('enqueueTripStatsFor', () => {
  let harness: Harness
  let alpha: SeededTenant

  beforeEach(async () => {
    stubs.sent = []
    stubs.batchSizes = []
    stubs.bindingReads = 0
    stubs.rejects = false
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
    await subscribeTenant(alpha.scope, 'crew', 5)
  })

  /** The envelopes as themselves, so a payload can be read without a cast at every assertion. */
  function envelopes(): Array<TaskEnvelopeOf<'travel-stats'>> {
    return stubs.sent as Array<TaskEnvelopeOf<'travel-stats'>>
  }

  it('sends to the recipients it is handed rather than to the trip’s members', async () => {
    const trip = await createTrip(alpha.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })
    // Nobody who is on the trip: `createTrip` wrote the owner's membership, and the owner is exactly
    // who a read of the member list would have returned.
    const newcomer = await alpha.addUser('Just invited')

    await enqueueTripStatsFor(alpha.scope, trip, [newcomer])

    expect(
      new Set(envelopes().map((envelope) => envelope.payload.userId)),
    ).toEqual(new Set([newcomer]))
  })

  it('covers the all-time roll-up and the year the trip starts in', async () => {
    const trip = await createTrip(alpha.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })

    await enqueueTripStatsFor(alpha.scope, trip, [alpha.ownerUserId])

    expect(
      new Set(envelopes().map((envelope) => envelope.payload.statYear)),
    ).toEqual(new Set([ALL_TIME_STAT_YEAR, 2026]))
  })

  it('covers the roll-up alone when the trip has no departure date yet', async () => {
    const trip = await createTrip(alpha.scope, {
      title: 'Somewhere, eventually',
      currency: 'EUR',
    })

    await enqueueTripStatsFor(alpha.scope, trip, [alpha.ownerUserId])

    expect(envelopes().map((envelope) => envelope.payload.statYear)).toEqual([
      ALL_TIME_STAT_YEAR,
    ])
  })

  it('sends nothing when the recipient list is empty', async () => {
    const trip = await createTrip(alpha.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })

    await enqueueTripStatsFor(alpha.scope, trip, [])

    expect(stubs.sent).toEqual([])
  })

  it('names the trip in the warn line when the binding refuses', async () => {
    const trip = await createTrip(alpha.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })
    stubs.rejects = true
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    await enqueueTripStatsFor(alpha.scope, trip, [alpha.ownerUserId])

    // The trip path's half of the attribution: the producer is handed `{ tripId }` by
    // `enqueueTravelStats`, and dropping it there would leave the organization and a count alone.
    const line = String(warn.mock.calls[0]?.[0])
    expect(line).toContain(`"tripId":"${trip.id}"`)

    warn.mockRestore()
  })
})

/**
 * The producer itself — the seam the atlas and the trip fan-out now share.
 *
 * `atlas.ts` used to carry a second copy of this, differing only in who the envelopes went to, and
 * the assertions below are about the two things that copy did *not* do: honouring the Queues batch
 * ceiling, and taking its recipients as an argument rather than reading them from a trip. The
 * envelope's own shape stays the authority of the call-site suites above and in
 * `src/server/fns/__tests__/atlas.test.ts`.
 */
describe('requestTravelStatsRecompute', () => {
  let harness: Harness
  let alpha: SeededTenant

  beforeEach(async () => {
    stubs.sent = []
    stubs.batchSizes = []
    stubs.bindingReads = 0
    stubs.rejects = false
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
  })

  function envelopes(): Array<TaskEnvelopeOf<'travel-stats'>> {
    return stubs.sent as Array<TaskEnvelopeOf<'travel-stats'>>
  }

  it('sends one envelope per traveller and year it is handed', async () => {
    const travellers = [alpha.ownerUserId, await alpha.addUser('Second')]

    await requestTravelStatsRecompute(alpha.scope, travellers, [
      ALL_TIME_STAT_YEAR,
      2026,
    ])

    expect(
      envelopes().map((envelope) => [
        envelope.payload.userId,
        envelope.payload.statYear,
      ]),
    ).toEqual([
      [travellers[0], ALL_TIME_STAT_YEAR],
      [travellers[0], 2026],
      [travellers[1], ALL_TIME_STAT_YEAR],
      [travellers[1], 2026],
    ])
  })

  it('splits a fan-out wider than the Queues ceiling across batches', async () => {
    // The copy this replaced sent one message at a time and so could not exceed the cap; this one
    // batches, which is the whole reason the cap has to be honoured here at all.
    const travellers = Array.from(
      { length: QUEUE_BATCH_MAX + 1 },
      (_unused, index) => `user_${index}`,
    )

    await requestTravelStatsRecompute(alpha.scope, travellers, [
      ALL_TIME_STAT_YEAR,
    ])

    expect(stubs.batchSizes).toEqual([QUEUE_BATCH_MAX, 1])
    expect(stubs.sent).toHaveLength(QUEUE_BATCH_MAX + 1)
  })

  it('does not even reach for the binding when there is no year to recompute', async () => {
    await requestTravelStatsRecompute(alpha.scope, [alpha.ownerUserId], [])

    // A batch count alone cannot tell the guard from its absence — `enqueueTasks` would send
    // nothing either way. Reaching `taskQueue()` is the cost the guard exists to avoid.
    expect(stubs.bindingReads).toBe(0)
    expect(stubs.batchSizes).toEqual([])
  })

  it("never fails the caller's write when the binding refuses", async () => {
    stubs.rejects = true
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    // D1 is the durable record and has already been written by the time this runs; a stale panel is
    // a much smaller harm than a save that appears to have failed.
    await expect(
      requestTravelStatsRecompute(
        alpha.scope,
        [alpha.ownerUserId],
        [ALL_TIME_STAT_YEAR],
      ),
    ).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalled()

    warn.mockRestore()
  })

  it("spreads the caller's context into the line, which is what makes it attributable", async () => {
    stubs.rejects = true
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    // Without this the line is an organization and a count, which cannot say *which* of the writes
    // in flight lost its statistics. The producer never invents the identity — only the caller knows
    // it — so the assertion is that whatever it is handed reaches the record.
    await requestTravelStatsRecompute(
      alpha.scope,
      [alpha.ownerUserId],
      [ALL_TIME_STAT_YEAR],
      { route: 'a-caller-of-its-own' },
    )

    const line = String(warn.mock.calls[0]?.[0])
    expect(line).toContain('"route":"a-caller-of-its-own"')

    warn.mockRestore()
  })
})

describe('trip contents roll-up', () => {
  it('keeps all-time and every distinct usable date year, with existing signatures unchanged', () => {
    expect(affectedStatYears(null)).toEqual([0])
    expect(affectedStatYears('2026-01-01', '2025-01-01')).toEqual([
      0, 2026, 2025,
    ])
    expect(
      affectedStatYears(
        '2026-01-01',
        '2027-01-01',
        '2028-01-01',
        '0000-01-01',
        null,
        undefined,
        '2027-02-01',
      ),
    ).toEqual([0, 2026, 2027, 2028])
  })

  it('uses real trip recipients and tenant envelopes for all departure years, and survives queue refusal', async () => {
    const harness = await createHarness()
    const tenant = await harness.seedTenant('contents')
    const trip = await createTrip(tenant.scope, {
      title: 'Across years',
      startDate: '2026-12-31',
      endDate: '2027-01-02',
    })
    stubs.sent = []
    stubs.rejects = false
    await enqueueTripRollup(tenant.scope, trip, ['2027-01-01', '2028-01-01'])
    expect(stubs.sent).toHaveLength(4)
    expect(stubs.sent).toEqual(
      expect.arrayContaining(
        [0, 2026, 2027, 2028].map((statYear) =>
          expect.objectContaining({
            orgId: tenant.organizationId,
            id: expect.stringContaining(
              `travel-stats:${tenant.organizationId}:${tenant.ownerUserId}:${statYear}:`,
            ),
            payload: { userId: tenant.ownerUserId, statYear },
          }),
        ),
      ),
    )
    stubs.rejects = true
    await expect(enqueueTripRollup(tenant.scope, trip)).resolves.toBeUndefined()
    stubs.rejects = false
    const foreign = await harness.seedTenant('foreign')
    stubs.sent = []
    await enqueueTripRollup(foreign.scope, trip)
    expect(stubs.sent).toEqual([])
  })
})
