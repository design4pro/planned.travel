/**
 * planned.travel — relational model for Cloudflare D1 (SQLite).
 *
 * Conventions applied to every table in this file:
 *
 * - Primary keys are `text` and time-sortable (`newId()`), never autoincrement integers.
 * - Timestamps are epoch-millisecond integers exposed as `Date` (`created_at` / `updated_at`
 *   on every table that is mutated).
 * - Calendar dates are `text` in `YYYY-MM-DD`, wall-clock times are `text` in `HH:MM`, and
 *   instants are epoch-millisecond integers. Never mix the three.
 * - Money is stored in **minor units** as an integer plus an ISO-4217 `currency` code. There
 *   are no floating point amounts anywhere in the model.
 * - Every column that behaves like an enum carries a SQL `CHECK` constraint generated from the
 *   exported value tuple, so the database rejects unknown values even if application code is
 *   bypassed.
 * - Every foreign key, and every column we filter or sort by, has an index.
 * - Every tenant-owned table carries `organization_id` with an index, and the tenant column is
 *   always the leading column of the table's composite indexes so lookups stay sargable.
 *
 * `user.id` is owned by the auth module (`src/server/db/auth-schema.ts`). Columns that point at
 * a user use {@link userRef}, which is a text column without a Drizzle-declared foreign key so
 * that this file never has to import from the auth module's schema.
 */

import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { nanoid } from 'nanoid'
import { organization } from './auth-schema'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

/* -------------------------------------------------------------------------------------------------
 * Identifiers, shared column builders and constraint helpers
 * ---------------------------------------------------------------------------------------------- */

const ID_RANDOM_LENGTH = 16
const ID_TIME_LENGTH = 9

/**
 * Time-sortable, URL-safe, 25 character identifier: a base-36 millisecond timestamp followed by
 * 16 random characters. Sorting by `id` is therefore sorting by creation time, which lets every
 * paginated list use the primary key as a stable cursor.
 */
export function newId(): string {
  return `${Date.now().toString(36).padStart(ID_TIME_LENGTH, '0')}${nanoid(ID_RANDOM_LENGTH)}`
}

const pk = () => text('id').primaryKey().$defaultFn(newId)

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())

const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())

const timestamps = () => ({ createdAt: createdAt(), updatedAt: updatedAt() })

/** Tenant discriminator. Present on every domain table, cascading on organization deletion. */
const orgRef = () =>
  text('organization_id')
    .notNull()
    .references(() => organization.id, { onDelete: 'cascade' })

/**
 * Reference to `user.id` in the auth module's schema. Declared without a Drizzle foreign key so
 * the domain schema stays independent of the auth schema file; user rows are only ever removed
 * through the account-deletion flow, which fans out through the repositories.
 */
const userRef = (name: string) => text(name)

/** ISO-4217 alphabetic currency code. */
const currency = (name = 'currency') => text(name, { length: 3 })

/** Amount in the minor unit of the paired currency (cents, yen, fils, …). */
const minor = (name: string) => integer(name)

/** Fractional sort key so reordering a list never has to rewrite its siblings. */
const sortOrder = () => real('sort_order').notNull().default(0)

const colour = (name: string) => text(name, { length: 9 })

/**
 * Builds a `CHECK` constraint restricting a column to a fixed value tuple. `NULL` is always
 * accepted: nullability is expressed by `notNull()` on the column itself, not by the check.
 */
function enumCheck(name: string, column: AnySQLiteColumn, values: readonly string[]) {
  const list = values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', ')
  return check(name, sql.raw(`("${column.name}" IS NULL OR "${column.name}" IN (${list}))`))
}

/** Builds a `CHECK` constraint asserting a numeric column is not negative. */
function nonNegativeCheck(name: string, column: AnySQLiteColumn) {
  return check(name, sql.raw(`("${column.name}" IS NULL OR "${column.name}" >= 0)`))
}

/** Builds a `CHECK` constraint asserting a coordinate pair stays inside valid WGS-84 bounds. */
function latLngChecks(name: string, lat: AnySQLiteColumn, lng: AnySQLiteColumn) {
  return [
    check(name, sql.raw(`("${lat.name}" IS NULL OR ("${lat.name}" BETWEEN -90 AND 90))`)),
    check(
      `${name}_lng`,
      sql.raw(`("${lng.name}" IS NULL OR ("${lng.name}" BETWEEN -180 AND 180))`),
    ),
  ]
}

const geo = () => ({ lat: real('lat'), lng: real('lng') })

/* -------------------------------------------------------------------------------------------------
 * Enumerated value tuples — shared by the schema checks, the repositories and the Zod inputs
 * ---------------------------------------------------------------------------------------------- */

export const ORGANIZATION_PLANS = ['free', 'starter', 'pro', 'business'] as const
export const SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'unpaid',
  'paused',
] as const
export const USAGE_METRICS = [
  'trips',
  'places',
  'members',
  'files',
  'storage_bytes',
  'exports',
  'collections',
  'journeys',
] as const

export const TRIP_STATUSES = [
  'draft',
  'planning',
  'booked',
  'active',
  'completed',
  'archived',
] as const
export const TRIP_VISIBILITIES = ['private', 'organization', 'public'] as const
export const TRIP_MEMBER_ROLES = ['owner', 'editor', 'viewer'] as const

export const PLACE_SOURCES = ['manual', 'search', 'import', 'collection', 'osm'] as const
export const TRANSPORT_MODES = [
  'walk',
  'bike',
  'car',
  'taxi',
  'transit',
  'bus',
  'train',
  'tram',
  'metro',
  'ferry',
  'flight',
  'other',
] as const
export const TRANSPORT_STATUSES = ['idea', 'pending', 'confirmed', 'cancelled', 'completed'] as const
export const RESERVATION_TYPES = [
  'accommodation',
  'restaurant',
  'activity',
  'tour',
  'ticket',
  'transport',
  'other',
] as const
export const RESERVATION_STATUSES = [
  'none',
  'pending',
  'confirmed',
  'cancelled',
  'completed',
] as const

export const EXPENSE_CATEGORIES = [
  'accommodation',
  'transport',
  'food',
  'activities',
  'shopping',
  'fees',
  'insurance',
  'other',
] as const
export const SPLIT_METHODS = ['equal', 'shares', 'exact', 'percentage'] as const
export const SETTLEMENT_METHODS = ['cash', 'bank_transfer', 'card', 'app', 'other'] as const

export const LIST_KINDS = ['packing', 'todo', 'shopping', 'documents'] as const
export const ITEM_PRIORITIES = ['low', 'normal', 'high'] as const

export const FILE_KINDS = ['document', 'image', 'ticket', 'receipt', 'map', 'other'] as const

export const COLLECTION_VISIBILITIES = ['private', 'organization', 'public'] as const
export const COLLECTION_PLACE_STATUSES = [
  'idea',
  'shortlisted',
  'planned',
  'visited',
  'rejected',
] as const

export const JOURNEY_STATUSES = ['draft', 'published', 'archived'] as const
export const JOURNEY_ENTRY_TYPES = [
  'note',
  'photo',
  'place',
  'route',
  'milestone',
  'checkin',
] as const
export const CHECK_IN_SOURCES = ['manual', 'gps', 'import', 'photo'] as const
export const BUCKET_LIST_KINDS = ['country', 'region', 'place'] as const

export const VACAY_MEMBER_STATUSES = ['pending', 'accepted', 'declined'] as const
export const VACAY_ENTRY_KINDS = [
  'vacation',
  'half_day',
  'sick',
  'remote',
  'holiday',
  'other',
] as const

export const NOTIFICATION_TYPES = ['info', 'action', 'navigate'] as const
export const NOTIFICATION_SCOPES = ['trip', 'organization', 'user', 'system'] as const
export const NOTIFICATION_RESPONSES = ['accepted', 'declined'] as const
export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'push', 'webhook'] as const

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export const DISTANCE_UNITS = ['metric', 'imperial'] as const

