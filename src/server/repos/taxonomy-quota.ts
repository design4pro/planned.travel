/** Live categories and tags share one tenant-scoped operational ceiling; no usage counter. */
import { sql } from 'drizzle-orm'
import { categories, tags } from '#/server/db/schema'
import { UNLIMITED } from '#/server/db/types'
import { resolveQuotas, tenantFilter } from './base'
import { QuotaExceededError } from './context'
import type { SQL } from 'drizzle-orm'
import type { TenantScope } from './base'

export function taxonomyUsage(scope: TenantScope): SQL<number> {
  return sql<number>`((select count(*) from ${categories} where ${tenantFilter(scope, categories)}) + (select count(*) from ${tags} where ${tenantFilter(scope, tags)}))`
}

export async function taxonomyLimit(scope: TenantScope): Promise<number> {
  return (await resolveQuotas(scope)).limits.taxonomy
}

/** Embed this predicate in the INSERT, so competing writers cannot spend the same slot. */
export function taxonomyCapacity(
  scope: TenantScope,
  limit: number,
  additional: SQL | number = 1,
): SQL {
  return limit === UNLIMITED
    ? sql`1`
    : sql`${taxonomyUsage(scope)} + ${additional} <= ${limit}`
}

export async function refuseTaxonomyQuota(
  scope: TenantScope,
  limit: number,
): Promise<never> {
  const [row] = await scope.db
    .select({ used: taxonomyUsage(scope) })
    .from(sql`(select 1)`)
  throw new QuotaExceededError('taxonomy', limit, row?.used ?? 0)
}

/** The live shared meter, read through the same tenant predicate as growing writes. */
export async function readTaxonomyMeter(scope: TenantScope): Promise<{ used: number; limit: number }> {
  const [rows, limit] = await Promise.all([
    scope.db.select({ used: taxonomyUsage(scope) }).from(sql`(select 1)`),
    taxonomyLimit(scope),
  ])
  return { used: rows[0]?.used ?? 0, limit }
}
