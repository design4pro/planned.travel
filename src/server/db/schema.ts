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

/** Column defaults a fixture supplies for itself, in place of the clock and the random source. */
export interface SuppliedRowDefaults {
  /** Stands in for {@link newId}. Must return the same 25-character shape. */
  readonly id: () => string
  /** Stands in for the wall clock behind `created_at` and `updated_at`. */
  readonly now: () => Date
}

/**
 * The defaults in force for the write currently in progress.
 *
 * `null` in every request the product serves, which is what {@link newId} being unchanged means: no
 * deployed write path can reach {@link withSuppliedRowDefaults}, so no deployed write path sees
 * anything but `Date.now()` and `nanoid`. It exists for the demo fixture, whose rows have to be the
 * *same* rows on every run — a cover drawing, a wash colour and a grid's de-duplication walk are all
 * pure functions of a record's id, so a fixture that mints a new id per run repaints screens nobody
 * edited and reddens a visual baseline that is still correct about the product.
 *
 * Module scope rather than an `AsyncLocalStorage`, deliberately and with a cost. This file is
 * reachable from the client graph — routes read its enum tuples for their forms — so importing
 * `node:async_hooks` here fails the browser bundle outright. The cost is that the override is
 * isolate-wide while it is installed, so a write racing the seed inside the same *development*
 * isolate would be handed fixture values. That is bounded by {@link withSuppliedRowDefaults} being
 * unreachable outside `/api/dev/seed`, which `import.meta.env.DEV` compiles out of a production
 * build.
 */
let supplied: SuppliedRowDefaults | null = null

/**
 * Time-sortable, URL-safe, 25 character identifier: a base-36 millisecond timestamp followed by
 * 16 random characters. Sorting by `id` is therefore sorting by creation time, which lets every
 * paginated list use the primary key as a stable cursor.
 */
export function newId(): string {
  if (supplied !== null) {
    return supplied.id()
  }
  return `${Date.now().toString(36).padStart(ID_TIME_LENGTH, '0')}${nanoid(ID_RANDOM_LENGTH)}`
}

/** The instant a mutated row is stamped with when the caller does not name one itself. */
function rowInstant(): Date {
  return supplied === null ? new Date() : supplied.now()
}

/**
 * Runs `write` with every {@link newId} and every unstamped `created_at` / `updated_at` inside it
 * answered by `defaults`.
 *
 * **Fixtures only.** The one caller is the demo seed in `src/routes/api/dev/-seed`, which is behind
 * `import.meta.env.DEV` and compiled out of a production bundle;
 * `-seed/__tests__/fixture-rows.test.ts` reads the tree back off disk and fails if a second caller
 * appears. A real identifier is drawn from a real random source, and an application write that
 * supplied its own would be handing an attacker the shape of the next primary key.
 *
 * `defaults.id` must return an identifier of the same shape `newId()` does — a base-36 instant
 * followed by sixteen characters — and `defaults.now` must advance, or the ordering that every
 * keyset cursor in `src/server/repos` depends on stops meaning creation order. The defaults are
 * restored on the way out however `write` ends, and two of these do not nest: a second one inside
 * the first is a caller that has lost track of its own sections, and it throws rather than quietly
 * stealing them.
 */
export async function withSuppliedRowDefaults<T>(
  defaults: SuppliedRowDefaults,
  write: () => Promise<T>,
): Promise<T> {
  if (supplied !== null) {
    throw new Error(
      'withSuppliedRowDefaults: defaults are already installed for this write; these do not nest',
    )
  }
  supplied = defaults
  try {
    return await write()
  } finally {
    supplied = null
  }
}

const pk = () => text('id').primaryKey().$defaultFn(newId)

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(rowInstant)

const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(rowInstant)
    .$onUpdateFn(rowInstant)

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
function enumCheck(
  name: string,
  column: AnySQLiteColumn,
  values: readonly string[],
) {
  const list = values
    .map((value) => `'${value.replaceAll("'", "''")}'`)
    .join(', ')
  return check(
    name,
    sql.raw(`("${column.name}" IS NULL OR "${column.name}" IN (${list}))`),
  )
}

/** Builds a `CHECK` constraint asserting a numeric column is not negative. */
function nonNegativeCheck(name: string, column: AnySQLiteColumn) {
  return check(
    name,
    sql.raw(`("${column.name}" IS NULL OR "${column.name}" >= 0)`),
  )
}

/** Builds a `CHECK` constraint asserting a coordinate pair stays inside valid WGS-84 bounds. */
function latLngChecks(
  name: string,
  lat: AnySQLiteColumn,
  lng: AnySQLiteColumn,
) {
  return [
    check(
      name,
      sql.raw(`("${lat.name}" IS NULL OR ("${lat.name}" BETWEEN -90 AND 90))`),
    ),
    check(
      `${name}_lng`,
      sql.raw(
        `("${lng.name}" IS NULL OR ("${lng.name}" BETWEEN -180 AND 180))`,
      ),
    ),
  ]
}

const geo = () => ({ lat: real('lat'), lng: real('lng') })

/* -------------------------------------------------------------------------------------------------
 * Enumerated value tuples — shared by the schema checks, the repositories and the Zod inputs
 * ---------------------------------------------------------------------------------------------- */

export const ORGANIZATION_PLANS = [
  'free',
  'starter',
  'pro',
  'business',
] as const
/**
 * The plans we *sell*, which is a different vocabulary from the coarse tier above:
 * `plan` is what the quota guards read, these are what a customer is told they are on.
 * Mirrors `PLAN_IDS` in `src/lib/plans.ts`, which this file cannot import because that
 * module reads `import.meta.env` at load time and `drizzle-kit generate` runs it under
 * plain Node. The two tuples are held in step by a test rather than by an import.
 */
export const PLAN_CATALOGUE_IDS = ['free', 'solo', 'crew'] as const
/** Mirrors `BILLING_INTERVALS` in `src/lib/plans.ts`, on the same terms. */
export const BILLING_INTERVALS = ['monthly', 'yearly'] as const
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

export const PLACE_SOURCES = [
  'manual',
  'search',
  'import',
  'collection',
  'osm',
] as const
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
export const TRANSPORT_STATUSES = [
  'idea',
  'pending',
  'confirmed',
  'cancelled',
  'completed',
] as const
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
export const SETTLEMENT_METHODS = [
  'cash',
  'bank_transfer',
  'card',
  'app',
  'other',
] as const

export const LIST_KINDS = ['packing', 'todo', 'shopping', 'documents'] as const
export const ITEM_PRIORITIES = ['low', 'normal', 'high'] as const

export const FILE_KINDS = [
  'document',
  'image',
  'ticket',
  'receipt',
  'map',
  'other',
] as const

export const COLLECTION_VISIBILITIES = [
  'private',
  'organization',
  'public',
] as const
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

export const VACAY_MEMBER_STATUSES = [
  'pending',
  'accepted',
  'declined',
] as const
export const VACAY_ENTRY_KINDS = [
  'vacation',
  'half_day',
  'sick',
  'remote',
  'holiday',
  'other',
] as const

export const NOTIFICATION_TYPES = ['info', 'action', 'navigate'] as const
export const NOTIFICATION_SCOPES = [
  'trip',
  'organization',
  'user',
  'system',
] as const
export const NOTIFICATION_RESPONSES = ['accepted', 'declined'] as const
export const NOTIFICATION_CHANNELS = [
  'in_app',
  'email',
  'push',
  'webhook',
] as const

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export const DISTANCE_UNITS = ['metric', 'imperial'] as const

/**
 * Who a `platform_audit_log` row is attributed to (docs/ACCESS.md §4.1). `human` is a signed-in
 * platform role acting through the console, `agent` an MCP call authenticated by a
 * `staff_api_tokens` bearer, `system` the platform itself — cron, matcher, prune.
 */
export const PLATFORM_ACTOR_KINDS = ['human', 'agent', 'system'] as const

/**
 * Providers whose outbound calls this repository actually makes, and can therefore count.
 *
 * Four, because four clients exist: `src/server/queue/handlers/email.ts`,
 * `src/server/queue/handlers/pdf-export.ts`, the injected `fetch` of
 * `src/server/billing/polar.ts` and `src/server/geo/geoapify.ts`. A slug earns a place here when a
 * call site can name it, never before — {@link PLANNED_PROVIDERS} is where an intention lives, and
 * moving a slug across is what adopting a provider looks like.
 */
