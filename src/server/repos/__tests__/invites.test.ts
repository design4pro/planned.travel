import { beforeEach, describe, expect, it } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { member, user } from '#/server/db/auth-schema'
import { tripInviteLinks, tripMembers, trips } from '#/server/db/schema'
import {
  deriveSecret,
  hashSecret,
  TRIP_INVITE_PURPOSE,
} from '#/server/security/secret'
import { NotFoundError } from '../context'
import {
  createTripInvite,
  findLiveTripInviteByDigestUnscoped,
  readTripInvite,
  replaceTripInvite,
  revealTripInviteSecret,
  touchTripInvite,
  updateTripInvite,
} from '../invites'
import {
  TripArchivedError,
  TripRoleError,
  addTripMember,
  insertTripMember,
  archiveTrip,
  createTrip,
  removeTripMember,
  updateTripMember,
} from '../trips'
import { captureError, createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { TenantScope } from '../base'

const KEY = 'a-test-key-that-is-long-enough-for-hkdf'

describe('trip invite links', () => {
  let h: Harness
  let a: SeededTenant
  let b: SeededTenant
  let tripId: string

  beforeEach(async () => {
    h = await createHarness()
    a = await h.seedTenant('a')
    b = await h.seedTenant('b')
    tripId = (await createTrip(a.scope, { title: 'Lisbon', currency: 'EUR' }))
      .id
  })

  async function live(secret: string | null) {
    expect(secret).not.toBeNull()
    return findLiveTripInviteByDigestUnscoped(
      h.db,
      await hashSecret(secret ?? ''),
      KEY,
    )
  }

  async function mint(role: 'editor' | 'viewer' = 'viewer') {
    const created = await createTripInvite(a.scope, tripId, { role, key: KEY })
    return { ...created, secret: created.secret ?? '' }
  }

  async function addOnTrip(name: string, role: 'owner' | 'editor' | 'viewer') {
    const userId = await a.addUser(name)
    await addTripMember(a.scope, { tripId, userId, role })
    return { userId, scope: a.scopeFor(userId) }
  }

  async function membershipOf(userId: string) {
    const [row] = await h.db
      .select()
      .from(tripMembers)
      .where(
        and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)),
      )
    if (!row) throw new Error('no membership')
    return row
  }

  async function rows() {
    return h.db.select().from(tripInviteLinks)
  }

  describe('create', () => {
    it('stores the digest of a derived secret, never the secret', async () => {
      const { invite, secret } = await mint('editor')
      expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(invite).toMatchObject({
        tripId,
        role: 'editor',
        rotation: 0,
        createdBy: a.ownerUserId,
        disabledAt: null,
        lastUsedAt: null,
        useCount: 0,
        state: 'active',
      })
      const [row] = await rows()
      expect(row?.token).toBe(await hashSecret(secret))
      expect(row?.token).not.toBe(secret)
      expect(secret).toBe(
        await deriveSecret(TRIP_INVITE_PURPOSE, KEY, invite.id, 0),
      )
    })

    it('returns the same link when created twice, and does not take the second role', async () => {
      const first = await mint('viewer')
      const second = await createTripInvite(a.scope, tripId, {
        role: 'editor',
        key: KEY,
      })
      expect(second.invite).toEqual(first.invite)
      expect(second.secret).toBe(first.secret)
      expect(await rows()).toHaveLength(1)
    })

    it('leaves one link when two owners create at once', async () => {
      const other = await addOnTrip('co-owner', 'owner')
      const [x, y] = await Promise.all([
        createTripInvite(a.scope, tripId, { role: 'viewer', key: KEY }),
        createTripInvite(other.scope, tripId, { role: 'viewer', key: KEY }),
      ])
      expect(await rows()).toHaveLength(1)
      expect(x.invite.id).toBe(y.invite.id)
      expect(x.secret).toBe(y.secret)
    })

    it('refuses a role that is not editor or viewer', async () => {
      await expect(
        createTripInvite(a.scope, tripId, {
          role: 'owner' as never,
          key: KEY,
        }),
      ).rejects.toThrow()
      expect(await rows()).toHaveLength(0)
    })

    it('is a trip owner’s verb, and an archived trip refuses it', async () => {
      const editor = await addOnTrip('editor', 'editor')
      expect(
        await captureError(() =>
          createTripInvite(editor.scope, tripId, { role: 'viewer', key: KEY }),
        ),
      ).toBeInstanceOf(TripRoleError)
      await archiveTrip(a.scope, tripId)
      expect(
        await captureError(() =>
          createTripInvite(a.scope, tripId, { role: 'viewer', key: KEY }),
        ),
      ).toBeInstanceOf(TripArchivedError)
      expect(await rows()).toHaveLength(0)
    })
  })

  describe('reads carry no secret', () => {
    it('returns null before a link exists', async () => {
      expect(await readTripInvite(a.scope, tripId, KEY)).toBeNull()
      expect(await revealTripInviteSecret(a.scope, tripId, KEY)).toBeNull()
    })

    it('has no secret or digest field anywhere in what it returns', async () => {
      const { secret } = await mint()
      const view = await readTripInvite(a.scope, tripId, KEY)
      expect(Object.keys(view ?? {}).sort()).toEqual([
        'createdBy',
        'disabledAt',
        'id',
        'lastUsedAt',
        'role',
        'rotatedAt',
        'rotation',
        'state',
        'tripId',
        'useCount',
      ])
      const wire = JSON.stringify(view)
      expect(wire).not.toContain(secret)
      expect(wire).not.toContain(await hashSecret(secret))
    })
  })

  describe('reveal', () => {
    it('gives a trip owner the same secret every time', async () => {
      const { secret } = await mint()
      expect(await revealTripInviteSecret(a.scope, tripId, KEY)).toBe(secret)
      expect(await revealTripInviteSecret(a.scope, tripId, KEY)).toBe(secret)
    })

    it('refuses an editor, a viewer, a workspace admin who is not on the trip and another workspace', async () => {
      await mint()
      const editor = await addOnTrip('editor', 'editor')
      const viewer = await addOnTrip('viewer', 'viewer')
      const admin = a.scopeFor(await a.addUser('admin', 'admin'), 'admin')
      for (const scope of [editor.scope, viewer.scope, admin, b.scope]) {
        const error = await captureError(() =>
          revealTripInviteSecret(scope, tripId, KEY),
        )
        expect(
          error instanceof NotFoundError || error instanceof TripRoleError,
        ).toBe(true)
      }
    })

    it('refuses a workspace admin who can read the trip but is not on it', async () => {
      await mint()
      await h.db
        .update(trips)
        .set({ visibility: 'organization' })
        .where(eq(trips.id, tripId))
      const admin = a.scopeFor(await a.addUser('admin', 'admin'), 'admin')
      expect(
        await captureError(() => revealTripInviteSecret(admin, tripId, KEY)),
      ).toBeInstanceOf(TripRoleError)
      expect(
        await captureError(() => readTripInvite(admin, tripId, KEY)),
      ).toBeInstanceOf(TripRoleError)
    })

    it('does not hand out the secret of a link that does not resolve', async () => {
      await mint()
      await updateTripInvite(a.scope, tripId, {
        enabled: false,
        expectedRotation: 0,
        key: KEY,
      })
      expect(await revealTripInviteSecret(a.scope, tripId, KEY)).toBeNull()
    })
  })

  describe('replace', () => {
    it('issues a new secret and the old one stops resolving', async () => {
      const first = await mint()
      expect(await live(first.secret)).toMatchObject({ tripId })
      const replaced = await replaceTripInvite(a.scope, tripId, {
        role: 'viewer',
        expectedRotation: 0,
        key: KEY,
      })
      expect(replaced.ok).toBe(true)
      if (!replaced.ok) return
      expect(replaced.invite.rotation).toBe(1)
      expect(replaced.secret).not.toBe(first.secret)
      expect(await live(first.secret)).toBeNull()
      expect(await live(replaced.secret)).toMatchObject({
        tripId,
        rotation: 1,
        createdBy: a.ownerUserId,
      })
    })

    it('reports a stale rotation as changed and writes nothing', async () => {
      await mint()
      await replaceTripInvite(a.scope, tripId, {
        role: 'viewer',
        expectedRotation: 0,
        key: KEY,
      })
      const before = await rows()
      const result = await replaceTripInvite(a.scope, tripId, {
        role: 'editor',
        expectedRotation: 0,
        key: KEY,
      })
      expect(result).toMatchObject({
        ok: false,
        reason: 'changed',
        invite: { rotation: 1, role: 'viewer' },
      })
      expect(await rows()).toEqual(before)
    })

    it('lets exactly one of two concurrent replaces win', async () => {
      await mint()
      const other = await addOnTrip('co-owner', 'owner')
      const results = await Promise.all([
        replaceTripInvite(a.scope, tripId, {
          role: 'viewer',
          expectedRotation: 0,
          key: KEY,
        }),
        replaceTripInvite(other.scope, tripId, {
          role: 'viewer',
          expectedRotation: 0,
          key: KEY,
        }),
      ])
      expect(results.filter((result) => result.ok)).toHaveLength(1)
      expect((await rows())[0]?.rotation).toBe(1)
      // The loser is told the state that won, not the one it read before the write.
      const lost = results.find((result) => !result.ok)
      const won = results.find((result) => result.ok)
      expect(lost).toMatchObject({
        reason: 'changed',
        invite: { rotation: 1, createdBy: won?.invite.createdBy },
      })
    })

    it('cannot grant owner', async () => {
      await mint()
      await expect(
        replaceTripInvite(a.scope, tripId, {
          role: 'owner' as never,
          expectedRotation: 0,
          key: KEY,
        }),
      ).rejects.toThrow()
    })

    it('is not possible before a link exists', async () => {
      expect(
        await captureError(() =>
          replaceTripInvite(a.scope, tripId, {
            role: 'viewer',
            expectedRotation: 0,
            key: KEY,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
    })
  })

  describe('update', () => {
    it('changes the role without touching the secret, the rotation or the creator', async () => {
      const first = await mint('viewer')
      const co = await addOnTrip('co-owner', 'owner')
      const result = await updateTripInvite(co.scope, tripId, {
        role: 'editor',
        expectedRotation: 0,
        key: KEY,
      })
      expect(result).toMatchObject({
        ok: true,
        secret: first.secret,
        invite: { role: 'editor', rotation: 0, createdBy: a.ownerUserId },
      })
      expect(await live(first.secret)).toMatchObject({ role: 'editor' })
    })

    it('switches off, and switching on issues a new secret while the old one stays dead', async () => {
      const first = await mint()
      const off = await updateTripInvite(a.scope, tripId, {
        enabled: false,
        expectedRotation: 0,
        key: KEY,
      })
      expect(off).toMatchObject({
        ok: true,
        secret: null,
        invite: { state: 'off', rotation: 1 },
      })
      expect(await live(first.secret)).toBeNull()

      const on = await updateTripInvite(a.scope, tripId, {
        enabled: true,
        expectedRotation: 1,
        key: KEY,
      })
      expect(on.ok).toBe(true)
      if (!on.ok) return
      expect(on.invite).toMatchObject({ state: 'active', rotation: 2 })
      expect(on.secret).not.toBe(first.secret)
      expect(await live(first.secret)).toBeNull()
      expect(await live(on.secret)).not.toBeNull()
    })

    it('does not let a stale panel replace a link that was switched off', async () => {
      await mint()
      const co = await addOnTrip('co-owner', 'owner')
      await updateTripInvite(a.scope, tripId, {
        enabled: false,
        expectedRotation: 0,
        key: KEY,
      })
      const before = await rows()
      expect(
        await replaceTripInvite(co.scope, tripId, {
          role: 'viewer',
          expectedRotation: 0,
          key: KEY,
        }),
      ).toMatchObject({
        ok: false,
        reason: 'changed',
        invite: { state: 'off' },
      })
      expect(await rows()).toEqual(before)
    })

    it('does nothing when asked for the state it is already in', async () => {
      await mint()
      const before = await rows()
      const result = await updateTripInvite(a.scope, tripId, {
        enabled: true,
        role: 'viewer',
        expectedRotation: 0,
        key: KEY,
      })
      expect(result.ok).toBe(true)
      expect(await rows()).toEqual(before)
    })

    it('reports a stale rotation as changed and writes nothing', async () => {
      await mint()
      await replaceTripInvite(a.scope, tripId, {
        role: 'viewer',
        expectedRotation: 0,
        key: KEY,
      })
      const before = await rows()
      const result = await updateTripInvite(a.scope, tripId, {
        role: 'editor',
        expectedRotation: 0,
        key: KEY,
      })
      expect(result).toMatchObject({ ok: false, reason: 'changed' })
      expect(await rows()).toEqual(before)
    })

    it('is a trip owner’s verb', async () => {
      await mint()
      const editor = await addOnTrip('editor', 'editor')
      expect(
        await captureError(() =>
          updateTripInvite(editor.scope, tripId, {
            enabled: false,
            expectedRotation: 0,
            key: KEY,
          }),
        ),
      ).toBeInstanceOf(TripRoleError)
    })
  })

  describe('the takeover rule', () => {
    it('keeps a demoted creator’s secret dead, through another owner’s role change, until a replace issues a new one', async () => {
      const creator = await addOnTrip('creator', 'owner')
      const minted = await createTripInvite(creator.scope, tripId, {
        role: 'viewer',
        key: KEY,
      })
      const secret = minted.secret ?? ''
      expect(await live(secret)).not.toBeNull()

      await updateTripMember(a.scope, (await membershipOf(creator.userId)).id, {
        role: 'editor',
      })
      expect(await live(secret)).toBeNull()
      expect((await readTripInvite(a.scope, tripId, KEY))?.state).toBe(
        'creator-gone',
      )
      expect(await revealTripInviteSecret(a.scope, tripId, KEY)).toBeNull()

      // Another owner's role change is not offered on a link whose creator is gone.
      const before = await rows()
      expect(
        await updateTripInvite(a.scope, tripId, {
          role: 'editor',
          expectedRotation: 0,
          key: KEY,
        }),
      ).toMatchObject({ ok: false, reason: 'creatorGone' })
      expect(await rows()).toEqual(before)
      expect(await live(secret)).toBeNull()

      // A replace by another owner takes the link over with a new secret; the old one stays dead.
      const replaced = await replaceTripInvite(a.scope, tripId, {
        role: 'viewer',
        expectedRotation: 0,
        key: KEY,
      })
      expect(replaced.ok).toBe(true)
      if (!replaced.ok) return
      expect(replaced.invite).toMatchObject({
        createdBy: a.ownerUserId,
        state: 'active',
      })
      expect(await live(replaced.secret)).toMatchObject({
        createdBy: a.ownerUserId,
      })
      expect(await live(secret)).toBeNull()

      // Promoting the first creator again does not bring their secret back.
      await updateTripMember(a.scope, (await membershipOf(creator.userId)).id, {
        role: 'owner',
      })
      expect(await live(secret)).toBeNull()
    })

    it('does not revive a copy when the creator is removed from the trip and added again', async () => {
      const creator = await addOnTrip('creator', 'owner')
      const minted = await createTripInvite(creator.scope, tripId, {
        role: 'viewer',
        key: KEY,
      })
      const secret = minted.secret ?? ''
      await removeTripMember(a.scope, (await membershipOf(creator.userId)).id)
      expect(await live(secret)).toBeNull()

      const [link] = await rows()
      await addTripMember(a.scope, {
        tripId,
        userId: creator.userId,
        role: 'owner',
      })
      await h.db
        .update(tripMembers)
        .set({ createdAt: new Date((link?.rotatedAt.getTime() ?? 0) + 1000) })
        .where(eq(tripMembers.id, (await membershipOf(creator.userId)).id))
      expect(await live(secret)).toBeNull()
    })

    it('does not revive a copy when the creator leaves the workspace and rejoins', async () => {
      const creator = await addOnTrip('creator', 'owner')
      const minted = await createTripInvite(creator.scope, tripId, {
        role: 'viewer',
        key: KEY,
      })
      const secret = minted.secret ?? ''
      const [link] = await rows()
      const [row] = await h.db
        .select()
        .from(member)
        .where(eq(member.userId, creator.userId))
      if (!row) throw new Error('no membership')
      await h.db.delete(member).where(eq(member.id, row.id))
      expect(await live(secret)).toBeNull()
      await h.db.insert(member).values({
        ...row,
        createdAt: new Date((link?.rotatedAt.getTime() ?? 0) + 1000),
      })
      expect(await live(secret)).toBeNull()
    })
  })

  describe('the one unscoped finder', () => {
    it('answers with coordinates only', async () => {
      const { secret } = await mint('editor')
      const found = await live(secret)
      expect(found).toEqual({
        id: expect.any(String),
        organizationId: a.organizationId,
        tripId,
        role: 'editor',
        rotation: 0,
        createdBy: a.ownerUserId,
      })
    })

    it('finds nothing for an unknown digest', async () => {
      await mint()
      expect(
        await findLiveTripInviteByDigestUnscoped(
          h.db,
          await hashSecret('nope'),
          KEY,
        ),
      ).toBeNull()
    })

    it('resolves a link to its own workspace and trip and no other', async () => {
      const other = await createTrip(b.scope, {
        title: 'Oslo',
        currency: 'NOK',
      })
      const mine = await mint()
      const theirs = await createTripInvite(b.scope, other.id, {
        role: 'viewer',
        key: KEY,
      })
      expect(await live(mine.secret)).toMatchObject({
        organizationId: a.organizationId,
        tripId,
      })
      expect(await live(theirs.secret)).toMatchObject({
        organizationId: b.organizationId,
        tripId: other.id,
      })
    })

    describe('is null for every kind of dead link', () => {
      let secret: string
      beforeEach(async () => {
        secret = (await mint()).secret
        expect(await live(secret)).not.toBeNull()
      })

      it('disabled', async () => {
        await h.db.update(tripInviteLinks).set({ disabledAt: new Date() })
        expect(await live(secret)).toBeNull()
      })

      it('rotated away', async () => {
        await replaceTripInvite(a.scope, tripId, {
          role: 'viewer',
          expectedRotation: 0,
          key: KEY,
        })
        expect(await live(secret)).toBeNull()
      })

      it('a role outside the allowed set, written by hand', async () => {
        await h.db.update(tripInviteLinks).set({ role: 'owner' })
        expect(await live(secret)).toBeNull()
      })

      it('an archived trip, and the same secret again once it is restored', async () => {
        await archiveTrip(a.scope, tripId)
        expect(await live(secret)).toBeNull()
        await h.db.update(trips).set({ isArchived: false })
        expect(await live(secret)).not.toBeNull()
      })

      it('a creator who is no longer an owner of the trip', async () => {
        await h.db
          .update(tripMembers)
          .set({ role: 'editor' })
          .where(eq(tripMembers.userId, a.ownerUserId))
        expect(await live(secret)).toBeNull()
      })

      it('a creator removed from the trip', async () => {
        await h.db
          .delete(tripMembers)
          .where(eq(tripMembers.userId, a.ownerUserId))
        expect(await live(secret)).toBeNull()
      })

      it('a creator removed from the workspace', async () => {
        await h.db.delete(member).where(eq(member.userId, a.ownerUserId))
        expect(await live(secret)).toBeNull()
      })

      it('a banned creator, until the ban expires', async () => {
        await h.db
          .update(user)
          .set({ banned: true, banExpires: null })
          .where(eq(user.id, a.ownerUserId))
        expect(await live(secret)).toBeNull()
        await h.db
          .update(user)
          .set({ banExpires: new Date(Date.now() - 1000) })
          .where(eq(user.id, a.ownerUserId))
        expect(await live(secret)).not.toBeNull()
      })

      it('a hand-made row whose workspace disagrees with its trip’s', async () => {
        await h.db
          .update(tripInviteLinks)
          .set({ organizationId: b.organizationId })
        expect(await live(secret)).toBeNull()
      })

      it('a creator who joined the workspace or the trip after the link was made', async () => {
        await h.db
          .update(tripMembers)
          .set({ createdAt: new Date(Date.now() + 60_000) })
          .where(eq(tripMembers.userId, a.ownerUserId))
        expect(await live(secret)).toBeNull()
      })
    })
  })

  describe('state', () => {
    it('is stale when the derivation key no longer yields the stored digest', async () => {
      const { secret } = await mint()
      const view = await readTripInvite(a.scope, tripId, `${KEY}-rotated`)
      expect(view?.state).toBe('stale')
      expect(
        await revealTripInviteSecret(a.scope, tripId, `${KEY}-rotated`),
      ).toBeNull()
      // The digest still matches the copy that was sent; the finder derives the secret again from
      // the current key, so a rotated key fails closed for every caller.
      expect(
        await findLiveTripInviteByDigestUnscoped(
          h.db,
          await hashSecret(secret),
          `${KEY}-rotated`,
        ),
      ).toBeNull()
      expect(await live(secret)).not.toBeNull()
    })

    it('is archived while the trip is archived', async () => {
      await mint()
      await archiveTrip(a.scope, tripId)
      expect((await readTripInvite(a.scope, tripId, KEY))?.state).toBe(
        'archived',
      )
    })

    it('refuses a write on an archived trip', async () => {
      await mint()
      await archiveTrip(a.scope, tripId)
      expect(
        await captureError(() =>
          replaceTripInvite(a.scope, tripId, {
            role: 'viewer',
            expectedRotation: 0,
            key: KEY,
          }),
        ),
      ).toBeInstanceOf(TripArchivedError)
    })
  })

  describe('touch', () => {
    it('counts a join and stamps when', async () => {
      const { invite } = await mint()
      const joiner = a.scopeFor(await a.addUser('joiner'))
      await touchTripInvite(joiner, invite.id)
      await touchTripInvite(joiner, invite.id)
      const view = await readTripInvite(a.scope, tripId, KEY)
      expect(view?.useCount).toBe(2)
      expect(view?.lastUsedAt).toBeInstanceOf(Date)
    })

    it('is not a read: reading never moves the count', async () => {
      await mint()
      await readTripInvite(a.scope, tripId, KEY)
      await revealTripInviteSecret(a.scope, tripId, KEY)
      expect((await rows())[0]?.useCount).toBe(0)
    })
  })

  describe('insertTripMember', () => {
    it('seats a person of this workspace on its own trip and refuses a trip of another workspace', async () => {
      const userId = await a.addUser('joiner')
      const seat = await insertTripMember(a.scope, {
        tripId,
        userId,
        role: 'viewer',
        invitedBy: a.ownerUserId,
      })
      expect(seat).toMatchObject({ tripId, userId, role: 'viewer' })

      const other = (
        await createTrip(b.scope, { title: 'Oslo', currency: 'NOK' })
      ).id
      expect(
        await captureError(() =>
          insertTripMember(a.scope, {
            tripId: other,
            userId,
            role: 'viewer',
            invitedBy: a.ownerUserId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await h.db
          .select()
          .from(tripMembers)
          .where(eq(tripMembers.tripId, other)),
      ).toHaveLength(1)
    })
  })

  describe('tenant isolation', () => {
    let bTripId: string
    let bSecret: string
    let bInviteId: string
    let outsider: TenantScope

    beforeEach(async () => {
      bTripId = (await createTrip(b.scope, { title: 'Oslo', currency: 'NOK' }))
        .id
      const created = await createTripInvite(b.scope, bTripId, {
        role: 'viewer',
        key: KEY,
      })
      bSecret = created.secret ?? ''
      bInviteId = created.invite.id
      outsider = a.scope
    })

    it('hides, and leaves byte-identical, a link of another workspace', async () => {
      const before = await h.db
        .select()
        .from(tripInviteLinks)
        .where(eq(tripInviteLinks.id, bInviteId))
      const attempts: Array<() => Promise<unknown>> = [
        () => readTripInvite(outsider, bTripId, KEY),
        () => revealTripInviteSecret(outsider, bTripId, KEY),
        () => createTripInvite(outsider, bTripId, { role: 'editor', key: KEY }),
        () =>
          replaceTripInvite(outsider, bTripId, {
            role: 'editor',
            expectedRotation: 0,
            key: KEY,
          }),
        () =>
          updateTripInvite(outsider, bTripId, {
            enabled: false,
            expectedRotation: 0,
            key: KEY,
          }),
        () => touchTripInvite(outsider, bInviteId),
      ]
      for (const attempt of attempts) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }
      const after = await h.db
        .select()
        .from(tripInviteLinks)
        .where(eq(tripInviteLinks.id, bInviteId))
      expect(after).toEqual(before)
      expect(await live(bSecret)).toMatchObject({
        organizationId: b.organizationId,
      })
    })
  })
})
