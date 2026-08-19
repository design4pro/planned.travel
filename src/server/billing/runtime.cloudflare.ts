/// <reference types="@cloudflare/workers-types" />

/**
 * The billing runtime, bound to this Worker.
 *
 * `./types` deliberately describes billing as a set of ports — a subscription
 * store, a usage reader, a cache, a task queue, a clock — so the entitlement and
 * webhook logic can be unit-tested against plain fakes. This is the one module
 * that plugs those ports into real Cloudflare bindings, and therefore the only
 * module in `src/server/billing/**` that may import `cloudflare:workers`.
 *
 * What is left here is only what needs a binding: the secrets, live usage over a
 * tenant scope, the queue and the logger. The two translations that used to sit in
 * this file moved out so they could be tested against a real database rather than
 * only on workerd — plan identity and the ceiling columns are now in `./limits` and
 * `./store`, which is also what keeps the vocabulary bridge in one place.
 *
 * Task hand-off stays: billing tasks are envelope-shaped for the `TASKS` queue with
 * a deterministic id, so a Stripe redelivery cannot enqueue the same follow-up twice.
 */

import { env } from 'cloudflare:workers'

import { createLogger, resolveLogLevel } from '#/server/observability'
import { getDb } from '#/server/db/client'
import {
  countMembers,
  countPendingInvitations,
  getStorageUsage,
  tripsRepository,
} from '#/server/repos'
import type { TenantScope } from '#/server/repos'
import { createStripeClient } from './stripe'
import { createSubscriptionStore } from './store'
import { BillingConfigError } from './types'
import type Stripe from 'stripe'
import type {
  BillingLogger,
  BillingRuntime,
  BillingTask,
  BillingTaskQueue,
  UsageReader,
  UsageSnapshot,
} from './types'

/* ------------------------------------------------------------------ secrets */

export function stripeSecretKey(): string {
  const value = env.STRIPE_SECRET_KEY
  if (typeof value !== 'string' || value === '') {
    throw new BillingConfigError(
      'STRIPE_SECRET_KEY is not set. Add it with `wrangler secret put STRIPE_SECRET_KEY`.',
    )
  }
  return value
}

/** Empty rather than throwing: the webhook turns an absent secret into a 400. */
export function stripeWebhookSecret(): string {
  const value = env.STRIPE_WEBHOOK_SECRET
  return typeof value === 'string' ? value : ''
}

/** Origin every Stripe return URL is built from, without a trailing slash. */
export function billingAppUrl(): string {
  // Declared as a `var` for every environment in wrangler.jsonc, so it is
  // always present; only the trailing slash needs normalising.
  return env.APP_URL.replace(/\/+$/, '')
}

/* ------------------------------------------------------------------- usage */

/**
 * Live usage for one tenant.
 *
 * Pending invitations count towards seats, so a workspace cannot hand out more
 * invitations than it pays for and then discover the problem when people accept.
 */
export function createUsageReader(scope: TenantScope): UsageReader {
  return {
    async read(organizationId): Promise<UsageSnapshot> {
      if (organizationId !== scope.ctx.organizationId) {
        throw new BillingConfigError(
          'Usage was requested for an organization this scope does not cover.',
        )
      }

      const [members, invitations, trips, storage] = await Promise.all([
        countMembers(scope),
        countPendingInvitations(scope),
        tripsRepository.count(scope),
        getStorageUsage(scope),
      ])

      return {
        seats: members + invitations,
        trips,
        storageBytes: storage.bytes,
      }
    },
  }
}

/** Used on paths that never read usage — the webhook, above all. */
const UNAVAILABLE_USAGE: UsageReader = {
  read(): Promise<UsageSnapshot> {
    return Promise.reject(
      new BillingConfigError(
        'Usage is only readable from a tenant-scoped request.',
      ),
    )
  },
}

/* ------------------------------------------------------------------- queue */

/** Deterministic per event *and* per task, so a redelivery cannot double-send. */
export function billingTaskId(task: BillingTask): string {
  return `${task.stripeEventId}:${task.kind}`
}

