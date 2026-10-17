/**
 * The D1 reads this directory takes through Better Auth's own database adapter, written so they
 * can be driven by a test rather than described by one.
 *
 * They used to live in `./bindings`, which imports `cloudflare:workers` and therefore cannot be
 * loaded by the `server` Vitest project at all. The consequence was measured rather than suspected:
 * `__tests__/console.test.ts` replaces `../bindings` wholesale, so its factory carried a *copy* of
 * both queries, and every property those queries exist to hold — the expiry predicate, the total
 * order, the single expiry instant across a paged walk — was pinned against the copy while the
 * shipped query was executed by nothing. Deleting either clause from the real file left all 110
 * console tests green.
 *
 * So the queries take their adapter as an argument, exactly as `./session-keys` takes its page
 * function and its key store, and `./bindings` shrinks to the one thing only it can do: resolve the
 * adapter out of the Worker environment. The mock in `__tests__/console.test.ts` now calls straight
 * into this module, which puts the shipped query under the real Better Auth adapter over the real
 * SQLite schema, and `__tests__/adapter-reads.test.ts` asserts the query *shape* against a recording
 * double.
 *
 * Nothing here decides anything: no authorisation, no validation of a caller's input, no audit
 * write. It reads two things and reports what it read, including its own failure to read.
 */

import { z } from 'zod'

import {
  OWNERSHIP_READ_LIMIT,
  isOwnerRole,
  readOwnershipPage,
} from './last-owner'

import type { getAuth } from '#/server/auth'
import type { OwnershipRead } from './last-owner'

/**
 * The slice of Better Auth's database adapter these two reads use.
 *
 * Derived from the shipped instance rather than hand-declared, so a bump that changes the adapter's
 * query shape is a type error here instead of a runtime surprise, and so a test double has to be a
 * real adapter rather than an approximation of one.
 */
export type AuthReadAdapter = Pick<
  Awaited<ReturnType<typeof getAuth>['$context']>['adapter'],
  'findMany' | 'findOne'
>

/**
 * How the adapter is obtained, deferred because `getAuth().$context` is a promise resolved per
 * isolate and a page function must be constructible synchronously.
 */
export type AuthReadAdapterSource = () => Promise<AuthReadAdapter>

/**
 * A page function over one account's **live** session rows, read from D1 through Better Auth's own
 * adapter. It moved to `#/server/auth/session-blobs` (#1176), where the room-eviction hooks share
 * it, and is re-exported here so the console binds it to the shipped adapter in `./bindings`.
 */
export { createSessionPageReader } from '#/server/auth/session-blobs'

/**
 * What one attempt to read an account's platform role found — including the attempt that found
 * nothing, which is the whole reason this is not a `string | null`.
 *
 * `role` is `null` for an account whose column is `NULL`, which docs/ACCESS.md §1.3 resolves as
 * `user` and which is an ordinary, correct answer. `ok: false` is the *absence* of an answer, and
 * collapsing the two is how an admin's action ends up in the ledger under `actor_role: 'user'`:
 * `resolvePlatformRole(null)` is `'user'`, so a read that failed and a plain account are the same
 * value by the time the audit writer sees it. docs/ACCESS.md §4.1 records `actor_role` as a value
 * precisely so nothing can rewrite it afterwards, which makes writing the wrong one worse than
 * refusing to write at all.
 */
export type PlatformRoleRead =
  | { readonly ok: true; readonly role: string | null }
  | { readonly ok: false; readonly reason: PlatformRoleReadFailure }

/** Why a role read produced no answer. Separated because they lead to different operator advice. */
export type PlatformRoleReadFailure =
  /** The adapter answered, and there is no `user` row with that id. A retry will not help. */
  | 'not-found'
  /** The adapter rejected, or answered something that is not a `user` row. A retry may help. */
  | 'unreadable'

const userRoleSchema = z.object({ role: z.string().nullish() })

/**
 * One `user` row's platform role, straight from D1.
 *
 * `auth.api.getUser` would be the obvious call and cannot be used here: it checks `user:get` for
 * itself, and both callers run where no session holds a statement: the impersonation exit and the
 * auth hook that audits a workspace switch inside an impersonated session (docs/ACCESS.md §6.4). This is a read of one column of a row the caller has
 * already proved it is connected to, taken through the same adapter as
 * {@link createSessionPageReader}.
 *
 * The adapter's rejection is caught here rather than propagated so that the caller has exactly one
 * branch to write and every failure arrives through it — a rejected read and an unparseable row are
 * the same fact ("no answer") to everything downstream, and only this function can tell them apart
 * from a `NULL` column.
 */
export async function readPlatformRole(
  source: AuthReadAdapterSource,
  userId: string,
): Promise<PlatformRoleRead> {
  let row: unknown
  try {
    const adapter = await source()
    row = await adapter.findOne<unknown>({
      model: 'user',
      where: [{ field: 'id', value: userId }],
      select: ['role'],
    })
  } catch {
    return { ok: false, reason: 'unreadable' }
  }

  if (row === null || row === undefined) {
    return { ok: false, reason: 'not-found' }
  }

  const parsed = userRoleSchema.safeParse(row)
  if (!parsed.success) {
    return { ok: false, reason: 'unreadable' }
  }
  return { ok: true, role: parsed.data.role ?? null }
}

