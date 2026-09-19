/**
 * Billing domain types and the runtime contract every billing operation runs against.
 *
 * Nothing in this file touches the Cloudflare runtime, Drizzle, or Polar's network
 * layer, which is what makes the entitlement and webhook logic unit-testable with
 * plain fakes. The platform bindings are wired in `runtime.cloudflare.ts`.
 *
 * `provider*` rather than `polar*` throughout: these names describe the row and the
 * queue envelope, both of which outlive any one payment provider, and the migration
 * away from the previous one is the proof that they do.
 */

import type {
  BillingInterval,
  BillingState,
  LimitKey,
  ModuleKey,
  PlanId,
  PlanLimits,
  QuotaKey,
  SubscriptionStatus,
} from '#/lib/plans'
import type { StoredCeilings } from './limits'

/* ----------------------------------------------------------------- persistence */

/**
 * The organization's billing state as we persist it.
 *
 * One row per organization in the `subscriptions` table. Free organizations either
 * have no row at all or a row whose status no longer entitles them, and both cases
 * resolve to the Free plan through `planFor()`.
 */
export interface SubscriptionRecord {
  readonly organizationId: string
  readonly planId: PlanId
  readonly status: SubscriptionStatus
  readonly interval: BillingInterval | null
  /** Seats billed on the subscription. Always at least 1. */
  readonly seats: number
  /** Polar customer id — `provider_customer_id` on the row. */
  readonly providerCustomerId: string | null
  /** Polar subscription id — `provider_subscription_id` on the row. */
  readonly providerSubscriptionId: string | null
  /** Polar **product** id, a UUID — `provider_product_id` on the row. */
  readonly providerProductId: string | null
  readonly currentPeriodStart: Date | null
  readonly currentPeriodEnd: Date | null
  readonly cancelAtPeriodEnd: boolean
  readonly trialEndsAt: Date | null
  readonly canceledAt: Date | null
  /**
   * A change Polar has accepted but not yet applied — see {@link PendingPlanChange}.
   *
   * Persisted, since the `pending_plan`, `pending_interval` and `pending_effective_at`
   * columns landed beside the mapper's `pending_update`: a scheduled change now
   * survives a page reload rather than only the redirect that follows it.
   *
   * Omitting it means the same thing as `null` — nothing is scheduled — and the store
   * writes the three columns to SQL `NULL` either way. Omission can therefore never
   * *preserve* a schedule that Polar has applied or superseded; only naming a change
   * keeps one, which is the direction a mistake should fail in.
   */
  readonly pendingChange?: PendingPlanChange | null
  /**
   * The per-tenant ceilings the row carries — the last word on effective limits, and
   * the reason a customer can be grandfathered above the plan they pay for. A record
   * synthesised from a Polar subscription rather than read back from the table
   * carries the ceilings its plan writes (`ceilingsForPlan`), which is exactly what
   * will be persisted, so the two paths cannot drift.
   */
  readonly ceilings: StoredCeilings
}

/** Tenant-scoped persistence for billing state. Implemented over Drizzle/D1. */
export interface SubscriptionStore {
  findByOrganization: (organizationId: string) => Promise<SubscriptionRecord | null>
  findByProviderCustomerId: (
    providerCustomerId: string,
  ) => Promise<SubscriptionRecord | null>
  findByProviderSubscriptionId: (
    providerSubscriptionId: string,
  ) => Promise<SubscriptionRecord | null>
  /** Insert or replace the organization's row wholesale. */
  upsert: (record: SubscriptionRecord) => Promise<void>
  /** Attach a provider customer to an organization before any subscription exists. */
  attachCustomer: (organizationId: string, providerCustomerId: string) => Promise<void>
  /** Narrow status-only write used by invoice events. */
  updateStatus: (
    organizationId: string,
    status: SubscriptionStatus,
    changedAt: Date,
  ) => Promise<void>
}

/* ------------------------------------------------------------------------ usage */

/** What an organization is currently consuming, measured live. */
export interface UsageSnapshot {
  readonly seats: number
  readonly trips: number
  readonly storageBytes: number
}

export interface UsageReader {
  read: (organizationId: string) => Promise<UsageSnapshot>
}

export const EMPTY_USAGE: UsageSnapshot = { seats: 0, trips: 0, storageBytes: 0 }

/* --------------------------------------------------------------- platform seams */

/**
 * The slice of Workers KV billing uses. A real `KVNamespace` satisfies it, and so
 * does an in-memory map in tests.
 */
export interface BillingCache {
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>
  delete: (key: string) => Promise<void>
}

/** Follow-up work a webhook hands off so it can answer the provider immediately. */
export type BillingTask =
  | {
      readonly kind: 'billing.subscription.changed'
      readonly organizationId: string
      readonly planId: PlanId
      readonly previousPlanId: PlanId
      readonly status: SubscriptionStatus
      /** Polar delivers the event id in the `webhook-id` header, not in the body. */
      readonly providerEventId: string
    }
  | {
      readonly kind: 'billing.invoice.paid'
      readonly organizationId: string
      /** Polar order id. An order is what Polar calls a paid invoice. */
      readonly providerOrderId: string
      readonly amountPaid: number
      readonly currency: string
      readonly providerEventId: string
    }

