/**
 * Tenant-scoped query primitives.
 *
 * This module exists so that **forgetting the tenant filter is not expressible**. Repositories
 * never call `scope.db.select()` directly on a tenant table; they go through
 * {@link createTenantRepository} / {@link createTenantTableAccess}, whose every read and write path
 * begins with `WHERE organization_id = ?` taken from the {@link TenantScope}, and through
 * {@link tenantFilter} for the handful of bespoke joins. Callers can pass extra predicates but they
 * cannot replace or remove the tenant predicate.
 *
 * The narrow `as` casts below are the price of writing one generic implementation over Drizzle's
 * per-table generics. They are all *widening a concrete row shape into the same shape expressed
 * through a generic*, they are confined to this file, and each one is annotated.
 */

import { and, asc, count, desc, eq, inArray, lt, sum } from 'drizzle-orm'
import { subscriptions } from '#/server/db/schema'
import { UNLIMITED } from '#/server/db/types'
import { resolveLimitsFromRow } from '#/server/billing/limits'
import {
  NotFoundError,
  QuotaExceededError,
  RepositoryError,
  requireTenantContext,
} from './context'
import type { SQL } from 'drizzle-orm'
import type {
  SQLiteColumn,
  SQLiteInsertValue,
  SQLiteTable,
  SQLiteUpdateSetSource,
} from 'drizzle-orm/sqlite-core'
import type { PlanId } from '#/lib/plans'
import type { Database, OrganizationPlan, UsageMetric } from '#/server/db/types'
import type { TenantContext } from './context'

/* -------------------------------------------------------------------------------------------------
 * Scope
 * ---------------------------------------------------------------------------------------------- */

/** A validated tenant context paired with the database handle it may act on. */
export interface TenantScope {
  readonly db: Database
  readonly ctx: TenantContext
}

/**
 * The only constructor for a {@link TenantScope}. The context is validated by
 * {@link requireTenantContext}, so a scope always carries a real organization id.
 */
export function createScope(db: Database, context: unknown): TenantScope {
  return Object.freeze({ db, ctx: requireTenantContext(context) })
}

/* -------------------------------------------------------------------------------------------------
 * Table shapes
 * ---------------------------------------------------------------------------------------------- */

/** Any table carrying the tenant discriminator. */
export type TenantTable = SQLiteTable & { readonly organizationId: SQLiteColumn }

/** A tenant table with a single-column text primary key, i.e. everything but the join tables. */
export type KeyedTenantTable = TenantTable & { readonly id: SQLiteColumn }

/** Column or expression usable in `ORDER BY`. */
export type OrderTerm = SQL | SQLiteColumn

export interface ListOptions {
  /** Extra predicate, ANDed with — never instead of — the tenant filter. */
  readonly where?: SQL
  readonly orderBy?: ReadonlyArray<OrderTerm>
  readonly limit?: number
  readonly offset?: number
}

export interface CursorPage<TRow> {
  readonly items: ReadonlyArray<TRow>
  /** Pass back as `cursor` to fetch the next page; `null` when the list is exhausted. */
  readonly nextCursor: string | null
}

/**
 * Builds the predicate for a tenant table: always `organization_id = <scope>`, ANDed with any
 * caller-supplied predicates. There is no code path that produces a predicate without it.
 */
export function tenantFilter(
  scope: TenantScope,
  table: TenantTable,
  ...extra: ReadonlyArray<SQL | undefined>
): SQL {
  const scoped = eq(table.organizationId, scope.ctx.organizationId)
  const additional = extra.filter((part): part is SQL => part !== undefined)
  if (additional.length === 0) {
    return scoped
  }
  return and(scoped, ...additional) ?? scoped
}

/**
 * ANDs predicates that are all optional except the first. Drizzle's `and()` widens its result to
 * `SQL | undefined`, which repositories cannot pass to APIs that require a predicate; this keeps the
 * narrowing in one place instead of sprinkling fallbacks through the query code.
 */
