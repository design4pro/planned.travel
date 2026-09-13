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
import {
  createJourney,
  journalCoverage,
  listTripsWithoutJourney,
} from '../journey'
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
  listTripMembers,
  listTripParticipants,
  listTrips,
  listTripsForUser,
  listUpcomingTrips,
  removeTripMember,
  requireTrip,
  restoreTrip,
  startTripCopy,
  TripRoleError,
  updateTrip,
  updateTripMember,
} from '../trips'
import {
  countFavourites,
  listFavouriteTripIds,
  setFavourite,
} from '../trip-favourites'
import { listTripDayTransports, reorderDayTransports } from '../transports'
import {
  captureError,
  createHarness,
  memberUserIds,
  subscribeTenant,
} from './harness'
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

    it('is neither offered to write up nor counted in journal coverage (#196)', async () => {
      // The journal's own two trip readers, which reached `trips` without the read predicate until
      // #196. "Waiting for a story" prints titles, so the leak was a private trip's name; the
      // coverage denominator leaks the same trip as a number, which is no better for being smaller.
      expect(
        await listTripsWithoutJourney(stranger, { today: '2026-04-01' }),
      ).toEqual([])
      expect(await journalCoverage(stranger)).toEqual({ trips: 0, written: 0 })

      // And the owner still sees their own backlog — the predicate narrowed the reader, not the read.
      expect(
        (
          await listTripsWithoutJourney(alpha.scope, { today: '2026-04-01' })
        ).map((row) => row.id),
      ).toEqual([fixture.tripId])
      expect((await journalCoverage(alpha.scope)).trips).toBe(1)

      // A trip of the stranger's own, so the predicate is asked to tell two rows apart rather than
      // to refuse the whole table. A membership `EXISTS` correlated on the wrong row — or on none,
      // asking only "does this person hold any membership at all" — satisfies every assertion above
      // and fails here.
      const own = await createTrip(stranger, {
        title: 'Porto on my own',
        slug: 'porto-on-my-own',
        startDate: '2026-05-01',
        endDate: '2026-05-04',
      })
      expect(
        (await listTripsWithoutJourney(stranger, { today: '2026-04-01' })).map(
          (row) => row.id,
        ),
      ).toEqual([own.id])
      expect(await journalCoverage(stranger)).toEqual({ trips: 1, written: 0 })

      // Writing the private trip up moves the owner's two numbers and neither of the stranger's.
      // Coverage reaches trips through `journeys`, which makes its numerator a trip count as much
      // as its denominator is one: counted workspace-wide it would report a trip the stranger
      // cannot open, and report it as written up out of a backlog that never mentions it.
      await createJourney(alpha.scope, {
        tripId: fixture.tripId,
        title: 'Lisbon, written up',
      })
      expect(await journalCoverage(stranger)).toEqual({ trips: 1, written: 0 })
      expect(
        (await listTripsWithoutJourney(stranger, { today: '2026-04-01' })).map(
          (row) => row.id,
        ),
      ).toEqual([own.id])

      // The owner's own reading of the same two facts: the trip leaves the backlog it was in —
      // the `notInArray` half of the list, composed with the read predicate — and enters coverage.
      expect(
        await listTripsWithoutJourney(alpha.scope, { today: '2026-04-01' }),
      ).toEqual([])
      expect(await journalCoverage(alpha.scope)).toEqual({
        trips: 1,
        written: 1,
      })
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

    it('refuses to be copied by a reader who cannot see it', async () => {
      // The copy is open to every *reader* (PRD #104 decision 6), and this is what makes that a
      // boundary rather than a hole: `requireTrip` is the whole check, so somebody who cannot read
      // the trip cannot copy it either — and is told the same thing they are told about a trip in
      // another workspace.
      expect(
        await captureError(() =>
          startTripCopy(stranger, fixture.tripId, { title: 'Mine now' }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(await listTrips(stranger)).toEqual([])
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

    it('refuses to list or reorder its day journeys (03-S5)', async () => {
      // A private trip's journeys are endpoints, times, service numbers and fares, so the read
      // resolves the trip before it reads a row — the guard is in the repository function rather
      // than in the planner's loader, where a later caller could forget it.
      expect(
        await captureError(() =>
          listTripDayTransports(stranger, fixture.tripId),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          reorderDayTransports(stranger, {
            tripId: fixture.tripId,
            dayId: fixture.dayId,
            items: [{ kind: 'note', id: fixture.noteId }],
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
    })

    it('refuses the same reorder when the trip is handed in already resolved', async () => {
      // `reorderDayTransports` takes an optional third argument — the trip its caller has already
      // resolved — so that the planner's handler, which resolves it to refuse an archived trip,
      // does not pay for the row twice. A `Trip` is a row and not a proof, so this asserts what
      // happens when the proof is false: the row read in the owner's scope, handed in by somebody
      // who may not see the trip at all.
      const asTheOwnerSeesIt = await requireTrip(alpha.scope, fixture.tripId)

      // Still refused. The visibility guard is skipped, so the refusal comes from the role
      // assertion behind it and says `FORBIDDEN` rather than `NotFoundError` — the one thing this
      // argument costs, and the reason it is for a caller that has run `requireTrip` and no other.
      expect(
        await captureError(() =>
          reorderDayTransports(
            stranger,
            {
              tripId: fixture.tripId,
              dayId: fixture.dayId,
              items: [{ kind: 'note', id: fixture.noteId }],
            },
            asTheOwnerSeesIt,
          ),
        ),
      ).toBeInstanceOf(TripRoleError)

      // A trip of another workspace is refused by the tenant filter whatever is handed in.
      expect(await listTrips(stranger)).toEqual([])
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

    it('refuses its people, and its visibility, to a non-member (01-S6a)', async () => {
      // The people read is the same refusal as every other trip-scoped read, and for the same
      // reason it has to resolve the trip first: an empty participant list would tell the reader
      // the trip exists and nobody is on it.
      expect(
        await captureError(() =>
          listTripParticipants(stranger, fixture.tripId),
        ),
      ).toBeInstanceOf(NotFoundError)

      // The visibility switch writes through `updateTrip`, so it answers the same way.
      expect(
        await captureError(() =>
          updateTrip(stranger, fixture.tripId, { visibility: 'organization' }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect((await requireTrip(alpha.scope, fixture.tripId)).visibility).toBe(
        'private',
      )
    })

    it('refuses every membership write on it to a non-member (01-S6a)', async () => {
      const ownerMembership = (
        await listTripMembers(alpha.scope, fixture.tripId)
      ).at(0)
      if (ownerMembership === undefined) {
        throw new Error('A trip must have its creator’s membership.')
      }

      // `addTripMember` names the trip id, so the trip is what gets resolved. The other two name a
      // membership row id, which is tenant-visible but belongs to a trip this reader cannot see —
      // the resolution order is what turns that into the same `NotFoundError` and not a
      // `FORBIDDEN` that would confirm the trip is there.
      for (const attempt of [
        () =>
          addTripMember(stranger, {
            tripId: fixture.tripId,
            userId: strangerId,
            role: 'owner',
          }),
        () =>
          updateTripMember(stranger, ownerMembership.id, { role: 'viewer' }),
        () => removeTripMember(stranger, ownerMembership.id),
      ]) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }

      expect(
        (await listTripMembers(alpha.scope, fixture.tripId)).map(
          (row) => row.userId,
        ),
      ).toEqual([alpha.ownerUserId])
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

    it('and the journal offers it to write up, and counts it (#196)', async () => {
      expect(
        (await listTripsWithoutJourney(stranger, { today: '2026-04-01' })).map(
          (row) => row.id,
        ),
      ).toEqual([fixture.tripId])
      expect((await journalCoverage(stranger)).trips).toBe(1)
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

    it('and any reader may copy it, into a trip of their own', async () => {
      const copyId = await startTripCopy(stranger, fixture.tripId, {
        title: 'Lisbon, my way',
      })

      // Theirs, not a second view of the owner's: they own the copy, it is private again, and it is
      // still being built.
      const copy = await requireTrip(stranger, copyId)
      expect(copy.visibility).toBe('private')
      expect(copy.copyPendingAt).not.toBeNull()
      expect(copy.createdBy).toBe(strangerId)
      // And the owner's own trip is untouched by somebody else having copied it.
      expect((await listTrips(alpha.scope)).map((row) => row.id)).toEqual([
        fixture.tripId,
      ])
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

    it('and its people are readable, without enabling one write (01-S6a)', async () => {
      // The half of ADR 0007 that is easy to get wrong in the other direction: organization
      // visibility is a *read* grant. The participant list opens; nothing else does.
      expect(
        memberUserIds(
          await listTripParticipants(stranger, fixture.tripId),
        ),
      ).toEqual([alpha.ownerUserId])

      const visibilityRefusal = await captureError(() =>
        updateTrip(stranger, fixture.tripId, { visibility: 'private' }),
      )
      expect((visibilityRefusal as RepositoryError).code).toBe('FORBIDDEN')

      const inviteRefusal = await captureError(() =>
        addTripMember(stranger, {
          tripId: fixture.tripId,
          userId: strangerId,
          role: 'owner',
        }),
      )
      expect((inviteRefusal as RepositoryError).code).toBe('FORBIDDEN')

      expect((await requireTrip(alpha.scope, fixture.tripId)).visibility).toBe(
        'organization',
      )
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

  /** `01-S6a` — the editor is the role the people screen has to refuse, not merely not offer. */
  describe('once the stranger is added as an editor', () => {
    beforeEach(async () => {
      await addTripMember(alpha.scope, {
        tripId: fixture.tripId,
        userId: strangerId,
        role: 'editor',
      })
    })

    it('reads the trip’s people, because a collaborator may see who they collaborate with', async () => {
      expect(
        memberUserIds(
          await listTripParticipants(stranger, fixture.tripId),
        ),
      ).toEqual([alpha.ownerUserId, strangerId])
    })

    it('is refused the visibility switch and every membership write with FORBIDDEN', async () => {
      const ownerMembership = (
        await listTripMembers(alpha.scope, fixture.tripId)
      ).find((row) => row.userId === alpha.ownerUserId)
      if (ownerMembership === undefined) {
        throw new Error('A trip must have its creator’s membership.')
      }
      const invitedId = await alpha.addUser('Somebody the editor invited')

      for (const attempt of [
        () =>
          updateTrip(stranger, fixture.tripId, { visibility: 'organization' }),
        () =>
          addTripMember(stranger, {
            tripId: fixture.tripId,
            userId: invitedId,
            role: 'viewer',
          }),
        () =>
          updateTripMember(stranger, ownerMembership.id, { role: 'viewer' }),
        () => removeTripMember(stranger, ownerMembership.id),
      ]) {
        const error = await captureError(attempt)
        expect(error).toBeInstanceOf(RepositoryError)
        expect(error).not.toBeInstanceOf(NotFoundError)
        expect((error as RepositoryError).code).toBe('FORBIDDEN')
      }

      const trip = await requireTrip(alpha.scope, fixture.tripId)
      expect(trip.visibility).toBe('private')
      expect(
        (await listTripMembers(alpha.scope, fixture.tripId)).map(
          (row) => row.userId,
        ),
      ).toEqual([alpha.ownerUserId, strangerId])
    })

    it('may still take themselves off the trip, which is not an administrative act', async () => {
      const own = (await listTripMembers(alpha.scope, fixture.tripId)).find(
        (row) => row.userId === strangerId,
      )
      if (own === undefined) {
        throw new Error('The editor must have a membership row.')
      }

      await removeTripMember(stranger, own.id)

      expect(
        (await listTripMembers(alpha.scope, fixture.tripId)).map(
          (row) => row.userId,
        ),
      ).toEqual([alpha.ownerUserId])
      // And the private trip closes behind them.
      expect(await canReadTrip(stranger, fixture.tripId)).toBe(false)
    })
  })
})
