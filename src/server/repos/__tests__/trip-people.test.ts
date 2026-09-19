/**
 * The trip's people — the guards inside the membership writers, and the one participant read model.
 *
 * `01-S6a`'s first half. Before it, the three writers in `trips.ts` were unguarded in three distinct
 * ways: `addTripMember` accepted a user id from outside the caller's organization, `removeTripMember`
 * would remove a trip's last owner, `updateTripMember` would demote them to the same unownable trip
 * by a different verb, and not one of the three asserted the owner role. Every case here is about a
 * guard that now lives in the writer rather than at a call site — which is the point: `01-S8`'s
 * initial-members picker and `01-S9`'s participant vocabulary call these same functions, and a guard
 * added at one call site is a guard the next call site does not have.
 *
 * The cross-organization half of the same question is in `tenant-isolation.test.ts`, and the
 * between-members half in `member-isolation.test.ts`. This file holds the invariants that are
 * neither: the trip's own rules about its own people.
 */

import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { member } from '#/server/db/auth-schema'
import { newId, tripMembers } from '#/server/db/schema'
import { RepositoryError } from '../context'
import {
  addTripMember,
  createTrip,
  listTripMembers,
  listTripParticipants,
  removeTripMember,
  TripMemberExistsError,
  updateTripMember,
} from '../trips'
import {
  captureError,
  createHarness,
  memberUserIds,
  subscribeTenant,
} from './harness'
import type { Harness, SeededTenant } from './harness'

