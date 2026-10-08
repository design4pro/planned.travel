/**
 * The journeys quota and the orphaned journey (#799, amending ADR 0034).
 *
 * An orphan whose owner has left the workspace is unreadable by everyone, so nobody can delete it to
 * give the slot back. `createJourney` therefore counts only what can still be reached: a journey
 * that names no trip because its trip was deleted, and whose owner holds no `member` row here, is
 * left out. The count is worked out when it is needed, so it covers every way a person can leave
 * and corrects itself when they return.
 *
 * Every case runs on the free plan, which sells one journey: with one row in the workspace the
 * next `createJourney` either takes the last slot or is refused, and which one it is says whether
 * that row counted.
 */

import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { member, user } from '#/server/db/auth-schema'
import { QuotaExceededError } from '../context'
import { createJourney, deleteJourney, journeysRepository } from '../journey'
import { createTrip, deleteTrip } from '../trips'
import { captureError, createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { TenantScope } from '../base'

describe('the journeys quota and an orphaned journey', () => {
  let harness: Harness
  let alpha: SeededTenant
  let leaverId: string
  let leaver: TenantScope

  /** A journey the leaver wrote on a trip of theirs, after the trip was deleted: an orphan. */
  async function orphanOf(
    tenant: SeededTenant,
    userId: string,
  ): Promise<string> {
    const scope = tenant.scopeFor(userId)
    const trip = await createTrip(scope, { title: 'Lisbon in spring' })
    const journey = await createJourney(scope, {
      title: 'Lisbon, written up',
      tripId: trip.id,
    })
    await deleteTrip(scope, trip.id)
    const orphan = await journeysRepository.requireById(scope, journey.id)
    expect(orphan.tripId).toBeNull()
    expect(orphan.tripDeletedAt).toBeInstanceOf(Date)
    return journey.id
  }

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

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
    leaverId = await alpha.addUser('Leaver')
    leaver = alpha.scopeFor(leaverId)
  })

  afterEach(() => {
    harness.close()
  })

  it('keeps counting an orphan whose owner is still a member', async () => {
    await orphanOf(alpha, leaverId)

    const error = await captureError(() =>
      createJourney(alpha.scope, { title: 'One too many' }),
    )

    expect(error).toBeInstanceOf(QuotaExceededError)
  })

  it('keeps counting a journey that never had a trip, whoever owns it', async () => {
    await createJourney(leaver, { title: 'A weekend walk' })
    await removeMembership(alpha, leaverId)

    const error = await captureError(() =>
      createJourney(alpha.scope, { title: 'One too many' }),
    )

    expect(error).toBeInstanceOf(QuotaExceededError)
  })

  it('stops counting an orphan whose owner was removed from the workspace', async () => {
    const orphanId = await orphanOf(alpha, leaverId)
    await removeMembership(alpha, leaverId)

    const created = await createJourney(alpha.scope, { title: 'Room again' })

    expect(created.title).toBe('Room again')
    // Nothing is deleted or moved: the orphan is still a row, just not one that is counted.
    expect(
      await journeysRepository.findById(alpha.scope, orphanId),
    ).not.toBeNull()
  })

  it('stops counting an orphan whose owner’s account was deleted', async () => {
    await orphanOf(alpha, leaverId)
    // The `member` row goes by cascade, which is how the console removes a person.
    await harness.db.delete(user).where(eq(user.id, leaverId))

    const created = await createJourney(alpha.scope, { title: 'Room again' })

    expect(created.title).toBe('Room again')
  })

  it('counts the orphan again once its owner is added back', async () => {
    await orphanOf(alpha, leaverId)
    await removeMembership(alpha, leaverId)
    const meanwhile = await createJourney(alpha.scope, { title: 'Room again' })
    await deleteJourney(alpha.scope, meanwhile.id)

    await alpha.addMembership(leaverId)

    const error = await captureError(() =>
      createJourney(alpha.scope, { title: 'One too many' }),
    )
    expect(error).toBeInstanceOf(QuotaExceededError)
  })

  it('leaves a workspace the owner is still a member of untouched when they leave another', async () => {
    const beta = await harness.seedTenant('beta')
    await beta.addMembership(leaverId)
    await orphanOf(alpha, leaverId)
    await orphanOf(beta, leaverId)

    await removeMembership(alpha, leaverId)

    // Alpha lets go of the orphan; beta, where the same person is still a member, does not.
    expect(
      (await createJourney(alpha.scope, { title: 'Room again' })).title,
    ).toBe('Room again')
    const error = await captureError(() =>
      createJourney(beta.scope, { title: 'One too many' }),
    )
    expect(error).toBeInstanceOf(QuotaExceededError)
  })
})