/** JSON payload shapes stored in `text({ mode: 'json' })` columns. */
export type JsonRecord = Record<string, string | number | boolean | null>
export type PollOption = { id: string; label: string }
export type OpeningHours = Array<{ day: number; opens: string; closes: string }>
export type ShareScopes = {
  map: boolean
  itinerary: boolean
  reservations: boolean
  lists: boolean
  budget: boolean
  collab: boolean
  files: boolean
}
export type QuotaOverrides = Partial<Record<(typeof USAGE_METRICS)[number], number>>
export type ContinentCounts = Record<string, number>

/* -------------------------------------------------------------------------------------------------
 * Billing — written by the Stripe webhook handler, read by the quota guards
 * ---------------------------------------------------------------------------------------------- */

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: pk(),
    organizationId: orgRef(),
    plan: text('plan').notNull().default('free'),
    status: text('status').notNull().default('active'),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),
    stripePriceId: text('stripe_price_id'),
    seats: integer('seats').notNull().default(1),
    currency: currency(),
    unitAmountMinor: minor('unit_amount_minor'),
    currentPeriodStart: integer('current_period_start', { mode: 'timestamp_ms' }),
    currentPeriodEnd: integer('current_period_end', { mode: 'timestamp_ms' }),
    cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' })
      .notNull()
      .default(false),
    canceledAt: integer('canceled_at', { mode: 'timestamp_ms' }),
    trialEndsAt: integer('trial_ends_at', { mode: 'timestamp_ms' }),
    /** Per-tenant quota escapes; unset metrics fall back to the plan defaults. */
    quotaOverrides: text('quota_overrides', { mode: 'json' }).$type<QuotaOverrides>(),
    seatLimit: integer('seat_limit').notNull().default(10),
    storageLimitBytes: integer('storage_limit_bytes').notNull().default(1_073_741_824),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('subscriptions_org_unq').on(t.organizationId),
    uniqueIndex('subscriptions_stripe_subscription_unq').on(t.stripeSubscriptionId),
    index('subscriptions_stripe_customer_idx').on(t.stripeCustomerId),
    index('subscriptions_status_idx').on(t.status),
    index('subscriptions_current_period_end_idx').on(t.currentPeriodEnd),
    enumCheck('subscriptions_plan_chk', t.plan, ORGANIZATION_PLANS),
    enumCheck('subscriptions_status_chk', t.status, SUBSCRIPTION_STATUSES),
    nonNegativeCheck('subscriptions_seats_chk', t.seats),
    nonNegativeCheck('subscriptions_seat_limit_chk', t.seatLimit),
    nonNegativeCheck('subscriptions_storage_limit_chk', t.storageLimitBytes),
  ],
)

export const usageRecords = sqliteTable(
  'usage_records',
  {
    id: pk(),
    organizationId: orgRef(),
    metric: text('metric').notNull(),
    /** `YYYY-MM` for metered metrics, `all` for cumulative ones. */
    period: text('period').notNull().default('all'),
    value: integer('value').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('usage_records_org_metric_period_unq').on(t.organizationId, t.metric, t.period),
    index('usage_records_org_period_idx').on(t.organizationId, t.period),
    enumCheck('usage_records_metric_chk', t.metric, USAGE_METRICS),
    nonNegativeCheck('usage_records_value_chk', t.value),
  ],
)

/* -------------------------------------------------------------------------------------------------
 * Trips
 * ---------------------------------------------------------------------------------------------- */

export const trips = sqliteTable(
  'trips',
  {
    id: pk(),
    organizationId: orgRef(),
    createdBy: userRef('created_by').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    summary: text('summary'),
    description: text('description'),
    destination: text('destination'),
    countryCodes: text('country_codes', { mode: 'json' }).$type<Array<string>>(),
    startDate: text('start_date'),
    endDate: text('end_date'),
    timezone: text('timezone'),
    currency: currency().notNull().default('EUR'),
    status: text('status').notNull().default('planning'),
    visibility: text('visibility').notNull().default('private'),
    coverImageKey: text('cover_image_key'),
    coverImageUrl: text('cover_image_url'),
    accentColour: colour('accent_colour'),
    budgetTargetMinor: minor('budget_target_minor'),
    reminderDays: integer('reminder_days').notNull().default(3),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    isFavourite: integer('is_favourite', { mode: 'boolean' }).notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('trips_org_slug_unq').on(t.organizationId, t.slug),
    index('trips_org_status_idx').on(t.organizationId, t.status),
    index('trips_org_start_date_idx').on(t.organizationId, t.startDate),
    index('trips_org_updated_at_idx').on(t.organizationId, t.updatedAt),
    index('trips_org_archived_idx').on(t.organizationId, t.isArchived),
    index('trips_created_by_idx').on(t.createdBy),
    enumCheck('trips_status_chk', t.status, TRIP_STATUSES),
    enumCheck('trips_visibility_chk', t.visibility, TRIP_VISIBILITIES),
    nonNegativeCheck('trips_reminder_days_chk', t.reminderDays),
    check(
      'trips_date_order_chk',
      sql.raw('("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date")'),
    ),
  ],
)

export const tripMembers = sqliteTable(
  'trip_members',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    userId: userRef('user_id').notNull(),
    role: text('role').notNull().default('editor'),
    colour: colour('colour'),
    invitedBy: userRef('invited_by'),
    joinedAt: integer('joined_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('trip_members_trip_user_unq').on(t.tripId, t.userId),
    index('trip_members_org_trip_idx').on(t.organizationId, t.tripId),
    index('trip_members_org_user_idx').on(t.organizationId, t.userId),
    enumCheck('trip_members_role_chk', t.role, TRIP_MEMBER_ROLES),
  ],
)

export const days = sqliteTable(
  'days',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    dayNumber: integer('day_number').notNull(),
    date: text('date'),
    title: text('title'),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('days_trip_number_unq').on(t.tripId, t.dayNumber),
    index('days_org_trip_idx').on(t.organizationId, t.tripId),
    index('days_org_date_idx').on(t.organizationId, t.date),
    check('days_day_number_chk', sql.raw('"day_number" >= 1')),
  ],
)

/* -------------------------------------------------------------------------------------------------
 * Taxonomy
 * ---------------------------------------------------------------------------------------------- */

