/**
 * The planned.travel plan catalogue.
 *
 * This module is **isomorphic** — it is safe to import from browser code. It contains
 * no secrets: Polar *product* identifiers are public (they ship in every client-side
 * checkout integration), so they are supplied through Vite's `VITE_`-prefixed
 * environment variables and inlined at build time.
 *
 * The catalogue is the single source of truth for what a subscription is allowed to
 * do. The server always resolves a product id from this file — never from a value the
 * client sent — so a tampered request can only ever ask for a plan that exists here.
 */

declare global {
  interface ImportMetaEnv {
    readonly VITE_POLAR_PRODUCT_SOLO_MONTHLY?: string
    readonly VITE_POLAR_PRODUCT_SOLO_YEARLY?: string
    readonly VITE_POLAR_PRODUCT_CREW_MONTHLY?: string
    readonly VITE_POLAR_PRODUCT_CREW_YEARLY?: string
  }
}

/* ------------------------------------------------------------------ identities */

export const BILLING_INTERVALS = ['monthly', 'yearly'] as const
export type BillingInterval = (typeof BILLING_INTERVALS)[number]

export const PLAN_IDS = ['free', 'solo', 'crew'] as const
export type PlanId = (typeof PLAN_IDS)[number]

/**
 * Subscription statuses we persist and reason about. The eight values are Polar's
 * `SubscriptionStatus` enum, one for one, and the `subscriptions_status_chk` CHECK
 * constraint in `src/server/db/schema.ts` mirrors them: dropping one here would make
 * a legitimate webhook fail on write rather than fail a type check.
 */
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
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

/**
 * Every billing state an organization can be in, including our own `none` sentinel
 * for an organization that has never had a subscription. Polar never sends `none`.
 */
export const BILLING_STATES = [...SUBSCRIPTION_STATUSES, 'none'] as const
export type BillingState = (typeof BILLING_STATES)[number]

/**
 * Statuses that still grant the paid plan. `past_due` keeps access during dunning so
 * a failed card does not lock a traveller out mid-trip; `unpaid` and `paused` do not.
 */
const ENTITLING_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  'trialing',
  'active',
  'past_due',
])

export function isPlanId(value: unknown): value is PlanId {
  return (
    typeof value === 'string' &&
    (PLAN_IDS as ReadonlyArray<string>).includes(value)
  )
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return (
    typeof value === 'string' &&
    (BILLING_INTERVALS as ReadonlyArray<string>).includes(value)
  )
}

export function isSubscriptionStatus(
  value: unknown,
): value is SubscriptionStatus {
  return (
    typeof value === 'string' &&
    (SUBSCRIPTION_STATUSES as ReadonlyArray<string>).includes(value)
  )
}

export function isBillingState(value: unknown): value is BillingState {
  return (
    typeof value === 'string' &&
    (BILLING_STATES as ReadonlyArray<string>).includes(value)
  )
}

/** True when a subscription in this status should still receive its paid plan. */
export function isEntitlingStatus(value: unknown): boolean {
  return isSubscriptionStatus(value) && ENTITLING_STATUSES.has(value)
}

/* ---------------------------------------------------------------------- limits */

/** Countable limits. `null` means unlimited (JSON-safe, unlike `Infinity`). */
export interface PlanQuotas {
  /** Seats billed on the subscription — how many people may join the organization. */
  readonly seats: number | null
  /** Trips the organization may keep at once. */
  readonly trips: number | null
  /** Total bytes of uploaded files and photos. */
  readonly storageBytes: number | null
}

/** Feature switches. */
export interface PlanModules {
  readonly itinerary: boolean
  readonly map: boolean
  readonly budget: boolean
  readonly packing: boolean
  readonly reservations: boolean
  readonly journal: boolean
  readonly atlas: boolean
  /** Invite other people to a trip at all. */
  readonly collaboration: boolean
  /** Live cursors and instant sync through the per-trip Durable Object. */
  readonly realtime: boolean
  /** #1166: dormant and hidden until a feature ships; removal is plan 08's price-list decision. */
  readonly offlineMaps: boolean
  readonly pdfExport: boolean
  readonly prioritySupport: boolean
}

export interface PlanLimits extends PlanQuotas, PlanModules {}

export type QuotaKey = keyof PlanQuotas
export type ModuleKey = keyof PlanModules
export type LimitKey = keyof PlanLimits

export const QUOTA_KEYS = [
  'seats',
  'trips',
  'storageBytes',
] as const satisfies ReadonlyArray<QuotaKey>

