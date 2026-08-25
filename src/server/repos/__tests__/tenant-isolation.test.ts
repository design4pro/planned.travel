/**
 * Tenant isolation — the contract the whole data layer exists to keep.
 *
 * Two organizations are seeded with an identical, complete set of rows. Every repository is then
 * asked, from organization A's scope, to read, list, update and delete organization B's rows by id,
 * and to parent new rows onto B's rows. None of it may work, and B's data must be untouched
 * afterwards. A cross-tenant id is a `NotFoundError`, never a row quietly re-scoped into the caller's
 * own organization.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  assignmentParticipants,
  collabMessageReactions,
  collectionPlaceLabels,
  placeTags,
} from '#/server/db/schema'
import { NotFoundError, QuotaExceededError } from '../context'
import {
  bucketListRepository,
  markCountryVisited,
  markRegionVisited,
  travelStatsRepository,
  upsertTravelStats,
  visitedCountriesRepository,
  visitedRegionsRepository,
} from '../atlas'
import { auditLogRepository, recordAudit } from '../audit'
import {
  getSubscription,
  setUsage,
  subscriptionsRepository,
  upsertSubscription,
  upsertSubscriptionUnscoped,
  usageRecordsRepository,
} from '../billing'
import { categoriesRepository, createCategory } from '../categories'
import {
  castVote,
  checkInsRepository,
  collabMessageReactionsAccess,
  collabMessagesRepository,
  collabNotesRepository,
  collabPollVotesRepository,
  collabPollsRepository,
  createCheckIn,
  createCollabNote,
  createPoll,
  editMessage,
  listMessages,
  postMessage,
  toggleReaction,
} from '../collab'
import {
  addCollectionPlace,
  collectionLabelsRepository,
  collectionPlacesRepository,
  collectionsRepository,
  createCollection,
  createLabel,
  listCollectionsWithCounts,
  saveTripPlaceToCollection,
  setCollectionPlaceLabels,
} from '../collections'
import { getDashboardSummary } from '../dashboard'
import { createDayNote, dayNotesRepository, daysRepository, listTripDays } from '../days'
import {
  budgetItemsRepository,
  computeShares,
  createBudgetItem,
  createExpense,
  createSettlement,
  expenseSharesRepository,
  expensesRepository,
  getMemberBalances,
  getTripSpendSummary,
  settlementsRepository,
} from '../expenses'
import { getStorageUsage, recordFile, tripFilesRepository } from '../files'
import {
  createAccommodation,
  createAssignment,
  dayAccommodationsRepository,
  dayAssignmentsRepository,
  getTripItinerary,
  setAssignmentParticipants,
} from '../itinerary'
import {
  addPhoto,
  createEntry,
  createJourney,
  createMood,
  journeyEntriesRepository,
  journeyMoodsRepository,
  journeyPhotosRepository,
  journeysRepository,
} from '../journey'
import {
  applyTemplateToTrip,
  createList,
  createListItem,
  createTemplate,
  packingItemsRepository,
  packingListsRepository,
  packingTemplateItemsRepository,
  packingTemplatesRepository,
} from '../lists'
import {
  changeMemberRole,
  createInvitation,
  getOrganization,
  invitationsRepository,
  listMemberProfiles,
  membersRepository,
  updateOrganization,
} from '../members'
import {
  markRead,
  notificationPreferencesRepository,
  notificationsRepository,
  notify,
  setPreference,
} from '../notifications'
import { createPlace, placesRepository, setPlaceTags } from '../places'
import { createReservation, reservationsRepository } from '../reservations'
import {
  appSettingsStore,
  ensureOrganizationSettings,
  getEffectiveSettings,
  getUserSettings,
  organizationSettingsRepository,
  updateOrganizationSettings,
  updateUserSettings,
  userSettingsRepository,
} from '../settings'
import { createTag, tagsRepository } from '../tags'
import { createTransport, transportsRepository } from '../transports'
import {
  countTripsByStatus,
  createShareLink,
  createTrip,
  shareLinksRepository,
  tripMembersRepository,
  tripsRepository,
  updateTrip,
} from '../trips'
import {
  addCompanyHoliday,
  addHolidayCalendar,
  ensurePlan,
  ensureYear,
  setEntitlement,
  setEntry,
  setUserColour,
  vacayCompanyHolidaysRepository,
  vacayEntriesRepository,
  vacayHolidayCalendarsRepository,
  vacayPlanMembersRepository,
  vacayPlansRepository,
  vacayUserColoursRepository,
  vacayUserYearsRepository,
  vacayYearsRepository,
} from '../vacay'
import { captureError, createHarness } from './harness'
import type { KeyedTenantTable, TenantPatch, TenantRepository, TenantScope } from '../base'
import type { Harness, SeededTenant } from './harness'

/* -------------------------------------------------------------------------------------------------
 * Fixtures
 * ---------------------------------------------------------------------------------------------- */

/** One row in every table the tenant owns, so isolation can be asserted table by table. */
interface World {
  readonly tenant: SeededTenant
  readonly secondUserId: string
  readonly tripId: string
  readonly dayId: string
  readonly lastDayId: string
  readonly categoryId: string
  readonly tagId: string
  readonly placeId: string
  readonly dayNoteId: string
  readonly assignmentId: string
  readonly accommodationId: string
  readonly transportId: string
  readonly reservationId: string
  readonly budgetItemId: string
  readonly expenseId: string
  readonly expenseShareId: string
  readonly settlementId: string
  readonly listId: string
  readonly listItemId: string
  readonly templateId: string
  readonly templateItemId: string
  readonly fileId: string
  readonly shareLinkId: string
  readonly tripMemberId: string
  readonly messageId: string
  readonly collabNoteId: string
  readonly pollId: string
  readonly voteId: string
  readonly checkInId: string
  readonly collectionId: string
  readonly collectionPlaceId: string
  readonly labelId: string
  readonly moodId: string
  readonly journeyId: string
  readonly journeyEntryId: string
  readonly journeyPhotoId: string
  readonly visitedCountryId: string
  readonly visitedRegionId: string
  readonly travelStatsId: string
  readonly bucketItemId: string
  readonly planId: string
  readonly planMemberId: string
  readonly vacayYearId: string
  readonly userYearId: string
  readonly vacayEntryId: string
  readonly companyHolidayId: string
  readonly holidayCalendarId: string
  readonly userColourId: string
  readonly notificationId: string
  readonly preferenceId: string
  readonly auditId: string
  readonly memberId: string
  readonly invitationId: string
  readonly subscriptionId: string
  readonly usageRecordId: string
  readonly organizationSettingsId: string
  readonly userSettingsId: string
}

