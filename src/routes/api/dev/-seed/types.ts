/**
 * The shape of the demo dataset.
 *
 * Everything under `-seed/dataset` is plain data described by these types: no database handle, no
 * repository import, no generated identifier. `-seed/apply.ts` is the only module that turns it into
 * rows, which keeps the copy reviewable on its own and lets the applier stay a single generic pass
 * over every trip rather than five bespoke ones.
 *
 * Cross-references between entities are by `key` — a stable, human-readable local name — never by a
 * generated id, because ids only exist once the applier has written the parent row.
 */

import type {
  EXPENSE_CATEGORIES,
  FILE_KINDS,
  ITEM_PRIORITIES,
  JOURNEY_ENTRY_TYPES,
  LIST_KINDS,
  NOTIFICATION_SCOPES,
  NOTIFICATION_TYPES,
  OpeningHours,
  RESERVATION_STATUSES,
  RESERVATION_TYPES,
  SETTLEMENT_METHODS,
  SPLIT_METHODS,
  TRANSPORT_MODES,
  TRANSPORT_STATUSES,
  TRIP_STATUSES,
  TRIP_VISIBILITIES,
  VACAY_ENTRY_KINDS,
} from '#/server/db/schema'

/** The four demo travellers, referenced by key everywhere in the dataset. */
export const PERSON_KEYS = ['rafal', 'mika', 'jonas', 'priya'] as const

export type PersonKey = (typeof PERSON_KEYS)[number]

export type TransportMode = (typeof TRANSPORT_MODES)[number]
export type TransportStatus = (typeof TRANSPORT_STATUSES)[number]
export type ReservationType = (typeof RESERVATION_TYPES)[number]
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export type SplitMethod = (typeof SPLIT_METHODS)[number]
export type SettlementMethod = (typeof SETTLEMENT_METHODS)[number]
export type ListKind = (typeof LIST_KINDS)[number]
export type ItemPriority = (typeof ITEM_PRIORITIES)[number]
export type FileKind = (typeof FILE_KINDS)[number]
export type JourneyEntryType = (typeof JOURNEY_ENTRY_TYPES)[number]
export type VacayEntryKind = (typeof VACAY_ENTRY_KINDS)[number]
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]
export type NotificationScope = (typeof NOTIFICATION_SCOPES)[number]
export type TripStatus = (typeof TRIP_STATUSES)[number]
export type TripVisibility = (typeof TRIP_VISIBILITIES)[number]

/**
 * A demo collaborator. `rafal` is the existing account and is never created here; the other three
 * are added to the workspace so splits, assignments, votes and chat have real people in them.
 */
export interface SeedPerson {
  readonly key: PersonKey
  readonly name: string
  readonly email: string
  readonly role: 'owner' | 'admin' | 'member'
  /** Colour the traveller is drawn in on trip member chips and the vacay grid. */
  readonly colour: string
}

export interface SeedCategory {
  readonly name: string
  readonly slug: string
  readonly icon: string
  readonly colour: string
  readonly sortOrder: number
}

export interface SeedPlace {
  readonly key: string
  readonly name: string
  /** Slug of a category created by {@link SeedCategory} or by `ensureDefaultCategories`. */
  readonly categorySlug: string
  readonly description?: string
  readonly notes?: string
  readonly lat: number
  readonly lng: number
  readonly address: string
  readonly city: string
  readonly countryCode: string
  readonly website?: string
  readonly phone?: string
  readonly openingHours?: OpeningHours
  readonly rating?: number
  readonly durationMinutes: number
  readonly transportMode: TransportMode
  readonly priceMinor?: number
  readonly currency?: string
  readonly tags?: ReadonlyArray<string>
  readonly isVisited?: boolean
}

