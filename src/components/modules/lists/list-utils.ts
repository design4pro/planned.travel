/**
 * How a checklist is read, before any of it is drawn.
 *
 * Grouping, filtering and progress are the three things the lists screen has to
 * get right and the three things a screenshot cannot prove, so they live here as
 * plain functions over plain data.
 */

export interface ListItemLike {
  readonly id: string
  readonly name: string
  readonly category: string | null
  readonly quantity: number
  readonly weightGrams: number | null
  readonly isDone: boolean
  readonly assignedTo: string | null
  readonly priority: string
}

export const LIST_KINDS = ['packing', 'todo', 'shopping', 'documents'] as const
export type ListKind = (typeof LIST_KINDS)[number]

export function isListKind(value: string): value is ListKind {
  return (LIST_KINDS as ReadonlyArray<string>).includes(value)
}

export const LIST_KIND_LABELS: { readonly [K in ListKind]: string } = {
  packing: 'Packing',
  todo: 'To-do',
  shopping: 'Shopping',
  documents: 'Documents',
}

export function listKindLabel(kind: string): string {
  return isListKind(kind) ? LIST_KIND_LABELS[kind] : 'List'
}

export const ITEM_PRIORITIES = ['low', 'normal', 'high'] as const
export type ItemPriority = (typeof ITEM_PRIORITIES)[number]

export function isItemPriority(value: string): value is ItemPriority {
  return (ITEM_PRIORITIES as ReadonlyArray<string>).includes(value)
}

/* ---------------------------------------------------------------- filtering */

export type ListFilter = 'all' | 'open' | 'done'

/**
 * The state a row must be in to survive the filter. Takes the *rendered* done
 * state, not the stored one, so an optimistically ticked row does not vanish and
 * reappear as the write settles.
 */
export function matchesFilter(isDone: boolean, filter: ListFilter): boolean {
  if (filter === 'open') {
    return !isDone
  }
  if (filter === 'done') {
    return isDone
  }
  return true
}

export type OwnerFilter = 'everyone' | 'shared' | 'mine'

export function matchesOwner(
  ownerUserId: string | null,
  viewerUserId: string,
  filter: OwnerFilter,
): boolean {
  if (filter === 'shared') {
    return ownerUserId === null
  }
  if (filter === 'mine') {
    return ownerUserId === viewerUserId
  }
  return true
}

/* ----------------------------------------------------------------- grouping */

export interface ItemGroup<T> {
  /** `null` is the un-categorised group, which always sorts last. */
  readonly category: string | null
  readonly items: ReadonlyArray<T>
}

/**
 * Groups items by their category, keeping each group in the order the items
 * themselves are in — which is the traveller's own drag-and-drop order.
 *
 * Categories appear in the order they are first used, so reordering an item to
 * the top of a list also moves its category to the top. Un-categorised items are
 * collected into one trailing group; a list where *nothing* is categorised comes
 * back as a single `null` group, which lets the renderer skip the headings
 * entirely rather than drawing one heading over everything.
 */
export function groupByCategory<T extends { readonly category: string | null }>(
  items: ReadonlyArray<T>,
): Array<ItemGroup<T>> {
  const order: Array<string> = []
  const buckets = new Map<string, Array<T>>()
  const loose: Array<T> = []

  for (const item of items) {
    const key = item.category?.trim() ?? ''
    if (key.length === 0) {
      loose.push(item)
      continue
    }
    const bucket = buckets.get(key)
    if (bucket === undefined) {
      order.push(key)
      buckets.set(key, [item])
    } else {
      bucket.push(item)
    }
  }

  const groups: Array<ItemGroup<T>> = order.map((category) => ({
    category,
    items: buckets.get(category) ?? [],
  }))

  if (loose.length > 0) {
    groups.push({ category: null, items: loose })
  }
  return groups
}

/** True when the grouping is not worth drawing — one group, and it is the loose one. */
export function isUngrouped<T>(groups: ReadonlyArray<ItemGroup<T>>): boolean {
  return groups.length <= 1 && (groups[0]?.category ?? null) === null
}

/** Categories already used across a trip, for the item dialog's suggestions. */
export function knownCategories(
  items: ReadonlyArray<{ readonly category: string | null }>,
): Array<string> {
  const seen = new Set<string>()
  for (const item of items) {
    const value = item.category?.trim() ?? ''
    if (value.length > 0) {
      seen.add(value)
    }
  }
  return [...seen].sort((left, right) => left.localeCompare(right, 'en-GB'))
}

/* ----------------------------------------------------------------- progress */

export interface ListProgress {
  readonly total: number
  readonly done: number
  readonly open: number
  /** `0`–`1`. An empty list is `0`, never `NaN`. */
  readonly ratio: number
  readonly complete: boolean
  readonly weightGrams: number
}

/**
 * Progress over the *rendered* state of a set of items.
 *
 * Recomputed on the client rather than read from the loader's counts, because the
 * moment a row is ticked optimistically the loader's number is one behind and a
 * progress bar that lags the checkbox above it is worse than no progress bar.
 */
export function progressOf(
  items: ReadonlyArray<{
    readonly isDone: boolean
    readonly weightGrams: number | null
    readonly quantity: number
  }>,
): ListProgress {
  const total = items.length
  const done = items.filter((item) => item.isDone).length
  const weightGrams = items.reduce(
    (sum, item) => sum + (item.weightGrams ?? 0) * Math.max(item.quantity, 1),
    0,
  )
  return {
    total,
    done,
    open: total - done,
    ratio: total === 0 ? 0 : done / total,
    complete: total > 0 && done === total,
    weightGrams,
  }
}

/**
 * What the panel's select-all checkbox should show: every row ticked, none, or a
 * mix. `indeterminate` is what Radix wants for `aria-checked="mixed"`.
 */
export function selectAllState(
  items: ReadonlyArray<{ readonly isDone: boolean }>,
): boolean | 'indeterminate' {
  if (items.length === 0) {
    return false
  }
  const done = items.filter((item) => item.isDone).length
  if (done === 0) {
    return false
  }
  return done === items.length ? true : 'indeterminate'
}
