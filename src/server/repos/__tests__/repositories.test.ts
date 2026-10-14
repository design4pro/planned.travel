/**
 * Behaviour of the repository layer: the reads and writes the UI depends on, exercised against the
 * generated schema. Isolation is covered separately in `tenant-isolation.test.ts`; this file is about
 * the queries being *correct* — ordering, nesting, roll-ups, batched writes and the invariants the
 * modules promise (contiguous day runs, splits that add up, allowances that subtract).
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { PLANS } from '#/lib/plans'
import {
  createBucketListItem,
  achieveBucketListItem,
  getAtlasSummary,
  listVisitedCountries,
  markCountryVisited,
  recomputeTravelStats,
} from '../atlas'
import {
  countAuditActions,
  listAuditLog,
  recordAudit,
  recordAuditMany,
} from '../audit'
import { bumpUsage, getMonthlyUsage, getPlanSummary } from '../billing'
import { ensureDefaultCategories, listCategoriesWithUsage } from '../categories'
import {
  castVote,
  createPoll,
  getPollResult,
  listNotes,
  createCollabNote,
  deleteMessage,
  listMessages,
  postMessage,
} from '../collab'
import {
  addCollectionPlace,
  createCollection,
  createLabel,
  listCollectionPlaces,
  listCollectionPlacesWithLabels,
  setCollectionPlaceLabels,
} from '../collections'
import { RepositoryError } from '../context'
import { createDayNote, listTripDays, syncTripDays } from '../days'
import {
  createExpense,
  createSettlement,
  createSettlementInput,
  getMemberBalances,
  listDailySpend,
  listSettlements,
  setExpenseShares,
  settlementsRepository,
  suggestSettlements,
} from '../expenses'
import {
  createAssignment,
  getTripItinerary,
  reorderAssignments,
} from '../itinerary'
import {
  addPhoto,
  createEntry,
  createJourney,
  createMood,
  journalCoverage,
  listRecentEntries,
  listTripsWithoutJourney,
  tallyMoods,
} from '../journey'
import {
  applyTemplateToTrip,
  createList,
  createListItem,
  createTemplate,
  createTemplateFromList,
  listTripListsWithProgress,
  resetList,
  setListItemDone,
} from '../lists'
import {
  countUnread,
  filterEnabledRecipients,
  listNotifications,
  markAllRead,
  notify,
  notifyMany,
  setPreference,
} from '../notifications'
import {
  createPlace,
  listTripPlacesWithTags,
  listUnscheduledPlaces,
  reorderPlaces,
} from '../places'
import { resolveTags } from '../tags'
import {
  createTransport,
  summariseTripTransports,
  totalTripDistanceMetres,
} from '../transports'
import {
  MAX_BOUND_PARAMETERS,
  addTripMember,
  createTrip,
  getTripBySlug,
  listTrips,
  updateTrip,
} from '../trips'
import {
  countUsedDays,
  ensurePlan,
  getPlanOverview,
  setEntry,
  setEntryRange,
  setEntitlement,
} from '../vacay'
import { createHarness, subscribeTenant } from './harness'
import type { Harness, SeededTenant } from './harness'

describe('repositories', () => {
  let harness: Harness
  let tenant: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('solo')
  })

  describe('trips and days', () => {
    it('derives a unique slug per tenant and keeps the day run contiguous', async () => {
      const first = await createTrip(tenant.scope, {
        title: 'Lisbon in spring',
      })
      const second = await createTrip(tenant.scope, {
        title: 'Lisbon in spring',
      })

      expect(first.slug).toBe('lisbon-in-spring')
      expect(second.slug).toBe('lisbon-in-spring-2')
      expect(
        (await getTripBySlug(tenant.scope, 'lisbon-in-spring-2'))?.id,
      ).toBe(second.id)
      expect((await listTrips(tenant.scope)).length).toBe(2)
    })

    it('grows, re-dates and shrinks the day run as the trip dates move', async () => {
      const trip = await createTrip(tenant.scope, {
        title: 'Azores',
        startDate: '2026-06-01',
        endDate: '2026-06-03',
      })
      expect(
        (await listTripDays(tenant.scope, trip.id)).map((day) => day.date),
      ).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])

      await updateTrip(tenant.scope, trip.id, {
        startDate: '2026-06-02',
        endDate: '2026-06-06',
      })
      const grown = await listTripDays(tenant.scope, trip.id)
      expect(grown).toHaveLength(5)
      expect(grown.map((day) => day.dayNumber)).toEqual([1, 2, 3, 4, 5])
      expect(grown.map((day) => day.date)).toEqual([
        '2026-06-02',
        '2026-06-03',
        '2026-06-04',
        '2026-06-05',
        '2026-06-06',
      ])

      const shrunk = await syncTripDays(tenant.scope, trip.id, {
        startDate: '2026-06-02',
        endDate: '2026-06-03',
      })
      expect(shrunk).toHaveLength(2)
      expect(shrunk.map((day) => day.dayNumber)).toEqual([1, 2])
    })

    it('rejects a trip that ends before it starts', async () => {
      await expect(
        createTrip(tenant.scope, {
          title: 'Impossible',
          startDate: '2026-06-05',
          endDate: '2026-06-01',
        }),
      ).rejects.toThrow(/cannot end before/)
    })
  })

  describe('places and the itinerary', () => {
    it('nests stops under their day in board order and separates the unscheduled ones', async () => {
      const trip = await createTrip(tenant.scope, {
        title: 'Porto',
        startDate: '2026-05-01',
        endDate: '2026-05-02',
      })
      const days = await listTripDays(tenant.scope, trip.id)
      const dayOne = days.at(0)
      const dayTwo = days.at(1)
      if (dayOne === undefined || dayTwo === undefined) {
        throw new Error('The trip must have two days.')
      }

      const bridge = await createPlace(tenant.scope, {
        tripId: trip.id,
        name: 'Dom Luís bridge',
      })
      const cellar = await createPlace(tenant.scope, {
        tripId: trip.id,
        name: 'Wine cellar',
      })
      const idea = await createPlace(tenant.scope, {
        tripId: trip.id,
        name: 'Bookshop',
      })

      const second = await createAssignment(tenant.scope, {
        tripId: trip.id,
        dayId: dayOne.id,
        placeId: cellar.id,
        orderIndex: 2,
      })
      const first = await createAssignment(tenant.scope, {
        tripId: trip.id,
        dayId: dayOne.id,
        placeId: bridge.id,
        orderIndex: 1,
      })

      const itinerary = await getTripItinerary(tenant.scope, trip.id)
      expect(itinerary.map((entry) => entry.day.dayNumber)).toEqual([1, 2])
      expect(itinerary[0]?.stops.map((stop) => stop.place.name)).toEqual([
        'Dom Luís bridge',
        'Wine cellar',
      ])
      expect(itinerary[1]?.stops).toHaveLength(0)

      const unscheduled = await listUnscheduledPlaces(tenant.scope, trip.id)
      expect(unscheduled.map((place) => place.id)).toEqual([idea.id])

      // A batched reorder swaps them.
      await reorderAssignments(tenant.scope, [
        { assignmentId: first.id, orderIndex: 9 },
        { assignmentId: second.id, orderIndex: 1 },
      ])
      const reordered = await getTripItinerary(tenant.scope, trip.id)
      expect(reordered[0]?.stops.map((stop) => stop.place.name)).toEqual([
        'Wine cellar',
        'Dom Luís bridge',
      ])
    })

    /**
     * The planner reads its notes through `loadDayNotes`, so an itinerary that read them too made
     * the page pay for `day_notes` twice and throw one answer away (#393). The assertion is on the
     * SQL rather than on the returned shape because the shape alone cannot tell a removed
     * projection from a removed read — and it is the read this ticket is about.
     */
    it('never touches day_notes, whose rows the planner reads for itself', async () => {
      const trip = await createTrip(tenant.scope, {
        title: 'Lisbon',
        startDate: '2026-07-01',
        endDate: '2026-07-02',
      })
      const firstDay = (await listTripDays(tenant.scope, trip.id)).at(0)
      if (firstDay === undefined) {
        throw new Error('The trip must have a first day.')
      }
      await createDayNote(tenant.scope, {
        tripId: trip.id,
        dayId: firstDay.id,
        body: 'Book the tram',
      })

      harness.statements.length = 0
      const itinerary = await getTripItinerary(tenant.scope, trip.id)

      expect(itinerary).toHaveLength(2)
      expect(
        harness.statements.filter((sql) => sql.includes('day_notes')),
      ).toEqual([])
    })

    it('reorders places in one batch and attaches resolved tags', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Madeira' })
      const levada = await createPlace(tenant.scope, {
        tripId: trip.id,
        name: 'Levada walk',
      })
      const market = await createPlace(tenant.scope, {
        tripId: trip.id,
        name: 'Farmers market',
      })

      const tags = await resolveTags(tenant.scope, [
        'Must see',
        'must-see',
        'Rainy day',
      ])
      expect(tags.map((tag) => tag.slug)).toEqual(['must-see', 'rainy-day'])

      await reorderPlaces(tenant.scope, [
        { placeId: market.id, sortOrder: 1 },
        { placeId: levada.id, sortOrder: 2 },
      ])

      const withTags = await listTripPlacesWithTags(tenant.scope, trip.id)
      expect(withTags.map((place) => place.name)).toEqual([
        'Farmers market',
        'Levada walk',
      ])
      expect(withTags.every((place) => place.tags.length === 0)).toBe(true)
    })

    it('counts category usage across the tenant', async () => {
      const categories = await ensureDefaultCategories(tenant.scope)
      expect(categories.length).toBeGreaterThanOrEqual(8)

      // Seeding twice must not duplicate the starter taxonomy.
      expect((await ensureDefaultCategories(tenant.scope)).length).toBe(
        categories.length,
      )

      const stays = categories.find((row) => row.slug === 'stays')
      if (!stays) {
        throw new Error('The starter taxonomy must include stays.')
      }
      const trip = await createTrip(tenant.scope, { title: 'Sintra' })
      await createPlace(tenant.scope, {
        tripId: trip.id,
        name: 'Quinta da Regaleira',
        categoryId: stays.id,
      })

      const usage = await listCategoriesWithUsage(tenant.scope)
      expect(usage.find((row) => row.slug === 'stays')?.placeCount).toBe(1)
      expect(usage.find((row) => row.slug === 'museums')?.placeCount).toBe(0)
    })
  })

  describe('money', () => {
    it('splits an expense, reports balances and suggests the clearing transfers', async () => {
      const other = await tenant.addUser('Second traveller')
      const trip = await createTrip(tenant.scope, {
        title: 'Split test',
        startDate: '2026-07-01',
        endDate: '2026-07-02',
      })
      await addTripMember(tenant.scope, {
        tripId: trip.id,
        userId: other,
        role: 'editor',
      })

      const dinner = await createExpense(tenant.scope, {
        tripId: trip.id,
        title: 'Dinner',
        amountMinor: 5_001,
        spentOn: '2026-07-01',
        paidBy: tenant.ownerUserId,
        participants: [{ userId: tenant.ownerUserId }, { userId: other }],
      })
      expect(dinner.shares.map((share) => share.shareMinor)).toEqual([
        2_501, 2_500,
      ])

      const balances = await getMemberBalances(tenant.scope, trip.id)
      expect(balances[0]?.userId).toBe(tenant.ownerUserId)
      expect(balances[0]?.balanceMinor).toBe(2_500)
      expect(balances[1]?.balanceMinor).toBe(-2_500)

      const suggestions = await suggestSettlements(tenant.scope, trip.id)
      expect(suggestions).toEqual([
        { fromUserId: other, toUserId: tenant.ownerUserId, amountMinor: 2_500 },
      ])

      await createSettlement(tenant.scope, {
        tripId: trip.id,
        fromUserId: other,
        toUserId: tenant.ownerUserId,
        amountMinor: 2_500,
        settledOn: '2026-07-02',
      })
      expect(
        (await getMemberBalances(tenant.scope, trip.id)).every(
          (row) => row.balanceMinor === 0,
        ),
      ).toBe(true)

      // Re-splitting replaces the old rows rather than adding to them.
      const reshared = await setExpenseShares(
        tenant.scope,
        trip.id,
        dinner.expense.id,
        [
          { userId: tenant.ownerUserId, weight: 3 },
          { userId: other, weight: 1 },
        ],
        'shares',
      )
      expect(reshared).toHaveLength(2)
      expect(reshared.reduce((total, row) => total + row.shareMinor, 0)).toBe(
        5_001,
      )

      const daily = await listDailySpend(tenant.scope, trip.id)
      expect(daily).toEqual([{ spentOn: '2026-07-01', spentMinor: 5_001 }])
    })

    describe('a settlement paid in another currency', () => {
      async function tokyoTrip(): Promise<{
        readonly payment: {
          readonly tripId: string
          readonly fromUserId: string
          readonly toUserId: string
          readonly amountMinor: number
          readonly settledOn: string
        }
        readonly written: () => Promise<number>
      }> {
        const other = await tenant.addUser('Payer')
        const trip = await createTrip(tenant.scope, {
          title: 'Tokyo',
          currency: 'JPY',
        })
        await addTripMember(tenant.scope, {
          tripId: trip.id,
          userId: other,
          role: 'editor',
        })
        return {
          payment: {
            tripId: trip.id,
            fromUserId: other,
            toUserId: tenant.ownerUserId,
            amountMinor: 46_488,
            settledOn: '2026-10-12',
          },
          written: async () =>
            (await listSettlements(tenant.scope, trip.id)).length,
        }
      }

      it('derives the rate from the amount pair and freezes it on the row', async () => {
        const { payment } = await tokyoTrip()

        const converted = await createSettlement(tenant.scope, {
          ...payment,
          originalAmountMinor: 59_600,
          originalCurrency: 'GBP',
        })

        const stored = (
          await listSettlements(tenant.scope, payment.tripId)
        ).find((row) => row.id === converted.id)
        expect(stored?.amountMinor).toBe(46_488)
        expect(stored?.currency).toBe('JPY')
        expect(stored?.originalAmountMinor).toBe(59_600)
        expect(stored?.originalCurrency).toBe('GBP')
        // 46,488 yen for 596.00 pounds: 78 yen to the pound, major per major.
        expect(stored?.exchangeRate).toBe(78)
      })

      it('refuses a half-recorded pair and a source amount of nothing, and writes nothing', async () => {
        const { payment, written } = await tokyoTrip()

        const attempts = [
          { originalAmountMinor: 59_600 },
          { originalCurrency: 'GBP' },
          { originalAmountMinor: null, originalCurrency: 'GBP' },
          { originalAmountMinor: 0, originalCurrency: 'GBP' },
          // Nothing sent is refused whichever currency it names, the trip's own included.
          { originalAmountMinor: 0, originalCurrency: 'JPY' },
        ] as const
        for (const source of attempts) {
          const error = await createSettlement(tenant.scope, {
            ...payment,
            ...source,
          }).then(
            () => null,
            (cause: unknown) => cause,
          )
          expect(error).toBeInstanceOf(RepositoryError)
          expect((error as RepositoryError).code).toBe('CONVERSION_INCOMPLETE')
        }

        // The table deliberately carries no CHECK for this, so the guard is the writer's.
        await expect(
          createSettlement(tenant.scope, {
            ...payment,
            originalAmountMinor: -1,
            originalCurrency: 'GBP',
          }),
        ).rejects.toThrow()
        expect(await written()).toBe(0)
      })

      it('does not accept a rate from the caller, whether or not it agrees with the amounts', async () => {
        const { payment, written } = await tokyoTrip()
        const body = {
          ...payment,
          originalAmountMinor: 59_600,
          originalCurrency: 'GBP',
        }

        for (const exchangeRate of [78, 195]) {
          const result = createSettlementInput.safeParse({
            ...body,
            exchangeRate,
          })
          expect(result.success).toBe(false)
          expect(result.error?.issues[0]?.code).toBe('unrecognized_keys')
          await expect(
            createSettlement(tenant.scope, { ...body, exchangeRate } as never),
          ).rejects.toThrow(/exchangeRate/)
        }
        expect(await written()).toBe(0)
      })

      it('takes the currency from the trip and refuses one that differs', async () => {
        const { payment, written } = await tokyoTrip()

        const error = await createSettlement(tenant.scope, {
          ...payment,
          currency: 'EUR',
        }).then(
          () => null,
          (cause: unknown) => cause,
        )
        expect(error).toBeInstanceOf(RepositoryError)
        expect(await written()).toBe(0)

        const own = await createSettlement(tenant.scope, {
          ...payment,
          currency: 'JPY',
        })
        expect(own.currency).toBe('JPY')
        const fallback = await createSettlement(tenant.scope, payment)
        expect(fallback.currency).toBe('JPY')
      })

      it('stores no source figures when the source currency is the trip’s own', async () => {
        const { payment } = await tokyoTrip()

        const same = await createSettlement(tenant.scope, {
          ...payment,
          originalAmountMinor: payment.amountMinor,
          originalCurrency: 'JPY',
        })

        expect(same.originalAmountMinor).toBeNull()
        expect(same.originalCurrency).toBeNull()
        expect(same.exchangeRate).toBeNull()
      })

      it('still clears a trip to zero when converted and unconverted payments are mixed', async () => {
        const { payment } = await tokyoTrip()
        await createExpense(tenant.scope, {
          tripId: payment.tripId,
          title: 'Ramen',
          amountMinor: 100_000,
          spentOn: '2026-10-11',
          paidBy: tenant.ownerUserId,
          participants: [
            { userId: tenant.ownerUserId },
            { userId: payment.fromUserId },
          ],
        })

        // A payment written before the source columns existed: three nulls, face value.
        const legacy = await settlementsRepository.insert(tenant.scope, {
          ...payment,
          amountMinor: 20_000,
          currency: 'JPY',
          createdBy: tenant.ownerUserId,
        })
        expect(legacy.originalAmountMinor).toBeNull()
        expect(legacy.originalCurrency).toBeNull()
        expect(legacy.exchangeRate).toBeNull()

        await createSettlement(tenant.scope, {
          ...payment,
          amountMinor: 30_000,
          originalAmountMinor: 38_462,
          originalCurrency: 'GBP',
        })

        const balances = await getMemberBalances(tenant.scope, payment.tripId)
        expect(balances).toHaveLength(2)
        expect(balances.every((row) => row.balanceMinor === 0)).toBe(true)
      })
    })

    it('leaves the three source columns null when the payment is in the trip currency', async () => {
      const other = await tenant.addUser('Third traveller')
      const trip = await createTrip(tenant.scope, { title: 'Porto again' })
      await addTripMember(tenant.scope, {
        tripId: trip.id,
        userId: other,
        role: 'editor',
      })

      await createExpense(tenant.scope, {
        tripId: trip.id,
        title: 'Taxi',
        amountMinor: 4_000,
        spentOn: '2026-07-01',
        paidBy: tenant.ownerUserId,
        participants: [{ userId: tenant.ownerUserId }, { userId: other }],
      })

      const settlement = await createSettlement(tenant.scope, {
        tripId: trip.id,
        fromUserId: other,
        toUserId: tenant.ownerUserId,
        amountMinor: 2_000,
        settledOn: '2026-07-02',
      })

      expect(settlement.originalAmountMinor).toBeNull()
      expect(settlement.originalCurrency).toBeNull()
      expect(settlement.exchangeRate).toBeNull()

      const balances = await getMemberBalances(tenant.scope, trip.id)
      expect(balances.every((row) => row.balanceMinor === 0)).toBe(true)
    })

    it('names a misspelled settlement field instead of dropping it', () => {
      const body = {
        tripId: 'trip-1',
        fromUserId: 'user-1',
        toUserId: 'user-2',
        amountMinor: 2_000,
        settledOn: '2026-07-02',
      }
      expect(createSettlementInput.safeParse(body).success).toBe(true)

      // The input is strict: `originalAmount` is not `originalAmountMinor`, and a source amount
      // quietly discarded would leave a converted payment recorded as if it never converted.
      const result = createSettlementInput.safeParse({
        ...body,
        originalAmount: 59_600,
      })
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.code).toBe('unrecognized_keys')
      expect(result.error?.message).toContain('originalAmount')
    })
  })

  describe('lists', () => {
    it('tracks progress, applies a template and resets', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Weekend' })
      const list = await createList(tenant.scope, {
        tripId: trip.id,
        name: 'Bag',
      })
      const boots = await createListItem(tenant.scope, {
        listId: list.id,
        name: 'Boots',
        weightGrams: 900,
      })
      await createListItem(tenant.scope, {
        listId: list.id,
        name: 'Socks',
        weightGrams: 100,
      })

      await setListItemDone(tenant.scope, boots.id, true)
      const progress = (
        await listTripListsWithProgress(tenant.scope, trip.id)
      ).at(0)
      expect(progress?.itemCount).toBe(2)
      expect(progress?.doneCount).toBe(1)
      expect(progress?.weightGrams).toBe(1_000)

      expect(await resetList(tenant.scope, list.id)).toBe(1)
      const afterReset = (
        await listTripListsWithProgress(tenant.scope, trip.id)
      ).at(0)
      expect(afterReset?.doneCount).toBe(0)

      const template = await createTemplateFromList(
        tenant.scope,
        list.id,
        'Weekend bag',
      )
      const applied = await applyTemplateToTrip(tenant.scope, {
        templateId: template.id,
        tripId: trip.id,
        name: 'Second bag',
      })
      expect(applied.list.name).toBe('Second bag')
      expect(applied.items.map((item) => item.name)).toEqual(['Boots', 'Socks'])

      const fresh = await createTemplate(tenant.scope, {
        name: 'Beach',
        items: [{ name: 'Towel' }],
      })
      const beach = await applyTemplateToTrip(tenant.scope, {
        templateId: fresh.id,
        tripId: trip.id,
      })
      expect(beach.list.name).toBe('Beach')
      expect(beach.items).toHaveLength(1)
    })
  })

  describe('collaboration', () => {
    it('hides soft-deleted messages and tallies polls', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Group trip' })
      const kept = await postMessage(tenant.scope, {
        tripId: trip.id,
        body: 'Morning',
      })
      const removed = await postMessage(tenant.scope, {
        tripId: trip.id,
        body: 'Oops',
      })
      await deleteMessage(tenant.scope, removed.id)

      const page = await listMessages(tenant.scope, trip.id)
      expect(page.items.map((row) => row.id)).toEqual([kept.id])

      await createCollabNote(tenant.scope, {
        tripId: trip.id,
        title: 'Loose',
        isPinned: false,
      })
      await createCollabNote(tenant.scope, {
        tripId: trip.id,
        title: 'Pinned',
        isPinned: true,
      })
      expect(
        (await listNotes(tenant.scope, trip.id)).map((note) => note.title),
      ).toEqual(['Pinned', 'Loose'])

      const poll = await createPoll(tenant.scope, {
        tripId: trip.id,
        question: 'Beach or hike?',
        options: [
          { id: 'beach', label: 'Beach' },
          { id: 'hike', label: 'Hike' },
        ],
      })
      await castVote(tenant.scope, poll.id, 'beach')
      // A single-choice poll replaces the previous answer.
      await castVote(tenant.scope, poll.id, 'hike')

      const result = await getPollResult(tenant.scope, poll.id)
      expect(result.totalVotes).toBe(1)
      expect(result.tally.map((entry) => entry.votes)).toEqual([0, 1])

      // Voting for the same option again withdraws it.
      await castVote(tenant.scope, poll.id, 'hike')
      expect((await getPollResult(tenant.scope, poll.id)).totalVotes).toBe(0)
    })

    it('filters collection places by label', async () => {
      const collection = await createCollection(tenant.scope, {
        name: 'Lisbon ideas',
      })
      const bakery = await addCollectionPlace(tenant.scope, {
        collectionId: collection.id,
        name: 'Pastelaria',
      })
      await addCollectionPlace(tenant.scope, {
        collectionId: collection.id,
        name: 'Viewpoint',
      })
      const food = await createLabel(tenant.scope, {
        collectionId: collection.id,
        name: 'Food',
      })

      await setCollectionPlaceLabels(tenant.scope, bakery.id, [food.id])

      const filtered = await listCollectionPlaces(tenant.scope, {
        collectionId: collection.id,
        labelIds: [food.id],
      })
      expect(filtered.map((row) => row.name)).toEqual(['Pastelaria'])

      const withLabels = await listCollectionPlacesWithLabels(
        tenant.scope,
        collection.id,
      )
      expect(withLabels.find((row) => row.id === bakery.id)?.labelIds).toEqual([
        food.id,
      ])
    })
  })

  describe('atlas', () => {
    it('merges repeat visits and rolls up by continent', async () => {
      await markCountryVisited(tenant.scope, {
        countryCode: 'PT',
        continent: 'Europe',
        visitedOn: '2024-05-01',
      })
      const second = await markCountryVisited(tenant.scope, {
        countryCode: 'PT',
        continent: 'Europe',
        visitedOn: '2026-04-10',
      })
      expect(second.visitCount).toBe(2)
      expect(second.firstVisitedOn).toBe('2024-05-01')
      expect(second.lastVisitedOn).toBe('2026-04-10')
      expect(
        await listVisitedCountries(tenant.scope, tenant.ownerUserId),
      ).toHaveLength(1)

      await markCountryVisited(tenant.scope, {
        countryCode: 'JP',
        continent: 'Asia',
      })
      const goal = await createBucketListItem(tenant.scope, {
        name: 'Iceland',
        kind: 'country',
        countryCode: 'IS',
      })
      await achieveBucketListItem(tenant.scope, goal.id, '2026-09-01')

      const summary = await getAtlasSummary(tenant.scope, tenant.ownerUserId)
      expect(summary.countryCount).toBe(3)
      expect(summary.bucketList).toEqual({ total: 1, achieved: 1 })
      // Countries recorded without a continent are simply absent from the roll-up.
      expect(
        summary.byContinent.map((entry) => entry.continent).sort(),
      ).toEqual(['Asia', 'Europe'])

      const trip = await createTrip(tenant.scope, {
        title: 'Tokyo',
        startDate: '2026-03-01',
        endDate: '2026-03-04',
        countryCodes: ['JP'],
      })
      await createPlace(tenant.scope, {
        tripId: trip.id,
        name: 'Shibuya',
        city: 'Tokyo',
      })
      const stats = await recomputeTravelStats(
        tenant.scope,
        tenant.ownerUserId,
        2026,
      )
      expect(stats.tripCount).toBe(1)
      expect(stats.dayCount).toBe(4)
      expect(stats.placeCount).toBe(1)
      expect(stats.cityCount).toBe(1)
      // A year row counts the countries that year's trips went to — not the
      // traveller's lifetime list, which is 3 here and belongs to `statYear` 0.
      expect(stats.countryCount).toBe(1)
      expect(stats.lastTripId).toBe(trip.id)

      const allTime = await recomputeTravelStats(
        tenant.scope,
        tenant.ownerUserId,
      )
      expect(allTime.countryCount).toBe(3)
    })

    /**
     * Distance is the one figure a year row does *not* read through that year's trips.
     *
     * A transport carries its own `departure_date`, and a trip that starts on 30 December has
     * transports in two calendar years. Filing January's flight under the previous year — which is
     * what filtering the legs by the trip's `start_date` would do — is the failure this asserts
     * against, and it is the entire reason the distance read filters on the traveller's *whole*
     * membership rather than on the year's trip ids.
     */
    it('files a leg under the year it departed in, not the year its trip started', async () => {
      const trip = await createTrip(tenant.scope, {
        title: 'New Year in Lisbon',
        startDate: '2025-12-30',
        endDate: '2026-01-05',
        countryCodes: ['PT'],
      })
      await createTransport(tenant.scope, {
        tripId: trip.id,
        title: 'Flight home',
        mode: 'flight',
        distanceMetres: 3_000_000,
        departureDate: '2026-01-02',
      })

      // 2026 has no trip of its own — the trip started in 2025 — and still carries the distance.
      const departureYear = await recomputeTravelStats(
        tenant.scope,
        tenant.ownerUserId,
        2026,
      )
      expect(departureYear.tripCount).toBe(0)
      expect(departureYear.distanceMetres).toBe(3_000_000)

      // 2025 owns the trip and none of the distance.
      const startYear = await recomputeTravelStats(
        tenant.scope,
        tenant.ownerUserId,
        2025,
      )
      expect(startYear.tripCount).toBe(1)
      expect(startYear.distanceMetres).toBe(0)

      // All time sums it once.
      const allTime = await recomputeTravelStats(
        tenant.scope,
        tenant.ownerUserId,
      )
      expect(allTime.distanceMetres).toBe(3_000_000)
    })

    /**
     * D1 refuses a statement carrying more than {@link MAX_BOUND_PARAMETERS} bound parameters and
     * drizzle binds one per id, so the aggregates behind a stat row cannot filter on a materialized
     * list of the cohort's trip ids: the paid plans sell unlimited trips, so nothing caps that list
     * (#381).
     *
     * The assertion is on the SQL rather than on a rejection, because nothing here rejects —
     * `node:sqlite` accepts the statement D1 would refuse, which is exactly why those four reads
     * looked verified while failing in the cron trigger and the queue consumer, where nobody is
     * watching. Counting placeholders is the ceiling this harness can see. The figures are asserted
     * beside it, because a read that stops binding ids is only a fix while it still counts the same
     * rows.
     */
    it('keeps every statement under D1’s parameter ceiling on a year cohort that exceeds it', async () => {
      // The default tier caps trips long before the ceiling; `solo` is one of the plans that sells
      // the unlimited cohort this test is about.
      await subscribeTenant(tenant.scope, 'solo')

      const cohort = MAX_BOUND_PARAMETERS + 1
      for (let index = 0; index < cohort; index += 1) {
        const trip = await createTrip(tenant.scope, {
          title: `Hop ${index}`,
          startDate: '2026-04-01',
          endDate: '2026-04-01',
        })
        // Three cities across the whole cohort, so the distinct count cannot be read off the trip
        // count, and a city that recurs at both ends of the list has to be merged rather than
        // counted twice.
        await createPlace(tenant.scope, {
          tripId: trip.id,
          name: `Stop ${index}`,
          city: `City ${index % 3}`,
        })
        // One expense at each end: enough to prove the sum spans the cohort without seeding a
        // hundred rows that assert nothing extra.
        if (index === 0 || index === cohort - 1) {
          await createExpense(tenant.scope, {
            tripId: trip.id,
            title: 'Coffee',
            amountMinor: 450,
            spentOn: '2026-04-01',
          })
        }
      }

      const widestStatement = (): number =>
        Math.max(
          ...harness.statements.map((sql) => (sql.match(/\?/g) ?? []).length),
        )

      harness.statements.length = 0
      const year = await recomputeTravelStats(
        tenant.scope,
        tenant.ownerUserId,
        2026,
      )

      expect(widestStatement()).toBeLessThanOrEqual(MAX_BOUND_PARAMETERS)
      expect(year.tripCount).toBe(cohort)
      expect(year.dayCount).toBe(cohort)
      expect(year.placeCount).toBe(cohort)
      expect(year.cityCount).toBe(3)
      expect(year.spendMinor).toBe(900)

      // The all-time row runs the same four reads over a cohort that is a lifetime rather than a
      // year, so it is the one that crosses the ceiling first — and it is a different branch of
      // `recomputeTravelStats`, because `statYear = 0` drops the date bounds from the predicate.
      harness.statements.length = 0
      const allTime = await recomputeTravelStats(
        tenant.scope,
        tenant.ownerUserId,
      )

      expect(widestStatement()).toBeLessThanOrEqual(MAX_BOUND_PARAMETERS)
      expect(allTime.tripCount).toBe(cohort)
      expect(allTime.dayCount).toBe(cohort)
      expect(allTime.placeCount).toBe(cohort)
      expect(allTime.cityCount).toBe(3)
      expect(allTime.spendMinor).toBe(900)
    })
  })

  describe('vacay', () => {
    it('marks a range in one batch and subtracts it from the allowance', async () => {
      const plan = await ensurePlan(tenant.scope)
      await setEntitlement(tenant.scope, {
        planId: plan.id,
        year: 2026,
        entitlementDays: 25,
      })

      await setEntryRange(tenant.scope, {
        planId: plan.id,
        from: '2026-08-03',
        to: '2026-08-07',
        kind: 'vacation',
      })
      await setEntry(tenant.scope, {
        planId: plan.id,
        date: '2026-08-10',
        kind: 'half_day',
      })
      await setEntry(tenant.scope, {
        planId: plan.id,
        date: '2026-08-11',
        kind: 'sick',
      })

      expect(
        await countUsedDays(tenant.scope, plan.id, tenant.ownerUserId, 2026),
      ).toBe(5.5)

      const overview = await getPlanOverview(tenant.scope, plan.id, 2026)
      expect(overview.entries).toHaveLength(7)
      const balance = overview.balances.find(
        (row) => row.userId === tenant.ownerUserId,
      )
      expect(balance?.entitlementDays).toBe(25)
      expect(balance?.usedDays).toBe(5.5)
      expect(balance?.remainingDays).toBe(19.5)

      // Re-marking a day replaces its kind instead of adding a second row.
      await setEntry(tenant.scope, {
        planId: plan.id,
        date: '2026-08-10',
        kind: 'vacation',
      })
      expect(
        await countUsedDays(tenant.scope, plan.id, tenant.ownerUserId, 2026),
      ).toBe(6)
    })
  })

  describe('notifications, audit and usage', () => {
    it('counts unread, marks all read and honours opt-outs', async () => {
      const other = await tenant.addUser('Second traveller')

      await notify(tenant.scope, {
        recipientUserId: tenant.ownerUserId,
        titleKey: 'trip.updated.title',
        bodyKey: 'trip.updated.body',
      })
      await notifyMany(tenant.scope, [tenant.ownerUserId, other, other], {
        titleKey: 'trip.invited.title',
        bodyKey: 'trip.invited.body',
        type: 'action',
      })

      expect(await countUnread(tenant.scope, tenant.ownerUserId)).toBe(2)
      expect(await countUnread(tenant.scope, other)).toBe(1)

      const page = await listNotifications(tenant.scope, tenant.ownerUserId, {
        limit: 1,
      })
      expect(page.items).toHaveLength(1)
      expect(page.nextCursor).not.toBeNull()

      expect(await markAllRead(tenant.scope, tenant.ownerUserId)).toBe(2)
      expect(await countUnread(tenant.scope, tenant.ownerUserId)).toBe(0)

      await setPreference(tenant.scope, {
        userId: other,
        eventType: 'trip.invited',
        channel: 'email',
        isEnabled: false,
      })
      expect(
        await filterEnabledRecipients(
          tenant.scope,
          [tenant.ownerUserId, other],
          'trip.invited',
          'email',
        ),
      ).toEqual([tenant.ownerUserId])
    })

    it('appends an audit trail and groups it by action', async () => {
      await recordAudit(tenant.scope, {
        action: 'trip.created',
        entityType: 'trip',
        entityId: 't1',
      })
      await recordAuditMany(tenant.scope, [
        { action: 'place.created', entityType: 'place', entityId: 'p1' },
        { action: 'place.created', entityType: 'place', entityId: 'p2' },
      ])

      const page = await listAuditLog(tenant.scope, { action: 'place.created' })
      expect(page.items).toHaveLength(2)

      const grouped = await countAuditActions(tenant.scope)
      expect(grouped[0]).toEqual({ action: 'place.created', value: 2 })
    })

    it('moves usage counters without dropping concurrent increments', async () => {
      const month = new Date().toISOString().slice(0, 7)
      await bumpUsage(tenant.scope, 'exports', 1, month)
      await Promise.all([
        bumpUsage(tenant.scope, 'exports', 1, month),
        bumpUsage(tenant.scope, 'exports', 1, month),
      ])
      expect((await getMonthlyUsage(tenant.scope, month)).get('exports')).toBe(
        3,
      )

      // Clamped at zero rather than going negative.
      await bumpUsage(tenant.scope, 'exports', -10, month)
      expect((await getMonthlyUsage(tenant.scope, month)).get('exports')).toBe(
        0,
      )
    })

    it('reports the free plan and its ceilings when there is no subscription', async () => {
      const summary = await getPlanSummary(tenant.scope)
      expect(summary.plan).toBe('free')
      expect(summary.planId).toBe('free')
      // The published number *is* the enforced number now that one resolver answers
      // both: the catalogue sells "2 trips at a time", so two is what is allowed.
      expect(summary.limits.trips).toBe(PLANS.free.limits.trips)
      expect(summary.limits.members).toBe(PLANS.free.limits.seats)
      expect(summary.limits.storage_bytes).toBe(PLANS.free.limits.storageBytes)
      expect(summary.seats).toBe(1)
    })
  })

  describe('transports', () => {
    it('summarises transports by mode and totals the distance', async () => {
      const trip = await createTrip(tenant.scope, { title: 'Island hop' })
      await createTransport(tenant.scope, {
        tripId: trip.id,
        title: 'Flight out',
        mode: 'flight',
        distanceMetres: 2_000_000,
        departureDate: '2026-04-10',
      })
      await createTransport(tenant.scope, {
        tripId: trip.id,
        title: 'Ferry',
        mode: 'ferry',
        distanceMetres: 40_000,
        departureDate: '2026-04-12',
      })
      await createTransport(tenant.scope, {
        tripId: trip.id,
        title: 'Flight back',
        mode: 'flight',
        distanceMetres: 2_000_000,
        departureDate: '2026-04-17',
      })

      const summary = await summariseTripTransports(tenant.scope, trip.id)
      expect(summary[0]).toEqual({
        mode: 'flight',
        count: 2,
        distanceMetres: 4_000_000,
      })
      expect(await totalTripDistanceMetres(tenant.scope, trip.id)).toBe(
        4_040_000,
      )
    })
  })
  describe('the travel journal', () => {
    // These read across several trips at once, which the Free plan's two-trip ceiling
    // will not hold. Solo is the plan that sells unlimited trips.
    beforeEach(async () => {
      await subscribeTenant(tenant.scope, 'solo')
    })

    it('reads the journal index: latest entries, moods, coverage and what is unwritten', async () => {
      const dolomites = await createTrip(tenant.scope, {
        title: 'Dolomites, hut to hut',
        startDate: '2026-06-13',
        endDate: '2026-06-20',
      })
      const lisbon = await createTrip(tenant.scope, {
        title: 'Lisbon, slowly',
        startDate: '2026-08-17',
        endDate: '2026-08-23',
      })
      const tokyo = await createTrip(tenant.scope, {
        title: 'Tokyo & Kyoto',
        startDate: '2026-10-09',
        endDate: '2026-10-20',
      })

      const awed = await createMood(tenant.scope, {
        key: 'awed',
        label: 'Awed',
        emoji: '🏔️',
      })
      const weary = await createMood(tenant.scope, {
        key: 'weary',
        label: 'Weary',
        emoji: '🌙',
      })

      const journey = await createJourney(tenant.scope, {
        title: 'Ninety-four kilometres of limestone',
        tripId: dolomites.id,
      })
      const first = await createEntry(tenant.scope, {
        journeyId: journey.id,
        entryDate: '2026-06-16',
        title: 'Six-fifteen at Braies',
        body: 'The car park was empty.',
        moodId: awed.id,
      })
      const last = await createEntry(tenant.scope, {
        journeyId: journey.id,
        entryDate: '2026-06-18',
        title: 'The loop, anticlockwise',
        moodId: weary.id,
      })
      await createEntry(tenant.scope, {
        journeyId: journey.id,
        entryDate: '2026-06-14',
        title: 'No mood recorded',
      })
      await addPhoto(tenant.scope, {
        journeyId: journey.id,
        entryId: last.id,
        storageKey: `photos/${tenant.organizationId}/lagazuoi.jpg`,
        contentType: 'image/jpeg',
        sizeBytes: 204_800,
      })

      const recent = await listRecentEntries(tenant.scope, { limit: 2 })
      expect(recent.map((row) => row.entry.id)).toEqual([last.id, first.id])
      expect(recent[0].journeyTitle).toBe('Ninety-four kilometres of limestone')
      expect(recent[0].mood?.label).toBe('Weary')
      expect(recent[0].photoCount).toBe(1)
      expect(recent[1].photoCount).toBe(0)

      // The moodless entry is counted nowhere, so the tally never over-reports.
      const moods = await tallyMoods(tenant.scope)
      expect(moods.map((row) => [row.mood.label, row.value])).toEqual([
        ['Awed', 1],
        ['Weary', 1],
      ])

      expect(await journalCoverage(tenant.scope)).toEqual({
        trips: 3,
        written: 1,
      })

      // Ranked, not merely date-ordered: the trip under way comes before the one
      // still ahead, and the trip already written up is absent altogether.
      const unwritten = await listTripsWithoutJourney(tenant.scope, {
        today: '2026-08-19',
        limit: 4,
      })
      expect(unwritten.map((trip) => trip.id)).toEqual([lisbon.id, tokyo.id])
      expect(unwritten.some((trip) => trip.id === dolomites.id)).toBe(false)
    })

    it('puts the trip that has just ended first and the undated one last', async () => {
      const past = await createTrip(tenant.scope, {
        title: 'Marrakech riad week',
        startDate: '2025-11-08',
        endDate: '2025-11-15',
      })
      const older = await createTrip(tenant.scope, {
        title: 'Vienna, two nights',
        startDate: '2025-02-01',
        endDate: '2025-02-03',
      })
      const someday = await createTrip(tenant.scope, {
        title: 'Patagonia traverse',
      })

      expect(
        (
          await listTripsWithoutJourney(tenant.scope, { today: '2026-08-19' })
        ).map((trip) => trip.id),
      ).toEqual([past.id, older.id, someday.id])
    })

    it('reports an empty journal without inventing anything', async () => {
      expect(await listRecentEntries(tenant.scope)).toEqual([])
      expect(await tallyMoods(tenant.scope)).toEqual([])
      expect(await journalCoverage(tenant.scope)).toEqual({
        trips: 0,
        written: 0,
      })
      expect(await listTripsWithoutJourney(tenant.scope)).toEqual([])
    })
  })
})
