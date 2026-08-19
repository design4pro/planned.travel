/**
 * Lists — packing, to-do, shopping and document checklists, plus the reusable templates they are
 * built from.
 *
 * A list belongs to a trip and optionally to one traveller (`ownerUserId`); a template belongs to the
 * tenant and is copied into a trip by {@link applyTemplateToTrip}, which writes the list and all of
 * its items in a single batch so a half-copied checklist can never be observed.
 */

import { and, asc, count, desc, eq, sum } from 'drizzle-orm'
import { z } from 'zod'
import {
  ITEM_PRIORITIES,
  LIST_KINDS,
  packingItems,
  packingLists,
  packingTemplateItems,
  packingTemplates,
} from '#/server/db/schema'
import { allOf, createTenantRepository, tenantFilter } from './base'
import { requireTrip } from './trips'
import {
  colourSchema,
  dateSchema,
  definedOnly,
  idSchema,
  longTextSchema,
  nonNegativeIntSchema,
  shortTextSchema,
  sortOrderSchema,
  titleSchema,
} from './validation'
import type {
  PackingItem,
  PackingList,
  PackingTemplate,
  PackingTemplateItem,
} from '#/server/db/types'
import type { TenantScope } from './base'

export const packingListsRepository = createTenantRepository(packingLists, 'list')
export const packingItemsRepository = createTenantRepository(packingItems, 'list item')
export const packingTemplatesRepository = createTenantRepository(packingTemplates, 'list template')
export const packingTemplateItemsRepository = createTenantRepository(
  packingTemplateItems,
  'list template item',
)

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const listKindSchema = z.enum(LIST_KINDS)
const prioritySchema = z.enum(ITEM_PRIORITIES)

export const createListInput = z.object({
  tripId: idSchema,
  name: titleSchema,
  kind: listKindSchema.optional(),
  colour: colourSchema.nullish(),
  icon: shortTextSchema.nullish(),
  ownerUserId: idSchema.nullish(),
  weightLimitGrams: nonNegativeIntSchema.nullish(),
  sortOrder: sortOrderSchema.optional(),
})
export type CreateListInput = z.infer<typeof createListInput>

export const updateListInput = z.object({
  name: titleSchema.optional(),
  kind: listKindSchema.optional(),
  colour: colourSchema.nullish(),
  icon: shortTextSchema.nullish(),
  ownerUserId: idSchema.nullish(),
  weightLimitGrams: nonNegativeIntSchema.nullish(),
  sortOrder: sortOrderSchema.optional(),
})
export type UpdateListInput = z.infer<typeof updateListInput>

const itemFields = {
  name: titleSchema,
  category: shortTextSchema.nullish(),
  description: longTextSchema.nullish(),
  quantity: nonNegativeIntSchema.max(10_000).optional(),
  weightGrams: nonNegativeIntSchema.nullish(),
  assignedTo: idSchema.nullish(),
  dueDate: dateSchema.nullish(),
  priority: prioritySchema.optional(),
  sortOrder: sortOrderSchema.optional(),
}

export const createListItemInput = z.object({ listId: idSchema, ...itemFields })
export type CreateListItemInput = z.infer<typeof createListItemInput>

export const updateListItemInput = z.object({ ...itemFields, name: titleSchema.optional() })
export type UpdateListItemInput = z.infer<typeof updateListItemInput>

export const createTemplateInput = z.object({
  name: titleSchema,
  description: longTextSchema.nullish(),
  kind: listKindSchema.optional(),
  icon: shortTextSchema.nullish(),
  isShared: z.boolean().optional(),
  items: z
    .array(
      z.object({
        name: titleSchema,
        category: shortTextSchema.nullish(),
        quantity: nonNegativeIntSchema.max(10_000).optional(),
        sortOrder: sortOrderSchema.optional(),
      }),
    )
    .max(500)
    .optional(),
})
export type CreateTemplateInput = z.infer<typeof createTemplateInput>

/* -------------------------------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------------------------------- */

export async function listTripLists(
  scope: TenantScope,
  tripId: string,
): Promise<Array<PackingList>> {
  return packingListsRepository.findMany(scope, {
    where: eq(packingLists.tripId, tripId),
    orderBy: [asc(packingLists.sortOrder), asc(packingLists.id)],
  })
}