/** A day of the itinerary. `dayNumber` is 1-based and must exist in the trip's date range. */
export interface SeedDay {
  readonly dayNumber: number
  readonly title: string
  readonly notes: string
  /** Timed reminders pinned to the day, rendered above its stops. */
  readonly pins?: ReadonlyArray<{
    readonly body: string
    readonly time?: string
    readonly icon?: string
  }>
}

/** A place placed on a day — one row of the planner. */
export interface SeedStop {
  readonly dayNumber: number
  readonly placeKey: string
  readonly startTime?: string
  readonly endTime?: string
  readonly durationMinutes?: number
  readonly transportMode?: TransportMode
  readonly notes?: string
  readonly reservationStatus?: ReservationStatus
  readonly participants?: ReadonlyArray<PersonKey>
}

export interface SeedAccommodation {
  readonly key: string
  readonly startDay: number
  readonly endDay: number
  readonly placeKey?: string
  readonly name: string
  readonly address: string
  readonly checkInTime?: string
  readonly checkInEndTime?: string
  readonly checkOutTime?: string
  readonly confirmationNumber: string
  readonly priceMinor: number
  readonly currency: string
  readonly notes?: string
}

export interface SeedTransport {
  readonly key: string
  readonly mode: TransportMode
  readonly status: TransportStatus
  readonly title: string
  readonly carrier?: string
  readonly serviceNumber?: string
  readonly bookingCode?: string
  readonly seat?: string
  readonly dayNumber?: number
  readonly departureName: string
  readonly departureCode?: string
  readonly departureLat: number
  readonly departureLng: number
  readonly departureDate: string
  readonly departureTime: string
  readonly departureTimezone: string
  readonly arrivalName: string
  readonly arrivalCode?: string
  readonly arrivalLat: number
  readonly arrivalLng: number
  readonly arrivalDate: string
  readonly arrivalTime: string
  readonly arrivalTimezone: string
  readonly distanceMetres: number
  readonly priceMinor: number
  readonly currency: string
  readonly notes?: string
}

export interface SeedReservation {
  readonly key: string
  readonly type: ReservationType
  readonly status: ReservationStatus
  readonly title: string
  readonly provider?: string
  readonly location?: string
  readonly url?: string
  readonly confirmationNumber?: string
  readonly startDay?: number
  readonly endDay?: number
  readonly startTime?: string
  readonly endTime?: string
  readonly guests?: number
  readonly priceMinor?: number
  readonly currency?: string
  readonly notes?: string
  readonly placeKey?: string
  readonly transportKey?: string
}

export interface SeedBudgetItem {
  readonly key: string
  readonly category: ExpenseCategory
  readonly name: string
  readonly plannedAmountMinor: number
  readonly currency: string
  readonly persons?: number
  readonly days?: number
  readonly note?: string
}

export interface SeedSplit {
  readonly person: PersonKey
  readonly weight?: number
  readonly shareMinor?: number
  readonly percentage?: number
}

export interface SeedExpense {
  readonly key: string
  readonly title: string
  readonly category: ExpenseCategory
  /** Amount in the trip's currency, in minor units. */
  readonly amountMinor: number
  readonly currency: string
  readonly originalAmountMinor?: number
  readonly originalCurrency?: string
  readonly exchangeRate?: number
  readonly spentOn: string
  readonly dayNumber?: number
  readonly placeKey?: string
  readonly budgetItemKey?: string
  /** `null` models a receipt nobody has claimed yet — the "outstanding" tile on the costs screen. */
  readonly paidBy: PersonKey | null
  readonly splitMethod: SplitMethod
  readonly participants: ReadonlyArray<SeedSplit>
  readonly notes?: string
}

export interface SeedSettlement {
  readonly from: PersonKey
  readonly to: PersonKey
  readonly amountMinor: number
  readonly currency: string
  readonly method: SettlementMethod
  readonly settledOn: string
  readonly note: string
}

export interface SeedListItem {
  readonly name: string
  readonly category: string
  readonly description?: string
  readonly quantity?: number
  readonly weightGrams?: number
  readonly isDone?: boolean
  readonly assignedTo?: PersonKey
  readonly dueDate?: string
  readonly priority?: ItemPriority
}

