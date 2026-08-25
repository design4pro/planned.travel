/**
 * The three reads the account screen needs that no existing console function can answer.
 *
 * **Where each one goes, and why none of them writes SQL against a table that has a repository.**
 * `docs/SPEC.md` §6 puts every SQL statement in `src/server/repos`, with `src/server/catalog` as the
 * single stated exception for the nine global tables, and this module used to break that rule four
 * tables wide — `member`, `organization` and `subscriptions` were joined on the plain platform D1
 * handle from inside `src/routes/**`. They are not any more:
 *
 * - **`member` and `organization` are auth-owned**, so they are read through Better Auth's own
 *   database adapter, exactly as `src/server/fns/console/adapter-reads.ts` reads `session` and
 *   `user`. The adapter already knows their field mapping; no statement is written here.
 * - **`subscriptions` is tenant data with a repository**, so the read is
 *   {@link findSubscriptionByOrganizationUnscoped} in `src/server/repos/billing.ts` — the layering
 *   §6 states in as many words, "routes call server functions; server functions call repos".
 *   `createTenantRepository()` is deliberately *not* reached for: §5 forbids handing it a fabricated
 *   context to get at rows the operator is not a member of, and a platform admin reading somebody
 *   else's workspace is precisely that case. The unscoped read is scoped instead by the organization
 *   ids the account under review belongs to, never by a scope the operator does not hold.
 *
 * **What is left is one statement against one global table, and its home is elsewhere.**
 * `platform_audit_log` carries no `organization_id`, so it cannot pass through the tenant repository
 * at all (§5), and §6 names `src/server/catalog` as the one directory its SQL may live in — beside
 * `appendPlatformAudit`, which is already its single writer. That directory is not this work item's
 * to edit, and the ownership rule is that necessary work elsewhere is reported rather than performed,
 * so {@link readAccountAudit} is written here and the move is reported with this item. It is one
 * `select` on one table with no join, so the move is a cut and a paste.
 *
 * **Authorisation is not decided here.** {@link readAccountContext} opens a console call first, so
 * `requirePermission` has answered `user:get` before a single row is read, exactly as every other
 * console read does. `docs/ACCESS.md` §4.2 closes the audit vocabulary at thirty-one mutations and
 * says in as many words that reads are not among them, so none of this writes a ledger row.
 */

import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'

import { getAuth } from '#/server/auth'
import { platformAuditLog } from '#/server/db/schema'
import { platformDb } from '#/server/fns/console/bindings'
import { openConsoleCall, recordConsoleRead } from '#/server/fns/console/context'
import { findSubscriptionByOrganizationUnscoped } from '#/server/repos/billing'

import type { AuthReadAdapter } from '#/server/fns/console/adapter-reads'

/** One workspace this account belongs to, and the role it holds inside it. */
export interface ConsoleMembership {
  readonly organizationId: string
  readonly name: string
  readonly slug: string
  /** `owner`, `admin` or `member` — the *workspace* vocabulary, never the platform one. */
  readonly role: string
  readonly joinedAt: string | null
  /** The workspace's billing tier, or `null` where no subscription row exists yet. */
  readonly plan: string | null
  readonly planStatus: string | null
}

/** What a workspace this account owns is paying for. */
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

/** One `platform_audit_log` row, as the account timeline reads it. */
export interface ConsoleAuditEntry {
  readonly id: string
  readonly action: string
  readonly entityType: string
  readonly actorKind: string
  readonly actorRole: string | null
  readonly actorName: string | null
  readonly at: string
  /**
   * The `changes` column, verbatim.
   *
   * Not diffed here. The rendering of a before/after pair is presentation, it belongs beside the
   * component that draws it (`auditChanges` in `#/components/console`), and putting it there is what
   * lets it be tested — this module imports the Worker binding seam and cannot be loaded by the
   * `server` Vitest project at all. There is nothing to withhold: `auditUserState` builds both sides
   * from a fixed key set that has never carried a credential.
   */
  readonly changes: ConsoleAuditPayload | null
}

/**
 * The `changes` column as it crosses the wire.
 *
 * Narrower than the column's own `PlatformAuditChanges`, whose sides are `Record<string, unknown>`:
 * an `unknown` value inside a server function's return type resolves to `unknown` for the whole
 * loader result, so the account screen's four panels all lost their types at once. Every value the
 * writers actually put in either side is a JSON scalar — `auditUserState` builds both from a fixed
 * key set of strings, booleans and nulls — so this states that rather than widening it and losing
 * the type of everything beside it. `auditChanges` still takes `unknown` and reads what is there.
 */