export const categories = sqliteTable(
  'categories',
  {
    id: pk(),
    organizationId: orgRef(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    colour: colour('colour').notNull().default('#2F6F5E'),
    icon: text('icon').notNull().default('map-pin'),
    isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('categories_org_slug_unq').on(t.organizationId, t.slug),
    index('categories_org_sort_idx').on(t.organizationId, t.sortOrder),
  ],
)

export const tags = sqliteTable(
  'tags',
  {
    id: pk(),
    organizationId: orgRef(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    colour: colour('colour').notNull().default('#B26B08'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('tags_org_slug_unq').on(t.organizationId, t.slug),
    index('tags_org_name_idx').on(t.organizationId, t.name),
  ],
)

/* -------------------------------------------------------------------------------------------------
 * Places and the itinerary
 * ---------------------------------------------------------------------------------------------- */

export const places = sqliteTable(
  'places',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    notes: text('notes'),
    ...geo(),
    address: text('address'),
    city: text('city'),
    countryCode: text('country_code', { length: 2 }),
    website: text('website'),
    phone: text('phone'),
    imageUrl: text('image_url'),
    openingHours: text('opening_hours', { mode: 'json' }).$type<OpeningHours>(),
    priceMinor: minor('price_minor'),
    currency: currency(),
    rating: integer('rating'),
    durationMinutes: integer('duration_minutes').notNull().default(60),
    transportMode: text('transport_mode').notNull().default('walk'),
    source: text('source').notNull().default('manual'),
    externalId: text('external_id'),
    isVisited: integer('is_visited', { mode: 'boolean' }).notNull().default(false),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('places_org_trip_idx').on(t.organizationId, t.tripId),
    index('places_org_category_idx').on(t.organizationId, t.categoryId),
    index('places_org_country_idx').on(t.organizationId, t.countryCode),
    index('places_trip_sort_idx').on(t.tripId, t.sortOrder),
    index('places_org_name_idx').on(t.organizationId, t.name),
    index('places_external_idx').on(t.source, t.externalId),
    enumCheck('places_transport_mode_chk', t.transportMode, TRANSPORT_MODES),
    enumCheck('places_source_chk', t.source, PLACE_SOURCES),
    nonNegativeCheck('places_duration_chk', t.durationMinutes),
    nonNegativeCheck('places_price_chk', t.priceMinor),
    check('places_rating_chk', sql.raw('("rating" IS NULL OR ("rating" BETWEEN 1 AND 5))')),
    ...latLngChecks('places_lat_chk', t.lat, t.lng),
  ],
)

export const placeTags = sqliteTable(
  'place_tags',
  {
    organizationId: orgRef(),
    placeId: text('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.placeId, t.tagId] }),
    index('place_tags_org_idx').on(t.organizationId),
    index('place_tags_tag_idx').on(t.tagId),
  ],
)

export const dayAssignments = sqliteTable(
  'day_assignments',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    dayId: text('day_id')
      .notNull()
      .references(() => days.id, { onDelete: 'cascade' }),
    placeId: text('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    orderIndex: real('order_index').notNull().default(0),
    startTime: text('start_time'),
    endTime: text('end_time'),
    durationMinutes: integer('duration_minutes'),
    transportMode: text('transport_mode'),
    notes: text('notes'),
    reservationStatus: text('reservation_status').notNull().default('none'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('day_assignments_day_place_unq').on(t.dayId, t.placeId),
    index('day_assignments_org_trip_idx').on(t.organizationId, t.tripId),
    index('day_assignments_day_order_idx').on(t.dayId, t.orderIndex),
    index('day_assignments_place_idx').on(t.placeId),
    enumCheck('day_assignments_transport_mode_chk', t.transportMode, TRANSPORT_MODES),
    enumCheck('day_assignments_reservation_status_chk', t.reservationStatus, RESERVATION_STATUSES),
    nonNegativeCheck('day_assignments_duration_chk', t.durationMinutes),
  ],
)

export const assignmentParticipants = sqliteTable(
  'assignment_participants',
  {
    organizationId: orgRef(),
    assignmentId: text('assignment_id')
      .notNull()
      .references(() => dayAssignments.id, { onDelete: 'cascade' }),
    userId: userRef('user_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.assignmentId, t.userId] }),
    index('assignment_participants_org_idx').on(t.organizationId),
    index('assignment_participants_user_idx').on(t.userId),
  ],
)

export const dayNotes = sqliteTable(
  'day_notes',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    dayId: text('day_id')
      .notNull()
      .references(() => days.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    time: text('time'),
    icon: text('icon').notNull().default('sticky-note'),
    createdBy: userRef('created_by'),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('day_notes_org_trip_idx').on(t.organizationId, t.tripId),
    index('day_notes_day_sort_idx').on(t.dayId, t.sortOrder),
  ],
)

export const dayAccommodations = sqliteTable(
  'day_accommodations',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    placeId: text('place_id').references(() => places.id, { onDelete: 'set null' }),
    startDayId: text('start_day_id')
      .notNull()
      .references(() => days.id, { onDelete: 'cascade' }),
    endDayId: text('end_day_id')
      .notNull()
      .references(() => days.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    address: text('address'),
    checkInTime: text('check_in_time'),
    checkInEndTime: text('check_in_end_time'),
    checkOutTime: text('check_out_time'),
    confirmationNumber: text('confirmation_number'),
    priceMinor: minor('price_minor'),
    currency: currency(),
    notes: text('notes'),
    ...timestamps(),
  },
  (t) => [
    index('day_accommodations_org_trip_idx').on(t.organizationId, t.tripId),
    index('day_accommodations_start_day_idx').on(t.startDayId),
    index('day_accommodations_end_day_idx').on(t.endDayId),
    index('day_accommodations_place_idx').on(t.placeId),
    nonNegativeCheck('day_accommodations_price_chk', t.priceMinor),
  ],
)

/* -------------------------------------------------------------------------------------------------
 * Transports and reservations
 * ---------------------------------------------------------------------------------------------- */

export const transports = sqliteTable(
  'transports',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    dayId: text('day_id').references(() => days.id, { onDelete: 'set null' }),
    mode: text('mode').notNull().default('flight'),
    status: text('status').notNull().default('pending'),
    title: text('title').notNull(),
    carrier: text('carrier'),
    serviceNumber: text('service_number'),
    bookingCode: text('booking_code'),
    seat: text('seat'),
    departureName: text('departure_name'),
    departureCode: text('departure_code', { length: 8 }),
    departureLat: real('departure_lat'),
    departureLng: real('departure_lng'),
    departureDate: text('departure_date'),
    departureTime: text('departure_time'),
    departureTimezone: text('departure_timezone'),
    arrivalName: text('arrival_name'),
    arrivalCode: text('arrival_code', { length: 8 }),
    arrivalLat: real('arrival_lat'),
    arrivalLng: real('arrival_lng'),
    arrivalDate: text('arrival_date'),
    arrivalTime: text('arrival_time'),
    arrivalTimezone: text('arrival_timezone'),
    distanceMetres: integer('distance_metres'),
    priceMinor: minor('price_minor'),
    currency: currency(),
    notes: text('notes'),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('transports_org_trip_idx').on(t.organizationId, t.tripId),
    index('transports_trip_departure_idx').on(t.tripId, t.departureDate),
    index('transports_org_status_idx').on(t.organizationId, t.status),
    index('transports_org_mode_idx').on(t.organizationId, t.mode),
    index('transports_day_idx').on(t.dayId),
    enumCheck('transports_mode_chk', t.mode, TRANSPORT_MODES),
    enumCheck('transports_status_chk', t.status, TRANSPORT_STATUSES),
    nonNegativeCheck('transports_price_chk', t.priceMinor),
    nonNegativeCheck('transports_distance_chk', t.distanceMetres),
  ],
)

export const reservations = sqliteTable(
  'reservations',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    dayId: text('day_id').references(() => days.id, { onDelete: 'set null' }),
    endDayId: text('end_day_id').references(() => days.id, { onDelete: 'set null' }),
    placeId: text('place_id').references(() => places.id, { onDelete: 'set null' }),
    assignmentId: text('assignment_id').references(() => dayAssignments.id, {
      onDelete: 'set null',
    }),
    transportId: text('transport_id').references(() => transports.id, { onDelete: 'set null' }),
    type: text('type').notNull().default('other'),
    status: text('status').notNull().default('pending'),
    title: text('title').notNull(),
    provider: text('provider'),
    location: text('location'),
    url: text('url'),
    confirmationNumber: text('confirmation_number'),
    startDate: text('start_date'),
    startTime: text('start_time'),
    endDate: text('end_date'),
    endTime: text('end_time'),
    guests: integer('guests'),
    priceMinor: minor('price_minor'),
    currency: currency(),
    notes: text('notes'),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('reservations_org_trip_idx').on(t.organizationId, t.tripId),
    index('reservations_trip_start_idx').on(t.tripId, t.startDate),
    index('reservations_org_status_idx').on(t.organizationId, t.status),
    index('reservations_org_type_idx').on(t.organizationId, t.type),
    index('reservations_day_idx').on(t.dayId),
    index('reservations_end_day_idx').on(t.endDayId),
    index('reservations_place_idx').on(t.placeId),
    index('reservations_assignment_idx').on(t.assignmentId),
    index('reservations_transport_idx').on(t.transportId),
    enumCheck('reservations_type_chk', t.type, RESERVATION_TYPES),
    enumCheck('reservations_status_chk', t.status, RESERVATION_STATUSES),
    nonNegativeCheck('reservations_price_chk', t.priceMinor),
    nonNegativeCheck('reservations_guests_chk', t.guests),
  ],
)

/* -------------------------------------------------------------------------------------------------
 * Budget, expenses, splits and settlements
 * ---------------------------------------------------------------------------------------------- */

export const budgetItems = sqliteTable(
  'budget_items',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    category: text('category').notNull().default('other'),
    name: text('name').notNull(),
    plannedAmountMinor: minor('planned_amount_minor').notNull().default(0),
    currency: currency().notNull().default('EUR'),
    persons: integer('persons'),
    days: integer('days'),
    note: text('note'),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('budget_items_org_trip_idx').on(t.organizationId, t.tripId),
    index('budget_items_trip_category_idx').on(t.tripId, t.category),
    index('budget_items_trip_sort_idx').on(t.tripId, t.sortOrder),
    enumCheck('budget_items_category_chk', t.category, EXPENSE_CATEGORIES),
    nonNegativeCheck('budget_items_amount_chk', t.plannedAmountMinor),
    nonNegativeCheck('budget_items_persons_chk', t.persons),
    nonNegativeCheck('budget_items_days_chk', t.days),
  ],
)

export const expenses = sqliteTable(
  'expenses',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    dayId: text('day_id').references(() => days.id, { onDelete: 'set null' }),
    placeId: text('place_id').references(() => places.id, { onDelete: 'set null' }),
    budgetItemId: text('budget_item_id').references(() => budgetItems.id, { onDelete: 'set null' }),
    category: text('category').notNull().default('other'),
    title: text('title').notNull(),
    /** Amount in the trip currency; the source amount is preserved alongside it. */
    amountMinor: minor('amount_minor').notNull().default(0),
    currency: currency().notNull().default('EUR'),
    originalAmountMinor: minor('original_amount_minor'),
    originalCurrency: currency('original_currency'),
    exchangeRate: real('exchange_rate'),
    spentOn: text('spent_on').notNull(),
    paidBy: userRef('paid_by'),
    splitMethod: text('split_method').notNull().default('equal'),
    notes: text('notes'),
    createdBy: userRef('created_by').notNull(),
    ...timestamps(),
  },
  (t) => [
    index('expenses_org_trip_idx').on(t.organizationId, t.tripId),
    index('expenses_trip_spent_on_idx').on(t.tripId, t.spentOn),
    index('expenses_trip_category_idx').on(t.tripId, t.category),
    index('expenses_org_paid_by_idx').on(t.organizationId, t.paidBy),
    index('expenses_day_idx').on(t.dayId),
    index('expenses_place_idx').on(t.placeId),
    index('expenses_budget_item_idx').on(t.budgetItemId),
    enumCheck('expenses_category_chk', t.category, EXPENSE_CATEGORIES),
    enumCheck('expenses_split_method_chk', t.splitMethod, SPLIT_METHODS),
    nonNegativeCheck('expenses_amount_chk', t.amountMinor),
    nonNegativeCheck('expenses_original_amount_chk', t.originalAmountMinor),
  ],
)

export const expenseShares = sqliteTable(
  'expense_shares',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    expenseId: text('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    userId: userRef('user_id').notNull(),
    shareMinor: minor('share_minor').notNull().default(0),
    weight: real('weight').notNull().default(1),
    isSettled: integer('is_settled', { mode: 'boolean' }).notNull().default(false),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('expense_shares_expense_user_unq').on(t.expenseId, t.userId),
    index('expense_shares_org_trip_idx').on(t.organizationId, t.tripId),
    index('expense_shares_org_user_idx').on(t.organizationId, t.userId),
    nonNegativeCheck('expense_shares_share_chk', t.shareMinor),
    nonNegativeCheck('expense_shares_weight_chk', t.weight),
  ],
)

export const settlements = sqliteTable(
  'settlements',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    fromUserId: userRef('from_user_id').notNull(),
    toUserId: userRef('to_user_id').notNull(),
    amountMinor: minor('amount_minor').notNull().default(0),
    currency: currency().notNull().default('EUR'),
    method: text('method').notNull().default('cash'),
    settledOn: text('settled_on').notNull(),
    note: text('note'),
    createdBy: userRef('created_by').notNull(),
    ...timestamps(),
  },
  (t) => [
    index('settlements_org_trip_idx').on(t.organizationId, t.tripId),
    index('settlements_trip_settled_on_idx').on(t.tripId, t.settledOn),
    index('settlements_org_from_idx').on(t.organizationId, t.fromUserId),
    index('settlements_org_to_idx').on(t.organizationId, t.toUserId),
    enumCheck('settlements_method_chk', t.method, SETTLEMENT_METHODS),
    nonNegativeCheck('settlements_amount_chk', t.amountMinor),
    check('settlements_distinct_parties_chk', sql.raw('"from_user_id" <> "to_user_id"')),
  ],
)

