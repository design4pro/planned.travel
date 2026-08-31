/**
 * Member isolation — the boundary ADR 0007 draws *inside* one organization.
 *
 * The sibling of `tenant-isolation.test.ts`, and the second half of one question. That file asks
 * "may this scope see this row?" across two organizations; this one asks it between two members of
 * the same organization, where the tenant filter passes and something else has to refuse. A
 * repository function is done when both files say yes only where they should.
 *
 * The third user here — `alpha-2` — is a full member of the workspace and a member of none of its
 * trips. Everything asserted below is asserted from their scope.
 *
 * Every later stage that adds a trip-scoped reader appends a case here, under the same append-only
 * rule the tenant file follows.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { NotFoundError, RepositoryError } from '../context'
import { createDayNote, listDayNotes, listTripDays } from '../days'
import { createAssignment, reorderDayTimeline } from '../itinerary'
import { createPlace } from '../places'
import {
  addTripMember,
  archiveTrip,
  canReadTrip,
  countTripsByStatus,
  createTrip,
  deleteTrip,
  getTrip,
  getTripBySlug,
  listTrips,
  listTripsForUser,
  listUpcomingTrips,
  requireTrip,
  restoreTrip,
  updateTrip,
} from '../trips'
import {
  countFavourites,
  listFavouriteTripIds,
  setFavourite,
} from '../trip-favourites'
import { captureError, createHarness, subscribeTenant } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { TenantScope } from '../base'

/** What the owner built and the non-member is measured against. */
interface Fixture {
  readonly tripId: string
  readonly slug: string
  readonly dayId: string
  readonly placeId: string
  readonly assignmentId: string
  readonly noteId: string
}