export type ConsoleAuditPayload = {
  readonly before: Readonly<
    Record<string, string | number | boolean | null>
  > | null
  readonly after: Readonly<
    Record<string, string | number | boolean | null>
  > | null
}

/** Everything the account screen renders beside the identity card and the session list. */
export interface ConsoleAccountContext {
  readonly memberships: ReadonlyArray<ConsoleMembership>
  /** True when the account belongs to more workspaces than {@link MEMBERSHIP_LIMIT} shows. */
  readonly membershipsTruncated: boolean
  readonly subscriptions: ReadonlyArray<ConsoleSubscription>
  readonly audit: ReadonlyArray<ConsoleAuditEntry>
  /** True when the ledger holds more rows than {@link AUDIT_LIMIT} shows. */
  readonly auditTruncated: boolean
}

/**
 * How many ledger rows the timeline shows.
 *
 * One more than that is fetched, which is how "there are more" is known without a second `COUNT`
 * over an append-only table that only ever grows.
 */
export const AUDIT_LIMIT = 12

/**
 * How many workspaces the panel lists.
 *
 * Twelve rather than a round fifty, because every one of them costs a billing lookup: the plan
 * column beside a workspace's name is what tells two workspaces with the same name apart, and it is
 * read per organization through the repository rather than joined here. Twelve keeps the screen
 * inside `docs/ARCHITECTURE.md` §2.1's D1 budget for a document request in the case that actually
 * occurs — one or two workspaces — and bounds the case that does not. One extra row is fetched, so
 * "there are more" is a fact rather than a guess, and the panel says so.
 */
export const MEMBERSHIP_LIMIT = 12

/**
 * The `entity_type` a row about one account carries.
 *
 * `docs/ACCESS.md` §4.4's timeline query is `(entity_type, entity_id)` ordered by `created_at`, and
 * `platform_audit_log_entity_idx` is the three-column index it was created for. This is that query.
 *
 * **One entity type, and the session verbs are missing from this timeline because of a defect
 * elsewhere.** `platform.session.revoked` records the *session's* id as its entity, and
 * `platform.session.revoked_all` records `entity_id: null` with the account only inside `changes` —
 * measured in the ledger, not inferred. So neither can be found by any account's timeline, and an
 * operator reading this panel sees a suspension without the sessions it ended. Adding `'session'` to
 * this filter would not fix it: there is nothing on the other side to match. The repair is in
 * `src/server/fns/console/sessions.ts`, which is not this item's to edit, and it is reported with
 * it — the moment those two rows name the account, they appear here with no change to this query.
 */
const ACCOUNT_ENTITY_TYPE = 'user'

/**
 * One side of a `changes` payload, narrowed to what can cross the wire.
 *
 * A cast would have been a lie about a `text({ mode: 'json' })` column that no schema validates on
 * the way out. Every value the writers put there is a JSON scalar, so a scalar passes through and
 * anything else is stringified once, here, rather than reaching a component that would have to
 * decide what to do with an object at render time.
 */
function toScalarRecord(
  value: unknown,
): Readonly<Record<string, string | number | boolean | null>> | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const scalars: Record<string, string | number | boolean | null> = {}
  for (const [key, item] of Object.entries(value)) {
    scalars[key] =
      typeof item === 'string' ||
      typeof item === 'number' ||
      typeof item === 'boolean'
        ? item
        : item === null || item === undefined
          ? null
          : JSON.stringify(item)
  }
  return scalars
}

/** Both sides, or `null` for a row that recorded no payload at all. */
function toAuditPayload(value: unknown): ConsoleAuditPayload | null {
  if (typeof value !== 'object' || value === null) {
    return null
  }
  const { before, after } = value as { before?: unknown; after?: unknown }
  return { before: toScalarRecord(before), after: toScalarRecord(after) }
}

/**
 * An instant as the adapter hands it back, as an ISO string.
 *
 * The Drizzle adapter returns a `Date` for a `timestamp_ms` column and a driver that ever answers a
 * number or a string is a runtime surprise rather than a type error, so all three are read and
 * anything else is refused. `null` is a real answer for a row whose column is genuinely empty.
 */
