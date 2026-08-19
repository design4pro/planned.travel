/**
 * Write paths for the trip's checklists.
 *
 * Every handler re-reads the trip inside the caller's tenant before it touches a
 * child row — the repository layer's guarantee, surfaced at the route boundary —
 * and every input is parsed by Zod here *and* again inside the repository, so a
 * hand-rolled request cannot smuggle a field past the form.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { ITEM_PRIORITIES, LIST_KINDS } from '#/server/db/schema'
import {
  applyTemplateToTrip,
  createList,
  createListItem,
  deleteList,
  deleteListItem,
  listTemplateItems,
  listTemplates,
  requireTrip,
  resetList,
  setListItemDone,
  updateList,
  updateListItem,
} from '#/server/repos'
import { appScope, mirrorToRoom, orNull, patch, tombstone } from './context'

/* ------------------------------------------------------------------ inputs */

const tripId = z.string().trim().min(1).max(64)
const rowId = z.string().trim().min(1).max(64)
const name = z.string().trim().min(1).max(120)

const listKind = z.enum(LIST_KINDS)
const priority = z.enum(ITEM_PRIORITIES)

/** A hex colour, or `''` for "no colour" — the shape a radio group produces. */
const colour = z
  .string()
  .trim()
  .max(9)
  .refine(
    (value) =>
      value === '' || /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value),
    'must be a hex colour',
  )

const listFields = {
  name,
  kind: listKind,
  colour,
  /** `''` means the list is shared with everyone on the trip. */
  ownerUserId: z.string().trim().max(64),
  weightLimitGrams: z.number().int().min(0).max(500_000),
}

const itemFields = {
  name,
  category: z.string().trim().max(60),
  quantity: z.number().int().min(1).max(999),
  weightGrams: z.number().int().min(0).max(200_000),
  assignedTo: z.string().trim().max(64),
  priority,
}

export const createListInputSchema = z.object({ tripId, ...listFields })
export const updateListInputSchema = z.object({
  tripId,
  listId: rowId,
  ...listFields,
})
export const createListItemInputSchema = z.object({
  tripId,
  listId: rowId,
  ...itemFields,
})
export const updateListItemInputSchema = z.object({
  tripId,
  itemId: rowId,
  ...itemFields,
})

/* -------------------------------------------------------------------- lists */

export const createListFn = createServerFn({ method: 'POST' })
  .validator(createListInputSchema)
  .handler(async ({ data }): Promise<{ readonly listId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    const list = await createList(scope, {
      tripId: data.tripId,
      name: data.name,
      kind: data.kind,
      colour: orNull(data.colour),
      ownerUserId: orNull(data.ownerUserId),
      weightLimitGrams:
        data.weightLimitGrams === 0 ? null : data.weightLimitGrams,
    })

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { listsChangedAt: Date.now() }),
    ])
    return { listId: list.id }
  })

export const updateListFn = createServerFn({ method: 'POST' })
  .validator(updateListInputSchema)
  .handler(async ({ data }): Promise<{ readonly listId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    await updateList(scope, data.listId, {
      name: data.name,
      kind: data.kind,
      colour: orNull(data.colour),
      ownerUserId: orNull(data.ownerUserId),
      weightLimitGrams:
        data.weightLimitGrams === 0 ? null : data.weightLimitGrams,
    })

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { listsChangedAt: Date.now() }),
    ])
    return { listId: data.listId }
  })

export const deleteListFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, listId: rowId }))
  .handler(async ({ data }): Promise<{ readonly deleted: true }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    await deleteList(scope, data.listId)

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { listsChangedAt: Date.now() }),
    ])
    return { deleted: true }
  })

/** Unticks every item on a list — "reset for the next trip". */
export const resetListFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, listId: rowId }))
  .handler(async ({ data }): Promise<{ readonly cleared: number }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    const cleared = await resetList(scope, data.listId)

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { listsChangedAt: Date.now() }),
    ])
    return { cleared }
  })

/* -------------------------------------------------------------------- items */

export const createListItemFn = createServerFn({ method: 'POST' })
  .validator(createListItemInputSchema)
  .handler(async ({ data }): Promise<{ readonly itemId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    const item = await createListItem(scope, {
      listId: data.listId,
      name: data.name,
      category: orNull(data.category),
      quantity: data.quantity,
      weightGrams: data.weightGrams === 0 ? null : data.weightGrams,
      assignedTo: orNull(data.assignedTo),
      priority: data.priority,
    })

    await mirrorToRoom(scope, data.tripId, [
      patch('packing-item', item.id, {
        listId: data.listId,
        name: data.name,
        isDone: false,
      }),
    ])
    return { itemId: item.id }
  })

