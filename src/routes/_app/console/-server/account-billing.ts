/**
 * What the workspaces an account belongs to are paying for.
 *
 * **No SQL and no adapter read.** Every statement behind this file is in `src/server/repos/billing.ts`
 * — `docs/SPEC.md` §6's "routes call server functions; server functions call repos", which is the
 * shape fourteen other `-server/` modules in `src/routes/**` already have. The workspaces and the
 * ledger arrive through `#/server/fns/console/account`, whose reads are on their own layers; this
 * module only puts a plan beside a name.
 *
 * **The tenant repository is deliberately not reached for.** `docs/SPEC.md` §5 forbids handing
 * `createTenantRepository()` a fabricated context to reach rows the caller is not a member of, and a
 * platform admin reading somebody else's workspace is exactly that case. The unscoped read is scoped
 * instead by the organization ids the account under review belongs to — never by a scope the
 * operator does not hold — and it returns billing columns only.
 *
 * **One statement, not one per workspace.** The ids are read together through
 * {@link listSubscriptionsByOrganizationsUnscoped}, so a person in eight workspaces costs the same
 * one D1 query as a person in one. The earlier shape issued a lookup per membership, which put the
 * cost of a document request on how many crews somebody had joined.
 */

import { getDb } from '#/server/db/client'
import { listSubscriptionsByOrganizationsUnscoped } from '#/server/repos/billing'

import type { ConsoleMembership } from '#/server/fns/console/account'

/** A workspace this account belongs to, with the tier it runs on. */
export interface ConsoleWorkspace extends ConsoleMembership {
  /** The workspace's billing tier, or `null` where no subscription row exists yet. */
  readonly plan: string | null
}

/** What a workspace this account *owns* is paying for. */
export interface ConsoleSubscription {
  readonly organizationId: string
  readonly organizationName: string
  readonly plan: string
  readonly status: string
  readonly seats: number
  readonly seatLimit: number
  readonly currentPeriodEnd: string | null
  readonly cancelAtPeriodEnd: boolean
  readonly trialEndsAt: string | null
}

export interface AccountBilling {
  readonly workspaces: ReadonlyArray<ConsoleWorkspace>
  readonly subscriptions: ReadonlyArray<ConsoleSubscription>
}

/**
 * Puts a plan beside every workspace, and a subscription beside every workspace this account owns.
 *
 * The plan column is the workspace's, not this person's — it is here because "which workspace is
 * this, exactly" is a question a name and a slug only half answer, and a `Business` beside a name is
 * the fastest way to tell two workspaces called "Design" apart.
 *
 * Only the workspaces this account **owns** produce a subscription row. A member of somebody else's
 * crew workspace is not who that workspace bills, and printing the bill on their page would say they
 * were.
 */
export async function readAccountBilling(
  memberships: ReadonlyArray<ConsoleMembership>,
): Promise<AccountBilling> {
  if (memberships.length === 0) {
    return { workspaces: [], subscriptions: [] }
  }

  const rows = await listSubscriptionsByOrganizationsUnscoped(
    getDb(),
    memberships.map((membership) => membership.organizationId),
  )
  const byOrganization = new Map(rows.map((row) => [row.organizationId, row]))

  const workspaces: Array<ConsoleWorkspace> = []
  const subscriptions: Array<ConsoleSubscription> = []

  for (const membership of memberships) {
    const subscription = byOrganization.get(membership.organizationId) ?? null
    workspaces.push({ ...membership, plan: subscription?.plan ?? null })

    if (membership.role === 'owner' && subscription !== null) {
      subscriptions.push({
        organizationId: membership.organizationId,
        organizationName: membership.name,
        plan: subscription.plan,
        status: subscription.status,
        seats: subscription.seats,
        seatLimit: subscription.seatLimit,
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() ?? null,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      })
    }
  }

  return { workspaces, subscriptions }
}
