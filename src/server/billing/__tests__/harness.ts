/**
 * Fakes for the billing ports.
 *
 * `src/server/billing/types.ts` describes the runtime as a set of interfaces
 * rather than as bindings, which is exactly so this file can exist: the
 * entitlement maths and the webhook endpoint run here against in-memory doubles,
 * with no D1, no KV, no queue and no network.
 *
 * The one real Stripe object is the `webhooks` namespace, because signature
 * verification is the thing under test and faking it would test nothing. It runs
 * on the same WebCrypto provider production uses.
 */

// Must come first: it configures the price ids `#/lib/plans` reads at import.
import { TEST_PRICE_IDS } from './prices.fixture'
import { ceilingsForPlan } from '../limits'
import { createStripeClient, stripeWebhookCryptoProvider } from '../stripe'
import { EMPTY_USAGE } from '../types'

import type Stripe from 'stripe'
import type {
  BillingCache,
  BillingIdentity,
  BillingLogger,
  BillingRuntime,
  BillingTask,
  BillingTaskQueue,
  SubscriptionRecord,
  SubscriptionStore,
  UsageReader,
  UsageSnapshot,
} from '../types'
import type { SubscriptionStatus } from '#/lib/plans'

export const TEST_ORG_ID = 'org_test'
export const TEST_WEBHOOK_SECRET = 'whsec_test_secret_value'
export const TEST_APP_URL = 'https://planned.travel'
export const TEST_CUSTOMER_ID = 'cus_test_1'
export const TEST_CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_test_1'
export const TEST_PORTAL_URL = 'https://billing.stripe.com/p/session/test_1'

/* ------------------------------------------------------------------- signing */

/** A client used only for its `webhooks` namespace — it never makes a request. */
const signingClient = createStripeClient('sk_test_harness')

/** Sign a payload exactly the way Stripe does, on WebCrypto. */
export async function signStripePayload(
  payload: string,
  secret: string = TEST_WEBHOOK_SECRET,
  timestampSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  return await signingClient.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
    timestamp: timestampSeconds,
    cryptoProvider: stripeWebhookCryptoProvider(),
  })
}