export interface SeedList {
  readonly key: string
  readonly name: string
  readonly kind: ListKind
  readonly colour: string
  readonly icon: string
  readonly owner?: PersonKey
  readonly weightLimitGrams?: number
  readonly items: ReadonlyArray<SeedListItem>
}

export interface SeedMessage {
  readonly key: string
  readonly author: PersonKey
  readonly body: string
  readonly replyTo?: string
  /** Minutes before the seed runs, so a re-seed still reads as a recent conversation. */
  readonly minutesAgo: number
  readonly reactions?: ReadonlyArray<{ readonly person: PersonKey; readonly emoji: string }>
}

export interface SeedNote {
  readonly key: string
  readonly author: PersonKey
  readonly title: string
  readonly category: string
  readonly body: string
  readonly colour: string
  readonly isPinned?: boolean
  readonly sortOrder: number
}

export interface SeedPoll {
  readonly key: string
  readonly author: PersonKey
  readonly question: string
  readonly options: ReadonlyArray<{ readonly id: string; readonly label: string }>
  readonly allowMultiple?: boolean
  /** One entry per voter; the option must exist in `options`. */
  readonly votes: ReadonlyArray<{ readonly person: PersonKey; readonly optionId: string }>
}

export interface SeedFile {
  readonly storageKey: string
  readonly filename: string
  readonly contentType: string
  readonly sizeBytes: number
  readonly kind: FileKind
  readonly description: string
  readonly uploadedBy: PersonKey
  readonly width?: number
  readonly height?: number
  readonly placeKey?: string
  readonly reservationKey?: string
  readonly transportKey?: string
  readonly expenseKey?: string
}

/** One trip and everything hanging off it. Only `title`, `slug` and `status` are required. */
export interface SeedTrip {
  readonly slug: string
  readonly title: string
  readonly summary: string
  readonly description?: string
  readonly destination: string
  readonly countryCodes: ReadonlyArray<string>
  readonly startDate?: string
  readonly endDate?: string
  readonly timezone?: string
  readonly currency: string
  readonly status: TripStatus
  readonly visibility: TripVisibility
  readonly accentColour: string
  readonly budgetTargetMinor?: number
  readonly reminderDays?: number
  readonly isFavourite?: boolean
  readonly isArchived?: boolean
  readonly travellers: ReadonlyArray<{
    readonly person: PersonKey
    readonly role: 'owner' | 'editor' | 'viewer'
  }>
  readonly days?: ReadonlyArray<SeedDay>
  readonly places?: ReadonlyArray<SeedPlace>
  readonly stops?: ReadonlyArray<SeedStop>
  readonly accommodations?: ReadonlyArray<SeedAccommodation>
  readonly transports?: ReadonlyArray<SeedTransport>
  readonly reservations?: ReadonlyArray<SeedReservation>
  readonly budgetItems?: ReadonlyArray<SeedBudgetItem>
  readonly expenses?: ReadonlyArray<SeedExpense>
  readonly settlements?: ReadonlyArray<SeedSettlement>
  readonly lists?: ReadonlyArray<SeedList>
  readonly messages?: ReadonlyArray<SeedMessage>
  readonly notes?: ReadonlyArray<SeedNote>
  readonly polls?: ReadonlyArray<SeedPoll>
  readonly files?: ReadonlyArray<SeedFile>
}

/* -------------------------------------------------------------------------------------------------
 * Workspace-level data — everything that is not scoped to one trip
 * ---------------------------------------------------------------------------------------------- */

export interface SeedVisitedCountry {
  readonly countryCode: string
  readonly continent: string
  /** One date per visit; the earliest and latest become `first`/`lastVisitedOn`. */
  readonly visits: ReadonlyArray<string>
  readonly note?: string
}

