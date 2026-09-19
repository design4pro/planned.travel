/**
 * Server functions for the billing screen.
 *
 * The screen only ever learns things that are safe for it to know: which plan is
 * in force, what the workspace is consuming against it, its recent orders, and
 * whether the viewer is allowed to spend the organization's money. It never
 * learns a Polar product id, a customer id or a secret — the plan catalogue on
 * the client is enough to render a comparison, and every purchase resolves its
 * price again on the server from `src/lib/plans.ts`.
 *
 * The mutations return a URL rather than redirecting, so the client can show a
 * pending state on the button it came from and then hand the browser over.
 */
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'

import { getSession } from '#/server/auth/session'
import {
  applyDiscountToCurrentPlan,
  changePlan,
  createPortalSession,
  discountCodeInput,
  listRecentInvoices,
  orderInvoiceInput,
  orderInvoiceUrl,
  planSelectionInput,
  portalInput,
} from '#/server/billing/checkout'
import type {
  BillingRedirect,
  InvoiceSummary,
  OrderInvoiceResult,
  PlanChangeResult,
} from '#/server/billing/checkout'
import { entitlements } from '#/server/billing/entitlements'
import { PolarApiError } from '#/server/billing/polar'
import { billingRuntime } from '#/server/billing/runtime.cloudflare'
import {
  BillingConfigError,
  billingContext,
  canManageBilling,
} from '#/server/billing/types'
import { getOrganization } from '#/server/repos'
import { appScope } from './context'

import type {
  BillingIdentity,
  BillingRuntime,
  Entitlements,
} from '#/server/billing/types'
import type { TenantScope } from '#/server/repos'

/* ----------------------------------------------------------------- identity */

/**
 * Who is asking, and on whose behalf.
 *
 * The role comes from the tenant scope, which re-reads membership rather than
 * trusting the session cookie, so a demoted admin loses the upgrade button on
 * their very next request.
 */
async function billingIdentity(scope: TenantScope): Promise<BillingIdentity> {
  const [session, organization] = await Promise.all([
    getSession(),
    getOrganization(scope),
  ])
  if (session === null) {
    throw new Error('Your session has expired. Sign in again to continue.')
  }

  return {
    userId: scope.ctx.userId,
    userEmail: session.user.email,
    userName: session.user.name,
    organizationId: scope.ctx.organizationId,
    organizationName: organization.name,
    role: scope.ctx.role,
    // Cloudflare terminates the connection, so this is the client address; every other
    // candidate is a header the client writes. Read only by the promotion-code limiter.
    clientIp: getRequestHeader('cf-connecting-ip') ?? null,
  }
}

async function billingSession(): Promise<{
  scope: TenantScope
  runtime: BillingRuntime
  identity: BillingIdentity
}> {
  const scope = await appScope()
  const runtime = billingRuntime({ scope })
  return { scope, runtime, identity: await billingIdentity(scope) }
}

/* --------------------------------------------------------------------- read */

export interface BillingPayload {
  readonly entitlements: Entitlements
  readonly invoices: ReadonlyArray<InvoiceSummary>
  /**
   * True when the order history could not be read from Polar. The plan summary
   * and the meters are still accurate, so the screen degrades to a single
   * inline notice instead of an error page.
   */
  readonly invoicesUnavailable: boolean
  readonly canManage: boolean
  readonly organizationName: string
}

export const loadBilling = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BillingPayload> => {
    const { runtime, identity } = await billingSession()
    const ctx = billingContext(runtime, identity.organizationId)

    const [state, invoices] = await Promise.all([
      entitlements(ctx),
      // Polar is a third party in the render path, so its failure must not take
      // the plan summary down with it.
      listRecentInvoices(runtime, identity.organizationId).catch(
        (cause: unknown) => {
          runtime.logger.warn('billing.invoices.unavailable', {
            organizationId: identity.organizationId,
            message: cause instanceof Error ? cause.message : String(cause),
          })
          return null
        },
      ),
    ])

    return {
      entitlements: state,
      invoices: invoices ?? [],
      invoicesUnavailable: invoices === null,
      canManage: canManageBilling(identity),
      organizationName: identity.organizationName,
    }
  },
)

/* ---------------------------------------------------------------- mutations */

/**
 * What the browser is allowed to read when a provider call fails.
 *
 * TanStack serialises a thrown message straight through to the client, and the
 * two error types this path can raise are written for an operator, not for a
 * customer: `PolarApiError` carries the request path, the subscription id and a
 * slice of Polar's response body, and `BillingConfigError` carries the exact
 * `wrangler secret put` command to run. Neither belongs on a billing screen.
 * Errors we wrote as customer copy — the forbidden guard, "no billing profile
 * yet" — are already the right sentence and pass through untouched.
 */
