/**
 * `billing.subscription.changed` and `billing.invoice.paid` — the tenant-facing half of a webhook
 * delivery that has already been applied.
 *
 * The state-critical half never waited on this: `src/server/billing/webhook.ts` upserts the
 * subscription and invalidates entitlements synchronously and *then* enqueues, and its `enqueue()`
 * swallows a send failure on purpose so a queue problem can never turn into a provider retry that
 * redoes a write. What these handlers owe is the follow-up — the inbox row and the email that tell
 * the people who pay for the workspace that the plan moved or the invoice cleared. Before they
 * existed both kinds fell through `runHandler` to `unhandled()`, dead-lettering on first delivery.
 *
 * ## What the envelope may and may not decide
 *
 * The envelope names the organization and nothing else that matters here — the plan, the status and
 * the amounts on it are the provider's own words, repeated into the sentence and never used to pick
 * a row. Every read runs under a scope built from the envelope's organization, so a forged envelope
 * can only address a tenant it already names, and the recipients are derived inside `dispatch()`
 * from `member`, not from the message.
 *
 * ## Why these events are workspace-scoped
 *
 * A billing event has no trip. `dispatch()` therefore takes them on its `organization` branch,
 * which reaches the workspace's `owner`s and `admin`s — the people who can act on a plan change or
 * a failed charge — instead of every member of a trip nobody has mentioned.
 */

import { drizzle } from 'drizzle-orm/d1'

import { planById } from '#/lib/plans'
import { dispatchQuietly } from '#/server/notifications/dispatch'
import { createScope, getOrganization, listMembers } from '#/server/repos'
import { TaskConfigurationError, TaskPermanentError } from '../types'

import type { SubscriptionStatus } from '#/lib/plans'
import type { Database } from '#/server/db/types'
import type { DispatchDeps } from '#/server/notifications/dispatch'
import type { TenantScope } from '#/server/repos'
import type {
  InvoicePaidPayload,
  SubscriptionChangedPayload,
  TaskBindings,
  TaskContext,
  TaskHandler,
  TaskMetrics,
} from '../types'

/** The D1 binding as `TaskBindings` declares it, without the `undefined`. */
type D1Handle = NonNullable<TaskBindings['DB']>

/**
 * How a D1 binding becomes a Drizzle handle — the seam `travel-stats` opened and for the same
 * mechanical reason: `src/server/db/client.ts` reads the ambient Worker environment at module
 * scope, and the server suite runs in plain Node where `cloudflare:workers` does not resolve.
 */
export type DatabaseFor = (binding: D1Handle) => Database

/** Where a billing notification sends the reader. */
const BILLING_ACTION_URL = '/settings/billing'

/**
 * The user a probe read acts as before a real member is known — the same fabricated value, and the
 * same bound on it, as `src/server/queue/reminders.ts` uses. The one read made through the probe,
 * `listMembers`, is `tenantFilter()`-bound on `organization_id` and compares no user id at all, so
 * the probe sees exactly the rows the organization already owns. It is never used to write.
 */
const PROBE_USER_ID = 'system'

/**
 * The stored event a subscription move is announced as.
 *
 * Two kinds, not one, because the sentence has to be true: a move into `past_due` or `unpaid` is a
 * charge that did not go through, and "you are now on the Crew plan" is the wrong thing to tell
 * someone whose card was declined. The webhook enqueues the dunning path as a
 * `billing.subscription.changed` with `status: 'past_due'` (`onOrderProgressed`), which is the only
 * shape a failed payment has — Polar has no `order.payment_failed` event (`docs/ARCHITECTURE.md`).
 *
 * Checked against the status vocabulary rather than held as plain strings: a set of `string`
 * would go on compiling after a status is renamed, and the branch would silently stop matching —
 * every declined card would then be announced as a plan change.
 */
const FAILED_PAYMENT_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  'past_due',
  'unpaid',
] as const satisfies ReadonlyArray<SubscriptionStatus>)

/**
 * The tenant scope a billing follow-up runs under.
 *
 * A billing envelope names no user, so the scope's principal is read rather than carried: the first
 * `owner` the workspace's `member` rows hold. The role is not re-derived the way `travel-stats`
 * re-derives it, because there is nothing to re-derive from — the user id and the role came out of
 * the same tenant-filtered read, not off the message.
 *
 * A workspace that other people belong to keeps at least one owner. The Better Auth `organization()`
 * calls (remove member, leave) refuse to take the last one (remove member only in process: its HTTP
 * route is closed, like update-member-role's), the product's own `changeMemberRoleFn` refuses to
 * demote it, and console account deletion (`deletePlatformUser`) refuses the only owner of a
 * workspace with other members.
 * The repository's `removeMember` guards nothing here: it has no production caller. An organization
 * without an owner is therefore a row-level breakage (or a workspace whose only member was deleted)
 * that will not resolve itself: a permanent failure with a named
 * reason, never five retries.
 */
