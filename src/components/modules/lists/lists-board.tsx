/**
 * The lists screen's working surface.
 *
 * Three things make this a tool rather than a rendering of a table:
 *
 * - **Ticking is instant and honest.** A checkbox paints its new state before the
 *   request leaves, through the claim/settle overlay in `../shared/optimistic.ts`,
 *   and the progress bar above it is recomputed from the *rendered* state, so the
 *   two never disagree. A failed write withdraws only its own claim.
 * - **Order is the traveller's.** Rows are draggable with `@dnd-kit`, keyboard
 *   included, and the new order is persisted as `sort_order` on every row.
 * - **Everything has a way in from the keyboard.** The add-item field sits in the
 *   panel foot, every row action is a real menu item, and the drag handle is a
 *   focusable button registered as dnd-kit's activator.
 */
import { useMemo, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDownUp,
  Backpack,
  CircleSlash,
  GripVertical,
  ListChecks,
  ListTree,
  Pencil,
  Plus,
  RotateCcw,
  ShoppingBag,
  SquareCheck,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Chip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  EmptyState,
  IconButton,
  Input,
  Progress,
  Tooltip,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { paintFor } from '#/lib/swatches'
import { useTranslate } from '#/lib/i18n'
import { useKeyboardCodeFallback } from '#/lib/dnd-keyboard'
import {
  createListItemFn,
  deleteListFn,
  deleteListItemFn,
  reorderListItemsFn,
  resetListFn,
  setListItemsDoneFn,
  updateListItemFn,
} from '#/server/fns/lists'
import {
  ConfirmDialog,
  FilterRow,
  ModulePanel,
  NOT_SET,
  RowMenu,
  fromSelectValue,
  moveItem,
  toSelectValue,
  useAction,
  useOptimistic,
} from '../shared'
import { ItemDialog, ListDialog, TemplateDialog } from './list-dialogs'
import {
  groupByCategory,
  isItemPriority,
  isUngrouped,
  knownCategories,
  listKindLabel,
  matchesFilter,
  matchesOwner,
  progressOf,
  selectAllState,
} from './list-utils'

import type { DragEndEvent } from '@dnd-kit/core'
import type { LucideIcon } from 'lucide-react'
import type { MessageKey, Translate } from '#/lib/i18n'
import type { ReactNode } from 'react'
import type { ConfirmRequest, RowMenuItem } from '../shared'
import type { ListFilter, OwnerFilter } from './list-utils'
import type { ListData, ListItemData, PersonOption } from './types'

/** An item as rendered: the stored row with the overlay's tick applied. */
type RenderedItem = ListItemData & { readonly isDone: boolean }

const KIND_ICON: Record<string, LucideIcon> = {
  packing: Backpack,
  todo: ListChecks,
  shopping: ShoppingBag,
  documents: SquareCheck,
}

function iconFor(kind: string): LucideIcon {
  return KIND_ICON[kind] ?? ListChecks
}

function nameFor(
  people: ReadonlyArray<PersonOption>,
  userId: string | null,
  t: Translate,
): string {
  if (userId === null) {
    return t('modules.lists.unassigned')
  }
  return (
    people.find((person) => person.userId === userId)?.name ??
    t('costs.person.removed')
  )
}

function formatWeight(grams: number): string {
  if (grams < 1000) {
    return `${grams} g`
  }
  return `${(Math.round(grams / 100) / 10).toFixed(1)} kg`
}

const ROW_DIVIDER = 'not-last:border-b not-last:border-edge-faint'

/* ------------------------------------------------------------------- board */

export interface ListsBoardProps {
  readonly tripId: string
  readonly lists: ReadonlyArray<ListData>
  readonly people: ReadonlyArray<PersonOption>
  readonly viewerUserId: string
  /**
   * Whether the reader may change the lists (`canWritePlan`, off the lists payload). Required
   * rather than defaulted: a flag that can be forgotten at a call site draws write controls on a
   * trip that refuses them.
   */
  readonly canWrite: boolean
  /** The reason a writer is refused, for the notice: an archived trip says to restore it. */
  readonly archived: boolean
  /**
   * Whether the "new list" dialog is open. Owned by the screen rather than the
   * board, so the module header can hold the primary action where a primary
   * action belongs while the board keeps the form.
   */
  readonly newListOpen: boolean
  readonly onNewListOpenChange: (open: boolean) => void
}

export function ListsBoard({
  tripId,
  lists,
  people,
  viewerUserId,
  canWrite,
  archived,
  newListOpen,
  onNewListOpenChange,
}: ListsBoardProps) {
  const t = useTranslate()

  const [filter, setFilter] = useState<ListFilter>('all')
  const [owner, setOwner] = useState<OwnerFilter>('everyone')
  const [editingList, setEditingList] = useState<ListData | null>(null)
  const [itemDialog, setItemDialog] = useState<{
    readonly listId: string
    readonly item?: ListItemData
  } | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null)

  const ticks = useOptimistic<boolean>()
  const orders = useOptimistic<ReadonlyArray<string>>()

  const categories = useMemo(
    () => knownCategories(lists.flatMap((list) => list.items)),
    [lists],
  )

  const visibleLists = lists.filter((list) =>
    matchesOwner(list.ownerUserId, viewerUserId, owner),
  )

  const removeList = useAction(deleteListFn, {
    success: t('modules.lists.toast.listRemoved'),
    failure: t('modules.lists.toast.listRemoveFailed'),
    onSuccess: () => setConfirm(null),
  })
  const removeItem = useAction(deleteListItemFn, {
    success: t('modules.lists.toast.itemRemoved'),
    failure: t('modules.lists.toast.itemRemoveFailed'),
    onSuccess: () => setConfirm(null),
  })
  const reset = useAction(resetListFn, {
    success: t('modules.lists.toast.reset'),
    description: t('modules.lists.toast.resetBody'),
    failure: t('modules.lists.toast.resetFailed'),
  })
  const setDone = useAction(setListItemsDoneFn, {
    failure: t('modules.lists.toast.tickFailed'),
    fallback: t('modules.lists.toast.tickFailedBody'),
  })
  const assign = useAction(updateListItemFn, {
    failure: t('modules.lists.toast.assignFailed'),
  })
  const reorder = useAction(reorderListItemsFn, {
    failure: t('modules.lists.toast.orderFailed'),
    fallback: t('modules.lists.toast.orderFailedBody'),
  })

  /** Ticks one row or a whole list, painting the change before it lands. */
  async function tick(
    itemIds: ReadonlyArray<string>,
    isDone: boolean,
  ): Promise<void> {
    if (itemIds.length === 0) {
      return
    }
    await ticks.claim(
      itemIds.map((id) => [id, isDone] as const),
      () => setDone.run({ data: { tripId, itemIds: [...itemIds], isDone } }),
    )
  }

  async function persistOrder(
    listId: string,
    itemIds: ReadonlyArray<string>,
  ): Promise<void> {
    await orders.claim([[listId, itemIds]], () =>
      reorder.run({ data: { tripId, listId, itemIds: [...itemIds] } }),
    )
  }

  function reassign(item: ListItemData, userId: string): void {
    void assign.run({
      data: {
        tripId,
        itemId: item.id,
        name: item.name,
        category: item.category ?? '',
        quantity: item.quantity,
        weightGrams: item.weightGrams ?? 0,
        assignedTo: userId,
        priority: isItemPriority(item.priority) ? item.priority : 'normal',
      },
    })
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {canWrite ? null : (
        <Alert tone="info" size="sm">
          {t(
            archived
              ? 'modules.lists.readOnly.archived'
              : 'modules.lists.readOnly.role',
          )}
        </Alert>
      )}

      <FilterRow>
        <span className="me-1 shrink-0 text-micro font-semibold tracking-label text-ink-4 uppercase">
          {t('modules.lists.show')}
        </span>
        {(
          [
            ['all', 'modules.filter.all'],
            ['open', 'modules.lists.filter.todo'],
            ['done', 'modules.lists.filter.done'],
          ] as ReadonlyArray<readonly [ListFilter, MessageKey]>
        ).map(([value, label]) => (
          <Chip
            key={value}
            selected={filter === value}
            onClick={() => setFilter(value)}
          >
            {t(label)}
          </Chip>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-edge" />
        {(
          [
            ['everyone', 'modules.lists.scope.all', Users],
            ['shared', 'modules.lists.scope.shared', Users],
            ['mine', 'modules.lists.scope.mine', UserRound],
          ] as ReadonlyArray<readonly [OwnerFilter, MessageKey, LucideIcon]>
        ).map(([value, label, Icon]) => (
          <Chip
            key={value}
            selected={owner === value}
            icon={<Icon aria-hidden />}
            onClick={() => setOwner(value)}
          >
            {t(label)}
          </Chip>
        ))}
        {canWrite ? (
          <Button
            variant="secondary"
            size="sm"
            shape="pill"
            className="ms-auto"
            onClick={() => setTemplateOpen(true)}
          >
            <Plus aria-hidden />
            {t('modules.lists.template.from')}
          </Button>
        ) : null}
      </FilterRow>

      {visibleLists.length === 0 ? (
        <EmptyState
          variant="dashed"
          size="lg"
          tone="brand"
          icon={<Backpack />}
          title={
            owner === 'mine'
              ? t('modules.lists.empty.mine.title')
              : t('modules.lists.empty.shared.title')
          }
          description={
            owner === 'mine'
              ? t('modules.lists.empty.mine.body')
              : t('modules.lists.empty.shared.body')
          }
          action={
            canWrite ? (
              <Button
                variant="primary"
                shape="pill"
                onClick={() => onNewListOpenChange(true)}
              >
                <Plus aria-hidden strokeWidth={2.5} />
                {t('modules.lists.action.new')}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="grid min-w-0 gap-4 xl:grid-cols-2">
          {visibleLists.map((list) => (
            <li
              key={list.id}
              className="min-w-0 only:xl:col-span-2 only:xl:mx-auto only:xl:w-full only:xl:max-w-4xl"
            >
              <ListPanel
                tripId={tripId}
                list={list}
                people={people}
                canWrite={canWrite}
                filter={filter}
                orderOverride={orders.get(list.id)}
                tickOverride={ticks.get}
                onTick={tick}
                onReorder={persistOrder}
                onEditList={() => setEditingList(list)}
                onEditItem={(item) => setItemDialog({ listId: list.id, item })}
                onAddItem={() => setItemDialog({ listId: list.id })}
                onAssign={reassign}
                onResetList={() => {
                  void reset.run({ data: { tripId, listId: list.id } })
                }}
                onDeleteList={() =>
                  setConfirm({
                    title: t('modules.remove.confirmTitle', {
                      name: list.name,
                    }),
                    description: t('modules.lists.remove.listBody', {
                      count: list.items.length,
                    }),
                    confirmLabel: t('modules.lists.remove.list'),
                    onConfirm: () =>
                      removeList.run({ data: { tripId, listId: list.id } }),
                  })
                }
                onDeleteItem={(item) =>
                  setConfirm({
                    title: t('modules.remove.confirmTitle', {
                      name: item.name,
                    }),
                    description: t('modules.lists.remove.itemBody'),
                    confirmLabel: t('modules.lists.remove.item'),
                    onConfirm: () =>
                      removeItem.run({ data: { tripId, itemId: item.id } }),
                  })
                }
              />
            </li>
          ))}
        </ul>
      )}

      {canWrite ? (
        <ListDialog
          tripId={tripId}
          list={editingList ?? undefined}
          people={people}
          open={newListOpen || editingList !== null}
          onOpenChange={(next) => {
            if (!next) {
              setEditingList(null)
              onNewListOpenChange(false)
            }
          }}
        />
      ) : null}

      {itemDialog === null || !canWrite ? null : (
        <ItemDialog
          tripId={tripId}
          listId={itemDialog.listId}
          item={itemDialog.item}
          people={people}
          categories={categories}
          open
          onOpenChange={(next) => {
            if (!next) {
              setItemDialog(null)
            }
          }}
        />
      )}

      {canWrite ? (
        <TemplateDialog
          tripId={tripId}
          open={templateOpen}
          onOpenChange={setTemplateOpen}
        />
      ) : null}

      <ConfirmDialog
        request={confirm}
        pending={removeList.pending || removeItem.pending}
        onOpenChange={(next) => {
          if (!next) {
            setConfirm(null)
          }
        }}
      />
    </div>
  )
}

/**
 * The button that opens the "new list" dialog, for the module header. Exported so
 * the route can put the screen's primary action where a primary action belongs.
 */
export function NewListAction({ onClick }: { onClick: () => void }) {
  const t = useTranslate()

  return (
    <Button
      variant="primary"
      size="sm"
      shape="pill"
      icon={<Plus aria-hidden strokeWidth={2.5} />}
      onClick={onClick}
    >
      {t('modules.lists.action.new')}
    </Button>
  )
}

/* -------------------------------------------------------------------- panel */

interface ListPanelProps {
  readonly tripId: string
  readonly list: ListData
  readonly people: ReadonlyArray<PersonOption>
  readonly canWrite: boolean
  readonly filter: ListFilter
  readonly orderOverride: ReadonlyArray<string> | undefined
  readonly tickOverride: (itemId: string) => boolean | undefined
  readonly onTick: (
    itemIds: ReadonlyArray<string>,
    isDone: boolean,
  ) => Promise<void>
  readonly onReorder: (
    listId: string,
    itemIds: ReadonlyArray<string>,
  ) => Promise<void>
  readonly onEditList: () => void
  readonly onEditItem: (item: ListItemData) => void
  readonly onAddItem: () => void
  readonly onAssign: (item: ListItemData, userId: string) => void
  readonly onResetList: () => void
  readonly onDeleteList: () => void
  readonly onDeleteItem: (item: ListItemData) => void
}

function ListPanel(props: ListPanelProps) {
  const { list, people, canWrite, filter, tickOverride } = props
  const Icon = iconFor(list.kind)

  const [mode, setMode] = useState<'grouped' | 'order'>('grouped')

  /** Every item with its rendered tick and the order actually being shown. */
  const rendered = useMemo<Array<RenderedItem>>(() => {
    const byId = new Map(list.items.map((item) => [item.id, item]))
    const ids =
      props.orderOverride === undefined
        ? list.items.map((item) => item.id)
        : props.orderOverride.filter((id) => byId.has(id))
    return ids.flatMap((id) => {
      const item = byId.get(id)
      return item === undefined
        ? []
        : [{ ...item, isDone: tickOverride(id) ?? item.isDone }]
    })
  }, [list.items, props.orderOverride, tickOverride])

  const progress = progressOf(rendered)
  const groups = useMemo(() => groupByCategory(rendered), [rendered])
  const t = useTranslate()
  const hasCategories = !isUngrouped(groups)
  const showGroups = hasCategories && mode === 'grouped'

  const visible = rendered.filter((item) => matchesFilter(item.isDone, filter))
  const allState = selectAllState(rendered)
  const overLimit =
    list.weightLimitGrams !== null &&
    progress.weightGrams > list.weightLimitGrams

  const menuItems: ReadonlyArray<RowMenuItem> = [
    {
      label: t('modules.lists.menu.editList'),
      icon: <Pencil aria-hidden />,
      onSelect: props.onEditList,
    },
    {
      label: t('modules.lists.menu.tickAll'),
      icon: <SquareCheck aria-hidden />,
      disabled: rendered.length === 0 || allState === true,
      separated: true,
      onSelect: () => {
        void props.onTick(
          rendered.filter((item) => !item.isDone).map((item) => item.id),
          true,
        )
      },
    },
    {
      label: t('modules.lists.menu.untickAll'),
      icon: <CircleSlash aria-hidden />,
      disabled: rendered.length === 0 || allState === false,
      onSelect: () => {
        void props.onTick(
          rendered.filter((item) => item.isDone).map((item) => item.id),
          false,
        )
      },
    },
    {
      label: t('modules.lists.menu.reset'),
      icon: <RotateCcw aria-hidden />,
      disabled: progress.done === 0,
      onSelect: props.onResetList,
    },
    {
      label: t('modules.lists.remove.list'),
      icon: <Trash2 aria-hidden />,
      tone: 'danger',
      separated: true,
      onSelect: props.onDeleteList,
    },
  ]

  return (
    <ModulePanel
      className="h-full"
      label={
        <span className="inline-flex min-w-0 items-center gap-2">
          {list.colour === null ? null : (
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              // Through the palette, so the dot is the swatch that was picked
              // and not a hex frozen in the light theme.
              style={{ backgroundColor: paintFor(list.colour) }}
            />
          )}
          <span className="truncate">{list.name}</span>
        </span>
      }
      count={`${progress.done}/${progress.total}`}
      action={
        <>
          <Badge
            tone={progress.complete ? 'success' : 'neutral'}
            size="sm"
            icon={<Icon aria-hidden className="size-3" />}
            className="hidden sm:inline-flex"
          >
            {t(listKindLabel(list.kind))}
          </Badge>
          {list.ownerUserId === null ? null : (
            <Badge tone="outline" size="sm">
              {nameFor(people, list.ownerUserId, t).split(' ')[0]}
            </Badge>
          )}
          {hasCategories ? (
            <Tooltip
              content={
                showGroups
                  ? t('modules.lists.menu.dragOrderLong')
                  : t('modules.lists.menu.groupAgain')
              }
            >
              <IconButton
                variant="ghost"
                size="sm"
                label={
                  showGroups
                    ? t('modules.lists.menu.dragOrder')
                    : t('modules.lists.menu.groupByCategory')
                }
                icon={
                  showGroups ? (
                    <ArrowDownUp aria-hidden />
                  ) : (
                    <ListTree aria-hidden />
                  )
                }
                onClick={() => setMode(showGroups ? 'order' : 'grouped')}
              />
            </Tooltip>
          ) : null}
          {canWrite ? (
            <RowMenu
              label={t('modules.actionsFor', { name: list.name })}
              items={menuItems}
            />
          ) : null}
        </>
      }
      toolbar={
        <div className="flex flex-col gap-2">
          <Progress
            value={progress.done}
            max={Math.max(progress.total, 1)}
            size="xs"
            tone={progress.complete ? 'success' : 'brand'}
            aria-label={t('modules.lists.progress.ticked', {
              done: progress.done,
              total: progress.total,
            })}
          />
          {progress.weightGrams === 0 &&
          list.weightLimitGrams === null ? null : (
            <p
              className={cn(
                'text-caption tabular-nums',
                overLimit ? 'text-danger' : 'text-ink-4',
              )}
            >
              {list.weightLimitGrams === null
                ? t(
                    overLimit
                      ? 'modules.lists.weight.packedOver'
                      : 'modules.lists.weight.packed',
                    { weight: formatWeight(progress.weightGrams) },
                  )
                : t(
                    overLimit
                      ? 'modules.lists.weight.packedOfOver'
                      : 'modules.lists.weight.packedOf',
                    {
                      weight: formatWeight(progress.weightGrams),
                      limit: formatWeight(list.weightLimitGrams),
                    },
                  )}
            </p>
          )}
        </div>
      }
      flush
      footer={
        canWrite ? (
          <InlineItemComposer
            tripId={props.tripId}
            listId={list.id}
            onOpenFullForm={props.onAddItem}
          />
        ) : undefined
      }
    >
      {rendered.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState
            size="sm"
            icon={<Icon />}
            title={t('modules.lists.items.empty.title')}
            description={t('modules.lists.items.empty.body')}
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="px-5 py-8">
          <EmptyState
            size="sm"
            icon={<Icon />}
            title={
              filter === 'done'
                ? t('modules.lists.items.doneEmpty.title')
                : t('modules.lists.items.todoEmpty.title')
            }
            description={
              filter === 'done'
                ? t('modules.lists.items.doneEmpty.body')
                : t('modules.lists.items.todoEmpty.body', {
                    label: t('modules.filter.all'),
                  })
            }
          />
        </div>
      ) : showGroups ? (
        <div className="flex flex-col">
          {groups.map((group) => {
            const rows = group.items.filter((item) =>
              matchesFilter(item.isDone, filter),
            )
            if (rows.length === 0) {
              return null
            }
            return (
              <section key={group.category ?? '__loose'} className="min-w-0">
                <h3 className="flex items-baseline gap-2 border-b border-edge-faint bg-surface-2/50 px-5 py-1.5 text-micro font-semibold tracking-label text-ink-3 uppercase">
                  <span className="truncate">
                    {group.category ?? t('modules.lists.category.other')}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink-4">
                    {group.items.filter((item) => item.isDone).length}/
                    {group.items.length}
                  </span>
                </h3>
                <ul>
                  {rows.map((item) => (
                    <li key={item.id} className={ROW_DIVIDER}>
                      <ItemRow
                        item={item}
                        people={people}
                        canWrite={canWrite}
                        onTick={(next) => void props.onTick([item.id], next)}
                        onEdit={() => props.onEditItem(item)}
                        onDelete={() => props.onDeleteItem(item)}
                        onAssign={(userId) => props.onAssign(item, userId)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      ) : (
        <SortableItems
          listId={list.id}
          items={visible}
          allIds={rendered.map((item) => item.id)}
          people={people}
          canWrite={canWrite}
          onTick={props.onTick}
          onReorder={props.onReorder}
          onEditItem={props.onEditItem}
          onDeleteItem={props.onDeleteItem}
          onAssign={props.onAssign}
        />
      )}
    </ModulePanel>
  )
}

/* --------------------------------------------------------------- sortable */

function SortableItems({
  listId,
  items,
  allIds,
  people,
  canWrite,
  onTick,
  onReorder,
  onEditItem,
  onDeleteItem,
  onAssign,
}: {
  listId: string
  items: ReadonlyArray<RenderedItem>
  /** Every id in the list, including the ones a filter is hiding. */
  allIds: ReadonlyArray<string>
  people: ReadonlyArray<PersonOption>
  canWrite: boolean
  onTick: (itemIds: ReadonlyArray<string>, isDone: boolean) => Promise<void>
  onReorder: (listId: string, itemIds: ReadonlyArray<string>) => Promise<void>
  onEditItem: (item: ListItemData) => void
  onDeleteItem: (item: ListItemData) => void
  onAssign: (item: ListItemData, userId: string) => void
}) {
  // Same reason as the planner board: `@dnd-kit` reads the physical key code, and a
  // synthesised keypress does not have to carry one.
  useKeyboardCodeFallback()

  const sensors = useSensors(
    // 6px of slack, so a tap on the checkbox inside a draggable row stays a tap.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const t = useTranslate()
  const ids = items.map((item) => item.id)
  const filtering = ids.length !== allIds.length
  const byId = new Map(items.map((item) => [item.id, item]))

  function nameOf(id: string | number): string {
    return byId.get(String(id))?.name ?? t('modules.lists.dnd.fallbackName')
  }

  function handleDragEnd(event: DragEndEvent): void {
    const { active, over } = event
    if (over === null || active.id === over.id) {
      return
    }
    const from = allIds.indexOf(String(active.id))
    const to = allIds.indexOf(String(over.id))
    if (from === -1 || to === -1) {
      return
    }
    void onReorder(listId, moveItem(allIds, from, to))
  }

  return (
    <DndContext
      // Stable across server and client: see the note in `plan-screen.tsx`.
      id="lists-board"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) =>
            t('modules.lists.dnd.picked', { name: nameOf(active.id) }),
          onDragOver: () => undefined,
          onDragEnd: ({ active }) =>
            t('modules.lists.dnd.dropped', { name: nameOf(active.id) }),
          onDragCancel: () => t('modules.lists.dnd.cancelled'),
        },
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul>
          {items.map((item) => (
            <SortableItemRow
              key={item.id}
              item={item}
              people={people}
              canWrite={canWrite}
              // Dragging while a filter hides rows would reorder against a list
              // the traveller cannot see, so the handles step aside instead.
              draggable={canWrite && !filtering}
              onTick={(next) => void onTick([item.id], next)}
              onEdit={() => onEditItem(item)}
              onDelete={() => onDeleteItem(item)}
              onAssign={(userId) => onAssign(item, userId)}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableItemRow({
  item,
  people,
  canWrite,
  draggable,
  onTick,
  onEdit,
  onDelete,
  onAssign,
}: {
  item: RenderedItem
  people: ReadonlyArray<PersonOption>
  canWrite: boolean
  draggable: boolean
  onTick: (next: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onAssign: (userId: string) => void
}) {
  const t = useTranslate()
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !draggable })

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'relative bg-surface',
        ROW_DIVIDER,
        isDragging && 'z-dropdown shadow-elevated',
      )}
    >
      <ItemRow
        item={item}
        people={people}
        canWrite={canWrite}
        dragging={isDragging}
        handle={
          draggable ? (
            <button
              ref={setActivatorNodeRef}
              type="button"
              aria-label={t('modules.lists.dnd.reorder', { name: item.name })}
              // Always visible, quietly: a handle that only appears on hover
              // cannot be found on a touch screen, where there is no hover.
              className={cn(
                'grid size-6 shrink-0 cursor-grab touch-none place-items-center rounded-sm text-ink-4 focus-ring',
                'opacity-45 transition-opacity duration-fast ease-out-quint',
                'group-hover/row:opacity-100 hover:text-ink-2 focus-visible:opacity-100',
                isDragging && 'cursor-grabbing opacity-100',
              )}
              {...attributes}
              {...listeners}
            >
              <GripVertical aria-hidden className="size-4" />
            </button>
          ) : undefined
        }
        onTick={onTick}
        onEdit={onEdit}
        onDelete={onDelete}
        onAssign={onAssign}
      />
    </li>
  )
}

/* ---------------------------------------------------------------- item row */

function ItemRow({
  item,
  people,
  canWrite,
  dragging = false,
  handle,
  onTick,
  onEdit,
  onDelete,
  onAssign,
}: {
  item: RenderedItem
  people: ReadonlyArray<PersonOption>
  canWrite: boolean
  dragging?: boolean
  handle?: ReactNode
  onTick: (next: boolean) => void
  onEdit: () => void
  onDelete: () => void
  onAssign: (userId: string) => void
}) {
  const t = useTranslate()

  return (
    <div
      className={cn(
        'group/row flex min-w-0 items-center gap-2.5 px-3 py-2 sm:px-5',
        'transition-colors duration-fast ease-out-quint hover:bg-hover',
        dragging && 'bg-surface-2',
      )}
    >
      {handle ?? (
        <span aria-hidden className="hidden size-6 shrink-0 sm:block" />
      )}

      <Checkbox
        size="sm"
        checked={item.isDone}
        disabled={!canWrite}
        onCheckedChange={(next) => onTick(next === true)}
        aria-label={t(
          item.isDone
            ? 'modules.lists.action.untickItem'
            : 'modules.lists.action.tickOffItem',
          { name: item.name },
        )}
        className="shrink-0"
      />

      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span
          className={cn(
            'min-w-0 truncate text-label',
            item.isDone ? 'text-ink-4 line-through' : 'text-ink',
          )}
        >
          {item.name}
        </span>
        {item.quantity > 1 ? (
          <span className="shrink-0 text-caption tabular-nums text-ink-3">
            ×{item.quantity}
          </span>
        ) : null}
      </span>

      {item.weightGrams === null || item.weightGrams === 0 ? null : (
        <span className="hidden shrink-0 text-caption tabular-nums text-ink-4 sm:inline">
          {formatWeight(item.weightGrams * Math.max(item.quantity, 1))}
        </span>
      )}

      {item.priority === 'high' ? (
        <Badge tone="warning" size="sm" className="shrink-0">
          {t('modules.lists.priority.high')}
        </Badge>
      ) : null}

      <AssigneeMenu
        item={item}
        people={people}
        canWrite={canWrite}
        onAssign={onAssign}
      />

      {canWrite ? (
        <RowMenu
          label={t('modules.actionsFor', { name: item.name })}
          size="sm"
          className="shrink-0"
          items={[
            {
              label: t('modules.lists.menu.editItem'),
              icon: <Pencil aria-hidden />,
              onSelect: onEdit,
            },
            {
              label: t('modules.lists.remove.item'),
              icon: <Trash2 aria-hidden />,
              tone: 'danger',
              separated: true,
              onSelect: onDelete,
            },
          ]}
        />
      ) : null}
    </div>
  )
}

/** Assignment, as a control rather than a read-out. */
function AssigneeMenu({
  item,
  people,
  canWrite,
  onAssign,
}: {
  item: ListItemData
  people: ReadonlyArray<PersonOption>
  canWrite: boolean
  onAssign: (userId: string) => void
}) {
  const t = useTranslate()

  if (people.length === 0) {
    return null
  }
  const assignee = people.find((person) => person.userId === item.assignedTo)
  // A reader who may not write still sees who the item is for, as a read-out.
  if (!canWrite) {
    return assignee === undefined ? null : (
      <Avatar name={assignee.name} src={assignee.image} size="sm" />
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            assignee === undefined
              ? t('modules.lists.item.assignAria', { name: item.name })
              : t('modules.lists.item.reassignAria', {
                  item: item.name,
                  owner: assignee.name,
                })
          }
          className={cn(
            'inline-flex shrink-0 items-center rounded-full p-0.5 focus-ring',
            'transition-colors duration-fast ease-out-quint hover:bg-active',
          )}
        >
          {assignee === undefined ? (
            <span className="grid size-6 place-items-center rounded-full border border-dashed border-edge-strong text-ink-4">
              <UserRound aria-hidden className="size-3" />
            </span>
          ) : (
            <Avatar name={assignee.name} src={assignee.image} size="sm" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>
          {t('modules.lists.item.field.owner')}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={toSelectValue(item.assignedTo)}
          onValueChange={(next) => onAssign(fromSelectValue(next))}
        >
          <DropdownMenuRadioItem value={NOT_SET}>
            {t('modules.lists.item.owner.nobody')}
          </DropdownMenuRadioItem>
          {people.map((person) => (
            <DropdownMenuRadioItem key={person.userId} value={person.userId}>
              {person.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* -------------------------------------------------------------- composer */

/**
 * The fastest way to fill a list: one field in the panel foot, Enter to add,
 * focus kept so the next item can be typed straight away. The full dialog is one
 * click away for the things that need a weight, a category or an owner.
 */
function InlineItemComposer({
  tripId,
  listId,
  onOpenFullForm,
}: {
  tripId: string
  listId: string
  onOpenFullForm: () => void
}) {
  const t = useTranslate()
  const [value, setValue] = useState('')
  const add = useAction(createListItemFn, {
    failure: t('modules.lists.item.toast.addFailed'),
  })

  const trimmed = value.trim()
  const canAdd = trimmed.length > 0 && !add.pending

  async function submit(): Promise<void> {
    if (!canAdd) {
      return
    }
    const result = await add.run({
      data: {
        tripId,
        listId,
        name: trimmed,
        category: '',
        quantity: 1,
        weightGrams: 0,
        assignedTo: '',
        priority: 'normal',
      },
    })
    if (result !== null) {
      setValue('')
    }
  }

  return (
    <form
      className="flex min-w-0 items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Input
        size="sm"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('modules.lists.quickAdd.placeholder')}
        aria-label={t('modules.lists.quickAdd.aria')}
        maxLength={120}
        autoComplete="off"
        className="min-w-0 flex-1"
        loading={add.pending}
      />
      <Button
        type="submit"
        variant="subtle"
        size="sm"
        shape="pill"
        disabled={!canAdd}
      >
        {t('modules.lists.action.add')}
      </Button>
      <Tooltip content={t('modules.lists.quickAdd.detailsHint')}>
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          label={t('modules.lists.quickAdd.detailsAria')}
          icon={<Plus aria-hidden />}
          onClick={onOpenFullForm}
        />
      </Tooltip>
    </form>
  )
}