/** The slice of a Cloudflare Queue billing uses. */
export interface BillingTaskQueue {
  send: (message: BillingTask) => Promise<void>
}

/** Structured log sink; the Cloudflare adapter forwards to Workers Observability. */
export interface BillingLogger {
  info: (message: string, fields?: Readonly<Record<string, unknown>>) => void
  warn: (message: string, fields?: Readonly<Record<string, unknown>>) => void
  error: (message: string, fields?: Readonly<Record<string, unknown>>) => void
}

/* ------------------------------------------------------------------ the provider */

/**
 * Metadata we write onto every Polar object we create, and read back off the ones
 * Polar sends us.
 *
 * Polar metadata values may be strings, integers, floats or booleans — unlike the
 * string-only maps of the provider before it — so the seat count travels as a number
 * and needs no parsing on the way back. It is a *cross-check* and never the primary
 * source of attribution: `customer.external_id` is, because Polar guarantees it is
 * unique per organization and copies it onto every object in the chain.
 */
export interface ProviderBillingMetadata {
  readonly organizationId: string
  readonly planId: PlanId
  readonly interval: BillingInterval
  readonly seats: number
}

/** One call against Polar's REST API. */
export interface PolarRequest {
  readonly method: 'GET' | 'POST' | 'PATCH'
  /**
   * Path from the API root. Polar's collection endpoints answer a request without
   * the trailing slash with a 307, which costs a subrequest and can drop the
   * `Authorization` header, so the slash is part of the path and not optional.
   */
  readonly path: string
  readonly query?: Readonly<Record<string, string | number>>
  readonly body?: unknown
}

/**
 * The Polar REST surface, as one method.
 *
 * Deliberately not a facade of named operations: keeping the path on the call site
 * is what lets the checkout and invoice tests assert *which* endpoint was hit and
 * with what body, which is the only thing standing between a Crew subscription and
 * being billed as one seat. The response is `unknown` because a third party's JSON
 * is untrusted input; every caller parses it with Zod before believing a field.
 */
export interface PolarClient {
  request: (request: PolarRequest) => Promise<unknown>
}

/* ---------------------------------------------------------------------- runtime */

/** Everything a billing operation needs, injected rather than imported. */
export interface BillingRuntime {
  readonly polar: PolarClient
  /** Standard Webhooks signing secret for the billing endpoint. */
  readonly webhookSecret: string
  /** Absolute origin used to build Polar return URLs, no trailing slash. */
  readonly appUrl: string
  readonly subscriptions: SubscriptionStore
  readonly usage: UsageReader
  readonly cache: BillingCache
  readonly tasks: BillingTaskQueue
  readonly logger: BillingLogger
  /** Injected clock so trials and period maths are testable. */
  readonly now: () => Date
  /**
   * Paged `GET /v1/discounts/` requests allowed per minute across every tenant — a fifth of the
   * environment's Polar rate limit (DEPLOY.md §9.2), so promotion-code lookups can never starve
   * the rest of billing on the one token every tenant shares. `discountLookupBudgetFor()` in
   * `./discounts` derives it from `POLAR_SERVER`.
   */
  readonly discountLookupBudget: number
}

/** A billing runtime narrowed to one tenant. Everything quota-related takes this. */
export interface BillingContext {
  readonly runtime: BillingRuntime
  readonly organizationId: string
}

export function billingContext(
  runtime: BillingRuntime,
  organizationId: string,
): BillingContext {
  return { runtime, organizationId }
}

/** Who is asking. Resolved from the session before any billing mutation runs. */
export interface BillingIdentity {
  readonly userId: string
  readonly userEmail: string
  readonly userName: string | null
  readonly organizationId: string
  readonly organizationName: string
  readonly role: 'owner' | 'admin' | 'member'
  /**
   * The client address (`cf-connecting-ip`), or `null` outside a request. Read only by the
   * promotion-code limiter, which counts per address because accounts are free to mint.
   */
  readonly clientIp?: string | null
}

/** Only owners and admins may spend the organization's money. */
export function canManageBilling(identity: BillingIdentity): boolean {
  return identity.role === 'owner' || identity.role === 'admin'
}

/* ----------------------------------------------------------------- entitlements */

export interface QuotaState {
  readonly key: QuotaKey
  readonly limit: number | null
  readonly used: number
  readonly remaining: number | null
  /** 0…1 for meters. Unlimited quotas read as 0. */
  readonly ratio: number
  readonly exceeded: boolean
}