/* -------------------------------------------------------------------------------------------------
 * Lists — packing, todo, shopping, and reusable templates
 * ---------------------------------------------------------------------------------------------- */

export const packingLists = sqliteTable(
  'packing_lists',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    kind: text('kind').notNull().default('packing'),
    colour: colour('colour'),
    icon: text('icon'),
    /** `null` means the list is shared by the whole trip rather than owned by one traveller. */
    ownerUserId: userRef('owner_user_id'),
    weightLimitGrams: integer('weight_limit_grams'),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('packing_lists_org_trip_idx').on(t.organizationId, t.tripId),
    index('packing_lists_trip_kind_idx').on(t.tripId, t.kind),
    index('packing_lists_trip_sort_idx').on(t.tripId, t.sortOrder),
    index('packing_lists_owner_idx').on(t.ownerUserId),
    enumCheck('packing_lists_kind_chk', t.kind, LIST_KINDS),
    nonNegativeCheck('packing_lists_weight_limit_chk', t.weightLimitGrams),
  ],
)

export const packingItems = sqliteTable(
  'packing_items',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    listId: text('list_id')
      .notNull()
      .references(() => packingLists.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category'),
    description: text('description'),
    quantity: integer('quantity').notNull().default(1),
    weightGrams: integer('weight_grams'),
    isDone: integer('is_done', { mode: 'boolean' }).notNull().default(false),
    doneAt: integer('done_at', { mode: 'timestamp_ms' }),
    assignedTo: userRef('assigned_to'),
    dueDate: text('due_date'),
    priority: text('priority').notNull().default('normal'),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('packing_items_org_trip_idx').on(t.organizationId, t.tripId),
    index('packing_items_list_sort_idx').on(t.listId, t.sortOrder),
    index('packing_items_list_done_idx').on(t.listId, t.isDone),
    index('packing_items_org_assigned_idx').on(t.organizationId, t.assignedTo),
    index('packing_items_due_date_idx').on(t.dueDate),
    enumCheck('packing_items_priority_chk', t.priority, ITEM_PRIORITIES),
    nonNegativeCheck('packing_items_quantity_chk', t.quantity),
    nonNegativeCheck('packing_items_weight_chk', t.weightGrams),
  ],
)

export const packingTemplates = sqliteTable(
  'packing_templates',
  {
    id: pk(),
    organizationId: orgRef(),
    name: text('name').notNull(),
    description: text('description'),
    kind: text('kind').notNull().default('packing'),
    icon: text('icon'),
    isShared: integer('is_shared', { mode: 'boolean' }).notNull().default(true),
    createdBy: userRef('created_by').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('packing_templates_org_name_unq').on(t.organizationId, t.name),
    index('packing_templates_org_kind_idx').on(t.organizationId, t.kind),
    index('packing_templates_created_by_idx').on(t.createdBy),
    enumCheck('packing_templates_kind_chk', t.kind, LIST_KINDS),
  ],
)