export const MODULE_KEYS = [
  'itinerary',
  'map',
  'budget',
  'packing',
  'reservations',
  'journal',
  'atlas',
  'collaboration',
  'realtime',
  'offlineMaps',
  'pdfExport',
  'prioritySupport',
] as const satisfies ReadonlyArray<ModuleKey>

export function isQuotaKey(key: LimitKey): key is QuotaKey {
  return (QUOTA_KEYS as ReadonlyArray<string>).includes(key)
}

export function isModuleKey(key: LimitKey): key is ModuleKey {
  return (MODULE_KEYS as ReadonlyArray<string>).includes(key)
}

/** Human labels for the three metered quotas, used by usage meters. */
export const QUOTA_LABELS: { readonly [K in QuotaKey]: string } = {
  seats: 'Members',
  trips: 'Trips',
  storageBytes: 'Storage',
}

/* ----------------------------------------------------------------------- plans */

export interface PlanPrice {
  readonly interval: BillingInterval
  /** Polar product id. Empty string when the deployment has not configured it yet. */
  readonly productId: string
  /** Amount in minor units per billing period — per seat when `perSeat` is true. */
  readonly amount: number
  readonly currency: 'usd'
  readonly perSeat: boolean
}

export interface PlanFeature {
  readonly label: string
  /** Optional second line shown beneath the bullet in plan comparison cards. */
  readonly detail?: string
}

export interface Plan {
  readonly id: PlanId
  readonly name: string
  /** One short line under the plan name on a comparison card. */
  readonly tagline: string
  /** A full sentence for settings screens and marketing pages. */
  readonly description: string
  /** True when the subscription bills one unit per member rather than a flat fee. */
  readonly seatBased: boolean
  readonly seatRange: { readonly min: number; readonly max: number | null }
  /** Free-trial length applied on a customer's first paid subscription. */
  readonly trialDays: number
  /** The plan we visually lead with. */
  readonly recommended: boolean
  readonly prices: { readonly [I in BillingInterval]: PlanPrice | null }
  readonly features: ReadonlyArray<PlanFeature>
  readonly limits: PlanLimits
}

const MEGABYTE = 1024 * 1024
const GIGABYTE = 1024 * MEGABYTE

/**
 * Product ids must be referenced statically so Vite can inline them into both
 * bundles. A computed lookup — `import.meta.env[name]` — compiles and then resolves
 * to an empty string in the client bundle, which surfaces one broken Upgrade button
 * at a time instead of a build error.
 */
const PRODUCT_IDS = {
  soloMonthly: import.meta.env.VITE_POLAR_PRODUCT_SOLO_MONTHLY ?? '',
  soloYearly: import.meta.env.VITE_POLAR_PRODUCT_SOLO_YEARLY ?? '',
  crewMonthly: import.meta.env.VITE_POLAR_PRODUCT_CREW_MONTHLY ?? '',
  crewYearly: import.meta.env.VITE_POLAR_PRODUCT_CREW_YEARLY ?? '',
} as const

const NO_MODULES: PlanModules = {
  itinerary: false,
  map: false,
  budget: false,
  packing: false,
  reservations: false,
  journal: false,
  atlas: false,
  collaboration: false,
  realtime: false,
  offlineMaps: false,
  pdfExport: false,
  prioritySupport: false,
}

const freePlan: Plan = {
  id: 'free',
  name: 'Free',
  tagline: 'Plan your next two trips',
  description:
    'Everything you need to sketch out a couple of trips on your own — a day-by-day itinerary, a map of the places you want to see, and a packing list.',
  seatBased: false,
  seatRange: { min: 1, max: 1 },
  trialDays: 0,
  recommended: false,
  prices: { monthly: null, yearly: null },
  features: [
    { label: '2 trips at a time', detail: 'Archive one to start another' },
    { label: 'Day-by-day itinerary and map' },
    { label: 'Packing lists and simple budgets' },
    { label: 'World map tracker' },
    { label: '100 MB for photos and documents' },
  ],
  limits: {
    ...NO_MODULES,
    seats: 1,
    trips: 2,
    storageBytes: 100 * MEGABYTE,
    itinerary: true,
    map: true,
    budget: true,
    packing: true,
    atlas: true,
  },
}

