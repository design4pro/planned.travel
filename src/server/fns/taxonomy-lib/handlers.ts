/** Binding-free category operations; the request boundary supplies a fresh session scope. */
import { z } from 'zod'
import { AUDIT_ACTIONS, trail } from '#/server/audit/trail'
import { assertCanAdminister } from '#/server/repos/context'
import {
  createCategory,
  deleteCategory,
  ensureDefaultCategories,
  listCategoriesWithUsage,
  moveCategory,
  updateCategory,
} from '#/server/repos/categories'
import { readTaxonomyMeter } from '#/server/repos/taxonomy-quota'
import { colourSchema, idSchema, titleSchema } from '#/server/repos/validation'
import type { TenantScope } from '#/server/repos/base'

export const loadTaxonomySchema = z.strictObject({})
export const createCategorySchema = z.strictObject({
  name: titleSchema,
  colour: colourSchema.optional(),
})
export const updateCategorySchema = z.strictObject({
  categoryId: idSchema,
  name: titleSchema.optional(),
  colour: colourSchema.optional(),
})
export const moveCategorySchema = z.strictObject({
  categoryId: idSchema,
  direction: z.enum(['up', 'down']),
})
export const deleteCategorySchema = z.strictObject({ categoryId: idSchema })

export async function loadTaxonomy(scope: TenantScope, input: unknown) {
  loadTaxonomySchema.parse(input)
  await ensureDefaultCategories(scope)
  const [categories, meter] = await Promise.all([
    listCategoriesWithUsage(scope),
    readTaxonomyMeter(scope),
  ])
  return { categories, meter }
}

export async function createTaxonomyCategory(
  scope: TenantScope,
  input: unknown,
) {
  const data = createCategorySchema.parse(input)
  assertCanAdminister(scope.ctx, 'create categories')
  await ensureDefaultCategories(scope)
  const row = await createCategory(scope, data)
  await trail(scope, {
    action: AUDIT_ACTIONS.CATEGORY_CREATED,
    entityType: 'category',
    entityId: row.id,
  })
  return row
}

export async function updateTaxonomyCategory(
  scope: TenantScope,
  input: unknown,
) {
  const { categoryId, ...data } = updateCategorySchema.parse(input)
  assertCanAdminister(scope.ctx, 'update categories')
  await ensureDefaultCategories(scope)
  const row = await updateCategory(scope, categoryId, data)
  await trail(scope, {
    action: AUDIT_ACTIONS.CATEGORY_UPDATED,
    entityType: 'category',
    entityId: row.id,
  })
  return row
}

export async function moveTaxonomyCategory(scope: TenantScope, input: unknown) {
  const { categoryId, direction } = moveCategorySchema.parse(input)
  assertCanAdminister(scope.ctx, 'move categories')
  await ensureDefaultCategories(scope)
  await moveCategory(scope, categoryId, direction)
  await trail(scope, {
    action: AUDIT_ACTIONS.CATEGORY_MOVED,
    entityType: 'category',
    entityId: categoryId,
  })
}

export async function deleteTaxonomyCategory(
  scope: TenantScope,
  input: unknown,
): Promise<void> {
  const { categoryId } = deleteCategorySchema.parse(input)
  assertCanAdminister(scope.ctx, 'delete categories')
  await ensureDefaultCategories(scope)
  await deleteCategory(scope, categoryId)
  await trail(scope, {
    action: AUDIT_ACTIONS.CATEGORY_DELETED,
    entityType: 'category',
    entityId: categoryId,
  })
}
