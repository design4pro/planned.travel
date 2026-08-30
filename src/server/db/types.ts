/**
 * Shared database-layer types.
 *
 * The repositories are written against {@link Database}, a driver-agnostic Drizzle handle. In the
 * Worker it is backed by D1; in tests it is backed by an in-memory SQLite database through the
 * Drizzle proxy driver. Nothing below this module knows which one it is talking to.
 */

import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core'
import type * as schema from './schema'
import type {
  METERED_PROVIDERS,
  ORGANIZATION_PLANS,
  PLANNED_PROVIDERS,
  PLATFORM_ACTOR_KINDS,
  PLATFORM_ACTOR_ROLES,
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_ENTITY_TYPES,
  PROVIDER_LIMIT_POLICIES,
  PROVIDER_LIMIT_WINDOWS,
  PROVIDER_USAGE_GRAINS,
  USAGE_METRICS,
} from './schema'

/** Any async SQLite-dialect Drizzle handle. Satisfied by both D1 and the proxy driver. */
export type Database = BaseSQLiteDatabase<'async', unknown>

export type OrganizationPlan = (typeof ORGANIZATION_PLANS)[number]
export type UsageMetric = (typeof USAGE_METRICS)[number]

/** Sentinel used by {@link PLAN_QUOTAS} for metrics a plan does not cap. */
export const UNLIMITED = Number.POSITIVE_INFINITY

/**
 * The three metrics the plan catalogue in `src/lib/plans.ts` sells and therefore owns.
 * They are deliberately absent from {@link PLAN_QUOTAS}: a tier number for a metric the
 * catalogue also names is how the billing screen and the repositories came to disagree,
 * so the type makes restating one impossible.
 */
export const CATALOGUE_METRICS = ['members', 'trips', 'storage_bytes'] as const
export type CatalogueMetric = (typeof CATALOGUE_METRICS)[number]

/** The operational metrics only the coarse tier column models. */
export type TierMetric = Exclude<UsageMetric, CatalogueMetric>

/**
 * Quota ceilings per tier, in the unit of the metric (`storage_bytes` in bytes, everything else a
 * row count). These are the *defaults* for the metrics the catalogue does not sell; the effective
 * ceiling for a tenant always comes from `resolveLimits()` in `src/server/billing/limits.ts`, which
 * layers the catalogue and the row's own ceilings on top and is what `assertQuota()` enforces —
 * per `docs/SPEC.md` §5 and `docs/ARCHITECTURE.md` §6.
 */
export const PLAN_QUOTAS: Record<
  OrganizationPlan,
  Record<TierMetric, number>
> = {
  free: {
    places: 150,
    files: 50,
    exports: 3,
    collections: 2,
    journeys: 1,
  },
  starter: {
    places: 1_500,
    files: 500,
    exports: 25,
    collections: 10,
    journeys: 10,
  },
  pro: {
    places: 20_000,
    files: 5_000,
    exports: 250,
    collections: 100,
    journeys: 100,
  },
  business: {
    places: UNLIMITED,
    files: UNLIMITED,
    exports: UNLIMITED,
    collections: UNLIMITED,
    journeys: UNLIMITED,
  },
}

/* -------------------------------------------------------------------------------------------------
 * Row and insert models. `New*` types are the raw table insert shapes; the repositories expose
 * narrower, Zod-validated inputs on top of them.
 * ---------------------------------------------------------------------------------------------- */

/**
 * The tenancy tables (`organization`, `member`, `invitation`) are owned by the auth module because
 * Better Auth's organization plugin writes them directly. Their row types are surfaced here so the
 * repositories have a single import site for the whole relational model.
 */
export type {
  OrganizationRow as Organization,
  MemberRow as Member,
  InvitationRow as Invitation,
  OrganizationRole,
  InvitationStatus,
} from './auth-schema'

export type Subscription = typeof schema.subscriptions.$inferSelect
export type NewSubscription = typeof schema.subscriptions.$inferInsert
export type UsageRecord = typeof schema.usageRecords.$inferSelect
export type NewUsageRecord = typeof schema.usageRecords.$inferInsert

export type Trip = typeof schema.trips.$inferSelect
export type NewTrip = typeof schema.trips.$inferInsert
export type TripMember = typeof schema.tripMembers.$inferSelect
export type NewTripMember = typeof schema.tripMembers.$inferInsert
export type Day = typeof schema.days.$inferSelect
export type NewDay = typeof schema.days.$inferInsert

export type Category = typeof schema.categories.$inferSelect
export type NewCategory = typeof schema.categories.$inferInsert
export type Tag = typeof schema.tags.$inferSelect
export type NewTag = typeof schema.tags.$inferInsert

export type Place = typeof schema.places.$inferSelect
export type NewPlace = typeof schema.places.$inferInsert
export type PlaceTag = typeof schema.placeTags.$inferSelect
export type NewPlaceTag = typeof schema.placeTags.$inferInsert
export type DayAssignment = typeof schema.dayAssignments.$inferSelect
export type NewDayAssignment = typeof schema.dayAssignments.$inferInsert
export type AssignmentParticipant =
  typeof schema.assignmentParticipants.$inferSelect
