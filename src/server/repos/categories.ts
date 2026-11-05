/**
 * Place categories — the tenant-owned taxonomy behind map pin colours and itinerary icons.
 *
 * Categories are per tenant rather than global so a workspace can rename or recolour them, which is
 * why the development seeder uses {@link ensureDefaultCategories} rather than a global list.
 */

import { and, asc, count, eq, ne, sql } from 'drizzle-orm'
import { z } from 'zod'
import { categories, places, newId } from '#/server/db/schema'
import { createTenantRepository, prepareTenantInsert, tenantFilter } from './base'
import {
  taxonomyCapacity,
  taxonomyLimit,
  refuseTaxonomyQuota,
} from './taxonomy-quota'
import { isUniqueConstraintViolation, RepositoryError } from './context'
import {
  colourSchema,
  definedOnly,
  shortTextSchema,
  slugSchema,
  slugify,
  sortOrderSchema,
  titleSchema,
} from './validation'
import type { Category } from '#/server/db/types'
import type { TenantScope } from './base'

export const categoriesRepository = createTenantRepository(categories, 'category')

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

export const createCategoryInput = z.object({
  name: titleSchema,
  slug: slugSchema.optional(),
  colour: colourSchema.optional(),
  icon: shortTextSchema.min(1).optional(),
  sortOrder: sortOrderSchema.optional(),
})
export type CreateCategoryInput = z.infer<typeof createCategoryInput>

export const updateCategoryInput = z.object({
  name: titleSchema.optional(),
  colour: colourSchema.optional(),
  icon: shortTextSchema.min(1).optional(),
  sortOrder: sortOrderSchema.optional(),
})
export type UpdateCategoryInput = z.infer<typeof updateCategoryInput>

/* -------------------------------------------------------------------------------------------------
 * Queries
 * ---------------------------------------------------------------------------------------------- */

export async function listCategories(scope: TenantScope): Promise<Array<Category>> {
  return categoriesRepository.findMany(scope, {
    orderBy: [asc(categories.sortOrder), asc(categories.name)],
  })
}

export async function getCategory(
  scope: TenantScope,
  categoryId: string,
): Promise<Category | null> {
  return categoriesRepository.findById(scope, categoryId)
}

export async function getCategoryBySlug(
  scope: TenantScope,
  slug: string,
): Promise<Category | null> {
  return categoriesRepository.findOne(scope, eq(categories.slug, slug))
}

export interface CategoryUsage extends Category {
  /** How many places across the tenant currently sit in this category. */
  readonly placeCount: number
}

