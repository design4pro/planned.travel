/**
 * Fakes for the billing ports.
 *
 * `src/server/billing/types.ts` describes the runtime as a set of interfaces rather
 * than as bindings, which is exactly so this file can exist: the entitlement maths,
 * the purchase flows and the webhook endpoint all run here against in-memory doubles,
 * with no D1, no KV, no queue and no network.
 *
 * `signPolarWebhook()` is the one thing here that is not a double. It is a second,
 * independent implementation of Standard Webhooks signing, written straight from the
 * specification on WebCrypto and deliberately *not* calling
 * `verifyWebhookSignature()`. A signer that shared code with the verifier would agree
 * with it about anything, including a mistake, and would prove nothing.
 */

// Must come first: it configures the product ids `#/lib/plans` reads at import.
import { TEST_PRODUCT_IDS } from './prices.fixture'
import { planById } from '#/lib/plans'
import { upsertSubscriptionInput } from '#/server/repos'
import { ceilingsForPlan } from '../limits'
import { PolarApiError } from '../polar'
import { ceilingColumns, recordFromRow, rowValuesFromRecord } from '../store'
import { EMPTY_USAGE } from '../types'

import type { Subscription } from '#/server/db/types'
import type { UpsertSubscriptionInput } from '#/server/repos'
import type { PolarDiscount, PolarOrder, PolarSubscription } from '../mapping'
import type {
  BillingCache,
  BillingIdentity,
  BillingLogger,
  BillingRuntime,
  BillingTask,
  BillingTaskQueue,
  PolarClient,
  PolarRequest,
  SubscriptionRecord,
  SubscriptionStore,
  UsageReader,
  UsageSnapshot,
} from '../types'
import type { BillingInterval, PlanId, SubscriptionStatus } from '#/lib/plans'

export const TEST_ORG_ID = 'org_test'
export const TEST_WEBHOOK_SECRET = 'polar_whs_test_secret_value'
export const TEST_APP_URL = 'https://planned.travel'
/** Polar object ids are UUIDs, and a fixture that pretended otherwise would let a
 *  validator that rejects one slip through the suite and fail against the API. */
export const TEST_CUSTOMER_ID = '0d7d6f5c-9a51-4f0e-8f0c-2a3b4c5d6e7f'
export const TEST_SUBSCRIPTION_ID = '4c1e8b22-5a7d-4c19-9e33-6f8b0a1d2e34'
export const TEST_ORDER_ID = 'a95f2c71-3b8e-4d06-9c52-1e7a4f930b68'
export const TEST_CHECKOUT_ID = 'e2b71f04-6c3d-4a58-b019-7d5e2c86af13'
export const TEST_CHECKOUT_URL = `https://buy.polar.sh/c/${TEST_CHECKOUT_ID}`
export const TEST_PORTAL_URL =
  'https://polar.sh/planned-travel/portal?token=test'
export const TEST_INVOICE_PDF_URL = 'https://polar.sh/invoices/test.pdf'

/* ------------------------------------------------------------------- signing */

export interface PolarSigningOptions {
  readonly secret?: string
  /** The `webhook-id` header. Polar's event id lives here and not in the body. */
  readonly webhookId?: string
  readonly timestampSeconds?: number
}

function base64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Sign a payload the way Polar does: HMAC-SHA256 over
 * `${webhook-id}.${webhook-timestamp}.${raw body}`, keyed on the raw UTF-8 bytes of
 * the secret, base64 with padding, presented as one `v1,<signature>` entry.
 *
 * Returns the three headers a delivery carries, ready to spread into a `Request`.
 */