export type NewAssignmentParticipant =
  typeof schema.assignmentParticipants.$inferInsert
export type DayNote = typeof schema.dayNotes.$inferSelect
export type NewDayNote = typeof schema.dayNotes.$inferInsert
export type DayAccommodation = typeof schema.dayAccommodations.$inferSelect
export type NewDayAccommodation = typeof schema.dayAccommodations.$inferInsert

export type Transport = typeof schema.transports.$inferSelect
export type NewTransport = typeof schema.transports.$inferInsert
export type TransportLeg = typeof schema.transportLegs.$inferSelect
export type NewTransportLeg = typeof schema.transportLegs.$inferInsert
export type Reservation = typeof schema.reservations.$inferSelect
export type NewReservation = typeof schema.reservations.$inferInsert

export type BudgetItem = typeof schema.budgetItems.$inferSelect
export type NewBudgetItem = typeof schema.budgetItems.$inferInsert
export type TripCostCategory = typeof schema.tripCostCategories.$inferSelect
export type NewTripCostCategory = typeof schema.tripCostCategories.$inferInsert
export type Expense = typeof schema.expenses.$inferSelect
export type NewExpense = typeof schema.expenses.$inferInsert
export type ExpenseShare = typeof schema.expenseShares.$inferSelect
export type NewExpenseShare = typeof schema.expenseShares.$inferInsert
export type Settlement = typeof schema.settlements.$inferSelect
export type NewSettlement = typeof schema.settlements.$inferInsert

export type PackingList = typeof schema.packingLists.$inferSelect
export type NewPackingList = typeof schema.packingLists.$inferInsert
export type PackingItem = typeof schema.packingItems.$inferSelect
export type NewPackingItem = typeof schema.packingItems.$inferInsert
export type PackingTemplate = typeof schema.packingTemplates.$inferSelect
export type NewPackingTemplate = typeof schema.packingTemplates.$inferInsert
export type PackingTemplateItem =
  typeof schema.packingTemplateItems.$inferSelect
export type NewPackingTemplateItem =
  typeof schema.packingTemplateItems.$inferInsert

export type TripFile = typeof schema.tripFiles.$inferSelect
export type NewTripFile = typeof schema.tripFiles.$inferInsert
export type ShareLink = typeof schema.shareLinks.$inferSelect
export type NewShareLink = typeof schema.shareLinks.$inferInsert

export type CollabMessage = typeof schema.collabMessages.$inferSelect
export type NewCollabMessage = typeof schema.collabMessages.$inferInsert
export type CollabMessageReaction =
  typeof schema.collabMessageReactions.$inferSelect
export type NewCollabMessageReaction =
  typeof schema.collabMessageReactions.$inferInsert
export type CollabNote = typeof schema.collabNotes.$inferSelect
export type NewCollabNote = typeof schema.collabNotes.$inferInsert
export type CollabPoll = typeof schema.collabPolls.$inferSelect
export type NewCollabPoll = typeof schema.collabPolls.$inferInsert
export type CollabPollVote = typeof schema.collabPollVotes.$inferSelect
export type NewCollabPollVote = typeof schema.collabPollVotes.$inferInsert
export type CheckIn = typeof schema.checkIns.$inferSelect
export type NewCheckIn = typeof schema.checkIns.$inferInsert

export type Collection = typeof schema.collections.$inferSelect
export type NewCollection = typeof schema.collections.$inferInsert
export type CollectionPlace = typeof schema.collectionPlaces.$inferSelect
export type NewCollectionPlace = typeof schema.collectionPlaces.$inferInsert
export type CollectionLabel = typeof schema.collectionLabels.$inferSelect
export type NewCollectionLabel = typeof schema.collectionLabels.$inferInsert
export type CollectionPlaceLabel =
  typeof schema.collectionPlaceLabels.$inferSelect
export type NewCollectionPlaceLabel =
  typeof schema.collectionPlaceLabels.$inferInsert

export type Journey = typeof schema.journeys.$inferSelect
export type NewJourney = typeof schema.journeys.$inferInsert
export type JourneyEntry = typeof schema.journeyEntries.$inferSelect
export type NewJourneyEntry = typeof schema.journeyEntries.$inferInsert
export type JourneyPhoto = typeof schema.journeyPhotos.$inferSelect
export type NewJourneyPhoto = typeof schema.journeyPhotos.$inferInsert
export type JourneyMood = typeof schema.journeyMoods.$inferSelect
export type NewJourneyMood = typeof schema.journeyMoods.$inferInsert

export type VisitedCountry = typeof schema.visitedCountries.$inferSelect
export type NewVisitedCountry = typeof schema.visitedCountries.$inferInsert
export type VisitedRegion = typeof schema.visitedRegions.$inferSelect
export type NewVisitedRegion = typeof schema.visitedRegions.$inferInsert
export type TravelStat = typeof schema.travelStats.$inferSelect
export type NewTravelStat = typeof schema.travelStats.$inferInsert
export type BucketListItem = typeof schema.bucketListItems.$inferSelect
export type NewBucketListItem = typeof schema.bucketListItems.$inferInsert