export const METERED_PROVIDERS = [
  'resend',
  'browser-rendering',
  'polar',
  'geoapify',
] as const

/**
 * Providers the console lists with no client behind them, so that a screen of counters can say
 * "not integrated yet" instead of `0`. The two readings are opposite facts and a bare zero cannot
 * tell them apart.
 *
 * These are **decided but unwritten**, which is a different state from undecided and is why they
 * are named rather than omitted:
 *
 * - `d1-export` — the backup cron's unwritten half. `readCloudflareApi` in
 *   `src/server/queue/http.ts` has no caller and the `BACKUP_CRON` branch of `src/server/worker.ts`
 *   logs that it has no handler.
 * - `here` — public-transit routing, bought under ADR 0011 (30,000 requests a month included).
 * - `workers-ai` — confirmation extraction, bound under ADR 0012, whose decision text asks for a
 *   per-tenant ceiling in the same breath.
 *
 * **No allowance figure is stored in code**, and the reason has changed since these slugs first
 * appeared here. It was that the provider decision was open. It is now that an allowance is a term
 * of a contract that an operator renegotiates without a deploy: the figures above are context for a
 * reader, and the enforced number is the one typed into `provider_registry`.
 *
 * Moving a slug from here to {@link METERED_PROVIDERS} is what adopting a provider looks like; all
 * three are waiting on a client rather than on a decision. `geoapify` made that move when
 * `src/server/geo/` was minted, which is the shape the remaining three are waiting for.
 */
export const PLANNED_PROVIDERS = ['d1-export', 'here', 'workers-ai'] as const

/**
 * The two resolutions `provider_usage` stores. `hour` is the write shape; `month` is the archive
 * the weekly rollup folds it into, so usage stays countable for ever without keeping an hourly row
 * for ever.
 */
export const PROVIDER_USAGE_GRAINS = ['hour', 'month'] as const

/** What happens at a provider's ceiling: bill through it, or refuse the call. */
export const PROVIDER_LIMIT_POLICIES = ['allow', 'block'] as const

/**
 * The windows a `provider_registry` ceiling can be expressed over.
 *
 * `day` is here because a vendor's own term is, not because a shorter window seemed useful: ADR 0013
 * buys geocoding from Geoapify with 3,000 credits included **a day**, and a ceiling expressed over a
 * month could not be the term we agreed to. Every other agreed ceiling in this repository is monthly.
 */
export const PROVIDER_LIMIT_WINDOWS = ['day', 'month'] as const

/**
 * The platform role an audit row records its actor as holding **at the moment of the action**
 * (docs/ACCESS.md §4.1). `user.role` is mutable and this column is not, which is the whole reason
 * the role is stored rather than joined.
 *
 * The same three names are enumerated once more, as the keys of `roles` in
 * `src/server/auth/access.ts`, and that is deliberate rather than an oversight. This file is
 * reachable from the client graph and from `drizzle-kit`, so it carries the vocabulary of every
 * column it declares itself instead of importing an authorisation module to type one; the two
 * lists are held together by a drift test in `__tests__/platform-schema.test.ts` that fails the
 * moment a fourth role is added to either without the other.
 */
export const PLATFORM_ACTOR_ROLES = ['admin', 'curator', 'user'] as const

/**
 * The nine entities a platform action can touch (docs/ACCESS.md §4.2).
 *
 * A TypeScript vocabulary, not a database constraint: `entity_type` is plain `text` in §4.1's
 * column table, so a tenth entity costs an amendment to §4.2's mapping rather than a recreate of
 * an append-only log.
 */
export const PLATFORM_AUDIT_ENTITY_TYPES = [
  'catalog_place',
  'catalog_ingest',
  'place_pack',
  'catalog_source',
  'user',
  'session',
  'staff_api_token',
  'share_link',
  'provider',
] as const

/**
 * The thirty-three actions a `platform_audit_log` row can carry, in the order docs/ACCESS.md §4.2
 * tables them. The list is closed there and closed here: a new action is an amendment to that
 * table, made in the commit that adds the code writing it.
 *

 * Eighteen take the two-segment `<entity_type>.<verb>` form, and fifteen take the three-segment
 * `platform.<entity>.<verb>` form because their entities — user, session, credential, share — are
 * named identically in the tenant audit log of §4.5, where a bare `user.created` read out of a
 * view spanning both tables would be attributable to neither. The two `provider.*` actions take the
 * short form for the converse reason: no tenant log has a provider, so there is nothing for a bare
 * name to be confused with, and the three-segment form would claim a collision that does not exist.
 *
 * Like {@link PLATFORM_AUDIT_ENTITY_TYPES} this is a TypeScript vocabulary rather than a SQL
 * `CHECK`, for the reason §4.1 gives: the list grows by amendment, and a `CHECK` would price each
 * amendment at a recreate of an append-only table that may not be recreated.
 */
export const PLATFORM_AUDIT_ACTIONS = [
  'catalog_place.created',
  'catalog_place.updated',
  'catalog_place.published',
  'catalog_place.retired',
  'catalog_place.status_changed',
  'catalog_place.licence_escalated',
  'catalog_ingest.promoted',
  'catalog_ingest.merged',
  'catalog_ingest.rejected',
  'place_pack.created',
  'place_pack.places_set',
  'place_pack.published',
  'catalog_source.run_started',
  'place_pack.retired',
  'catalog_source.enabled',
  'catalog_source.disabled',
  'platform.user.created',
  'platform.user.updated',
  'platform.user.role_changed',
  'platform.user.banned',
  'platform.user.unbanned',
  'platform.user.deleted',
  'platform.user.password_set',
  'platform.user.email_set',
  'platform.user.impersonation_started',
  'platform.user.impersonation_ended',
  'platform.session.revoked',
  'platform.session.revoked_all',
  'platform.token.issued',
  'platform.token.revoked',
  'platform.share.revoked',
  'provider.limit_changed',
  'provider.policy_changed',
] as const

/** JSON payload shapes stored in `text({ mode: 'json' })` columns. */
export type JsonRecord = Record<string, string | number | boolean | null>
/**
 * The `changes` payload on `platform_audit_log`: the fields that moved, on both sides. Nested by
 * definition, so the flat {@link JsonRecord} the tenant log's `metadata` column uses does not fit
 * it and is deliberately not reused.
 */
export type PlatformAuditChanges = {
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}
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
export type QuotaOverrides = Partial<
  Record<(typeof USAGE_METRICS)[number], number>
>
export type ContinentCounts = Record<string, number>

/* -------------------------------------------------------------------------------------------------
 * Billing — written by the billing provider's webhook handler, read by the quota guards
 * ---------------------------------------------------------------------------------------------- */

