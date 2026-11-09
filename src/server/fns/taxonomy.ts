import { createServerFn } from '@tanstack/react-start'
import { appScope } from './context'
import {
  createCategorySchema,
  createTaxonomyCategory,
  deleteCategorySchema,
  deleteTaxonomyCategory,
  loadTaxonomy,
  loadTaxonomySchema,
  moveCategorySchema,
  moveTaxonomyCategory,
  updateCategorySchema,
  updateTaxonomyCategory,
} from './taxonomy-lib/handlers'

export const loadTaxonomyFn = createServerFn({ method: 'GET' })
  .validator(loadTaxonomySchema)
  .handler(async ({ data }) => loadTaxonomy(await appScope(), data))

export const createCategoryFn = createServerFn({ method: 'POST' })
  .validator(createCategorySchema)
  .handler(async ({ data }) => createTaxonomyCategory(await appScope(), data))

export const updateCategoryFn = createServerFn({ method: 'POST' })
  .validator(updateCategorySchema)
  .handler(async ({ data }) => updateTaxonomyCategory(await appScope(), data))

export const moveCategoryFn = createServerFn({ method: 'POST' })
  .validator(moveCategorySchema)
  .handler(async ({ data }) => moveTaxonomyCategory(await appScope(), data))

export const deleteCategoryFn = createServerFn({ method: 'POST' })
  .validator(deleteCategorySchema)
  .handler(async ({ data }) => deleteTaxonomyCategory(await appScope(), data))