const instantSchema = z
  .union([z.date(), z.string(), z.number()])
  .nullish()
  .transform((value) => {
    if (value === null || value === undefined) return null
    const at = value instanceof Date ? value : new Date(value)
    return Number.isNaN(at.getTime()) ? null : at.toISOString()
  })

/** One `member` row, as much of it as this screen reads. */
const memberRowSchema = z.object({
  organizationId: z.string(),
  role: z.string(),
  createdAt: instantSchema,
})

/** One `organization` row, as much of it as this screen reads. */
const organizationRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
})

/** One `user` row, read only to put a name on a ledger entry's actor. */
const actorRowSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
})

/**
 * Better Auth's own database adapter, resolved per isolate.
 *
 * The same handle `src/server/fns/console/adapter-reads.ts` takes, obtained the same way. It is not
 * imported from `#/server/fns/console/bindings` because that module keeps it private on purpose —
 * its exports are bound page readers rather than a raw adapter — and widening it to hand one out
 * would put a second door on a seam that exists to have one.
 */
async function authAdapter(): Promise<AuthReadAdapter> {
  const context = await getAuth().$context
  return context.adapter
}

/**
 * The workspaces, the subscriptions behind them and the ledger, for one account.
 *
 * The guard is opened once and the two independent halves run together — the workspaces and the
 * ledger know nothing about each other. Only the actors' names wait, because which accounts to look
 * up is not known until the ledger page has come back, and one read for the whole page is cheaper
 * than a join per row. That is the shape `docs/ARCHITECTURE.md` §2.1 budgets for a document
 * request: one KV session read, a handful of D1 queries.
 */
export async function readAccountContext(
  userId: string,
): Promise<ConsoleAccountContext> {
  const call = await openConsoleCall({ user: ['get'] })
  const adapter = await authAdapter()

  const [workspaces, ledger] = await Promise.all([
    readAccountWorkspaces(adapter, userId),
    readAccountAudit(userId),
  ])
  const audit = await nameAuditActors(adapter, ledger.slice(0, AUDIT_LIMIT))

  recordConsoleRead(call, 'user', {
    memberships: workspaces.memberships.length,
    auditRows: audit.length,
  })

  return {
    memberships: workspaces.memberships,
    membershipsTruncated: workspaces.truncated,
    subscriptions: workspaces.subscriptions,
    audit,
    auditTruncated: ledger.length > AUDIT_LIMIT,
  }
}

/**
 * Where this account belongs and what those workspaces pay, with no SQL of this module's own.
 *
 * `member` and `organization` come back through the auth adapter; the billing row behind each
 * workspace comes back through `src/server/repos/billing.ts`. A membership whose organization row
 * has vanished is dropped rather than rendered as a blank line: the two reads are not in one
 * transaction, so a workspace deleted between them is an ordinary race and not a fault.
 */