export function allOf(first: SQL, ...rest: ReadonlyArray<SQL | undefined>): SQL {
  return and(first, ...rest) ?? first
}

/* -------------------------------------------------------------------------------------------------
 * Generic access for tables without a single-column primary key (the join tables)
 * ---------------------------------------------------------------------------------------------- */

export interface TenantTableAccess<TTable extends TenantTable> {
  readonly table: TTable
  readonly entityName: string
  findMany: (scope: TenantScope, options?: ListOptions) => Promise<Array<TTable['$inferSelect']>>
  findOne: (scope: TenantScope, where: SQL) => Promise<TTable['$inferSelect'] | null>
  count: (scope: TenantScope, where?: SQL) => Promise<number>
  sumOf: (scope: TenantScope, column: SQLiteColumn, where?: SQL) => Promise<number>
  insert: (
    scope: TenantScope,
    values: Omit<TTable['$inferInsert'], 'organizationId'>,
  ) => Promise<TTable['$inferSelect']>
  insertMany: (
    scope: TenantScope,
    values: ReadonlyArray<Omit<TTable['$inferInsert'], 'organizationId'>>,
  ) => Promise<Array<TTable['$inferSelect']>>
  updateWhere: (
    scope: TenantScope,
    where: SQL,
    patch: TenantPatch<TTable>,
  ) => Promise<Array<TTable['$inferSelect']>>
  removeWhere: (scope: TenantScope, where: SQL) => Promise<number>
}

/** A partial update: never the tenant column, never the primary key, never `created_at`. */
export type TenantPatch<TTable extends TenantTable> = Partial<
  Omit<TTable['$inferInsert'], 'organizationId' | 'id' | 'createdAt'>
>

export function createTenantTableAccess<TTable extends TenantTable>(
  table: TTable,
  entityName: string,
): TenantTableAccess<TTable> {
  type Row = TTable['$inferSelect']

  async function findMany(scope: TenantScope, options: ListOptions = {}): Promise<Array<Row>> {
    const query = scope.db
      .select()
      .from(table)
      .where(tenantFilter(scope, table, options.where))
      .$dynamic()

    if (options.orderBy && options.orderBy.length > 0) {
      query.orderBy(...options.orderBy)
    }
    if (options.limit !== undefined) {
      query.limit(options.limit)
    }
    if (options.offset !== undefined) {
      query.offset(options.offset)
    }

    // `select()` with no field list selects every column of `table`, so the rows are `Row`.
    return (await query)
  }

  async function findOne(scope: TenantScope, where: SQL): Promise<Row | null> {
    const rows = await findMany(scope, { where, limit: 1 })
    return rows[0] ?? null
  }

  async function countRows(scope: TenantScope, where?: SQL): Promise<number> {
    const rows = await scope.db
      .select({ value: count() })
      .from(table)
      .where(tenantFilter(scope, table, where))
    return rows[0]?.value ?? 0
  }

  async function sumOf(scope: TenantScope, column: SQLiteColumn, where?: SQL): Promise<number> {
    const rows = await scope.db
      .select({ value: sum(column) })
      .from(table)
      .where(tenantFilter(scope, table, where))
    const value = rows.at(0)?.value
    return value === undefined || value === null ? 0 : Number(value)
  }

  async function insertMany(
    scope: TenantScope,
    values: ReadonlyArray<Omit<TTable['$inferInsert'], 'organizationId'>>,
  ): Promise<Array<Row>> {
    if (values.length === 0) {
      return []
    }
    // The tenant column is stamped here and cannot be overridden by the caller's payload.
    const records = values.map(
      (value) =>
        ({ ...value, organizationId: scope.ctx.organizationId }) as SQLiteInsertValue<TTable>,
    )
    const rows = await scope.db.insert(table).values(records).returning()
    return rows
  }

  async function insert(
    scope: TenantScope,
    values: Omit<TTable['$inferInsert'], 'organizationId'>,
  ): Promise<Row> {
    const rows = await insertMany(scope, [values])
    const row = rows.at(0)
    if (row === undefined) {
      throw new RepositoryError(`Insert into ${entityName} returned no row.`, 'INSERT_FAILED')
    }
    return row
  }

  async function updateWhere(
    scope: TenantScope,
    where: SQL,
    patch: TenantPatch<TTable>,
  ): Promise<Array<Row>> {
    if (Object.keys(patch).length === 0) {
      return findMany(scope, { where })
    }
    const rows = await scope.db
      .update(table)
      .set(patch as SQLiteUpdateSetSource<TTable>)
      .where(tenantFilter(scope, table, where))
      .returning()
    return rows
  }

  async function removeWhere(scope: TenantScope, where: SQL): Promise<number> {
    const rows = await scope.db
      .delete(table)
      .where(tenantFilter(scope, table, where))
      .returning({ deleted: table.organizationId })
    return rows.length
  }

  return {
    table,
    entityName,
    findMany,
    findOne,
    count: countRows,
    sumOf,
    insert,
    insertMany,
    updateWhere,
    removeWhere,
  }
}