export const packingTemplateItems = sqliteTable(
  'packing_template_items',
  {
    id: pk(),
    organizationId: orgRef(),
    templateId: text('template_id')
      .notNull()
      .references(() => packingTemplates.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    category: text('category'),
    quantity: integer('quantity').notNull().default(1),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('packing_template_items_org_idx').on(t.organizationId),
    index('packing_template_items_template_sort_idx').on(t.templateId, t.sortOrder),
    nonNegativeCheck('packing_template_items_quantity_chk', t.quantity),
  ],
)

/* -------------------------------------------------------------------------------------------------
 * Files
 * ---------------------------------------------------------------------------------------------- */

export const tripFiles = sqliteTable(
  'trip_files',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    placeId: text('place_id').references(() => places.id, { onDelete: 'set null' }),
    reservationId: text('reservation_id').references(() => reservations.id, {
      onDelete: 'set null',
    }),
    transportId: text('transport_id').references(() => transports.id, { onDelete: 'set null' }),
    expenseId: text('expense_id').references(() => expenses.id, { onDelete: 'set null' }),
    /** Object key inside the `FILES` R2 bucket. */
    storageKey: text('storage_key').notNull(),
    filename: text('filename').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    checksum: text('checksum'),
    kind: text('kind').notNull().default('document'),
    description: text('description'),
    width: integer('width'),
    height: integer('height'),
    uploadedBy: userRef('uploaded_by').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('trip_files_storage_key_unq').on(t.storageKey),
    index('trip_files_org_trip_idx').on(t.organizationId, t.tripId),
    index('trip_files_trip_kind_idx').on(t.tripId, t.kind),
    index('trip_files_place_idx').on(t.placeId),
    index('trip_files_reservation_idx').on(t.reservationId),
    index('trip_files_transport_idx').on(t.transportId),
    index('trip_files_expense_idx').on(t.expenseId),
    index('trip_files_org_created_at_idx').on(t.organizationId, t.createdAt),
    enumCheck('trip_files_kind_chk', t.kind, FILE_KINDS),
    nonNegativeCheck('trip_files_size_chk', t.sizeBytes),
  ],
)

export const shareLinks = sqliteTable(
  'share_links',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    scopes: text('scopes', { mode: 'json' }).$type<ShareScopes>().notNull(),
    createdBy: userRef('created_by').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    viewCount: integer('view_count').notNull().default(0),
    lastViewedAt: integer('last_viewed_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('share_links_token_unq').on(t.token),
    index('share_links_org_trip_idx').on(t.organizationId, t.tripId),
    index('share_links_expires_at_idx').on(t.expiresAt),
    nonNegativeCheck('share_links_view_count_chk', t.viewCount),
  ],
)

/* -------------------------------------------------------------------------------------------------
 * Collaboration
 * ---------------------------------------------------------------------------------------------- */

export const collabMessages = sqliteTable(
  'collab_messages',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    userId: userRef('user_id').notNull(),
    body: text('body').notNull(),
    replyToId: text('reply_to_id').references((): AnySQLiteColumn => collabMessages.id, {
      onDelete: 'set null',
    }),
    fileId: text('file_id').references(() => tripFiles.id, { onDelete: 'set null' }),
    editedAt: integer('edited_at', { mode: 'timestamp_ms' }),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (t) => [
    index('collab_messages_org_trip_idx').on(t.organizationId, t.tripId),
    index('collab_messages_trip_created_at_idx').on(t.tripId, t.createdAt),
    index('collab_messages_org_user_idx').on(t.organizationId, t.userId),
    index('collab_messages_reply_to_idx').on(t.replyToId),
    index('collab_messages_file_idx').on(t.fileId),
  ],
)

export const collabMessageReactions = sqliteTable(
  'collab_message_reactions',
  {
    organizationId: orgRef(),
    messageId: text('message_id')
      .notNull()
      .references(() => collabMessages.id, { onDelete: 'cascade' }),
    userId: userRef('user_id').notNull(),
    emoji: text('emoji').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.messageId, t.userId, t.emoji] }),
    index('collab_message_reactions_org_idx').on(t.organizationId),
    index('collab_message_reactions_user_idx').on(t.userId),
  ],
)

export const collabNotes = sqliteTable(
  'collab_notes',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    createdBy: userRef('created_by').notNull(),
    category: text('category'),
    title: text('title').notNull(),
    body: text('body'),
    colour: colour('colour'),
    isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('collab_notes_org_trip_idx').on(t.organizationId, t.tripId),
    index('collab_notes_trip_pinned_idx').on(t.tripId, t.isPinned),
    index('collab_notes_trip_sort_idx').on(t.tripId, t.sortOrder),
    index('collab_notes_created_by_idx').on(t.createdBy),
  ],
)

export const collabPolls = sqliteTable(
  'collab_polls',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    createdBy: userRef('created_by').notNull(),
    question: text('question').notNull(),
    options: text('options', { mode: 'json' }).$type<Array<PollOption>>().notNull(),
    allowMultiple: integer('allow_multiple', { mode: 'boolean' }).notNull().default(false),
    isClosed: integer('is_closed', { mode: 'boolean' }).notNull().default(false),
    closesAt: integer('closes_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (t) => [
    index('collab_polls_org_trip_idx').on(t.organizationId, t.tripId),
    index('collab_polls_trip_closed_idx').on(t.tripId, t.isClosed),
    index('collab_polls_created_by_idx').on(t.createdBy),
    index('collab_polls_closes_at_idx').on(t.closesAt),
  ],
)

export const collabPollVotes = sqliteTable(
  'collab_poll_votes',
  {
    id: pk(),
    organizationId: orgRef(),
    pollId: text('poll_id')
      .notNull()
      .references(() => collabPolls.id, { onDelete: 'cascade' }),
    userId: userRef('user_id').notNull(),
    optionId: text('option_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('collab_poll_votes_poll_user_option_unq').on(t.pollId, t.userId, t.optionId),
    index('collab_poll_votes_org_poll_idx').on(t.organizationId, t.pollId),
    index('collab_poll_votes_user_idx').on(t.userId),
  ],
)

export const checkIns = sqliteTable(
  'check_ins',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id').references(() => trips.id, { onDelete: 'cascade' }),
    placeId: text('place_id').references(() => places.id, { onDelete: 'set null' }),
    userId: userRef('user_id').notNull(),
    name: text('name').notNull(),
    ...geo(),
    address: text('address'),
    countryCode: text('country_code', { length: 2 }),
    note: text('note'),
    source: text('source').notNull().default('manual'),
    checkedInAt: integer('checked_in_at', { mode: 'timestamp_ms' }).notNull(),
    ...timestamps(),
  },
  (t) => [
    index('check_ins_org_user_idx').on(t.organizationId, t.userId),
    index('check_ins_org_trip_idx').on(t.organizationId, t.tripId),
    index('check_ins_user_checked_in_at_idx').on(t.userId, t.checkedInAt),
    index('check_ins_org_country_idx').on(t.organizationId, t.countryCode),
    index('check_ins_place_idx').on(t.placeId),
    enumCheck('check_ins_source_chk', t.source, CHECK_IN_SOURCES),
    ...latLngChecks('check_ins_lat_chk', t.lat, t.lng),
  ],
)

/* -------------------------------------------------------------------------------------------------
 * Collections — saved places outside any single trip
 * ---------------------------------------------------------------------------------------------- */

export const collections = sqliteTable(
  'collections',
  {
    id: pk(),
    organizationId: orgRef(),
    ownerUserId: userRef('owner_user_id').notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    colour: colour('colour').notNull().default('#2F6F5E'),
    icon: text('icon').notNull().default('bookmark'),
    coverImageUrl: text('cover_image_url'),
    visibility: text('visibility').notNull().default('organization'),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('collections_org_slug_unq').on(t.organizationId, t.slug),
    index('collections_org_owner_idx').on(t.organizationId, t.ownerUserId),
    index('collections_org_sort_idx').on(t.organizationId, t.sortOrder),
    index('collections_org_updated_at_idx').on(t.organizationId, t.updatedAt),
    enumCheck('collections_visibility_chk', t.visibility, COLLECTION_VISIBILITIES),
  ],
)

