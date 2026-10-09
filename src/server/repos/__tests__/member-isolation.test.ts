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
import { createAssignment, reorderDayTimelines } from '../itinerary'
import {
  addPhoto,
  attachPhotoToEntry,
  countEntriesByMood,
  createEntry,
  createJourney,
  createMood,
  deleteEntry,
  deleteJourney,
  deletePhoto,
  getJourney,
  getJourneyBySlug,
  getJourneyStory,
  journalCoverage,
  listEntriesByIds,
  listJourneyEntries,
  listJourneys,
  listJourneysWithCounts,
  listRecentEntries,
  listTripsWithoutJourney,
  listUnattachedPhotos,
  publishJourney,
  tallyMoods,
  unpublishJourney,
  updateEntry,
  updateJourney,
} from '../journey'
import {
  createBudgetItem,
  createExpense,
  createSettlement,
  deleteBudgetItem,
  deleteExpense,
  deleteSettlement,
  expenseSharesRepository,
  getExpenseWithShares,
  getMemberBalances,
  listBudgetItems,
  listSettlements,
  listTripExpenses,
  markShareSettled,
  setExpenseShares,
  updateBudgetItem,
  updateExpense,
} from '../expenses'
import { createPlace } from '../places'
import {
  createReservation,
  getReservation,
  linkReservationExpense,
} from '../reservations'
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
  listTrips,
  listTripsForUser,
  listUpcomingTrips,
  removeTripMember,
  requireTrip,
  restoreTrip,
  startTripCopy,
  TripRoleError,
  tripMemberUserIds,
  updateTrip,
  updateTripMember,
} from '../trips'
import {
  countTripPeople,
  createTripGuest,
  listTripGuests,
  listTripParticipants,
  mergeTripGuest,
  removeTripGuest,
  renameTripGuest,
} from '../trip-guests'
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

    /** `01-S7` — the companion figure, and both of the arrays the trips loader reads. */
    it('gets no people count and is in neither the active nor the archived list', async () => {
      await createTripGuest(alpha.scope, {
        tripId: fixture.tripId,
        displayName: 'Anna',
      })
      expect(
        (await countTripPeople(alpha.scope, [fixture.tripId])).get(
          fixture.tripId,
        ),
      ).toBe(2)
      expect(await countTripPeople(stranger, [fixture.tripId])).toEqual(
        new Map(),
      )

      expect(await listTrips(stranger, { archived: false })).toEqual([])
      await archiveTrip(alpha.scope, fixture.tripId)
      expect(await listTrips(stranger, { archived: true })).toEqual([])
      expect(
        (await listTrips(alpha.scope, { archived: true })).map((row) => row.id),
      ).toEqual([fixture.tripId])
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

    it('keeps the journey written about it out of every journal reader (#456)', async () => {
      // ADR 0020: a journey is read by whoever may read the trip it names. The story is reachable
      // by id, from the index and from the recent strip without the trip ever being read, so each
      // of those readers has to ask the trip itself.
      const mood = await createMood(alpha.scope, {
        key: 'quiet',
        label: 'Quiet',
        emoji: '🌿',
      })
      const journey = await createJourney(alpha.scope, {
        tripId: fixture.tripId,
        title: 'Lisbon, written up',
      })
      await createEntry(alpha.scope, {
        journeyId: journey.id,
        entryDate: '2026-04-10',
        title: 'Custard tarts, twice',
        moodId: mood.id,
      })

      expect(await listJourneys(stranger)).toEqual([])
      expect(await listJourneysWithCounts(stranger)).toEqual([])
      expect(await getJourney(stranger, journey.id)).toBeNull()
      expect(await getJourneyBySlug(stranger, journey.slug)).toBeNull()
      expect(
        await captureError(() => getJourneyStory(stranger, journey.id)),
      ).toBeInstanceOf(NotFoundError)
      expect(await listRecentEntries(stranger)).toEqual([])
      expect(await tallyMoods(stranger)).toEqual([])

      // A journey tied to no trip has nothing to inherit and stays the workspace's, so the
      // predicate narrowed the journal rather than emptying it.
      const untied = await createJourney(alpha.scope, {
        title: 'A weekend walk',
      })
      await createEntry(alpha.scope, {
        journeyId: untied.id,
        entryDate: '2026-03-01',
        title: 'Rain on the ridge',
        moodId: mood.id,
      })
      expect((await listJourneys(stranger)).map((row) => row.id)).toEqual([
        untied.id,
      ])
      expect((await getJourneyStory(stranger, untied.id)).entries).toHaveLength(
        1,
      )
      expect(
        (await listRecentEntries(stranger)).map((row) => row.journeyId),
      ).toEqual([untied.id])
      expect(
        (await tallyMoods(stranger)).map((row) => [row.mood.key, row.value]),
      ).toEqual([['quiet', 1]])

      // A journey on the stranger's own private trip, so the `EXISTS` is asked to tell two linked
      // journeys apart: correlated on the wrong trip, or on none, it passes everything above and
      // fails here — and the owner, on none of the stranger's trips, loses that one in turn.
      const own = await createTrip(stranger, {
        title: 'Porto on my own',
        slug: 'porto-on-my-own',
        startDate: '2026-05-01',
        endDate: '2026-05-04',
      })
      const ownJourney = await createJourney(stranger, {
        tripId: own.id,
        title: 'Porto, written up',
      })
      expect(
        (await listJourneys(stranger)).map((row) => row.id).sort(),
      ).toEqual([untied.id, ownJourney.id].sort())
      expect(
        (await listJourneys(alpha.scope)).map((row) => row.id).sort(),
      ).toEqual([journey.id, untied.id].sort())
      expect(
        (await getJourneyStory(alpha.scope, journey.id)).entries,
      ).toHaveLength(1)
      expect((await getJourneyBySlug(alpha.scope, journey.slug))?.id).toBe(
        journey.id,
      )
      expect(
        (await tallyMoods(alpha.scope)).map((row) => [row.mood.key, row.value]),
      ).toEqual([['quiet', 2]])
    })

    it('refuses every journal write and id-keyed helper on the journey written about it (#521)', async () => {
      // The #456 readers ask the trip; these reach a journey, an entry or a photo by id, so each of
      // them has to ask too, or the id alone is enough to rewrite a story the caller cannot open.
      const mood = await createMood(alpha.scope, {
        key: 'quiet',
        label: 'Quiet',
        emoji: '🌿',
      })
      const journey = await createJourney(alpha.scope, {
        tripId: fixture.tripId,
        title: 'Lisbon, written up',
      })
      const entry = await createEntry(alpha.scope, {
        journeyId: journey.id,
        entryDate: '2026-04-10',
        title: 'Custard tarts, twice',
        moodId: mood.id,
      })
      const photo = await addPhoto(alpha.scope, {
        journeyId: journey.id,
        storageKey: 'journeys/lisbon/tram.jpg',
        contentType: 'image/jpeg',
      })

      for (const attempt of [
        () => updateJourney(stranger, journey.id, { title: 'Hijacked' }),
        () =>
          publishJourney(stranger, journey.id, 'a-token-long-enough-to-pass'),
        () => unpublishJourney(stranger, journey.id),
        () => deleteJourney(stranger, journey.id),
        () =>
          createEntry(stranger, {
            journeyId: journey.id,
            entryDate: '2026-04-11',
            title: 'Planted',
          }),
        () => updateEntry(stranger, entry.id, { title: 'Hijacked' }),
        () => deleteEntry(stranger, entry.id),
        () =>
          addPhoto(stranger, {
            journeyId: journey.id,
            storageKey: 'journeys/lisbon/planted.jpg',
            contentType: 'image/jpeg',
          }),
        () => attachPhotoToEntry(stranger, photo.id, entry.id),
        () => deletePhoto(stranger, photo.id),
      ]) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }

      expect(await listJourneyEntries(stranger, journey.id)).toEqual([])
      expect(await listUnattachedPhotos(stranger, journey.id)).toEqual([])
      expect(await countEntriesByMood(stranger, journey.id)).toEqual([])

      // A journey tied to no trip stays the workspace's, and asking for both entries in one call
      // makes the predicate tell two rows apart rather than refuse the whole table.
      const untied = await createJourney(alpha.scope, {
        title: 'A weekend walk',
      })
      const untiedEntry = await createEntry(stranger, {
        journeyId: untied.id,
        entryDate: '2026-03-01',
        title: 'Rain on the ridge',
      })
      expect(
        (await listEntriesByIds(stranger, [entry.id, untiedEntry.id])).map(
          (row) => row.id,
        ),
      ).toEqual([untiedEntry.id])

      // And nothing moved: the owner reads the story exactly as they wrote it.
      const story = await getJourneyStory(alpha.scope, journey.id)
      expect(story.journey.title).toBe('Lisbon, written up')
      expect(story.journey.status).toBe('draft')
      expect(story.entries.map((row) => row.entry.title)).toEqual([
        'Custard tarts, twice',
      ])
      expect(
        (await listUnattachedPhotos(alpha.scope, journey.id)).map(
          (row) => row.id,
        ),
      ).toEqual([photo.id])
      expect(await countEntriesByMood(alpha.scope, journey.id)).toEqual([
        { moodId: mood.id, value: 1 },
      ])
      expect(
        (await listEntriesByIds(alpha.scope, [entry.id])).map((row) => row.id),
      ).toEqual([entry.id])
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
      // `reorderDayTimelines` names a trip id and day ids, so it answers the same way
      // every other trip-scoped writer does: not found, and nothing about the day.
      expect(
        await captureError(() =>
          reorderDayTimelines(stranger, {
            tripId: fixture.tripId,
            days: [
              {
                dayId: fixture.dayId,
                items: [{ kind: 'note', id: fixture.noteId }],
              },
            ],
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

    it('and the journey written about it is read with it (#456)', async () => {
      const mood = await createMood(alpha.scope, {
        key: 'bright',
        label: 'Bright',
        emoji: '☀️',
      })
      const journey = await createJourney(alpha.scope, {
        tripId: fixture.tripId,
        title: 'Lisbon, written up',
      })
      const entry = await createEntry(alpha.scope, {
        journeyId: journey.id,
        entryDate: '2026-04-10',
        title: 'Custard tarts, twice',
        moodId: mood.id,
      })

      expect((await listJourneys(stranger)).map((row) => row.id)).toEqual([
        journey.id,
      ])
      expect((await getJourney(stranger, journey.id))?.id).toBe(journey.id)
      // The id-keyed helpers (#521) open with the trip too.
      expect(
        (await listJourneyEntries(stranger, journey.id)).map((row) => row.id),
      ).toEqual([entry.id])
      expect(
        (await listEntriesByIds(stranger, [entry.id])).map((row) => row.id),
      ).toEqual([entry.id])
      expect(await countEntriesByMood(stranger, journey.id)).toEqual([
        { moodId: mood.id, value: 1 },
      ])
      expect((await getJourneyBySlug(stranger, journey.slug))?.id).toBe(
        journey.id,
      )
      expect(
        (await getJourneyStory(stranger, journey.id)).entries,
      ).toHaveLength(1)
      expect(
        (await listRecentEntries(stranger)).map((row) => row.journeyId),
      ).toEqual([journey.id])
      expect(
        (await tallyMoods(stranger)).map((row) => [row.mood.key, row.value]),
      ).toEqual([['bright', 1]])
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
        reorderDayTimelines(stranger, {
          tripId: fixture.tripId,
          days: [
            {
              dayId: fixture.dayId,
              items: [{ kind: 'note', id: fixture.noteId }],
            },
          ],
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
        memberUserIds(await listTripParticipants(stranger, fixture.tripId)),
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
        reorderDayTimelines(stranger, {
          tripId: fixture.tripId,
          days: [
            {
              dayId: fixture.dayId,
              items: [
                { kind: 'note', id: fixture.noteId },
                { kind: 'stop', id: fixture.assignmentId },
              ],
            },
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
        memberUserIds(await listTripParticipants(stranger, fixture.tripId)),
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

    /** `01-S6b` — every guest write is the owner's, and an editor is refused each one. */
    it('is refused every guest write with FORBIDDEN, and the guests stay as they were', async () => {
      const guest = await createTripGuest(alpha.scope, {
        tripId: fixture.tripId,
        displayName: 'Anna',
      })

      for (const attempt of [
        () =>
          createTripGuest(stranger, {
            tripId: fixture.tripId,
            displayName: 'Marek',
          }),
        () => renameTripGuest(stranger, guest.id, 'Hanna'),
        () => removeTripGuest(stranger, guest.id),
        () => mergeTripGuest(stranger, fixture.tripId, guest.id, strangerId),
      ]) {
        const error = await captureError(attempt)
        expect(error).toBeInstanceOf(RepositoryError)
        expect(error).not.toBeInstanceOf(NotFoundError)
        expect((error as RepositoryError).code).toBe('FORBIDDEN')
      }

      expect(await listTripGuests(alpha.scope, fixture.tripId)).toEqual([guest])
    })
  })

  describe('once the trip a journey was written about is deleted (#520)', () => {
    /** On none of the workspace's trips, and so a stranger before and after the deletion. */
    let outsiderId: string
    let outsider: TenantScope
    let moodId: string
    let journeyId: string
    let journeySlug: string
    let entryId: string
    let photoId: string

    beforeEach(async () => {
      outsiderId = await alpha.addUser('Alpha the third')
      outsider = alpha.scopeFor(outsiderId)
      await addTripMember(alpha.scope, {
        tripId: fixture.tripId,
        userId: strangerId,
        role: 'editor',
      })

      moodId = (
        await createMood(alpha.scope, {
          key: 'quiet',
          label: 'Quiet',
          emoji: '🌿',
        })
      ).id
      const journey = await createJourney(alpha.scope, {
        tripId: fixture.tripId,
        title: 'Lisbon, written up',
      })
      journeyId = journey.id
      journeySlug = journey.slug
      entryId = (
        await createEntry(alpha.scope, {
          journeyId,
          entryDate: '2026-04-10',
          title: 'Custard tarts, twice',
          moodId,
        })
      ).id
      photoId = (
        await addPhoto(alpha.scope, {
          journeyId,
          storageKey: 'journeys/lisbon/tram.jpg',
          contentType: 'image/jpeg',
        })
      ).id
      // A co-traveller's entry in the owner's journey: it goes with the journey, not with its author.
      await createEntry(stranger, {
        journeyId,
        entryDate: '2026-04-11',
        title: 'The funicular',
      })

      await deleteTrip(alpha.scope, fixture.tripId)
    })

    it.each([
      ['a former member of the trip who did not write it', () => stranger],
      ['a stranger to the workspace’s trips', () => outsider],
    ])('is out of every reader and writer for %s', async (_who, pick) => {
      const reader = pick()

      expect(await listJourneys(reader)).toEqual([])
      expect(await listJourneysWithCounts(reader)).toEqual([])
      expect(await getJourney(reader, journeyId)).toBeNull()
      expect(await getJourneyBySlug(reader, journeySlug)).toBeNull()
      expect(
        await captureError(() => getJourneyStory(reader, journeyId)),
      ).toBeInstanceOf(NotFoundError)
      expect(await listRecentEntries(reader)).toEqual([])
      expect(await tallyMoods(reader)).toEqual([])
      expect(await countEntriesByMood(reader, journeyId)).toEqual([])
      expect(await listEntriesByIds(reader, [entryId])).toEqual([])
      expect(await listJourneyEntries(reader, journeyId)).toEqual([])
      expect(await listUnattachedPhotos(reader, journeyId)).toEqual([])

      for (const attempt of [
        () => updateJourney(reader, journeyId, { title: 'Hijacked' }),
        () => deleteJourney(reader, journeyId),
        () =>
          createEntry(reader, {
            journeyId,
            entryDate: '2026-04-12',
            title: 'Planted',
          }),
        () => updateEntry(reader, entryId, { title: 'Hijacked' }),
        () =>
          addPhoto(reader, {
            journeyId,
            storageKey: 'journeys/lisbon/planted.jpg',
            contentType: 'image/jpeg',
          }),
        () => deletePhoto(reader, photoId),
      ]) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }
    })

    it('stays readable in full by the person who wrote it', async () => {
      expect((await listJourneys(alpha.scope)).map((row) => row.id)).toEqual([
        journeyId,
      ])
      expect(
        (await listJourneysWithCounts(alpha.scope)).map((row) => row.id),
      ).toEqual([journeyId])
      expect((await getJourney(alpha.scope, journeyId))?.tripId).toBeNull()
      expect((await getJourneyBySlug(alpha.scope, journeySlug))?.id).toBe(
        journeyId,
      )
      const story = await getJourneyStory(alpha.scope, journeyId)
      expect(story.entries.map((row) => row.entry.title)).toEqual([
        'Custard tarts, twice',
        'The funicular',
      ])
      expect(
        (await listRecentEntries(alpha.scope)).map((row) => row.journeyId),
      ).toEqual([journeyId, journeyId])
      expect(
        (await tallyMoods(alpha.scope)).map((row) => [row.mood.key, row.value]),
      ).toEqual([['quiet', 1]])
      expect(await countEntriesByMood(alpha.scope, journeyId)).toEqual([
        { moodId, value: 1 },
      ])
      expect(
        (await listEntriesByIds(alpha.scope, [entryId])).map((row) => row.id),
      ).toEqual([entryId])
      expect(
        (await updateJourney(alpha.scope, journeyId, { title: 'Lisbon' }))
          .title,
      ).toBe('Lisbon')
    })

    it('is not opened to the trip’s owner when somebody else wrote it', async () => {
      // The reader to refuse is whoever is *not* `owner_user_id`, whatever else they were: here it is
      // the person who owned the deleted trip, and the journey's owner is the editor they invited.
      const own = await createTrip(alpha.scope, {
        title: 'Porto together',
        slug: 'porto-together',
        startDate: '2026-05-01',
        endDate: '2026-05-04',
      })
      await addTripMember(alpha.scope, {
        tripId: own.id,
        userId: strangerId,
        role: 'editor',
      })
      const written = await createJourney(stranger, {
        tripId: own.id,
        title: 'Porto, my side',
      })
      expect((await getJourney(alpha.scope, written.id))?.id).toBe(written.id)

      await deleteTrip(alpha.scope, own.id)

      expect(await getJourney(alpha.scope, written.id)).toBeNull()
      expect(
        (await listJourneys(alpha.scope)).map((row) => row.id),
      ).not.toContain(written.id)
      expect((await getJourney(stranger, written.id))?.id).toBe(written.id)
    })

    it('leaves a journey tied to no trip, and one on a live trip, as they were', async () => {
      const untied = await createJourney(alpha.scope, {
        title: 'A weekend walk',
      })
      const shared = await createTrip(alpha.scope, {
        title: 'Porto for everyone',
        slug: 'porto-for-everyone',
        startDate: '2026-05-01',
        endDate: '2026-05-04',
      })
      await updateTrip(alpha.scope, shared.id, { visibility: 'organization' })
      const onShared = await createJourney(alpha.scope, {
        tripId: shared.id,
        title: 'Porto, written up',
      })
      const priv = await createTrip(alpha.scope, {
        title: 'Faro, quietly',
        slug: 'faro-quietly',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      })
      const onPrivate = await createJourney(alpha.scope, {
        tripId: priv.id,
        title: 'Faro, written up',
      })

      // Deleting a different trip marked none of these: the marker is per trip, not per workspace.
      await deleteTrip(alpha.scope, priv.id)

      for (const reader of [stranger, outsider]) {
        expect(
          (await listJourneys(reader)).map((row) => row.id).sort(),
        ).toEqual([untied.id, onShared.id].sort())
        expect(await getJourney(reader, onPrivate.id)).toBeNull()
      }
    })
  })

  /**
   * An id names a row; the trip in the request names what the caller is working in. A money writer
   * that finds the row by id alone lets someone who may read *any* trip rewrite or remove another
   * trip's ledger, so every one of them is asked for the pair, and a row of some other trip answers
   * exactly as a row that is not there.
   */
  describe('the money writers', () => {
    interface Ledger {
      readonly tripId: string
      readonly expenseId: string
      readonly shareId: string
      readonly budgetItemId: string
      readonly settlementId: string
      readonly reservationId: string
    }

    let payerId: string
    let victim: Ledger
    let mine: string

    async function seedLedger(
      tripId: string,
      scope: TenantScope,
      ids: { readonly payer: string; readonly other: string },
    ): Promise<Ledger> {
      for (const userId of [ids.payer, ids.other]) {
        if (!(await tripMemberUserIds(scope, tripId)).includes(userId)) {
          await addTripMember(scope, { tripId, userId, role: 'editor' })
        }
      }
      const { expense, shares } = await createExpense(scope, {
        tripId,
        title: 'Dinner',
        amountMinor: 6_000,
        spentOn: '2026-04-10',
        paidBy: ids.payer,
        participants: [{ userId: ids.payer }, { userId: ids.other }],
      })
      const share = shares.at(0)
      if (share === undefined) {
        throw new Error('A split expense must have share rows.')
      }
      const budgetItem = await createBudgetItem(scope, {
        tripId,
        name: 'Food',
        plannedAmountMinor: 20_000,
      })
      const settlement = await createSettlement(scope, {
        tripId,
        fromUserId: ids.other,
        toUserId: ids.payer,
        amountMinor: 1_000,
        settledOn: '2026-04-11',
      })
      const booking = await createReservation(scope, {
        tripId,
        title: 'Table for four',
      })
      await linkReservationExpense(scope, booking.id, expense.id)
      return {
        tripId,
        expenseId: expense.id,
        shareId: share.id,
        budgetItemId: budgetItem.id,
        settlementId: settlement.id,
        reservationId: booking.id,
      }
    }

    /** Everything an attack on the victim could change, read back as the owner. */
    async function ledgerOf(ledger: Ledger): Promise<unknown> {
      return {
        expense: await getExpenseWithShares(alpha.scope, ledger.expenseId),
        budgetItems: await listBudgetItems(alpha.scope, ledger.tripId),
        settlements: await listSettlements(alpha.scope, ledger.tripId),
        balances: await getMemberBalances(alpha.scope, ledger.tripId),
        bookingLink: (await getReservation(alpha.scope, ledger.reservationId))
          ?.expenseId,
      }
    }

    function attacksVia(
      tripId: string,
    ): ReadonlyArray<readonly [string, () => Promise<unknown>]> {
      return [
        [
          'editing the expense',
          () =>
            updateExpense(stranger, tripId, victim.expenseId, {
              title: 'Rewritten',
              amountMinor: 1,
              participants: [{ userId: strangerId }],
            }),
        ],
        [
          'deleting the expense',
          () => deleteExpense(stranger, tripId, victim.expenseId),
        ],
        [
          'resplitting the expense',
          () =>
            setExpenseShares(stranger, tripId, victim.expenseId, [
              { userId: strangerId },
            ]),
        ],
        [
          'settling a share',
          () => markShareSettled(stranger, tripId, victim.shareId, true),
        ],
        [
          'editing a planned item',
          () =>
            updateBudgetItem(stranger, tripId, victim.budgetItemId, {
              name: 'Rewritten',
            }),
        ],
        [
          'deleting a planned item',
          () => deleteBudgetItem(stranger, tripId, victim.budgetItemId),
        ],
        [
          'deleting a payment',
          () => deleteSettlement(stranger, tripId, victim.settlementId),
        ],
      ]
    }

    beforeEach(async () => {
      payerId = await alpha.addUser('Alpha the payer')
      victim = await seedLedger(fixture.tripId, alpha.scope, {
        payer: alpha.ownerUserId,
        other: payerId,
      })
      mine = (
        await createTrip(stranger, {
          title: 'Porto, my side',
          slug: 'porto-my-side',
          startDate: '2026-05-01',
          endDate: '2026-05-04',
        })
      ).id
    })

    async function expectRefusedAndUntouched(
      namedTripId: string,
    ): Promise<void> {
      const before = await ledgerOf(victim)
      for (const [, attack] of attacksVia(namedTripId)) {
        const error = await captureError(attack)
        expect(error).toBeInstanceOf(NotFoundError)
        expect((error as NotFoundError).code).toBe('NOT_FOUND')
      }
      expect(await ledgerOf(victim)).toEqual(before)
    }

    it('refuse an expense of a private trip the caller is not on, named through the caller’s own trip', async () => {
      await expectRefusedAndUntouched(mine)
    })

    it('refuse an expense of an organization-visible trip, named through the caller’s own trip', async () => {
      await updateTrip(alpha.scope, victim.tripId, {
        visibility: 'organization',
      })
      await expectRefusedAndUntouched(mine)
    })

    it('refuse an expense of another trip the caller is a member of', async () => {
      const shared = await createTrip(alpha.scope, {
        title: 'Faro, together',
        slug: 'faro-together',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      })
      await addTripMember(alpha.scope, {
        tripId: shared.id,
        userId: strangerId,
        role: 'editor',
      })
      await expectRefusedAndUntouched(shared.id)
    })

    it('answer an id that does not exist as they answer an id of another trip', async () => {
      const missingIds = {
        expense: 'no-such-expense',
        share: 'no-such-share',
        budgetItem: 'no-such-planned-item',
        settlement: 'no-such-payment',
      }
      const withMissing: ReadonlyArray<() => Promise<unknown>> = [
        () => updateExpense(stranger, mine, missingIds.expense, { title: 'x' }),
        () => deleteExpense(stranger, mine, missingIds.expense),
        () =>
          setExpenseShares(stranger, mine, missingIds.expense, [
            { userId: strangerId },
          ]),
        () => markShareSettled(stranger, mine, missingIds.share, true),
        () =>
          updateBudgetItem(stranger, mine, missingIds.budgetItem, {
            name: 'x',
          }),
        () => deleteBudgetItem(stranger, mine, missingIds.budgetItem),
        () => deleteSettlement(stranger, mine, missingIds.settlement),
      ]
      const foreign = attacksVia(mine)
      expect(withMissing).toHaveLength(foreign.length)

      for (const [index, missing] of withMissing.entries()) {
        const missingError = await captureError(missing)
        const foreignError = await captureError(
          foreign[index]?.[1] ?? (() => Promise.resolve()),
        )
        expect(missingError).toBeInstanceOf(NotFoundError)
        expect(foreignError).toBeInstanceOf(NotFoundError)
        expect((foreignError as NotFoundError).code).toBe(
          (missingError as NotFoundError).code,
        )
      }
    })

    it('leave the booking link and the share rows alone when the expense is not the trip’s', async () => {
      await captureError(() => deleteExpense(stranger, mine, victim.expenseId))
      expect(
        (await getReservation(alpha.scope, victim.reservationId))?.expenseId,
      ).toBe(victim.expenseId)
      expect(await expenseSharesRepository.count(alpha.scope)).toBeGreaterThan(
        0,
      )
    })

    it('still write the rows of the trip they name, every one of the writers', async () => {
      const own = await seedLedger(mine, stranger, {
        payer: strangerId,
        other: payerId,
      })

      await updateExpense(stranger, mine, own.expenseId, { title: 'Supper' })
      const settled = await markShareSettled(stranger, mine, own.shareId, true)
      expect(settled.isSettled).toBe(true)
      const resplit = await setExpenseShares(stranger, mine, own.expenseId, [
        { userId: strangerId },
      ])
      expect(resplit).toHaveLength(1)
      const item = await updateBudgetItem(stranger, mine, own.budgetItemId, {
        name: 'Meals',
      })
      expect(item.name).toBe('Meals')

      await deleteBudgetItem(stranger, mine, own.budgetItemId)
      await deleteSettlement(stranger, mine, own.settlementId)
      expect(await listBudgetItems(stranger, mine)).toEqual([])
      expect(await listSettlements(stranger, mine)).toEqual([])
    })

    it('still edit and delete an expense of the trip they name', async () => {
      const own = await createExpense(stranger, {
        tripId: mine,
        title: 'Taxi',
        amountMinor: 1_200,
        spentOn: '2026-05-01',
      })

      const edited = await updateExpense(stranger, mine, own.expense.id, {
        title: 'Taxi to the airport',
      })
      expect(edited.expense.title).toBe('Taxi to the airport')

      await deleteExpense(stranger, mine, own.expense.id)
      expect(
        await captureError(() =>
          updateExpense(stranger, mine, own.expense.id, { title: 'Gone' }),
        ),
      ).toBeInstanceOf(NotFoundError)
    })
  })

  /**
   * A money write names people, and optionally a place and a planned item. The trip in the request
   * decides which of them are allowed: its members, and anyone the trip's money already carries, so
   * someone who has since left the trip does not lock their own expense or their own debt. A person
   * the trip has never seen, and a place or planned item of another trip, answer as an id that is
   * not there - once for the whole submitted set, without saying which id was wrong.
   */
  describe('the people, places and planned items a money write names', () => {
    let ownerId: string
    let memberId: string
    /** In the workspace, on no trip: what a crafted request would name. */
    let outsiderId: string
    let tripId: string
    let elsewhere: {
      readonly placeId: string
      readonly budgetItemId: string
    }

    async function expectRefusedWithoutNaming(
      write: () => Promise<unknown>,
      ...ids: ReadonlyArray<string>
    ): Promise<void> {
      const error = await captureError(write)
      expect(error).toBeInstanceOf(NotFoundError)
      expect((error as NotFoundError).code).toBe('NOT_FOUND')
      for (const id of ids) {
        expect((error as NotFoundError).message).not.toContain(id)
      }
    }

    async function ledger(): Promise<unknown> {
      return {
        expenses: await listTripExpenses(alpha.scope, tripId),
        settlements: await listSettlements(alpha.scope, tripId),
        balances: await getMemberBalances(alpha.scope, tripId),
      }
    }

    beforeEach(async () => {
      tripId = fixture.tripId
      ownerId = alpha.ownerUserId
      memberId = await alpha.addUser('Alpha on the trip')
      outsiderId = strangerId
      await addTripMember(alpha.scope, {
        tripId,
        userId: memberId,
        role: 'editor',
      })
      const other = await createTrip(alpha.scope, {
        title: 'Faro, another time',
        slug: 'faro-another-time',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      })
      const place = await createPlace(alpha.scope, {
        tripId: other.id,
        name: 'Ponta da Piedade',
      })
      const item = await createBudgetItem(alpha.scope, {
        tripId: other.id,
        name: 'Boat',
      })
      elsewhere = { placeId: place.id, budgetItemId: item.id }
    })

    async function dinner(): Promise<string> {
      const { expense } = await createExpense(alpha.scope, {
        tripId,
        title: 'Dinner',
        amountMinor: 6_000,
        spentOn: '2026-04-10',
        paidBy: ownerId,
        participants: [{ userId: ownerId }, { userId: memberId }],
      })
      return expense.id
    }

    describe('refuse a person the trip has never seen', () => {
      it('in the split of a new expense, writing nothing', async () => {
        const before = await ledger()
        await expectRefusedWithoutNaming(
          () =>
            createExpense(alpha.scope, {
              tripId,
              title: 'Taxi',
              amountMinor: 1_000,
              spentOn: '2026-04-10',
              participants: [{ userId: ownerId }, { userId: outsiderId }],
            }),
          outsiderId,
        )
        expect(await ledger()).toEqual(before)
      })

      it('as the payer of a new expense', async () => {
        const before = await ledger()
        await expectRefusedWithoutNaming(
          () =>
            createExpense(alpha.scope, {
              tripId,
              title: 'Taxi',
              amountMinor: 1_000,
              spentOn: '2026-04-10',
              paidBy: outsiderId,
            }),
          outsiderId,
        )
        expect(await ledger()).toEqual(before)
      })

      it('in the split or as the payer of an edit, leaving the expense as it was', async () => {
        const expenseId = await dinner()
        const before = await ledger()
        const sharesBefore = await getExpenseWithShares(alpha.scope, expenseId)

        await expectRefusedWithoutNaming(
          () =>
            updateExpense(alpha.scope, tripId, expenseId, {
              participants: [{ userId: ownerId }, { userId: outsiderId }],
            }),
          outsiderId,
        )
        await expectRefusedWithoutNaming(
          () =>
            updateExpense(alpha.scope, tripId, expenseId, {
              title: 'Rewritten',
              paidBy: outsiderId,
            }),
          outsiderId,
        )

        expect(await ledger()).toEqual(before)
        expect(await getExpenseWithShares(alpha.scope, expenseId)).toEqual(
          sharesBefore,
        )
      })

      it('when the split of an expense is replaced', async () => {
        const expenseId = await dinner()
        const sharesBefore = await getExpenseWithShares(alpha.scope, expenseId)
        await expectRefusedWithoutNaming(
          () =>
            setExpenseShares(alpha.scope, tripId, expenseId, [
              { userId: ownerId },
              { userId: outsiderId },
            ]),
          outsiderId,
        )
        expect(await getExpenseWithShares(alpha.scope, expenseId)).toEqual(
          sharesBefore,
        )
      })

      it('on either side of a payment', async () => {
        const before = await ledger()
        await expectRefusedWithoutNaming(
          () =>
            createSettlement(alpha.scope, {
              tripId,
              fromUserId: outsiderId,
              toUserId: ownerId,
              amountMinor: 500,
              settledOn: '2026-04-11',
            }),
          outsiderId,
        )
        await expectRefusedWithoutNaming(
          () =>
            createSettlement(alpha.scope, {
              tripId,
              fromUserId: ownerId,
              toUserId: outsiderId,
              amountMinor: 500,
              settledOn: '2026-04-11',
            }),
          outsiderId,
        )
        expect(await ledger()).toEqual(before)
      })

      it('with one refusal for the whole set, whichever id was the wrong one', async () => {
        const second = await alpha.addUser('Alpha the third')
        const first = await captureError(() =>
          createExpense(alpha.scope, {
            tripId,
            title: 'Taxi',
            amountMinor: 1_000,
            spentOn: '2026-04-10',
            participants: [{ userId: outsiderId }],
          }),
        )
        const other = await captureError(() =>
          createExpense(alpha.scope, {
            tripId,
            title: 'Taxi',
            amountMinor: 1_000,
            spentOn: '2026-04-10',
            participants: [{ userId: ownerId }, { userId: second }],
          }),
        )
        expect((first as NotFoundError).message).toBe(
          (other as NotFoundError).message,
        )
      })
    })

    describe('refuse a place or planned item of another trip', () => {
      it('when the expense is created', async () => {
        const before = await ledger()
        await expectRefusedWithoutNaming(() =>
          createExpense(alpha.scope, {
            tripId,
            title: 'Boat',
            amountMinor: 1_000,
            spentOn: '2026-04-10',
            placeId: elsewhere.placeId,
          }),
        )
        await expectRefusedWithoutNaming(() =>
          createExpense(alpha.scope, {
            tripId,
            title: 'Boat',
            amountMinor: 1_000,
            spentOn: '2026-04-10',
            budgetItemId: elsewhere.budgetItemId,
          }),
        )
        expect(await ledger()).toEqual(before)
      })

      it('when the expense is edited', async () => {
        const expenseId = await dinner()
        const before = await ledger()
        await expectRefusedWithoutNaming(() =>
          updateExpense(alpha.scope, tripId, expenseId, {
            placeId: elsewhere.placeId,
          }),
        )
        await expectRefusedWithoutNaming(() =>
          updateExpense(alpha.scope, tripId, expenseId, {
            budgetItemId: elsewhere.budgetItemId,
          }),
        )
        expect(await ledger()).toEqual(before)
      })

      it('and still link the trip’s own, or clear the link', async () => {
        const item = await createBudgetItem(alpha.scope, {
          tripId,
          name: 'Food',
        })
        const { expense } = await createExpense(alpha.scope, {
          tripId,
          title: 'Lunch',
          amountMinor: 1_000,
          spentOn: '2026-04-10',
          placeId: fixture.placeId,
          budgetItemId: item.id,
        })
        expect(expense.placeId).toBe(fixture.placeId)
        expect(expense.budgetItemId).toBe(item.id)

        const cleared = await updateExpense(alpha.scope, tripId, expense.id, {
          placeId: null,
          budgetItemId: null,
        })
        expect(cleared.expense.placeId).toBeNull()
        expect(cleared.expense.budgetItemId).toBeNull()
      })
    })

    describe('keep working for someone who has left the trip', () => {
      let formerId: string
      let expenseId: string

      beforeEach(async () => {
        formerId = await alpha.addUser('Alpha who left')
        const membership = await addTripMember(alpha.scope, {
          tripId,
          userId: formerId,
          role: 'editor',
        })
        const created = await createExpense(alpha.scope, {
          tripId,
          title: 'Boat trip',
          amountMinor: 9_000,
          spentOn: '2026-04-11',
          paidBy: formerId,
          participants: [
            { userId: formerId },
            { userId: ownerId },
            { userId: memberId },
          ],
        })
        expenseId = created.expense.id
        await removeTripMember(alpha.scope, membership.id)
      })

      it('lets an expense they paid and share be edited with the same people', async () => {
        const edited = await updateExpense(alpha.scope, tripId, expenseId, {
          title: 'Boat trip, corrected',
          paidBy: formerId,
          participants: [
            { userId: formerId },
            { userId: ownerId },
            { userId: memberId },
          ],
        })
        expect(edited.expense.title).toBe('Boat trip, corrected')
        expect(edited.shares.map((row) => row.userId).sort()).toEqual(
          [formerId, ownerId, memberId].sort(),
        )

        const resplit = await setExpenseShares(alpha.scope, tripId, expenseId, [
          { userId: formerId },
          { userId: ownerId },
        ])
        expect(resplit).toHaveLength(2)
      })

      it('still refuses a new outsider on that same expense', async () => {
        await expectRefusedWithoutNaming(
          () =>
            updateExpense(alpha.scope, tripId, expenseId, {
              participants: [{ userId: formerId }, { userId: outsiderId }],
            }),
          outsiderId,
        )
      })

      it('does not let them be added to another expense', async () => {
        await expectRefusedWithoutNaming(
          () =>
            createExpense(alpha.scope, {
              tripId,
              title: 'Taxi',
              amountMinor: 1_000,
              spentOn: '2026-04-12',
              participants: [{ userId: formerId }],
            }),
          formerId,
        )
      })

      it('lets a debt they still owe be recorded as paid, and a credit be paid back', async () => {
        const balances = await getMemberBalances(alpha.scope, tripId)
        expect(balances.map((row) => row.userId)).toContain(formerId)

        const owed = await createSettlement(alpha.scope, {
          tripId,
          fromUserId: ownerId,
          toUserId: formerId,
          amountMinor: 1_000,
          settledOn: '2026-04-12',
        })
        expect(owed.toUserId).toBe(formerId)

        const paid = await createSettlement(alpha.scope, {
          tripId,
          fromUserId: formerId,
          toUserId: memberId,
          amountMinor: 500,
          settledOn: '2026-04-12',
        })
        expect(paid.fromUserId).toBe(formerId)
      })

      it('refuses a payment with someone who left and owes and is owed nothing', async () => {
        const gone = await alpha.addUser('Alpha long gone')
        const membership = await addTripMember(alpha.scope, {
          tripId,
          userId: gone,
          role: 'viewer',
        })
        await removeTripMember(alpha.scope, membership.id)
        await expectRefusedWithoutNaming(
          () =>
            createSettlement(alpha.scope, {
              tripId,
              fromUserId: gone,
              toUserId: ownerId,
              amountMinor: 500,
              settledOn: '2026-04-12',
            }),
          gone,
        )
      })
    })

    it('leaves an expense with no people, as booking sync writes it, unchanged', async () => {
      const { expense, shares } = await createExpense(alpha.scope, {
        tripId,
        title: 'Guesthouse',
        amountMinor: 24_000,
        spentOn: '2026-04-10',
      })
      expect(shares).toEqual([])
      const edited = await updateExpense(alpha.scope, tripId, expense.id, {
        title: 'Guesthouse, confirmed',
        amountMinor: 25_000,
      })
      expect(edited.expense.amountMinor).toBe(25_000)
    })
  })
})