/* -------------------------------------------------------------------------------------------------
 * Generic access for tables keyed by a single `id` column
 * ---------------------------------------------------------------------------------------------- */

export interface TenantRepository<TTable extends KeyedTenantTable>
  extends TenantTableAccess<TTable> {
  findById: (scope: TenantScope, id: string) => Promise<TTable['$inferSelect'] | null>
  requireById: (scope: TenantScope, id: string) => Promise<TTable['$inferSelect']>
  findByIds: (scope: TenantScope, ids: ReadonlyArray<string>) => Promise<Array<TTable['$inferSelect']>>
  exists: (scope: TenantScope, id: string) => Promise<boolean>
  update: (
    scope: TenantScope,
    id: string,
    patch: TenantPatch<TTable>,
  ) => Promise<TTable['$inferSelect'] | null>
  requireUpdate: (
    scope: TenantScope,
    id: string,
    patch: TenantPatch<TTable>,
  ) => Promise<TTable['$inferSelect']>
  remove: (scope: TenantScope, id: string) => Promise<boolean>
  requireRemove: (scope: TenantScope, id: string) => Promise<void>
  /** Keyset pagination on the time-sortable primary key, newest first. */
  page: (
    scope: TenantScope,
    options?: { readonly where?: SQL; readonly limit?: number; readonly cursor?: string | null },
  ) => Promise<CursorPage<TTable['$inferSelect']>>
}

const DEFAULT_PAGE_SIZE = 25
const MAX_PAGE_SIZE = 100

