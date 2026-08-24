import * as React from 'react'
import { Select as SelectPrimitive } from 'radix-ui'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '#/lib/cn'
import { useFieldControl } from './field'
import { useUiCopy } from './copy'
import {
  fieldSizes,
  iconSizes,
  layerSurface,
  menuItemBase,
  menuLabelBase,
  menuSeparatorBase,
  popMotion,
  transitionBase,
  useControllableState,
} from './shared'

import type { FieldSize } from './shared'

/**
 * A native-feeling single-select built on Radix, so typeahead, Home/End,
 * PageUp/PageDown, RTL and the "selected item opens under the cursor" behaviour
 * all come for free — none of which a hand-rolled listbox would have.
 */
export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export type SelectTriggerProps = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Trigger
> & {
  size?: FieldSize
  invalid?: boolean
  /** Glyph pinned to the left of the value. */
  leading?: React.ReactNode
}

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  SelectTriggerProps
>(
  (
    {
      className,
      size = 'md',
      invalid,
      leading,
      children,
      disabled,
      id,
      ...props
    },
    ref,
  ) => {
    const field = useFieldControl({
      id,
      'aria-describedby': props['aria-describedby'],
      'aria-invalid': invalid ?? props['aria-invalid'],
      disabled,
    })

    return (
      <SelectPrimitive.Trigger
        ref={ref}
        /*
         * `role="combobox"` carries an implicit `aria-haspopup="listbox"`, but
         * the WAI-ARIA select-only combobox pattern spells it out and some
         * screen-reader/browser pairs only announce "has popup" when it is
         * present in the markup. Declared before `{...props}` so a caller can
         * still override it — a `Select` whose content is a grid, say.
         */
        aria-haspopup="listbox"
        className={cn(
          'group flex w-full items-center justify-between gap-2 rounded-md border border-edge-strong bg-surface text-ink',
          'text-start select-none',
          transitionBase,
          'hover:border-ink-4',
          'focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring',
          'data-[state=open]:border-brand',
          'data-[placeholder]:text-ink-4',
          'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4 disabled:hover:border-edge-strong',
          'aria-[invalid=true]:border-danger aria-[invalid=true]:outline-danger',
          fieldSizes[size],
          className,
        )}
        {...props}
        {...field}
      >
        <span className="flex min-w-0 items-center gap-2">
          {leading ? (
            <span
              className="grid shrink-0 place-items-center text-ink-4"
              aria-hidden="true"
            >
              {leading}
            </span>
          ) : null}
          <span className="truncate">{children}</span>
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            size={iconSizes[size]}
            aria-hidden="true"
            className={cn(
              'shrink-0 text-ink-4',
              transitionBase,
              'group-data-[state=open]:rotate-180 motion-reduce:group-data-[state=open]:rotate-0',
            )}
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
    )
  },
)
SelectTrigger.displayName = 'SelectTrigger'

const scrollButtonClasses =
  'flex h-6 cursor-default items-center justify-center bg-surface text-ink-4'

export type SelectContentProps = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Content
>

export const SelectContent = React.forwardRef<
  HTMLDivElement,
  SelectContentProps
>(
  (
    { className, children, position = 'popper', sideOffset = 6, ...props },
    ref,
  ) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={sideOffset}
        className={cn(
          layerSurface,
          popMotion,
          'z-dropdown max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden p-1',
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className={scrollButtonClasses}>
          <ChevronUp size={14} aria-hidden="true" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-0">
          {children}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className={scrollButtonClasses}>
          <ChevronDown size={14} aria-hidden="true" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  ),
)
SelectContent.displayName = 'SelectContent'

export type SelectItemProps = React.ComponentPropsWithoutRef<
  typeof SelectPrimitive.Item
> & {
  /** Glyph, flag or swatch shown before the label. */
  icon?: React.ReactNode
  /** Second line, for a currency name or an airport code. */
  description?: React.ReactNode
}

export const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, icon, description, children, ...props }, ref) => (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(menuItemBase, 'pe-8', className)}
      {...props}
    >
      {icon ? (
        <span
          className="grid size-4 shrink-0 place-items-center text-ink-4"
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        {description ? (
          <span className="block truncate text-caption text-ink-4">
            {description}
          </span>
        ) : null}
      </span>
      <SelectPrimitive.ItemIndicator className="absolute end-2.5 grid place-items-center text-brand">
        <Check size={14} aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  ),
)
SelectItem.displayName = 'SelectItem'

export const SelectLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn(menuLabelBase, className)}
    {...props}
  />
))
SelectLabel.displayName = 'SelectLabel'

export const SelectSeparator = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn(menuSeparatorBase, className)}
    {...props}
  />
))
SelectSeparator.displayName = 'SelectSeparator'