export function webhookRequest(
  body: string,
  headers: Readonly<Record<string, string>> = {},
): Request {
  return new Request('https://planned.travel/api/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
}

/* --------------------------------------------------------------------- store */

export class FakeSubscriptionStore implements SubscriptionStore {
  readonly rows = new Map<string, SubscriptionRecord>()
  /** Every write, in order — the assertion surface for idempotency tests. */
  readonly writes: Array<SubscriptionRecord> = []

  constructor(seed?: SubscriptionRecord) {
    if (seed !== undefined) this.rows.set(seed.organizationId, seed)
  }

  async findByOrganization(
    organizationId: string,
  ): Promise<SubscriptionRecord | null> {
    return this.rows.get(organizationId) ?? null
  }

  async findByStripeCustomerId(
    stripeCustomerId: string,
  ): Promise<SubscriptionRecord | null> {
    for (const row of this.rows.values()) {
      if (row.stripeCustomerId === stripeCustomerId) return row
    }
    return null
  }

  async findByStripeSubscriptionId(
    stripeSubscriptionId: string,
  ): Promise<SubscriptionRecord | null> {
    for (const row of this.rows.values()) {
      if (row.stripeSubscriptionId === stripeSubscriptionId) return row
    }
    return null
  }

  async upsert(record: SubscriptionRecord): Promise<void> {
    this.rows.set(record.organizationId, record)
    this.writes.push(record)
  }

  async attachCustomer(
    organizationId: string,
    stripeCustomerId: string,
  ): Promise<void> {
    const existing = this.rows.get(organizationId)
    this.rows.set(organizationId, {
      ...(existing ?? emptyRecord(organizationId)),
      stripeCustomerId,
    })
  }

  async updateStatus(
    organizationId: string,
    status: SubscriptionStatus,
    changedAt: Date,
  ): Promise<void> {
    const existing = this.rows.get(organizationId)
    if (existing === undefined) return
    this.rows.set(organizationId, {
      ...existing,
      status,
      canceledAt: status === 'canceled' ? changedAt : existing.canceledAt,
    })
  }
}

export function emptyRecord(organizationId: string): SubscriptionRecord {
  return {
    organizationId,
    planId: 'free',
    status: 'incomplete',
    interval: null,
    seats: 1,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    stripePriceId: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    canceledAt: null,
    ceilings: ceilingsForPlan('free', 1),
  }
}

/**
 * A persisted row, with only the fields a test cares about spelled out.
 *
 * The stored ceilings default to the ones the record's own plan writes, so the row is
 * internally consistent the way every sanctioned write path leaves it. A test that
 * wants a row whose ceilings *disagree* with its plan — a grandfathered escape, a
 * legacy row — passes `ceilings` explicitly and says so.
 */
export function subscriptionRecord(
  overrides: Partial<SubscriptionRecord> = {},
): SubscriptionRecord {
  const base = {
    organizationId: TEST_ORG_ID,
    planId: 'crew',
    status: 'active',
    interval: 'monthly',
    seats: 4,
    stripeCustomerId: TEST_CUSTOMER_ID,
    stripeSubscriptionId: 'sub_test_1',
    stripePriceId: TEST_PRICE_IDS.crewMonthly,
    currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    canceledAt: null,
    ...overrides,
  } satisfies Omit<SubscriptionRecord, 'ceilings'> & Partial<SubscriptionRecord>

  return {
    ...base,
    ceilings: overrides.ceilings ?? ceilingsForPlan(base.planId, base.seats),
  }
}

/* --------------------------------------------------------------------- cache */

export class FakeCache implements BillingCache {
  readonly entries = new Map<string, string>()
  gets = 0
  puts = 0
  deletes = 0

  async get(key: string): Promise<string | null> {
    this.gets += 1
    return this.entries.get(key) ?? null
  }

  async put(key: string, value: string): Promise<void> {
    this.puts += 1
    this.entries.set(key, value)
  }

  async delete(key: string): Promise<void> {
    this.deletes += 1
    this.entries.delete(key)
  }
}

/* --------------------------------------------------------------------- usage */

export class FakeUsageReader implements UsageReader {
  reads = 0

  constructor(private snapshot: UsageSnapshot = EMPTY_USAGE) {}

  set(snapshot: UsageSnapshot): void {
    this.snapshot = snapshot
  }

  async read(): Promise<UsageSnapshot> {
    this.reads += 1
    return this.snapshot
  }
}

/* --------------------------------------------------------------------- queue */

export class FakeTaskQueue implements BillingTaskQueue {
  readonly sent: Array<BillingTask> = []
  failNext = false

  async send(message: BillingTask): Promise<void> {
    if (this.failNext) {
      this.failNext = false
      throw new Error('queue unavailable')
    }
    this.sent.push(message)
  }
}

/* -------------------------------------------------------------------- logger */

export interface CapturedLog {
  readonly level: 'info' | 'warn' | 'error'
  readonly message: string
  readonly fields: Readonly<Record<string, unknown>>
}

export function createCapturingLogger(): {
  logger: BillingLogger
  records: Array<CapturedLog>
} {
  const records: Array<CapturedLog> = []
  const push =
    (level: CapturedLog['level']) =>
    (message: string, fields?: Readonly<Record<string, unknown>>): void => {
      records.push({ level, message, fields: fields ?? {} })
    }
  return {
    logger: { info: push('info'), warn: push('warn'), error: push('error') },
    records,
  }
}

/* -------------------------------------------------------------------- stripe */

export interface StripeCalls {
  readonly customers: Array<{
    params: Stripe.CustomerCreateParams
    options?: Stripe.RequestOptions
  }>
  readonly checkoutSessions: Array<{
    params: Stripe.Checkout.SessionCreateParams
    options?: Stripe.RequestOptions
  }>
  readonly portalSessions: Array<Stripe.BillingPortal.SessionCreateParams>
  readonly subscriptionsRetrieved: Array<string>
  readonly invoiceQueries: Array<Stripe.InvoiceListParams>
}

export interface StripeStubSeed {
  /** Returned by `subscriptions.retrieve`. */
  readonly subscription?: Stripe.Subscription
  readonly invoices?: ReadonlyArray<Stripe.Invoice>
  /** Forces `checkout.sessions.create` to answer without a URL. */
  readonly checkoutWithoutUrl?: boolean
}

/**
 * A Stripe double with a real `webhooks` namespace and recorded writes.
 *
 * The cast is deliberate and confined to this function: the SDK surface is far
 * larger than billing touches, and widening the fake to all of it would add
 * noise without adding a single assertion.
 */
export function createStripeStub(seed: StripeStubSeed = {}): {
  stripe: Stripe
  calls: StripeCalls
} {
  const calls: StripeCalls = {
    customers: [],
    checkoutSessions: [],
    portalSessions: [],
    subscriptionsRetrieved: [],
    invoiceQueries: [],
  }

  const stub = {
    webhooks: signingClient.webhooks,
    customers: {
      create: async (
        params: Stripe.CustomerCreateParams,
        options?: Stripe.RequestOptions,
      ) => {
        calls.customers.push({ params, options })
        return { id: TEST_CUSTOMER_ID }
      },
    },
    checkout: {
      sessions: {
        create: async (
          params: Stripe.Checkout.SessionCreateParams,
          options?: Stripe.RequestOptions,
        ) => {
          calls.checkoutSessions.push({ params, options })
          return {
            id: 'cs_test_1',
            url: seed.checkoutWithoutUrl === true ? null : TEST_CHECKOUT_URL,
          }
        },
      },
    },
    billingPortal: {
      sessions: {
        create: async (params: Stripe.BillingPortal.SessionCreateParams) => {
          calls.portalSessions.push(params)
          return { url: TEST_PORTAL_URL }
        },
      },
    },
    subscriptions: {
      retrieve: async (id: string) => {
        calls.subscriptionsRetrieved.push(id)
        if (seed.subscription === undefined) {
          throw new Error(`No subscription seeded for ${id}`)
        }
        return seed.subscription
      },
    },
    invoices: {
      list: async (params: Stripe.InvoiceListParams) => {
        calls.invoiceQueries.push(params)
        return { data: [...(seed.invoices ?? [])] }
      },
    },
  }

  return { stripe: stub as unknown as Stripe, calls }
}

/* ------------------------------------------------------------------- runtime */

export interface HarnessOptions {
  readonly record?: SubscriptionRecord
  readonly usage?: UsageSnapshot
  readonly webhookSecret?: string
  readonly now?: Date
  readonly stripe?: StripeStubSeed
}

export interface Harness {
  readonly runtime: BillingRuntime
  readonly store: FakeSubscriptionStore
  readonly cache: FakeCache
  readonly usage: FakeUsageReader
  readonly tasks: FakeTaskQueue
  readonly logs: Array<CapturedLog>
  readonly calls: StripeCalls
  /** Moves the injected clock, for trial and tolerance assertions. */
  setNow: (next: Date) => void
}

export function createHarness(options: HarnessOptions = {}): Harness {
  const store = new FakeSubscriptionStore(options.record)
  const cache = new FakeCache()
  const usage = new FakeUsageReader(options.usage ?? EMPTY_USAGE)
  const tasks = new FakeTaskQueue()
  const { logger, records } = createCapturingLogger()
  const { stripe, calls } = createStripeStub(options.stripe)

  // A frozen, deliberately arbitrary instant. Every assertion that touches it is
  // relative to it, so the value itself carries no meaning — verified by running
  // the suite with dates months either side of the real one. Keep it in the past
  // and never set it from `new Date()`: a default of "today" would silently
  // couple the suite to the wall clock, and Stripe signature timestamps are
  // generated from the real clock, so the two must not be assumed equal.
  let now = options.now ?? new Date('2025-03-04T09:17:00.000Z')

  const runtime: BillingRuntime = {
    stripe,
    webhookSecret: options.webhookSecret ?? TEST_WEBHOOK_SECRET,
    appUrl: TEST_APP_URL,
    subscriptions: store,
    usage,
    cache,
    tasks,
    logger,
    now: () => now,
  }

  return {
    runtime,
    store,
    cache,
    usage,
    tasks,
    logs: records,
    calls,
    setNow(next) {
      now = next
    },
  }
}

/* ------------------------------------------------------------------ identity */

export function billingIdentity(
  overrides: Partial<BillingIdentity> = {},
): BillingIdentity {
  return {
    userId: 'user_test',
    userEmail: 'owner@example.com',
    userName: 'Test Owner',
    organizationId: TEST_ORG_ID,
    organizationName: 'Test Expeditions',
    role: 'owner',
    ...overrides,
  }
}
