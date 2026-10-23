import * as React from 'react'
import { Check, ChevronsUpDown, Search, X } from 'lucide-react'

import { cn } from '#/lib/cn'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Spinner } from './spinner'
import { useFieldControl } from './field'
import { useUiCopy } from './copy'
import {
  fieldSizes,
  focusRing,
  iconSizes,
  menuLabelBase,
  transitionBase,
  useControllableState,
} from './shared'

import type { FieldSize } from './shared'

export type ComboboxOption = {
  value: string
  label: string
  /** Second line in the row — an airport code, a country, a currency name. */
  description?: string
  icon?: React.ReactNode
  disabled?: boolean
  /** Rows sharing a group are rendered under one uppercase heading. */
  group?: string
}

const triggerClasses = [
  'flex w-full items-center gap-2 rounded-md border border-edge-strong bg-surface text-start text-ink',
  transitionBase,
  focusRing,
  'hover:border-ink-4',
  'data-[state=open]:border-brand',
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4 disabled:hover:border-edge-strong',
  'aria-[invalid=true]:border-danger',
]

function defaultFilter(option: ComboboxOption, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') return true
  return (
    option.label.toLowerCase().includes(needle) ||
    (option.description?.toLowerCase().includes(needle) ?? false)
  )
}

/** Rows in render order, with the group headings they sit under. */
function groupOptions(options: Array<ComboboxOption>) {
  const groups = new Map<string, Array<ComboboxOption>>()
  for (const option of options) {
    const key = option.group ?? ''
    const bucket = groups.get(key)
    if (bucket) bucket.push(option)
    else groups.set(key, [option])
  }
  return [...groups.entries()]
}

type ListboxProps = {
  listId: string
  options: Array<ComboboxOption>
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  isSelected: (option: ComboboxOption) => boolean
  onPick: (option: ComboboxOption) => void
  emptyMessage: React.ReactNode
  loading: boolean
  /** True when several options can be selected at once, so assistive tech reads each as on or off. */
  multiselectable?: boolean
}