/**
 * A plan change Polar has scheduled for the start of the next billing period.
 *
 * Polar applies an upgrade at once and defers a downgrade: the subscription keeps
 * its current product, seats and entitlements until `effectiveAt`, and carries a
 * non-null `pending_update` describing what it becomes. So this is what the customer
 * moves *to*, never what they are on now — a screen that renders it as the current
 * plan tells them they have lost a plan they are still paying for.
 *
 * `effectiveAt` is a real `Date` rather than the ISO string every other instant on
 * {@link Entitlements} uses. TanStack Start serialises server-function results with
 * seroval, which encodes `Date` natively, so it arrives in the browser as a `Date`.
 * KV round-trips through `JSON.stringify`, which a `Date` does not survive, so the
 * cached half is the *same* declaration at `TInstant = string` rather than a second
 * interface — see {@link CachedPendingPlanChange}. One set of field names, one place
 * to change them, and no way for the two halves to drift into disagreeing shapes.
 */
export interface PendingPlanChange<TInstant extends Date | string = Date> {
  readonly planId: PlanId
  readonly interval: BillingInterval
  readonly effectiveAt: TInstant
}

/**
 * The whole entitlement picture for one organization.
 *
 * Every field crosses the server-function boundary untouched — dates are ISO
 * strings, unlimited quotas are `null`. `pendingChange.effectiveAt` is the one
 * documented exception and the reason it is one is written on it.
 */
export interface Entitlements {
  readonly organizationId: string
  /** The catalogue plan the customer bought — what the screen names them as. */
  readonly planId: PlanId
  readonly planName: string
  readonly status: BillingState
  readonly interval: BillingInterval | null
  readonly seats: number
  /**
   * The limits **in force**, from `resolveLimits()` — not the plan's published numbers.
   * A grandfathered workspace is named after its plan and metered against its row, so
   * these are the same numbers `assertQuota()` enforces in the repositories.
   */
  readonly limits: PlanLimits
  readonly usage: UsageSnapshot
  readonly quotas: { readonly [K in QuotaKey]: QuotaState }
  readonly cancelAtPeriodEnd: boolean
  readonly currentPeriodEnd: string | null
  readonly trialEndsAt: string | null
  /** True while a trial is running, so the UI can count down. */
  readonly trialing: boolean
  readonly hasProviderCustomer: boolean
  /**
   * The change Polar will apply at the start of the next period, or `null`.
   *
   * Non-null only while a scheduled change is genuinely still ahead of us: an
   * immediate upgrade leaves it `null`, and so does a scheduled change whose date
   * has already passed, because at that point Polar has applied it and the fields
   * above already describe it.
   */
  readonly pendingChange: PendingPlanChange | null
}

/**
 * {@link PendingPlanChange} as it survives the KV round trip: the instant is an
 * ISO-8601 string, because the cache entry is `JSON.stringify`d and a `Date` would
 * come back a string and fail the schema — which `loadPlanState()` would then treat
 * as a miss, quietly turning the cache off instead of throwing.
 */
export type CachedPendingPlanChange = PendingPlanChange<string>

/**
 * The cached half of an entitlement lookup: the plan state, which only changes when
 * Polar tells us it has. Usage is always read live so a tenant cannot burst past a
 * quota inside the cache window.
 */
export interface CachedPlanState {
  readonly planId: PlanId
  readonly status: BillingState
  readonly interval: BillingInterval | null
  readonly seats: number
  readonly cancelAtPeriodEnd: boolean
  readonly currentPeriodEnd: string | null
  readonly trialEndsAt: string | null
  readonly hasProviderCustomer: boolean
  /** The scheduled change, or `null`. Dropped with the plan when a status lapses. */
  readonly pendingChange: CachedPendingPlanChange | null
  /**
   * The row's own ceilings, cached alongside the plan because they change on exactly
   * the same events. `null` for a tenant with nothing to escape with — no row, or a row
   * whose status has stopped entitling it, since a lapsed subscription grandfathers
   * nothing. Only integers and a small record of integers, so it stays JSON-safe.
   */
  readonly ceilings: StoredCeilings | null
}

/* ----------------------------------------------------------------------- errors */

/** A deployment is missing a secret or a product id. Never shown to a customer. */
export class BillingConfigError extends Error {
  override readonly name = 'BillingConfigError'
}

/** The signature on an inbound webhook did not verify. */
export class WebhookVerificationError extends Error {
  override readonly name = 'WebhookVerificationError'
}

/** The caller is not allowed to manage this organization's billing. */
export class BillingForbiddenError extends Error {
  override readonly name = 'BillingForbiddenError'
}

export interface QuotaViolation {
  readonly key: QuotaKey
  readonly planId: PlanId
  readonly limit: number
  readonly used: number
  readonly requested: number
}

/** A write would push the tenant past a countable plan limit. */
export class QuotaExceededError extends Error {
  override readonly name = 'QuotaExceededError'
  readonly violation: QuotaViolation

  constructor(violation: QuotaViolation, message: string) {
    super(message)
    this.violation = violation
  }
}

export interface FeatureLock {
  readonly key: ModuleKey
  readonly planId: PlanId
}

/** The tenant's plan does not include the module they tried to use. */
export class FeatureLockedError extends Error {
  override readonly name = 'FeatureLockedError'
  readonly lock: FeatureLock

  constructor(lock: FeatureLock, message: string) {
    super(message)
    this.lock = lock
  }
}

export type LimitAssertionKey = LimitKey
