/**
 * The participation anchor (`workspace_participants`, ADR 0043): "this person took part in this
 * workspace", kept when they leave so a later erasure still finds the workspace.
 *
 * Two writers live here. {@link recordParticipant} is the anchor write for membership inserts the
 * repositories own (`addMember`); the auth layer has its own write-only twin in
 * `src/server/auth/participation.ts` because it cannot import this layer. {@link backfillParticipants}
 * is the one-off catch-up for people who left before the anchor existed: it reads the distinct user
 * ids the erasure registry names in this one workspace, and records each.
 *
 * Nothing here reads the anchor back for a tenant-facing screen. The cross-tenant discovery read is
 * `src/server/catalog/erasure.ts`.
 */

import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core'
import { is } from 'drizzle-orm'
import * as authTables from '#/server/db/auth-schema'
import * as domainTables from '#/server/db/schema'
import { workspaceParticipants } from '#/server/db/schema'
import { ERASURE_REGISTRY } from '#/server/erasure/registry'
import { chunkFor, boundParametersPerRow, runBatch } from './batch'
import { tenantFilter } from './base'
import type { SQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { BatchStatement } from './batch'
import type { TenantScope, TenantTable } from './base'

/**
 * Records `userId` as a participant of the scope's workspace. `INSERT OR IGNORE`: repeating it, or
 * a person who rejoins, writes nothing. Returned as a statement so a caller can put it in the same
 * batch as the membership insert; awaiting it runs it alone.
 */
export function recordParticipant(scope: TenantScope, userId: string) {
  return scope.db
    .insert(workspaceParticipants)
    .values({ organizationId: scope.ctx.organizationId, userId })
    .onConflictDoNothing()
}

/** Every Drizzle table the erasure registry can name, by SQL table name. */
function tablesByName(): Map<string, SQLiteTable> {
  const byName = new Map<string, SQLiteTable>()
  for (const value of [
    ...Object.values(authTables),
    ...Object.values(domainTables),
  ]) {
    if (is(value, SQLiteTable)) {
      byName.set(getTableConfig(value).name, value)
    }
  }
  return byName
}

/**
 * The registered tenant columns that hold a user id, as `[table, column]`, plus `member.user_id`:
 * everything the backfill reads. A table without an `organization_id` column (a global table, the
 * auth rows) is another workspace's business by construction and is left out, as are the embedded
 * places (they are not columns of a user id) and the anchor itself.
 */
function participantSources(): Array<{
  table: TenantTable
  column: SQLiteColumn
}> {
  const tables = tablesByName()
  const sources: Array<{ table: TenantTable; column: SQLiteColumn }> = []
  for (const entry of ERASURE_REGISTRY) {
    if (
      entry.origin === 'embedded' ||
      entry.table === 'workspace_participants'
    ) {
      continue
    }
    const table = tables.get(entry.table)
    if (table === undefined) {
      continue
    }
    const columns = getTableConfig(table).columns
    const column = columns.find((candidate) => candidate.name === entry.column)
    const hasTenantColumn = columns.some(
      (candidate) => candidate.name === 'organization_id',
    )
    if (column !== undefined && hasTenantColumn) {
      sources.push({ table: table as TenantTable, column })
    }
  }
  return sources
}

/**
 * Records every person the registered tenant columns of this workspace name, and every current
 * member. Idempotent and re-runnable: a second run inserts nothing. Returns how many distinct
 * people the workspace names, for the handler's log line.
 */
export async function backfillParticipants(
  scope: TenantScope,
): Promise<number> {
  const userIds = new Set<string>()
  for (const { table, column } of participantSources()) {
    const rows = await scope.db
      .selectDistinct({ userId: column })
      .from(table)
      .where(tenantFilter(scope, table))
    for (const row of rows) {
      if (typeof row.userId === 'string' && row.userId !== '') {
        userIds.add(row.userId)
      }
    }
  }

  const size = chunkFor(boundParametersPerRow(workspaceParticipants))
  const ids = [...userIds]
  const statements: Array<BatchStatement> = []
  for (let index = 0; index < ids.length; index += size) {
    statements.push(
      scope.db
        .insert(workspaceParticipants)
        .values(
          ids.slice(index, index + size).map((userId) => ({
            organizationId: scope.ctx.organizationId,
            userId,
          })),
        )
        .onConflictDoNothing(),
    )
  }
  await runBatch(scope, statements)
  return ids.length
}
