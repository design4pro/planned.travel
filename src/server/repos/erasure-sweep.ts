/**
 * The reads behind the erasure's verification sweep, and the trip listing its room resets need
 * (`.ai/specs/2026-10-08-erase-a-persons-data.md` phase 5, ADR 0043).
 *
 * Everything here is a count or an id. Nothing returns a row of content, and no function writes.
 * The places counted are the erasure registry's (`src/server/erasure/registry.ts`), so a column the
 * schema gains is swept the moment the drift test makes the registry list it.
 *
 * ## Three kinds of place
 *
 * - **workspace**: a tenant column (`userRef()` columns, `audit_log.entity_id`,
 *   `notifications.entity_id`). {@link countWorkspacePlaces} counts them through the caller's
 *   `TenantScope`, so a sweep for workspace A cannot see workspace B.
 * - **account**: the Better Auth tables (`user`, `session`, `account`, `two_factor`, `passkey`,
 *   `verification`, `member`, `invitation`). They are not SPEC §5 platform tables, and several of
 *   them must be read across every workspace: an invitation addressed to the person's email can
 *   belong to a workspace the person never joined, which the participation anchor does not list.
 *   {@link countAccountPlacesUnscoped} is that read.
 * - **platform**: `staff_api_tokens` and `provider_registry`. SPEC §5 routes every access to them
 *   through `src/server/catalog`, so this module does not read them ({@link platformPlaceNames}
 *   only names them). The sweep reports them as unverified, which fails it, until the change that
 *   ships their scrubs also amends SPEC §5 for `catalog/erasure.ts` and supplies their counts.
 *   `platform_audit_log` is the registered `keep` and is skipped.
 *
 * ## SPEC §5 FU-3
 *
 * {@link countAccountPlacesUnscoped} takes a plain `Database`, carries the `Unscoped` suffix, has
 * one production caller (`src/server/erasure/verify.ts`, pinned in
 * `__tests__/unscoped-shape.test.ts`) and returns one number per registered place: no row, no
 * content, no id of another person. It is not a fourth catalog exception.
 *
 * ## Matching an id inside text
 *
 * `verification.identifier` and `.value` hold the id (or the email) inside a longer string. A user
 * id can contain `_`, which `LIKE` reads as a wildcard, so the match is `instr()`, never `LIKE`.
 */

