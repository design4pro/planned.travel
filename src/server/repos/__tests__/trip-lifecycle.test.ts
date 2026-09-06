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
import {
  dayAssignments,
  dayNotes,
  days,
  places,
  tripFavourites,
  trips,
} from '#/server/db/schema'
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
import {
  countFavourites,
  listFavouriteTripIds,
  setFavourite,
} from '../trip-favourites'
import { createDayNote, listTripDays } from '../days'
import { createAssignment } from '../itinerary'
import { createPlace } from '../places'
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
      ).resolves.toBeUndefined()

      const refusal = await captureError(() =>
        assertTripRole(outsider, trip.id, ['owner']),
      )
      expect(refusal).toBeInstanceOf(RepositoryError)
      expect(refusal).not.toBeInstanceOf(NotFoundError)
      expect((refusal as RepositoryError).code).toBe('FORBIDDEN')

      // The same member is admitted where the matrix admits an editor.
      await expect(
        assertTripRole(outsider, trip.id, ['owner', 'editor']),
      ).resolves.toBeUndefined()
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

    it('clears a legacy `archived` status when the trip comes back', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Marrakech' })
      // The shape the code this replaced left behind, and the only one that can reach the branch:
      // the flag set *and* the status overwritten, so what it went in with is already lost.
      await harness.db
        .update(trips)
        .set({ isArchived: true, status: 'archived' })
        .where(eq(trips.id, trip.id))

      const restored = await restoreTrip(tenant.scope, trip.id)

      expect(restored.isArchived).toBe(false)
      // Not `'archived'`: the badge and the status breakdown would both still say archived on a
      // trip the archived list no longer shows.
      expect(restored.status).toBe('planning')
      const counts = await countTripsByStatus(tenant.scope)
      expect(counts.byStatus.archived).toBe(0)
      expect(counts.byStatus.planning).toBe(1)
      expect(counts.archived).toBe(0)
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
  /* --------------------------------------------------------------- deleting */

  /**
   * Delete is terminal (PRD #104 decision 3): there is no `deleted_at` and no trash, because
   * `is_archived` already *is* the recoverable state. What that makes worth asserting is the cascade
   * — a trip that left one orphaned day, place, assignment or note behind would be a trip that was
   * still half there, invisible to every reader and still counted by nothing.
   */
  describe('deleting', () => {
    /** Rows read past every repository, so the tables are the witness rather than a scoped reader. */
    async function childRowCounts(
      tripId: string,
    ): Promise<Record<string, number>> {
      const [dayRows, placeRows, assignmentRows, noteRows] = await Promise.all([
        harness.db
          .select({ id: days.id })
          .from(days)
          .where(eq(days.tripId, tripId)),
        harness.db
          .select({ id: places.id })
          .from(places)
          .where(eq(places.tripId, tripId)),
        harness.db
          .select({ id: dayAssignments.id })
          .from(dayAssignments)
          .where(eq(dayAssignments.tripId, tripId)),
        harness.db
          .select({ id: dayNotes.id })
          .from(dayNotes)
          .where(eq(dayNotes.tripId, tripId)),
      ])
      return {
        days: dayRows.length,
        places: placeRows.length,
        assignments: assignmentRows.length,
        notes: noteRows.length,
      }
    }

    it('takes every day, place, assignment and note with it', async () => {
      const trip = await createTrip(tenant.scope, {
        title: 'Lisbon',
        startDate: '2026-04-10',
        endDate: '2026-04-12',
      })
      const day = (await listTripDays(tenant.scope, trip.id)).at(0)
      expect(day).toBeDefined()
      if (day === undefined) return

      const place = await createPlace(tenant.scope, {
        tripId: trip.id,
        name: 'Miradouro da Senhora do Monte',
      })
      await createAssignment(tenant.scope, {
        tripId: trip.id,
        dayId: day.id,
        placeId: place.id,
      })
      await createDayNote(tenant.scope, {
        tripId: trip.id,
        dayId: day.id,
        body: 'Buy the transit pass at the airport.',
      })
      await setFavourite(tenant.scope, trip.id, true)

      expect(await childRowCounts(trip.id)).toEqual({
        days: 3,
        places: 1,
        assignments: 1,
        notes: 1,
      })

      await deleteTrip(tenant.scope, trip.id)

      expect(await childRowCounts(trip.id)).toEqual({
        days: 0,
        places: 0,
        assignments: 0,
        notes: 0,
      })
      expect(
        await captureError(() => requireTrip(tenant.scope, trip.id)),
      ).toBeInstanceOf(NotFoundError)
      // The star goes with the trip too, so a cleared favourites count is not a stale row's doing.
      expect(await listFavouriteTripIds(tenant.scope)).toEqual([])
    })
  })

  /* ------------------------------------------------------------ favourites */

  /**
   * The favourite is one person's bookmark (PRD #104 decision 5). The row's existence *is* the
   * star, so the invariants worth holding are about rows: one per person and trip however many
   * times it is set, none once it is cleared, and a count that answers the caller and nobody else.
   */
  describe('the favourite', () => {
    /** Rows in `trip_favourites`, read past every repository so the table is the witness. */
    async function favouriteRows(): Promise<
      Array<{ tripId: string; userId: string }>
    > {
      return harness.db
        .select({
          tripId: tripFavourites.tripId,
          userId: tripFavourites.userId,
        })
        .from(tripFavourites)
    }

    it('writes one row however many times it is set, and none once it is cleared', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Lisbon' })

      await setFavourite(tenant.scope, trip.id, true)
      await setFavourite(tenant.scope, trip.id, true)
      expect(await favouriteRows()).toEqual([
        { tripId: trip.id, userId: tenant.ownerUserId },
      ])

      await setFavourite(tenant.scope, trip.id, false)
      expect(await favouriteRows()).toEqual([])
      // Clearing a star that was never set is the same answer, not a NotFoundError.
      await expect(
        setFavourite(tenant.scope, trip.id, false),
      ).resolves.toBeUndefined()
    })

    it('leaves one row when two requests set it at once', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Lisbon' })

      // A double click is two requests, and started together they interleave at every `await`:
      // both read no row, then both insert. The read cannot answer that one - the unique index on
      // `(trip_id, user_id)` does, and the loser has nothing left to do because the row it wanted
      // is the row that is now there.
      await Promise.all([
        setFavourite(tenant.scope, trip.id, true),
        setFavourite(tenant.scope, trip.id, true),
      ])

      expect(await favouriteRows()).toEqual([
        { tripId: trip.id, userId: tenant.ownerUserId },
      ])
    })

    it('counts and lists for the caller alone', async () => {
      const mine = await createTrip(tenant.scope, {
        title: 'Mine',
        visibility: 'organization',
      })
      const theirs = await createTrip(tenant.scope, {
        title: 'Theirs',
        visibility: 'organization',
      })

      await setFavourite(tenant.scope, mine.id, true)
      await setFavourite(outsider, theirs.id, true)

      expect(await listFavouriteTripIds(tenant.scope)).toEqual([mine.id])
      expect(await listFavouriteTripIds(outsider)).toEqual([theirs.id])
      expect(await countFavourites(tenant.scope)).toBe(1)
      expect(await countFavourites(outsider)).toBe(1)
    })

    it('filters the list on the caller’s own star, not on a flag the trip carries', async () => {
      const starred = await createTrip(tenant.scope, {
        title: 'Starred',
        visibility: 'organization',
      })
      const plain = await createTrip(tenant.scope, {
        title: 'Plain',
        visibility: 'organization',
      })
      await setFavourite(tenant.scope, starred.id, true)

      expect(
        (await listTrips(tenant.scope, { favourite: true })).map(
          (row) => row.id,
        ),
      ).toEqual([starred.id])
      expect(
        (await listTrips(tenant.scope, { favourite: false })).map(
          (row) => row.id,
        ),
      ).toEqual([plain.id])
      // The same two trips, read by the colleague who starred neither.
      expect(await listTrips(outsider, { favourite: true })).toEqual([])
    })

    it('is a reader’s verb: a viewer may star a trip they may not change', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Lisbon' })
      await addTripMember(tenant.scope, {
        tripId: trip.id,
        userId: outsiderId,
        role: 'viewer',
      })

      await setFavourite(outsider, trip.id, true)
      expect(await listFavouriteTripIds(outsider)).toEqual([trip.id])
      expect(await countFavourites(tenant.scope)).toBe(0)
    })
  })
})