export async function signPolarWebhook(
  payload: string,
  options: PolarSigningOptions = {},
): Promise<Record<string, string>> {
  const secret = options.secret ?? TEST_WEBHOOK_SECRET
  const webhookId = options.webhookId ?? 'msg_test_delivery_1'
  const timestamp = String(
    options.timestampSeconds ?? Math.floor(Date.now() / 1000),
  )

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${webhookId}.${timestamp}.${payload}`),
  )

  return {
    'webhook-id': webhookId,
    'webhook-timestamp': timestamp,
    'webhook-signature': `v1,${base64(new Uint8Array(signature))}`,
  }
}

export function webhookRequest(
  body: string,
  headers: Readonly<Record<string, string>> = {},
): Request {
  return new Request('https://planned.travel/api/polar/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  })
}

/* --------------------------------------------------------------------- store */

/** A row as the `subscriptions` table would hold it before anything is written. */
function blankRow(organizationId: string): Subscription {
  const stamp = new Date('2026-01-01T00:00:00.000Z')
  return {
    id: `sub_${organizationId}`,
    organizationId,
    plan: 'free',
    status: 'active',
    providerCustomerId: null,
    providerSubscriptionId: null,
    providerProductId: null,
    seats: 1,
    currency: null,
    unitAmountMinor: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    canceledAt: null,
    trialEndsAt: null,
    quotaOverrides: null,
    seatLimit: 10,
    storageLimitBytes: 1_073_741_824,
    pendingPlan: null,
    pendingInterval: null,
    pendingEffectiveAt: null,
    createdAt: stamp,
    updatedAt: stamp,
  }
}

/**
 * Apply a patch to a row the way `definedOnly()` does in the repository: `undefined`
 * leaves the column alone, `null` writes SQL NULL. Spelled out column by column
 * rather than spread, so a column added to the table without a line here is a type
 * error in this file instead of a value that silently stops being persisted.
 */
function applyPatch(
  base: Subscription,
  patch: UpsertSubscriptionInput,
): Subscription {
  const keep = <T>(next: T | null | undefined, current: T | null): T | null =>
    next === undefined ? current : next

  return {
    ...base,
    plan: patch.plan ?? base.plan,
    status: patch.status ?? base.status,
    providerCustomerId: keep(patch.providerCustomerId, base.providerCustomerId),
    providerSubscriptionId: keep(
      patch.providerSubscriptionId,
      base.providerSubscriptionId,
    ),
    providerProductId: keep(patch.providerProductId, base.providerProductId),
    seats: patch.seats ?? base.seats,
    currency: keep(patch.currency, base.currency),
    unitAmountMinor: keep(patch.unitAmountMinor, base.unitAmountMinor),
    currentPeriodStart: keep(patch.currentPeriodStart, base.currentPeriodStart),
    currentPeriodEnd: keep(patch.currentPeriodEnd, base.currentPeriodEnd),
    cancelAtPeriodEnd: patch.cancelAtPeriodEnd ?? base.cancelAtPeriodEnd,
    canceledAt: keep(patch.canceledAt, base.canceledAt),
    trialEndsAt: keep(patch.trialEndsAt, base.trialEndsAt),
    quotaOverrides: keep(patch.quotaOverrides, base.quotaOverrides),
    seatLimit: patch.seatLimit ?? base.seatLimit,
    storageLimitBytes: patch.storageLimitBytes ?? base.storageLimitBytes,
    pendingPlan: keep(patch.pendingPlan, base.pendingPlan),
    pendingInterval: keep(patch.pendingInterval, base.pendingInterval),
    pendingEffectiveAt: keep(patch.pendingEffectiveAt, base.pendingEffectiveAt),
  }
}

/**
 * An in-memory `SubscriptionStore` that is exactly as narrow as the table.
 *
 * It keeps **rows**, not records, and every write goes through the real
 * `rowValuesFromRecord()` and the real `upsertSubscriptionInput` parse before it is
 * stored, then back through the real `recordFromRow()` on the way out. That is
 * deliberate and it is the fix for how a whole feature shipped green: the previous
 * version put the domain record straight into a `Map` and handed the same object
 * back, so it round-tripped any field the *type* allowed — including one the database
 * had no column for. A double that is wider than the thing it stands in for does not
 * fail; it agrees with you.
 *
 * `src/server/billing/__tests__/store.test.ts` is the other half of the argument: the
 * same round trip over a real SQLite database, because a fake built from the same
 * mappers cannot prove the columns exist.
 */
export class FakeSubscriptionStore implements SubscriptionStore {
  readonly rows = new Map<string, Subscription>()
  /** Every write, in order, as the row reads back — the idempotency assertion surface. */
  readonly writes: Array<SubscriptionRecord> = []
  /** Organizations that were deleted: writing a row for one fails like the foreign key does. */
  readonly deletedOrganizations = new Set<string>()

  constructor(seed?: SubscriptionRecord) {
    if (seed !== undefined) this.seed(seed)
  }

  /** Put a row in place without counting it as a write. */
  seed(record: SubscriptionRecord): void {
    this.#write(record.organizationId, rowValuesFromRecord(record))
  }

  #write(organizationId: string, patch: UpsertSubscriptionInput): Subscription {
    if (this.deletedOrganizations.has(organizationId)) {
      throw new Error('FOREIGN KEY constraint failed')
    }
    const base = this.rows.get(organizationId) ?? blankRow(organizationId)
    const row = applyPatch(base, upsertSubscriptionInput.parse(patch))
    this.rows.set(organizationId, row)
    return row
  }

  async organizationExists(organizationId: string): Promise<boolean> {
    return !this.deletedOrganizations.has(organizationId)
  }

  async findByOrganization(
    organizationId: string,
  ): Promise<SubscriptionRecord | null> {
    const row = this.rows.get(organizationId)
    return row === undefined ? null : recordFromRow(row)
  }

  async findByProviderCustomerId(
    providerCustomerId: string,
  ): Promise<SubscriptionRecord | null> {
    for (const row of this.rows.values()) {
      if (row.providerCustomerId === providerCustomerId)
        return recordFromRow(row)
    }
    return null
  }

  async findByProviderSubscriptionId(
    providerSubscriptionId: string,
  ): Promise<SubscriptionRecord | null> {
    for (const row of this.rows.values()) {
      if (row.providerSubscriptionId === providerSubscriptionId) {
        return recordFromRow(row)
      }
    }
    return null
  }

  async upsert(record: SubscriptionRecord): Promise<void> {
    const row = this.#write(record.organizationId, rowValuesFromRecord(record))
    this.writes.push(recordFromRow(row))
  }

  async attachCustomer(
    organizationId: string,
    providerCustomerId: string,
  ): Promise<void> {
    // Mirrors the real store: a row created ahead of any subscription is stamped with
    // the Free plan's ceilings rather than left on the column defaults.
    const existing = this.rows.get(organizationId)
    this.#write(organizationId, {
      ...(existing === undefined
        ? ceilingColumns(ceilingsForPlan('free', 1))
        : {}),
      providerCustomerId,
    })
  }

  async updateStatus(
    organizationId: string,
    status: SubscriptionStatus,
    changedAt: Date,
  ): Promise<void> {
    if (!this.rows.has(organizationId)) return
    this.#write(organizationId, {
      status,
      canceledAt: status === 'canceled' ? changedAt : undefined,
    })
  }
}

/** The catalogue product a plan and interval are sold under, or `null` for Free. */
function productIdFor(
  planId: PlanId,
  interval: BillingInterval | null,
): string | null {
  if (planId === 'free' || interval === null) return null
  return planById(planId).prices[interval]?.productId ?? null
}

/**
 * A persisted row, with only the fields a test cares about spelled out.
 *
 * The stored ceilings and the provider product id both default to the ones the
 * record's own plan and interval carry, so the row is internally consistent the way
 * every sanctioned write path leaves it — and, since the store now reads a plan back
 * out of `provider_product_id` rather than trusting the record it was handed, a
 * fixture whose two halves disagreed would come back as a different plan than it went
 * in as. A test that wants that disagreement — a grandfathered escape, a legacy row —
 * passes `ceilings` or `providerProductId` explicitly and says so.
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
    providerCustomerId: TEST_CUSTOMER_ID,
    providerSubscriptionId: TEST_SUBSCRIPTION_ID,
    providerProductId: TEST_PRODUCT_IDS.crewMonthly,
    currentPeriodStart: new Date('2026-08-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    canceledAt: null,
    pendingChange: null,
    ...overrides,
  } satisfies Omit<SubscriptionRecord, 'ceilings'> & Partial<SubscriptionRecord>

  return {
    ...base,
    providerProductId:
      overrides.providerProductId === undefined
        ? productIdFor(base.planId, base.interval)
        : overrides.providerProductId,
    ceilings: overrides.ceilings ?? ceilingsForPlan(base.planId, base.seats),
  }
}

/* ---------------------------------------------------------------- wire fixtures */

/** A Polar `Subscription` as the API and the webhooks deliver it. */
export function polarSubscription(
  overrides: Partial<PolarSubscription> = {},
): PolarSubscription {
  return {
    id: TEST_SUBSCRIPTION_ID,
    status: 'active',
    product_id: TEST_PRODUCT_IDS.crewMonthly,
    seats: 4,
    current_period_start: '2026-08-01T00:00:00Z',
    current_period_end: '2026-09-01T00:00:00Z',
    cancel_at_period_end: false,
    trial_end: null,
    canceled_at: null,
    customer_id: TEST_CUSTOMER_ID,
    customer: {
      id: TEST_CUSTOMER_ID,
      external_id: TEST_ORG_ID,
      email: 'owner@example.com',
    },
    metadata: {
      organizationId: TEST_ORG_ID,
      planId: 'crew',
      interval: 'monthly',
      seats: 4,
    },
    ...overrides,
  }
}

export const TEST_DISCOUNT_ID = '7f3a9c10-2b4d-4e6f-8a1b-3c5d7e9f0a2b'

/**
 * A Polar `Discount` as `GET /v1/discounts/` lists it: a live, unrestricted, open-ended 20%
 * code. Restrictions and bounds are opted into per test.
 */
export function polarDiscount(
  overrides: Partial<PolarDiscount> = {},
): PolarDiscount {
  return {
    id: TEST_DISCOUNT_ID,
    code: 'SUMMER20',
    type: 'percentage',
    basis_points: 2000,
    amount: null,
    starts_at: null,
    ends_at: null,
    max_redemptions: null,
    redemptions_count: 0,
    products: [],
    ...overrides,
  }
}

/** A Polar `Order` — what Polar issues in place of an invoice. */
export function polarOrder(overrides: Partial<PolarOrder> = {}): PolarOrder {
  return {
    id: TEST_ORDER_ID,
    status: 'paid',
    created_at: '2026-08-01T09:30:00Z',
    total_amount: 2800,
    currency: 'usd',
    invoice_number: 'PT-0001',
    is_invoice_generated: true,
    next_payment_attempt_at: null,
    subscription_id: TEST_SUBSCRIPTION_ID,
    customer_id: TEST_CUSTOMER_ID,
    customer: {
      id: TEST_CUSTOMER_ID,
      external_id: TEST_ORG_ID,
      email: 'owner@example.com',
    },
    metadata: { organizationId: TEST_ORG_ID },
    ...overrides,
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

/* --------------------------------------------------------------------- polar */

export interface PolarStubSeed {
  /** Body of `POST /v1/checkouts/`. */
  readonly checkout?: unknown
  /** Body of `POST /v1/customer-sessions/`. */
  readonly customerSession?: unknown
  /** Body of `PATCH /v1/subscriptions/{id}`. */
  readonly subscription?: unknown
  /** Items of `GET /v1/orders/`. */
  readonly orders?: ReadonlyArray<unknown>
  /** Body of `GET /v1/orders/{id}`. */
  readonly order?: unknown
  /** Body of `GET /v1/orders/{id}/invoice`. */
  readonly orderInvoice?: unknown
  /**
   * Successive answers to `GET /v1/orders/{id}/invoice`, one per call, so the
   * 202-then-404-then-200 render race can be reproduced exactly. An `Error` entry
   * is thrown rather than returned, and the last entry repeats once the list runs
   * out — which is what lets a test hold the endpoint at 404 forever.
   */
  readonly orderInvoiceSequence?: ReadonlyArray<unknown>
  /** Thrown by `POST /v1/orders/{id}/invoice`: Polar refusing to start the render. */
  readonly generateInvoiceError?: Error
  /** Thrown by every request, for the paths that must degrade rather than fail. */
  readonly error?: Error
  /**
   * The organization's discount catalogue. `GET /v1/discounts/` pages it by the request's own
   * `limit` and `page`; `GET /v1/discounts/{id}` finds one in it or answers 404.
   */
  readonly discounts?: ReadonlyArray<PolarDiscount>
  /** Thrown by every `/v1/discounts/` request — a 403 for a token without the scope. */
  readonly discountError?: Error
  /** Body of `GET /v1/subscriptions/{id}`. Defaults to `subscription`, then the fixture. */
  readonly subscriptionRead?: unknown
  /** Decides per body whether a `PATCH /v1/subscriptions/{id}` is refused, and with what. */
  readonly rejectPatch?: (body: unknown) => Error | null
}

function defaultCheckout(): unknown {
  return {
    id: TEST_CHECKOUT_ID,
    status: 'open',
    url: TEST_CHECKOUT_URL,
    product_id: TEST_PRODUCT_IDS.crewMonthly,
    external_customer_id: TEST_ORG_ID,
    customer_id: null,
    seats: null,
    metadata: {},
  }
}

/**
 * The 404 Polar answers with between accepting a generate request and finishing the
 * render. Built from the real error class so the code under test branches on
 * `status` exactly as it does in production.
 */
export function invoiceNotRenderedYet(): PolarApiError {
  return new PolarApiError(
    404,
    '{"error":"ResourceNotFound","detail":"Invoice not generated"}',
    'Polar GET /v1/orders/{id}/invoice failed with 404.',
  )
}

function defaultCustomerSession(): unknown {
  return {
    id: 'b3ec9f47-1d20-4a6b-8c7e-90f1a2b3c4d5',
    customer_portal_url: TEST_PORTAL_URL,
    customer_id: TEST_CUSTOMER_ID,
    expires_at: '2026-08-01T10:00:00Z',
  }
}

/**
 * A Polar double that records every request and answers by route.
 *
 * The port is one `request()` method precisely so a fake can be this small and a
 * test can assert the path, the method and the exact body that went out — which is
 * the only thing standing between a Crew subscription and being billed as one seat.
 */
export function createPolarStub(seed: PolarStubSeed = {}): {
  polar: PolarClient
  calls: Array<PolarRequest>
} {
  const calls: Array<PolarRequest> = []
  let invoiceReads = 0

  const polar: PolarClient = {
    async request(request: PolarRequest): Promise<unknown> {
      calls.push(request)
      if (seed.error !== undefined) throw seed.error

      const { method, path } = request

      if (method === 'POST' && path === '/v1/checkouts/') {
        return seed.checkout ?? defaultCheckout()
      }
      if (method === 'POST' && path === '/v1/customer-sessions/') {
        return seed.customerSession ?? defaultCustomerSession()
      }
      if (method === 'PATCH' && path.startsWith('/v1/subscriptions/')) {
        const refusal = seed.rejectPatch?.(request.body) ?? null
        if (refusal !== null) throw refusal
        return seed.subscription ?? polarSubscription()
      }
      if (method === 'GET' && path.startsWith('/v1/subscriptions/')) {
        return (
          seed.subscriptionRead ?? seed.subscription ?? polarSubscription()
        )
      }
      if (path.startsWith('/v1/discounts/')) {
        if (seed.discountError !== undefined) throw seed.discountError
        const catalogue = seed.discounts ?? []
        if (path === '/v1/discounts/') {
          const limit = Number(request.query?.limit ?? 10)
          const page = Number(request.query?.page ?? 1)
          return {
            items: catalogue.slice((page - 1) * limit, page * limit),
            pagination: {
              total_count: catalogue.length,
              max_page: Math.max(1, Math.ceil(catalogue.length / limit)),
            },
          }
        }
        const id = path.slice('/v1/discounts/'.length)
        const found = catalogue.find((discount) => discount.id === id)
        if (found === undefined) {
          throw new PolarApiError(404, '{"error":"ResourceNotFound"}', 'Not found')
        }
        return found
      }
      if (method === 'GET' && path === '/v1/orders/') {
        const items = seed.orders ?? []
        return { items, pagination: { total_count: items.length, max_page: 1 } }
      }
      if (path.startsWith('/v1/orders/') && path.endsWith('/invoice')) {
        // The generate call answers 202 with no body at all.
        if (method === 'POST') {
          if (seed.generateInvoiceError !== undefined) {
            throw seed.generateInvoiceError
          }
          return null
        }

        const sequence = seed.orderInvoiceSequence
        if (sequence !== undefined && sequence.length > 0) {
          const answer = sequence[Math.min(invoiceReads, sequence.length - 1)]
          invoiceReads += 1
          if (answer instanceof Error) throw answer
          return answer
        }

        return seed.orderInvoice ?? { url: TEST_INVOICE_PDF_URL }
      }
      if (method === 'GET' && path.startsWith('/v1/orders/')) {
        return seed.order ?? polarOrder()
      }

      throw new Error(`No Polar stub for ${method} ${path}`)
    },
  }

  return { polar, calls }
}

/* ------------------------------------------------------------------- runtime */

export interface HarnessOptions {
  readonly record?: SubscriptionRecord
  readonly usage?: UsageSnapshot
  readonly webhookSecret?: string
  readonly now?: Date
  readonly polar?: PolarStubSeed
}

export interface Harness {
  readonly runtime: BillingRuntime
  readonly store: FakeSubscriptionStore
  readonly cache: FakeCache
  readonly usage: FakeUsageReader
  readonly tasks: FakeTaskQueue
  readonly logs: Array<CapturedLog>
  /** Every request that went to Polar, in order. */
  readonly calls: Array<PolarRequest>
  /** Moves the injected clock, for trial and tolerance assertions. */
  setNow: (next: Date) => void
}

export function createHarness(options: HarnessOptions = {}): Harness {
  const store = new FakeSubscriptionStore(options.record)
  const cache = new FakeCache()
  const usage = new FakeUsageReader(options.usage ?? EMPTY_USAGE)
  const tasks = new FakeTaskQueue()
  const { logger, records } = createCapturingLogger()
  const { polar, calls } = createPolarStub(options.polar)

  // A frozen, deliberately arbitrary instant. Every assertion that touches it is
  // relative to it, so the value itself carries no meaning — verified by running
  // the suite with dates months either side of the real one. Keep it in the past
  // and never set it from `new Date()`: a default of "today" would silently
  // couple the suite to the wall clock, and webhook signature timestamps are
  // generated from the real clock, so the two must not be assumed equal.
  let now = options.now ?? new Date('2025-03-04T09:17:00.000Z')

  const runtime: BillingRuntime = {
    polar,
    webhookSecret: options.webhookSecret ?? TEST_WEBHOOK_SECRET,
    appUrl: TEST_APP_URL,
    subscriptions: store,
    usage,
    cache,
    tasks,
    logger,
    now: () => now,
    // The sandbox budget, the tighter of the two.
    discountLookupBudget: 20,
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
