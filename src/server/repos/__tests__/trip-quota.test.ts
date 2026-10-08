/**
 * The trips quota and the stranded trip (#810, after #799 settled the rule for journeys).
 *
 * A trip that is not readable by the whole workspace and whose every `trip_members` row belongs to
 * somebody who has left the workspace is readable by nobody, so nobody can delete it to give the
 * slot back. `countTripsAgainstPlan` therefore leaves it out, and `createTrip`, `startTripCopy` and
 * the plan-usage figure all count through it. The count is worked out when it is needed, so it
 * covers every way a person can leave and corrects itself when they return. Nothing is deleted,
 * moved or handed over, and no read rule changes.
 *
 * Every case runs on the free plan, which sells two trips: the workspace owner holds one, the leaver
 * the other, and the next `createTrip` either takes the last slot or is refused, which says whether
 * the leaver's trip counted.
 */

import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { member, user } from '#/server/db/auth-schema'
import { QuotaExceededError } from '../context'
import {
  addTripMember,
  countTripsAgainstPlan,
  createTrip,
  startTripCopy,
  tripsRepository,
} from '../trips'
import { captureError, createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { TenantScope } from '../base'
import type { CreateTripInput } from '../trips'

describe('the trips quota and a stranded trip', () => {
  let harness: Harness
  let alpha: SeededTenant
  let leaverId: string
  let leaver: TenantScope

  async function removeMembership(
    tenant: SeededTenant,
    userId: string,
  ): Promise<void> {
    await harness.db
      .delete(member)
      .where(
        and(
          eq(member.organizationId, tenant.organizationId),
          eq(member.userId, userId),
        ),
      )
  }

  /** Whether one more trip fits: it is created, or the quota refuses it. */
  async function oneMoreFits(scope: TenantScope): Promise<boolean> {
    try {
      await createTrip(scope, { title: 'One more' })
      return true
    } catch (error) {
      expect(error).toBeInstanceOf(QuotaExceededError)
      return false
    }
  }

  /** The owner's trip plus the leaver's own, which fill the free plan's two slots. */
  async function fillThePlan(
    leaversTrip: Partial<CreateTripInput> = {},
  ): Promise<string> {
    await createTrip(alpha.scope, { title: 'Owner trip' })
    const trip = await createTrip(leaver, {
      title: 'Leaver trip',
      ...leaversTrip,
    })
    return trip.id
  }

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
    leaverId = await alpha.addUser('Leaver')
    leaver = alpha.scopeFor(leaverId)
  })

  afterEach(() => {
    harness.close()
  })

  it('keeps counting a private trip whose member is still in the workspace', async () => {
    await fillThePlan()

    expect(await countTripsAgainstPlan(alpha.scope)).toBe(2)
    expect(await oneMoreFits(alpha.scope)).toBe(false)
  })

  it('stops counting a private trip whose only member was removed from the workspace', async () => {
    const tripId = await fillThePlan()
    await removeMembership(alpha, leaverId)

    expect(await countTripsAgainstPlan(alpha.scope)).toBe(1)
    expect(await oneMoreFits(alpha.scope)).toBe(true)
    // Nothing is deleted or moved: the stranded trip is still a row, just not one that is counted.
    expect(await tripsRepository.findById(alpha.scope, tripId)).not.toBeNull()
  })

  it('stops counting a stranded trip whose visibility is public', async () => {
    await fillThePlan({ visibility: 'public' })
    await removeMembership(alpha, leaverId)

    expect(await countTripsAgainstPlan(alpha.scope)).toBe(1)
  })

  it('keeps counting a trip readable by the whole workspace even with no member left', async () => {
    await fillThePlan({ visibility: 'organization' })
    await removeMembership(alpha, leaverId)

    expect(await countTripsAgainstPlan(alpha.scope)).toBe(2)
    expect(await oneMoreFits(alpha.scope)).toBe(false)
  })

  it('keeps counting a private trip while any one of its members is still in the workspace', async () => {
    const tripId = await fillThePlan()
    const stayerId = await alpha.addUser('Stayer')
    await addTripMember(leaver, { tripId, userId: stayerId, role: 'editor' })

    await removeMembership(alpha, leaverId)

    expect(await countTripsAgainstPlan(alpha.scope)).toBe(2)
    expect(await oneMoreFits(alpha.scope)).toBe(false)
  })

  it('stops counting a trip whose only member’s account was deleted', async () => {
    await fillThePlan()
    // The `member` row goes by cascade, which is how the console removes a person; the
    // `trip_members` row has no foreign key to the account and stays.
    await harness.db.delete(user).where(eq(user.id, leaverId))

    expect(await countTripsAgainstPlan(alpha.scope)).toBe(1)
    expect(await oneMoreFits(alpha.scope)).toBe(true)
  })

  it('counts the trip again once its member is added back to the workspace', async () => {
    await fillThePlan()
    await removeMembership(alpha, leaverId)
    expect(await countTripsAgainstPlan(alpha.scope)).toBe(1)

    await alpha.addMembership(leaverId)

    expect(await countTripsAgainstPlan(alpha.scope)).toBe(2)
    expect(await oneMoreFits(alpha.scope)).toBe(false)
  })

  it('lets a trip copy take the last slot once a stranded trip held it', async () => {
    const source = await createTrip(alpha.scope, { title: 'Source' })
    await createTrip(leaver, { title: 'Leaver trip' })
    const refused = await captureError(() =>
      startTripCopy(alpha.scope, source.id, { title: 'Copy' }),
    )
    expect(refused).toBeInstanceOf(QuotaExceededError)

    await removeMembership(alpha, leaverId)

    expect(
      await startTripCopy(alpha.scope, source.id, { title: 'Copy' }),
    ).toEqual(expect.any(String))
  })

  it('leaves a workspace the member is still in untouched when they leave another', async () => {
    const beta = await harness.seedTenant('beta')
    await beta.addMembership(leaverId)
    const betaLeaver = beta.scopeFor(leaverId)
    await createTrip(alpha.scope, { title: 'Alpha owner trip' })
    await createTrip(leaver, { title: 'Alpha leaver trip' })
    await createTrip(beta.scope, { title: 'Beta owner trip' })
    await createTrip(betaLeaver, { title: 'Beta leaver trip' })

    await removeMembership(alpha, leaverId)

    // Alpha lets go of the stranded trip; beta, where the same person is still a member, does not.
    expect(await countTripsAgainstPlan(alpha.scope)).toBe(1)
    expect(await countTripsAgainstPlan(beta.scope)).toBe(2)
    expect(await oneMoreFits(beta.scope)).toBe(false)
  })

  it('counts only the caller’s workspace', async () => {
    const beta = await harness.seedTenant('beta')
    await createTrip(alpha.scope, { title: 'Alpha trip' })
    await createTrip(beta.scope, { title: 'Beta trip' })
    await createTrip(beta.scope, { title: 'Another beta trip' })

    expect(await countTripsAgainstPlan(alpha.scope)).toBe(1)
    expect(await countTripsAgainstPlan(beta.scope)).toBe(2)
  })
})