/**
 * Billing follow-ups are pushed onto the shared `TASKS` queue in the envelope
 * shape every other producer uses, so the consumer can route them by `kind`
 * once `taskEnvelopeSchema` learns the billing variants. A deployment without
 * the binding logs and drops rather than failing the webhook.
 */
export function createBillingTaskQueue(
  queue: Queue<unknown> | null,
  logger: BillingLogger,
): BillingTaskQueue {
  return {
    async send(message) {
      if (queue === null) {
        logger.warn('billing.task.dropped', {
          kind: message.kind,
          organizationId: message.organizationId,
          reason: 'TASKS queue binding is not configured',
        })
        return
      }

      await queue.send({
        id: billingTaskId(message),
        orgId: message.organizationId,
        enqueuedAt: Date.now(),
        kind: message.kind,
        payload: message,
      })
    },
  }
}

/* ------------------------------------------------------------------ logger */

type LogFieldValue = string | number | boolean | null | undefined

/** Billing logs take `unknown` fields; the sink takes JSON-safe ones. */
function toLogFields(
  fields: Readonly<Record<string, unknown>> | undefined,
): Record<string, LogFieldValue> {
  if (fields === undefined) return {}
  const result: Record<string, LogFieldValue> = {}
  for (const [key, value] of Object.entries(fields)) {
    result[key] =
      value === null ||
      value === undefined ||
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
        ? value
        : JSON.stringify(value)
  }
  return result
}

export function createBillingLogger(
  component: string,
  organizationId?: string,
): BillingLogger {
  const logger = createLogger({
    level: resolveLogLevel(env.LOG_LEVEL),
    context: {
      component,
      orgId: organizationId,
      environment:
        typeof env.ENVIRONMENT === 'string' ? env.ENVIRONMENT : undefined,
    },
  })

  return {
    info: (message, fields) => logger.info(message, toLogFields(fields)),
    warn: (message, fields) => logger.warn(message, toLogFields(fields)),
    error: (message, fields) =>
      logger.error(message, undefined, toLogFields(fields)),
  }
}

/* ----------------------------------------------------------------- runtime */

export interface BillingRuntimeOptions {
  /**
   * The caller's tenant scope. Present on every in-request path, absent in the
   * webhook, which has no session and never reads usage.
   */
  readonly scope?: TenantScope
  /** `worker` for HTTP routes, `queue` for consumers — logged on every line. */
  readonly component?: string
}

/** The billing runtime for this request, wired to the Worker's bindings. */
export function billingRuntime(
  options: BillingRuntimeOptions = {},
): BillingRuntime {
  const db = options.scope?.db ?? getDb()
  const logger = createBillingLogger(
    options.component ?? 'worker',
    options.scope?.ctx.organizationId,
  )

  // Memoised per runtime, so two operations in one request share one client.
  let stripe: Stripe | null = null

  return {
    /**
     * Built on first use, not on construction.
     *
     * The billing screen reads the plan in force and the usage meters, and both
     * come from our own database. Constructing the client eagerly meant a
     * workspace with no `STRIPE_SECRET_KEY` — a fresh self-hosted deployment, or
     * any local checkout — got an error page there instead of its plan, and the
     * missing-secret message was rendered into the browser. Now only the
     * operations that genuinely talk to Stripe (checkout, the portal, the
     * invoice list) can fail, and each of those already has its own fallback.
     */
    get stripe(): Stripe {
      stripe ??= createStripeClient(stripeSecretKey())
      return stripe
    },
    webhookSecret: stripeWebhookSecret(),
    appUrl: billingAppUrl(),
    subscriptions: createSubscriptionStore(db),
    usage:
      options.scope === undefined
        ? UNAVAILABLE_USAGE
        : createUsageReader(options.scope),
    cache: env.KV,
    tasks: createBillingTaskQueue(env.TASKS, logger),
    logger,
    now: () => new Date(),
  }
}
