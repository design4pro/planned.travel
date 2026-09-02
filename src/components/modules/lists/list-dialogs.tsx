/**
 * The three dialogs behind the lists screen: a list, an item, and a template.
 *
 * All three follow the same contract as every other form in the product —
 * validate on the client so the traveller is told before the round trip, validate
 * again on the server because the client is never trusted, invalidate the router
 * on success so the loader becomes the truth again, and keep the failure where the
 * form can show it inline as well as in a toast.
 */
import { useEffect, useId, useState } from 'react'
import { Layers, Sparkles } from 'lucide-react'

import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  SimpleSelect,
  Skeleton,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import {
  applyListTemplateFn,
  createListFn,
  createListItemFn,
  loadListTemplatesFn,
  updateListFn,
  updateListItemFn,
} from '#/server/fns/lists'
import { SwatchPicker } from '../shared/swatch-picker'
import {
  NOT_SET,
  fromSelectValue,
  messageOf,
  toSelectValue,
  useAction,
} from '../shared'
import {
  ITEM_PRIORITIES,
  LIST_KINDS,
  LIST_KIND_LABELS,
  isItemPriority,
  isListKind,
} from './list-utils'

import type { ListTemplateOption } from '#/server/fns/lists'
import type { ListData, ListItemData, PersonOption } from './types'

/* --------------------------------------------------------------- list dialog */

