import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { user } from '#/server/db/auth-schema'
import { tripInviteLinks, tripMembers } from '#/server/db/schema'
import { hashSecret } from '#/server/security/secret'
import {
  createTripInvite,
  readInvitePreviewUnscoped,
  updateTripInvite,
} from '../invites'
import { addTripMember, archiveTrip, createTrip } from '../trips'
import { createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

const KEY = 'a-test-key-that-is-long-enough-for-hkdf'

describe('readInvitePreviewUnscoped', () => {
  let h: Harness
  let a: SeededTenant
  let b: SeededTenant
  let tripId: string
  let secret: string
  let digest: string

  beforeEach(async () => {
    h = await createHarness()
    a = await h.seedTenant('a')
    b = await h.seedTenant('b')
    tripId = (
      await createTrip(a.scope, {
        title: 'Lisbon',
        currency: 'EUR',
        destination: 'Portugal',
        startDate: '2027-05-01',
        endDate: '2027-05-09',
      })
    ).id
    const created = await createTripInvite(a.scope, tripId, {
      role: 'editor',
      key: KEY,
    })
    secret = created.secret ?? ''
    digest = await hashSecret(secret)
  })

  const preview = (viewer: { id: string; banned: boolean } | null) =>
    readInvitePreviewUnscoped(h.db, digest, KEY, viewer)

  it('gives a stranger the whitelist and nothing else', async () => {
    const answer = await preview(null)
    expect(answer).toEqual({
      state: 'invited',
      tripTitle: 'Lisbon',
      inviterName: 'Owner a',
      inviterImage: null,
      role: 'editor',
    })
    expect(Object.keys(answer).sort()).toEqual([
      'inviterImage',
      'inviterName',
      'role',
      'state',
      'tripTitle',
    ])
  })

  it('shows the inviter avatar when they have one', async () => {
    await h.db
      .update(user)
      .set({ image: 'https://example.test/me.png' })
      .where(eq(user.id, a.ownerUserId))
    expect(await preview(null)).toMatchObject({
      inviterImage: 'https://example.test/me.png',
    })
  })

  it('adds the dates and destination for a member of the workspace who is not on the trip', async () => {
    const friend = await a.addUser('Friend')
    expect(await preview({ id: friend, banned: false })).toEqual({
      state: 'invited',
      tripTitle: 'Lisbon',
      inviterName: 'Owner a',
      inviterImage: null,
      role: 'editor',
      startDate: '2027-05-01',
      endDate: '2027-05-09',
      destination: 'Portugal',
    })
  })

  it('previews a private trip to a workspace member who cannot read it yet', async () => {
    const friend = await a.addUser('Friend')
    expect(await preview({ id: friend, banned: false })).toMatchObject({
      state: 'invited',
      tripTitle: 'Lisbon',
    })
  })

  it('says member, with the coordinates, when the viewer is already on the trip', async () => {
    const friend = await a.addUser('Friend')
    await addTripMember(a.scope, { tripId, userId: friend, role: 'viewer' })
    expect(await preview({ id: friend, banned: false })).toEqual({
      state: 'member',
      tripId,
      organizationId: a.organizationId,
    })
  })

  it('says needs-workspace, naming only the trip and the inviter, to someone outside the workspace', async () => {
    const outsider = await b.addUser('Outsider')
    const answer = await preview({ id: outsider, banned: false })
    expect(answer).toEqual({
      state: 'needs-workspace',
      tripTitle: 'Lisbon',
      inviterName: 'Owner a',
    })
  })

  it('writes nothing for a viewer outside the workspace', async () => {
    const outsider = await b.addUser('Outsider')
    const before = await h.db.select().from(tripMembers)
    await preview({ id: outsider, banned: false })
    expect(await h.db.select().from(tripMembers)).toEqual(before)
    const [row] = await h.db.select().from(tripInviteLinks)
    expect(row).toMatchObject({ useCount: 0, lastUsedAt: null })
  })

  it('is unavailable to a banned viewer, in the same shape as a dead link', async () => {
    const friend = await a.addUser('Friend')
    expect(await preview({ id: friend, banned: true })).toEqual({
      state: 'unavailable',
    })
  })

  it('is unavailable for an unknown digest, a switched-off link and an archived trip', async () => {
    expect(
      await readInvitePreviewUnscoped(
        h.db,
        await hashSecret('x'.repeat(43)),
        KEY,
        null,
      ),
    ).toEqual({ state: 'unavailable' })

    await updateTripInvite(a.scope, tripId, {
      enabled: false,
      expectedRotation: 0,
      key: KEY,
    })
    expect(await preview(null)).toEqual({ state: 'unavailable' })
  })

  it('is unavailable once the trip is archived', async () => {
    await archiveTrip(a.scope, tripId)
    expect(await preview(null)).toEqual({ state: 'unavailable' })
  })

  it('is unavailable under a rotated derivation key', async () => {
    expect(
      await readInvitePreviewUnscoped(h.db, digest, `${KEY}-rotated`, null),
    ).toEqual({ state: 'unavailable' })
  })

  it('reads only the trip the digest points at', async () => {
    await createTrip(a.scope, { title: 'Porto', currency: 'EUR' })
    await createTrip(b.scope, { title: 'Berlin', currency: 'EUR' })
    expect(await preview(null)).toMatchObject({ tripTitle: 'Lisbon' })
  })
})