export async function listItems(scope: TenantScope, listId: string): Promise<Array<PackingItem>> {
  return packingItemsRepository.findMany(scope, {
    where: eq(packingItems.listId, listId),
    orderBy: [asc(packingItems.sortOrder), asc(packingItems.id)],
  })
}

export interface ListProgress extends PackingList {
  readonly itemCount: number
  readonly doneCount: number
  readonly weightGrams: number
}

/** Every list of a trip with its completion counts and packed weight — the lists screen. */
export async function listTripListsWithProgress(
  scope: TenantScope,
  tripId: string,
): Promise<Array<ListProgress>> {
  const [lists, totals, done, weights] = await Promise.all([
    listTripLists(scope, tripId),
    scope.db
      .select({ listId: packingItems.listId, value: count() })
      .from(packingItems)
      .where(tenantFilter(scope, packingItems, eq(packingItems.tripId, tripId)))
      .groupBy(packingItems.listId),
    scope.db
      .select({ listId: packingItems.listId, value: count() })
      .from(packingItems)
      .where(
        tenantFilter(
          scope,
          packingItems,
          and(eq(packingItems.tripId, tripId), eq(packingItems.isDone, true)),
        ),
      )
      .groupBy(packingItems.listId),
    scope.db
      .select({ listId: packingItems.listId, value: sum(packingItems.weightGrams) })
      .from(packingItems)
      .where(tenantFilter(scope, packingItems, eq(packingItems.tripId, tripId)))
      .groupBy(packingItems.listId),
  ])

  const totalBy = new Map(totals.map((row) => [row.listId, row.value]))
  const doneBy = new Map(done.map((row) => [row.listId, row.value]))
  const weightBy = new Map(weights.map((row) => [row.listId, Number(row.value ?? 0)]))

  return lists.map((list) => ({
    ...list,
    itemCount: totalBy.get(list.id) ?? 0,
    doneCount: doneBy.get(list.id) ?? 0,
    weightGrams: weightBy.get(list.id) ?? 0,
  }))
}

