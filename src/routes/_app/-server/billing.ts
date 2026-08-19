/**
 * Server functions for the billing screen.
 *
 * The screen only ever learns things that are safe for it to know: which plan is
 * in force, what the workspace is consuming against it, its recent invoices, and
 * whether the viewer is allowed to spend the organization's money. It never
 * learns a Stripe price id, a customer id or a secret — the plan catalogue on the
 * client is enough to render a comparison, and every purchase resolves its price
 * again on the server from `src/lib/plans.ts`.
 *
 * The mutations return a URL rather than redirecting, so the client can show a
 * pending state on the button it came from and then hand the browser over.
 */
import { createServerFn } from '@tanstack/react-start'

import { getSession } from '#/server/auth/session'
import {
  changePlan,
  createPortalSession,
  listRecentInvoices,
  planSelectionInput,
  portalInput,
} from '#/server/billing/checkout'
import type { BillingRedirect, InvoiceSummary } from '#/server/billing/checkout'
import { entitlements } from '#/server/billing/entitlements'
import { billingRuntime } from '#/server/billing/runtime.cloudflare'
import { billingContext, canManageBilling } from '#/server/billing/types'
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
   * True when the invoice history could not be read from Stripe. The plan
   * summary and the meters are still accurate, so the screen degrades to a
   * single inline notice instead of an error page.
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
      // Stripe is a third party in the render path, so its failure must not take
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
 * Subscribe, upgrade, downgrade or switch interval.
 *
 * One entry point for all four because the customer's intent is identical —
 * "put this workspace on that plan" — and only Stripe's answer differs: a
 * Checkout Session when there is nothing to change, a Portal confirmation flow
 * when there is.
 */
export const startPlanChange = createServerFn({ method: 'POST' })
  .validator(planSelectionInput)
  .handler(async ({ data }): Promise<BillingRedirect> => {
    const { runtime, identity } = await billingSession()
    return await changePlan(runtime, identity, data)
  })

/** Open the Billing Portal — payment methods, receipts, cancellation. */
export const openBillingPortal = createServerFn({ method: 'POST' })
  .validator(portalInput)
  .handler(async ({ data }): Promise<BillingRedirect> => {
    const { runtime, identity } = await billingSession()
    return await createPortalSession(runtime, identity, data)
  })