function customerFacing(cause: unknown): Error {
  if (cause instanceof BillingConfigError) {
    return new Error(
      'Billing is not connected on this deployment yet, so nothing was changed. Contact support and we will sort it out.',
    )
  }

  if (cause instanceof PolarApiError) {
    if (cause.status === 422 || cause.status === 402) {
      return new Error(
        'Polar would not accept that change. Check the seat count against the members you have, then try again or make the change in the billing portal.',
      )
    }
    if (cause.status === 429) {
      return new Error(
        'Polar is rate-limiting us at the moment. Nothing was changed — try again in a minute.',
      )
    }
    return new Error(
      'The billing provider did not complete that request, so nothing was changed. Try again in a moment.',
    )
  }

  return cause instanceof Error
    ? cause
    : new Error('That request did not complete. Try again in a moment.')
}

/**
 * Run one provider call, log the real failure and re-raise a readable one.
 *
 * The original is never swallowed: it goes to the structured log with the
 * organization it belongs to, which is where an operator looks for it.
 */
async function guarded<T>(
  runtime: BillingRuntime,
  organizationId: string,
  action: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    return await run()
  } catch (cause) {
    const readable = customerFacing(cause)
    if (readable !== cause) {
      runtime.logger.error('billing.action.failed', {
        organizationId,
        action,
        message: cause instanceof Error ? cause.message : String(cause),
      })
    }
    throw readable
  }
}

/**
 * Subscribe, upgrade, downgrade or switch interval.
 *
 * One entry point for all four because the customer's intent is identical —
 * "put this workspace on that plan" — and only the answer differs: a hosted
 * Checkout Session when the workspace has nothing to change yet, and a
 * server-side `PATCH /v1/subscriptions/{id}` when it does. The second case
 * comes back with `surface: 'applied'` and a URL on our own origin carrying
 * `?plan=changed`, because Polar has no hosted "confirm the proration" page to
 * send anybody to.
 *
 * A promotion code travels on the same selection. A refused code is not an error: it comes
 * back as `{ surface: 'discount_rejected', reason }`, nothing in Polar has changed, and the
 * screen shows the reason under the field. `customerFacing()` is not involved.
 */
export const startPlanChange = createServerFn({ method: 'POST' })
  .validator(planSelectionInput)
  .handler(async ({ data }): Promise<PlanChangeResult> => {
    const { runtime, identity } = await billingSession()
    return await guarded(runtime, identity.organizationId, 'plan_change', () =>
      changePlan(runtime, identity, data),
    )
  })

/**
 * **Apply to current plan**: attach a promotion code to the subscription in force. Only the code
 * travels; the plan is read from the subscription row, so this can never change the plan.
 */
export const applyPromotionCode = createServerFn({ method: 'POST' })
  .validator(discountCodeInput)
  .handler(async ({ data }): Promise<PlanChangeResult> => {
    const { runtime, identity } = await billingSession()
    return await guarded(runtime, identity.organizationId, 'plan_change', () =>
      applyDiscountToCurrentPlan(runtime, identity, data),
    )
  })

/**
 * Mint a customer session and hand back the hosted Polar Customer Portal URL.
 *
 * It takes no arguments. The provider before Polar accepted a deep-link intent
 * that opened the portal straight at a card update or a cancellation; Polar
 * mints one short-lived token for the portal home and that is the whole
 * surface, so three names that all produced the same URL became one action.
 * `portalInput` stays as the boundary that rejects a non-object payload.
 */
export const openBillingPortal = createServerFn({ method: 'POST' })
  .validator(portalInput)
  .handler(async ({ data }): Promise<BillingRedirect> => {
    const { runtime, identity } = await billingSession()
    return await guarded(runtime, identity.organizationId, 'portal', () =>
      createPortalSession(runtime, identity, data),
    )
  })

/**
 * The PDF for one order, resolved when a reader asks for it.
 *
 * Polar produces the document on demand — `POST /v1/orders/{id}/invoice` and
 * then a separate read for the signed URL — so doing it eagerly would cost two
 * extra provider calls per row on every page load. It is a per-row action
 * instead, and it is readable by anybody who can already read the order list:
 * `orderInvoiceUrl()` re-reads the order and refuses one that belongs to
 * another workspace, because the id arrived from a browser.
 *
 * The render is asynchronous, so the result is discriminated: `pending` is the
 * document still being written and is a state the screen draws, not an error.
 */
export const downloadInvoice = createServerFn({ method: 'POST' })
  .validator(orderInvoiceInput)
  .handler(async ({ data }): Promise<OrderInvoiceResult> => {
    const { runtime, identity } = await billingSession()
    return await guarded(runtime, identity.organizationId, 'invoice', () =>
      orderInvoiceUrl(runtime, identity.organizationId, data),
    )
  })