/** Items assigned to one traveller across a trip — "your packing" on the mobile lists screen. */
export async function listItemsAssignedTo(
  scope: TenantScope,
  tripId: string,
  userId: string,
): Promise<Array<PackingItem>> {
  return packingItemsRepository.findMany(scope, {
    where: and(eq(packingItems.tripId, tripId), eq(packingItems.assignedTo, userId)),
    orderBy: [asc(packingItems.isDone), asc(packingItems.dueDate), asc(packingItems.sortOrder)],
  })
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

export async function createList(scope: TenantScope, input: CreateListInput): Promise<PackingList> {
  const values = createListInput.parse(input)
  await requireTrip(scope, values.tripId)
  return packingListsRepository.insert(scope, values)
}

export async function updateList(
  scope: TenantScope,
  listId: string,
  input: UpdateListInput,
): Promise<PackingList> {
  return packingListsRepository.requireUpdate(
    scope,
    listId,
    definedOnly(updateListInput.parse(input)),
  )
}

export async function deleteList(scope: TenantScope, listId: string): Promise<void> {
  await packingListsRepository.requireRemove(scope, listId)
}

/**
 * Appends an item to a list. Without an explicit `sortOrder` the item goes to the end: two items added
 * in the same millisecond would otherwise share `sort_order` 0 and the list order would depend on the
 * random half of their ids.
 */
export async function createListItem(
  scope: TenantScope,
  input: CreateListItemInput,
): Promise<PackingItem> {
  const { listId, ...values } = createListItemInput.parse(input)
  const list = await packingListsRepository.requireById(scope, listId)
  return packingItemsRepository.insert(scope, {
    ...values,
    listId,
    tripId: list.tripId,
    sortOrder: values.sortOrder ?? (await nextItemSortOrder(scope, listId)),
  })
}

/** One past the highest `sort_order` currently in the list. */
async function nextItemSortOrder(scope: TenantScope, listId: string): Promise<number> {
  const rows = await packingItemsRepository.findMany(scope, {
    where: eq(packingItems.listId, listId),
    orderBy: [desc(packingItems.sortOrder)],
    limit: 1,
  })
  return (rows.at(0)?.sortOrder ?? -1) + 1
}

export async function updateListItem(
  scope: TenantScope,
  itemId: string,
  input: UpdateListItemInput,
): Promise<PackingItem> {
  return packingItemsRepository.requireUpdate(
    scope,
    itemId,
    definedOnly(updateListItemInput.parse(input)),
  )
}

/** Ticks or unticks an item, stamping `doneAt` so the UI can show when it was packed. */
export async function setListItemDone(
  scope: TenantScope,
  itemId: string,
  isDone: boolean,
): Promise<PackingItem> {
  return packingItemsRepository.requireUpdate(scope, itemId, {
    isDone,
    doneAt: isDone ? new Date() : null,
  })
}

export async function deleteListItem(scope: TenantScope, itemId: string): Promise<void> {
  await packingItemsRepository.requireRemove(scope, itemId)
}

/** Unticks every item of a list — "reset for the next trip". */
export async function resetList(scope: TenantScope, listId: string): Promise<number> {
  await packingListsRepository.requireById(scope, listId)
  const rows = await packingItemsRepository.updateWhere(
    scope,
    allOf(eq(packingItems.listId, listId), eq(packingItems.isDone, true)),
    { isDone: false, doneAt: null },
  )
  return rows.length
}

/* -------------------------------------------------------------------------------------------------
 * Templates
 * ---------------------------------------------------------------------------------------------- */

export async function listTemplates(scope: TenantScope): Promise<Array<PackingTemplate>> {
  return packingTemplatesRepository.findMany(scope, { orderBy: [asc(packingTemplates.name)] })
}

export async function listTemplateItems(
  scope: TenantScope,
  templateId: string,
): Promise<Array<PackingTemplateItem>> {
  return packingTemplateItemsRepository.findMany(scope, {
    where: eq(packingTemplateItems.templateId, templateId),
    orderBy: [asc(packingTemplateItems.sortOrder), asc(packingTemplateItems.id)],
  })
}

export async function createTemplate(
  scope: TenantScope,
  input: CreateTemplateInput,
): Promise<PackingTemplate> {
  const { items, ...values } = createTemplateInput.parse(input)
  const template = await packingTemplatesRepository.insert(scope, {
    ...values,
    createdBy: scope.ctx.userId,
  })
  if (items && items.length > 0) {
    await packingTemplateItemsRepository.insertMany(
      scope,
      items.map((item, index) => ({
        templateId: template.id,
        ...item,
        sortOrder: item.sortOrder ?? index,
      })),
    )
  }
  return template
}

export async function deleteTemplate(scope: TenantScope, templateId: string): Promise<void> {
  await packingTemplatesRepository.requireRemove(scope, templateId)
}

export interface AppliedTemplate {
  readonly list: PackingList
  readonly items: ReadonlyArray<PackingItem>
}

/** Copies a template into a trip as a new list. Both ids are re-read inside the tenant first. */
export async function applyTemplateToTrip(
  scope: TenantScope,
  input: { readonly templateId: string; readonly tripId: string; readonly name?: string },
): Promise<AppliedTemplate> {
  const templateId = idSchema.parse(input.templateId)
  const tripId = idSchema.parse(input.tripId)

  const template = await packingTemplatesRepository.requireById(scope, templateId)
  await requireTrip(scope, tripId)
  const templateItems = await listTemplateItems(scope, templateId)

  const list = await packingListsRepository.insert(scope, {
    tripId,
    name: input.name ? titleSchema.parse(input.name) : template.name,
    kind: template.kind,
    icon: template.icon,
  })

  if (templateItems.length > 0) {
    await packingItemsRepository.insertMany(
      scope,
      templateItems.map((item, index) => ({
        tripId,
        listId: list.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        sortOrder: item.sortOrder === 0 ? index : item.sortOrder,
      })),
    )
  }

  // Re-read rather than trusting `RETURNING`, whose row order SQLite does not define.
  return { list, items: await listItems(scope, list.id) }
}

/** Turns an existing trip list into a reusable template. */
export async function createTemplateFromList(
  scope: TenantScope,
  listId: string,
  name?: string,
): Promise<PackingTemplate> {
  const list = await packingListsRepository.requireById(scope, listId)
  const items = await listItems(scope, listId)
  return createTemplate(scope, {
    name: name ? titleSchema.parse(name) : list.name,
    kind: listKindSchema.catch('packing').parse(list.kind),
    icon: list.icon,
    items: items.map((item, index) => ({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      sortOrder: index,
    })),
  })
}
