/**
 * Tags — free-form labels a tenant attaches to places.
 *
 * Tags are deduplicated by slug within the tenant, so {@link resolveTags} can turn the raw strings a
 * user typed into a stable id list, creating only the ones that do not exist yet.
 */

import { and, asc, count, eq, inArray, ne } from 'drizzle-orm'
import { z } from 'zod'
import { placeTags, tags } from '#/server/db/schema'
import { createTenantRepository, tenantFilter } from './base'
import { colourSchema, definedOnly, slugSchema, slugify, titleSchema } from './validation'
import type { Tag } from '#/server/db/types'
import type { TenantScope } from './base'

export const tagsRepository = createTenantRepository(tags, 'tag')

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

export const createTagInput = z.object({
  name: titleSchema,
  slug: slugSchema.optional(),
  colour: colourSchema.optional(),
})
export type CreateTagInput = z.infer<typeof createTagInput>

export const updateTagInput = z.object({
  name: titleSchema.optional(),
  colour: colourSchema.optional(),
})
export type UpdateTagInput = z.infer<typeof updateTagInput>

export const resolveTagsInput = z.array(titleSchema).max(50)
export type ResolveTagsInput = z.infer<typeof resolveTagsInput>

/* -------------------------------------------------------------------------------------------------
 * Queries
 * ---------------------------------------------------------------------------------------------- */

export async function listTags(scope: TenantScope): Promise<Array<Tag>> {
  return tagsRepository.findMany(scope, { orderBy: [asc(tags.name)] })
}

export async function getTag(scope: TenantScope, tagId: string): Promise<Tag | null> {
  return tagsRepository.findById(scope, tagId)
}

export interface TagUsage extends Tag {
  readonly placeCount: number
}

/** Tags ordered by how often they are used — the tag filter rail on the planner. */
export async function listTagsWithUsage(scope: TenantScope): Promise<Array<TagUsage>> {
  const [rows, usage] = await Promise.all([
    listTags(scope),
    scope.db
      .select({ tagId: placeTags.tagId, value: count() })
      .from(placeTags)
      .where(tenantFilter(scope, placeTags))
      .groupBy(placeTags.tagId),
  ])
  const counts = new Map(usage.map((row) => [row.tagId, row.value]))
  return rows
    .map((row) => ({ ...row, placeCount: counts.get(row.id) ?? 0 }))
    .sort((left, right) => right.placeCount - left.placeCount || left.name.localeCompare(right.name))
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

async function reserveSlug(
  scope: TenantScope,
  desired: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(desired, 'tag')
  for (let attempt = 1; attempt <= 25; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base.slice(0, 74)}-${attempt}`
    const clashes = await tagsRepository.count(
      scope,
      and(eq(tags.slug, candidate), excludeId ? ne(tags.id, excludeId) : undefined),
    )
    if (clashes === 0) {
      return candidate
    }
  }
  return `${base.slice(0, 68)}-${Date.now().toString(36)}`
}

export async function createTag(scope: TenantScope, input: CreateTagInput): Promise<Tag> {
  const values = createTagInput.parse(input)
  const slug = await reserveSlug(scope, values.slug ?? values.name)
  return tagsRepository.insert(scope, { ...values, slug })
}

export async function updateTag(
  scope: TenantScope,
  tagId: string,
  input: UpdateTagInput,
): Promise<Tag> {
  return tagsRepository.requireUpdate(scope, tagId, definedOnly(updateTagInput.parse(input)))
}

export async function deleteTag(scope: TenantScope, tagId: string): Promise<void> {
  await tagsRepository.requireRemove(scope, tagId)
}

/**
 * Maps typed tag names onto tag ids inside the tenant, creating the missing ones. Returns the ids in
 * the order the caller supplied, deduplicated by slug.
 */
export async function resolveTags(
  scope: TenantScope,
  names: ResolveTagsInput,
): Promise<Array<Tag>> {
  const wanted = resolveTagsInput.parse(names)
  const bySlug = new Map<string, string>()
  for (const name of wanted) {
    const slug = slugify(name, 'tag')
    if (!bySlug.has(slug)) {
      bySlug.set(slug, name)
    }
  }
  if (bySlug.size === 0) {
    return []
  }

  const existing = await tagsRepository.findMany(scope, {
    where: inArray(tags.slug, [...bySlug.keys()]),
  })
  const known = new Map(existing.map((row) => [row.slug, row]))
  const missing = [...bySlug.entries()].filter(([slug]) => !known.has(slug))

  if (missing.length > 0) {
    const created = await tagsRepository.insertMany(
      scope,
      missing.map(([slug, name]) => ({ name, slug })),
    )
    for (const row of created) {
      known.set(row.slug, row)
    }
  }

  return [...bySlug.keys()].flatMap((slug) => {
    const row = known.get(slug)
    return row ? [row] : []
  })
}
