/**
 * Clearing a trip's cover when the file behind it is deleted.
 *
 * The write is open to every role (an editor can delete a file, and a guard here would let that
 * delete fail halfway), so what keeps it harmless is its condition: only the trip the file names,
 * only where the cover is that very object, and only inside the caller's workspace.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { clearTripCoverIfKey, createTrip, getTrip, updateTrip } from '../trips'
import { createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { Trip } from '#/server/db/types'

const KEY = 'trips/org/trip/file1-cover.jpg'
const URL = 'https://planned.travel/api/trips/trip/cover?v=file1'

describe('clearTripCoverIfKey', () => {
  let harness: Harness
  let tenant: SeededTenant
  let trip: Trip

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('cover')
    trip = await createTrip(tenant.scope, { title: 'Lisbon' })
    await updateTrip(tenant.scope, trip.id, {
      coverImageKey: KEY,
      coverImageUrl: URL,
    })
  })

  it('clears the key and the URL together when the cover is that object', async () => {
    expect(await clearTripCoverIfKey(tenant.scope, trip.id, KEY)).toBe(true)

    const after = await getTrip(tenant.scope, trip.id)
    expect(after?.coverImageKey).toBeNull()
    expect(after?.coverImageUrl).toBeNull()
  })

  it('leaves a cover that is another object alone', async () => {
    expect(
      await clearTripCoverIfKey(tenant.scope, trip.id, 'trips/org/trip/other'),
    ).toBe(false)

    const after = await getTrip(tenant.scope, trip.id)
    expect(after?.coverImageKey).toBe(KEY)
    expect(after?.coverImageUrl).toBe(URL)
  })

  it('does not reach a trip whose cover has the same key in another workspace', async () => {
    const other = await harness.seedTenant('cover-other')
    const foreign = await createTrip(other.scope, { title: 'Porto' })
    await updateTrip(other.scope, foreign.id, {
      coverImageKey: KEY,
      coverImageUrl: URL,
    })

    expect(await clearTripCoverIfKey(tenant.scope, foreign.id, KEY)).toBe(false)
    expect((await getTrip(other.scope, foreign.id))?.coverImageKey).toBe(KEY)
  })

  it('is open to a member who is not the trip owner', async () => {
    const editorId = await tenant.addUser('Editor')

    expect(
      await clearTripCoverIfKey(tenant.scopeFor(editorId), trip.id, KEY),
    ).toBe(true)
  })
})