export interface SeedVisitedRegion {
  readonly countryCode: string
  readonly regionCode: string
  readonly regionName: string
  readonly visitedOn: string
}

export interface SeedBucketListItem {
  readonly kind: 'country' | 'region' | 'place'
  readonly name: string
  readonly countryCode?: string
  readonly lat?: number
  readonly lng?: number
  readonly note: string
  readonly targetYear?: number
  readonly achievedOn?: string
  readonly sortOrder: number
}

export interface SeedJourneyEntry {
  readonly type: JourneyEntryType
  readonly moodKey: string
  readonly title: string
  readonly body: string
  readonly entryDate: string
  readonly entryTime: string
  readonly locationName: string
  readonly lat: number
  readonly lng: number
  readonly weather: string
  readonly temperatureCelsius: number
  readonly tags: ReadonlyArray<string>
  readonly sortOrder: number
  readonly photos?: ReadonlyArray<{
    readonly storageKey: string
    readonly thumbnailKey: string
    readonly caption: string
    readonly contentType: string
    readonly sizeBytes: number
    readonly width: number
    readonly height: number
  }>
}

export interface SeedJourney {
  readonly slug: string
  readonly title: string
  readonly subtitle: string
  readonly description: string
  readonly coverGradient: string
  readonly tripSlug?: string
  readonly startedOn: string
  readonly endedOn: string
  readonly entries: ReadonlyArray<SeedJourneyEntry>
}

export interface SeedCollectionPlace {
  readonly name: string
  readonly categorySlug: string
  readonly description: string
  readonly notes?: string
  readonly lat: number
  readonly lng: number
  readonly address: string
  readonly city: string
  readonly countryCode: string
  readonly website?: string
  readonly status: 'idea' | 'shortlisted' | 'planned' | 'visited' | 'rejected'
  readonly labels: ReadonlyArray<string>
  readonly sortOrder: number
}

export interface SeedCollection {
  readonly slug: string
  readonly name: string
  readonly description: string
  readonly colour: string
  readonly icon: string
  readonly visibility: 'private' | 'organization' | 'public'
  readonly labels: ReadonlyArray<{ readonly name: string; readonly colour: string }>
  readonly places: ReadonlyArray<SeedCollectionPlace>
}

export interface SeedVacayEntry {
  readonly person: PersonKey
  readonly from: string
  readonly to: string
  readonly kind: VacayEntryKind
  readonly note: string
}

export interface SeedVacay {
  readonly name: string
  readonly defaultEntitlementDays: number
  readonly years: ReadonlyArray<number>
  readonly entitlements: ReadonlyArray<{
    readonly person: PersonKey
    readonly year: number
    readonly entitlementDays: number
    readonly carriedOverDays: number
  }>
  readonly calendars: ReadonlyArray<{
    readonly region: string
    readonly label: string
    readonly colour: string
    readonly sortOrder: number
  }>
  readonly companyHolidays: ReadonlyArray<{ readonly date: string; readonly label: string }>
  readonly entries: ReadonlyArray<SeedVacayEntry>
}

export interface SeedNotification {
  readonly key: string
  readonly sender: PersonKey
  readonly type: NotificationType
  readonly scope: NotificationScope
  readonly titleKey: string
  readonly titleParams: Record<string, string | number>
  readonly bodyKey: string
  readonly bodyParams: Record<string, string | number>
  readonly actionUrl?: string
  readonly entityType?: string
  /** Trip slug the notification points at; resolved to the trip id by the applier. */
  readonly entityTripSlug?: string
  readonly minutesAgo: number
  readonly isRead: boolean
}

export interface SeedAuditEntry {
  readonly action: string
  readonly entityType: string
  readonly entityTripSlug?: string
  readonly metadata: Record<string, string | number | boolean>
  readonly minutesAgo: number
}

export interface SeedTravelStats {
  readonly statYear: number
  readonly distanceMetres: number
  readonly yearStreak: number
}
