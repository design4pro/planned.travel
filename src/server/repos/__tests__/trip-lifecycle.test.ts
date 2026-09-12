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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import {
  dayAssignments,
  dayNotes,
  days,
  expenses,
  placeTags,
  places,
  reservations,
  shareLinks,
  tripFavourites,
  tripFiles,
  tripMembers,
  trips,
} from '#/server/db/schema'
import { NotFoundError, RepositoryError } from '../context'
import {
  MAX_BOUND_PARAMETERS,
  addTripMember,
  archiveTrip,
  assertTripRole,
  canReadTrip,
  chunkFor,
  copyTripContents,
  countTripsByStatus,
  createShareLink,
  createTrip,
  deleteTrip,
  listTrips,
  listTripsForUser,
  registerTripCopier,
  requireTrip,
  restoreTrip,
  startTripCopy,
  tripRolesFor,
  updateTrip,
  updateTripMember,
} from '../trips'
import {
  countFavourites,
  listFavouriteTripIds,
  setFavourite,
} from '../trip-favourites'
import { createDayNote, listTripDays, updateDay } from '../days'
import { createExpense } from '../expenses'
import { recordFile } from '../files'
import { createAssignment } from '../itinerary'
import {
  createPlace,
  listUnscheduledPlaces,
  placeTagsAccess,
  placesRepository,
  setPlaceTags,
} from '../places'
import { createReservation } from '../reservations'
import { createTag } from '../tags'
import { captureError, createHarness, subscribeTenant } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { Trip } from '#/server/db/types'
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
      // both read no row, then both insert. The read cannot answer that one - the primary key on
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

  /* ----------------------------------------------------------------- copying */

  /**
   * A copy reproduces the **plan** and never the **record** (PRD #104 decision 4b), and it is split
   * on the bound: {@link startTripCopy} does only what is O(1) in the source's size, so the reader
   * gets a trip id and a quota refusal inside one round trip, and {@link copyTripContents} does the
   * rest in a queue consumer where an unbounded write belongs.
   *
   * Every count below is read past every repository, so the tables are the witness.
   */
  describe('copying', () => {
    interface Inventory {
      days: number
      places: number
      tags: number
      assignments: number
      notes: number
      expenses: number
      files: number
      reservations: number
      shareLinks: number
      members: number
    }

    async function inventoryOf(tripId: string): Promise<Inventory> {
      const placeIds = (
        await harness.db
          .select({ id: places.id })
          .from(places)
          .where(eq(places.tripId, tripId))
      ).map((row) => row.id)
      const tagRows =
        placeIds.length === 0
          ? []
          : await harness.db
              .select({ tagId: placeTags.tagId })
              .from(placeTags)
              .where(inArray(placeTags.placeId, placeIds))
      const [
        dayRows,
        assignmentRows,
        noteRows,
        expenseRows,
        fileRows,
        reservationRows,
        shareLinkRows,
        memberRows,
      ] = await Promise.all([
        harness.db
          .select({ id: days.id })
          .from(days)
          .where(eq(days.tripId, tripId)),
        harness.db
          .select({ id: dayAssignments.id })
          .from(dayAssignments)
          .where(eq(dayAssignments.tripId, tripId)),
        harness.db
          .select({ id: dayNotes.id })
          .from(dayNotes)
          .where(eq(dayNotes.tripId, tripId)),
        harness.db
          .select({ id: expenses.id })
          .from(expenses)
          .where(eq(expenses.tripId, tripId)),
        harness.db
          .select({ id: tripFiles.id })
          .from(tripFiles)
          .where(eq(tripFiles.tripId, tripId)),
        harness.db
          .select({ id: reservations.id })
          .from(reservations)
          .where(eq(reservations.tripId, tripId)),
        harness.db
          .select({ id: shareLinks.id })
          .from(shareLinks)
          .where(eq(shareLinks.tripId, tripId)),
        harness.db
          .select({ id: tripMembers.id })
          .from(tripMembers)
          .where(eq(tripMembers.tripId, tripId)),
      ])
      return {
        days: dayRows.length,
        places: placeIds.length,
        tags: tagRows.length,
        assignments: assignmentRows.length,
        notes: noteRows.length,
        expenses: expenseRows.length,
        files: fileRows.length,
        reservations: reservationRows.length,
        shareLinks: shareLinkRows.length,
        members: memberRows.length,
      }
    }

    /**
     * A three-day trip carrying one of everything: a place on each day with a tag, an assignment
     * and a note per day, and one row in each of the four record tables the copy must leave behind.
     */
    async function seedSource(): Promise<Trip> {
      const trip = await createTrip(tenant.scope, {
        title: 'Lisbon',
        destination: 'Lisbon, Portugal',
        summary: 'Three days of miradouros.',
        currency: 'EUR',
        countryCodes: ['PT'],
        startDate: '2026-04-10',
        endDate: '2026-04-12',
      })
      const tag = await createTag(tenant.scope, { name: 'Viewpoint' })
      const run = await listTripDays(tenant.scope, trip.id)

      for (const [index, day] of run.entries()) {
        const place = await createPlace(tenant.scope, {
          tripId: trip.id,
          name: `Miradouro ${index + 1}`,
          city: 'Lisbon',
          notes: 'Go at sunset.',
        })
        await setPlaceTags(tenant.scope, place.id, [tag.id])
        await createAssignment(tenant.scope, {
          tripId: trip.id,
          dayId: day.id,
          placeId: place.id,
        })
        await createDayNote(tenant.scope, {
          tripId: trip.id,
          dayId: day.id,
          body: `Day ${index + 1}: buy the transit pass.`,
        })
      }

      await createExpense(tenant.scope, {
        tripId: trip.id,
        title: 'Transit pass',
        amountMinor: 640,
        spentOn: '2026-04-10',
      })
      await createReservation(tenant.scope, {
        tripId: trip.id,
        title: 'Hotel do Chiado',
      })
      await recordFile(tenant.scope, {
        tripId: trip.id,
        storageKey: `trips/${tenant.organizationId}/${trip.id}/booking.pdf`,
        filename: 'booking.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1_024,
      })
      await createShareLink(tenant.scope, {
        tripId: trip.id,
        token: 'share-token-0123456789',
        scopes: {
          map: true,
          itinerary: true,
          reservations: false,
          lists: false,
          budget: false,
          collab: false,
          files: false,
        },
      })
      return trip
    }

    /* ------------------------------------------------------------ the bound */

    it('fits a statement inside D1’s bound-parameter ceiling', () => {
      expect(MAX_BOUND_PARAMETERS).toBe(100)
      expect(chunkFor(25)).toBe(4)
      expect(chunkFor(3)).toBe(33)
      // A row wider than the ceiling still sends one row rather than none.
      expect(chunkFor(200)).toBe(1)
    })

    /* --------------------------------------------- the synchronous half */

    it('writes the trip, its owner and the dated run — and nothing else', async () => {
      const source = await seedSource()

      const targetId = await startTripCopy(tenant.scope, source.id, {
        title: 'Lisbon again',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      })

      // This is the assertion that fails if anyone moves inventory work into the request path.
      expect(await inventoryOf(targetId)).toEqual({
        days: 3,
        places: 0,
        tags: 0,
        assignments: 0,
        notes: 0,
        expenses: 0,
        files: 0,
        reservations: 0,
        shareLinks: 0,
        members: 1,
      })

      const target = await requireTrip(tenant.scope, targetId)
      expect(target.copyPendingAt).not.toBeNull()
      expect(target.slug).not.toBe(source.slug)
      // Inherited (spec Q5) — and `visibility` deliberately is not.
      expect(target.destination).toBe('Lisbon, Portugal')
      expect(target.summary).toBe('Three days of miradouros.')
      expect(target.currency).toBe('EUR')
      expect(target.countryCodes).toEqual(['PT'])
      expect(target.visibility).toBe('private')
    })

    it('is open to any reader: a viewer may copy a trip they may not change', async () => {
      const source = await createTrip(tenant.scope, { title: 'Lisbon' })
      await addTripMember(tenant.scope, {
        tripId: source.id,
        userId: outsiderId,
        role: 'viewer',
      })

      const targetId = await startTripCopy(outsider, source.id, {
        title: 'My own Lisbon',
      })

      // The copy is the viewer's, and they own it.
      expect(
        await tripRolesFor(outsider, [targetId]).then((roles) =>
          roles.get(targetId),
        ),
      ).toBe('owner')
    })

    /* -------------------------------------------- the asynchronous half */

    it('reproduces the plan and none of the record', async () => {
      const source = await seedSource()
      const targetId = await startTripCopy(tenant.scope, source.id, {
        title: 'Lisbon again',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      })

      const result = await copyTripContents(tenant.scope, source.id, targetId)

      expect(await inventoryOf(targetId)).toEqual({
        days: 3,
        places: 3,
        tags: 3,
        assignments: 3,
        notes: 3,
        // The record stays behind, by design.
        expenses: 0,
        files: 0,
        reservations: 0,
        shareLinks: 0,
        // The source's people do not come across either: the copier is the only member.
        members: 1,
      })
      expect(result).toMatchObject({
        days: 3,
        places: 3,
        assignments: 3,
        unscheduled: 0,
        notes: 3,
        droppedNotes: 0,
      })
    })

    it('leaves a copy that outlives its source', async () => {
      const source = await seedSource()
      const targetId = await startTripCopy(tenant.scope, source.id, {
        title: 'Lisbon again',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      })
      await copyTripContents(tenant.scope, source.id, targetId)

      await deleteTrip(tenant.scope, source.id)

      expect(await inventoryOf(targetId)).toMatchObject({
        days: 3,
        places: 3,
        tags: 3,
        assignments: 3,
        notes: 3,
      })
    })

    it('does not clear the pending stamp — that is the handler’s last write', async () => {
      const source = await seedSource()
      const targetId = await startTripCopy(tenant.scope, source.id, {
        title: 'Lisbon again',
      })

      await copyTripContents(tenant.scope, source.id, targetId)

      expect(
        (await requireTrip(tenant.scope, targetId)).copyPendingAt,
      ).not.toBeNull()
    })

    it('chunks every insert inside D1’s bound-parameter ceiling', async () => {
      const source = await createTrip(tenant.scope, { title: 'Lisbon' })
      for (let index = 0; index < 10; index += 1) {
        await createPlace(tenant.scope, {
          tripId: source.id,
          name: `Miradouro ${index}`,
        })
      }
      const targetId = await startTripCopy(tenant.scope, source.id, {
        title: 'Lisbon again',
      })

      const insertMany = vi.spyOn(placesRepository, 'insertMany')
      await copyTripContents(tenant.scope, source.id, targetId)
      const sent = insertMany.mock.calls.map((call) => call[1].length)
      insertMany.mockRestore()

      // Ten places at three rows a statement — three, because a `places` row binds 27 parameters
      // and not the 24 its payload spells. The bound is held by the loop, not by a comment.
      expect(sent).toEqual([3, 3, 3, 1])
      expect((await inventoryOf(targetId)).places).toBe(10)
    })

    it('chunks the tag read too, not only the tag write', async () => {
      // The read binds one parameter per place id, and a trip is not capped at ninety places, so an
      // `IN (...)` over the whole place map is a statement D1 refuses. It refuses it with neither
      // `NotFoundError` nor `QuotaExceededError`, so the handler reads it as transient and
      // redelivers the copy forever, leaving the target stuck with `copy_pending_at` set.
      const source = await createTrip(tenant.scope, { title: 'Lisbon' })
      const tag = await createTag(tenant.scope, { name: 'Viewpoint' })
      const placeCount = 95
      for (let index = 0; index < placeCount; index += 1) {
        const place = await createPlace(tenant.scope, {
          tripId: source.id,
          name: `Miradouro ${index}`,
        })
        await setPlaceTags(tenant.scope, place.id, [tag.id])
      }
      const targetId = await startTripCopy(tenant.scope, source.id, {
        title: 'Lisbon again',
      })

      const findMany = vi.spyOn(placeTagsAccess, 'findMany')
      await copyTripContents(tenant.scope, source.id, targetId)
      const reads = findMany.mock.calls.length
      findMany.mockRestore()

      // Ninety-five ids at ninety a read: two statements, not one over the ceiling.
      expect(reads).toBe(2)
      // And the chunking lost nothing on the way — every tag came across.
      expect((await inventoryOf(targetId)).tags).toBe(placeCount)
    })

    /* ------------------------------------------------- truncation and dates */

    it('truncates a shorter range: the overflow lands in ideas, its notes are counted', async () => {
      const source = await createTrip(tenant.scope, {
        title: 'Lisbon',
        startDate: '2026-04-10',
        endDate: '2026-04-14',
      })
      const run = await listTripDays(tenant.scope, source.id)
      expect(run).toHaveLength(5)
      for (const [index, day] of run.entries()) {
        const place = await createPlace(tenant.scope, {
          tripId: source.id,
          name: `Stop ${index + 1}`,
        })
        await createAssignment(tenant.scope, {
          tripId: source.id,
          dayId: day.id,
          placeId: place.id,
        })
        await createDayNote(tenant.scope, {
          tripId: source.id,
          dayId: day.id,
          body: `Day ${index + 1}`,
        })
      }

      const targetId = await startTripCopy(tenant.scope, source.id, {
        title: 'A shorter Lisbon',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      })
      const result = await copyTripContents(tenant.scope, source.id, targetId)

      expect(result).toMatchObject({
        days: 3,
        places: 5,
        assignments: 3,
        unscheduled: 2,
        notes: 3,
        droppedNotes: 2,
      })
      // Every place came across; the two with nowhere to be sit in the ideas column.
      expect(
        (await listUnscheduledPlaces(tenant.scope, targetId)).map(
          (place) => place.name,
        ),
      ).toEqual(['Stop 4', 'Stop 5'])
    })

    it('gives an undated copy a numbered, dateless run', async () => {
      const source = await seedSource()
      const targetId = await startTripCopy(tenant.scope, source.id, {
        title: 'Someday Lisbon',
      })

      await copyTripContents(tenant.scope, source.id, targetId)

      const run = await listTripDays(tenant.scope, targetId)
      expect(run.map((day) => day.dayNumber)).toEqual([1, 2, 3])
      expect(run.every((day) => day.date === null)).toBe(true)
      // The plan came across whole even without dates to hang it on.
      expect(await inventoryOf(targetId)).toMatchObject({
        assignments: 3,
        notes: 3,
      })
    })

    it('carries each day’s title and notes across, dated run or not', async () => {
      const source = await seedSource()
      for (const [index, day] of (
        await listTripDays(tenant.scope, source.id)
      ).entries()) {
        await updateDay(tenant.scope, day.id, {
          title: `Day ${index + 1}: the hills`,
          notes: `Tram 28 goes at ${7 + index}.`,
        })
      }

      // The dated branch keeps the run `startTripCopy` minted, and that run is blank. Without a
      // pass over it the same source copied *with* dates would lose both columns while copied
      // *without* dates kept them — silent, and on the more common of the two paths.
      const dated = await startTripCopy(tenant.scope, source.id, {
        title: 'Lisbon again',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      })
      await copyTripContents(tenant.scope, source.id, dated)

      expect(
        (await listTripDays(tenant.scope, dated)).map((day) => [
          day.title,
          day.notes,
        ]),
      ).toEqual([
        ['Day 1: the hills', 'Tram 28 goes at 7.'],
        ['Day 2: the hills', 'Tram 28 goes at 8.'],
        ['Day 3: the hills', 'Tram 28 goes at 9.'],
      ])

      const undated = await startTripCopy(tenant.scope, source.id, {
        title: 'Someday Lisbon',
      })
      await copyTripContents(tenant.scope, source.id, undated)

      expect(
        (await listTripDays(tenant.scope, undated)).map((day) => [
          day.title,
          day.notes,
        ]),
      ).toEqual([
        ['Day 1: the hills', 'Tram 28 goes at 7.'],
        ['Day 2: the hills', 'Tram 28 goes at 8.'],
        ['Day 3: the hills', 'Tram 28 goes at 9.'],
      ])
    })

    /**
     * The headings are paired by day number, which a shorter run is the way to prove.
     *
     * The test above copies runs of the same length as the source's, where pairing by number and
     * pairing by position give the same answer. A truncated copy is where they part: day 1 of the
     * copy must carry day 1's heading and the days beyond the range must bring none of theirs
     * across — an off-by-one here reads plausibly and is wrong.
     */
    it('gives a truncated copy the headings of the days it kept, and no others', async () => {
      const source = await createTrip(tenant.scope, {
        title: 'Lisbon',
        startDate: '2026-04-10',
        endDate: '2026-04-14',
      })
      for (const [index, day] of (
        await listTripDays(tenant.scope, source.id)
      ).entries()) {
        await updateDay(tenant.scope, day.id, { title: `Stop ${index + 1}` })
      }

      const targetId = await startTripCopy(tenant.scope, source.id, {
        title: 'A shorter Lisbon',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      })
      await copyTripContents(tenant.scope, source.id, targetId)

      expect(
        (await listTripDays(tenant.scope, targetId)).map((day) => day.title),
      ).toEqual(['Stop 1', 'Stop 2'])
    })

    it('pairs each copy with its source by the id it minted, not by RETURNING’s order', async () => {
      const source = await seedSource()
      const targetId = await startTripCopy(tenant.scope, source.id, {
        title: 'Lisbon again',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      })

      // SQLite defines no row order for `RETURNING`, so handing the rows back reversed is a legal
      // answer to the very same statement. Correlating by array index would silently hang every
      // tag and assignment off the wrong place; nothing would throw and no count would move.
      const real = placesRepository.insertMany.bind(placesRepository)
      const insertMany = vi
        .spyOn(placesRepository, 'insertMany')
        .mockImplementation(async (scope, values) =>
          [...(await real(scope, values))].reverse(),
        )
      await copyTripContents(tenant.scope, source.id, targetId)
      insertMany.mockRestore()

      const scheduled = await harness.db
        .select({ place: places.name, dayNumber: days.dayNumber })
        .from(dayAssignments)
        .innerJoin(places, eq(places.id, dayAssignments.placeId))
        .innerJoin(days, eq(days.id, dayAssignments.dayId))
        .where(eq(dayAssignments.tripId, targetId))

      expect([...scheduled].sort((a, b) => a.dayNumber - b.dayNumber)).toEqual([
        { place: 'Miradouro 1', dayNumber: 1 },
        { place: 'Miradouro 2', dayNumber: 2 },
        { place: 'Miradouro 3', dayNumber: 3 },
      ])
    })

    /**
     * A copy reproduces the plan and never the record, and `is_visited` is the record.
     *
     * It says the reader has already been there, so carrying it onto a trip nobody has taken makes
     * the copy tell them something untrue — the same reason `copyAssignments` leaves
     * `reservation_status` to fall back to `none`. It is also what `atlas.ts` counts per country, so
     * a carried flag inflates the visited tallies of a reader who has been nowhere new.
     */
    it('leaves a visited place unvisited in the copy, because that is the record', async () => {
      const source = await createTrip(tenant.scope, {
        title: 'Lisbon',
        startDate: '2026-04-10',
        endDate: '2026-04-11',
      })
      await createPlace(tenant.scope, {
        tripId: source.id,
        name: 'Miradouro da Graça',
        countryCode: 'PT',
        isVisited: true,
      })

      const targetId = await startTripCopy(tenant.scope, source.id, {
        title: 'Lisbon again',
      })
      await copyTripContents(tenant.scope, source.id, targetId)

      const copied = await placesRepository.findMany(tenant.scope, {
        where: eq(places.tripId, targetId),
      })
      expect(copied.map((place) => place.isVisited)).toEqual([false])
      // The source keeps its own record — the drop is the copy's, not a mutation of what was read.
      const original = await placesRepository.findMany(tenant.scope, {
        where: eq(places.tripId, source.id),
      })
      expect(original.map((place) => place.isVisited)).toEqual([true])
    })

    /* ------------------------------------------------------------- retries */

    it('rebuilds the target from clean when an attempt died part-way', async () => {
      const source = await seedSource()
      const targetId = await startTripCopy(tenant.scope, source.id, {
        title: 'Lisbon again',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      })

      // A delivery that dies after the places pass. The regression this guards is `placeIds`: an
      // attempt that resumed instead of restarting would hold ids only for the places it inserted
      // itself, and would silently drop every earlier place's tags and assignments.
      const insertMany = vi
        .spyOn(placeTagsAccess, 'insertMany')
        .mockRejectedValueOnce(new Error('D1_ERROR: network'))
      await expect(
        copyTripContents(tenant.scope, source.id, targetId),
      ).rejects.toThrow('D1_ERROR: network')
      insertMany.mockRestore()

      await copyTripContents(tenant.scope, source.id, targetId)

      expect(await inventoryOf(targetId)).toMatchObject({
        days: 3,
        places: 3,
        tags: 3,
        assignments: 3,
        notes: 3,
      })
    })

    it('refuses to copy a trip into itself', async () => {
      const trip = await seedSource()

      const error = await captureError(() =>
        copyTripContents(tenant.scope, trip.id, trip.id),
      )

      expect(error).toBeInstanceOf(RepositoryError)
      // Nothing was cleared on the way to finding out.
      expect(await inventoryOf(trip.id)).toMatchObject({ places: 3, notes: 3 })
    })

    /* ------------------------------------------------------------ the registry
     *
     * This block registers copiers into module state that has no un-register, so it stays **last**
     * in the file: the fakes write no rows, but they would show up in every later `extras`.
     */

    it('runs every registered copier in order and reports what each did', async () => {
      const ran: Array<string> = []
      registerTripCopier('budget', async (_scope, _source, _target, maps) => {
        ran.push('budget')
        return { name: 'budget', rows: maps.placeIds.size }
      })
      registerTripCopier('packing', async () => {
        ran.push('packing')
        return { name: 'packing', rows: 7 }
      })
      // The same name again replaces rather than appends: a module imported twice must not double.
      registerTripCopier('packing', async () => {
        ran.push('packing')
        return { name: 'packing', rows: 9 }
      })

      const source = await seedSource()
      const targetId = await startTripCopy(tenant.scope, source.id, {
        title: 'Lisbon again',
      })
      const result = await copyTripContents(tenant.scope, source.id, targetId)

      expect(ran).toEqual(['budget', 'packing'])
      expect(result.extras).toEqual([
        { name: 'budget', rows: 3 },
        { name: 'packing', rows: 9 },
      ])
    })
  })
})