async function scopeForWorkspace(
  db: Database,
  organizationId: string,
): Promise<TenantScope> {
  const probe = createScope(db, {
    userId: PROBE_USER_ID,
    organizationId,
    role: 'member',
    impersonatedBy: null,
  })

  const owner = (await listMembers(probe)).find((row) => row.role === 'owner')
  if (owner === undefined) {
    throw new TaskPermanentError(
      `Organization ${organizationId} has no owner to attribute a billing notification to`,
    )
  }

  return createScope(db, {
    userId: owner.userId,
    organizationId,
    role: 'owner',
    impersonatedBy: null,
  })
}

/** One billing follow-up, in the vocabulary `dispatch()` takes. */
interface BillingNotification {
  /** Also the catalogue key and the `event_type` the preference matrix switches. */
  readonly kind: string
  readonly entityType: string
  readonly params: Record<string, string>
}

/**
 * Everything the two handlers share: resolve the scope, name the workspace, fan out, report.
 *
 * `dispatchQuietly` rather than `dispatch`, and deliberately: the provider has already been acked
 * and the subscription row already written, so a catalogue miss or an unreachable queue must not
 * dead-letter an envelope whose work is done. What it swallows is logged, and the metrics below
 * say plainly that nothing went out.
 */
async function announce(
  databaseFor: DatabaseFor,
  context: TaskContext,
  providerEventId: string,
  build: (organizationName: string) => BillingNotification,
): Promise<TaskMetrics> {
  const binding = context.env.DB
  if (binding === undefined) {
    throw new TaskConfigurationError(
      'DB binding is not available to the queue consumer; a billing follow-up cannot be delivered',
    )
  }

  const scope = await scopeForWorkspace(databaseFor(binding), context.orgId)
  const organization = await getOrganization(scope)
  const notification = build(organization.name)

  const deps: DispatchDeps = {
    queue: context.env.TASKS,
    logger: context.logger,
    appUrl: context.env.APP_URL,
    now: context.now,
  }

  const result = await dispatchQuietly(
    scope,
    {
      kind: notification.kind,
      entityType: notification.entityType,
      // The provider event id — a UUID, so it fits `idSchema`'s 64 characters — which makes the
      // row a redelivery would write the same row and the email envelope id the same id.
      entityId: providerEventId,
      // No `actorUserId`: a billing event is the system speaking and excludes nobody, least of all
      // the owner the scope happens to be built from.
      scope: 'organization',
      // No `titleKey`/`bodyKey`: both default to the kind, which is the shipped catalogue key.
      titleParams: notification.params,
      bodyParams: notification.params,
      actionUrl: BILLING_ACTION_URL,
    },
    deps,
  )

  return {
    event: notification.kind,
    recipients: result?.recipients.length ?? 0,
    inAppWritten: result?.inAppWritten ?? 0,
    emailsEnqueued: result?.emailsEnqueued ?? 0,
  }
}

/**
 * Builds both handlers over one database seam. {@link handleSubscriptionChanged} and
 * {@link handleInvoicePaid} are the ones `consumer.ts` registers; a test builds its own against
 * the harness.
 */
export function createBillingHandlers(
  databaseFor: DatabaseFor = (binding) => drizzle(binding),
): {
  subscriptionChanged: TaskHandler<'billing.subscription.changed'>
  invoicePaid: TaskHandler<'billing.invoice.paid'>
} {
  return {
    async subscriptionChanged(
      payload: SubscriptionChangedPayload,
      context: TaskContext,
    ): Promise<TaskMetrics> {
      return announce(
        databaseFor,
        context,
        payload.providerEventId,
        (organizationName): BillingNotification =>
          FAILED_PAYMENT_STATUSES.has(payload.status)
            ? {
                kind: 'billing.payment_failed',
                entityType: 'subscription',
                params: { organizationName },
              }
            : {
                kind: 'billing.plan_changed',
                entityType: 'subscription',
                // The catalogue plan's own name — a brand, identical in all twenty-three locales.
                params: {
                  organizationName,
                  plan: planById(payload.planId).name,
                },
              },
      )
    },

    async invoicePaid(
      payload: InvoicePaidPayload,
      context: TaskContext,
    ): Promise<TaskMetrics> {
      return announce(
        databaseFor,
        context,
        payload.providerEventId,
        (organizationName) => ({
          kind: 'billing.invoice_paid',
          entityType: 'invoice',
          // Not the amount: money is formatted per locale at render time and a stored param is
          // substituted verbatim, so a receipt sentence carrying one would print a workspace's
          // layout on every other reader's screen. The billing screen has the figure.
          params: { organizationName },
        }),
      )
    },
  }
}

const handlers = createBillingHandlers()

/** The handlers `consumer.ts` registers, over the Worker's own D1 binding. */
export const handleSubscriptionChanged = handlers.subscriptionChanged
export const handleInvoicePaid = handlers.invoicePaid