export function ListDialog({
  tripId,
  list,
  people,
  open,
  onOpenChange,
}: {
  tripId: string
  /** Absent for a new list. */
  list?: ListData
  people: ReadonlyArray<PersonOption>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslate()
  const editing = list !== undefined
  const formId = useId()

  const [name, setName] = useState('')
  const [kind, setKind] = useState<string>('packing')
  const [colour, setColour] = useState('')
  const [owner, setOwner] = useState(NOT_SET)
  const [limit, setLimit] = useState('')

  // Re-seeded whenever the dialog opens, so "edit" never shows the last row's
  // values and "new" never shows the last thing that was typed.
  useEffect(() => {
    if (!open) {
      return
    }
    setName(list?.name ?? '')
    setKind(list?.kind ?? 'packing')
    setColour(list?.colour ?? '')
    setOwner(toSelectValue(list?.ownerUserId))
    setLimit(
      list?.weightLimitGrams === null || list?.weightLimitGrams === undefined
        ? ''
        : String(list.weightLimitGrams),
    )
  }, [open, list])

  const create = useAction(createListFn, {
    success: t('modules.lists.toast.created'),
    description: t('modules.lists.toast.createdBody'),
    failure: t('modules.lists.toast.createFailed'),
  })
  const update = useAction(updateListFn, {
    success: t('modules.lists.toast.updated'),
    failure: t('modules.lists.toast.updateFailed'),
  })
  const action = editing ? update : create

  const trimmed = name.trim()
  const limitError =
    limit !== '' && !/^\d{1,6}$/.test(limit.trim())
      ? t('modules.lists.error.weightLimit')
      : undefined
  const canSave =
    trimmed.length > 0 && limitError === undefined && !action.pending

  async function submit(): Promise<void> {
    const payload = {
      tripId,
      name: trimmed,
      kind: isListKind(kind) ? kind : 'packing',
      colour,
      ownerUserId: fromSelectValue(owner),
      weightLimitGrams: limit === '' ? 0 : Number.parseInt(limit, 10),
    }
    const result = editing
      ? await update.run({ data: { ...payload, listId: list.id } })
      : await create.run({ data: payload })
    if (result !== null) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t('modules.lists.dialog.editTitle')
              : t('modules.lists.action.new')}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? t('modules.lists.dialog.editBody')
              : t('modules.lists.dialog.addBody')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (canSave) {
                void submit()
              }
            }}
          >
            {action.error === null ? null : (
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {action.error}
              </Alert>
            )}

            <Field label={t('modules.field.name')} required>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('modules.lists.field.namePlaceholder')}
                maxLength={120}
                autoComplete="off"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('modules.lists.field.kind')}>
                <SimpleSelect
                  options={LIST_KINDS.map((value) => ({
                    value,
                    label: t(LIST_KIND_LABELS[value]),
                  }))}
                  value={kind}
                  onValueChange={setKind}
                  ariaLabel={t('modules.lists.field.kindAria')}
                />
              </Field>
              <Field
                label={t('modules.lists.field.owner')}
                hint={t('modules.lists.field.ownerHint')}
              >
                <SimpleSelect
                  options={[
                    {
                      value: NOT_SET,
                      label: t('modules.lists.field.everyone'),
                    },
                    ...people.map((person) => ({
                      value: person.userId,
                      label: person.name,
                    })),
                  ]}
                  value={owner}
                  onValueChange={setOwner}
                  ariaLabel={t('modules.lists.field.owner')}
                />
              </Field>
            </div>

            <Field
              label={t('modules.lists.field.weightLimit')}
              hint={t('modules.lists.field.weightLimitHint')}
              error={limitError}
            >
              <Input
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                inputMode="numeric"
                placeholder="7000"
                trailing={<span className="text-caption text-ink-4">g</span>}
              />
            </Field>

            <SwatchPicker
              value={colour}
              onChange={setColour}
              legend={t('modules.colour.legend')}
            />
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={action.pending}
            loadingLabel={t('modules.lists.action.saving')}
          >
            {editing
              ? t('modules.lists.action.save')
              : t('modules.lists.action.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* --------------------------------------------------------------- item dialog */

export function ItemDialog({
  tripId,
  listId,
  item,
  people,
  categories,
  open,
  onOpenChange,
}: {
  tripId: string
  listId: string
  /** Absent for a new item. */
  item?: ListItemData
  people: ReadonlyArray<PersonOption>
  /** Categories already used on this trip, offered as a datalist. */
  categories: ReadonlyArray<string>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslate()
  const editing = item !== undefined
  const formId = useId()
  const listName = useId()

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [weight, setWeight] = useState('')
  const [assignedTo, setAssignedTo] = useState(NOT_SET)
  const [priority, setPriority] = useState<string>('normal')

  useEffect(() => {
    if (!open) {
      return
    }
    setName(item?.name ?? '')
    setCategory(item?.category ?? '')
    setQuantity(String(item?.quantity ?? 1))
    setWeight(
      item?.weightGrams === null || item?.weightGrams === undefined
        ? ''
        : String(item.weightGrams),
    )
    setAssignedTo(toSelectValue(item?.assignedTo))
    setPriority(item?.priority ?? 'normal')
  }, [open, item])

  const create = useAction(createListItemFn, {
    success: t('modules.lists.item.toast.added'),
    failure: t('modules.lists.item.toast.addFailed'),
  })
  const update = useAction(updateListItemFn, {
    success: t('modules.lists.item.toast.updated'),
    failure: t('modules.lists.item.toast.updateFailed'),
  })
  const action = editing ? update : create

  const trimmed = name.trim()
  const quantityError = !/^\d{1,3}$/.test(quantity.trim())
    ? t('modules.lists.item.error.quantity')
    : Number.parseInt(quantity, 10) < 1
      ? t('modules.lists.item.error.quantity')
      : undefined
  const weightError =
    weight !== '' && !/^\d{1,6}$/.test(weight.trim())
      ? t('modules.lists.item.error.weight')
      : undefined
  const canSave =
    trimmed.length > 0 &&
    quantityError === undefined &&
    weightError === undefined &&
    !action.pending

  async function submit(): Promise<void> {
    const payload = {
      tripId,
      name: trimmed,
      category,
      quantity: Number.parseInt(quantity, 10),
      weightGrams: weight === '' ? 0 : Number.parseInt(weight, 10),
      assignedTo: fromSelectValue(assignedTo),
      priority: isItemPriority(priority) ? priority : ('normal' as const),
    }
    const result = editing
      ? await update.run({ data: { ...payload, itemId: item.id } })
      : await create.run({ data: { ...payload, listId } })
    if (result !== null) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t('modules.lists.item.dialog.editTitle')
              : t('modules.lists.item.dialog.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('modules.lists.item.dialog.body')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (canSave) {
                void submit()
              }
            }}
          >
            {action.error === null ? null : (
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {action.error}
              </Alert>
            )}

            <Field label={t('modules.lists.item.field.label')} required>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('modules.lists.item.field.placeholder')}
                maxLength={120}
                autoComplete="off"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('modules.field.category')}
                hint={t('modules.lists.item.field.categoryHint')}
              >
                <Input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder={t(
                    'modules.lists.item.field.categoryPlaceholder',
                  )}
                  maxLength={60}
                  list={categories.length === 0 ? undefined : listName}
                  autoComplete="off"
                />
                {categories.length === 0 ? null : (
                  <datalist id={listName}>
                    {categories.map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                )}
              </Field>
              <Field label={t('modules.lists.item.field.priority')}>
                <SimpleSelect
                  options={ITEM_PRIORITIES.map((value) => ({
                    value,
                    label:
                      value === 'high'
                        ? t('modules.lists.priorityChoice.high')
                        : value === 'low'
                          ? t('modules.lists.priorityChoice.low')
                          : t('modules.lists.priorityChoice.normal'),
                  }))}
                  value={priority}
                  onValueChange={setPriority}
                  ariaLabel={t('modules.lists.item.field.priority')}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t('modules.lists.item.field.quantity')}
                error={quantityError}
              >
                <Input
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  inputMode="numeric"
                  leading={<span className="text-caption text-ink-4">×</span>}
                />
              </Field>
              <Field
                label={t('modules.lists.item.field.weight')}
                error={weightError}
                hint={t('modules.lists.item.field.weightHint')}
              >
                <Input
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  inputMode="numeric"
                  placeholder="240"
                  trailing={<span className="text-caption text-ink-4">g</span>}
                />
              </Field>
            </div>

            <Field label={t('modules.lists.item.field.owner')}>
              <SimpleSelect
                options={[
                  {
                    value: NOT_SET,
                    label: t('modules.lists.item.owner.nobody'),
                  },
                  ...people.map((person) => ({
                    value: person.userId,
                    label: person.name,
                  })),
                ]}
                value={assignedTo}
                onValueChange={setAssignedTo}
                ariaLabel={t('modules.lists.item.field.owner')}
              />
            </Field>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={action.pending}
            loadingLabel={t('modules.lists.item.action.saving')}
          >
            {editing
              ? t('modules.lists.item.action.save')
              : t('modules.lists.item.action.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ----------------------------------------------------------- template dialog */

export function TemplateDialog({
  tripId,
  open,
  onOpenChange,
}: {
  tripId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslate()
  const [templates, setTemplates] =
    useState<ReadonlyArray<ListTemplateOption> | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  // Loaded when the dialog opens rather than with the screen: a template
  // catalogue nobody opens is a query nobody needed.
  useEffect(() => {
    if (!open) {
      return
    }
    let cancelled = false
    setTemplates(null)
    setLoadError(null)
    setSelected(null)

    loadListTemplatesFn({ data: { tripId } })
      .then((rows) => {
        if (!cancelled) {
          setTemplates(rows)
          setSelected(rows[0]?.id ?? null)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setLoadError(messageOf(cause, t('modules.lists.template.loadError')))
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, tripId])

  const apply = useAction(applyListTemplateFn, {
    success: t('modules.lists.template.toast.added'),
    description: (result) =>
      t('modules.lists.template.copiedIn', { count: result.itemCount }),
    failure: t('modules.lists.template.toast.addFailed'),
  })

  async function submit(): Promise<void> {
    if (selected === null) {
      return
    }
    const result = await apply.run({
      data: { tripId, templateId: selected, name: '' },
    })
    if (result !== null) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('modules.lists.template.dialogTitle')}</DialogTitle>
          <DialogDescription>
            {t('modules.lists.template.dialogBody')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {apply.error === null ? null : (
            <Alert
              tone="danger"
              title={t('modules.lists.template.error.apply')}
              className="mb-4"
            >
              {apply.error}
            </Alert>
          )}

          {loadError !== null ? (
            <Alert tone="danger" title={t('modules.lists.template.error.load')}>
              {loadError}
            </Alert>
          ) : templates === null ? (
            <div aria-busy="true" className="flex flex-col gap-3">
              <span className="sr-only">
                {t('modules.lists.template.loading')}
              </span>
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-20 w-full" radius="lg" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<Layers />}
              title={t('modules.lists.template.empty.title')}
              description={t('modules.lists.template.empty.body')}
            />
          ) : (
            <ul className="flex flex-col gap-2.5">
              {templates.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    aria-pressed={selected === template.id}
                    onClick={() => setSelected(template.id)}
                    className={cn(
                      'flex w-full flex-col gap-1.5 rounded-lg border p-4 text-start focus-ring',
                      'transition-[border-color,background-color] duration-base ease-out-quint',
                      selected === template.id
                        ? 'border-brand bg-brand-subtle'
                        : 'border-edge-faint bg-surface-2/60 hover:border-edge-strong',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-label font-semibold text-ink">
                        {template.name}
                      </span>
                      <Badge tone="neutral" size="sm">
                        {t('modules.lists.template.itemCount', {
                          count: template.itemCount,
                        })}
                      </Badge>
                    </span>
                    {template.description === null ? null : (
                      <span className="text-caption text-ink-3">
                        {template.description}
                      </span>
                    )}
                    {template.sample.length === 0 ? null : (
                      <span className="truncate text-caption text-ink-4">
                        {template.sample.join(' · ')}
                        {template.itemCount > template.sample.length
                          ? ' …'
                          : ''}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            shape="pill"
            icon={<Sparkles aria-hidden />}
            disabled={selected === null || apply.pending}
            loading={apply.pending}
            loadingLabel={t('modules.lists.template.applying')}
            onClick={() => void submit()}
          >
            {t('modules.lists.template.apply')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
