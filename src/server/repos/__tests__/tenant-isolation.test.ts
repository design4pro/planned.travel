/**
 * Tenant isolation — the contract the whole data layer exists to keep.
 *
 * Two organizations are seeded with an identical, complete set of rows. Every repository is then
 * asked, from organization A's scope, to read, list, update and delete organization B's rows by id,
 * and to parent new rows onto B's rows. None of it may work, and B's data must be untouched
 * afterwards. A cross-tenant id is a `NotFoundError`, never a row quietly re-scoped into the caller's
 * own organization.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { AUDIT_ACTIONS, trail } from '#/server/audit/trail'
import {
  assignmentParticipants,
  collabMessageReactions,
  collectionPlaceLabels,
  placeTags,
  places,
} from '#/server/db/schema'
import { NotFoundError, QuotaExceededError, RepositoryError } from '../context'
import {
  bucketListRepository,
  getTravelStats,
  listTravelStats,
  markCountryVisited,
  markRegionVisited,
  recomputeTravelStats,
  travelStatsRepository,
  upsertTravelStats,
  visitedCountriesRepository,
  visitedRegionsRepository,
} from '../atlas'
import {
  auditLogRepository,
  countAuditActions,
  listAuditLog,
  listEntityHistory,
  recordAudit,
} from '../audit'
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
import {
  createDayNote,
  dayNotesRepository,
  daysRepository,
  listDayNotes,
  listTripDayNotes,
  listTripDays,
  requireDayNote,
} from '../days'
import {
  budgetItemsRepository,
  computeShares,
  createBudgetItem,
  createExpense,
  createSettlement,
  expenseSharesRepository,
  expensesRepository,
  getExpense,
  getMemberBalances,
  getTripSpendSummary,
  settlementsRepository,
} from '../expenses'
import { getStorageUsage, recordFile, tripFilesRepository } from '../files'
import { handleTripPurge } from '#/server/queue/handlers/trip-purge'
import { purgeContext } from '#/server/queue/handlers/__tests__/purge-context'
import { fakeBucket } from '#/server/storage/__tests__/fake-bucket'
import {
  createAccommodation,
  createAssignment,
  dayAccommodationsRepository,
  dayAssignmentsRepository,
  getTripItinerary,
  listDayAssignments,
  reorderDayTimeline,
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
  filterEnabledRecipients,
  listForEntity,
  listNotifications,
  markRead,
  notificationPreferencesRepository,
  notificationsRepository,
  notify,
  notifyMany,
  setPreference,
} from '../notifications'
import { createPlace, placesRepository, setPlaceTags } from '../places'
import {
  clearReservationImported,
  createReservation,
  deleteReservation,
  getReservation,
  linkReservationExpense,
  listTripReservations,
  markReservationsImported,
  reservationsRepository,
  setReservationStatus,
  updateReservation,
} from '../reservations'
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
import {
  createTransport,
  deleteTransport,
  getTransport,
  listDayTransports,
  listTransportLegs,
  listTripDayTransports,
  listTripLegs,
  listTripTransports,
  nextDeparture,
  reorderDayTransports,
  replaceTransportChain,
  saveSearchedConnection,
  setTransportStatus,
  summariseTripTransports,
  totalTripDistanceMetres,
  transportLegsRepository,
  transportsRepository,
  unlinkTransportsFromDays,
  updateTransport,
} from '../transports'
import {
  countFavourites,
  listFavouriteTripIds,
  setFavourite,
} from '../trip-favourites'
import {
  addTripMember,
  archiveTrip,
  canReadTrip,
  copyTripContents,
  countTripsByStatus,
  TripRoleError,
  createShareLink,
  createTrip,
  deleteTrip,
  listTripMembers,
  listTripParticipants,
  listTrips,
  memberTripIds,
  removeTripMember,
  requireTrip,
  restoreTrip,
  shareLinksRepository,
  startTripCopy,
  tripMembersRepository,
  tripMemberUserIds,
  tripRolesFor,
  tripsRepository,
  updateTrip,
  updateTripMember,
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
import { dispatch } from '#/server/notifications/dispatch'
import { createLogger, createMemorySink } from '#/server/observability'
import { sweepReminders } from '#/server/queue/reminders'
import { createScope } from '../base'
import { captureError, createHarness } from './harness'
import type {
  KeyedTenantTable,
  TenantPatch,
  TenantRepository,
  TenantScope,
} from '../base'
import type { TaskBindings, TaskQueue } from '#/server/queue/types'
import type { UserSettings } from '#/server/db/types'
import type { FakeBucket } from '#/server/storage/__tests__/fake-bucket'
import type { Harness, SeededTenant } from './harness'
import type { StagedImport } from '#/server/queue/handlers/booking-import'

/* -------------------------------------------------------------------------------------------------
 * The confirmation import's request path
 * ---------------------------------------------------------------------------------------------- */

/**
 * `#/server/fns/booking-import` is the one module under test here that is not a repository, and it
 * is included because two of its trust boundaries are not repository boundaries: a **file id** and
 * a **job id** both arrive from a browser, and KV has no tenant filter of its own. Its three
 * bindings modules read the Worker environment at module scope through `cloudflare:workers`, which
 * does not resolve in this project, so each is replaced by a stub that throws — no case below may
 * reach one, and a case that did would be asserting the wrong thing.
 */
vi.mock('#/server/fns/context', () => ({
  appScope: () => {
    throw new Error('appScope is not reached: this suite hands the scope in.')
  },
  importStore: () => {
    throw new Error('importStore is not reached: this suite hands it in.')
  },
  mirrorToRoom: () => {
    throw new Error('mirrorToRoom is not reached: nothing here is written.')
  },
  patch: () => {
    throw new Error('patch is not reached: nothing here is written.')
  },
}))

vi.mock('#/server/auth/env', () => ({
  taskQueue: () => {
    throw new Error('taskQueue is not reached: this suite hands the queue in.')
  },
}))

vi.mock('#/server/geo/bindings', () => ({
  geocodeRuntime: () => {
    throw new Error('geocodeRuntime is not reached: no place is written here.')
  },
}))

const { confirmBookingImport, startBookingImport } =
  await import('#/server/fns/booking-import')
const { stagedImportKey } =
  await import('#/server/queue/handlers/booking-import')