const soloPlan: Plan = {
  id: 'solo',
  name: 'Solo',
  tagline: 'For the traveller who plans everything',
  description:
    'Unlimited trips and every planning module, for one person. Reservations, the travel journal and PDF exports all unlock.',
  seatBased: false,
  seatRange: { min: 1, max: 1 },
  trialDays: 14,
  recommended: true,
  prices: {
    monthly: {
      interval: 'monthly',
      productId: PRODUCT_IDS.soloMonthly,
      amount: 900,
      currency: 'usd',
      perSeat: false,
    },
    yearly: {
      interval: 'yearly',
      productId: PRODUCT_IDS.soloYearly,
      amount: 9000,
      currency: 'usd',
      perSeat: false,
    },
  },
  features: [
    { label: 'Unlimited trips' },
    {
      label: 'Every planning module',
      detail: 'Reservations, journal, budgets, packing',
    },
    { label: 'PDF and calendar export' },
    { label: '5 GB for photos and documents' },
  ],
  limits: {
    ...NO_MODULES,
    seats: 1,
    trips: null,
    storageBytes: 5 * GIGABYTE,
    itinerary: true,
    map: true,
    budget: true,
    packing: true,
    reservations: true,
    journal: true,
    atlas: true,
    offlineMaps: true,
    pdfExport: true,
  },
}

const crewPlan: Plan = {
  id: 'crew',
  name: 'Crew',
  tagline: 'For families, friends and small teams',
  description:
    'Everything in Solo, plus real-time collaboration for up to ten people. Everyone edits the same itinerary at once and sees each other move.',
  seatBased: true,
  seatRange: { min: 2, max: 10 },
  trialDays: 14,
  recommended: false,
  prices: {
    monthly: {
      interval: 'monthly',
      productId: PRODUCT_IDS.crewMonthly,
      amount: 700,
      currency: 'usd',
      perSeat: true,
    },
    yearly: {
      interval: 'yearly',
      productId: PRODUCT_IDS.crewYearly,
      amount: 7000,
      currency: 'usd',
      perSeat: true,
    },
  },
  features: [
    { label: 'Up to 10 members', detail: 'Billed per member, change any time' },
    {
      label: 'Real-time collaboration',
      detail: 'Live cursors and instant sync',
    },
    { label: 'Unlimited trips and every module' },
    { label: '50 GB shared for photos and documents' },
    {
      label: 'Priority support',
      detail: 'Answers from a person within one working day',
    },
  ],
  limits: {
    ...NO_MODULES,
    seats: 10,
    trips: null,
    storageBytes: 50 * GIGABYTE,
    itinerary: true,
    map: true,
    budget: true,
    packing: true,
    reservations: true,
    journal: true,
    atlas: true,
    collaboration: true,
    realtime: true,
    offlineMaps: true,
    pdfExport: true,
    prioritySupport: true,
  },
}

export const PLANS: { readonly [K in PlanId]: Plan } = {
  free: freePlan,
  solo: soloPlan,
  crew: crewPlan,
}

/** The catalogue in the order it is presented to a customer. */
export const PLAN_LIST: ReadonlyArray<Plan> = [freePlan, soloPlan, crewPlan]

/** Plans a customer can actually buy. */
export const PAID_PLAN_LIST: ReadonlyArray<Plan> = [soloPlan, crewPlan]

export const FREE_PLAN = freePlan

/* --------------------------------------------------------------------- lookups */

export function planById(id: PlanId): Plan {
  return PLANS[id]
}

/** Resolve a plan from an untrusted value, or `null` when it is not a plan id. */
export function planFromUnknown(value: unknown): Plan | null {
  return isPlanId(value) ? PLANS[value] : null
}

/** Anything shaped enough like a persisted subscription row to pick a plan from. */
export interface PlanSubscriptionLike {
  readonly planId?: string | null
  readonly status?: string | null
}

/**
 * The plan an organization is currently entitled to.
 *
 * Falls back to Free when there is no subscription, when the plan id is unknown, or
 * when the status no longer entitles the customer (cancelled, unpaid, paused…).
 */
export function planFor(
  subscription: PlanSubscriptionLike | null | undefined,
): Plan {
  if (!subscription) return freePlan
  if (!isEntitlingStatus(subscription.status)) return freePlan
  return planFromUnknown(subscription.planId) ?? freePlan
}

/** Reverse-resolve a Polar product id back to our catalogue. */
export function planForProductId(
  productId: string | null | undefined,
): { plan: Plan; interval: BillingInterval } | null {
  if (!productId) return null
  for (const plan of PAID_PLAN_LIST) {
    for (const interval of BILLING_INTERVALS) {
      const price = plan.prices[interval]
      if (price && price.productId !== '' && price.productId === productId) {
        return { plan, interval }
      }
    }
  }
  return null
}

export function priceFor(
  plan: Plan,
  interval: BillingInterval,
): PlanPrice | null {
  return plan.prices[interval]
}

/**
 * The price a paid plan/interval pair maps to, guaranteed to be configured.
 * Throws rather than silently charging the wrong thing.
 */
