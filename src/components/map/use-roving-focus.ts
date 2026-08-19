import * as React from 'react'

/**
 * Roving tabindex for a toolbar.
 *
 * `role="toolbar"` is a promise: the whole strip is one tab stop and the arrow
 * keys move between its controls. Ship the role without the behaviour and a
 * keyboard user is worse off than with plain buttons, because their browser's
 * expectations no longer match what the widget does. This hook keeps that promise
 * in about forty lines, for any toolbar that renders its own items.
 */
export type RovingOrientation = 'horizontal' | 'vertical'

export interface RovingFocusOptions {
  /** How many focusable items the toolbar currently renders. */
  readonly count: number
  readonly orientation?: RovingOrientation
  /** Wrap from the last item to the first. Defaults to `true`. */
  readonly loop?: boolean
}

export interface RovingItemProps {
  readonly tabIndex: number
  readonly ref: (node: HTMLButtonElement | null) => void
  readonly onFocus: () => void
}

export interface RovingFocus {
  /** The item that currently owns the toolbar's single tab stop. */
  readonly activeIndex: number
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
  readonly itemProps: (index: number) => RovingItemProps
}

export function useRovingFocus({
  count,
  orientation = 'horizontal',
  loop = true,
}: RovingFocusOptions): RovingFocus {
  const [activeIndex, setActiveIndex] = React.useState(0)
  const nodes = React.useRef<Array<HTMLButtonElement | null>>([])
  const refs = React.useRef(
    new Map<number, (node: HTMLButtonElement | null) => void>(),
  )

  // Items can disappear (a category filter is removed), so the stored index is
  // never trusted directly.
  const active = count === 0 ? 0 : Math.min(activeIndex, count - 1)

  const focusAt = React.useCallback((index: number) => {
    // `.at()` rather than `[index]`: an item can be missing entirely if the
    // toolbar re-rendered with fewer children between keypress and focus.
    const node = nodes.current.at(index) ?? null
    if (node === null) return
    setActiveIndex(index)
    node.focus()
  }, [])

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (count === 0) return
      const forward = orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
      const backward = orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'

      const move = (delta: number): void => {
        event.preventDefault()
        const raw = active + delta
        const next = loop
          ? (raw + count) % count
          : Math.min(count - 1, Math.max(0, raw))
        focusAt(next)
      }

      if (event.key === forward) move(1)
      else if (event.key === backward) move(-1)
      else if (event.key === 'Home') {
        event.preventDefault()
        focusAt(0)
      } else if (event.key === 'End') {
        event.preventDefault()
        focusAt(count - 1)
      }
    },
    [active, count, focusAt, loop, orientation],
  )

  const itemProps = React.useCallback(
    (index: number): RovingItemProps => {
      let ref = refs.current.get(index)
      if (ref === undefined) {
        // Cached so React is not handed a new callback ref on every render,
        // which would detach and reattach every item each time.
        ref = (node: HTMLButtonElement | null): void => {
          nodes.current[index] = node
        }
        refs.current.set(index, ref)
      }
      return {
        tabIndex: index === active ? 0 : -1,
        ref,
        onFocus: () => setActiveIndex(index),
      }
    },
    [active],
  )

  return { activeIndex: active, onKeyDown, itemProps }
}
