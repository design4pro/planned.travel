/**
 * The statistics fan-out for a **membership** change.
 *
 * The fan-out for a *trip* write is asserted end-to-end through the lifecycle handlers, in
 * `src/routes/_app/-server/__tests__/trip-lifecycle-side-effects.test.ts`, and that is still the
 * authority on the envelopes themselves. This file covers only what that route cannot reach:
 * `enqueueTripStatsFor`, whose whole reason for existing is that a membership change addresses
 * somebody who is *not* in the trip's member list at the moment it is enqueued — the person just
 * added is not a member yet when the add is recorded, and the person just removed is one no longer
 * (PRD #104 decision 11).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createTrip } from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import { ALL_TIME_STAT_YEAR } from '#/server/queue/types'
import { enqueueTripStatsFor } from '../travel-stats-fanout'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TaskEnvelopeOf } from '#/server/queue/types'

/** Every envelope the fan-out handed the binding, flattened across batches. */
const stubs = vi.hoisted(() => ({ sent: [] as Array<unknown> }))

/**
 * The `TASKS` binding. `#/server/auth/env` imports `cloudflare:workers` at module scope, a specifier
 * that does not resolve in the plain-Node project this suite runs in, so it is replaced wholesale.
 */
vi.mock('#/server/auth/env', () => ({
  taskQueue: () => ({
    sendBatch: async (messages: Array<{ body: unknown }>) => {
      stubs.sent.push(...messages.map((message) => message.body))
      return undefined
    },
  }),
}))

describe('enqueueTripStatsFor', () => {
  let harness: Harness
  let alpha: SeededTenant

  beforeEach(async () => {
    stubs.sent = []
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
})