const POLL_OPTIONS = [
  { id: 'sunrise', label: 'Sunrise hike' },
  { id: 'market', label: 'Morning market' },
]

/** Seeds one complete tenant through the public repository API. */
async function seedWorld(tenant: SeededTenant): Promise<World> {
  const scope = tenant.scope
  // A paid plan first: the seed adds a second traveller and an invitation, which the free plan's
  // single seat would refuse. Written as a tier-only row on purpose — that is what a subscription
  // predating the price catalogue looks like, and the resolver has to keep reading it. The quota
  // guards themselves are exercised in their own test.
  const subscription = await upsertSubscription(scope, { plan: 'pro', status: 'active', seats: 5 })
  const secondUserId = await tenant.addUser('Second traveller')

  const trip = await createTrip(scope, {
    title: 'Lisbon in spring',
    startDate: '2026-04-10',
    endDate: '2026-04-12',
    destination: 'Lisbon, Portugal',
    currency: 'EUR',
  })
  const days = await listTripDays(scope, trip.id)
  const firstDay = days.at(0)
  const lastDay = days.at(-1)
  if (firstDay === undefined || lastDay === undefined) {
    throw new Error('Creating a trip with a date range must create its days.')
  }

  const category = await createCategory(scope, { name: 'Bakeries' })
  const tag = await createTag(scope, { name: 'Must see' })
  const place = await createPlace(scope, {
    tripId: trip.id,
    name: 'Miradouro da Senhora do Monte',
    categoryId: category.id,
    lat: 38.7167,
    lng: -9.1333,
    countryCode: 'PT',
  })
  await setPlaceTags(scope, place.id, [tag.id])

  const dayNote = await createDayNote(scope, {
    tripId: trip.id,
    dayId: firstDay.id,
    body: 'Buy the transit pass at the airport.',
  })
  const assignment = await createAssignment(scope, {
    tripId: trip.id,
    dayId: firstDay.id,
    placeId: place.id,
    startTime: '09:30',
  })
  await setAssignmentParticipants(scope, assignment.id, [tenant.ownerUserId, secondUserId])

  const accommodation = await createAccommodation(scope, {
    tripId: trip.id,
    startDayId: firstDay.id,
    endDayId: lastDay.id,
    name: 'Alfama guesthouse',
  })
  const transport = await createTransport(scope, {
    tripId: trip.id,
    dayId: firstDay.id,
    title: 'Flight to Lisbon',
    mode: 'flight',
    departureDate: '2026-04-10',
    departureTime: '07:05',
    distanceMetres: 1_720_000,
  })
  const reservation = await createReservation(scope, {
    tripId: trip.id,
    dayId: firstDay.id,
    placeId: place.id,
    transportId: transport.id,
    title: 'Guesthouse booking',
    type: 'accommodation',
    status: 'confirmed',
    startDate: '2026-04-10',
    priceMinor: 24_000,
    currency: 'EUR',
  })

  const budgetItem = await createBudgetItem(scope, {
    tripId: trip.id,
    name: 'Food',
    category: 'food',
    plannedAmountMinor: 30_000,
  })
  const expense = await createExpense(scope, {
    tripId: trip.id,
    dayId: firstDay.id,
    budgetItemId: budgetItem.id,
    title: 'Dinner in Alfama',
    category: 'food',
    amountMinor: 9_000,
    spentOn: '2026-04-10',
    paidBy: tenant.ownerUserId,
    participants: [{ userId: tenant.ownerUserId }, { userId: secondUserId }],
  })
  const expenseShare = expense.shares.at(0)
  if (expenseShare === undefined) {
    throw new Error('An expense with participants must produce shares.')
  }
  const settlement = await createSettlement(scope, {
    tripId: trip.id,
    fromUserId: secondUserId,
    toUserId: tenant.ownerUserId,
    amountMinor: 4_500,
    settledOn: '2026-04-13',
  })

  const list = await createList(scope, { tripId: trip.id, name: 'Carry-on', kind: 'packing' })
  const listItem = await createListItem(scope, { listId: list.id, name: 'Adapter' })
  const template = await createTemplate(scope, {
    name: 'City break',
    items: [{ name: 'Passport' }, { name: 'Charger' }],
  })
  const templateItems = await packingTemplateItemsRepository.findMany(scope)
  const templateItem = templateItems.at(0)
  if (templateItem === undefined) {
    throw new Error('A template created with items must have items.')
  }

  const file = await recordFile(scope, {
    tripId: trip.id,
    storageKey: `files/${tenant.organizationId}/booking.pdf`,
    filename: 'booking.pdf',
    contentType: 'application/pdf',
    sizeBytes: 20_480,
    kind: 'ticket',
    reservationId: reservation.id,
  })
  const shareLink = await createShareLink(scope, {
    tripId: trip.id,
    token: `share-${tenant.organizationId}`,
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
  const tripMembers = await tripMembersRepository.findMany(scope)
  const tripMember = tripMembers.at(0)
  if (tripMember === undefined) {
    throw new Error('Creating a trip must create its owner membership.')
  }

  const message = await postMessage(scope, { tripId: trip.id, body: 'Landed, heading in.' })
  await toggleReaction(scope, message.id, '🎉')
  const collabNote = await createCollabNote(scope, {
    tripId: trip.id,
    title: 'Ideas',
    body: 'Tram 28 early, before the queues.',
  })
  const poll = await createPoll(scope, {
    tripId: trip.id,
    question: 'Which morning?',
    options: POLL_OPTIONS,
  })
  const votes = await castVote(scope, poll.id, 'sunrise')
  const vote = votes.at(0)
  if (vote === undefined) {
    throw new Error('Casting a vote must record it.')
  }
  const checkIn = await createCheckIn(scope, {
    tripId: trip.id,
    placeId: place.id,
    name: 'Miradouro',
    countryCode: 'PT',
  })

  const collection = await createCollection(scope, { name: 'Someday' })
  const collectionPlace = await addCollectionPlace(scope, {
    collectionId: collection.id,
    name: 'Time Out Market',
    countryCode: 'PT',
  })
  const label = await createLabel(scope, { collectionId: collection.id, name: 'Food' })
  await setCollectionPlaceLabels(scope, collectionPlace.id, [label.id])

  const mood = await createMood(scope, { key: 'sunny', label: 'Sunny', emoji: '☀️' })
  const journey = await createJourney(scope, { title: 'Lisbon notebook', tripId: trip.id })
  const journeyEntry = await createEntry(scope, {
    journeyId: journey.id,
    entryDate: '2026-04-10',
    body: 'Custard tarts, twice.',
    moodId: mood.id,
    checkInId: checkIn.id,
  })
  const photo = await addPhoto(scope, {
    journeyId: journey.id,
    entryId: journeyEntry.id,
    storageKey: `photos/${tenant.organizationId}/tarts.jpg`,
    contentType: 'image/jpeg',
    sizeBytes: 102_400,
  })

  const visitedCountry = await markCountryVisited(scope, {
    countryCode: 'PT',
    continent: 'Europe',
    visitedOn: '2026-04-10',
  })
  const visitedRegion = await markRegionVisited(scope, {
    countryCode: 'PT',
    regionCode: 'PT-11',
    regionName: 'Lisboa',
  })
  const travelStat = await upsertTravelStats(scope, { statYear: 2026, tripCount: 1 })
  const bucketItem = await bucketListRepository.insert(scope, {
    userId: tenant.ownerUserId,
    name: 'Azores',
    kind: 'country',
    countryCode: 'PT',
  })

  const plan = await ensurePlan(scope)
  const planMembers = await vacayPlanMembersRepository.findMany(scope)
  const planMember = planMembers.at(0)
  if (planMember === undefined) {
    throw new Error('Creating a plan must create its owner membership.')
  }
  const vacayYear = await ensureYear(scope, plan.id, 2026)
  const userYear = await setEntitlement(scope, { planId: plan.id, year: 2026, entitlementDays: 28 })
  const vacayEntry = await setEntry(scope, { planId: plan.id, date: '2026-04-10', kind: 'vacation' })
  const companyHoliday = await addCompanyHoliday(scope, {
    planId: plan.id,
    date: '2026-12-24',
    label: 'Office closed',
  })
  const holidayCalendar = await addHolidayCalendar(scope, { planId: plan.id, region: 'PT' })
  const userColour = await setUserColour(scope, plan.id, tenant.ownerUserId, '#2F6F5E')

  const notification = await notify(scope, {
    recipientUserId: tenant.ownerUserId,
    titleKey: 'trip.invited.title',
    bodyKey: 'trip.invited.body',
    type: 'action',
    entityType: 'trip',
    entityId: trip.id,
  })
  const preference = await setPreference(scope, {
    eventType: 'trip.invited',
    channel: 'email',
    isEnabled: false,
  })
  const audit = await recordAudit(scope, {
    action: 'trip.created',
    entityType: 'trip',
    entityId: trip.id,
  })

  const memberships = await membersRepository.findMany(scope)
  const membership = memberships.at(0)
  if (membership === undefined) {
    throw new Error('A seeded tenant must have a member row.')
  }
  const invitation = await createInvitation(scope, {
    email: `invitee-${tenant.organizationId}@example.test`,
    expiresAt: new Date(Date.now() + 86_400_000),
  })

  const usageRecord = await setUsage(scope, { metric: 'trips', value: 1 })
  const organizationSettings = await ensureOrganizationSettings(scope)
  const userSettings = await updateUserSettings(scope, { theme: 'dark' })

  return {
    tenant,
    secondUserId,
    tripId: trip.id,
    dayId: firstDay.id,
    lastDayId: lastDay.id,
    categoryId: category.id,
    tagId: tag.id,
    placeId: place.id,
    dayNoteId: dayNote.id,
    assignmentId: assignment.id,
    accommodationId: accommodation.id,
    transportId: transport.id,
    reservationId: reservation.id,
    budgetItemId: budgetItem.id,
    expenseId: expense.expense.id,
    expenseShareId: expenseShare.id,
    settlementId: settlement.id,
    listId: list.id,
    listItemId: listItem.id,
    templateId: template.id,
    templateItemId: templateItem.id,
    fileId: file.id,
    shareLinkId: shareLink.id,
    tripMemberId: tripMember.id,
    messageId: message.id,
    collabNoteId: collabNote.id,
    pollId: poll.id,
    voteId: vote.id,
    checkInId: checkIn.id,
    collectionId: collection.id,
    collectionPlaceId: collectionPlace.id,
    labelId: label.id,
    moodId: mood.id,
    journeyId: journey.id,
    journeyEntryId: journeyEntry.id,
    journeyPhotoId: photo.id,
    visitedCountryId: visitedCountry.id,
    visitedRegionId: visitedRegion.id,
    travelStatsId: travelStat.id,
    bucketItemId: bucketItem.id,
    planId: plan.id,
    planMemberId: planMember.id,
    vacayYearId: vacayYear.id,
    userYearId: userYear.id,
    vacayEntryId: vacayEntry.id,
    companyHolidayId: companyHoliday.id,
    holidayCalendarId: holidayCalendar.id,
    userColourId: userColour.id,
    notificationId: notification.id,
    preferenceId: preference.id,
    auditId: audit.id,
    memberId: membership.id,
    invitationId: invitation.id,
    subscriptionId: subscription.id,
    usageRecordId: usageRecord.id,
    organizationSettingsId: organizationSettings.id,
    userSettingsId: userSettings.id,
  }
}

/* -------------------------------------------------------------------------------------------------
 * Table-driven isolation over every keyed repository
 * ---------------------------------------------------------------------------------------------- */

interface IsolationCase {
  readonly name: string
  readonly pick: (world: World) => string
  readonly findById: (scope: TenantScope, id: string) => Promise<unknown>
  readonly requireById: (scope: TenantScope, id: string) => Promise<unknown>
  readonly listIds: (scope: TenantScope) => Promise<Array<string>>
  readonly update: (scope: TenantScope, id: string) => Promise<unknown>
  readonly remove: (scope: TenantScope, id: string) => Promise<boolean>
  readonly count: (scope: TenantScope) => Promise<number>
}

function isolationCase<TTable extends KeyedTenantTable>(
  name: string,
  repository: TenantRepository<TTable>,
  pick: (world: World) => string,
  patch: TenantPatch<TTable>,
): IsolationCase {
  return {
    name,
    pick,
    findById: (scope, id) => repository.findById(scope, id),
    requireById: (scope, id) => repository.requireById(scope, id),
    async listIds(scope) {
      const rows = await repository.findMany(scope)
      return rows.map((row) => String((row as { id: string }).id))
    },
    update: (scope, id) => repository.update(scope, id, patch),
    remove: (scope, id) => repository.remove(scope, id),
    count: (scope) => repository.count(scope),
  }
}

const cases: ReadonlyArray<IsolationCase> = [
  isolationCase('trips', tripsRepository, (w) => w.tripId, { title: 'hijacked' }),
  isolationCase('trip members', tripMembersRepository, (w) => w.tripMemberId, { role: 'viewer' }),
  isolationCase('share links', shareLinksRepository, (w) => w.shareLinkId, { viewCount: 99 }),
  isolationCase('days', daysRepository, (w) => w.dayId, { title: 'hijacked' }),
  isolationCase('day notes', dayNotesRepository, (w) => w.dayNoteId, { body: 'hijacked' }),
  isolationCase('categories', categoriesRepository, (w) => w.categoryId, { name: 'hijacked' }),
  isolationCase('tags', tagsRepository, (w) => w.tagId, { name: 'hijacked' }),
  isolationCase('places', placesRepository, (w) => w.placeId, { name: 'hijacked' }),
  isolationCase('day assignments', dayAssignmentsRepository, (w) => w.assignmentId, {
    notes: 'hijacked',
  }),
  isolationCase('accommodations', dayAccommodationsRepository, (w) => w.accommodationId, {
    name: 'hijacked',
  }),
  isolationCase('transports', transportsRepository, (w) => w.transportId, { title: 'hijacked' }),
  isolationCase('reservations', reservationsRepository, (w) => w.reservationId, {
    title: 'hijacked',
  }),
  isolationCase('budget items', budgetItemsRepository, (w) => w.budgetItemId, { name: 'hijacked' }),
  isolationCase('expenses', expensesRepository, (w) => w.expenseId, { title: 'hijacked' }),
  isolationCase('expense shares', expenseSharesRepository, (w) => w.expenseShareId, {
    isSettled: true,
  }),
  isolationCase('settlements', settlementsRepository, (w) => w.settlementId, { note: 'hijacked' }),
  isolationCase('lists', packingListsRepository, (w) => w.listId, { name: 'hijacked' }),
  isolationCase('list items', packingItemsRepository, (w) => w.listItemId, { name: 'hijacked' }),
  isolationCase('templates', packingTemplatesRepository, (w) => w.templateId, { name: 'hijacked' }),
  isolationCase('template items', packingTemplateItemsRepository, (w) => w.templateItemId, {
    name: 'hijacked',
  }),
  isolationCase('files', tripFilesRepository, (w) => w.fileId, { filename: 'hijacked.pdf' }),
  isolationCase('messages', collabMessagesRepository, (w) => w.messageId, { body: 'hijacked' }),
  isolationCase('collab notes', collabNotesRepository, (w) => w.collabNoteId, {
    title: 'hijacked',
  }),
  isolationCase('polls', collabPollsRepository, (w) => w.pollId, { question: 'hijacked?' }),
  isolationCase('poll votes', collabPollVotesRepository, (w) => w.voteId, { optionId: 'market' }),
  isolationCase('check-ins', checkInsRepository, (w) => w.checkInId, { name: 'hijacked' }),
  isolationCase('collections', collectionsRepository, (w) => w.collectionId, { name: 'hijacked' }),
  isolationCase('collection places', collectionPlacesRepository, (w) => w.collectionPlaceId, {
    name: 'hijacked',
  }),
  isolationCase('collection labels', collectionLabelsRepository, (w) => w.labelId, {
    name: 'hijacked',
  }),
  isolationCase('moods', journeyMoodsRepository, (w) => w.moodId, { label: 'hijacked' }),
  isolationCase('journeys', journeysRepository, (w) => w.journeyId, { title: 'hijacked' }),
  isolationCase('journey entries', journeyEntriesRepository, (w) => w.journeyEntryId, {
    body: 'hijacked',
  }),
  isolationCase('journey photos', journeyPhotosRepository, (w) => w.journeyPhotoId, {
    caption: 'hijacked',
  }),
  isolationCase('visited countries', visitedCountriesRepository, (w) => w.visitedCountryId, {
    note: 'hijacked',
  }),
  isolationCase('visited regions', visitedRegionsRepository, (w) => w.visitedRegionId, {
    regionName: 'hijacked',
  }),
  isolationCase('travel stats', travelStatsRepository, (w) => w.travelStatsId, { tripCount: 99 }),
  isolationCase('bucket list', bucketListRepository, (w) => w.bucketItemId, { name: 'hijacked' }),
  isolationCase('vacay plans', vacayPlansRepository, (w) => w.planId, { name: 'hijacked' }),
  isolationCase('vacay plan members', vacayPlanMembersRepository, (w) => w.planMemberId, {
    status: 'declined',
  }),
  isolationCase('vacay years', vacayYearsRepository, (w) => w.vacayYearId, { year: 2031 }),
  isolationCase('vacay entitlements', vacayUserYearsRepository, (w) => w.userYearId, {
    entitlementDays: 1,
  }),
  isolationCase('vacay entries', vacayEntriesRepository, (w) => w.vacayEntryId, {
    note: 'hijacked',
  }),
  isolationCase('company holidays', vacayCompanyHolidaysRepository, (w) => w.companyHolidayId, {
    label: 'hijacked',
  }),
  isolationCase('holiday calendars', vacayHolidayCalendarsRepository, (w) => w.holidayCalendarId, {
    label: 'hijacked',
  }),
  isolationCase('vacay colours', vacayUserColoursRepository, (w) => w.userColourId, {
    colour: '#000000',
  }),
  isolationCase('notifications', notificationsRepository, (w) => w.notificationId, {
    isRead: true,
  }),
  isolationCase('notification preferences', notificationPreferencesRepository, (w) => w.preferenceId, {
    isEnabled: true,
  }),
  isolationCase('audit log', auditLogRepository, (w) => w.auditId, { action: 'trip.hijacked' }),
  isolationCase('members', membersRepository, (w) => w.memberId, { role: 'admin' }),
  isolationCase('invitations', invitationsRepository, (w) => w.invitationId, {
    status: 'canceled',
  }),
  isolationCase('subscriptions', subscriptionsRepository, (w) => w.subscriptionId, { seats: 99 }),
  isolationCase('usage records', usageRecordsRepository, (w) => w.usageRecordId, { value: 99 }),
  isolationCase('workspace settings', organizationSettingsRepository, (w) => w.organizationSettingsId, {
    locale: 'de',
  }),
  isolationCase('user settings', userSettingsRepository, (w) => w.userSettingsId, {
    theme: 'light',
  }),
]

/* -------------------------------------------------------------------------------------------------
 * Suite
 * ---------------------------------------------------------------------------------------------- */

describe('tenant isolation', () => {
  let harness: Harness
  let alpha: World
  let beta: World

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await seedWorld(await harness.seedTenant('alpha'))
    beta = await seedWorld(await harness.seedTenant('beta'))
  })

  it('seeds both tenants with a complete, independent world', () => {
    expect(alpha.tenant.organizationId).not.toBe(beta.tenant.organizationId)
    expect(alpha.tripId).not.toBe(beta.tripId)
    expect(cases.length).toBeGreaterThanOrEqual(50)
  })

  describe.each(cases.map((entry) => [entry.name, entry] as const))('%s', (_name, entry) => {
    it('cannot be read by id across the boundary', async () => {
      const foreignId = entry.pick(beta)
      expect(await entry.findById(alpha.tenant.scope, foreignId)).toBeNull()

      const error = await captureError(() => entry.requireById(alpha.tenant.scope, foreignId))
      expect(error).toBeInstanceOf(NotFoundError)

      // The same id resolves for its own tenant, proving the row exists and only scoping hid it.
      expect(await entry.findById(beta.tenant.scope, foreignId)).not.toBeNull()
    })

    it('is never listed across the boundary', async () => {
      const ids = await entry.listIds(alpha.tenant.scope)
      expect(ids).not.toContain(entry.pick(beta))
      expect(ids).toContain(entry.pick(alpha))
    })

    it('cannot be updated across the boundary', async () => {
      const foreignId = entry.pick(beta)
      const before = await entry.findById(beta.tenant.scope, foreignId)

      expect(await entry.update(alpha.tenant.scope, foreignId)).toBeNull()
      expect(await entry.findById(beta.tenant.scope, foreignId)).toEqual(before)
    })

    it('cannot be deleted across the boundary', async () => {
      const foreignId = entry.pick(beta)
      expect(await entry.remove(alpha.tenant.scope, foreignId)).toBe(false)
      expect(await entry.findById(beta.tenant.scope, foreignId)).not.toBeNull()
    })

    it('counts only the caller’s own rows', async () => {
      const own = await entry.count(alpha.tenant.scope)
      const foreign = await entry.count(beta.tenant.scope)
      expect(own).toBeGreaterThan(0)
      expect(foreign).toBeGreaterThan(0)

      const alphaIds = new Set(await entry.listIds(alpha.tenant.scope))
      const betaIds = await entry.listIds(beta.tenant.scope)
      expect(betaIds.some((id) => alphaIds.has(id))).toBe(false)
    })
  })

  describe('join tables', () => {
    it('keeps place tags inside their tenant', async () => {
      const alphaLinks = await harness.db
        .select()
        .from(placeTags)
        .where(eq(placeTags.organizationId, alpha.tenant.organizationId))
      const betaLinks = await harness.db
        .select()
        .from(placeTags)
        .where(eq(placeTags.organizationId, beta.tenant.organizationId))

      expect(alphaLinks).toHaveLength(1)
      expect(betaLinks).toHaveLength(1)
      expect(alphaLinks[0]?.tagId).not.toBe(betaLinks[0]?.tagId)
    })

    it('drops a foreign tag id instead of linking it', async () => {
      const linked = await setPlaceTags(alpha.tenant.scope, alpha.placeId, [beta.tagId])
      expect(linked).toEqual([])

      const links = await harness.db
        .select()
        .from(placeTags)
        .where(eq(placeTags.placeId, alpha.placeId))
      expect(links).toHaveLength(0)
    })

    it('drops a foreign label id instead of linking it', async () => {
      const linked = await setCollectionPlaceLabels(
        alpha.tenant.scope,
        alpha.collectionPlaceId,
        [beta.labelId],
      )
      expect(linked).toEqual([])

      const links = await harness.db
        .select()
        .from(collectionPlaceLabels)
        .where(eq(collectionPlaceLabels.collectionPlaceId, alpha.collectionPlaceId))
      expect(links).toHaveLength(0)
    })

    it('refuses to set participants on a foreign assignment', async () => {
      const error = await captureError(() =>
        setAssignmentParticipants(alpha.tenant.scope, beta.assignmentId, [
          alpha.tenant.ownerUserId,
        ]),
      )
      expect(error).toBeInstanceOf(NotFoundError)

      const rows = await harness.db
        .select()
        .from(assignmentParticipants)
        .where(eq(assignmentParticipants.assignmentId, beta.assignmentId))
      expect(rows).toHaveLength(2)
      expect(rows.every((row) => row.organizationId === beta.tenant.organizationId)).toBe(true)
    })

    it('scopes reactions to the tenant that made them', async () => {
      const own = await collabMessageReactionsAccess.findMany(alpha.tenant.scope)
      expect(own).toHaveLength(1)
      expect(own[0]?.messageId).toBe(alpha.messageId)

      const rows = await harness.db
        .select()
        .from(collabMessageReactions)
        .where(eq(collabMessageReactions.messageId, beta.messageId))
      expect(rows).toHaveLength(1)
      expect(rows[0]?.organizationId).toBe(beta.tenant.organizationId)
    })

    it('refuses to react to a foreign message', async () => {
      const error = await captureError(() =>
        toggleReaction(alpha.tenant.scope, beta.messageId, '👍'),
      )
      expect(error).toBeInstanceOf(NotFoundError)
    })
  })

  describe('a foreign parent id is rejected, never re-scoped', () => {
    it('rejects a foreign trip on every trip-scoped write', async () => {
      const scope = alpha.tenant.scope
      const attempts: ReadonlyArray<() => Promise<unknown>> = [
        () => createPlace(scope, { tripId: beta.tripId, name: 'Stolen place' }),
        () =>
          createTransport(scope, { tripId: beta.tripId, title: 'Stolen leg', mode: 'train' }),
        () => createReservation(scope, { tripId: beta.tripId, title: 'Stolen booking' }),
        () => createBudgetItem(scope, { tripId: beta.tripId, name: 'Stolen budget' }),
        () =>
          createExpense(scope, {
            tripId: beta.tripId,
            title: 'Stolen expense',
            amountMinor: 100,
            spentOn: '2026-04-10',
          }),
        () => createList(scope, { tripId: beta.tripId, name: 'Stolen list' }),
        () =>
          recordFile(scope, {
            tripId: beta.tripId,
            storageKey: 'files/stolen.pdf',
            filename: 'stolen.pdf',
            contentType: 'application/pdf',
            sizeBytes: 10,
          }),
        () => postMessage(scope, { tripId: beta.tripId, body: 'Stolen message' }),
        () => createCollabNote(scope, { tripId: beta.tripId, title: 'Stolen note' }),
        () =>
          createPoll(scope, {
            tripId: beta.tripId,
            question: 'Stolen?',
            options: POLL_OPTIONS,
          }),
        () => createCheckIn(scope, { tripId: beta.tripId, name: 'Stolen check-in' }),
        () => createJourney(scope, { tripId: beta.tripId, title: 'Stolen journey' }),
        () =>
          createShareLink(scope, {
            tripId: beta.tripId,
            token: 'stolen-share-token-1234',
            scopes: {
              map: true,
              itinerary: true,
              reservations: true,
              lists: true,
              budget: true,
              collab: true,
              files: true,
            },
          }),
        () => getTripItinerary(scope, beta.tripId),
        () => getTripSpendSummary(scope, beta.tripId),
        () => getMemberBalances(scope, beta.tripId),
        () => updateTrip(scope, beta.tripId, { title: 'Stolen title' }),
      ]

      for (const attempt of attempts) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }

      // Nothing landed in either tenant.
      expect(await placesRepository.count(alpha.tenant.scope)).toBe(1)
      expect(await placesRepository.count(beta.tenant.scope)).toBe(1)
      const betaTrip = await tripsRepository.requireById(beta.tenant.scope, beta.tripId)
      expect(betaTrip.title).toBe('Lisbon in spring')
    })

    it('rejects a foreign day, place or assignment on the itinerary', async () => {
      const scope = alpha.tenant.scope

      expect(
        await captureError(() =>
          createAssignment(scope, {
            tripId: alpha.tripId,
            dayId: beta.dayId,
            placeId: alpha.placeId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          createAssignment(scope, {
            tripId: alpha.tripId,
            dayId: alpha.dayId,
            placeId: beta.placeId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          createAccommodation(scope, {
            tripId: alpha.tripId,
            startDayId: alpha.dayId,
            endDayId: beta.lastDayId,
            name: 'Stolen stay',
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          createReservation(scope, {
            tripId: alpha.tripId,
            title: 'Cross-linked booking',
            assignmentId: beta.assignmentId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          createReservation(scope, {
            tripId: alpha.tripId,
            title: 'Cross-linked booking',
            transportId: beta.transportId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(await dayAssignmentsRepository.count(alpha.tenant.scope)).toBe(1)
    })

    it('rejects a foreign category, collection, journey, template or plan', async () => {
      const scope = alpha.tenant.scope

      expect(
        await captureError(() =>
          createPlace(scope, {
            tripId: alpha.tripId,
            name: 'Cross-categorised',
            categoryId: beta.categoryId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          addCollectionPlace(scope, { collectionId: beta.collectionId, name: 'Stolen save' }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          saveTripPlaceToCollection(scope, {
            collectionId: alpha.collectionId,
            placeId: beta.placeId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() => createLabel(scope, { collectionId: beta.collectionId, name: 'X' })),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          createEntry(scope, { journeyId: beta.journeyId, entryDate: '2026-04-11' }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          createEntry(scope, {
            journeyId: alpha.journeyId,
            entryDate: '2026-04-11',
            moodId: beta.moodId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          addPhoto(scope, {
            journeyId: alpha.journeyId,
            entryId: beta.journeyEntryId,
            storageKey: 'photos/stolen.jpg',
            contentType: 'image/jpeg',
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          applyTemplateToTrip(scope, { templateId: beta.templateId, tripId: alpha.tripId }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          applyTemplateToTrip(scope, { templateId: alpha.templateId, tripId: beta.tripId }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() => createListItem(scope, { listId: beta.listId, name: 'Stolen item' })),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() => setEntry(scope, { planId: beta.planId, date: '2026-05-01' })),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() => ensureYear(scope, beta.planId, 2027)),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() => addCompanyHoliday(scope, { planId: beta.planId, date: '2027-01-01' })),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() => setUserColour(scope, beta.planId, alpha.tenant.ownerUserId, '#111111')),
      ).toBeInstanceOf(NotFoundError)

      expect(await vacayEntriesRepository.count(beta.tenant.scope)).toBe(1)
    })

    it('rejects foreign ids on collaboration, notifications and membership writes', async () => {
      const scope = alpha.tenant.scope

      expect(
        await captureError(() => editMessage(scope, beta.messageId, 'Rewritten')),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() => castVote(scope, beta.pollId, 'market')),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          postMessage(scope, {
            tripId: alpha.tripId,
            body: 'Reply across tenants',
            replyToId: beta.messageId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(await captureError(() => markRead(scope, beta.notificationId))).toBeInstanceOf(
        NotFoundError,
      )

      expect(
        await captureError(() => changeMemberRole(alpha.tenant.scope, beta.memberId, 'member')),
      ).toBeInstanceOf(NotFoundError)

      const betaVotes = await collabPollVotesRepository.findMany(beta.tenant.scope)
      expect(betaVotes).toHaveLength(1)
      expect(betaVotes[0]?.optionId).toBe('sunrise')
    })
  })

  describe('aggregates and summaries', () => {
    it('counts trips per status within the tenant only', async () => {
      const summary = await countTripsByStatus(alpha.tenant.scope)
      expect(summary.total).toBe(1)
      expect(summary.byStatus.planning).toBe(1)
    })

    it('keeps expense balances inside the tenant', async () => {
      const balances = await getMemberBalances(alpha.tenant.scope, alpha.tripId)
      const userIds = balances.map((row) => row.userId)
      expect(userIds).toContain(alpha.tenant.ownerUserId)
      expect(userIds).not.toContain(beta.tenant.ownerUserId)

      // 9 000 paid by the owner, split 4 500 / 4 500, then 4 500 settled back: everyone is square.
      for (const balance of balances) {
        expect(balance.balanceMinor).toBe(0)
      }
    })

    it('keeps the spend summary inside the tenant', async () => {
      const summary = await getTripSpendSummary(alpha.tenant.scope, alpha.tripId)
      expect(summary.spentMinor).toBe(9_000)
      expect(summary.plannedMinor).toBe(30_000)
      expect(summary.currency).toBe('EUR')
    })

    it('keeps storage usage inside the tenant', async () => {
      const usage = await getStorageUsage(alpha.tenant.scope)
      expect(usage.fileCount).toBe(1)
      expect(usage.bytes).toBe(20_480)
    })

    it('keeps collection counts inside the tenant', async () => {
      const collections = await listCollectionsWithCounts(alpha.tenant.scope)
      expect(collections).toHaveLength(1)
      expect(collections[0]?.placeCount).toBe(1)
    })

    it('keeps the dashboard summary inside the tenant', async () => {
      const dashboard = await getDashboardSummary(alpha.tenant.scope, { today: '2026-04-01' })
      expect(dashboard.trips.total).toBe(1)
      expect(dashboard.counts.places).toBe(1)
      expect(dashboard.counts.files).toBe(1)
      expect(dashboard.counts.members).toBe(2)
      expect(dashboard.counts.visitedCountries).toBe(1)
      expect(dashboard.upcomingTrips.map((trip) => trip.id)).toEqual([alpha.tripId])
    })

    it('keeps the member directory inside the tenant', async () => {
      const profiles = await listMemberProfiles(alpha.tenant.scope)
      expect(profiles).toHaveLength(2)
      expect(profiles.map((row) => row.userId)).not.toContain(beta.tenant.ownerUserId)
    })

    it('reads the caller’s own workspace row only', async () => {
      const organization = await getOrganization(alpha.tenant.scope)
      expect(organization.id).toBe(alpha.tenant.organizationId)

      await updateOrganization(alpha.tenant.scope, { name: 'Renamed alpha' })
      expect((await getOrganization(beta.tenant.scope)).name).toBe('Workspace beta')
    })

    it('keeps effective settings inside the tenant', async () => {
      await updateUserSettings(beta.tenant.scope, { locale: 'pt-BR' })
      const settings = await getEffectiveSettings(alpha.tenant.scope)
      // `en` rather than the `en-GB` this column used to hold: every read is narrowed to one of the
      // twenty-three shipped tags, so a workspace on the legacy default still resolves.
      expect(settings.locale).toBe('en')
      expect(settings.theme).toBe('dark')
    })

    it('writes a language into the caller’s workspace only', async () => {
      await updateOrganizationSettings(alpha.tenant.scope, { locale: 'ja' })
      await updateUserSettings(alpha.tenant.scope, { locale: 'ko' })

      expect((await ensureOrganizationSettings(beta.tenant.scope)).locale).toBe('en')
      expect((await getUserSettings(beta.tenant.scope))?.locale ?? null).toBeNull()
      expect((await getEffectiveSettings(beta.tenant.scope)).locale).toBe('en')
      expect((await getEffectiveSettings(alpha.tenant.scope)).locale).toBe('ko')
    })

    it('keeps the trip itinerary inside the tenant', async () => {
      const itinerary = await getTripItinerary(alpha.tenant.scope, alpha.tripId)
      expect(itinerary).toHaveLength(3)
      expect(itinerary[0]?.stops).toHaveLength(1)
      expect(itinerary[0]?.stops[0]?.place.id).toBe(alpha.placeId)
      expect(itinerary[0]?.notes).toHaveLength(1)
      expect(itinerary[0]?.accommodations).toHaveLength(1)
      expect(itinerary[2]?.accommodations).toHaveLength(1)
      expect(itinerary[0]?.stops[0]?.participantUserIds).toHaveLength(2)
    })

    it('pages trip chat within the tenant', async () => {
      const page = await listMessages(alpha.tenant.scope, alpha.tripId, { limit: 10 })
      expect(page.items.map((row) => row.id)).toEqual([alpha.messageId])
      expect(page.nextCursor).toBeNull()
    })
  })

  describe('billing', () => {
    it('reads only the caller’s subscription', async () => {
      const own = await getSubscription(alpha.tenant.scope)
      expect(own?.id).toBe(alpha.subscriptionId)
      expect(own?.organizationId).toBe(alpha.tenant.organizationId)
    })

    it('writes only the organization a webhook addressed', async () => {
      await upsertSubscriptionUnscoped(harness.db, beta.tenant.organizationId, { seats: 12 })

      expect((await getSubscription(beta.tenant.scope))?.seats).toBe(12)
      expect((await getSubscription(alpha.tenant.scope))?.seats).toBe(5)
    })

    it('enforces the plan quota on the caller’s own tenant only', async () => {
      // The free plan sells — and now enforces — two trips at a time. Alpha is on a paid
      // row of its own and is unaffected by this tenant filling its ceiling.
      const free = await harness.seedTenant('free')
      await createTrip(free.scope, { title: 'One' })
      await createTrip(free.scope, { title: 'Two' })

      const error = await captureError(() => createTrip(free.scope, { title: 'Three' }))
      expect(error).toBeInstanceOf(QuotaExceededError)
      expect(await tripsRepository.count(free.scope)).toBe(2)
      expect(await tripsRepository.count(alpha.tenant.scope)).toBe(1)
    })
  })

  describe('cascades and unscoped configuration', () => {
    it('cascades a trip deletion only inside its own tenant', async () => {
      await tripsRepository.requireRemove(alpha.tenant.scope, alpha.tripId)

      expect(await placesRepository.count(alpha.tenant.scope)).toBe(0)
      expect(await daysRepository.count(alpha.tenant.scope)).toBe(0)
      expect(await dayAssignmentsRepository.count(alpha.tenant.scope)).toBe(0)
      expect(await expensesRepository.count(alpha.tenant.scope)).toBe(0)

      expect(await placesRepository.count(beta.tenant.scope)).toBe(1)
      expect(await daysRepository.count(beta.tenant.scope)).toBe(3)
      expect(await expensesRepository.count(beta.tenant.scope)).toBe(1)
    })

    it('shares app settings across the deployment by design', async () => {
      await appSettingsStore.set(harness.db, 'tiles.pack', { version: 3 }, 'Published tile pack')

      const row = await appSettingsStore.get(harness.db, 'tiles.pack')
      expect(row?.value).toEqual({ version: 3 })
      expect(await appSettingsStore.list(harness.db)).toHaveLength(1)
      expect(await appSettingsStore.remove(harness.db, 'tiles.pack')).toBe(true)
    })
  })

  describe('split arithmetic', () => {
    it('always sums back to the expense total', () => {
      const equal = computeShares(100, 'equal', [{ userId: 'a' }, { userId: 'b' }, { userId: 'c' }])
      expect(equal.map((row) => row.shareMinor)).toEqual([34, 33, 33])

      const shares = computeShares(1000, 'shares', [
        { userId: 'a', weight: 3 },
        { userId: 'b', weight: 1 },
      ])
      expect(shares.map((row) => row.shareMinor)).toEqual([750, 250])

      const percentage = computeShares(999, 'percentage', [
        { userId: 'a', percentage: 70 },
        { userId: 'b', percentage: 30 },
      ])
      expect(percentage.reduce((total, row) => total + row.shareMinor, 0)).toBe(999)

      const exact = computeShares(500, 'exact', [
        { userId: 'a', shareMinor: 200 },
        { userId: 'b', shareMinor: 300 },
      ])
      expect(exact.map((row) => row.shareMinor)).toEqual([200, 300])
    })

    it('refuses exact shares that do not add up', () => {
      expect(() =>
        computeShares(500, 'exact', [
          { userId: 'a', shareMinor: 200 },
          { userId: 'b', shareMinor: 200 },
        ]),
      ).toThrow(/add up/)
    })
  })
})