export function createTenantRepository<TTable extends KeyedTenantTable>(
  table: TTable,
  entityName: string,
): TenantRepository<TTable> {
  type Row = TTable['$inferSelect']
  const access = createTenantTableAccess(table, entityName)

  async function findById(scope: TenantScope, id: string): Promise<Row | null> {
    return access.findOne(scope, eq(table.id, id))
  }

  async function requireById(scope: TenantScope, id: string): Promise<Row> {
    const row = await findById(scope, id)
    if (!row) {
      throw new NotFoundError(entityName, id)
    }
    return row
  }

  async function update(
    scope: TenantScope,
    id: string,
    patch: TenantPatch<TTable>,
  ): Promise<Row | null> {
    const rows = await access.updateWhere(scope, eq(table.id, id), patch)
    return rows[0] ?? null
  }

  async function page(
    scope: TenantScope,
    options: { readonly where?: SQL; readonly limit?: number; readonly cursor?: string | null } = {},
  ): Promise<CursorPage<Row>> {
    const limit = Math.min(Math.max(options.limit ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)
    const cursorFilter = options.cursor ? lt(table.id, options.cursor) : undefined
    const where = and(options.where, cursorFilter)
    const items = await access.findMany(scope, {
      where,
      orderBy: [desc(table.id)],
      limit: limit + 1,
    })
    const hasMore = items.length > limit
    const pageItems = hasMore ? items.slice(0, limit) : items
    const last = pageItems.at(-1)
    // Every keyed tenant table has a text `id`; reading it off the generic row needs a widening.
    const lastId = last === undefined ? undefined : (last as Record<string, unknown>).id
    return {
      items: pageItems,
      nextCursor: hasMore && typeof lastId === 'string' ? lastId : null,
    }
  }

  return {
    ...access,
    findById,
    requireById,
    async findByIds(scope, ids) {
      if (ids.length === 0) {
        return []
      }
      return access.findMany(scope, { where: inArray(table.id, [...ids]) })
    },
    async exists(scope, id) {
      return (await access.count(scope, eq(table.id, id))) > 0
    },
    update,
    async requireUpdate(scope, id, patch) {
      const row = await update(scope, id, patch)
      if (!row) {
        throw new NotFoundError(entityName, id)
      }
      return row
    },
    async remove(scope, id) {
      return (await access.removeWhere(scope, eq(table.id, id))) > 0
    },
    async requireRemove(scope, id) {
      if (!(await access.removeWhere(scope, eq(table.id, id)))) {
        throw new NotFoundError(entityName, id)
      }
    },
    page,
  }
}

/* -------------------------------------------------------------------------------------------------
 * Small shared query helpers
 * ---------------------------------------------------------------------------------------------- */

/**
 * `IN (...)` over a readonly list. Drizzle renders an empty list as `false`, so an empty filter
 * returns no rows rather than producing invalid SQL.
 */
export function inIds(column: SQLiteColumn, values: ReadonlyArray<string>): SQL {
  return inArray(column, [...values])
}

/** Ordering helpers re-exported so repositories need only import from this module. */
export { asc, desc }

/* -------------------------------------------------------------------------------------------------
 * Plan quotas — enforced at the repository boundary (docs/SPEC.md §5)
 * ---------------------------------------------------------------------------------------------- */

export interface ResolvedQuotas {
  /** The coarse tier the operational ceilings came from — the `subscriptions.plan` column. */
  readonly plan: OrganizationPlan
  /** The catalogue plan in force, which is what a customer is told they are on. */
  readonly planId: PlanId
  /** Ceilings in the unit of each metric; {@link UNLIMITED} where there is no cap. */
  readonly limits: Record<UsageMetric, number>
}

/**
 * The tenant's quota ceilings.
 *
 * A thin adapter, deliberately: it reads the subscription row and hands it to
 * {@link resolveLimitsFromRow}, the one resolver the billing domain also goes through, then returns
 * the column-shaped half of its answer. There is no arithmetic here to drift out of step with the
 * billing screen — see `src/server/billing/limits.ts` for the authority order.
 */
export async function resolveQuotas(scope: TenantScope): Promise<ResolvedQuotas> {
  const rows = await scope.db
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      seats: subscriptions.seats,
      providerProductId: subscriptions.providerProductId,
      quotaOverrides: subscriptions.quotaOverrides,
      seatLimit: subscriptions.seatLimit,
      storageLimitBytes: subscriptions.storageLimitBytes,
    })
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, scope.ctx.organizationId))
    .limit(1)

  const resolved = resolveLimitsFromRow(rows.at(0) ?? null)
  return { plan: resolved.tier, planId: resolved.planId, limits: resolved.metrics }
}

/**
 * Throws {@link QuotaExceededError} when adding `additional` rows would exceed the tenant's ceiling
 * for `metric`. Call this before any write that grows a metered resource.
 */
export async function assertQuota(
  scope: TenantScope,
  metric: UsageMetric,
  currentUsage: number,
  additional = 1,
): Promise<void> {
  const { limits } = await resolveQuotas(scope)
  const limit = limits[metric]
  if (limit === UNLIMITED) {
    return
  }
  if (currentUsage + additional > limit) {
    throw new QuotaExceededError(metric, limit, currentUsage)
  }
}