/** Categories with their place counts — the legend on the trip map and the taxonomy settings list. */
export async function listCategoriesWithUsage(
  scope: TenantScope,
): Promise<Array<CategoryUsage>> {
  const [rows, usage] = await Promise.all([
    listCategories(scope),
    scope.db
      .select({ categoryId: places.categoryId, value: count() })
      .from(places)
      .where(tenantFilter(scope, places))
      .groupBy(places.categoryId),
  ])
  const counts = new Map(usage.map((row) => [row.categoryId, row.value]))
  return rows.map((row) => ({ ...row, placeCount: counts.get(row.id) ?? 0 }))
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

async function reserveSlug(
  scope: TenantScope,
  desired: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(desired, 'category')
  for (let attempt = 1; attempt <= 25; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base.slice(0, 74)}-${attempt}`
    const clashes = await categoriesRepository.count(
      scope,
      and(eq(categories.slug, candidate), excludeId ? ne(categories.id, excludeId) : undefined),
    )
    if (clashes === 0) {
      return candidate
    }
  }
  return `${base.slice(0, 68)}-${Date.now().toString(36)}`
}

export async function createCategory(
  scope: TenantScope,
  input: CreateCategoryInput,
): Promise<Category> {
  const values = createCategoryInput.parse(input)
  const limit = await taxonomyLimit(scope)
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = await reserveSlug(scope, values.slug ?? values.name)
    try {
      const [row] = await prepareTenantInsert(
        scope,
        categories,
        { ...values, slug },
        taxonomyCapacity(scope, limit),
      ).returning()
      if (!row) return refuseTaxonomyQuota(scope, limit)
      return row
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error
    }
  }
  throw new RepositoryError(
    'Category slug conflicts exhausted retries.',
    'CONFLICT',
  )
}

export async function updateCategory(
  scope: TenantScope,
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<Category> {
  return categoriesRepository.requireUpdate(
    scope,
    categoryId,
    definedOnly(updateCategoryInput.parse(input)),
  )
}

/** Deleting a category leaves its places behind: the FK is `ON DELETE SET NULL`. */
export async function deleteCategory(scope: TenantScope, categoryId: string): Promise<void> {
  await categoriesRepository.requireRemove(scope, categoryId)
}

/**
 * The starter taxonomy a new workspace gets. `isSystem` records provenance only.
 */
const DEFAULT_CATEGORIES: ReadonlyArray<{
  readonly name: string
  readonly slug: string
  readonly icon: string
  readonly colour: string
  readonly sortOrder: number
}> = [
  { name: 'Landmarks', slug: 'landmarks', icon: 'landmark', colour: '#2F6F5E', sortOrder: 1 },
  { name: 'Food & drink', slug: 'food-and-drink', icon: 'utensils', colour: '#B26B08', sortOrder: 2 },
  { name: 'Stays', slug: 'stays', icon: 'bed-double', colour: '#2563EB', sortOrder: 3 },
  { name: 'Outdoors', slug: 'outdoors', icon: 'trees', colour: '#16794C', sortOrder: 4 },
  { name: 'Museums', slug: 'museums', icon: 'building-2', colour: '#7C3AED', sortOrder: 5 },
  { name: 'Nightlife', slug: 'nightlife', icon: 'moon-star', colour: '#C0392B', sortOrder: 6 },
  { name: 'Shopping', slug: 'shopping', icon: 'shopping-bag', colour: '#B5179E', sortOrder: 7 },
  { name: 'Transport', slug: 'transport', icon: 'train-front', colour: '#0E7490', sortOrder: 8 },
]

/**
 * Development seeder refill, quota-guarded as one missing set. Normal reads never call it.
 * The durable once-only initializer and its bounded bootstrap exception belong to #1843.
 */
export async function ensureDefaultCategories(
  scope: TenantScope,
): Promise<Array<Category>> {
  const existing = await listCategories(scope)
  if (
    DEFAULT_CATEGORIES.every((candidate) =>
      existing.some((row) => row.slug === candidate.slug),
    )
  )
    return existing
  const limit = await taxonomyLimit(scope)
  const candidates = JSON.stringify(
    DEFAULT_CATEGORIES.map((row) => ({
      ...row,
      id: newId(),
      createdAt: Number(categories.createdAt.defaultFn?.()),
      updatedAt: Number(categories.updatedAt.defaultFn?.()),
    })),
  )
  await scope.db.insert(categories).select(sql`
    with missing as materialized (
      select json_extract(value, '$.id') as id, json_extract(value, '$.name') as name,
        json_extract(value, '$.slug') as slug, json_extract(value, '$.colour') as colour,
        json_extract(value, '$.icon') as icon, json_extract(value, '$.sortOrder') as sort_order,
        json_extract(value, '$.createdAt') as created_at, json_extract(value, '$.updatedAt') as updated_at
      from json_each(${candidates})
      where not exists (select 1 from ${categories} where ${tenantFilter(scope, categories)}
        and ${categories.slug} = json_extract(value, '$.slug'))
    )
    select id, ${scope.ctx.organizationId}, name, slug, colour, icon, 1, sort_order, created_at, updated_at
    from missing where ${taxonomyCapacity(scope, limit, sql`(select count(*) from missing)`)}
  `)
  const rows = await listCategories(scope)
  if (
    DEFAULT_CATEGORIES.some(
      (candidate) => !rows.some((row) => row.slug === candidate.slug),
    )
  ) {
    return refuseTaxonomyQuota(scope, limit)
  }
  return rows
}