/**
 * One `member` row, as much of it as the account screen reads.
 *
 * `createdAt` comes back as a `Date` from the Drizzle adapter, but a driver that ever answers a
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

const memberRowSchema = z.object({
  organizationId: z.string(),
  /** `owner`, `admin` or `member` — the *workspace* vocabulary, never the platform one. */
  role: z.string(),
  createdAt: instantSchema,
})

/** A membership, before the workspace behind it has a name. */
export type MemberRow = z.output<typeof memberRowSchema>

const organizationRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
})

/** One workspace, as much of it as the account screen names. */
export type OrganizationRow = z.output<typeof organizationRowSchema>

const namedUserRowSchema = z.object({
  id: z.string(),
  name: z.string().nullish(),
})

/**
 * The workspaces one account belongs to, oldest membership first.
 *
 * `member` and `organization` are auth-owned tables, so they are read through Better Auth's own
 * database adapter exactly as {@link createSessionPageReader} reads `session` — the adapter already
 * knows their field mapping, and no SQL is written anywhere in `src/server/fns`. Ordering by
 * `createdAt` puts the workspace this account has been in longest at the top, which is the one an
 * operator is usually looking for.
 *
 * Ask for one row more than you intend to show: that is how "there are more" is known without a
 * second `COUNT` over a table the operator has no scope on.
 */
export async function readAccountMemberships(
  source: AuthReadAdapterSource,
  userId: string,
  limit: number,
): Promise<ReadonlyArray<MemberRow>> {
  const adapter = await source()
  const rows = await adapter.findMany<unknown>({
    model: 'member',
    where: [{ field: 'userId', value: userId }],
    sortBy: { field: 'createdAt', direction: 'asc' },
    limit,
  })
  return rows.flatMap((row) => {
    const parsed = memberRowSchema.safeParse(row)
    return parsed.success ? [parsed.data] : []
  })
}

/**
 * The target's memberships, and everyone else's in the workspaces the target owns.
 *
 * Two reads, the second only when the target owns something. Ordered by nothing: the answer is a
 * count, and a complete page has no order to preserve.
 */
export async function readWorkspaceOwnership(
  source: AuthReadAdapterSource,
  userId: string,
  limit: number = OWNERSHIP_READ_LIMIT,
): Promise<OwnershipRead> {
  const adapter = await source()

  const own = readOwnershipPage(
    await adapter.findMany<unknown>({
      model: 'member',
      where: [{ field: 'userId', value: userId }],
      select: ['organizationId', 'role'],
      limit,
    }),
    limit,
  )
  if (own === null) return { complete: false }

  const owned = own
    .filter((row) => isOwnerRole(row.role))
    .map((row) => row.organizationId)
  if (owned.length === 0) return { complete: true, own, others: [] }

  const others = readOwnershipPage(
    await adapter.findMany<unknown>({
      model: 'member',
      where: [
        { field: 'organizationId', operator: 'in', value: owned },
        { field: 'userId', operator: 'ne', value: userId },
      ],
      select: ['organizationId', 'role'],
      limit,
    }),
    limit,
  )
  return others === null ? { complete: false } : { complete: true, own, others }
}

/**
 * The named workspaces behind a set of ids, in one read rather than one per membership.
 *
 * An id with no row left is dropped rather than returned half-formed: the membership read and this
 * one are not in a transaction, so a workspace deleted between them is an ordinary race.
 */
export async function readOrganizations(
  source: AuthReadAdapterSource,
  organizationIds: ReadonlyArray<string>,
): Promise<ReadonlyArray<OrganizationRow>> {
  if (organizationIds.length === 0) return []
  const adapter = await source()
  const rows = await adapter.findMany<unknown>({
    model: 'organization',
    where: [{ field: 'id', operator: 'in', value: [...organizationIds] }],
    limit: organizationIds.length,
  })
  return rows.flatMap((row) => {
    const parsed = organizationRowSchema.safeParse(row)
    return parsed.success ? [parsed.data] : []
  })
}

/**
 * The display names behind a set of account ids, keyed by id.
 *
 * One read for a whole ledger page rather than a join per row: an operator who took five actions is
 * looked up once. An id with no `user` row left is simply absent from the map — the ledger outlives
 * the accounts it names by design, `actor_user_id` carries no foreign key, and the caller says so in
 * words rather than printing a stale name.
 */
export async function readAccountNames(
  source: AuthReadAdapterSource,
  userIds: ReadonlyArray<string>,
): Promise<ReadonlyMap<string, string | null>> {
  if (userIds.length === 0) return new Map()
  const adapter = await source()
  const rows = await adapter.findMany<unknown>({
    model: 'user',
    where: [{ field: 'id', operator: 'in', value: [...userIds] }],
    limit: userIds.length,
  })
  const names = new Map<string, string | null>()
  for (const row of rows) {
    const parsed = namedUserRowSchema.safeParse(row)
    if (parsed.success) {
      names.set(parsed.data.id, parsed.data.name ?? null)
    }
  }
  return names
}
