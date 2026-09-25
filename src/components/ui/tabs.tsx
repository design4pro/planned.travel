import * as React from 'react'
import * as TabsPrimitive from 'radix-ui/tabs'

import { cn } from '#/lib/cn'
import { useUiI18n } from './copy'
import {
  ariaDisabledState,
  focusRing,
  transitionBase,
  useControllableState,
} from './shared'

type TabsVariant = 'underline' | 'segmented'
type TabsSize = 'sm' | 'md'

type TabsContextValue = {
  value: string
  variant: TabsVariant
  size: TabsSize
}

const TabsContext = React.createContext<TabsContextValue>({
  value: '',
  variant: 'underline',
  size: 'md',
})

export type TabsProps = Omit<
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>,
  'value' | 'defaultValue' | 'onValueChange'
> & {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  /**
   * `underline` is the page-level tab bar; `segmented` is the pill-on-a-track
   * control used inside a card header.
   */
  variant?: TabsVariant
  size?: TabsSize
}

/**
 * The tab set. Value is tracked here rather than left entirely to Radix,
 * because the segmented variant needs to know the active index to place its
 * sliding thumb — and it slides with `translateX` alone, never with `left` or
 * `width`, so nothing in the row is ever laid out twice.
 */
export const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      className,
      value,
      defaultValue = '',
      onValueChange,
      variant = 'underline',
      size = 'md',
      ...props
    },
    ref,
  ) => {
    const [current, setCurrent] = useControllableState<string>({
      value,
      defaultValue,
      onChange: onValueChange,
    })

    const context = React.useMemo<TabsContextValue>(
      () => ({ value: current, variant, size }),
      [current, variant, size],
    )

    return (
      <TabsContext.Provider value={context}>
        <TabsPrimitive.Root
          ref={ref}
          value={current}
          onValueChange={setCurrent}
          className={cn('flex flex-col', className)}
          {...props}
        />
      </TabsContext.Provider>
    )
  },
)
Tabs.displayName = 'Tabs'

const listVariants = {
  underline: 'relative flex items-center gap-1 border-b border-edge',
  segmented:
    'relative grid auto-cols-fr grid-flow-col gap-0 rounded-full bg-track p-1',
} as const

export type TabsListProps = React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.List
>

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    const { dir } = useUiI18n()
    const { variant, value } = React.useContext(TabsContext)

    // Trigger values are read straight off the children, so the thumb's index
    // is exact without a layout measurement or a resize observer.
    const values = React.Children.toArray(children).flatMap((child) =>
      React.isValidElement<{ value?: string }>(child) &&
      typeof child.props.value === 'string'
        ? [child.props.value]
        : [],
    )
    const activeIndex = values.indexOf(value)

    return (
      <TabsPrimitive.List
        ref={ref}
        className={cn(listVariants[variant], className)}
        {...props}
      >
        {variant === 'segmented' && activeIndex >= 0 ? (
          <span
            aria-hidden="true"
            data-motion-transform=""
            className={cn(
              'pointer-events-none absolute inset-y-1 start-1 rounded-full bg-track-thumb shadow-card',
              'w-[calc((100%-var(--space-2))/var(--tab-count))] translate-x-[calc(var(--tab-index)*var(--tab-dir)*100%)]',
              'transition-transform duration-base ease-out-quint',
            )}
            /**
             * The thumb is anchored at the inline start and walks along the
             * inline axis, so under `dir="rtl"` it has to walk the other way.
             * The sign lives in a custom property rather than in an `rtl:`
             * variant because Tailwind v4 compiles `rtl:` to a zero-specificity
             * `:where()`, which would leave two `translate` utilities to be
             * settled by emission order rather than by intent.
             */
            style={
              {
                '--tab-count': values.length,
                '--tab-index': activeIndex,
                '--tab-dir': dir === 'rtl' ? -1 : 1,
              } as React.CSSProperties
            }
          />
        ) : null}
        {children}
      </TabsPrimitive.List>
    )
  },
)
TabsList.displayName = 'TabsList'

const triggerSizes = {
  underline: { sm: 'h-9 px-2.5 text-caption', md: 'h-11 px-3 text-label' },
  segmented: { sm: 'h-7 px-3 text-caption', md: 'h-9 px-4 text-label' },
} as const

export type TabsTriggerProps = React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.Trigger
> & {
  icon?: React.ReactNode
  /** A count or a status dot pinned after the label. */
  badge?: React.ReactNode
}

export const TabsTrigger = React.forwardRef<
  HTMLButtonElement,
  TabsTriggerProps
>(({ className, icon, badge, children, ...props }, ref) => {
  const { variant, size } = React.useContext(TabsContext)

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        'relative z-1 inline-flex shrink-0 items-center justify-center gap-2 font-medium whitespace-nowrap',
        transitionBase,
        focusRing,
        ariaDisabledState,
        'disabled:pointer-events-none disabled:opacity-45',
        triggerSizes[variant][size],
        variant === 'underline' && [
          'text-ink-3 hover:text-ink data-[state=active]:font-semibold data-[state=active]:text-ink',
          // The underline scales in from its centre — motion without moving
          // anything that other elements are measured against.
          "after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-accent after:content-['']",
          'after:origin-center after:scale-x-0 after:transition-transform after:duration-base after:ease-out-quint',
          'data-[state=active]:after:scale-x-100',
        ],
        variant === 'segmented' && [
          'rounded-full text-ink-3 hover:text-ink',
          'data-[state=active]:font-semibold data-[state=active]:text-ink',
        ],
        className,
      )}
      {...props}
    >
      {icon ? (
        <span
          className="grid size-4 shrink-0 place-items-center [&_svg]:size-4"
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      {children}
      {badge ? <span className="shrink-0">{badge}</span> : null}
    </TabsPrimitive.Trigger>
  )
})
TabsTrigger.displayName = 'TabsTrigger'

export const TabsContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-5 focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring',
      'data-[state=active]:animate-rise',
      className,
    )}
    {...props}
  />
))
TabsContent.displayName = 'TabsContent'
