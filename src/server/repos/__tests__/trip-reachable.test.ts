/**
 * Which trips a person could open in one workspace, as ids - the list the trip-room eviction walks
 * when somebody loses their place in the workspace (#1073).
 *
 * The rule is `readableTripFilter` and nothing else, so what is pinned here is the three edges the
 * eviction depends on: a trip the person could open is listed (archived ones included, a viewer can
 * still connect to those), and a trip they could not open, or one in another workspace, never is.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import {
  addTripMember,
  archiveTrip,
  createTrip,
  reachableTripIds,
} from '../trips'
import { createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

describe('the trips a person could open', () => {
  let harness: Harness
  let alpha: SeededTenant
  let beta: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
    beta = await harness.seedTenant('beta')
  })

  const trip = (
    scope: SeededTenant['scope'],
    title: string,
    visibility?: 'organization',
  ) =>
    createTrip(scope, {
      title,
      currency: 'EUR',
      ...(visibility ? { visibility } : {}),
    })

  it('lists a trip the person is on and a trip open to the whole workspace', async () => {
    const guestId = await alpha.addUser('Guest')
    const joined = await trip(alpha.scope, 'Joined')
    await addTripMember(alpha.scope, {
      tripId: joined.id,
      userId: guestId,
      role: 'viewer',
    })
    const open = await trip(alpha.scope, 'Open', 'organization')

    const ids = await reachableTripIds(alpha.scopeFor(guestId))

    expect([...ids].sort()).toEqual([joined.id, open.id].sort())
  })

  it('lists an archived trip', async () => {
    const guestId = await alpha.addUser('Guest')
    const archived = await trip(alpha.scope, 'Archived', 'organization')
    await archiveTrip(alpha.scope, archived.id)

    expect(await reachableTripIds(alpha.scopeFor(guestId))).toEqual([
      archived.id,
    ])
  })

  it('does not list a private trip the person is not on', async () => {
    const guestId = await alpha.addUser('Guest')
    await trip(alpha.scope, 'Private')

    expect(await reachableTripIds(alpha.scopeFor(guestId))).toEqual([])
  })

  it('never lists a trip of another workspace, open or not', async () => {
    await trip(beta.scope, 'Beta open', 'organization')
    await trip(beta.scope, 'Beta private')

    expect(await reachableTripIds(alpha.scope)).toEqual([])
  })

  it('does not widen a person’s reach in one workspace by what they hold in another', async () => {
    const travellerId = await alpha.addUser('Traveller')
    await beta.addMembership(travellerId)
    const betaTrip = await trip(beta.scope, 'Beta trip')
    await addTripMember(beta.scope, {
      tripId: betaTrip.id,
      userId: travellerId,
      role: 'editor',
    })

    expect(await reachableTripIds(alpha.scopeFor(travellerId))).toEqual([])
    expect(await reachableTripIds(beta.scopeFor(travellerId))).toEqual([
      betaTrip.id,
    ])
  })
})
