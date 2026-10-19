import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { member, user } from '#/server/db/auth-schema'
import { tripInviteLinks, tripMembers } from '#/server/db/schema'
import { hashSecret } from '#/server/security/secret'
import {
  createTripInvite,
  joinTripByInviteUnscoped,
  replaceTripInvite,
  updateTripInvite,
} from '../invites'
import {
  addTripMember,
  archiveTrip,
  createTrip,
  updateTripMember,
} from '../trips'
import { createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { InviteJoiner } from '../invites'

const KEY = 'a-test-key-that-is-long-enough-for-hkdf'

describe('joinTripByInviteUnscoped', () => {
  let h: Harness
  let a: SeededTenant
  let b: SeededTenant
  let tripId: string
  let inviteId: string
  let secret: string
  let digest: string

  beforeEach(async () => {
    h = await createHarness()
    a = await h.seedTenant('a')
    b = await h.seedTenant('b')
    tripId = (await createTrip(a.scope, { title: 'Lisbon', currency: 'EUR' }))
      .id
    const created = await createTripInvite(a.scope, tripId, {
      role: 'editor',
      key: KEY,
    })
    inviteId = created.invite.id
    secret = created.secret ?? ''
    digest = await hashSecret(secret)
  })

  const joiner = (
    id: string,
    extra: Partial<InviteJoiner> = {},
  ): InviteJoiner => ({
    id,
    banned: false,
    impersonated: false,
    ...extra,
  })
  const join = (viewer: InviteJoiner, value = digest) =>
    joinTripByInviteUnscoped(h.db, value, KEY, viewer)
  const tripRows = () =>
    h.db.select().from(tripMembers).where(eq(tripMembers.tripId, tripId))
  const useCount = async () =>
    (await h.db.select().from(tripInviteLinks))[0]?.useCount

  it("puts a workspace member on the trip with the link's role and creator, and counts one use", async () => {
    const friend = await a.addUser('Friend')
    const answer = await join(joiner(friend))

    expect(answer).toMatchObject({
      outcome: 'joined',
      tripId,
      organizationId: a.organizationId,
      inviteId,
      role: 'editor',
      context: {
        organizationId: a.organizationId,
        userId: friend,
        role: 'member',
      },
    })
    const row = (await tripRows()).find((entry) => entry.userId === friend)
    expect(row).toMatchObject({
      role: 'editor',
      invitedBy: a.ownerUserId,
      organizationId: a.organizationId,
    })
    expect(row?.joinedAt).toBeInstanceOf(Date)
    expect(await useCount()).toBe(1)
    const [link] = await h.db.select().from(tripInviteLinks)
    expect(link?.lastUsedAt).toBeInstanceOf(Date)
  })

  it('gives a viewer link a viewer, and never an owner', async () => {
    await updateTripInvite(a.scope, tripId, {
      role: 'viewer',
      expectedRotation: 0,
      key: KEY,
    })
    const friend = await a.addUser('Friend')
    await join(joiner(friend))
    expect(
      (await tripRows()).find((entry) => entry.userId === friend)?.role,
    ).toBe('viewer')
  })

  it('refuses a hand-edited owner role and writes nothing', async () => {
    await h.db
      .update(tripInviteLinks)
      .set({ role: 'owner' })
      .where(eq(tripInviteLinks.id, inviteId))
    const friend = await a.addUser('Friend')
    expect(await join(joiner(friend))).toEqual({ outcome: 'unavailable' })
    expect(await tripRows()).toHaveLength(1)
    expect(await useCount()).toBe(0)
  })

  it('answers member for someone already on the trip, leaves their role and the count alone', async () => {
    const friend = await a.addUser('Friend')
    await addTripMember(a.scope, { tripId, userId: friend, role: 'viewer' })
    const answer = await join(joiner(friend))
    expect(answer).toMatchObject({
      outcome: 'member',
      tripId,
      organizationId: a.organizationId,
    })
    expect(
      (await tripRows()).find((entry) => entry.userId === friend)?.role,
    ).toBe('viewer')
    expect(await useCount()).toBe(0)
  })

  it('counts one use when the same person submits twice', async () => {
    const friend = await a.addUser('Friend')
    const first = await join(joiner(friend))
    const second = await join(joiner(friend))
    expect(first.outcome).toBe('joined')
    expect(second.outcome).toBe('member')
    expect(await useCount()).toBe(1)
    expect(
      (await tripRows()).filter((row) => row.userId === friend),
    ).toHaveLength(1)
  })

  it("joins a member of two workspaces to the link's workspace, whatever is active", async () => {
    const both = await b.addUser('Both')
    await a.addMembership(both, 'admin')
    const answer = await join(joiner(both))
    expect(answer).toMatchObject({
      outcome: 'joined',
      organizationId: a.organizationId,
      context: { organizationId: a.organizationId, role: 'admin' },
    })
    const row = (await tripRows()).find((entry) => entry.userId === both)
    expect(row?.organizationId).toBe(a.organizationId)
    const other = await h.db
      .select()
      .from(tripMembers)
      .where(eq(tripMembers.organizationId, b.organizationId))
    expect(other).toHaveLength(0)
  })

  it('writes nothing and names nothing for someone outside the workspace', async () => {
    const outsider = await b.addUser('Outsider')
    const before = await h.db.select().from(tripMembers)
    const answer = await join(joiner(outsider))
    expect(answer).toEqual({ outcome: 'needs-workspace' })
    expect(await h.db.select().from(tripMembers)).toEqual(before)
    expect(await useCount()).toBe(0)
  })

  it('is unavailable to a banned joiner and to an impersonated session, and writes nothing', async () => {
    const friend = await a.addUser('Friend')
    expect(await join(joiner(friend, { banned: true }))).toEqual({
      outcome: 'unavailable',
    })
    expect(await join(joiner(friend, { impersonated: true }))).toEqual({
      outcome: 'unavailable',
    })
    expect(await tripRows()).toHaveLength(1)
    expect(await useCount()).toBe(0)
  })

  it('is unavailable for an unknown digest, a switched-off link and a replaced one', async () => {
    const friend = await a.addUser('Friend')
    expect(
      await join(joiner(friend), await hashSecret('x'.repeat(43))),
    ).toEqual({
      outcome: 'unavailable',
    })

    await replaceTripInvite(a.scope, tripId, {
      role: 'editor',
      expectedRotation: 0,
      key: KEY,
    })
    // The secret in the open tab is the old one: the submit re-resolves and fails.
    expect(await join(joiner(friend))).toEqual({ outcome: 'unavailable' })
    expect(await tripRows()).toHaveLength(1)
    expect(await useCount()).toBe(0)
  })

  it('is unavailable once the trip is archived', async () => {
    const friend = await a.addUser('Friend')
    await archiveTrip(a.scope, tripId)
    expect(await join(joiner(friend))).toEqual({ outcome: 'unavailable' })
    expect(await tripRows()).toHaveLength(1)
  })

  it('is unavailable under a rotated derivation key', async () => {
    const friend = await a.addUser('Friend')
    expect(
      await joinTripByInviteUnscoped(
        h.db,
        digest,
        `${KEY}-rotated`,
        joiner(friend),
      ),
    ).toEqual({ outcome: 'unavailable' })
    expect(await tripRows()).toHaveLength(1)
  })

  it('is unavailable when the creator was demoted from owner', async () => {
    const second = await a.addUser('Second owner')
    await addTripMember(a.scope, { tripId, userId: second, role: 'owner' })
    const friend = await a.addUser('Friend')

    const [row] = await tripRows().then((rows) =>
      rows.filter((entry) => entry.userId === a.ownerUserId),
    )
    await updateTripMember(a.scopeFor(second, 'owner'), row?.id ?? '', {
      role: 'editor',
    })
    expect(await join(joiner(friend))).toEqual({ outcome: 'unavailable' })
  })

  it('is unavailable when the creator is banned', async () => {
    const friend = await a.addUser('Friend')
    await h.db
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, a.ownerUserId))
    expect(await join(joiner(friend))).toEqual({ outcome: 'unavailable' })
    expect(await tripRows()).toHaveLength(1)
  })

  it('is unavailable when the creator is no longer a member of the workspace', async () => {
    const friend = await a.addUser('Friend')
    await h.db.delete(member).where(eq(member.userId, a.ownerUserId))
    expect(await join(joiner(friend))).toEqual({ outcome: 'unavailable' })
    expect(await tripRows()).toHaveLength(1)
  })
})