describe('member isolation', () => {
  let harness: Harness
  let alpha: SeededTenant
  /** In the organization, on none of its trips. */
  let strangerId: string
  let stranger: TenantScope
  let fixture: Fixture

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
    await subscribeTenant(alpha.scope, 'crew')
    strangerId = await alpha.addUser('Alpha the second')
    stranger = alpha.scopeFor(strangerId)

    const trip = await createTrip(alpha.scope, {
      title: 'Lisbon in spring',
      slug: 'lisbon-in-spring',
      destination: 'Lisbon, Portugal',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })
    const days = await listTripDays(alpha.scope, trip.id)
    const firstDay = days.at(0)
    if (firstDay === undefined) {
      throw new Error('A dated trip must have a day run.')
    }
    const place = await createPlace(alpha.scope, {
      tripId: trip.id,
      name: 'Miradouro da Senhora do Monte',
    })
    const note = await createDayNote(alpha.scope, {
      tripId: trip.id,
      dayId: firstDay.id,
      body: 'Buy the transit pass at the airport.',
    })
    const assignment = await createAssignment(alpha.scope, {
      tripId: trip.id,
      dayId: firstDay.id,
      placeId: place.id,
    })

    fixture = {
      tripId: trip.id,
      slug: trip.slug,
      dayId: firstDay.id,
      placeId: place.id,
      assignmentId: assignment.id,
      noteId: note.id,
    }
  })

  describe('a private trip', () => {
    it('is not found by any reader that addresses it directly', async () => {
      expect(await canReadTrip(stranger, fixture.tripId)).toBe(false)
      expect(await getTrip(stranger, fixture.tripId)).toBeNull()
      expect(await getTripBySlug(stranger, fixture.slug)).toBeNull()
      expect(
        await captureError(() => requireTrip(stranger, fixture.tripId)),
      ).toBeInstanceOf(NotFoundError)
    })

    it('appears in no list, count or aggregate the non-member can reach', async () => {
      expect(await listTrips(stranger)).toEqual([])
      expect(await listTripsForUser(stranger, strangerId)).toEqual([])
      expect(
        await listUpcomingTrips(stranger, { today: '2026-01-01' }),
      ).toEqual([])

      const counts = await countTripsByStatus(stranger)
      expect(counts.total).toBe(0)
      expect(counts.archived).toBe(0)
      expect(await countFavourites(stranger)).toBe(0)
      expect(await listFavouriteTripIds(stranger)).toEqual([])
      expect(
        Object.values(counts.byStatus).filter((value) => value > 0),
      ).toEqual([])
    })

    it('refuses every write with NOT_FOUND rather than FORBIDDEN', async () => {
      // The distinction is the whole point: `FORBIDDEN` would confirm the trip exists, which is the
      // one thing a non-member must not learn.
      for (const attempt of [
        () => updateTrip(stranger, fixture.tripId, { title: 'Hijacked' }),
        () => archiveTrip(stranger, fixture.tripId),
        () => restoreTrip(stranger, fixture.tripId),
        () => deleteTrip(stranger, fixture.tripId),
      ]) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }

      // And nothing moved.
      const trip = await requireTrip(alpha.scope, fixture.tripId)
      expect(trip.title).toBe('Lisbon in spring')
      expect(trip.isArchived).toBe(false)
    })

    it('refuses to be starred by a reader who cannot see it', async () => {
      // A bookmark is the mildest write in the product and still a write: it names a trip id. A
      // non-member who could star this one would learn it exists, which is the single thing
      // decision 1 exists to withhold.
      expect(
        await captureError(() => setFavourite(stranger, fixture.tripId, true)),
      ).toBeInstanceOf(NotFoundError)
      expect(await listFavouriteTripIds(stranger)).toEqual([])
      expect(await countFavourites(stranger)).toBe(0)
    })

    it('refuses to reorder a day of a trip it cannot see', async () => {
      // `reorderDayTimeline` names a trip id and a day id, so it answers the same way
      // every other trip-scoped writer does: not found, and nothing about the day.
      expect(
        await captureError(() =>
          reorderDayTimeline(stranger, {
            tripId: fixture.tripId,
            dayId: fixture.dayId,
            items: [{ kind: 'note', id: fixture.noteId }],
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
    })

    it('refuses a child write parented onto it', async () => {
      expect(
        await captureError(() =>
          createPlace(stranger, {
            tripId: fixture.tripId,
            name: 'A place on a trip that is not mine',
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      /**
       * `createDayNote` is deliberately absent from this list. It resolves neither the trip nor the
       * day before it inserts (`src/server/repos/days.ts`), so it accepts a `tripId` the caller may
       * not read — the defect PRD #104 decision 10 assigns to `01-S2` as "the two tenant guards it
       * lacks today". Asserting the leak here would freeze it; asserting the fix here would fail on
       * code this slice does not own. Recorded rather than silently omitted, and this case gains its
       * `createDayNote` line the day `01-S2` lands.
       */
    })
  })

  describe('once the trip is made visible to the organization', () => {
    beforeEach(async () => {
      await updateTrip(alpha.scope, fixture.tripId, {
        visibility: 'organization',
      })
    })

    it('the same reads now succeed', async () => {
      expect(await canReadTrip(stranger, fixture.tripId)).toBe(true)
      expect((await requireTrip(stranger, fixture.tripId)).id).toBe(
        fixture.tripId,
      )
      expect((await listTrips(stranger)).map((row) => row.id)).toEqual([
        fixture.tripId,
      ])
      expect((await countTripsByStatus(stranger)).total).toBe(1)
    })

    it('and any reader may star it, privately to themselves', async () => {
      await setFavourite(stranger, fixture.tripId, true)

      expect(await listFavouriteTripIds(stranger)).toEqual([fixture.tripId])
      expect(await countFavourites(stranger)).toBe(1)
      // The owner's own shortlist is untouched: the star is one person's, and the trip row carries
      // no trace of somebody else having made it.
      expect(await listFavouriteTripIds(alpha.scope)).toEqual([])
      expect(await countFavourites(alpha.scope)).toBe(0)
      expect(await listTrips(alpha.scope, { favourite: true })).toEqual([])
    })

    it('and the day timeline is FORBIDDEN, because reading is not editing', async () => {
      const error = await captureError(() =>
        reorderDayTimeline(stranger, {
          tripId: fixture.tripId,
          dayId: fixture.dayId,
          items: [{ kind: 'note', id: fixture.noteId }],
        }),
      )
      expect(error).toBeInstanceOf(RepositoryError)
      expect(error).not.toBeInstanceOf(NotFoundError)
      expect((error as RepositoryError).code).toBe('FORBIDDEN')
    })

    it('but the writes are FORBIDDEN, because the reader is not its owner', async () => {
      for (const attempt of [
        () => updateTrip(stranger, fixture.tripId, { title: 'Hijacked' }),
        () => archiveTrip(stranger, fixture.tripId),
        () => deleteTrip(stranger, fixture.tripId),
      ]) {
        const error = await captureError(attempt)
        expect(error).toBeInstanceOf(RepositoryError)
        expect(error).not.toBeInstanceOf(NotFoundError)
        expect((error as RepositoryError).code).toBe('FORBIDDEN')
      }

      expect((await requireTrip(alpha.scope, fixture.tripId)).title).toBe(
        'Lisbon in spring',
      )
    })
  })

  describe('once the stranger is added as a viewer', () => {
    beforeEach(async () => {
      await addTripMember(alpha.scope, {
        tripId: fixture.tripId,
        userId: strangerId,
        role: 'viewer',
      })
    })

    it('reads the private trip again', async () => {
      expect(await canReadTrip(stranger, fixture.tripId)).toBe(true)
      expect((await requireTrip(stranger, fixture.tripId)).id).toBe(
        fixture.tripId,
      )
      expect((await listTrips(stranger)).map((row) => row.id)).toEqual([
        fixture.tripId,
      ])
      expect((await listTripsForUser(stranger, strangerId)).length).toBe(1)
    })

    it('and still may not change it', async () => {
      const error = await captureError(() =>
        updateTrip(stranger, fixture.tripId, { title: 'Hijacked' }),
      )
      expect((error as RepositoryError).code).toBe('FORBIDDEN')
    })

    it('and may not reorder its day, which is the editor’s verb (decision 6)', async () => {
      const before = (await listDayNotes(alpha.scope, fixture.dayId)).map(
        (row) => row.sortOrder,
      )

      const error = await captureError(() =>
        reorderDayTimeline(stranger, {
          tripId: fixture.tripId,
          dayId: fixture.dayId,
          items: [
            { kind: 'note', id: fixture.noteId },
            { kind: 'stop', id: fixture.assignmentId },
          ],
        }),
      )
      expect(error).toBeInstanceOf(RepositoryError)
      expect(error).not.toBeInstanceOf(NotFoundError)
      expect((error as RepositoryError).code).toBe('FORBIDDEN')

      expect(
        (await listDayNotes(alpha.scope, fixture.dayId)).map(
          (row) => row.sortOrder,
        ),
      ).toEqual(before)
    })
  })
})