async function readAccountWorkspaces(
  adapter: AuthReadAdapter,
  userId: string,
): Promise<{
  readonly memberships: ReadonlyArray<ConsoleMembership>
  readonly truncated: boolean
  readonly subscriptions: ReadonlyArray<ConsoleSubscription>
}> {
  const rows = await adapter.findMany<unknown>({
    model: 'member',
    where: [{ field: 'userId', value: userId }],
    sortBy: { field: 'createdAt', direction: 'asc' },
    limit: MEMBERSHIP_LIMIT + 1,
  })
  const parsed = rows.flatMap((row) => {
    const member = memberRowSchema.safeParse(row)
    return member.success ? [member.data] : []
  })
  const shown = parsed.slice(0, MEMBERSHIP_LIMIT)
  if (shown.length === 0) {
    return { memberships: [], truncated: false, subscriptions: [] }
  }

  const organizationIds = shown.map((row) => row.organizationId)
  const db = platformDb()
  const [organizationRows, billingRows] = await Promise.all([
    adapter.findMany<unknown>({
      model: 'organization',
      where: [{ field: 'id', operator: 'in', value: organizationIds }],
      limit: organizationIds.length,
    }),
    Promise.all(
      organizationIds.map(async (organizationId) =>
        findSubscriptionByOrganizationUnscoped(db, organizationId),
      ),
    ),
  ])

  const organizations = new Map(
    organizationRows.flatMap((row) => {
      const organization = organizationRowSchema.safeParse(row)
      return organization.success
        ? ([[organization.data.id, organization.data]] as const)
        : []
    }),
  )
  const billing = new Map(
    organizationIds.map((organizationId, index) => [
      organizationId,
      billingRows[index] ?? null,
    ]),
  )

  const memberships: Array<ConsoleMembership> = []
  const subscriptions: Array<ConsoleSubscription> = []
  for (const row of shown) {
    const organization = organizations.get(row.organizationId)
    if (organization === undefined) continue
    const subscription = billing.get(row.organizationId) ?? null

    memberships.push({
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      role: row.role,
      joinedAt: row.createdAt,
      plan: subscription?.plan ?? null,
      planStatus: subscription?.status ?? null,
    })

    // Only the workspaces this account *owns*: a member of somebody else's crew workspace is not who
    // that workspace bills, and printing the bill on their page would say they were.
    if (row.role === 'owner' && subscription !== null) {
      subscriptions.push({
        organizationId: organization.id,
        organizationName: organization.name,
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

  return {
    memberships,
    truncated: parsed.length > MEMBERSHIP_LIMIT,
    subscriptions,
  }
}

/** One ledger row before its actor has a name. */
type LedgerRow = Omit<ConsoleAuditEntry, 'actorName'> & {
  readonly actorUserId: string | null
}

/**
 * `docs/ACCESS.md` §4.4's timeline query, and the only statement this module writes.
 *
 * One `select`, one table, no join — `platform_audit_log` by `(entity_type, entity_id)` newest
 * first, on `platform_audit_log_entity_idx`. `id` breaks the tie on `created_at`, which is a
 * millisecond stamp two rows written in the same call can share; without it the two halves of a
 * password reset would swap places between renders.
 *
 * Its home is `src/server/catalog`, beside `appendPlatformAudit` — see the note at the top of this
 * file for why it is not there yet and what moving it costs.
 */
async function readAccountAudit(
  userId: string,
): Promise<ReadonlyArray<LedgerRow>> {
  const rows = await platformDb()
    .select({
      id: platformAuditLog.id,
      action: platformAuditLog.action,
      entityType: platformAuditLog.entityType,
      actorKind: platformAuditLog.actorKind,
      actorRole: platformAuditLog.actorRole,
      actorUserId: platformAuditLog.actorUserId,
      createdAt: platformAuditLog.createdAt,
      changes: platformAuditLog.changes,
    })
    .from(platformAuditLog)
    .where(
      and(
        eq(platformAuditLog.entityType, ACCOUNT_ENTITY_TYPE),
        eq(platformAuditLog.entityId, userId),
      ),
    )
    .orderBy(desc(platformAuditLog.createdAt), desc(platformAuditLog.id))
    .limit(AUDIT_LIMIT + 1)

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    actorKind: row.actorKind,
    actorRole: row.actorRole,
    actorUserId: row.actorUserId,
    at: row.createdAt.toISOString(),
    changes: toAuditPayload(row.changes),
  }))
}

/**
 * Puts a name on each entry's actor, through the adapter rather than a join.
 *
 * One read for the whole page, keyed by the distinct actor ids on it — an operator who took five
 * actions is looked up once. An id with no `user` row left is a deleted account, which the ledger
 * outlives by design (`actor_user_id` carries no foreign key), and `describeAuditActor` says so in
 * words rather than printing a stale name.
 */
async function nameAuditActors(
  adapter: AuthReadAdapter,
  rows: ReadonlyArray<LedgerRow>,
): Promise<ReadonlyArray<ConsoleAuditEntry>> {
  const ids = [
    ...new Set(
      rows.flatMap((row) => (row.actorUserId === null ? [] : [row.actorUserId])),
    ),
  ]
  const names = new Map<string, string | null>()
  if (ids.length > 0) {
    const actors = await adapter.findMany<unknown>({
      model: 'user',
      where: [{ field: 'id', operator: 'in', value: ids }],
      limit: ids.length,
    })
    for (const actor of actors) {
      const parsed = actorRowSchema.safeParse(actor)
      if (parsed.success) {
        names.set(parsed.data.id, parsed.data.name ?? null)
      }
    }
  }

  return rows.map(({ actorUserId, ...row }) => ({
    ...row,
    actorName: actorUserId === null ? null : (names.get(actorUserId) ?? null),
  }))
}