describe('a trip’s people', () => {
  let harness: Harness
  let alpha: SeededTenant
  let tripId: string
  /** The trip's owner — `createTrip` writes their membership. */
  let ownerId: string

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
    await subscribeTenant(alpha.scope, 'crew', 5)
    ownerId = alpha.ownerUserId

    const trip = await createTrip(alpha.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })
    tripId = trip.id
  })

  /** The membership row of one user on the fixture's trip. */
  async function membershipOf(userId: string): Promise<string> {
    const row = (await listTripMembers(alpha.scope, tripId)).find(
      (candidate) => candidate.userId === userId,
    )
    if (row === undefined) {
      throw new Error(`No membership for ${userId} on the fixture's trip.`)
    }
    return row.id
  }

  /** Adds a workspace user and puts them on the fixture's trip. */
  async function join(
    name: string,
    role: 'owner' | 'editor' | 'viewer',
  ): Promise<string> {
    const userId = await alpha.addUser(name)
    await addTripMember(alpha.scope, { tripId, userId, role })
    return userId
  }

  describe('the order the members come back in', () => {
    /**
     * Two memberships created in the same millisecond, with ids in the opposite order to their
     * insertion. `created_at` alone leaves the tie to whatever rowid order SQLite happens to
     * produce, which is insertion order here — so a read that comes back in *id* order can only be
     * the tie-break doing it. Remove `asc(tripMembers.id)` from `listTripMembers` and this fails.
     */
    it('breaks a created_at tie on the id, so the order is total', async () => {
      const tiedAt = new Date(1_772_000_000_000)
      const [first, second] = [newId(), newId()].sort()
      const seat = async (id: string, name: string): Promise<void> => {
        await harness.db.insert(tripMembers).values({
          id,
          organizationId: alpha.organizationId,
          tripId,
          userId: await alpha.addUser(name),
          role: 'editor',
          createdAt: tiedAt,
          updatedAt: tiedAt,
        })
      }
      // Inserted in the reverse of their id order, so insertion order and id order disagree.
      await seat(second, 'Tied second')
      await seat(first, 'Tied first')

      const ids = (await listTripMembers(alpha.scope, tripId))
        .filter((row) => row.createdAt.getTime() === tiedAt.getTime())
        .map((row) => row.id)
      expect(ids).toEqual([first, second])
    })
  })

  describe('the workspace guard on addTripMember', () => {
    it('refuses a user id from another organization, and writes no row', async () => {
      const beta = await harness.seedTenant('beta')
      const before = (await listTripMembers(alpha.scope, tripId)).length

      const refusal = await captureError(() =>
        addTripMember(alpha.scope, {
          tripId,
          userId: beta.ownerUserId,
          role: 'editor',
        }),
      )

      expect(refusal).toBeInstanceOf(RepositoryError)
      expect((refusal as RepositoryError).code).toBe(
        'TRIP_MEMBER_NOT_IN_WORKSPACE',
      )
      expect((await listTripMembers(alpha.scope, tripId)).length).toBe(before)
    })

    it('admits a user id from the caller’s own workspace', async () => {
      const userId = await join('Second traveller', 'editor')

      expect(
        (await listTripMembers(alpha.scope, tripId)).map((row) => row.userId),
      ).toContain(userId)
    })

    it('refuses somebody already on the trip with its own code, and writes no row', async () => {
      // A stale people screen, or two owners adding the same person at once: the unique index is
      // what refuses, and the writer has to name that refusal rather than let the driver's through.
      const userId = await join('Already here', 'editor')
      const before = (await listTripMembers(alpha.scope, tripId)).length

      const refusal = await captureError(() =>
        addTripMember(alpha.scope, { tripId, userId, role: 'viewer' }),
      )

      expect(refusal).toBeInstanceOf(TripMemberExistsError)
      expect((refusal as RepositoryError).code).toBe('TRIP_MEMBER_EXISTS')
      expect((await listTripMembers(alpha.scope, tripId)).length).toBe(before)
    })
  })

  describe('the last-owner guard, which two verbs reach', () => {
    it('refuses to remove a trip’s sole owner, and the row survives', async () => {
      const refusal = await captureError(async () =>
        removeTripMember(alpha.scope, await membershipOf(ownerId)),
      )

      expect((refusal as RepositoryError).code).toBe('TRIP_LAST_OWNER')
      expect(
        (await listTripMembers(alpha.scope, tripId)).map((row) => row.userId),
      ).toEqual([ownerId])
    })

    it('refuses to demote a trip’s sole owner, and the role is unchanged', async () => {
      const membershipId = await membershipOf(ownerId)

      const refusal = await captureError(() =>
        updateTripMember(alpha.scope, membershipId, { role: 'editor' }),
      )

      expect((refusal as RepositoryError).code).toBe('TRIP_LAST_OWNER')
      expect(
        (await listTripMembers(alpha.scope, tripId)).find(
          (row) => row.id === membershipId,
        )?.role,
      ).toBe('owner')
    })

    it('allows both once a second owner exists', async () => {
      const secondOwnerId = await join('Co-owner', 'owner')
      const ownMembershipId = await membershipOf(ownerId)

      // The demotion the guard refused a moment ago now goes through.
      await updateTripMember(alpha.scope, ownMembershipId, { role: 'editor' })
      expect(
        (await listTripMembers(alpha.scope, tripId)).find(
          (row) => row.id === ownMembershipId,
        )?.role,
      ).toBe('editor')

      // And so does the removal — driven by the co-owner, because the demotion above has just cost
      // the original owner the role the assert requires. That is the guard working, not a detour.
      await removeTripMember(alpha.scopeFor(secondOwnerId), ownMembershipId)
      expect(
        (await listTripMembers(alpha.scope, tripId)).map((row) => row.userId),
      ).toEqual([secondOwnerId])
    })

    it('refuses a sole owner’s own leave, because leaving is self-removal', async () => {
      // The self-removal exemption covers the owner assert and nothing else. A trip nobody owns is
      // the state both verbs exist to prevent, so it holds for the owner's own row too.
      const refusal = await captureError(async () =>
        removeTripMember(alpha.scope, await membershipOf(ownerId)),
      )

      expect((refusal as RepositoryError).code).toBe('TRIP_LAST_OWNER')
    })
  })

  describe('the owner assert, and its one exemption', () => {
    it('refuses an editor re-adding a current member with FORBIDDEN, not as already on the trip', async () => {
      // The owner assert runs before the unique index answers, so a non-owner learns nothing about
      // who is on the trip from the refusal's code.
      const editor = alpha.scopeFor(await join('Editor of A', 'editor'))

      const refusal = await captureError(() =>
        addTripMember(editor, { tripId, userId: ownerId, role: 'viewer' }),
      )

      expect((refusal as RepositoryError).code).toBe('FORBIDDEN')
    })

    it('refuses an editor all three writes with FORBIDDEN', async () => {
      const editorId = await join('Editor of A', 'editor')
      const viewerId = await join('Viewer of A', 'viewer')
      const editor = alpha.scopeFor(editorId)
      const viewerMembershipId = await membershipOf(viewerId)

      for (const attempt of [
        async () =>
          addTripMember(editor, {
            tripId,
            userId: await alpha.addUser('Somebody the editor invited'),
            role: 'viewer',
          }),
        () => updateTripMember(editor, viewerMembershipId, { role: 'editor' }),
        () => removeTripMember(editor, viewerMembershipId),
      ]) {
        const refusal = await captureError(attempt)
        expect(refusal).toBeInstanceOf(RepositoryError)
        expect((refusal as RepositoryError).code).toBe('FORBIDDEN')
      }

      // Nothing moved.
      expect(
        (await listTripMembers(alpha.scope, tripId)).find(
          (row) => row.id === viewerMembershipId,
        )?.role,
      ).toBe('viewer')
    })

    it('lets a viewer remove their own membership', async () => {
      const viewerId = await join('Viewer of A', 'viewer')

      await removeTripMember(
        alpha.scopeFor(viewerId),
        await membershipOf(viewerId),
      )

      expect(
        (await listTripMembers(alpha.scope, tripId)).map((row) => row.userId),
      ).not.toContain(viewerId)
    })

    it('refuses a viewer removing somebody else’s', async () => {
      const viewerId = await join('Viewer of A', 'viewer')
      const editorId = await join('Editor of A', 'editor')
      const editorMembershipId = await membershipOf(editorId)

      const refusal = await captureError(() =>
        removeTripMember(alpha.scopeFor(viewerId), editorMembershipId),
      )

      expect((refusal as RepositoryError).code).toBe('FORBIDDEN')
      expect(
        (await listTripMembers(alpha.scope, tripId)).map((row) => row.userId),
      ).toContain(editorId)
    })
  })

  describe('listTripParticipants', () => {
    it('answers owner first, with the discriminant intact', async () => {
      const editorId = await join('Editor of A', 'editor')
      // Demote the owner's own row *after* a second owner exists, then take the second owner back
      // to editor, so the trip holds one owner whose membership is not the oldest row.
      const coOwnerId = await join('Co-owner', 'owner')
      await updateTripMember(alpha.scope, await membershipOf(ownerId), {
        role: 'viewer',
      })

      const participants = await listTripParticipants(alpha.scope, tripId)

      expect(participants.every((row) => row.kind === 'member')).toBe(true)
      expect(participants[0]).toMatchObject({
        kind: 'member',
        userId: coOwnerId,
        role: 'owner',
      })
      // The rest are the two the partition did not promote, as a set. Their order between them is
      // not assertable here: `createTrip` and `join` can write inside one millisecond, `created_at`
      // ties, and the tie falls to the random tail of `newId()` — the same #472 mechanism. That the
      // tie-break makes the order *total* is the deliberate subject of
      // 'breaks a created_at tie on the id', which seats its rows at a fixed `createdAt` instead of
      // hoping for one.
      const rest = memberUserIds(participants).slice(1)
      expect(rest).toHaveLength(2)
      expect(new Set(rest)).toEqual(new Set([ownerId, editorId]))
    })

    it('carries no email address on any element', async () => {
      await join('Second traveller', 'editor')

      const participants = await listTripParticipants(alpha.scope, tripId)

      expect(participants.length).toBeGreaterThan(1)
      for (const participant of participants) {
        expect(Object.keys(participant)).not.toContain('email')
      }
      // And not anywhere inside a serialised payload either, which is what actually crosses the
      // wire. `seedTenant` gives every user an `@example.com` address.
      expect(JSON.stringify(participants)).not.toContain('@')
    })

    it('drops a member whose workspace account has gone, rather than rendering them nameless', async () => {
      const leaverId = await join('Left the workspace', 'editor')
      // The workspace membership goes; the trip membership row stays, which is exactly the state a
      // removal from the workspace leaves behind.
      await harness.db.delete(member).where(eq(member.userId, leaverId))

      const participants = await listTripParticipants(alpha.scope, tripId)

      expect(memberUserIds(participants)).toEqual([ownerId])
      // The row itself is still there — this is a read-model decision, not a cascade.
      expect(
        await harness.db
          .select({ id: tripMembers.id })
          .from(tripMembers)
          .where(
            and(
              eq(tripMembers.tripId, tripId),
              eq(tripMembers.userId, leaverId),
            ),
          ),
      ).toHaveLength(1)
    })

    it('answers an empty list when every remaining member has left the workspace', async () => {
      await harness.db.delete(member).where(eq(member.userId, ownerId))

      expect(await listTripParticipants(alpha.scope, tripId)).toEqual([])
    })
  })
})