export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: pk(),
    organizationId: orgRef(),
    plan: text('plan').notNull().default('free'),
    status: text('status').notNull().default('active'),
    providerCustomerId: text('provider_customer_id'),
    providerSubscriptionId: text('provider_subscription_id'),
    providerProductId: text('provider_product_id'),
    seats: integer('seats').notNull().default(1),
    currency: currency(),
    unitAmountMinor: minor('unit_amount_minor'),
    currentPeriodStart: integer('current_period_start', {
      mode: 'timestamp_ms',
    }),
    currentPeriodEnd: integer('current_period_end', { mode: 'timestamp_ms' }),
    cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' })
      .notNull()
      .default(false),
    canceledAt: integer('canceled_at', { mode: 'timestamp_ms' }),
    trialEndsAt: integer('trial_ends_at', { mode: 'timestamp_ms' }),
    /** Per-tenant quota escapes; unset metrics fall back to the plan defaults. */
    quotaOverrides: text('quota_overrides', {
      mode: 'json',
    }).$type<QuotaOverrides>(),
    seatLimit: integer('seat_limit').notNull().default(10),
    storageLimitBytes: integer('storage_limit_bytes')
      .notNull()
      .default(1_073_741_824),
    /**
     * A plan change the provider has accepted but has not applied yet — an upgrade
     * lands at once, a downgrade waits for the period the customer has paid for to
     * end. All three are null together or set together; a partial triple is read as
     * no scheduled change, because a change we cannot date is one we cannot describe.
     *
     * `pending_plan` holds a **catalogue** plan id (`PLAN_CATALOGUE_IDS` —
     * `free`/`solo`/`crew`), a different vocabulary from the coarse `plan` tier column
     * above. They carry no CHECK constraint, unlike every other enum column in this
     * file, and the exception is deliberate: SQLite cannot attach a constraint to a
     * live table, so drizzle-kit answers one with a `__new_subscriptions` recreate that
     * drops and rebuilds the table — which on D1 would run without the
     * `PRAGMA foreign_keys=OFF` it emits, and would take `subscriptions_status_chk`
     * with it. The value tuples above are enforced by `upsertSubscriptionInput` in
     * `src/server/repos/billing.ts`, which is the only way a row is ever written.
     */
    pendingPlan: text('pending_plan'),
    pendingInterval: text('pending_interval'),
    pendingEffectiveAt: integer('pending_effective_at', {
      mode: 'timestamp_ms',
    }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('subscriptions_org_unq').on(t.organizationId),
    uniqueIndex('subscriptions_provider_subscription_unq').on(
      t.providerSubscriptionId,
    ),
    index('subscriptions_provider_customer_idx').on(t.providerCustomerId),
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
    uniqueIndex('usage_records_org_metric_period_unq').on(
      t.organizationId,
      t.metric,
      t.period,
    ),
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
    countryCodes: text('country_codes', { mode: 'json' }).$type<
      Array<string>
    >(),
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
    isArchived: integer('is_archived', { mode: 'boolean' })
      .notNull()
      .default(false),
    /**
     * @deprecated The favourite is one person's, and lives in `trip_favourites`
     * ({@link tripFavourites}) — one row per person and trip. This column is a single boolean
     * shared by every member, so it records nobody's choice (`CONTEXT.md`, **Favourite**) and no
     * new code may read or write it. It stays rather than being dropped because dropping a column
     * is a table rebuild on SQLite, which docs/DEPLOY.md §5 admits only through the register in
     * its §12.
     *
     * The trips surfaces written before wave 1 still read and write it; moving them onto the
     * table is the whole of what `01-S1` (`docs/plans/01-trips-core.md`) has to move. A `grep`
     * for `isFavourite` names them, and a list kept here would go stale on the first rename.
     */
    isFavourite: integer('is_favourite', { mode: 'boolean' })
      .notNull()
      .default(false),
    /**
     * Non-null while a `trip-copy` job for this trip is in flight; the handler clears it as its
     * last statement. That handler does not exist yet — it lands with `01-S1`
     * (`docs/plans/01-trips-core.md`) and the column ships ahead of it, so nothing reads or writes
     * it today. A timestamp rather than a sixth `status` value, because `trips_status_chk` would
     * have to be rebuilt for that — and it records *when* the copy started, which tells a copy
     * still running apart from one whose consumer died three days ago.
     */
    copyPendingAt: integer('copy_pending_at', { mode: 'timestamp_ms' }),
    /**
     * Which collaboration sub-features this trip shows, keyed by sub-feature id — the same JSON
     * idiom as `share_links.scopes`. Null means nothing has been decided for this trip, which
     * resolves to every sub-feature on, so a rolled-back Worker simply ignores the column. The key
     * vocabulary is validated in `src/server/repos/collab.ts` rather than by a `CHECK` — that
     * validation lands with `07-S2`, and until it does nothing reads or writes the column.
     */
    collabModules: text('collab_modules', { mode: 'json' }).$type<
      Record<string, boolean>
    >(),
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
      sql.raw(
        '("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date")',
      ),
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

/**
 * A person on a trip who has no account: the travelling companion, the child, the friend who was
 * invited by phone. A display name and a colour are the whole identity a guest has.
 *
 * `trip_guests_trip_name_unq` is the **backstop**, not the duplicate-name rule itself. `display_name`
 * carries SQLite's default `BINARY` collation, so the index refuses only a byte-identical name on the
 * same trip. The rule the reader meets — a second guest whose name matches one already on the trip
 * *case-insensitively, after trimming*, refused inline rather than suffixed — lives in the repository,
 * and is `01-S6b`'s (`docs/plans/01-trips-core.md`, stage `01-S6`, decision 7). Adding `COLLATE
 * NOCASE` here would not implement that rule; it would quietly widen a backstop the rule is written
 * against.
 *
 * Shipped ahead of its readers, as a shared-file schema stage does: the guest repository, the
 * participant read model and the guest-into-member merge are all `01-S6b` and land against this
 * table rather than beside it.
 */
export const tripGuests = sqliteTable(
  'trip_guests',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    colour: colour('colour'),
    createdBy: userRef('created_by'),
    ...timestamps(),
  },
  (t) => [
    index('trip_guests_org_trip_idx').on(t.organizationId, t.tripId),
    uniqueIndex('trip_guests_trip_name_unq').on(t.tripId, t.displayName),
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

/**
 * One person's bookmark on a trip they may read: private to them, showing nothing to anyone else
 * and granting nothing (`CONTEXT.md`, **Favourite**). The row's existence *is* the favourite, so
 * unfavouriting is a delete and there is no column a writer could ever update — hence `createdAt()`
 * alone, as `place_tags` and the other immutable join rows in this file do, and not `timestamps()`.
 *
 * Keyless, on the composite `primaryKey()` of `(trip_id, user_id)` like `place_tags` and the other
 * immutable join rows here, and not on a surrogate `id` with the same pair re-imposed as a unique
 * index. `(trip_id, user_id)` *is* the identity of a favourite — a second row for the same pair is
 * not a second favourite, it is the same one — so the key that says so is the one the table should
 * carry. `src/server/repos/base.ts` splits the two shapes at the type level, and keeping this one
 * keyless is what makes `createTenantTableAccess`, not the keyed repository, the access flavour its
 * three verbs reach for.
 *
 * Its reader and writer are `src/server/repos/trip-favourites.ts`. Nothing was backfilled from the
 * deprecated {@link trips.isFavourite}, which holds no person's choice to copy.
 */
export const tripFavourites = sqliteTable(
  'trip_favourites',
  {
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    userId: userRef('user_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.tripId, t.userId] }),
    index('trip_favourites_org_user_idx').on(t.organizationId, t.userId),
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
    isSystem: integer('is_system', { mode: 'boolean' })
      .notNull()
      .default(false),
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
    categoryId: text('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
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
    isVisited: integer('is_visited', { mode: 'boolean' })
      .notNull()
      .default(false),
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
    check(
      'places_rating_chk',
      sql.raw('("rating" IS NULL OR ("rating" BETWEEN 1 AND 5))'),
    ),
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
    enumCheck(
      'day_assignments_transport_mode_chk',
      t.transportMode,
      TRANSPORT_MODES,
    ),
    enumCheck(
      'day_assignments_reservation_status_chk',
      t.reservationStatus,
      RESERVATION_STATUSES,
    ),
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
    /** The long half of a note, below the one-line `body`. Null on every row written before it. */
    detail: text('detail'),
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
    placeId: text('place_id').references(() => places.id, {
      onDelete: 'set null',
    }),
    startDayId: text('start_day_id')
      .notNull()
      .references(() => days.id, { onDelete: 'cascade' }),
    endDayId: text('end_day_id')
      .notNull()
      .references(() => days.id, { onDelete: 'cascade' }),
    /**
     * The booking this stay was made under, so the nights and the confirmation are one fact rather
     * than two. `set null` and never `cascade`: a stay is the record of where somebody slept and
     * outlives the reservation that held it — see
     * `docs/plans/03-reservations-and-transport.md`, `03-S8`.
     */
    reservationId: text('reservation_id').references(() => reservations.id, {
      onDelete: 'set null',
    }),
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
    index('day_accommodations_reservation_idx').on(t.reservationId),
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
    /** The day this leg *departs*. The name is kept for the rows already written. */
    dayId: text('day_id').references(() => days.id, { onDelete: 'set null' }),
    /**
     * The day it lands, when that is a different one. Null on every leg written before it.
     *
     * The `set null` here is the schema's, and the test database — built from this file — has it.
     * The deployed one does not: SQLite's `ADD COLUMN` takes no `ON DELETE` clause, so
     * `0006_mighty_nehzno` left the constraint at `NO ACTION`, where deleting a day a leg names
     * fails rather than nulling the column. So the day deleters in `repos/days.ts` clear it
     * themselves first, through `unlinkTransportsFromDays` (#186).
     */
    arrivalDayId: text('arrival_day_id').references(() => days.id, {
      onDelete: 'set null',
    }),
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
    index('transports_arrival_day_idx').on(t.arrivalDayId),
    // "What lands on this day", asked the only way a repository can ask it: `tenantFilter()` puts
    // `organization_id` in the WHERE clause of every statement, so the tenant column leads. The
    // bare `transports_arrival_day_idx` above predates it and is now redundant under every
    // tenant-scoped read; dropping an index is not additive, so it is reported on #168 rather than
    // removed here.
    index('transports_org_arrival_day_idx').on(
      t.organizationId,
      t.arrivalDayId,
    ),
    // "What departs from this day", the departure half of the same question, and the same reason
    // for the same column order. `transports_day_idx` above is the bare form and cannot serve a
    // tenant-scoped read: with `organization_id` always in the WHERE clause, SQLite prefers an
    // index that can match it, so a day-scoped read landed on `transports_org_trip_idx` and
    // visited every transport of the trip. `trip_id` is carried between the two so the three
    // equality columns beat that index outright rather than tying with it.
    index('transports_org_trip_day_idx').on(
      t.organizationId,
      t.tripId,
      t.dayId,
    ),
    enumCheck('transports_mode_chk', t.mode, TRANSPORT_MODES),
    enumCheck('transports_status_chk', t.status, TRANSPORT_STATUSES),
    nonNegativeCheck('transports_price_chk', t.priceMinor),
    nonNegativeCheck('transports_distance_chk', t.distanceMetres),
  ],
)

/**
 * The legs of one transport record, ordered: N stations make N−1 legs
 * (`docs/plans/03-reservations-and-transport.md`, `03-S2`).
 *
 * **An empty chain is a one-leg journey, not a broken one.** A transport with no rows here is read
 * as a single leg whose endpoints are the record's own `departure_*` and `arrival_*` columns, which
 * is what makes this table additive with no backfill: every journey written before it keeps
 * rendering exactly as it does today, and a rolled-back Worker reads those same columns and ignores
 * a table it does not know. The record's flat endpoint columns keep being written for the first and
 * last station of a chain, so the two representations cannot disagree.
 *
 * **`position` and `sort_order` are different questions and both are needed.** `position` is the
 * 0-based index of a leg *inside its own chain* — leg 2 of 4 — and is what the writer assigns from
 * an array index; `sort_order` is the fractional key that places a leg among everything else
 * happening on a day, which is the shared idiom every other timeline row in this file uses. A chain
 * reordered inside itself and a chain dragged around a day are not the same edit.
 *
 * **No mode and no money, both deliberately.** The mode belongs to the parent record: a leg of a
 * flight is not a different kind of thing from the flight. And a ticket is priced once, on the
 * record — splitting a fare across four legs would invent four numbers nobody was charged — so the
 * price stays on `transports.price_minor` beside its ISO-4217 `currency`.
 *
 * **The `set null` on the two day references is the deployed one**, unlike
 * `transports.arrival_day_id` above: this table arrives by `CREATE TABLE`, which carries the
 * `ON DELETE` clause SQLite's `ADD COLUMN` cannot.
 *
 * Nothing reads or writes this table yet. `03-S2` mints `transportLegsRepository` and the chain
 * writer; this stage ships the shape so that stage has one to compile against.
 */
export const transportLegs = sqliteTable(
  'transport_legs',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    transportId: text('transport_id')
      .notNull()
      .references(() => transports.id, { onDelete: 'cascade' }),
    /** 0-based index in the chain. See the note above on why `sort_order` is not this. */
    position: integer('position').notNull().default(0),
    fromName: text('from_name').notNull(),
    fromCode: text('from_code', { length: 8 }),
    fromLat: real('from_lat'),
    fromLng: real('from_lng'),
    /** IANA zone of the departure endpoint: what makes `departure_time` readable elsewhere. */
    fromTimezone: text('from_timezone'),
    toName: text('to_name').notNull(),
    toCode: text('to_code', { length: 8 }),
    toLat: real('to_lat'),
    toLng: real('to_lng'),
    toTimezone: text('to_timezone'),
    /** The three facts a person reads at a desk, per leg rather than per journey. */
    serviceNumber: text('service_number'),
    platform: text('platform'),
    seat: text('seat'),
    departureDayId: text('departure_day_id').references(() => days.id, {
      onDelete: 'set null',
    }),
    arrivalDayId: text('arrival_day_id').references(() => days.id, {
      onDelete: 'set null',
    }),
    departureDate: text('departure_date'),
    arrivalDate: text('arrival_date'),
    /** Wall-clock `HH:MM` at the endpoint's own zone, never converted on the way in. */
    departureTime: text('departure_time'),
    arrivalTime: text('arrival_time'),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('transport_legs_org_trip_idx').on(t.organizationId, t.tripId),
    index('transport_legs_transport_position_idx').on(
      t.transportId,
      t.position,
    ),
    index('transport_legs_departure_day_idx').on(t.departureDayId),
    index('transport_legs_arrival_day_idx').on(t.arrivalDayId),
    // The two tenant-led forms the day's own read needs, for `transports_org_trip_day_idx`'s
    // reason: the bare day index above cannot be chosen while `organization_id` is in every
    // WHERE clause, so without these a read of one day's legs walked every leg of the trip.
    // The first answers "which legs depart from this day"; the second answers "which of these
    // records has legs at all", which is what keeps a chained journey from being drawn whole.
    index('transport_legs_org_trip_departure_day_idx').on(
      t.organizationId,
      t.tripId,
      t.departureDayId,
    ),
    index('transport_legs_org_transport_idx').on(
      t.organizationId,
      t.transportId,
    ),
    nonNegativeCheck('transport_legs_position_chk', t.position),
    ...latLngChecks('transport_legs_from_lat_chk', t.fromLat, t.fromLng),
    ...latLngChecks('transport_legs_to_lat_chk', t.toLat, t.toLng),
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
    endDayId: text('end_day_id').references(() => days.id, {
      onDelete: 'set null',
    }),
    placeId: text('place_id').references(() => places.id, {
      onDelete: 'set null',
    }),
    assignmentId: text('assignment_id').references(() => dayAssignments.id, {
      onDelete: 'set null',
    }),
    transportId: text('transport_id').references(() => transports.id, {
      onDelete: 'set null',
    }),
    /**
     * The ledger line this booking paid for, so editing a price rewrites one expense instead of
     * leaving a new one behind each time. The link lives on this side because a deleted cost line
     * then unlinks the booking with no code of ours running — see
     * `docs/plans/03-reservations-and-transport.md`, `03-S4`.
     */
    expenseId: text('expense_id').references(() => expenses.id, {
      onDelete: 'set null',
    }),
    /**
     * When a machine wrote this row and nobody has checked it yet — cleared by the first save a
     * person makes. An instant rather than a flag, at the width `read_at` and `onboarded_at`
     * already use, so "unchecked" keeps the date it became true on.
     */
    importedAt: integer('imported_at', { mode: 'timestamp_ms' }),
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
    index('reservations_expense_idx').on(t.expenseId),
    // `tenantFilter()` puts `organization_id` in every WHERE clause, so it leads: this is the
    // index behind "which bookings on this desk has nobody checked yet".
    index('reservations_org_imported_at_idx').on(
      t.organizationId,
      t.importedAt,
    ),
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

/**
 * A cost category a trip defines for itself, beside the fixed `EXPENSE_CATEGORIES` vocabulary.
 *
 * `colour_index` is a position in the shared palette rather than a hex value, so a palette change
 * repaints every trip at once instead of leaving stored colours behind.
 */
export const tripCostCategories = sqliteTable(
  'trip_cost_categories',
  {
    id: pk(),
    organizationId: orgRef(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    colourIndex: integer('colour_index').notNull().default(0),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('trip_cost_categories_org_trip_idx').on(t.organizationId, t.tripId),
    index('trip_cost_categories_trip_sort_idx').on(t.tripId, t.sortOrder),
    nonNegativeCheck('trip_cost_categories_colour_index_chk', t.colourIndex),
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
    placeId: text('place_id').references(() => places.id, {
      onDelete: 'set null',
    }),
    budgetItemId: text('budget_item_id').references(() => budgetItems.id, {
      onDelete: 'set null',
    }),
    category: text('category').notNull().default('other'),
    /**
     * The trip's own category for this expense, when it has one. `set null` rather than a cascade
     * deliberately: a database-level cascade that silently deleted money rows is not something a
     * confirmation dialog can undo. Null until a trip defines categories of its own, and the read
     * path falls back to the `category` enum — which is what keeps that column load-bearing and
     * the rollback honest. Both halves are later stages: `04-S2` ships the resolver, `04-S3` the
     * expense writer that can first set the column, so it is `NULL` on every row today.
     *
     * As with `transports.arrival_day_id`, the deployed constraint is `NO ACTION` rather than
     * `set null` — `0006_mighty_nehzno` added the column, and SQLite's `ADD COLUMN` carries no
     * `ON DELETE` clause. `04-S2` is the stage that first deletes a category, so it is the stage
     * that has to null this column itself.
     */
    costCategoryId: text('cost_category_id').references(
      () => tripCostCategories.id,
      {
        onDelete: 'set null',
      },
    ),
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
    index('expenses_cost_category_idx').on(t.costCategoryId),
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
    isSettled: integer('is_settled', { mode: 'boolean' })
      .notNull()
      .default(false),
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
    /** Amount in the trip currency; the source amount is preserved alongside it. */
    amountMinor: minor('amount_minor').notNull().default(0),
    currency: currency().notNull().default('EUR'),
    /**
     * The three columns below record a payment made in a currency other than the trip's own — the
     * same shape `expenses` carries. All three null is what every row written before them is, and
     * it reads as: paid in the accounting currency, no conversion, implied rate 1. They carry no
     * `CHECK`, because a constraint change rebuilds the table on SQLite; the all-three-or-none
     * rule and the non-negative guard live in `createSettlementInput`
     * (`src/server/repos/expenses.ts`) instead.
     */
    originalAmountMinor: minor('original_amount_minor'),
    originalCurrency: currency('original_currency'),
    exchangeRate: real('exchange_rate'),
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
    check(
      'settlements_distinct_parties_chk',
      sql.raw('"from_user_id" <> "to_user_id"'),
    ),
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
    index('packing_template_items_template_sort_idx').on(
      t.templateId,
      t.sortOrder,
    ),
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
    placeId: text('place_id').references(() => places.id, {
      onDelete: 'set null',
    }),
    reservationId: text('reservation_id').references(() => reservations.id, {
      onDelete: 'set null',
    }),
    transportId: text('transport_id').references(() => transports.id, {
      onDelete: 'set null',
    }),
    expenseId: text('expense_id').references(() => expenses.id, {
      onDelete: 'set null',
    }),
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
    replyToId: text('reply_to_id').references(
      (): AnySQLiteColumn => collabMessages.id,
      {
        onDelete: 'set null',
      },
    ),
    fileId: text('file_id').references(() => tripFiles.id, {
      onDelete: 'set null',
    }),
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
    isPinned: integer('is_pinned', { mode: 'boolean' })
      .notNull()
      .default(false),
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
    options: text('options', { mode: 'json' })
      .$type<Array<PollOption>>()
      .notNull(),
    allowMultiple: integer('allow_multiple', { mode: 'boolean' })
      .notNull()
      .default(false),
    isClosed: integer('is_closed', { mode: 'boolean' })
      .notNull()
      .default(false),
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
    uniqueIndex('collab_poll_votes_poll_user_option_unq').on(
      t.pollId,
      t.userId,
      t.optionId,
    ),
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
    placeId: text('place_id').references(() => places.id, {
      onDelete: 'set null',
    }),
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
    enumCheck(
      'collections_visibility_chk',
      t.visibility,
      COLLECTION_VISIBILITIES,
    ),
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
    categoryId: text('category_id').references(() => categories.id, {
      onDelete: 'set null',
    }),
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
    sourceTripId: text('source_trip_id').references(() => trips.id, {
      onDelete: 'set null',
    }),
    sourcePlaceId: text('source_place_id').references(() => places.id, {
      onDelete: 'set null',
    }),
    savedBy: userRef('saved_by').notNull(),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('collection_places_org_collection_idx').on(
      t.organizationId,
      t.collectionId,
    ),
    index('collection_places_collection_sort_idx').on(
      t.collectionId,
      t.sortOrder,
    ),
    index('collection_places_org_status_idx').on(t.organizationId, t.status),
    index('collection_places_org_country_idx').on(
      t.organizationId,
      t.countryCode,
    ),
    index('collection_places_category_idx').on(t.categoryId),
    index('collection_places_source_trip_idx').on(t.sourceTripId),
    index('collection_places_source_place_idx').on(t.sourcePlaceId),
    enumCheck(
      'collection_places_status_chk',
      t.status,
      COLLECTION_PLACE_STATUSES,
    ),
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
    uniqueIndex('collection_labels_collection_name_unq').on(
      t.collectionId,
      t.name,
    ),
    index('collection_labels_org_collection_idx').on(
      t.organizationId,
      t.collectionId,
    ),
    index('collection_labels_collection_sort_idx').on(
      t.collectionId,
      t.sortOrder,
    ),
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
    tripId: text('trip_id').references(() => trips.id, {
      onDelete: 'set null',
    }),
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
    moodId: text('mood_id').references(() => journeyMoods.id, {
      onDelete: 'set null',
    }),
    checkInId: text('check_in_id').references(() => checkIns.id, {
      onDelete: 'set null',
    }),
    sourceTripId: text('source_trip_id').references(() => trips.id, {
      onDelete: 'set null',
    }),
    sourcePlaceId: text('source_place_id').references(() => places.id, {
      onDelete: 'set null',
    }),
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
    index('journey_entries_org_author_idx').on(
      t.organizationId,
      t.authorUserId,
    ),
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
    entryId: text('entry_id').references(() => journeyEntries.id, {
      onDelete: 'cascade',
    }),
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
    index('visited_countries_org_continent_idx').on(
      t.organizationId,
      t.continent,
    ),
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
    index('visited_regions_org_country_idx').on(
      t.organizationId,
      t.countryCode,
    ),
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
    byContinent: text('by_continent', {
      mode: 'json',
    }).$type<ContinentCounts>(),
    yearStreak: integer('year_streak').notNull().default(0),
    lastTripId: text('last_trip_id').references(() => trips.id, {
      onDelete: 'set null',
    }),
    computedAt: integer('computed_at', { mode: 'timestamp_ms' }).notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('travel_stats_org_user_year_unq').on(
      t.organizationId,
      t.userId,
      t.statYear,
    ),
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
    isAchieved: integer('is_achieved', { mode: 'boolean' })
      .notNull()
      .default(false),
    achievedOn: text('achieved_on'),
    sortOrder: sortOrder(),
    ...timestamps(),
  },
  (t) => [
    index('bucket_list_items_org_user_idx').on(t.organizationId, t.userId),
    index('bucket_list_items_user_achieved_idx').on(t.userId, t.isAchieved),
    index('bucket_list_items_org_country_idx').on(
      t.organizationId,
      t.countryCode,
    ),
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
    blockWeekends: integer('block_weekends', { mode: 'boolean' })
      .notNull()
      .default(true),
    holidaysEnabled: integer('holidays_enabled', { mode: 'boolean' })
      .notNull()
      .default(true),
    companyHolidaysEnabled: integer('company_holidays_enabled', {
      mode: 'boolean',
    })
      .notNull()
      .default(true),
    carryOverEnabled: integer('carry_over_enabled', { mode: 'boolean' })
      .notNull()
      .default(true),
    defaultEntitlementDays: integer('default_entitlement_days')
      .notNull()
      .default(30),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('vacay_plans_org_owner_unq').on(
      t.organizationId,
      t.ownerUserId,
    ),
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
    uniqueIndex('vacay_user_years_plan_user_year_unq').on(
      t.planId,
      t.userId,
      t.year,
    ),
    index('vacay_user_years_org_plan_idx').on(t.organizationId, t.planId),
    index('vacay_user_years_org_user_year_idx').on(
      t.organizationId,
      t.userId,
      t.year,
    ),
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
    uniqueIndex('vacay_entries_plan_user_date_unq').on(
      t.planId,
      t.userId,
      t.date,
    ),
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
    uniqueIndex('vacay_holiday_calendars_plan_region_unq').on(
      t.planId,
      t.region,
    ),
    index('vacay_holiday_calendars_org_plan_idx').on(
      t.organizationId,
      t.planId,
    ),
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
    index('notifications_recipient_created_at_idx').on(
      t.recipientUserId,
      t.createdAt,
    ),
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
    isEnabled: integer('is_enabled', { mode: 'boolean' })
      .notNull()
      .default(true),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('notification_preferences_org_user_event_channel_unq').on(
      t.organizationId,
      t.userId,
      t.eventType,
      t.channel,
    ),
    index('notification_preferences_org_user_idx').on(
      t.organizationId,
      t.userId,
    ),
    enumCheck(
      'notification_preferences_channel_chk',
      t.channel,
      NOTIFICATION_CHANNELS,
    ),
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
    // The catalogue's neutral entry (`src/lib/map/basemap.ts`), spelled out because this file
    // imports nothing outside the schema layer. It was `planned-light`, whose palette is the fixed
    // literal `light` — so once the map started reading this column, every workspace that had never
    // opened the appearance screen rendered a permanently paper map under a dark chrome. `auto` is
    // the entry that follows the resolved theme, which is what the map did before it read anything
    // here. Drizzle inlines a static default into every `INSERT` client-side, so a stale value here
    // would keep writing pinned rows however the DDL reads.
    // `drizzle/0010_basemap_default.sql` carries the matching column default and remaps the rows
    // written under the old one.
    mapStyle: text('map_style').notNull().default('auto'),
    features: text('features', { mode: 'json' }).$type<JsonRecord>(),
    onboardedAt: integer('onboarded_at', { mode: 'timestamp_ms' }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('organization_settings_org_unq').on(t.organizationId),
    enumCheck(
      'organization_settings_distance_unit_chk',
      t.distanceUnit,
      DISTANCE_UNITS,
    ),
    check(
      'organization_settings_week_start_chk',
      sql.raw('"week_starts_on" BETWEEN 0 AND 6'),
    ),
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
    /**
     * The currency this reader wants amounts *shown* in. Null means none has been chosen and every
     * trip renders in its own accounting currency, which is what the costs screen does today — so
     * the column moves no pixel until somebody sets it. No default, for the reason every other
     * override on this table has none: it would make a reader who never chose indistinguishable
     * from one who chose the default.
     */
    displayCurrency: currency('display_currency'),
    weekStartsOn: integer('week_starts_on'),
    dateFormat: text('date_format'),
    distanceUnit: text('distance_unit'),
    mapStyle: text('map_style'),
    accentColour: colour('accent_colour'),
    reduceMotion: integer('reduce_motion', { mode: 'boolean' })
      .notNull()
      .default(false),
    /**
     * Hide confirmation codes on the booking desk until the reader asks for one. A display
     * preference always has an answer, so it is `NOT NULL` with a default — off, because a product
     * that hides the reader's own data on first sight has decided for them.
     */
    maskConfirmationCodes: integer('mask_confirmation_codes', {
      mode: 'boolean',
    })
      .notNull()
      .default(false),
    onboardingCompletedAt: integer('onboarding_completed_at', {
      mode: 'timestamp_ms',
    }),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('user_settings_org_user_unq').on(t.organizationId, t.userId),
    index('user_settings_user_idx').on(t.userId),
    enumCheck('user_settings_theme_chk', t.theme, THEME_PREFERENCES),
    enumCheck(
      'user_settings_distance_unit_chk',
      t.distanceUnit,
      DISTANCE_UNITS,
    ),
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

/* -------------------------------------------------------------------------------------------------
 * Platform tables — global, never tenant-scoped
 *
 * The five global tables declared in this file. None is ever reachable through
 * `createTenantRepository()` or `src/server/repos/base.ts`, and every mutation that touches one
 * takes an explicit platform actor instead of a tenant context.
 *
 * Four of the five carry no `organization_id` at all. `provider_usage` is the exception §5's
 * amendment argues: its column is attribution — which workspace a metered call was made *for* —
 * rather than a tenant discriminator, it is nullable because a cron belongs to no workspace, and it
 * carries no foreign key so that deleting a workspace cannot delete the platform's own accounting.
 *
 * All five are names docs/SPEC.md §5 carves out of "every domain row is scoped by
 * organization_id". `airports` is the twelfth name on that list and joined it by the amendment §5
 * carries, the way `platform_audit_log` and the provider pair joined it before: the list is closed,
 * and a table lands on it by argument rather than by a schema decision taken on the way past. The
 * argument is there and not here - what is worth repeating is its conclusion, that this table has
 * no write path at all, so adding one is a change to that contract.
 * ---------------------------------------------------------------------------------------------- */

/**
 * MCP bearer credentials (docs/CATALOG.md §2.10). A token's authority is its owner's platform
 * role, never a per-token scope list, so there is one authorisation model rather than two.
 *
 * `token_hash` is the lowercase hex `HMAC-SHA256(key = MCP_TOKEN_PEPPER, message = token)`; the
 * plaintext is shown once at creation and never stored. `expires_at` is mandatory — the console
 * offers 30 / 90 / 365 days and nothing unbounded — and revocation sets `revoked_at` rather than
 * deleting the row, so a revoked credential's history stays attributable.
 */
export const staffApiTokens = sqliteTable(
  'staff_api_tokens',
  {
    id: pk(),
    userId: userRef('user_id').notNull(),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    tokenPrefix: text('token_prefix').notNull(),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
    lastUsedIp: text('last_used_ip'),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    createdBy: userRef('created_by').notNull(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('staff_api_tokens_token_hash_unq').on(t.tokenHash),
    index('staff_api_tokens_user_revoked_idx').on(t.userId, t.revokedAt),
    index('staff_api_tokens_expires_at_idx').on(t.expiresAt),
    index('staff_api_tokens_created_by_idx').on(t.createdBy),
  ],
)

/**
 * The platform audit log (docs/ACCESS.md §4.1). Twelve columns and no thirteenth; in particular no
 * `organization_id`, because a platform action belongs to no tenant.
 *
 * Append-only. Rows are never updated, and the only delete path is the retention prune on
 * `created_at`. Its single writer is `src/server/catalog/audit.ts`.
 *
 * **Why `actor_user_id` has no foreign key while `token_id` does.** `userRef()` is a bare text
 * column by house convention, so this file never imports the auth module's schema — see the header
 * of this file. `staff_api_tokens` lives here, so `token_id` carries a real foreign key, and with
 * it the referential guarantee that "everything that arrived on this credential" joins to a row
 * that exists. The two columns sit side by side for that reason and not by oversight.
 *
 * **`token_id` is `on delete restrict`, which is the only action this table can actually take.**
 * docs/ACCESS.md §4.1's type column says `on delete restrict` and its §5 carries the reasoning.
 * The wording it replaced was `on delete set null`, which is unreachable here by construction:
 * SQLite re-evaluates `CHECK` constraints on the implicit
 * `UPDATE` that `SET NULL` performs, and `platform_audit_log_agent_token_chk` demands a non-`NULL`
 * `token_id` on precisely the rows — the `agent` ones — that are the only rows able to reference a
 * token at all. Every `SET NULL` the action could perform therefore violates that `CHECK` and
 * SQLite aborts the whole `DELETE`, so the declared clause and the observed behaviour disagreed:
 * it read as "the history loses its attribution" and did "the delete is refused". `RESTRICT` says
 * what happens, fails with a foreign-key message rather than a constraint the caller did not
 * mention, and changes no outcome — for an append-only log, keeping the `token_id` is the better
 * of the two anyway, and nothing hard-deletes a `staff_api_tokens` row in the first place because
 * revocation writes `revoked_at` (docs/ACCESS.md §5). The earlier divergence from §4.1's wording
 * was reported as a finding and amended there, in that file's own commit; nothing here and in
 * docs/DEPLOY.md §5 disagrees with it any more. The behaviour is pinned by tests in
 * `src/server/db/__tests__/platform-schema.test.ts` rather than left as prose, since it cannot be
 * changed after `0005` ships without a table recreate (docs/DEPLOY.md §5).
 *
 * **Four cross-column `CHECK`s, because the two obvious ones only cover half of each rule.**
 * docs/ACCESS.md §4.1 lists four, and the Notes column they come from states two biconditionals:
 * `actor_user_id` and `actor_role` are `NULL` only when `actor_kind` is `system`, and `token_id`
 * is non-`NULL` *exactly* when `actor_kind` is `agent`. `agent ⇒ token_id NOT NULL` and
 * `system ⇒ everything NULL` are the forward halves; without the converses a `human` row could
 * carry a `token_id` and a `human` or an `agent` row could carry no actor at all, all three
 * accepted by a direct insert.
 * `platform_audit_log_token_agent_only_chk` and `platform_audit_log_actor_identity_chk` close those
 * converses, so the shipped table enforces what §4.1 says rather than a weaker reading of it. The
 * two extra constraints shipped first and §4.1's "two invariants" sentence was amended to four
 * afterwards, as a finding reported against that file and applied in its own commit: an extension
 * of the contract, never a relaxation.
 *
 * All four are declared in the `CREATE TABLE` rather than added later: adding a `CHECK` to an
 * existing table escalates drizzle-kit to a table recreate, which docs/DEPLOY.md §5 counts as
 * non-additive.
 *
 * **`entity_type` and `action` carry no `CHECK`, and are narrowed by `$type` instead.** §4.1's
 * type column marks `actor_kind` as `text, enumCheck()` and `entity_type` as plain `text`, with
 * the eight values in the Notes column; `action` is closed in §4.2 by the same kind of list and is
 * plain `text` too. Both vocabularies grow by amendment, in the commit that adds the code writing
 * the new name, and a `CHECK` would price each of those amendments at a recreate of a table that
 * may not be recreated.
 *
 * That reasoning only holds if the narrowing exists somewhere, so all four vocabulary columns
 * carry `$type`: {@link PLATFORM_AUDIT_ACTIONS} on `action`,
 * {@link PLATFORM_AUDIT_ENTITY_TYPES} on `entity_type`, {@link PLATFORM_ACTOR_KINDS} on
 * `actor_kind` and {@link PLATFORM_ACTOR_ROLES} on `actor_role`. A value outside any of the four
 * fails `pnpm typecheck` at the insert, which is the whole of the guarantee for the two with no
 * `CHECK` behind them and the first line of it for the two that have one. `$type` is a type-level
 * cast that emits no SQL — the `changes` column has carried one since `0005` and generates plain
 * `text` — so adding these moved no migration.
 */
export const platformAuditLog = sqliteTable(
  'platform_audit_log',
  {
    id: pk(),
    /** The human, or the owner of the MCP token. `NULL` only when `actor_kind` is `system`. */
    actorUserId: userRef('actor_user_id'),
    actorKind: text('actor_kind')
      .notNull()
      .$type<(typeof PLATFORM_ACTOR_KINDS)[number]>(),
    /** The platform role held at the moment of the action — `user.role` is mutable, this is not. */
    actorRole:
      text('actor_role').$type<(typeof PLATFORM_ACTOR_ROLES)[number]>(),
    /** The credential the call arrived on. Non-`NULL` exactly when `actor_kind` is `agent`. */
    tokenId: text('token_id').references(() => staffApiTokens.id, {
      onDelete: 'restrict',
    }),
    action: text('action')
      .notNull()
      .$type<(typeof PLATFORM_AUDIT_ACTIONS)[number]>(),
    entityType: text('entity_type')
      .notNull()
      .$type<(typeof PLATFORM_AUDIT_ENTITY_TYPES)[number]>(),
    entityId: text('entity_id'),
    changes: text('changes', { mode: 'json' }).$type<PlatformAuditChanges>(),
    ip: text('ip'),
    /** The request's `User-Agent` header, verbatim, and nothing else. */
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [
    // The §4.4 timeline query filters on (entity_type, entity_id) and orders by created_at, so this
    // three-column index serves it whole and no two-column index is created beside it.
    index('platform_audit_log_entity_idx').on(
      t.entityType,
      t.entityId,
      t.createdAt,
    ),
    index('platform_audit_log_actor_idx').on(t.actorUserId, t.createdAt),
    index('platform_audit_log_action_idx').on(t.action, t.createdAt),
    index('platform_audit_log_token_idx').on(t.tokenId),
    index('platform_audit_log_created_at_idx').on(t.createdAt),
    enumCheck(
      'platform_audit_log_actor_kind_chk',
      t.actorKind,
      PLATFORM_ACTOR_KINDS,
    ),
    // The two forward halves are declared first, deliberately. SQLite reports the first constraint a
    // row violates in declaration order, and a `system` row naming a token breaks a forward rule and
    // a converse one at once; naming it against the kind it claimed to be is the sharper of the two
    // messages. `src/server/db/__tests__/platform-schema.test.ts` pins the order and the names.
    // An agent row names its credential.
    check(
      'platform_audit_log_agent_token_chk',
      sql.raw(`("actor_kind" <> 'agent' OR "token_id" IS NOT NULL)`),
    ),
    // A system row names no actor, no role and no credential.
    check(
      'platform_audit_log_system_actor_chk',
      sql.raw(
        `("actor_kind" <> 'system' OR ("actor_user_id" IS NULL AND "actor_role" IS NULL AND "token_id" IS NULL))`,
      ),
    ),
    // Nothing but an agent row may name a credential.
    check(
      'platform_audit_log_token_agent_only_chk',
      sql.raw(`("token_id" IS NULL OR "actor_kind" = 'agent')`),
    ),
    // Every kind but system names both an actor and the role it held at the time.
    check(
      'platform_audit_log_actor_identity_chk',
      sql.raw(
        `("actor_kind" = 'system' OR ("actor_user_id" IS NOT NULL AND "actor_role" IS NOT NULL))`,
      ),
    ),
  ],
)

/**
 * The per-provider ceiling and what happens when it is reached (the plan's `provider_registry`).
 *
 * Configuration, not measurement: the counters live in {@link providerUsage} and nothing here is
 * derived from them. Its single writer is `src/server/catalog/provider-usage.ts`, where every
 * mutation takes an explicit platform actor, passes `requirePermission({ provider: ['configure'] })`
 * and appends a `platform_audit_log` row in the same call — the full clause set docs/SPEC.md §5
 * holds a global table to.
 *
 * **A missing row is the open state**, not a broken one. Absence reads as
 * `{ policy: 'allow', callLimit: null }`, so the day this table ships empty every existing call
 * still goes through, no seed step has to run, and `drizzle/` stays free of inserted data. Saving a
 * ceiling in the console is what creates the row.
 *
 * **`slug` carries no `CHECK`**, unlike almost every other vocabulary column in this file. An
 * operator agrees a ceiling with a vendor before we write the client — that is the whole point of
 * naming `here` and `workers-ai` in {@link PLANNED_PROVIDERS} — and a constraint generated from a
 * tuple in this file would make the configuration step wait on a deploy. It is also what makes
 * adopting a slug free: `geoapify` moved lists with no migration behind it.
 *
 * **`blockable` is a safety interlock, not a preference.** A provider whose feature has no fallback
 * must not be stoppable by a control on a settings screen: blocking `polar` would stop checkout, so
 * it would stop revenue in order to save a metering line. The refusal is enforced server-side in
 * `updateProviderLimit`, so it holds however the mutation is reached, and this column is what makes
 * the refusal a fact about the provider rather than a rule someone has to remember.
 */
export const providerRegistry = sqliteTable(
  'provider_registry',
  {
    id: pk(),
    slug: text('slug').notNull(),
    label: text('label').notNull(),
    // `limit_window`, never `window`: SQLite reserves `WINDOW` as a keyword, and a bare column of
    // that name has to be quoted in every statement that touches it for ever.
    limitWindow: text('limit_window')
      .notNull()
      .default('month')
      .$type<(typeof PROVIDER_LIMIT_WINDOWS)[number]>(),
    /** `NULL` is "no ceiling agreed", which is different from a ceiling of zero. */
    callLimit: integer('call_limit'),
    policy: text('policy')
      .notNull()
      .default('allow')
      .$type<(typeof PROVIDER_LIMIT_POLICIES)[number]>(),
    warnPercent: integer('warn_percent').notNull().default(70),
    criticalPercent: integer('critical_percent').notNull().default(90),
    /** `false` forbids `policy = 'block'` on this provider. See the note above. */
    blockable: integer('blockable', { mode: 'boolean' })
      .notNull()
      .default(true),
    notes: text('notes'),
    updatedBy: userRef('updated_by'),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('provider_registry_slug_unq').on(t.slug),
    enumCheck(
      'provider_registry_policy_chk',
      t.policy,
      PROVIDER_LIMIT_POLICIES,
    ),
    enumCheck(
      'provider_registry_window_chk',
      t.limitWindow,
      PROVIDER_LIMIT_WINDOWS,
    ),
    nonNegativeCheck('provider_registry_call_limit_chk', t.callLimit),
    // Thresholds inside the scale and in order, or the meters on screen lie about themselves: a
    // warn step above the critical one paints a bar green on its way past the ceiling.
    check(
      'provider_registry_thresholds_chk',
      sql.raw(
        `("warn_percent" BETWEEN 1 AND 100 AND "critical_percent" BETWEEN 1 AND 100 AND "warn_percent" <= "critical_percent")`,
      ),
    ),
  ],
)

/**
 * One counter per provider, operation, time bucket and — where there is one — workspace.
 *
 * The one table in this file whose writer holds neither of docs/SPEC.md §5's two clauses, and the
 * amendment there says why rather than reading them loosely: a meter tick records a call the
 * platform has *already made*, so there is no session to authorise and nothing a "who changed
 * what" row could describe, and one audit row per outbound call would put a request-rate stream
 * into a 400-day ledger. What guards it instead is the shape of what it writes — single-writer
 * (`src/server/catalog/provider-usage.ts`), system-actor-only, monotonic, and carrying no
 * tenant-readable field: a slug, an operation name, a bucket and three integers.
 *
 * **`organization_id` is attribution, not a tenant discriminator**, which is why it is a bare
 * `text` column in the {@link userRef} style rather than {@link orgRef}. Neither half of `orgRef`
 * fits. `NULL` is the ordinary case — a cron backup and a platform email belong to no workspace,
 * and inventing one to fill the column would be the fabricated tenant context §5 forbids. And a
 * cascade would delete the platform's own accounting when a workspace is deleted, though the calls
 * were made and the money was spent; `SET NULL` would be worse still, collapsing a deleted
 * workspace's rows onto the platform bucket and failing the delete on a unique index the caller
 * never mentioned.
 *
 * **Two partial unique indexes rather than one**, and this is the reason they exist: SQLite treats
 * `NULL`s as distinct inside a `UNIQUE` index, so a single index spanning the nullable column
 * would accept unlimited duplicate platform rows and the upsert would quietly stop being an
 * upsert. The counter would keep looking plausible while being wrong, which is the failure a
 * counter has no way of reporting.
 */
export const providerUsage = sqliteTable(
  'provider_usage',
  {
    id: pk(),
    // `$type`-narrowed rather than `CHECK`-constrained, for the reason `platform_audit_log.action`
    // gives: the vocabulary grows by amendment, and a `CHECK` prices each one at a table recreate.
    provider: text('provider')
      .notNull()
      .$type<(typeof METERED_PROVIDERS)[number]>(),
    operation: text('operation').notNull(),
    grain: text('grain')
      .notNull()
      .default('hour')
      .$type<(typeof PROVIDER_USAGE_GRAINS)[number]>(),
    /** `YYYY-MM-DDTHH` at `hour`, `YYYY-MM` at `month`. UTC, so lexicographic is chronological. */
    bucket: text('bucket').notNull(),
    organizationId: text('organization_id'),
    /** Calls that reached the provider, whatever they answered. */
    calls: integer('calls').notNull().default(0),
    /** The subset of `calls` that failed. Never counted twice — an error is a call. */
    errors: integer('errors').notNull().default(0),
    /** Calls refused at our own gate. Demand that was turned away, so not part of `calls`. */
    blocked: integer('blocked').notNull().default(0),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('provider_usage_tenant_unq')
      .on(t.grain, t.provider, t.operation, t.bucket, t.organizationId)
      .where(sql`"organization_id" IS NOT NULL`),
    uniqueIndex('provider_usage_platform_unq')
      .on(t.grain, t.provider, t.operation, t.bucket)
      .where(sql`"organization_id" IS NULL`),
    // The console's two reads: one provider across a window, and one workspace's share of it.
    index('provider_usage_window_idx').on(t.grain, t.provider, t.bucket),
    index('provider_usage_org_idx').on(t.organizationId, t.grain, t.bucket),
    enumCheck('provider_usage_grain_chk', t.grain, PROVIDER_USAGE_GRAINS),
    // A bucket whose shape disagrees with its grain makes every window query silently wrong: the
    // string still sorts, still compares, and selects the wrong rows. 13 = `YYYY-MM-DDTHH`, 7 =
    // `YYYY-MM`.
    check(
      'provider_usage_bucket_grain_chk',
      sql.raw(
        `(("grain" = 'hour' AND length("bucket") = 13) OR ("grain" = 'month' AND length("bucket") = 7))`,
      ),
    ),
    nonNegativeCheck('provider_usage_calls_chk', t.calls),
    nonNegativeCheck('provider_usage_errors_chk', t.errors),
    nonNegativeCheck('provider_usage_blocked_chk', t.blocked),
  ],
)

/**
 * The airport reference dataset behind the endpoint type-ahead (`03-S2`, PRD #167 decision 4).
 *
 * **It carries no `organization_id`, and that is the point.** An airport belongs to no workspace,
 * so there is no tenant discriminator for a filter to be forgotten on — the single stated exception
 * to the tenant-scoped repository rule (`CLAUDE.md`, docs/SPEC.md §6). Reads go through
 * `src/server/catalog/**` when `03-S2` writes them, never through `createTenantRepository()`.
 *
 * **A build-time artefact, not a provider.** The rows are loaded from a committed artefact built
 * from a pinned public-domain source, so nothing here is fetched at runtime and no licence follows
 * a request. That is also why `id` is the artefact's own stable identifier rather than a fresh
 * {@link newId} on every load: the build has to be byte-identical from one run to the next, and a
 * random primary key would make it differ for no reason. `pk()`'s default stands behind a loader
 * that does not supply one, and a loader that does not supply one is a defect in the loader.
 *
 * **The type-ahead is a shortcut over free text and never a gate in front of it.** A traveller may
 * type a code this catalogue does not hold — an airport that opened after our last build — and
 * choose the zone themselves; nothing in the write path resolves against this table. So both codes
 * are nullable: most airports in a public-domain dataset carry no IATA code at all, and SQLite
 * treats `NULL`s inside a `UNIQUE` index as distinct, which is what lets one plain unique index
 * hold "one row per code" and "thousands of rows with no code" at the same time.
 *
 * Ships empty, and is filled out of band: the migration creates the shape and
 * `scripts/seed/airports.mjs` loads the committed artefact
 * `public/atlas/airports-iata.v1.txt` into it - `pnpm db:airports:local` in a checkout, and a
 * step of both deploy workflows on a deployed database. Nothing in the request path ever
 * writes here.
 */
export const airports = sqliteTable(
  'airports',
  {
    id: pk(),
    /** IATA three-letter code, the one a traveller types. Null for most of the dataset. */
    iataCode: text('iata_code', { length: 3 }),
    /** ICAO four-letter code, which the source dataset keys on. */
    icaoCode: text('icao_code', { length: 4 }),
    name: text('name').notNull(),
    city: text('city'),
    /** ISO-3166-1 alpha-2, the same vocabulary `trips.country_codes` carries. */
    countryCode: text('country_code', { length: 2 }),
    /** IANA zone name: the fourth field a resolved code fills in, and the one that reads a time. */
    timezone: text('timezone'),
    ...geo(),
    ...timestamps(),
  },
  (t) => [
    uniqueIndex('airports_iata_unq').on(t.iataCode),
    uniqueIndex('airports_icao_unq').on(t.icaoCode),
    // The type-ahead matches a prefix of the code, the name or the city. SQLite can only turn
    // `LIKE 'term%'` into an indexed range scan when the index collation matches the comparison,
    // and with `case_sensitive_like` off that means NOCASE — which is why the prefix probes get
    // their own indexes and do not ride the unique ones. The unique indexes stay BINARY: they
    // serve `findAirportByCode`'s exact lookup, which compares with the column's own collation.
    index('airports_iata_prefix_idx').on(sql`${t.iataCode} COLLATE NOCASE`),
    index('airports_icao_prefix_idx').on(sql`${t.icaoCode} COLLATE NOCASE`),
    index('airports_name_idx').on(sql`${t.name} COLLATE NOCASE`),
    index('airports_city_idx').on(sql`${t.city} COLLATE NOCASE`),
    ...latLngChecks('airports_lat_chk', t.lat, t.lng),
  ],
)