export type VacayPlan = typeof schema.vacayPlans.$inferSelect
export type NewVacayPlan = typeof schema.vacayPlans.$inferInsert
export type VacayPlanMember = typeof schema.vacayPlanMembers.$inferSelect
export type NewVacayPlanMember = typeof schema.vacayPlanMembers.$inferInsert
export type VacayYear = typeof schema.vacayYears.$inferSelect
export type NewVacayYear = typeof schema.vacayYears.$inferInsert
export type VacayUserYear = typeof schema.vacayUserYears.$inferSelect
export type NewVacayUserYear = typeof schema.vacayUserYears.$inferInsert
export type VacayEntry = typeof schema.vacayEntries.$inferSelect
export type NewVacayEntry = typeof schema.vacayEntries.$inferInsert
export type VacayCompanyHoliday =
  typeof schema.vacayCompanyHolidays.$inferSelect
export type NewVacayCompanyHoliday =
  typeof schema.vacayCompanyHolidays.$inferInsert
export type VacayHolidayCalendar =
  typeof schema.vacayHolidayCalendars.$inferSelect
export type NewVacayHolidayCalendar =
  typeof schema.vacayHolidayCalendars.$inferInsert
export type VacayUserColour = typeof schema.vacayUserColours.$inferSelect
export type NewVacayUserColour = typeof schema.vacayUserColours.$inferInsert

export type Notification = typeof schema.notifications.$inferSelect
export type NewNotification = typeof schema.notifications.$inferInsert
export type NotificationPreference =
  typeof schema.notificationPreferences.$inferSelect
export type NewNotificationPreference =
  typeof schema.notificationPreferences.$inferInsert
export type AuditLogEntry = typeof schema.auditLog.$inferSelect
export type NewAuditLogEntry = typeof schema.auditLog.$inferInsert
export type OrganizationSettings =
  typeof schema.organizationSettings.$inferSelect
export type NewOrganizationSettings =
  typeof schema.organizationSettings.$inferInsert
export type UserSettings = typeof schema.userSettings.$inferSelect
export type NewUserSettings = typeof schema.userSettings.$inferInsert
export type AppSetting = typeof schema.appSettings.$inferSelect
export type NewAppSetting = typeof schema.appSettings.$inferInsert

/**
 * The two global platform tables of `docs/SPEC.md` §5's carve-out. They carry no
 * `organization_id` and are never reached through a tenant repository; their row types live here
 * beside every other table so the model has one import site.
 */
export type StaffApiToken = typeof schema.staffApiTokens.$inferSelect
export type NewStaffApiToken = typeof schema.staffApiTokens.$inferInsert
export type PlatformAuditLogEntry = typeof schema.platformAuditLog.$inferSelect
export type NewPlatformAuditLogEntry =
  typeof schema.platformAuditLog.$inferInsert

export type { PlatformAuditChanges } from './schema'

export type ProviderRegistryRow = typeof schema.providerRegistry.$inferSelect
export type NewProviderRegistryRow = typeof schema.providerRegistry.$inferInsert
export type ProviderUsageRow = typeof schema.providerUsage.$inferSelect
export type NewProviderUsageRow = typeof schema.providerUsage.$inferInsert

export type Airport = typeof schema.airports.$inferSelect
export type NewAirport = typeof schema.airports.$inferInsert

/**
 * The provider-metering vocabularies. {@link MeteredProvider} is the narrow one — a slug a call
 * site in this repository can name — and is what `provider_usage.provider` is `$type`d to;
 * {@link PlannedProvider} names a provider the console lists with no client behind it, so that a
 * screen can tell an unintegrated provider apart from one that simply made no calls.
 */
export type MeteredProvider = (typeof METERED_PROVIDERS)[number]
export type PlannedProvider = (typeof PLANNED_PROVIDERS)[number]
export type ProviderUsageGrain = (typeof PROVIDER_USAGE_GRAINS)[number]
export type ProviderLimitPolicy = (typeof PROVIDER_LIMIT_POLICIES)[number]
export type ProviderLimitWindow = (typeof PROVIDER_LIMIT_WINDOWS)[number]

/**
 * The four closed vocabularies `platform_audit_log` stores, and the four the columns are narrowed
 * to with `$type` (docs/ACCESS.md §4.1, §4.2). Two of them — {@link PlatformAuditEntityType} and
 * {@link PlatformAuditAction} — have no SQL `CHECK` behind them on purpose, so these types are the
 * whole of what stops a value nobody declared reaching an append-only table.
 */
export type PlatformActorKind = (typeof PLATFORM_ACTOR_KINDS)[number]
export type PlatformActorRole = (typeof PLATFORM_ACTOR_ROLES)[number]
export type PlatformAuditEntityType =
  (typeof PLATFORM_AUDIT_ENTITY_TYPES)[number]
export type PlatformAuditAction = (typeof PLATFORM_AUDIT_ACTIONS)[number]
