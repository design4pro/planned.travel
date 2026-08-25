/**
 * Class fragments and tiny hooks shared by the primitives in this directory.
 *
 * Everything here is expressed in tokens — there is no raw hex, px radius or
 * literal shadow anywhere in `src/components/ui`. Keeping the fragments in one
 * place is what makes "every control has the same ring, the same press and the
 * same disabled treatment" true by construction instead of by discipline.
 */
import * as React from 'react'

/**
 * The one focus treatment in the product. Drawn outside the control.
 *
 * `outline-solid` is load-bearing, and `outline-none` must not appear here.
 *
 * In Tailwind v4 the outline utilities share one `--tw-outline-style` custom
 * property: `outline-none` sets it to `none`, and `outline-2` then resolves
 * `outline-style: var(--tw-outline-style)` against that. Pairing them — as this
 * constant used to — produced a focus ring two pixels wide and styled `none`,
 * so every control built on it had no visible focus ring at all while still
 * reporting a focus colour. Stating the style explicitly under the same variant
 * is what makes the ring real. The unfocused case needs no suppression: the base
 * layer already carries `:focus:not(:focus-visible) { outline: none }`.
 */
export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring'

/** Same ring, drawn inward — for controls flush against a panel edge. */
export const focusRingInset =
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-ring'

/** Ring for a wrapper that receives focus on behalf of a nested input. */
export const focusWithinRing =
  'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring'

export const disabledState =
  'disabled:pointer-events-none disabled:opacity-45 disabled:shadow-none'

/**
 * The inactive base for a control that carries its own label.
 *
 * Deliberately no `opacity`: fading the element dims the label along with the
 * fill, so a disabled primary lands at about 2.9:1 and reads as a broken button
 * rather than a waiting one. Each variant repaints instead — see
 * `buttonVariants` — landing on `ink-4`, which clears 4.5:1 on every surface in
 * both themes. Unchecked boxes, switches and radios keep {@link disabledState}:
 * they have no label of their own to keep readable.
 */
export const disabledLabelled =
  'disabled:pointer-events-none disabled:shadow-none aria-disabled:pointer-events-none'

export const ariaDisabledState =
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-45'

/**
 * Transform and opacity plus the paint-only properties. Never `width`,
 * `height`, `top` or `margin` — layout is not animated in this system.
 *
 * `translate`, `scale` and `rotate` are named alongside `transform` because
 * Tailwind v4 compiles `-translate-y-px`, `scale-98` and `rotate-180` to those
 * three standalone CSS properties rather than to `transform` — measured against
 * the pinned compiler, which also expands the built-in `transition-transform`
 * to exactly this set. Listing only `transform`, as this constant used to, left
 * every hover lift and every press in the directory snapping instantly while
 * the class that produced it looked animated.
 */
export const transitionBase =
  'transition-[color,background-color,border-color,outline-color,box-shadow,transform,translate,scale,rotate,opacity] duration-fast ease-out-quint'

export const transitionSlow =
  'transition-[color,background-color,border-color,box-shadow,transform,translate,scale,rotate,opacity] duration-base ease-out-quint'

/** Full-bleed scrim behind Dialog and Sheet. */
export const overlaySurface =
  'fixed inset-0 z-overlay bg-overlay data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out'

/** The floating-panel treatment: hairline, surface, dropdown shadow. */
export const layerSurface =
  'rounded-lg border border-edge bg-surface shadow-dropdown'

/** Enter/exit choreography for a Radix popper layer. */
export const popMotion =
  'origin-(--radix-popper-transform-origin) data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out'

/** A row inside DropdownMenu / ContextMenu / Select / Combobox. */
export const menuItemBase = [
  'relative flex cursor-default select-none items-center gap-2.5 rounded-md px-2.5 py-2',
  'text-label text-ink-2 outline-none',
  transitionBase,
  'data-[highlighted]:bg-hover data-[highlighted]:text-ink',
  'data-[state=checked]:text-ink data-[state=checked]:font-semibold',
  ariaDisabledState,
].join(' ')

export const menuLabelBase =
  'px-2.5 pt-2.5 pb-1.5 text-micro uppercase tracking-label text-ink-3'

export const menuSeparatorBase = '-mx-1 my-1.5 h-px bg-edge-faint'

/**
 * Shared shell for Input / Textarea / Select trigger / Combobox trigger.
 * `--color-edge-strong` gives every control a 3:1 boundary (WCAG 2.2 1.4.11)
 * without the heaviness of a full-contrast border.
 */
export const fieldSurface = [
  'w-full rounded-md border border-edge-strong bg-surface text-ink',
  'placeholder:text-ink-4',
  transitionBase,
  'hover:border-ink-4',
  'focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-0 focus-visible:outline-ring',
  'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-4 disabled:opacity-70 disabled:hover:border-edge-strong',
  'aria-[invalid=true]:border-danger aria-[invalid=true]:outline-danger',
].join(' ')

export const fieldSizes = {
  sm: 'h-8 px-2.5 text-caption',
  md: 'h-10 px-3 text-label',
  lg: 'h-12 px-3.5 text-body',
} as const

export type FieldSize = keyof typeof fieldSizes

/**
 * Icon box sizes paired to each control size, in 4px-grid steps. Numbers,
 * because they go to a `lucide-react` `size` prop.
 */
export const iconSizes = { sm: 14, md: 16, lg: 18 } as const

/**
 * The same three sizes as CSS, for a slot that holds an icon it was *handed*
 * rather than one it rendered itself.
 *
 * `lucide-react` defaults to `width="24" height="24"` as presentation
 * attributes. A presentation attribute is beaten by any CSS rule but by nothing
 * else, so a slot that only sizes its own box gets a 24px drawing inside a 14px
 * box — the icon overflows, the gap next to it disappears, and every icon in the
 * product ends up the same size whatever size was asked for. Sizing the
 * descendant `svg` is the half that actually constrains the drawing.
 */
export const iconBoxes = {
  sm: 'size-3.5 [&_svg]:size-3.5',
  md: 'size-4 [&_svg]:size-4',
  lg: 'size-[1.125rem] [&_svg]:size-[1.125rem]',
} as const

/**
 * Controlled-or-uncontrolled state, the pattern every one of our composite
 * controls (Combobox, DatePicker, PillNav, Pagination) needs.
 */
export function useControllableState<T>(options: {
  value: T | undefined
  defaultValue: T
  onChange?: (next: T) => void
}): [T, (next: T) => void] {
  const { value, defaultValue, onChange } = options
  const isControlled = value !== undefined
  const [uncontrolled, setUncontrolled] = React.useState<T>(defaultValue)
  const current = isControlled ? value : uncontrolled

  const set = React.useCallback(
    (next: T) => {
      if (!isControlled) setUncontrolled(next)
      onChange?.(next)
    },
    [isControlled, onChange],
  )

  return [current, set]
}

/**
 * True once the component has mounted on the client. Used to keep animated
 * primitives from playing their entrance during hydration, which would
 * otherwise read as layout shift on first paint.
 */
export function useHasMounted(): boolean {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  return mounted
}

/**
 * Stagger delays for list entrances: 24ms apart, capped at 8 items so a long
 * list never makes the reader wait on an animation queue.
 */
export function staggerDelay(index: number, step = 24, cap = 8): string {
  return `${Math.min(index, cap) * step}ms`
}
