/**
 * The trip lifecycle at the repository — who may see a trip, and who may change it.
 *
 * Two questions with two different answers, and the whole point of this file is that they must stay
 * two: "may this scope see this row?" is answered with {@link NotFoundError}, indistinguishable from
 * a foreign tenant's id, so the answer never reveals that a trip exists; "may this member do this?"
 * is answered with a `FORBIDDEN` {@link RepositoryError}, which the caller has already earned by
 * proving they may see the trip. Collapsing them either way is a leak in one direction and a lie in
 * the other.
 *
 * PRD #104 decisions 1, 2 and 6; ADR 0007.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { trips } from '#/server/db/schema'
import { NotFoundError, RepositoryError } from '../context'
import {
  addTripMember,
  archiveTrip,
  assertTripRole,
  canReadTrip,
  countTripsByStatus,
  createTrip,
  deleteTrip,
  listTrips,
  listTripsForUser,
  requireTrip,
  restoreTrip,
  tripRolesFor,
  updateTrip,
  updateTripMember,
} from '../trips'
import { captureError, createHarness, subscribeTenant } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { TenantScope } from '../base'

describe('trip lifecycle', () => {
  let harness: Harness
  let tenant: SeededTenant
  /** A second workspace member, on none of the workspace's trips. */
  let outsiderId: string
  let outsider: TenantScope

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('lifecycle')
    await subscribeTenant(tenant.scope, 'crew')
    outsiderId = await tenant.addUser('Colleague')
    outsider = tenant.scopeFor(outsiderId)
  })

  /* ------------------------------------------------------------------ reads */

  describe('the read predicate', () => {
    it('lets a trip’s own member read it', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Lisbon' })

      expect(await canReadTrip(tenant.scope, trip.id)).toBe(true)
      expect((await requireTrip(tenant.scope, trip.id)).id).toBe(trip.id)
    })

    it('hides a private trip from a workspace member who is not on it', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Lisbon' })

      expect(await canReadTrip(outsider, trip.id)).toBe(false)
      expect(
        await captureError(() => requireTrip(outsider, trip.id)),
      ).toBeInstanceOf(NotFoundError)
      expect(await listTrips(outsider)).toEqual([])
      expect((await countTripsByStatus(outsider)).total).toBe(0)
    })

    it('opens an organization-visible trip to every workspace member', async () => {
      const trip = await createTrip(tenant.scope, {
        title: 'Team offsite',
        visibility: 'organization',
      })

      expect(await canReadTrip(outsider, trip.id)).toBe(true)
      expect((await listTrips(outsider)).map((row) => row.id)).toEqual([
        trip.id,
      ])
      expect((await countTripsByStatus(outsider)).total).toBe(1)
    })

    it('grants a signed-in reader nothing from `public` on its own', async () => {
      const trip = await createTrip(tenant.scope, {
        title: 'Gallery candidate',
        visibility: 'public',
      })

      expect(await canReadTrip(outsider, trip.id)).toBe(false)
      expect(await listTrips(outsider)).toEqual([])
    })

    it('opens a private trip once the reader is a member of it', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Lisbon' })
      await addTripMember(tenant.scope, {
        tripId: trip.id,
        userId: outsiderId,
        role: 'viewer',
      })

      expect(await canReadTrip(outsider, trip.id)).toBe(true)
      expect((await requireTrip(outsider, trip.id)).id).toBe(trip.id)
    })

    it('answers `listTripsForUser` for the acting user and nobody else', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Lisbon' })

      expect(
        (await listTripsForUser(tenant.scope, tenant.ownerUserId)).map(
          (row) => row.id,
        ),
      ).toEqual([trip.id])
      // The alias answers the scope's own user; asking it about someone else is not a question a
      // tenant-scoped read may answer after ADR 0007, and an empty list says so without leaking.
      expect(await listTripsForUser(tenant.scope, outsiderId)).toEqual([])
    })

    it('reports each trip’s role for the acting user, and null where there is none', async () => {
      const mine = await createTrip(tenant.scope, { title: 'Mine' })
      const theirs = await createTrip(tenant.scope, {
        title: 'Theirs',
        visibility: 'organization',
      })

      const roles = await tripRolesFor(outsider, [mine.id, theirs.id])
      expect(roles.get(mine.id) ?? null).toBeNull()
      expect(roles.get(theirs.id) ?? null).toBeNull()

      expect((await tripRolesFor(tenant.scope, [mine.id])).get(mine.id)).toBe(
        'owner',
      )
    })
  })

  /* ----------------------------------------------------------------- writes */

  describe('the role guard', () => {
    it('admits the owner and refuses everyone else with FORBIDDEN, not NOT_FOUND', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Lisbon' })
      await addTripMember(tenant.scope, {
        tripId: trip.id,
        userId: outsiderId,
        role: 'editor',
      })

      await expect(
        assertTripRole(tenant.scope, trip.id, ['owner']),
      ).resolves.toBe('owner')

      const refusal = await captureError(() =>
        assertTripRole(outsider, trip.id, ['owner']),
      )
      expect(refusal).toBeInstanceOf(RepositoryError)
      expect(refusal).not.toBeInstanceOf(NotFoundError)
      expect((refusal as RepositoryError).code).toBe('FORBIDDEN')

      // The same member is admitted where the matrix admits an editor.
      await expect(
        assertTripRole(outsider, trip.id, ['owner', 'editor']),
      ).resolves.toBe('editor')
    })

    it('refuses an archive to anyone but an owner', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Lisbon' })
      await addTripMember(tenant.scope, {
        tripId: trip.id,
        userId: outsiderId,
        role: 'editor',
      })

      const refusal = await captureError(() => archiveTrip(outsider, trip.id))
      expect((refusal as RepositoryError).code).toBe('FORBIDDEN')
      expect((await requireTrip(tenant.scope, trip.id)).isArchived).toBe(false)
    })

    it('refuses an edit and a delete to an editor, and admits them to an owner', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Lisbon' })
      await addTripMember(tenant.scope, {
        tripId: trip.id,
        userId: outsiderId,
        role: 'editor',
      })

      expect(
        (
          (await captureError(() =>
            updateTrip(outsider, trip.id, { title: 'Hijacked' }),
          )) as RepositoryError
        ).code,
      ).toBe('FORBIDDEN')
      expect(
        (
          (await captureError(() =>
            deleteTrip(outsider, trip.id),
          )) as RepositoryError
        ).code,
      ).toBe('FORBIDDEN')

      expect((await requireTrip(tenant.scope, trip.id)).title).toBe('Lisbon')
      await updateTrip(tenant.scope, trip.id, { title: 'Lisbon in April' })
      expect((await requireTrip(tenant.scope, trip.id)).title).toBe(
        'Lisbon in April',
      )
    })

    it('hides a trip the caller may not see behind NotFoundError, never FORBIDDEN', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Lisbon' })

      for (const attempt of [
        () => updateTrip(outsider, trip.id, { title: 'Hijacked' }),
        () => archiveTrip(outsider, trip.id),
        () => restoreTrip(outsider, trip.id),
        () => deleteTrip(outsider, trip.id),
      ]) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }
    })
  })

  describe('archiving', () => {
    it('keeps the lifecycle status across the round trip and never writes `archived`', async () => {
      const trip = await createTrip(tenant.scope, {
        title: 'Patagonia',
        status: 'completed',
      })

      const archived = await archiveTrip(tenant.scope, trip.id)
      expect(archived.isArchived).toBe(true)
      expect(archived.status).toBe('completed')

      const restored = await restoreTrip(tenant.scope, trip.id)
      expect(restored.isArchived).toBe(false)
      expect(restored.status).toBe('completed')

      const rows = await harness.db
        .select({ status: trips.status })
        .from(trips)
        .where(eq(trips.id, trip.id))
      expect(rows.map((row) => row.status)).toEqual(['completed'])
    })

    it('leaves an archived trip readable by its members', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Patagonia' })
      await archiveTrip(tenant.scope, trip.id)

      expect((await requireTrip(tenant.scope, trip.id)).isArchived).toBe(true)
      expect((await countTripsByStatus(tenant.scope)).archived).toBe(1)
    })

    it('lets a demoted owner’s trip still be archived by a remaining owner', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Lisbon' })
      const member = await addTripMember(tenant.scope, {
        tripId: trip.id,
        userId: outsiderId,
        role: 'viewer',
      })
      await updateTripMember(tenant.scope, member.id, { role: 'owner' })

      await expect(archiveTrip(outsider, trip.id)).resolves.toMatchObject({
        isArchived: true,
      })
    })
  })
})