import { count, eq, gt, sql } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/sqlite-core'
import { trips } from '#/server/db/schema'
import { ERASURE_REGISTRY } from '#/server/erasure/registry'
import { tenantFilter } from './base'
import { tablesByName } from './participants'
import { idSchema } from './validation'
import type { SQL } from 'drizzle-orm'
import type { SQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core'
import type { Database } from '#/server/db/types'
import type { ErasureEntry } from '#/server/erasure/registry'
import type { TenantScope, TenantTable } from './base'

/** How many occurrences one registered place holds. */
export interface PlaceCount {
  /** `table.column`, never a value. */
  readonly place: string
  readonly count: number
}

/** What the account-wide read could and could not count. */
export interface AccountPlaceCounts {
  readonly counts: ReadonlyArray<PlaceCount>
  /** Places this read cannot answer for (an email it was not given): a gap, never read as zero. */
  readonly unverified: ReadonlyArray<string>
}

/** Who the account-wide places are searched for. `email` is `null` when the caller no longer has it. */
export interface AccountIdentity {
  readonly userId: string
  readonly email: string | null
}

type PlaceKind = 'workspace' | 'account' | 'platform' | 'skipped'

const placeName = (entry: ErasureEntry): string =>
  `${entry.table}.${entry.column}`

function hasOrganizationColumn(table: SQLiteTable): boolean {
  return getTableConfig(table).columns.some(
    (column) => column.name === 'organization_id',
  )
}

/**
 * Which read answers for a registered place. The `keep` entries and the participation anchor
 * (`step: 'finish'`, removed after the sweep) are not swept. An `auth` place, and an embedded place
 * the catalog module owns, is an auth-table place; a `userRef` column on a table without an
 * `organization_id` is a platform table.
 */
function kindOf(entry: ErasureEntry, table: SQLiteTable): PlaceKind {
  if (entry.outcome === 'keep' || entry.step === 'finish') return 'skipped'
  if (entry.origin === 'auth') return 'account'
  if (
    entry.origin === 'embedded' &&
    !entry.owner.startsWith('src/server/repos/')
  )
    return 'account'
  if (!hasOrganizationColumn(table)) return 'platform'
  return 'workspace'
}

interface ResolvedPlace {
  readonly entry: ErasureEntry
  readonly kind: PlaceKind
  readonly table: SQLiteTable
  readonly column: SQLiteColumn
}

/**
 * The registry resolved against the schema. A place that resolves to nothing throws: the drift test
 * keeps the two in step, and a skipped place would be a place the sweep never looked at.
 */
function resolvedPlaces(): ReadonlyArray<ResolvedPlace> {
  const tables = tablesByName()
  return ERASURE_REGISTRY.map((entry) => {
    const table = tables.get(entry.table)
    const column = table
      ? getTableConfig(table).columns.find((c) => c.name === entry.column)
      : undefined
    if (table === undefined || column === undefined) {
      throw new Error(
        `The erasure registry names an unknown place ${placeName(entry)}`,
      )
    }
    return { entry, kind: kindOf(entry, table), table, column }
  })
}

/** The places of one kind, in registry order. */
function placesOfKind(kind: PlaceKind): ReadonlyArray<ResolvedPlace> {
  return resolvedPlaces().filter((place) => place.kind === kind)
}

/**
 * Counts, in the scope's workspace, every registered tenant place that still holds `userId`.
 * One entry per place, zero included, so a test can see that every place was looked at.
 */
export async function countWorkspacePlaces(
  scope: TenantScope,
  userId: string,
): Promise<Array<PlaceCount>> {
  const id = idSchema.parse(userId)
  const counts: Array<PlaceCount> = []
  for (const { entry, table, column } of placesOfKind('workspace')) {
    const [row] = await scope.db
      .select({ value: count() })
      .from(table)
      .where(tenantFilter(scope, table as TenantTable, eq(column, id)))
    counts.push({ place: placeName(entry), count: row?.value ?? 0 })
  }
  return counts
}

/**
 * The registered places this module does not read (the SPEC §5 platform tables), as `table.column`.
 * The sweep reports each as unverified unless its caller supplies a count read through
 * `src/server/catalog`.
 */
export function platformPlaceNames(): ReadonlyArray<string> {
  return placesOfKind('platform').map((place) => placeName(place.entry))
}

/** Where the identity may sit in a column, by place. Everything else is an exact match on the id. */
function accountPredicate(
  place: ResolvedPlace,
  who: AccountIdentity,
): SQL | 'needs-email' {
  const { column } = place
  const name = placeName(place.entry)
  const email = who.email?.trim().toLowerCase() ?? ''

  if (name === 'invitation.email') {
    return email === '' ? 'needs-email' : sql`lower(${column}) = ${email}`
  }
  if (name === 'verification.identifier') {
    // Keyed by the email (reset-password and OTP rows) or holding the id (passkey challenges).
    return email === ''
      ? 'needs-email'
      : sql`(instr(${column}, ${who.userId}) > 0 or instr(lower(${column}), ${email}) > 0)`
  }
  if (name === 'verification.value') {
    return sql`instr(${column}, ${who.userId}) > 0`
  }
  return eq(column, who.userId)
}

/**
 * Counts, across every workspace, the auth-table places that still hold the person, and names the
 * ones it cannot answer for.
 *
 * SPEC §5 FU-3 shape: see the file header. The single production caller is
 * `src/server/erasure/verify.ts`.
 */
export async function countAccountPlacesUnscoped(
  db: Database,
  who: AccountIdentity,
): Promise<AccountPlaceCounts> {
  const identity = { ...who, userId: idSchema.parse(who.userId) }
  const counts: Array<PlaceCount> = []
  const unverified: Array<string> = []

  for (const place of placesOfKind('account')) {
    const name = placeName(place.entry)
    const predicate = accountPredicate(place, identity)
    if (predicate === 'needs-email') {
      unverified.push(name)
      continue
    }
    const [row] = await db
      .select({ value: count() })
      .from(place.table)
      .where(predicate)
    counts.push({ place: name, count: row?.value ?? 0 })
  }

  return { counts, unverified }
}

/** The most trip ids one page returns. */
export const TRIP_ID_PAGE_SIZE = 500

export interface TripIdPage {
  readonly items: ReadonlyArray<string>
  /** Pass back as `after` for the next page; `null` at the end. */
  readonly next: string | null
}

/**
 * Every trip of the scope's workspace, in id order, for the room resets an erasure owes.
 *
 * Every trip and not only the ones with a column naming the person, because a trip room stamps `by`
 * on every change it commits: an edit that leaves no user column behind, a child table without a
 * `trip_id` and a trip the person has since left all leave their id in a room. Listing them all is
 * the one answer that cannot miss a room; the cost is one reset per trip (the spec's owner-confirms
 * item 6). A reset rebuilds the room from D1, so resetting a room that never held the id is
 * harmless.
 */
export async function listTripIdsForRoomReset(
  scope: TenantScope,
  options: { readonly after?: string | null; readonly limit?: number } = {},
): Promise<TripIdPage> {
  const limit = Math.min(
    Math.max(Math.floor(options.limit ?? TRIP_ID_PAGE_SIZE), 1),
    TRIP_ID_PAGE_SIZE,
  )
  const rows = await scope.db
    .select({ id: trips.id })
    .from(trips)
    .where(
      tenantFilter(
        scope,
        trips,
        options.after ? gt(trips.id, options.after) : undefined,
      ),
    )
    .orderBy(trips.id)
    .limit(limit + 1)

  const items = rows.slice(0, limit).map((row) => row.id)
  const last = items.at(-1)
  return { items, next: rows.length > limit && last ? last : null }
}