export const updateListItemFn = createServerFn({ method: 'POST' })
  .validator(updateListItemInputSchema)
  .handler(async ({ data }): Promise<{ readonly itemId: string }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    await updateListItem(scope, data.itemId, {
      name: data.name,
      category: orNull(data.category),
      quantity: data.quantity,
      weightGrams: data.weightGrams === 0 ? null : data.weightGrams,
      assignedTo: orNull(data.assignedTo),
      priority: data.priority,
    })

    await mirrorToRoom(scope, data.tripId, [
      patch('packing-item', data.itemId, { name: data.name }),
    ])
    return { itemId: data.itemId }
  })

export const deleteListItemFn = createServerFn({ method: 'POST' })
  .validator(z.object({ tripId, itemId: rowId }))
  .handler(async ({ data }): Promise<{ readonly deleted: true }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)
    await deleteListItem(scope, data.itemId)

    await mirrorToRoom(scope, data.tripId, [
      tombstone('packing-item', data.itemId),
    ])
    return { deleted: true }
  })

/**
 * Ticks or unticks items. Takes a list rather than a single id because the row
 * checkbox and the "tick everything" bulk action are the same operation, and one
 * round trip keeps the optimistic state and the server in step.
 */
export const setListItemsDoneFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId,
      itemIds: z.array(rowId).min(1).max(200),
      isDone: z.boolean(),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly changed: number }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    await Promise.all(
      data.itemIds.map((itemId) => setListItemDone(scope, itemId, data.isDone)),
    )

    await mirrorToRoom(
      scope,
      data.tripId,
      data.itemIds.map((itemId) =>
        patch('packing-item', itemId, { isDone: data.isDone }),
      ),
    )
    return { changed: data.itemIds.length }
  })

/** Persists a drag-and-drop reorder: the array order *is* the new sort order. */
export const reorderListItemsFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId,
      listId: rowId,
      itemIds: z.array(rowId).min(1).max(500),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly ordered: number }> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    await Promise.all(
      data.itemIds.map((itemId, index) =>
        updateListItem(scope, itemId, { sortOrder: index }),
      ),
    )

    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { listsChangedAt: Date.now() }),
    ])
    return { ordered: data.itemIds.length }
  })

/* ---------------------------------------------------------------- templates */

export interface ListTemplateOption {
  readonly id: string
  readonly name: string
  readonly kind: string
  readonly description: string | null
  readonly itemCount: number
  readonly sample: ReadonlyArray<string>
}

/**
 * The templates the "start from a template" dialog offers, each with the first
 * few things it will add — a name alone is not enough to choose between two
 * packing lists.
 */
export const loadListTemplatesFn = createServerFn({ method: 'GET' })
  .validator(z.object({ tripId }))
  .handler(async ({ data }): Promise<ReadonlyArray<ListTemplateOption>> => {
    const scope = await appScope()
    await requireTrip(scope, data.tripId)

    const templates = await listTemplates(scope)
    const items = await Promise.all(
      templates.map((template) => listTemplateItems(scope, template.id)),
    )

    return templates.map((template, index) => {
      const rows = items[index] ?? []
      return {
        id: template.id,
        name: template.name,
        kind: template.kind,
        description: template.description,
        itemCount: rows.length,
        sample: rows.slice(0, 4).map((row) => row.name),
      }
    })
  })

export const applyListTemplateFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({ tripId, templateId: rowId, name: name.or(z.literal('')) }),
  )
  .handler(
    async ({
      data,
    }): Promise<{ readonly listId: string; readonly itemCount: number }> => {
      const scope = await appScope()
      await requireTrip(scope, data.tripId)

      const applied = await applyTemplateToTrip(scope, {
        templateId: data.templateId,
        tripId: data.tripId,
        name: data.name === '' ? undefined : data.name,
      })

      await mirrorToRoom(scope, data.tripId, [
        patch('trip', data.tripId, { listsChangedAt: Date.now() }),
      ])
      return { listId: applied.list.id, itemCount: applied.items.length }
    },
  )