export const collectionPlaces = sqliteTable(
  'collection_places',
  {
    id: pk(),
    organizationId: orgRef(),
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    description: text('description'),
    notes: text('notes'),
    ...geo(),
    address: text('address'),
    city: text('city'),
    countryCode: text('country_code', { length: 2 }),
    website: text('website'),
    phone: text('phone'),
    imageUrl: text('image_url'),
    priceMinor: minor('price_minor'),
    currency: currency(),
    status: text('status').notNull().default('idea'),
    source: text('source').notNull().default('manual'),
    externalId: text('external_id'),
    sourceTripId: text('source_trip_id').references(() => trips.id, { onDelete: 'set null' }),
    sourcePlaceId: text('source_place_id').references(() => places.id, { onDelete: 'set null' }),
    savedBy: userRef('saved_by').notNull(),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('collection_places_org_collection_idx').on(t.organizationId, t.collectionId),
    index('collection_places_collection_sort_idx').on(t.collectionId, t.sortOrder),
    index('collection_places_org_status_idx').on(t.organizationId, t.status),
    index('collection_places_org_country_idx').on(t.organizationId, t.countryCode),
    index('collection_places_category_idx').on(t.categoryId),
    index('collection_places_source_trip_idx').on(t.sourceTripId),
    index('collection_places_source_place_idx').on(t.sourcePlaceId),
    enumCheck('collection_places_status_chk', t.status, COLLECTION_PLACE_STATUSES),
    enumCheck('collection_places_source_chk', t.source, PLACE_SOURCES),
    nonNegativeCheck('collection_places_price_chk', t.priceMinor),
    ...latLngChecks('collection_places_lat_chk', t.lat, t.lng),
  ],
)

export const collectionLabels = sqliteTable(
  'collection_labels',
  {
    id: pk(),
    organizationId: orgRef(),
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    colour: colour('colour').notNull().default('#2F6F5E'),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('collection_labels_collection_name_unq').on(t.collectionId, t.name),
    index('collection_labels_org_collection_idx').on(t.organizationId, t.collectionId),
    index('collection_labels_collection_sort_idx').on(t.collectionId, t.sortOrder),
  ],
)

export const collectionPlaceLabels = sqliteTable(
  'collection_place_labels',
  {
    organizationId: orgRef(),
    collectionPlaceId: text('collection_place_id')
      .notNull()
      .references(() => collectionPlaces.id, { onDelete: 'cascade' }),
    labelId: text('label_id')
      .notNull()
      .references(() => collectionLabels.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.collectionPlaceId, t.labelId] }),
    index('collection_place_labels_org_idx').on(t.organizationId),
    index('collection_place_labels_label_idx').on(t.labelId),
  ],
)

/* -------------------------------------------------------------------------------------------------
 * Journey — the travel journal
 * ---------------------------------------------------------------------------------------------- */

export const journeyMoods = sqliteTable(
  'journey_moods',
  {
    id: pk(),
    organizationId: orgRef(),
    key: text('key').notNull(),
    label: text('label').notNull(),
    emoji: text('emoji').notNull(),
    colour: colour('colour').notNull().default('#2F6F5E'),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('journey_moods_org_key_unq').on(t.organizationId, t.key),
    index('journey_moods_org_sort_idx').on(t.organizationId, t.sortOrder),
  ],
)

export const journeys = sqliteTable(
  'journeys',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id').references(() => trips.id, { onDelete: 'set null' }),
    ownerUserId: userRef('owner_user_id').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    subtitle: text('subtitle'),
    description: text('description'),
    coverImageUrl: text('cover_image_url'),
    coverGradient: text('cover_gradient'),
    status: text('status').notNull().default('draft'),
    visibility: text('visibility').notNull().default('private'),
    publicToken: text('public_token'),
    startedOn: text('started_on'),
    endedOn: text('ended_on'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('journeys_org_slug_unq').on(t.organizationId, t.slug),
    uniqueIndex('journeys_public_token_unq').on(t.publicToken),
    index('journeys_org_owner_idx').on(t.organizationId, t.ownerUserId),
    index('journeys_org_status_idx').on(t.organizationId, t.status),
    index('journeys_org_updated_at_idx').on(t.organizationId, t.updatedAt),
    index('journeys_trip_idx').on(t.tripId),
    enumCheck('journeys_status_chk', t.status, JOURNEY_STATUSES),
    enumCheck('journeys_visibility_chk', t.visibility, COLLECTION_VISIBILITIES),
  ],
)

export const journeyEntries = sqliteTable(
  'journey_entries',
  {
    id: pk(),
    organizationId: orgRef(),
    journeyId: text('journey_id')
      .notNull()
      .references(() => journeys.id, { onDelete: 'cascade' }),
    authorUserId: userRef('author_user_id').notNull(),
    moodId: text('mood_id').references(() => journeyMoods.id, { onDelete: 'set null' }),
    checkInId: text('check_in_id').references(() => checkIns.id, { onDelete: 'set null' }),
    sourceTripId: text('source_trip_id').references(() => trips.id, { onDelete: 'set null' }),
    sourcePlaceId: text('source_place_id').references(() => places.id, { onDelete: 'set null' }),
    type: text('type').notNull().default('note'),
    title: text('title'),
    body: text('body'),
    entryDate: text('entry_date').notNull(),
    entryTime: text('entry_time'),
    locationName: text('location_name'),
    ...geo(),
    weather: text('weather'),
    temperatureCelsius: real('temperature_celsius'),
    tags: text('tags', { mode: 'json' }).$type<Array<string>>(),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('journey_entries_org_journey_idx').on(t.organizationId, t.journeyId),
    index('journey_entries_journey_date_idx').on(t.journeyId, t.entryDate),
    index('journey_entries_journey_sort_idx').on(t.journeyId, t.sortOrder),
    index('journey_entries_org_author_idx').on(t.organizationId, t.authorUserId),
    index('journey_entries_mood_idx').on(t.moodId),
    index('journey_entries_check_in_idx').on(t.checkInId),
    index('journey_entries_source_trip_idx').on(t.sourceTripId),
    index('journey_entries_source_place_idx').on(t.sourcePlaceId),
    enumCheck('journey_entries_type_chk', t.type, JOURNEY_ENTRY_TYPES),
    ...latLngChecks('journey_entries_lat_chk', t.lat, t.lng),
  ],
)

export const journeyPhotos = sqliteTable(
  'journey_photos',
  {
    id: pk(),
    organizationId: orgRef(),
    journeyId: text('journey_id')
      .notNull()
      .references(() => journeys.id, { onDelete: 'cascade' }),
    entryId: text('entry_id').references(() => journeyEntries.id, { onDelete: 'cascade' }),
    /** Object key inside the `FILES` R2 bucket. */
    storageKey: text('storage_key').notNull(),
    thumbnailKey: text('thumbnail_key'),
    caption: text('caption'),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    takenAt: integer('taken_at', { mode: 'timestamp_ms' }),
    ...geo(),
    uploadedBy: userRef('uploaded_by').notNull(),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('journey_photos_storage_key_unq').on(t.storageKey),
    index('journey_photos_org_journey_idx').on(t.organizationId, t.journeyId),
    index('journey_photos_entry_sort_idx').on(t.entryId, t.sortOrder),
    index('journey_photos_org_taken_at_idx').on(t.organizationId, t.takenAt),
    nonNegativeCheck('journey_photos_size_chk', t.sizeBytes),
    ...latLngChecks('journey_photos_lat_chk', t.lat, t.lng),
  ],
)

