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
import { ZodError } from 'zod'
import { and, eq } from 'drizzle-orm'
import { member } from '#/server/db/auth-schema'
import { AUDIT_ACTIONS, trail } from '#/server/audit/trail'
import {
  assignmentParticipants,
  collabMessageReactions,
  collectionPlaceLabels,
  dayAccommodations,
  placeTags,
  places,
  reservations,
  transports,
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
import { reserveExport, exportAllowance } from '../exports'
import { readFeedSource } from '../calendar-feeds'
import { createTripInvite, tripInviteLinksRepository } from '../invites'
import { categoriesRepository, createCategory } from '../categories'
import {
  setTripCollabSections,
  castVote,
  checkInsRepository,
  collabMessageReactionsAccess,
  collabMessagesRepository,
  collabNotesRepository,
  collabPollVotesRepository,
  collabPollsRepository,
  createCheckIn,
  countMessages,
  createCollabNote,
  createPoll,
  deleteMessage,
  editMessage,
  listMessages,
  listReactions,
  listTripCheckIns,
  postMessage,
  toggleReaction,
} from '../collab'
import {
  addCollectionPlace,
  collectionLabelsRepository,
  collectionPlacesRepository,
  collectionsRepository,
  collectionDeleteSummary,
  deleteCollection,
  deleteCollectionConfirmed,
  updateCollection,
  setCollectionPlaceStatus,
  createCollection,
  createLabel,
  listCollectionsWithCounts,
  listCollectionPlaces,
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
  deleteBudgetItem,
  deleteExpense,
  deleteSettlement,
  expenseSharesRepository,
  expensesRepository,
  getExpense,
  getExpenseWithShares,
  getMemberBalances,
  getTripSpendSummary,
  listBudgetItems,
  listSettlements,
  listTripExpenses,
  markShareSettled,
  requireExpenseOfTrip,
  setExpenseShares,
  settlementsRepository,
  updateBudgetItem,
  updateExpense,
} from '../expenses'
import {
  deleteFile,
  getFile,
  getStorageUsage,
  listTripFiles,
  recordFile,
  tripFilesRepository,
  updateFile,
} from '../files'
import { handleTripPurge } from '#/server/queue/handlers/trip-purge'
import { purgeContext } from '#/server/queue/handlers/__tests__/purge-context'
import { fakeBucket } from '#/server/storage/__tests__/fake-bucket'
import { exportObjectKey } from '#/server/storage/export-artifacts'
import {
  countAccommodationNights,
  createAccommodation,
  createAssignment,
  dayAccommodationsRepository,
  dayAssignmentsRepository,
  deleteAccommodation,
  deletePlaceWithJourneys,
  getTripItinerary,
  listDayAssignments,
  listTripAccommodations,
  readDayLocations,
  reorderDayTimelines,
  scheduleAssignment,
  setAssignmentParticipants,
  unscheduleAssignment,
  updateAccommodation,
} from '../itinerary'
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
  getJourneyStory,
  journeyEntriesRepository,
  journeyMoodsRepository,
  journeyPhotosRepository,
  journeysRepository,
  listEntriesByIds,
  listJourneyEntries,
  listJourneys,
  listRecentEntries,
  listUnattachedPhotos,
  publishJourney,
  tallyMoods,
  unpublishJourney,
  updateEntry,
  updateJourney,
} from '../journey'
import {
  applyTemplateToTrip,
  createList,
  createListItem,
  createTemplate,
  listTemplateItems,
  listTemplates,
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
import {
  createPlace,
  getPlace,
  placesRepository,
  setPlaceTags,
} from '../places'
import {
  clearReservationImported,
  createReservation,
  createImportedReservation,
  deleteReservation,
  getReservation,
  createReservationExpense,
  linkReservationExpense,
  listTripReservations,
  markReservationsImported,
  requireReservationOfTrip,
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
  replaceTransportChain,
  requireTransportOfTrip,
  saveSearchedConnection,
  CLIENT_ID_WINDOW_MS,
  saveTransport,
  setTransportStatus,
  summariseTripTransports,
  totalTripDistanceMetres,
  transportLegsRepository,
  TransportRefusalError,
  transportsRepository,
  unlinkTransportsFromDays,
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
  MAX_BOUND_PARAMETERS,
  copyTripContents,
  countTripsByStatus,
  CurrencyRefusalError,
  TripArchivedError,
  TripRoleError,
  createShareLink,
  createTrip,
  deleteTrip,
  listTripMembers,
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
  TripGuestMergeTargetError,
  countTripPeople,
  createTripGuest,
  listTripGuests,
  listTripParticipants,
  mergeTripGuest,
  registerGuestRelinker,
  removeTripGuest,
  renameTripGuest,
  tripGuestsRepository,
} from '../trip-guests'
import { seedUserLocale } from '../user-locale-seed'
import {
  addCompanyHoliday,
  addHolidayCalendar,
  ensurePlan,
  ensureYear,
  getAllowance,
  getPlanOverview,
  listUserYears,
  recomputeCarryOver,
  requirePlanActor,
  requirePlanOwner,
  saveAllowance,
  setEntitlement,
  setEntry,
  setUserColour,
  updatePlan,
  updatePlanSettings,
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
import {
  findLatestFrozenRate,
  getDisplayCurrency,
  listAnsweringCurrencies,
  resolveRate,
  setDisplayCurrency,
  suggestedRatesForTrip,
} from '../rates'
import { changeTripCurrency, previewCurrencyChange } from '../trip-currency'
import { editTransport } from './edit-transport'
import {
  collabRows,
  creatingWriters,
  rowWriters,
  seedCollabRows,
} from './collab-writers'
import { captureError, createHarness } from './harness'
import { PRICED_KINDS } from './priced-rows'
import { classifyFailure } from '#/server/errors/public'
import { ID_PATTERN, ID_TIME_LENGTH, mintId } from '#/lib/ids'
import type {
  KeyedTenantTable,
  TenantPatch,
  TenantRepository,
  TenantScope,
} from '../base'
import type { TaskBindings, TaskQueue } from '#/server/queue/types'
import type { UserSettings } from '#/server/db/types'
import type { FakeBucket } from '#/server/storage/__tests__/fake-bucket'
import type { CollabRowIds } from './collab-writers'
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
const { downloadTripExport, listTripExports } =
  await import('#/server/fns/exports')

/** The confirm's ports, stubbed to throw for the same reason: a refused confirm reaches neither. */
const unreachedPorts: Parameters<typeof confirmBookingImport>[3] = {
  enqueueRollup: () => {
    throw new Error("enqueueRollup is not reached: no place is written.")
  },
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
  /** On the world's trip, and the person its expense is split with and its payment comes from. */
  readonly companionUserId: string
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
  readonly tripInviteId: string
  readonly tripMemberId: string
  readonly guestId: string
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

/** Writes `count` bookings on a trip and returns their ids, the way a confirm leaves them. */
async function bookingIds(
  scope: TenantScope,
  tripId: string,
  count: number,
): Promise<Array<string>> {
  const ids: Array<string> = []
  for (let index = 0; index < count; index += 1) {
    const row = await reservationsRepository.insert(scope, {
      tripId,
      title: `Imported booking ${index}`,
    })
    ids.push(row.id)
  }
  return ids
}

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
  const companionUserId = await tenant.addUser('Travelling companion')

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
  await addTripMember(scope, {
    tripId: trip.id,
    userId: companionUserId,
    role: 'editor',
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
    participants: [{ userId: tenant.ownerUserId }, { userId: companionUserId }],
  })
  const expenseShare = expense.shares.at(0)
  if (expenseShare === undefined) {
    throw new Error('An expense with participants must produce shares.')
  }
  const settlement = await createSettlement(scope, {
    tripId: trip.id,
    fromUserId: companionUserId,
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
  const tripInvite = await createTripInvite(scope, trip.id, {
    role: 'viewer',
    key: 'isolation-test-key',
  })
  const tripMembers = await tripMembersRepository.findMany(scope)
  const tripMember = tripMembers.at(0)
  if (tripMember === undefined) {
    throw new Error('Creating a trip must create its owner membership.')
  }
  const guest = await createTripGuest(scope, {
    tripId: trip.id,
    displayName: 'Travelling without an account',
  })

  const message = await postMessage(scope, {
    tripId: trip.id,
    body: 'Landed, heading in.',
  })
  await toggleReaction(scope, trip.id, message.id, '🎉')
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
  const votes = await castVote(scope, trip.id, poll.id, 'sunrise')
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
    companionUserId,
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
    tripInviteId: tripInvite.invite.id,
    tripMemberId: tripMember.id,
    guestId: guest.id,
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
  isolationCase('trip guests', tripGuestsRepository, (w) => w.guestId, {
    displayName: 'hijacked',
  }),
  isolationCase('share links', shareLinksRepository, (w) => w.shareLinkId, {
    viewCount: 99,
  }),
  isolationCase(
    'trip invite links',
    tripInviteLinksRepository,
    (w) => w.tripInviteId,
    { useCount: 99 },
  ),
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

  describe('08-S4a collection management', () => {
    it('refuses foreign ids before roles or counts and leaves both tenant worlds intact', async () => {
      const snapshot = () => ({
        collections: harness.sqlite
          .prepare('SELECT * FROM collections ORDER BY id')
          .all(),
        places: harness.sqlite
          .prepare('SELECT * FROM collection_places ORDER BY id')
          .all(),
        labels: harness.sqlite
          .prepare('SELECT * FROM collection_labels ORDER BY id')
          .all(),
        assignments: harness.sqlite
          .prepare(
            'SELECT * FROM collection_place_labels ORDER BY collection_place_id, label_id',
          )
          .all(),
      })
      const before = snapshot()
      for (const [actor, target] of [
        [alpha, beta],
        [beta, alpha],
      ] as const) {
        const scope = actor.tenant.scopeFor(actor.tenant.ownerUserId, 'member')
        for (const call of [
          () => updateCollection(scope, target.collectionId, { name: 'Forged' }),
          () => deleteCollection(scope, target.collectionId),
          () => deleteCollectionConfirmed(scope, target.collectionId, 'Forged'),
          () => collectionDeleteSummary(scope, target.collectionId),
          () =>
            setCollectionPlaceStatus(scope, target.collectionPlaceId, 'visited'),
        ])
          await expect(call()).rejects.toMatchObject({ code: 'NOT_FOUND' })
        expect(
          await collectionsRepository.findById(scope, target.collectionId),
        ).toBeNull()
        expect(
          await listCollectionPlaces(scope, {
            collectionId: target.collectionId,
          }),
        ).toEqual([])
      }
      expect(snapshot()).toEqual(before)
    })
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
        toggleReaction(alpha.tenant.scope, alpha.tripId, beta.messageId, '👍'),
      )
      expect(error).toBeInstanceOf(NotFoundError)
    })
  })

  describe('a foreign parent id is rejected, never re-scoped', () => {
    it('rejects a foreign trip on every trip-scoped write', async () => {
      const scope = alpha.tenant.scope
      const attempts: ReadonlyArray<() => Promise<unknown>> = [
        // Carrying coordinates, as a pin dropped on the map does (02-S4): they buy it nothing.
        () =>
          createPlace(scope, {
            tripId: beta.tripId,
            name: 'Stolen place',
            lat: 48.208494,
            lng: 16.373118,
          }),
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
        () => readDayLocations(scope, beta.tripId),
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
            lat: 48.208494,
            lng: 16.373118,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(await placesRepository.count(alpha.tenant.scope)).toBe(1)
      expect(await placesRepository.count(beta.tenant.scope)).toBe(1)

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
          editMessage(scope, alpha.tripId, beta.messageId, 'Rewritten'),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          castVote(scope, alpha.tripId, beta.pollId, 'market'),
        ),
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
      // The owner, the second traveller and the companion on the trip.
      expect(dashboard.counts.members).toBe(3)
      expect(dashboard.counts.visitedCountries).toBe(1)
      expect(dashboard.upcomingTrips.map((trip) => trip.id)).toEqual([
        alpha.tripId,
      ])
    })

    it('keeps the member directory inside the tenant', async () => {
      const profiles = await listMemberProfiles(alpha.tenant.scope)
      expect(profiles).toHaveLength(3)
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

    it('reads day locations only for the tenant’s own trip', async () => {
      const own = await readDayLocations(alpha.tenant.scope, alpha.tripId)
      // The positive control: the seeded stop is a place with both coordinates.
      expect(own).toHaveLength(3)
      expect(own[0]?.location).toEqual({ lat: 38.7167, lng: -9.1333 })

      expect(
        await captureError(() =>
          readDayLocations(alpha.tenant.scope, beta.tripId),
        ),
      ).toBeInstanceOf(NotFoundError)
      const theirs = await readDayLocations(beta.tenant.scope, beta.tripId)
      expect(theirs.map((row) => row.dayId)).toContain(beta.dayId)
      expect(theirs.map((row) => row.dayId)).not.toContain(alpha.dayId)
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

    it('marks the journey of a deleted trip inside its own tenant only (#520)', async () => {
      await deleteTrip(alpha.tenant.scope, alpha.tripId)

      const marked = await journeysRepository.requireById(
        alpha.tenant.scope,
        alpha.journeyId,
      )
      expect(marked.tripId).toBeNull()
      expect(marked.tripDeletedAt).toBeInstanceOf(Date)
      const untouched = await journeysRepository.requireById(
        beta.tenant.scope,
        beta.journeyId,
      )
      expect(untouched.tripId).toBe(beta.tripId)
      expect(untouched.tripDeletedAt).toBeNull()

      // B's trip goes too: its orphan is B's owner's, and A cannot see it through either door.
      await deleteTrip(beta.tenant.scope, beta.tripId)
      expect(
        (
          await journeysRepository.requireById(
            beta.tenant.scope,
            beta.journeyId,
          )
        ).tripDeletedAt,
      ).toBeInstanceOf(Date)
      expect(await getJourney(alpha.tenant.scope, beta.journeyId)).toBeNull()
      expect(
        (await listJourneys(alpha.tenant.scope)).map((row) => row.id),
      ).toEqual([alpha.journeyId])
      expect(
        (await listJourneys(beta.tenant.scope)).map((row) => row.id),
      ).toEqual([beta.journeyId])
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

  it('lists only the named traveller’s statistics, including among workspace colleagues', async () => {
    await travelStatsRepository.insert(alpha.tenant.scope, {
      userId: alpha.secondUserId,
      statYear: 2026,
      tripCount: 99,
      computedAt: new Date(),
    })
    await travelStatsRepository.insert(alpha.tenant.scope, {
      userId: alpha.tenant.ownerUserId,
      statYear: 0,
      tripCount: 2,
      computedAt: new Date(),
    })
    const rows = await listTravelStats(
      alpha.tenant.scope,
      alpha.tenant.ownerUserId,
    )
    expect(rows.map((row) => row.statYear)).toEqual([2026, 0])
    expect(rows.every((row) => row.userId === alpha.tenant.ownerUserId)).toBe(
      true,
    )
    expect(rows.some((row) => row.tripCount === 99)).toBe(false)
    expect(
      await listTravelStats(beta.tenant.scope, alpha.tenant.ownerUserId),
    ).toEqual([])
    expect(
      (await listTravelStats(alpha.tenant.scope, alpha.secondUserId)).map(
        (row) => row.tripCount,
      ),
    ).toEqual([99])
  })

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
      // `trip_members` rows on A's trip are the owner's, written by `createTrip`, and the
      // companion's, who is there for the expense and the payment.
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
    // EUR 117.00 for GBP 150.00 is 0.78 euros to the pound: the pair implies the rate, so the
    // fixture no longer carries a rate of its own that the amounts contradict.
    const payment = {
      amountMinor: 11_700,
      settledOn: '2026-04-14',
      originalAmountMinor: 15_000,
      originalCurrency: 'GBP',
    } as const

    it('cannot be recorded onto a foreign trip', async () => {
      const before = await settlementsRepository.findMany(beta.tenant.scope)

      const error = await captureError(() =>
        createSettlement(alpha.tenant.scope, {
          tripId: beta.tripId,
          fromUserId: beta.companionUserId,
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
        fromUserId: alpha.companionUserId,
        toUserId: alpha.tenant.ownerUserId,
        ...payment,
      })
      expect(own.originalAmountMinor).toBe(15_000)
      expect(own.originalCurrency).toBe('GBP')
      expect(own.exchangeRate).toBeCloseTo(0.78, 10)

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

    it('is not found by id from the other workspace, and the trip id does not help', async () => {
      const scope = alpha.tenant.scope
      expect(
        await settlementsRepository.findById(scope, beta.settlementId),
      ).toBeNull()
      expect(
        await captureError(() =>
          deleteSettlement(scope, beta.tripId, beta.settlementId),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await captureError(() =>
          deleteSettlement(scope, alpha.tripId, beta.settlementId),
        ),
      ).toBeInstanceOf(NotFoundError)
    })

    it('refuses a foreign-currency payment onto the other workspace’s trip and leaves its rows as they were', async () => {
      const ledgerOfB = async (): Promise<unknown> => ({
        settlements: await settlementsRepository.findMany(beta.tenant.scope),
        balances: await getMemberBalances(beta.tenant.scope, beta.tripId),
      })
      const before = await ledgerOfB()

      // Complete, incomplete and zero alike: the trip is refused before the pair is read, so the
      // answer does not say which of them was wrong.
      for (const source of [
        payment,
        { ...payment, originalAmountMinor: undefined },
        { ...payment, originalAmountMinor: 0 },
      ]) {
        const error = await captureError(() =>
          createSettlement(alpha.tenant.scope, {
            tripId: beta.tripId,
            fromUserId: beta.companionUserId,
            toUserId: beta.tenant.ownerUserId,
            ...source,
          }),
        )
        expect(error).toBeInstanceOf(NotFoundError)
      }

      expect(await ledgerOfB()).toEqual(before)
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
      const inverted = {
        departureDate: '2026-04-16',
        departureTime: '12:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '08:00',
      }

      // An edit of B's id under A's trip reads as a transport that is not there, which is the
      // refusal an absent id gets; every other write is a plain not-found.
      const attempts: ReadonlyArray<
        readonly [
          () => Promise<unknown>,
          typeof NotFoundError | typeof TransportRefusalError,
        ]
      > = [
        [
          () =>
            editTransport(scope, alpha.tripId, beta.transportId, {
              title: 'Hijacked',
            }),
          TransportRefusalError,
        ],
        // An inverted write is still a row A cannot see, not a timing refusal that confirms it.
        [
          () =>
            editTransport(scope, alpha.tripId, beta.transportId, {
              title: 'Hijacked',
              ...inverted,
            }),
          TransportRefusalError,
        ],
        [
          () =>
            replaceTransportChain(scope, beta.transportId, {
              stations: [{ name: 'Hijacked' }, { name: 'Elsewhere' }],
              legs: [inverted],
            }),
          NotFoundError,
        ],
        [
          () => setTransportStatus(scope, beta.transportId, 'cancelled'),
          NotFoundError,
        ],
        [() => deleteTransport(scope, beta.transportId), NotFoundError],
        // B's transport under B's own trip still resolves to nothing from A.
        [
          () => requireTransportOfTrip(scope, beta.tripId, beta.transportId),
          NotFoundError,
        ],
      ]
      for (const [attempt, refusal] of attempts) {
        expect(await captureError(attempt)).toBeInstanceOf(refusal)
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

      const title = (await getTransport(scope, alpha.transportId))?.title ?? ''

      expect(
        await captureError(() =>
          editTransport(scope, alpha.tripId, alpha.transportId, {
            title,
            dayId: beta.dayId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(
        await captureError(() =>
          editTransport(scope, alpha.tripId, alpha.transportId, {
            title,
            arrivalDayId: beta.lastDayId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      const own = await getTransport(scope, alpha.transportId)
      expect(own?.dayId).toBe(alpha.dayId)
      expect(own?.arrivalDayId).toBeNull()
    })

    it('never unlinks a B transport from its arrival day from A’s scope', async () => {
      await editTransport(beta.tenant.scope, beta.tripId, beta.transportId, {
        title:
          (await getTransport(beta.tenant.scope, beta.transportId))?.title ??
          '',
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

      // An edit of B's id under A's trip reads as a transport that is not there, which is the
      // refusal an absent id gets; every other write is a plain not-found.
      const attempts: ReadonlyArray<
        readonly [
          () => Promise<unknown>,
          typeof NotFoundError | typeof TransportRefusalError,
        ]
      > = [
        [
          () =>
            createTransport(scope, {
              tripId: beta.tripId,
              title: 'Stolen journey',
              mode: 'train',
            }),
          NotFoundError,
        ],
        [
          () =>
            createTransport(scope, {
              tripId: alpha.tripId,
              title: 'Cross-parented',
              mode: 'train',
              arrivalDayId: beta.dayId,
            }),
          NotFoundError,
        ],
        [
          () =>
            editTransport(scope, alpha.tripId, beta.transportId, {
              title: 'Hijacked',
            }),
          TransportRefusalError,
        ],
        [
          () => setTransportStatus(scope, beta.transportId, 'cancelled'),
          NotFoundError,
        ],
        [() => deleteTransport(scope, beta.transportId), NotFoundError],
      ]
      for (const [attempt, refusal] of attempts) {
        expect(await captureError(attempt)).toBeInstanceOf(refusal)
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
   * Saving a transport and its legs in one call: three ids arrive from the browser (trip,
   * transport, and the days inside the chain) and none of them is trusted.
   *
   * B's journey is read back before and after every attempt and must be identical, chain
   * included: the writer deletes before it inserts, so "refused" alone would not show that B's
   * legs survived.
   */
  describe('saving a transport together with its legs', () => {
    const CHAIN = {
      stations: [{ name: 'Lisbon' }, { name: 'Porto' }],
      legs: [{}],
    }

    async function betaWorld() {
      return {
        record: await getTransport(beta.tenant.scope, beta.transportId),
        legs: await listTripLegs(beta.tenant.scope, beta.tripId),
        transports: await listTripTransports(beta.tenant.scope, beta.tripId),
      }
    }

    beforeEach(async () => {
      await replaceTransportChain(beta.tenant.scope, beta.transportId, {
        stations: [{ name: 'Shin-Osaka' }, { name: 'Tokyo' }],
        legs: [{ serviceNumber: 'Nozomi 24' }],
      })
    })

    it('refuses B’s trip from A’s scope and writes nothing', async () => {
      const before = await betaWorld()
      const brandNew = mintId()

      expect(
        await captureError(() =>
          saveTransport(alpha.tenant.scope, {
            tripId: beta.tripId,
            transportId: brandNew,
            intent: 'create',
            record: { title: 'Hijacked', mode: 'train' },
            chain: CHAIN,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await captureError(() =>
          saveTransport(alpha.tenant.scope, {
            tripId: beta.tripId,
            transportId: beta.transportId,
            intent: 'edit',
            record: { title: 'Hijacked', mode: 'train' },
            chain: CHAIN,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(await betaWorld()).toEqual(before)
      expect(await getTransport(alpha.tenant.scope, brandNew)).toBeNull()
    })

    it('does not touch B’s transport when A names it under A’s own trip', async () => {
      const before = await betaWorld()

      // A's scope cannot see B's row, so the id reads as unused. A `create` reaches the insert,
      // the primary key refuses it, the batch takes the chain with it, and the refusal is a
      // NotFoundError like any other foreign id. An `edit` never reaches a write at all, and reads
      // as the transport being gone, the answer an id that never existed gets.
      for (const [intent, refusal] of [
        ['create', NotFoundError],
        ['edit', TransportRefusalError],
      ] as const) {
        expect(
          await captureError(() =>
            saveTransport(alpha.tenant.scope, {
              tripId: alpha.tripId,
              transportId: beta.transportId,
              intent,
              record: { title: 'Hijacked', mode: 'train' },
              chain: CHAIN,
            }),
          ),
        ).toBeInstanceOf(refusal)
      }

      expect(await betaWorld()).toEqual(before)
      expect(await listTripLegs(alpha.tenant.scope, alpha.tripId)).toEqual([])
    })

    /**
     * The id the other test names is a fixture of no shape; this one is B's real id, well-formed and
     * minted just now, which is the only id that gets past the shape and window checks and so the
     * one that reaches the primary-key clash. A is refused as it is for any invalid id, and nothing
     * of B's - the record or its legs - moves.
     */
    it('answers A naming B’s real, well-formed id as it answers any other invalid id', async () => {
      const before = await betaWorld()
      const alphaBefore = await listTripTransports(
        alpha.tenant.scope,
        alpha.tripId,
      )
      expect(beta.transportId).toMatch(ID_PATTERN)
      // In window too, so A's call reaches the primary-key clash and not an earlier refusal.
      expect(
        Math.abs(
          parseInt(beta.transportId.slice(0, ID_TIME_LENGTH), 36) - Date.now(),
        ),
      ).toBeLessThanOrEqual(CLIENT_ID_WINDOW_MS)
      const refuse = (transportId: string) =>
        captureError(() =>
          saveTransport(alpha.tenant.scope, {
            tripId: alpha.tripId,
            transportId,
            intent: 'create',
            record: { title: 'Hijacked', mode: 'train' },
            chain: CHAIN,
          }),
        )

      const clash = (await refuse(beta.transportId)) as NotFoundError
      const malformed = (await refuse('not-a-generated-id')) as NotFoundError
      const stale = (await refuse(
        `000000000${beta.transportId.slice(9)}`,
      )) as NotFoundError

      for (const refusal of [clash, malformed, stale]) {
        expect(refusal).toBeInstanceOf(NotFoundError)
        expect(refusal.code).toBe(clash.code)
        expect(classifyFailure(refusal)).toEqual({ kind: 'unexpected' })
      }
      expect(clash.message.replace(beta.transportId, '<id>')).toBe(
        malformed.message.replace('not-a-generated-id', '<id>'),
      )
      expect(await betaWorld()).toEqual(before)
      expect(
        await listTripTransports(alpha.tenant.scope, alpha.tripId),
      ).toEqual(alphaBefore)
      expect(await listTripLegs(alpha.tenant.scope, alpha.tripId)).toEqual([])
    })

    /**
     * A foreign id and an absent one must read the same, or the refusal tells A which of B's ids
     * exist. The inverted times are the probe: if the existence check ran after the ordering, the
     * foreign row would answer with a timing refusal and the absent one with not-found.
     */
    it('answers an edit of B’s transport exactly as it answers an edit of one that is not there', async () => {
      const inverted = {
        departureDate: '2026-04-16',
        departureTime: '12:00',
        arrivalDate: '2026-04-16',
        arrivalTime: '08:00',
      }
      const refuse = (transportId: string) =>
        captureError(() =>
          saveTransport(alpha.tenant.scope, {
            tripId: alpha.tripId,
            transportId,
            intent: 'edit',
            record: { title: 'Probe', mode: 'train', ...inverted },
            chain: CHAIN,
          }),
        )

      const foreign = (await refuse(beta.transportId)) as RepositoryError
      const absent = (await refuse('never-existed')) as RepositoryError

      expect(foreign).toBeInstanceOf(TransportRefusalError)
      expect(absent).toBeInstanceOf(TransportRefusalError)
      expect(foreign.code).toBe(absent.code)
      expect(foreign.message).toBe(absent.message)
    })

    it('refuses a leg day or a record day belonging to B, and writes nothing', async () => {
      const scope = alpha.tenant.scope
      const alphaBefore = await listTripTransports(scope, alpha.tripId)
      const crossParented = mintId()

      for (const draft of [
        { record: { dayId: beta.dayId }, chain: CHAIN },
        { record: { arrivalDayId: beta.lastDayId }, chain: CHAIN },
        {
          record: {},
          chain: {
            stations: CHAIN.stations,
            legs: [{ departureDayId: beta.dayId }],
          },
        },
      ]) {
        expect(
          await captureError(() =>
            saveTransport(scope, {
              tripId: alpha.tripId,
              transportId: crossParented,
              intent: 'create',
              ...draft,
              record: {
                title: 'Cross-parented',
                mode: 'train',
                ...draft.record,
              },
            }),
          ),
        ).toBeInstanceOf(NotFoundError)
      }

      expect(await listTripTransports(scope, alpha.tripId)).toEqual(alphaBefore)
      expect(await getTransport(scope, crossParented)).toBeNull()
    })

    it('refuses A’s transport named under another trip of A', async () => {
      const otherTrip = await createTrip(alpha.tenant.scope, {
        title: 'Second trip of A',
      })
      const before = await listTransportLegs(
        alpha.tenant.scope,
        alpha.transportId,
      )

      // An edit reads as a transport that is not there, the answer an absent id gets, so the
      // lookup by workspace tells nobody that a row of a trip they cannot read exists.
      for (const [intent, refusal] of [
        ['create', NotFoundError],
        ['edit', TransportRefusalError],
      ] as const) {
        expect(
          await captureError(() =>
            saveTransport(alpha.tenant.scope, {
              tripId: otherTrip.id,
              transportId: alpha.transportId,
              intent,
              record: { title: 'Moved', mode: 'train' },
              chain: CHAIN,
            }),
          ),
        ).toBeInstanceOf(refusal)
      }

      expect(
        await listTransportLegs(alpha.tenant.scope, alpha.transportId),
      ).toEqual(before)
      expect(
        (await getTransport(alpha.tenant.scope, alpha.transportId))?.tripId,
      ).toBe(alpha.tripId)
    })

    it('saves on A’s own trip without disturbing B', async () => {
      const before = await betaWorld()

      const saved = await saveTransport(alpha.tenant.scope, {
        tripId: alpha.tripId,
        transportId: alpha.transportId,
        intent: 'edit',
        record: { title: 'Lisbon to Porto', mode: 'train' },
        chain: CHAIN,
      })

      expect(saved.legs).toHaveLength(1)
      expect(await betaWorld()).toEqual(before)
    })

    it('refuses a viewer for either intent and leaves the row as it was', async () => {
      const viewerId = await alpha.tenant.addUser('A viewer')
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: viewerId,
        role: 'viewer',
      })
      const before = await getTransport(alpha.tenant.scope, alpha.transportId)

      for (const intent of ['create', 'edit'] as const) {
        expect(
          await captureError(() =>
            saveTransport(alpha.tenant.scopeFor(viewerId), {
              tripId: alpha.tripId,
              transportId: alpha.transportId,
              intent,
              record: { title: 'Renamed', mode: 'train' },
              chain: CHAIN,
            }),
          ),
        ).toBeInstanceOf(TripRoleError)
      }

      expect(await getTransport(alpha.tenant.scope, alpha.transportId)).toEqual(
        before,
      )
    })
  })
  /**
   * The money writers take the trip the caller is working in *and* the row's id. Naming one's own
   * trip together with another workspace's row must not find the row, and must write nothing.
   */
  describe('the money writers', () => {
    it('refuse every B ledger row named through A’s own trip, and change nothing', async () => {
      const scope = alpha.tenant.scope
      const ledgerOfB = async (): Promise<unknown> => ({
        expense: await getExpenseWithShares(beta.tenant.scope, beta.expenseId),
        budgetItems: await listBudgetItems(beta.tenant.scope, beta.tripId),
        settlements: await listSettlements(beta.tenant.scope, beta.tripId),
      })
      const before = await ledgerOfB()

      const attempts: ReadonlyArray<() => Promise<unknown>> = [
        () =>
          updateExpense(scope, alpha.tripId, beta.expenseId, {
            title: 'Hijacked',
            amountMinor: 1,
          }),
        () => deleteExpense(scope, alpha.tripId, beta.expenseId),
        () =>
          setExpenseShares(scope, alpha.tripId, beta.expenseId, [
            { userId: alpha.tenant.ownerUserId },
          ]),
        () => markShareSettled(scope, alpha.tripId, beta.expenseShareId, true),
        () =>
          updateBudgetItem(scope, alpha.tripId, beta.budgetItemId, {
            name: 'Hijacked',
          }),
        () => deleteBudgetItem(scope, alpha.tripId, beta.budgetItemId),
        () => deleteSettlement(scope, alpha.tripId, beta.settlementId),
        // B's own trip does not help either: it is not A's to read.
        () => deleteExpense(scope, beta.tripId, beta.expenseId),
        () =>
          updateExpense(scope, beta.tripId, beta.expenseId, {
            title: 'Hijacked',
          }),
      ]
      for (const attempt of attempts) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }

      expect(await ledgerOfB()).toEqual(before)
    })

    /**
     * A write stamps the row with the caller's own organization, so an id of another workspace that
     * got through would be stored as a row A owns and B cannot see. Each is refused as an id that is
     * not there, on the create path and on the edit path.
     */
    it('refuse B’s people, place and planned item named in A’s own trip, and write nothing', async () => {
      const scope = alpha.tenant.scope
      const own = await createExpense(scope, {
        tripId: alpha.tripId,
        title: 'Taxi',
        amountMinor: 1_000,
        spentOn: '2026-04-10',
      })
      const ledgerOfA = async (): Promise<unknown> => ({
        expenses: await listTripExpenses(scope, alpha.tripId),
        shares: await getExpenseWithShares(scope, own.expense.id),
        settlements: await listSettlements(scope, alpha.tripId),
        balances: await getMemberBalances(scope, alpha.tripId),
      })
      const before = await ledgerOfA()
      const stranger = beta.tenant.ownerUserId
      const create = {
        tripId: alpha.tripId,
        title: 'Stolen',
        amountMinor: 1_000,
        spentOn: '2026-04-10',
      }

      const attempts: ReadonlyArray<() => Promise<unknown>> = [
        () =>
          createExpense(scope, {
            ...create,
            participants: [{ userId: stranger }],
          }),
        () => createExpense(scope, { ...create, paidBy: stranger }),
        () => createExpense(scope, { ...create, placeId: beta.placeId }),
        () =>
          createExpense(scope, { ...create, budgetItemId: beta.budgetItemId }),
        () =>
          updateExpense(scope, alpha.tripId, own.expense.id, {
            participants: [{ userId: stranger }],
          }),
        () =>
          updateExpense(scope, alpha.tripId, own.expense.id, {
            paidBy: stranger,
          }),
        () =>
          updateExpense(scope, alpha.tripId, own.expense.id, {
            placeId: beta.placeId,
          }),
        () =>
          updateExpense(scope, alpha.tripId, own.expense.id, {
            budgetItemId: beta.budgetItemId,
          }),
        () =>
          setExpenseShares(scope, alpha.tripId, own.expense.id, [
            { userId: stranger },
          ]),
        () =>
          createSettlement(scope, {
            tripId: alpha.tripId,
            fromUserId: stranger,
            toUserId: alpha.tenant.ownerUserId,
            amountMinor: 500,
            settledOn: '2026-04-11',
          }),
        () =>
          createSettlement(scope, {
            tripId: alpha.tripId,
            fromUserId: alpha.tenant.ownerUserId,
            toUserId: stranger,
            amountMinor: 500,
            settledOn: '2026-04-11',
          }),
      ]
      for (const attempt of attempts) {
        const error = await captureError(attempt)
        expect(error).toBeInstanceOf(NotFoundError)
        expect((error as NotFoundError).message).not.toContain(stranger)
      }

      expect(await ledgerOfA()).toEqual(before)
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
        // B's booking under B's own trip still resolves to nothing from A.
        () => requireReservationOfTrip(scope, beta.tripId, beta.reservationId),
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

    /**
     * The cost line and its link are one write, so the tenant and the trip of both are the scope's:
     * a B booking named from A inserts nothing in either workspace, and neither does an A booking
     * named under another trip.
     */
    it('creates a booking’s cost line only for a booking of its own tenant and trip', async () => {
      const scope = alpha.tenant.scope
      const expensesA = await expensesRepository.count(scope)
      const expensesB = await expensesRepository.count(beta.tenant.scope)

      expect(
        await captureError(() =>
          createReservationExpense(scope, beta.reservationId, {
            tripId: alpha.tripId,
            title: 'Cost of a booking that is not ours',
            amountMinor: 1_000,
            spentOn: '2026-04-10',
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await captureError(() =>
          createReservationExpense(scope, beta.reservationId, {
            tripId: beta.tripId,
            title: 'Cost on a trip that is not ours',
            amountMinor: 1_000,
            spentOn: '2026-04-10',
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      const otherTrip = await createTrip(scope, {
        title: 'Elsewhere',
        currency: 'EUR',
      })
      expect(
        await captureError(() =>
          createReservationExpense(scope, alpha.reservationId, {
            tripId: otherTrip.id,
            title: 'Cost under another trip',
            amountMinor: 1_000,
            spentOn: '2026-04-10',
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(await expensesRepository.count(scope)).toBe(expensesA)
      expect(await expensesRepository.count(beta.tenant.scope)).toBe(expensesB)
      expect(
        (await getReservation(beta.tenant.scope, beta.reservationId))
          ?.expenseId,
      ).toBeNull()
      expect(
        (await getReservation(scope, alpha.reservationId))?.expenseId,
      ).toBeNull()
    })

    it('creates a booking’s cost line and links it in one write, once', async () => {
      const scope = alpha.tenant.scope
      const input = {
        tripId: alpha.tripId,
        title: 'Dinner',
        amountMinor: 4_000,
        spentOn: '2026-04-10',
      }

      const first = await createReservationExpense(
        scope,
        alpha.reservationId,
        input,
      )
      expect(first.reservation.expenseId).toBe(first.expenseId)
      expect(await getExpense(scope, first.expenseId)).toMatchObject({
        tripId: alpha.tripId,
        title: 'Dinner',
      })

      // The booking is linked now, so a second write inserts nothing and is told so by the link.
      const countBefore = await expensesRepository.count(scope)
      const second = await createReservationExpense(
        scope,
        alpha.reservationId,
        input,
      )
      expect(second.reservation.expenseId).toBe(first.expenseId)
      expect(second.expenseId).not.toBe(first.expenseId)
      expect(await expensesRepository.count(scope)).toBe(countBefore)
      expect(await getExpense(scope, second.expenseId)).toBeNull()
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
        await markReservationsImported(scope, alpha.tripId, [
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

    /**
     * The statement binds the import instant, the updated-at stamp, the organization and the trip
     * next to one parameter per id, so one statement fits 96 ids and not 97 under D1's limit of
     * 100. The harness refuses an over-limit statement too, so these sizes pin that arithmetic
     * where the limit is enforced; 500 is the import engine's ceiling.
     */
    describe.each([96, 97, 98, 500])('a confirm of %i rows', (size) => {
      it('marks every row it wrote, with one shared instant', async () => {
        const scope = alpha.tenant.scope
        const ids = await bookingIds(scope, alpha.tripId, size)

        expect(await markReservationsImported(scope, alpha.tripId, ids)).toBe(
          size,
        )

        const rows = await listTripReservations(scope, {
          tripId: alpha.tripId,
        })
        const written = rows.filter((row) => ids.includes(row.id))
        expect(written).toHaveLength(size)
        expect(written.every((row) => row.importedAt instanceof Date)).toBe(
          true,
        )
        expect(
          new Set(written.map((row) => row.importedAt?.getTime())).size,
        ).toBe(1)
      })
    })

    it('skips a foreign id wherever it falls across the chunk boundary', async () => {
      const scope = alpha.tenant.scope
      const own = await bookingIds(scope, alpha.tripId, 200)

      // 95 and 96 are the last id of the first chunk and the first of the second.
      for (const position of [0, 95, 96, 199]) {
        const ids = own.slice()
        ids.splice(position, 0, beta.reservationId)

        expect(await markReservationsImported(scope, alpha.tripId, ids)).toBe(
          own.length,
        )
        expect(
          (await getReservation(beta.tenant.scope, beta.reservationId))
            ?.importedAt,
        ).toBeNull()
      }
    })

    it('answers NotFoundError for B\u2019s trip id, and leaves B\u2019s row unmarked', async () => {
      const scope = alpha.tenant.scope

      for (const ids of [[beta.reservationId], [alpha.reservationId]]) {
        expect(
          await captureError(() =>
            markReservationsImported(scope, beta.tripId, ids),
          ),
        ).toBeInstanceOf(NotFoundError)
      }

      expect(
        (await getReservation(beta.tenant.scope, beta.reservationId))
          ?.importedAt,
      ).toBeNull()
      expect(
        (await getReservation(scope, alpha.reservationId))?.importedAt,
      ).toBeNull()
    })

    it('marks nothing on a trip other than the one it was handed', async () => {
      const scope = alpha.tenant.scope
      const other = await createTrip(scope, { title: 'Another alpha trip' })
      const elsewhere = await createReservation(scope, {
        tripId: other.id,
        title: 'Booked on the other trip',
      })

      expect(
        await markReservationsImported(scope, alpha.tripId, [
          alpha.reservationId,
          elsewhere.id,
        ]),
      ).toBe(1)
      expect((await getReservation(scope, elsewhere.id))?.importedAt).toBeNull()
    })

    it('clears its own marker twice without complaining', async () => {
      const scope = alpha.tenant.scope
      await markReservationsImported(scope, alpha.tripId, [alpha.reservationId])

      expect(
        (await clearReservationImported(scope, alpha.reservationId)).importedAt,
      ).toBeNull()
      expect(
        (await clearReservationImported(scope, alpha.reservationId)).importedAt,
      ).toBeNull()
    })

    it('creates an imported reservation atomically inside the tenant and trip guards', async () => {
      const scope = alpha.tenant.scope
      const before = await listTripReservations(beta.tenant.scope, {
        tripId: beta.tripId,
      })
      const instant = new Date('2026-10-15T12:00:00Z')
      // A later UPDATE cannot rescue an unmarked INSERT.
      harness.sqlite
        .exec(`CREATE TRIGGER require_import_marker BEFORE INSERT ON reservations
        WHEN NEW.imported_at IS NULL BEGIN SELECT RAISE(ABORT, 'missing import marker'); END`)

      const created = await createImportedReservation(
        scope,
        {
          tripId: alpha.tripId,
          title: 'Confirmed import',
        },
        instant,
      )
      expect(created.importedAt).toEqual(instant)
      expect(await getReservation(scope, created.id)).toEqual(created)
      expect(await getReservation(beta.tenant.scope, created.id)).toBeNull()

      const ownBefore = await listTripReservations(scope, {
        tripId: alpha.tripId,
      })
      for (const input of [
        { tripId: beta.tripId, title: 'Foreign trip' },
        {
          tripId: alpha.tripId,
          title: 'Foreign reference',
          placeId: beta.placeId,
        },
      ]) {
        expect(
          await captureError(() =>
            createImportedReservation(scope, input, instant),
          ),
        ).toBeInstanceOf(NotFoundError)
      }
      const other = await createTrip(scope, { title: 'Other trip' })
      const place = await createPlace(scope, {
        tripId: other.id,
        name: 'Other place',
      })
      expect(
        await captureError(() =>
          createImportedReservation(
            scope,
            {
              tripId: alpha.tripId,
              title: 'Wrong trip reference',
              placeId: place.id,
            },
            instant,
          ),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await listTripReservations(scope, { tripId: alpha.tripId }),
      ).toEqual(ownBefore)
      expect(
        await listTripReservations(beta.tenant.scope, { tripId: beta.tripId }),
      ).toEqual(before)
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
      const imported = await createImportedReservation(
        editor,
        { tripId: alpha.tripId, title: 'Imported by editor' },
        new Date(),
      )
      expect(imported.importedAt).toBeInstanceOf(Date)

      // The marker writers are a booking write like any other: an editor is let
      // through on both, and a viewer is refused on both with the marker untouched.
      expect(
        await markReservationsImported(editor, alpha.tripId, [
          alpha.reservationId,
        ]),
      ).toBe(1)
      expect(
        (await clearReservationImported(editor, alpha.reservationId))
          .importedAt,
      ).toBeNull()

      // Every refusal below is the one class `assertTripRole` throws, under the
      // code `FORBIDDEN`, and the classifier shows it to the reader as a refusal.
      const refusalCode = async (
        run: () => Promise<unknown>,
      ): Promise<string> => {
        const error = await captureError(run)
        expect(error).toBeInstanceOf(TripRoleError)
        expect(classifyFailure(error).kind).toBe('refusal')
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

      const beforeViewer = await listTripReservations(alpha.tenant.scope, {
        tripId: alpha.tripId,
      })
      // And the same refusal on every other writer this file owns.
      for (const attempt of [
        () =>
          createImportedReservation(
            viewer,
            {
              tripId: alpha.tripId,
              title: 'Viewer import',
              placeId: beta.placeId,
            },
            new Date(),
          ),
        () =>
          updateReservation(viewer, alpha.reservationId, { title: 'Hijacked' }),
        () => setReservationStatus(viewer, alpha.reservationId, 'cancelled'),
        () => deleteReservation(viewer, alpha.reservationId),
        () =>
          linkReservationExpense(viewer, alpha.reservationId, alpha.expenseId),
        () =>
          markReservationsImported(viewer, alpha.tripId, [alpha.reservationId]),
        () => clearReservationImported(viewer, alpha.reservationId),
      ]) {
        expect(await refusalCode(attempt)).toBe('FORBIDDEN')
      }

      expect(
        await listTripReservations(alpha.tenant.scope, {
          tripId: alpha.tripId,
        }),
      ).toEqual(beforeViewer)
      // A refused viewer changed nothing: not marked, and not cleared once marked.
      expect(
        (await getReservation(alpha.tenant.scope, alpha.reservationId))
          ?.importedAt,
      ).toBeNull()
      await markReservationsImported(alpha.tenant.scope, alpha.tripId, [
        alpha.reservationId,
      ])
      await captureError(() =>
        clearReservationImported(viewer, alpha.reservationId),
      )
      expect(
        (await getReservation(alpha.tenant.scope, alpha.reservationId))
          ?.importedAt,
      ).toBeInstanceOf(Date)
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
   * `src/server/transit/__tests__/search.test.ts`: it names the workspace and
   * the member, so it must be a *different* string for every pair of them.
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

      // B's trip is not A's to see, so it is refused as a trip; B's transport named under A's own
      // trip reads as a transport that is not there, which is the answer an absent id gets.
      for (const [tripId, refusal] of [
        [beta.tripId, NotFoundError],
        [alpha.tripId, TransportRefusalError],
      ] as const) {
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
        ).toBeInstanceOf(refusal)
      }
      const absent = await captureError(() =>
        saveSearchedConnection(alpha.tenant.scope, {
          ...CONNECTION,
          tripId: alpha.tripId,
          transportId: 'never-existed',
        }),
      )
      const foreign = await captureError(() =>
        saveSearchedConnection(alpha.tenant.scope, {
          ...CONNECTION,
          tripId: alpha.tripId,
          transportId: beta.transportId,
        }),
      )
      expect(foreign).toEqual(absent)

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
      ).toBeInstanceOf(TransportRefusalError)
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
      await editTransport(
        scope,
        alpha.tripId,
        saved.transport.id,
        {
          title: saved.transport.title,
          status: 'confirmed',
          bookingCode: 'TXK9QP',
          seat: '21A',
        },
        { stations: CONNECTION.stations, legs: CONNECTION.legs },
      )
      expect(await listTransportLegs(scope, saved.transport.id)).toHaveLength(2)

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

      it('refuses a foreign trip’s existing member as NOT_FOUND, never as already on the trip', async () => {
        // B's owner is on B's trip, so the unique index would refuse the insert. `TRIP_MEMBER_EXISTS`
        // here would confirm who is on B's trip; the trip has to be unresolvable before the index.
        expect(
          await captureError(() =>
            addTripMember(alpha.tenant.scope, {
              tripId: beta.tripId,
              userId: beta.tenant.ownerUserId,
              role: 'editor',
            }),
          ),
        ).toBeInstanceOf(NotFoundError)
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
          impersonatedBy: null,
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
   * `09-S5c`: sign-up seeds the new account's language through `seedUserLocale`, called from the
   * auth layer with a scope it builds from the organization and user it has just created.
   *
   * The scope is the only thing that decides where the row lands, so the cases are about the scope:
   * the row carries the scope's organization and user, nothing is written for the other
   * organization, and a row that already exists is left exactly as it was.
   */
  describe('seeding a new member’s language', () => {
    async function rowsOf(world: World): Promise<Array<UserSettings>> {
      return userSettingsRepository.findMany(world.tenant.scope)
    }

    it('writes one row for the scope’s own organization and user, and none in another', async () => {
      const newcomer = await alpha.tenant.addUser('Newcomer')
      const betaBefore = await rowsOf(beta)

      await seedUserLocale(alpha.tenant.scopeFor(newcomer), 'pl')

      const written = await getUserSettings(alpha.tenant.scope, newcomer)
      expect(written?.organizationId).toBe(alpha.tenant.organizationId)
      expect(written?.userId).toBe(newcomer)
      expect(written?.locale).toBe('pl')
      expect(await rowsOf(beta)).toEqual(betaBefore)
      expect(await getUserSettings(beta.tenant.scope, newcomer)).toBeNull()
    })

    it('is insert-if-absent: a row that exists keeps every column', async () => {
      const before = await getUserSettings(
        alpha.tenant.scope,
        alpha.tenant.ownerUserId,
      )
      expect(before?.theme).toBe('dark')

      await seedUserLocale(alpha.tenant.scope, 'de')
      await seedUserLocale(alpha.tenant.scope, 'fr')

      expect(
        await getUserSettings(alpha.tenant.scope, alpha.tenant.ownerUserId),
      ).toEqual(before)
    })

    it('a repeated seed adds nothing', async () => {
      const newcomer = await alpha.tenant.addUser('Newcomer')
      const scope = alpha.tenant.scopeFor(newcomer)

      await seedUserLocale(scope, 'pl')
      await seedUserLocale(scope, 'uk')

      expect(
        (await userSettingsRepository.findMany(alpha.tenant.scope)).filter(
          (row) => row.userId === newcomer,
        ),
      ).toHaveLength(1)
      expect((await getUserSettings(scope))?.locale).toBe('pl')
    })

    it('refuses a tag the catalogue does not ship', async () => {
      const newcomer = await alpha.tenant.addUser('Newcomer')

      await expect(
        // The argument type is the shipped tags; the cast reaches the runtime defence.
        seedUserLocale(alpha.tenant.scopeFor(newcomer), 'xx-nope' as never),
      ).rejects.toThrow()
      expect(await getUserSettings(alpha.tenant.scope, newcomer)).toBeNull()
    })
  })

  /**
   * `01-S4a`: one number line per day, written across two tables in one batch.
   *
   * The batch is the reason this block exists rather than riding on the generic
   * per-repository cases above. `reorderDayTimelines` is the only write in the
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
          reorderDayTimelines(scope, {
            tripId: beta.tripId,
            days: [
              {
                dayId: beta.dayId,
                items: [{ kind: 'stop', id: beta.assignmentId }],
              },
            ],
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      // A's own trip with B's day: `requireTripDay`'s job, and the one a caller who
      // has already proved they own a trip could otherwise reach through.
      expect(
        await captureError(() =>
          reorderDayTimelines(scope, {
            tripId: alpha.tripId,
            days: [{ dayId: beta.dayId, items: [] }],
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
    })

    it('refuses B’s day named beside A’s own, and writes nothing to either', async () => {
      const scope = alpha.tenant.scope
      const before = {
        alpha: await positionsOf(scope, alpha.dayId),
        beta: await positionsOf(beta.tenant.scope, beta.dayId),
      }

      expect(
        await captureError(() =>
          reorderDayTimelines(scope, {
            tripId: alpha.tripId,
            days: [
              {
                dayId: alpha.dayId,
                items: [{ kind: 'note', id: alpha.dayNoteId }],
              },
              {
                dayId: beta.dayId,
                items: [{ kind: 'stop', id: alpha.assignmentId }],
              },
            ],
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(await positionsOf(scope, alpha.dayId)).toEqual(before.alpha)
      expect(await positionsOf(beta.tenant.scope, beta.dayId)).toEqual(
        before.beta,
      )
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

      const written = await reorderDayTimelines(scope, {
        tripId: alpha.tripId,
        days: [
          {
            dayId: alpha.dayId,
            items: [
              { kind: 'stop', id: beta.assignmentId },
              { kind: 'note', id: alpha.dayNoteId },
              { kind: 'note', id: beta.dayNoteId },
              { kind: 'transport', id: beta.transportId },
              { kind: 'stop', id: extraStop.id },
              { kind: 'note', id: extraNote.id },
              { kind: 'stop', id: alpha.assignmentId },
            ],
          },
        ],
      })

      // B's three ids (two rows and a journey) are gone from the write, and A's four are
      // numbered 0..3.
      expect(written).toEqual([
        {
          dayId: alpha.dayId,
          items: [
            { kind: 'note', id: alpha.dayNoteId },
            { kind: 'stop', id: extraStop.id },
            { kind: 'note', id: extraNote.id },
            { kind: 'stop', id: alpha.assignmentId },
          ],
          journeys: [{ kind: 'transport', id: alpha.transportId }],
        },
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
      await reorderDayTimelines(scope, {
        tripId: alpha.tripId,
        days: [
          {
            dayId: alpha.dayId,
            items: [
              { kind: 'stop', id: beta.assignmentId },
              { kind: 'note', id: beta.dayNoteId },
            ],
          },
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

      await reorderDayTimelines(scope, {
        tripId: alpha.tripId,
        days: [
          {
            dayId: alpha.dayId,
            items: [{ kind: 'stop', id: beta.assignmentId }],
            clearTime: [{ kind: 'stop', id: beta.assignmentId }],
          },
        ],
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
   * A trip's file writes. Membership is not a role: a viewer reads the trip's files and writes none
   * of them, an archived trip refuses everybody, and a file id is bound to the trip it names, so the
   * trip a caller proved they may change is the trip whose file they change.
   */
  describe('trip files', () => {
    const INPUT = {
      storageKey: 'files/written.pdf',
      filename: 'written.pdf',
      contentType: 'application/pdf',
      sizeBytes: 10,
    }

    async function memberScope(
      role: 'viewer' | 'editor',
    ): Promise<TenantScope> {
      const userId = await alpha.tenant.addUser(`File ${role} of A`)
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId,
        role,
      })
      return alpha.tenant.scopeFor(userId)
    }

    /** The three writers, aimed at A's own file on A's trip. */
    function writersAs(
      scope: TenantScope,
    ): ReadonlyArray<() => Promise<unknown>> {
      return [
        () => recordFile(scope, { ...INPUT, tripId: alpha.tripId }),
        () =>
          updateFile(scope, alpha.tripId, alpha.fileId, {
            filename: 'new.pdf',
          }),
        () => deleteFile(scope, alpha.tripId, alpha.fileId),
      ]
    }

    async function filesOf(scope: TenantScope, tripId: string) {
      return listTripFiles(scope, tripId)
    }

    it('refuses a viewer all three writes and changes nothing', async () => {
      const viewer = await memberScope('viewer')
      const before = await filesOf(alpha.tenant.scope, alpha.tripId)

      for (const attempt of writersAs(viewer)) {
        expect(await captureError(attempt)).toBeInstanceOf(TripRoleError)
      }

      expect(await filesOf(alpha.tenant.scope, alpha.tripId)).toEqual(before)
    })

    it('admits an editor and an owner on the same trip', async () => {
      const editor = await memberScope('editor')

      await recordFile(editor, { ...INPUT, tripId: alpha.tripId })
      const renamed = await updateFile(editor, alpha.tripId, alpha.fileId, {
        filename: 'editor.pdf',
      })
      expect(renamed.filename).toBe('editor.pdf')
      expect(await deleteFile(editor, alpha.tripId, alpha.fileId)).toEqual(
        expect.any(String),
      )

      const second = await recordFile(alpha.tenant.scope, {
        ...INPUT,
        storageKey: 'files/owner.pdf',
        tripId: alpha.tripId,
      })
      await updateFile(alpha.tenant.scope, alpha.tripId, second.id, {
        filename: 'owner.pdf',
      })
      await deleteFile(alpha.tenant.scope, alpha.tripId, second.id)
    })

    it('refuses every write on an archived trip, owner included, before the role', async () => {
      const viewer = await memberScope('viewer')
      await archiveTrip(alpha.tenant.scope, alpha.tripId)
      const before = await filesOf(alpha.tenant.scope, alpha.tripId)

      for (const scope of [alpha.tenant.scope, viewer]) {
        for (const attempt of writersAs(scope)) {
          expect(await captureError(attempt)).toBeInstanceOf(TripArchivedError)
        }
      }

      expect(await filesOf(alpha.tenant.scope, alpha.tripId)).toEqual(before)
    })

    it('answers a member of the workspace who cannot see a private trip with NotFound', async () => {
      const strangerId = await alpha.tenant.addUser('Stranger')
      const stranger = alpha.tenant.scopeFor(strangerId)

      const before = await filesOf(alpha.tenant.scope, alpha.tripId)
      for (const attempt of writersAs(stranger)) {
        const error = await captureError(attempt)
        expect(error).toBeInstanceOf(NotFoundError)
        expect(error).not.toBeInstanceOf(TripRoleError)
      }
      expect(await filesOf(alpha.tenant.scope, alpha.tripId)).toEqual(before)
    })

    it('refuses a workspace member who can read an organization-visible trip but is not on it', async () => {
      // Readable is not writable: with no `trip_members` row the role is null, which no write allows.
      const open = await createTrip(alpha.tenant.scope, {
        title: 'Open to the workspace',
        visibility: 'organization',
      })
      const onOpen = await recordFile(alpha.tenant.scope, {
        ...INPUT,
        tripId: open.id,
      })
      const outsider = alpha.tenant.scopeFor(
        await alpha.tenant.addUser('Reader of A'),
      )

      const before = await filesOf(alpha.tenant.scope, open.id)
      for (const attempt of [
        () => recordFile(outsider, { ...INPUT, tripId: open.id }),
        () => updateFile(outsider, open.id, onOpen.id, { filename: 'new.pdf' }),
        () => deleteFile(outsider, open.id, onOpen.id),
      ]) {
        expect(await captureError(attempt)).toBeInstanceOf(TripRoleError)
      }
      expect(await filesOf(alpha.tenant.scope, open.id)).toEqual(before)
    })

    it('gives missing, other-trip and other-workspace deletes the identical file refusal', async () => {
      const other = await createTrip(alpha.tenant.scope, {
        title: 'Other trip',
      })
      const otherFile = await recordFile(alpha.tenant.scope, {
        ...INPUT,
        tripId: other.id,
      })
      const beforeOther = await getFile(alpha.tenant.scope, otherFile.id)
      const beforeBeta = await getFile(beta.tenant.scope, beta.fileId)
      for (const fileId of ['missing-file', otherFile.id, beta.fileId]) {
        expect(
          await captureError(() =>
            deleteFile(alpha.tenant.scope, alpha.tripId, fileId),
          ),
        ).toEqual(new NotFoundError('file', fileId))
      }
      expect(await getFile(alpha.tenant.scope, otherFile.id)).toEqual(
        beforeOther,
      )
      expect(await getFile(beta.tenant.scope, beta.fileId)).toEqual(beforeBeta)
    })

    it('binds a file id to the trip it names', async () => {
      // A second trip the editor may change, and a file on a trip they may only read.
      const editor = await memberScope('editor')
      const other = await createTrip(alpha.tenant.scope, { title: 'Porto' })
      const onOther = await recordFile(alpha.tenant.scope, {
        ...INPUT,
        tripId: other.id,
      })
      const before = await getFile(alpha.tenant.scope, onOther.id)

      // The caller may write on A's trip but is not on the other (private) one at all.
      for (const attempt of [
        () =>
          updateFile(editor, alpha.tripId, onOther.id, { filename: 'x.pdf' }),
        () => deleteFile(editor, alpha.tripId, onOther.id),
      ]) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }
      expect(await getFile(alpha.tenant.scope, onOther.id)).toEqual(before)
    })

    it('refuses a file id of another workspace', async () => {
      const before = await getFile(beta.tenant.scope, beta.fileId)

      for (const attempt of [
        () =>
          updateFile(alpha.tenant.scope, alpha.tripId, beta.fileId, {
            filename: 'x.pdf',
          }),
        () => deleteFile(alpha.tenant.scope, alpha.tripId, beta.fileId),
      ]) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }
      expect(await getFile(beta.tenant.scope, beta.fileId)).toEqual(before)
    })
  })

  /**
   * A file or a check-in names a place, booking, transport or expense by id (#1035). The tenant
   * filter hides a row of another workspace from the lookup, so the writer answers it as an id that
   * is not there, and nothing is written in either workspace.
   */
  describe('the ids a file or a check-in links to', () => {
    const INPUT = {
      storageKey: 'files/linked.pdf',
      filename: 'linked.pdf',
      contentType: 'application/pdf',
      sizeBytes: 10,
    }

    /** One id of workspace B per link a file can carry. */
    const foreignLinks = (): ReadonlyArray<
      readonly [string, Record<string, string>]
    > => [
      ['placeId', { placeId: beta.placeId }],
      ['reservationId', { reservationId: beta.reservationId }],
      ['transportId', { transportId: beta.transportId }],
      ['expenseId', { expenseId: beta.expenseId }],
    ]

    async function filesOfBoth(): Promise<unknown> {
      return {
        alpha: await listTripFiles(alpha.tenant.scope, alpha.tripId),
        beta: await listTripFiles(beta.tenant.scope, beta.tripId),
      }
    }

    async function checkInsOfBoth(): Promise<unknown> {
      return {
        alpha: await listTripCheckIns(alpha.tenant.scope, alpha.tripId),
        beta: await listTripCheckIns(beta.tenant.scope, beta.tripId),
      }
    }

    it.each(['placeId', 'reservationId', 'transportId', 'expenseId'])(
      'refuses to record a file linked to the %s of another workspace',
      async (key) => {
        const link = foreignLinks().find(([name]) => name === key)?.[1]
        const before = await filesOfBoth()

        const error = await captureError(() =>
          recordFile(alpha.tenant.scope, {
            ...INPUT,
            tripId: alpha.tripId,
            ...link,
          }),
        )

        expect(error).toBeInstanceOf(NotFoundError)
        expect(await filesOfBoth()).toEqual(before)
      },
    )

    it.each(['placeId', 'reservationId', 'transportId', 'expenseId'])(
      'refuses to link a file to the %s of another workspace, leaving the row as it was',
      async (key) => {
        const link = foreignLinks().find(([name]) => name === key)?.[1]
        const before = await getFile(alpha.tenant.scope, alpha.fileId)
        const beforeBoth = await filesOfBoth()

        const error = await captureError(() =>
          updateFile(alpha.tenant.scope, alpha.tripId, alpha.fileId, {
            filename: 'renamed.pdf',
            ...link,
          }),
        )

        expect(error).toBeInstanceOf(NotFoundError)
        expect(await getFile(alpha.tenant.scope, alpha.fileId)).toEqual(before)
        expect(await filesOfBoth()).toEqual(beforeBoth)
      },
    )

    it('refuses an expense of another workspace under either trip', async () => {
      for (const tripId of [alpha.tripId, beta.tripId]) {
        expect(
          await captureError(() =>
            requireExpenseOfTrip(alpha.tenant.scope, tripId, beta.expenseId),
          ),
        ).toBeInstanceOf(NotFoundError)
      }
    })

    it('refuses to update a file of another workspace even when the links are its own', async () => {
      const before = await filesOfBoth()

      const error = await captureError(() =>
        updateFile(alpha.tenant.scope, alpha.tripId, beta.fileId, {
          placeId: alpha.placeId,
        }),
      )

      expect(error).toBeInstanceOf(NotFoundError)
      expect(await filesOfBoth()).toEqual(before)
    })

    it('refuses a check-in at a place of another workspace, with or without a trip of its own', async () => {
      const before = await checkInsOfBoth()

      const onOwnTrip = await captureError(() =>
        createCheckIn(alpha.tenant.scope, {
          tripId: alpha.tripId,
          placeId: beta.placeId,
          name: 'Stolen check-in',
        }),
      )
      const withoutTrip = await captureError(() =>
        createCheckIn(alpha.tenant.scope, {
          placeId: beta.placeId,
          name: 'Stolen check-in',
        }),
      )

      expect(onOwnTrip).toBeInstanceOf(NotFoundError)
      expect(withoutTrip).toBeInstanceOf(ZodError)
      expect(await checkInsOfBoth()).toEqual(before)
    })

    it('still accepts the links of its own trip and a check-in with neither trip nor place', async () => {
      const file = await recordFile(alpha.tenant.scope, {
        ...INPUT,
        tripId: alpha.tripId,
        placeId: alpha.placeId,
        reservationId: alpha.reservationId,
        transportId: alpha.transportId,
        expenseId: alpha.expenseId,
      })
      expect(file.expenseId).toBe(alpha.expenseId)

      await createCheckIn(alpha.tenant.scope, {
        tripId: alpha.tripId,
        placeId: alpha.placeId,
        name: 'Miradouro',
      })
      await createCheckIn(alpha.tenant.scope, { name: 'Somewhere' })
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
   * `03-S5`: the board's read of a trip's journeys, and the writes that place them.
   *
   * The read is ordinary and is asserted for completeness. The **writes** are the case this block
   * genuinely adds: schedule, unschedule and delete (#816) each write `sort_order` on two tables
   * from a run the client chose, so a forged id must be *dropped*, not merely refused at the end —
   * and the only honest proof of that is B's stored values, re-read on both tables afterwards and
   * byte-for-byte identical.
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

    it('refuses to schedule onto a day of B’s trip, named with B’s trip or with A’s own', async () => {
      const scope = alpha.tenant.scope

      expect(
        await captureError(() =>
          scheduleAssignment(scope, {
            tripId: beta.tripId,
            dayId: beta.dayId,
            placeId: beta.placeId,
            orderIndex: 0,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      // A's own trip with B's day and B's place: the tenant filter alone lets the day through,
      // because every row it would write is A's. `requireTripDay` is what refuses it.
      expect(
        await captureError(() =>
          scheduleAssignment(scope, {
            tripId: alpha.tripId,
            dayId: beta.dayId,
            placeId: alpha.placeId,
            orderIndex: 0,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await captureError(() =>
          scheduleAssignment(scope, {
            tripId: alpha.tripId,
            dayId: alpha.lastDayId,
            placeId: beta.placeId,
            orderIndex: 0,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
    })

    it('refuses to unschedule B’s stop and to delete B’s place, named with B’s trip or with A’s own', async () => {
      const scope = alpha.tenant.scope
      const before = await positionsOf(beta)

      for (const tripId of [beta.tripId, alpha.tripId]) {
        expect(
          await captureError(() =>
            unscheduleAssignment(scope, {
              tripId,
              assignmentId: beta.assignmentId,
            }),
          ),
        ).toBeInstanceOf(NotFoundError)
        expect(
          await captureError(() =>
            deletePlaceWithJourneys(scope, { tripId, placeId: beta.placeId }),
          ),
        ).toBeInstanceOf(NotFoundError)
      }

      // B still holds the stop, the place and every position it held.
      expect(
        await listDayAssignments(beta.tenant.scope, beta.dayId),
      ).toHaveLength(1)
      expect(await getPlace(beta.tenant.scope, beta.placeId)).not.toBeNull()
      expect(await positionsOf(beta)).toEqual(before)
    })

    it('drops B’s transport and leg ids inside a schedule onto A’s own day', async () => {
      const before = await positionsOf(beta)
      const betaLegs = await listTripLegs(beta.tenant.scope, beta.tripId)
      const place = await createPlace(alpha.tenant.scope, {
        tripId: alpha.tripId,
        name: 'A second stop',
      })

      const scheduled = await scheduleAssignment(alpha.tenant.scope, {
        tripId: alpha.tripId,
        dayId: alpha.dayId,
        placeId: place.id,
        orderIndex: 1000,
        items: [
          { kind: 'stop', id: alpha.assignmentId },
          { kind: 'transport', id: beta.transportId },
          { kind: 'leg', id: betaLegs[0].id },
          { kind: 'note', id: beta.dayNoteId },
          { kind: 'stop', id: beta.assignmentId },
          { kind: 'stop', id: place.id },
        ],
      })

      // Not one number of B's moved — on either table.
      expect(await positionsOf(beta)).toEqual(before)
      // A's own journey was placed, and the room hears only A's rows.
      expect(scheduled.days).toEqual([
        {
          dayId: alpha.dayId,
          journeys: [{ kind: 'transport', id: alpha.transportId }],
        },
      ])
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

  /**
   * The journal's journey readers (#456, ADR 0020).
   *
   * They now ask the trip a journey names through a sub-select over `trips`. Both halves of it are
   * tenant-bound, so A's journey — tied to A's trip — is no more reachable from B through the new
   * predicate than it was through the tenant filter alone.
   */
  describe('the journal read from the other organization', () => {
    it('lists, opens and tallies none of A’s journeys', async () => {
      expect(
        (await listJourneys(beta.tenant.scope)).map((row) => row.id),
      ).toEqual([beta.journeyId])
      expect(await getJourney(beta.tenant.scope, alpha.journeyId)).toBeNull()
      expect(
        await captureError(() =>
          getJourneyStory(beta.tenant.scope, alpha.journeyId),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        (await listRecentEntries(beta.tenant.scope)).map((row) => row.entry.id),
      ).toEqual([beta.journeyEntryId])
      expect(
        (await tallyMoods(beta.tenant.scope)).map((row) => row.value),
      ).toEqual([1])
    })

    it('writes to and reads by id none of A’s journeys, entries or photos (#521)', async () => {
      // The writes and id-keyed helpers now resolve through the same read predicate, whose
      // sub-selects are tenant-bound too; A's ids stay a `NotFoundError` or nothing from B.
      const scope = beta.tenant.scope
      for (const attempt of [
        () => updateJourney(scope, alpha.journeyId, { title: 'Stolen' }),
        () =>
          publishJourney(scope, alpha.journeyId, 'a-token-long-enough-to-pass'),
        () => unpublishJourney(scope, alpha.journeyId),
        () => deleteJourney(scope, alpha.journeyId),
        () => updateEntry(scope, alpha.journeyEntryId, { title: 'Stolen' }),
        () => deleteEntry(scope, alpha.journeyEntryId),
        () => attachPhotoToEntry(scope, alpha.journeyPhotoId, null),
        () => deletePhoto(scope, alpha.journeyPhotoId),
      ]) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }

      expect(await listJourneyEntries(scope, alpha.journeyId)).toEqual([])
      expect(await listUnattachedPhotos(scope, alpha.journeyId)).toEqual([])
      expect(await countEntriesByMood(scope, alpha.journeyId)).toEqual([])
      expect(
        (
          await listEntriesByIds(scope, [
            alpha.journeyEntryId,
            beta.journeyEntryId,
          ])
        ).map((row) => row.id),
      ).toEqual([beta.journeyEntryId])

      const story = await getJourneyStory(alpha.tenant.scope, alpha.journeyId)
      expect(story.journey.title).toBe('Lisbon notebook')
      expect(story.entries.map((row) => row.photos.length)).toEqual([1])
    })
  })

  /** `01-S6b` — a trip's guests, read and written across the tenant boundary. */
  describe('trip guests', () => {
    it('refuses to put a guest on a foreign trip', async () => {
      expect(
        await captureError(() =>
          createTripGuest(alpha.tenant.scope, {
            tripId: beta.tripId,
            displayName: 'Stowaway',
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        (await listTripGuests(beta.tenant.scope, beta.tripId)).map(
          (guest) => guest.id,
        ),
      ).toEqual([beta.guestId])
    })

    it('refuses to rename or remove a foreign guest, and leaves it byte-identical', async () => {
      const before = await tripGuestsRepository.findById(
        beta.tenant.scope,
        beta.guestId,
      )

      expect(
        await captureError(() =>
          renameTripGuest(alpha.tenant.scope, beta.guestId, 'hijacked'),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await captureError(() =>
          removeTripGuest(alpha.tenant.scope, beta.guestId),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await tripGuestsRepository.findById(beta.tenant.scope, beta.guestId),
      ).toEqual(before)
    })

    it('lists none of a foreign trip’s guests, and refuses its participants', async () => {
      expect(await listTripGuests(alpha.tenant.scope, beta.tripId)).toEqual([])
      expect(
        await captureError(() =>
          listTripParticipants(alpha.tenant.scope, beta.tripId),
        ),
      ).toBeInstanceOf(NotFoundError)
    })

    it('merges neither a foreign guest nor into a foreign member, and relinks nothing', async () => {
      const calls: Array<string> = []
      const unregister = registerGuestRelinker('probe', async () => {
        calls.push('probe')
        return { count: 0, statements: [] }
      })
      try {
        expect(
          await captureError(() =>
            mergeTripGuest(
              alpha.tenant.scope,
              alpha.tripId,
              beta.guestId,
              alpha.tenant.ownerUserId,
            ),
          ),
        ).toBeInstanceOf(NotFoundError)
        // B's owner is a member of B's trip and of no trip of A's, so as a target they are
        // somebody not on this trip — the refusal every outsider gets, disclosing nothing.
        expect(
          await captureError(() =>
            mergeTripGuest(
              alpha.tenant.scope,
              alpha.tripId,
              alpha.guestId,
              beta.tenant.ownerUserId,
            ),
          ),
        ).toBeInstanceOf(TripGuestMergeTargetError)
        expect(calls).toEqual([])
      } finally {
        unregister()
      }
      expect(
        await tripGuestsRepository.findById(beta.tenant.scope, beta.guestId),
      ).not.toBeNull()
      expect(
        await tripGuestsRepository.findById(alpha.tenant.scope, alpha.guestId),
      ).not.toBeNull()
    })
  })

  /**
   * 03-S8a — a stay linked to the booking that pays for it.
   *
   * The day-range and place guards were already in `itinerary.ts`; what this stage adds is the
   * `reservation_id` link and the role guard on the three writers. The link is the case worth its
   * own assertion: both accommodation validators are `z.object`s, so before this stage a
   * `reservationId` was stripped rather than refused, and a guard that is never reached proves
   * nothing. It is asserted here to reach the insert, and to refuse B's booking on the way.
   */
  describe('a stay and the booking it is linked to', () => {
    it('cannot read, list, count, update or delete another tenant’s stay', async () => {
      const scope = alpha.tenant.scope

      expect(await listTripAccommodations(scope, beta.tripId)).toHaveLength(0)
      for (const attempt of [
        () => countAccommodationNights(scope, beta.accommodationId),
        () =>
          updateAccommodation(scope, beta.accommodationId, {
            name: 'Hijacked',
          }),
        () => deleteAccommodation(scope, beta.accommodationId),
      ]) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }
    })

    it('cannot create a stay on another tenant’s days or place', async () => {
      const scope = alpha.tenant.scope

      for (const refs of [
        { startDayId: beta.dayId, endDayId: alpha.lastDayId },
        { startDayId: alpha.dayId, endDayId: beta.lastDayId },
        {
          startDayId: alpha.dayId,
          endDayId: alpha.lastDayId,
          placeId: beta.placeId,
        },
      ]) {
        expect(
          await captureError(() =>
            createAccommodation(scope, {
              tripId: alpha.tripId,
              name: 'Stolen stay',
              ...refs,
            }),
          ),
        ).toBeInstanceOf(NotFoundError)
      }
    })

    it('links its own booking, and refuses a link to another tenant’s booking', async () => {
      const scope = alpha.tenant.scope
      const betaStaysBefore = await listTripAccommodations(
        beta.tenant.scope,
        beta.tripId,
      )
      const betaBookingsBefore = await listTripReservations(beta.tenant.scope, {
        tripId: beta.tripId,
      })

      const linked = await createAccommodation(scope, {
        tripId: alpha.tripId,
        startDayId: alpha.dayId,
        endDayId: alpha.lastDayId,
        name: 'Alfama guesthouse, booked',
        reservationId: alpha.reservationId,
      })
      expect(linked.reservationId).toBe(alpha.reservationId)

      expect(
        await captureError(() =>
          createAccommodation(scope, {
            tripId: alpha.tripId,
            startDayId: alpha.dayId,
            endDayId: alpha.lastDayId,
            name: 'Dangling stay',
            reservationId: beta.reservationId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await captureError(() =>
          updateAccommodation(scope, alpha.accommodationId, {
            reservationId: beta.reservationId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        (
          await dayAccommodationsRepository.findById(
            scope,
            alpha.accommodationId,
          )
        )?.reservationId,
      ).toBeNull()

      expect(
        await listTripAccommodations(beta.tenant.scope, beta.tripId),
      ).toEqual(betaStaysBefore)
      expect(
        await listTripReservations(beta.tenant.scope, { tripId: beta.tripId }),
      ).toEqual(betaBookingsBefore)
    })

    it('refuses a link to a booking of another trip in the same workspace', async () => {
      const scope = alpha.tenant.scope
      // The tenant filter cannot tell two trips of one workspace apart; the reference guard can.
      const otherTrip = await createTrip(scope, {
        title: 'Porto in autumn',
        startDate: '2026-10-01',
        endDate: '2026-10-03',
        currency: 'EUR',
      })
      const otherBooking = await createReservation(scope, {
        tripId: otherTrip.id,
        title: 'Porto guesthouse',
        type: 'accommodation',
        status: 'confirmed',
      })

      expect(
        await captureError(() =>
          createAccommodation(scope, {
            tripId: alpha.tripId,
            startDayId: alpha.dayId,
            endDayId: alpha.lastDayId,
            name: 'Linked across trips',
            reservationId: otherBooking.id,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await captureError(() =>
          updateAccommodation(scope, alpha.accommodationId, {
            reservationId: otherBooking.id,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        (
          await dayAccommodationsRepository.findById(
            scope,
            alpha.accommodationId,
          )
        )?.reservationId,
      ).toBeNull()
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
      const viewer = alpha.tenant.scopeFor(viewerId)
      const editor = alpha.tenant.scopeFor(editorId)
      const stay = {
        tripId: alpha.tripId,
        startDayId: alpha.dayId,
        endDayId: alpha.lastDayId,
        name: 'A second guesthouse',
      }

      // `FORBIDDEN` is the code every caller maps to a 403, so it is the code asserted.
      const refusalCode = async (
        run: () => Promise<unknown>,
      ): Promise<string> => {
        const error = await captureError(run)
        return error instanceof RepositoryError ? error.code : error.name
      }
      for (const attempt of [
        () => createAccommodation(viewer, stay),
        () =>
          updateAccommodation(viewer, alpha.accommodationId, {
            name: 'Viewed',
          }),
        () => deleteAccommodation(viewer, alpha.accommodationId),
      ]) {
        expect(await refusalCode(attempt)).toBe('FORBIDDEN')
      }

      const written = await createAccommodation(editor, stay)
      expect(
        (
          await updateAccommodation(editor, written.id, {
            name: 'Renamed by the editor',
          })
        ).name,
      ).toBe('Renamed by the editor')
      await deleteAccommodation(editor, written.id)
      expect(
        await dayAccommodationsRepository.findById(editor, written.id),
      ).toBeNull()
    })
  })

  /** `01-S7` — the companion figure on every trip card, counted for a whole page at once. */
  describe('trip people counts', () => {
    it('counts only the caller’s trips, and gives a foreign id no entry rather than a zero', async () => {
      const counts = await countTripPeople(alpha.tenant.scope, [
        alpha.tripId,
        beta.tripId,
      ])

      const members = await listTripMembers(alpha.tenant.scope, alpha.tripId)
      const guests = await listTripGuests(alpha.tenant.scope, alpha.tripId)
      expect(guests.length).toBeGreaterThan(0)
      expect(counts.get(alpha.tripId)).toBe(members.length + guests.length)
      expect(counts.has(beta.tripId)).toBe(false)
      expect([...counts.keys()]).toEqual([alpha.tripId])
    })

    it('answers an empty map for the other tenant’s ids alone', async () => {
      const betaMembers = await listTripMembers(beta.tenant.scope, beta.tripId)
      const betaGuests = await listTripGuests(beta.tenant.scope, beta.tripId)

      expect(await countTripPeople(alpha.tenant.scope, [beta.tripId])).toEqual(
        new Map(),
      )

      // A read, and nothing of B's moved under it.
      expect(await listTripMembers(beta.tenant.scope, beta.tripId)).toEqual(
        betaMembers,
      )
      expect(await listTripGuests(beta.tenant.scope, beta.tripId)).toEqual(
        betaGuests,
      )
    })

    it('reads a whole page in two grouped statements, never one per card', async () => {
      const second = await createTrip(alpha.tenant.scope, {
        title: 'A second trip of A',
        currency: 'EUR',
      })
      harness.statements.length = 0

      const counts = await countTripPeople(alpha.tenant.scope, [
        alpha.tripId,
        second.id,
      ])

      expect(counts.get(second.id)).toBe(1)
      expect(harness.statements).toHaveLength(2)
      for (const statement of harness.statements) {
        expect(statement).toMatch(/group by/i)
      }
    })

    it('keeps every statement within D1’s bound-parameter limit for a full page of a hundred trips', async () => {
      const page = [
        alpha.tripId,
        ...Array.from({ length: 99 }, (_, index) => `missing-trip-${index}`),
      ]
      harness.statements.length = 0

      const counts = await countTripPeople(alpha.tenant.scope, page)

      expect(counts.get(alpha.tripId)).toBeGreaterThan(0)
      expect(counts.size).toBe(1)
      // Two chunks, a members and a guests statement each.
      expect(harness.statements).toHaveLength(4)
      for (const statement of harness.statements) {
        expect(statement.split('?').length - 1).toBeLessThanOrEqual(
          MAX_BOUND_PARAMETERS,
        )
      }
    })
  })

  /**
   * The changed-currency `UPDATE` embeds a priced-rows test, so a subquery that forgot the trip, or
   * the tenant, would let somebody else's prices decide whether this trip's currency may change -
   * in one direction a refusal that is not the caller's to receive, in the other a relabel that
   * should have been refused. One kind of price at a time on the other trips, so that a single
   * missing predicate cannot hide behind the kinds that are filtered correctly.
   */
  describe('a trip’s budget currency', () => {
    const CHANGE = { currency: 'JPY' } as const

    it('is not found, and unchanged, for another workspace’s trip', async () => {
      const before = await tripsRepository.findById(
        beta.tenant.scope,
        beta.tripId,
      )

      const failure = await captureError(() =>
        updateTrip(alpha.tenant.scope, beta.tripId, CHANGE),
      )

      expect(failure).toBeInstanceOf(NotFoundError)
      expect(
        await tripsRepository.findById(beta.tenant.scope, beta.tripId),
      ).toEqual(before)
    })

    it('is not found, and unchanged, for a private trip the caller is not on', async () => {
      const privateTrip = await createTrip(alpha.tenant.scope, {
        title: 'Private to A’s owner',
        currency: 'EUR',
      })
      const colleague = alpha.tenant.scopeFor(alpha.secondUserId)

      const failure = await captureError(() =>
        updateTrip(colleague, privateTrip.id, CHANGE),
      )

      expect(failure).toBeInstanceOf(NotFoundError)
      expect(
        (await requireTrip(alpha.tenant.scope, privateTrip.id)).currency,
      ).toBe('EUR')
    })

    it('is refused to an editor and to a viewer, who see the trip but do not own it', async () => {
      const trip = await createTrip(alpha.tenant.scope, {
        title: 'Shared with two',
        currency: 'EUR',
      })
      const viewerId = await alpha.tenant.addUser('Viewer')
      await addTripMember(alpha.tenant.scope, {
        tripId: trip.id,
        userId: alpha.secondUserId,
        role: 'editor',
      })
      await addTripMember(alpha.tenant.scope, {
        tripId: trip.id,
        userId: viewerId,
        role: 'viewer',
      })

      for (const userId of [alpha.secondUserId, viewerId]) {
        const failure = await captureError(() =>
          updateTrip(alpha.tenant.scopeFor(userId), trip.id, CHANGE),
        )
        expect(failure).toBeInstanceOf(TripRoleError)
      }
      expect((await requireTrip(alpha.tenant.scope, trip.id)).currency).toBe(
        'EUR',
      )
    })

    it.each(PRICED_KINDS.map((kind) => [kind.name, kind] as const))(
      'is not decided by %s on a sibling trip or on another workspace’s trip',
      async (_name, kind) => {
        const empty = await createTrip(alpha.tenant.scope, {
          title: 'Empty one',
          startDate: '2026-05-01',
          endDate: '2026-05-02',
          currency: 'EUR',
        })
        const sibling = await createTrip(alpha.tenant.scope, {
          title: 'Sibling with prices',
          startDate: '2026-05-01',
          endDate: '2026-05-02',
          currency: 'EUR',
        })
        const foreign = await createTrip(beta.tenant.scope, {
          title: 'Foreign with prices',
          startDate: '2026-05-01',
          endDate: '2026-05-02',
          currency: 'EUR',
        })
        await kind.seed(alpha.tenant.scope, sibling.id, alpha.secondUserId)
        await kind.seed(beta.tenant.scope, foreign.id, beta.secondUserId)
        const siblingBefore = await requireTrip(alpha.tenant.scope, sibling.id)
        const foreignBefore = await requireTrip(beta.tenant.scope, foreign.id)

        const saved = await updateTrip(alpha.tenant.scope, empty.id, CHANGE)

        expect(saved.currency).toBe('JPY')
        expect(await requireTrip(alpha.tenant.scope, sibling.id)).toEqual(
          siblingBefore,
        )
        expect(await requireTrip(beta.tenant.scope, foreign.id)).toEqual(
          foreignBefore,
        )
      },
    )
  })

  describe('one user who belongs to two workspaces', () => {
    // The workspace switcher moves a session between two organizations the same user belongs to.
    // Membership of both must not merge them: a scope is the (user, organization) pair, so it is
    // the organization half that every read is held to.
    let userId: string
    let inAlpha: TenantScope
    let inBeta: TenantScope

    beforeEach(async () => {
      userId = alpha.tenant.ownerUserId
      await beta.tenant.addMembership(userId, 'member')
      inAlpha = alpha.tenant.scopeFor(userId, 'owner')
      inBeta = beta.tenant.scopeFor(userId, 'member')
    })

    it('lists only the active workspace’s trips, from either side', async () => {
      // The repository handle rather than `listTrips`: the latter also filters by trip visibility,
      // which would hide the workspace's own trip from a plain member and prove nothing here.
      const idsIn = async (scope: TenantScope) =>
        (await tripsRepository.findMany(scope)).map((row) => row.id)

      expect(await idsIn(inAlpha)).toEqual([alpha.tripId])
      expect(await idsIn(inBeta)).toEqual([beta.tripId])
    })

    it('refuses the other workspace’s trip id as not found, in both directions', async () => {
      expect(await tripsRepository.findById(inAlpha, beta.tripId)).toBeNull()
      expect(await tripsRepository.findById(inBeta, alpha.tripId)).toBeNull()
      // The positive control: each id resolves from the workspace it belongs to.
      expect(
        await tripsRepository.findById(inAlpha, alpha.tripId),
      ).not.toBeNull()
      expect(await tripsRepository.findById(inBeta, beta.tripId)).not.toBeNull()

      expect(
        await captureError(() =>
          tripsRepository.requireById(inAlpha, beta.tripId),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await captureError(() =>
          tripsRepository.requireById(inBeta, alpha.tripId),
        ),
      ).toBeInstanceOf(NotFoundError)
    })

    it('keeps someone who left A but belongs to B off A’s new money (#1034)', async () => {
      // "Still in the workspace" is the caller's workspace, not any workspace: a `member` row in B
      // must not stand in for the one A lost.
      const leaverId = await alpha.tenant.addUser('Left alpha, still in beta')
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: leaverId,
        role: 'editor',
      })
      await beta.tenant.addMembership(leaverId)
      await harness.db
        .delete(member)
        .where(
          and(
            eq(member.organizationId, alpha.tenant.organizationId),
            eq(member.userId, leaverId),
          ),
        )

      expect(
        await captureError(() =>
          createExpense(alpha.tenant.scope, {
            tripId: alpha.tripId,
            title: 'Taxi',
            amountMinor: 1_000,
            spentOn: '2026-04-10',
            paidBy: leaverId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await captureError(() =>
          createSettlement(alpha.tenant.scope, {
            tripId: alpha.tripId,
            fromUserId: leaverId,
            toUserId: alpha.tenant.ownerUserId,
            amountMinor: 500,
            settledOn: '2026-04-10',
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
    })
  })
  describe('frozen rates', () => {
    // `findLatestFrozenRate` and `resolveRate` are the first workspace-wide money reads, so the
    // trip a rate was frozen on decides who may see it: another workspace's, and a private trip of
    // this one that the caller is not on, never answer (#835, and #839 which depends on it).
    const pair = { from: 'GBP', to: 'EUR', on: '2026-04-20' } as const

    async function freezeRate(world: World, tripId: string, rate: number) {
      await createExpense(world.tenant.scope, {
        tripId,
        title: 'Receipt in pounds',
        amountMinor: 11_500,
        currency: 'EUR',
        originalAmountMinor: 10_000,
        originalCurrency: 'GBP',
        exchangeRate: rate,
        spentOn: '2026-04-11',
      })
    }

    async function snapshot() {
      return {
        alphaExpenses: await expensesRepository.findMany(alpha.tenant.scope),
        betaExpenses: await expensesRepository.findMany(beta.tenant.scope),
        alphaSettlements: await settlementsRepository.findMany(
          alpha.tenant.scope,
        ),
        betaSettlements: await settlementsRepository.findMany(
          beta.tenant.scope,
        ),
      }
    }

    it('answers a trip of another workspace as not found, and reads no rate from it', async () => {
      await freezeRate(beta, beta.tripId, 1.3)
      const before = await snapshot()

      const refusal = await captureError(() =>
        findLatestFrozenRate(alpha.tenant.scope, {
          tripId: beta.tripId,
          from: 'GBP',
          to: 'EUR',
        }),
      )

      expect(refusal).toBeInstanceOf(NotFoundError)
      expect(await snapshot()).toEqual(before)
    })

    it('never answers with a rate frozen in another workspace', async () => {
      await freezeRate(beta, beta.tripId, 1.3)
      const before = await snapshot()

      expect(await resolveRate(alpha.tenant.scope, pair)).toBeNull()
      expect(
        await findLatestFrozenRate(alpha.tenant.scope, {
          tripId: alpha.tripId,
          from: 'GBP',
          to: 'EUR',
        }),
      ).toBeNull()
      // The positive control: the same rate answers in the workspace that froze it.
      expect((await resolveRate(beta.tenant.scope, pair))?.rate).toBe(1.3)
      expect(await snapshot()).toEqual(before)
    })

    it('never answers with a rate frozen on a private trip the caller is not on, and does with a workspace-visible one', async () => {
      const stranger = alpha.tenant.scopeFor(
        await alpha.tenant.addUser('A member who is on no trip'),
      )
      const priv = await createTrip(alpha.tenant.scope, {
        title: 'Owner only',
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        currency: 'EUR',
        visibility: 'private',
      })
      await freezeRate(alpha, priv.id, 1.4)
      const before = await snapshot()

      expect(await resolveRate(stranger, pair)).toBeNull()
      expect(
        await captureError(() =>
          findLatestFrozenRate(stranger, {
            tripId: priv.id,
            from: 'GBP',
            to: 'EUR',
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      // The owner reads their own private trip's rate.
      expect((await resolveRate(alpha.tenant.scope, pair))?.rate).toBe(1.4)

      await updateTrip(alpha.tenant.scope, priv.id, {
        visibility: 'organization',
      })
      expect(await resolveRate(stranger, pair)).toEqual({
        rate: 1.4,
        source: 'recent',
      })
      expect(
        (
          await findLatestFrozenRate(stranger, {
            tripId: priv.id,
            from: 'GBP',
            to: 'EUR',
          })
        )?.rate,
      ).toBe(1.4)

      // Reading changed nothing; only the visibility switch above did.
      const after = await snapshot()
      expect(after.alphaExpenses).toEqual(before.alphaExpenses)
      expect(after.betaExpenses).toEqual(before.betaExpenses)
      expect(after.alphaSettlements).toEqual(before.alphaSettlements)
      expect(after.betaSettlements).toEqual(before.betaSettlements)
    })

    it('offers a pre-fill from the trip’s own rate only, never from another workspace or another trip', async () => {
      const otherTrip = await createTrip(alpha.tenant.scope, {
        title: 'Alpha, another trip',
        startDate: '2026-09-01',
        endDate: '2026-09-03',
        currency: 'EUR',
      })
      await freezeRate(beta, beta.tripId, 1.3)
      await freezeRate(alpha, otherTrip.id, 1.5)
      const query = { from: ['GBP'], to: 'EUR' }

      expect(
        await suggestedRatesForTrip(alpha.tenant.scope, {
          tripId: alpha.tripId,
          ...query,
        }),
      ).toBeNull()
      expect(
        await captureError(() =>
          suggestedRatesForTrip(alpha.tenant.scope, {
            tripId: beta.tripId,
            ...query,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      await freezeRate(alpha, alpha.tripId, 1.15)
      expect(
        await suggestedRatesForTrip(alpha.tenant.scope, {
          tripId: alpha.tripId,
          ...query,
        }),
      ).toEqual({ GBP: { rate: 1.15, observedOn: '2026-04-11' } })
    })
  })
  /**
   * `04-S1` (#844): the reader's display currency is the one write the slice makes outside the money
   * tables. It is the caller's own row, resolved by organization and user inside the scope, so a
   * second workspace's row for the same person is unreachable rather than merely unlikely.
   */
  describe('a reader’s display currency', () => {
    async function rowOf(world: World, userId: string) {
      return getUserSettings(world.tenant.scope, userId)
    }

    it('written in one workspace leaves the same person’s row in the other byte-identical', async () => {
      const traveller = await alpha.tenant.addUser(
        'A traveller in two workspaces',
      )
      await beta.tenant.addMembership(traveller)
      const inAlpha = alpha.tenant.scopeFor(traveller)
      const inBeta = beta.tenant.scopeFor(traveller)

      await setDisplayCurrency(inBeta, 'USD')
      const betaBefore = await rowOf(beta, traveller)
      expect(betaBefore?.displayCurrency).toBe('USD')

      await setDisplayCurrency(inAlpha, 'GBP')

      expect(await rowOf(beta, traveller)).toEqual(betaBefore)
      // Each workspace reads back its own value, never the other's.
      expect(await getDisplayCurrency(inAlpha, traveller)).toBe('GBP')
      expect(await getDisplayCurrency(inBeta, traveller)).toBe('USD')

      await setDisplayCurrency(inAlpha, null)
      expect(await getDisplayCurrency(inAlpha, traveller)).toBeNull()
      expect(await rowOf(beta, traveller)).toEqual(betaBefore)
    })

    it('refuses someone who belongs to the other workspace only, and writes nothing', async () => {
      const betaOnly = await beta.tenant.addUser('Only in the other workspace')
      await setDisplayCurrency(beta.tenant.scopeFor(betaOnly), 'USD')
      const betaBefore = await rowOf(beta, betaOnly)

      const refusal = await captureError(() =>
        setDisplayCurrency(alpha.tenant.scopeFor(betaOnly), 'GBP'),
      )

      expect(refusal).toBeInstanceOf(NotFoundError)
      expect(await rowOf(alpha, betaOnly)).toBeNull()
      expect(await rowOf(beta, betaOnly)).toEqual(betaBefore)
    })

    it('lists no code from the other workspace’s frozen rates', async () => {
      // Beta froze EUR to GBP; Alpha's reader must not be offered GBP because of it.
      const betaTrip = await createTrip(beta.tenant.scope, {
        title: 'Beta in pounds',
        startDate: '2026-05-01',
        endDate: '2026-05-03',
        currency: 'GBP',
      })
      await createExpense(beta.tenant.scope, {
        tripId: betaTrip.id,
        title: 'Tickets',
        amountMinor: 8_500,
        currency: 'GBP',
        originalAmountMinor: 10_000,
        originalCurrency: 'EUR',
        exchangeRate: 0.85,
        spentOn: '2026-05-02',
      })

      expect(await listAnsweringCurrencies(beta.tenant.scope, 'EUR')).toEqual([
        'GBP',
      ])
      expect(await listAnsweringCurrencies(alpha.tenant.scope, 'EUR')).toEqual(
        [],
      )
    })
  })
  /**
   * The preview reads every money row of a trip and can name a rate from the whole workspace, so a
   * read that forgot the trip, the tenant or the visibility of the trip a rate was frozen on would
   * show somebody else's money. It also has to write nothing, in either workspace.
   */
  describe('previewing a change of a trip’s budget currency', () => {
    const PREVIEW = { to: 'JPY', rate: 160 } as const

    async function footprint() {
      const both = [alpha.tenant.scope, beta.tenant.scope]
      return {
        trips: await Promise.all(both.map((s) => tripsRepository.findMany(s))),
        expenses: await Promise.all(
          both.map((s) => expensesRepository.findMany(s)),
        ),
        shares: await Promise.all(
          both.map((s) => expenseSharesRepository.findMany(s)),
        ),
        settlements: await Promise.all(
          both.map((s) => settlementsRepository.findMany(s)),
        ),
        budgetItems: await Promise.all(
          both.map((s) => budgetItemsRepository.findMany(s)),
        ),
      }
    }

    /** A trip in `world` that already holds money, so a read that lost its trip filter has something to show. */
    async function richSibling(world: World) {
      const sibling = await createTrip(world.tenant.scope, {
        title: 'Sibling with money',
        startDate: '2026-05-01',
        endDate: '2026-05-02',
        currency: 'EUR',
      })
      await createExpense(world.tenant.scope, {
        tripId: sibling.id,
        title: 'Sibling dinner',
        amountMinor: 9900,
        spentOn: '2026-05-01',
      })
      await createBudgetItem(world.tenant.scope, {
        tripId: sibling.id,
        name: 'Sibling food',
        plannedAmountMinor: 12_300,
      })
      return sibling
    }

    async function freezeYenRate(world: World, rate: number, title: string) {
      const yen = await createTrip(world.tenant.scope, {
        title,
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        currency: 'JPY',
      })
      await createExpense(world.tenant.scope, {
        tripId: yen.id,
        title: 'Ramen paid in euros',
        amountMinor: 1600,
        currency: 'JPY',
        originalAmountMinor: 1000,
        originalCurrency: 'EUR',
        exchangeRate: rate,
        spentOn: '2026-06-01',
      })
      return yen
    }

    it('counts only the trip asked about, whatever a sibling trip or another workspace holds', async () => {
      await richSibling(alpha)
      await richSibling(beta)
      const own = (
        await expensesRepository.findMany(alpha.tenant.scope)
      ).filter((row) => row.tripId === alpha.tripId)
      const ownItems = (
        await budgetItemsRepository.findMany(alpha.tenant.scope)
      ).filter((row) => row.tripId === alpha.tripId)
      const before = await footprint()

      const preview = await previewCurrencyChange(
        alpha.tenant.scope,
        alpha.tripId,
        PREVIEW,
      )

      expect(preview.counts.expenses).toBe(own.length)
      expect(preview.counts.budgetItems).toBe(ownItems.length)
      expect(preview.counts.expenses).toBeGreaterThan(0)
      // Nothing was written, in A's other trip or anywhere in B.
      expect(await footprint()).toEqual(before)
    })

    it('is not found, and writes nothing, for another workspace’s trip', async () => {
      const before = await footprint()

      const failure = await captureError(() =>
        previewCurrencyChange(alpha.tenant.scope, beta.tripId, PREVIEW),
      )

      expect(failure).toBeInstanceOf(NotFoundError)
      expect(await footprint()).toEqual(before)
    })

    it('is not found, and writes nothing, for a private trip the caller is not on', async () => {
      const privateTrip = await createTrip(alpha.tenant.scope, {
        title: 'Private to A’s owner',
        currency: 'EUR',
        visibility: 'private',
      })
      const before = await footprint()

      const failure = await captureError(() =>
        previewCurrencyChange(
          alpha.tenant.scopeFor(alpha.secondUserId),
          privateTrip.id,
          PREVIEW,
        ),
      )

      expect(failure).toBeInstanceOf(NotFoundError)
      expect(await footprint()).toEqual(before)
    })

    it('is refused to an editor and a viewer, who see the trip but do not own it', async () => {
      const viewerId = await alpha.tenant.addUser('Viewer')
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: alpha.secondUserId,
        role: 'editor',
      })
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: viewerId,
        role: 'viewer',
      })
      const before = await footprint()

      for (const userId of [alpha.secondUserId, viewerId]) {
        const failure = await captureError(() =>
          previewCurrencyChange(
            alpha.tenant.scopeFor(userId),
            alpha.tripId,
            PREVIEW,
          ),
        )
        expect(failure).toBeInstanceOf(TripRoleError)
      }
      expect(await footprint()).toEqual(before)
    })

    it('is refused for an archived trip, and writes nothing', async () => {
      await archiveTrip(alpha.tenant.scope, alpha.tripId)
      const before = await footprint()

      const failure = await captureError(() =>
        previewCurrencyChange(alpha.tenant.scope, alpha.tripId, PREVIEW),
      )

      expect(failure).toBeInstanceOf(TripArchivedError)
      expect(await footprint()).toEqual(before)
    })

    it('never suggests a rate frozen in another workspace', async () => {
      await freezeYenRate(beta, 150, 'Beta’s Tokyo')
      const before = await footprint()

      const alphaPreview = await previewCurrencyChange(
        alpha.tenant.scope,
        alpha.tripId,
        { to: 'JPY' },
      )

      expect(alphaPreview.rate).toBeNull()
      expect(alphaPreview.refusal).toEqual({ kind: 'no-rate' })
      // The positive control: the workspace that froze it is offered it.
      const betaPreview = await previewCurrencyChange(
        beta.tenant.scope,
        beta.tripId,
        { to: 'JPY' },
      )
      expect(betaPreview.rate).toEqual({ value: 150, source: 'recent' })
      expect(await footprint()).toEqual(before)
    })

    it('never suggests a rate frozen on a private trip the caller cannot read, and does once it is shared', async () => {
      const secondScope = alpha.tenant.scopeFor(alpha.secondUserId)
      const theirs = await createTrip(secondScope, {
        title: 'The second traveller’s own trip',
        currency: 'EUR',
      })
      await createExpense(secondScope, {
        tripId: theirs.id,
        title: 'Dinner',
        amountMinor: 4200,
        spentOn: '2026-04-10',
      })
      const privateYen = await createTrip(alpha.tenant.scope, {
        title: 'Owner only',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
        currency: 'JPY',
        visibility: 'private',
      })
      await createExpense(alpha.tenant.scope, {
        tripId: privateYen.id,
        title: 'Ramen paid in euros',
        amountMinor: 1600,
        currency: 'JPY',
        originalAmountMinor: 1000,
        originalCurrency: 'EUR',
        exchangeRate: 155,
        spentOn: '2026-06-01',
      })

      const hidden = await previewCurrencyChange(secondScope, theirs.id, {
        to: 'JPY',
      })
      expect(hidden.rate).toBeNull()
      expect(hidden.refusal).toEqual({ kind: 'no-rate' })

      await updateTrip(alpha.tenant.scope, privateYen.id, {
        visibility: 'organization',
      })
      const shared = await previewCurrencyChange(secondScope, theirs.id, {
        to: 'JPY',
      })
      expect(shared.rate).toEqual({ value: 155, source: 'recent' })
    })
  })
  /**
   * The commit rewrites every money row of a trip in one batch and decides, in SQL, whether anything
   * moved since it read them. A rewrite that forgot the trip would convert a sibling's ledger, one
   * that forgot the workspace would convert somebody else's, and a staleness test that forgot either
   * would refuse because of money that is not the trip's - or miss money that is.
   */
  describe('committing a change of a trip’s budget currency', () => {
    const COMMIT = { to: 'JPY', rate: 160 } as const

    /** The columns every table the commit pins has in common. */
    interface PricedRow {
      readonly tripId: string
      readonly priceMinor: number | null
      readonly currency: string | null
    }

    /** Every money row of both workspaces, so "untouched" is a comparison of the whole of it. */
    async function money() {
      const both = [alpha.tenant.scope, beta.tenant.scope]
      return {
        trips: await Promise.all(both.map((s) => tripsRepository.findMany(s))),
        expenses: await Promise.all(
          both.map((s) => expensesRepository.findMany(s)),
        ),
        shares: await Promise.all(
          both.map((s) => expenseSharesRepository.findMany(s)),
        ),
        settlements: await Promise.all(
          both.map((s) => settlementsRepository.findMany(s)),
        ),
        budgetItems: await Promise.all(
          both.map((s) => budgetItemsRepository.findMany(s)),
        ),
        // The four tables the commit pins with set-based `UPDATE`s, read whole across both workspaces.
        places: await harness.db.select().from(places),
        reservations: await harness.db.select().from(reservations),
        transports: await harness.db.select().from(transports),
        stays: await harness.db.select().from(dayAccommodations),
      }
    }

    /** Every price a trip can hold, left without a currency: the shape the pin statements exist for. */
    async function priceEverything(world: World, tripId: string) {
      for (const kind of PRICED_KINDS) {
        if (kind.name !== 'a trip copy still in progress') {
          await kind.seed(world.tenant.scope, tripId, world.companionUserId)
        }
      }
    }

    /** A second trip in `world`, in euros and holding money, next to the one being converted. */
    async function sibling(world: World) {
      const trip = await createTrip(world.tenant.scope, {
        title: 'Sibling with money',
        startDate: '2026-05-01',
        endDate: '2026-05-02',
        currency: 'EUR',
      })
      await createExpense(world.tenant.scope, {
        tripId: trip.id,
        title: 'Sibling dinner',
        amountMinor: 9900,
        spentOn: '2026-05-01',
        paidBy: world.tenant.ownerUserId,
        participants: [{ userId: world.tenant.ownerUserId }],
      })
      await createBudgetItem(world.tenant.scope, {
        tripId: trip.id,
        name: 'Sibling food',
        plannedAmountMinor: 12_300,
      })
      await priceEverything(world, trip.id)
      await tripsRepository.requireUpdate(world.tenant.scope, trip.id, {
        budgetTargetMinor: 50_000,
      })
      return trip
    }

    it('converts the trip asked about and leaves its sibling and the other workspace exactly as they were', async () => {
      const alphaSibling = await sibling(alpha)
      await sibling(beta)
      await priceEverything(alpha, alpha.tripId)
      await priceEverything(beta, beta.tripId)
      const before = await money()

      await changeTripCurrency(alpha.tenant.scope, alpha.tripId, COMMIT)

      const after = await money()
      const own = <T extends { tripId: string }>(rows: ReadonlyArray<T>) =>
        rows.filter((row) => row.tripId === alpha.tripId)
      const others = <T extends { tripId: string }>(rows: ReadonlyArray<T>) =>
        rows.filter((row) => row.tripId !== alpha.tripId)
      // The other workspace: not one row moved.
      expect(after.expenses[1]).toEqual(before.expenses[1])
      expect(after.shares[1]).toEqual(before.shares[1])
      expect(after.settlements[1]).toEqual(before.settlements[1])
      expect(after.budgetItems[1]).toEqual(before.budgetItems[1])
      expect(after.trips[1]).toEqual(before.trips[1])
      // Priced places, bookings, transports and stays are written by set-based `UPDATE`s: the other
      // workspace's and the sibling trip's rows are untouched, the trip's own are pinned.
      const checkPins = (
        beforeRows: ReadonlyArray<PricedRow>,
        afterRows: ReadonlyArray<PricedRow>,
      ) => {
        const unpinned = (row: PricedRow) =>
          row.priceMinor !== null && row.currency === null
        expect(others(beforeRows).some(unpinned)).toBe(true)
        expect(others(afterRows)).toEqual(others(beforeRows))
        const priced = own(afterRows).filter((row) => row.priceMinor !== null)
        expect(priced.length).toBeGreaterThan(0)
        expect(priced.some(unpinned)).toBe(false)
      }
      checkPins(before.places, after.places)
      checkPins(before.reservations, after.reservations)
      checkPins(before.transports, after.transports)
      checkPins(before.stays, after.stays)
      // The sibling trip of the same workspace, in euros still.
      expect(others(after.expenses[0] ?? [])).toEqual(
        others(before.expenses[0] ?? []),
      )
      expect(others(after.budgetItems[0] ?? [])).toEqual(
        others(before.budgetItems[0] ?? []),
      )
      expect(others(after.shares[0] ?? [])).toEqual(
        others(before.shares[0] ?? []),
      )
      expect(others(after.settlements[0] ?? [])).toEqual(
        others(before.settlements[0] ?? []),
      )
      expect(
        after.trips[0]?.find((trip) => trip.id === alphaSibling.id)
          ?.budgetTargetMinor,
      ).toBe(50_000)
      expect(
        after.trips[0]?.find((trip) => trip.id === alphaSibling.id)?.currency,
      ).toBe('EUR')
      // The positive control: the trip asked about did move, and every one of its rows with it.
      expect(
        after.trips[0]?.find((trip) => trip.id === alpha.tripId)?.currency,
      ).toBe('JPY')
      expect(own(after.expenses[0] ?? []).length).toBeGreaterThan(0)
      for (const row of [
        ...own(after.expenses[0] ?? []),
        ...own(after.settlements[0] ?? []),
        ...own(after.budgetItems[0] ?? []),
      ]) {
        expect(row.currency).toBe('JPY')
      }
    })

    it('is not found, and writes nothing, for another workspace’s trip', async () => {
      const before = await money()

      const failure = await captureError(() =>
        changeTripCurrency(alpha.tenant.scope, beta.tripId, COMMIT),
      )

      expect(failure).toBeInstanceOf(NotFoundError)
      expect(await money()).toEqual(before)
    })

    it('is not found, and writes nothing, for a private trip the caller is not on', async () => {
      const privateTrip = await createTrip(alpha.tenant.scope, {
        title: 'Private to A’s owner',
        currency: 'EUR',
        visibility: 'private',
      })
      const before = await money()

      const failure = await captureError(() =>
        changeTripCurrency(
          alpha.tenant.scopeFor(alpha.secondUserId),
          privateTrip.id,
          COMMIT,
        ),
      )

      expect(failure).toBeInstanceOf(NotFoundError)
      expect(await money()).toEqual(before)
    })

    it('is refused to an editor and a viewer, and writes nothing', async () => {
      const viewerId = await alpha.tenant.addUser('Viewer')
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: alpha.secondUserId,
        role: 'editor',
      })
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: viewerId,
        role: 'viewer',
      })
      const before = await money()

      for (const userId of [alpha.secondUserId, viewerId]) {
        const failure = await captureError(() =>
          changeTripCurrency(
            alpha.tenant.scopeFor(userId),
            alpha.tripId,
            COMMIT,
          ),
        )
        expect(failure).toBeInstanceOf(TripRoleError)
      }
      expect(await money()).toEqual(before)
    })

    it('is refused for an archived trip, and writes nothing', async () => {
      await archiveTrip(alpha.tenant.scope, alpha.tripId)
      const before = await money()

      const failure = await captureError(() =>
        changeTripCurrency(alpha.tenant.scope, alpha.tripId, COMMIT),
      )

      expect(failure).toBeInstanceOf(TripArchivedError)
      expect(await money()).toEqual(before)
    })

    it('does not let the other workspace’s conversion decide a stale tab’s write here', async () => {
      await changeTripCurrency(beta.tenant.scope, beta.tripId, COMMIT)

      const { expense } = await createExpense(alpha.tenant.scope, {
        tripId: alpha.tripId,
        title: 'Written under the belief the trip is in euros',
        amountMinor: 500,
        spentOn: '2026-04-11',
        expectedTripCurrency: 'EUR',
      })

      expect(expense.currency).toBe('EUR')
    })

    describe('a stale tab’s write names no other workspace’s trip or row', () => {
      it.each([
        [
          'an expense logged on its trip',
          () =>
            createExpense(alpha.tenant.scope, {
              tripId: beta.tripId,
              title: 'Probe',
              amountMinor: 100,
              spentOn: '2026-04-11',
              expectedTripCurrency: 'XXX',
            }),
        ],
        [
          'an expense edited on its trip',
          () =>
            updateExpense(alpha.tenant.scope, beta.tripId, beta.expenseId, {
              amountMinor: 100,
              expectedTripCurrency: 'XXX',
            }),
        ],
        [
          'an expense of its trip edited through its own',
          () =>
            updateExpense(alpha.tenant.scope, alpha.tripId, beta.expenseId, {
              amountMinor: 100,
              expectedTripCurrency: 'EUR',
            }),
        ],
        [
          'a payment recorded on its trip',
          () =>
            createSettlement(alpha.tenant.scope, {
              tripId: beta.tripId,
              fromUserId: alpha.tenant.ownerUserId,
              toUserId: alpha.companionUserId,
              amountMinor: 100,
              settledOn: '2026-04-11',
              expectedTripCurrency: 'XXX',
            }),
        ],
        [
          'a planned item created on its trip',
          () =>
            createBudgetItem(alpha.tenant.scope, {
              tripId: beta.tripId,
              name: 'Probe',
              expectedTripCurrency: 'XXX',
            }),
        ],
        [
          'a planned item edited on its trip',
          () =>
            updateBudgetItem(
              alpha.tenant.scope,
              beta.tripId,
              beta.budgetItemId,
              { name: 'Probe', expectedTripCurrency: 'XXX' },
            ),
        ],
      ])(
        'answers %s as not found, never as a currency refusal that would confirm the trip exists',
        async (_name, attempt) => {
          const before = await money()

          const failure = await captureError(attempt)

          expect(failure).toBeInstanceOf(NotFoundError)
          expect(failure).not.toBeInstanceOf(CurrencyRefusalError)
          expect(await money()).toEqual(before)
        },
      )
    })
  })

  describe('collaboration section configuration', () => {
    it('hides a foreign trip and leaves its stored configuration and timestamps byte-identical', async () => {
      const readForeignTrip = () =>
        harness.sqlite.prepare('SELECT * FROM trips WHERE id = ?').get(beta.tripId)
      const before = readForeignTrip()
      await expect(
        setTripCollabSections(alpha.tenant.scope, beta.tripId, {
          section: 'polls',
          on: false,
        }),
      ).rejects.toBeInstanceOf(NotFoundError)
      expect(readForeignTrip()).toEqual(before)
    })
  })

  describe('older conversation pages', () => {
    it('scopes foreign and arbitrary cursors, message ids and reactions without changing B', async () => {
      const scope = alpha.tenant.scope
      await postMessage(scope, { tripId: alpha.tripId, body: 'another A message' })
      const before = await collabRows(beta.tenant.scope)
      expect((await listMessages(scope, beta.tripId)).items).toEqual([])
      await expect(
        collabMessagesRepository.requireById(scope, beta.messageId),
      ).rejects.toBeInstanceOf(NotFoundError)
      for (const cursor of [beta.messageId, '~']) {
        const page = await listMessages(scope, alpha.tripId, { cursor })
        for (const message of page.items) {
          expect(message.organizationId).toBe(scope.ctx.organizationId)
          expect(message.tripId).toBe(alpha.tripId)
          expect(message.id).not.toBe(beta.messageId)
        }
      }
      expect(await listReactions(scope, [beta.messageId])).toEqual(new Map())
      expect(await collabRows(beta.tenant.scope)).toEqual(before)
    })
  })

  describe('the conversation count', () => {
    it('counts the whole non-deleted thread of one trip, inside the tenant', async () => {
      const scope = alpha.tenant.scope
      const own = await countMessages(scope, alpha.tripId)
      const kept = await postMessage(scope, { tripId: alpha.tripId, body: 'kept' })
      const gone = await postMessage(scope, { tripId: alpha.tripId, body: 'gone' })
      await deleteMessage(scope, alpha.tripId, gone.id)

      expect(kept.id).not.toBe(gone.id)
      expect(await countMessages(scope, alpha.tripId)).toBe(own + 1)
      expect(await countMessages(scope, beta.tripId)).toBe(0)
      expect(await countMessages(beta.tenant.scope, beta.tripId)).toBe(1)
    })
  })

  describe('the collaboration writers', () => {
    const rowsOf = (world: World): CollabRowIds => ({
      messageId: world.messageId,
      noteId: world.collabNoteId,
      pollId: world.pollId,
    })

    it('refuse another workspace’s rows, paired with either workspace’s trip, and change nothing', async () => {
      const scope = alpha.tenant.scope
      const beforeBeta = await collabRows(beta.tenant.scope)
      const beforeAlpha = await collabRows(scope)

      for (const tripId of [alpha.tripId, beta.tripId]) {
        for (const [label, write] of rowWriters(scope, tripId, rowsOf(beta))) {
          expect(
            await captureError(write),
            `${label} on ${tripId}`,
          ).toBeInstanceOf(NotFoundError)
        }
      }

      expect(await collabRows(beta.tenant.scope)).toEqual(beforeBeta)
      expect(await collabRows(scope)).toEqual(beforeAlpha)
    })

    it('refuse a row of another trip of the same workspace, in either direction', async () => {
      const scope = alpha.tenant.scope
      const second = await createTrip(scope, {
        title: 'Faro, another time',
        slug: 'faro-another-time',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      })
      const secondRows = await seedCollabRows(scope, second.id)
      const before = await collabRows(scope)

      for (const [label, write] of rowWriters(
        scope,
        alpha.tripId,
        secondRows,
      )) {
        expect(
          await captureError(write),
          `${label}, second row on first trip`,
        ).toBeInstanceOf(NotFoundError)
      }
      for (const [label, write] of rowWriters(
        scope,
        second.id,
        rowsOf(alpha),
      )) {
        expect(
          await captureError(write),
          `${label}, first row on second trip`,
        ).toBeInstanceOf(NotFoundError)
      }
      expect(await collabRows(scope)).toEqual(before)
    })

    it('refuse to create a row on another workspace’s trip', async () => {
      const before = await collabRows(beta.tenant.scope)

      for (const [label, write] of creatingWriters(
        alpha.tenant.scope,
        beta.tripId,
      )) {
        expect(await captureError(write), label).toBeInstanceOf(NotFoundError)
      }
      expect(await collabRows(beta.tenant.scope)).toEqual(before)
    })
  })

  describe('template writes', () => {
    // `createTemplate` writes its rows with raw inserts in one batch, so the tenant column is
    // stamped by the function itself and not by the base repository. A read through the writer's own
    // scope would hide a row with the wrong stamp, so the rows are counted straight off the tables.
    function organizationsOf(table: string, where: string, id: string) {
      const statement = harness.sqlite.prepare(
        `select organization_id as organizationId, count(*) as n from ${table} where ${where} = ? group by organization_id`,
      )
      return (
        statement.all(id) as Array<{
          organizationId: string
          n: number | bigint
        }>
      ).map((row) => [row.organizationId, Number(row.n)] as const)
    }

    it('stamps the template and every chunk of its items with the writer’s workspace', async () => {
      const untouched = await packingTemplatesRepository.requireById(
        beta.tenant.scope,
        beta.templateId,
      )
      const names = Array.from(
        { length: 30 },
        (_, index) => `Island item ${index}`,
      )

      const saved = await createTemplate(alpha.tenant.scope, {
        name: 'Island hop',
        items: names.map((name) => ({ name })),
      })

      expect(saved.organizationId).toBe(alpha.tenant.organizationId)
      expect(organizationsOf('packing_templates', 'id', saved.id)).toEqual([
        [alpha.tenant.organizationId, 1],
      ])
      expect(
        organizationsOf('packing_template_items', 'template_id', saved.id),
      ).toEqual([[alpha.tenant.organizationId, 30]])

      expect(
        await packingTemplatesRepository.findById(beta.tenant.scope, saved.id),
      ).toBeNull()
      expect(await listTemplateItems(beta.tenant.scope, saved.id)).toEqual([])
      expect(
        (await listTemplates(beta.tenant.scope)).map((template) => template.id),
      ).not.toContain(saved.id)
      expect(
        (await listTemplateItems(alpha.tenant.scope, saved.id)).map(
          (item) => item.name,
        ),
      ).toEqual(names)

      expect(
        await packingTemplatesRepository.requireById(
          beta.tenant.scope,
          beta.templateId,
        ),
      ).toEqual(untouched)
    })
  })

  /**
   * The read side of a trip export, driven through `listTripExports` and `downloadTripExport`.
   *
   * The pure storage functions take the organization id as a parameter, so testing them alone proves
   * nothing about tenancy. These are the functions a server function calls once it has the scope, and
   * the bucket is one fake that holds a real object of each workspace.
   */
  describe('trip exports: the request, list and download', () => {
    const month = '2027-02'
    it('refuses a foreign trip before moving the caller’s counter', async () => {
      await expect(
        reserveExport(alpha.tenant.scope, beta.tripId, { month }),
      ).rejects.toBeInstanceOf(NotFoundError)
      expect((await exportAllowance(alpha.tenant.scope, { month })).used).toBe(
        0,
      )
    })
    it('counts only A when B has spent its month', async () => {
      await setUsage(beta.tenant.scope, {
        metric: 'exports',
        period: month,
        value: 3,
      })
      await reserveExport(alpha.tenant.scope, alpha.tripId, { month })
      expect((await exportAllowance(alpha.tenant.scope, { month })).used).toBe(
        1,
      )
      expect((await exportAllowance(beta.tenant.scope, { month })).used).toBe(3)
    })
    it('refuses a private-trip non-member and a viewer before counting', async () => {
      await updateTrip(alpha.tenant.scope, alpha.tripId, {
        visibility: 'private',
      })
      const userId = await alpha.tenant.addUser('Export viewer')
      const scope = alpha.tenant.scopeFor(userId)
      await expect(
        reserveExport(scope, alpha.tripId, { month }),
      ).rejects.toBeInstanceOf(NotFoundError)
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId,
        role: 'viewer',
      })
      await expect(
        reserveExport(scope, alpha.tripId, { month }),
      ).rejects.toBeInstanceOf(TripRoleError)
      expect((await exportAllowance(alpha.tenant.scope, { month })).used).toBe(
        0,
      )
    })
    const NOW = Date.parse('2026-10-15T12:00:00.000Z')
    const taskA = 'task-of-alpha'
    const taskB = 'task-of-beta'

    function exportKey(world: World, taskId: string, tripId = world.tripId) {
      return exportObjectKey(
        world.tenant.organizationId,
        tripId,
        taskId,
        'html',
      )
    }

    function seededBucket() {
      return fakeBucket({
        [exportKey(alpha, taskA)]: {
          body: '<p>alpha</p>',
          uploaded: new Date(NOW - 60_000),
        },
        [exportKey(beta, taskB)]: {
          body: '<p>beta</p>',
          uploaded: new Date(NOW - 60_000),
        },
      })
    }

    /** Every byte under a workspace's export prefix, so "untouched" means identical. */
    function prefixOf(bucket: FakeBucket, world: World) {
      const prefix = `exports/${world.tenant.organizationId}/`
      return [...bucket.objects.entries()].filter(([key]) =>
        key.startsWith(prefix),
      )
    }

    it('does not find another workspace’s trip, for the list or the download', async () => {
      const bucket = seededBucket()

      for (const attempt of [
        () =>
          listTripExports(
            alpha.tenant.scope,
            bucket,
            { tripId: beta.tripId },
            NOW,
          ),
        () =>
          downloadTripExport(
            alpha.tenant.scope,
            bucket,
            { tripId: beta.tripId, taskId: taskB },
            NOW,
          ),
      ]) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }
      expect(bucket.listCalls).toEqual([])
    })

    it('answers a real object of workspace B, asked for through A’s own trip, as the one 404', async () => {
      const bucket = seededBucket()
      const before = prefixOf(bucket, beta)

      const response = await downloadTripExport(
        alpha.tenant.scope,
        bucket,
        { tripId: alpha.tripId, taskId: taskB },
        NOW,
      )

      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ error: 'missing' })
      expect(prefixOf(bucket, beta)).toEqual(before)
      expect(bucket.calls).toEqual([])
    })

    it('lists only A’s own exports and leaves B’s prefix byte-identical', async () => {
      const bucket = seededBucket()
      const before = prefixOf(bucket, beta)

      const listed = await listTripExports(
        alpha.tenant.scope,
        bucket,
        { tripId: alpha.tripId },
        NOW,
      )

      expect(listed.artifacts.map((artifact) => artifact.taskId)).toEqual([
        taskA,
      ])
      expect(prefixOf(bucket, beta)).toEqual(before)
      expect(bucket.calls).toEqual([])
    })

    it('leaves out a trip whose id begins with the same characters', async () => {
      const bucket = seededBucket()
      bucket.objects.set(
        exportKey(alpha, 'task-lookalike', `${alpha.tripId}2`),
        {
          body: '<p>another trip</p>',
          uploaded: new Date(NOW - 60_000),
        },
      )

      const listed = await listTripExports(
        alpha.tenant.scope,
        bucket,
        { tripId: alpha.tripId },
        NOW,
      )

      expect(listed.artifacts.map((artifact) => artifact.taskId)).toEqual([
        taskA,
      ])
      const response = await downloadTripExport(
        alpha.tenant.scope,
        bucket,
        { tripId: alpha.tripId, taskId: 'task-lookalike' },
        NOW,
      )
      expect(response.status).toBe(404)
    })

    it('does not find a private trip for a workspace member who is not on it', async () => {
      await updateTrip(alpha.tenant.scope, alpha.tripId, {
        visibility: 'private',
      })
      const stranger = alpha.tenant.scopeFor(
        await alpha.tenant.addUser('Export stranger'),
      )
      const bucket = seededBucket()

      for (const attempt of [
        () => listTripExports(stranger, bucket, { tripId: alpha.tripId }, NOW),
        () =>
          downloadTripExport(
            stranger,
            bucket,
            { tripId: alpha.tripId, taskId: taskA },
            NOW,
          ),
      ]) {
        expect(await captureError(attempt)).toBeInstanceOf(NotFoundError)
      }
      expect(bucket.listCalls).toEqual([])
    })

    it('lets a viewer list and download, and says they cannot request', async () => {
      const viewerId = await alpha.tenant.addUser('Export viewer')
      await addTripMember(alpha.tenant.scope, {
        tripId: alpha.tripId,
        userId: viewerId,
        role: 'viewer',
      })
      const viewer = alpha.tenant.scopeFor(viewerId)
      const bucket = seededBucket()

      const listed = await listTripExports(
        viewer,
        bucket,
        { tripId: alpha.tripId },
        NOW,
      )
      const response = await downloadTripExport(
        viewer,
        bucket,
        { tripId: alpha.tripId, taskId: taskA },
        NOW,
      )

      expect(listed.canRequest).toBe(false)
      expect(listed.artifacts).toHaveLength(1)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('<p>alpha</p>')
    })
  })

  describe('the leave planner allowance', () => {
    const planRows = async (world: World) => ({
      plans: await vacayPlansRepository.findMany(world.tenant.scope),
      years: await vacayYearsRepository.findMany(world.tenant.scope),
      userYears: await vacayUserYearsRepository.findMany(world.tenant.scope),
    })

    it('rejects every guarded call aimed at another workspace’s plan and leaves its rows byte-identical', async () => {
      const scope = alpha.tenant.scope
      const before = await planRows(beta)

      for (const call of [
        () =>
          saveAllowance(scope, {
            planId: beta.planId,
            year: 2026,
            entitlementDays: 1,
          }),
        () => updatePlan(scope, beta.planId, { carryOverEnabled: false }),
        () =>
          updatePlanSettings(scope, beta.planId, {
            carryOverEnabled: false,
            defaultEntitlementDays: 1,
          }),
        () => updatePlanSettings(scope, beta.planId, {}),
        () => ensureYear(scope, beta.planId, 2031),
        () => getAllowance(scope, beta.planId, alpha.tenant.ownerUserId, 2026),
        () => requirePlanActor(scope, beta.planId),
        () => requirePlanOwner(scope, beta.planId),
      ]) {
        expect(await captureError(call)).toBeInstanceOf(NotFoundError)
      }

      expect(await planRows(beta)).toEqual(before)
    })

    it('rejects a carry-over recompute aimed at another workspace’s plan and changes none of its rows', async () => {
      const owner = beta.tenant.ownerUserId
      await setEntitlement(beta.tenant.scope, {
        planId: beta.planId,
        year: 2025,
        entitlementDays: 20,
      })
      await setEntitlement(beta.tenant.scope, {
        planId: beta.planId,
        year: 2026,
        entitlementDays: 20,
        carriedOverDays: 99,
      })
      const before = await planRows(beta)

      expect(
        await captureError(() =>
          recomputeCarryOver(alpha.tenant.scope, beta.planId, owner),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(await planRows(beta)).toEqual(before)
    })

    it('answers the overview in the other workspace’s scope as not found, and the year listing as empty', async () => {
      expect(
        await captureError(() =>
          getPlanOverview(beta.tenant.scope, alpha.planId, 2026),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await listUserYears(beta.tenant.scope, alpha.planId, 2026),
      ).toEqual([])
    })

    it('writes nothing for a user id that belongs to the other workspace, on the caller’s own plan', async () => {
      const before = await vacayUserYearsRepository.count(beta.tenant.scope)

      expect(
        await captureError(() =>
          saveAllowance(alpha.tenant.scope, {
            planId: alpha.planId,
            userId: beta.tenant.ownerUserId,
            year: 2026,
            entitlementDays: 1,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)

      expect(await vacayUserYearsRepository.count(beta.tenant.scope)).toBe(
        before,
      )
      expect(await vacayUserYearsRepository.count(alpha.tenant.scope)).toBe(1)
    })

    it('does not let a user who belongs to both workspaces reach one workspace’s plan from the other’s scope', async () => {
      const shared = await alpha.tenant.addUser('Both workspaces')
      await beta.tenant.addMembership(shared)
      const inBeta = beta.tenant.scopeFor(shared)

      expect(
        await captureError(() => requirePlanActor(inBeta, alpha.planId)),
      ).toBeInstanceOf(NotFoundError)
    })
  })

  describe('the calendar read model', () => {
    const rowsOf = (source: Awaited<ReturnType<typeof readFeedSource>>) => [
      source.trips,
      source.days,
      source.places,
      source.stops,
      source.dayNotes,
      source.stays,
      source.transports,
      source.legs,
      source.reservations,
    ]

    it('returns nothing of another workspace’s trip, asked for by its id', async () => {
      const source = await readFeedSource(alpha.tenant.scope, {
        kind: 'trips',
        tripIds: [beta.tripId],
      })

      for (const rows of rowsOf(source)) {
        expect(rows).toEqual([])
      }
    })

    it('returns only the caller’s rows when both workspaces’ trips are asked for', async () => {
      const source = await readFeedSource(alpha.tenant.scope, {
        kind: 'trips',
        tripIds: [alpha.tripId, beta.tripId],
      })

      expect(source.trips.map((row) => row.id)).toEqual([alpha.tripId])
      expect(source.days.length).toBeGreaterThan(0)
      expect(source.places.map((row) => row.id)).toEqual([alpha.placeId])
      expect(source.stops.map((row) => row.id)).toEqual([alpha.assignmentId])
      expect(source.dayNotes.map((row) => row.id)).toEqual([alpha.dayNoteId])
      expect(source.stays.map((row) => row.id)).toEqual([alpha.accommodationId])
      expect(source.transports.map((row) => row.id)).toEqual([
        alpha.transportId,
      ])
      expect(source.reservations.map((row) => row.id)).toEqual([
        alpha.reservationId,
      ])
      const contentRows = [
        ...source.days,
        ...source.places,
        ...source.stops,
        ...source.dayNotes,
        ...source.stays,
        ...source.transports,
        ...source.legs,
        ...source.reservations,
      ]
      for (const row of contentRows) {
        expect(row.tripId).toBe(alpha.tripId)
      }
    })
  })

  describe('changing a member role (#995)', () => {
    it('does not find another workspace’s member, and leaves its role as it was', async () => {
      const before = await membersRepository.requireById(
        beta.tenant.scope,
        beta.memberId,
      )

      for (const role of ['member', 'admin', 'owner'] as const) {
        expect(
          await captureError(() =>
            changeMemberRole(alpha.tenant.scope, beta.memberId, role),
          ),
        ).toBeInstanceOf(NotFoundError)
      }

      const after = await membersRepository.requireById(
        beta.tenant.scope,
        beta.memberId,
      )
      expect(after.role).toBe(before.role)
    })
  })
})

describe('visited region records across workspaces', () => {
  it('scopes writes, reads, row removals and the ceiling to the target workspace', async () => {
    const db = await createHarness()
    try {
      const a = await db.seedTenant('regions-a')
      const b = await db.seedTenant('regions-b')
      const {
        listVisitedRegions,
        recordRegionVisit,
        regionCodeFor,
        unmarkRegionVisited,
      } = await import('../atlas')
      const bCountry = await markCountryVisited(b.scope, { countryCode: 'DE' })
      const bRow = await markRegionVisited(b.scope, {
        countryCode: 'DE',
        regionCode: 'DE-BY',
        regionName: 'Bavaria',
      })
      const aCode = await regionCodeFor('DE', 'Bavaria')
      expect(aCode).toBe(await regionCodeFor('DE', ' BÁVARIA '))
      expect(aCode).not.toBe(await regionCodeFor('FR', 'Bavaria'))
      const written = await recordRegionVisit(a.scope, {
        countryCode: 'DE',
        regionCode: aCode,
        regionName: 'Bavaria',
      })
      expect(written.created).toBe(true)
      expect(
        (
          await recordRegionVisit(a.scope, {
            countryCode: 'DE',
            regionCode: aCode,
            regionName: 'Bavaria',
          })
        ).created,
      ).toBe(false)
      expect(await listVisitedRegions(b.scope, a.ownerUserId)).toEqual([])
      await expect(
        visitedRegionsRepository.requireById(b.scope, written.row.id),
      ).rejects.toBeInstanceOf(NotFoundError)
      await expect(
        unmarkRegionVisited(a.scope, bRow.id),
      ).rejects.toBeInstanceOf(NotFoundError)
      expect(
        (await visitedCountriesRepository.requireById(b.scope, bCountry.id))
          .visitCount,
      ).toBe(1)
      expect(
        await visitedRegionsRepository.requireById(b.scope, bRow.id),
      ).toMatchObject({ regionName: 'Bavaria' })
      for (let i = 1; i < 1000; i += 1) {
        await visitedRegionsRepository.insert(b.scope, {
          userId: b.ownerUserId,
          countryCode: 'DE',
          regionCode: `DE-${i}`,
          regionName: `Region ${i}`,
        })
      }
      await expect(
        markRegionVisited(b.scope, {
          countryCode: 'FR',
          regionCode: 'FR-new',
          regionName: 'New',
        }),
      ).rejects.toMatchObject({
        metric: 'visited_regions_per_traveller',
        limit: 1000,
        current: 1000,
      })
      await markRegionVisited(a.scope, {
        countryCode: 'FR',
        regionCode: 'FR-new',
        regionName: 'New',
      })
      expect(await listVisitedRegions(a.scope, a.ownerUserId)).toHaveLength(2)
      expect(await listVisitedRegions(b.scope, b.ownerUserId)).toHaveLength(
        1000,
      )
    } finally {
      db.close()
    }
  })
})