/**
 * A whole select in one call, for the common case where the options are a flat
 * list. Falls back to the composable parts above the moment groups, icons or
 * descriptions are needed.
 */
export type SelectOption = {
  value: string
  label: string
  description?: string
  icon?: React.ReactNode
  disabled?: boolean
}

export type SimpleSelectProps = Omit<
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Root>,
  'children'
> & {
  options: Array<SelectOption>
  /** Overrides the empty-value text. Left out, it says "Select…". */
  placeholder?: string
  size?: FieldSize
  invalid?: boolean
  className?: string
  triggerId?: string
  /** Accessible name when no visible label sits next to the control. */
  ariaLabel?: string
}

export const SimpleSelect = React.forwardRef<
  HTMLButtonElement,
  SimpleSelectProps
>(
  (
    {
      options,
      placeholder,
      size = 'md',
      invalid,
      className,
      triggerId,
      ariaLabel,
      value,
      defaultValue,
      onValueChange,
      ...props
    },
    ref,
  ) => {
    const t = useUiCopy()

    /*
     * Why this component tracks the chosen value as well as passing it down.
     *
     * Radix fills the trigger by portalling the selected `Select.ItemText` into
     * the `Select.Value` node, and the items live inside `Select.Content`. While
     * the menu is shut, `Content` renders them into a `DocumentFragment` it
     * builds in a layout effect — which never runs on the server. So a
     * server-rendered trigger holds `<span style="pointer-events:none"></span>`
     * and nothing else, and the label only appears once React has hydrated.
     *
     * Measured on this tree before the fix: `renderToStaticMarkup` of a
     * `SimpleSelect` with `value="gbp"` contained no `British pound` anywhere,
     * and a settings screen whose client bundle had not hydrated showed six
     * blank controls with an entirely clean console — a working page that looked
     * broken, and a flash of empty control on every first paint even when
     * hydration was healthy.
     *
     * The composable parts cannot fix this: only the caller knows what an item's
     * text is. `SimpleSelect` does know — it was handed `options` — so it renders
     * the label itself as `Select.Value`'s children. Radix treats supplied
     * children as authoritative (`onValueNodeHasChildrenChange`) and stops
     * portalling, so there is one copy of the label, present in the SSR HTML and
     * unchanged by hydration.
     *
     * That needs the current value on every render, including after an
     * uncontrolled pick, hence the mirror. A caller that passes `value` still
     * owns it: `useControllableState` defers to a defined `value` and only holds
     * state when there is none.
     */
    const [chosen, setChosen] = useControllableState<string>({
      value,
      // Radix's own "nothing chosen" sentinel, and a value no item may carry.
      defaultValue: defaultValue ?? '',
      onChange: onValueChange,
    })
    const placeholderText = placeholder ?? t('ui.select.placeholder')
    const selectedLabel = options.find(
      (option) => option.value === chosen,
    )?.label
    /*
     * A stored value no option carries, which is the state a schema change
     * leaves behind. Measured on `/settings` before this branch existed: the
     * traveller's language override had been canonicalised to `en` while the
     * control still offered `en-GB`, and the trigger rendered as an empty box —
     * Radix only shows its own placeholder for its "nothing chosen" sentinel
     * (`''`), so a value of `en` made it render the supplied children, and the
     * children were `undefined`.
     *
     * Naming the placeholder ourselves in that case is the honest picture: the
     * control has nothing this reader can act on, so it reads exactly like an
     * untouched one. `undefined` — never `null` — stays the value for the
     * genuinely-empty case, because Radix reads "the caller supplied the text"
     * off `children !== undefined` and a nullish child would block its own
     * portal and leave the trigger blank again.
     */
    const orphaned = chosen !== '' && selectedLabel === undefined
    /*
     * Radix spreads the trigger's own props *after* its `data-placeholder`, so
     * this wins, and `data-[placeholder]:text-ink-4` mutes the orphaned case the
     * same way it mutes an empty one. Undefined leaves Radix's own answer alone.
     */
    const placeholderFlag = selectedLabel === undefined ? '' : undefined

    return (
      <SelectPrimitive.Root
        value={value}
        defaultValue={defaultValue}
        onValueChange={setChosen}
        {...props}
      >
        <SelectTrigger
          ref={ref}
          id={triggerId}
          size={size}
          invalid={invalid}
          className={className}
          aria-label={ariaLabel}
          data-placeholder={placeholderFlag}
        >
          <SelectValue placeholder={placeholderText}>
            {orphaned ? placeholderText : selectedLabel}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              icon={option.icon}
              description={option.description}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectPrimitive.Root>
    )
  },
)
SimpleSelect.displayName = 'SimpleSelect'