/* -------------------------------------------------------------------------------------------------
 * Atlas — the world-map tracker
 * ---------------------------------------------------------------------------------------------- */

export const visitedCountries = sqliteTable(
  'visited_countries',
  {
    id: pk(),
    organizationId: orgRef(),
    userId: userRef('user_id').notNull(),
    countryCode: text('country_code', { length: 2 }).notNull(),
    continent: text('continent'),
    firstVisitedOn: text('first_visited_on'),
    lastVisitedOn: text('last_visited_on'),
    visitCount: integer('visit_count').notNull().default(1),
    note: text('note'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('visited_countries_org_user_country_unq').on(
      t.organizationId,
      t.userId,
      t.countryCode,
    ),
    index('visited_countries_org_user_idx').on(t.organizationId, t.userId),
    index('visited_countries_org_continent_idx').on(t.organizationId, t.continent),
    nonNegativeCheck('visited_countries_visit_count_chk', t.visitCount),
  ],
)

export const visitedRegions = sqliteTable(
  'visited_regions',
  {
    id: pk(),
    organizationId: orgRef(),
    userId: userRef('user_id').notNull(),
    countryCode: text('country_code', { length: 2 }).notNull(),
    regionCode: text('region_code').notNull(),
    regionName: text('region_name').notNull(),
    firstVisitedOn: text('first_visited_on'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('visited_regions_org_user_region_unq').on(
      t.organizationId,
      t.userId,
      t.regionCode,
    ),
    index('visited_regions_org_user_idx').on(t.organizationId, t.userId),
    index('visited_regions_org_country_idx').on(t.organizationId, t.countryCode),
  ],
)

export const travelStats = sqliteTable(
  'travel_stats',
  {
    id: pk(),
    organizationId: orgRef(),
    userId: userRef('user_id').notNull(),
    /** Calendar year, or `0` for the all-time roll-up. */
    statYear: integer('stat_year').notNull().default(0),
    tripCount: integer('trip_count').notNull().default(0),
    placeCount: integer('place_count').notNull().default(0),
    cityCount: integer('city_count').notNull().default(0),
    countryCount: integer('country_count').notNull().default(0),
    regionCount: integer('region_count').notNull().default(0),
    dayCount: integer('day_count').notNull().default(0),
    distanceMetres: integer('distance_metres').notNull().default(0),
    spendMinor: minor('spend_minor').notNull().default(0),
    currency: currency().notNull().default('EUR'),
    byContinent: text('by_continent', { mode: 'json' }).$type<ContinentCounts>(),
    yearStreak: integer('year_streak').notNull().default(0),
    lastTripId: text('last_trip_id').references(() => trips.id, { onDelete: 'set null' }),
    computedAt: integer('computed_at', { mode: 'timestamp_ms' }).notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('travel_stats_org_user_year_unq').on(t.organizationId, t.userId, t.statYear),
    index('travel_stats_org_year_idx').on(t.organizationId, t.statYear),
    index('travel_stats_last_trip_idx').on(t.lastTripId),
    nonNegativeCheck('travel_stats_year_chk', t.statYear),
  ],
)

export const bucketListItems = sqliteTable(
  'bucket_list_items',
  {
    id: pk(),
    organizationId: orgRef(),
    userId: userRef('user_id').notNull(),
    kind: text('kind').notNull().default('place'),
    name: text('name').notNull(),
    countryCode: text('country_code', { length: 2 }),
    regionCode: text('region_code'),
    ...geo(),
    note: text('note'),
    targetYear: integer('target_year'),
    isAchieved: integer('is_achieved', { mode: 'boolean' }).notNull().default(false),
    achievedOn: text('achieved_on'),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('bucket_list_items_org_user_idx').on(t.organizationId, t.userId),
    index('bucket_list_items_user_achieved_idx').on(t.userId, t.isAchieved),
    index('bucket_list_items_org_country_idx').on(t.organizationId, t.countryCode),
    index('bucket_list_items_user_sort_idx').on(t.userId, t.sortOrder),
    enumCheck('bucket_list_items_kind_chk', t.kind, BUCKET_LIST_KINDS),
    ...latLngChecks('bucket_list_items_lat_chk', t.lat, t.lng),
  ],
)

/* -------------------------------------------------------------------------------------------------
 * Vacay — vacation-day planning
 * ---------------------------------------------------------------------------------------------- */

export const vacayPlans = sqliteTable(
  'vacay_plans',
  {
    id: pk(),
    organizationId: orgRef(),
    ownerUserId: userRef('owner_user_id').notNull(),
    name: text('name').notNull().default('Vacay'),
    blockWeekends: integer('block_weekends', { mode: 'boolean' }).notNull().default(true),
    holidaysEnabled: integer('holidays_enabled', { mode: 'boolean' }).notNull().default(true),
    companyHolidaysEnabled: integer('company_holidays_enabled', { mode: 'boolean' })
      .notNull()
      .default(true),
    carryOverEnabled: integer('carry_over_enabled', { mode: 'boolean' }).notNull().default(true),
    defaultEntitlementDays: integer('default_entitlement_days').notNull().default(30),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('vacay_plans_org_owner_unq').on(t.organizationId, t.ownerUserId),
    index('vacay_plans_org_idx').on(t.organizationId),
    nonNegativeCheck('vacay_plans_entitlement_chk', t.defaultEntitlementDays),
  ],
)

export const vacayPlanMembers = sqliteTable(
  'vacay_plan_members',
  {
    id: pk(),
    organizationId: orgRef(),
    planId: text('plan_id')
      .notNull()
      .references(() => vacayPlans.id, { onDelete: 'cascade' }),
    userId: userRef('user_id').notNull(),
    status: text('status').notNull().default('pending'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('vacay_plan_members_plan_user_unq').on(t.planId, t.userId),
    index('vacay_plan_members_org_plan_idx').on(t.organizationId, t.planId),
    index('vacay_plan_members_org_user_idx').on(t.organizationId, t.userId),
    enumCheck('vacay_plan_members_status_chk', t.status, VACAY_MEMBER_STATUSES),
  ],
)

export const vacayYears = sqliteTable(
  'vacay_years',
  {
    id: pk(),
    organizationId: orgRef(),
    planId: text('plan_id')
      .notNull()
      .references(() => vacayPlans.id, { onDelete: 'cascade' }),
    year: integer('year').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('vacay_years_plan_year_unq').on(t.planId, t.year),
    index('vacay_years_org_plan_idx').on(t.organizationId, t.planId),
  ],
)

export const vacayUserYears = sqliteTable(
  'vacay_user_years',
  {
    id: pk(),
    organizationId: orgRef(),
    planId: text('plan_id')
      .notNull()
      .references(() => vacayPlans.id, { onDelete: 'cascade' }),
    userId: userRef('user_id').notNull(),
    year: integer('year').notNull(),
    entitlementDays: integer('entitlement_days').notNull().default(30),
    carriedOverDays: integer('carried_over_days').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('vacay_user_years_plan_user_year_unq').on(t.planId, t.userId, t.year),
    index('vacay_user_years_org_plan_idx').on(t.organizationId, t.planId),
    index('vacay_user_years_org_user_year_idx').on(t.organizationId, t.userId, t.year),
    nonNegativeCheck('vacay_user_years_entitlement_chk', t.entitlementDays),
    nonNegativeCheck('vacay_user_years_carried_over_chk', t.carriedOverDays),
  ],
)

export const vacayEntries = sqliteTable(
  'vacay_entries',
  {
    id: pk(),
    organizationId: orgRef(),
    planId: text('plan_id')
      .notNull()
      .references(() => vacayPlans.id, { onDelete: 'cascade' }),
    userId: userRef('user_id').notNull(),
    date: text('date').notNull(),
    kind: text('kind').notNull().default('vacation'),
    note: text('note'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('vacay_entries_plan_user_date_unq').on(t.planId, t.userId, t.date),
    index('vacay_entries_org_plan_idx').on(t.organizationId, t.planId),
    index('vacay_entries_plan_date_idx').on(t.planId, t.date),
    index('vacay_entries_org_user_idx').on(t.organizationId, t.userId),
    enumCheck('vacay_entries_kind_chk', t.kind, VACAY_ENTRY_KINDS),
  ],
)

export const vacayCompanyHolidays = sqliteTable(
  'vacay_company_holidays',
  {
    id: pk(),
    organizationId: orgRef(),
    planId: text('plan_id')
      .notNull()
      .references(() => vacayPlans.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    label: text('label'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('vacay_company_holidays_plan_date_unq').on(t.planId, t.date),
    index('vacay_company_holidays_org_plan_idx').on(t.organizationId, t.planId),
    index('vacay_company_holidays_plan_date_idx').on(t.planId, t.date),
  ],
)

export const vacayHolidayCalendars = sqliteTable(
  'vacay_holiday_calendars',
  {
    id: pk(),
    organizationId: orgRef(),
    planId: text('plan_id')
      .notNull()
      .references(() => vacayPlans.id, { onDelete: 'cascade' }),
    region: text('region').notNull(),
    label: text('label'),
    colour: colour('colour').notNull().default('#C0392B'),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('vacay_holiday_calendars_plan_region_unq').on(t.planId, t.region),
    index('vacay_holiday_calendars_org_plan_idx').on(t.organizationId, t.planId),
    index('vacay_holiday_calendars_plan_sort_idx').on(t.planId, t.sortOrder),
  ],
)

export const vacayUserColours = sqliteTable(
  'vacay_user_colours',
  {
    id: pk(),
    organizationId: orgRef(),
    planId: text('plan_id')
      .notNull()
      .references(() => vacayPlans.id, { onDelete: 'cascade' }),
    userId: userRef('user_id').notNull(),
    colour: colour('colour').notNull().default('#2F6F5E'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('vacay_user_colours_plan_user_unq').on(t.planId, t.userId),
    index('vacay_user_colours_org_plan_idx').on(t.organizationId, t.planId),
  ],
)

/* -------------------------------------------------------------------------------------------------
 * Notifications, settings and audit
 * ---------------------------------------------------------------------------------------------- */

export const notifications = sqliteTable(
  'notifications',
  {
    id: pk(),
    organizationId: orgRef(),
    recipientUserId: userRef('recipient_user_id').notNull(),
    senderUserId: userRef('sender_user_id'),
    type: text('type').notNull().default('info'),
    scope: text('scope').notNull().default('user'),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    titleKey: text('title_key').notNull(),
    titleParams: text('title_params', { mode: 'json' }).$type<JsonRecord>(),
    bodyKey: text('body_key').notNull(),
    bodyParams: text('body_params', { mode: 'json' }).$type<JsonRecord>(),
    actionUrl: text('action_url'),
    response: text('response'),
    respondedAt: integer('responded_at', { mode: 'timestamp_ms' }),
    isRead: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    readAt: integer('read_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (t) => [
    index('notifications_org_recipient_read_idx').on(
      t.organizationId,
      t.recipientUserId,
      t.isRead,
    ),
    index('notifications_recipient_created_at_idx').on(t.recipientUserId, t.createdAt),
    index('notifications_org_scope_idx').on(t.organizationId, t.scope),
    index('notifications_entity_idx').on(t.entityType, t.entityId),
    enumCheck('notifications_type_chk', t.type, NOTIFICATION_TYPES),
    enumCheck('notifications_scope_chk', t.scope, NOTIFICATION_SCOPES),
    enumCheck('notifications_response_chk', t.response, NOTIFICATION_RESPONSES),
  ],
)

export const notificationPreferences = sqliteTable(
  'notification_preferences',
  {
    id: pk(),
    organizationId: orgRef(),
    userId: userRef('user_id').notNull(),
    eventType: text('event_type').notNull(),
    channel: text('channel').notNull(),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('notification_preferences_org_user_event_channel_unq').on(
      t.organizationId,
      t.userId,
      t.eventType,
      t.channel,
    ),
    index('notification_preferences_org_user_idx').on(t.organizationId, t.userId),
    enumCheck('notification_preferences_channel_chk', t.channel, NOTIFICATION_CHANNELS),
  ],
)

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: pk(),
    organizationId: orgRef(),
    actorUserId: userRef('actor_user_id'),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    metadata: text('metadata', { mode: 'json' }).$type<JsonRecord>(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_log_org_created_at_idx').on(t.organizationId, t.createdAt),
    index('audit_log_org_actor_idx').on(t.organizationId, t.actorUserId),
    index('audit_log_org_action_idx').on(t.organizationId, t.action),
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
  ],
)

export const organizationSettings = sqliteTable(
  'organization_settings',
  {
    id: pk(),
    organizationId: orgRef(),
    defaultCurrency: currency().notNull().default('EUR'),
    // The source locale of `src/lib/i18n/locales.ts` (`DEFAULT_LOCALE`), spelled out because this
    // file imports nothing outside the schema layer. It was `en-GB`, which is not one of the
    // twenty-three tags `docs/SPEC.md` §8 ships, and Drizzle inlines a static default into every
    // `INSERT` client-side — so a stale value here would keep writing off-spec rows however the DDL
    // reads. `drizzle/0002_locale_normalisation.sql` carries the matching column default.
    locale: text('locale').notNull().default('en'),
    timezone: text('timezone').notNull().default('UTC'),
    weekStartsOn: integer('week_starts_on').notNull().default(1),
    dateFormat: text('date_format').notNull().default('dd MMM yyyy'),
    distanceUnit: text('distance_unit').notNull().default('metric'),
    mapStyle: text('map_style').notNull().default('planned-light'),
    features: text('features', { mode: 'json' }).$type<JsonRecord>(),
    onboardedAt: integer('onboarded_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('organization_settings_org_unq').on(t.organizationId),
    enumCheck('organization_settings_distance_unit_chk', t.distanceUnit, DISTANCE_UNITS),
    check('organization_settings_week_start_chk', sql.raw('"week_starts_on" BETWEEN 0 AND 6')),
  ],
)

export const userSettings = sqliteTable(
  'user_settings',
  {
    id: pk(),
    organizationId: orgRef(),
    userId: userRef('user_id').notNull(),
    theme: text('theme').notNull().default('system'),
    locale: text('locale'),
    timezone: text('timezone'),
    currency: currency(),
    weekStartsOn: integer('week_starts_on'),
    dateFormat: text('date_format'),
    distanceUnit: text('distance_unit'),
    mapStyle: text('map_style'),
    accentColour: colour('accent_colour'),
    reduceMotion: integer('reduce_motion', { mode: 'boolean' }).notNull().default(false),
    onboardingCompletedAt: integer('onboarding_completed_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('user_settings_org_user_unq').on(t.organizationId, t.userId),
    index('user_settings_user_idx').on(t.userId),
    enumCheck('user_settings_theme_chk', t.theme, THEME_PREFERENCES),
    enumCheck('user_settings_distance_unit_chk', t.distanceUnit, DISTANCE_UNITS),
    check(
      'user_settings_week_start_chk',
      sql.raw('("week_starts_on" IS NULL OR "week_starts_on" BETWEEN 0 AND 6)'),
    ),
  ],
)

/**
 * Instance-wide key/value configuration. This is the one table that is deliberately not
 * tenant-scoped: it holds deployment settings such as the marketing feature flags and the
 * currently published tile pack. It is never reachable from a tenant repository.
 */
export const appSettings = sqliteTable(
  'app_settings',
  {
    key: text('key').primaryKey(),
    value: text('value', { mode: 'json' }).$type<JsonRecord>(),
    description: text('description'),
    ...timestamps(),
  },
  (t) => [index('app_settings_updated_at_idx').on(t.updatedAt)],
)