function Listbox({
  listId,
  options,
  activeIndex,
  onActiveIndexChange,
  isSelected,
  onPick,
  emptyMessage,
  loading,
  multiselectable,
}: ListboxProps) {
  const t = useUiCopy()
  const activeRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-caption text-ink-3">
        <Spinner size="sm" label={null} />
        {t('ui.status.searching')}
      </div>
    )
  }

  if (options.length === 0) {
    return (
      <p className="px-2.5 py-6 text-center text-caption text-ink-3">
        {emptyMessage}
      </p>
    )
  }

  let index = -1
  return (
    <div
      role="listbox"
      aria-multiselectable={multiselectable || undefined}
      id={listId}
      className="max-h-64 overflow-y-auto overscroll-contain py-1"
    >
      {groupOptions(options).map(([group, rows]) => (
        <div
          key={group || 'ungrouped'}
          role="group"
          aria-label={group || undefined}
        >
          {group ? <p className={menuLabelBase}>{group}</p> : null}
          {rows.map((option) => {
            index += 1
            const optionIndex = index
            const active = optionIndex === activeIndex
            const selected = isSelected(option)
            return (
              <div
                key={option.value}
                ref={active ? activeRef : undefined}
                id={`${listId}-option-${optionIndex}`}
                role="option"
                aria-selected={selected}
                aria-disabled={option.disabled || undefined}
                onPointerMove={() => {
                  if (!option.disabled) onActiveIndexChange(optionIndex)
                }}
                onClick={() => {
                  if (!option.disabled) onPick(option)
                }}
                className={cn(
                  'relative mx-1 flex cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 pe-8',
                  'text-label text-ink-2',
                  transitionBase,
                  active && 'bg-hover text-ink',
                  selected && 'font-semibold text-ink',
                  option.disabled && 'pointer-events-none opacity-45',
                )}
              >
                {option.icon ? (
                  <span
                    className="grid size-4 shrink-0 place-items-center text-ink-4 [&_svg]:size-4"
                    aria-hidden="true"
                  >
                    {option.icon}
                  </span>
                ) : null}
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{option.label}</span>
                  {option.description ? (
                    <span className="block truncate text-caption font-normal text-ink-4">
                      {option.description}
                    </span>
                  ) : null}
                </span>
                {selected ? (
                  <Check
                    size={14}
                    strokeWidth={3}
                    className="absolute end-2.5 text-brand"
                    aria-hidden="true"
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** Shared keyboard handling for the search box inside the popover. */
function useListNavigation(
  count: number,
  onCommit: (index: number) => void,
  onClose: () => void,
) {
  const [activeIndex, setActiveIndex] = React.useState(0)

  React.useEffect(() => {
    setActiveIndex((current) =>
      current > count - 1 ? Math.max(count - 1, 0) : current,
    )
  }, [count])

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (count === 0) return
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + delta + count) % count)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActiveIndex(event.key === 'Home' ? 0 : Math.max(count - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (count > 0) onCommit(activeIndex)
      return
    }
    if (event.key === 'Escape' || event.key === 'Tab') {
      onClose()
    }
  }

  return { activeIndex, setActiveIndex, onKeyDown }
}

type SearchInputProps = {
  value: string
  onValueChange: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  placeholder: string
  listId: string
  activeId: string | undefined
  ariaLabel: string
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      value,
      onValueChange,
      onKeyDown,
      placeholder,
      listId,
      activeId,
      ariaLabel,
    },
    ref,
  ) => (
    <div className="flex items-center gap-2 border-b border-edge-faint px-2.5 pb-2">
      <Search size={14} className="shrink-0 text-ink-4" aria-hidden="true" />
      <input
        ref={ref}
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onValueChange(event.currentTarget.value)}
        onKeyDown={onKeyDown}
        className="h-7 w-full min-w-0 bg-transparent text-label text-ink outline-none placeholder:text-ink-4"
      />
    </div>
  ),
)
SearchInput.displayName = 'SearchInput'

export type ComboboxProps = {
  options: Array<ComboboxOption>
  value?: string | null
  defaultValue?: string | null
  onChange?: (value: string | null) => void
  /** Overrides the empty-value text. Left out, it says "Select…". */
  placeholder?: string
  /** Overrides the search box's placeholder and its accessible name. */
  searchPlaceholder?: string
  /** Overrides the no-results line. Left out, it says "No matches". */
  emptyMessage?: React.ReactNode
  size?: FieldSize
  invalid?: boolean
  disabled?: boolean
  id?: string
  /** Adds a reset affordance to the trigger once something is chosen. */
  clearable?: boolean
  /** Notified on every keystroke — the hook for server-side search. */
  onSearchChange?: (query: string) => void
  /** Skips local filtering; the caller is already returning filtered options. */
  manualFiltering?: boolean
  loading?: boolean
  filter?: (option: ComboboxOption, query: string) => boolean
  ariaLabel?: string
  className?: string
  contentClassName?: string
}

/**
 * A searchable single-select. The list is a real `listbox` with
 * `aria-activedescendant`, so focus stays in the search box while the arrow keys
 * move the highlight — the pattern screen readers expect from a combobox, and
 * the reason typing and navigating never fight each other here.
 */
export const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      options,
      value,
      defaultValue = null,
      onChange,
      placeholder,
      searchPlaceholder,
      emptyMessage,
      size = 'md',
      invalid,
      disabled,
      id,
      clearable = false,
      onSearchChange,
      manualFiltering = false,
      loading = false,
      filter = defaultFilter,
      ariaLabel,
      className,
      contentClassName,
    },
    ref,
  ) => {
    const t = useUiCopy()
    const search = searchPlaceholder ?? t('ui.combobox.search')
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState('')
    const searchRef = React.useRef<HTMLInputElement | null>(null)
    const [selected, setSelected] = useControllableState<string | null>({
      value,
      defaultValue,
      onChange,
    })

    const listId = `${React.useId()}-listbox`
    const field = useFieldControl({ id, 'aria-invalid': invalid, disabled })

    const visible = manualFiltering
      ? options
      : options.filter((option) => filter(option, query))
    const selectedOption =
      options.find((option) => option.value === selected) ?? null

    const commit = (index: number) => {
      const option = visible.at(index)
      if (!option || option.disabled) return
      setSelected(option.value)
      setOpen(false)
    }

    const { activeIndex, setActiveIndex, onKeyDown } = useListNavigation(
      visible.length,
      commit,
      () => setOpen(false),
    )

    const handleOpenChange = (next: boolean) => {
      setOpen(next)
      if (!next) {
        setQuery('')
        onSearchChange?.('')
      }
    }

    return (
      <Popover open={open} onOpenChange={handleOpenChange}>
        <span className={cn('relative flex w-full items-center', className)}>
          <PopoverTrigger asChild>
            <button
              ref={ref}
              type="button"
              aria-label={ariaLabel}
              className={cn(
                triggerClasses,
                fieldSizes[size],
                clearable && selected && 'pe-14',
              )}
              {...field}
            >
              {selectedOption?.icon ? (
                <span
                  className="grid size-4 shrink-0 place-items-center text-ink-4 [&_svg]:size-4"
                  aria-hidden="true"
                >
                  {selectedOption.icon}
                </span>
              ) : null}
              <span
                className={cn(
                  'min-w-0 flex-1 truncate',
                  !selectedOption && 'text-ink-4',
                )}
              >
                {selectedOption?.label ??
                  placeholder ??
                  t('ui.select.placeholder')}
              </span>
              <ChevronsUpDown
                size={iconSizes[size]}
                className="shrink-0 text-ink-4"
                aria-hidden="true"
              />
            </button>
          </PopoverTrigger>

          {clearable && selected && !field.disabled ? (
            <button
              type="button"
              aria-label={t('ui.combobox.clear')}
              onClick={() => setSelected(null)}
              className={cn(
                'absolute top-1/2 end-8 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ink-4',
                transitionBase,
                focusRing,
                'hover:bg-hover hover:text-ink',
              )}
            >
              <X size={iconSizes[size]} aria-hidden="true" />
            </button>
          ) : null}
        </span>

        <PopoverContent
          padding="none"
          align="start"
          onOpenAutoFocus={(event) => {
            // Focus belongs in the search box, not on the panel itself.
            event.preventDefault()
            searchRef.current?.focus()
          }}
          className={cn(
            'w-(--radix-popover-trigger-width) min-w-56 overflow-hidden pt-2',
            contentClassName,
          )}
        >
          <SearchInput
            ref={searchRef}
            value={query}
            onValueChange={(next) => {
              setQuery(next)
              setActiveIndex(0)
              onSearchChange?.(next)
            }}
            onKeyDown={onKeyDown}
            placeholder={search}
            listId={listId}
            activeId={
              visible.length > 0 ? `${listId}-option-${activeIndex}` : undefined
            }
            ariaLabel={ariaLabel ?? search}
          />
          <Listbox
            listId={listId}
            options={visible}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            isSelected={(option) => option.value === selected}
            onPick={(option) => {
              setSelected(option.value)
              setOpen(false)
            }}
            emptyMessage={emptyMessage ?? t('ui.combobox.empty')}
            loading={loading}
          />
        </PopoverContent>
      </Popover>
    )
  },
)
Combobox.displayName = 'Combobox'

export type MultiComboboxProps = Omit<
  ComboboxProps,
  'value' | 'defaultValue' | 'onChange' | 'clearable'
> & {
  value?: Array<string>
  defaultValue?: Array<string>
  onChange?: (values: Array<string>) => void
  /** Faces shown in the trigger before it collapses to a count. */
  maxVisibleTags?: number
}

/**
 * The same list, toggling many values. Selected entries stay in the trigger as
 * removable tags, and Backspace in an empty search box removes the last one —
 * the shortcut that makes a tag field feel like a text field.
 */
export const MultiCombobox = React.forwardRef<
  HTMLButtonElement,
  MultiComboboxProps
>(
  (
    {
      options,
      value,
      defaultValue = [],
      onChange,
      placeholder,
      searchPlaceholder,
      emptyMessage,
      size = 'md',
      invalid,
      disabled,
      id,
      onSearchChange,
      manualFiltering = false,
      loading = false,
      filter = defaultFilter,
      ariaLabel,
      className,
      contentClassName,
      maxVisibleTags = 3,
    },
    ref,
  ) => {
    const t = useUiCopy()
    const search = searchPlaceholder ?? t('ui.combobox.search')
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState('')
    const searchRef = React.useRef<HTMLInputElement | null>(null)
    const [selected, setSelected] = useControllableState<Array<string>>({
      value,
      defaultValue,
      onChange,
    })

    const listId = `${React.useId()}-listbox`
    const field = useFieldControl({ id, 'aria-invalid': invalid, disabled })

    const visible = manualFiltering
      ? options
      : options.filter((option) => filter(option, query))
    const chosen = options.filter((option) => selected.includes(option.value))

    const toggle = (optionValue: string) => {
      setSelected(
        selected.includes(optionValue)
          ? selected.filter((entry) => entry !== optionValue)
          : [...selected, optionValue],
      )
    }

    const { activeIndex, setActiveIndex, onKeyDown } = useListNavigation(
      visible.length,
      (index) => {
        const option = visible.at(index)
        if (option && !option.disabled) toggle(option.value)
      },
      () => setOpen(false),
    )

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Backspace' && query === '' && selected.length > 0) {
        event.preventDefault()
        setSelected(selected.slice(0, -1))
        return
      }
      onKeyDown(event)
    }

    return (
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setQuery('')
            onSearchChange?.('')
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            aria-label={ariaLabel}
            className={cn(
              triggerClasses,
              'h-auto min-h-10 flex-wrap gap-1.5 px-2 py-1.5',
              size === 'sm' && 'min-h-8',
              size === 'lg' && 'min-h-12',
              className,
            )}
            {...field}
          >
            {chosen.length === 0 ? (
              <span className="px-1 text-label text-ink-4">
                {placeholder ?? t('ui.select.placeholder')}
              </span>
            ) : (
              <>
                {chosen.slice(0, maxVisibleTags).map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-caption font-medium text-ink-2"
                  >
                    {option.label}
                  </span>
                ))}
                {chosen.length > maxVisibleTags ? (
                  <span className="text-caption tabular-nums text-ink-3">
                    +{chosen.length - maxVisibleTags}
                  </span>
                ) : null}
              </>
            )}
            <ChevronsUpDown
              size={iconSizes[size]}
              className="ms-auto shrink-0 text-ink-4"
              aria-hidden="true"
            />
          </button>
        </PopoverTrigger>

        <PopoverContent
          padding="none"
          align="start"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            searchRef.current?.focus()
          }}
          className={cn(
            'w-(--radix-popover-trigger-width) min-w-56 overflow-hidden pt-2',
            contentClassName,
          )}
        >
          <SearchInput
            ref={searchRef}
            value={query}
            onValueChange={(next) => {
              setQuery(next)
              setActiveIndex(0)
              onSearchChange?.(next)
            }}
            onKeyDown={handleKeyDown}
            placeholder={search}
            listId={listId}
            activeId={
              visible.length > 0 ? `${listId}-option-${activeIndex}` : undefined
            }
            ariaLabel={ariaLabel ?? search}
          />
          <Listbox
            listId={listId}
            options={visible}
            activeIndex={activeIndex}
            onActiveIndexChange={setActiveIndex}
            isSelected={(option) => selected.includes(option.value)}
            onPick={(option) => toggle(option.value)}
            emptyMessage={emptyMessage ?? t('ui.combobox.empty')}
            loading={loading}
            multiselectable
          />
        </PopoverContent>
      </Popover>
    )
  },
)
MultiCombobox.displayName = 'MultiCombobox'
