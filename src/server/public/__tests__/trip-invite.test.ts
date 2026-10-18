import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTrip } from '#/server/repos/trips'
import { createTripInvite, updateTripInvite } from '#/server/repos/invites'
import { createHarness } from '#/server/repos/__tests__/harness'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { Database } from '#/server/db/types'
import { resolveTripInvite } from '../trip-invite'

const KEY = 'a-test-key-that-is-long-enough-for-hkdf'

describe('resolveTripInvite', () => {
  let h: Harness
  let a: SeededTenant
  let tripId: string
  let secret: string

  beforeEach(async () => {
    h = await createHarness()
    a = await h.seedTenant('a')
    tripId = (await createTrip(a.scope, { title: 'Lisbon', currency: 'EUR' }))
      .id
    const created = await createTripInvite(a.scope, tripId, {
      role: 'editor',
      key: KEY,
    })
    secret = created.secret ?? ''
  })

  it('resolves a live link to its coordinates', async () => {
    expect(await resolveTripInvite(h.db, KEY, secret)).toMatchObject({
      organizationId: a.organizationId,
      tripId,
      role: 'editor',
    })
  })

  it('rejects anything that is not shaped like a secret before it queries', async () => {
    const select = vi.fn(() => {
      throw new Error('a malformed secret must not reach the database')
    })
    const db = { select } as unknown as Database
    for (const value of [
      '',
      'short',
      `${secret}x`,
      secret.slice(1),
      `${secret.slice(1)}!`,
    ]) {
      expect(await resolveTripInvite(db, KEY, value)).toBeNull()
    }
    expect(select).not.toHaveBeenCalled()
  })

  it('is null for a well-shaped secret nobody issued', async () => {
    expect(await resolveTripInvite(h.db, KEY, 'A'.repeat(43))).toBeNull()
  })

  it('is null once the link is switched off', async () => {
    await updateTripInvite(a.scope, tripId, {
      enabled: false,
      expectedRotation: 0,
      key: KEY,
    })
    expect(await resolveTripInvite(h.db, KEY, secret)).toBeNull()
  })

  it('fails closed when the derivation key has been rotated', async () => {
    expect(await resolveTripInvite(h.db, `${KEY}-rotated`, secret)).toBeNull()
    expect(await resolveTripInvite(h.db, KEY, secret)).not.toBeNull()
  })
})