/** The confirm's ports, stubbed to throw for the same reason: a refused confirm reaches neither. */
const unreachedPorts: Parameters<typeof confirmBookingImport>[3] = {
  announce: () => {
    throw new Error('announce is not reached: nothing here is written.')
  },
  geocoding: () => {
    throw new Error('geocoding is not reached: no place is written here.')
  },
}

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
  const subscription = await upsertSubscription(scope, {
    plan: 'pro',
    status: 'active',
    seats: 5,
  })
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
  await setAssignmentParticipants(scope, assignment.id, [
    tenant.ownerUserId,
    secondUserId,
  ])

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

  const list = await createList(scope, {
    tripId: trip.id,
    name: 'Carry-on',
    kind: 'packing',
  })
  const listItem = await createListItem(scope, {
    listId: list.id,
    name: 'Adapter',
  })
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

  const message = await postMessage(scope, {
    tripId: trip.id,
    body: 'Landed, heading in.',
  })
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
  const label = await createLabel(scope, {
    collectionId: collection.id,
    name: 'Food',
  })
  await setCollectionPlaceLabels(scope, collectionPlace.id, [label.id])

  const mood = await createMood(scope, {
    key: 'sunny',
    label: 'Sunny',
    emoji: '☀️',
  })
  const journey = await createJourney(scope, {
    title: 'Lisbon notebook',
    tripId: trip.id,
  })
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
  const travelStat = await upsertTravelStats(scope, {
    statYear: 2026,
    tripCount: 1,
  })
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
  const userYear = await setEntitlement(scope, {
    planId: plan.id,
    year: 2026,
    entitlementDays: 28,
  })
  const vacayEntry = await setEntry(scope, {
    planId: plan.id,
    date: '2026-04-10',
    kind: 'vacation',
  })
  const companyHoliday = await addCompanyHoliday(scope, {
    planId: plan.id,
    date: '2026-12-24',
    label: 'Office closed',
  })
  const holidayCalendar = await addHolidayCalendar(scope, {
    planId: plan.id,
    region: 'PT',
  })
  const userColour = await setUserColour(
    scope,
    plan.id,
    tenant.ownerUserId,
    '#2F6F5E',
  )

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
  isolationCase('trips', tripsRepository, (w) => w.tripId, {
    title: 'hijacked',
  }),
  isolationCase('trip members', tripMembersRepository, (w) => w.tripMemberId, {
    role: 'viewer',
  }),
  isolationCase('share links', shareLinksRepository, (w) => w.shareLinkId, {
    viewCount: 99,
  }),
  isolationCase('days', daysRepository, (w) => w.dayId, { title: 'hijacked' }),
  isolationCase('day notes', dayNotesRepository, (w) => w.dayNoteId, {
    body: 'hijacked',
  }),
  isolationCase('categories', categoriesRepository, (w) => w.categoryId, {
    name: 'hijacked',
  }),
  isolationCase('tags', tagsRepository, (w) => w.tagId, { name: 'hijacked' }),
  isolationCase('places', placesRepository, (w) => w.placeId, {
    name: 'hijacked',
  }),
  isolationCase(
    'day assignments',
    dayAssignmentsRepository,
    (w) => w.assignmentId,
    {
      notes: 'hijacked',
    },
  ),
  isolationCase(
    'accommodations',
    dayAccommodationsRepository,
    (w) => w.accommodationId,
    {
      name: 'hijacked',
    },
  ),
  isolationCase('transports', transportsRepository, (w) => w.transportId, {
    title: 'hijacked',
  }),
  isolationCase(
    'reservations',
    reservationsRepository,
    (w) => w.reservationId,
    {
      title: 'hijacked',
    },
  ),
  isolationCase('budget items', budgetItemsRepository, (w) => w.budgetItemId, {
    name: 'hijacked',
  }),
  isolationCase('expenses', expensesRepository, (w) => w.expenseId, {
    title: 'hijacked',
  }),
  isolationCase(
    'expense shares',
    expenseSharesRepository,
    (w) => w.expenseShareId,
    {
      isSettled: true,
    },
  ),
  isolationCase('settlements', settlementsRepository, (w) => w.settlementId, {
    note: 'hijacked',
  }),
  isolationCase('lists', packingListsRepository, (w) => w.listId, {
    name: 'hijacked',
  }),
  isolationCase('list items', packingItemsRepository, (w) => w.listItemId, {
    name: 'hijacked',
  }),
  isolationCase('templates', packingTemplatesRepository, (w) => w.templateId, {
    name: 'hijacked',
  }),
  isolationCase(
    'template items',
    packingTemplateItemsRepository,
    (w) => w.templateItemId,
    {
      name: 'hijacked',
    },
  ),
  isolationCase('files', tripFilesRepository, (w) => w.fileId, {
    filename: 'hijacked.pdf',
  }),
  isolationCase('messages', collabMessagesRepository, (w) => w.messageId, {
    body: 'hijacked',
  }),
  isolationCase('collab notes', collabNotesRepository, (w) => w.collabNoteId, {
    title: 'hijacked',
  }),
  isolationCase('polls', collabPollsRepository, (w) => w.pollId, {
    question: 'hijacked?',
  }),
  isolationCase('poll votes', collabPollVotesRepository, (w) => w.voteId, {
    optionId: 'market',
  }),
  isolationCase('check-ins', checkInsRepository, (w) => w.checkInId, {
    name: 'hijacked',
  }),
  isolationCase('collections', collectionsRepository, (w) => w.collectionId, {
    name: 'hijacked',
  }),
  isolationCase(
    'collection places',
    collectionPlacesRepository,
    (w) => w.collectionPlaceId,
    {
      name: 'hijacked',
    },
  ),
  isolationCase(
    'collection labels',
    collectionLabelsRepository,
    (w) => w.labelId,
    {
      name: 'hijacked',
    },
  ),
  isolationCase('moods', journeyMoodsRepository, (w) => w.moodId, {
    label: 'hijacked',
  }),
  isolationCase('journeys', journeysRepository, (w) => w.journeyId, {
    title: 'hijacked',
  }),
  isolationCase(
    'journey entries',
    journeyEntriesRepository,
    (w) => w.journeyEntryId,
    {
      body: 'hijacked',
    },
  ),
  isolationCase(
    'journey photos',
    journeyPhotosRepository,
    (w) => w.journeyPhotoId,
    {
      caption: 'hijacked',
    },
  ),
  isolationCase(
    'visited countries',
    visitedCountriesRepository,
    (w) => w.visitedCountryId,
    {
      note: 'hijacked',
    },
  ),
  isolationCase(
    'visited regions',
    visitedRegionsRepository,
    (w) => w.visitedRegionId,
    {
      regionName: 'hijacked',
    },
  ),
  isolationCase('travel stats', travelStatsRepository, (w) => w.travelStatsId, {
    tripCount: 99,
  }),
  isolationCase('bucket list', bucketListRepository, (w) => w.bucketItemId, {
    name: 'hijacked',
  }),
  isolationCase('vacay plans', vacayPlansRepository, (w) => w.planId, {
    name: 'hijacked',
  }),
  isolationCase(
    'vacay plan members',
    vacayPlanMembersRepository,
    (w) => w.planMemberId,
    {
      status: 'declined',
    },
  ),
  isolationCase('vacay years', vacayYearsRepository, (w) => w.vacayYearId, {
    year: 2031,
  }),
  isolationCase(
    'vacay entitlements',
    vacayUserYearsRepository,
    (w) => w.userYearId,
    {
      entitlementDays: 1,
    },
  ),
  isolationCase(
    'vacay entries',
    vacayEntriesRepository,
    (w) => w.vacayEntryId,
    {
      note: 'hijacked',
    },
  ),
  isolationCase(
    'company holidays',
    vacayCompanyHolidaysRepository,
    (w) => w.companyHolidayId,
    {
      label: 'hijacked',
    },
  ),
  isolationCase(
    'holiday calendars',
    vacayHolidayCalendarsRepository,
    (w) => w.holidayCalendarId,
    {
      label: 'hijacked',
    },
  ),
  isolationCase(
    'vacay colours',
    vacayUserColoursRepository,
    (w) => w.userColourId,
    {
      colour: '#000000',
    },
  ),
  isolationCase(
    'notifications',
    notificationsRepository,
    (w) => w.notificationId,
    {
      isRead: true,
    },
  ),
  isolationCase(
    'notification preferences',
    notificationPreferencesRepository,
    (w) => w.preferenceId,
    {
      isEnabled: true,
    },
  ),
  isolationCase('audit log', auditLogRepository, (w) => w.auditId, {
    action: 'trip.hijacked',
  }),
  isolationCase('members', membersRepository, (w) => w.memberId, {
    role: 'admin',
  }),
  isolationCase('invitations', invitationsRepository, (w) => w.invitationId, {
    status: 'canceled',
  }),
  isolationCase(
    'subscriptions',
    subscriptionsRepository,
    (w) => w.subscriptionId,
    { seats: 99 },
  ),
  isolationCase(
    'usage records',
    usageRecordsRepository,
    (w) => w.usageRecordId,
    { value: 99 },
  ),
  isolationCase(
    'workspace settings',
    organizationSettingsRepository,
    (w) => w.organizationSettingsId,
    {
      locale: 'de',
    },
  ),
  isolationCase(
    'user settings',
    userSettingsRepository,
    (w) => w.userSettingsId,
    {
      theme: 'light',
    },
  ),
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

  describe.each(cases.map((entry) => [entry.name, entry] as const))(
    '%s',
    (_name, entry) => {
      it('cannot be read by id across the boundary', async () => {
        const foreignId = entry.pick(beta)
        expect(await entry.findById(alpha.tenant.scope, foreignId)).toBeNull()

        const error = await captureError(() =>
          entry.requireById(alpha.tenant.scope, foreignId),
        )
        expect(error).toBeInstanceOf(NotFoundError)

        // The same id resolves for its own tenant, proving the row exists and only scoping hid it.
        expect(
          await entry.findById(beta.tenant.scope, foreignId),
        ).not.toBeNull()
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
        expect(await entry.findById(beta.tenant.scope, foreignId)).toEqual(
          before,
        )
      })

      it('cannot be deleted across the boundary', async () => {
        const foreignId = entry.pick(beta)
        expect(await entry.remove(alpha.tenant.scope, foreignId)).toBe(false)
        expect(
          await entry.findById(beta.tenant.scope, foreignId),
        ).not.toBeNull()
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
    },
  )

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
      const linked = await setPlaceTags(alpha.tenant.scope, alpha.placeId, [
        beta.tagId,
      ])
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
        .where(
          eq(collectionPlaceLabels.collectionPlaceId, alpha.collectionPlaceId),
        )
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
      expect(
        rows.every((row) => row.organizationId === beta.tenant.organizationId),
      ).toBe(true)
    })

    it('scopes reactions to the tenant that made them', async () => {
      const own = await collabMessageReactionsAccess.findMany(
        alpha.tenant.scope,
      )
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
          createTransport(scope, {
            tripId: beta.tripId,
            title: 'Stolen leg',
            mode: 'train',
          }),
        () =>
          createReservation(scope, {
            tripId: beta.tripId,
            title: 'Stolen booking',
          }),
        () =>
          createBudgetItem(scope, {
            tripId: beta.tripId,
            name: 'Stolen budget',
          }),
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
        () =>
          postMessage(scope, { tripId: beta.tripId, body: 'Stolen message' }),
        () =>
          createCollabNote(scope, {
            tripId: beta.tripId,
            title: 'Stolen note',
          }),
        () =>
          createPoll(scope, {
            tripId: beta.tripId,
            question: 'Stolen?',
            options: POLL_OPTIONS,
          }),
        () =>
          createCheckIn(scope, {
            tripId: beta.tripId,
            name: 'Stolen check-in',
          }),
        () =>
          createJourney(scope, {
            tripId: beta.tripId,
            title: 'Stolen journey',
          }),
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
      const betaTrip = await tripsRepository.requireById(
        beta.tenant.scope,
        beta.tripId,
      )
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
          addCollectionPlace(scope, {
            collectionId: beta.collectionId,
            name: 'Stolen save',
          }),
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
        await captureError(() =>
          createLabel(scope, { collectionId: beta.collectionId, name: 'X' }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          createEntry(scope, {
            journeyId: beta.journeyId,
            entryDate: '2026-04-11',
          }),
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
          applyTemplateToTrip(scope, {
            templateId: beta.templateId,
            tripId: alpha.tripId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          applyTemplateToTrip(scope, {
            templateId: alpha.templateId,
            tripId: beta.tripId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          createListItem(scope, { listId: beta.listId, name: 'Stolen item' }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          setEntry(scope, { planId: beta.planId, date: '2026-05-01' }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() => ensureYear(scope, beta.planId, 2027)),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          addCompanyHoliday(scope, { planId: beta.planId, date: '2027-01-01' }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          setUserColour(
            scope,
            beta.planId,
            alpha.tenant.ownerUserId,
            '#111111',
          ),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(await vacayEntriesRepository.count(beta.tenant.scope)).toBe(1)
    })

    it('rejects foreign ids on collaboration, notifications and membership writes', async () => {
      const scope = alpha.tenant.scope

      expect(
        await captureError(() =>
          editMessage(scope, beta.messageId, 'Rewritten'),
        ),
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

      expect(
        await captureError(() => markRead(scope, beta.notificationId)),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          changeMemberRole(alpha.tenant.scope, beta.memberId, 'member'),
        ),
      ).toBeInstanceOf(NotFoundError)

      const betaVotes = await collabPollVotesRepository.findMany(
        beta.tenant.scope,
      )
      expect(betaVotes).toHaveLength(1)
      expect(betaVotes[0]?.optionId).toBe('sunrise')
    })

    it('rejects a foreign settings row on the map style write path', async () => {
      const scope = alpha.tenant.scope

      expect(
        await captureError(() =>
          userSettingsRepository.requireUpdate(scope, beta.userSettingsId, {
            mapStyle: 'planned-dark',
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          organizationSettingsRepository.requireUpdate(
            scope,
            beta.organizationSettingsId,
            { mapStyle: 'planned-dark' },
          ),
        ),
      ).toBeInstanceOf(NotFoundError)

      // The real write path — the one `saveAppearance` calls — reaches only the caller's own row.
      await updateUserSettings(alpha.tenant.scope, {
        mapStyle: 'planned-dark',
      })

      const betaUserRow = await userSettingsRepository.requireById(
        beta.tenant.scope,
        beta.userSettingsId,
      )
      expect(betaUserRow.mapStyle).toBeNull()
      // Beta never chose one, so this is the workspace default — `auto` since
      // `drizzle/0010_basemap_default.sql`. What the row proves is that alpha's write did not
      // reach it, not which id the default happens to be.
      expect((await getEffectiveSettings(beta.tenant.scope)).mapStyle).toBe(
        'auto',
      )
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
      const summary = await getTripSpendSummary(
        alpha.tenant.scope,
        alpha.tripId,
      )
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
      const dashboard = await getDashboardSummary(alpha.tenant.scope, {
        today: '2026-04-01',
      })
      expect(dashboard.trips.total).toBe(1)
      expect(dashboard.counts.places).toBe(1)
      expect(dashboard.counts.files).toBe(1)
      expect(dashboard.counts.members).toBe(2)
      expect(dashboard.counts.visitedCountries).toBe(1)
      expect(dashboard.upcomingTrips.map((trip) => trip.id)).toEqual([
        alpha.tripId,
      ])
    })

    it('keeps the member directory inside the tenant', async () => {
      const profiles = await listMemberProfiles(alpha.tenant.scope)
      expect(profiles).toHaveLength(2)
      expect(profiles.map((row) => row.userId)).not.toContain(
        beta.tenant.ownerUserId,
      )
    })

    it('reads the caller’s own workspace row only', async () => {
      const organization = await getOrganization(alpha.tenant.scope)
      expect(organization.id).toBe(alpha.tenant.organizationId)

      await updateOrganization(alpha.tenant.scope, { name: 'Renamed alpha' })
      expect((await getOrganization(beta.tenant.scope)).name).toBe(
        'Workspace beta',
      )
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

      expect((await ensureOrganizationSettings(beta.tenant.scope)).locale).toBe(
        'en',
      )
      expect(
        (await getUserSettings(beta.tenant.scope))?.locale ?? null,
      ).toBeNull()
      expect((await getEffectiveSettings(beta.tenant.scope)).locale).toBe('en')
      expect((await getEffectiveSettings(alpha.tenant.scope)).locale).toBe('ko')
    })

    it('keeps the trip itinerary inside the tenant', async () => {
      const itinerary = await getTripItinerary(alpha.tenant.scope, alpha.tripId)
      expect(itinerary).toHaveLength(3)
      expect(itinerary[0]?.stops).toHaveLength(1)
      expect(itinerary[0]?.stops[0]?.place.id).toBe(alpha.placeId)
      expect(itinerary[0]?.accommodations).toHaveLength(1)
      expect(itinerary[2]?.accommodations).toHaveLength(1)
      expect(itinerary[0]?.stops[0]?.participantUserIds).toHaveLength(2)
    })

    // The itinerary carried the day notes until #393; the isolation it proved moves here, to the
    // read that now serves them, rather than being dropped with the projection.
    it('keeps the trip day notes inside the tenant', async () => {
      expect(
        await listTripDayNotes(alpha.tenant.scope, alpha.tripId),
      ).toHaveLength(1)
      expect(await listTripDayNotes(alpha.tenant.scope, beta.tripId)).toEqual(
        [],
      )
      expect(
        (await listTripDayNotes(beta.tenant.scope, beta.tripId)).map(
          (note) => note.id,
        ),
      ).toEqual([beta.dayNoteId])
    })

    it('pages trip chat within the tenant', async () => {
      const page = await listMessages(alpha.tenant.scope, alpha.tripId, {
        limit: 10,
      })
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
      await upsertSubscriptionUnscoped(harness.db, beta.tenant.organizationId, {
        seats: 12,
      })

      expect((await getSubscription(beta.tenant.scope))?.seats).toBe(12)
      expect((await getSubscription(alpha.tenant.scope))?.seats).toBe(5)
    })

    it('enforces the plan quota on the caller’s own tenant only', async () => {
      // The free plan sells — and now enforces — two trips at a time. Alpha is on a paid
      // row of its own and is unaffected by this tenant filling its ceiling.
      const free = await harness.seedTenant('free')
      await createTrip(free.scope, { title: 'One' })
      await createTrip(free.scope, { title: 'Two' })

      const error = await captureError(() =>
        createTrip(free.scope, { title: 'Three' }),
      )
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
      await appSettingsStore.set(
        harness.db,
        'tiles.pack',
        { version: 3 },
        'Published tile pack',
      )

      const row = await appSettingsStore.get(harness.db, 'tiles.pack')
      expect(row?.value).toEqual({ version: 3 })
      expect(await appSettingsStore.list(harness.db)).toHaveLength(1)
      expect(await appSettingsStore.remove(harness.db, 'tiles.pack')).toBe(true)
    })
  })

  /**
   * Notification dispatch, the first production write path onto these tables.
   *
   * The middle case is written against what the repository actually does rather than against what
   * it ought to do, and it is the reason the layer above derives its recipients from
   * `listTripMembers` and never from a request body.
   */
  describe('notification dispatch', () => {
    const event = (tripId: string) => ({
      kind: 'trip.updated',
      tripId,
      entityType: 'trip',
      entityId: tripId,
      // No actor: a system event excludes nobody, so the trip's owner is a recipient without the
      // seed having to grow a second trip member.
      titleParams: {
        tripTitle: 'Lisbon in spring',
        actorName: 'The workspace',
      },
    })

    it('refuses a foreign trip through requireTrip, not through an empty membership', async () => {
      const before = await notificationsRepository.count(beta.tenant.scope)

      const error = await captureError(() =>
        dispatch(alpha.tenant.scope, event(beta.tripId), { queue: null }),
      )

      // `listTripMembers` would have answered `[]` here and the fan-out would have succeeded
      // silently — indistinguishable on screen from a trip whose only member is the actor.
      expect(error).toBeInstanceOf(NotFoundError)
      expect(await notificationsRepository.count(beta.tenant.scope)).toBe(
        before,
      )
    })

    it('writes a foreign user id handed straight to notifyMany under the caller’s own tenant', async () => {
      // `notifications.recipient_user_id` is a `userRef()` text column with no foreign key, so the
      // repository cannot refuse this and does not pretend to. Dispatch is the chokepoint.
      const rows = await notifyMany(alpha.tenant.scope, [beta.secondUserId], {
        titleKey: 'trip.updated',
        bodyKey: 'trip.updated',
        entityType: 'trip',
        entityId: alpha.tripId,
      })

      expect(rows).toHaveLength(1)
      expect(rows[0]?.organizationId).toBe(alpha.tenant.organizationId)
      expect(
        (await listNotifications(beta.tenant.scope, beta.secondUserId)).items,
      ).toHaveLength(0)

      // The half that *is* isolated: B's own opt-out is recorded in B and invisible from A, so it
      // cannot suppress A's row either.
      await setPreference(beta.tenant.scope, {
        userId: beta.secondUserId,
        eventType: 'trip.updated',
        channel: 'in_app',
        isEnabled: false,
      })
      expect(
        await filterEnabledRecipients(
          alpha.tenant.scope,
          [beta.secondUserId],
          'trip.updated',
          'in_app',
        ),
      ).toEqual([beta.secondUserId])
      expect(
        await filterEnabledRecipients(
          beta.tenant.scope,
          [beta.secondUserId],
          'trip.updated',
          'in_app',
        ),
      ).toEqual([])
    })

    it('keeps the rows one tenant’s dispatch produced out of the other’s scope', async () => {
      const result = await dispatch(alpha.tenant.scope, event(alpha.tripId), {
        queue: null,
      })
      expect(result.inAppWritten).toBeGreaterThan(0)

      const written = await listNotifications(
        alpha.tenant.scope,
        alpha.tenant.ownerUserId,
      )
      const fresh = written.items.filter(
        (row) => row.titleKey === 'trip.updated',
      )
      expect(fresh).toHaveLength(1)
      const id = fresh[0]?.id ?? ''

      expect(
        await notificationsRepository.findById(beta.tenant.scope, id),
      ).toBeNull()
      const error = await captureError(() =>
        notificationsRepository.requireById(beta.tenant.scope, id),
      )
      expect(error).toBeInstanceOf(NotFoundError)
      expect(
        (await listNotifications(beta.tenant.scope, alpha.tenant.ownerUserId))
          .items,
      ).toHaveLength(0)
    })
  })

  /**
   * The membership expression the travel-stats blocks below read through, on its own.
   *
   * `memberTripIds` is exported, so a future caller can reach it without `recomputeTravelStats`
   * around it, and the tenant filter on its inner side is the only thing standing between that
   * caller and another organization's `trip_members` rows. The blocks below prove the figures; this
   * one proves the seam they rest on, with the same `userId` read from both sides of the boundary.
   */
  describe('memberTripIds', () => {
    const readIds = async (scope: TenantScope, userId: string) =>
      (await memberTripIds(scope, userId)).map((row) => row.id)

    it('answers only for the calling organization', async () => {
      // `createTrip` writes the creator's own `trip_members` row, so A's owner is on A's trip.
      expect(
        await readIds(alpha.tenant.scope, alpha.tenant.ownerUserId),
      ).toEqual([alpha.tripId])
      expect(await readIds(beta.tenant.scope, beta.tenant.ownerUserId)).toEqual(
        [beta.tripId],
      )

      // The same user id, read from the other side: B's owner is a member of nothing A can see,
      // even though B's own scope finds their trip under it.
      expect(
        await readIds(alpha.tenant.scope, beta.tenant.ownerUserId),
      ).toEqual([])
      expect(
        await readIds(beta.tenant.scope, alpha.tenant.ownerUserId),
      ).toEqual([])

      // Membership, not readability: A's second traveller belongs to the organization and to no
      // trip in it, which is the distinction `readableTripFilter` would erase.
      expect(await readIds(alpha.tenant.scope, alpha.secondUserId)).toEqual([])
    })
  })

  /** The calendar year both travel-stats blocks below seed into and recompute for. */
  const STAT_YEAR = 2026

  /**
   * The recompute behind the atlas statistics panel, run from the wrong side of the boundary.
   *
   * Since the `00-S4` amendment (PRD #104, decision 11) every trip-derived figure is computed over
   * the trips the row's `user_id` is a member of, so the boundary here is finally the plain one:
   * B's owner is a member of no trip of A's, and every figure on the row A writes for them is zero.
   * The assertions below used to read the other way round — equal to A's own row rather than to
   * zero — because the predicate was `tenantFilter()` and nothing else.
   */
  describe('travel stats recomputed for a foreign traveller', () => {
    /**
     * A's own trip for the year, so the year row has country codes of its own to count. Its
     * currency is deliberately not `travel_stats.currency`'s `'EUR'` default: that is the only way
     * an assertion below can tell a column A never wrote from a column A wrote its own value into.
     */
    let alphaYearTripId: string

    beforeEach(async () => {
      const trip = await createTrip(alpha.tenant.scope, {
        title: 'Two countries in one week',
        startDate: `${STAT_YEAR}-06-01`,
        endDate: `${STAT_YEAR}-06-08`,
        countryCodes: ['JP', 'KR'],
        currency: 'JPY',
      })
      alphaYearTripId = trip.id
    })

    /** The eight figures the trip rows carry, whoever the row belongs to. */
    function tripFigures(row: {
      tripCount: number
      dayCount: number
      placeCount: number
      cityCount: number
      distanceMetres: number
      spendMinor: number
      currency: string
      lastTripId: string | null
    }): Record<string, unknown> {
      return {
        tripCount: row.tripCount,
        dayCount: row.dayCount,
        placeCount: row.placeCount,
        cityCount: row.cityCount,
        distanceMetres: row.distanceMetres,
        spendMinor: row.spendMinor,
        currency: row.currency,
        lastTripId: row.lastTripId,
      }
    }

    it('writes the rows under the caller’s organization and never under the other', async () => {
      const betaBefore = await listTravelStats(
        beta.tenant.scope,
        beta.tenant.ownerUserId,
      )

      const allTime = await recomputeTravelStats(
        alpha.tenant.scope,
        beta.tenant.ownerUserId,
        0,
      )
      const yearRow = await recomputeTravelStats(
        alpha.tenant.scope,
        beta.tenant.ownerUserId,
        STAT_YEAR,
      )

      expect(allTime.organizationId).toBe(alpha.tenant.organizationId)
      expect(yearRow.organizationId).toBe(alpha.tenant.organizationId)
      expect(
        await listTravelStats(beta.tenant.scope, beta.tenant.ownerUserId),
      ).toEqual(betaBefore)
    })

    it('leaves the per-traveller figures empty, because B’s atlas is invisible from A', async () => {
      const allTime = await recomputeTravelStats(
        alpha.tenant.scope,
        beta.tenant.ownerUserId,
        0,
      )
      const yearRow = await recomputeTravelStats(
        alpha.tenant.scope,
        beta.tenant.ownerUserId,
        STAT_YEAR,
      )

      // `visited_countries` and `visited_regions` are filtered by organization *and* user.
      expect(allTime.regionCount).toBe(0)
      expect(allTime.byContinent).toEqual({})
      expect(yearRow.byContinent).toEqual({})

      // The year row's region figure is *not* evidence of isolation and is not read as such:
      // since #139 a year row carries a constant `0` whatever the traveller has visited, so this
      // asserts the year-scoping rule rather than the tenant boundary. What proves the boundary
      // for regions is the all-time assertion above, and the year-scoping rule itself is covered
      // against a traveller who does have regions in
      // `src/server/queue/handlers/__tests__/travel-stats.test.ts`.
      expect(yearRow.regionCount).toBe(0)
    })

    it('counts no countries on either row kind', async () => {
      const allTime = await recomputeTravelStats(
        alpha.tenant.scope,
        beta.tenant.ownerUserId,
        0,
      )
      const yearRow = await recomputeTravelStats(
        alpha.tenant.scope,
        beta.tenant.ownerUserId,
        STAT_YEAR,
      )
      const ownYear = await recomputeTravelStats(
        alpha.tenant.scope,
        alpha.tenant.ownerUserId,
        STAT_YEAR,
      )

      // All-time reads the traveller's own visited list, which A cannot see.
      expect(allTime.countryCount).toBe(0)
      // A year row reads `trips.country_codes` over the trips the traveller is a member of. A's
      // two-country trip is in A's organization and B's owner is on none of it, so the set is empty
      // — where before the amendment this row printed A's own count of 2.
      expect(yearRow.countryCount).toBe(0)
      // A's owner is on that trip, so the two codes are there to be counted and the zero above is
      // the membership predicate rather than an unreadable column.
      expect(ownYear.countryCount).toBe(2)
    })

    it('leaves A’s own trip figures off the foreign traveller’s rows', async () => {
      const foreignAllTime = await recomputeTravelStats(
        alpha.tenant.scope,
        beta.tenant.ownerUserId,
        0,
      )
      const foreignYear = await recomputeTravelStats(
        alpha.tenant.scope,
        beta.tenant.ownerUserId,
        STAT_YEAR,
      )
      const ownAllTime = await recomputeTravelStats(
        alpha.tenant.scope,
        alpha.tenant.ownerUserId,
        0,
      )
      const ownYear = await recomputeTravelStats(
        alpha.tenant.scope,
        alpha.tenant.ownerUserId,
        STAT_YEAR,
      )

      const empty = {
        tripCount: 0,
        dayCount: 0,
        placeCount: 0,
        cityCount: 0,
        distanceMetres: 0,
        spendMinor: 0,
        // Never written, so the column keeps its `'EUR'` default — and A's own trips are in `JPY`,
        // so this really is the untouched column rather than A's currency copied across.
        currency: 'EUR',
        lastTripId: null,
      }
      expect(tripFigures(foreignAllTime)).toEqual(empty)
      expect(tripFigures(foreignYear)).toEqual(empty)

      // A's own row over the same rows, so the zeros above are the membership predicate rather
      // than an empty workspace.
      expect(ownAllTime.tripCount).toBe(2)
      expect(ownYear.lastTripId).toBe(alphaYearTripId)
      expect(ownAllTime.distanceMetres).toBe(1_720_000)
      expect(ownAllTime.currency).toBe('JPY')
    })

    it('hides the rows it wrote from the organization the traveller belongs to', async () => {
      const betaBefore = await listTravelStats(
        beta.tenant.scope,
        beta.tenant.ownerUserId,
      )
      const written = await recomputeTravelStats(
        alpha.tenant.scope,
        beta.tenant.ownerUserId,
        0,
      )

      // B's own traveller, read from B: the all-time row A just wrote is not there, and the row B
      // did have is untouched.
      expect(
        await getTravelStats(beta.tenant.scope, beta.tenant.ownerUserId, 0),
      ).toBeNull()
      expect(
        await listTravelStats(beta.tenant.scope, beta.tenant.ownerUserId),
      ).toEqual(betaBefore)
      // And A's own traveller is invisible from B in either direction.
      expect(
        await getTravelStats(beta.tenant.scope, alpha.tenant.ownerUserId, 0),
      ).toBeNull()
      expect(
        await listTravelStats(beta.tenant.scope, alpha.tenant.ownerUserId),
      ).toEqual([])

      const error = await captureError(() =>
        travelStatsRepository.requireById(beta.tenant.scope, written.id),
      )
      expect(error).toBeInstanceOf(NotFoundError)
      // The same id resolves inside the organization that wrote it.
      expect(
        await travelStatsRepository.findById(alpha.tenant.scope, written.id),
      ).not.toBeNull()
    })
  })

  /**
   * The `00-S4` amendment's own case, and the half a tenant filter cannot cover.
   *
   * The block above proves a foreign traveller's row is empty, but a tenant filter already made
   * most of that true. The predicate this stage adds is the one asserted here: A's own workspace
   * member, on none of A's trips, gets an empty row inside the organization they belong to — while
   * A's owner, over the same rows, does not.
   */
  describe('travel stats for a workspace member who is on no trip', () => {
    it('counts none of A’s trips for a non-member, and none of B’s for either', async () => {
      // `seedWorld` adds the second traveller to the organization and to nothing else: the only
      // `trip_members` row on A's trip is the owner's, written by `createTrip`.
      const outsider = await recomputeTravelStats(
        alpha.tenant.scope,
        alpha.secondUserId,
        0,
      )
      const owner = await recomputeTravelStats(
        alpha.tenant.scope,
        alpha.tenant.ownerUserId,
        0,
      )

      expect(outsider.tripCount).toBe(0)
      expect(outsider.dayCount).toBe(0)
      expect(outsider.placeCount).toBe(0)
      expect(outsider.cityCount).toBe(0)
      expect(outsider.spendMinor).toBe(0)
      expect(outsider.distanceMetres).toBe(0)
      expect(outsider.lastTripId).toBeNull()

      // The same statement, one trip membership apart. B's identical world is absent from both.
      expect(owner.tripCount).toBe(1)
      expect(owner.lastTripId).toBe(alpha.tripId)
      expect(owner.spendMinor).toBeGreaterThan(0)
    })

    it('counts an organization-visible trip no more than a private one', async () => {
      // Membership, never readability: `visibility: 'organization'` makes the trip one A's second
      // traveller may open, which is not the same as one they are travelling on.
      await createTrip(alpha.tenant.scope, {
        title: 'Open to the workspace',
        startDate: `${STAT_YEAR}-09-01`,
        endDate: `${STAT_YEAR}-09-04`,
        countryCodes: ['IT'],
        currency: 'EUR',
        visibility: 'organization',
      })

      const outsider = await recomputeTravelStats(
        alpha.tenant.scope,
        alpha.secondUserId,
        STAT_YEAR,
      )
      const owner = await recomputeTravelStats(
        alpha.tenant.scope,
        alpha.tenant.ownerUserId,
        STAT_YEAR,
      )

      expect(outsider.tripCount).toBe(0)
      expect(outsider.countryCount).toBe(0)
      expect(outsider.lastTripId).toBeNull()
      // The trip is there, and on the owner's row it is counted: the zeros above are the membership
      // predicate and not a missing trip.
      expect(owner.tripCount).toBe(2)
    })

    it('empties a year row a membership no longer supports', async () => {
      const membership = await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: alpha.secondUserId,
        role: 'viewer',
      })
      const joined = await recomputeTravelStats(
        alpha.tenant.scope,
        alpha.secondUserId,
        STAT_YEAR,
      )
      expect(joined.tripCount).toBe(1)
      expect(joined.lastTripId).toBe(alpha.tripId)

      await removeTripMember(alpha.tenant.scope, membership.id)

      const left = await recomputeTravelStats(
        alpha.tenant.scope,
        alpha.secondUserId,
        STAT_YEAR,
      )
      expect(left.tripCount).toBe(0)
      expect(left.dayCount).toBe(0)
      expect(left.lastTripId).toBeNull()
    })
  })

  describe('split arithmetic', () => {
    it('always sums back to the expense total', () => {
      const equal = computeShares(100, 'equal', [
        { userId: 'a' },
        { userId: 'b' },
        { userId: 'c' },
      ])
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
      expect(percentage.reduce((total, row) => total + row.shareMinor, 0)).toBe(
        999,
      )

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

  describe('a settlement paid in another currency', () => {
    const payment = {
      amountMinor: 46_488,
      currency: 'JPY',
      settledOn: '2026-04-14',
      originalAmountMinor: 59_600,
      originalCurrency: 'GBP',
      exchangeRate: 195,
    } as const

    it('cannot be recorded onto a foreign trip', async () => {
      const before = await settlementsRepository.findMany(beta.tenant.scope)

      const error = await captureError(() =>
        createSettlement(alpha.tenant.scope, {
          tripId: beta.tripId,
          fromUserId: beta.secondUserId,
          toUserId: beta.tenant.ownerUserId,
          ...payment,
        }),
      )
      expect(error).toBeInstanceOf(NotFoundError)

      // Byte-identical, not merely the same length: a re-scoped write would show up here as a new
      // row, and a re-scoped update as a changed one.
      expect(await settlementsRepository.findMany(beta.tenant.scope)).toEqual(
        before,
      )
    })

    it('is invisible to the other tenant once recorded', async () => {
      const own = await createSettlement(alpha.tenant.scope, {
        tripId: alpha.tripId,
        fromUserId: alpha.secondUserId,
        toUserId: alpha.tenant.ownerUserId,
        ...payment,
      })
      expect(own.originalAmountMinor).toBe(59_600)
      expect(own.originalCurrency).toBe('GBP')
      expect(own.exchangeRate).toBe(195)

      expect(
        await settlementsRepository.findById(beta.tenant.scope, own.id),
      ).toBeNull()
      expect(
        await captureError(() =>
          settlementsRepository.requireById(beta.tenant.scope, own.id),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await settlementsRepository.findById(alpha.tenant.scope, own.id),
      ).not.toBeNull()
    })
  })

  describe('audit recording', () => {
    /**
     * The trail is the one table whose rows deliberately *name* ids from elsewhere: an entry's
     * `entity_id` is free text with no foreign key, so an action against a resource that has since
     * been deleted still reads. That is exactly what makes it worth a case of its own — nothing in
     * the column stops A from writing B's identifiers into it, and the only thing that keeps the
     * entry inside A is `organization_id` on the row and `tenantFilter()` on every read.
     *
     * Returns the id of the entry A wrote about B's reservation.
     */
    async function trailInAlpha(): Promise<string> {
      await trail(alpha.tenant.scope, {
        action: AUDIT_ACTIONS.RESERVATION_DELETED,
        entityType: 'reservation',
        entityId: beta.reservationId,
        metadata: { tripId: beta.tripId },
      })
      const page = await listAuditLog(alpha.tenant.scope, {
        action: AUDIT_ACTIONS.RESERVATION_DELETED,
      })
      expect(page.items).toHaveLength(1)
      return page.items[0].id
    }

    it('keeps an entry naming another tenant’s entity inside the tenant that wrote it', async () => {
      const entryId = await trailInAlpha()

      const inAlpha = await auditLogRepository.requireById(
        alpha.tenant.scope,
        entryId,
      )
      expect(inAlpha.organizationId).toBe(alpha.tenant.organizationId)
      expect(inAlpha.actorUserId).toBe(alpha.tenant.ownerUserId)
      expect(inAlpha.entityId).toBe(beta.reservationId)

      const listedInBeta = await listAuditLog(beta.tenant.scope, { limit: 100 })
      expect(listedInBeta.items.map((row) => row.id)).not.toContain(entryId)

      // The entity id is B's own, so this is the query most likely to leak: B asks for the history
      // of B's reservation and must not be shown A's entry about it.
      const historyInBeta = await listEntityHistory(
        beta.tenant.scope,
        'reservation',
        beta.reservationId,
      )
      expect(historyInBeta.map((row) => row.id)).not.toContain(entryId)

      const historyInAlpha = await listEntityHistory(
        alpha.tenant.scope,
        'reservation',
        beta.reservationId,
      )
      expect(historyInAlpha.map((row) => row.id)).toContain(entryId)
    })

    it('refuses to read that entry by id from the other tenant', async () => {
      const entryId = await trailInAlpha()

      expect(
        await auditLogRepository.findById(beta.tenant.scope, entryId),
      ).toBeNull()
      const error = await captureError(() =>
        auditLogRepository.requireById(beta.tenant.scope, entryId),
      )
      expect(error).toBeInstanceOf(NotFoundError)
    })

    it('counts only the reading tenant’s actions', async () => {
      await trailInAlpha()
      await recordAudit(beta.tenant.scope, { action: 'trip.archived' })

      const inAlpha = await countAuditActions(alpha.tenant.scope)
      const inBeta = await countAuditActions(beta.tenant.scope)

      expect(
        inAlpha.find((row) => row.action === AUDIT_ACTIONS.RESERVATION_DELETED)
          ?.value,
      ).toBe(1)
      expect(inBeta.map((row) => row.action)).not.toContain(
        AUDIT_ACTIONS.RESERVATION_DELETED,
      )
      expect(inBeta.find((row) => row.action === 'trip.archived')?.value).toBe(
        1,
      )
      expect(inAlpha.map((row) => row.action)).not.toContain('trip.archived')
    })
  })

  /**
   * The reminder sweep — the one production path that reads across every tenant in a single query.
   *
   * `src/server/catalog/reminders.ts` answers with rows from every organization at once, which is
   * exactly the shape the tenant layer exists to make unexpressible, so what has to be asserted is
   * the seam *after* the scan: each due trip is reminded under a scope built from that trip's own
   * organization and its own owner, and the inbox rows one tenant's reminder produced are invisible
   * to the other. A single mis-attributed scope here would put B's travellers in A's inbox with no
   * repository call ever having crossed a boundary.
   */
  describe('reminder sweep', () => {
    /** 09:00 UTC on the day a trip starting three days later, with a 3-day lead time, is due. */
    const NOW = Date.UTC(2026, 2, 10, 9)
    const DUE_AT = Date.UTC(2026, 2, 10, 8)
    const REMINDER_KEY = 'trip.starting_soon'

    function kvDouble() {
      const store = new Map<string, string>()
      return {
        store,
        get: async (key: string) => store.get(key) ?? null,
        put: async (key: string, value: string) => {
          store.set(key, value)
        },
        delete: async (key: string) => {
          store.delete(key)
        },
        list: async () => ({
          keys: [...store.keys()].map((name) => ({ name })),
          list_complete: true,
        }),
      }
    }

    function bindings(kv: ReturnType<typeof kvDouble>): TaskBindings {
      return {
        KV: kv,
        FILES: {
          get: async () => null,
          put: async () => undefined,
          head: async () => null,
          delete: async () => undefined,
          list: async () => ({ objects: [], truncated: false }),
        },
        TASKS: {
          send: async () => undefined,
          sendBatch: async () => undefined,
        },
        DB: {} as TaskBindings['DB'],
      }
    }

    async function dueTrip(world: World, title: string): Promise<string> {
      const trip = await createTrip(world.tenant.scope, {
        title,
        currency: 'EUR',
        startDate: '2026-03-13',
        reminderDays: 3,
      })
      return trip.id
    }

    /** Runs one tick over both tenants and returns the KV markers it wrote. */
    async function sweepBoth(): Promise<ReturnType<typeof kvDouble>> {
      const kv = kvDouble()
      const result = await sweepReminders(
        bindings(kv),
        createLogger({ level: 'error', sink: createMemorySink() }),
        NOW,
        { databaseFor: () => harness.db },
      )
      expect(result).toMatchObject({ due: 2, notified: 2, failed: 0 })
      return kv
    }

    /** The reminder rows one tenant's owner can see, read under that tenant's own scope. */
    async function remindersFor(
      world: World,
    ): Promise<Awaited<ReturnType<typeof listNotifications>>['items']> {
      const { items } = await listNotifications(
        world.tenant.scope,
        world.tenant.ownerUserId,
      )
      return items.filter((row) => row.titleKey === REMINDER_KEY)
    }

    /** Switches "Departure reminders" off in one tenant's own preference table. */
    async function optOutInApp(world: World, userId: string): Promise<void> {
      await setPreference(world.tenant.scope, {
        userId,
        eventType: REMINDER_KEY,
        channel: 'in_app',
        isEnabled: false,
      })
    }

    it('reminds each tenant under its own trip’s owner, and never the other’s', async () => {
      const alphaTripId = await dueTrip(alpha, 'Lisbon in spring')
      const betaTripId = await dueTrip(beta, 'Porto in autumn')

      const kv = await sweepBoth()

      const inAlpha = await remindersFor(alpha)
      const inBeta = await remindersFor(beta)
      expect(inAlpha).toHaveLength(1)
      expect(inBeta).toHaveLength(1)

      // The scope each reminder ran under, read off the row it wrote: `notifyMany` stamps
      // `senderUserId` from `scope.ctx.userId`, so this is the sweep's per-trip identity and it is
      // the owner membership of *that* trip, never the other tenant's.
      expect(inAlpha[0]?.senderUserId).toBe(alpha.tenant.ownerUserId)
      expect(inAlpha[0]?.organizationId).toBe(alpha.tenant.organizationId)
      expect(inAlpha[0]?.entityId).toBe(`${alphaTripId}:${DUE_AT}`)
      expect(inBeta[0]?.senderUserId).toBe(beta.tenant.ownerUserId)
      expect(inBeta[0]?.organizationId).toBe(beta.tenant.organizationId)
      expect(inBeta[0]?.entityId).toBe(`${betaTripId}:${DUE_AT}`)

      // The markers are keyed by organization, so one tenant's sweep can never close another's
      // window — the failure that would silently cost a workspace its reminders.
      expect([...kv.store.keys()].sort()).toEqual(
        [
          `reminded:${alpha.tenant.organizationId}:${alphaTripId}:${DUE_AT}`,
          `reminded:${beta.tenant.organizationId}:${betaTripId}:${DUE_AT}`,
        ].sort(),
      )
    })

    it('lets a Departure reminders opt-out govern its own tenant and no other', async () => {
      const alphaTripId = await dueTrip(alpha, 'Lisbon in spring')
      const betaTripId = await dueTrip(beta, 'Porto in autumn')

      // Two opt-out rows in B, both carrying the event type and channel A's reminder is dispatched
      // under: one for B's own owner, and one naming *A's* owner — `notification_preferences.user_id`
      // is a `userRef()` with no foreign key, so B can write that row, and only the tenant filter on
      // the read stops it from reaching across.
      await optOutInApp(beta, beta.tenant.ownerUserId)
      await optOutInApp(beta, alpha.tenant.ownerUserId)

      const kv = await sweepBoth()

      // One tick, two answers: B's traveller is suppressed, A's is reminded. `sweepBoth` has
      // already asserted both trips counted `notified` — an opt-out filters recipients and never
      // reopens the window.
      expect(await remindersFor(alpha)).toHaveLength(1)
      expect(await remindersFor(beta)).toEqual([])
      expect([...kv.store.keys()].sort()).toEqual(
        [
          `reminded:${alpha.tenant.organizationId}:${alphaTripId}:${DUE_AT}`,
          `reminded:${beta.tenant.organizationId}:${betaTripId}:${DUE_AT}`,
        ].sort(),
      )
    })

    it('refuses to read either tenant’s reminder rows from the other', async () => {
      await dueTrip(alpha, 'Lisbon in spring')
      await dueTrip(beta, 'Porto in autumn')

      await sweepBoth()

      const alphaRow = (await remindersFor(alpha))[0]
      const betaRow = (await remindersFor(beta))[0]
      const alphaId = alphaRow.id
      const betaId = betaRow.id

      expect(
        await notificationsRepository.findById(beta.tenant.scope, alphaId),
      ).toBeNull()
      expect(
        await captureError(() =>
          notificationsRepository.requireById(beta.tenant.scope, alphaId),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await notificationsRepository.findById(alpha.tenant.scope, betaId),
      ).toBeNull()
      expect(
        await captureError(() =>
          notificationsRepository.requireById(alpha.tenant.scope, betaId),
        ),
      ).toBeInstanceOf(NotFoundError)

      // And neither tenant can reach the other's traveller by asking for their inbox.
      expect(
        (await listNotifications(beta.tenant.scope, alpha.tenant.ownerUserId))
          .items,
      ).toHaveLength(0)
      expect(
        (await listNotifications(alpha.tenant.scope, beta.tenant.ownerUserId))
          .items,
      ).toHaveLength(0)
    })
  })
  /**
   * 03-S1 — a transport anchored to a departure day and an arrival day.
   *
   * The new surface is a second day reference, and a reference is exactly what a
   * tenant boundary is crossed by: a row parented onto a foreign day would be a
   * dangling pointer into another workspace's itinerary, invisible in every list
   * because the list is scoped and the pointer is not.
   *
   * The read half is asserted as what it is rather than as what a writer does.
   * `listTripTransports`, `listDayTransports`, `summariseTripTransports`,
   * `totalTripDistanceMetres` and `getTransport` take an id and filter on
   * `organization_id`; handed B's id from A's scope they answer *empty*, which is
   * the same isolation stated in the shape a `WHERE` clause can state it. Only the
   * calls that resolve a row before acting on it — the four writers — can raise,
   * and they do.
   */
  describe('a transport and both of its day references', () => {
    it('answers nothing when asked, from A, about B rows', async () => {
      const scope = alpha.tenant.scope

      expect(await getTransport(scope, beta.transportId)).toBeNull()
      expect(await listTripTransports(scope, beta.tripId)).toEqual([])
      expect(await listDayTransports(scope, beta.dayId)).toEqual([])
      expect(await summariseTripTransports(scope, beta.tripId)).toEqual([])
      expect(await totalTripDistanceMetres(scope, beta.tripId)).toBe(0)

      // The same ids resolve for their own tenant, so it is scoping that hid them.
      expect(
        await getTransport(beta.tenant.scope, beta.transportId),
      ).not.toBeNull()
      expect(
        await listTripTransports(beta.tenant.scope, beta.tripId),
      ).toHaveLength(1)
      expect(
        await totalTripDistanceMetres(beta.tenant.scope, beta.tripId),
      ).toBe(1_720_000)
    })

    it('never catches the other tenant’s next departure', async () => {
      // Both worlds seed one flight on 2026-04-10. Confirming B's makes it the only
      // candidate in the whole database, so a read that leaked would return it.
      await setTransportStatus(beta.tenant.scope, beta.transportId, 'confirmed')

      expect(
        await nextDeparture(alpha.tenant.scope, { from: '2026-01-01' }),
      ).toBeNull()
      expect(
        (await nextDeparture(beta.tenant.scope, { from: '2026-01-01' }))?.id,
      ).toBe(beta.transportId)
    })

    it('refuses every write against a B row from A’s scope', async () => {
      const scope = alpha.tenant.scope
      const before = await getTransport(beta.tenant.scope, beta.transportId)

      const attempts: ReadonlyArray<() => Promise<unknown>> = [
        () => updateTransport(scope, beta.transportId, { title: 'Hijacked' }),
        () => setTransportStatus(scope, beta.transportId, 'cancelled'),
        () => deleteTransport(scope, beta.transportId),
      ]
      for (const attempt of attempts) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }

      expect(await getTransport(beta.tenant.scope, beta.transportId)).toEqual(
        before,
      )
    })

    it('refuses a departure day or an arrival day belonging to B', async () => {
      const scope = alpha.tenant.scope

      expect(
        await captureError(() =>
          createTransport(scope, {
            tripId: alpha.tripId,
            title: 'Cross-parented departure',
            mode: 'flight',
            dayId: beta.dayId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          createTransport(scope, {
            tripId: alpha.tripId,
            title: 'Cross-parented arrival',
            mode: 'flight',
            dayId: alpha.dayId,
            arrivalDayId: beta.lastDayId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      // Not one row landed: A's own transport count is still the single seeded one.
      expect(await transportsRepository.count(scope)).toBe(1)
    })

    it('refuses to move an A row onto a B day', async () => {
      const scope = alpha.tenant.scope

      expect(
        await captureError(() =>
          updateTransport(scope, alpha.transportId, { dayId: beta.dayId }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          updateTransport(scope, alpha.transportId, {
            arrivalDayId: beta.lastDayId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      const own = await getTransport(scope, alpha.transportId)
      expect(own?.dayId).toBe(alpha.dayId)
      expect(own?.arrivalDayId).toBeNull()
    })

    it('never unlinks a B transport from its arrival day from A’s scope', async () => {
      await updateTransport(beta.tenant.scope, beta.transportId, {
        arrivalDayId: beta.lastDayId,
      })

      expect(
        await unlinkTransportsFromDays(alpha.tenant.scope, [beta.lastDayId]),
      ).toBe(0)
      expect(
        (await getTransport(beta.tenant.scope, beta.transportId))?.arrivalDayId,
      ).toBe(beta.lastDayId)

      // The same call from B's own scope does clear it, so it is scoping that refused A.
      expect(
        await unlinkTransportsFromDays(beta.tenant.scope, [beta.lastDayId]),
      ).toBe(1)
    })

    it('leaves B byte-identical after every refusal', async () => {
      const scope = alpha.tenant.scope
      const before = await listTripTransports(beta.tenant.scope, beta.tripId)
      const daysBefore = await listTripDays(beta.tenant.scope, beta.tripId)

      const attempts: ReadonlyArray<() => Promise<unknown>> = [
        () =>
          createTransport(scope, {
            tripId: beta.tripId,
            title: 'Stolen journey',
            mode: 'train',
          }),
        () =>
          createTransport(scope, {
            tripId: alpha.tripId,
            title: 'Cross-parented',
            mode: 'train',
            arrivalDayId: beta.dayId,
          }),
        () => updateTransport(scope, beta.transportId, { title: 'Hijacked' }),
        () => setTransportStatus(scope, beta.transportId, 'cancelled'),
        () => deleteTransport(scope, beta.transportId),
      ]
      for (const attempt of attempts) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }

      expect(await listTripTransports(beta.tenant.scope, beta.tripId)).toEqual(
        before,
      )
      expect(await listTripDays(beta.tenant.scope, beta.tripId)).toEqual(
        daysBefore,
      )
    })
  })
  /**
   * 03-S2b — the station chain, and who may replace it.
   *
   * Two boundaries meet on this writer and they are asserted apart. The first is
   * the tenant one, which every other block here states: B's legs are invisible
   * from A by transport id and by trip id, and a leg may not be parented onto B's
   * day even when the parent transport is A's own.
   *
   * The second is destructive and belongs to this writer alone. `replaceTransportChain`
   * **deletes before it inserts**, so "refused" is not enough: a call that threw
   * after the delete and before the insert would leave B's journey with no legs
   * and every other assertion in this file still green. B's rows are therefore
   * counted before and after and must be identical.
   *
   * The third is not a tenant boundary at all. A trip role is a role *inside* one
   * workspace, so it is asserted in both directions on one trip: a viewer on
   * their own trip is refused and an editor on that same trip is allowed, which
   * proves the guard discriminates rather than merely throws.
   */
  describe('a transport’s station chain', () => {
    /** Three stations, so a refusal that dropped one leg would still be visible. */
    const CHAIN = {
      stations: [
        { name: 'Shin-Osaka', code: 'OSA', timezone: 'Asia/Tokyo' },
        { name: 'Nagoya', code: 'NGO', timezone: 'Asia/Tokyo' },
        { name: 'Tokyo', code: 'TYO', timezone: 'Asia/Tokyo' },
      ],
      legs: [{ serviceNumber: 'Hikari 500' }, { serviceNumber: 'Nozomi 24' }],
    }

    beforeEach(async () => {
      await replaceTransportChain(beta.tenant.scope, beta.transportId, CHAIN)
    })

    it('answers nothing when asked, from A, about B’s legs', async () => {
      const scope = alpha.tenant.scope

      expect(await listTransportLegs(scope, beta.transportId)).toEqual([])
      expect(await listTripLegs(scope, beta.tripId)).toEqual([])

      // The same ids resolve for their own tenant, so it is scoping that hid them.
      expect(
        await listTransportLegs(beta.tenant.scope, beta.transportId),
      ).toHaveLength(2)
      expect(await listTripLegs(beta.tenant.scope, beta.tripId)).toHaveLength(2)
    })

    it('refuses to replace the chain of a B transport from A’s scope', async () => {
      expect(
        await captureError(() =>
          replaceTransportChain(alpha.tenant.scope, beta.transportId, {
            stations: [{ name: 'Hijacked' }, { name: 'Elsewhere' }],
            legs: [{}],
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
    })

    it('refuses a leg parented onto a B day even on A’s own transport', async () => {
      const scope = alpha.tenant.scope

      for (const leg of [
        { departureDayId: beta.dayId },
        { arrivalDayId: beta.lastDayId },
      ]) {
        expect(
          await captureError(() =>
            replaceTransportChain(scope, alpha.transportId, {
              stations: [{ name: 'Lisbon' }, { name: 'Porto' }],
              legs: [leg],
            }),
          ),
        ).toBeInstanceOf(NotFoundError)
      }

      // Not one row landed: a dropped reference would have written a leg anyway.
      expect(await listTransportLegs(scope, alpha.transportId)).toEqual([])
    })

    it('deletes nothing of B’s while refusing', async () => {
      const scope = alpha.tenant.scope
      const before = await listTripLegs(beta.tenant.scope, beta.tripId)
      expect(before).toHaveLength(2)

      const attempts: ReadonlyArray<() => Promise<unknown>> = [
        () =>
          replaceTransportChain(scope, beta.transportId, {
            stations: [{ name: 'Hijacked' }, { name: 'Elsewhere' }],
            legs: [{}],
          }),
        () =>
          replaceTransportChain(scope, beta.transportId, {
            stations: [],
            legs: [],
          }),
      ]
      for (const attempt of attempts) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }

      expect(await listTripLegs(beta.tenant.scope, beta.tripId)).toEqual(before)
      expect(await transportLegsRepository.count(beta.tenant.scope)).toBe(
        before.length,
      )
    })

    /**
     * Not a tenant boundary: one workspace, one trip, two roles. Membership is
     * not a role, and the collaborative session already refuses a viewer the
     * equivalent edit (`src/server/do/trip-room.ts:358`).
     */
    it('refuses a viewer and admits an editor on the same trip', async () => {
      const viewerId = await alpha.tenant.addUser('Viewer of A')
      const editorId = await alpha.tenant.addUser('Editor of A')
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: viewerId,
        role: 'viewer',
      })
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: editorId,
        role: 'editor',
      })

      expect(
        await captureError(() =>
          replaceTransportChain(
            alpha.tenant.scopeFor(viewerId),
            alpha.transportId,
            { stations: [{ name: 'Lisbon' }, { name: 'Porto' }], legs: [{}] },
          ),
        ),
      ).toBeInstanceOf(TripRoleError)
      expect(
        await listTransportLegs(alpha.tenant.scope, alpha.transportId),
      ).toEqual([])

      expect(
        await replaceTransportChain(
          alpha.tenant.scopeFor(editorId),
          alpha.transportId,
          { stations: [{ name: 'Lisbon' }, { name: 'Porto' }], legs: [{}] },
        ),
      ).toHaveLength(1)
    })
  })
  /**
   * 03-S4 — a booking that knows which stop it is for, and what it cost.
   *
   * Three surfaces cross the boundary here and each is asserted from the side
   * that can be fooled. The **stop link** is a reference into another workspace's
   * itinerary. The **cost link** is a reference the server writes on the caller's
   * behalf, which is exactly the kind an attacker would rather supply than earn —
   * so it is resolved through a scoped read on both ends rather than trusted. The
   * **import marker** is written in bulk over a list of ids, which is the one
   * write in this file whose `where` is not a single primary key.
   *
   * The role guard is asserted in the same block because it is the layer above
   * all three: a `viewer` on their own trip is inside the tenant, inside the trip,
   * and still may not write.
   */
  describe('a booking, the stop it is for, and the cost line it wrote', () => {
    it('answers nothing when asked, from A, about B rows', async () => {
      const scope = alpha.tenant.scope

      expect(await getReservation(scope, beta.reservationId)).toBeNull()
      expect(
        await listTripReservations(scope, { tripId: beta.tripId }),
      ).toEqual([])

      // The same ids resolve for their own tenant, so it is scoping that hid them.
      expect(
        await getReservation(beta.tenant.scope, beta.reservationId),
      ).not.toBeNull()
      expect(
        await listTripReservations(beta.tenant.scope, { tripId: beta.tripId }),
      ).toHaveLength(1)
    })

    it('refuses every write against a B booking from A’s scope', async () => {
      const scope = alpha.tenant.scope
      const before = await getReservation(beta.tenant.scope, beta.reservationId)

      const attempts: ReadonlyArray<() => Promise<unknown>> = [
        () =>
          updateReservation(scope, beta.reservationId, { title: 'Hijacked' }),
        () => setReservationStatus(scope, beta.reservationId, 'cancelled'),
        () => deleteReservation(scope, beta.reservationId),
        () =>
          linkReservationExpense(scope, beta.reservationId, alpha.expenseId),
        () => clearReservationImported(scope, beta.reservationId),
      ]
      for (const attempt of attempts) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }

      expect(
        await getReservation(beta.tenant.scope, beta.reservationId),
      ).toEqual(before)
    })

    it('refuses to move an A booking onto a B stop', async () => {
      const scope = alpha.tenant.scope

      expect(
        await captureError(() =>
          updateReservation(scope, alpha.reservationId, {
            assignmentId: beta.assignmentId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      const own = await getReservation(scope, alpha.reservationId)
      expect(own?.assignmentId).toBeNull()
    })

    /**
     * The case that proves the cost link cannot be used to reach across tenants.
     * A owns the booking, so `requireById` lets it through; the expense is B's,
     * and the scoped read behind it returns null rather than a row.
     */
    it('refuses to link A’s booking to B’s cost line', async () => {
      const scope = alpha.tenant.scope

      expect(
        await captureError(() =>
          linkReservationExpense(scope, alpha.reservationId, beta.expenseId),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        (await getReservation(scope, alpha.reservationId))?.expenseId,
      ).toBeNull()
    })

    it('links a booking to a cost line of its own trip, and unlinks it again', async () => {
      const scope = alpha.tenant.scope

      const linked = await linkReservationExpense(
        scope,
        alpha.reservationId,
        alpha.expenseId,
      )
      expect(linked.expenseId).toBe(alpha.expenseId)

      const unlinked = await linkReservationExpense(
        scope,
        alpha.reservationId,
        null,
      )
      expect(unlinked.expenseId).toBeNull()
    })

    it('never writes a ledger row into B, whatever combination of ids it is given', async () => {
      const scope = alpha.tenant.scope
      const before = await expensesRepository.count(beta.tenant.scope)
      const bookingsBefore = await listTripReservations(beta.tenant.scope, {
        tripId: beta.tripId,
      })

      const attempts: ReadonlyArray<() => Promise<unknown>> = [
        () =>
          createExpense(scope, {
            tripId: beta.tripId,
            title: 'Stolen cost line',
            amountMinor: 1_000,
            spentOn: '2026-04-10',
          }),
        () => linkReservationExpense(scope, beta.reservationId, beta.expenseId),
        () =>
          linkReservationExpense(scope, alpha.reservationId, beta.expenseId),
        () =>
          linkReservationExpense(scope, beta.reservationId, alpha.expenseId),
      ]
      for (const attempt of attempts) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }

      expect(await expensesRepository.count(beta.tenant.scope)).toBe(before)
      expect(
        await listTripReservations(beta.tenant.scope, { tripId: beta.tripId }),
      ).toEqual(bookingsBefore)
      expect(
        (await getExpense(beta.tenant.scope, beta.expenseId))?.tripId,
      ).toBe(beta.tripId)
    })

    /**
     * The bulk writer's `where` is an id list, so it is the one place a foreign
     * id could be marked by being named rather than by being owned. The count it
     * returns is what makes that visible: without it, a silent no-op on B's id is
     * indistinguishable from success.
     */
    it('marks only the rows the caller owns, and says how many', async () => {
      const scope = alpha.tenant.scope

      expect(
        await markReservationsImported(scope, [
          alpha.reservationId,
          beta.reservationId,
        ]),
      ).toBe(1)

      expect(
        (await getReservation(scope, alpha.reservationId))?.importedAt,
      ).toBeInstanceOf(Date)
      expect(
        (await getReservation(beta.tenant.scope, beta.reservationId))
          ?.importedAt,
      ).toBeNull()
    })

    it('clears its own marker twice without complaining', async () => {
      const scope = alpha.tenant.scope
      await markReservationsImported(scope, [alpha.reservationId])

      expect(
        (await clearReservationImported(scope, alpha.reservationId)).importedAt,
      ).toBeNull()
      expect(
        (await clearReservationImported(scope, alpha.reservationId)).importedAt,
      ).toBeNull()
    })

    /**
     * The strip defect this stage exists to close, asserted from the outside:
     * `createReservationInput` and `updateReservationInput` are `z.object`s, so an
     * `importedAt` handed to either is dropped rather than refused. If it were
     * ever declared there, a hand-typed booking could claim to be machine-written.
     */
    it('cannot be marked as imported through a booking payload', async () => {
      const scope = alpha.tenant.scope

      // Declared as variables rather than inline, so the extra key reaches the
      // validator instead of being caught by the compiler's excess-property check —
      // a request off the wire is exactly that: a wider object than the schema.
      const creation = {
        tripId: alpha.tripId,
        title: 'Typed by a person',
        importedAt: new Date(),
      }
      const created = await createReservation(scope, creation)
      expect(created.importedAt).toBeNull()

      const edit = { title: 'Still typed by a person', importedAt: new Date() }
      const updated = await updateReservation(scope, alpha.reservationId, edit)
      expect(updated.title).toBe('Still typed by a person')
      expect(updated.importedAt).toBeNull()
    })

    it('lets an editor write and refuses a viewer, on their own trip', async () => {
      const editorId = await alpha.tenant.addUser('Editor')
      const viewerId = await alpha.tenant.addUser('Viewer')
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: editorId,
        role: 'editor',
      })
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: viewerId,
        role: 'viewer',
      })

      const editor = alpha.tenant.scopeFor(editorId)
      const viewer = alpha.tenant.scopeFor(viewerId)

      const written = await createReservation(editor, {
        tripId: alpha.tripId,
        title: 'Added by the editor',
      })
      expect(written.tripId).toBe(alpha.tripId)

      // `FORBIDDEN` is the code every caller maps to a 403, so it is the code that
      // is asserted rather than the class or the sentence.
      const refusalCode = async (
        run: () => Promise<unknown>,
      ): Promise<string> => {
        const error = await captureError(run)
        return error instanceof RepositoryError ? error.code : error.name
      }

      expect(
        await refusalCode(() =>
          createReservation(viewer, {
            tripId: alpha.tripId,
            title: 'Added by the viewer',
          }),
        ),
      ).toBe('FORBIDDEN')

      // And the same refusal on every other writer this file owns.
      for (const attempt of [
        () =>
          updateReservation(viewer, alpha.reservationId, { title: 'Hijacked' }),
        () => setReservationStatus(viewer, alpha.reservationId, 'cancelled'),
        () => deleteReservation(viewer, alpha.reservationId),
        () =>
          linkReservationExpense(viewer, alpha.reservationId, alpha.expenseId),
      ]) {
        expect(await refusalCode(attempt)).toBe('FORBIDDEN')
      }
    })
  })

  /**
   * 03-S3 — a connection found for the traveller, saved as an ordinary journey.
   *
   * Two ids arrive from the browser on this path and each is re-resolved in the
   * caller's own scope. The **trip** id is the usual one. The **transport** id is
   * the one worth a case of its own, because a re-search *replaces* rows: a
   * missing scope check here would not fail loudly, it would quietly rewrite
   * another workspace's journey with a route it never asked for.
   *
   * The cache key is asserted where it lives, in
   * `src/server/transit/__tests__/search.test.ts`, and for the opposite reason:
   * it must be the *same* string for both tenants.
   */
  describe('a connection saved as a journey, and re-searched in place', () => {
    /** Two legs, so a refusal that dropped one would still be visible. */
    const CONNECTION = {
      mode: 'train' as const,
      title: 'Lisboa to Porto',
      stations: [
        { name: 'Lisboa Santa Apolonia', code: 'LIS' },
        { name: 'Coimbra-B' },
        { name: 'Porto Campanha', code: 'OPO' },
      ],
      legs: [
        { serviceNumber: 'IC 728', departureTime: '08:12' },
        { serviceNumber: 'IC 728', arrivalTime: '11:03' },
      ],
    }

    it('refuses to hang a found connection off B\u2019s trip, and writes nothing', async () => {
      const before = await transportsRepository.count(beta.tenant.scope)

      expect(
        await captureError(() =>
          saveSearchedConnection(alpha.tenant.scope, {
            ...CONNECTION,
            tripId: beta.tripId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(await transportsRepository.count(beta.tenant.scope)).toBe(before)
      expect(await transportLegsRepository.count(beta.tenant.scope)).toBe(0)
      // Nor did it land in A's own workspace under B's trip id.
      expect(await transportsRepository.count(alpha.tenant.scope)).toBe(1)
    })

    it('refuses to re-search B\u2019s journey, and leaves its chain byte-identical', async () => {
      await saveSearchedConnection(beta.tenant.scope, {
        ...CONNECTION,
        tripId: beta.tripId,
        transportId: beta.transportId,
      })
      const before = await listTransportLegs(
        beta.tenant.scope,
        beta.transportId,
      )
      expect(before).toHaveLength(2)

      for (const tripId of [beta.tripId, alpha.tripId]) {
        expect(
          await captureError(() =>
            saveSearchedConnection(alpha.tenant.scope, {
              ...CONNECTION,
              tripId,
              transportId: beta.transportId,
              stations: [{ name: 'Hijacked' }, { name: 'Elsewhere' }],
              legs: [{}],
            }),
          ),
        ).toBeInstanceOf(NotFoundError)
      }

      expect(
        await listTransportLegs(beta.tenant.scope, beta.transportId),
      ).toEqual(before)
    })

    it('refuses a transport of another trip inside the same workspace', async () => {
      const other = await createTrip(alpha.tenant.scope, {
        title: 'A second trip of A',
        startDate: '2027-01-01',
        endDate: '2027-01-04',
      })

      expect(
        await captureError(() =>
          saveSearchedConnection(alpha.tenant.scope, {
            ...CONNECTION,
            tripId: other.id,
            transportId: alpha.transportId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await listTransportLegs(alpha.tenant.scope, alpha.transportId),
      ).toEqual([])
    })

    it('keeps the record\u2019s identity, status and booking fields on a re-search', async () => {
      const scope = alpha.tenant.scope
      const saved = await saveSearchedConnection(scope, {
        ...CONNECTION,
        tripId: alpha.tripId,
        priceMinor: 2450,
        currency: 'EUR',
      })
      await updateTransport(scope, saved.transport.id, {
        status: 'confirmed',
        bookingCode: 'TXK9QP',
        seat: '21A',
      })

      const again = await saveSearchedConnection(scope, {
        ...CONNECTION,
        tripId: alpha.tripId,
        transportId: saved.transport.id,
        title: 'A different name the search proposed',
        priceMinor: 9900,
        currency: 'USD',
        stations: [{ name: 'Lisboa Oriente' }, { name: 'Porto Campanha' }],
        legs: [{ serviceNumber: 'AP 124' }],
      })

      expect(again.transport.id).toBe(saved.transport.id)
      expect(again.transport.status).toBe('confirmed')
      expect(again.transport.bookingCode).toBe('TXK9QP')
      expect(again.transport.seat).toBe('21A')
      expect(again.transport.title).toBe('Lisboa to Porto')
      expect(again.transport.priceMinor).toBe(2450)
      expect(again.transport.currency).toBe('EUR')
      // The route, and only the route, is what a re-search replaces.
      expect(again.legs).toHaveLength(1)
      expect(again.transport.departureName).toBe('Lisboa Oriente')
      expect(again.transport.arrivalName).toBe('Porto Campanha')
    })

    it('refuses a viewer and admits an editor on the same trip', async () => {
      const viewerId = await alpha.tenant.addUser('Viewer of A')
      const editorId = await alpha.tenant.addUser('Editor of A')
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: viewerId,
        role: 'viewer',
      })
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: editorId,
        role: 'editor',
      })

      expect(
        await captureError(() =>
          saveSearchedConnection(alpha.tenant.scopeFor(viewerId), {
            ...CONNECTION,
            tripId: alpha.tripId,
          }),
        ),
      ).toBeInstanceOf(TripRoleError)

      const saved = await saveSearchedConnection(
        alpha.tenant.scopeFor(editorId),
        { ...CONNECTION, tripId: alpha.tripId },
      )
      expect(saved.legs).toHaveLength(2)
    })
  })

  /**
   * The trip lifecycle (`01-S1`, PRD #104 decisions 1, 2 and 6).
   *
   * Two refusals that must never collapse into one. Across the boundary every lifecycle write is a
   * `NotFoundError`, identical to the one a trip that does not exist raises — so B's trip ids stay
   * unguessable from A. Inside A's own organization the refusal is `FORBIDDEN`, and that is safe
   * precisely because the caller has already proved they may see the trip.
   */
  describe('trip lifecycle', () => {
    it('refuses every lifecycle write across the boundary, leaving B untouched', async () => {
      const scope = alpha.tenant.scope
      const before = await tripsRepository.findById(
        beta.tenant.scope,
        beta.tripId,
      )

      for (const attempt of [
        () => updateTrip(scope, beta.tripId, { title: 'Hijacked' }),
        () => archiveTrip(scope, beta.tripId),
        () => restoreTrip(scope, beta.tripId),
        () => deleteTrip(scope, beta.tripId),
      ]) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }

      expect(
        await tripsRepository.findById(beta.tenant.scope, beta.tripId),
      ).toEqual(before)
      expect(
        (await listTripDays(beta.tenant.scope, beta.tripId)).length,
      ).toBeGreaterThan(0)
      expect(
        await placesRepository.count(
          beta.tenant.scope,
          eq(places.tripId, beta.tripId),
        ),
      ).toBe(1)
    })

    it('answers a demoted owner with FORBIDDEN, not NOT_FOUND', async () => {
      const scope = alpha.tenant.scope
      // A second owner first: since `01-S6a` `updateTripMember` refuses to demote a trip's last
      // one, and the demotion here is only the setup for the refusal this case is about.
      await addTripMember(scope, {
        tripId: alpha.tripId,
        userId: await alpha.tenant.addUser('Co-owner of A'),
        role: 'owner',
      })
      const membership = (await listTripMembers(scope, alpha.tripId)).find(
        (row) => row.userId === alpha.tenant.ownerUserId,
      )
      expect(membership).toBeDefined()
      if (membership === undefined) return

      await updateTripMember(scope, membership.id, { role: 'editor' })

      const refusal = await captureError(() => archiveTrip(scope, alpha.tripId))
      expect(refusal).toBeInstanceOf(RepositoryError)
      expect(refusal).not.toBeInstanceOf(NotFoundError)
      expect((refusal as RepositoryError).code).toBe('FORBIDDEN')

      // Still readable, which is what makes the two failures different questions.
      expect((await requireTrip(scope, alpha.tripId)).id).toBe(alpha.tripId)
    })

    it('never lets a foreign trip into a list, a count or a role map', async () => {
      const scope = alpha.tenant.scope

      expect((await listTrips(scope)).map((row) => row.id)).toEqual([
        alpha.tripId,
      ])
      expect((await countTripsByStatus(scope)).total).toBe(1)
      expect((await tripRolesFor(scope, [beta.tripId])).size).toBe(0)
      expect(await canReadTrip(scope, beta.tripId)).toBe(false)
    })

    it('refuses a delete to a demoted owner, and the trip survives it', async () => {
      const scope = alpha.tenant.scope
      // As above: the last-owner guard would refuse the demotion, which is not what is on trial.
      await addTripMember(scope, {
        tripId: alpha.tripId,
        userId: await alpha.tenant.addUser('Co-owner of A'),
        role: 'owner',
      })
      const membership = (await listTripMembers(scope, alpha.tripId)).find(
        (row) => row.userId === alpha.tenant.ownerUserId,
      )
      expect(membership).toBeDefined()
      if (membership === undefined) return

      await updateTripMember(scope, membership.id, { role: 'editor' })

      const refusal = await captureError(() => deleteTrip(scope, alpha.tripId))
      expect((refusal as RepositoryError).code).toBe('FORBIDDEN')
      expect((await requireTrip(scope, alpha.tripId)).id).toBe(alpha.tripId)
    })

    /** `01-S6a` — the trip's people, read and written across the tenant boundary. */
    describe('a trip’s people', () => {
      it('refuses a foreign trip’s participants rather than reporting it has none', async () => {
        // The trap this closes: `listTripMembers` is tenant-filtered, so B's trip id answers `[]`
        // through it. `listTripParticipants` resolves the trip *first*, so the answer is a refusal
        // and not the far more convincing lie that the trip exists and is empty.
        expect(
          await captureError(() =>
            listTripParticipants(alpha.tenant.scope, beta.tripId),
          ),
        ).toBeInstanceOf(NotFoundError)
      })

      it('refuses to seat a user from another organization on its own trip', async () => {
        const before = await listTripMembers(alpha.tenant.scope, alpha.tripId)

        const refusal = await captureError(() =>
          addTripMember(alpha.tenant.scope, {
            tripId: alpha.tripId,
            userId: beta.tenant.ownerUserId,
            role: 'editor',
          }),
        )

        expect(refusal).toBeInstanceOf(RepositoryError)
        expect((refusal as RepositoryError).code).toBe(
          'TRIP_MEMBER_NOT_IN_WORKSPACE',
        )
        // The tenant column on `trip_members` would have made the row invisible either way; what
        // matters is that the row was never written, so B's owner never becomes A's collaborator.
        expect(await listTripMembers(alpha.tenant.scope, alpha.tripId)).toEqual(
          before,
        )
      })

      it('counts none of a foreign trip’s people through tripMemberUserIds', async () => {
        // The projection `readTripForDelete` reads the delete dialog's member count off. An
        // unscoped one would hand A both how many people are on B's trip and who they are.
        expect(
          await tripMemberUserIds(alpha.tenant.scope, beta.tripId),
        ).toEqual([])
      })

      it('refuses both membership writes on a foreign membership row, and leaves it standing', async () => {
        // Each verb resolves its trip from the membership row rather than from an argument, so the
        // tenant filter has to hold on `requireById` — before `requireTrip`, before the role assert
        // and before the last-owner guard, none of which would ever be reached with B's row.
        const betaMembership = (
          await listTripMembers(beta.tenant.scope, beta.tripId)
        )[0]
        expect(betaMembership).toBeDefined()

        for (const attempt of [
          () =>
            updateTripMember(alpha.tenant.scope, betaMembership.id, {
              role: 'viewer',
            }),
          () => removeTripMember(alpha.tenant.scope, betaMembership.id),
        ]) {
          // A `NotFoundError` and not a `FORBIDDEN`: a row of another tenant is indistinguishable
          // from a row that does not exist (ADR 0007), so neither verb confirms the id is real.
          expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
        }

        const after = await listTripMembers(beta.tenant.scope, beta.tripId)
        expect(after.map((row) => row.id)).toContain(betaMembership.id)
        expect(after.find((row) => row.id === betaMembership.id)?.role).toBe(
          betaMembership.role,
        )
      })
    })

    /**
     * The copy is the one write in this module whose second half runs in a queue consumer, so its
     * scope is rebuilt from an envelope rather than resolved from a session. Every case below is
     * therefore run twice: once with the request-shaped scope the harness hands out, and once with
     * one built exactly as `src/server/queue/handlers/trip-copy.ts` builds it. The refusal has to
     * come from the tenant filter itself, and not from a server function the consumer never calls.
     */
    describe('copying', () => {
      /** The scope the `trip-copy` handler assembles for A's owner, from an envelope. */
      function handlerScope(): TenantScope {
        return createScope(harness.db, {
          userId: alpha.tenant.ownerUserId,
          organizationId: alpha.tenant.organizationId,
          role: 'owner',
        })
      }

      function bothScopes(): Array<TenantScope> {
        return [alpha.tenant.scope, handlerScope()]
      }

      it('refuses to start a copy of B’s trip, whichever scope asks', async () => {
        for (const scope of bothScopes()) {
          expect(
            await captureError(() =>
              startTripCopy(scope, beta.tripId, { title: 'Hijacked' }),
            ),
          ).toBeInstanceOf(NotFoundError)
        }
        // Nothing was minted on the way to being refused.
        expect(
          (await listTrips(alpha.tenant.scope)).map((row) => row.id),
        ).toEqual([alpha.tripId])
      })

      it('refuses B’s trip as the source and writes nothing into A’s target', async () => {
        const targetId = await startTripCopy(alpha.tenant.scope, alpha.tripId, {
          title: 'A copy of A’s own trip',
        })

        for (const scope of bothScopes()) {
          expect(
            await captureError(() =>
              copyTripContents(scope, beta.tripId, targetId),
            ),
          ).toBeInstanceOf(NotFoundError)
        }

        // The target is still the empty shell `startTripCopy` left: the source is read-checked
        // before the clearing pass, so a foreign source cannot even empty a trip it may not see.
        expect(
          await placesRepository.count(
            alpha.tenant.scope,
            eq(places.tripId, targetId),
          ),
        ).toBe(0)
        expect(
          await placesRepository.count(
            beta.tenant.scope,
            eq(places.tripId, beta.tripId),
          ),
        ).toBe(1)
      })

      it('refuses B’s trip as the target and leaves B’s inventory alone', async () => {
        const before = await placesRepository.count(
          beta.tenant.scope,
          eq(places.tripId, beta.tripId),
        )

        for (const scope of bothScopes()) {
          expect(
            await captureError(() =>
              copyTripContents(scope, alpha.tripId, beta.tripId),
            ),
          ).toBeInstanceOf(NotFoundError)
        }

        expect(
          await placesRepository.count(
            beta.tenant.scope,
            eq(places.tripId, beta.tripId),
          ),
        ).toBe(before)
        expect(
          (await listTripDays(beta.tenant.scope, beta.tripId)).length,
        ).toBeGreaterThan(0)
      })
    })

    it('refuses a favourite on B’s trip and never lists B’s ids', async () => {
      const scope = alpha.tenant.scope

      expect(
        await captureError(() => setFavourite(scope, beta.tripId, true)),
      ).toBeInstanceOf(NotFoundError)

      // A's own star, so the reads below have something to be wrong about.
      await setFavourite(scope, alpha.tripId, true)
      await setFavourite(beta.tenant.scope, beta.tripId, true)

      expect(await listFavouriteTripIds(scope)).toEqual([alpha.tripId])
      expect(await countFavourites(scope)).toBe(1)
      expect(await listFavouriteTripIds(beta.tenant.scope)).toEqual([
        beta.tripId,
      ])
    })
  })
  /**
   * The purge is the one half of a delete that leaves the database entirely, so it is the one place
   * a boundary could be crossed without a tenant filter to stop it (PRD #104 decision 3). R2 has no
   * `organization_id`; what it has is a key namespace, and every key this product mints names its
   * organization in the second path segment. The envelope's `orgId` is the authority and the keys are
   * a request, so an envelope forged under A that names B's objects deletes nothing.
   */
  describe('the storage purge', () => {
    async function purge(
      orgId: string,
      keys: ReadonlyArray<string>,
      bucket: FakeBucket,
    ): Promise<void> {
      await handleTripPurge({ keys: [...keys] }, purgeContext(orgId, bucket))
    }

    /** The key `seedWorld` recorded for that tenant's one file. */
    async function fileKey(world: World): Promise<string> {
      const file = await tripFilesRepository.findById(
        world.tenant.scope,
        world.fileId,
      )
      expect(file).not.toBeNull()
      return file?.storageKey ?? ''
    }

    it('deletes nothing when A’s envelope names B’s objects', async () => {
      const key = await fileKey(beta)
      const bucket = fakeBucket([key])

      await purge(alpha.tenant.organizationId, [key], bucket)

      expect(bucket.calls).toEqual([])
      expect([...bucket.remaining]).toEqual([key])
    })

    it('deletes A’s own objects and drops B’s from the same envelope', async () => {
      const mine = await fileKey(alpha)
      const theirs = await fileKey(beta)
      const bucket = fakeBucket([mine, theirs])

      await purge(alpha.tenant.organizationId, [mine, theirs], bucket)

      expect(bucket.calls).toEqual([[mine]])
      expect([...bucket.remaining]).toEqual([theirs])
    })
  })

  /**
   * `updateUserSettings`, specified against what it actually does rather than
   * against what a guard would do.
   *
   * It takes no row id from the caller: it resolves its row through
   * `ensureUserSettings`, which looks the user id up **inside the tenant scope**
   * and inserts a fresh row stamped with the caller's own `organization_id` when
   * none exists. So a user id belonging to B, handed to a write made from A, is
   * never *rejected* — it is ensured into A's organization, and B's row stays
   * structurally unreachable. Asserting a `NotFoundError` here would assert a
   * refusal this function cannot make.
   */
  describe('a display preference written for a foreign user id', () => {
    /** The whole row, so a single-field check cannot pass a partial clobber. */
    async function betaRow(): Promise<UserSettings | null> {
      return getUserSettings(beta.tenant.scope, beta.tenant.ownerUserId)
    }

    it('lands in the caller’s own organization and leaves B’s row byte-identical', async () => {
      const before = await betaRow()
      expect(before).not.toBeNull()

      await updateUserSettings(
        alpha.tenant.scope,
        { maskConfirmationCodes: true },
        beta.tenant.ownerUserId,
      )

      // A now has a row for that user id, carrying the flag, in its own organization.
      const written = await getUserSettings(
        alpha.tenant.scope,
        beta.tenant.ownerUserId,
      )
      expect(written?.organizationId).toBe(alpha.tenant.organizationId)
      expect(written?.maskConfirmationCodes).toBe(true)

      // And B's own row is exactly what it was — every column, not one.
      expect(await betaRow()).toEqual(before)
    })

    /**
     * Not an isolation case, and it is here because this is the only test file
     * this stage owns.
     *
     * The assertion is made through the **merge** rather than through the stored
     * row on purpose: `getEffectiveSettings` hand-builds its answer key by key,
     * so a column that reaches `user_settings` and the write validator but never
     * reaches that literal passes a row assertion and fails this one — a switch
     * that writes a boolean nothing can ever read.
     */
    it('reaches the effective settings of its own tenant and of nobody else’s', async () => {
      expect(
        (await getEffectiveSettings(alpha.tenant.scope)).maskConfirmationCodes,
      ).toBe(false)

      await updateUserSettings(alpha.tenant.scope, {
        maskConfirmationCodes: true,
      })

      expect(
        (await getEffectiveSettings(alpha.tenant.scope)).maskConfirmationCodes,
      ).toBe(true)
      expect(
        (await getEffectiveSettings(beta.tenant.scope)).maskConfirmationCodes,
      ).toBe(false)
    })
  })

  /**
   * `01-S4a`: one number line per day, written across two tables in one batch.
   *
   * The batch is the reason this block exists rather than riding on the generic
   * per-repository cases above. `reorderDayTimeline` is the only write in the
   * product that touches two tables at once, and a tenant filter that held on one of
   * them and not the other would renumber a stranger's day at the moment a reader
   * dragged their own.
   */
  describe('day timeline ordering', () => {
    /** Positions of a day's stops and notes, keyed by row id, for a byte-for-byte diff. */
    async function positionsOf(
      scope: TenantScope,
      dayId: string,
    ): Promise<Record<string, number>> {
      const [stops, notes] = await Promise.all([
        listDayAssignments(scope, dayId),
        listDayNotes(scope, dayId),
      ])
      return Object.fromEntries([
        ...stops.map((row) => [row.id, row.orderIndex] as const),
        ...notes.map((row) => [row.id, row.sortOrder] as const),
      ])
    }

    it('refuses B’s day, named with B’s trip or with A’s own', async () => {
      const scope = alpha.tenant.scope

      expect(
        await captureError(() =>
          reorderDayTimeline(scope, {
            tripId: beta.tripId,
            dayId: beta.dayId,
            items: [{ kind: 'stop', id: beta.assignmentId }],
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      // A's own trip with B's day: `requireTripDay`'s job, and the one a caller who
      // has already proved they own a trip could otherwise reach through.
      expect(
        await captureError(() =>
          reorderDayTimeline(scope, {
            tripId: alpha.tripId,
            dayId: beta.dayId,
            items: [],
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
    })

    it('drops B’s ids and renumbers A over its own items only', async () => {
      const scope = alpha.tenant.scope
      const before = await positionsOf(beta.tenant.scope, beta.dayId)

      const second = await createPlace(scope, {
        tripId: alpha.tripId,
        name: 'Time Out Market',
      })
      const extraStop = await createAssignment(scope, {
        tripId: alpha.tripId,
        dayId: alpha.dayId,
        placeId: second.id,
      })
      const extraNote = await createDayNote(scope, {
        tripId: alpha.tripId,
        dayId: alpha.dayId,
        body: 'Book the tram tickets.',
      })

      const written = await reorderDayTimeline(scope, {
        tripId: alpha.tripId,
        dayId: alpha.dayId,
        items: [
          { kind: 'stop', id: beta.assignmentId },
          { kind: 'note', id: alpha.dayNoteId },
          { kind: 'note', id: beta.dayNoteId },
          { kind: 'stop', id: extraStop.id },
          { kind: 'note', id: extraNote.id },
          { kind: 'stop', id: alpha.assignmentId },
        ],
      })

      // B's two ids are gone from the write, and A's four are numbered 0..3.
      expect(written).toEqual([
        { kind: 'note', id: alpha.dayNoteId },
        { kind: 'stop', id: extraStop.id },
        { kind: 'note', id: extraNote.id },
        { kind: 'stop', id: alpha.assignmentId },
      ])
      expect(await positionsOf(scope, alpha.dayId)).toEqual({
        [alpha.dayNoteId]: 0,
        [extraStop.id]: 1,
        [extraNote.id]: 2,
        [alpha.assignmentId]: 3,
      })

      // And B's own day is byte-identical.
      expect(await positionsOf(beta.tenant.scope, beta.dayId)).toEqual(before)
    })

    it('leaves A a complete renumber when every id it was sent is a stranger’s', async () => {
      const scope = alpha.tenant.scope
      const before = await positionsOf(beta.tenant.scope, beta.dayId)

      // Nothing addressable is left after the drop, so the day is rewritten from its
      // own current order: a whole 0..n-1, never half a batch.
      await reorderDayTimeline(scope, {
        tripId: alpha.tripId,
        dayId: alpha.dayId,
        items: [
          { kind: 'stop', id: beta.assignmentId },
          { kind: 'note', id: beta.dayNoteId },
        ],
      })

      // The seed's note and stop are both at 0 — two tables, one number line not yet
      // written — so which of the two leads is the id tiebreak's business and not
      // this test's. What is asserted is that the day came out a whole `0..n-1`.
      const after = await positionsOf(scope, alpha.dayId)
      expect(Object.keys(after).sort()).toEqual(
        [alpha.dayNoteId, alpha.assignmentId].sort(),
      )
      expect(Object.values(after).sort()).toEqual([0, 1])
      expect(await positionsOf(beta.tenant.scope, beta.dayId)).toEqual(before)
    })

    it('refuses to clear a foreign row’s time through `clearTime`', async () => {
      const scope = alpha.tenant.scope
      const before = await dayAssignmentsRepository.findById(
        beta.tenant.scope,
        beta.assignmentId,
      )

      await reorderDayTimeline(scope, {
        tripId: alpha.tripId,
        dayId: alpha.dayId,
        items: [{ kind: 'stop', id: beta.assignmentId }],
        clearTime: [{ kind: 'stop', id: beta.assignmentId }],
      })

      expect(
        await dayAssignmentsRepository.findById(
          beta.tenant.scope,
          beta.assignmentId,
        ),
      ).toEqual(before)
    })
  })

  /**
   * `01-S2b`: a note is parented onto a day, and the day is the client's to name.
   *
   * The generic per-repository cases above prove that B's *note* is unreachable from A.
   * They cannot reach this one: the insert stamps `organization_id` from A's own scope, so
   * a note carrying B's `day_id` is written as a row A owns and B cannot see — corrupt for
   * one tenant and invisible to the other. Only `requireTripDay` refuses it.
   */
  describe('day notes', () => {
    /** Every note row of a day, keyed by id, for a byte-for-byte diff. */
    async function notesOf(
      scope: TenantScope,
      dayId: string,
    ): Promise<Record<string, unknown>> {
      const notes = await listDayNotes(scope, dayId)
      return Object.fromEntries(notes.map((note) => [note.id, note] as const))
    }

    it('refuses B’s day, named with B’s trip or with A’s own', async () => {
      const scope = alpha.tenant.scope
      const before = await notesOf(beta.tenant.scope, beta.dayId)

      expect(
        await captureError(() =>
          createDayNote(scope, {
            tripId: beta.tripId,
            dayId: beta.dayId,
            body: 'Written onto a stranger’s day.',
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      // A's own trip with B's day: the tenant filter alone lets this one through,
      // because the row it would write is A's. `requireTripDay` is what refuses it.
      expect(
        await captureError(() =>
          createDayNote(scope, {
            tripId: alpha.tripId,
            dayId: beta.dayId,
            body: 'Written onto a stranger’s day, from a trip A owns.',
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(await notesOf(beta.tenant.scope, beta.dayId)).toEqual(before)
    })

    it('refuses to resolve B’s note by id', async () => {
      // The lookup every note write opens with: it is the row that names the trip and the day the
      // guard then checks, so reaching a stranger's row here would hand the guard the wrong trip.
      expect(
        await captureError(() =>
          requireDayNote(alpha.tenant.scope, beta.dayNoteId),
        ),
      ).toBeInstanceOf(NotFoundError)
    })
  })

  /**
   * `03-S7` — a confirmation import aimed across the boundary.
   *
   * Two ids arrive from a browser on this path and neither is an authorisation. The **file id** is
   * re-resolved through `getFile` in the caller's own scope, because a storage key taken from a
   * request is a path into a bucket every tenant shares. The **job id** is compared against the
   * staged record's own `orgId` and `tripId`, because KV is one flat namespace with no tenant
   * filter of its own — a repository refuses a foreign row by construction and a KV key does not.
   *
   * The queue double is what makes the two failures distinguishable: "no booking was written" and
   * "no message was enqueued" are different claims, and a refusal that enqueued the envelope first
   * would satisfy the first while handing another workspace's file to the extractor.
   *
   * `createReservation` and `getFile` are the only writers this block covers.
   * `markReservationsImported` is asserted where it is defined, in the booking block above, and is
   * not duplicated here.
   */
  describe('a confirmation import aimed across the boundary', () => {
    /** The `TASKS` binding, recording every envelope handed to it. */
    function queueDouble(): TaskQueue & { readonly sent: Array<unknown> } {
      const sent: Array<unknown> = []
      return {
        sent,
        send: (body) => {
          sent.push(body)
          return Promise.resolve()
        },
        sendBatch: (messages) => {
          sent.push(...messages)
          return Promise.resolve()
        },
      }
    }

    /** The slice of KV the staged record lives in, in memory. */
    function memoryStore(): {
      readonly entries: Map<string, string>
      get: (key: string) => Promise<string | null>
      put: (key: string, value: string) => Promise<void>
      delete: (key: string) => Promise<void>
    } {
      const entries = new Map<string, string>()
      return {
        entries,
        get: (key) => Promise.resolve(entries.get(key) ?? null),
        put: (key, value) => {
          entries.set(key, value)
          return Promise.resolve()
        },
        delete: (key) => {
          entries.delete(key)
          return Promise.resolve()
        },
      }
    }

    /** A staged record, written the way the queue handler writes one. */
    function stage(
      store: ReturnType<typeof memoryStore>,
      record: Pick<StagedImport, 'jobId' | 'tripId' | 'orgId' | 'requestedBy'>,
    ): StagedImport {
      const staged: StagedImport = {
        ...record,
        createdAt: Date.parse('2026-09-11T10:00:00Z'),
        format: 'document',
        count: 1,
        reservations: [
          {
            externalId: null,
            title: 'Hotel Roma',
            kind: 'activity',
            startsAt: '2026-03-04T14:00:00Z',
            endsAt: null,
            allDay: false,
            floating: false,
            location: null,
            notes: null,
            reference: null,
          },
        ],
      }
      store.entries.set(stagedImportKey(staged.jobId), JSON.stringify(staged))
      return staged
    }

    /** Every booking of a trip with its import marker, for a byte-for-byte diff. */
    async function markersOf(
      scope: TenantScope,
      tripId: string,
    ): Promise<Record<string, unknown>> {
      const rows = await listTripReservations(scope, { tripId })
      return Object.fromEntries(
        rows.map((row) => [row.id, row.importedAt] as const),
      )
    }

    it('refuses B’s file id, and enqueues nothing', async () => {
      const queue = queueDouble()
      const before = await markersOf(beta.tenant.scope, beta.tripId)

      expect(
        await captureError(() =>
          startBookingImport(alpha.tenant.scope, queue, {
            tripId: alpha.tripId,
            fileId: beta.fileId,
            index: 0,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(queue.sent).toEqual([])
      expect(await markersOf(beta.tenant.scope, beta.tripId)).toEqual(before)
    })

    /**
     * The variant the tenant filter alone lets through: the file is A's own, so `getFile` resolves
     * it, and only the comparison against the trip refuses it. Without that comparison one
     * uploaded confirmation could be imported into a trip it was never attached to.
     */
    it('refuses a file A owns when it is named against another trip, and enqueues nothing', async () => {
      const queue = queueDouble()
      const other = await createTrip(alpha.tenant.scope, { title: 'Lisbon' })

      expect(
        await captureError(() =>
          startBookingImport(alpha.tenant.scope, queue, {
            tripId: other.id,
            fileId: alpha.fileId,
            index: 0,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(queue.sent).toEqual([])
      expect(
        await listTripReservations(alpha.tenant.scope, { tripId: other.id }),
      ).toEqual([])
    })

    it('refuses B’s staged job though the KV key resolves, and writes into neither workspace', async () => {
      const store = memoryStore()
      const staged = stage(store, {
        jobId: `booking-import:${beta.tripId}:${beta.fileId}`,
        tripId: beta.tripId,
        orgId: beta.tenant.organizationId,
        requestedBy: beta.tenant.ownerUserId,
      })
      const before = await markersOf(beta.tenant.scope, beta.tripId)

      expect(
        await captureError(() =>
          confirmBookingImport(
            alpha.tenant.scope,
            store,
            {
              tripId: alpha.tripId,
              jobId: staged.jobId,
              accept: [0],
            },
            unreachedPorts,
          ),
        ),
      ).toBeInstanceOf(NotFoundError)

      // Neither side gained a row, and B's markers are the ones B wrote.
      expect(await markersOf(alpha.tenant.scope, alpha.tripId)).toEqual({
        [alpha.reservationId]: null,
      })
      expect(await markersOf(beta.tenant.scope, beta.tripId)).toEqual(before)
      // And the record A could not claim is still there for the workspace that owns it.
      expect(store.entries.has(stagedImportKey(staged.jobId))).toBe(true)
    })

    /**
     * The staged record is A's, so the organization comparison passes — and the trip in it is B's.
     * A confirm that trusted the request's own trip id would write A's rows against B's trip id,
     * which the insert would stamp as A's own organization: corrupt for one tenant and invisible to
     * the other.
     */
    it('refuses a record of A’s own workspace staged against B’s trip', async () => {
      const store = memoryStore()
      const staged = stage(store, {
        jobId: `booking-import:${beta.tripId}:${alpha.fileId}`,
        tripId: beta.tripId,
        orgId: alpha.tenant.organizationId,
        requestedBy: alpha.tenant.ownerUserId,
      })
      const before = await markersOf(beta.tenant.scope, beta.tripId)

      expect(
        await captureError(() =>
          confirmBookingImport(
            alpha.tenant.scope,
            store,
            {
              tripId: alpha.tripId,
              jobId: staged.jobId,
              accept: [0],
            },
            unreachedPorts,
          ),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(await markersOf(alpha.tenant.scope, alpha.tripId)).toEqual({
        [alpha.reservationId]: null,
      })
      expect(await markersOf(beta.tenant.scope, beta.tripId)).toEqual(before)
    })
  })

  /**
   * `03-S5`: the board's read of a trip's journeys, and the reorder that places them.
   *
   * The read is ordinary and is asserted for completeness. The **reorder** is the case this block
   * genuinely adds, because it is the one write in this file shaped like a bulk update over ids the
   * client chose: it takes a whole day's run and writes `sort_order` on two tables from it. A
   * forged id must therefore be *dropped*, not merely refused at the end — and the only honest
   * proof of that is B's stored values, re-read on both tables afterwards and byte-for-byte
   * identical.
   */
  describe('a day’s journeys and the run that places them', () => {
    /** Every `sort_order` B holds, on both tables, keyed by row id. */
    async function positionsOf(world: World): Promise<Record<string, number>> {
      const [records, legs] = await Promise.all([
        listTripTransports(world.tenant.scope, world.tripId),
        listTripLegs(world.tenant.scope, world.tripId),
      ])
      return Object.fromEntries([
        ...records.map((row) => [row.id, row.sortOrder] as const),
        ...legs.map((row) => [row.id, row.sortOrder] as const),
      ])
    }

    beforeEach(async () => {
      // B's journey is a chain, so both tables carry a row the reorder could write.
      await replaceTransportChain(beta.tenant.scope, beta.transportId, {
        stations: [{ name: 'Shin-Osaka' }, { name: 'Tokyo' }],
        legs: [{ departureDayId: beta.dayId, sortOrder: 3.25 }],
      })
    })

    it('answers nothing when asked, from A, for B’s journeys', async () => {
      expect(
        await captureError(() =>
          listTripDayTransports(alpha.tenant.scope, beta.tripId),
        ),
      ).toBeInstanceOf(NotFoundError)

      // The same trip id resolves for its own tenant, so it is scoping that hid it.
      const own = await listTripDayTransports(beta.tenant.scope, beta.tripId)
      expect(own.records).toHaveLength(1)
      expect(own.legs).toHaveLength(1)
    })

    it('refuses to reorder a day of B’s trip, named with B’s trip or with A’s own', async () => {
      const scope = alpha.tenant.scope

      expect(
        await captureError(() =>
          reorderDayTransports(scope, {
            tripId: beta.tripId,
            dayId: beta.dayId,
            items: [{ kind: 'transport', id: beta.transportId }],
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      // A's own trip with B's day: the tenant filter alone lets this one through,
      // because every row it would write is A's. `requireTripDay` is what refuses it.
      expect(
        await captureError(() =>
          reorderDayTransports(scope, {
            tripId: alpha.tripId,
            dayId: beta.dayId,
            items: [{ kind: 'transport', id: beta.transportId }],
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
    })

    it('drops B’s transport and leg ids inside a reorder of A’s own day', async () => {
      const before = await positionsOf(beta)
      const betaLegs = await listTripLegs(beta.tenant.scope, beta.tripId)

      await reorderDayTransports(alpha.tenant.scope, {
        tripId: alpha.tripId,
        dayId: alpha.dayId,
        items: [
          { kind: 'stop', id: alpha.assignmentId },
          { kind: 'transport', id: beta.transportId },
          { kind: 'leg', id: betaLegs[0].id },
          { kind: 'note', id: beta.dayNoteId },
        ],
      })

      // Not one number of B's moved — on either table.
      expect(await positionsOf(beta)).toEqual(before)
      // A's own journey was placed, so the call did do its work rather than failing silently.
      const alphaRecords = await listTripTransports(
        alpha.tenant.scope,
        alpha.tripId,
      )
      expect(alphaRecords[0].sortOrder).toBe(0.5)
    })
  })

  /**
   * The workspace-scoped branch of `dispatch` (#304).
   *
   * The trip branch has `requireTrip` in front of it; this one cannot — a billing event names no
   * trip — so the whole boundary is the tenant filter, on the `listMembers` read that derives the
   * recipients and on the insert that writes their rows. Both halves are asserted from B.
   */
  describe('a workspace-scoped billing dispatch', () => {
    const BILLING_EVENT_ID = 'evt_billing_isolation'

    const billingEvent = () => ({
      kind: 'billing.plan_changed',
      entityType: 'subscription',
      entityId: BILLING_EVENT_ID,
      scope: 'organization' as const,
      titleParams: { organizationName: 'Workspace A', plan: 'Crew' },
      bodyParams: { organizationName: 'Workspace A', plan: 'Crew' },
    })

    it('reaches only A’s own leadership and leaves nothing B can read', async () => {
      const before = await notificationsRepository.count(beta.tenant.scope)

      const result = await dispatch(alpha.tenant.scope, billingEvent(), {
        queue: null,
      })

      // The seed gives each workspace one `owner` and one plain `member`, so the derivation is
      // observable: the owner is in and the member is out, from A's `member` rows alone.
      expect(result.recipients).toEqual([alpha.tenant.ownerUserId])
      expect(result.inAppWritten).toBe(1)

      expect(await notificationsRepository.count(beta.tenant.scope)).toBe(
        before,
      )
      expect(
        await listForEntity(
          beta.tenant.scope,
          'subscription',
          BILLING_EVENT_ID,
        ),
      ).toEqual([])
      expect(
        await listForEntity(
          alpha.tenant.scope,
          'subscription',
          BILLING_EVENT_ID,
        ),
      ).toHaveLength(1)
    })
  })
})
