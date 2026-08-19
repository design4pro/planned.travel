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
import {
  applyListTemplateFn,
  createListFn,
  createListItemFn,
  loadListTemplatesFn,
  updateListFn,
  updateListItemFn,
} from '#/server/fns/lists'
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

/**
 * A list's colour is stored on the row, so the palette has to travel as a hex
 * string the database can hold. Each option is paired with the token class that
 * paints the swatch, so nothing on screen is drawn from the literal.
 */
const SWATCHES: ReadonlyArray<{
  value: string
  className: string
  label: string
}> = [
  { value: '', className: 'bg-surface-inset', label: 'No colour' },
  { value: '#256256', className: 'bg-brand', label: 'Pine' },
  { value: '#1d4fd8', className: 'bg-info', label: 'Ink blue' },
  { value: '#8a5305', className: 'bg-warning', label: 'Amber' },
  { value: '#136b45', className: 'bg-success', label: 'Green' },
  { value: '#b22f22', className: 'bg-danger', label: 'Red' },
]

function SwatchPicker({
  value,
  onChange,
  legend,
}: {
  value: string
  onChange: (next: string) => void
  legend: string
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-label font-medium text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch.label}
            type="button"
            aria-pressed={value === swatch.value}
            aria-label={swatch.label}
            onClick={() => onChange(swatch.value)}
            className={cn(
              'size-8 rounded-full border border-edge-faint transition-[box-shadow,transform] duration-base ease-out-quint focus-ring',
              swatch.className,
              value === swatch.value
                ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface'
                : 'hover:scale-105 motion-reduce:hover:scale-100',
            )}
          />
        ))}
      </div>
    </fieldset>
  )
}

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
    success: 'List created',
    description: 'Add the first thing you must not forget.',
    failure: 'The list was not created',
  })
  const update = useAction(updateListFn, {
    success: 'List updated',
    failure: 'The list was not updated',
  })
  const action = editing ? update : create

  const trimmed = name.trim()
  const limitError =
    limit !== '' && !/^\d{1,6}$/.test(limit.trim())
      ? 'A weight limit is a whole number of grams.'
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
          <DialogTitle>{editing ? 'Edit this list' : 'New list'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Rename it, change what kind of list it is, or hand it to one traveller.'
              : 'Packing, to-dos, shopping and the documents you must not forget — each one gets its own list.'}
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
              <Alert tone="danger" title="That did not save">
                {action.error}
              </Alert>
            )}

            <Field label="Name" required>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Carry-on"
                maxLength={120}
                autoComplete="off"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Kind">
                <SimpleSelect
                  options={LIST_KINDS.map((value) => ({
                    value,
                    label: LIST_KIND_LABELS[value],
                  }))}
                  value={kind}
                  onValueChange={setKind}
                  ariaLabel="Kind of list"
                />
              </Field>
              <Field
                label="Belongs to"
                hint="Shared lists are everyone's to tick off."
              >
                <SimpleSelect
                  options={[
                    { value: NOT_SET, label: 'Everyone on the trip' },
                    ...people.map((person) => ({
                      value: person.userId,
                      label: person.name,
                    })),
                  ]}
                  value={owner}
                  onValueChange={setOwner}
                  ariaLabel="Belongs to"
                />
              </Field>
            </div>

            <Field
              label="Weight limit"
              hint="Grams. Leave it empty if there is no allowance to keep to."
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

            <SwatchPicker value={colour} onChange={setColour} legend="Colour" />
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={action.pending}
            loadingLabel="Saving the list"
          >
            {editing ? 'Save list' : 'Create list'}
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
    success: 'Item added',
    failure: 'The item was not added',
  })
  const update = useAction(updateListItemFn, {
    success: 'Item updated',
    failure: 'The item was not updated',
  })
  const action = editing ? update : create

  const trimmed = name.trim()
  const quantityError = !/^\d{1,3}$/.test(quantity.trim())
    ? 'A quantity is a whole number from 1 to 999.'
    : Number.parseInt(quantity, 10) < 1
      ? 'A quantity is a whole number from 1 to 999.'
      : undefined
  const weightError =
    weight !== '' && !/^\d{1,6}$/.test(weight.trim())
      ? 'A weight is a whole number of grams.'
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
            {editing ? 'Edit this item' : 'Add an item'}
          </DialogTitle>
          <DialogDescription>
            Everything except the name is optional — a weight makes the pack
            total real, and a category groups the list.
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
              <Alert tone="danger" title="That did not save">
                {action.error}
              </Alert>
            )}

            <Field label="Item" required>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Passport"
                maxLength={120}
                autoComplete="off"
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Category"
                hint="Groups the list under a heading. Optional."
              >
                <Input
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Documents"
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
              <Field label="Priority">
                <SimpleSelect
                  options={ITEM_PRIORITIES.map((value) => ({
                    value,
                    label:
                      value === 'high'
                        ? 'High — do not forget'
                        : value === 'low'
                          ? 'Low — if there is room'
                          : 'Normal',
                  }))}
                  value={priority}
                  onValueChange={setPriority}
                  ariaLabel="Priority"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Quantity" error={quantityError}>
                <Input
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                  inputMode="numeric"
                  leading={<span className="text-caption text-ink-4">×</span>}
                />
              </Field>
              <Field label="Weight" error={weightError} hint="Grams, per unit.">
                <Input
                  value={weight}
                  onChange={(event) => setWeight(event.target.value)}
                  inputMode="numeric"
                  placeholder="240"
                  trailing={<span className="text-caption text-ink-4">g</span>}
                />
              </Field>
            </div>

            <Field label="Whose job is this">
              <SimpleSelect
                options={[
                  { value: NOT_SET, label: 'Nobody in particular' },
                  ...people.map((person) => ({
                    value: person.userId,
                    label: person.name,
                  })),
                ]}
                value={assignedTo}
                onValueChange={setAssignedTo}
                ariaLabel="Whose job is this"
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
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={action.pending}
            loadingLabel="Saving the item"
          >
            {editing ? 'Save item' : 'Add item'}
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
          setLoadError(
            messageOf(cause, 'The templates could not be loaded right now.'),
          )
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, tripId])

  const apply = useAction(applyListTemplateFn, {
    success: 'List added from a template',
    description: (result) =>
      `${result.itemCount} item${result.itemCount === 1 ? '' : 's'} copied in, ready to tick off.`,
    failure: 'The template was not applied',
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
          <DialogTitle>Start from a template</DialogTitle>
          <DialogDescription>
            A template is a list you have saved before. Applying one copies it
            in as a new list on this trip — the original is left alone.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {apply.error === null ? null : (
            <Alert tone="danger" title="That did not apply" className="mb-4">
              {apply.error}
            </Alert>
          )}

          {loadError !== null ? (
            <Alert tone="danger" title="The templates did not load">
              {loadError}
            </Alert>
          ) : templates === null ? (
            <div aria-busy="true" className="flex flex-col gap-3">
              <span className="sr-only">Loading templates</span>
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-20 w-full" radius="lg" />
              ))}
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<Layers />}
              title="No templates yet"
              description="Save a list as a template once you have one you would build again, and it will show up here for every future trip."
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
                      'flex w-full flex-col gap-1.5 rounded-lg border p-4 text-left focus-ring',
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
                        {template.itemCount} item
                        {template.itemCount === 1 ? '' : 's'}
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
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            shape="pill"
            icon={<Sparkles aria-hidden />}
            disabled={selected === null || apply.pending}
            loading={apply.pending}
            loadingLabel="Applying the template"
            onClick={() => void submit()}
          >
            Apply template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