export function requirePrice(plan: Plan, interval: BillingInterval): PlanPrice {
  const price = plan.prices[interval]
  if (!price) {
    throw new Error(
      `Plan "${plan.id}" cannot be purchased on a ${interval} interval.`,
    )
  }
  if (price.productId === '') {
    throw new Error(
      `Polar product id for the ${plan.id} ${interval} plan is not configured. ` +
        `Set VITE_POLAR_PRODUCT_${plan.id.toUpperCase()}_${interval.toUpperCase()}.`,
    )
  }
  return price
}

/** Every limit value for a plan, keyed. `limitFor(plan, 'trips')` → `number | null`. */
export function limitFor<TKey extends LimitKey>(
  plan: Plan,
  key: TKey,
): PlanLimits[TKey] {
  return plan.limits[key]
}

/**
 * The seat ceiling that actually applies. On a seat-based plan the organization may
 * only fill the seats it pays for, never the plan's maximum.
 */
export function effectiveSeatLimit(
  plan: Plan,
  purchasedSeats: number,
): number | null {
  if (plan.limits.seats === null) return null
  return plan.seatBased ? clampSeats(plan, purchasedSeats) : plan.limits.seats
}

/**
 * A plan's catalogue limits with the seat ceiling narrowed to the seats purchased.
 *
 * These are the plan's *published* numbers, not the numbers in force for a given
 * workspace: a subscription row may legitimately be grandfathered above them. Only
 * `resolveLimits()` in `src/server/billing/limits.ts` answers that question, and it is
 * the sole caller of this function — read the limits from there, never from here, or
 * the screen starts contradicting what the repositories enforce.
 */
export function catalogueLimits(
  plan: Plan,
  purchasedSeats: number,
): PlanLimits {
  return { ...plan.limits, seats: effectiveSeatLimit(plan, purchasedSeats) }
}

/** Clamp a requested seat count into what the plan allows. */
export function clampSeats(plan: Plan, requested: number): number {
  const min = plan.seatRange.min
  const max = plan.seatRange.max ?? requested
  const whole = Number.isFinite(requested) ? Math.floor(requested) : min
  return Math.min(Math.max(whole, min), Math.max(max, min))
}

/* ------------------------------------------------------------- quota arithmetic */

export function isUnlimited(limit: number | null): limit is null {
  return limit === null
}

/** How much head-room is left, or `null` when the limit is unlimited. */
export function quotaRemaining(
  limit: number | null,
  used: number,
): number | null {
  if (isUnlimited(limit)) return null
  return Math.max(limit - used, 0)
}

/** Fraction of the limit consumed, clamped to 0…1. Unlimited quotas read as 0. */
export function quotaRatio(limit: number | null, used: number): number {
  if (isUnlimited(limit)) return 0
  if (limit <= 0) return 1
  return Math.min(Math.max(used / limit, 0), 1)
}

/** True when adding `requested` more would break the limit. */
export function exceedsQuota(
  limit: number | null,
  used: number,
  requested: number,
): boolean {
  if (isUnlimited(limit)) return false
  return used + requested > limit
}

/* ------------------------------------------------------------------ formatting */

/** What a yearly price works out to per month, for the "billed yearly" sub-line. */
export function monthlyEquivalent(price: PlanPrice): number {
  return price.interval === 'yearly'
    ? Math.round(price.amount / 12)
    : price.amount
}

/** Percentage saved by paying yearly instead of monthly, rounded down. `0` when none. */
export function yearlySavingPercent(plan: Plan): number {
  const monthly = plan.prices.monthly
  const yearly = plan.prices.yearly
  if (!monthly || !yearly || monthly.amount <= 0) return 0
  const fullPrice = monthly.amount * 12
  if (yearly.amount >= fullPrice) return 0
  return Math.floor(((fullPrice - yearly.amount) / fullPrice) * 100)
}

/** `104857600` → `"100 MB"`. Binary units, because that is how R2 bills us. */
export function formatStorage(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'] as const
  let value = Math.max(bytes, 0)
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const rounded =
    value >= 100 || unit === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[unit]}`
}

/** Render a quota for a meter: `"2"`, `"Unlimited"`, `"5 GB"`. */
export function formatQuota(key: QuotaKey, limit: number | null): string {
  if (isUnlimited(limit)) return 'Unlimited'
  return key === 'storageBytes' ? formatStorage(limit) : String(limit)
}

/** Render the used side of a meter in the same units as its limit. */
export function formatQuotaUsage(key: QuotaKey, used: number): string {
  return key === 'storageBytes' ? formatStorage(used) : String(used)
}
