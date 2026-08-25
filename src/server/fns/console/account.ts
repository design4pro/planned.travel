/**
 * The two reads behind the account screen that no other console function answers: where an account
 * belongs, and what the platform has done to it.
 *
 * Both used to be written inside `src/routes/_app/console/-server/**` — a raw Drizzle `select`
 * against `platform_audit_log` and three `adapter.findMany` calls, in a route directory. That is the
 * layering `docs/SPEC.md` §6 states in one sentence, "routes call server functions; server functions
 * call repos", and it was broken in the one tree whose whole subject is authority. Each half is now
 * where the contract puts it:
 *
 * - **The ledger statement lives in `src/server/catalog/audit.ts`**, beside `appendPlatformAudit`.
 *   §6 names `server/catalog` as the single stated exception to the tenant-repository rule, and
 *   `platform_audit_log` carries no `organization_id` so it could never pass through the tenant
 *   layer at all (§5). The append and the timeline are two halves of one table's contract; splitting
 *   them across layers is how the ordering ends up restated somewhere it can drift.
 * - **`member`, `organization` and the actors' names are auth-owned**, so they are read through
 *   Better Auth's own database adapter in `./adapter-reads`, the one module in this directory that
 *   may hold a query. No SQL is written in `src/server/fns`, here or anywhere.
 *
 * **Authorisation is decided once, before a row is read.** {@link readAccountContext} opens a console
 * call for `user:get`, so `requirePermission` — the only implementation of "may this actor do this"
 * (docs/ACCESS.md §2.5) — has answered before the first read. Nothing here writes to the ledger:
 * §4.2 closes the audit vocabulary at thirty-one *mutations* and says in as many words that reads
 * are not among them.
 *
 * **Nothing here is a `createServerFn`.** The account screen resolves one loader call, and a second
 * server function beside it would be a second session resolution — one more KV read for the same
 * request — for a read the caller has already been authorised for. It is called from
 * `loadConsoleAccount`, which is the screen's one entry point.
 */

import { readPlatformAuditByEntity } from '#/server/catalog/audit'
import {
  platformDb,
  readMemberships,
  readNames,
  readWorkspaces,
} from './bindings'
import { openConsoleCall, recordConsoleRead } from './context'

/** One workspace this account belongs to, and the role it holds inside it. */
export interface ConsoleMembership {
  readonly organizationId: string
  readonly name: string
  readonly slug: string
  /** `owner`, `admin` or `member` — the *workspace* vocabulary, never the platform one. */
  readonly role: string
  readonly joinedAt: string | null
}

/**
 * The `changes` column as it crosses the wire.
 *
 * Narrower than the column's own `PlatformAuditChanges`, whose sides are `Record<string, unknown>`:
 * an `unknown` value inside a server function's return type resolves to `unknown` for the whole
 * loader result, so every panel on the account screen lost its type at once. Every value the writers
 * actually put in either side is a JSON scalar — `auditUserState` builds both from a fixed key set
 * of strings, booleans and nulls — so this states that rather than widening it and losing the type
 * of everything beside it. `auditChanges` still takes `unknown` and reads what is there.
 */
export type ConsoleAuditPayload = {
  readonly before: Readonly<
    Record<string, string | number | boolean | null>
  > | null
  readonly after: Readonly<
    Record<string, string | number | boolean | null>
  > | null
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
   * Not diffed here. Rendering a before/after pair is presentation, it belongs beside the component
   * that draws it (`auditChanges` in `#/components/console`), and putting it there is what lets it
   * be tested. There is nothing to withhold: `auditUserState` builds both sides from a fixed key set
   * that has never carried a credential.
   */
  readonly changes: ConsoleAuditPayload | null
}

/** Where the account belongs and what has been done to it. */
export interface ConsoleAccountContext {
  readonly memberships: ReadonlyArray<ConsoleMembership>
  /** True when the account belongs to more workspaces than {@link MEMBERSHIP_LIMIT} shows. */
  readonly membershipsTruncated: boolean
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
 * Twelve rather than a round fifty. Twelve keeps the screen inside `docs/ARCHITECTURE.md` §2.1's D1
 * budget for a document request in the case that actually occurs — one or two workspaces — and
 * bounds the case that does not. One extra row is fetched, so "there are more" is a fact rather than
 * a guess, and the panel says so.
 */
export const MEMBERSHIP_LIMIT = 12

/**
 * The `entity_type` a ledger row about one account carries.
 *
 * docs/ACCESS.md §4.4's timeline query is `(entity_type, entity_id)` ordered by `created_at`, and
 * `platform_audit_log_entity_idx` is the three-column index it was created for.
 *
 * **One entity type, and the session verbs are missing from this timeline because of a defect
 * elsewhere.** `platform.session.revoked` records the *session's* id as its entity, and
 * `platform.session.revoked_all` records `entity_id: null` with the account only inside `changes` —
 * measured in the ledger, not inferred. Neither can be found by any account's timeline, so an
 * operator reading this panel sees a suspension without the sessions it ended. Adding `'session'` to
 * this filter would not fix it: there is nothing on the other side to match. The repair is in
 * `./sessions.ts`, and the moment those two rows name the account they appear here with no change to
 * this query.
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
 * The workspaces and the ledger for one account, behind one guard.
 *
 * The two halves know nothing about each other and run together. Only the actors' names wait,
 * because which accounts to look up is not known until the ledger page has come back — and one read
 * for the whole page is cheaper than a join per row.
 */
export async function readAccountContext(
  userId: string,
): Promise<ConsoleAccountContext> {
  const call = await openConsoleCall({ user: ['get'] })

  const [membershipRows, ledgerRows] = await Promise.all([
    readMemberships(userId, MEMBERSHIP_LIMIT + 1),
    readPlatformAuditByEntity(platformDb(), {
      entityType: ACCOUNT_ENTITY_TYPE,
      entityId: userId,
      limit: AUDIT_LIMIT + 1,
    }),
  ])

  const shown = membershipRows.slice(0, MEMBERSHIP_LIMIT)
  const organizations = await readWorkspaces(
    shown.map((row) => row.organizationId),
  )
  const byId = new Map(
    organizations.map((organization) => [organization.id, organization]),
  )

  const memberships = shown.flatMap((row) => {
    const organization = byId.get(row.organizationId)
    return organization === undefined
      ? []
      : [
          {
            organizationId: organization.id,
            name: organization.name,
            slug: organization.slug,
            role: row.role,
            joinedAt: row.createdAt,
          },
        ]
  })

  const page = ledgerRows.slice(0, AUDIT_LIMIT)
  const names = await readNames([
    ...new Set(
      page.flatMap((row) =>
        row.actorUserId === null ? [] : [row.actorUserId],
      ),
    ),
  ])
  const audit = page.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    actorKind: row.actorKind,
    actorRole: row.actorRole,
    actorName:
      row.actorUserId === null ? null : (names.get(row.actorUserId) ?? null),
    at: row.createdAt.toISOString(),
    changes: toAuditPayload(row.changes),
  }))

  recordConsoleRead(call, 'user', {
    memberships: memberships.length,
    auditRows: audit.length,
  })

  return {
    memberships,
    membershipsTruncated: membershipRows.length > MEMBERSHIP_LIMIT,
    audit,
    auditTruncated: ledgerRows.length > AUDIT_LIMIT,
  }
}
