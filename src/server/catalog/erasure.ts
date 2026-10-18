/**
 * Which workspaces an erasure has to visit, read across every tenant, ids only.
 *
 * Erasing a person (`.ai/specs/2026-10-08-erase-a-persons-data.md`, ADR 0043) is a job with no
 * workspace behind it: the question "in which workspaces did this person take part" has no tenant
 * context to scope it with, and the person may already have left the workspaces that matter, so
 * `member` cannot answer it. `workspace_participants` (the participation anchor) can, because
 * departure never removes a row from it.
 *
 * ## Why this module is in `src/server/catalog/**`
 *
 * It is the third member of the closed exception in `docs/SPEC.md` §5, beside `audit.ts` and
 * `reminders.ts`: a plain {@link Database}, no `TenantScope`, no reach into `src/server/repos/**`
 * (walked by `catalog/__tests__/isolation.test.ts`). What keeps the boundary honest is the shape
 * of the answer, and it has four properties that tests pin:
 *
 * - **ids only.** A row is an organization id, and for {@link listWorkspacesHoldingUser} the
 *   erasure id the anchor carries. No content table is joined or selected.
 * - **keyset-paged** with a fixed maximum page size, never `OFFSET` and never unbounded.
 * - **session-less but not request-reachable.** Only `queue/handlers/participant-backfill*` imports
 *   this module in this change, and the importer list is pinned by a test. {@link
 *   listWorkspacesHoldingUser} takes a user id and has no production importer yet; the engine that
 *   will call it takes that id from a verified, server-written erasure job, never from a body.
 * - **read-only.** Nothing here writes; the anchor is written by `auth/participation.ts` and
 *   `repos/participants.ts`.
 *
 * The scrub itself, per workspace, runs afterwards through a `TenantScope` bound to one organization.
 */

import { and, asc, eq, gt } from 'drizzle-orm'
import { organization } from '#/server/db/auth-schema'
import { workspaceParticipants } from '#/server/db/schema'

import type { Database } from '#/server/db/types'

/** The most rows one page returns, whatever the caller asks for. */
export const ERASURE_CATALOG_MAX_PAGE_SIZE = 100

/** A workspace a person took part in, and the erasure (if any) already running for them there. */
export interface HeldWorkspace {
  readonly organizationId: string
  readonly erasureId: string | null
}

/** One page of a keyset-paged listing. `next` is the cursor for the page after, `null` at the end. */
export interface CatalogPage<TItem> {
  readonly items: ReadonlyArray<TItem>
  readonly next: string | null
}

export interface PageOptions {
  /** Exclusive keyset cursor: the last organization id of the previous page. */
  readonly after?: string | null
  /** Clamped to {@link ERASURE_CATALOG_MAX_PAGE_SIZE}. */
  readonly limit?: number
}

function clampedLimit(limit: number | undefined): number {
  const requested = limit ?? ERASURE_CATALOG_MAX_PAGE_SIZE
  return Math.min(
    Math.max(Math.floor(requested), 1),
    ERASURE_CATALOG_MAX_PAGE_SIZE,
  )
}

/**
 * The workspaces whose participation anchor names `userId`, including those the person has left.
 * Ordered by organization id, so the cursor is the last id of the page.
 */
export async function listWorkspacesHoldingUser(
  db: Database,
  userId: string,
  options: PageOptions = {},
): Promise<CatalogPage<HeldWorkspace>> {
  const limit = clampedLimit(options.limit)
  const rows = await db
    .select({
      organizationId: workspaceParticipants.organizationId,
      erasureId: workspaceParticipants.erasureId,
    })
    .from(workspaceParticipants)
    .where(
      and(
        eq(workspaceParticipants.userId, userId),
        options.after
          ? gt(workspaceParticipants.organizationId, options.after)
          : undefined,
      ),
    )
    .orderBy(asc(workspaceParticipants.organizationId))
    .limit(limit + 1)

  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    next: rows.length > limit && last ? last.organizationId : null,
  }
}

/**
 * Every organization id, in id order, for the one-off participation backfill: a message handles the
 * next organization after its cursor and hands the cursor on.
 */
export async function listOrganizationIds(
  db: Database,
  options: PageOptions = {},
): Promise<CatalogPage<string>> {
  const limit = clampedLimit(options.limit)
  const rows = await db
    .select({ id: organization.id })
    .from(organization)
    .where(options.after ? gt(organization.id, options.after) : undefined)
    .orderBy(asc(organization.id))
    .limit(limit + 1)

  const items = rows.slice(0, limit).map((row) => row.id)
  const last = items.at(-1)
  return { items, next: rows.length > limit && last ? last : null }
}
